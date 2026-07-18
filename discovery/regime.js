const {
  DISCOVERY_BUCKET_DEFINITIONS,
  DISCOVERY_REGIME_MAXIMUM_ADJUSTMENT,
  DISCOVERY_REGIME_NEUTRAL_BUCKET_EMPHASIS,
  DISCOVERY_REGIME_SCHEMA_VERSION,
} = require("./constants");
const {
  normalizeEvidenceTimestamp,
  normalizeNullableNumber,
  normalizeProvenanceEntry,
} = require("./schema");

const REGIME_METRIC_NAMES = Object.freeze([
  "broadMarketReturn5",
  "broadMarketReturn20",
  "percentAboveMovingAverage20",
  "advancingPercent",
  "decliningPercent",
  "medianVolatility20",
]);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeEvaluationTime(value) {
  return normalizeEvidenceTimestamp(value) || new Date(0).toISOString();
}

function normalizeText(value, maximumLength = 300) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, maximumLength) : null;
}

function normalizeMetric(metric, name, options) {
  const input = metric && typeof metric === "object" ? metric : {};
  const value = normalizeNullableNumber(input.value);
  const provenance = value === null
    ? null
    : normalizeProvenanceEntry({
        ...input.provenance,
        fields: [name],
      }, options);
  const validProvenance = Boolean(
    provenance &&
    (provenance.provider || provenance.source) &&
    (provenance.sourceTimestamp || provenance.fetchedAt),
  );
  return {
    value: validProvenance ? value : null,
    provenance: validProvenance ? provenance : null,
    missingReason: value === null
      ? normalizeText(input.missingReason) || "No real aggregate market evidence was supplied."
      : validProvenance
        ? null
        : "Populated regime metrics require source provenance and a timestamp.",
  };
}

function qualityForMetrics(metrics) {
  const available = Object.values(metrics).filter((metric) => metric.value !== null);
  if (!available.length) return 0;
  const fresh = available.filter((metric) => !metric.provenance.stale).length;
  const sourced = available.filter((metric) => metric.provenance.provider || metric.provenance.source).length;
  return Math.round(((available.length / REGIME_METRIC_NAMES.length) * 60) + ((fresh / available.length) * 25) + ((sourced / available.length) * 15));
}

function neutralEmphasis() {
  return { ...DISCOVERY_REGIME_NEUTRAL_BUCKET_EMPHASIS };
}

