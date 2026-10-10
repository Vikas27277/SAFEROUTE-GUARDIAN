import { describe, it, expect, vi, beforeEach } from 'vitest';
import { REPORT_STATUS } from '../../../shared/communityReports.js';
import { getPublicReports } from './publicReportService.js';
import { getDocs } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn()
}));

vi.mock('./firebase.js', () => ({
  db: {}
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('publicReportService', () => {

  it('fetches active reports and strips PII', async () => {
    const mockSnapshot = [
      {
        id: 'report1',
        data: () => ({
          category: 'pothole',
          title: 'Deep pothole',
          description: 'A deep pothole on main st',
          location: { type: 'Point', coordinates: [77.5946, 12.9716] },
          imageUrls: ['http://example.com/img1.jpg'],
          reportedAt: new Date('2024-01-01').getTime(),
          status: REPORT_STATUS.COMMUNITY_VERIFIED,
          community: {
            confirmCount: 10,
            inaccurateCount: 1,
            verificationConfidence: 0.9,
            totalVotes: 11
          },
          moderator: {
            decision: null
          }
        })
      }
    ];

    getDocs.mockResolvedValue({ docs: mockSnapshot });

    const reports = await getPublicReports();
    
    expect(reports).toHaveLength(1);
    
    const r = reports[0];
    expect(r.id).toBe('report1');
    expect(r.category).toBe('pothole');
    expect(r.title).toBe('Deep pothole');
    expect(r.location).toEqual({ type: 'Point', coordinates: [77.5946, 12.9716] });
    expect(r.status).toBe(REPORT_STATUS.COMMUNITY_VERIFIED);
    
    // Community stats passed
    expect(r.community.confirmCount).toBe(10);
    expect(r.community.totalVotes).toBe(11);
    
    // Moderator decision exposed but ID stripped
    expect(r.moderator.decision).toBe(null);
    expect(r.moderator.moderatorId).toBeUndefined();
    
    // PII explicitly stripped
    expect(r.createdBy).toBeUndefined();
    expect(r.reporterEmail).toBeUndefined();
  });
});
