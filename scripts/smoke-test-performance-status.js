const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert.match(server, /function performanceSummary/, "performance summary should exist");
assert.match(server, /predictionsRecorded/, "performance summary should count recorded predictions");
assert.match(server, /predictionsPending/, "performance summary should count pending predictions");
assert.match(server, /predictionsEligible/, "performance summary should count eligible predictions");
assert.match(server, /predictionsSettled/, "performance summary should count settled predictions");
assert.match(app, /No settled predictions yet/, "performance wording should avoid vague pending state");
assert.match(app, /Awaiting first market close/, "1-day performance status should be precise");
assert.match(app, /First results expected/, "monthly performance status should show expected timing");
assert.match(app, /Live Forward Results/, "forward results should be separate from backtests");
assert.match(app, /Historical Backtest Results/, "backtests should be labeled separately");
assert.match(app, /settled.*recorded|recorded.*settled/i, "sample counts should be shown beside metrics");
assert.equal(pkg.scripts["smoke:performance-status"], "node scripts/smoke-test-performance-status.js");

console.log("Performance status smoke test passed.");
