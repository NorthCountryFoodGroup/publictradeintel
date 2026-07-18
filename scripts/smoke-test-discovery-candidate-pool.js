const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const fixture = require("./fixtures/discovery-candidate-pool.json");
const { buildCandidatePool } = require(path.join(root, "discovery", "candidate-pool.js"));

function record(ticker, sector = null, overrides = {}) {
  return {
    identity: {
      canonicalTicker: ticker,
      ticker,
      sector,
      productionEligible: true,
      active: true,
      generatedFixture: false,
      supportedSecurityType: true,
      ...overrides.identity,
    },
    dataQuality: { fallbackOnly: false, ...overrides.dataQuality },
    provenance: overrides.provenance || [],
  };
}

function membership(bucketId, score, overrides = {}) {
  return {
    bucketId,
    bucketName: bucketId,
    qualified: true,
    productionEligible: true,
    rawScore: score,
    regimeAdjustedScore: score,
    provenance: [],
    missingEvidence: [],
    limitations: [],
    ...overrides,
  };
}

function entry(ticker, sector, memberships, overrides = {}) {
  return {
    evidenceRecord: record(ticker, sector, overrides),
    bucketResults: memberships,
    watchlist: overrides.watchlist === true,
  };
}

const options = { evaluatedAt: fixture.evaluatedAt, settings: fixture.settings };
const disqualified = entry("FAIL", "Tech", [membership("momentum", 99, { qualified: false })]);
const watchlistOnly = entry("WATCH", "Tech", [], { watchlist: true });
const ineligible = entry("NOPE", "Tech", [membership("momentum", 99)], {
  identity: { productionEligible: false },
});
const base = buildCandidatePool({ entries: [disqualified, watchlistOnly, ineligible] }, options);
assert.equal(base.qualifiedCandidates.length, 0);
assert.equal(base.deepAnalysisCandidates.length, 0);

const duplicateMembership = membership("momentum", 80);
const duplicateEntries = [
  entry("DUP", "Tech", [
    duplicateMembership,
    { ...duplicateMembership },
    membership("earnings", 0, {
      qualified: false,
      rawScore: null,
      regimeAdjustedScore: null,
      missingEvidence: [{ field: "catalysts.earnings.nextEarningsAt", reason: "Unavailable." }],
    }),
  ]),
  entry("dup", "Tech", [membership("policy", 70)]),
];
const duplicatePool = buildCandidatePool({ entries: duplicateEntries }, options);
assert.equal(duplicatePool.qualifiedCandidates.length, 1);
const duplicateCandidate = duplicatePool.qualifiedCandidates[0];
assert.deepEqual(duplicateCandidate.qualifiedBucketMemberships.map((item) => item.bucketId), ["momentum", "policy"]);
assert.equal(duplicateCandidate.strongestRawScore, 80);
assert.equal(duplicateCandidate.strongestAdjustedScore, 80);
assert.equal(duplicateCandidate.poolPriorityComponents.breadthContribution, 3);
assert.equal(duplicateCandidate.poolPriority, 83);
assert.deepEqual(duplicateCandidate.missingEvidence, [{
  field: "catalysts.earnings.nextEarningsAt",
  reason: "Unavailable.",
}]);

const oneBucket = buildCandidatePool({
  entries: [entry("ONE", "Tech", [membership("momentum", 80)])],
}, options).qualifiedCandidates[0];
const manyBuckets = buildCandidatePool({
  entries: [entry("MANY", "Tech", [
    membership("momentum", 80),
    membership("policy", 70),
    membership("congressional", 65),
    membership("earnings", 60),
  ])],
}, options).qualifiedCandidates[0];
assert.equal(oneBucket.poolPriority, 80);
assert.equal(manyBuckets.poolPriority, 86, "breadth contribution must be bounded by fixture maximum");

const adjusted = buildCandidatePool({
  entries: [entry("ADJ", "Tech", [membership("momentum", 80, { regimeAdjustedScore: 88 })])],
}, options).qualifiedCandidates[0];
assert.equal(adjusted.strongestRawScore, 80);
assert.equal(adjusted.strongestAdjustedScore, 88);

