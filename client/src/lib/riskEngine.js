import { analyseRoute } from './spatial.js';
import { analyseLifeline } from './lifeline.js';
import { calculateCommunityRisk } from './communityRiskEngine.js';
import { DEFAULT_CONFIG } from '../../../shared/scoringConfig.js';

export function timeBand(date, cfg = DEFAULT_CONFIG) {
  const h = date.getHours();
  return cfg.timeBands.find(b => b.from < b.to ? (h >= b.from && h < b.to) : (h >= b.from || h < b.to));
}

export function scoreRoute(route, zones, travelTimeDate, cfg = DEFAULT_CONFIG, lifelineResult = null, reports = [], precomputedAnalysis = null) {
  const analysis = precomputedAnalysis || analyseRoute(route.geometry, zones);
  const band = timeBand(travelTimeDate, cfg);
  
  const zoneExposure = Object.entries(analysis.exposureKm)
    .reduce((sum, [cls, km]) => sum + km * (cfg.weights[cls] || 0) * band.mult, 0);
    
  let isolationExposure = 0;
  let longestUnprotectedStretchKm = 0;
  let worstDistanceKm = 0;
  
  if (lifelineResult && cfg.lifeline) {
    isolationExposure = lifelineResult.isolationExposure;
    longestUnprotectedStretchKm = lifelineResult.longestUnprotectedStretchKm;
    worstDistanceKm = lifelineResult.worstDistanceKm;
  }
  
  const communityRisk = calculateCommunityRisk(analysis.segments, reports, travelTimeDate, cfg);
  const communityRiskExposure = communityRisk.communityRiskExposure;
  
  const E = zoneExposure + (cfg.lifeline?.isolationWeight || 0) * isolationExposure + communityRiskExposure;
  const routeLengthKm = Object.values(analysis.exposureKm).reduce((sum, km) => sum + km, 0);
  const normalizedExposure = routeLengthKm > 0 ? E / routeLengthKm : E;
    
  const riskPenaltyMin = cfg.penaltyMinPerUnit * E;
  const routeCost = route.durationMin + riskPenaltyMin;
  
  const safetyScore = Math.max(0, Math.min(100, Math.round(100 * Math.exp(-cfg.scoreDecay * normalizedExposure))));
  
  return {
    ...route,
    travelTimeMin: route.durationMin,
    exposureKm: analysis.exposureKm,
    riskPenaltyMin,
    routeCost,
    safetyScore,
    crossedZones: analysis.crossedZones,
    isolationExposure,
    longestUnprotectedStretchKm,
    worstDistanceKm,
    communityRiskExposure,
    activeCommunityReportCount: communityRisk.activeCommunityReportCount,
    contributingCommunityReportIds: communityRisk.contributingCommunityReportIds,
    riskBreakdown: {
      timeBand: band.id,
      timeBandMult: band.mult,
      weightedExposure: E
    },
    segments: analysis.segments,
    intersectsRedZone: analysis.intersectsRedZone,
    redZoneExposureDistance: analysis.redZoneExposureDistance,
    redZoneExposureRatio: analysis.redZoneExposureRatio,
    redZoneCount: analysis.redZoneCount,
    riskZoneIds: analysis.riskZoneIds
  };
}
