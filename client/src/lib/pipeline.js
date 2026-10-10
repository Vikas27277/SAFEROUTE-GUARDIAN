import { fetchRoutes } from './routing.js';
import { scoreRoute } from './riskEngine.js';
import { analyseRoute } from './spatial.js';
import { analyseLifeline } from './lifeline.js';
import { DEFAULT_CONFIG } from '../../../shared/scoringConfig.js';
import { useStore } from '../state/useStore.js';
import { getPublicReports } from './publicReportService.js';

import * as turf from '@turf/turf';

async function fetchRefuges(routeGeometry, travelTimeDate, mode) {
  try {
    const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
    const params = new URLSearchParams({
      mode,
      travelTime: travelTimeDate.toISOString()
    });
    
    // Pass stringified geometry if available
    if (routeGeometry) {
      params.append('routeGeometry', JSON.stringify(routeGeometry));
    }
    
    const res = await fetch(`${apiBase}/api/refuges?${params.toString()}`);
    if (!res.ok) throw new Error('Live API failed');
    return await res.json();
  } catch (err) {
    console.warn('Live API failed, falling back to local synthetic geojson:', err);
    try {
      const fb = await fetch('/refuges.bengaluru.geojson');
      return await fb.json();
    } catch (e) {
      console.error('Fallback also failed:', e);
      return { type: 'FeatureCollection', features: [] };
    }
  }
}

/**
 * Orchestrates fetching routes and scoring them to find the fastest and safer routes.
 */
