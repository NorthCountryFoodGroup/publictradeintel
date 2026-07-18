const {
  DISCOVERY_BUCKET_DEFINITIONS,
  DISCOVERY_EXPLANATION_REASON_CODES,
  DISCOVERY_EXPLANATION_VERSION,
} = require("./constants");

const REASON_CODE_SET = new Set(DISCOVERY_EXPLANATION_REASON_CODES);

function tickerOf(input) {
  return String(
    input?.candidate?.canonicalTicker ||
    input?.evidenceRecord?.identity?.canonicalTicker ||
    input?.evidenceRecord?.identity?.ticker ||
    input?.ticker ||
    "",
  ).trim().toUpperCase().replace(/[^A-Z.-]/g, "").slice(0, 12);
}

function stableStrings(values) {
  return [...new Set((values || []).filter(Boolean).map(String))].sort();
}

function stableObjects(values) {
  const map = new Map();
  (values || []).filter(Boolean).forEach((value) => map.set(JSON.stringify(value), value));
  return [...map.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value);
}

function addReason(codes, code) {
  if (REASON_CODE_SET.has(code)) codes.add(code);
}

function normalizedBucketExplanation(result = {}) {
  return {
    bucketId: String(result.bucketId || ""),
    bucketName: String(result.bucketName || DISCOVERY_BUCKET_DEFINITIONS[result.bucketId]?.label || "Unknown bucket"),
    qualified: result.qualified === true,
    rawScore: result.rawScore === undefined ? null : result.rawScore,
    regimeMultiplier: result.regimeMultiplier === undefined ? 1 : result.regimeMultiplier,
    regimeAdjustedScore: result.regimeAdjustedScore === undefined ? null : result.regimeAdjustedScore,
    qualificationReasons: stableStrings(result.qualificationReasons),
    disqualificationReasons: stableStrings(result.disqualificationReasons),
    evidenceUsed: stableObjects(result.evidenceUsed),
    missingEvidence: stableObjects(result.missingEvidence),
    provenance: stableObjects(result.provenance),
    limitations: stableStrings([
      ...(result.limitations || []),
      ...(result.bucketId === "congressional"
        ? ["Congressional disclosures are delayed and disclosure timing is not real-time trade timing."]
        : []),
      ...(result.bucketId === "policy" && result.qualified === true
        ? ["Policy qualification uses ticker-specific sourced policy evidence."]
        : []),
    ]),
  };
}

function productionContext(input, reasonCodes) {
  const identity = input.evidenceRecord?.identity || input.candidate?.identity || {};
  const fallbackOnly = input.evidenceRecord?.dataQuality?.fallbackOnly === true;
  const reasons = [];
  if (identity.productionEligible !== true) {
    reasons.push("Security is not production-eligible.");
    addReason(reasonCodes, "PRODUCTION_INELIGIBLE");
  }
  if (identity.supportedSecurityType === false) {
    reasons.push("Security type is unsupported.");
    addReason(reasonCodes, "UNSUPPORTED_SECURITY_TYPE");
  }
  if (identity.active === false) {
    reasons.push("Security is inactive.");
    addReason(reasonCodes, "INACTIVE_SECURITY");
  }
  if (identity.generatedFixture === true) {
    reasons.push("Generated fixture securities are excluded from production discovery.");
    addReason(reasonCodes, "GENERATED_FIXTURE");
  }
  if (fallbackOnly) {
    reasons.push("Only fallback evidence is available.");
    addReason(reasonCodes, "FALLBACK_EVIDENCE");
  }
  return {
    eligible: identity.productionEligible === true &&
      identity.supportedSecurityType !== false &&
      identity.active !== false &&
      identity.generatedFixture !== true &&
      !fallbackOnly,
    reasons,
  };
}

function codesFromBuckets(buckets, reasonCodes) {
  buckets.forEach((bucket) => {
    if (bucket.qualified) addReason(reasonCodes, "QUALIFIED_BUCKET");
    if (!bucket.qualified && bucket.rawScore !== null) addReason(reasonCodes, "BELOW_BUCKET_THRESHOLD");
    if (bucket.missingEvidence.length) addReason(reasonCodes, "MISSING_REQUIRED_EVIDENCE");
    if (bucket.provenance.some((entry) => entry.stale === true)) addReason(reasonCodes, "STALE_EVIDENCE");
    if (bucket.provenance.some((entry) => entry.fallback === true)) addReason(reasonCodes, "FALLBACK_EVIDENCE");
    if (bucket.limitations.length) addReason(reasonCodes, "PROVIDER_LIMITATION");
    if (bucket.qualified && bucket.regimeMultiplier !== 1) addReason(reasonCodes, "REGIME_ADJUSTMENT_APPLIED");
  });
}

