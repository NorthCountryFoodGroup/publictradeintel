const {
  DISCOVERY_BUCKET_DEFINITIONS,
  DISCOVERY_ENGINE_VERSIONS,
  DISCOVERY_SHADOW_COMPARISON_VERSION,
  DISCOVERY_SHADOW_DIAGNOSTIC_MAX_ITEMS,
} = require("./constants");

function canonicalTicker(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z.-]/g, "").slice(0, 12);
}

function boundedSorted(values, limit = DISCOVERY_SHADOW_DIAGNOSTIC_MAX_ITEMS) {
  return [...new Set((values || []).filter(Boolean).map(String))].sort().slice(0, limit);
}

function countBy(values) {
  const counts = new Map();
  (values || []).filter(Boolean).forEach((value) => counts.set(String(value), (counts.get(String(value)) || 0) + 1));
  return Object.fromEntries(
    [...counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, DISCOVERY_SHADOW_DIAGNOSTIC_MAX_ITEMS),
  );
}

function legacySummary(candidates = [], watchlistTickers = []) {
  const tickers = candidates.map((candidate) => canonicalTicker(candidate?.ticker || candidate?.canonicalTicker)).filter(Boolean);
  const allUniqueTickers = [...new Set(tickers)].sort();
  const uniqueTickers = allUniqueTickers.slice(0, DISCOVERY_SHADOW_DIAGNOSTIC_MAX_ITEMS);
  const duplicates = boundedSorted(tickers.filter((ticker, index) => tickers.indexOf(ticker) !== index));
  const watchlist = new Set((watchlistTickers || []).map(canonicalTicker).filter(Boolean));
  return {
    candidateCount: allUniqueTickers.length,
    sourceCandidateCount: tickers.length,
    canonicalTickers: uniqueTickers,
    duplicates,
    availableSourceLabels: boundedSorted(candidates.flatMap((candidate) => [
      candidate?.source,
      candidate?.marketProvider,
      candidate?.providerUsed,
    ])),
    watchlistTickers: uniqueTickers.filter((ticker) => watchlist.has(ticker)),
    sectorRepresentation: countBy(candidates.map((candidate) => candidate?.sector || "unknown")),
  };
}

function v3Summary(v3 = {}) {
  const qualified = Array.isArray(v3.candidatePool?.qualifiedCandidates) ? v3.candidatePool.qualifiedCandidates : [];
  const deep = Array.isArray(v3.candidatePool?.deepAnalysisCandidates) ? v3.candidatePool.deepAnalysisCandidates : [];
  const explanations = Array.isArray(v3.explanations) ? v3.explanations : [];
  const bucketResults = Array.isArray(v3.bucketResults) ? v3.bucketResults : [];
  const unavailableBucketCounts = {};
  Object.keys(DISCOVERY_BUCKET_DEFINITIONS).forEach((bucketId) => {
    unavailableBucketCounts[bucketId] = bucketResults.filter((entry) => {
      const result = entry?.results?.find((item) => item.bucketId === bucketId);
      return !result || (!result.qualified && (result.missingEvidence || []).length > 0);
    }).length;
  });
  return {
    qualifiedCandidateCount: qualified.length,
    deepAnalysisCandidateCount: deep.length,
    canonicalTickers: boundedSorted(deep.map((candidate) => canonicalTicker(candidate.canonicalTicker))),
    qualifiedCanonicalTickers: boundedSorted(qualified.map((candidate) => canonicalTicker(candidate.canonicalTicker))),
    bucketMemberships: Object.fromEntries(deep.slice(0, DISCOVERY_SHADOW_DIAGNOSTIC_MAX_ITEMS).map((candidate) => [
      candidate.canonicalTicker,
      boundedSorted(candidate.qualifiedBucketMemberships?.map((membership) => membership.bucketId), 8),
    ])),
    strongestBuckets: countBy(deep.map((candidate) => candidate.strongestBucket)),
    evidenceCoverage: v3.evidenceDiagnostics || null,
    explanationCoverage: {
      explanationCount: explanations.length,
      selectedExplanationCount: explanations.filter((item) => item.selectedForDeepAnalysis).length,
      errorCount: explanations.filter((item) => item.status === "error").length,
    },
    productionEligibilityExclusions: Number(v3.evidenceDiagnostics?.productionIneligibleCount) || 0,
    unavailableBucketCounts,
  };
}

