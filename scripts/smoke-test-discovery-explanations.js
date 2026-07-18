const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const fixture = require("./fixtures/discovery-explanations.json");
const {
  buildDiscoveryExplanation,
  buildDiscoveryExplanations,
} = require(path.join(root, "discovery", "explanations.js"));

function evidenceRecord(ticker, overrides = {}) {
  return {
    identity: {
      canonicalTicker: ticker,
      productionEligible: true,
      supportedSecurityType: true,
      active: true,
      generatedFixture: false,
      sector: overrides.sector,
      ...overrides.identity,
    },
    dataQuality: { fallbackOnly: false, ...overrides.dataQuality },
    provenance: overrides.provenance || [],
  };
}

function bucket(bucketId, overrides = {}) {
  return {
    bucketId,
    bucketName: bucketId,
    qualified: true,
    productionEligible: true,
    rawScore: 80,
    regimeMultiplier: 1.1,
    regimeAdjustedScore: 88,
    qualificationReasons: ["Qualified evidence.", "Qualified evidence."],
    disqualificationReasons: [],
    evidenceUsed: [{ field: "market.return20", value: 0 }, { field: "market.return20", value: 0 }],
    missingEvidence: [],
    provenance: [{
      evidenceType: "real-source",
      provider: "Public provider",
      sourceTimestamp: fixture.evaluatedAt,
      fields: ["market.return20"],
      stale: false,
      fallback: false,
    }],
    limitations: [],
    ...overrides,
  };
}

function candidate(ticker, overrides = {}) {
  return {
    canonicalTicker: ticker,
    identity: evidenceRecord(ticker, overrides).identity,
    qualifiedBucketMemberships: overrides.bucketResults || [bucket("momentum")],
    strongestBucket: "momentum",
    strongestRawScore: 80,
    strongestAdjustedScore: 88,
    poolPriority: 93,
    poolPriorityComponents: {
      strongestAdjustedScore: 88,
      additionalQualifiedBucketCount: 1,
      breadthContribution: 3,
      watchlistContribution: 2,
    },
    watchlist: true,
    sector: overrides.sector || "Technology",
    provenance: [],
    missingEvidence: [],
    limitations: [],
    selectedForDeepAnalysis: overrides.selected !== false,
    selectionReasons: overrides.selected === false ? [] : ["Selected as deterministic representation for Momentum Leaders."],
    exclusionReasons: overrides.selected === false ? ["Deep-analysis candidate limit was reached."] : [],
    evaluatedAt: fixture.evaluatedAt,
  };
}

const selectedCandidate = candidate("GOOD");
const selected = buildDiscoveryExplanation({
  evidenceRecord: evidenceRecord("GOOD", { sector: "Technology" }),
  candidate: selectedCandidate,
  bucketResults: [
    bucket("momentum"),
    bucket("congressional", {
      rawScore: 65,
      regimeMultiplier: 1,
      regimeAdjustedScore: 65,
      provenance: [{
        evidenceType: "congressional-disclosure",
        provider: "Saved disclosure source",
        sourceTimestamp: fixture.evaluatedAt,
        fields: ["catalysts.congressional.buyCount"],
      }],
    }),
    bucket("policy", {
      rawScore: 60,
      regimeMultiplier: 1,
      regimeAdjustedScore: 60,
      provenance: [{
        evidenceType: "policy-keyword-signal",
        provider: "Saved policy scanner",
        sourceTimestamp: fixture.evaluatedAt,
        fields: ["catalysts.policy.signalCount"],
      }],
    }),
  ],
  poolSettings: fixture.poolSettings,
  regime: { state: "risk-on", maximumAdjustment: 0.15, explanation: "Sourced aggregate context." },
  sourceRecordCount: 2,
});
assert.equal(selected.status, "qualified-selected");
assert.equal(selected.qualified, true);
assert.equal(selected.selectedForDeepAnalysis, true);
assert.equal(selected.poolPriorityExplanation.strongestAdjustedBucketScore, 88);
assert.equal(selected.poolPriorityExplanation.breadthContribution, 3);
assert.equal(selected.poolPriorityExplanation.watchlistContribution, 2);
assert.equal(selected.poolPriorityExplanation.finalPoolPriority, 93);
assert.match(selected.poolPriorityExplanation.statement, /not a prediction score/);
assert.ok(selected.reasonCodes.includes("QUALIFIED_BUCKET"));
assert.ok(selected.reasonCodes.includes("SELECTED_FOR_DEEP_ANALYSIS"));
assert.ok(selected.reasonCodes.includes("REGIME_ADJUSTMENT_APPLIED"));
assert.ok(selected.reasonCodes.includes("WATCHLIST_PRIORITY_APPLIED"));
assert.ok(selected.reasonCodes.includes("DUPLICATE_RECORD_MERGED"));
assert.equal(selected.regimeContext.qualificationEffect, "none");
assert.equal(selected.watchlistContext.qualificationEffect, "none");
assert.equal(selected.bucketExplanations[0].rawScore, 80);
assert.equal(selected.bucketExplanations[0].regimeAdjustedScore, 88);
assert.equal(selected.evidenceUsed[0].value, 0, "factual zero must be preserved");
assert.equal(selected.evidenceUsed.length, 1, "duplicate evidence must be removed");
assert.match(selected.limitations.join(" "), /not real-time trade timing/);
assert.match(selected.limitations.join(" "), /ticker-specific sourced policy evidence/);

