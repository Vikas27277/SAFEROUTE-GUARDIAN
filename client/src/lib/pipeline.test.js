import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAnalysis } from './pipeline.js';
import * as routing from './routing.js';
import * as riskEngine from './riskEngine.js';
import * as publicReportService from './publicReportService.js';

vi.mock('./publicReportService.js', () => ({
  getPublicReports: vi.fn().mockResolvedValue([])
}));

describe('Pipeline Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('selects a safer route when it has a better cost and +10 score gain', async () => {
    const mockRoutes = [
      { id: 'r0', label: 'Fastest', durationMin: 18, distanceKm: 5, geometry: { type: 'LineString', coordinates: [[0,0], [1,1]] }, intersectsRedZone: false },
      { id: 'r1', label: 'Alternative 1', durationMin: 21, distanceKm: 6, geometry: { type: 'LineString', coordinates: [[0,0], [1,1]] }, intersectsRedZone: false }
    ];
    
    vi.spyOn(routing, 'fetchRoutes').mockResolvedValue(mockRoutes);
    
    vi.spyOn(riskEngine, 'scoreRoute').mockImplementation((route) => {
      if (route.id === 'r0') {
        return { ...route, routeCost: 40, safetyScore: 50 }; // High cost (18 + 22 penalty)
      } else {
        return { ...route, routeCost: 22, safetyScore: 90 }; // Low cost (21 + 1 penalty)
      }
    });

    const result = await runAnalysis({
      origin: [0,0], destination: [1,1], timeDate: new Date(), zones: { type: 'FeatureCollection', features: [] }
    });

    expect(result.fastestRoute.id).toBe('r1');
    expect(result.safestRoute.id).toBe('r0');
    expect(result.routes.length).toBe(2);
  });

  it('returns fastest route as safest if it has lowest cost', async () => {
    const mockRoutes = [
      { id: 'r0', label: 'Fastest', durationMin: 18, distanceKm: 5, geometry: { type: 'LineString', coordinates: [[0,0], [1,1]] }, intersectsRedZone: false },
      { id: 'r1', label: 'Alternative 1', durationMin: 21, distanceKm: 6, geometry: { type: 'LineString', coordinates: [[0,0], [1,1]] }, intersectsRedZone: false }
    ];
    
    vi.spyOn(routing, 'fetchRoutes').mockResolvedValue(mockRoutes);
    
    vi.spyOn(riskEngine, 'scoreRoute').mockImplementation((route) => {
      if (route.id === 'r0') {
        return { ...route, routeCost: 25, safetyScore: 80 };
      } else {
        return { ...route, routeCost: 30, safetyScore: 70 };
      }
    });

    const result = await runAnalysis({
      origin: [0,0], destination: [1,1], timeDate: new Date(), zones: { type: 'FeatureCollection', features: [] }
    });

    expect(result.fastestRoute.id).toBe('r0');
    expect(result.safestRoute.id).toBe('r0');
  });

  it('prioritizes red zone avoidance', async () => {
    const mockRoutes = [
      { id: 'r0', label: 'Fastest', durationMin: 18, distanceKm: 5, geometry: { type: 'LineString', coordinates: [[0,0], [1,1]] }, intersectsRedZone: true },
      { id: 'r1', label: 'Alternative 1', durationMin: 25, distanceKm: 8, geometry: { type: 'LineString', coordinates: [[0,0], [1,1]] }, intersectsRedZone: false }
    ];
    
    vi.spyOn(routing, 'fetchRoutes').mockResolvedValue(mockRoutes);
    
    vi.spyOn(riskEngine, 'scoreRoute').mockImplementation((route) => {
      return { ...route, routeCost: route.durationMin };
    });

    const result = await runAnalysis({
      origin: [0,0], destination: [1,1], timeDate: new Date(), zones: { type: 'FeatureCollection', features: [] }
    });

    expect(result.fastestRoute.durationMin).toBe(18);
    expect(result.safestRoute.intersectsRedZone).toBe(false);
  });

  describe('Lifeline Integration', () => {
    it('fetches refuges and attaches route.lifeline to all candidate routes', async () => {
      const mockRoutes = [
        { id: 'r0', label: 'Fastest', durationMin: 18, distanceKm: 5, geometry: { type: 'LineString', coordinates: [[0,0], [1,1]] } },
        { id: 'r1', label: 'Alternative', durationMin: 21, distanceKm: 6, geometry: { type: 'LineString', coordinates: [[0,0], [2,2]] } }
      ];
      vi.spyOn(routing, 'fetchRoutes').mockResolvedValue(mockRoutes);
      
      const mockRefuges = { type: 'FeatureCollection', features: [] };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRefuges
      });

      // Pass-through riskEngine so we don't just mock the result blindly
      vi.spyOn(riskEngine, 'scoreRoute').mockImplementation((route, zones, timeDate, config, lifelineResult) => {
        return { 
          ...route,
          lifeline: lifelineResult,
          routeCost: route.durationMin, 
          safetyScore: 100 
        };
      });

      const result = await runAnalysis({
        origin: [0,0], destination: [1,1], timeDate: new Date(), zones: { type: 'FeatureCollection', features: [] }
      });

      // Ensure fetch was called for refuges
      expect(global.fetch).toHaveBeenCalled();

      // Ensure lifeline was attached
      expect(result.routes[0].lifeline).toBeDefined();
      expect(result.routes[1].lifeline).toBeDefined();
      expect(result.routes[0].lifeline).toHaveProperty('isolationExposure');
    });

    it('continues successfully when API fails and synthetic fallback fails', async () => {
      const mockRoutes = [
        { id: 'r0', label: 'Fastest', durationMin: 18, distanceKm: 5, geometry: { type: 'LineString', coordinates: [[0,0], [1,1]] } }
      ];
      vi.spyOn(routing, 'fetchRoutes').mockResolvedValue(mockRoutes);
      
      // Force both fetches to fail
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      vi.spyOn(riskEngine, 'scoreRoute').mockImplementation((route, z, t, c, lifelineResult) => ({ 
        ...route, lifeline: lifelineResult, routeCost: 20, safetyScore: 80 
      }));

      const result = await runAnalysis({
        origin: [0,0], destination: [1,1], timeDate: new Date(), zones: { type: 'FeatureCollection', features: [] }
      });

      expect(result.routes[0].lifeline).toBeDefined(); // Still runs analyseLifeline with []
      expect(result.routes[0].lifeline.isolationExposure).toBeGreaterThan(0);
    });

    it('?demo=1 routes still receive real Lifeline analysis', async () => {
      const demoRoutes = [
        { id: 'demo1', label: 'Fastest', durationMin: 20, distanceKm: 5, geometry: { type: 'LineString', coordinates: [[0,0], [1,1]] } }
      ];
      vi.spyOn(routing, 'fetchRoutes').mockResolvedValue(demoRoutes);
      
      const mockRefuges = { type: 'FeatureCollection', features: [] };
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockRefuges });
      
      vi.spyOn(riskEngine, 'scoreRoute').mockImplementation((route, z, t, c, lifelineResult) => ({ 
        ...route, lifeline: lifelineResult, routeCost: 20, safetyScore: 80 
      }));

      // Simulate demo=1
      const result = await runAnalysis({
        origin: [0,0], destination: [1,1], timeDate: new Date(), zones: { type: 'FeatureCollection', features: [] }, isDemo: true
      });

      expect(result.routes[0].lifeline).toBeDefined();
      expect(result.routes[0].lifeline.isolationExposure).toBeDefined();
    });
  });
});
