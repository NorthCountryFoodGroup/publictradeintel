"use strict";
const networkGuard = require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
const assert = require("node:assert/strict"), cp = require("node:child_process"), path = require("node:path"), fs = require("node:fs");
const t = require("./fixtures/kronos-native-evidence");
for (const stage of ["validated", "reserved", "pre-sign-witness", "before-sign", "signed", "envelope", "receipt", "completion-intent", "final-witness", "completion", "returned"]) {
  const root = t.temp(); let x;
  try {
    const child = cp.spawnSync(process.execPath, [path.join(__dirname, "fixtures/kronos-native-crash-child.js"), root, stage], {encoding: "utf8", timeout: 30000});
    assert.equal(child.status, 73, stage + child.stderr);
    assert.throws(() => t.open(root, {mode: "open-existing"}), /WRITER_OWNED/);
    t.recoverLocks(root); x = t.open(root, {mode: "open-existing"}); const data = x.fixture.data;
    if (["reserved", "pre-sign-witness", "before-sign", "signed"].includes(stage)) {
      assert.equal(x.signer.status(data.request.requestId).state, "RESERVED");
      assert.throws(() => x.signer.issue(data), /AMBIGUOUS/);
      assert.throws(() => x.signer.recover(data, {operatorRef: "reviewed-fixture"}), /AMBIGUOUS/);
      assert.equal(x.keys.metrics().signCalls, 0);
    } else if (stage === "validated") {
      assert.equal(x.signer.status(data.request.requestId).state, "ABSENT"); x.signer.issue(data);
    } else {
      const before = x.vault.latest().sequence;
      const out = x.signer.recover(data, {operatorRef: "reviewed-fixture"});
      assert.equal(x.keys.metrics().signCalls, 0); assert.deepEqual(x.signer.get(data), out);
      const after = x.vault.latest().sequence;
      assert(after === before || after === before + 1);
      assert.deepEqual(x.signer.recover(data, {operatorRef: "reviewed-again"}), out);
      assert.equal(x.vault.latest().sequence, after);
      for (const field of ["request", "attestation", "approval"]) { const bad = structuredClone(data); bad[field].unexpected = true; assert.throws(() => x.signer.get(bad)); }
    }
    // Public databases contain no serialized fixture private keys or secret field names.
    for (const name of ["signer.sqlite", "signer.sqlite.control.sqlite", "witness.sqlite", "vault.sqlite"]) {
      const bytes = fs.readFileSync(path.join(root, name));
      assert(!bytes.includes(Buffer.from("PRIVATE KEY"))); assert(!bytes.includes(Buffer.from('"privateKey"')));
      for (const key of Object.values(t.f.t.f.keys)) assert(!bytes.includes(key.privateKey.export({format: "der", type: "pkcs8"})));
    }
  } finally { if (x) x.close(); t.recoverLocks(root); t.remove(root); }
}
console.log("Native eleven fresh-process crash boundaries, explicit dead-owner recovery, no ambiguous re-sign, exact completion/retrieval and private-material exclusion: PASS");

networkGuard.assertClean(); networkGuard.restore();