function selectionContext(candidate, poolSettings, reasonCodes) {
  const selected = candidate?.selectedForDeepAnalysis === true;
  const selectionReasons = stableStrings(candidate?.selectionReasons);
  const exclusionReasons = stableStrings(candidate?.exclusionReasons);
  if (selected) addReason(reasonCodes, "SELECTED_FOR_DEEP_ANALYSIS");
  exclusionReasons.forEach((reason) => {
    if (/deep-analysis candidate limit was reached/i.test(reason)) addReason(reasonCodes, "EXCLUDED_POOL_LIMIT");
    if (/sector concentration/i.test(reason)) addReason(reasonCodes, "EXCLUDED_SECTOR_CONCENTRATION");
    if (/bucket-diversity/i.test(reason)) addReason(reasonCodes, "EXCLUDED_BUCKET_DIVERSITY");
  });
  return {
    selected,
    applicablePoolLimit: poolSettings?.deepAnalysisLimit ?? null,
    bucketDiversityRole: selectionReasons.filter((reason) => /representation/i.test(reason)),
    sectorConcentrationImpact: exclusionReasons.filter((reason) => /sector concentration/i.test(reason)),
    selectionReasons,
    exclusionReasons,
  };
}

function malformedExplanation(input, error) {
  let ticker = "";
  let evaluatedAt = new Date(0).toISOString();
  try {
    ticker = tickerOf(input);
    evaluatedAt = input?.evaluatedAt || evaluatedAt;
  } catch {
    // Malformed inputs must still produce a stable structured error.
  }
  return {
    explanationVersion: DISCOVERY_EXPLANATION_VERSION,
    ticker,
    status: "error",
    productionEligible: false,
    qualified: false,
    selectedForDeepAnalysis: false,
    summary: "Discovery explanation is unavailable because the supplied discovery output is malformed.",
    primaryReason: error?.message || "Malformed discovery explanation input.",
    reasonCodes: ["MALFORMED_INPUT"],
    qualifiedBuckets: [],
    strongestBucket: null,
    bucketExplanations: [],
    poolPriorityExplanation: null,
    selectionExplanation: null,
    exclusionReasons: [error?.message || "Malformed discovery explanation input."],
    evidenceUsed: [],
    missingEvidence: [],
    provenance: [],
    limitations: [],
    regimeContext: null,
    watchlistContext: { watchlist: false, affectedPriority: false, qualificationEffect: "none" },
    sectorContext: { sector: "unknown", sourceStatus: "unavailable" },
    evaluatedAt,
  };
}

