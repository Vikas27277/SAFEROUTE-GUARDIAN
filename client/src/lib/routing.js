export async function fetchRoutes(origin, destination, mode = 'driving', waypoints = []) {
  // Use import.meta.env for Vite, fallback to process.env for Node/Test environments
  const token = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MAPBOX_TOKEN) 
                || (typeof process !== 'undefined' && process.env && process.env.VITE_MAPBOX_TOKEN);
                
  if (!token) {
    throw new Error('Mapbox token is missing');
  }
  
  if (!origin || !destination || origin.length !== 2 || destination.length !== 2) {
    throw new Error('Invalid coordinates provided');
  }

  const waypointString = waypoints.length > 0 ? ';' + waypoints.map(wp => `${wp[0]},${wp[1]}`).join(';') : '';
  const path = `${origin[0]},${origin[1]}${waypointString};${destination[0]},${destination[1]}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/${mode}/${path}?alternatives=true&geometries=geojson&overview=full&access_token=${token}`;
  const cacheKey = `mapbox_${path}_${mode}`;

  const isDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';

  if (isDemo) {
    const cached = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
    if (cached) {
      console.log('Using cached routes for demo mode');
      return JSON.parse(cached);
    }
  }

  let response;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null;

  try {
    response = await fetch(url, { signal: controller?.signal });
    if (timeoutId) clearTimeout(timeoutId);
  } catch (err) {
    console.error('Mapbox API error:', err);
    if (err.name === 'AbortError') {
      throw new Error('Network timeout connecting to Mapbox API. Please check your connection.');
    }
    const cached = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
    if (cached) {
      console.log('Network failed, falling back to cached routes');
      return JSON.parse(cached);
    }
    throw new Error('Network error connecting to Mapbox API');
  }

  if (!response.ok) {
    throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.routes || data.routes.length === 0) {
    throw new Error('No route found');
  }

  // Normalize
  let routes = data.routes.map((rt, index) => ({
    id: `route_${index}`,
    label: index === 0 ? 'Fastest' : `Alternative ${index}`,
    durationMin: rt.duration / 60,
    distanceKm: rt.distance / 1000,
    geometry: rt.geometry // GeoJSON LineString
  }));

  // Sort by travel time (fastest first)
  routes.sort((a, b) => a.durationMin - b.durationMin);
  
  // Deduplicate similar routes (e.g. ±0.5 min duration and ±2% distance)
  const uniqueRoutes = [];
  for (const rt of routes) {
    const isDuplicate = uniqueRoutes.some(existing => {
      const durDiff = Math.abs(existing.durationMin - rt.durationMin);
      const distDiff = Math.abs(existing.distanceKm - rt.distanceKm) / existing.distanceKm;
      return durDiff < 0.5 && distDiff < 0.02;
    });
    
    if (!isDuplicate) {
      uniqueRoutes.push(rt);
    }
  }

  // Re-label after deduplication
  const finalRoutes = uniqueRoutes.map((rt, index) => ({
    ...rt,
    id: `r${index}`,
    label: index === 0 ? 'Fastest' : `Alternative ${index}`
  }));

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(finalRoutes));
    } catch (e) {
      console.warn('Failed to cache routes:', e);
    }
  }

  return finalRoutes;
}

