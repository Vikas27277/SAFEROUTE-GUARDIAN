const fs = require('fs');

const EXISTING_FILE = 'client/public/zones.bengaluru.geojson';
const SERVER_FILE = 'server/data/zones.bengaluru.geojson';

const geojson = JSON.parse(fs.readFileSync(EXISTING_FILE, 'utf-8'));

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

const numNewZones = 30;
const risks = ['green', 'yellow', 'red'];
const sizes = [
  { class: 'small', radiusBase: 0.002, count: 10 },
  { class: 'medium', radiusBase: 0.005, count: 10 },
  { class: 'large', radiusBase: 0.015, count: 10 },
];

let nextId = 13;

for (let i = 0; i < sizes.length; i++) {
  const sizeDef = sizes[i];
  for (let j = 0; j < sizeDef.count; j++) {
    const risk = risks[nextId % 3];
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
    // Close the polygon
    coordinates.push([...coordinates[0]]);
    
    const zoneId = `zone_${nextId.toString().padStart(3, '0')}`;
    
    const mult_daytime = Number(randomInRange(0.5, 1.8).toFixed(1));
    const mult_evening = Number(randomInRange(0.5, 1.8).toFixed(1));
    const mult_night = Number(randomInRange(0.5, 1.8).toFixed(1));
    
    geojson.features.push({
      type: "Feature",
      properties: {
        id: zoneId,
        name: `Simulated Zone ${nextId}`,
        risk: risk,
        note: `Illustrative synthetic polygon. ${sizeDef.class} zone. Does not describe any real place, incident or person. Simulated demo data, not real-time safety information.`,
        mult_daytime: mult_daytime,
        mult_evening: mult_evening,
        mult_night: mult_night,
        data_origin: "SYNTHETIC_DEMO_DATA",
        is_synthetic: true,
        scenario_id: `S_${sizeDef.class.toUpperCase()}_TEST`,
        size_class: sizeDef.class
      },
      geometry: {
        type: "Polygon",
        coordinates: [coordinates]
      }
    });
    
    nextId++;
  }
}

fs.writeFileSync(EXISTING_FILE, JSON.stringify(geojson, null, 2));
fs.writeFileSync(SERVER_FILE, JSON.stringify(geojson, null, 2));

console.log(`Generated 30 new zones. Total features: ${geojson.features.length}`);
