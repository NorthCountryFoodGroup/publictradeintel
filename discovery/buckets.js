const {
  DISCOVERY_BUCKET_DEFINITIONS,
  DISCOVERY_REGIME_MAXIMUM_ADJUSTMENT,
} = require("./constants");
const { normalizeNullableNumber } = require("./schema");

function clamp(value, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function valueAtPath(record, path) {
  return path.split(".").reduce((value, key) => value?.[key], record);
}

function provenanceForPath(record, path) {
  return (Array.isArray(record?.provenance) ? record.provenance : [])
    .filter((entry) => Array.isArray(entry.fields) && entry.fields.includes(path))
    .filter((entry) => (entry.provider || entry.source) && (entry.sourceTimestamp || entry.fetchedAt));
}

function uniqueProvenance(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = JSON.stringify([
      entry.evidenceType || null,
      entry.provider || null,
      entry.source || null,
      entry.sourceTimestamp || null,
      entry.fetchedAt || null,
      entry.fallback === true,
      entry.stale === true,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectEvidence(record, paths) {
  const evidenceUsed = [];
  const missingEvidence = [];
  const provenance = [];
  const limitations = [];

  paths.forEach((path) => {
    const value = valueAtPath(record, path);
    const sources = provenanceForPath(record, path);
    if (value === null || value === undefined || value === "") {
      missingEvidence.push({ field: path, reason: "Required real evidence is not populated." });
      return;
    }
    if (!sources.length) {
      missingEvidence.push({ field: path, reason: "Populated evidence lacks field-level source provenance." });
      return;
    }
    if (sources.every((entry) => entry.fallback === true)) {
      missingEvidence.push({ field: path, reason: "Only fallback evidence is available." });
      return;
    }
    if (sources.every((entry) => entry.stale === true)) {
      missingEvidence.push({ field: path, reason: "Only stale evidence is available." });
      return;
    }
    evidenceUsed.push({ field: path, value });
    sources.forEach((entry) => {
      provenance.push(entry);
      (entry.limitations || []).forEach((limitation) => limitations.push(limitation));
    });
  });

  return {
    evidenceUsed,
    missingEvidence,
    provenance: uniqueProvenance(provenance),
    limitations: [...new Set(limitations)].sort(),
  };
}

function boundedScore(value) {
  const number = normalizeNullableNumber(value);
  return number === null ? null : Number(clamp(number).toFixed(6));
}

function scoreMomentum(record) {
  const return5 = record.market.return5;
  const return20 = record.market.return20;
  const relative = record.context.marketRelativeStrength;
  const qualified = return5 >= 0.03 && return20 >= 0.08 && relative >= 0.02;
  return {
    qualified,
    score: boundedScore(35 + clamp(return5 * 500, 0, 25) + clamp(return20 * 250, 0, 25) + clamp(relative * 500, 0, 15)),
    reason: qualified ? "Positive 5-day and 20-day returns are confirmed with market-relative strength." : "Historical returns or market-relative strength do not meet momentum thresholds.",
  };
}

function scoreRelativeVolume(record) {
  const relativeVolume = record.market.relativeVolume;
  const qualified = relativeVolume >= 1.5 && record.market.volume >= record.market.averageVolume20;
  return {
    qualified,
    score: boundedScore(55 + clamp((relativeVolume - 1.5) * 45, 0, 45)),
    reason: qualified ? "Current real volume is at least 1.5 times its sourced 20-day average." : "Relative volume is below the 1.5 qualification threshold.",
  };
}

function scoreBreakout(record) {
  const distance = record.market.distanceFromHigh20Percent;
  const qualified = distance >= -1 && record.market.relativeVolume >= 1.25 && record.market.price >= record.market.high20 * 0.99;
  return {
    qualified,
    score: boundedScore(55 + clamp((record.market.relativeVolume - 1.25) * 30, 0, 25) + clamp(1 + distance, 0, 1) * 20),
    reason: qualified ? "Price is within 1% of its sourced 20-day high with confirming relative volume." : "Price proximity or confirming relative volume does not meet breakout thresholds.",
  };
}

function scoreEarnings(record) {
  const days = record.catalysts.earnings.daysUntilEarnings;
  const qualified = days >= 0 && days <= 14;
  return {
    qualified,
    score: boundedScore(100 - (days * 3)),
    reason: qualified ? "A sourced earnings event is scheduled within 14 days." : "The sourced earnings event is outside the 14-day catalyst window.",
  };
}

function scoreCongressional(record) {
  const evidence = record.catalysts.congressional;
  const qualified = evidence.buyCount >= 1 && evidence.memberCount >= 1;
  return {
    qualified,
    score: boundedScore(35 + clamp(evidence.buyCount * 12, 0, 36) + clamp(evidence.memberCount * 7, 0, 21) + (evidence.bipartisan === true ? 8 : 0)),
    reason: qualified
      ? "One or more sourced congressional purchase disclosures are present; disclosure dates are not treated as trade timestamps."
      : "No sourced congressional purchase disclosure meets the threshold.",
  };
}

function scorePolicy(record) {
  const evidence = record.catalysts.policy;
  const direction = String(evidence.strongestDirection || "").toLowerCase();
  const qualified = evidence.signalCount >= 1 && evidence.independentSourceCount >= 1 && direction === "positive";
  return {
    qualified,
    score: boundedScore(35 + clamp(evidence.signalCount * 10, 0, 30) + clamp(evidence.independentSourceCount * 15, 0, 30)),
    reason: qualified ? "Ticker-specific sourced policy evidence includes a positive signal." : "Ticker-specific sourced positive policy evidence does not meet the threshold.",
  };
}

function scoreSectorLeader(record) {
  const context = record.context;
  const qualified = context.sectorReturn5 > 0 && context.sectorReturn20 > 0 && context.sectorRelativeStrength >= 0.02;
  return {
    qualified,
    score: boundedScore(35 + clamp(context.sectorReturn5 * 400, 0, 25) + clamp(context.sectorReturn20 * 200, 0, 25) + clamp(context.sectorRelativeStrength * 500, 0, 15)),
    reason: qualified ? "Sourced sector returns are positive with confirmed sector-relative strength." : "Sector return or relative-strength thresholds are not met.",
  };
}

function scoreReversal(record) {
  const market = record.market;
  const qualified = market.return20 <= -0.08 && market.return5 >= 0.02 && market.distanceFromLow20Percent >= 3 && market.movingAverage20 > 0;
  return {
    qualified,
    score: boundedScore(40 + clamp(Math.abs(market.return20) * 250, 0, 25) + clamp(market.return5 * 500, 0, 20) + clamp(market.distanceFromLow20Percent, 0, 15)),
    reason: qualified ? "A sourced longer decline is followed by a confirmed five-day rebound away from the 20-day low." : "Historical decline and rebound confirmation do not meet reversal thresholds.",
  };
}

const SCORERS = Object.freeze({
  momentum: scoreMomentum,
  relativeVolume: scoreRelativeVolume,
  breakout: scoreBreakout,
  earnings: scoreEarnings,
  congressional: scoreCongressional,
  policy: scorePolicy,
  sectorLeaders: scoreSectorLeader,
  reversal: scoreReversal,
});

function productionEligibility(record) {
  const reasons = [];
  if (record?.identity?.productionEligible !== true) reasons.push("Security identity is production-ineligible.");
  if (record?.identity?.active === false) reasons.push("Security is inactive.");
  if (record?.identity?.generatedFixture === true) reasons.push("Generated fixture securities are production-ineligible.");
  if (record?.identity?.supportedSecurityType === false) reasons.push("Security type is unsupported.");
  if (record?.dataQuality?.fallbackOnly === true) reasons.push("Fallback-only securities are production-ineligible.");
  return { eligible: reasons.length === 0, reasons };
}

function neutralOrBoundedMultiplier(regime, bucketId) {
  if (!regime || regime.state === "unavailable" || regime.fallbackBehavior?.mode === "neutral") return 1;
  const configured = normalizeNullableNumber(regime.bucketEmphasis?.[bucketId]) ?? 1;
  return clamp(configured, 1 - DISCOVERY_REGIME_MAXIMUM_ADJUSTMENT, 1 + DISCOVERY_REGIME_MAXIMUM_ADJUSTMENT);
}

function safeUnknownResult(bucketId, record, evaluatedAt) {
  return {
    bucketId: String(bucketId || ""),
    bucketName: "Unknown bucket",
    qualified: false,
    productionEligible: productionEligibility(record).eligible,
    rawScore: null,
    regimeMultiplier: 1,
    regimeAdjustedScore: null,
    evidenceUsed: [],
    missingEvidence: [],
    qualificationReasons: [],
    disqualificationReasons: ["Unknown bucket ID; qualification failed safely."],
    provenance: [],
    limitations: [],
    evaluatedAt,
  };
}

function evaluateBucket(bucketId, record = {}, regime = {}, options = {}) {
  const evaluatedAt = options.evaluatedAt || new Date(0).toISOString();
  const definition = DISCOVERY_BUCKET_DEFINITIONS[bucketId];
  const scorer = SCORERS[bucketId];
  if (!definition || !scorer) return safeUnknownResult(bucketId, record, evaluatedAt);

  try {
    const eligibility = productionEligibility(record);
    const collected = collectEvidence(record, definition.requiredEvidence);
    if (
      bucketId === "policy" &&
      !collected.provenance.some((entry) => entry.evidenceType === "policy-keyword-signal")
    ) {
      collected.missingEvidence.push({
        field: "catalysts.policy",
        reason: "Policy qualification requires ticker-specific sourced policy-signal provenance.",
      });
    }
    if (
      bucketId === "congressional" &&
      !collected.provenance.some((entry) => entry.evidenceType === "congressional-disclosure")
    ) {
      collected.missingEvidence.push({
        field: "catalysts.congressional",
        reason: "Congressional qualification requires normalized disclosure provenance.",
      });
    }
    let scoreResult = null;
    if (!collected.missingEvidence.length) scoreResult = scorer(record);
    const rawScore = scoreResult?.score ?? null;
    const independentlyQualified = Boolean(
      eligibility.eligible &&
      !collected.missingEvidence.length &&
      scoreResult?.qualified &&
      rawScore !== null &&
      rawScore >= definition.minimumScore,
    );
    const regimeMultiplier = independentlyQualified ? neutralOrBoundedMultiplier(regime, bucketId) : 1;
    const regimeAdjustedScore = independentlyQualified
      ? Number((rawScore * regimeMultiplier).toFixed(6))
      : rawScore;
    const disqualificationReasons = [
      ...eligibility.reasons,
      ...collected.missingEvidence.map((item) => `${item.field}: ${item.reason}`),
    ];
    if (!independentlyQualified && scoreResult) disqualificationReasons.push(scoreResult.reason);

    return {
      bucketId,
      bucketName: definition.label,
      qualified: independentlyQualified,
      productionEligible: eligibility.eligible,
      rawScore,
      regimeMultiplier,
      regimeAdjustedScore,
      evidenceUsed: collected.evidenceUsed,
      missingEvidence: collected.missingEvidence,
      qualificationReasons: independentlyQualified ? [scoreResult.reason] : [],
      disqualificationReasons: [...new Set(disqualificationReasons)],
      provenance: collected.provenance,
      limitations: collected.limitations,
      evaluatedAt,
    };
  } catch (error) {
    return {
      ...safeUnknownResult(bucketId, record, evaluatedAt),
      bucketName: definition.label,
      disqualificationReasons: [`Bucket evaluation failed safely: ${error.message}`],
    };
  }
}

function evaluateAllBuckets(record, regime, options) {
  return Object.keys(DISCOVERY_BUCKET_DEFINITIONS).map((bucketId) =>
    evaluateBucket(bucketId, record, regime, options));
}

module.exports = {
  evaluateAllBuckets,
  evaluateBucket,
};
