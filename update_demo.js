const fs = require('fs');

const demoPath = 'client/scripts/validate_demo.js';
let code = fs.readFileSync(demoPath, 'utf8');

// We will replace the mockRoutes with RF-14 and RF-16 from the fixtures
code = code.replace(/const mockRoutes = \[[\s\S]*?\];/m, `const mockRoutes = [
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
];`);

fs.writeFileSync(demoPath, code);
console.log("Updated mockRoutes in validate_demo.js");
