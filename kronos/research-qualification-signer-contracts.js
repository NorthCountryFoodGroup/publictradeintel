"use strict";
// Pure contracts only: no signing implementation, private keys, authorization or I/O.
const crypto = require("node:crypto");
const c = require("./research-backup-contracts");
const q = require("./research-qualification-contracts");
const { hashValue } = require("./research-hash");
const { canonicalize } = require("./research-canonical");
const VERSION = Object.freeze({
  registry: "KRONOS_SIGNER_REGISTRY_V1", request: "KRONOS_ATTESTATION_SIGNING_REQUEST_V1",
  envelope: "KRONOS_SIGNED_ATTESTATION_V1", receipt: "KRONOS_ISSUANCE_RECEIPT_V1",
  journal: "KRONOS_ISSUANCE_JOURNAL_V1"
});
const ERRORS = Object.freeze(["SIGNER_UNAVAILABLE","SIGNER_UNAUTHORIZED","SIGNER_REVOKED",
  "SIGNER_RETIRED","SIGNER_EXPIRED","SIGNING_REQUEST_EXPIRED","SIGNING_REQUEST_REPLAY",
  "EVIDENCE_INVALID","POLICY_MISMATCH","DOMAIN_NOT_ALLOWED","ENVIRONMENT_NOT_ALLOWED",
  "STREAM_NOT_ALLOWED","SIGNATURE_INVALID","REGISTRY_MISMATCH","JOURNAL_MISMATCH"]);
