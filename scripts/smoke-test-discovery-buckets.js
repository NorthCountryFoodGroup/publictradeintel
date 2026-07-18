const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const fixture = require("./fixtures/discovery-buckets.json");
const { evaluateAllBuckets, evaluateBucket } = require(path.join(root, "discovery", "buckets.js"));
const { normalizeEvidenceRecord } = require(path.join(root, "discovery", "schema.js"));
const { buildMarketRegime } = require(path.join(root, "discovery", "regime.js"));

function provenance(fields, overrides = {}) {
  return {
    evidenceType: "real-test-evidence",
    provider: "Public test provider",
    source: "Fixture modeled on a sourced provider response",
    sourceTimestamp: fixture.sourceTimestamp,
    fetchedAt: fixture.evaluatedAt,
    fields,
    fallback: false,
    stale: false,
    limitations: [],
    ...overrides,
  };
}

function record(overrides = {}) {
  return normalizeEvidenceRecord({
    identity: {
      ticker: "REAL",
      securityType: "Common Stock",
      active: true,
      productionEligible: true,
      source: "Nasdaq Trader nasdaqlisted",
      ...overrides.identity,
    },
    market: overrides.market,
    catalysts: overrides.catalysts,
    context: overrides.context,
    provenance: overrides.provenance,
    valuationScore: 100,
    momentumScore: 100,
    qualityScore: 100,
    volatilityScore: 100,
    pressScore: 100,
    committeeScore: 100,
  }, { now: Date.parse(fixture.evaluatedAt) });
}

const options = { evaluatedAt: fixture.evaluatedAt };
const neutralRegime = buildMarketRegime({}, options);
const empty = record();
const emptyResults = evaluateAllBuckets(empty, neutralRegime, options);
assert.equal(emptyResults.length, 8);
assert.ok(emptyResults.every((result) => !result.qualified));
assert.ok(emptyResults.every((result) => result.rawScore === null));
assert.ok(emptyResults.every((result) => result.missingEvidence.length > 0));

const quoteOnly = record({
  market: { price: 50, changePercent: 10, volume: 5000000, latestQuoteAt: fixture.sourceTimestamp },
  provenance: [provenance(["market.price", "market.changePercent", "market.volume"])],
});
for (const bucket of ["momentum", "relativeVolume", "breakout", "reversal"]) {
  assert.equal(evaluateBucket(bucket, quoteOnly, neutralRegime, options).qualified, false, `${bucket} must not qualify from point-in-time quotes`);
}

const zeroVolume = record({
  market: { volume: 0, averageVolume20: 100, relativeVolume: 0 },
  provenance: [provenance(["market.volume", "market.averageVolume20", "market.relativeVolume"])],
});
const zeroResult = evaluateBucket("relativeVolume", zeroVolume, neutralRegime, options);
assert.deepEqual(zeroResult.evidenceUsed.map((item) => item.value), [0, 100, 0]);
assert.equal(zeroResult.qualified, false);

const nullVolume = record({
  market: { volume: null, averageVolume20: 100, relativeVolume: null },
  provenance: [provenance(["market.averageVolume20"])],
});
assert.equal(evaluateBucket("relativeVolume", nullVolume, neutralRegime, options).rawScore, null);

const multi = record({
  market: { return5: fixture.momentum.return5, return20: fixture.momentum.return20 },
  context: { marketRelativeStrength: fixture.momentum.marketRelativeStrength },
  catalysts: {
    congressional: fixture.congressional,
    policy: fixture.policy,
  },
  provenance: [
    provenance(["market.return5", "market.return20", "context.marketRelativeStrength"]),
    provenance(["catalysts.congressional.buyCount", "catalysts.congressional.sellCount", "catalysts.congressional.memberCount", "catalysts.congressional.bipartisan", "catalysts.congressional.latestTransactionAt", "catalysts.congressional.latestDisclosureAt"], {
      evidenceType: "congressional-disclosure",
      limitations: ["Congressional disclosures are delayed and are not real-time trade activity."],
    }),
    provenance(["catalysts.policy.signalCount", "catalysts.policy.positiveCount", "catalysts.policy.negativeCount", "catalysts.policy.independentSourceCount", "catalysts.policy.strongestDirection"], {
      evidenceType: "policy-keyword-signal",
      limitations: ["Keyword-derived policy association requires source review."],
    }),
  ],
});
const multiResults = evaluateAllBuckets(multi, neutralRegime, options);
assert.deepEqual(
  multiResults.filter((result) => result.qualified).map((result) => result.bucketId),
  ["momentum", "congressional", "policy"],
);
assert.match(evaluateBucket("congressional", multi, neutralRegime, options).qualificationReasons[0], /disclosure dates are not treated as trade timestamps/);

