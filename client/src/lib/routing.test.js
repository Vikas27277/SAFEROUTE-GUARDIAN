import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRoutes } from './routing.js';

describe('Routing Service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'test_token');
  });

  it('throws error if token is missing', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');
    await expect(fetchRoutes([0,0], [1,1])).rejects.toThrow('Mapbox token is missing');
  });

  it('throws error if coordinates are invalid', async () => {
    await expect(fetchRoutes(null, [1,1])).rejects.toThrow('Invalid coordinates provided');
  });

  it('fetches, normalizes, sorts, and deduplicates routes', async () => {
    const mockResponse = {
      routes: [
        { duration: 1200, distance: 10000, geometry: { type: 'LineString', coordinates: [[0,0], [1,1]] } }, // 20 min, 10 km
        { duration: 600, distance: 5000, geometry: { type: 'LineString', coordinates: [[0,0], [0.5,0.5]] } }, // 10 min, 5 km (Fastest)
        { duration: 610, distance: 5050, geometry: { type: 'LineString', coordinates: [[0,0], [0.6,0.6]] } } // 10.16 min, 5.05 km (Duplicate)
      ]
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const routes = await fetchRoutes([0,0], [1,1], 'driving');

    // Should fetch with correct URL
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.mapbox.com/directions/v5/mapbox/driving/0,0;1,1?alternatives=true&geometries=geojson&overview=full&access_token=test_token'),
      expect.anything()
    );

    // Should have 2 routes (3rd is duplicate of 2nd)
    expect(routes.length).toBe(2);

    // Fastest should be first
    expect(routes[0].durationMin).toBe(10);
    expect(routes[0].distanceKm).toBe(5);
    expect(routes[0].label).toBe('Fastest');
    expect(routes[0].id).toBe('r0');

    // Alternative should be second
    expect(routes[1].durationMin).toBe(20);
    expect(routes[1].distanceKm).toBe(10);
    expect(routes[1].label).toBe('Alternative 1');
    expect(routes[1].id).toBe('r1');
  });

  it('handles API errors gracefully', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized'
    });

    await expect(fetchRoutes([0,0], [1,1])).rejects.toThrow('Mapbox API error: 401 Unauthorized');
  });

  it('handles empty routes gracefully', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ routes: [] })
    });

    await expect(fetchRoutes([0,0], [1,1])).rejects.toThrow('No route found');
  });
});
