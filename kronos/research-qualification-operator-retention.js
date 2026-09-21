"use strict";
const crypto = require("node:crypto"), w = require("./research-qualification-witness-contracts");
const r = require("./research-qualification-operator-retention-contracts"), d = require("./research-qualification-operator-contracts");
function createClient({config, adapter, store, writerStoreId, writerEpoch, now = Date.now, hook = () => {}}) {
  const cfg = r.config(config);
  function current() {
    const challengeNonce = crypto.randomBytes(32).toString("hex"), proof = adapter.proof(challengeNonce);
    const model = r.verifyProof(proof, cfg, {challengeNonce, now: now(), writerStoreId, writerEpoch});
    // All remote decisions must be present exactly, including denials; rollback freezes even mutually stale local stores.
    for (const entry of model.requests.values()) { const local = store.decision(entry.append.record.decision.context.requestId);
      w.check(local && w.canonicalize(local) === w.canonicalize(entry.append.record), "RETENTION_OPERATOR_ROLLBACK"); }
    for (const marker of store.retained()) {
      const entry = model.requests.get(marker.requestId);
      w.check(entry && entry.append.appendHash === marker.appendHash && entry.receipt.sequence === marker.sequence && entry.append.record.decision.decisionHash === marker.decisionHash, "RETENTION_WITNESS_ROLLBACK");
    }
    return {proof, model};
  }
  function retain(record) {
    const {model} = current(), id = record.decision.context.requestId, old = model.requests.get(id);
    const local = store.decision(id); d.equal(local, record);
    const request = old?.append || r.request(record, model, cfg);
    if (old) d.equal(old.append.record, record);
    const ack = adapter.append(request); r.acknowledgment(ack, {append: request, receipt: ack.body.receipt}, cfg);
    hook("after-witness-ack"); const fresh = current();
    w.check(fresh.model.requests.get(id)?.append.appendHash === request.appendHash, "RETENTION_ACK_NOT_CURRENT");
    store.markRetained({requestId: id, decisionHash: record.decision.decisionHash, sequence: request.sequence, appendHash: request.appendHash});
    hook("after-retained-marker"); return record;
  }
  return Object.freeze({current, retain});
}
// This is a mandatory trusted-constructor gate, not a caller-supplied boolean or serialized authority.
const gates = new WeakMap();
function createGate({config, adapter, now = Date.now}) {
  const cfg = r.config(config), gate = Object.freeze({}); gates.set(gate, {cfg, adapter, now}); return gate;
}
function assertGate(gate, config) {
  const g = gates.get(gate); w.check(g && typeof g.adapter?.proof === "function" && typeof g.now === "function", "OPERATOR_RETENTION_REQUIRED");
  d.equal(g.cfg, r.config(config));
}
function consume(gate, candidate, at) {
  const g = gates.get(gate); w.check(g, "OPERATOR_RETENTION_REQUIRED");
  const challengeNonce = crypto.randomBytes(32).toString("hex"), proof = g.adapter.proof(challengeNonce);
  const verifiedAt = g.now(); w.check(Number.isFinite(at) && verifiedAt >= at && verifiedAt - at < w.LEASE_MS, "RETENTION_TIME");
  const model = r.verifyProof(proof, g.cfg, {challengeNonce, now: verifiedAt}), entry = model.requests.get(candidate.request.requestId);
  w.check(entry && entry.append.record.decision.action === "APPROVED", "OPERATOR_RETENTION_REQUIRED");
  const record = entry.append.record; d.equal(record.candidate, {request: candidate.request, attestation: candidate.attestation}); d.equal(record.approval, candidate.approval);
  require("./research-qualification-preflight-contracts").createOperatorAuthority({operators: g.cfg.operators, binding: g.cfg.binding}).validate(record.approval, candidate.request, candidate.attestation, record.registry, verifiedAt);
  w.check(entry.append.writerStoreId === model.writerStoreId && entry.append.writerEpoch === model.writerEpoch, "RETENTION_OLD_WRITER");
  return {proof, decisionHash: record.decision.decisionHash, challengeNonce, consumedAt: new Date(verifiedAt).toISOString()};
}
module.exports = {createClient, createGate, assertGate, consume};
