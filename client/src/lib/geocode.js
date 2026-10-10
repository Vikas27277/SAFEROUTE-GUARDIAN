export async function geocode(q, { signal } = {}) {
  if (!q || typeof q !== 'string' || q.trim().length < 2) return [];
  
  const isDemo = typeof window !== 'undefined' && window.location.search.includes('demo=1');
  
  if (isDemo) {
    // Deterministic mock data for demo presentation
    const lowerQ = q.toLowerCase();
    const mocks = [
      { label: 'M G Road, Bengaluru, Karnataka', coords: [77.607421, 12.973413] },
      { label: 'Indiranagar, Bengaluru, Karnataka', coords: [77.638708, 12.978281] },
      { label: 'Koramangala, Bengaluru, Karnataka', coords: [77.620020, 12.927923] },
      { label: 'Jayanagar, Bengaluru, Karnataka', coords: [77.5833, 12.9298] },
      { label: 'Malleshwaram, Bengaluru, Karnataka', coords: [77.5683, 13.0031] }
    ];
    
    return mocks.filter(m => m.label.toLowerCase().includes(lowerQ));
  }

  const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
  const url = `${apiBase}/api/places/search?q=${encodeURIComponent(q.trim())}`;
  
  try {
    const r = await fetch(url, { signal });
    const payload = await r.json().catch(() => null);
    if (!r.ok) {
      const message = payload?.error || (r.status === 429
        ? 'Place search is rate limited. Wait a moment and try again.'
        : `Place search failed (HTTP ${r.status}).`);
      throw new Error(message);
    }

    if (!Array.isArray(payload)) {
      throw new Error('Place search returned an invalid response. Please try again.');
    }

    return payload.filter(place =>
      typeof place?.label === 'string' &&
      Array.isArray(place.coords) &&
      place.coords.length === 2 &&
      place.coords.every(Number.isFinite) &&
      Math.abs(place.coords[0]) <= 180 &&
      Math.abs(place.coords[1]) <= 90
    );
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    if (error instanceof TypeError) {
      throw new Error('Cannot reach the place search server. Confirm the Express server is running.');
    }
    throw error;
  }
}
