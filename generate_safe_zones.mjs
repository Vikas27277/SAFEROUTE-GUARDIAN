import fs from 'fs';
import { analyseRoute } from './client/src/lib/spatial.js';

const EXISTING_FILE = 'client/public/zones.bengaluru.geojson';
const SERVER_FILE = 'server/data/zones.bengaluru.geojson';
const FIXTURES_FILE = 'shared/route_fixtures.json';

const geojson = JSON.parse(fs.readFileSync(EXISTING_FILE, 'utf-8'));
const fixtures = JSON.parse(fs.readFileSync(FIXTURES_FILE, 'utf-8'));

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

const numNewZones = 30;
const risks = ['low', 'moderate', 'elevated'];
const riskMap = { 'low': 'green', 'moderate': 'yellow', 'elevated': 'red' };
const sizes = [
  { class: 'small', radiusBase: 0.002, count: 10 },
  { class: 'medium', radiusBase: 0.005, count: 10 },
  { class: 'large', radiusBase: 0.015, count: 10 },
];

let nextId = 23;

function doesZoneBreakFixtures(feature) {
  const testZones = {
    type: "FeatureCollection",
    features: [...geojson.features, feature]
  };
  
  for (const fixture of fixtures) {
    if (!fixture.is_valid_geometry) continue;
    if (fixture.expected_zone_ids === null) continue;
    
    const result = analyseRoute(fixture.geometry_json, testZones);
    const actualZones = result.crossedZones;
    
    if (actualZones.includes(feature.properties.id)) {
        return true;
    }
  }
  return false;
}

for (let i = 0; i < sizes.length; i++) {
  const sizeDef = sizes[i];
  let generated = 0;
  
  while (generated < sizeDef.count) {
    const riskCategory = risks[nextId % 3];
    const risk = riskMap[riskCategory];
    const centerLon = randomInRange(77.45, 77.75);
    const centerLat = randomInRange(12.85, 13.15);
    const numPoints = Math.floor(randomInRange(5, 10));
    const coordinates = [];
    
    for (let k = 0; k < numPoints; k++) {
      const angle = (k / numPoints) * Math.PI * 2;
      const r = sizeDef.radiusBase * randomInRange(0.5, 1.5);
      coordinates.push([
        Number((centerLon + r * Math.cos(angle)).toFixed(5)),
        Number((centerLat + r * Math.sin(angle)).toFixed(5))
      ]);
    }
    coordinates.push([...coordinates[0]]);
    
    const zoneId = `SZ-${nextId.toString().padStart(2, '0')}`;
    
    const feature = {
      type: "Feature",
      properties: {
        id: zoneId,
        name: `Simulated Zone ${nextId}`,
        risk: risk,
        risk_category: riskCategory,
        note: `Illustrative synthetic polygon. ${sizeDef.class} zone. Simulated demo data.`,
        mult_daytime: Number(randomInRange(0.5, 1.8).toFixed(1)),
        mult_evening: Number(randomInRange(0.5, 1.8).toFixed(1)),
        mult_night: Number(randomInRange(0.5, 1.8).toFixed(1)),
        data_origin: "SYNTHETIC_DEMO_DATA",
        is_synthetic: true,
        scenario_id: `S_RANDOM_FILL`,
        size_class: sizeDef.class
      },
      geometry: {
        type: "Polygon",
        coordinates: [coordinates]
      }
    };
    
    if (!doesZoneBreakFixtures(feature)) {
      geojson.features.push(feature);
      nextId++;
      generated++;
    }
  }
}

fs.writeFileSync(EXISTING_FILE, JSON.stringify(geojson, null, 2));
fs.writeFileSync(SERVER_FILE, JSON.stringify(geojson, null, 2));

console.log(`Generated 30 new zones safely. Total features: ${geojson.features.length}`);
