const {
  DISCOVERY_BUCKET_DEFINITIONS,
  DISCOVERY_READINESS_MAXIMUM_OBSERVATIONS,
  DISCOVERY_READINESS_MINIMUM_OBSERVATIONS,
  DISCOVERY_READINESS_THRESHOLDS,
  DISCOVERY_READINESS_VERSION,
} = require("./constants");

const CRITERIA = Object.freeze([
  ["observation-sufficiency", "Sufficient completed observations exist.", "INSUFFICIENT_OBSERVATIONS"],
  ["execution-success", "V3 execution succeeds reliably.", "V3_EXECUTION_FAILURE_RATE"],
  ["selector-activation", "Explicit v3 requests activate successfully when valid.", "V3_SELECTOR_ACTIVATION_FAILURE_RATE"],
  ["fallback-reliability", "Every failed v3 activation falls back completely to legacy.", "FALLBACK_RELIABILITY_FAILURE"],
  ["fatal-error-rate", "V3 fatal diagnostic rate is zero.", "V3_FATAL_ERROR_RATE"],
  ["runtime-compliance", "V3 runtime remains within its activation limit.", "V3_RUNTIME_NONCOMPLIANCE"],
  ["evidence-coverage", "Production-eligible securities have sufficient real evidence.", "INSUFFICIENT_REAL_EVIDENCE"],
  ["bucket-availability", "Enough approved buckets have structurally available evidence.", "STRUCTURALLY_UNAVAILABLE_BUCKETS"],
  ["candidate-pool-viability", "V3 produces a minimum viable deep-analysis pool reliably.", "V3_BELOW_MINIMUM_POOL_RATE"],
  ["production-eligibility", "Selected v3 candidates remain production-eligible and qualified.", "INELIGIBLE_CANDIDATE_SELECTED"],
  ["explanation-completeness", "Every qualified and selected candidate has a complete explanation.", "EXPLANATION_COVERAGE_INCOMPLETE"],
  ["deterministic-stability", "Substantive outputs remain deterministic under identical and reordered inputs.", "DETERMINISTIC_STABILITY_FAILURE"],
  ["duplicate-integrity", "Selected v3 pools contain no duplicate canonical tickers.", "DUPLICATE_TICKER_SELECTED"],
  ["shadow-availability", "Shadow diagnostics are available whenever shadow mode is expected.", "SHADOW_DIAGNOSTIC_UNAVAILABLE"],
  ["api-compatibility", "Required API contracts remain compatible.", "API_CONTRACT_REGRESSION"],
  ["persistence-compatibility", "Prediction persistence contracts remain compatible.", "PERSISTENCE_CONTRACT_REGRESSION"],
  ["prediction-boundary", "The approved prediction boundary remains unchanged.", "PREDICTION_BOUNDARY_REGRESSION"],
  ["selector-safety", "The active selector has no configuration ambiguity.", "SELECTOR_CONFIGURATION_AMBIGUITY"],
  ["critical-diagnostics", "No unresolved critical diagnostics remain.", "UNRESOLVED_CRITICAL_DIAGNOSTIC"],
]);

function percent(numerator, denominator) {
  return denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2));
}

function criterion(id, description, reasonCode, observedValue, threshold, pass, details = []) {
  return {
    criterionId: id,
    description,
    required: true,
    status: pass === true ? "PASS" : pass === false ? "FAIL" : "UNKNOWN",
    observedValue,
    threshold,
    pass: pass === true,
    reasonCode: pass === true ? null : reasonCode,
    details: [...new Set((details || []).filter(Boolean).map(String))].sort().slice(0, 50),
  };
}

