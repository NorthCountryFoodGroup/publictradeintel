const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const fixture = require("./fixtures/discovery-shadow-comparison.json");
const { buildShadowComparison, runShadowComparison } = require(path.join(root, "discovery", "shadow-comparison.js"));

function candidate(ticker, overrides = {}) {
  return {
    canonicalTicker: ticker,
    sector: overrides.sector ?? "unknown",
    watchlist: overrides.watchlist === true,
    strongestBucket: overrides.bucket || "policy",
    qualifiedBucketMemberships: [{ bucketId: overrides.bucket || "policy" }],
  };
}

const legacyCandidates = fixture.legacyTickers.map((ticker) => ({
  ticker,
  sector: ticker === "AAA" ? "Technology" : null,
  source: "Legacy source",
}));
const v3Output = {
  candidatePool: {
    qualifiedCandidates: fixture.v3Tickers.map((ticker) => candidate(ticker)),
    deepAnalysisCandidates: fixture.v3Tickers.map((ticker) => candidate(ticker, {
      sector: ticker === "AAA" ? "Technology" : undefined,
      watchlist: ticker === "CCC",
    })),
  },
  explanations: fixture.v3Tickers.map((ticker) => ({
    ticker,
    status: "qualified-selected",
    selectedForDeepAnalysis: true,
  })),
  bucketResults: [{
    ticker: "AAA",
    results: [{ bucketId: "momentum", qualified: false, missingEvidence: [{ field: "market.return20" }] }],
  }],
  evidenceDiagnostics: {
    productionEligibleCount: 3,
    productionIneligibleCount: 2,
  },
};

const comparison = buildShadowComparison({
  generatedAt: fixture.generatedAt,
  legacyCandidates,
  watchlistTickers: ["AAA", "CCC"],
  v3: v3Output,
});
assert.equal(comparison.activeEngine, "legacy");
assert.deepEqual(comparison.legacySummary.canonicalTickers, ["AAA", "BBB", "LEG"]);
assert.deepEqual(comparison.legacySummary.duplicates, ["BBB"]);
assert.deepEqual(comparison.v3Summary.canonicalTickers, ["AAA", "CCC", "VTH"]);
assert.deepEqual(comparison.overlappingCandidates, ["AAA"]);
assert.deepEqual(comparison.legacyOnlyCandidates, ["BBB", "LEG"]);
assert.deepEqual(comparison.v3OnlyCandidates, ["CCC", "VTH"]);
assert.equal(comparison.overlapSummary.overlapCount, 1);
assert.equal(comparison.overlapSummary.overlapPercentOfLegacy, 33.33);
assert.equal(comparison.overlapSummary.overlapPercentOfV3, 33.33);
assert.match(comparison.overlapSummary.validationStatement, /not prediction-performance validation/);
assert.equal(comparison.sectorRepresentation.unknown, 2);
assert.equal(comparison.missingEvidenceSummary.byField["market.return20"], 1);
assert.equal(comparison.productionEligibilitySummary.ineligibleRecordCount, 2);
assert.equal(comparison.explanationCoverage.explanationCount, 3);

const empty = buildShadowComparison({ generatedAt: fixture.generatedAt, legacyCandidates: [], v3: {
  candidatePool: { qualifiedCandidates: [], deepAnalysisCandidates: [] },
  explanations: [],
  bucketResults: [],
  evidenceDiagnostics: {},
} });
assert.equal(empty.overlapSummary.overlapPercentOfLegacy, 0);
assert.equal(empty.overlapSummary.overlapPercentOfV3, 0);

let disabledCalls = 0;
const disabled = runShadowComparison({
  generatedAt: fixture.generatedAt,
  discoverySettings: { discoveryEngineVersion: "legacy", discoveryShadowComparisonEnabled: false },
}, () => {
  disabledCalls += 1;
  return v3Output;
});
assert.equal(disabledCalls, 0);
assert.equal(disabled.shadowEnabled, false);

let unknownCalls = 0;
const unknown = runShadowComparison({
  generatedAt: fixture.generatedAt,
  discoverySettings: { discoveryEngineVersion: "unknown", discoveryShadowComparisonEnabled: true },
}, () => {
  unknownCalls += 1;
  return v3Output;
});
assert.equal(unknownCalls, 0);
assert.equal(unknown.activeEngine, "legacy");

const failed = runShadowComparison({
  generatedAt: fixture.generatedAt,
  discoverySettings: { discoveryEngineVersion: "legacy", discoveryShadowComparisonEnabled: true },
}, () => { throw new Error("simulated v3 failure"); });
assert.equal(failed.errorState.status, "failed");
assert.equal(failed.errorState.activeSelectorAffected, false);
assert.equal(failed.errorState.message, "V3 shadow execution failed.");

const malformed = runShadowComparison({
  generatedAt: fixture.generatedAt,
  discoverySettings: { discoveryEngineVersion: "legacy", discoveryShadowComparisonEnabled: true },
}, () => ({}));
assert.equal(malformed.errorState.status, "failed");

const reordered = buildShadowComparison({
  generatedAt: fixture.generatedAt,
  legacyCandidates: [...legacyCandidates].reverse(),
  watchlistTickers: ["CCC", "AAA"],
  v3: {
    ...v3Output,
    candidatePool: {
      ...v3Output.candidatePool,
      deepAnalysisCandidates: [...v3Output.candidatePool.deepAnalysisCandidates].reverse(),
    },
  },
});
assert.deepEqual(reordered.legacySummary, comparison.legacySummary);
assert.deepEqual(reordered.overlappingCandidates, comparison.overlappingCandidates);
assert.deepEqual(reordered.v3OnlyCandidates, comparison.v3OnlyCandidates);

const many = buildShadowComparison({
  generatedAt: fixture.generatedAt,
  legacyCandidates: Array.from({ length: 250 }, (_, index) => ({
    ticker: `X${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`,
  })),
  v3: v3Output,
});
assert.equal(many.legacySummary.candidateCount, 250);
assert.equal(many.legacySummary.canonicalTickers.length, 200);

const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");
assert.match(serverSource, /const scanUniverse = discoveryPipeline\.deepAnalysisCandidates;/);
assert.match(serverSource, /const predictions = scanUniverse[\s\S]*?buildDiscoveryShadowDiagnostics\(/, "shadow diagnostics must run only after unchanged prediction inputs are established");
assert.match(serverSource, /function buildDiscoveryShadowDiagnostics\([\s\S]*?runShadowComparison\([\s\S]*?try|function buildDiscoveryShadowDiagnostics\([\s\S]*?runShadowComparison\(/);
assert.match(serverSource, /discoveryShadowComparison:\s*discoveryShadowDiagnostics/);
assert.doesNotMatch(serverSource, /scanUniverse\s*=\s*.*v3/i);
assert.match(serverSource, /discoveryShadowComparisonEnabled:\s*[\s\S]*?DISCOVERY_ENGINE_VERSIONS\.includes/, "malformed engine configuration must disable shadow execution");

console.log("Discovery isolated legacy-v3 shadow comparison smoke test passed.");
