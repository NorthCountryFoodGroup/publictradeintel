"use strict";
const assert = require("node:assert/strict"), t = require("./fixtures/kronos-operator-evidence");
const guard = require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
(async () => {
  const root = t.temp(); let x, saved, config, requirements;
  try {
    x = t.setup(root); Object.assign(x.research, {modelRevision: "fictional-model-v1", forecastContractVersion: "KRONOS_FORECAST_FIXTURE_V1", researchContractVersion: "KRONOS_RESEARCH_FIXTURE_V1", inputCutoff: "2026-09-20T15:59:59.000Z"});
    const session = await x.session(), review = await x.inspect(session), approval = await x.approve(session, review.reviewHash);
    x.issue(approval); saved = await x.controller.execute("result", {requestId: x.candidate.request.requestId}, session); config = structuredClone(x.config);
    requirements = {expectedDecisionHash: approval.decision.decisionHash, challengeNonce: saved.issuance.view.body.challengeNonce, minimumSequence: saved.issuance.view.body.sequence, expectedDomain: "provider"};
  } finally { x?.close(); t.remove(root); }
  const verifier = require("../kronos/research-qualification-operator-proof").createVerifier({...config, now: () => t.n.f.t.f.time});
  const out = verifier.verify(saved, requirements); assert.equal(out.verified, true); assert.equal(out.context.research.modelRevision, "fictional-model-v1");
  assert.equal(out.context.research.inputCutoff, "2026-09-20T15:59:59.000Z");
  for (const change of [v => { v.decision.decision.context.research.inputCutoff = "2026-09-20T16:00:01.000Z"; },
    v => { v.decision.decision.context.softwareRevision = "changed"; }, v => { v.decision.decision.context.coverage.verified.push("forecast"); },
    v => { v.decision.decision.context.policyRevision = "changed"; }, v => { v.decision.decision.operatorId = "other"; },
    v => { v.decision.signature = "A".repeat(86) + "=="; }, v => { v.decision.approval.approval.nonce = "0".repeat(64); },
    v => { v.issuance.result.receipt.receiptHash = "0".repeat(64); }, v => { v.issuance = null; }]) {
    const changed = structuredClone(saved); change(changed); assert.throws(() => verifier.verify(changed, requirements));
  }
  assert.throws(() => verifier.verify(saved, {...requirements, expectedDecisionHash: "0".repeat(64)}));
  // Existing V1 remains independently usable with the original exact approval artifact.
  require("../kronos/research-qualification-public-proof").createPublicVerifier({...config, now: () => t.n.f.t.f.time}).verify(saved.issuance, requirements);
  const deniedRoot = t.temp(); let denied;
  try { denied = t.setup(deniedRoot); const session = await denied.session(), review = await denied.inspect(session), record = await denied.deny(session, review.reviewHash);
    const proof = {version: "KRONOS_OPERATOR_PUBLIC_PROOF_V1", decision: record, issuance: null};
    const v = require("../kronos/research-qualification-operator-proof").createVerifier({...denied.config, now: () => t.n.f.t.f.time});
    assert.equal(v.verify(proof, {expectedDecisionHash: record.decision.decisionHash}).action, "DENIED");
    assert.throws(() => v.verify({...proof, issuance: saved.issuance}, {expectedDecisionHash: record.decision.decisionHash}));
  } finally { denied?.close(); t.remove(deniedRoot); }
  const f = t.n.f, limited = f.candidate("restore", false), summary = require("../kronos/research-qualification-operator-contracts").summary({request: limited.request, attestation: limited.attestation}, f.t.registry());
  assert.deepEqual(summary.coverage.missing, ["forecast", "correction", "outcome"]); assert.equal(summary.research.modelRevision, null);
  guard.assertClean(); console.log("Public approval/denial verification after deleting source databases, original V1 compatibility, metadata binding, limited coverage and tamper rejection: PASS");
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => guard.restore());
