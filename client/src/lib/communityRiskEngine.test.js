import { describe, it, expect } from 'vitest';
import * as turf from '@turf/turf';
import { calculateCommunityRisk } from './communityRiskEngine.js';
import { DEFAULT_CONFIG } from '../../../shared/scoringConfig.js';
import { REPORT_STATUS, MODERATOR_DECISIONS } from '../../../shared/communityReports.js';

describe('Community Risk Engine', () => {
  const timeDate = new Date('2024-01-01T12:00:00Z');
  const now = timeDate.getTime();
  
  const createConfig = (overrides = {}) => {
    const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    cfg.communityReports = {
      ...cfg.communityReports,
      ...overrides
    };
    return cfg;
  };
  
  const baseConfig = createConfig();

  // Create a segment at [0, 0] of length 1km
  const segments = turf.featureCollection([
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[0, 0], [0, 0.01]] },
      properties: { km: 1, midPoint: [0, 0] }
    }
  ]);

  const createReport = (overrides = {}) => {
    return {
      id: 'r1',
      category: 'pothole',
      location: { type: 'Point', coordinates: [0, 0] }, // exact match with segment midPoint
      status: REPORT_STATUS.COMMUNITY_VERIFIED,
      createdAt: now,
      expiresAt: now + 86400000, // +24h
      community: {
        confirmCount: 10,
        inaccurateCount: 0,
        totalVotes: 10,
        verificationConfidence: 1.0
      },
      moderator: {},
      ...overrides
    };
  };

  it('1. No Community Reports produces 0 community risk', () => {
    const res = calculateCommunityRisk(segments, [], timeDate, baseConfig);
    expect(res.communityRiskExposure).toBe(0);
  });

  it('2. A nearby COMMUNITY_VERIFIED report increases route risk', () => {
    const report = createReport();
    const res = calculateCommunityRisk(segments, [report], timeDate, baseConfig);
    expect(res.communityRiskExposure).toBeGreaterThan(0);
  });

  it('3. A nearby MODERATOR_VERIFIED report has >= influence than COMMUNITY_VERIFIED', () => {
    const commReport = createReport();
    const modReport = createReport({
      status: REPORT_STATUS.MODERATOR_VERIFIED,
      moderator: { decision: MODERATOR_DECISIONS.VERIFY }
    });

    const commRes = calculateCommunityRisk(segments, [commReport], timeDate, baseConfig);
    const modRes = calculateCommunityRisk(segments, [modReport], timeDate, baseConfig);
    
    expect(modRes.communityRiskExposure).toBeGreaterThanOrEqual(commRes.communityRiskExposure);
  });

  it('4. PENDING reports have zero scoring effect', () => {
    const report = createReport({ 
      community: { confirmCount: 4, inaccurateCount: 0, totalVotes: 4, verificationConfidence: 1.0 } 
    });
    const res = calculateCommunityRisk(segments, [report], timeDate, baseConfig);
    expect(res.communityRiskExposure).toBe(0);
  });

  it('5. DISPUTED reports have zero scoring effect', () => {
    const report = createReport({ 
      community: { confirmCount: 5, inaccurateCount: 5, totalVotes: 10, verificationConfidence: 0.5 }
    });
    const res = calculateCommunityRisk(segments, [report], timeDate, baseConfig);
    expect(res.communityRiskExposure).toBe(0);
  });

  it('6. REJECTED reports have zero scoring effect', () => {
    const report = createReport({ 
      moderator: { decision: MODERATOR_DECISIONS.REJECT }
    });
    const res = calculateCommunityRisk(segments, [report], timeDate, baseConfig);
    expect(res.communityRiskExposure).toBe(0);
  });

  it('7. EXPIRED reports have zero scoring effect', () => {
    const report = createReport({ expiresAt: now - 1000 }); // expired
    const res = calculateCommunityRisk(segments, [report], timeDate, baseConfig);
    expect(res.communityRiskExposure).toBe(0);
  });

  it('8. A report outside the configured spatial radius has zero effect', () => {
    const report = createReport({ location: { type: 'Point', coordinates: [10, 10] } }); // very far away
    const res = calculateCommunityRisk(segments, [report], timeDate, baseConfig);
    expect(res.communityRiskExposure).toBe(0);
  });

  it('9. A fresh report has more influence than an older report', () => {
    const freshReport = createReport({ createdAt: now, lastConfirmedAt: now });
    const olderReport = createReport({ createdAt: now - (6 * 3600 * 1000), lastConfirmedAt: now - (6 * 3600 * 1000) });
    
    const freshRes = calculateCommunityRisk(segments, [freshReport], timeDate, baseConfig);
    const olderRes = calculateCommunityRisk(segments, [olderReport], timeDate, baseConfig);
    
    expect(freshRes.communityRiskExposure).toBeGreaterThan(olderRes.communityRiskExposure);
  });

  it('10. A report with invalid coordinates or timestamps does not crash scoring', () => {
    const invalidLocReport = createReport({ location: null });
    const invalidTimeReport = createReport({ createdAt: 'invalid-date' });
    
    expect(() => calculateCommunityRisk(segments, [invalidLocReport, invalidTimeReport], timeDate, baseConfig)).not.toThrow();
  });

  it('11. Community Risk respects the configured maximum contribution', () => {
    // Generate 100 verified reports at the exact same location
    const massiveReports = Array(100).fill(null).map((_, i) => createReport({ id: `r${i}` }));
    
    const res = calculateCommunityRisk(segments, massiveReports, timeDate, baseConfig);
    const maxAllowed = baseConfig.communityReports.score.maxExposureContribution;
    
    expect(res.communityRiskExposure).toBeLessThanOrEqual(maxAllowed);
    expect(res.communityRiskExposure).toBe(maxAllowed); // Should hit the cap
  });

  it('12. Setting Community Risk weight to zero preserves previous scores', () => {
    const cfg = createConfig();
    cfg.communityReports.score.weight = 0;
    
    const report = createReport();
    const res = calculateCommunityRisk(segments, [report], timeDate, cfg);
    expect(res.communityRiskExposure).toBe(0);
  });

  it('13. Disabling Community Risk preserves previous scores exactly', () => {
    const cfg = createConfig();
    cfg.communityReports.score.enabled = false;
    
    const report = createReport();
    const res = calculateCommunityRisk(segments, [report], timeDate, cfg);
    expect(res.communityRiskExposure).toBe(0);
  });
});
