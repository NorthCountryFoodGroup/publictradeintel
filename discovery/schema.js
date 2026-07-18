const {
  DISCOVERY_EVIDENCE_FIELD_PATHS,
  DISCOVERY_EVIDENCE_SCHEMA_VERSION,
  DISCOVERY_SUPPORTED_SECURITY_TYPES,
} = require("./constants");

const DEFAULT_MAXIMUM_EVIDENCE_AGE_MS = 24 * 60 * 60 * 1000;

function clampQuality(value) {
  return Math.round(Math.min(100, Math.max(0, Number(value) || 0)));
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "string" && !value.trim()) return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeNullableString(value, maximumLength = 240) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, maximumLength) : null;
}

function normalizeEvidenceTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const timestamp = Date.parse(String(value));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeSecurityIdentity(identity = {}) {
  const rawTicker = identity.canonicalTicker || identity.displayTicker || identity.providerTicker || identity.ticker || "";
  const canonicalTicker = String(rawTicker).toUpperCase().replace(/[^A-Z.-]/g, "").slice(0, 12);
  const securityType = normalizeNullableString(identity.securityType, 80);
  const source = normalizeNullableString(identity.source, 160);
  const generatedFixture = identity.generatedFixture === true || /fixture|generated synthetic/i.test(source || "");
  const supportedSecurityType = DISCOVERY_SUPPORTED_SECURITY_TYPES.includes(securityType);
  const productionEligible =
    identity.productionEligible !== false &&
    identity.active !== false &&
    Boolean(canonicalTicker) &&
    !generatedFixture &&
    supportedSecurityType;

  return {
    canonicalTicker,
    displayTicker: String(identity.displayTicker || canonicalTicker).toUpperCase().replace(/[^A-Z.-]/g, "").slice(0, 12),
    providerTicker: String(identity.providerTicker || canonicalTicker).toUpperCase().replace(/[^A-Z.-]/g, "").slice(0, 20),
    name: normalizeNullableString(identity.name, 160),
    exchange: normalizeNullableString(identity.exchange, 80),
    securityType,
    sector: normalizeNullableString(identity.sector, 120),
    industry: normalizeNullableString(identity.industry, 160),
    source,
    active: identity.active !== false,
    generatedFixture,
    supportedSecurityType,
    productionEligible,
  };
}

function isTimestampStale(timestamp, now, maximumEvidenceAgeMs) {
  const parsed = Date.parse(timestamp || "");
  return Number.isFinite(parsed) && now - parsed > maximumEvidenceAgeMs;
}

function normalizeProvenanceEntry(entry = {}, options = {}) {
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const maximumEvidenceAgeMs =
    normalizeNullableNumber(options.maximumEvidenceAgeMs) ?? DEFAULT_MAXIMUM_EVIDENCE_AGE_MS;
  const sourceTimestamp = normalizeEvidenceTimestamp(entry.sourceTimestamp);
  const fetchedAt = normalizeEvidenceTimestamp(entry.fetchedAt);
  const fields = [...new Set(
    (Array.isArray(entry.fields) ? entry.fields : [])
      .map((field) => String(field || "").trim())
      .filter(Boolean),
  )].sort();
  const stale =
    entry.stale === true ||
    isTimestampStale(sourceTimestamp || fetchedAt, now, maximumEvidenceAgeMs);

  return {
    evidenceType: normalizeNullableString(entry.evidenceType, 100),
    provider: normalizeNullableString(entry.provider, 120),
    source: normalizeNullableString(entry.source, 240),
    sourceTimestamp,
    fetchedAt,
    fields,
    fallback: entry.fallback === true,
    stale,
    limitations: [...new Set(
      (Array.isArray(entry.limitations) ? entry.limitations : [])
        .map((limitation) => normalizeNullableString(limitation, 400))
        .filter(Boolean),
    )].sort(),
  };
}

function normalizeMissingEvidence(entry = {}) {
  const requiredByBuckets = [...new Set(
    (Array.isArray(entry.requiredByBuckets) ? entry.requiredByBuckets : [])
      .map((bucket) => String(bucket || "").trim())
      .filter(Boolean),
  )].sort();
  return {
    field: normalizeNullableString(entry.field, 160),
    requiredByBuckets,
    reason: normalizeNullableString(entry.reason, 300) || "Evidence unavailable",
  };
}

