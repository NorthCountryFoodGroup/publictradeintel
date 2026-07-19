const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

function resolveConfiguredDataDir(environmentValue, pathImplementation, repositoryRoot) {
  const process = { env: { DATA_DIR: environmentValue } };
  const path = pathImplementation;
  const __dirname = repositoryRoot;
  return Function("process", "path", "__dirname", `
    const CONFIGURED_DATA_DIR = String(process.env.DATA_DIR || "").trim();
    const DATA_DIR = CONFIGURED_DATA_DIR
      ? path.resolve(CONFIGURED_DATA_DIR)
      : path.join(__dirname, "data");
    return DATA_DIR;
  `)(process, path, __dirname);
}

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

assert.match(server, /const CONFIGURED_DATA_DIR = String\(process\.env\.DATA_DIR \|\| ""\)\.trim\(\);/);
assert.match(server, /const DATA_DIR = CONFIGURED_DATA_DIR\s*\?\s*path\.resolve\(CONFIGURED_DATA_DIR\)\s*:\s*path\.join\(__dirname, "data"\);/);
assert.equal(resolveConfiguredDataDir("/var/data", path.posix, "/srv/publictradeintel"), "/var/data", "production DATA_DIR should resolve to the mounted absolute path");
assert.equal(resolveConfiguredDataDir("  /var/data  ", path.posix, "/srv/publictradeintel"), "/var/data", "DATA_DIR should trim surrounding whitespace");
assert.equal(resolveConfiguredDataDir("   ", path.posix, "/srv/publictradeintel"), "/srv/publictradeintel/data", "blank DATA_DIR should use the repository data directory");
assert.equal(resolveConfiguredDataDir(undefined, path.posix, "/srv/publictradeintel"), "/srv/publictradeintel/data", "missing DATA_DIR should use the repository data directory");
assert.equal(resolveConfiguredDataDir("runtime-data", path.posix, "/srv/publictradeintel"), path.posix.resolve("runtime-data"), "relative DATA_DIR should resolve deterministically from the process working directory");

[
  ["DISCOVERY_READINESS_HISTORY_FILE", "DISCOVERY_READINESS_HISTORY_FILENAME"],
  ["CONFIG_FILE", '"config.json"'],
  ["EVENTS_FILE", '"events.json"'],
  ["POLICY_FILE", '"policySignals.json"'],
  ["CONGRESS_FEED_STATUS_FILE", '"congressFeedStatus.json"'],
  ["PORTFOLIO_FILE", '"portfolio.json"'],
  ["PREDICTIONS_FILE", 'path.join(DATA_DIR, "predictions.json")'],
  ["SYMBOL_UNIVERSE_FILE", '"symbolUniverse.json"'],
  ["PUBLIC_SYMBOL_SNAPSHOT_FILE", '"publicSymbolSnapshot.json"'],
  ["PREDICTION_HISTORY_FILE", 'path.join(DATA_DIR, "predictionHistory.json")'],
  ["OUTCOME_STATUS_FILE", 'path.join(DATA_DIR, "outcomeStatus.json")'],
].forEach(([constant, filenameOrInitializer]) => {
  const initializer = filenameOrInitializer.startsWith("path.join")
    ? filenameOrInitializer
    : `path.join(DATA_DIR, ${filenameOrInitializer})`;
  assert.ok(server.includes(`const ${constant} = ${initializer};`), `${constant} should retain its DATA_DIR-rooted persisted file`);
});

const readinessInitializer = server.match(/const DISCOVERY_READINESS_HISTORY_FILE = ([^;]+);/)?.[1];
const predictionsInitializer = server.match(/const PREDICTIONS_FILE = ([^;]+);/)?.[1];
assert.match(readinessInitializer || "", /^path\.join\(DATA_DIR, /, "readiness history should use the configured runtime root");
assert.match(predictionsInitializer || "", /^path\.join\(DATA_DIR, /, "prediction persistence should use the configured runtime root");
assert.doesNotMatch(server.match(/function boundedReadinessAdminPayload[\s\S]*?\n}/)?.[0] || "", /DATA_DIR|CONFIGURED_DATA_DIR|(?:file)?path\s*:/i, "admin diagnostics must not expose the absolute storage root");

const refreshPredictions = extractFunction(server, "refreshPredictions");
const writeJson = extractFunction(server, "writeJson");
const historicalPredictionRows = extractFunction(server, "historicalPredictionRows");
const appendPredictionHistory = extractFunction(server, "appendPredictionHistory");
const settlePredictionOutcomes = extractFunction(server, "settlePredictionOutcomes");
const performanceSummary = extractFunction(server, "performanceSummary");

assert.match(writeJson, /mkdirSync\(path\.dirname\(file\), \{ recursive: true \}\)/, "runtime storage directories should be created recursively");
assert.match(writeJson, /Runtime data storage is unavailable\./, "storage failures should remain visible without exposing an absolute path");
assert.doesNotMatch(writeJson, /error\.message|file\s*[}`]/, "storage failures should not disclose the runtime file path");
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
