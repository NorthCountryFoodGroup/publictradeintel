"use strict";
const crypto = require("node:crypto"), w = require("./research-qualification-witness-contracts");
const c = require("./research-backup-contracts"), s = require("./research-qualification-signer-contracts");
const r = require("./research-qualification-operator-retention-contracts"), d = require("./research-qualification-operator-contracts");
function verifyConsumption(value, configuration, {candidateHash, signedAt} = {}) {
  const cfg = r.config(configuration); c.shape(value, "body,signature,proof");
  const b = value.body; c.shape(b, "version,candidateHash,decisionHash,proofHash,challengeNonce,consumedAt,signerId,keyFingerprint");
  w.check(b.version === "KRONOS_OPERATOR_CONSUMPTION_V1" && b.candidateHash === candidateHash && b.proofHash === w.hashValue(value.proof), "RETENTION_CONSUMPTION");
  const at = s.time(b.consumedAt), model = r.verifyProof(value.proof, cfg, {challengeNonce: b.challengeNonce, now: at, expectedDecisionHash: b.decisionHash});
  const entry = [...model.requests.values()].find(e => e.append.record.decision.decisionHash === b.decisionHash), record = entry.append.record;
  w.check(record.decision.action === "APPROVED" && entry.append.writerEpoch === model.writerEpoch && entry.append.writerStoreId === model.writerStoreId, "RETENTION_CONSUMPTION");
  w.check(w.hashValue({...record.candidate, approval: record.approval}) === b.candidateHash, "RETENTION_CANDIDATE");
  const key = record.registry.signers.find(k => k.signerId === b.signerId);
  w.check(key && key.keyFingerprint === b.keyFingerprint && b.signerId === record.candidate.request.signerId, "RETENTION_CONSUMER");
  w.check(typeof value.signature === "string" && /^[A-Za-z0-9+/]{86}==$/.test(value.signature) && crypto.verify(null, w.signedBytes(b), s.publicKey(key.publicKey), Buffer.from(value.signature, "base64")), "RETENTION_CONSUMPTION_SIGNATURE");
  require("./research-qualification-preflight-contracts").createOperatorAuthority({operators: cfg.operators, binding: cfg.binding}).validate(record.approval, record.candidate.request, record.candidate.attestation, record.registry, at);
  if (signedAt !== undefined) { const end = s.time(signedAt); w.check(at <= end, "RETENTION_CONSUMPTION_TIME"); r.verifyProof(value.proof, cfg, {challengeNonce: b.challengeNonce, now: end, expectedDecisionHash: b.decisionHash}); require("./research-qualification-preflight-contracts").createOperatorAuthority({operators: cfg.operators, binding: cfg.binding}).validate(record.approval, record.candidate.request, record.candidate.attestation, record.registry, end); }
  return {verified: true, decisionHash: b.decisionHash, context: record.decision.context, independentlyRetainedFixture: true, productionReady: false, offDiskVerified: false};
}
function verifyDecisionProof(proof, config, requirements) {
  const model = r.verifyProof(proof, r.config(config), requirements);
  const record = [...model.requests.values()].find(e => e.append.record.decision.decisionHash === requirements.expectedDecisionHash)?.append.record;
  w.check(record, "RETENTION_DECISION_MISSING"); return d.verifyDecision(record, config, requirements.expectedDecisionHash);
}
module.exports = {verifyConsumption, verifyDecisionProof};