function recordMissingEvidence(missingEvidence, field, requiredByBuckets = [], reason = "Evidence unavailable") {
  const target = Array.isArray(missingEvidence) ? missingEvidence : [];
  const normalized = normalizeMissingEvidence({ field, requiredByBuckets, reason });
  if (!normalized.field) return target;
  const existing = target.find((entry) => entry.field === normalized.field);
  if (existing) {
    existing.requiredByBuckets = [...new Set([
      ...(existing.requiredByBuckets || []),
      ...normalized.requiredByBuckets,
    ])].sort();
    if (!existing.reason) existing.reason = normalized.reason;
    return target;
  }
  target.push(normalized);
  return target;
}

function normalizeMarketEvidence(market = {}) {
  return {
    price: normalizeNullableNumber(market.price),
    previousClose: normalizeNullableNumber(market.previousClose),
    change: normalizeNullableNumber(market.change),
    changePercent: normalizeNullableNumber(market.changePercent),
    volume: normalizeNullableNumber(market.volume),
    dollarVolume: normalizeNullableNumber(market.dollarVolume),
    averageVolume20: normalizeNullableNumber(market.averageVolume20),
    averageDollarVolume20: normalizeNullableNumber(market.averageDollarVolume20),
    relativeVolume: normalizeNullableNumber(market.relativeVolume),
    high20: normalizeNullableNumber(market.high20),
    low20: normalizeNullableNumber(market.low20),
    high60: normalizeNullableNumber(market.high60),
    low60: normalizeNullableNumber(market.low60),
    return1: normalizeNullableNumber(market.return1),
    return5: normalizeNullableNumber(market.return5),
    return20: normalizeNullableNumber(market.return20),
    volatility20: normalizeNullableNumber(market.volatility20),
    movingAverage5: normalizeNullableNumber(market.movingAverage5),
    movingAverage20: normalizeNullableNumber(market.movingAverage20),
    distanceFromHigh20Percent: normalizeNullableNumber(market.distanceFromHigh20Percent),
    distanceFromLow20Percent: normalizeNullableNumber(market.distanceFromLow20Percent),
    latestQuoteAt: normalizeEvidenceTimestamp(market.latestQuoteAt),
    latestBarAt: normalizeEvidenceTimestamp(market.latestBarAt),
    providerFetchedAt: normalizeEvidenceTimestamp(market.providerFetchedAt),
  };
}

function normalizeCatalystEvidence(catalysts = {}) {
  const earnings = catalysts.earnings || {};
  const congressional = catalysts.congressional || {};
  const policy = catalysts.policy || {};
  return {
    earnings: {
      nextEarningsAt: normalizeEvidenceTimestamp(earnings.nextEarningsAt),
      previousEarningsAt: normalizeEvidenceTimestamp(earnings.previousEarningsAt),
      daysUntilEarnings: normalizeNullableNumber(earnings.daysUntilEarnings),
      daysSinceEarnings: normalizeNullableNumber(earnings.daysSinceEarnings),
      surprisePercent: normalizeNullableNumber(earnings.surprisePercent),
      postEarningsReturn: normalizeNullableNumber(earnings.postEarningsReturn),
      source: normalizeNullableString(earnings.source, 240),
      sourceTimestamp: normalizeEvidenceTimestamp(earnings.sourceTimestamp),
    },
    congressional: {
      buyCount: normalizeNullableNumber(congressional.buyCount),
      sellCount: normalizeNullableNumber(congressional.sellCount),
      memberCount: normalizeNullableNumber(congressional.memberCount),
      bipartisan: typeof congressional.bipartisan === "boolean" ? congressional.bipartisan : null,
      transactionValueMinimum: normalizeNullableNumber(congressional.transactionValueMinimum),
      transactionValueMaximum: normalizeNullableNumber(congressional.transactionValueMaximum),
      latestTransactionAt: normalizeEvidenceTimestamp(congressional.latestTransactionAt),
      latestDisclosureAt: normalizeEvidenceTimestamp(congressional.latestDisclosureAt),
      source: normalizeNullableString(congressional.source, 240),
      sourceTimestamp: normalizeEvidenceTimestamp(congressional.sourceTimestamp),
    },
    policy: {
      signalCount: normalizeNullableNumber(policy.signalCount),
      positiveCount: normalizeNullableNumber(policy.positiveCount),
      negativeCount: normalizeNullableNumber(policy.negativeCount),
      independentSourceCount: normalizeNullableNumber(policy.independentSourceCount),
      strongestScore: normalizeNullableNumber(policy.strongestScore),
      strongestDirection: normalizeNullableString(policy.strongestDirection, 40),
      strongestSummary: normalizeNullableString(policy.strongestSummary, 500),
      sourceTimestamp: normalizeEvidenceTimestamp(policy.sourceTimestamp),
    },
  };
}

