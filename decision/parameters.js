"use strict";

const {
  DECISION_SCHEMA_VERSIONS,
  INVESTMENT_HORIZONS,
  MAXIMUM_ARRAY_ITEMS,
  MAXIMUM_POSITIONS,
  SHARE_MODES,
} = require("./constants");

const PARAMETER_KEYS = Object.freeze([
  "schemaVersion", "parameterSetId", "createdAt", "availableCapital", "maximumPositions",
  "minimumPositionAmount", "shareMode", "horizon", "riskTolerance",
  "maximumAcceptableLoss", "desiredCashReserve", "maximumPositionPercent",
  "sectorConcentrationLimit", "industryConcentrationLimit", "volatilityTolerance",
  "excludedSymbols", "excludedSectors", "dividendPreference", "stylePreference",
  "minimumLiquidity", "taxContext", "transactionCostAssumptions",
  "currentHoldingsSnapshotId", "customConstraints", "investmentMandateId",
]);
const BLOCKED_KEY = /(credential|password|secret|token|pin|prompt|payload|environment|envVar|absolutePath|filePath|providerResponse)/i;

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function iso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z.-]/g, "").slice(0, 12);
}

function stableStrings(values, mapper = (value) => String(value || "").trim()) {
  return [...new Set((Array.isArray(values) ? values : []).map(mapper).filter(Boolean))].sort();
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function prohibitedPaths(value, prefix = "$", found = []) {
  if (!value || typeof value !== "object") return found;
  for (const [key, nested] of Object.entries(value)) {
    const current = `${prefix}.${key}`;
    if (BLOCKED_KEY.test(key)) found.push(current);
    prohibitedPaths(nested, current, found);
  }
  return found;
}

function normalizeDecisionParameters(input = {}) {
  const source = clone(input) || {};
  return {
    schemaVersion: source.schemaVersion,
    parameterSetId: typeof source.parameterSetId === "string" ? source.parameterSetId.trim() : source.parameterSetId,
    createdAt: source.createdAt,
    availableCapital: source.availableCapital,
    maximumPositions: source.maximumPositions,
    minimumPositionAmount: source.minimumPositionAmount,
    shareMode: source.shareMode,
    horizon: source.horizon,
    riskTolerance: source.riskTolerance,
    maximumAcceptableLoss: source.maximumAcceptableLoss,
    desiredCashReserve: source.desiredCashReserve,
    maximumPositionPercent: source.maximumPositionPercent,
    sectorConcentrationLimit: source.sectorConcentrationLimit,
    industryConcentrationLimit: source.industryConcentrationLimit,
    volatilityTolerance: source.volatilityTolerance,
    excludedSymbols: stableStrings(source.excludedSymbols, normalizeSymbol),
    excludedSectors: stableStrings(source.excludedSectors, (value) => String(value || "").trim().toLowerCase()),
    dividendPreference: source.dividendPreference,
    stylePreference: source.stylePreference,
    minimumLiquidity: source.minimumLiquidity,
    taxContext: source.taxContext,
    transactionCostAssumptions: clone(source.transactionCostAssumptions),
    currentHoldingsSnapshotId: source.currentHoldingsSnapshotId ?? null,
    customConstraints: clone(source.customConstraints || []),
    investmentMandateId: typeof source.investmentMandateId === "string" ? source.investmentMandateId.trim() : source.investmentMandateId ?? null,
  };
}

function validateDecisionParameters(input = {}) {
  const errors = [];
  const unknown = Object.keys(input).filter((key) => !PARAMETER_KEYS.includes(key));
  unknown.forEach((key) => errors.push(`Unknown parameter property: ${key}.`));
  prohibitedPaths(input).forEach((key) => errors.push(`Prohibited parameter property: ${key}.`));
  const value = normalizeDecisionParameters(input);
  if (value.schemaVersion !== DECISION_SCHEMA_VERSIONS.PARAMETER) errors.push("Unsupported parameter schema version.");
  if (!value.parameterSetId) errors.push("parameterSetId is required.");
  if (!iso(value.createdAt)) errors.push("createdAt must be an explicit ISO-8601 timestamp.");
  if (!finite(value.availableCapital) || value.availableCapital <= 0) errors.push("availableCapital must be a finite positive number.");
  if (!Number.isInteger(value.maximumPositions) || value.maximumPositions < 1 || value.maximumPositions > MAXIMUM_POSITIONS) errors.push("maximumPositions must be a bounded positive integer.");
  if (!finite(value.minimumPositionAmount) || value.minimumPositionAmount < 0 || value.minimumPositionAmount > value.availableCapital) errors.push("minimumPositionAmount must be finite, nonnegative, and no greater than availableCapital.");
  if (!SHARE_MODES.includes(value.shareMode)) errors.push("Invalid shareMode.");
  if (!INVESTMENT_HORIZONS.includes(value.horizon)) errors.push("Invalid horizon.");
  ["riskTolerance", "maximumPositionPercent", "sectorConcentrationLimit", "industryConcentrationLimit", "volatilityTolerance", "dividendPreference", "minimumLiquidity"].forEach((field) => {
    if (!finite(value[field]) || value[field] < 0 || value[field] > 100) errors.push(`${field} must be between 0 and 100.`);
  });
  if (!finite(value.maximumAcceptableLoss) || value.maximumAcceptableLoss < 0) errors.push("maximumAcceptableLoss cannot be negative.");
  if (!finite(value.desiredCashReserve) || value.desiredCashReserve < 0 || value.desiredCashReserve > value.availableCapital) errors.push("desiredCashReserve must be between zero and availableCapital.");
  if (!["growth", "value", "balanced", "income", "none"].includes(value.stylePreference)) errors.push("Invalid stylePreference.");
  if (!["taxable", "non-taxable", "unspecified"].includes(value.taxContext)) errors.push("Invalid taxContext.");
  if (value.investmentMandateId !== null && !/^[A-Za-z][A-Za-z0-9._:-]{2,127}$/.test(value.investmentMandateId)) errors.push("investmentMandateId is malformed.");
  if (!Array.isArray(input.excludedSymbols) || !Array.isArray(input.excludedSectors) || !Array.isArray(input.customConstraints)) errors.push("Excluded symbols, excluded sectors, and custom constraints must be arrays.");
  if (Array.isArray(input.excludedSymbols)) {
    input.excludedSymbols.forEach((symbol) => {
      const trimmed = typeof symbol === "string" ? symbol.trim().toUpperCase() : "";
      if (!trimmed || normalizeSymbol(symbol) !== trimmed) errors.push("Excluded symbols must use supported ticker characters and length.");
    });
  }
  if (value.excludedSymbols.length > MAXIMUM_ARRAY_ITEMS || value.excludedSectors.length > MAXIMUM_ARRAY_ITEMS || value.customConstraints.length > MAXIMUM_ARRAY_ITEMS) errors.push("Parameter request arrays exceed the bounded size.");
  if (!value.transactionCostAssumptions || typeof value.transactionCostAssumptions !== "object" || Array.isArray(value.transactionCostAssumptions)) errors.push("transactionCostAssumptions is required.");
  else {
    const allowed = ["commissionPerTrade", "slippagePercent", "minimumFee"];
    Object.keys(value.transactionCostAssumptions).filter((key) => !allowed.includes(key)).forEach((key) => errors.push(`Unknown transaction cost property: ${key}.`));
    allowed.forEach((key) => {
      if (!finite(value.transactionCostAssumptions[key]) || value.transactionCostAssumptions[key] < 0) errors.push(`${key} must be a finite nonnegative number.`);
    });
  }
  return { valid: errors.length === 0, errors, normalized: value, quarantinedUnknownProperties: unknown.sort() };
}

module.exports = {
  PARAMETER_KEYS,
  normalizeDecisionParameters,
  normalizeSymbol,
  validateDecisionParameters,
};
