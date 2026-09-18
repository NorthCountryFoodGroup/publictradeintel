"use strict";

const { MAX_OBSERVATIONS, MIN_OBSERVATIONS, MAX_SAMPLES, HORIZON_MAPPINGS, SERVICE_CONTRACT_VERSION } = require("./constants");
function validationError(message, code = "invalid_request") { return Object.assign(new Error(message), { code }); }
function normalizeTicker(value) { const ticker = String(value || "").trim().toUpperCase(); return /^[A-Z][A-Z0-9.-]{0,11}$/.test(ticker) ? ticker : null; }
function finite(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function iso(value) { const time = Date.parse(value); return Number.isFinite(time) ? new Date(time).toISOString() : null; }
function validateBars(input, { cutoff = null, minimum = MIN_OBSERVATIONS, maximum = MAX_OBSERVATIONS } = {}) {
  if (!Array.isArray(input) || input.length < minimum || input.length > maximum) throw validationError(`K-line input must contain ${minimum}-${maximum} observations.`, "invalid_observation_count");
  const cutoffTime = cutoff ? Date.parse(cutoff) : Infinity; let previous = -Infinity; const seen = new Set();
  return input.map((row) => {
    const timestamp = iso(row?.timestamp || row?.date); const time = Date.parse(timestamp);
    if (!timestamp || time <= previous || seen.has(timestamp)) throw validationError("K-line timestamps must be unique and chronological.", "invalid_timestamps");
    if (time > cutoffTime) throw validationError("K-line input contains data after the input cutoff.", "future_data");
    const open = finite(row.open), high = finite(row.high), low = finite(row.low), close = finite(row.close), volume = finite(row.volume);
    if ([open, high, low, close, volume].some((value) => value === null) || Math.min(open, high, low, close) <= 0 || volume < 0 || high < low || high < Math.max(open, close) || low > Math.min(open, close)) throw validationError("K-line OHLCV values are invalid.", "invalid_ohlcv");
    previous = time; seen.add(timestamp); return { timestamp, open, high, low, close, volume };
  });
}
function validateForecastRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw validationError("Forecast request must be an object.");
  const allowed = new Set(["ticker", "horizon", "sampleCount"]); if (Object.keys(value).some((key) => !allowed.has(key))) throw validationError("Forecast request contains unsupported fields.");
  const ticker = normalizeTicker(value.ticker); if (!ticker) throw validationError("Ticker is invalid.", "invalid_symbol");
  const horizon = String(value.horizon || "7-Day"); if (!HORIZON_MAPPINGS[horizon]) throw validationError("Kronos Phase 1 supports 1-Day, 7-Day, and 1-Month only.", "unsupported_horizon");
  const sampleCount = value.sampleCount == null ? null : Number(value.sampleCount); if (sampleCount !== null && (!Number.isInteger(sampleCount) || sampleCount < 1 || sampleCount > MAX_SAMPLES)) throw validationError(`sampleCount must be between 1 and ${MAX_SAMPLES}.`, "invalid_sample_count");
  return { ticker, horizon, sampleCount };
}
function validateTriggerMode(value) {
  const mode = String(value || "").trim();
  if (!new Set(["manual", "automatic_shadow"]).has(mode)) throw validationError("Kronos trigger provenance is invalid.", "invalid_trigger_mode");
  return mode;
}
function validateAdapterResponse(value, expectedBars) {
  if (!value || typeof value !== "object" || !Array.isArray(value.samples) || !value.samples.length || value.samples.length > MAX_SAMPLES) throw validationError("Kronos response is malformed.", "invalid_model_output");
  if (value.serviceContractVersion !== SERVICE_CONTRACT_VERSION) throw validationError("Kronos service contract is incompatible.", "contract_mismatch");
  const executionMode = String(value.executionMode || "");
  if (!new Set(["real_model", "deterministic_adapter"]).has(executionMode)) throw validationError("Kronos response execution provenance is invalid.", "invalid_model_output");
  const samples = value.samples.map((sample) => validateBars(sample, { minimum: expectedBars, maximum: expectedBars }));
  const rawSamples = Array.isArray(value.rawSamples) && value.rawSamples.length === samples.length
    ? value.rawSamples.map((sample) => sample.map((row) => ({ timestamp: iso(row?.timestamp), open: finite(row?.open), high: finite(row?.high), low: finite(row?.low), close: finite(row?.close), volume: finite(row?.volume) })))
    : null;
  if (!rawSamples || rawSamples.some((sample) => sample.length !== expectedBars || sample.some((row) => !row.timestamp || [row.open, row.high, row.low, row.close, row.volume].some((item) => item === null)))) throw validationError("Kronos raw samples are malformed.", "invalid_model_output");
  return { serviceContractVersion: SERVICE_CONTRACT_VERSION, executionMode, outputNormalization: String(value.outputNormalization || "none").slice(0, 80), modelName: String(value.modelName || "").slice(0, 120), modelVersion: String(value.modelVersion || "").slice(0, 120), tokenizerVersion: String(value.tokenizerVersion || "").slice(0, 120), checkpoint: String(value.checkpoint || "").slice(0, 160), sourceRevision: String(value.sourceRevision || "").slice(0, 80), rawSamples, samples };
}
module.exports = { validationError, normalizeTicker, validateBars, validateForecastRequest, validateTriggerMode, validateAdapterResponse };