function buildDiscoveryExplanation(input = {}) {
  try {
    const ticker = tickerOf(input);
    if (!ticker) throw new Error("Canonical ticker is required.");
    const candidate = input.candidate || null;
    const bucketSource = Array.isArray(input.bucketResults)
      ? input.bucketResults
      : candidate?.qualifiedBucketMemberships || [];
    if (!Array.isArray(bucketSource)) throw new Error("Bucket results must be an array.");
    const bucketExplanations = bucketSource
      .filter((result) => result && DISCOVERY_BUCKET_DEFINITIONS[result.bucketId])
      .map(normalizedBucketExplanation)
      .sort((left, right) =>
        Object.keys(DISCOVERY_BUCKET_DEFINITIONS).indexOf(left.bucketId) -
        Object.keys(DISCOVERY_BUCKET_DEFINITIONS).indexOf(right.bucketId));
    const reasonCodes = new Set();
    codesFromBuckets(bucketExplanations, reasonCodes);
    const production = productionContext(input, reasonCodes);
    const qualifiedBuckets = bucketExplanations.filter((bucket) => bucket.qualified).map((bucket) => bucket.bucketId);
    const qualified = production.eligible && qualifiedBuckets.length > 0;
    const selectionExplanation = selectionContext(candidate, input.poolResult?.settings || input.poolSettings, reasonCodes);
    const selected = qualified && selectionExplanation.selected;
    const watchlist = candidate?.watchlist === true || input.watchlist === true;
    const watchlistContribution = candidate?.poolPriorityComponents?.watchlistContribution ?? 0;
    if (watchlistContribution > 0) addReason(reasonCodes, "WATCHLIST_PRIORITY_APPLIED");
    if (watchlist && !qualified) addReason(reasonCodes, "WATCHLIST_DID_NOT_QUALIFY");
    const regime = input.regimeContext || input.regime || null;
    if (!regime || regime.state === "unavailable") addReason(reasonCodes, "REGIME_UNAVAILABLE");
    const sector = candidate?.sector || input.evidenceRecord?.identity?.sector || "unknown";
    if (sector === "unknown") addReason(reasonCodes, "UNKNOWN_SECTOR");
    if ((input.sourceRecordCount || 1) > 1) addReason(reasonCodes, "DUPLICATE_RECORD_MERGED");

    const status = !production.eligible
      ? "production-ineligible"
      : !qualified
        ? "insufficient-evidence"
        : selected
          ? "qualified-selected"
          : "qualified-not-selected";
    const summary = status === "production-ineligible"
      ? `${ticker} is excluded from production discovery.`
      : status === "insufficient-evidence"
        ? `${ticker} did not independently qualify for an evidence bucket.`
        : status === "qualified-selected"
          ? `${ticker} qualified for discovery and was selected for deep analysis.`
          : `${ticker} qualified for discovery but was not selected for deep analysis.`;
    const primaryReason = production.reasons[0] ||
      (selected ? selectionExplanation.selectionReasons[0] : null) ||
      (!qualified ? bucketExplanations.flatMap((bucket) => bucket.disqualificationReasons)[0] : null) ||
      selectionExplanation.exclusionReasons[0] ||
      `Qualified through ${qualifiedBuckets.length} evidence bucket(s).`;
    const strongestBucket = candidate?.strongestBucket ||
      [...bucketExplanations]
        .filter((bucket) => bucket.qualified)
        .sort((left, right) =>
          (right.regimeAdjustedScore ?? -Infinity) - (left.regimeAdjustedScore ?? -Infinity) ||
          left.bucketId.localeCompare(right.bucketId))[0]?.bucketId ||
      null;
    const components = candidate?.poolPriorityComponents || null;
    const poolPriorityExplanation = components ? {
      strongestAdjustedBucketScore: components.strongestAdjustedScore,
      breadthContribution: components.breadthContribution,
      watchlistContribution: components.watchlistContribution,
      finalPoolPriority: candidate.poolPriority,
      statement: "Candidate-pool priority is a transparent discovery ordering value, not a prediction score.",
    } : null;
    const evidenceUsed = stableObjects(bucketExplanations.flatMap((bucket) => bucket.evidenceUsed));
    const missingEvidence = stableObjects([
      ...(candidate?.missingEvidence || []),
      ...bucketExplanations.flatMap((bucket) => bucket.missingEvidence),
    ]);
    const provenance = stableObjects([
      ...(candidate?.provenance || []),
      ...(input.evidenceRecord?.provenance || []),
      ...bucketExplanations.flatMap((bucket) => bucket.provenance),
    ]);
    const limitations = stableStrings([
      ...(candidate?.limitations || []),
      ...bucketExplanations.flatMap((bucket) => bucket.limitations),
    ]);

    return {
      explanationVersion: DISCOVERY_EXPLANATION_VERSION,
      ticker,
      status,
      productionEligible: production.eligible,
      qualified,
      selectedForDeepAnalysis: selected,
      summary,
      primaryReason,
      reasonCodes: [...reasonCodes].sort(),
      qualifiedBuckets,
      strongestBucket,
      bucketExplanations,
      poolPriorityExplanation,
      selectionExplanation,
      exclusionReasons: stableStrings([...production.reasons, ...selectionExplanation.exclusionReasons]),
      evidenceUsed,
      missingEvidence,
      provenance,
      limitations,
      regimeContext: regime ? {
        state: regime.state ?? "unavailable",
        maximumAdjustment: regime.maximumAdjustment ?? null,
        explanation: regime.explanation ?? null,
        qualificationEffect: "none",
      } : {
        state: "unavailable",
        maximumAdjustment: null,
        explanation: "Regime context was not supplied.",
        qualificationEffect: "none",
      },
      watchlistContext: {
        watchlist,
        affectedPriority: watchlistContribution > 0,
        priorityContribution: watchlistContribution,
        qualificationEffect: "none",
      },
      sectorContext: {
        sector,
        sourceStatus: sector === "unknown" ? "unavailable" : "sourced",
      },
      evaluatedAt: candidate?.evaluatedAt || input.evaluatedAt || new Date(0).toISOString(),
    };
  } catch (error) {
    return malformedExplanation(input, error);
  }
}

function buildDiscoveryExplanations(inputs = []) {
  if (!Array.isArray(inputs)) return [malformedExplanation({}, new Error("Explanation inputs must be an array."))];
  return inputs.map(buildDiscoveryExplanation).sort((left, right) => left.ticker.localeCompare(right.ticker));
}

module.exports = {
  buildDiscoveryExplanation,
  buildDiscoveryExplanations,
};
