"use strict";
const assert = require("node:assert/strict"), t = require("./fixtures/kronos-integration-processes");
(async () => {
  for (const rollback of ["signer", "witness", "both"]) {
    const fleet = await new t.Fleet().open();
    try {
      const signerOld = fleet.capture("signer"), witnessOld = fleet.capture("witness"), data = t.candidate();
      await fleet.signer.call("issue", {candidate: data}); assert.equal((await fleet.vault.call("latest")).sequence, 3);
      await fleet.signer.close(); await fleet.witness.close();
      if (rollback !== "witness") fleet.restore("signer", signerOld);
      if (rollback !== "signer") fleet.restore("witness", witnessOld);
      await fleet.start("witness", "witness", {mode: "open-existing"});
      if (rollback !== "signer") assert.equal((await fleet.witness.call("status")).state, "ROLLBACK_DETECTED");
      await assert.rejects(fleet.start("signer", "signer", {mode: "open-existing"}));
      assert.equal((await fleet.vault.call("latest")).sequence, 3);
    } finally { await fleet.dispose(); }
  }
  {
    const fleet = await new t.Fleet().open(); let releaseFirst, releaseSecond;
    try {
      const snapshot = fleet.capture("signer"); fleet.restore("competing", snapshot);
      const other = await fleet.start("competing", "signer", {mode: "open-existing"});
      let firstHeld, secondHeld; const held1 = new Promise(r => { firstHeld = r; }), held2 = new Promise(r => { secondHeld = r; });
      let held = 0;
      fleet.fault = (message, deliver) => {
        const body = message.payload?.request?.body;
        if (message.from.role === "signer" && body?.operation === "append" && body.payload.events.some(x => x.event.kind === "RESERVED") && held < 2) {
          return new Promise((resolve, reject) => { const release = () => deliver().then(resolve, reject); if (++held === 1) { releaseFirst = release; firstHeld(); } else { releaseSecond = release; secondHeld(); } });
        }
        return deliver();
      };
      const a = t.candidate("provider", "branch-a"), b = t.candidate("provider", "branch-b");
      const winner = fleet.signer.call("issue", {candidate: a}); await held1;
      const loser = other.call("issue", {candidate: b}); const rejection = assert.rejects(loser); await held2;
      releaseFirst(); releaseFirst = null; const result = await winner; releaseSecond(); releaseSecond = null; await rejection;
      fleet.fault = null; await fleet.restart("witness");
      await assert.rejects(other.call("issue", {candidate: b}));
      assert.deepEqual(await fleet.signer.call("get", {candidate: a}), result);
      assert.equal((await fleet.vault.call("latest")).sequence, 3);
      assert.equal(fleet.events.filter(x => x.kind === "signature" && x.signatureKind === "attestation").length, 1);
      assert.equal(fleet.events.filter(x => x.kind === "signature" && x.worker === "competing").length, 0);
    } finally { if (releaseFirst) releaseFirst(); if (releaseSecond) releaseSecond(); await fleet.dispose(); }
  }
  {
    const fleet = await new t.Fleet().open();
    try {
      await fleet.signer.call("issue", {candidate: t.candidate()});
      await assert.rejects(fleet.start("premature", "signer", {clientId: "signer-two"}), /OLD_WRITER/);
      const body = {version: t.ipc.V.epoch, operatorId: fleet.config.operators[0].operatorId, identityHash: t.w.hashValue(fleet.config.identity), witnessId: fleet.config.identity.witnessId, witnessEpoch: fleet.config.identity.epoch,
        fromStore: "ordinary-store", fromEpoch: 1, toStore: "ordinary-store-next", toEpoch: 2, nonce: "e".repeat(64), issuedAt: t.f.t.f.instant, expiresAt: t.f.t.iso(fleet.config.now + 300000)};
      const transition = t.signed(body, t.f.t.extraKey.privateKey);
      const wrong = structuredClone(transition); wrong.signature = Buffer.alloc(64).toString("base64"); await assert.rejects(fleet.vault.call("transition", wrong));
      await fleet.vault.call("transition", transition); await assert.rejects(fleet.vault.call("transition", transition));
      await assert.rejects(fleet.signer.call("issue", {candidate: t.candidate("provider", "old-writer")}), /OLD_WRITER/);
      const next = await fleet.start("next", "signer", {clientId: "signer-two"});
      const out = await next.call("issue", {candidate: t.candidate("provider", "new-writer")}); assert(out.resultHash);
      await fleet.restart("vault");
      await fleet.restart("witness");
      await assert.rejects(fleet.restart("signer"), /OLD_WRITER/);
      await assert.rejects(fleet.witness.call("challenge", {signerId: "signer-one", requestHash: "a".repeat(64)}), /OLD_WRITER/);
      const proof = await fleet.proof(t.candidate("provider", "new-writer"), next);
      assert.equal(proof.bundle.view.body.writerEpoch, 2); assert.equal(proof.bundle.view.body.storeId, "ordinary-store-next");
    } finally { await fleet.dispose(); }
  }
  console.log("Signer, witness and mutually consistent dual rollback detected by retained vault; same-predecessor fork accepts one; explicit authorized epoch transition fences old writer across restart: PASS");
})().catch(e => { console.error(e); process.exitCode = 1; });
