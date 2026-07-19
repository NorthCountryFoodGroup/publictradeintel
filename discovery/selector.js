const {
  DISCOVERY_ENGINE_VERSIONS,
  DISCOVERY_SELECTOR_DIAGNOSTIC_MAX_ITEMS,
  DISCOVERY_SELECTOR_VERSION,
} = require("./constants");

function canonicalTicker(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z.-]/g, "").slice(0, 12);
}

function cloneCandidates(candidates) {
  const seen = new Set();
  return (Array.isArray(candidates) ? candidates : []).filter((candidate, index) => {
    const ticker = canonicalTicker(candidate?.ticker || candidate?.canonicalTicker);
    const key = ticker || `malformed-${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((candidate) => ({ ...candidate }));
}

function normalizedLimit(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, Math.floor(number))) : fallback;
}

function requestedEngineState(value) {
  if (value === undefined || value === null || value === "") {
    return { requestedEngine: null, valid: false, reason: "DEFAULTED_TO_LEGACY" };
  }
  if (typeof value !== "string") {
    return { requestedEngine: null, valid: false, reason: "MALFORMED_CONFIGURATION" };
  }
  if (!DISCOVERY_ENGINE_VERSIONS.includes(value)) {
    return { requestedEngine: value.slice(0, 80), valid: false, reason: "UNKNOWN_ENGINE" };
  }
  return { requestedEngine: value, valid: true, reason: null };
}

function diagnosticBase({ request, legacyCandidates, shadowEnabled, selectedAt }) {
  return {
    selectorVersion: DISCOVERY_SELECTOR_VERSION,
    requestedEngine: request.requestedEngine,
    resolvedEngine: "legacy",
    activeEngine: "legacy",
    fallbackApplied: !request.valid,
    fallbackReason: request.reason,
    legacyCandidateCount: legacyCandidates.length,
    v3QualifiedCandidateCount: 0,
    v3DeepAnalysisCandidateCount: 0,
    selectedCandidateCount: legacyCandidates.length,
    selectedCandidateTickers: legacyCandidates
      .map((candidate) => canonicalTicker(candidate?.ticker || candidate?.canonicalTicker))
      .filter(Boolean)
      .slice(0, DISCOVERY_SELECTOR_DIAGNOSTIC_MAX_ITEMS),
    v3ExecutionAttempted: false,
    v3ExecutionSucceeded: false,
    shadowEnabled: shadowEnabled === true,
    durationMs: 0,
    warnings: [],
    limitations: [
      "The versioned selector changes discovery inputs only; buildPrediction remains unchanged.",
      "A synchronous v3 execution cannot be forcibly interrupted; over-limit results are rejected after duration measurement.",
      "V3 and shadow diagnostics may construct evidence separately.",
    ],
    selectedAt,
  };
}

function legacyResult(diagnostics, legacyCandidates, reason, warning = null) {
  const selectedCandidates = cloneCandidates(legacyCandidates);
  const next = {
    ...diagnostics,
    resolvedEngine: "legacy",
    activeEngine: "legacy",
    fallbackApplied: Boolean(reason),
    fallbackReason: reason,
    selectedCandidateCount: selectedCandidates.length,
    selectedCandidateTickers: selectedCandidates
      .map((candidate) => canonicalTicker(candidate?.ticker || candidate?.canonicalTicker))
      .filter(Boolean)
      .slice(0, DISCOVERY_SELECTOR_DIAGNOSTIC_MAX_ITEMS),
    warnings: warning ? [...diagnostics.warnings, warning] : diagnostics.warnings,
  };
  return { ...next, selectedCandidates };
}

function selectDiscoveryEngine(input = {}, executeV3) {
  const legacyCandidates = Array.isArray(input.legacyCandidates) ? input.legacyCandidates : [];
  const request = requestedEngineState(input.requestedEngine);
  const selectedAt = input.selectedAt || new Date(0).toISOString();
  const diagnostics = diagnosticBase({
    request,
    legacyCandidates,
    shadowEnabled: input.shadowEnabled,
    selectedAt,
  });

  if (!request.valid) return legacyResult(diagnostics, legacyCandidates, request.reason);
  if (request.requestedEngine === "legacy") {
    return legacyResult(diagnostics, legacyCandidates, null);
  }
  if (request.requestedEngine !== "v3-evidence-buckets" || typeof executeV3 !== "function") {
    return legacyResult(diagnostics, legacyCandidates, "V3_EXECUTION_ERROR", "V3 executor is unavailable.");
  }

  const minimumCount = normalizedLimit(input.minimumViableCandidateCount, 1, 1, 1000);
  const maximumCount = normalizedLimit(input.maximumCandidateCount, 600, minimumCount, 2000);
  const maximumDurationMs = normalizedLimit(input.maximumDurationMs, 10000, 1, 120000);
  const now = typeof input.now === "function" ? input.now : Date.now;
  const startedAt = now();
  let v3;
  try {
    v3 = executeV3();
  } catch {
    const durationMs = Math.max(0, now() - startedAt);
    return legacyResult({
      ...diagnostics,
      v3ExecutionAttempted: true,
      durationMs,
    }, legacyCandidates, "V3_EXECUTION_ERROR", "V3 execution failed in isolation.");
  }
  const durationMs = Math.max(0, now() - startedAt);
  const pool = v3?.candidatePool;
  const deepCandidates = pool?.deepAnalysisCandidates;
  const qualifiedCandidates = pool?.qualifiedCandidates;
  const candidateInputs = v3?.candidateInputs;
  const measured = {
    ...diagnostics,
    v3ExecutionAttempted: true,
    v3ExecutionSucceeded: true,
    durationMs,
    v3QualifiedCandidateCount: Array.isArray(qualifiedCandidates) ? qualifiedCandidates.length : 0,
    v3DeepAnalysisCandidateCount: Array.isArray(deepCandidates) ? deepCandidates.length : 0,
  };

  if (!pool || !Array.isArray(deepCandidates) || !Array.isArray(qualifiedCandidates) || !Array.isArray(candidateInputs)) {
    return legacyResult(measured, legacyCandidates, "V3_INVALID_OUTPUT", "V3 output failed structural validation.");
  }
  if (Array.isArray(v3.fatalErrors) && v3.fatalErrors.length) {
    return legacyResult(measured, legacyCandidates, "V3_FATAL_DIAGNOSTIC", "V3 reported a fatal diagnostic.");
  }
  if (durationMs > maximumDurationMs) {
    return legacyResult(measured, legacyCandidates, "V3_RUNTIME_LIMIT_EXCEEDED", "V3 completed after the configured activation limit.");
  }
  if (!deepCandidates.length) return legacyResult(measured, legacyCandidates, "V3_EMPTY_POOL");
  if (deepCandidates.length < minimumCount) return legacyResult(measured, legacyCandidates, "V3_BELOW_MINIMUM_POOL");
  if (deepCandidates.length > maximumCount) return legacyResult(measured, legacyCandidates, "V3_ABOVE_MAXIMUM_POOL");

  const orderedDeepCandidates = [...deepCandidates].sort((left, right) =>
    (Number(right?.poolPriority) || 0) - (Number(left?.poolPriority) || 0) ||
    (Number(right?.strongestAdjustedScore) || 0) - (Number(left?.strongestAdjustedScore) || 0) ||
    canonicalTicker(left?.canonicalTicker).localeCompare(canonicalTicker(right?.canonicalTicker)));
  const tickers = orderedDeepCandidates.map((candidate) => canonicalTicker(candidate?.canonicalTicker));
  if (tickers.some((ticker) => !ticker)) return legacyResult(measured, legacyCandidates, "V3_INVALID_OUTPUT");
  if (new Set(tickers).size !== tickers.length) return legacyResult(measured, legacyCandidates, "V3_DUPLICATE_TICKER");
  if (orderedDeepCandidates.some((candidate) =>
    candidate?.identity?.productionEligible !== true ||
    candidate?.identity?.active === false ||
    candidate?.identity?.generatedFixture === true ||
    candidate?.identity?.supportedSecurityType === false)) {
    return legacyResult(measured, legacyCandidates, "V3_INELIGIBLE_CANDIDATE");
  }
  if (orderedDeepCandidates.some((candidate) =>
    !Array.isArray(candidate?.qualifiedBucketMemberships) ||
    !candidate.qualifiedBucketMemberships.some((membership) => membership?.qualified === true))) {
    return legacyResult(measured, legacyCandidates, "V3_UNQUALIFIED_CANDIDATE");
  }

  const inputsByTicker = new Map();
  for (const candidate of candidateInputs) {
    const ticker = canonicalTicker(candidate?.ticker || candidate?.canonicalTicker);
    if (!ticker || inputsByTicker.has(ticker)) {
      return legacyResult(measured, legacyCandidates, ticker ? "V3_DUPLICATE_TICKER" : "V3_INVALID_OUTPUT");
    }
    inputsByTicker.set(ticker, candidate);
  }
  const selected = tickers.map((ticker) => inputsByTicker.get(ticker));
  if (selected.some((candidate) => !candidate)) {
    return legacyResult(measured, legacyCandidates, "V3_INVALID_OUTPUT", "V3 candidate input data is incomplete.");
  }

  return {
    ...measured,
    resolvedEngine: "v3-evidence-buckets",
    activeEngine: "v3-evidence-buckets",
    fallbackApplied: false,
    fallbackReason: "V3_ACTIVE",
    selectedCandidateCount: selected.length,
    selectedCandidateTickers: tickers.slice(0, DISCOVERY_SELECTOR_DIAGNOSTIC_MAX_ITEMS),
    selectedCandidates: cloneCandidates(selected),
  };
}

module.exports = {
  selectDiscoveryEngine,
};
