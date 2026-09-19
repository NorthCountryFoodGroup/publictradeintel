"use strict";

// Pure data contracts. No selection, scheduling, storage, or evaluation occurs here.
const { assertNoProductionInfluence } = require("./research-guards");
function check(condition, message) {
  if (!condition) throw Object.assign(new Error(message), { code: "invalid_research_contract" });
}
function object(value) { check(value && Object.getPrototypeOf(value) === Object.prototype, "Expected a plain object."); }
function copy(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(copy));
  if (value && typeof value === "object") {
    object(value);
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)])));
  }
  check(value === null || ["string", "boolean"].includes(typeof value) || (typeof value === "number" && Number.isFinite(value)), "Expected JSON data.");
  return value;
}
const TRIGGER_MODES = Object.freeze(["manual", "automatic_shadow"]);
const PROTOCOL_VERSION = "KRONOS_AUTO_SHADOW_PROTOCOL_V1";
const PROTOCOL = copy({
  protocolVersion: PROTOCOL_VERSION, productionInfluence: false, triggerMode: "automatic_shadow",
  cohortTarget: 20, strata: { legacyHighConviction: 4, legacyMediumWatch: 4, legacyAvoidNegative: 3,
    legacyNeutral: 5, benchmarkEtf: 2, rotatingControl: 2 },
  horizon: "7-Day", forecastBars: 5, samplePaths: 8, targetObservations: 512,
  minimumObservations: 252, inferenceConcurrency: 1, hardSessionLimitMs: 1200000,
  sectorConcentrationCap: 0.25,
});
const VERSIONS = Object.freeze({ session: "KRONOS_COLLECTION_SESSION_V1", cohort: "KRONOS_FROZEN_COHORT_V1",
  job: "KRONOS_COLLECTION_JOB_V1", outcome: "KRONOS_OUTCOME_LIFECYCLE_V1", membership: "KRONOS_RESEARCH_MEMBERSHIP_V1" });