function normalizeContextEvidence(context = {}) {
  return {
    sectorReturn1: normalizeNullableNumber(context.sectorReturn1),
    sectorReturn5: normalizeNullableNumber(context.sectorReturn5),
    sectorReturn20: normalizeNullableNumber(context.sectorReturn20),
    marketReturn1: normalizeNullableNumber(context.marketReturn1),
    marketReturn5: normalizeNullableNumber(context.marketReturn5),
    marketReturn20: normalizeNullableNumber(context.marketReturn20),
    sectorRelativeStrength: normalizeNullableNumber(context.sectorRelativeStrength),
    marketRelativeStrength: normalizeNullableNumber(context.marketRelativeStrength),
    sectorBreadth: normalizeNullableNumber(context.sectorBreadth),
  };
}

function valueAtPath(record, path) {
  return path.split(".").reduce((value, key) => value?.[key], record);
}

function populatedEvidenceFields(record) {
  return DISCOVERY_EVIDENCE_FIELD_PATHS.filter((path) => {
    const value = valueAtPath(record, path);
    return value !== null && value !== undefined && value !== "";
  });
}

function evidenceTimestampCandidates(record) {
  return [
    record.market.latestQuoteAt,
    record.market.latestBarAt,
    record.market.providerFetchedAt,
    record.catalysts.earnings.sourceTimestamp,
    record.catalysts.congressional.sourceTimestamp,
    record.catalysts.policy.sourceTimestamp,
    ...record.provenance.flatMap((entry) => [entry.sourceTimestamp, entry.fetchedAt]),
  ].filter(Boolean);
}

function calculateEvidenceDataQuality(record, options = {}) {
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const maximumEvidenceAgeMs =
    normalizeNullableNumber(options.maximumEvidenceAgeMs) ?? DEFAULT_MAXIMUM_EVIDENCE_AGE_MS;
  const populated = populatedEvidenceFields(record);
  const usableProvenance = record.provenance.filter(
    (entry) =>
      (entry.provider || entry.source) &&
      (entry.sourceTimestamp || entry.fetchedAt) &&
      entry.fields.length,
  );
  const provenanceFields = new Set(usableProvenance.flatMap((entry) => entry.fields));
  const covered = populated.filter((field) => provenanceFields.has(field));
  const timestamps = evidenceTimestampCandidates(record);
  const freshTimestamps = timestamps.filter((timestamp) => !isTimestampStale(timestamp, now, maximumEvidenceAgeMs));
  const stale = record.provenance.some((entry) => entry.stale) ||
    (timestamps.length > 0 && freshTimestamps.length < timestamps.length);
  const completenessScore = populated.length
    ? Math.min(100, Math.round((populated.length / DISCOVERY_EVIDENCE_FIELD_PATHS.length) * 250))
    : 0;
  const sourceReliabilityScore = populated.length
    ? Math.round((covered.length / populated.length) * 100)
    : 0;
  const freshnessScore = timestamps.length
    ? Math.round((freshTimestamps.length / timestamps.length) * 100)
    : 0;
  const invalidRange =
    record.catalysts.congressional.transactionValueMinimum !== null &&
    record.catalysts.congressional.transactionValueMaximum !== null &&
    record.catalysts.congressional.transactionValueMinimum > record.catalysts.congressional.transactionValueMaximum;
  const consistencyScore = invalidRange ? 0 : populated.length ? 100 : 0;
  const score = populated.length
    ? clampQuality(
      completenessScore * 0.35 +
      sourceReliabilityScore * 0.30 +
      freshnessScore * 0.25 +
      consistencyScore * 0.10,
    )
    : 0;
  const label = score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "fair" : score > 0 ? "poor" : "unavailable";
  const reasons = [];
  if (!populated.length) reasons.push("No discovery evidence is populated.");
  if (covered.length < populated.length) reasons.push(`${populated.length - covered.length} populated evidence field(s) lack provenance coverage.`);
  if (!timestamps.length && populated.length) reasons.push("Populated evidence has no source timestamp.");
  if (stale) reasons.push("One or more evidence sources are stale.");
  if (invalidRange) reasons.push("Congressional transaction value range is inconsistent.");

  return {
    score,
    label,
    freshnessScore,
    completenessScore,
    sourceReliabilityScore,
    consistencyScore,
    stale,
    fallbackOnly: usableProvenance.length > 0 && usableProvenance.every((entry) => entry.fallback),
    productionUsable:
      record.identity.productionEligible &&
      populated.length > 0 &&
      covered.length === populated.length &&
      timestamps.length > 0 &&
      !invalidRange,
    populatedEvidenceCount: populated.length,
    provenanceCoveredEvidenceCount: covered.length,
    reasons,
  };
}