const policyWithoutTickerProvenance = record({
  catalysts: { policy: fixture.policy },
  provenance: [provenance([
    "catalysts.policy.signalCount",
    "catalysts.policy.positiveCount",
    "catalysts.policy.negativeCount",
    "catalysts.policy.independentSourceCount",
    "catalysts.policy.strongestDirection",
  ], { evidenceType: "generic-policy-summary" })],
});
const policyWithoutTickerResult = evaluateBucket("policy", policyWithoutTickerProvenance, neutralRegime, options);
assert.equal(policyWithoutTickerResult.qualified, false);
assert.match(policyWithoutTickerResult.missingEvidence[0].reason, /ticker-specific/);

const duplicatedProvenance = record({
  ...{
    market: { return5: fixture.momentum.return5, return20: fixture.momentum.return20 },
    context: { marketRelativeStrength: fixture.momentum.marketRelativeStrength },
  },
  provenance: [
    provenance(["market.return5", "market.return20", "context.marketRelativeStrength"]),
    provenance(["market.return5", "market.return20", "context.marketRelativeStrength"]),
  ],
});
assert.equal(
  evaluateBucket("momentum", duplicatedProvenance, neutralRegime, options).rawScore,
  evaluateBucket("momentum", multi, neutralRegime, options).rawScore,
  "duplicate provenance must not inflate scores",
);

const riskOn = {
  state: "risk-on",
  maximumAdjustment: 0.15,
  bucketEmphasis: { momentum: 5 },
  fallbackBehavior: { mode: "evidence-based" },
};
const adjusted = evaluateBucket("momentum", multi, riskOn, options);
assert.equal(adjusted.qualified, true);
assert.equal(adjusted.rawScore, evaluateBucket("momentum", multi, neutralRegime, options).rawScore);
assert.equal(adjusted.regimeMultiplier, 1.15);
assert.equal(adjusted.regimeAdjustedScore, Number((adjusted.rawScore * 1.15).toFixed(6)));

const belowThreshold = record({
  market: { return5: 0, return20: 0 },
  context: { marketRelativeStrength: 0 },
  provenance: [provenance(["market.return5", "market.return20", "context.marketRelativeStrength"])],
});
const cannotCreateQualification = evaluateBucket("momentum", belowThreshold, riskOn, options);
assert.equal(cannotCreateQualification.qualified, false);
assert.equal(cannotCreateQualification.regimeMultiplier, 1);

const ineligible = record({
  identity: { generatedFixture: true, source: "generated fixture" },
  market: { return5: fixture.momentum.return5, return20: fixture.momentum.return20 },
  context: { marketRelativeStrength: fixture.momentum.marketRelativeStrength },
  provenance: [provenance(["market.return5", "market.return20", "context.marketRelativeStrength"])],
});
const ineligibleResult = evaluateBucket("momentum", ineligible, riskOn, options);
assert.equal(ineligibleResult.productionEligible, false);
assert.equal(ineligibleResult.qualified, false);

const inactive = record({
  identity: { active: false },
  market: { return5: fixture.momentum.return5, return20: fixture.momentum.return20 },
  context: { marketRelativeStrength: fixture.momentum.marketRelativeStrength },
  provenance: [provenance(["market.return5", "market.return20", "context.marketRelativeStrength"])],
});
assert.equal(evaluateBucket("momentum", inactive, riskOn, options).productionEligible, false);

const unsupported = record({
  identity: { securityType: "Warrant" },
  market: { return5: fixture.momentum.return5, return20: fixture.momentum.return20 },
  context: { marketRelativeStrength: fixture.momentum.marketRelativeStrength },
  provenance: [provenance(["market.return5", "market.return20", "context.marketRelativeStrength"])],
});
assert.equal(evaluateBucket("momentum", unsupported, riskOn, options).productionEligible, false);

const fallbackOnly = record({
  market: { return5: fixture.momentum.return5, return20: fixture.momentum.return20 },
  context: { marketRelativeStrength: fixture.momentum.marketRelativeStrength },
  provenance: [provenance(["market.return5", "market.return20", "context.marketRelativeStrength"], {
    fallback: true,
    provider: "Saved quote fallback",
  })],
});
const fallbackResult = evaluateBucket("momentum", fallbackOnly, riskOn, options);
assert.equal(fallbackResult.productionEligible, false);
assert.equal(fallbackResult.qualified, false);

assert.deepEqual(
  evaluateAllBuckets(multi, neutralRegime, options),
  evaluateAllBuckets(multi, neutralRegime, options),
  "identical input must produce identical output",
);
assert.equal(evaluateBucket("not-a-bucket", multi, riskOn, options).qualified, false);

const broken = new Proxy(multi, {
  get(target, property) {
    if (property === "market") throw new Error("test failure");
    return target[property];
  },
});
assert.doesNotThrow(() => evaluateBucket("momentum", broken, riskOn, options));
assert.equal(evaluateBucket("momentum", broken, riskOn, options).qualified, false);

assert.equal(Object.hasOwn(multi, "momentumScore"), false, "legacy synthetic fields must be excluded by normalization");
console.log("Discovery evidence-based qualification bucket smoke test passed.");