const TRANSITIONS = copy({
  session: { PLANNED: ["QUEUED", "FAILED", "CANCELLED"], QUEUED: ["RUNNING", "FAILED", "CANCELLED"],
    RUNNING: ["COMPLETED", "COMPLETED_WITH_FAILURES", "FAILED", "CANCELLED"],
    COMPLETED: [], COMPLETED_WITH_FAILURES: [], FAILED: [], CANCELLED: [] },
  job: { PLANNED: ["QUEUED", "SKIPPED", "FAILED"], QUEUED: ["RUNNING", "SKIPPED", "FAILED"],
    RUNNING: ["COMPLETED", "FAILED"], COMPLETED: [], SKIPPED: [], FAILED: [] },
  outcome: { PENDING: ["MATURED", "INSUFFICIENT_DATA", "SYMBOL_CHANGED", "DELISTED", "CORPORATE_ACTION_REVIEW", "PROVIDER_UNAVAILABLE"],
    MATURED: ["EVALUATED", "INSUFFICIENT_DATA", "SYMBOL_CHANGED", "DELISTED", "CORPORATE_ACTION_REVIEW", "PROVIDER_UNAVAILABLE", "EVALUATION_FAILED"],
    EVALUATED: [], INSUFFICIENT_DATA: ["PENDING", "MATURED"], SYMBOL_CHANGED: ["PENDING", "MATURED"], DELISTED: [],
    CORPORATE_ACTION_REVIEW: ["PENDING", "MATURED"], PROVIDER_UNAVAILABLE: ["PENDING", "MATURED"], EVALUATION_FAILED: ["MATURED"] },
});
function assertTransition(kind, from, to) {
  check(Object.hasOwn(TRANSITIONS, kind) && Object.hasOwn(TRANSITIONS[kind], from) && TRANSITIONS[kind][from].includes(to), "Forbidden lifecycle transition.");
}
function text(value, label, maximum = 160) { check(typeof value === "string" && value.length > 0 && value.length <= maximum && value.trim() === value && !/[\x00-\x1f]/.test(value), `Invalid ${label}.`); }
function id(value) { text(value, "reference"); check(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/.test(value), "Invalid reference."); }
function hash(value) { check(typeof value === "string" && /^[a-f0-9]{64}$/.test(value), "Invalid SHA-256."); }
function timestamp(value) { check(typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, "Expected canonical UTC timestamp."); }
function integer(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) { check(Number.isInteger(value) && value >= minimum && value <= maximum, "Invalid count/order."); }
function fields(value, allowed) { object(value); check(Object.keys(value).every((key) => allowed.includes(key)), "Unsupported contract field."); }
function snapshot(value) { fields(value, ["ref", "hash"]); id(value.ref); hash(value.hash); }
function ticker(value) { check(typeof value === "string" && /^[A-Z][A-Z0-9.-]{0,11}$/.test(value), "Invalid ticker."); }
const COMMON = ["contractVersion", "protocolVersion", "productionInfluence", "triggerMode", "id", "createdAt"];
function envelope(value, kind, extra, automatic = true) {
  fields(value, [...COMMON, ...extra]); assertNoProductionInfluence(value);
  check(value.contractVersion === VERSIONS[kind], "Unsupported contract version.");
  check(value.protocolVersion === PROTOCOL_VERSION, "Unsupported protocol version.");
  check(automatic ? value.triggerMode === "automatic_shadow" : TRIGGER_MODES.includes(value.triggerMode), "Invalid trusted provenance.");
  id(value.id); timestamp(value.createdAt);
}
function lifecycle(value, kind) {
  check(Object.hasOwn(TRANSITIONS[kind], value.state), "Invalid lifecycle state.");
  timestamp(value.updatedAt); check(value.updatedAt >= value.createdAt, "Lifecycle precedes creation.");
}
function validateSession(value) {
  envelope(value, "session", ["state", "updatedAt", "tradingDate", "timezone", "inputCutoff", "idempotencyKey", "cohort", "jobCounts", "reason"]);
  lifecycle(value, "session"); id(value.idempotencyKey); snapshot(value.cohort);
  check(/^\d{4}-\d{2}-\d{2}$/.test(value.tradingDate) && Number.isFinite(Date.parse(value.tradingDate)) && new Date(value.tradingDate).toISOString().slice(0, 10) === value.tradingDate, "Invalid trading date.");
  check(value.timezone === "America/New_York", "Invalid experiment timezone."); timestamp(value.inputCutoff);
  check(value.inputCutoff <= value.createdAt, "Input cutoff follows planning.");
  fields(value.jobCounts, Object.keys(TRANSITIONS.job));
  for (const state of Object.keys(TRANSITIONS.job)) integer(value.jobCounts[state], 0, PROTOCOL.cohortTarget);
  check(Object.values(value.jobCounts).reduce((sum, n) => sum + n, 0) === PROTOCOL.cohortTarget, "Session must account for 20 jobs.");
  if (value.state === "PLANNED") check(value.jobCounts.PLANNED === 20, "Planned session has advanced jobs.");
  if (value.state === "QUEUED") check(value.jobCounts.RUNNING + value.jobCounts.COMPLETED === 0, "Queued session has executed jobs.");
  if (value.state === "COMPLETED") check(value.jobCounts.COMPLETED === 20, "Completed session requires all forecasts.");
  if (value.state === "COMPLETED_WITH_FAILURES") check(value.jobCounts.PLANNED + value.jobCounts.QUEUED + value.jobCounts.RUNNING === 0 && value.jobCounts.COMPLETED > 0 && value.jobCounts.COMPLETED < 20, "Mixed completion requires terminal jobs and both successes and exceptions.");
  if (["FAILED", "CANCELLED"].includes(value.state)) text(value.reason, "terminal reason", 240);
  else check(value.reason === null, "Unexpected terminal reason.");
  return copy(value);
}
function candidate(value, reasonRequired) {
  fields(value, reasonRequired ? ["ticker", "stratum", "sector", "order", "reason"] : ["ticker", "stratum", "sector", "order"]);
  ticker(value.ticker); check(Object.hasOwn(PROTOCOL.strata, value.stratum), "Invalid stratum.");
  text(value.sector, "sector", 80); integer(value.order); if (reasonRequired) text(value.reason, "candidate reason", 240);
}
function validateCohort(value) {
  envelope(value, "cohort", ["universeSnapshot", "legacySnapshot", "selectorVersion", "seed", "frozenAt", "sectorConcentrationCap", "selected", "reserves", "rejected"]);
  snapshot(value.universeSnapshot); snapshot(value.legacySnapshot); id(value.selectorVersion); text(value.seed, "seed"); timestamp(value.frozenAt);
  check(value.frozenAt >= value.createdAt, "Freeze precedes creation.");
  check(value.sectorConcentrationCap === PROTOCOL.sectorConcentrationCap, "Sector cap requires a new protocol version.");
  check(Array.isArray(value.selected) && value.selected.length === 20 && Array.isArray(value.reserves) && Array.isArray(value.rejected), "Invalid cohort lists.");
  const seen = new Set();
  for (const [name, rows] of [["selected", value.selected], ["reserves", value.reserves], ["rejected", value.rejected]]) {
    rows.forEach((row, index) => { candidate(row, name !== "selected"); check(row.order === index, "Order must be contiguous within each list."); check(!seen.has(row.ticker), "Duplicate cohort candidate."); seen.add(row.ticker); });
  }
  for (const [stratum, count] of Object.entries(PROTOCOL.strata)) check(value.selected.filter((row) => row.stratum === stratum).length === count, "Stratum allocation differs from protocol.");
  const sectors = new Map();
  for (const row of value.selected) { const key = row.sector.toLowerCase(); sectors.set(key, (sectors.get(key) || 0) + 1); }
  check([...sectors.values()].every((count) => count <= 20 * PROTOCOL.sectorConcentrationCap), "Sector concentration exceeds protocol.");
  return copy(value);
}
function validateJob(value) {
  envelope(value, "job", ["sessionId", "cohort", "ticker", "stratum", "selectionOrder", "idempotencyKey", "state", "updatedAt", "input", "forecastId", "reason"]);
  lifecycle(value, "job"); id(value.sessionId); snapshot(value.cohort); ticker(value.ticker); id(value.idempotencyKey);
  check(Object.hasOwn(PROTOCOL.strata, value.stratum), "Invalid stratum."); integer(value.selectionOrder, 0, 19);
  if (value.input !== null) {
    fields(value.input, ["snapshot", "cutoff", "observationCount"]); snapshot(value.input.snapshot); timestamp(value.input.cutoff);
    check(value.input.cutoff <= value.updatedAt, "Future input cutoff."); integer(value.input.observationCount, 252, 512);
  }
  if (["RUNNING", "COMPLETED"].includes(value.state)) check(value.input !== null, "Execution state requires input provenance.");
  if (value.state === "COMPLETED") id(value.forecastId); else check(value.forecastId === null, "Only completed jobs reference a forecast.");
  if (["SKIPPED", "FAILED"].includes(value.state)) text(value.reason, "job reason", 240); else check(value.reason === null, "Unexpected job reason.");
  return copy(value);
}
function validateOutcome(value) {
  envelope(value, "outcome", ["forecastId", "state", "updatedAt", "maturityAt", "evidence", "reason"], false);
  lifecycle(value, "outcome"); id(value.forecastId); timestamp(value.maturityAt);
  if (["MATURED", "EVALUATED"].includes(value.state)) check(value.updatedAt >= value.maturityAt, "Outcome is not mature.");
  if (value.state === "EVALUATED") {
    fields(value.evidence, ["barsSnapshot", "completenessRef", "evaluationRef", "expectedBars", "observedBars", "complete"]);
    snapshot(value.evidence.barsSnapshot); id(value.evidence.completenessRef); id(value.evidence.evaluationRef);
    check(value.evidence.expectedBars === 5 && value.evidence.observedBars === 5 && value.evidence.complete === true, "Evaluation requires complete five-bar evidence.");
  } else check(value.evidence === null, "Unevaluated state cannot claim evaluation evidence.");
  if (!["PENDING", "MATURED", "EVALUATED"].includes(value.state)) text(value.reason, "outcome exception", 240); else check(value.reason === null, "Unexpected outcome reason.");
  return copy(value);
}
function validateMembership(value) {
  envelope(value, "membership", ["forecastId", "primaryProspective", "sessionId", "jobId", "partition", "partitionPlanRef"], false);
  id(value.forecastId);
  if (value.triggerMode === "manual") {
    check(value.primaryProspective === false && value.sessionId === null && value.jobId === null && value.partition === "EXCLUDED_MANUAL" && value.partitionPlanRef === null, "Manual research cannot enter the primary cohort.");
  } else {
    check(value.primaryProspective === true, "Automatic membership must be explicitly prospective."); id(value.sessionId); id(value.jobId); id(value.partitionPlanRef);
    check(["DEVELOPMENT", "VALIDATION", "HOLDOUT"].includes(value.partition), "Invalid chronological partition.");
  }
  return copy(value);
}
module.exports = Object.freeze({ TRIGGER_MODES, PROTOCOL_VERSION, PROTOCOL, VERSIONS, TRANSITIONS, assertTransition,
  validateSession, validateCohort, validateJob, validateOutcome, validateMembership });
