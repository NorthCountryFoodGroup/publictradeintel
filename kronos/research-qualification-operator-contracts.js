"use strict";
// Public operator review/decision contracts. No I/O or authority is created on import.
const crypto = require("node:crypto"), w = require("./research-qualification-witness-contracts");
const p = require("./research-qualification-preflight-contracts"), s = require("./research-qualification-signer-contracts");
const q = require("./research-qualification-contracts"), c = require("./research-backup-contracts");
const {evaluateCoverage} = require("./research-qualification-policy");
const VERSION = "KRONOS_OPERATOR_DECISION_V1", REASONS = Object.freeze(["POLICY", "EVIDENCE", "SCOPE", "OPERATOR_CANCELLED"]);
const equal = (a, b) => w.check(w.hashValue(a) === w.hashValue(b), "OPERATOR_CONTEXT_CHANGED");
function research(value, a) {
  const v = value || {modelRevision: null, forecastContractVersion: null, researchContractVersion: null, inputCutoff: null};
  c.shape(v, "modelRevision,forecastContractVersion,researchContractVersion,inputCutoff");
  for (const k of ["modelRevision", "forecastContractVersion", "researchContractVersion"]) if (v[k] !== null) c.label(v[k]);
  if (v.inputCutoff !== null) w.check(s.time(v.inputCutoff) <= s.time(a.observedAt), "OPERATOR_INPUT_CUTOFF");
  q.safe(v); return structuredClone(v);
}
function context(candidate, registry, metadata) {
  c.shape(candidate, "request,attestation"); const {request: r, attestation: a} = candidate;
  s.request(r, a); s.registry(registry); w.check(r.registryHash === registry.registryHash, "OPERATOR_REGISTRY");
  return {requestId: r.requestId, requestHash: r.requestHash, evidenceHash: a.evidenceHash, attestationHash: a.attestationHash,
    domain: s.role(a), environmentId: a.binding.environmentId, streamId: a.binding.streamId, signerId: r.signerId,
    registryHash: registry.registryHash, registryRevision: registry.registryRevision, softwareRevision: a.binding.softwareRevision,
    policyRevision: a.binding.qualificationPolicyVersion, evidenceType: a.attestationType, evidenceVersion: a.attestationVersion,
    createdAt: r.requestedAt, expiresAt: r.expiresAt, evidenceTimestamp: a.observedAt,
    coverage: a.domain === "restore" ? evaluateCoverage(a.evidence) : {verified: [], missing: []}, research: research(metadata, a)};
}
function summary(candidate, registry, metadata) {
  const out = context(candidate, registry, metadata), a = candidate.attestation, e = a.evidence, b = a.binding;
  const common = {observedAt: a.observedAt, expiresAt: a.expiresAt};
  if (a.domain === "provider") out.evidence = {...common, provider: b.providerType, bucket: b.bucket, region: b.region,
    encryption: e.encryption, retention: e.observedRetention, versionId: e.input.versionId,
    exactReadback: e.exactReadback, idempotency: e.idempotency, versioning: e.versioning, objectLock: e.objectLock};
  else if (a.domain === "runtime") out.evidence = {...common, runtimeRevision: b.runtimeRevision, nodeVersion: e.nodeVersion,
    sqliteVersion: e.sqliteVersion, sqliteAvailable: e.sqliteAvailable, backupAvailable: e.backupAvailable,
    persistentDataDir: e.persistentDataDir, writerLock: e.writerLock, fsync: e.fsync, atomicRename: e.atomicRename};
  else out.evidence = {...common, remoteVersions: e.inputs.slice(0, 10).map(v => ({versionId: v.versionId, artifactSha256: v.artifactSha256})),
    inputCount: e.inputs.length, omittedInputs: Math.max(0, e.inputs.length - 10), expectedCounts: e.expectedCounts, actualCounts: e.actualCounts,
    expectedStateHash: e.expectedStateHash, actualStateHash: e.actualStateHash, remoteOnly: e.remoteOnly, sourceRemoved: e.sourceRemoved, result: e.result};
  q.safe(out); w.check(Buffer.byteLength(w.canonicalize(out)) <= 16384, "OPERATOR_SUMMARY_LIMIT"); return out;
}
function decisionBytes(v) {
  c.shape(v, "version,storeId,operatorId,action,reason,context,reviewHash,nonce,issuedAt,approvalHash,decisionHash");
  w.check(v.version === VERSION && ["APPROVED", "DENIED"].includes(v.action), "OPERATOR_DECISION");
  c.label(v.storeId); c.label(v.operatorId); c.digest(v.reviewHash); c.digest(v.nonce); c.iso(v.issuedAt);
  w.check(v.action === "APPROVED" ? v.reason === null && typeof v.approvalHash === "string" : REASONS.includes(v.reason) && v.approvalHash === null, "OPERATOR_DECISION");
  if (v.approvalHash !== null) c.digest(v.approvalHash);
  w.hashed(v, "decisionHash"); q.safe(v); return Buffer.from(VERSION + "\n" + v.decisionHash);
}
function verifyDecision(record, {operators, binding, registryPins, witnessIdentity}, expectedHash) {
  c.shape(record, "decision,signature,approval,candidate,registry"); const d = record.decision;
  c.digest(expectedHash); w.check(d.decisionHash === expectedHash, "OPERATOR_DECISION_PIN");
  const bytes = decisionBytes(d), ctx = context(record.candidate, record.registry, d.context.research);
  equal(ctx, d.context); w.check(d.reviewHash === w.hashValue({operatorId: d.operatorId, context: ctx, state: "PENDING"}), "OPERATOR_REVIEW_BINDING"); equal(record.candidate.attestation.binding, binding);
  w.check(registryPins.includes(record.registry.registryHash), "OPERATOR_REGISTRY");
  const op = operators.find(v => v.operatorId === d.operatorId), at = s.time(d.issuedAt);
  w.check(op && op.status === "ACTIVE" && op.keyFingerprint === s.fingerprint(op.publicKey), "OPERATOR_UNAUTHORIZED");
  w.check(s.time(op.notBefore) <= at && at < s.time(op.notAfter) && op.domains.includes(ctx.domain) && op.deploymentIds.includes(ctx.environmentId) && op.streamIds.includes(ctx.streamId), "OPERATOR_UNAUTHORIZED");
  const authority = p.createOperatorAuthority({operators, binding}); authority.assertIndependent(record.registry);
  authority.assertIndependent({signers: [{keyFingerprint: witnessIdentity.keyFingerprint}]});
  w.check(typeof record.signature === "string" && /^[A-Za-z0-9+/]{86}==$/.test(record.signature) && crypto.verify(null, bytes, s.publicKey(op.publicKey), Buffer.from(record.signature, "base64")), "OPERATOR_SIGNATURE");
  s.assess(record.candidate.request, record.candidate.attestation, record.registry, binding, at);
  if (d.action === "APPROVED") {
    authority.validate(record.approval, record.candidate.request, record.candidate.attestation, record.registry, at);
    w.check(record.approval.approval.approvalHash === d.approvalHash && record.approval.approval.operatorId === d.operatorId && record.approval.approval.nonce === d.nonce && record.approval.approval.issuedAt === d.issuedAt, "OPERATOR_DECISION_BINDING");
  } else w.check(record.approval === null, "OPERATOR_DENIED");
  return {verified: true, action: d.action, decisionHash: d.decisionHash, context: structuredClone(ctx), automaticCollectionReady: false, offDiskVerified: false};
}
module.exports = {VERSION, REASONS, equal, context, summary, decisionBytes, verifyDecision};
