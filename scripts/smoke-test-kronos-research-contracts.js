"use strict";
const assert = require("node:assert/strict");
const c = require("../kronos/research-contracts");
const time = "2026-09-19T00:00:00.000Z";
const snap = () => ({ ref: "snapshot-1", hash: "a".repeat(64) });
const base = (kind) => ({ contractVersion: c.VERSIONS[kind], protocolVersion: c.PROTOCOL_VERSION, productionInfluence: false, triggerMode: "automatic_shadow", id: `${kind}-1`, createdAt: time });
const counts = () => ({ PLANNED: 20, QUEUED: 0, RUNNING: 0, COMPLETED: 0, SKIPPED: 0, FAILED: 0 });
const session = () => ({ ...base("session"), state: "PLANNED", updatedAt: time, tradingDate: "2026-09-18", timezone: "America/New_York", inputCutoff: "2026-09-18T20:00:00.000Z", idempotencyKey: "protocol:2026-09-18", cohort: snap(), jobCounts: counts(), reason: null });
const selected = Object.entries(c.PROTOCOL.strata).flatMap(([stratum, count]) => Array.from({ length: count }, () => ({ stratum })));
selected.forEach((row, index) => Object.assign(row, { ticker: `T${index}`, sector: `Sector ${index % 4}`, order: index }));
const cohort = () => ({ ...base("cohort"), universeSnapshot: snap(), legacySnapshot: snap(), selectorVersion: "selector-v1", seed: "frozen-seed", frozenAt: time, sectorConcentrationCap: .25, selected: structuredClone(selected), reserves: [{ ticker: "RES", stratum: "legacyNeutral", sector: "Sector 1", order: 0, reason: "reserve" }], rejected: [{ ticker: "REJ", stratum: "legacyNeutral", sector: "Sector 1", order: 0, reason: "insufficient_history" }] });
const job = () => ({ ...base("job"), sessionId: "session-1", cohort: snap(), ticker: "AAPL", stratum: "legacyHighConviction", selectionOrder: 0, idempotencyKey: "session-1:AAPL", state: "PLANNED", updatedAt: time, input: null, forecastId: null, reason: null });
const outcome = () => ({ ...base("outcome"), forecastId: "forecast-1", state: "PENDING", updatedAt: time, maturityAt: "2026-09-25T20:00:00.000Z", evidence: null, reason: null });
const membership = () => ({ ...base("membership"), forecastId: "forecast-1", primaryProspective: true, sessionId: "session-1", jobId: "job-1", partition: "DEVELOPMENT", partitionPlanRef: "chronological-plan-v1" });

assert.deepEqual(c.PROTOCOL, { protocolVersion: "KRONOS_AUTO_SHADOW_PROTOCOL_V1", productionInfluence: false, triggerMode: "automatic_shadow", cohortTarget: 20,
  strata: { legacyHighConviction: 4, legacyMediumWatch: 4, legacyAvoidNegative: 3, legacyNeutral: 5, benchmarkEtf: 2, rotatingControl: 2 },
  horizon: "7-Day", forecastBars: 5, samplePaths: 8, targetObservations: 512, minimumObservations: 252, inferenceConcurrency: 1, hardSessionLimitMs: 1200000, sectorConcentrationCap: .25 });
