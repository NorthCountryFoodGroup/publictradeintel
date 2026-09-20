"use strict";
const networkGuard = require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
const assert = require("node:assert/strict"), crypto = require("node:crypto");
const t = require("./fixtures/kronos-native-evidence");
let maximum = 0;
for (const [kind, profile] of [["provider", "typical"], ["provider", "maximum"], ["full-restore", "typical"], ["full-restore", "maximum"], ["full-restore", "worst"], ["runtime", "typical"], ["independent-restore", "typical"]]) {
  const root = t.temp(), fixture = t.setup({kind, profile}); let x;
  try {
    x = t.open(root, {fixture});
    const out = x.signer.issue(fixture.data), bytes = t.f.t.f.contracts.signingBytes(fixture.data.attestation);
    maximum = Math.max(maximum, bytes.length);
    assert(crypto.verify(null, bytes, t.f.t.s.publicKey(fixture.registry.signers.find(k => k.signerId === fixture.data.request.signerId).publicKey), Buffer.from(out.envelope.signature, "base64")));
    assert.equal(x.keys.metrics().signCalls, 2); assert.deepEqual(x.keys.metrics().messageBytes, [bytes.length]);
    assert.equal(x.keys.sign, undefined); assert.equal(x.signer.sign, undefined);
    assert.equal(x.keys.export, undefined); assert(!JSON.stringify(x.keys.publicIdentities()).includes("privateKey"));
    assert.equal(out.simulated, true); assert.equal(out.offDiskVerified, false);
    assert.deepEqual(x.signer.get(fixture.data), out); assert.deepEqual(x.signer.issue(fixture.data), out);
    assert.equal(x.keys.metrics().signCalls, 2);
    x.close(); x = t.open(root, {fixture, mode: "open-existing"});
    assert.deepEqual(x.signer.get(fixture.data), out); assert.equal(x.keys.metrics().signCalls, 0);
  } finally { if (x) x.close(); t.remove(root); }
}
assert(maximum >= 95793);
for (const mutate of [rows => { rows[0].privateKey = "not-private-material"; }, rows => { rows[0].privateKey = t.f.t.f.keys.runtime.privateKey; }, rows => { rows[0].keyFingerprint = "a".repeat(64); }, rows => { rows[3].issuer = rows[0].issuer; }]) {
  const rows = t.keyRows(); mutate(rows); assert.throws(() => t.native.createFixtureKeyProvider({testOnly: true, keys: rows}));
}
console.log(`Native key abstraction, four domains, exact Ed25519 bytes through ${maximum}, reopen/idempotency: PASS`);

networkGuard.assertClean(); networkGuard.restore();