const watchlisted = buildCandidatePool({
  entries: [entry("WLST", "Tech", [membership("policy", 60)], { watchlist: true })],
}, options).qualifiedCandidates[0];
assert.equal(watchlisted.poolPriorityComponents.watchlistContribution, 2);
assert.equal(watchlisted.poolPriority, 62);

const tiePool = buildCandidatePool({
  entries: [
    entry("ZZZ", "Tech", [membership("momentum", 80)]),
    entry("AAA", "Tech", [membership("momentum", 80)]),
  ],
}, options);
assert.deepEqual(tiePool.qualifiedCandidates.map((candidate) => candidate.canonicalTicker), ["AAA", "ZZZ"]);

const diversifiedEntries = [
  entry("TAA", "Tech", [membership("momentum", 99)]),
  entry("TBB", "Tech", [membership("momentum", 98)]),
  entry("TCC", "Tech", [membership("momentum", 97)]),
  entry("TDD", "Tech", [membership("momentum", 96)]),
  entry("POL", "Health", [membership("policy", 70)]),
  entry("CON", "Finance", [membership("congressional", 65)]),
  entry("UNK", null, [membership("policy", 60)]),
];
const diversified = buildCandidatePool({ entries: diversifiedEntries }, options);
assert.equal(diversified.deepAnalysisCandidates.length, 4);
assert.ok(diversified.deepAnalysisCandidates.some((candidate) => candidate.strongestBucket === "policy"));
assert.ok(diversified.deepAnalysisCandidates.some((candidate) => candidate.strongestBucket === "congressional"));
assert.ok(diversified.deepAnalysisCandidates.filter((candidate) => candidate.sector === "Tech").length <= 2);
assert.equal(diversified.qualifiedCandidates.find((candidate) => candidate.canonicalTicker === "UNK").sector, "unknown");
assert.match(
  diversified.qualifiedCandidates.find((candidate) => candidate.canonicalTicker === "UNK").limitations.join(" "),
  /not fabricated/,
);

const onlyMomentum = buildCandidatePool({
  entries: diversifiedEntries.filter((item) => item.bucketResults[0].bucketId === "momentum"),
}, options);
assert.equal(onlyMomentum.deepAnalysisCandidates.length, 2, "sector concentration should not be bypassed by padding");

const reallocated = buildCandidatePool({
  entries: [
    entry("AAA", "Tech", [membership("momentum", 90)]),
    entry("BBB", "Health", [membership("momentum", 80)]),
    entry("CCC", "Finance", [membership("momentum", 70)]),
  ],
}, { ...options, settings: { ...fixture.settings, maximumSectorConcentrationPercent: 100 } });
assert.deepEqual(reallocated.deepAnalysisCandidates.map((candidate) => candidate.canonicalTicker), ["AAA", "BBB", "CCC"]);

const reversed = buildCandidatePool({ entries: [...diversifiedEntries].reverse() }, options);
assert.deepEqual(
  JSON.parse(JSON.stringify(reversed)),
  JSON.parse(JSON.stringify(diversified)),
  "input ordering must not change substantive output",
);
assert.deepEqual(
  buildCandidatePool({ entries: diversifiedEntries }, options),
  diversified,
  "identical inputs must produce identical output",
);

for (const candidate of diversified.qualifiedCandidates) {
  assert.equal(Object.hasOwn(candidate, "predictionScore"), false);
  assert.equal(Object.hasOwn(candidate, "discoveryScore"), false);
}
const source = require("node:fs").readFileSync(path.join(root, "discovery", "candidate-pool.js"), "utf8");
assert.doesNotMatch(source, /buildPrediction\s*\(/);
assert.doesNotThrow(() => buildCandidatePool({ entries: [null, {}, { evidenceRecord: new Proxy({}, {
  get() { throw new Error("test failure"); },
}) }] }, options));

console.log("Discovery diversified candidate-pool smoke test passed.");
