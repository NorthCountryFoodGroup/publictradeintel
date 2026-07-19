const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const fixture = require("./fixtures/discovery-selector.json");
const { selectDiscoveryEngine } = require(path.join(root, "discovery", "selector.js"));

const legacy = [
  { ticker: "LEG", name: "Legacy One", momentumScore: 70 },
  { ticker: "OLD", name: "Legacy Two", momentumScore: 60 },
];

function poolCandidate(ticker, overrides = {}) {
  return {
    canonicalTicker: ticker,
    identity: {
      canonicalTicker: ticker,
      productionEligible: true,
      active: true,
      generatedFixture: false,
      supportedSecurityType: true,
      ...overrides.identity,
    },
    qualifiedBucketMemberships: overrides.memberships || [{
      bucketId: "policy",
      qualified: true,
      rawScore: 70,
      regimeAdjustedScore: 70,
    }],
  };
}

function v3Output(tickers = ["NEW", "VTH"], overrides = {}) {
  const deep = tickers.map((ticker) => poolCandidate(ticker, overrides));
  return {
    candidatePool: {
      qualifiedCandidates: deep,
      deepAnalysisCandidates: deep,
    },
    candidateInputs: tickers.map((ticker) => ({
      ticker,
      name: `${ticker} input`,
      marketPrice: ticker === "NEW" ? 0 : null,
      momentumScore: 70,
    })),
    fatalErrors: [],
    ...overrides.output,
  };
}

function selectorInput(requestedEngine, overrides = {}) {
  return {
    requestedEngine,
    legacyCandidates: legacy,
    shadowEnabled: overrides.shadowEnabled !== false,
    selectedAt: fixture.selectedAt,
    minimumViableCandidateCount: overrides.minimum ?? fixture.minimumViableCandidateCount,
    maximumCandidateCount: overrides.maximum ?? fixture.maximumCandidateCount,
    maximumDurationMs: overrides.duration ?? fixture.maximumDurationMs,
    now: overrides.now,
  };
}

const originalLegacy = JSON.stringify(legacy);
for (const requested of [undefined, null, "", "unknown", {}, 42]) {
  let calls = 0;
  const result = selectDiscoveryEngine(selectorInput(requested), () => {
    calls += 1;
    return v3Output();
  });
  assert.equal(result.activeEngine, "legacy");
  assert.equal(calls, 0);
  assert.deepEqual(result.selectedCandidates, legacy);
}

for (const shadowEnabled of [true, false]) {
  let calls = 0;
  const result = selectDiscoveryEngine(selectorInput("legacy", { shadowEnabled }), () => {
    calls += 1;
    return v3Output();
  });
  assert.equal(result.activeEngine, "legacy");
  assert.equal(calls, 0);
  assert.deepEqual(result.selectedCandidates, legacy);
}

const valid = selectDiscoveryEngine(selectorInput("v3-evidence-buckets", {
  now: (() => { const values = [1000, 1050]; return () => values.shift(); })(),
}), () => v3Output());
assert.equal(valid.activeEngine, "v3-evidence-buckets");
assert.equal(valid.fallbackApplied, false);
assert.equal(valid.fallbackReason, "V3_ACTIVE");
assert.deepEqual(valid.selectedCandidateTickers, ["NEW", "VTH"]);
assert.deepEqual(valid.selectedCandidates.map((candidate) => candidate.ticker), ["NEW", "VTH"]);
assert.equal(valid.selectedCandidates[0].marketPrice, 0, "factual zero must be preserved");
assert.equal(valid.selectedCandidates[1].marketPrice, null, "unknown must remain null");

const fallbacks = [
  ["V3_EXECUTION_ERROR", () => { throw new Error("failure"); }, {}],
  ["V3_EMPTY_POOL", () => v3Output([]), { minimum: 1 }],
  ["V3_BELOW_MINIMUM_POOL", () => v3Output(["ONE"]), {}],
  ["V3_ABOVE_MAXIMUM_POOL", () => v3Output(["AAA", "BBB", "CCC", "DDD"]), {}],
  ["V3_INELIGIBLE_CANDIDATE", () => v3Output(["AAA", "BBB"], { identity: { productionEligible: false } }), {}],
  ["V3_UNQUALIFIED_CANDIDATE", () => v3Output(["AAA", "BBB"], { memberships: [] }), {}],
  ["V3_DUPLICATE_TICKER", () => v3Output(["AAA", "AAA"]), {}],
  ["V3_FATAL_DIAGNOSTIC", () => v3Output(["AAA", "BBB"], { output: { fatalErrors: ["fatal"] } }), {}],
];
for (const [reason, execute, overrides] of fallbacks) {
  const result = selectDiscoveryEngine(selectorInput("v3-evidence-buckets", overrides), execute);
  assert.equal(result.activeEngine, "legacy", reason);
  assert.equal(result.fallbackReason, reason);
  assert.deepEqual(result.selectedCandidates, legacy);
}

const overDurationClock = (() => { const values = [1000, 1200]; return () => values.shift(); })();
const overDuration = selectDiscoveryEngine(selectorInput("v3-evidence-buckets", {
  now: overDurationClock,
}), () => v3Output());
assert.equal(overDuration.activeEngine, "legacy");
assert.equal(overDuration.fallbackReason, "V3_RUNTIME_LIMIT_EXCEEDED");
assert.equal(overDuration.durationMs, 200);

const legacyBefore = JSON.stringify(legacy);
const v3Before = JSON.stringify(v3Output());
selectDiscoveryEngine(selectorInput("v3-evidence-buckets"), () => v3Output());
assert.equal(JSON.stringify(legacy), legacyBefore);
assert.equal(JSON.stringify(v3Output()), v3Before);
assert.equal(JSON.stringify(legacy), originalLegacy);
assert.deepEqual(
  selectDiscoveryEngine(selectorInput("v3-evidence-buckets"), () => v3Output()).selectedCandidateTickers,
  selectDiscoveryEngine(selectorInput("v3-evidence-buckets"), () => v3Output()).selectedCandidateTickers,
);
const reorderedV3 = v3Output();
reorderedV3.candidatePool.deepAnalysisCandidates.reverse();
reorderedV3.candidateInputs.reverse();
assert.deepEqual(
  selectDiscoveryEngine(selectorInput("v3-evidence-buckets"), () => reorderedV3).selectedCandidateTickers,
  ["NEW", "VTH"],
  "v3 input ordering must not change substantive selection ordering",
);

const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");
assert.match(serverSource, /const scanUniverse = discoveryPipeline\.deepAnalysisCandidates;/);
assert.match(serverSource, /selectDiscoveryEngine\([\s\S]*?legacyCandidates:\s*scanUniverse/);
assert.match(serverSource, /const predictions = selectedScanUniverse[\s\S]*?buildPrediction\(stock, config, policySignals, previousByTicker\)/);
assert.match(serverSource, /discoverySelector:\s*discoverySelectorDiagnostics/);
assert.equal((serverSource.match(/\.map\(\(stock\) => buildPrediction\(stock, config, policySignals, previousByTicker\)\)/g) || []).length, 1, "each scan must have one buildPrediction mapping path");
assert.doesNotMatch(fs.readFileSync(path.join(root, "discovery", "selector.js"), "utf8"), /buildPrediction\s*\(/);

console.log("Discovery fail-closed versioned selector smoke test passed.");
