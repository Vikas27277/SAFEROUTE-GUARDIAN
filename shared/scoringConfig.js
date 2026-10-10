export const DEFAULT_CONFIG = {
  weights: { red: 3, yellow: 1.5, green: 0.5, none: 0 },
  timeBands: [
    { id: 'day', from: 6, to: 17, mult: 1.0 },
    { id: 'evening', from: 17, to: 21, mult: 1.3 },
    { id: 'night', from: 21, to: 6, mult: 1.6 },
  ],
  penaltyMinPerUnit: 5,
  scoreDecay: 0.5,
  minScoreGain: 10,
  lifeline: {
    refugeRadiusKm: 0.25,
    maxHelpDistanceKm: 1.0,
    isolationWeight: 1.0,
    unprotectedStretchWarnKm: 0.4
  },
  communityReports: {
    enabled: true,
    maxImagesPerReport: 2,
    maxImageSizeMb: 5,
    communityVerificationThreshold: 0.70,
    communityMinimumVotes: 5,
    reportFreshnessHours: 24,
    defaultReportExpiryHours: 24,
    maxReportDescriptionLength: 300,
    voteCooldownHours: 0,
    maxReportsPerHourPerUser: 5,
    maxVotesPerHourPerUser: 30,
    score: {
      enabled: true,
      weight: 1.0,
      maxExposureContribution: 2.0,
      spatialRadiusKm: 0.15,
      freshnessHalfLifeHours: 12,
      moderatorVerifiedMultiplier: 1.0,
      communityVerifiedMultiplier: 0.6,
      severityWeights: {
        blocked_road: 1.0,
        streetlight_out: 0.6,
        flooding: 0.9,
        pothole: 0.5,
        poorly_lit: 0.7,
        construction: 0.6,
        accident: 1.0,
        unsafe_road_condition: 0.8,
        other: 0.4
      }
    }
  }
};
