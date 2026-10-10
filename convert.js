const fs = require('fs');

const safetyZonesRaw = fs.readFileSync('/Users/vikaskp/Downloads/SafeRoute Synthetic Zones/safety_zones.json', 'utf-8');
const safetyZones = JSON.parse(safetyZonesRaw);

const featureCollection = {
  type: "FeatureCollection",
  features: []
};

safetyZones.forEach(z => {
  featureCollection.features.push({
    type: "Feature",
    properties: {
      id: z.demo_id,
      name: z.label,
      risk: z.risk_category === 'elevated' ? 'red' : z.risk_category === 'moderate' ? 'yellow' : 'green',
      risk_category: z.risk_category,
      mult_daytime: z.mult_daytime,
      mult_evening: z.mult_evening,
      mult_night: z.mult_night,
      note: z.description,
      data_origin: z.data_origin,
      is_synthetic: z.is_synthetic,
      scenario_id: z.scenario_id,
      size_class: z.size_class
    },
    geometry: z.geometry_json
  });
});

fs.writeFileSync('client/public/zones.bengaluru.geojson', JSON.stringify(featureCollection, null, 2));
fs.writeFileSync('server/data/zones.bengaluru.geojson', JSON.stringify(featureCollection, null, 2));

console.log(`Converted ${featureCollection.features.length} zones.`);
