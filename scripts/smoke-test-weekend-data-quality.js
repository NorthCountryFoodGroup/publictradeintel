const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(server, /dataAvailability/, "engine health should expose data availability separately");
assert.match(server, /dataFreshness/, "engine health should expose data freshness separately");
assert.match(server, /predictionEngineStatus: status/, "engine status should remain separate from data quality");
assert.match(server, /providerFailurePercent >= 50/, "unavailable data should require critical provider failure threshold");
assert.match(server, /The scan completed with usable latest-session data/, "closed-market usable data should not be classified as failed");
assert.match(server, /usablePredictionRecords/, "health should count usable prediction records");
assert.match(app, /Data Availability/, "dashboard should show data availability");
assert.match(app, /Data Freshness/, "dashboard should show data freshness");
assert.doesNotMatch(app, /Market data as of: \$\{dataAsOf/, "scan message should not call provider fetch time market data time");

console.log("Weekend data quality smoke test passed.");