const unselected = buildDiscoveryExplanation({
  evidenceRecord: evidenceRecord("LATE", { sector: "Technology" }),
  candidate: candidate("LATE", { selected: false }),
  poolSettings: fixture.poolSettings,
});
assert.equal(unselected.status, "qualified-not-selected");
assert.equal(unselected.qualified, true);
assert.equal(unselected.selectedForDeepAnalysis, false);
assert.ok(unselected.reasonCodes.includes("EXCLUDED_POOL_LIMIT"));

const missing = buildDiscoveryExplanation({
  evidenceRecord: evidenceRecord("MISS"),
  bucketResults: [bucket("earnings", {
    qualified: false,
    rawScore: null,
    regimeAdjustedScore: null,
    evidenceUsed: [{ field: "catalysts.earnings.daysUntilEarnings", value: null }],
    missingEvidence: [{ field: "catalysts.earnings.nextEarningsAt", reason: "Not supplied." }],
    qualificationReasons: [],
    disqualificationReasons: ["Required earnings evidence is unavailable."],
  })],
  watchlist: true,
  evaluatedAt: fixture.evaluatedAt,
});
assert.equal(missing.status, "insufficient-evidence");
assert.equal(missing.bucketExplanations[0].rawScore, null);
assert.equal(missing.evidenceUsed[0].value, null, "unknown must remain null");
assert.ok(missing.reasonCodes.includes("MISSING_REQUIRED_EVIDENCE"));
assert.ok(missing.reasonCodes.includes("WATCHLIST_DID_NOT_QUALIFY"));
assert.doesNotMatch(missing.summary, /watchlist.*qualif/i);

const ineligible = buildDiscoveryExplanation({
  evidenceRecord: evidenceRecord("FAKE", {
    identity: { productionEligible: false, generatedFixture: true },
  }),
  bucketResults: [bucket("momentum")],
  evaluatedAt: fixture.evaluatedAt,
});
assert.equal(ineligible.status, "production-ineligible");
assert.equal(ineligible.qualified, false);
assert.ok(ineligible.reasonCodes.includes("PRODUCTION_INELIGIBLE"));
assert.ok(ineligible.reasonCodes.includes("GENERATED_FIXTURE"));

const unknownSector = buildDiscoveryExplanation({
  evidenceRecord: evidenceRecord("UNKN"),
  candidate: candidate("UNKN", { sector: "unknown" }),
});
assert.equal(unknownSector.sectorContext.sector, "unknown");
assert.ok(unknownSector.reasonCodes.includes("UNKNOWN_SECTOR"));

const duplicateReason = selected.bucketExplanations[0].qualificationReasons;
assert.deepEqual(duplicateReason, ["Qualified evidence."]);
assert.equal(selected.provenance.filter((entry) => entry.provider === "Public provider").length, 1);

const reordered = buildDiscoveryExplanations([
  { evidenceRecord: evidenceRecord("BBBB"), candidate: candidate("BBBB") },
  { evidenceRecord: evidenceRecord("AAAA"), candidate: candidate("AAAA") },
]);
assert.deepEqual(reordered.map((item) => item.ticker), ["AAAA", "BBBB"]);
assert.deepEqual(
  buildDiscoveryExplanation({
    evidenceRecord: evidenceRecord("GOOD", { sector: "Technology" }),
    candidate: selectedCandidate,
    bucketResults: [bucket("policy"), bucket("momentum")],
  }).bucketExplanations.map((item) => item.bucketId),
  ["momentum", "policy"],
);
assert.deepEqual(buildDiscoveryExplanation({
  evidenceRecord: evidenceRecord("SAME"),
  candidate: candidate("SAME"),
}), buildDiscoveryExplanation({
  evidenceRecord: evidenceRecord("SAME"),
  candidate: candidate("SAME"),
}));

const malformed = buildDiscoveryExplanation({ ticker: "" });
assert.equal(malformed.status, "error");
assert.deepEqual(malformed.reasonCodes, ["MALFORMED_INPUT"]);
assert.doesNotThrow(() => buildDiscoveryExplanation(new Proxy({}, {
  get() { throw new Error("malformed proxy"); },
})));

for (const explanation of [selected, unselected, missing, ineligible]) {
  assert.equal(Object.hasOwn(explanation, "predictionScore"), false);
  assert.equal(Object.hasOwn(explanation, "discoveryScore"), false);
}
const source = fs.readFileSync(path.join(root, "discovery", "explanations.js"), "utf8");
assert.doesNotMatch(source, /buildPrediction\s*\(/);

console.log("Discovery structured explanation smoke test passed.");
