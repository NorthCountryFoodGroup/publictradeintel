"use strict";
const networkGuard = require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
const assert = require("node:assert/strict");
const t = require("./fixtures/kronos-native-evidence"), w = t.t.w;
for (const fault of ["unavailable", "stale", "future", "key", "epoch", "store", "challenge", "checkpoint", "fork", "rollback", "vault", "final"]) {
  const root = t.temp(), fixture = t.setup(); let x, active = false, appends = 0, snapshot;
  try {
    x = t.open(root, {fixture, wrap(adapter) { return {
      history() { const rows = adapter.history(); if (!active) snapshot = rows; if (active && fault === "rollback") return snapshot; return rows; },
      append(input) { appends++; if (active && (fault === "vault" || (fault === "final" && appends === 3))) throw Error("injected-publication-failure");
        const ack = adapter.append(input); if (active && fault === "fork") ack.body.receipt.previousReceiptHash = "f".repeat(64); return ack; },
      view(input) {
        if (active && fault === "unavailable") throw Error("injected-unavailable");
        const signed = adapter.view(input); if (!active || ["vault", "final", "fork", "rollback"].includes(fault)) return signed;
        const v = signed.body;
        if (fault === "stale") { v.issuedAt = t.f.t.iso(t.f.t.f.time - 300000); v.expiresAt = t.f.t.f.instant; }
        if (fault === "future") { v.issuedAt = t.f.t.iso(t.f.t.f.time + 1); v.expiresAt = t.f.t.iso(t.f.t.f.time + 300001); }
        if (fault === "epoch") v.witnessEpoch++;
        if (fault === "store") v.storeId = "independent-store";
        if (fault === "challenge") v.challengeNonce = "a".repeat(64);
        if (fault === "checkpoint") v.checkpoint.journalHash = "b".repeat(64);
        signed.signature = fault === "key" ? Buffer.alloc(64).toString("base64") : fixture.cfg.signWitness(w.signedBytes(v)); return signed;
      }
    }; }});
    active = true;
    assert.throws(() => x.signer.issue(fixture.data), fault);
    assert.equal(x.keys.metrics().signCalls, fault === "final" ? 3 : 0, fault);
    assert.throws(() => x.signer.get(fixture.data));
  } finally { if (x) x.close(); t.remove(root); }
}
console.log("Native witness availability, lease, pinned key/epoch/store/challenge/checkpoint, fork/rollback, vault and final-ack refusal: PASS");

networkGuard.assertClean(); networkGuard.restore();