function buildMarketRegime(input = {}, options = {}) {
  const evaluatedAt = normalizeEvaluationTime(options.evaluatedAt || input.evaluatedAt);
  const now = Date.parse(evaluatedAt);
  const normalizationOptions = {
    now: Number.isFinite(now) ? now : 0,
    maximumEvidenceAgeMs: options.maximumEvidenceAgeMs,
  };
  const metrics = Object.fromEntries(
    REGIME_METRIC_NAMES.map((name) => [name, normalizeMetric(input.metrics?.[name], name, normalizationOptions)]),
  );
  const missingEvidence = REGIME_METRIC_NAMES
    .filter((name) => metrics[name].value === null)
    .map((name) => ({ metric: name, reason: metrics[name].missingReason }));
  const provenance = REGIME_METRIC_NAMES
    .filter((name) => metrics[name].provenance)
    .map((name) => ({ metric: name, ...metrics[name].provenance }));

  const return5 = metrics.broadMarketReturn5.value;
  const return20 = metrics.broadMarketReturn20.value;
  const above20 = metrics.percentAboveMovingAverage20.value;
  const advancing = metrics.advancingPercent.value;
  const declining = metrics.decliningPercent.value;
  const volatility20 = metrics.medianVolatility20.value;

  const trend = return5 === null || return20 === null || above20 === null
    ? "unavailable"
    : return5 > 0 && return20 > 0 && above20 >= 55
      ? "up"
      : return5 < 0 && return20 < 0 && above20 <= 45
        ? "down"
        : "mixed";
  const breadth = advancing === null || declining === null || above20 === null
    ? "unavailable"
    : advancing >= 55 && above20 >= 55
      ? "broad"
      : declining >= 55 && above20 <= 45
        ? "narrow"
        : "mixed";
  const volatility = volatility20 === null
    ? "unavailable"
    : volatility20 >= 0.035
      ? "high"
      : volatility20 <= 0.018
        ? "low"
        : "normal";

  let state = "unavailable";
  if (trend !== "unavailable" && breadth !== "unavailable" && volatility !== "unavailable") {
    if (trend === "up" && breadth === "broad" && volatility !== "high") state = "risk-on";
    else if (trend === "down" && breadth === "narrow") state = "risk-off";
    else state = "mixed";
  } else if ([trend, breadth, volatility].some((value) => value !== "unavailable")) {
    state = "mixed";
  }

  const bucketEmphasis = neutralEmphasis();
  if (state === "risk-on") {
    Object.assign(bucketEmphasis, {
      momentum: 1.12,
      relativeVolume: 1.05,
      breakout: 1.1,
      sectorLeaders: 1.08,
      reversal: 0.92,
    });
  } else if (state === "risk-off") {
    Object.assign(bucketEmphasis, {
      momentum: 0.88,
      breakout: 0.9,
      sectorLeaders: 0.92,
      reversal: 1.1,
    });
  }
  for (const bucket of Object.keys(bucketEmphasis)) {
    bucketEmphasis[bucket] = clamp(
      bucketEmphasis[bucket],
      1 - DISCOVERY_REGIME_MAXIMUM_ADJUSTMENT,
      1 + DISCOVERY_REGIME_MAXIMUM_ADJUSTMENT,
    );
  }

  const unavailable = state === "unavailable";
  return {
    schemaVersion: DISCOVERY_REGIME_SCHEMA_VERSION,
    evaluatedAt,
    state,
    trend,
    volatility,
    breadth,
    metrics,
    bucketEmphasis: unavailable ? neutralEmphasis() : bucketEmphasis,
    maximumAdjustment: DISCOVERY_REGIME_MAXIMUM_ADJUSTMENT,
    dataQualityScore: qualityForMetrics(metrics),
    provenance,
    missingEvidence,
    explanation: unavailable
      ? "Regime unavailable: real historical trend, breadth, and volatility evidence is insufficient. Neutral emphasis is used."
      : state === "mixed"
        ? "Available evidence is incomplete or mixed; only bounded, evidence-supported context is reported."
        : `Real aggregate evidence supports a ${state} context with bounded bucket emphasis.`,
    fallbackBehavior: {
      active: unavailable,
      mode: unavailable ? "neutral" : "evidence-based",
      bucketMultiplier: unavailable ? 1 : null,
      reason: unavailable ? "Insufficient real aggregate market evidence." : null,
    },
  };
}

function applyRegimeAdjustment(bucketMembership = {}, regime = {}) {
  const bucket = String(bucketMembership.bucket || "");
  const rawBucketScore = normalizeNullableNumber(bucketMembership.rawBucketScore);
  const qualified = bucketMembership.qualified === true;
  const configuredMultiplier = normalizeNullableNumber(regime.bucketEmphasis?.[bucket]);
  const maximumAdjustment = clamp(
    normalizeNullableNumber(regime.maximumAdjustment) ?? DISCOVERY_REGIME_MAXIMUM_ADJUSTMENT,
    0,
    DISCOVERY_REGIME_MAXIMUM_ADJUSTMENT,
  );
  const multiplier = clamp(
    configuredMultiplier ?? 1,
    1 - maximumAdjustment,
    1 + maximumAdjustment,
  );

  return {
    bucket,
    qualified,
    rawBucketScore,
    regimeAdjustedBucketScore: qualified && rawBucketScore !== null
      ? Number((rawBucketScore * multiplier).toFixed(6))
      : null,
    regimeMultiplier: qualified && rawBucketScore !== null ? multiplier : 1,
    adjustmentApplied: qualified && rawBucketScore !== null && multiplier !== 1,
  };
}

function validateMarketRegime(regime) {
  const errors = [];
  if (!regime || regime.schemaVersion !== DISCOVERY_REGIME_SCHEMA_VERSION) errors.push("Invalid regime schema version.");
  if (!["unavailable", "mixed", "risk-on", "risk-off"].includes(regime?.state)) errors.push("Invalid regime state.");
  for (const bucket of Object.keys(DISCOVERY_BUCKET_DEFINITIONS)) {
    const multiplier = normalizeNullableNumber(regime?.bucketEmphasis?.[bucket]);
    if (multiplier === null || multiplier < 0.85 || multiplier > 1.15) {
      errors.push(`Bucket emphasis ${bucket} must be between 0.85 and 1.15.`);
    }
  }
  if (regime?.state === "unavailable" && Object.values(regime.bucketEmphasis || {}).some((value) => value !== 1)) {
    errors.push("Unavailable regime must use neutral bucket emphasis.");
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  REGIME_METRIC_NAMES,
  applyRegimeAdjustment,
  buildMarketRegime,
  validateMarketRegime,
};
