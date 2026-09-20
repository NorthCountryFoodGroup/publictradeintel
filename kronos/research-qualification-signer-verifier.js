"use strict";
// Pinned public metadata only. No private-key, signing, transport, persistence or authorization capability.
const crypto = require("node:crypto");
const s = require("./research-qualification-signer-contracts");
const q = require("./research-qualification-contracts");
function immutable(value) { if (value && typeof value === "object") { Object.values(value).forEach(immutable); Object.freeze(value); } return value; }
function createPinnedVerifier({ registry, registryPin, journal, journalPin, binding, now = Date.now }) {
  q.binding(binding); const context = immutable(structuredClone(binding));
  function pin(r, rp, j, jp) {
    s.registry(r); s.journal(j);
    s.check(r.registryHash === rp.hash && r.registryRevision === rp.revision, "REGISTRY_MISMATCH");
    s.check(j.journalHash === jp.hash && j.revision === jp.revision, "JOURNAL_MISMATCH");
    return {registry:immutable(structuredClone(r)),journal:immutable(structuredClone(j))};
  }
  let trust = pin(registry, registryPin, journal, journalPin);
  function replaceTrust(next) {
    const proposed = pin(next.registry, next.registryPin, next.journal, next.journalPin);
    if (proposed.registry.registryHash !== trust.registry.registryHash) s.rotation(trust.registry, proposed.registry);
    if (proposed.journal.journalHash !== trust.journal.journalHash) s.journalSuccessor(trust.journal, proposed.journal);
    trust = proposed;
  }
  function inspect(e) {
    s.envelope(e); const a = e.attestation, r = e.request, reg = trust.registry, at = now();
    s.check(Number.isFinite(at)); q.equal(a.binding, context);
    s.check(s.time(reg.createdAt) <= at && at < s.time(reg.expiresAt), "REGISTRY_MISMATCH");
    s.check(r.registryId === reg.registryId && r.registryRevision <= reg.registryRevision, "REGISTRY_MISMATCH");
    // Historical request pins are authenticated by the signature AND externally pinned issuance journal.
    if (r.registryRevision === reg.registryRevision) s.check(r.registryHash === reg.registryHash, "REGISTRY_MISMATCH");
    const signer = reg.signers.find(row => row.signerId === e.signerId);
    s.check(signer, "SIGNER_UNAUTHORIZED"); s.check(signer.allowedServiceIdentities.includes(r.serviceIdentity), "SIGNER_UNAUTHORIZED"); s.permitted(signer, a);
    s.active(signer, s.time(e.signedAt), true);
    s.check(s.time(e.signedAt) <= at, "SIGNATURE_INVALID"); s.freshAttestation(a, at);
    s.check(e.keyFingerprint === signer.keyFingerprint, "SIGNATURE_INVALID");
    const key = s.publicKey(signer.publicKey);
    s.check(crypto.verify(null, q.signingBytes(a), key, Buffer.from(e.signature,"base64")), "SIGNATURE_INVALID");
    const {contextSignature,envelopeHash,...body} = e;
    s.check(crypto.verify(null, s.envelopeBytes(body), key, Buffer.from(contextSignature,"base64")), "SIGNATURE_INVALID");
    const j = trust.journal;
    s.check(s.time(j.createdAt) <= at && at < s.time(j.expiresAt), "JOURNAL_MISMATCH");
    const receipt = j.entries.find(row => row.requestId === r.requestId)?.receipt;
    s.check(receipt && receipt.result === "ISSUED" && receipt.signedEnvelopeHash === e.envelopeHash &&
      receipt.requestHash === r.requestHash && receipt.nonce === r.nonce &&
      receipt.attestationHash === a.attestationHash && receipt.evidenceHash === a.evidenceHash &&
      receipt.attestationType === a.attestationType && receipt.signerId === signer.signerId &&
      receipt.keyFingerprint === signer.keyFingerprint && receipt.issuedAt === e.signedAt, "JOURNAL_MISMATCH");
    return signer;
  }
  function verify(envelope) {
    try {
      const signer = inspect(envelope);
      return Object.freeze({trusted:true,signerId:signer.signerId,keyFingerprint:signer.keyFingerprint,
        domain:signer.domain,registryRevision:trust.registry.registryRevision,
        productionReady:false,automaticCollectionReady:false,productionOffDiskVerified:false});
    } catch(error) {
      return Object.freeze({trusted:false,reason:s.normalized(error),
        productionReady:false,automaticCollectionReady:false,productionOffDiskVerified:false});
    }
  }
  function verifyIndependent(normal, independent) {
    try {
      const a = inspect(normal), b = inspect(independent);
      s.check(a.domain === "restore" && b.domain === "independent-restore" &&
        a.signerId !== b.signerId && a.issuer !== b.issuer && a.keyFingerprint !== b.keyFingerprint, "DOMAIN_NOT_ALLOWED");
      s.check(normal.attestation.runId === independent.attestation.runId, "EVIDENCE_INVALID");
      return Object.freeze({trusted:true,productionReady:false,automaticCollectionReady:false,productionOffDiskVerified:false});
    } catch(error) { return Object.freeze({trusted:false,reason:s.normalized(error)}); }
  }
  return Object.freeze({verify,verifyIndependent,replaceTrust});
}
module.exports = { createPinnedVerifier };
