const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const {
  calculateEvidenceDataQuality,
  normalizeEvidenceRecord,
  normalizeEvidenceTimestamp,
  normalizeNullableNumber,
  normalizeProvenanceEntry,
  normalizeSecurityIdentity,
  recordMissingEvidence,
  validateEvidenceRecord,
  validateProductionEligibility,
} = require(path.join(root, "discovery", "schema.js"));

const NOW = Date.parse("2026-07-18T16:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const options = { now: NOW, maximumEvidenceAgeMs: DAY };

assert.equal(normalizeNullableNumber(null), null);
assert.equal(normalizeNullableNumber(undefined), null);
assert.equal(normalizeNullableNumber(""), null);
assert.equal(normalizeNullableNumber("   "), null);
assert.equal(normalizeNullableNumber(false), null);
assert.equal(normalizeNullableNumber("not-a-number"), null);
assert.equal(normalizeNullableNumber(Number.NaN), null);
assert.equal(normalizeNullableNumber(Number.POSITIVE_INFINITY), null);
assert.equal(normalizeNullableNumber(0), 0, "factual numeric zero should remain zero");
assert.equal(normalizeNullableNumber("0"), 0, "an explicit numeric string should be preserved");
assert.equal(normalizeNullableNumber("12.5"), 12.5);

assert.equal(normalizeEvidenceTimestamp(""), null);
assert.equal(normalizeEvidenceTimestamp("invalid"), null);
assert.equal(normalizeEvidenceTimestamp("2026-07-18T15:00:00Z"), "2026-07-18T15:00:00.000Z");

const empty = normalizeEvidenceRecord({
  identity: {
    ticker: "EMPTY",
    securityType: "Common Stock",
    active: true,
  },
}, options);
assert.equal(empty.market.price, null);
assert.equal(empty.market.volume, null);
assert.equal(empty.market.relativeVolume, null);
assert.equal(empty.catalysts.earnings.surprisePercent, null);
assert.equal(empty.context.marketRelativeStrength, null);
assert.equal(empty.dataQuality.score, 0, "empty evidence should not manufacture a quality score");
assert.equal(empty.dataQuality.label, "unavailable");
assert.equal(Object.hasOwn(empty, "discoveryScore"), false, "schema normalization must not manufacture attractiveness");
assert.equal(Object.hasOwn(empty, "score"), false, "schema normalization must not manufacture a generic score");

const populatedWithoutProvenance = validateEvidenceRecord({
  identity: { ticker: "REAL", securityType: "Common Stock", active: true },
  market: {
    price: 25,
    volume: 1000000,
    latestQuoteAt: "2026-07-18T15:30:00Z",
  },
}, options);
assert.equal(populatedWithoutProvenance.valid, false);
assert.match(populatedWithoutProvenance.errors.join(" "), /market\.price/);
assert.match(populatedWithoutProvenance.errors.join(" "), /market\.volume/);

const incompleteProvenance = validateEvidenceRecord({
  identity: { ticker: "REAL", securityType: "Common Stock", active: true },
  market: {
    price: 25,
    latestQuoteAt: "2026-07-18T15:30:00Z",
  },
  provenance: [{
    evidenceType: "current-quote",
    fields: ["market.price"],
  }],
}, options);
assert.equal(incompleteProvenance.valid, false);
assert.match(incompleteProvenance.errors.join(" "), /provider or source/);
assert.match(incompleteProvenance.errors.join(" "), /requires a timestamp/);
assert.equal(incompleteProvenance.normalized.dataQuality.sourceReliabilityScore, 0);
assert.equal(incompleteProvenance.normalized.dataQuality.productionUsable, false);

const validInput = {
  schemaVersion: "v3-evidence-1",
  identity: {
    ticker: "REAL",
    displayTicker: "REAL",
    providerTicker: "REAL",
    name: "Real Company",
    exchange: "NASDAQ",
    securityType: "Common Stock",
    active: true,
    source: "Nasdaq Trader",
  },
  market: {
    price: 25,
    previousClose: 24,
    changePercent: 4.1667,
    volume: 1000000,
    latestQuoteAt: "2026-07-18T15:30:00Z",
    providerFetchedAt: "2026-07-18T15:31:00Z",
  },
  provenance: [
    {
      evidenceType: "current-quote",
      provider: "Test market provider",
      source: "Test quote fixture",
      sourceTimestamp: "2026-07-18T15:30:00Z",
      fetchedAt: "2026-07-18T15:31:00Z",
      fields: [
        "market.price",
        "market.previousClose",
        "market.changePercent",
        "market.volume",
      ],
    },
  ],
};

const valid = validateEvidenceRecord(validInput, options);
assert.equal(valid.valid, true, valid.errors.join("; "));
assert.equal(valid.productionEligible, true);
assert.equal(valid.normalized.dataQuality.stale, false);
assert.ok(valid.normalized.dataQuality.score > 0);
assert.equal(valid.normalized.dataQuality.productionUsable, true);

const staleEntry = normalizeProvenanceEntry({
  evidenceType: "daily-bars",
  provider: "Test provider",
  sourceTimestamp: "2026-07-15T15:30:00Z",
  fields: ["market.return5"],
}, options);
assert.equal(staleEntry.stale, true, "old evidence should be identified explicitly");

const stale = validateEvidenceRecord({
  ...validInput,
  market: {
    price: 25,
    latestQuoteAt: "2026-07-15T15:30:00Z",
  },
  provenance: [{
    evidenceType: "current-quote",
    provider: "Test provider",
    sourceTimestamp: "2026-07-15T15:30:00Z",
    fields: ["market.price"],
  }],
}, options);
assert.equal(stale.normalized.dataQuality.stale, true);
assert.match(stale.warnings.join(" "), /stale/i);

const fixtureEligibility = validateProductionEligibility({
  ticker: "ZZ99",
  securityType: "Common Stock",
  active: true,
  source: "fixture-fallback",
});
assert.equal(fixtureEligibility.eligible, false);
assert.match(fixtureEligibility.reasons.join(" "), /fixture/i);

const explicitFixture = normalizeSecurityIdentity({
  ticker: "TEST",
  securityType: "Common Stock",
  generatedFixture: true,
});
assert.equal(explicitFixture.productionEligible, false);

for (const securityType of ["Warrant", "Right", "Unit", "Preferred Stock", "Unknown", null]) {
  const eligibility = validateProductionEligibility({
    ticker: "SEC",
    securityType,
    active: true,
  });
  assert.equal(eligibility.eligible, false, `${securityType} should be production-ineligible`);
}

const missing = [];
recordMissingEvidence(missing, "market.averageVolume20", ["relativeVolume"], "Historical volume unavailable");
recordMissingEvidence(missing, "market.averageVolume20", ["breakout"], "Historical volume unavailable");
assert.equal(missing.length, 1);
assert.deepEqual(missing[0].requiredByBuckets, ["breakout", "relativeVolume"]);
assert.equal(missing[0].reason, "Historical volume unavailable");

const qualityA = calculateEvidenceDataQuality(valid.normalized, options);
const renamed = normalizeEvidenceRecord({
  ...validInput,
  identity: {
    ...validInput.identity,
    ticker: "DIFFERENT",
    displayTicker: "DIFFERENT",
    providerTicker: "DIFFERENT",
    name: "Different Company",
  },
}, options);
const qualityB = calculateEvidenceDataQuality(renamed, options);
assert.deepEqual(qualityA, qualityB, "ticker text alone must not affect evidence quality");

const repeatedA = validateEvidenceRecord(validInput, options);
const repeatedB = validateEvidenceRecord(validInput, options);
assert.deepEqual(repeatedA, repeatedB, "validation must be deterministic for identical input and evaluation time");

const fallbackOnly = normalizeEvidenceRecord({
  ...validInput,
  provenance: validInput.provenance.map((entry) => ({ ...entry, fallback: true })),
}, options);
assert.equal(fallbackOnly.dataQuality.fallbackOnly, true);
assert.equal(
  fallbackOnly.dataQuality.score,
  valid.normalized.dataQuality.score,
  "fallback status may be reported but must not create attractiveness scoring",
);

console.log("Discovery evidence schema smoke test passed.");
