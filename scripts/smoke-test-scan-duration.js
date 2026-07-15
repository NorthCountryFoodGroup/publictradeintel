const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(server, /lifecycleStartedAt = Date\.now\(\)/, "scan should start lifecycle timing before work begins");
assert.match(server, /universeLoadDuration/, "scan should time universe loading");
assert.match(server, /quoteRefreshDuration/, "scan should time quote refresh");
assert.match(server, /deepAnalysisDuration/, "scan should time deep analysis");
assert.match(server, /rankingDuration/, "scan should time ranking");
assert.match(server, /validationDuration/, "scan should time validation");
assert.match(server, /saveDuration/, "scan should time saving");
assert.match(server, /publishDuration/, "scan should time publishing");
assert.match(server, /stageTimingMode: "parallel"/, "scan health should clarify that stages can overlap");
assert.match(server, /totalWallClockTimeMs/, "scan health should expose total wall-clock time");
assert.match(app, /durationBreakdown/, "UI should display duration breakdown");
assert.match(app, /Total Wall Clock Time/, "UI should label total duration as wall-clock time");
assert.match(app, /Parallel Stage Timing/, "UI should label parallel stage timing");

console.log("Scan duration smoke test passed.");
