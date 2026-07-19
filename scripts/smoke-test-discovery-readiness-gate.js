const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const fixture = require("./fixtures/discovery-readiness-gate.json");
const { evaluateReadiness } = require(path.join(root, "discovery", "readiness-gate.js"));

function passingObservation(index = 0, overrides = {}) {
  return {
    observedAt: `2026-07-${String(index + 1).padStart(2, "0")}T16:00:00.000Z`,
    v3ExecutionAttempted: true,
    v3ExecutionSucceeded: true,
    explicitV3Requested: true,
    selectorActivatedV3: true,
    fallbackRequired: true,
    fallbackSucceeded: true,
    hybridPoolUsed: false,
    scanInterrupted: false,
    fatalErrorCount: 0,
    durationMs: 1000,
    runtimeLimitMs: fixture.runtimeLimitMs,
    eligibleEvaluatedCount: 100,
    sufficientEvidenceCount: 90,
    bucketAvailability: Object.fromEntries(fixture.approvedBuckets.map((bucket) => [bucket, true])),
    deepAnalysisCandidateCount: 40,
    minimumViableCandidateCount: 20,
    ineligibleSelectedCount: 0,
    unqualifiedSelectedCount: 0,
    explanationRequiredCount: 40,
    explanationCompleteCount: 40,
    explanationErrorCount: 0,
    deterministicPassed: true,
    duplicateTickerCount: 0,
    shadowExpected: true,
    shadowAvailable: true,
    apiCompatible: true,
    persistenceCompatible: true,
    predictionBoundaryCompatible: true,
    selectorAmbiguous: false,
    unresolvedCriticalDiagnostics: [],
    ...overrides,
  };
}

const noHistory = evaluateReadiness({ evaluatedAt: fixture.evaluatedAt, observations: [] });
assert.equal(noHistory.status, "INSUFFICIENT_OBSERVATIONS");
assert.equal(noHistory.readyForDefaultPromotion, false);
assert.equal(noHistory.currentDefaultEngine, "legacy");
assert.equal(noHistory.recommendation, "CONTINUE_SHADOW_VALIDATION");

const single = evaluateReadiness({
  evaluatedAt: fixture.evaluatedAt,
  observations: [passingObservation()],
});
assert.equal(single.status, "INSUFFICIENT_OBSERVATIONS");
assert.equal(single.readyForDefaultPromotion, false);

const readyObservations = Array.from({ length: fixture.minimumObservationCount }, (_, index) => passingObservation(index));
const ready = evaluateReadiness({
  evaluatedAt: fixture.evaluatedAt,
  minimumObservationCount: fixture.minimumObservationCount,
  observations: readyObservations,
});
assert.equal(ready.status, "READY");
assert.equal(ready.readyForDefaultPromotion, true);
assert.equal(ready.recommendation, "READY_FOR_DEFAULT_PROMOTION_REVIEW");
assert.ok(ready.criteria.every((item) => item.required && item.pass));
assert.equal(ready.comparisonHealth.overlapIsPerformanceValidation, false);

const unknownCriterion = evaluateReadiness({
  evaluatedAt: fixture.evaluatedAt,
  minimumObservationCount: fixture.minimumObservationCount,
  observations: readyObservations,
  requiredCriterionIds: ["future-unknown-check"],
});
assert.equal(unknownCriterion.status, "NOT_READY");
assert.ok(unknownCriterion.blockingReasons.some((item) => item.reasonCode === "UNKNOWN_REQUIRED_CRITERION"));

const malformed = evaluateReadiness({ observations: "not-an-array" });
assert.equal(malformed.status, "ERROR");
assert.deepEqual(malformed.failedCriteria, ["MALFORMED_READINESS_INPUT"]);
assert.doesNotThrow(() => evaluateReadiness(new Proxy({}, {
  get() { throw new Error("proxy failure"); },
})));

