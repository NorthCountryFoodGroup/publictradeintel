"use strict";
// Explicit operator/server composition only. Never imported by startup or routes.
// Configuration is a trust root, not request data. No default issuers or private keys.
const crypto = require("node:crypto");
const c = require("./research-backup-contracts");
const contracts = require("./research-qualification-contracts");
const { hashValue } = require("./research-hash");
const { POLICY, evaluateCoverage } = require("./research-qualification-policy");
function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function createQualificationAuthority({ binding, issuers, now = Date.now }) {
  contracts.binding(binding);
  const context = freeze(structuredClone(binding));
  c.check(Array.isArray(issuers) && issuers.length > 0 && issuers.length <= 16 && typeof now === "function");
  const keys = new Map();
  for (const issuer of issuers) {
    c.shape(issuer, "id,domain,publicKey");
    c.label(issuer.id); c.check(Object.hasOwn(contracts.TYPES, issuer.domain) && !keys.has(issuer.id));
    c.check(typeof issuer.publicKey === "string" && issuer.publicKey.startsWith("-----BEGIN PUBLIC KEY-----"));
    const key = crypto.createPublicKey(issuer.publicKey); c.check(key.asymmetricKeyType === "ed25519");
    keys.set(issuer.id, { domain: issuer.domain, key, fingerprint: hashValue(key.export({ format: "jwk" })) });
  }
  const authorityHash = hashValue([...keys].map(([id, row]) => ({ id, domain: row.domain, fingerprint: row.fingerprint })).sort((a,b) => a.id.localeCompare(b.id)));
  const accepted = new WeakMap(), issued = new WeakMap();
  function clock() { const value = now(); c.check(Number.isFinite(value)); return value; }
  function fresh(a, time) {
    c.check(Date.parse(a.observedAt) <= time && time < Date.parse(a.expiresAt));
    if (a.domain === "provider") c.check(time < Date.parse(a.evidence.observedRetention.retainUntil));
  }
  function verifyEnvelope(envelope, time) {
    c.shape(envelope, "issuerId,attestation,signature");
    const key = keys.get(envelope.issuerId); c.check(key);
    const a = contracts.validateAttestation(envelope.attestation);
    c.check(key.domain === a.domain); contracts.equal(a.binding, context); fresh(a, time);
    c.check(typeof envelope.signature === "string" && /^[A-Za-z0-9+/]{86}==$/.test(envelope.signature));
    c.check(crypto.verify(null, contracts.signingBytes(a), key.key, Buffer.from(envelope.signature, "base64")));
    return a;
  }
  function accept(envelope) {
    const copy = structuredClone(envelope);
    verifyEnvelope(copy, clock()); freeze(copy);
    const a = copy.attestation;
    accepted.set(a, copy);
    return a;
  }
  function original(a, time) {
    const envelope = accepted.get(a); c.check(envelope);
    verifyEnvelope(envelope, time); return envelope;
  }
  function build({ provider, runtime = null, restore = null, independentRestore = null, initialRestore = null }) {
    const initial = initialRestore || (restore?.evidence.exerciseKind === "INITIAL" ? restore : null);
    const time = clock(), components = [...new Set([provider, runtime, restore, independentRestore, initial].filter(Boolean))];
    c.check(provider?.domain === "provider");
    const envelopes = components.map(a => original(a, time));
    c.check(!runtime || runtime.domain === "runtime");
    c.check(!restore || (restore.domain === "restore" && restore.evidence.exerciseKind !== "INDEPENDENT"));
    c.check(!independentRestore || (independentRestore.domain === "restore" && independentRestore.evidence.exerciseKind === "INDEPENDENT"));
    c.check(!initial || (initial.domain === "restore" && initial.evidence.exerciseKind === "INITIAL"));
    c.check(components.every(a => a.runId === provider.runId));
    // Cross-domain observations must bind the same immutable remote evidence, not merely a bucket.
    for (const drill of [restore, independentRestore, initial].filter(Boolean)) {
      c.check(drill.evidence.inputs.some(row => hashValue(row) === hashValue(provider.evidence.input)));
    }
    if (independentRestore) {
      c.check(restore);
      const left = original(restore, time), right = original(independentRestore, time);
      c.check(left.issuerId !== right.issuerId &&
        keys.get(left.issuerId).fingerprint !== keys.get(right.issuerId).fingerprint &&
        restore.attestationHash !== independentRestore.attestationHash);
    }
    const assessment = restore ? evaluateCoverage(restore.evidence) : { verified: [], missing: [...POLICY.fullCoverage] };
    const independentCoverage = independentRestore ? evaluateCoverage(independentRestore.evidence) : null;
    const reasons = [];
    if (!runtime) reasons.push("RUNTIME_ATTESTATION_REQUIRED");
    if (!restore) reasons.push("INITIAL_OR_WEEKLY_RESTORE_REQUIRED");
    if (!initial) reasons.push("INITIAL_DRILL_REQUIRED");
    if (!independentRestore) reasons.push("INDEPENDENT_EXERCISE_REQUIRED");
    for (const scope of assessment.missing) reasons.push("RESTORE_SCOPE_MISSING:" + scope);
    if (independentCoverage) for (const scope of independentCoverage.missing) reasons.push("INDEPENDENT_SCOPE_MISSING:" + scope);
    const full = reasons.length === 0;
    const expires = Math.min(...components.map(a => Date.parse(a.expiresAt)), Date.parse(provider.evidence.observedRetention.retainUntil));
    const body = {
      qualificationVersion: contracts.VERSIONS.qualification, policyVersion: POLICY.version,
      authorityHash, binding: context, runId: provider.runId,
      providerAttestationHash: provider.attestationHash, runtimeAttestationHash: runtime?.attestationHash || null,
      restoreAttestationHash: restore?.attestationHash || null, independentAttestationHash: independentRestore?.attestationHash || null,
      initialAttestationHash: initial?.attestationHash || null,
      retentionPolicyHash: context.retentionPolicyHash,
      providerState: "S3_MECHANICS_QUALIFIED",
      restoreState: !restore ? "UNQUALIFIED" : assessment.missing.length ? "REMOTE_RESTORE_PARTIAL" : "REMOTE_RESTORE_QUALIFIED",
      state: full ? "QUALIFIED" : "PARTIALLY_QUALIFIED",
      storageState: full ? "FULL_STORAGE_QUALIFIED" : "INCOMPLETE",
      coverage: assessment.verified, missingCoverage: assessment.missing, reasons,
      qualifiedAt: new Date(time).toISOString(), expiresAt: new Date(expires).toISOString(),
      nextWeeklyDrillAt: restore ? new Date(Date.parse(restore.evidence.completedAt) + POLICY.weeklyDrillDueMs).toISOString() : null,
      productionReady: false, automaticCollectionReady: false, productionOffDiskVerified: false
    };
    const record = freeze({ ...body, qualificationHash: hashValue(body) });
    issued.set(record, { envelopes, bodyHash: record.qualificationHash });
    return record;
  }
  function verify(record, currentBinding) {
    try {
      contracts.binding(currentBinding); contracts.equal(currentBinding, context);
      const provenance = issued.get(record); c.check(provenance);
      const { qualificationHash, ...body } = record;
      c.check(hashValue(body) === qualificationHash && qualificationHash === provenance.bodyHash);
      const time = clock(); c.check(time < Date.parse(record.expiresAt));
      provenance.envelopes.forEach(e => verifyEnvelope(e, time));
      return { trusted: true, state: record.state, providerState: record.providerState,
        restoreState: record.restoreState, storageState: record.storageState,
        coverage: [...record.coverage], missingCoverage: [...record.missingCoverage],
        productionReady: false, automaticCollectionReady: false, productionOffDiskVerified: false };
    } catch {
      return { trusted: false, state: "UNQUALIFIED", productionReady: false, automaticCollectionReady: false, productionOffDiskVerified: false };
    }
  }
  return Object.freeze({ accept, build, verify });
}
module.exports = { createQualificationAuthority };