function structuredError(input, message) {
  let evaluatedAt = new Date(0).toISOString();
  try {
    evaluatedAt = input?.evaluatedAt || evaluatedAt;
  } catch {
    // Malformed proxy inputs must still return a stable error contract.
  }
  return {
    readinessVersion: DISCOVERY_READINESS_VERSION,
    evaluatedAt,
    status: "ERROR",
    readyForDefaultPromotion: false,
    currentDefaultEngine: "legacy",
    evaluatedEngine: "v3-evidence-buckets",
    observationWindow: { source: "invalid", retainedObservationLimit: 0 },
    observationCount: 0,
    minimumObservationCount: DISCOVERY_READINESS_MINIMUM_OBSERVATIONS,
    criteria: [],
    passedCriteria: [],
    failedCriteria: ["MALFORMED_READINESS_INPUT"],
    blockingReasons: [{
      reasonCode: "MALFORMED_READINESS_INPUT",
      message: String(message || "Malformed readiness input.").slice(0, 240),
      preExisting: false,
    }],
    warnings: [],
    evidenceCoverage: null,
    bucketCoverage: null,
    candidatePoolHealth: null,
    explanationHealth: null,
    selectorHealth: null,
    fallbackHealth: null,
    runtimeHealth: null,
    stabilityHealth: null,
    comparisonHealth: null,
    productionEligibilityHealth: null,
    recommendation: "KEEP_LEGACY_DEFAULT",
    limitations: ["Readiness calculation failed safely; no engine configuration was changed."],
  };
}

