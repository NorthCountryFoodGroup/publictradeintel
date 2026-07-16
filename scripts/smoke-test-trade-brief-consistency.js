const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(app, /function tradeBriefConsistencyAudit/, "Trade Brief consistency audit should exist");
assert.match(app, /Ticker matches selected brief/, "audit should check selected ticker");
assert.match(app, /Timeframe uses selected prediction model/, "audit should check timeframe");
assert.match(app, /Rank metadata reconciles to ticker/, "audit should check rank metadata");
assert.match(app, /Score comes from selected prediction record/, "audit should check score source");
assert.match(app, /Data Reliability/, "Trade Brief should show data reliability");
assert.match(app, /No reliable price-based invalidation level is currently available/, "invalidation should not be fabricated");
assert.match(app, /This signal was not available for the latest scan/, "normal pages should use user-friendly unavailable wording");
assert.doesNotMatch(app, /Not in completed scan metadata|Provider operation unavailable|Fallback object missing|Internal field not populated/, "normal pages should not contain developer-oriented messages");

console.log("Trade Brief consistency smoke test passed.");