function buildShadowComparison(input = {}) {
  const generatedAt = input.generatedAt || new Date(0).toISOString();
  const legacy = legacySummary(input.legacyCandidates, input.watchlistTickers);
  const v3 = v3Summary(input.v3);
  const legacySet = new Set((input.legacyCandidates || [])
    .map((candidate) => canonicalTicker(candidate?.ticker || candidate?.canonicalTicker))
    .filter(Boolean));
  const v3Set = new Set((input.v3?.candidatePool?.deepAnalysisCandidates || [])
    .map((candidate) => canonicalTicker(candidate?.canonicalTicker))
    .filter(Boolean));
  const allOverlapping = [...legacySet].filter((ticker) => v3Set.has(ticker));
  const allLegacyOnly = [...legacySet].filter((ticker) => !v3Set.has(ticker));
  const allV3Only = [...v3Set].filter((ticker) => !legacySet.has(ticker));
  const overlappingCandidates = boundedSorted(allOverlapping);
  const legacyOnlyCandidates = boundedSorted(allLegacyOnly);
  const v3OnlyCandidates = boundedSorted(allV3Only);
  const deepCandidates = input.v3?.candidatePool?.deepAnalysisCandidates || [];
  const explanations = input.v3?.explanations || [];
  const bucketResults = input.v3?.bucketResults || [];
  const missingFields = bucketResults.flatMap((entry) =>
    (entry.results || []).flatMap((result) => (result.missingEvidence || []).map((item) => item.field)));

  return {
    comparisonVersion: DISCOVERY_SHADOW_COMPARISON_VERSION,
    generatedAt,
    shadowEnabled: true,
    activeEngine: "legacy",
    legacySummary: legacy,
    v3Summary: v3,
    overlapSummary: {
      overlapCount: allOverlapping.length,
      overlapPercentOfLegacy: legacy.candidateCount
        ? Number(((allOverlapping.length / legacy.candidateCount) * 100).toFixed(2))
        : 0,
      overlapPercentOfV3: v3.deepAnalysisCandidateCount
        ? Number(((allOverlapping.length / v3.deepAnalysisCandidateCount) * 100).toFixed(2))
        : 0,
      validationStatement: "Candidate overlap is a selection diagnostic and is not prediction-performance validation.",
    },
    legacyOnlyCandidates,
    v3OnlyCandidates,
    overlappingCandidates,
    bucketRepresentation: countBy(deepCandidates.flatMap((candidate) =>
      candidate.qualifiedBucketMemberships?.map((membership) => membership.bucketId) || [])),
    sectorRepresentation: countBy(deepCandidates.map((candidate) => candidate.sector || "unknown")),
    watchlistRepresentation: {
      legacyCount: legacy.watchlistTickers.length,
      v3Count: deepCandidates.filter((candidate) => candidate.watchlist).length,
      v3Tickers: boundedSorted(deepCandidates.filter((candidate) => candidate.watchlist).map((candidate) => candidate.canonicalTicker)),
    },
    evidenceCoverage: v3.evidenceCoverage,
    missingEvidenceSummary: {
      totalMissingFieldReferences: missingFields.length,
      byField: Object.fromEntries(Object.entries(countBy(missingFields)).slice(0, DISCOVERY_SHADOW_DIAGNOSTIC_MAX_ITEMS)),
    },
    productionEligibilitySummary: {
      eligibleRecordCount: Number(v3.evidenceCoverage?.productionEligibleCount) || 0,
      ineligibleRecordCount: Number(v3.evidenceCoverage?.productionIneligibleCount) || 0,
      qualifiedCandidateCount: v3.qualifiedCandidateCount,
    },
    explanationCoverage: v3.explanationCoverage,
    errorState: null,
    limitations: [
      "Shadow comparison is diagnostic only; legacy discovery remains authoritative.",
      "Candidate overlap is not prediction-performance validation.",
      "Missing evidence is not treated as qualification.",
      `Diagnostic lists are bounded to ${DISCOVERY_SHADOW_DIAGNOSTIC_MAX_ITEMS} items.`,
    ],
  };
}

function disabledComparison(generatedAt, reason) {
  return {
    comparisonVersion: DISCOVERY_SHADOW_COMPARISON_VERSION,
    generatedAt,
    shadowEnabled: false,
    activeEngine: "legacy",
    legacySummary: null,
    v3Summary: null,
    overlapSummary: null,
    legacyOnlyCandidates: [],
    v3OnlyCandidates: [],
    overlappingCandidates: [],
    bucketRepresentation: {},
    sectorRepresentation: {},
    watchlistRepresentation: {},
    evidenceCoverage: null,
    missingEvidenceSummary: { totalMissingFieldReferences: 0, byField: {} },
    productionEligibilitySummary: null,
    explanationCoverage: null,
    errorState: null,
    limitations: [reason, "Legacy discovery remains authoritative."],
  };
}

function failedComparison(generatedAt, error) {
  return {
    ...disabledComparison(generatedAt, "V3 shadow execution failed in isolation."),
    shadowEnabled: true,
    errorState: {
      status: "failed",
      message: "V3 shadow execution failed.",
      activeSelectorAffected: false,
    },
  };
}

function runShadowComparison(input = {}, executeV3) {
  const generatedAt = input.generatedAt || new Date(0).toISOString();
  const settings = input.discoverySettings || {};
  const version = settings.discoveryEngineVersion === undefined
    ? "legacy"
    : settings.discoveryEngineVersion;
  if (!DISCOVERY_ENGINE_VERSIONS.includes(version)) {
    return disabledComparison(generatedAt, "Unknown discovery configuration; v3 shadow execution was skipped.");
  }
  if (settings.discoveryShadowComparisonEnabled === false) {
    return disabledComparison(generatedAt, "V3 shadow comparison is disabled by configuration.");
  }
  if (typeof executeV3 !== "function") {
    return failedComparison(generatedAt, new Error("V3 shadow executor is unavailable."));
  }
  try {
    const v3 = executeV3();
    if (!v3 || !v3.candidatePool || !Array.isArray(v3.candidatePool.deepAnalysisCandidates)) {
      throw new Error("Malformed v3 shadow output.");
    }
    return buildShadowComparison({ ...input, v3, generatedAt });
  } catch (error) {
    return failedComparison(generatedAt, error);
  }
}

module.exports = {
  buildShadowComparison,
  runShadowComparison,
};
