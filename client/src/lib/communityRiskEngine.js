import * as turf from '@turf/turf';
import { evaluateReportStatus, evaluateReportFreshness } from '../../../shared/communityVerification.js';
import { REPORT_STATUS } from '../../../shared/communityReports.js';

/**
 * Calculates the community risk exposure for a set of route segments based on verified reports.
 * 
 * @param {Object} segments GeoJSON FeatureCollection of route segments (each with properties.midPoint)
 * @param {Array} reports Array of community reports
 * @param {Date} timeDate Current travel time
 * @param {Object} config scoringConfig object
 * @returns {Object} { communityRiskExposure, activeCommunityReportCount, contributingCommunityReportIds }
 */
export function calculateCommunityRisk(segments, reports, timeDate, config) {
  const commConfig = config.communityReports;
  if (!commConfig || !commConfig.score || !commConfig.score.enabled || !reports || reports.length === 0) {
    return {
      communityRiskExposure: 0,
      activeCommunityReportCount: 0,
      contributingCommunityReportIds: []
    };
  }

  const scoreCfg = commConfig.score;
  const now = timeDate.getTime();
  
  // 1. Filter eligible reports
  const eligibleReports = [];
  
  for (const report of reports) {
    // Validate report object
    if (!report || !report.location || !report.location.coordinates || !Array.isArray(report.location.coordinates)) continue;

    // Recalculate authoritative status (ignores client-supplied report.status)
    const status = evaluateReportStatus(report, commConfig, now);
    
    if (status !== REPORT_STATUS.COMMUNITY_VERIFIED && status !== REPORT_STATUS.MODERATOR_VERIFIED) {
      continue;
    }

    // Check authoritative expiry using effective timestamp
    const freshness = evaluateReportFreshness(report, now, commConfig);
    if (freshness === 'expired') {
      continue;
    }

    // Determine category severity
    const severityWeight = scoreCfg.severityWeights[report.category] !== undefined 
      ? scoreCfg.severityWeights[report.category] 
      : (scoreCfg.severityWeights.other || 0.4);

    // Determine verification multiplier
    const verificationMultiplier = status === REPORT_STATUS.MODERATOR_VERIFIED 
      ? scoreCfg.moderatorVerifiedMultiplier 
      : scoreCfg.communityVerifiedMultiplier;

    // Determine exponential freshness decay
    const effectiveTime = report.lastConfirmedAt || report.reportedAt || report.createdAt || now;
    // ensure effectiveTime is a timestamp number
    const effectiveTimeMs = typeof effectiveTime === 'object' && effectiveTime.toDate 
      ? effectiveTime.toDate().getTime() 
      : (typeof effectiveTime === 'string' ? new Date(effectiveTime).getTime() : Number(effectiveTime));

    const ageHours = Math.max(0, (now - effectiveTimeMs) / (1000 * 60 * 60));
    const freshnessFactor = Math.pow(2, -ageHours / scoreCfg.freshnessHalfLifeHours);

    // Calculate maximum potential risk contribution of this report (at distance 0)
    const baseRisk = severityWeight * verificationMultiplier * freshnessFactor;

    eligibleReports.push({
      id: report.id,
      coordinates: report.location.coordinates, // [lng, lat]
      baseRisk
    });
  }

  if (eligibleReports.length === 0) {
    return {
      communityRiskExposure: 0,
      activeCommunityReportCount: 0,
      contributingCommunityReportIds: []
    };
  }

  let totalCommunityRisk = 0;
  const contributingIds = new Set();

  // 2. Apply spatial relevance per route segment
  for (const feature of segments.features) {
    const midPoint = feature.properties.midPoint;
    if (!midPoint) continue;
    
    const segmentPoint = turf.point(midPoint);
    let segmentCommunityRisk = 0;

    for (const report of eligibleReports) {
      const reportPoint = turf.point(report.coordinates);
      const distanceKm = turf.distance(segmentPoint, reportPoint, { units: 'kilometers' });

      if (distanceKm <= scoreCfg.spatialRadiusKm) {
        // Linear spatial falloff: max(0, 1 - distance/radius)
        const spatialRelevance = 1 - (distanceKm / scoreCfg.spatialRadiusKm);
        const reportContribution = report.baseRisk * spatialRelevance;
        
        segmentCommunityRisk += reportContribution;
        contributingIds.add(report.id);
      }
    }
    
    // Scale risk by the length of the segment to get exposure
    totalCommunityRisk += segmentCommunityRisk * feature.properties.km;
  }

  // 3. Bound the contribution
  const weightedExposure = totalCommunityRisk * scoreCfg.weight;
  const boundedExposure = Math.min(weightedExposure, scoreCfg.maxExposureContribution);

  return {
    communityRiskExposure: boundedExposure,
    activeCommunityReportCount: eligibleReports.length,
    contributingCommunityReportIds: Array.from(contributingIds)
  };
}
