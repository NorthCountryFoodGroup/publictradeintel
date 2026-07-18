const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "discovery-evidence.json"), "utf8"));
const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");
const evidenceSource = fs.readFileSync(path.join(root, "discovery", "evidence.js"), "utf8");
const {
  buildEvidenceRecords,
  indexCongressionalEvidence,
  indexPolicyEvidence,
  parseReportedRange,
} = require(path.join(root, "discovery", "evidence.js"));

const options = {
  now: Date.parse(fixture.now),
  maximumEvidenceAgeMs: 24 * 60 * 60 * 1000,
};

const first = buildEvidenceRecords(fixture, options);
const second = buildEvidenceRecords(fixture, options);
assert.deepEqual(
  [...first.records.entries()],
  [...second.records.entries()],
  "evidence construction should be deterministic for identical inputs",
);
assert.deepEqual(first.diagnostics, second.diagnostics);

const real = first.records.get("REAL");
assert.ok(real, "real quote and congressional evidence should produce a record");
assert.equal(real.identity.productionEligible, true);
assert.equal(real.market.price, 25);
assert.equal(real.market.change, 1);
assert.equal(real.market.changePercent, 4.17);
assert.equal(real.market.volume, 1000000);
assert.equal(real.market.dollarVolume, 25000000);
assert.equal(real.market.latestQuoteAt, "2026-07-18T15:30:00.000Z");
assert.equal(real.market.averageVolume20, null);
assert.equal(real.market.relativeVolume, null);
assert.equal(real.market.return5, null);
assert.equal(real.market.return20, null);
assert.equal(real.market.high20, null);
assert.equal(real.market.movingAverage20, null);
assert.equal(real.catalysts.earnings.nextEarningsAt, null);
assert.equal(real.context.sectorReturn20, null);

for (const forbidden of [
  "valuationScore",
  "momentumScore",
  "qualityScore",
  "volatilityScore",
  "pressScore",
  "committeeScore",
]) {
  assert.equal(JSON.stringify(real).includes(forbidden), false, `${forbidden} must not enter discovery evidence`);
}

const missingFields = new Set(real.missingEvidence.map((entry) => entry.field));
for (const field of [
  "market.averageVolume20",
  "market.relativeVolume",
  "market.high20",
  "market.low20",
  "market.return5",
  "market.return20",
  "market.movingAverage20",
  "catalysts.earnings.nextEarningsAt",
  "context.sectorReturn20",
  "context.marketRelativeStrength",
]) {
  assert.ok(missingFields.has(field), `${field} should remain explicitly missing`);
}

const quoteProvenance = real.provenance.find((entry) => entry.evidenceType === "current-quote");
assert.equal(quoteProvenance.provider, "Yahoo");
assert.equal(quoteProvenance.sourceTimestamp, "2026-07-18T15:30:00.000Z");
assert.equal(quoteProvenance.fetchedAt, "2026-07-18T15:31:00.000Z");
assert.equal(quoteProvenance.fallback, false);
assert.equal(quoteProvenance.stale, false);

assert.equal(real.catalysts.congressional.buyCount, 1, "duplicate congressional records should be removed");
assert.equal(real.catalysts.congressional.sellCount, 1);
assert.equal(real.catalysts.congressional.memberCount, 2);
assert.equal(real.catalysts.congressional.bipartisan, true);
assert.equal(real.catalysts.congressional.transactionValueMinimum, 15001);
assert.equal(real.catalysts.congressional.transactionValueMaximum, 50000);
assert.equal(real.catalysts.congressional.latestTransactionAt, "2026-06-10T00:00:00.000Z");
assert.equal(real.catalysts.congressional.latestDisclosureAt, "2026-07-01T00:00:00.000Z");
const congressProvenance = real.provenance.find((entry) => entry.evidenceType === "congressional-disclosure");
assert.match(congressProvenance.limitations.join(" "), /not real-time/i);
assert.match(congressProvenance.limitations.join(" "), /retained separately/i);

const noAmount = parseReportedRange("Not reported");
assert.deepEqual(noAmount, { minimum: null, maximum: null }, "absent congressional amounts must remain null");
const congressIndex = indexCongressionalEvidence([{
  representative: "Member",
  ticker: "NONE",
  transaction: "Buy",
  reportedRange: "Not reported",
  reportedDate: "2026-07-01",
  sourceUrl: "https://example.gov/disclosure",
}]);
assert.equal(congressIndex.get("NONE").evidence.transactionValueMinimum, null);
assert.equal(congressIndex.get("NONE").evidence.transactionValueMaximum, null);
assert.equal(congressIndex.get("NONE").evidence.latestTransactionAt, null);
assert.equal(congressIndex.get("NONE").evidence.latestDisclosureAt, "2026-07-01T00:00:00.000Z");
assert.match(congressIndex.get("NONE").provenance.limitations.join(" "), /do not include a separate transaction date/i);

