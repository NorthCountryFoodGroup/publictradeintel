const assert = require("node:assert/strict");
const crypto = require("node:crypto");
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

const buildPrediction = extractFunction(server, "buildPrediction");
const refreshPredictions = extractFunction(server, "refreshPredictions");
const buildPredictionHash = crypto.createHash("sha256").update(buildPrediction).digest("hex");

assert.equal(
  buildPredictionHash,
  "72714872ed27c9c7d1ceac407a87e67d753afb9f6c7cec8f0051cc80631fb1bc",
  "buildPrediction changed; discovery work must preserve the approved prediction-engine baseline",
);

assert.match(
  refreshPredictions,
  /const scanUniverse = discoveryPipeline\.deepAnalysisCandidates;/,
  "deep-analysis candidates should continue crossing the established discovery boundary",
);
assert.match(
  refreshPredictions,
  /\.map\(\(stock\) => buildPrediction\(stock, config, policySignals, previousByTicker\)\)/,
  "selected candidates should continue feeding the unchanged buildPrediction contract",
);
assert.match(
  refreshPredictions,
  /\.sort\(\(a, b\) => b\.aiOpportunityScore - a\.aiOpportunityScore\)/,
  "existing post-prediction ordering should remain intact",
);

[
  "ticker",
  "name",
  "currentPrice",
  "marketVolume",
  "marketChangePercent",
  "marketProvider",
  "quoteTimestamp",
  "latestUnderlyingQuoteAt",
  "aiOpportunityScore",
  "oneDayScore",
  "threeDayScore",
  "sevenDayScore",
  "thirtyDayScore",
  "oneYearScore",
  "confidenceScore",
  "riskScore",
  "label",
  "status",
  "timeframeModels",
  "modelScores",
  "ensembleModels",
  "marketRegime",
  "dataQuality",
  "congressionalSignal",
  "predictionReason",
  "failureRisk",
  "scannedAt",
].forEach((field) => {
  assert.match(buildPrediction, new RegExp(`\\b${field}\\s*[,|:]`), `buildPrediction should retain output field ${field}`);
});

[
  "ticker",
  "name",
  "marketPrice",
  "marketVolume",
  "marketChangePercent",
  "marketUpdatedAt",
  "valuationScore",
  "momentumScore",
  "qualityScore",
  "volatilityScore",
  "pressScore",
  "committeeScore",
].forEach((field) => {
  assert.match(buildPrediction, new RegExp(`stock\\.${field}\\b`), `buildPrediction should retain candidate input ${field}`);
});

console.log("Prediction engine boundary contract passed.");
