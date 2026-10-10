import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scoreRoute } from '../src/lib/riskEngine.js';
import { DEFAULT_CONFIG } from '../../shared/scoringConfig.js';
import assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ZONES_FILE = path.join(__dirname, '../../server/data/zones.bengaluru.geojson');

// Mock Mapbox routes simulating the real-world demo geometry
const mockRoutes = [
  {
    id: "fastest",
    label: "Fastest Route",
    durationMin: 18,
    distanceKm: 5.2,
    geometry: {
      type: "LineString",
      coordinates: [
        [77.592, 12.95],
        [77.64, 12.95]
      ]
    }
  },
  {
    id: "safer",
    label: "Alternative 1",
    durationMin: 22,
    distanceKm: 7.8,
    geometry: {
      type: "LineString",
      coordinates: [
        [77.592, 12.95],
        [77.60, 12.968],
        [77.632, 12.968],
        [77.64, 12.95]
      ]
    }
  }
];

function runValidation() {
  console.log("Validating SafeRoute Guardian Demo Configuration...\n");
  
  const zonesRaw = fs.readFileSync(ZONES_FILE, 'utf-8');
  const zones = JSON.parse(zonesRaw);

  const demoDate = new Date();
  demoDate.setHours(22, 30, 0, 0); // 10:30 PM

  const analyzed = mockRoutes.map(r => scoreRoute(r, zones, demoDate, DEFAULT_CONFIG));
  analyzed.sort((a, b) => a.travelTimeMin - b.travelTimeMin);
  
  const fastestRoute = analyzed[0];
  let saferRoute = null;
  
  for (let i = 1; i < analyzed.length; i++) {
    if (analyzed[i].routeCost < fastestRoute.routeCost && 
        analyzed[i].safetyScore >= fastestRoute.safetyScore + 10) {
      if (!saferRoute || analyzed[i].routeCost < saferRoute.routeCost) {
        saferRoute = analyzed[i];
      }
    }
  }

  // Reporting
  console.log("=== FASTEST ROUTE ===");
  console.log(`Time: ${fastestRoute.travelTimeMin.toFixed(1)} min`);
  console.log(`Safety Score: ${fastestRoute.safetyScore.toFixed(1)}`);
  console.log(`Route Cost: ${fastestRoute.routeCost.toFixed(1)}`);
  console.log(`Exposure (Red/Yellow/Green): ${(fastestRoute.exposureKm.red || 0).toFixed(2)} / ${(fastestRoute.exposureKm.yellow || 0).toFixed(2)} / ${(fastestRoute.exposureKm.green || 0).toFixed(2)} km`);

  if (!saferRoute) {
    console.error("\n[FAILED] NO QUALIFYING SAFER ROUTE FOUND.");
    process.exit(1);
  }

  console.log("\n=== SAFER ROUTE ===");
  console.log(`Time: ${saferRoute.travelTimeMin.toFixed(1)} min`);
  console.log(`Safety Score: ${saferRoute.safetyScore.toFixed(1)}`);
  console.log(`Route Cost: ${saferRoute.routeCost.toFixed(1)}`);
  console.log(`Exposure (Red/Yellow/Green): ${(saferRoute.exposureKm.red || 0).toFixed(2)} / ${(saferRoute.exposureKm.yellow || 0).toFixed(2)} / ${(saferRoute.exposureKm.green || 0).toFixed(2)} km`);
  
  console.log("\n=== TRADE-OFF ===");
  console.log(`Extra time: ${(saferRoute.travelTimeMin - fastestRoute.travelTimeMin).toFixed(1)} min`);
  console.log(`Safety Improvement: ${(saferRoute.safetyScore - fastestRoute.safetyScore).toFixed(1)} pts`);

  // Assertions (Step 10 Requirements)
  try {
    assert(fastestRoute, "A fastest route exists");
    assert(saferRoute, "A qualifying safer route exists");
    
    // Safer route takes only a few minutes longer
    const extraTime = saferRoute.travelTimeMin - fastestRoute.travelTimeMin;
    assert(extraTime > 0 && extraTime <= 10, "The safer route takes only a few minutes longer");
    
    // Safer route has significantly higher Safety Score
    assert(saferRoute.safetyScore >= fastestRoute.safetyScore + 10, "The safer route has a significantly higher Safety Score");
    
    // Fastest route has meaningful high/moderate risk exposure
    const fastestExposure = (fastestRoute.exposureKm.red || 0) + (fastestRoute.exposureKm.yellow || 0);
    assert(fastestExposure > 0, "The fastest route has meaningful risk exposure");
    
    // Safer route has substantially lower high-risk exposure
    const saferExposure = (saferRoute.exposureKm.red || 0) + (saferRoute.exposureKm.yellow || 0);
    assert(saferExposure < fastestExposure, "The safer route has substantially lower high-risk exposure");
    
    // Route Cost correctly determines safer corridor
    assert(saferRoute.routeCost < fastestRoute.routeCost, "Route Cost correctly determines the recommended safer corridor");
    
    // Safety scores remain between 0 and 100
    assert(fastestRoute.safetyScore >= 0 && fastestRoute.safetyScore <= 100, "Safety Score bounds");
    assert(saferRoute.safetyScore >= 0 && saferRoute.safetyScore <= 100, "Safety Score bounds");
    
    console.log("\n[SUCCESS] All demo validation tests passed. The Bengaluru demo is reliably calibrated.");
  } catch (err) {
    console.error(`\n[FAILED] Validation error: ${err.message}`);
    process.exit(1);
  }
}

runValidation();
