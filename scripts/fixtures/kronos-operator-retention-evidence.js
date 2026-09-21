"use strict";
const crypto = require("node:crypto"), path = require("node:path");
const w = require("../../kronos/research-qualification-witness-contracts"), d = require("../../kronos/research-qualification-operator-contracts");
const r = require("../../kronos/research-qualification-operator-retention-contracts"), retention = require("../../kronos/research-qualification-operator-retention");
function config({binding, registry, identity, operators}) { return {ledgerId: "fixture-operator-store", writerStoreId: "ordinary-store", writerEpoch: 1, binding, operators, registryPins: [registry.registryHash], witnessIdentity: identity, vaultId: "fictional-operator-vault"}; }
function record(candidate, registry, cfg, {action = "APPROVED", reason = null, research, privateKey} = {}) {
  const f = require("./kronos-preflight-evidence"), context = d.context({request: candidate.request, attestation: candidate.attestation}, registry, research);
  const approval = action === "APPROVED" ? candidate.approval : null, op = cfg.operators[0];
  const decision = w.seal({version: d.VERSION, storeId: cfg.ledgerId, operatorId: op.operatorId, action, reason, context,
    reviewHash: w.hashValue({operatorId: op.operatorId, context, state: "PENDING"}), nonce: candidate.approval.approval.nonce, issuedAt: candidate.approval.approval.issuedAt, approvalHash: approval?.approval.approvalHash || null}, "decisionHash");
  return {decision, signature: crypto.sign(null, d.decisionBytes(decision), privateKey || f.t.extraKey.privateKey).toString("base64"), approval, candidate: {request: candidate.request, attestation: candidate.attestation}, registry};
}
function open(root, {mode, config: cfg, now, hook}) {
  const vault = require("./kronos-witness-vault").openFakeVault(path.join(root, "operator-vault.sqlite"), {mode, vaultId: cfg.vaultId});
  const f = require("./kronos-witness-evidence");
  let witness;
  try { witness = require("../../kronos/research-qualification-operator-retention-witness").openWitness(path.join(root, "operator-witness.sqlite"), {mode, config: cfg, now, vault, signWitness: f.config().signWitness, hook}); }
  catch (e) { vault.close(); throw e; }
  const adapter = {proof: nonce => witness.proof(nonce), append: value => witness.append(value)};
  return {vault, witness, adapter, config: cfg, gate: retention.createGate({config: cfg, adapter, now}),
    ensure(candidate, registry) {
      const challengeNonce = "a".repeat(64), proof = adapter.proof(challengeNonce), model = r.verifyProof(proof, cfg, {challengeNonce, now: now()});
      const old = model.requests.get(candidate.request.requestId); if (old) { d.equal(old.append.record.approval, candidate.approval); d.equal(old.append.record.candidate, {request: candidate.request, attestation: candidate.attestation}); return; }
      const value = record(candidate, registry, cfg); adapter.append(r.request(value, model, cfg));
    }, close() { witness.close(); vault.close(); }};
}
module.exports = {config, record, open};