function evaluateReadiness(input = {}) {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Readiness input must be an object.");
    if (input.observations !== undefined && !Array.isArray(input.observations)) throw new Error("Observations must be an array.");
    const evaluatedAt = input.evaluatedAt || new Date(0).toISOString();
    const minimumObservationCount = Math.max(
      2,
      Number.isFinite(Number(input.minimumObservationCount))
        ? Math.floor(Number(input.minimumObservationCount))
        : DISCOVERY_READINESS_MINIMUM_OBSERVATIONS,
    );
    const observations = (input.observations || [])
      .slice(-DISCOVERY_READINESS_MAXIMUM_OBSERVATIONS)
      .map((observation) => ({ ...observation }))
      .sort((left, right) => String(left.observedAt || "").localeCompare(String(right.observedAt || "")));
    const observationCount = observations.length;
    const unknownRequired = (input.requiredCriterionIds || []).filter(
      (id) => !CRITERIA.some(([known]) => known === id),
    );

    const attempted = observations.filter((item) => item.v3ExecutionAttempted === true);
    const successful = attempted.filter((item) => item.v3ExecutionSucceeded === true);
    const explicit = observations.filter((item) => item.explicitV3Requested === true);
    const activated = explicit.filter((item) => item.selectorActivatedV3 === true);
    const fallbackRequired = observations.filter((item) => item.fallbackRequired === true);
    const fallbackReliable = fallbackRequired.filter((item) =>
      item.fallbackSucceeded === true && item.hybridPoolUsed !== true && item.scanInterrupted !== true);
    const fatalCount = observations.filter((item) => Number(item.fatalErrorCount) > 0).length;
    const runtimes = attempted.map((item) => Number(item.durationMs)).filter(Number.isFinite);
    const withinRuntime = attempted.filter((item) =>
      Number.isFinite(Number(item.durationMs)) &&
      Number.isFinite(Number(item.runtimeLimitMs)) &&
      Number(item.durationMs) <= Number(item.runtimeLimitMs));
    const eligibleEvaluated = observations.reduce((sum, item) => sum + Math.max(0, Number(item.eligibleEvaluatedCount) || 0), 0);
    const sufficientEvidence = observations.reduce((sum, item) => sum + Math.max(0, Number(item.sufficientEvidenceCount) || 0), 0);
    const bucketIds = Object.keys(DISCOVERY_BUCKET_DEFINITIONS);
    const availableBuckets = bucketIds.filter((bucketId) =>
      observations.some((item) => item.bucketAvailability?.[bucketId] === true));
    const unavailableBuckets = bucketIds.filter((bucketId) => !availableBuckets.includes(bucketId));
    const poolAttempts = observations.filter((item) => Number.isFinite(Number(item.minimumViableCandidateCount)));
    const viablePools = poolAttempts.filter((item) =>
      Number(item.deepAnalysisCandidateCount) >= Number(item.minimumViableCandidateCount));
    const emptyPoolCount = poolAttempts.filter((item) => Number(item.deepAnalysisCandidateCount) === 0).length;
    const belowMinimumPoolCount = poolAttempts.filter((item) =>
      Number(item.deepAnalysisCandidateCount) > 0 &&
      Number(item.deepAnalysisCandidateCount) < Number(item.minimumViableCandidateCount)).length;
    const eligibilityViolations = observations.reduce((sum, item) =>
      sum + (Number(item.ineligibleSelectedCount) || 0) + (Number(item.unqualifiedSelectedCount) || 0), 0);
    const explanationRequired = observations.reduce((sum, item) => sum + (Number(item.explanationRequiredCount) || 0), 0);
    const explanationComplete = observations.reduce((sum, item) => sum + (Number(item.explanationCompleteCount) || 0), 0);
    const explanationErrors = observations.reduce((sum, item) => sum + (Number(item.explanationErrorCount) || 0), 0);
    const deterministicObserved = observations.filter((item) => typeof item.deterministicPassed === "boolean");
    const deterministicPassed = deterministicObserved.filter((item) => item.deterministicPassed).length;
    const duplicateTickerCount = observations.reduce((sum, item) => sum + (Number(item.duplicateTickerCount) || 0), 0);
    const shadowExpected = observations.filter((item) => item.shadowExpected === true);
    const shadowAvailable = shadowExpected.filter((item) => item.shadowAvailable === true);
    const apiObserved = observations.filter((item) => typeof item.apiCompatible === "boolean");
    const persistenceObserved = observations.filter((item) => typeof item.persistenceCompatible === "boolean");
    const boundaryObserved = observations.filter((item) => typeof item.predictionBoundaryCompatible === "boolean");
    const selectorAmbiguityCount = observations.filter((item) => item.selectorAmbiguous === true).length;
    const criticalDiagnostics = observations.flatMap((item) =>
      Array.isArray(item.unresolvedCriticalDiagnostics) ? item.unresolvedCriticalDiagnostics : []);

    const executionRate = percent(successful.length, attempted.length);
    const activationRate = percent(activated.length, explicit.length);
    const fallbackRate = percent(fallbackReliable.length, fallbackRequired.length);
    const fatalRate = percent(fatalCount, observationCount);
    const runtimeRate = percent(withinRuntime.length, attempted.length);
    const evidenceRate = percent(sufficientEvidence, eligibleEvaluated);
    const poolRate = percent(viablePools.length, poolAttempts.length);
    const explanationRate = percent(explanationComplete, explanationRequired);
    const stabilityRate = percent(deterministicPassed, deterministicObserved.length);
    const shadowRate = percent(shadowAvailable.length, shadowExpected.length);

    const values = {
      "observation-sufficiency": [observationCount, minimumObservationCount, observationCount >= minimumObservationCount],
      "execution-success": [executionRate, `>= ${DISCOVERY_READINESS_THRESHOLDS.executionSuccessRate}%`, executionRate !== null && executionRate >= DISCOVERY_READINESS_THRESHOLDS.executionSuccessRate],
      "selector-activation": [activationRate, `>= ${DISCOVERY_READINESS_THRESHOLDS.selectorActivationSuccessRate}%`, activationRate !== null && activationRate >= DISCOVERY_READINESS_THRESHOLDS.selectorActivationSuccessRate],
      "fallback-reliability": [fallbackRate, "100%", fallbackRate !== null && fallbackRate === DISCOVERY_READINESS_THRESHOLDS.fallbackReliabilityRate],
      "fatal-error-rate": [fatalRate, "0%", fatalRate !== null && fatalRate === 0],
      "runtime-compliance": [runtimeRate, `>= ${DISCOVERY_READINESS_THRESHOLDS.runtimeComplianceRate}%`, runtimeRate !== null && runtimeRate >= DISCOVERY_READINESS_THRESHOLDS.runtimeComplianceRate],
      "evidence-coverage": [evidenceRate, `>= ${DISCOVERY_READINESS_THRESHOLDS.minimumEvidenceCoveragePercent}%`, evidenceRate !== null && evidenceRate >= DISCOVERY_READINESS_THRESHOLDS.minimumEvidenceCoveragePercent],
      "bucket-availability": [availableBuckets.length, `>= ${DISCOVERY_READINESS_THRESHOLDS.minimumAvailableBucketCount} of 8`, availableBuckets.length >= DISCOVERY_READINESS_THRESHOLDS.minimumAvailableBucketCount],
      "candidate-pool-viability": [poolRate, `>= ${DISCOVERY_READINESS_THRESHOLDS.candidatePoolViabilityRate}%`, poolRate !== null && poolRate >= DISCOVERY_READINESS_THRESHOLDS.candidatePoolViabilityRate],
      "production-eligibility": [eligibilityViolations, "0 violations", eligibilityViolations === 0 && observations.length > 0],
      "explanation-completeness": [explanationRate, "100% and 0 errors", explanationRate !== null && explanationRate === 100 && explanationErrors === 0],
      "deterministic-stability": [stabilityRate, "100%", stabilityRate !== null && stabilityRate === 100],
      "duplicate-integrity": [duplicateTickerCount, "0 duplicates", duplicateTickerCount === 0 && observations.length > 0],
      "shadow-availability": [shadowRate, "100% when expected", shadowRate !== null && shadowRate === 100],
      "api-compatibility": [apiObserved.filter((item) => item.apiCompatible).length, "all observations passing", apiObserved.length === observationCount && apiObserved.every((item) => item.apiCompatible)],
      "persistence-compatibility": [persistenceObserved.filter((item) => item.persistenceCompatible).length, "all observations passing", persistenceObserved.length === observationCount && persistenceObserved.every((item) => item.persistenceCompatible)],
      "prediction-boundary": [boundaryObserved.filter((item) => item.predictionBoundaryCompatible).length, "all observations passing", boundaryObserved.length === observationCount && boundaryObserved.every((item) => item.predictionBoundaryCompatible)],
      "selector-safety": [selectorAmbiguityCount, "0 ambiguous observations", selectorAmbiguityCount === 0 && observations.length > 0],
      "critical-diagnostics": [criticalDiagnostics.length, "0 unresolved critical diagnostics", criticalDiagnostics.length === 0 && observations.length > 0],
    };

    const criteria = CRITERIA.map(([id, description, reasonCode]) => {
      const [observed, threshold, pass] = values[id];
      const details = id === "bucket-availability"
        ? unavailableBuckets.map((bucket) => `Unavailable: ${bucket}`)
        : id === "critical-diagnostics"
          ? criticalDiagnostics.map((item) => `${item.reasonCode || "UNKNOWN"}${item.preExisting ? " (pre-existing)" : ""}`)
          : [];
      return criterion(id, description, reasonCode, observed, threshold, pass, details);
    });
    unknownRequired.sort().forEach((id) => criteria.push(criterion(
      id,
      "Unknown required readiness criterion.",
      "UNKNOWN_REQUIRED_CRITERION",
      null,
      "recognized required criterion",
      false,
      [`Unknown criterion: ${id}`],
    )));

    const failed = criteria.filter((item) => !item.pass);
    const blockers = [
      ...failed.map((item) => ({
        reasonCode: item.reasonCode,
        criterionId: item.criterionId,
        message: item.description,
        preExisting: false,
      })),
      ...criticalDiagnostics.map((item) => ({
        reasonCode: item.reasonCode || "UNRESOLVED_CRITICAL_DIAGNOSTIC",
        criterionId: "critical-diagnostics",
        message: String(item.message || "Unresolved critical diagnostic.").slice(0, 240),
        preExisting: item.preExisting === true,
      })),
      ...(observations.some((item) => Number(item.unqualifiedSelectedCount) > 0)
        ? [{
            reasonCode: "UNQUALIFIED_CANDIDATE_SELECTED",
            criterionId: "production-eligibility",
            message: "One or more selected candidates lacked independent bucket qualification.",
            preExisting: false,
          }]
        : []),
    ];
    const ready = criteria.length > 0 && criteria.every((item) => item.pass);
    const status = ready
      ? "READY"
      : observationCount < minimumObservationCount
        ? "INSUFFICIENT_OBSERVATIONS"
        : "NOT_READY";
    const recommendation = ready
      ? "READY_FOR_DEFAULT_PROMOTION_REVIEW"
      : observationCount < minimumObservationCount
        ? "CONTINUE_SHADOW_VALIDATION"
        : "KEEP_LEGACY_DEFAULT";

    return {
      readinessVersion: DISCOVERY_READINESS_VERSION,
      evaluatedAt,
      status,
      readyForDefaultPromotion: ready,
      currentDefaultEngine: "legacy",
      evaluatedEngine: "v3-evidence-buckets",
      observationWindow: {
        source: input.observationSource || "provided-bounded-observations",
        retainedObservationLimit: DISCOVERY_READINESS_MAXIMUM_OBSERVATIONS,
        firstObservedAt: observations[0]?.observedAt || null,
        lastObservedAt: observations.at(-1)?.observedAt || null,
      },
      observationCount,
      minimumObservationCount,
      criteria,
      passedCriteria: criteria.filter((item) => item.pass).map((item) => item.criterionId),
      failedCriteria: failed.map((item) => item.criterionId),
      blockingReasons: blockers.slice(0, 100),
      warnings: observationCount < minimumObservationCount
        ? ["Observation history is insufficient; smoke-test fixtures are not counted as production history."]
        : [],
      evidenceCoverage: { eligibleEvaluated, sufficientEvidence, coveragePercent: evidenceRate },
      bucketCoverage: { availableBuckets, unavailableBuckets, availableBucketCount: availableBuckets.length },
      candidatePoolHealth: { observationCount: poolAttempts.length, viableRate: poolRate, emptyPoolCount, belowMinimumPoolCount },
      explanationHealth: { requiredCount: explanationRequired, completeCount: explanationComplete, completenessRate: explanationRate, errorCount: explanationErrors },
      selectorHealth: { explicitRequestCount: explicit.length, activationCount: activated.length, activationSuccessRate: activationRate, ambiguityCount: selectorAmbiguityCount },
      fallbackHealth: { requiredCount: fallbackRequired.length, reliableCount: fallbackReliable.length, reliabilityRate: fallbackRate },
      runtimeHealth: { observedCount: runtimes.length, complianceRate: runtimeRate, medianDurationMs: median(runtimes), maximumDurationMs: runtimes.length ? Math.max(...runtimes) : null, overLimitCount: attempted.length - withinRuntime.length, forcibleCancellationSupported: false },
      stabilityHealth: { observedCount: deterministicObserved.length, passedCount: deterministicPassed, passRate: stabilityRate, duplicateTickerCount },
      comparisonHealth: { expectedCount: shadowExpected.length, availableCount: shadowAvailable.length, availabilityRate: shadowRate, overlapIsPerformanceValidation: false },
      productionEligibilityHealth: { violationCount: eligibilityViolations, ineligibleSelectedCount: observations.reduce((sum, item) => sum + (Number(item.ineligibleSelectedCount) || 0), 0), unqualifiedSelectedCount: observations.reduce((sum, item) => sum + (Number(item.unqualifiedSelectedCount) || 0), 0) },
      recommendation,
      limitations: [
        "Readiness is diagnostic only and never changes discovery configuration.",
        "No persisted readiness history is created by this gate.",
        "Synchronous v3 work cannot be forcibly cancelled; runtime compliance is measured after completion.",
        "Candidate overlap is not prediction-performance validation.",
      ],
    };
  } catch (error) {
    return structuredError(input, error.message);
  }
}

module.exports = {
  evaluateReadiness,
};
