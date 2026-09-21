"use strict";
// Separate operator lane; common hashes, canonicalization, expiry and transition semantics are reused.
const crypto = require("node:crypto"), w = require("./research-qualification-witness-contracts");
const c = require("./research-backup-contracts"), s = require("./research-qualification-signer-contracts");
const d = require("./research-qualification-operator-contracts"), ipc = require("./research-qualification-integration-contracts");
const V = Object.freeze({transition: "KRONOS_OPERATOR_RETENTION_TRANSITION_V1", domain: "KRONOS_OPERATOR_RETENTION_DOMAIN_V1", append: "KRONOS_OPERATOR_RETENTION_APPEND_V1", receipt: "KRONOS_OPERATOR_RETENTION_RECEIPT_V1", ack: "KRONOS_OPERATOR_RETENTION_ACK_V1", view: "KRONOS_OPERATOR_RETENTION_VIEW_V1", proof: "KRONOS_OPERATOR_RETENTION_PROOF_V1", store: "KRONOS_OPERATOR_RETENTION_STORE_V1"});
function config(value) {
  const v = structuredClone(value); c.shape(v, "ledgerId,writerStoreId,writerEpoch,binding,operators,registryPins,witnessIdentity,vaultId");
  c.label(v.ledgerId); c.label(v.vaultId); w.identity(v.witnessIdentity); w.positive(v.writerEpoch);
  w.check(v.witnessIdentity.stores.some(x => x.storeId === v.writerStoreId && x.writerEpoch === v.writerEpoch), "RETENTION_WRITER");
  w.check(v.witnessIdentity.environmentId === v.binding.environmentId && v.witnessIdentity.streamId === v.binding.streamId, "RETENTION_SCOPE");
  return require("./research-qualification-preflight-contracts").freeze(v);
}
function scoped(v, cfg) {
  w.check(v.domain === V.domain && v.ledgerId === cfg.ledgerId && v.environmentId === cfg.binding.environmentId && v.streamId === cfg.binding.streamId, "RETENTION_SCOPE");
}
function common(cfg) { return {domain: V.domain, ledgerId: cfg.ledgerId, environmentId: cfg.binding.environmentId, streamId: cfg.binding.streamId}; }
function safe(v) {
  // Registry scope arrays are public enum values, not an environment dump.
  // Public PEM/base64 bytes are validated before replacing them in the secret scan.
  function scrub(value, key = "") {
    if (key === "allowedEnvironmentIds") {
      w.check(Array.isArray(value) && value.every(x => ["fixture", "development", "staging", "production"].includes(x)), "RETENTION_SCOPE");
      return {deploymentScopes: value};
    }
    if (key === "publicKey") { s.publicKey(value); return "validated-public-ed25519-key"; }
    if (["signature", "contextSignature"].includes(key)) {
      w.check(typeof value === "string" && /^[A-Za-z0-9+/]{86}==$/.test(value), "RETENTION_SIGNATURE"); return "validated-public-signature";
    }
    if (Array.isArray(value)) return value.map(x => scrub(x));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, x]) => [k === "allowedEnvironmentIds" ? "deploymentScopes" : k, scrub(x, k)]));
    return value;
  }
  const clean = scrub(v); c.safe(clean);
  // Keep the qualification credential/JWT/URL checks on every leaf, without its
  // single-attestation size cap incorrectly limiting a multi-entry proof.
  function scan(value) {
    if (value && typeof value === "object") for (const x of Object.values(value)) scan(x);
    else require("./research-qualification-contracts").safe({value});
  }
  scan(clean); w.check(Buffer.byteLength(w.canonicalize(v)) <= 16 * 1024 * 1024, "RETENTION_SIZE");
  w.check(!/PRIVATE KEY|AWS_ACCESS|AWS_SECRET|SessionToken|AccessKeyId|Authorization|LOGIN_PIN|ADMIN_PIN|KRONOS_SERVICE_TOKEN|cookie|oidc|bearer|environmentDump/i.test(w.canonicalize(v)), "RETENTION_SECRET");
}
function append(v, cfg) {
  c.shape(v, "version,domain,ledgerId,environmentId,streamId,writerStoreId,writerEpoch,operatorKeyFingerprint,sequence,previousCheckpointHash,kind,record,transition,appendHash");
  w.check(v.version === V.append && ["DECISION", "TRANSITION"].includes(v.kind), "RETENTION_VERSION"); scoped(v, cfg);
  w.positive(v.sequence); w.positive(v.writerEpoch); c.label(v.writerStoreId);
  if (v.previousCheckpointHash !== null) c.digest(v.previousCheckpointHash); w.hashed(v, "appendHash");
  const operatorId = v.kind === "DECISION" ? v.record?.decision?.operatorId : v.transition?.body?.operatorId;
  w.check(cfg.operators.some(op => op.operatorId === operatorId && op.keyFingerprint === v.operatorKeyFingerprint), "RETENTION_OPERATOR_KEY");
  if (v.kind === "DECISION") { w.check(v.transition === null && v.record.decision.storeId === cfg.ledgerId, "RETENTION_LEDGER"); d.verifyDecision(v.record, cfg, v.record.decision.decisionHash); }
  else {
    w.check(v.record === null && v.transition, "RETENTION_TRANSITION");
    c.shape(v.transition, "body,signature"); c.shape(v.transition.body, "version,domain,ledgerId,environmentId,streamId,operatorId,transition");
    w.check(v.transition.body.version === V.transition, "RETENTION_TRANSITION_DOMAIN"); scoped(v.transition.body, cfg);
  }
  safe(v); w.check(Buffer.byteLength(w.canonicalize(v)) <= 2097152, "RETENTION_SIZE"); return v;
}
function replay(entries, cfg) {
  w.check(Array.isArray(entries) && entries.length <= 10000, "RETENTION_LIMIT");
  const model = {sequence: 0, checkpoint: null, writerStoreId: cfg.writerStoreId, writerEpoch: cfg.writerEpoch, requests: new Map(), nonces: new Set(), receiptHash: null, at: 0};
  for (const entry of entries) {
    c.shape(entry, "append,receipt"); const a = append(entry.append, cfg), r = entry.receipt;
    c.shape(r, "version,domain,ledgerId,environmentId,streamId,sequence,previousReceiptHash,appendHash,acceptedAt,receiptHash"); scoped(r, cfg); w.hashed(r, "receiptHash");
    w.check(r.version === V.receipt && r.sequence === a.sequence && r.previousReceiptHash === model.receiptHash && r.appendHash === a.appendHash, "RETENTION_RECEIPT");
    w.check(a.sequence === model.sequence + 1 && a.previousCheckpointHash === model.checkpoint, "RETENTION_SEQUENCE");
    w.check(a.writerStoreId === model.writerStoreId && a.writerEpoch === model.writerEpoch, "RETENTION_OLD_WRITER");
    const at = s.time(r.acceptedAt); w.check(at >= model.at, "RETENTION_TIME");
    if (a.kind === "DECISION") {
      const v = a.record.decision, id = v.context.requestId;
      w.check(!model.requests.has(id) && !model.nonces.has(v.nonce), "RETENTION_FORK");
      w.check(s.time(v.issuedAt) <= at && at < s.time(v.context.expiresAt), "RETENTION_EXPIRED");
      if (a.record.approval) w.check(at < s.time(a.record.approval.approval.expiresAt), "RETENTION_EXPIRED");
      model.requests.set(id, entry); model.nonces.add(v.nonce);
    } else {
      const op = cfg.operators.find(x => x.operatorId === a.transition.body.operatorId); w.check(op, "RETENTION_TRANSITION");
      const wrapper = ipc.verify(a.transition, op.publicKey);
      w.check(op.deploymentIds.includes(cfg.binding.environmentId) && op.streamIds.includes(cfg.binding.streamId), "RETENTION_TRANSITION_SCOPE");
      const t = ipc.verifyTransition(wrapper.transition, {operator: op, identity: cfg.witnessIdentity, current: {storeId: model.writerStoreId, writerEpoch: model.writerEpoch}, now: at});
      model.writerStoreId = t.toStore; model.writerEpoch = t.toEpoch;
    }
    model.sequence = a.sequence; model.checkpoint = a.appendHash; model.receiptHash = r.receiptHash; model.at = at;
  }
  return model;
}
function verifySigned(packet, cfg, version) {
  c.shape(packet, "body,signature"); w.check(packet.body.version === version, "RETENTION_DOMAIN");
  w.check(typeof packet.signature === "string" && /^[A-Za-z0-9+/]{86}==$/.test(packet.signature) && crypto.verify(null, w.signedBytes(packet.body), s.publicKey(cfg.witnessIdentity.publicKey), Buffer.from(packet.signature, "base64")), "RETENTION_SIGNATURE");
  return packet.body;
}
function acknowledgment(packet, entry, cfg) {
  c.shape(entry, "append,receipt"); append(entry.append, cfg);
  c.shape(entry.receipt, "version,domain,ledgerId,environmentId,streamId,sequence,previousReceiptHash,appendHash,acceptedAt,receiptHash");
  scoped(entry.receipt, cfg); w.hashed(entry.receipt, "receiptHash");
  w.check(entry.receipt.version === V.receipt && entry.receipt.appendHash === entry.append.appendHash && entry.receipt.sequence === entry.append.sequence, "RETENTION_RECEIPT");
  const b = verifySigned(packet, cfg, V.ack); c.shape(b, "version,domain,ledgerId,environmentId,streamId,witnessId,witnessEpoch,keyFingerprint,receipt,vaultReceipt"); scoped(b, cfg);
  w.check(b.witnessId === cfg.witnessIdentity.witnessId && b.witnessEpoch === cfg.witnessIdentity.epoch && b.keyFingerprint === cfg.witnessIdentity.keyFingerprint, "RETENTION_IDENTITY");
  d.equal(b.receipt, entry.receipt); w.vaultReceipt(b.vaultReceipt);
  w.check(b.vaultReceipt.vaultId === cfg.vaultId && b.vaultReceipt.sequence === entry.receipt.sequence && b.vaultReceipt.entryHash === w.hashValue(entry), "RETENTION_READBACK"); return b;
}
function verifyProof(proof, cfg, {challengeNonce, now, expectedDecisionHash, writerStoreId, writerEpoch, minimumSequence = 0, expectedCheckpoint} = {}) {
  c.shape(proof, "version,history,view"); w.check(proof.version === V.proof && Array.isArray(proof.history) && proof.history.length <= 10000, "RETENTION_PROOF");
  let previous = null;
  for (const h of proof.history) { c.shape(h, "entry,ack"); const b = acknowledgment(h.ack, h.entry, cfg); w.check(b.vaultReceipt.previousHash === previous, "RETENTION_VAULT_CHAIN"); previous = b.vaultReceipt.receiptHash; }
  const m = replay(proof.history.map(h => h.entry), cfg), v = verifySigned(proof.view, cfg, V.view);
  c.shape(v, "version,domain,ledgerId,environmentId,streamId,witnessId,witnessEpoch,keyFingerprint,sequence,checkpoint,writerStoreId,writerEpoch,vaultHeadHash,challengeNonce,issuedAt,expiresAt"); scoped(v, cfg);
  c.digest(challengeNonce); w.check(v.witnessId === cfg.witnessIdentity.witnessId && v.witnessEpoch === cfg.witnessIdentity.epoch && v.keyFingerprint === cfg.witnessIdentity.keyFingerprint, "RETENTION_IDENTITY");
  w.check(v.challengeNonce === challengeNonce && Number.isFinite(now) && s.time(v.issuedAt) <= now && now < s.time(v.expiresAt) && s.time(v.expiresAt) - s.time(v.issuedAt) === w.LEASE_MS && s.time(v.issuedAt) >= m.at, "RETENTION_FRESHNESS");
  w.check(v.sequence === m.sequence && v.sequence >= minimumSequence && v.checkpoint === m.checkpoint && v.vaultHeadHash === previous && v.writerStoreId === m.writerStoreId && v.writerEpoch === m.writerEpoch, "RETENTION_VIEW_FORK");
  if (writerEpoch !== undefined) w.check(writerEpoch === m.writerEpoch && writerStoreId === m.writerStoreId, "RETENTION_OLD_WRITER");
  if (expectedCheckpoint !== undefined) w.check(expectedCheckpoint === m.checkpoint, "RETENTION_VIEW_FORK");
  if (expectedDecisionHash !== undefined) { c.digest(expectedDecisionHash); w.check([...m.requests.values()].some(e => e.append.record.decision.decisionHash === expectedDecisionHash), "RETENTION_DECISION_MISSING"); }
  safe(proof); return m;
}
function request(record, model, cfg) { return w.seal({version: V.append, ...common(cfg), writerStoreId: model.writerStoreId, writerEpoch: model.writerEpoch, operatorKeyFingerprint: cfg.operators.find(op => op.operatorId === record.decision.operatorId).keyFingerprint, sequence: model.sequence + 1, previousCheckpointHash: model.checkpoint, kind: "DECISION", record: structuredClone(record), transition: null}, "appendHash"); }
module.exports = {V, config, common, safe, append, replay, acknowledgment, verifyProof, request};