function validateProductionEligibility(identity = {}) {
  const normalized = normalizeSecurityIdentity(identity);
  const reasons = [];
  if (!normalized.canonicalTicker) reasons.push("Canonical ticker is missing.");
  if (!normalized.active) reasons.push("Security is inactive.");
  if (normalized.generatedFixture) reasons.push("Generated fixture symbols are not production-eligible.");
  if (!normalized.supportedSecurityType) reasons.push(`Unsupported security type: ${normalized.securityType || "missing"}.`);
  if (identity.productionEligible === false) reasons.push("Security was explicitly marked production-ineligible.");
  return {
    eligible: normalized.productionEligible && !reasons.length,
    reasons,
    identity: normalized,
  };
}

function normalizeEvidenceRecord(record = {}, options = {}) {
  const identity = normalizeSecurityIdentity(record.identity || record);
  const normalized = {
    schemaVersion: DISCOVERY_EVIDENCE_SCHEMA_VERSION,
    identity,
    market: normalizeMarketEvidence(record.market),
    catalysts: normalizeCatalystEvidence(record.catalysts),
    context: normalizeContextEvidence(record.context),
    provenance: (Array.isArray(record.provenance) ? record.provenance : [])
      .map((entry) => normalizeProvenanceEntry(entry, options)),
    missingEvidence: (Array.isArray(record.missingEvidence) ? record.missingEvidence : [])
      .map(normalizeMissingEvidence)
      .filter((entry) => entry.field),
    dataQuality: null,
  };
  normalized.dataQuality = calculateEvidenceDataQuality(normalized, options);
  return normalized;
}

function validateEvidenceRecord(record = {}, options = {}) {
  const normalized = normalizeEvidenceRecord(record, options);
  const errors = [];
  const warnings = [];
  const eligibility = validateProductionEligibility(normalized.identity);
  const populated = populatedEvidenceFields(normalized);
  const provenanceFields = new Set(normalized.provenance.flatMap((entry) => entry.fields));
  const uncovered = populated.filter((field) => !provenanceFields.has(field));

  if (record.schemaVersion && record.schemaVersion !== DISCOVERY_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`Unsupported evidence schema version: ${record.schemaVersion}.`);
  }
  if (!normalized.identity.canonicalTicker) errors.push("Canonical ticker is required.");
  uncovered.forEach((field) => errors.push(`Populated evidence requires provenance: ${field}.`));
  normalized.provenance.forEach((entry, index) => {
    if (!entry.provider && !entry.source) errors.push(`Provenance entry ${index} requires a provider or source.`);
    if (!entry.sourceTimestamp && !entry.fetchedAt) errors.push(`Provenance entry ${index} requires a timestamp.`);
    if (!entry.fields.length) errors.push(`Provenance entry ${index} requires covered fields.`);
    entry.fields
      .filter((field) => !DISCOVERY_EVIDENCE_FIELD_PATHS.includes(field))
      .forEach((field) => errors.push(`Provenance entry ${index} references an unsupported field: ${field}.`));
    if (entry.stale) warnings.push(`Provenance entry ${index} is stale.`);
  });
  if (!eligibility.eligible) warnings.push(...eligibility.reasons);
  if (!populated.length) warnings.push("No discovery evidence is populated.");

  return {
    valid: errors.length === 0,
    errors,
    warnings: [...new Set(warnings)],
    normalized,
    productionEligible: eligibility.eligible,
  };
}

module.exports = {
  calculateEvidenceDataQuality,
  normalizeEvidenceRecord,
  normalizeEvidenceTimestamp,
  normalizeNullableNumber,
  normalizeProvenanceEntry,
  normalizeSecurityIdentity,
  recordMissingEvidence,
  validateEvidenceRecord,
  validateProductionEligibility,
};
