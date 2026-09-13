const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const scenarioArg = process.argv.find((arg) => arg.startsWith("--scenario="))?.split("=")[1] || "zero";
const port = Number(process.argv.find((arg) => arg.startsWith("--port="))?.split("=")[1]) || 3311;
const qualifiedCount = scenarioArg === "mixed" ? 25 : 0;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), `publictradeintel-phase1b-${scenarioArg}-`));
fs.copyFileSync(path.join(__dirname, "..", "data", "config.json"), path.join(dataDir, "config.json"));

function record(index, qualified) {
  const ticker = `B${String(index).padStart(3, "0")}`;
  return {
    ticker,
    name: `Browser fixture ${ticker}`,
    currentPrice: qualified ? 20 + index : null,
    latestUnderlyingQuoteAt: qualified ? "2026-09-12T20:00:00.000Z" : null,
    quoteTimestamp: qualified ? "2026-09-12T20:00:00.000Z" : null,
    marketVolume: qualified ? 1_000_000 + index : null,
    dataQualityStatus: qualified ? "good" : "failed",
    freshnessStatus: qualified ? "live" : "unavailable",
    criticalDataComplete: qualified,
    dataUsabilityStatus: qualified ? "usable" : "insufficient",
    missingCriticalFields: qualified ? [] : ["currentPrice", "marketVolume"],
    unifiedDirection: index % 4 ? "bullish" : "bearish",
    unifiedPredictionScore: 80 - (index % 20),
    oneDayScore: 80 - (index % 20),
    sevenDayScore: 80 - (index % 20),
    thirtyDayScore: 80 - (index % 20),
    oneYearScore: 80 - (index % 20),
    riskScore: 25,
    confidenceTier: "High",
    sector: index % 2 ? "Technology" : "Energy",
  };
}

function stale(row) {
  return {
    ...row,
    currentPrice: 42.5,
    scanReferencePrice: 42.5,
    latestUnderlyingQuoteAt: "2026-07-21T17:21:10.000Z",
    quoteTimestamp: "2026-07-21T17:21:10.000Z",
    scanReferencePriceTimestamp: "2026-07-21T17:21:10.000Z",
    marketVolume: 900_000,
    dataQualityStatus: "good",
    freshnessStatus: "live",
    criticalDataComplete: true,
    dataUsabilityStatus: "usable",
    missingCriticalFields: [],
    qualified: true,
  };
}

const predictions = Array.from({ length: 600 }, (_, index) => record(index, index < qualifiedCount));
const legacyRows = predictions.slice(0, 283).map(stale);
const currentQualified = predictions.slice(0, qualifiedCount);
const payload = {
  updatedAt: "2026-09-12T22:11:42.000Z",
  predictions,
  predictionEngineHealth: {
    status: "healthy",
    predictionEngineStatus: "Healthy",
    tickersScanned: 600,
    predictionsGenerated: 600,
    usablePredictionRecords: qualifiedCount,
    dataAvailability: qualifiedCount ? "Available" : "Unavailable",
  },
  scanHealth: {
    scanCompletedAt: "2026-09-12T22:11:42.000Z",
    deepCandidatesSelected: 600,
    dataAvailability: qualifiedCount ? "Available" : "Unavailable",
    discoverySelector: { activeEngine: "legacy", requestedEngine: "legacy", resolvedEngine: "legacy" },
    discoveryReadiness: {
      status: "NOT_READY",
      recommendation: "KEEP_LEGACY",
      observationCount: 20,
      criteria: [
        {
          criterionId: "execution-success",
          status: "FAIL",
          pass: false,
          observedValue: 0,
          threshold: ">= 95%",
          reasonCode: "EXECUTION_SUCCESS_BELOW_THRESHOLD",
        },
        {
          criterionId: "api-compatibility",
          status: "UNKNOWN",
          pass: false,
          observedValue: null,
          threshold: "all observations passing",
          reasonCode: "API_COMPATIBILITY_INCOMPLETE",
        },
      ],
      blockingReasons: [
        { reasonCode: "EXECUTION_SUCCESS_BELOW_THRESHOLD", message: "Execution success meets the required threshold." },
        { reasonCode: "API_COMPATIBILITY_INCOMPLETE", message: "API compatibility passes for all observations." },
      ],
      limitations: [],
    },
    discoveryReadinessHistory: {
      storageAvailable: true,
      observationCount: 20,
      retainedObservationCount: 20,
      maximumObservations: 100,
      warnings: [],
      limitations: [],
    },
  },
  sections: {
    top25OneDay: currentQualified,
    top25SevenDay: currentQualified,
    top25OneMonth: currentQualified,
    top25OneYear: currentQualified,
    stocksToBuyCenter: {
      rankingLists: {
        "overall:oneDay": { qualifiedCount: 283, qualifiedRows: legacyRows, rows: legacyRows.slice(0, 25) },
        "overall:sevenDay": { qualifiedCount: 283, qualifiedRows: legacyRows, rows: legacyRows.slice(0, 25) },
        "overall:oneMonth": { qualifiedCount: 283, qualifiedRows: legacyRows, rows: legacyRows.slice(0, 25) },
        "overall:oneYear": { qualifiedCount: 283, qualifiedRows: legacyRows, rows: legacyRows.slice(0, 25) },
      },
      bestIdeas: { current: legacyRows.slice(0, 10) },
    },
  },
};
fs.writeFileSync(path.join(dataDir, "predictions.json"), JSON.stringify(payload));

const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
  cwd: path.join(__dirname, ".."),
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    DATA_DIR: dataDir,
    LOGIN_PIN: "phase1b-login-9081",
    ADMIN_PIN: "phase1b-admin-4617",
    PORTFOLIO_PIN: "phase1b-portfolio-7254",
    DECISION_LAB_ENABLED: "false",
    V3_SHADOW_ENABLED: "false",
    PRODUCTION_ORDER_EXECUTION_ENABLED: "false",
    PREDICTION_REFRESH_MS: "0",
    POLICY_REFRESH_MS: "0",
    CONGRESS_REFRESH_MS: "0",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.on("data", (chunk) => process.stdout.write(chunk));
child.stderr.on("data", (chunk) => process.stderr.write(chunk));
console.log(`PHASE1B_FIXTURE scenario=${scenarioArg} port=${port}`);

function cleanup() {
  if (!child.killed) child.kill();
  try {
    const resolved = path.resolve(dataDir);
    if (path.basename(resolved).startsWith(`publictradeintel-phase1b-${scenarioArg}-`)) fs.rmSync(resolved, { recursive: true, force: true });
  } catch {}
}
process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });
child.on("exit", () => { cleanup(); process.exit(0); });
