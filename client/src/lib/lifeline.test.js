import { describe, it, expect } from 'vitest';
import * as turf from '@turf/turf';
import { isOpenAt, analyseLifeline } from './lifeline.js';

describe('Lifeline Analysis', () => {
  const cfg = {
    lifeline: {
      refugeRadiusKm: 0.25,
      maxHelpDistanceKm: 1.0,
      isolationWeight: 1.0,
      unprotectedStretchWarnKm: 0.4
    }
  };

  describe('isOpenAt', () => {
    it('1. 24-hour refuge returns true during daytime and late night', () => {
      const r = { properties: { openFrom: 0, openTo: 24 } };
      expect(isOpenAt(r, 12)).toBe(true);
      expect(isOpenAt(r, 3)).toBe(true);
    });

    it('2. Normal daytime opening correctly handles boundaries', () => {
      const r = { properties: { openFrom: 9, openTo: 17 } };
      expect(isOpenAt(r, 8)).toBe(false);
      expect(isOpenAt(r, 9)).toBe(true);
      expect(isOpenAt(r, 16)).toBe(true);
      expect(isOpenAt(r, 17)).toBe(false);
    });

    it('3. Overnight refuge correctly handles boundaries', () => {
      const r = { properties: { openFrom: 20, openTo: 6 } };
      expect(isOpenAt(r, 22)).toBe(true);
      expect(isOpenAt(r, 2)).toBe(true);
      expect(isOpenAt(r, 12)).toBe(false);
      expect(isOpenAt(r, 20)).toBe(true);
      expect(isOpenAt(r, 6)).toBe(false);
    });
  });

  describe('analyseLifeline', () => {
    const routeGeom = turf.lineString([[0, 0], [0, 0.01]]); // ~1.1km line
    const segments = turf.lineChunk(routeGeom, 0.5, { units: 'kilometers' });

    it('4. Route close to an open refuge has zero/small unprotected stretch', () => {
      const refuges = turf.featureCollection([
        turf.point([0, 0.0025], { id: 'r1', openFrom: 0, openTo: 24 }),
        turf.point([0, 0.0075], { id: 'r2', openFrom: 0, openTo: 24 })
      ]);
      const date = new Date('2024-01-01T12:00:00');
      const result = analyseLifeline(segments, refuges, date, cfg);
      
      expect(result.longestUnprotectedStretchKm).toBeLessThan(0.01);
      expect(result.perChunk.length).toBeGreaterThan(0);
      expect(result.worstDistanceKm).toBeLessThan(0.25);
    });

    it('5. Route far from open refuge treated as unprotected', () => {
      const refuges = turf.featureCollection([
        turf.point([1, 1], { id: 'r1', openFrom: 0, openTo: 24 })
      ]);
      const date = new Date('2024-01-01T12:00:00');
      const result = analyseLifeline(segments, refuges, date, cfg);
      
      expect(result.longestUnprotectedStretchKm).toBeGreaterThan(0.5);
      expect(result.worstDistanceKm).toBeGreaterThan(10);
    });

    it('6. Closing nearby refuge increases worst distance', () => {
      const refuges = turf.featureCollection([
        turf.point([0, 0.005], { id: 'r1', openFrom: 8, openTo: 18 }) 
      ]);
      
      const dayDate = new Date('2024-01-01T12:00:00'); 
      const nightDate = new Date('2024-01-01T20:00:00'); 
      
      const dayResult = analyseLifeline(segments, refuges, dayDate, cfg);
      const nightResult = analyseLifeline(segments, refuges, nightDate, cfg);
      
      expect(nightResult.worstDistanceKm).toBeGreaterThan(dayResult.worstDistanceKm);
      expect(nightResult.worstDistanceKm).toBe(999);
    });

    it('7. No refuges returns valid result without throwing', () => {
      const date = new Date('2024-01-01T12:00:00');
      const result = analyseLifeline(segments, turf.featureCollection([]), date, cfg);
      expect(result.worstDistanceKm).toBe(999);
      expect(result.avgDistanceKm).toBe(999);
    });

    it('8. Empty segments returns valid empty result', () => {
      const refuges = turf.featureCollection([
        turf.point([0, 0.005], { id: 'r1', openFrom: 0, openTo: 24 })
      ]);
      const date = new Date('2024-01-01T12:00:00');
      const result = analyseLifeline(turf.featureCollection([]), refuges, date, cfg);
      expect(result.longestUnprotectedStretchKm).toBe(0);
      expect(result.perChunk).toEqual([]);
      expect(result.worstDistanceKm).toBe(0);
      expect(result.avgDistanceKm).toBe(0);
    });
    
    it('9. Coordinates remain [lng, lat]', () => {
      const refuges = turf.featureCollection([
        turf.point([10, 20], { id: 'r1', openFrom: 0, openTo: 24 })
      ]);
      const segs = turf.featureCollection([
        turf.lineString([[10, 20], [10.01, 20.01]])
      ]);
      segs.features[0].properties = { km: 1 };
      
      const date = new Date('2024-01-01T12:00:00');
      const result = analyseLifeline(segs, refuges, date, cfg);
      expect(result.perChunk[0].nearestRefuge.coords).toEqual([10, 20]);
    });
  });
});
