const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const fixture = require("./fixtures/discovery-regimes.json");
const {
  applyRegimeAdjustment,
  buildMarketRegime,
  validateMarketRegime,
} = require(path.join(root, "discovery", "regime.js"));

const DAY = 24 * 60 * 60 * 1000;
const options = { evaluatedAt: fixture.evaluatedAt, maximumEvidenceAgeMs: DAY };

function sourcedMetrics(values, sourceTimestamp = fixture.freshSourceTimestamp) {
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [name, {
    value,
    provenance: {
      evidenceType: "aggregate-market-metric",
      provider: "Test public market aggregate",
      source: "Fixture representing a real provider response",
      sourceTimestamp,
      fetchedAt: fixture.evaluatedAt,
    },
  }]));
}

const unavailable = buildMarketRegime({}, options);
assert.equal(unavailable.state, "unavailable");
assert.equal(unavailable.trend, "unavailable");
assert.equal(unavailable.breadth, "unavailable");
assert.equal(unavailable.volatility, "unavailable");
assert.equal(unavailable.dataQualityScore, 0);
assert.equal(unavailable.fallbackBehavior.active, true);
assert.ok(Object.values(unavailable.bucketEmphasis).every((value) => value === 1));
assert.equal(unavailable.missingEvidence.length, 6);
assert.equal(validateMarketRegime(unavailable).valid, true);

const oneDayOnly = buildMarketRegime({
  metrics: {
    broadMarketReturn1: {
      value: 0.08,
      provenance: {
        provider: "Real quote provider",
        sourceTimestamp: fixture.freshSourceTimestamp,
      },
    },
  },
}, options);
assert.equal(oneDayOnly.state, "unavailable", "one-day moves must not imply a regime");

const withoutProvenance = buildMarketRegime({
  metrics: { broadMarketReturn5: { value: 0.1 } },
}, options);
assert.equal(withoutProvenance.metrics.broadMarketReturn5.value, null);
assert.match(withoutProvenance.missingEvidence[0].reason, /provenance/);

const riskOn = buildMarketRegime({ metrics: sourcedMetrics(fixture.riskOn) }, options);
assert.equal(riskOn.state, "risk-on");
assert.equal(riskOn.trend, "up");
assert.equal(riskOn.breadth, "broad");
assert.equal(riskOn.volatility, "low");
assert.equal(riskOn.dataQualityScore, 100);
assert.equal(riskOn.provenance.length, 6);
assert.ok(Object.values(riskOn.bucketEmphasis).every((value) => value >= 0.85 && value <= 1.15));
assert.equal(validateMarketRegime(riskOn).valid, true);
assert.deepEqual(
  buildMarketRegime({ metrics: sourcedMetrics(fixture.riskOn) }, options),
  riskOn,
  "identical evidence and time must be deterministic",
);

const riskOff = buildMarketRegime({ metrics: sourcedMetrics(fixture.riskOff) }, options);
assert.equal(riskOff.state, "risk-off");
assert.equal(riskOff.trend, "down");
assert.equal(riskOff.breadth, "narrow");
assert.equal(riskOff.volatility, "high");
assert.equal(validateMarketRegime(riskOff).valid, true);

const stale = buildMarketRegime({
  metrics: sourcedMetrics(fixture.riskOn, fixture.staleSourceTimestamp),
}, options);
assert.ok(stale.provenance.every((entry) => entry.stale));
assert.equal(stale.dataQualityScore, 75, "staleness should reduce evidence quality, not attractiveness");

const adjusted = applyRegimeAdjustment({
  bucket: "momentum",
  qualified: true,
  rawBucketScore: 80,
}, riskOn);
assert.equal(adjusted.rawBucketScore, 80);
assert.equal(adjusted.regimeAdjustedBucketScore, 89.6);
assert.equal(adjusted.qualified, true);

const unqualified = applyRegimeAdjustment({
  bucket: "momentum",
  qualified: false,
  rawBucketScore: 80,
}, riskOn);
assert.equal(unqualified.qualified, false);
assert.equal(unqualified.regimeAdjustedBucketScore, null);

const noScore = applyRegimeAdjustment({
  bucket: "momentum",
  qualified: true,
}, riskOn);
assert.equal(noScore.rawBucketScore, null);
assert.equal(noScore.regimeAdjustedBucketScore, null, "regime must not manufacture a bucket score");

const malicious = applyRegimeAdjustment({
  bucket: "momentum",
  qualified: true,
  rawBucketScore: 100,
}, { maximumAdjustment: 0.9, bucketEmphasis: { momentum: 5 } });
assert.equal(malicious.regimeMultiplier, 1.15, "adjustments must remain bounded to +15%");
assert.equal(malicious.regimeAdjustedBucketScore, 115);

console.log("Discovery evidence-only market-regime smoke test passed.");
