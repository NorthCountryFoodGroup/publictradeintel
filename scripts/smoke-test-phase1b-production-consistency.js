const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const semantics = require(path.join(root, "prediction-semantics.js"));
const readinessGate = require(path.join(root, "discovery", "readiness-gate.js"));

function record(index, qualified) {
  return {
    ticker: `T${String(index).padStart(3, "0")}`,
    currentPrice: qualified ? 25 + index / 100 : null,
    latestUnderlyingQuoteAt: qualified ? "2026-09-12T20:00:00.000Z" : null,
    quoteTimestamp: qualified ? "2026-09-12T20:00:00.000Z" : null,
    marketVolume: qualified ? 1_000_000 + index : null,
    dataQualityStatus: qualified ? "good" : "failed",
    freshnessStatus: qualified ? "live" : "unavailable",
    criticalDataComplete: qualified,
    dataUsabilityStatus: qualified ? "usable" : "insufficient",
    missingCriticalFields: qualified ? [] : ["currentPrice", "marketVolume"],
    unifiedDirection: index % 3 ? "bullish" : "bearish",
    unifiedPredictionScore: 70 + (index % 10),
  };
}

function staleDerived(row) {
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
    recommendationQualified: true,
  };
}

function payload(qualifiedCount) {
  const predictions = Array.from({ length: 600 }, (_, index) => record(index, index < qualifiedCount));
  const legacyRows = predictions.slice(0, 283).map(staleDerived);
  return {
    updatedAt: "2026-09-12T22:11:42.000Z",
    predictions,
    predictionEngineHealth: { tickersScanned: 600, usablePredictionRecords: qualifiedCount },
    sections: {
      top25OneDay: legacyRows.slice(0, 25),
      top25SevenDay: legacyRows.slice(0, 25),
      stocksToBuyCenter: {
        rankingLists: {
          "overall:sevenDay": {
            qualifiedCount: 283,
            qualifiedRows: legacyRows,
            rows: legacyRows.slice(0, 25),
          },
        },
        bestIdeas: { current: legacyRows.slice(0, 10) },
      },
    },
  };
}

const zero = semantics.normalizePayload(payload(0));
assert.equal(zero.predictionSemantics.storedCount, 600);
assert.equal(zero.predictionSemantics.qualifiedCount, 0);
assert.equal(zero.sections.stocksToBuyCenter.rankingLists["overall:sevenDay"].qualifiedCount, 0);
assert.equal(zero.sections.stocksToBuyCenter.rankingLists["overall:sevenDay"].rows.length, 0);
assert.equal(zero.sections.stocksToBuyCenter.bestIdeas.current.length, 0);
assert.equal(zero.predictions[0].latestUnderlyingQuoteAt, null, "authoritative failed record must retain its missing timestamp");

const mixed = semantics.normalizePayload(payload(25));
const mixedList = mixed.sections.stocksToBuyCenter.rankingLists["overall:sevenDay"];
assert.equal(mixed.predictionSemantics.qualifiedCount, 25);
assert.equal(mixedList.qualifiedCount, 25);
assert.equal(mixedList.qualifiedRows.length, 25);
assert.equal(mixed.sections.stocksToBuyCenter.bestIdeas.current.length, 10);
assert.ok(mixedList.qualifiedRows.every((row) => semantics.isQualified(row)));
assert.ok(mixedList.qualifiedRows.every((row) => row.latestUnderlyingQuoteAt === "2026-09-12T20:00:00.000Z"));
assert.ok(mixedList.qualifiedRows.every((row) => row.scanReferencePriceTimestamp === "2026-09-12T20:00:00.000Z"));
assert.ok(mixedList.qualifiedRows.every((row) => row.scanReferencePrice === row.currentPrice));

const zeroMarket = semantics.deriveMarketSemantics(zero);
assert.equal(zeroMarket.qualifiedBias, "Insufficient evidence");
assert.equal(zeroMarket.usableEvidenceCount, 0);
assert.equal(zeroMarket.observedBreadthAvailable, false);
assert.equal(zeroMarket.qualifiedBullishCount, 0);
assert.equal(zeroMarket.qualifiedBearishCount, 0);

const mixedMarket = semantics.deriveMarketSemantics(mixed);
assert.equal(mixedMarket.qualifiedBias, "Bullish");
assert.equal(mixedMarket.qualifiedCount, 25);

const projected = readinessGate.projectBlockingReasons({
  criteria: [
    { criterionId: "execution-success", reasonCode: "V3_EXECUTION_FAILURE_RATE", status: "FAIL", pass: false, observedValue: 0, threshold: ">= 95%", description: "V3 execution succeeds reliably." },
    { criterionId: "api-compatibility", reasonCode: "API_CONTRACT_REGRESSION", status: "UNKNOWN", pass: false, observedValue: null, threshold: "all observations passing", description: "Required API contracts remain compatible." },
    { criterionId: "fallback-reliability", reasonCode: null, status: "PASS", pass: true, observedValue: 100, threshold: "100%", description: "Every failed v3 activation falls back completely to legacy." },
  ],
  blockingReasons: [
    { reasonCode: "V3_EXECUTION_FAILURE_RATE", message: "V3 execution succeeds reliably." },
    { reasonCode: "API_CONTRACT_REGRESSION", message: "Required API contracts remain compatible." },
  ],
});
assert.equal(projected.length, 2);
assert.match(projected[0].message, /has not met/i);
assert.match(projected[0].message, /Observed 0; required ">= 95%"/);
assert.match(projected[1].message, /unknown/i);
assert.equal(projected[1].status, "UNKNOWN");
assert.doesNotMatch(projected.map((item) => item.message).join(" "), /succeeds reliably|required api contracts remain compatible/i);

const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
assert.match(app, /deriveMarketSemantics\(predictionEngine\)/);
assert.match(app, /requalifyDerivedRows\([\s\S]*predictionEngine\.predictions/);
assert.match(server, /projectBlockingReasons\(readiness\)/);

console.log("Phase 1B production consistency contract passed.");