const policy = first.records.get("POLI");
assert.ok(policy, "ticker-associated policy evidence should produce a record");
assert.equal(policy.catalysts.policy.signalCount, 1, "repeated policy signals should be deterministically deduplicated");
assert.equal(policy.catalysts.policy.positiveCount, 1);
assert.equal(policy.catalysts.policy.negativeCount, 0);
assert.equal(policy.catalysts.policy.independentSourceCount, 1);
assert.equal(policy.catalysts.policy.strongestScore, null, "legacy policy scores must not enter discovery evidence");
assert.match(policy.catalysts.policy.strongestSummary, /Keyword-derived ticker match/);
const policyProvenance = policy.provenance.find((entry) => entry.evidenceType === "policy-keyword-signal");
assert.equal(policyProvenance.sourceTimestamp, "2026-07-18T13:00:00.000Z");
assert.match(policyProvenance.limitations.join(" "), /keyword-derived/i);
assert.match(policyProvenance.limitations.join(" "), /pressScore or committeeScore/i);

const unassociatedPolicy = indexPolicyEvidence({
  updatedAt: fixture.policySignals.updatedAt,
  signals: [{ ticker: "", direction: "positive", foundAt: fixture.policySignals.updatedAt }],
});
assert.equal(unassociatedPolicy.size, 0, "policy evidence must require a ticker-specific association");

const fixtureRecord = first.records.get("FXZZ");
assert.ok(fixtureRecord);
assert.equal(fixtureRecord.identity.generatedFixture, true);
assert.equal(fixtureRecord.identity.productionEligible, false);

const packagedOnly = buildEvidenceRecords({
  universe: {
    symbols: [{
      canonicalTicker: "LOOK",
      name: "Unverified Packaged Symbol",
      exchange: "NASDAQ",
      securityType: "Common Stock",
      active: true,
      source: "Cached public listing snapshot",
    }],
    symbolUniverseMetadata: {
      source: "Cached Public Snapshot",
      generatedAt: "2026-07-11T19:30:00.000Z",
      refreshStatus: "packaged-snapshot",
    },
  },
}, options);
assert.equal(
  packagedOnly.records.get("LOOK").identity.productionEligible,
  false,
  "unverified packaged rows must not make generated fixture symbols production-eligible",
);
assert.match(packagedOnly.diagnostics.limitations.join(" "), /lacks verified live Nasdaq Trader provenance/i);

assert.equal(policy.market.price, 12);
assert.equal(policy.dataQuality.stale, true, "stale underlying quote evidence should remain explicit");
const savedQuote = policy.provenance.find((entry) => entry.evidenceType === "current-quote");
assert.equal(savedQuote.provider, "Saved quote fallback");
assert.equal(savedQuote.fallback, true);
assert.equal(savedQuote.stale, true);

assert.equal(first.diagnostics.earningsEvidenceCount, 0);
assert.equal(first.diagnostics.historicalBarEvidenceCount, 0);
assert.equal(first.diagnostics.relativeVolumeEvidenceCount, 0);
assert.equal(first.diagnostics.breakoutEvidenceCount, 0);
assert.equal(first.diagnostics.sectorReturnEvidenceCount, 0);
assert.equal(first.diagnostics.reversalEvidenceCount, 0);
assert.equal(first.diagnostics.policyEvidenceCount, 1);
assert.equal(first.diagnostics.congressionalEvidenceCount, 1);
assert.equal(first.diagnostics.productionIneligibleCount, 1);
assert.match(first.diagnostics.limitations.join(" "), /does not select/i);

assert.match(serverSource, /const scanUniverse = discoveryPipeline\.deepAnalysisCandidates;/, "legacy discovery candidates must remain authoritative");
assert.match(serverSource, /function buildDiscoveryEvidenceDiagnostics\(/, "server should expose isolated evidence diagnostics");
assert.match(serverSource, /discoveryShadowComparisonEnabled === false[\s\S]*?status:\s*"disabled"/, "evidence diagnostics should honor the shadow comparison switch");
assert.match(serverSource, /buildDiscoveryEvidenceDiagnostics[\s\S]*?try \{[\s\S]*?buildEvidenceRecords[\s\S]*?catch \(error\)/, "evidence diagnostics must isolate construction failures");
assert.match(serverSource, /activeSelectorAffected:\s*false/, "evidence failure diagnostics should state that the active selector is unaffected");
assert.match(serverSource, /discoveryEvidence:\s*discoveryEvidenceDiagnostics/, "evidence diagnostics should be additive to scan health");
assert.doesNotMatch(evidenceSource, /buildPrediction|rankCandidatePool|evaluateMomentumBucket|selectDeepAnalysisCandidatesV3/, "Commit 4 evidence construction must not select, rank, or score candidates");

console.log("Discovery real-evidence construction smoke test passed.");
