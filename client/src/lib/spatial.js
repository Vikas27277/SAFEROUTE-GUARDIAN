import * as turf from '@turf/turf';

const RANK = { none: 0, green: 1, yellow: 2, red: 3 };
const CHUNK_KM = 0.05; // 50 meters

export function analyseRoute(geometry, zones) {
  const line = turf.lineString(geometry.coordinates || geometry);
  const chunks = turf.lineChunk(line, CHUNK_KM, { units: 'kilometers' });
  const exposureKm = { red: 0, yellow: 0, green: 0, none: 0 };
  const crossed = new Set();
  const redZones = new Set();
  
  // Cache bboxes for performance
  if (!zones._bboxes) {
    zones._bboxes = zones.features.map(z => ({
      feature: z,
      bbox: turf.bbox(z)
    }));
  }
  const zoneBBoxes = zones._bboxes;

  const segments = chunks.features.map((seg) => {
    const km = turf.length(seg, { units: 'kilometers' });
    const mid = turf.along(seg, km / 2, { units: 'kilometers' });
    let risk = 'none', zoneId = null;
    
    // Check bounding box first
    const [mx, my] = mid.geometry.coordinates;
    for (const z of zoneBBoxes) {
      const [minX, minY, maxX, maxY] = z.bbox;
      if (mx >= minX && mx <= maxX && my >= minY && my <= maxY) {
        const zRisk = z.feature.properties.risk;
        if (RANK[zRisk] > RANK[risk] && turf.booleanPointInPolygon(mid, z.feature)) {
          risk = zRisk;
          zoneId = z.feature.properties.id;
        }
      }
    }
    
    exposureKm[risk] += km;
    if (zoneId) {
      crossed.add(zoneId);
      if (risk === 'red') {
        redZones.add(zoneId);
      }
    }
    seg.properties = { 
      risk, 
      km, 
      midPoint: mid.geometry.coordinates 
    };
    return seg;
  });

  const totalKm = chunks.features.reduce((sum, seg) => sum + seg.properties.km, 0);
  const redZoneExposureDistance = exposureKm.red;
  const redZoneExposureRatio = totalKm > 0 ? redZoneExposureDistance / totalKm : 0;

  return {
    exposureKm,
    crossedZones: [...crossed],
    segments: turf.featureCollection(segments),
    intersectsRedZone: redZoneExposureDistance > 0,
    redZoneExposureDistance,
    redZoneExposureRatio,
    redZoneCount: redZones.size,
    riskZoneIds: [...redZones]
  };
}
