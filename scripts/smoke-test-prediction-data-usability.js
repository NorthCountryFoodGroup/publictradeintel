const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

assert.match(server, /criticalDataComplete/, "predictions should include criticalDataComplete");
assert.match(server, /fallbackDataUsed/, "predictions should include fallbackDataUsed");
assert.match(server, /staleDataUsed/, "predictions should include staleDataUsed");
assert.match(server, /missingCriticalFields/, "predictions should include missingCriticalFields");
assert.match(server, /missingOptionalFields/, "predictions should include missingOptionalFields");
assert.match(server, /dataUsabilityStatus/, "predictions should include dataUsabilityStatus");
assert.match(server, /dataQualityPenalty/, "predictions should include dataQualityPenalty");
assert.match(server, /freshnessPenalty/, "predictions should include freshnessPenalty");
assert.match(server, /1-day confidence was capped because critical quote\/intraday data is incomplete/, "high-confidence 1-day picks should be downgraded when critical data is missing");
assert.match(server, /Fallback market data was used/, "fallback usage should be explained");

console.log("Prediction data usability smoke test passed.");
