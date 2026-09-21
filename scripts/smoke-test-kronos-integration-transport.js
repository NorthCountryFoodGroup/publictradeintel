"use strict";
const assert = require("node:assert/strict"), t = require("./fixtures/kronos-integration-processes");
(async () => {
  for (const scenario of ["duplicate", "lost-reservation-response", "lost-final-response", "delay", "lost-request", "partition-before-ack", "partition-after-commit", "partition-after-signature", "partition-before-final-ack"]) {
    const fleet = await new t.Fleet().open(); let used = false, partitioned = false;
    try {
      const data = t.candidate();
      fleet.onEvent = (worker, message) => { if (scenario === "partition-after-signature" && worker.role === "signer" && message.stage === "signed") partitioned = true; };
      fleet.fault = async (message, deliver) => {
        if (message.from.role !== "signer") return deliver();
        if (partitioned) return t.unavailable();
        const operation = message.payload?.request?.body?.operation;
        const append = operation === "append" ? message.payload.request.body.payload : null;
        const final = append?.events.some(x => x.event.kind === "COMPLETED");
        if (scenario === "delay") { await new Promise(r => setTimeout(r, 10)); return deliver(); }
        if (append && scenario === "duplicate") { const a = await deliver(), b = await deliver(); assert.deepEqual(a, b); return b; }
        if (append && !used && ((scenario === "lost-reservation-response" && !final) || (scenario === "lost-final-response" && final))) {
          used = true; await deliver(); return t.unavailable("IPC_LOST_RESPONSE");
        }
        if (append && !used && ["lost-request", "partition-before-ack"].includes(scenario)) { used = true; partitioned = scenario === "partition-before-ack"; return t.unavailable(); }
        if (append && scenario === "partition-after-commit" && !used) { used = true; await deliver(); partitioned = true; return t.unavailable("IPC_LOST_RESPONSE"); }
        if (final && scenario === "partition-before-final-ack" && !used) { used = true; await deliver(); partitioned = true; return t.unavailable("IPC_LOST_RESPONSE"); }
        return deliver();
      };
      if (["duplicate", "lost-reservation-response", "lost-final-response", "delay"].includes(scenario)) {
        const a = await fleet.signer.call("issue", {candidate: data}), b = await fleet.signer.call("issue", {candidate: data}); assert.deepEqual(a, b);
        assert.equal((await fleet.vault.call("latest")).sequence, 3);
        const proof = await fleet.proof(data);
        for (const kind of ["RESERVED", "ENVELOPE", "RECEIPT", "COMPLETED"]) assert.equal(proof.bundle.history.flatMap(x => x.entry.append.events).filter(x => x.event.kind === kind).length, 1);
        assert.equal(fleet.events.filter(x => x.kind === "signature" && x.signatureKind === "attestation").length, 1);
      } else {
        await assert.rejects(fleet.signer.call("issue", {candidate: data}));
        await assert.rejects(fleet.signer.call("get", {candidate: data}));
        const count = fleet.events.filter(x => x.kind === "signature" && x.signatureKind === "attestation").length;
        fleet.fault = null; fleet.onEvent = null;
        if (["partition-after-signature", "partition-before-final-ack"].includes(scenario)) {
          const out = await fleet.signer.call("recover", {candidate: data, operatorRef: "explicit-partition-recovery"}); assert(out.resultHash);
          assert.equal((await fleet.vault.call("latest")).sequence, 3); assert.equal(count, 1);
        } else {
          await assert.rejects(fleet.signer.call("recover", {candidate: data, operatorRef: "explicit-review"}), /AMBIGUOUS/); assert.equal(count, 0);
        }
        assert.equal(fleet.events.filter(x => x.kind === "signature" && x.signatureKind === "attestation").length, count);
      }
    } finally { await fleet.dispose(); }
  }
  {
    const fleet = await new t.Fleet().open();
    try {
      await assert.rejects(fleet.witness.call("append", {}), /COMMAND_DENIED/);
      for (const command of ["init", "clock", "crash-at", "recover", "close", "append"]) await assert.rejects(fleet.route(fleet.signer, {to: "witness", command, payload: {}}), /ROUTE_DENIED/);
      await assert.rejects(fleet.route(fleet.signer, {to: "vault", command: "append", payload: {}}), /ROUTE_DENIED/);
      const packet = await fleet.packet("history", {});
      for (const mutate of [x => { x.request.signature = Buffer.alloc(64).toString("base64"); }, x => { x.challenge.signature = Buffer.alloc(64).toString("base64"); }, x => { x.request.body.signerId = "unknown"; }, x => { x.request.body.witnessId = "foreign"; }, x => { x.request.body.writerEpoch++; }, x => { x.request.body.storeId = "independent-store"; }, x => { x.request.body.challengeHash = "a".repeat(64); }, x => { x.request.body.requestHash = "b".repeat(64); }, x => { x.request.body.payload.secret = "forbidden"; }]) {
        const bad = structuredClone(packet); mutate(bad); await assert.rejects(fleet.witness.call("authenticated", bad));
      }
      const a = await fleet.packet("history", {}), b = await fleet.packet("view", {storeId: "ordinary-store", challengeNonce: "c".repeat(64)});
      // Reverse independent operations, then prove responses cannot be reassigned.
      const rb = await fleet.witness.call("authenticated", b), ra = await fleet.witness.call("authenticated", a);
      assert(t.ipc.verifyResponse(rb, b, fleet.config.identity)); assert(t.ipc.verifyResponse(ra, a, fleet.config.identity));
      assert.throws(() => t.ipc.verifyResponse(rb, a, fleet.config.identity));
      await fleet.witness.call("clock", {now: fleet.config.now + 300000});
      await assert.rejects(fleet.witness.call("authenticated", packet), /EXPIRED/);
      assert.equal((await fleet.vault.call("latest")).sequence, 1);
    } finally { await fleet.dispose(); }
  }
  console.log("Authenticated identities/epochs/challenges/request binding, duplicate/lost/delayed/reordered IPC, partitions and exact lost-response reconciliation without re-signing: PASS");
})().catch(e => { console.error(e); process.exitCode = 1; });
