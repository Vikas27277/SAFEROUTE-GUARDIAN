import { expect, test, describe } from 'vitest';
import { calculateConfidence, evaluateReportStatus, evaluateReportFreshness, computeVoteDelta } from './communityVerification.js';
import { REPORT_STATUS, VOTE_TYPES, MODERATOR_DECISIONS } from './communityReports.js';

const mockConfig = {
  communityVerificationThreshold: 0.7,
  communityMinimumVotes: 3,
  reportFreshnessHours: 2,
  defaultReportExpiryHours: 24
};

describe('calculateConfidence', () => {
  test('zero votes returns 0 confidence', () => {
    expect(calculateConfidence(0, 0)).toBe(0);
  });
  test('all confirms returns 1 confidence', () => {
    expect(calculateConfidence(5, 5)).toBe(1);
  });
  test('mixed votes calculates correct ratio', () => {
    expect(calculateConfidence(3, 4)).toBe(0.75);
    expect(calculateConfidence(1, 4)).toBe(0.25);
  });
});

describe('computeVoteDelta', () => {
  const initial = { confirmCount: 2, inaccurateCount: 1, totalVotes: 3, verificationConfidence: 0.66 };
  
  test('adds new confirm vote', () => {
    const res = computeVoteDelta(initial, null, VOTE_TYPES.CONFIRM);
    expect(res.confirmCount).toBe(3);
    expect(res.totalVotes).toBe(4);
    expect(res.verificationConfidence).toBe(0.75);
  });

  test('changes inaccurate to confirm', () => {
    const res = computeVoteDelta(initial, VOTE_TYPES.INACCURATE, VOTE_TYPES.CONFIRM);
    expect(res.inaccurateCount).toBe(0);
    expect(res.confirmCount).toBe(3);
    expect(res.totalVotes).toBe(3);
    expect(res.verificationConfidence).toBe(1);
  });
  
  test('changing same vote has no net effect on total', () => {
    // Should not normally happen due to UI blocks, but math should handle it safely
    const res = computeVoteDelta(initial, VOTE_TYPES.CONFIRM, VOTE_TYPES.CONFIRM);
    expect(res.confirmCount).toBe(2);
    expect(res.totalVotes).toBe(3);
  });
});

describe('evaluateReportStatus', () => {
  const baseReport = {
    community: { confirmCount: 0, inaccurateCount: 0, totalVotes: 0, verificationConfidence: 0 },
    moderator: { decision: null },
    expiresAt: Date.now() + 100000
  };

  test('below minimum votes remains PENDING', () => {
    const report = { ...baseReport, community: { confirmCount: 2, inaccurateCount: 0, totalVotes: 2, verificationConfidence: 1 } };
    expect(evaluateReportStatus(report, mockConfig)).toBe(REPORT_STATUS.PENDING);
  });

  test('minimum votes + threshold reached becomes COMMUNITY_VERIFIED', () => {
    const report = { ...baseReport, community: { confirmCount: 3, inaccurateCount: 0, totalVotes: 3, verificationConfidence: 1 } };
    expect(evaluateReportStatus(report, mockConfig)).toBe(REPORT_STATUS.COMMUNITY_VERIFIED);
  });

  test('insufficient confidence and meaning disagreement becomes DISPUTED', () => {
    const report = { ...baseReport, community: { confirmCount: 2, inaccurateCount: 2, totalVotes: 4, verificationConfidence: 0.5 } };
    expect(evaluateReportStatus(report, mockConfig)).toBe(REPORT_STATUS.DISPUTED);
  });

  test('moderator decision overrides community', () => {
    const report = { 
      ...baseReport, 
      community: { confirmCount: 5, inaccurateCount: 0, totalVotes: 5, verificationConfidence: 1 },
      moderator: { decision: MODERATOR_DECISIONS.REJECT } 
    };
    expect(evaluateReportStatus(report, mockConfig)).toBe(REPORT_STATUS.REJECTED);
  });

  test('expired report becomes EXPIRED regardless of community votes', () => {
    const report = { 
      ...baseReport, 
      expiresAt: Date.now() - 1000,
      community: { confirmCount: 5, inaccurateCount: 0, totalVotes: 5, verificationConfidence: 1 }
    };
    expect(evaluateReportStatus(report, mockConfig)).toBe(REPORT_STATUS.EXPIRED);
  });
});

describe('evaluateReportFreshness', () => {
  const now = 10000000;
  
  test('past expiry returns expired', () => {
    const report = { expiresAt: now - 1000 };
    expect(evaluateReportFreshness(report, now, mockConfig)).toBe('expired');
  });

  test('fresh report returns fresh', () => {
    const report = { 
      expiresAt: now + 100000, 
      reportedAt: now - 1000 // 1 second ago
    };
    expect(evaluateReportFreshness(report, now, mockConfig)).toBe('fresh');
  });

  test('stale report returns stale', () => {
    const staleMs = mockConfig.reportFreshnessHours * 60 * 60 * 1000 + 1000;
    const report = { 
      expiresAt: now + 100000, 
      reportedAt: now - staleMs 
    };
    expect(evaluateReportFreshness(report, now, mockConfig)).toBe('stale');
  });

  test('lastConfirmedAt refreshes report', () => {
    const staleMs = mockConfig.reportFreshnessHours * 60 * 60 * 1000 + 1000;
    const report = { 
      expiresAt: now + 100000, 
      reportedAt: now - staleMs,
      lastConfirmedAt: now - 1000 // 1 second ago
    };
    expect(evaluateReportFreshness(report, now, mockConfig)).toBe('fresh');
  });
});
