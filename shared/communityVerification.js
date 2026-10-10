import { REPORT_STATUS, VOTE_TYPES, MODERATOR_DECISIONS } from './communityReports.js';
import { DEFAULT_CONFIG } from './scoringConfig.js';

/**
 * Calculates verification confidence from vote counts.
 * @param {number} confirmCount 
 * @param {number} totalVotes 
 * @returns {number} Confidence ratio (0 to 1)
 */
export function calculateConfidence(confirmCount, totalVotes) {
  if (totalVotes === 0) return 0;
  return confirmCount / totalVotes;
}

/**
 * Evaluates the new status of a report based on community votes and moderator actions.
 * @param {Object} report Current report state
 * @param {Object} config Configuration values
 * @returns {string} New REPORT_STATUS
 */
export function evaluateReportStatus(report, config = DEFAULT_CONFIG.communityReports, now = Date.now()) {
  // 1. Moderator Precedence
  if (report.moderator && report.moderator.decision) {
    if (report.moderator.decision === MODERATOR_DECISIONS.VERIFY) return REPORT_STATUS.MODERATOR_VERIFIED;
    if (report.moderator.decision === MODERATOR_DECISIONS.REJECT) return REPORT_STATUS.REJECTED;
    // 'DISMISS' leaves it to community, fall through
  }

  // 2. Expiry check
  if (report.expiresAt && now >= report.expiresAt) {
    return REPORT_STATUS.EXPIRED;
  }

  const { confirmCount, inaccurateCount, totalVotes, verificationConfidence } = report.community || {
    confirmCount: 0,
    inaccurateCount: 0,
    totalVotes: 0,
    verificationConfidence: 0
  };

  // 3. Minimum votes check
  if (totalVotes < config.communityMinimumVotes) {
    return REPORT_STATUS.PENDING;
  }

  // 4. Verification check
  if (verificationConfidence >= config.communityVerificationThreshold) {
    return REPORT_STATUS.COMMUNITY_VERIFIED;
  }

  // 5. Disputed state check
  // Meaningful disagreement: met minimum votes, below threshold, but has both confirm and inaccurate votes
  if (confirmCount > 0 && inaccurateCount > 0 && verificationConfidence < config.communityVerificationThreshold) {
    return REPORT_STATUS.DISPUTED;
  }

  // Default to pending
  return REPORT_STATUS.PENDING;
}

/**
 * Evaluates the freshness of a report based on time.
 * @param {Object} report 
 * @param {number} now Current timestamp
 * @param {Object} config Configuration values
 * @returns {'fresh' | 'stale' | 'expired'}
 */
export function evaluateReportFreshness(report, now, config = DEFAULT_CONFIG.communityReports) {
  if (now >= report.expiresAt) {
    return 'expired';
  }

  const freshnessMs = config.reportFreshnessHours * 60 * 60 * 1000;
  const effectiveTime = report.lastConfirmedAt || report.reportedAt || report.createdAt;

  if (now - effectiveTime > freshnessMs) {
    return 'stale';
  }

  return 'fresh';
}

/**
 * Computes the new community counters after a vote is cast or changed.
 * @param {Object} currentCommunity Current community object
 * @param {string|null} previousVote The user's previous vote (if any)
 * @param {string} newVote The user's new vote (from VOTE_TYPES)
 * @returns {Object} Updated community counters (confirmCount, inaccurateCount, totalVotes, verificationConfidence)
 */
export function computeVoteDelta(currentCommunity, previousVote, newVote) {
  let { confirmCount, inaccurateCount, totalVotes } = currentCommunity;

  // Remove previous vote contribution
  if (previousVote === VOTE_TYPES.CONFIRM) {
    confirmCount = Math.max(0, confirmCount - 1);
    totalVotes = Math.max(0, totalVotes - 1);
  } else if (previousVote === VOTE_TYPES.INACCURATE) {
    inaccurateCount = Math.max(0, inaccurateCount - 1);
    totalVotes = Math.max(0, totalVotes - 1);
  }

  // Add new vote contribution
  if (newVote === VOTE_TYPES.CONFIRM) {
    confirmCount += 1;
    totalVotes += 1;
  } else if (newVote === VOTE_TYPES.INACCURATE) {
    inaccurateCount += 1;
    totalVotes += 1;
  }

  const verificationConfidence = calculateConfidence(confirmCount, totalVotes);

  return {
    confirmCount,
    inaccurateCount,
    totalVotes,
    verificationConfidence
  };
}
