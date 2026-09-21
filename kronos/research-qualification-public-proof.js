"use strict";
// Verifies public material only. Trust roots and freshness challenges are supplied independently.
const w = require("./research-qualification-witness-contracts");
const state = require("./research-qualification-witness-state");
const p = require("./research-qualification-preflight-contracts");
const s = require("./research-qualification-signer-contracts");
const q = require("./research-qualification-contracts");
const c = require("./research-backup-contracts");
const {POLICY, evaluateCoverage} = require("./research-qualification-policy");
const VERSION = "KRONOS_OFFLINE_PUBLIC_PROOF_V1";
const equal = (a, b) => w.check(w.canonicalize(a) === w.canonicalize(b), "PUBLIC_PROOF_BINDING");
function buildProofBundle({result, approval, registry, history, view}) {
  return w.seal({version: VERSION, result: structuredClone(result), approval: structuredClone(approval), registry: structuredClone(registry), history: structuredClone(history), view: structuredClone(view)}, "proofHash");
}
function createPublicVerifier(options) {
  const identity = structuredClone(w.identity(options.witnessIdentity)), binding = structuredClone(q.binding(options.binding));
  const registryPins = [...options.registryPins], operators = structuredClone(options.operators), vaultId = options.vaultId;
  const now = options.now || Date.now;
  const operatorAuthority = p.createOperatorAuthority({operators, binding}), witness = w.createVerifier({identity, vaultId});
  function verify(bundle, {challengeNonce, minimumSequence, expectedDomain, requiredCoverage = []}) {
    c.shape(bundle, "version,result,approval,registry,history,view,proofHash");
    w.check(bundle.version === VERSION, "PUBLIC_PROOF_VERSION"); w.hashed(bundle, "proofHash");
    c.digest(challengeNonce); w.positive(minimumSequence);
    w.check(["provider", "runtime", "restore", "independent-restore"].includes(expectedDomain), "PUBLIC_PROOF_DOMAIN");
    w.check(Array.isArray(requiredCoverage) && requiredCoverage.every(v => POLICY.fullCoverage.includes(v)), "PUBLIC_PROOF_COVERAGE");
    const r = bundle.result;
    c.shape(r, "version,envelope,receipt,approvalHash,preSignAcknowledgment,completionAcknowledgment,simulated,automaticCollectionReady,offDiskVerified,resultHash");
    w.check(r.version === "KRONOS_NATIVE_SIGNER_RESULT_V1" && r.simulated === true && r.automaticCollectionReady === false && r.offDiskVerified === false, "PUBLIC_PROOF_READINESS"); w.hashed(r, "resultHash");
    s.registry(bundle.registry); w.check(registryPins.includes(bundle.registry.registryHash), "PUBLIC_PROOF_REGISTRY");
    operatorAuthority.assertIndependent(bundle.registry);
    w.check(bundle.registry.signers.every(k => k.keyFingerprint !== identity.keyFingerprint), "PUBLIC_PROOF_KEY_SEPARATION");
    operatorAuthority.assertIndependent({signers: [{keyFingerprint: identity.keyFingerprint}]});
    w.check(Array.isArray(bundle.history) && bundle.history.length > 0 && bundle.history.length <= 10000 && Buffer.byteLength(w.canonicalize(bundle)) <= 16 * 1024 * 1024, "PUBLIC_PROOF_LIMIT");
    let previous = null;
    for (const item of bundle.history) {
      c.shape(item, "entry,ack"); witness.acknowledgment(item.ack, item.entry);
      w.check(item.ack.body.vaultReceipt.previousHash === previous, "PUBLIC_PROOF_VAULT_CHAIN"); previous = item.ack.body.vaultReceipt.receiptHash;
    }
    const model = state.replay(bundle.history.map(x => x.entry), {identity, binding, registryPins, operatorAuthority});
    equal(model.registry, bundle.registry);
    const a = r.envelope.attestation, request = r.envelope.request;
    s.request(request, a); equal(a.binding, binding);
    w.check(s.role(a) === expectedDomain, "PUBLIC_PROOF_DOMAIN");
    const record = model.requests.get(request.requestId);
    w.check(record?.state === "COMPLETED", "PUBLIC_PROOF_INCOMPLETE");
    equal(record.request, request); equal(record.attestation, a); equal(record.envelope, r.envelope); equal(record.receipt, r.receipt); equal(record.approval, bundle.approval);
    w.check(r.approvalHash === bundle.approval.approval.approvalHash, "PUBLIC_PROOF_APPROVAL");
    p.verifyEnvelope(r.envelope, request, a, bundle.registry, now()); equal(r.receipt, p.receipt(r.envelope));
    const pre = bundle.history.find(x => x.entry.receipt.receiptHash === r.preSignAcknowledgment.body.receipt.receiptHash);
    const final = bundle.history.find(x => x.entry.receipt.receiptHash === r.completionAcknowledgment.body.receipt.receiptHash);
    w.check(pre && final && pre.entry.receipt.sequence < final.entry.receipt.sequence, "PUBLIC_PROOF_ORDER");
    equal(pre.ack, r.preSignAcknowledgment); equal(final.ack, r.completionAcknowledgment);
    const reserved = pre.entry.append.events.at(-1), completed = final.entry.append.events.at(-1);
    w.check(reserved.event.kind === "RESERVED" && reserved.event.requestId === request.requestId && completed.event.kind === "COMPLETED" && completed.event.requestId === request.requestId, "PUBLIC_PROOF_ORDER");
    equal(reserved.event.data, {request, attestation: a, approval: bundle.approval});
    equal(completed.event.data, {envelopeHash: r.envelope.envelopeHash, receiptHash: r.receipt.receiptHash});
    witness.freshView(bundle.view, {storeId: record.storeId, challengeNonce, now: now(), minimumSequence, expectedReceiptHash: model.receiptHash});
    equal(bundle.view.body.checkpoint, model.lanes.get(record.storeId).checkpoint);
    w.check(bundle.view.body.sequence === model.sequence && bundle.view.body.registryHash === bundle.registry.registryHash && bundle.view.body.registryRevision === bundle.registry.registryRevision, "PUBLIC_PROOF_VIEW");
    const coverage = a.domain === "restore" ? evaluateCoverage(a.evidence) : {verified: [], missing: []};
    w.check(requiredCoverage.every(v => coverage.verified.includes(v)), "PUBLIC_PROOF_COVERAGE");
    const signer = bundle.registry.signers.find(k => k.signerId === r.envelope.signerId);
    return Object.freeze({verified: true, domain: expectedDomain, signerId: signer.signerId, issuer: signer.issuer, keyFingerprint: signer.keyFingerprint,
      runId: a.runId, proofHash: bundle.proofHash, resultHash: r.resultHash, sequence: model.sequence, coverage,
      productionReady: false, automaticCollectionReady: false, offDiskVerified: false});
  }
  function verifyIndependent(normal, independent, normalOptions, independentOptions) {
    const a = verify(normal, {...normalOptions, expectedDomain: "restore", requiredCoverage: POLICY.fullCoverage});
    const b = verify(independent, {...independentOptions, expectedDomain: "independent-restore", requiredCoverage: POLICY.fullCoverage});
    w.check(a.signerId !== b.signerId && a.keyFingerprint !== b.keyFingerprint && a.issuer !== b.issuer && a.runId === b.runId, "PUBLIC_PROOF_INDEPENDENCE");
    return Object.freeze({verified: true, productionReady: false, automaticCollectionReady: false, offDiskVerified: false});
  }
  return Object.freeze({verify, verifyIndependent});
}
module.exports = {VERSION, buildProofBundle, createPublicVerifier};
