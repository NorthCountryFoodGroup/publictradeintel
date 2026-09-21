"use strict";
const assert = require("node:assert/strict"), t = require("./fixtures/kronos-integration-processes");
(async () => {
  const fleet = await new t.Fleet().open();
  try {
    const data = t.candidate(), out = await fleet.signer.call("issue", {candidate: data});
    assert.deepEqual(await fleet.signer.call("get", {candidate: data}), out);
    const status = await Promise.all([fleet.signer.call("status"), fleet.witness.call("status"), fleet.vault.call("status")]);
    assert.equal(new Set(status.map(x => x.pid)).size, 3); assert(status.every(x => x.pid !== process.pid));
    assert.deepEqual(status[1].keyRoles, ["witness"]); assert.deepEqual(status[2].keyRoles, []); assert(!status[0].keyRoles.includes("witness"));
    assert.equal(fleet.events.filter(x => x.kind === "signature" && x.signatureKind === "attestation").length, 1);
    assert.equal(fleet.events.filter(x => x.kind === "signature" && x.signatureKind === "context").length, 1);
    const stages = fleet.events.filter(x => x.role === "signer" && x.kind === "stage").map(x => x.stage);
    assert.deepEqual(stages, ["validated", "reserved", "pre-sign-witness", "before-sign", "signed", "envelope", "receipt", "completion-intent", "final-witness", "completion", "returned"]);
    const proof = await fleet.proof(data), verifier = await fleet.start("verifier", "verifier");
    assert.equal((await verifier.call("verify", proof)).verified, true);
    assert.equal((await fleet.vault.call("latest")).sequence, 3);
    const events = proof.bundle.history.flatMap(x => x.entry.append.events);
    for (const kind of ["RESERVED", "ENVELOPE", "RECEIPT", "COMPLETED"]) assert.equal(events.filter(x => x.event.kind === kind).length, 1);
    assert.equal(proof.bundle.result.offDiskVerified, false);
    console.log("Separate signer/witness/vault PIDs, independent stores/keys, complete issuance order, one signature pair, exact result and standalone public verification: PASS");
  } finally { await fleet.dispose(); }
  const large = require("./fixtures/kronos-native-evidence").setup({kind: "full-restore", profile: "worst"});
  const config = t.config(); config.binding = large.cfg.binding; config.registry = large.registry;
  config.identity.streamId = large.cfg.identity.streamId; config.operators = [{...t.f.operator, streamIds: [config.binding.streamId]}];
  const stress = await new t.Fleet(config).open();
  try {
    const out = await stress.signer.call("issue", {candidate: large.data});
    assert.equal(t.f.t.f.contracts.signingBytes(out.envelope.attestation).length, 95793);
    const proof = await stress.proof(large.data), verifier = await stress.start("verifier", "verifier");
    assert.equal((await verifier.call("verify", proof)).verified, true);
    console.log("Separate-process UTF-8 framing and public proof for exact 95,793-byte Ed25519 input: PASS");
  } finally { await stress.dispose(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