const MAX_REQUEST_MS = 5 * 60000, MAX_SNAPSHOT_MS = 86400000;
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function check(ok, code = "EVIDENCE_INVALID") { if (!ok) fail(code); }
function normalized(error) { return ERRORS.includes(error?.code) ? error.code : "EVIDENCE_INVALID"; }
function guarded(fn) { try { return fn(); } catch (error) { fail(normalized(error)); } }
function shape(value, fields) { c.shape(value, fields); }
function seal(body, field) { return { ...body, [field]: hashValue(body) }; }
function hashed(value, field) { const { [field]: digest, ...body } = value; c.digest(digest); check(hashValue(body) === digest); }
function label(v) { c.label(v); q.safe(v); }
function list(v) { check(Array.isArray(v) && v.length > 0 && v.length <= 32 && new Set(v).size === v.length); v.forEach(label); }
function time(v) { c.iso(v); return Date.parse(v); }
function publicKey(pem) {
  check(typeof pem === "string" && pem.length < 256 && /^-----BEGIN PUBLIC KEY-----\n[A-Za-z0-9+/=\n]+\n-----END PUBLIC KEY-----\n?$/.test(pem), "REGISTRY_MISMATCH");
  const key = crypto.createPublicKey(pem);
  check(key.asymmetricKeyType === "ed25519", "REGISTRY_MISMATCH");
  return key;
}
function fingerprint(pem) { return hashValue(publicKey(pem).export({ format: "jwk" })); }
function role(a) { return a.domain === "restore" && a.evidence.exerciseKind === "INDEPENDENT" ? "independent-restore" : a.domain; }
function registry(r) {
  shape(r, "version,registryId,registryRevision,createdAt,expiresAt,signers,registryHash");
  check(r.version === VERSION.registry && Number.isSafeInteger(r.registryRevision) && r.registryRevision > 0);
  label(r.registryId); check(time(r.expiresAt) > time(r.createdAt) && time(r.expiresAt) - time(r.createdAt) <= MAX_SNAPSHOT_MS);
  check(Array.isArray(r.signers) && r.signers.length > 0 && r.signers.length <= 32);
  const ids = new Set(), fingerprints = new Set();
  for (const s of r.signers) {
    shape(s, "signerId,domain,algorithm,publicKey,keyFingerprint,issuer,status,notBefore,notAfter,createdAt,retiredAt,revokedAt,revocationReasonCode,replacementSignerId,allowedAttestationTypes,allowedEnvironmentIds,allowedStreamIds,allowedServiceIdentities,softwareRevisions,policyVersions");
    label(s.signerId); label(s.issuer); check(!ids.has(s.signerId)); ids.add(s.signerId);
    check(["provider","runtime","restore","independent-restore"].includes(s.domain));
    check(s.algorithm === "Ed25519" && s.keyFingerprint === fingerprint(s.publicKey));
    // Separate keys for all roles; in particular independent restore cannot reuse a normal restore key.
    check(!fingerprints.has(s.keyFingerprint), "DOMAIN_NOT_ALLOWED"); fingerprints.add(s.keyFingerprint);
    check(["ACTIVE","RETIRED","REVOKED"].includes(s.status));
    check(time(s.createdAt) <= time(s.notBefore) && time(s.notBefore) < time(s.notAfter));
    check(time(s.createdAt) <= time(r.createdAt));
    for (const name of ["allowedAttestationTypes","allowedEnvironmentIds","allowedStreamIds","allowedServiceIdentities","softwareRevisions","policyVersions"]) list(s[name]);
    check(s.allowedAttestationTypes.length === 1 && s.allowedAttestationTypes[0] === q.TYPES[s.domain === "independent-restore" ? "restore" : s.domain]);
    s.allowedEnvironmentIds.forEach(environmentId => c.identity({ environmentId, streamId: "contract-check" }));
    s.allowedStreamIds.forEach(streamId => c.identity({ environmentId: "fixture", streamId }));
    check(s.policyVersions.every(v => v === "KRONOS_QUALIFICATION_POLICY_V1"));
    if (s.status === "ACTIVE") check(s.retiredAt === null && s.revokedAt === null && s.revocationReasonCode === null);
    if (s.status === "RETIRED") check(time(s.retiredAt) >= time(s.notBefore) && time(s.retiredAt) <= time(r.createdAt) && s.revokedAt === null && s.revocationReasonCode === null);
    if (s.status === "REVOKED") {
      check(time(s.revokedAt) >= time(s.notBefore) && time(s.revokedAt) <= time(r.createdAt));
      check(["COMPROMISE","MISISSUANCE","ADMINISTRATIVE"].includes(s.revocationReasonCode));
      if (s.retiredAt !== null) check(time(s.retiredAt) >= time(s.notBefore) && time(s.retiredAt) <= time(s.revokedAt));
    }
    if (s.replacementSignerId !== null) { label(s.replacementSignerId); check(s.replacementSignerId !== s.signerId && s.status !== "ACTIVE"); }
    const { publicKey: ignored, allowedEnvironmentIds, ...metadata } = s; q.safe({...metadata, deploymentAllowlist:allowedEnvironmentIds});
  }
  for (const s of r.signers) if (s.replacementSignerId !== null) {
    const next = r.signers.find(row => row.signerId === s.replacementSignerId);
    check(next && next.domain === s.domain && next.keyFingerprint !== s.keyFingerprint);
  }
  hashed(r, "registryHash"); return r;
}
function rotation(previous, next) {
  registry(previous); registry(next);
  check(previous.registryId === next.registryId && next.registryRevision > previous.registryRevision &&
    time(next.createdAt) >= time(previous.createdAt), "REGISTRY_MISMATCH");
  for (const old of previous.signers) {
    const row = next.signers.find(s => s.signerId === old.signerId);
    check(row, "REGISTRY_MISMATCH"); // Never remove historical keys/tombstones.
    const mutable = new Set(["status","retiredAt","revokedAt","revocationReasonCode","replacementSignerId"]);
    for (const k of Object.keys(old)) if (!mutable.has(k)) check(canonicalize(old[k]) === canonicalize(row[k]), "REGISTRY_MISMATCH");
    check(old.status === "ACTIVE" || row.status === old.status || (old.status === "RETIRED" && row.status === "REVOKED"), "REGISTRY_MISMATCH");
    for (const k of ["retiredAt","revokedAt","revocationReasonCode","replacementSignerId"]) if (old[k] !== null) check(old[k] === row[k], "REGISTRY_MISMATCH");
  }
  return next;
}
function request(r, a) {
  shape(r, "version,requestId,nonce,signerId,attestationType,evidenceContract,canonicalEvidenceHash,attestationHash,binding,runId,requestedAt,expiresAt,operatorRef,serviceIdentity,registryId,registryRevision,registryHash,requestHash");
  check(r.version === VERSION.request); q.validateAttestation(a);
  for (const k of ["requestId","nonce","signerId","operatorRef","serviceIdentity","registryId","runId"]) label(r[k]);
  check(/^[a-f0-9]{64}$/.test(r.nonce));
  check(r.attestationType === a.attestationType && r.evidenceContract === a.attestationVersion &&
    r.canonicalEvidenceHash === a.evidenceHash && r.attestationHash === a.attestationHash && r.runId === a.runId);
  q.equal(r.binding, a.binding); c.digest(r.registryHash);
  check(Number.isSafeInteger(r.registryRevision) && r.registryRevision > 0);
  check(time(r.expiresAt) > time(r.requestedAt) && time(r.expiresAt) - time(r.requestedAt) <= MAX_REQUEST_MS);
  check(time(a.observedAt) <= time(r.requestedAt));
  hashed(r, "requestHash"); q.safe(r); return r;
}
function freshAttestation(a, at) {
  check(time(a.observedAt) <= at && at < time(a.expiresAt), "EVIDENCE_INVALID");
  if (a.domain === "provider") check(at < time(a.evidence.observedRetention.retainUntil), "EVIDENCE_INVALID");
}
function permitted(s, a) {
  check(s.domain === role(a) && s.allowedAttestationTypes.includes(a.attestationType), "DOMAIN_NOT_ALLOWED");
  check(s.allowedEnvironmentIds.includes(a.binding.environmentId), "ENVIRONMENT_NOT_ALLOWED");
  check(s.allowedStreamIds.includes(a.binding.streamId), "STREAM_NOT_ALLOWED");
  check(s.softwareRevisions.includes(a.binding.softwareRevision) && s.policyVersions.includes(a.binding.qualificationPolicyVersion), "POLICY_MISMATCH");
  if (s.domain === "independent-restore") {
    const missing = require("./research-qualification-policy").evaluateCoverage(a.evidence).missing;
    check(missing.length === 0, "EVIDENCE_INVALID");
  }
}
function active(s, at, historical = false) {
  check(s.status !== "REVOKED", "SIGNER_REVOKED"); // V1 compromise policy: deny ALL signatures of revoked keys.
  check(time(s.notBefore) <= at && at < time(s.notAfter), "SIGNER_EXPIRED");
  if (s.status === "RETIRED") check(historical && at < time(s.retiredAt), "SIGNER_RETIRED");
}
// Pure assessment is NOT an operator authorization or a capability to sign.
function assess(r, a, reg, binding, at) {
  return guarded(() => {
    registry(reg); request(r, a); q.equal(a.binding, binding);
    check(time(reg.createdAt) <= at && at < time(reg.expiresAt), "REGISTRY_MISMATCH");
    check(r.registryId === reg.registryId && r.registryRevision === reg.registryRevision && r.registryHash === reg.registryHash, "REGISTRY_MISMATCH");
    check(time(r.requestedAt) <= at && at < time(r.expiresAt), "SIGNING_REQUEST_EXPIRED");
    const s = reg.signers.find(s => s.signerId === r.signerId); check(s, "SIGNER_UNAUTHORIZED");
    check(s.allowedServiceIdentities.includes(r.serviceIdentity), "SIGNER_UNAUTHORIZED");
    permitted(s, a); active(s, at); freshAttestation(a, at); return { eligible: true, authorized: false };
  });
}
function signature(value) { check(typeof value === "string" && /^[A-Za-z0-9+/]{86}==$/.test(value), "SIGNATURE_INVALID"); }
// Additional signature authenticates issuance metadata without changing the existing V3 signature bytes.
function envelopeBytes(body) {
  shape(body, "version,attestation,request,signerId,keyFingerprint,algorithm,signature,signedAt");
  check(body.version === VERSION.envelope && body.algorithm === "Ed25519"); request(body.request, body.attestation);
  check(body.signerId === body.request.signerId); c.digest(body.keyFingerprint); signature(body.signature); time(body.signedAt);
  check(time(body.request.requestedAt) <= time(body.signedAt) && time(body.signedAt) < time(body.request.expiresAt), "SIGNING_REQUEST_EXPIRED");
  return Buffer.from("KRONOS_ISSUANCE_CONTEXT_V1\n" + hashValue(body), "utf8");
}
function envelope(e) {
  shape(e, "version,attestation,request,signerId,keyFingerprint,algorithm,signature,signedAt,contextSignature,envelopeHash");
  const { contextSignature, envelopeHash, ...body } = e;
  envelopeBytes(body); signature(contextSignature); hashed(e, "envelopeHash"); return e;
}
function receipt(r) {
  shape(r, "version,requestId,nonce,requestHash,attestationHash,evidenceHash,attestationType,signedEnvelopeHash,signerId,keyFingerprint,issuedAt,result,reason,receiptHash");
  check(r.version === VERSION.receipt);
  for (const k of ["requestId","signerId"]) label(r[k]);
  for (const k of ["nonce","requestHash","attestationHash","evidenceHash","keyFingerprint"]) c.digest(r[k]);
  check(Object.values(q.TYPES).includes(r.attestationType)); time(r.issuedAt);
  check(["ISSUED","REJECTED"].includes(r.result));
  if (r.result === "ISSUED") { c.digest(r.signedEnvelopeHash); check(r.reason === null); }
  else check(r.signedEnvelopeHash === null && ERRORS.includes(r.reason));
  hashed(r, "receiptHash"); q.safe(r); return r;
}
function journal(j) {
  shape(j, "version,journalId,revision,createdAt,expiresAt,entries,journalHash");
  check(j.version === VERSION.journal && Number.isSafeInteger(j.revision) && j.revision > 0); label(j.journalId);
  check(time(j.expiresAt) > time(j.createdAt) && time(j.expiresAt) - time(j.createdAt) <= MAX_SNAPSHOT_MS);
  check(Array.isArray(j.entries) && j.entries.length <= 10000);
  const ids = new Set(), nonces = new Set();
  for (const row of j.entries) {
    shape(row, "requestId,nonce,requestHash,reservedAt,receipt"); label(row.requestId); c.digest(row.nonce); c.digest(row.requestHash);
    check(!ids.has(row.requestId) && !nonces.has(row.nonce), "SIGNING_REQUEST_REPLAY"); ids.add(row.requestId); nonces.add(row.nonce);
    check(time(row.reservedAt) <= time(j.createdAt));
    if (row.receipt !== null) {
      receipt(row.receipt);
      check(row.receipt.requestId === row.requestId && row.receipt.nonce === row.nonce && row.receipt.requestHash === row.requestHash);
      check(time(row.receipt.issuedAt) >= time(row.reservedAt) && time(row.receipt.issuedAt) <= time(j.createdAt));
    }
  }
  hashed(j, "journalHash"); return j;
}
// Pure transition specification. A future authority MUST commit these atomically to durable external storage.
function reserve(j, r, a, at) {
  journal(j); request(r, a);
  check(time(j.createdAt) <= at && at < time(j.expiresAt), "JOURNAL_MISMATCH");
  check(time(r.requestedAt) <= at && at < time(r.expiresAt), "SIGNING_REQUEST_EXPIRED");
  check(!j.entries.some(row => row.requestId === r.requestId || row.nonce === r.nonce), "SIGNING_REQUEST_REPLAY");
  const { journalHash, ...body } = structuredClone(j);
  body.revision++; body.createdAt = new Date(at).toISOString();
  body.entries.push({requestId:r.requestId,nonce:r.nonce,requestHash:r.requestHash,reservedAt:body.createdAt,receipt:null});
  return journal(seal(body, "journalHash"));
}
function complete(j, r, result, at) {
  journal(j); hashed(r, "requestHash"); receipt(result);
  check(time(j.createdAt) <= at && at < time(j.expiresAt), "JOURNAL_MISMATCH");
  const { journalHash, ...body } = structuredClone(j);
  const row = body.entries.find(row => row.requestId === r.requestId);
  check(row && row.receipt === null && row.requestHash === r.requestHash && row.nonce === r.nonce, "SIGNING_REQUEST_REPLAY");
  check(result.requestId === r.requestId && result.requestHash === r.requestHash && result.nonce === r.nonce &&
    result.attestationHash === r.attestationHash && result.evidenceHash === r.canonicalEvidenceHash &&
    result.attestationType === r.attestationType && result.signerId === r.signerId);
  check(time(result.issuedAt) <= at && time(result.issuedAt) < time(r.expiresAt), "SIGNING_REQUEST_EXPIRED");
  body.revision++; body.createdAt = new Date(at).toISOString(); row.receipt = structuredClone(result);
  return journal(seal(body, "journalHash"));
}
function journalSuccessor(old, next) {
  journal(old); journal(next);
  check(old.journalId === next.journalId && next.revision > old.revision && time(next.createdAt) >= time(old.createdAt), "JOURNAL_MISMATCH");
  for (const row of old.entries) {
    const n = next.entries.find(n => n.requestId === row.requestId);
    check(n && n.nonce === row.nonce && n.requestHash === row.requestHash && n.reservedAt === row.reservedAt, "JOURNAL_MISMATCH");
    if (row.receipt !== null) check(hashValue(row.receipt) === hashValue(n.receipt), "JOURNAL_MISMATCH");
  }
}
module.exports = { VERSION, ERRORS, MAX_REQUEST_MS, MAX_SNAPSHOT_MS, check, guarded, normalized, seal, time,
  publicKey, fingerprint, registry, rotation, request, role, permitted, active, freshAttestation,
  assess, envelopeBytes, envelope, receipt, journal, reserve, complete, journalSuccessor };
