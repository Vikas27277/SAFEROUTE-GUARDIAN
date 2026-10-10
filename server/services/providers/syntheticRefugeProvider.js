import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getSyntheticRefuges() {
  try {
    const dataPath = path.join(__dirname, '../../data/refuges.bengaluru.geojson');
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (err) {
    console.error('Failed to load synthetic refuge data:', err);
    // Return empty FeatureCollection if it fails, so we don't crash
    return {
      type: "FeatureCollection",
      features: []
    };
  }
}
