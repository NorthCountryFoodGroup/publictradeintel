const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.js"), "utf8");

assert.match(server, /function marketDataAvailabilityFromCoverage/, "availability should use the shared backend threshold function");
assert.match(server, /percent < 90[\s\S]*"Partial"/, "89% critical-field coverage should be Partial");
assert.match(server, /Availability Label Matches Thresholds/, "consistency audit should verify availability labels");
assert.match(server, /Universe Source Matches Symbol Counts/, "consistency audit should verify universe source against counts");
assert.match(server, /Provider Coverage Matches Diagnostics/, "consistency audit should verify provider coverage against diagnostics");
assert.match(server, /Fallback Usage Matches Provider Logs/, "consistency audit should verify fallback usage against logs");
assert.match(server, /Wall Clock Timing/, "consistency audit should verify wall-clock timing");
assert.match(server, /consistencyScore/, "scan health should expose consistency score");
assert.match(server, /predictionEngineHealth\.status = predictionEngineHealth\.status === "Failed" \? "Failed" : "Warning"/, "consistency mismatch should warn without forcing failed engine");

assert.match(app, /function scanUniverseSourceLabel/, "UI should centralize universe source rendering");
assert.match(app, /function scanUniverseSourceNote/, "UI should centralize universe source notes");
assert.match(app, /Scan Universe Source/, "dashboard should render completed scan universe source");
assert.doesNotMatch(app, /metricCard\("Symbol Universe Source"[\s\S]*symbolUniverseStatus/, "dashboard should not render startup symbol-universe flags as scan truth");
assert.match(app, /Quote Coverage/, "provider card should label provider-specific quote coverage");
assert.match(app, /contribution/, "provider card should show provider contribution");
assert.match(app, /Not in completed scan metadata/, "market overview should not silently use non-scan globals");

assert.match(admin, /Consistency Report/, "admin should show consistency report");
assert.match(admin, /Consistency Score/, "admin should show consistency score");
assert.match(admin, /Checks Passed/, "admin should show passed check count");
assert.match(admin, /Checks Failed/, "admin should show failed check count");
assert.match(admin, /Expected:/, "admin consistency failures should include expected value");
assert.match(admin, /Actual:/, "admin consistency failures should include actual value");
assert.match(admin, /Source field:/, "admin consistency failures should include source field");
assert.match(admin, /Quote coverage percentage/, "admin provider report should label quote coverage");
assert.match(admin, /Provider contribution percentage/, "admin provider report should show provider contribution");

console.log("Consistency audit smoke test passed.");
