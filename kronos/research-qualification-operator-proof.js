"use strict";
const w = require("./research-qualification-witness-contracts"), c = require("./research-backup-contracts");
const contracts = require("./research-qualification-operator-contracts"), original = require("./research-qualification-public-proof");
function createVerifier(options) {
  const verifier = original.createPublicVerifier(options);
  return Object.freeze({verify(proof, requirements) {
    c.shape(proof, "version,decision,issuance"); w.check(proof.version === "KRONOS_OPERATOR_PUBLIC_PROOF_V1", "OPERATOR_PROOF_VERSION");
    const out = contracts.verifyDecision(proof.decision, options, requirements.expectedDecisionHash);
    if (out.action === "DENIED") w.check(proof.issuance === null, "OPERATOR_DENIED");
    else {
      w.check(proof.issuance, "OPERATOR_RESULT_INCOMPLETE");
      contracts.equal(proof.issuance.approval, proof.decision.approval);
      contracts.equal(proof.issuance.result.envelope.request, proof.decision.candidate.request);
      contracts.equal(proof.issuance.result.envelope.attestation, proof.decision.candidate.attestation);
      verifier.verify(proof.issuance, requirements);
    }
    return out;
  }});
}
module.exports = {createVerifier};
