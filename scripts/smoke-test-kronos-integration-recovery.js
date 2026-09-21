"use strict";
const assert = require("node:assert/strict"), t = require("./fixtures/kronos-integration-processes");
(async () => {
  for (const stage of ["reserved", "pre-sign-witness", "signed", "envelope", "receipt", "completion-intent", "final-witness", "completion"]) {
    const fleet = await new t.Fleet().open();
    try {
      const data = t.candidate(); await fleet.signer.call("crash-at", {stage});
      await assert.rejects(fleet.signer.call("issue", {candidate: data}), /PROCESS_LOST/);
      const signatureCount = fleet.events.filter(x => x.kind === "signature" && x.signatureKind === "attestation").length;
      assert.equal(signatureCount, ["reserved", "pre-sign-witness"].includes(stage) ? 0 : 1);
      await fleet.restart("signer");
      if (["reserved", "pre-sign-witness", "signed"].includes(stage)) {
        await assert.rejects(fleet.signer.call("issue", {candidate: data}), /AMBIGUOUS/);
        await assert.rejects(fleet.signer.call("recover", {candidate: data, operatorRef: "explicit-crash-review"}), /AMBIGUOUS/);
      } else {
        const out = await fleet.signer.call("recover", {candidate: data, operatorRef: "explicit-crash-review"});
        assert.deepEqual(await fleet.signer.call("get", {candidate: data}), out);
        assert.equal((await fleet.vault.call("latest")).sequence, 3);
        const proof = await fleet.proof(data); assert.equal(proof.bundle.history.flatMap(x => x.entry.append.events).filter(x => x.event.kind === "COMPLETED").length, 1);
      }
      assert.equal(fleet.events.filter(x => x.kind === "signature" && x.signatureKind === "attestation").length, signatureCount);
    } finally { await fleet.dispose(); }
  }
  for (const stage of ["local-transaction-committed", "vault-append-accepted", "local-completion-committed", "acknowledgment-generated", "response"]) {
    const fleet = await new t.Fleet().open();
    try {
      const data = t.candidate(); await fleet.witness.call("crash-at", {stage, appendNumber: 3});
      await assert.rejects(fleet.signer.call("issue", {candidate: data}));
      await fleet.restart("witness");
      const state = (await fleet.witness.call("status")).state;
      if (state !== "READY") await fleet.witness.call("recover", {operatorRef: "explicit-vault-reconciliation"});
      assert.equal((await fleet.witness.call("status")).state, "READY");
      await fleet.restart("signer");
      const out = await fleet.signer.call("recover", {candidate: data, operatorRef: "explicit-signer-reconciliation"}); assert(out.resultHash);
      assert.equal((await fleet.vault.call("latest")).sequence, 3);
      assert.equal(fleet.events.filter(x => x.kind === "signature" && x.signatureKind === "attestation").length, 1);
      const proof = await fleet.proof(data); assert.equal(proof.bundle.history.length, 3);
    } finally { await fleet.dispose(); }
  }
  console.log("Eight signer and five witness crash/restart boundaries, independent vault reconciliation, ambiguous reservation refusal and zero second signatures: PASS");
})().catch(e => { console.error(e); process.exitCode = 1; });
