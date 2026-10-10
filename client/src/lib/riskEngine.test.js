import { describe, it, expect } from 'vitest';
import { scoreRoute } from './riskEngine.js';
import { analyseRoute } from './spatial.js';
import { analyseLifeline } from './lifeline.js';
import { DEFAULT_CONFIG } from '../../../shared/scoringConfig.js';
import * as turf from '@turf/turf';

describe('Risk Engine', () => {
  const createZone = (id, risk, coordinates) => turf.polygon([coordinates], { id, risk });
  const zones = turf.featureCollection([
    createZone('red1', 'red', [[0,0], [0,1], [1,1], [1,0], [0,0]]),
    createZone('yellow1', 'yellow', [[2,2], [2,3], [3,3], [3,2], [2,2]]),
    createZone('green1', 'green', [[4,4], [4,5], [5,5], [5,4], [4,4]])
  ]);

  const createRoute = (id, coordinates, durationMin) => ({
    id,
    durationMin,
    geometry: turf.lineString(coordinates).geometry
  });

  it('scores a route through a red zone', () => {
    const start = [0.1, 0.1];
    const end = [0.9, 0.9];
    const route = createRoute('r1', [start, end], 10);
    const dateDay = new Date('2023-01-01T12:00:00');
    
    const result = scoreRoute(route, zones, dateDay, DEFAULT_CONFIG);
    
    expect(result.exposureKm.red).toBeGreaterThan(0);
    expect(result.riskPenaltyMin).toBeGreaterThan(0);
    expect(result.safetyScore).toBeLessThan(100);
    expect(result.crossedZones).toContain('red1');
  });

  it('keeps a typical-length route score informative instead of saturating at zero', () => {
    const route = createRoute('r_typical', [[0.1, 0.1], [0.14, 0.14]], 10);
    const result = scoreRoute(route, zones, new Date('2023-01-01T12:00:00'), DEFAULT_CONFIG);

    expect(result.exposureKm.red).toBeGreaterThan(0);
    expect(result.safetyScore).toBeGreaterThan(0);
    expect(result.safetyScore).toBeLessThan(100);
  });
  
  it('scores a route through a yellow zone', () => {
    const route = createRoute('r2', [[2.1, 2.1], [2.9, 2.9]], 10);
    const dateDay = new Date('2023-01-01T12:00:00');
    const result = scoreRoute(route, zones, dateDay, DEFAULT_CONFIG);
    
    expect(result.exposureKm.yellow).toBeGreaterThan(0);
    expect(result.exposureKm.red).toBe(0);
    expect(result.crossedZones).toContain('yellow1');
  });

  it('scores a route through only green zones', () => {
    const route = createRoute('r3', [[4.1, 4.1], [4.9, 4.9]], 10);
    const dateDay = new Date('2023-01-01T12:00:00');
    const result = scoreRoute(route, zones, dateDay, DEFAULT_CONFIG);
    
    expect(result.exposureKm.green).toBeGreaterThan(0);
    expect(result.crossedZones).toContain('green1');
  });

  it('scores a route with no risk zones', () => {
    const route = createRoute('r4', [[10, 10], [11, 11]], 10);
    const dateDay = new Date('2023-01-01T12:00:00');
    const result = scoreRoute(route, zones, dateDay, DEFAULT_CONFIG);
    
    expect(result.exposureKm.none).toBeGreaterThan(0);
    expect(result.exposureKm.red).toBe(0);
    expect(result.exposureKm.yellow).toBe(0);
    expect(result.exposureKm.green).toBe(0);
    expect(result.riskPenaltyMin).toBe(0);
    expect(result.safetyScore).toBe(100);
    expect(result.routeCost).toBe(10);
  });

  it('applies different time-of-day multipliers', () => {
    const route = createRoute('r1', [[0.1, 0.1], [0.11, 0.11]], 10);
    const dateDay = new Date('2023-01-01T12:00:00');
    const dateNight = new Date('2023-01-01T02:00:00');
    
    const resultDay = scoreRoute(route, zones, dateDay, DEFAULT_CONFIG);
    const resultNight = scoreRoute(route, zones, dateNight, DEFAULT_CONFIG);
    
    expect(resultNight.riskPenaltyMin).toBeGreaterThan(resultDay.riskPenaltyMin);
    expect(resultNight.safetyScore).toBeLessThan(resultDay.safetyScore);
  });

  it('keeps Safety Score between 0 and 100', () => {
    // Generate a very long route to push the score to 0
    const routeCoords = Array.from({ length: 50 }, (_, i) => [i/100, i/100]);
    const route = createRoute('r1', routeCoords, 10);
    const dateNight = new Date('2023-01-01T02:00:00');
    const result = scoreRoute(route, zones, dateNight, DEFAULT_CONFIG);
    
    expect(result.safetyScore).toBeGreaterThanOrEqual(0);
    expect(result.safetyScore).toBeLessThanOrEqual(100);
  });

  describe('Lifeline Integration', () => {
    const route = createRoute('r_life', [[10, 10], [10, 10.1]], 10); // ~11km route
    const dateDay = new Date('2023-01-01T12:00:00');
    
    // A refuge very far away
    const farRefuges = turf.featureCollection([
      turf.point([0, 0], { id: 'r1', openFrom: 0, openTo: 24 })
    ]);
    
    // A refuge right on top of the route
    const nearRefuges = turf.featureCollection([
      turf.point([10, 10.05], { id: 'r2', openFrom: 0, openTo: 24 })
    ]);

    // Use analyseRoute to get segments just like the pipeline does
    const { segments } = analyseRoute(route.geometry, zones);

    it('returns 0 isolation and unchanged score when no Lifeline data is supplied', () => {
      const result = scoreRoute(route, zones, dateDay, DEFAULT_CONFIG);
      expect(result.isolationExposure).toBe(0);
      expect(result.safetyScore).toBe(100); // Because no zones and no lifeline
    });

    it('route with greater isolation receives a lower Safety Score', () => {
      const nearLifeline = analyseLifeline(segments, nearRefuges, dateDay, DEFAULT_CONFIG);
      const farLifeline = analyseLifeline(segments, farRefuges, dateDay, DEFAULT_CONFIG);
      const nearResult = scoreRoute(route, zones, dateDay, DEFAULT_CONFIG, nearLifeline);
      const farResult = scoreRoute(route, zones, dateDay, DEFAULT_CONFIG, farLifeline);
      
      expect(farResult.isolationExposure).toBeGreaterThan(nearResult.isolationExposure);
      expect(farResult.safetyScore).toBeLessThan(nearResult.safetyScore);
    });

    it('isolationWeight = 0 means isolation contributes nothing to score', () => {
      const cfgZero = {
        ...DEFAULT_CONFIG,
        lifeline: { ...DEFAULT_CONFIG.lifeline, isolationWeight: 0 }
      };
      
      const farLifeline = analyseLifeline(segments, farRefuges, dateDay, cfgZero);
      const farResult = scoreRoute(route, zones, dateDay, cfgZero, farLifeline);
      expect(farResult.safetyScore).toBe(100); // Unchanged from base score
    });

    it('isolationWeight = 1 contributes to scoring formula', () => {
      const cfgOne = {
        ...DEFAULT_CONFIG,
        lifeline: { ...DEFAULT_CONFIG.lifeline, isolationWeight: 1.0 }
      };
      
      const farLifeline = analyseLifeline(segments, farRefuges, dateDay, cfgOne);
      const farResult = scoreRoute(route, zones, dateDay, cfgOne, farLifeline);
      expect(farResult.safetyScore).toBeLessThan(100);
    });

    it('combines existing zone exposure and Lifeline isolation', () => {
      // Route through a red zone, but short enough that score > 0
      const redRoute = createRoute('r_red', [[0.1, 0.1], [0.11, 0.11]], 10);
      const redSegments = analyseRoute(redRoute.geometry, zones).segments;
      const farLifeline = analyseLifeline(redSegments, farRefuges, dateDay, DEFAULT_CONFIG);
      
      const baseResult = scoreRoute(redRoute, zones, dateDay, DEFAULT_CONFIG);
      const lifeResult = scoreRoute(redRoute, zones, dateDay, DEFAULT_CONFIG, farLifeline);
      
      // Both are included, so it should be strictly worse than base
      expect(lifeResult.safetyScore).toBeLessThan(baseResult.safetyScore);
      expect(lifeResult.isolationExposure).toBeGreaterThan(0);
      expect(lifeResult.exposureKm.red).toBeGreaterThan(0);
    });

    it('keeps Safety Score clamped to 0–100 even with extreme isolation', () => {
      const longRoute = createRoute('r_long', Array.from({ length: 100 }, (_, i) => [10 + i/100, 10 + i/100]), 60);
      const cfgExtreme = {
        ...DEFAULT_CONFIG,
        lifeline: { ...DEFAULT_CONFIG.lifeline, isolationWeight: 100.0 }
      };
      const longSegments = analyseRoute(longRoute.geometry, zones).segments;
      const farLifeline = analyseLifeline(longSegments, farRefuges, dateDay, cfgExtreme);
      
      const farResult = scoreRoute(longRoute, zones, dateDay, cfgExtreme, farLifeline);
      
      expect(farResult.safetyScore).toBeGreaterThanOrEqual(0);
      expect(farResult.safetyScore).toBeLessThanOrEqual(100);
    });
  });
});
