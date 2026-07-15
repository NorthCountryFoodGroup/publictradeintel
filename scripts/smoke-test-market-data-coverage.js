const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(server, /function buildMarketDataCoverage/, "server should build market-data coverage metrics");
assert.match(server, /function marketDataAvailabilityFromCoverage/, "availability classification should be centralized");
assert.match(server, /symbolsRequested/, "coverage should include symbols requested");
assert.match(server, /symbolsReturned/, "coverage should include symbols returned");
assert.match(server, /symbolsMissingCriticalFields/, "coverage should include missing critical fields");
assert.match(server, /criticalFieldCoveragePercent/, "coverage should include critical-field coverage percent");
assert.match(server, /percent < 40[\s\S]*"Unavailable"/, "unavailable should require below-threshold critical coverage");
assert.match(server, /percent < 70[\s\S]*"Degraded"/, "degraded threshold should exist");
assert.match(server, /percent < 90[\s\S]*"Partial"/, "partial threshold should exist");
assert.match(server, /percent < 95[\s\S]*"Good"/, "good threshold should exist");
assert.match(app, /Market Data Availability/, "UI should show market-data availability");
assert.match(app, /had required data/, "UI should include availability counts");

console.log("Market data coverage smoke test passed.");
