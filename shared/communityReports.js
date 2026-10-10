/**
 * Guardian Reports - Data Models and Constants
 */

// 2. REPORT CATEGORIES
export const REPORT_CATEGORIES = {
  BLOCKED_ROAD: 'blocked_road',
  STREETLIGHT_OUT: 'streetlight_out',
  FLOODING: 'flooding',
  POTHOLE: 'pothole',
  POORLY_LIT: 'poorly_lit',
  CONSTRUCTION: 'construction',
  ACCIDENT: 'accident',
  UNSAFE_ROAD_CONDITION: 'unsafe_road_condition',
  OTHER: 'other'
};

// 3. REPORT STATUS
export const REPORT_STATUS = {
  PENDING: 'PENDING',
  COMMUNITY_VERIFIED: 'COMMUNITY_VERIFIED',
  MODERATOR_VERIFIED: 'MODERATOR_VERIFIED',
  DISPUTED: 'DISPUTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED'
};

// 4. USER ROLES
export const USER_ROLES = {
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin'
};

// 5. COMMUNITY VOTE TYPES
export const VOTE_TYPES = {
  CONFIRM: 'confirm',
  INACCURATE: 'inaccurate'
};

// 6. MODERATOR DECISIONS
export const MODERATOR_DECISIONS = {
  VERIFY: 'verify',
  REJECT: 'reject',
  DISMISS: 'dismiss'
};

/**
 * 7. REPORT DATA MODEL
 * @typedef {Object} GuardianReport
 * @property {string} id - Unique identifier for the report
 * @property {string} category - Must be one of REPORT_CATEGORIES
 * @property {string} title - Short title for the report
 * @property {string} description - Detailed description
 * @property {Object} location - GeoJSON Point representing the report location
 * @property {string} location.type - Must be "Point"
 * @property {number[]} location.coordinates - Must be [lng, lat]
 * @property {string[]} imageUrls - Array of image URLs
 * @property {string} createdBy - User ID of the reporter (pseudonymous in public context)
 * @property {number|Date} createdAt - When the report record was created
 * @property {number|Date} reportedAt - When the incident was reported to occur
 * @property {number|Date|null} lastConfirmedAt - Last time a confirmation vote was cast
 * @property {number|Date} expiresAt - Expiration timestamp based on freshness hours
 * @property {string} status - Current status from REPORT_STATUS
 * @property {number|string} severity - Severity level of the report
 * 
 * @property {Object} community - Community verification state
 * @property {number} community.confirmCount - Number of confirm votes
 * @property {number} community.inaccurateCount - Number of inaccurate votes
 * @property {number} community.totalVotes - Total number of votes
 * @property {number} community.verificationConfidence - Score/confidence ratio
 * 
 * @property {Object} moderator - Moderator review state
 * @property {string|null} moderator.decision - Decision from MODERATOR_DECISIONS
 * @property {string|null} moderator.moderatorId - ID of moderator who made decision
 * @property {number|Date|null} moderator.decidedAt - When the decision was made
 * @property {string|null} moderator.reason - Optional reason for decision
 * 
 * @property {string} source - e.g. "community"
 */

/**
 * 8. VOTE DATA MODEL
 * @typedef {Object} ReportVote
 * @property {string} userId - ID of the voting user
 * @property {string} reportId - ID of the report being voted on
 * @property {string} vote - One of VOTE_TYPES
 * @property {number|Date} createdAt - When the vote was cast
 * @property {number|Date} updatedAt - Last time the vote was updated
 * 
 * Note: One user can have only one active vote per report.
 */

/**
 * 9. MODERATOR DECISION MODEL
 * @typedef {Object} ModeratorDecision
 * @property {string} moderatorId - ID of the acting moderator
 * @property {string} decision - One of MODERATOR_DECISIONS
 * @property {string} reason - Justification for the decision
 * @property {number|Date} decidedAt - Timestamp of the decision
 */