assert.throws(() => { c.PROTOCOL.strata.legacyNeutral = 4; }, TypeError);
assert.throws(() => { c.PROTOCOL = {}; }, TypeError);
for (const [make, validate] of [[session, c.validateSession], [cohort, c.validateCohort], [job, c.validateJob], [outcome, c.validateOutcome], [membership, c.validateMembership]]) {
  assert.ok(Object.isFrozen(validate(make())));
  for (const unsafe of [true, "false", "true", 0, 1, null, undefined]) assert.throws(() => validate({ ...make(), productionInfluence: unsafe }), { code: "production_influence_prohibited" });
  assert.throws(() => validate({ ...make(), protocolVersion: "v2" }));
  assert.throws(() => validate({ ...make(), contractVersion: "old" }));
  assert.throws(() => validate({ ...make(), createdAt: "2026-02-30" }));
  assert.throws(() => validate({ ...make(), authoritative: true }));
}
for (const [kind, table] of Object.entries(c.TRANSITIONS)) {
  for (const [from, targets] of Object.entries(table)) {
    for (const to of Object.keys(table)) {
      if (targets.includes(to)) assert.doesNotThrow(() => c.assertTransition(kind, from, to));
      else assert.throws(() => c.assertTransition(kind, from, to));
    }
  }
}
for (const from of ["PLANNED", "QUEUED", "RUNNING"]) c.assertTransition("session", from, "CANCELLED");
const cancelled = { ...session(), state: "CANCELLED", reason: "operator_cancelled" };
c.validateSession(cancelled); assert.throws(() => c.validateSession({ ...cancelled, reason: "" }));
assert.throws(() => c.validateSession({ ...session(), state: "COMPLETED" }));
c.validateSession({ ...session(), state: "COMPLETED", jobCounts: { ...counts(), PLANNED: 0, COMPLETED: 20 } });
c.validateSession({ ...session(), state: "COMPLETED_WITH_FAILURES", jobCounts: { ...counts(), PLANNED: 0, COMPLETED: 19, FAILED: 1 } });
assert.throws(() => c.validateSession({ ...session(), jobCounts: { ...counts(), FAILED: 1 } }));
assert.throws(() => c.validateSession({ ...session(), inputCutoff: "2026-09-20T00:00:00.000Z" }));
assert.throws(() => c.validateSession({ ...session(), cohort: { ref: "ref", hash: "bad" } }));

const original = cohort(), frozen = c.validateCohort(original);
original.selected[0].ticker = "MUTATED"; original.reserves[0].reason = "changed"; original.universeSnapshot.hash = "b".repeat(64);
assert.equal(frozen.selected[0].ticker, "T0"); assert.equal(frozen.reserves[0].reason, "reserve"); assert.equal(frozen.universeSnapshot.hash, "a".repeat(64));
assert.throws(() => { frozen.selected[0].sector = "changed"; }, TypeError);
assert.throws(() => frozen.rejected.push({}), TypeError);
for (const mutate of [v => { v.selected[1].ticker = v.selected[0].ticker; }, v => { v.selected[0].order = 8; }, v => { v.selected[0].stratum = "legacyNeutral"; }, v => { v.selected.forEach(row => { row.sector = "same"; }); }, v => { v.sectorConcentrationCap = .5; }, v => { v.rejected[0].reason = ""; }]) {
  const value = cohort(); mutate(value); assert.throws(() => c.validateCohort(value));
}
const input = { snapshot: snap(), cutoff: "2026-09-18T20:00:00.000Z", observationCount: 512 };
const completed = { ...job(), state: "COMPLETED", input, forecastId: "forecast-1" }; c.validateJob(completed);
assert.throws(() => c.validateJob({ ...completed, forecastId: null }));
assert.throws(() => c.validateJob({ ...completed, input: { ...input, observationCount: 251 } }));
for (const state of ["FAILED", "SKIPPED"]) { c.validateJob({ ...job(), state, reason: "bounded_reason" }); assert.throws(() => c.validateJob({ ...job(), state })); assert.throws(() => c.validateJob({ ...job(), state, reason: "x".repeat(241) })); }
const evidence = { barsSnapshot: snap(), completenessRef: "complete-1", evaluationRef: "eval-1", expectedBars: 5, observedBars: 5, complete: true };
const evaluated = { ...outcome(), state: "EVALUATED", updatedAt: "2026-09-26T00:00:00.000Z", evidence }; c.validateOutcome(evaluated);
assert.throws(() => c.validateOutcome({ ...evaluated, updatedAt: time }));
assert.throws(() => c.validateOutcome({ ...evaluated, evidence: null }));
assert.throws(() => c.validateOutcome({ ...evaluated, evidence: { ...evidence, observedBars: 4 } }));
assert.throws(() => c.validateOutcome({ ...outcome(), state: "matured" }));
const manual = { ...membership(), triggerMode: "manual", primaryProspective: false, sessionId: null, jobId: null, partition: "EXCLUDED_MANUAL", partitionPlanRef: null };
c.validateMembership(manual);
assert.throws(() => c.validateMembership({ ...manual, primaryProspective: true }));
assert.throws(() => c.validateMembership({ ...membership(), triggerMode: "manual" }));
console.log("Slice 1 research contracts, protocol, transitions, provenance, and deep immutability: PASS");
