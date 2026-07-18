const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

function extractFunction(source, name) {
  const signature = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const match = signature.exec(source);
  assert.ok(match, `${name} should exist`);
  const parametersOpen = source.indexOf("(", match.index);
  let parameterDepth = 0;
  let parametersClose = -1;
  for (let index = parametersOpen; index < source.length; index += 1) {
    if (source[index] === "(") parameterDepth += 1;
    if (source[index] === ")") {
      parameterDepth -= 1;
      if (parameterDepth === 0) {
        parametersClose = index;
        break;
      }
    }
  }
  const open = source.indexOf("{", parametersClose);
  assert.notEqual(open, -1, `${name} should have a body`);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(match.index, index + 1);
    }
  }
  assert.fail(`${name} should have a balanced body`);
}

[
  ["PREDICTIONS_FILE", 'path.join(DATA_DIR, "predictions.json")'],
  ["PREDICTION_HISTORY_FILE", 'path.join(DATA_DIR, "predictionHistory.json")'],
  ["OUTCOME_STATUS_FILE", 'path.join(DATA_DIR, "outcomeStatus.json")'],
].forEach(([constant, initializer]) => {
  assert.ok(server.includes(`const ${constant} = ${initializer};`), `${constant} should retain its persisted file`);
});

const refreshPredictions = extractFunction(server, "refreshPredictions");
const historicalPredictionRows = extractFunction(server, "historicalPredictionRows");
const appendPredictionHistory = extractFunction(server, "appendPredictionHistory");
const settlePredictionOutcomes = extractFunction(server, "settlePredictionOutcomes");
const performanceSummary = extractFunction(server, "performanceSummary");

assert.match(refreshPredictions, /appendPredictionHistory\(historicalPredictionRows\(/, "scans should continue appending history before publishing");
assert.match(refreshPredictions, /settlePredictionOutcomes\(config\)/, "scans should continue settling due outcomes");
assert.match(refreshPredictions, /writeJson\(PREDICTIONS_FILE, result\)/, "scans should continue publishing the current result to predictions.json");

[
  "predictionId",
  "scanId",
  "modelVersion",
  "ticker",
  "timeframe",
  "rank",
  "predictionTimestamp",
  "evaluationDueAt",
  "predictedDirection",
  "unifiedScore",
  "confidenceTier",
  "recommendation",
  "referencePrice",
  "referencePriceTimestamp",
  "targetPrice",
  "stopPrice",
  "signalSummary",
  "dataFreshness",
  "universe",
  "settlementStatus",
].forEach((field) => {
  assert.match(historicalPredictionRows, new RegExp(`\\b${field}\\s*[,|:]`), `history records should retain ${field}`);
});

assert.match(appendPredictionHistory, /predictionId/, "history deduplication should remain prediction-ID based");
assert.match(appendPredictionHistory, /nextRecords\.slice\(-10000\)/, "prediction history should retain its 10,000-record cap");
assert.match(appendPredictionHistory, /writeJson\(PREDICTION_HISTORY_FILE, result\)/, "history should continue writing predictionHistory.json");

assert.match(settlePredictionOutcomes, /writeJson\(PREDICTION_HISTORY_FILE, result\)/, "settlement should continue updating prediction history");
assert.match(settlePredictionOutcomes, /writeJson\(OUTCOME_STATUS_FILE, status\)/, "settlement should continue writing outcome status");
assert.match(settlePredictionOutcomes, /settlementStatus:\s*"settled"/, "settlement records should retain settled status");

[
  "recordsTotal",
  "predictionsRecorded",
  "predictionsPending",
  "predictionsEligible",
  "predictionsSettled",
  "byTimeframe",
  "liveForwardResultsOnly",
  "historicalBacktestResults",
].forEach((field) => {
  assert.match(performanceSummary, new RegExp(`\\b${field}\\s*[,|:]`), `performance summary should retain ${field}`);
});

console.log("Discovery persistence compatibility contract passed.");
