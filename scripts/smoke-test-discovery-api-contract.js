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

function assertRoute(method, pathname) {
  const escaped = pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    handleApi,
    new RegExp(`request\\.method\\s*===\\s*"${method}"\\s*&&\\s*pathname\\s*===\\s*"${escaped}"`),
    `${method} ${pathname} should remain available`,
  );
}

const handleApi = extractFunction(server, "handleApi");
const refreshPredictions = extractFunction(server, "refreshPredictions");
const predictionSections = extractFunction(server, "predictionSections");

[
  ["POST", "/api/login"],
  ["POST", "/api/logout"],
  ["GET", "/api/session"],
  ["GET", "/api/config"],
  ["GET", "/api/policy-signals"],
  ["GET", "/api/symbol-universe"],
  ["GET", "/api/performance-summary"],
  ["GET", "/api/predictions"],
  ["POST", "/api/predictions/scan"],
  ["GET", "/api/congress-feed-status"],
  ["GET", "/api/symbol-universe-status"],
  ["GET", "/api/market-index-data"],
  ["GET", "/api/portfolio"],
  ["PUT", "/api/portfolio"],
  ["GET", "/api/quote"],
  ["POST", "/api/events"],
  ["GET", "/api/admin/config"],
  ["PUT", "/api/admin/config"],
  ["GET", "/api/admin/summary"],
  ["GET", "/api/admin/discovery-readiness"],
  ["GET", "/api/admin/symbol-universe-diagnostic"],
  ["GET", "/api/admin/market-index-diagnostic"],
  ["GET", "/api/admin/congress-connection-diagnostic"],
  ["POST", "/api/admin/refresh-market"],
  ["POST", "/api/admin/import/congress"],
  ["POST", "/api/admin/refresh-policy"],
  ["POST", "/api/admin/refresh-symbol-universe"],
  ["POST", "/api/admin/reload-symbol-snapshot"],
  ["POST", "/api/admin/refresh-predictions"],
  ["POST", "/api/admin/settle-outcomes"],
  ["POST", "/api/admin/refresh-congress-feed"],
].forEach(([method, pathname]) => assertRoute(method, pathname));

[
  "updatedAt",
  "predictions",
  "sections",
  "predictionEngineHealth",
  "scanHealth",
  "predictionHistory",
  "performanceSummary",
  "outcomeSettlementStatus",
  "scanUniverse",
  "refreshCadence",
  "performanceTrackingWindows",
  "historicalRankingTracking",
  "warnings",
  "errors",
  "modelVersion",
  "notes",
].forEach((field) => {
  assert.match(refreshPredictions, new RegExp(`\\b${field}\\s*[,|:]`), `prediction response should retain ${field}`);
});

[
  "topBuyCandidates",
  "stocksToBuyCenter",
  "top25OneDay",
  "top25SevenDay",
  "top25OneMonth",
  "top25OneYear",
  "bestFiveOneDay",
  "bestFiveSevenDay",
  "bestFiveOneMonth",
  "bestFiveOneYear",
  "avoidList",
  "comparisonView",
  "highAlignmentCandidates",
  "changedSinceLastScan",
  "oneDayOpportunities",
  "threeDayOpportunities",
  "sevenDayOpportunities",
  "thirtyDayOpportunities",
  "dailyOpportunities",
  "weeklyOpportunities",
  "monthlyOpportunities",
  "goldSilverOpportunities",
  "highestMomentum",
  "strongestSector",
  "congressionalTradeSignals",
  "strongestOneDay",
  "strongestThreeDay",
  "strongestSevenDay",
  "strongestThirtyDay",
  "biggestScoreIncrease",
  "biggestScoreDrop",
].forEach((field) => {
  assert.match(predictionSections, new RegExp(`\\b${field}\\s*[,|:]`), `prediction sections should retain ${field}`);
});

assert.match(handleApi, /saved\s*&&\s*Array\.isArray\(saved\.predictions\)/, "GET predictions should continue serving a valid saved scan");
assert.match(handleApi, /await runPredictionScan\(\)/, "prediction scan routes should continue invoking the existing scan entry point");

console.log("Discovery API compatibility contract passed.");
