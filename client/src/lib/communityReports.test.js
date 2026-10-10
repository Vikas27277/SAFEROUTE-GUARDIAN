import { expect, test, describe } from 'vitest';
import { DEFAULT_CONFIG } from '../../../shared/scoringConfig.js';
import { 
  REPORT_CATEGORIES, 
  REPORT_STATUS, 
  USER_ROLES, 
  VOTE_TYPES, 
  MODERATOR_DECISIONS 
} from '../../../shared/communityReports.js';

describe('Community Reports Foundations', () => {
  test('Configuration values are correctly set', () => {
    expect(DEFAULT_CONFIG.communityReports).toBeDefined();
    expect(DEFAULT_CONFIG.communityReports.enabled).toBe(true);
    expect(DEFAULT_CONFIG.communityReports.maxImagesPerReport).toBe(2);
    expect(DEFAULT_CONFIG.communityReports.maxImageSizeMb).toBe(5);
    expect(DEFAULT_CONFIG.communityReports.communityVerificationThreshold).toBe(0.70);
    expect(DEFAULT_CONFIG.communityReports.communityMinimumVotes).toBe(5);
    expect(DEFAULT_CONFIG.communityReports.reportFreshnessHours).toBe(24);
    expect(DEFAULT_CONFIG.communityReports.defaultReportExpiryHours).toBe(24);
    expect(DEFAULT_CONFIG.communityReports.maxReportDescriptionLength).toBe(300);
    expect(DEFAULT_CONFIG.communityReports.voteCooldownHours).toBe(0);
    expect(DEFAULT_CONFIG.communityReports.maxReportsPerHourPerUser).toBe(5);
    expect(DEFAULT_CONFIG.communityReports.maxVotesPerHourPerUser).toBe(30);
  });

  test('REPORT_CATEGORIES contains exact defined values', () => {
    const categories = Object.values(REPORT_CATEGORIES);
    expect(categories).toContain('blocked_road');
    expect(categories).toContain('streetlight_out');
    expect(categories).toContain('flooding');
    expect(categories).toContain('pothole');
    expect(categories).toContain('poorly_lit');
    expect(categories).toContain('construction');
    expect(categories).toContain('accident');
    expect(categories).toContain('unsafe_road_condition');
    expect(categories).toContain('other');
    expect(categories.length).toBe(9);
  });

  test('REPORT_STATUS contains exact defined values', () => {
    const statuses = Object.values(REPORT_STATUS);
    expect(statuses).toContain('PENDING');
    expect(statuses).toContain('COMMUNITY_VERIFIED');
    expect(statuses).toContain('MODERATOR_VERIFIED');
    expect(statuses).toContain('DISPUTED');
    expect(statuses).toContain('REJECTED');
    expect(statuses).toContain('EXPIRED');
    expect(statuses.length).toBe(6);
  });

  test('USER_ROLES contains exact defined values', () => {
    const roles = Object.values(USER_ROLES);
    expect(roles).toContain('user');
    expect(roles).toContain('moderator');
    expect(roles).toContain('admin');
    expect(roles.length).toBe(3);
  });

  test('VOTE_TYPES contains exact defined values', () => {
    const votes = Object.values(VOTE_TYPES);
    expect(votes).toContain('confirm');
    expect(votes).toContain('inaccurate');
    expect(votes.length).toBe(2);
  });

  test('MODERATOR_DECISIONS contains exact defined values', () => {
    const decisions = Object.values(MODERATOR_DECISIONS);
    expect(decisions).toContain('verify');
    expect(decisions).toContain('reject');
    expect(decisions).toContain('dismiss');
    expect(decisions.length).toBe(3);
  });
});
