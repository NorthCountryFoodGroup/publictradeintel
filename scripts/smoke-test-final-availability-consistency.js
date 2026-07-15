const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function expectedAvailabilityLabel(ready, total) {
  const percent = total ? (ready / total) * 100 : 0;
  if (percent < 40) return "Unavailable";
  if (percent < 70) return "Degraded";
  if (percent < 90) return "Partial";
  if (percent < 95) return "Good";
  return "Complete";
}

assert.equal(expectedAvailabilityLabel(2229, 2500), "Partial", "2229 of 2500 should classify as Partial");
assert.equal(expectedAvailabilityLabel(2231, 2500), "Partial", "2231 of 2500 should classify as Partial");
assert.match(server, /function marketDataAvailabilityFromCoverage/, "backend should keep shared availability threshold function");
assert.match(server, /percent < 90[\s\S]*"Partial"/, "backend threshold should classify 70-89.99% as Partial");
assert.match(app, /Market Data Status[\s\S]*marketDataNote/, "dashboard should use completed scan market-data wording");
assert.doesNotMatch(app, /Market Data Status", dataStatus, `\$\{Number\(health\.marketQuotesSucceeded\)/, "normal dashboard should not present provider quote success as overall availability");
assert.match(app, /Primary Market Data Provider/, "dashboard should summarize provider role");
assert.match(app, /Cached Fresh Data Reused/, "dashboard should summarize cache/fallback reuse");

console.log("Final availability consistency smoke test passed.");

