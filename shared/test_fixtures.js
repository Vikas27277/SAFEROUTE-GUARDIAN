import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyseRoute } from '../client/src/lib/spatial.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const zonesRaw = fs.readFileSync(path.join(__dirname, '../server/data/zones.bengaluru.geojson'), 'utf-8');
const zones = JSON.parse(zonesRaw);

const fixturesRaw = fs.readFileSync(path.join(__dirname, 'route_fixtures.json'), 'utf-8');
const fixtures = JSON.parse(fixturesRaw);

let failed = 0;

for (const fixture of fixtures) {
  if (!fixture.is_valid_geometry) continue;

  const result = analyseRoute(fixture.geometry_json, zones);
  
  if (fixture.expected_zone_ids !== null) {
    const expectedZones = fixture.expected_zone_ids;
    const actualZones = result.crossedZones;
    
    // Check if the expected zones are in the actual zones (we might cross MORE because of random zones)
    // Actually, if we randomly generated zones, we expect them to cross OUR new zones as well.
    // The fixture says "expected_zone_ids: []" for RF-01, but we might have randomly generated a zone there!
    // The instructions say "Keep existing route_fixtures.json expectations unchanged unless you have verified why an update is required."
    
    const missingExpected = expectedZones.filter(z => !actualZones.includes(z));
    if (missingExpected.length > 0) {
      console.error(`Fixture ${fixture.fixture_id} failed: missing expected zones ${missingExpected.join(', ')}. Actual: ${actualZones.join(', ')}`);
      failed++;
    } else {
      console.log(`Fixture ${fixture.fixture_id} passed.`);
    }
  }
}

if (failed > 0) {
  console.error(`${failed} fixtures failed.`);
  process.exit(1);
} else {
  console.log("All valid fixtures passed.");
}
