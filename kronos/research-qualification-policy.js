"use strict";
const DAY = 86400000;
const POLICY = Object.freeze({
  version: "KRONOS_QUALIFICATION_POLICY_V1",
  providerMaxAgeMs: 30 * DAY,
  runtimeMaxAgeMs: DAY,
  restoreMaxAgeMs: 8 * DAY,
  weeklyDrillDueMs: 7 * DAY,
  independentMaxAgeMs: 92 * DAY,
  fullCoverage: Object.freeze(["transaction", "audit", "outbox", "forecast", "correction", "outcome"])
});
function coverage(evidence) {
  const tables = { transaction: "research_transactions", audit: "audit_events", outbox: "backup_outbox",
    forecast: "forecasts", correction: "correction_events", outcome: "accepted_outcomes" };
  return POLICY.fullCoverage.filter(scope =>
    evidence.actualCounts[tables[scope]] > 0 && evidence.scopeEvidence[scope] !== null);
}
function evaluateCoverage(evidence) {
  const verified = coverage(evidence);
  return { verified, missing: POLICY.fullCoverage.filter(scope => !verified.includes(scope)) };
}
module.exports = { POLICY, coverage, evaluateCoverage };