export async function runAnalysis({ origin, destination, timeDate, zones, mode = 'driving', config = DEFAULT_CONFIG, isDemo = false, riskCoverageAvailable = true }) {
  // Fetch candidate routes
  let fetchedRoutes = await fetchRoutes(origin, destination, mode);
  
  // Fetch refuges once per pipeline run to avoid unnecessary network requests
  const primaryGeometry = fetchedRoutes[0]?.geometry;
  const refuges = riskCoverageAvailable
    ? await fetchRefuges(primaryGeometry, timeDate, mode)
    : { type: 'FeatureCollection', features: [] };
  
  let reports = [];
  if (config.communityReports?.score?.enabled) {
    try {
      reports = await getPublicReports();
    } catch (err) {
      console.warn('Failed to fetch public reports, continuing without community risk:', err);
    }
    
    if (isDemo) {
      // Inject a synthetic, clearly isolated demo report to demonstrate routing impact
      reports.push({
        id: 'synthetic-demo-report-1',
        category: 'blocked_road',
        title: '[DEMO] Blocked Road',
        description: 'Synthetic data for demo mode demonstration.',
        location: { type: 'Point', coordinates: [77.625, 12.978] },
        reportedAt: Date.now(),
        lastConfirmedAt: Date.now(),
        status: 'COMMUNITY_VERIFIED',
        community: {
          confirmCount: 10,
          inaccurateCount: 0,
          totalVotes: 10,
          verificationConfidence: 1.0,
        },
        moderator: { decision: null }
      });
    }
  }
  
  // Update Zustand state
  const setRefuges = useStore.getState().setRefuges;
  if (setRefuges) setRefuges(refuges);
  
  // Score all candidate routes
  const scoreAndFormatRoute = (route) => {
    if (!riskCoverageAvailable) {
      return {
        ...route,
        safetyScore: null,
        riskScoreAvailable: false,
        exposureKm: null,
        riskPenaltyMin: null,
        routeCost: null,
        lifeline: null,
        riskBreakdown: null,
        intersectsRedZone: false,
        redZoneExposureDistance: 0,
        redZoneExposureRatio: 0,
        redZoneCount: 0,
        riskZoneIds: []
      };
    }

    const analysis = analyseRoute(route.geometry, zones);
    const lifelineResult = analyseLifeline(analysis.segments, refuges, timeDate, config);
    route.lifeline = lifelineResult;
    return scoreRoute(route, zones, timeDate, config, lifelineResult, reports, analysis);
  };

  let scoredRoutes = fetchedRoutes.map(scoreAndFormatRoute);

  // If all primary routes intersect red zones, try to generate a detour
  const allIntersectRed = scoredRoutes.every(r => r.intersectsRedZone);
  if (allIntersectRed && riskCoverageAvailable && zones?.features?.length > 0) {
    try {
      // Find the center of all intersected red zones
      const intersectedZoneIds = new Set();
      scoredRoutes.forEach(r => r.riskZoneIds.forEach(id => intersectedZoneIds.add(id)));
      
      const intersectedPolygons = zones.features.filter(f => intersectedZoneIds.has(f.properties.id));
      if (intersectedPolygons.length > 0) {
        // Calculate the centroid of the blocked area
        const bbox = turf.bbox(turf.featureCollection(intersectedPolygons));
        const centerPt = turf.center(turf.bboxPolygon(bbox));
        
        // Calculate bearing from origin to destination
        const ptOrigin = turf.point(origin);
        const ptDest = turf.point(destination);
        const bearing = turf.bearing(ptOrigin, ptDest);
        
        // Generate two waypoints: left and right of the red zone center, perpendicular to the route
        const offsetDist = 1.5; // 1.5 km offset
        const leftWaypoint = turf.destination(centerPt, offsetDist, bearing - 90, { units: 'kilometers' }).geometry.coordinates;
        const rightWaypoint = turf.destination(centerPt, offsetDist, bearing + 90, { units: 'kilometers' }).geometry.coordinates;
        
        // Fetch detour routes
        const detourRoutesLeft = await fetchRoutes(origin, destination, mode, [leftWaypoint]);
        const detourRoutesRight = await fetchRoutes(origin, destination, mode, [rightWaypoint]);
        
        const allDetours = [...detourRoutesLeft, ...detourRoutesRight];
        
        // Add valid detours that aren't duplicates
        for (const dr of allDetours) {
          const isDup = fetchedRoutes.some(existing => {
            const durDiff = Math.abs(existing.durationMin - dr.durationMin);
            const distDiff = Math.abs(existing.distanceKm - dr.distanceKm) / existing.distanceKm;
            return durDiff < 0.5 && distDiff < 0.02;
          });
          if (!isDup) {
            fetchedRoutes.push({ ...dr, isDetour: true });
          }
        }
        
        // Re-score the entire set
        scoredRoutes = fetchedRoutes.map(scoreAndFormatRoute);
      }
    } catch (e) {
      console.warn("Failed to generate detour routes:", e);
    }
  }

  // Rank the routes
  // Priority 1: Red-zone avoidance
  // Priority 2: Overall risk (routeCost)
  // Priority 3: Travel time
  scoredRoutes.sort((a, b) => {
    if (a.intersectsRedZone !== b.intersectsRedZone) {
      return a.intersectsRedZone ? 1 : -1; // routes without red zone exposure come first
    }
    if (a.routeCost !== b.routeCost) {
      return (a.routeCost || 0) - (b.routeCost || 0);
    }
    return a.durationMin - b.durationMin;
  });

  // Re-label routes
  scoredRoutes.forEach((route, index) => {
    route.id = `r${index}`;
    route.label = index === 0 ? 'Top Recommendation' : `Alternative ${index}`;
  });

  // Fastest route is still the absolute fastest by duration
  const fastestRoute = [...scoredRoutes].sort((a, b) => a.durationMin - b.durationMin)[0];
  
  // The top recommended route is the first one in scoredRoutes (due to ranking). 
  const safestRoute = scoredRoutes[0];
  
  if (safestRoute && fastestRoute && safestRoute.id !== fastestRoute.id) {
    safestRoute.label = 'Safest Available';
    fastestRoute.label = 'Fastest';
  } else if (safestRoute) {
    safestRoute.label = 'Fastest & Safest Available';
  }
  
  return {
    fastestRoute,
    safestRoute,
    routes: scoredRoutes,
    riskCoverageAvailable
  };
}