const blockerCases = [
  ["INELIGIBLE_CANDIDATE_SELECTED", { ineligibleSelectedCount: 1 }],
  ["UNQUALIFIED_CANDIDATE_SELECTED", { unqualifiedSelectedCount: 1 }],
  ["DUPLICATE_TICKER_SELECTED", { duplicateTickerCount: 1 }],
  ["V3_EXECUTION_FAILURE_RATE", { v3ExecutionSucceeded: false }],
  ["V3_RUNTIME_NONCOMPLIANCE", { durationMs: 20000 }],
  ["V3_BELOW_MINIMUM_POOL_RATE", { deepAnalysisCandidateCount: 0 }],
  ["EXPLANATION_COVERAGE_INCOMPLETE", { explanationCompleteCount: 0 }],
  ["FALLBACK_RELIABILITY_FAILURE", { fallbackSucceeded: false }],
  ["SELECTOR_CONFIGURATION_AMBIGUITY", { selectorAmbiguous: true }],
  ["SHADOW_DIAGNOSTIC_UNAVAILABLE", { shadowAvailable: false }],
  ["API_CONTRACT_REGRESSION", { apiCompatible: false }],
  ["PERSISTENCE_CONTRACT_REGRESSION", { persistenceCompatible: false }],
  ["PREDICTION_BOUNDARY_REGRESSION", { predictionBoundaryCompatible: false }],
];
for (const [reasonCode, overrides] of blockerCases) {
  const observations = readyObservations.map((item) => ({ ...item }));
  observations[0] = passingObservation(0, overrides);
  const result = evaluateReadiness({
    evaluatedAt: fixture.evaluatedAt,
    minimumObservationCount: fixture.minimumObservationCount,
    observations,
  });
  assert.equal(result.readyForDefaultPromotion, false, reasonCode);
  assert.ok(result.blockingReasons.some((item) => item.reasonCode === reasonCode), reasonCode);
}

const insufficientEvidence = evaluateReadiness({
  evaluatedAt: fixture.evaluatedAt,
  minimumObservationCount: fixture.minimumObservationCount,
  observations: readyObservations.map((item, index) => passingObservation(index, {
    sufficientEvidenceCount: 0,
  })),
});
assert.ok(insufficientEvidence.blockingReasons.some((item) => item.reasonCode === "INSUFFICIENT_REAL_EVIDENCE"));

const unavailableBuckets = readyObservations.map((item) => ({
  ...item,
  bucketAvailability: {
    momentum: false,
    relativeVolume: false,
    breakout: false,
    earnings: false,
    congressional: true,
    policy: true,
    sectorLeaders: false,
    reversal: false,
  },
}));
const bucketBlocked = evaluateReadiness({
  evaluatedAt: fixture.evaluatedAt,
  minimumObservationCount: fixture.minimumObservationCount,
  observations: unavailableBuckets,
});
assert.ok(bucketBlocked.blockingReasons.some((item) => item.reasonCode === "STRUCTURALLY_UNAVAILABLE_BUCKETS"));
assert.deepEqual(bucketBlocked.bucketCoverage.availableBuckets, ["congressional", "policy"]);

const provenanceBlocked = readyObservations.map((item) => ({ ...item }));
provenanceBlocked[0] = passingObservation(0, {
  unresolvedCriticalDiagnostics: [{
    reasonCode: "UNRESOLVED_DATA_PROVENANCE_FAILURE",
    message: "Known frontend label and provenance test mismatch.",
    preExisting: true,
  }],
});
const knownFailure = evaluateReadiness({
  evaluatedAt: fixture.evaluatedAt,
  minimumObservationCount: fixture.minimumObservationCount,
  observations: provenanceBlocked,
});
assert.equal(knownFailure.status, "NOT_READY");
const knownBlocker = knownFailure.blockingReasons.find((item) => item.reasonCode === "UNRESOLVED_DATA_PROVENANCE_FAILURE");
assert.equal(knownBlocker.preExisting, true);

const reordered = evaluateReadiness({
  evaluatedAt: fixture.evaluatedAt,
  minimumObservationCount: fixture.minimumObservationCount,
  observations: [...readyObservations].reverse(),
});
assert.deepEqual(reordered, ready);
assert.deepEqual(evaluateReadiness({
  evaluatedAt: fixture.evaluatedAt,
  minimumObservationCount: fixture.minimumObservationCount,
  observations: readyObservations,
}), ready);

const bounded = evaluateReadiness({
  evaluatedAt: fixture.evaluatedAt,
  minimumObservationCount: 2,
  observations: Array.from({ length: 150 }, (_, index) => passingObservation(index % 28)),
});
assert.equal(bounded.observationCount, 100);
assert.equal(bounded.observationWindow.retainedObservationLimit, 100);

const constantsSource = fs.readFileSync(path.join(root, "discovery", "constants.js"), "utf8");
assert.match(constantsSource, /discoveryEngineVersion:\s*"legacy"/);
const gateSource = fs.readFileSync(path.join(root, "discovery", "readiness-gate.js"), "utf8");
assert.doesNotMatch(gateSource, /discoveryEngineVersion\s*=/);
assert.doesNotMatch(gateSource, /buildPrediction\s*\(/);
const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");
assert.match(serverSource, /discoveryReadiness:\s*discoveryReadinessDiagnostics/);
assert.match(serverSource, /function buildDiscoveryReadinessDiagnostics\([\s\S]*?try \{[\s\S]*?evaluateReadiness[\s\S]*?catch \(error\)/);

console.log("Discovery measurable promotion-readiness gate smoke test passed.");
