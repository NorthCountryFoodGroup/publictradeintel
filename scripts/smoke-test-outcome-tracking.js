const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert.match(server, /PREDICTION_HISTORY_FILE/, "prediction history file should exist");
assert.match(server, /OUTCOME_STATUS_FILE/, "outcome status file should exist");
assert.match(server, /function historicalPredictionRows/, "historical prediction rows should be recorded");
assert.match(server, /predictionId/, "prediction history should include predictionId");
assert.match(server, /evaluationDueAt/, "prediction history should include evaluation due date");
assert.match(server, /tradingDaysFrom/, "evaluation due dates should use trading-day logic");
assert.match(server, /settlementStatus: "pending"/, "new predictions should begin pending");
assert.match(server, /function settlePredictionOutcomes/, "outcome settlement process should exist");
assert.match(server, /settlementStatus: "eligible"/, "eligible-but-not-priced outcomes should be preserved");
assert.match(server, /settlementStatus: "settled"/, "settled outcomes should be stored");
assert.match(server, /maximumFavorableExcursion/, "MFE field should exist");
assert.match(server, /maximumAdverseExcursion/, "MAE field should exist");
assert.match(server, /\/api\/admin\/settle-outcomes/, "manual admin settlement route should exist");
assert.equal(pkg.scripts["smoke:outcome-tracking"], "node scripts/smoke-test-outcome-tracking.js");

console.log("Outcome tracking smoke test passed.");
