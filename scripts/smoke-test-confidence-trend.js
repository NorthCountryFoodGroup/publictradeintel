const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(app, /function confidenceTrend/, "confidence trend helper should exist");
assert.match(app, /predictionEngine\.predictionHistory \|\| predictionEngine\.performanceHistory \|\| predictionEngine\.history/, "confidence trend should use stored history only");
assert.match(app, /Confidence trend will appear after additional scans/, "missing history should be honest");
assert.match(app, /Insufficient History/, "missing history label should render");
assert.match(app, /Current Confidence/, "current confidence should render");
assert.match(app, /Previous Confidence/, "previous confidence should render");
assert.match(app, /Direction Change/, "direction change should render");
assert.match(app, /Recommendation Change/, "recommendation change should render");

console.log("Confidence trend smoke test passed.");

