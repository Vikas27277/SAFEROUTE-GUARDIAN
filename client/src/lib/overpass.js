const GRID_SIZE = 0.05; // Approx 5km grid
const fetchedGrids = new Set();

export async function fetchLifelinePOIs(bounds) {
  if (!bounds) return [];
  
  let s, w, n, e;
  if (typeof bounds.getSouth === 'function') {
    s = bounds.getSouth();
    w = bounds.getWest();
    n = bounds.getNorth();
    e = bounds.getEast();
  } else if (bounds._sw && bounds._ne) {
    s = bounds._sw.lat;
    w = bounds._sw.lng;
    n = bounds._ne.lat;
    e = bounds._ne.lng;
  } else {
    return [];
  }

  const minX = Math.floor(w / GRID_SIZE);
  const maxX = Math.floor(e / GRID_SIZE);
  const minY = Math.floor(s / GRID_SIZE);
  const maxY = Math.floor(n / GRID_SIZE);
  
  let needsFetch = false;
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      if (!fetchedGrids.has(`${x},${y}`)) {
        needsFetch = true;
        break;
      }
    }
  }
  
  if (!needsFetch) return []; // Already fetched this area
  
  // Mark as fetched (optimistically)
  const newlyFetched = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      if (!fetchedGrids.has(`${x},${y}`)) {
        fetchedGrids.add(`${x},${y}`);
        newlyFetched.push(`${x},${y}`);
      }
    }
  }
  
  const query = `
    [out:json][timeout:25];
    (
      nwr["amenity"~"pharmacy|hospital|police|fuel"](${s},${w},${n},${e});
    );
    out center;
  `;
  
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query
    });
    
    if (!res.ok) {
      throw new Error(`Overpass API error: ${res.status}`);
    }
    
    const data = await res.json();
    return parseOverpassData(data.elements || []);
    
  } catch (err) {
    console.error('Failed to fetch POIs from Overpass:', err);
    // Revert optimistic fetch status so we can try again later
    newlyFetched.forEach(key => fetchedGrids.delete(key));
    return [];
  }
}

function parseOverpassData(elements) {
  const pois = [];
  
  for (const el of elements) {
    const lat = el.lat || el.center?.lat;
    const lon = el.lon || el.center?.lon;
    if (!lat || !lon) continue;
    
    const tags = el.tags || {};
    let type = tags.amenity;
    if (type === 'fuel') type = 'petrol'; // Normalize
    
    const name = tags.name || tags['name:en'] || `Unknown ${type}`;
    const phone = tags.phone || tags['contact:phone'] || null;
    const opening_hours = tags.opening_hours || null;
    
    // Address
    const street = tags['addr:street'];
    const housenumber = tags['addr:housenumber'];
    const city = tags['addr:city'];
    let address = null;
    if (street) {
      address = housenumber ? `${housenumber} ${street}` : street;
      if (city) address += `, ${city}`;
    }
    
    pois.push({
      id: `${el.type}/${el.id}`,
      type,
      name,
      coords: [lon, lat],
      phone,
      opening_hours,
      address,
      source: 'OpenStreetMap'
    });
  }
  
  return pois;
}
