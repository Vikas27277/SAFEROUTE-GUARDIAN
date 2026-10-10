import * as turf from '@turf/turf';

export function isOpenAt(refuge, hour) {
  // If we have an OSM opening_hours string, attempt to parse basic "24/7"
  if (refuge.opening_hours) {
    if (refuge.opening_hours === '24/7') return true;
    // For now, if we have complex OSM strings and can't parse easily, we just assume it might be open
    // but the UI should label it "Unknown" if it's not simply 24/7
  }

  let openFrom = refuge.properties?.openFrom ?? refuge.openFrom;
  let openTo = refuge.properties?.openTo ?? refuge.openTo;
  
  if (openFrom === undefined || openFrom === null) openFrom = 0;
  if (openTo === undefined || openTo === null) openTo = 24;

  if (typeof openFrom === 'string') openFrom = parseFloat(openFrom.split(':')[0]) || 0;
  if (typeof openTo === 'string') {
    if (openTo.startsWith('23:59')) openTo = 24;
    else openTo = parseFloat(openTo.split(':')[0]) || 0;
  }
  
  if (openFrom === 0 && openTo === 24) return true;
  if (openFrom < openTo) return hour >= openFrom && hour < openTo;
  if (openFrom > openTo) return hour >= openFrom || hour < openTo;
  
  return false;
}

export function analyseLifeline(segments, refuges, date, cfg) {
  const hour = date.getHours();
  
  const openRefugesList = (refuges?.features || []).filter(r => isOpenAt(r, hour));
  const hasOpenRefuges = openRefugesList.length > 0;
  const openRefuges = hasOpenRefuges ? turf.featureCollection(openRefugesList) : null;
  
  const perChunk = [];
  let cumulativeKm = 0;
  let currentUnprotectedStretch = 0;
  let longestUnprotectedStretchKm = 0;
  let maxDist = 0;
  let isolationExposure = 0;
  let totalDistSum = 0;
  
  const { refugeRadiusKm, maxHelpDistanceKm } = cfg.lifeline;
  
  const segFeatures = segments?.features || [];

  for (const seg of segFeatures) {
    const chunkKm = seg.properties?.km ?? turf.length(seg, { units: 'kilometers' });
    
    let distanceToHelpKm = 999; 
    let nearestRefuge = null;

    if (chunkKm > 0 || segFeatures.length === 1) {
      let mid;
      try {
        mid = chunkKm > 0 ? turf.along(seg, chunkKm / 2, { units: 'kilometers' }) : turf.point(seg.geometry.coordinates[0]);
      } catch (e) {
        mid = turf.point(seg.geometry.coordinates[0]);
      }
      
      if (hasOpenRefuges) {
        const nearest = turf.nearestPoint(mid, openRefuges);
        if (nearest) {
          distanceToHelpKm = turf.distance(mid, nearest, { units: 'kilometers' });
          nearestRefuge = {
            id: nearest.properties.id,
            name: nearest.properties.name,
            type: nearest.properties.type,
            coords: nearest.geometry.coordinates
          };
        }
      }
    }
    
    perChunk.push({
      cumulativeKm,
      distanceToHelpKm,
      nearestRefuge
    });
    
    if (distanceToHelpKm > refugeRadiusKm) {
      currentUnprotectedStretch += chunkKm;
      if (currentUnprotectedStretch > longestUnprotectedStretchKm) {
        longestUnprotectedStretchKm = currentUnprotectedStretch;
      }
    } else {
      currentUnprotectedStretch = 0;
    }
    
    if (hasOpenRefuges && distanceToHelpKm > maxDist) {
      maxDist = distanceToHelpKm;
    }
    
    if (hasOpenRefuges) {
      totalDistSum += distanceToHelpKm;
    }
    
    const chunkContribution = chunkKm * Math.min(distanceToHelpKm / maxHelpDistanceKm, 1);
    isolationExposure += chunkContribution;
    
    cumulativeKm += chunkKm;
  }
  
  const validChunks = segFeatures.length;
  
  if (!hasOpenRefuges && validChunks > 0) {
    maxDist = 999;
  }
  
  const avgDistanceKm = hasOpenRefuges && validChunks > 0 ? (totalDistSum / validChunks) : (validChunks === 0 ? 0 : 999);

  return {
    perChunk,
    longestUnprotectedStretchKm,
    worstDistanceKm: maxDist,
    avgDistanceKm,
    isolationExposure
  };
}
