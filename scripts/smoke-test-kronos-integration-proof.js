"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");
const t = require("./fixtures/kronos-integration-processes");
const publicProof = require("../kronos/research-qualification-public-proof");
const {POLICY} = require("../kronos/research-qualification-policy");
function verifier(config, extra = {}) { return publicProof.createPublicVerifier({binding: config.binding, registryPins: [config.registry.registryHash], witnessIdentity: config.identity, operators: config.operators, vaultId: config.vaultId, retentionConfig: require("./fixtures/kronos-operator-retention-evidence").config({binding: config.binding, registry: config.registry, identity: config.identity, operators: config.operators}), now: () => config.now, ...extra}); }
(async () => {
  let portable, publicConfig;
  {
    const fleet = await new t.Fleet().open();
    try {
      const data = t.candidate(); await fleet.signer.call("issue", {candidate: data}); portable = await fleet.proof(data); publicConfig = structuredClone(fleet.config);
      const verify = verifier(publicConfig); assert.equal(verify.verify(portable.bundle, portable.requirements).verified, true);
      const mutations = [
        x => { x.result.envelope.attestation.evidence.encryption = "wrong"; },
        x => { x.approval.signature = Buffer.alloc(64).toString("base64"); },
        x => { x.result.receipt.signedEnvelopeHash = "a".repeat(64); },
        x => { x.registry.signers[0].publicKey = t.f.t.extraKey.publicKey; x.registry = t.f.t.rehash(x.registry, "registryHash"); },
        x => { x.history[1].ack.signature = Buffer.alloc(64).toString("base64"); },
        x => { x.view.signature = Buffer.alloc(64).toString("base64"); },
        x => { x.history[1].entry.append.events[0].event.data.request.nonce = "b".repeat(64); },
        x => { x.history[1].entry.receipt.sequence++; },
        x => { x.view.body.checkpoint.checkpointHash = "c".repeat(64); },
        x => { x.result.envelope.attestation.binding.softwareRevision = "foreign-software"; },
        x => { x.result.envelope.attestation.binding.qualificationPolicyVersion = "FOREIGN_POLICY"; },
        x => { x.result.envelope.signerId = "runtime"; },
        x => { x.view.body.witnessId = "foreign-witness"; },
        x => { x.history.reverse(); },
        x => { x.history.pop(); },
        x => { x.result.automaticCollectionReady = true; },
        x => { x.result.offDiskVerified = true; },
        x => { x.result.privateKey = "forbidden"; },
        x => { x.Authorization = "forbidden"; }
      ];
      const downgrade = structuredClone(portable.bundle); downgrade.version = "KRONOS_OFFLINE_PUBLIC_PROOF_V1"; delete downgrade.result.operatorRetention; downgrade.result.version = "KRONOS_NATIVE_SIGNER_RESULT_V1"; downgrade.result = t.w.seal(downgrade.result, "resultHash");
      assert.throws(() => verify.verify(t.w.seal(downgrade, "proofHash"), portable.requirements), /RETENTION_REQUIRED/);
      assert.equal(verifier(publicConfig, {allowHistoricalV1: true}).verify(t.w.seal(downgrade, "proofHash"), portable.requirements).operatorRetentionVerified, false);
      for (const mutate of [x => { x.body.decisionHash = "a".repeat(64); }, x => { x.signature = Buffer.alloc(64).toString("base64"); }, x => { x.proof.view.body.challengeNonce = "b".repeat(64); }]) {
        let bad = structuredClone(portable.bundle); mutate(bad.result.operatorRetention); bad.result = t.w.seal(bad.result, "resultHash"); bad = t.w.seal(bad, "proofHash"); assert.throws(() => verify.verify(bad, portable.requirements));
      }
      for (const mutate of mutations) { let bad = structuredClone(portable.bundle); mutate(bad); bad = t.w.seal(bad, "proofHash"); assert.throws(() => verify.verify(bad, portable.requirements)); }
      for (const secret of ["AWS_SECRET_ACCESS_KEY", "SessionToken", "OIDC_TOKEN", "LOGIN_PIN", "ADMIN_PIN", "KRONOS_SERVICE_TOKEN", "cookies", "environment", "databasePath"]) {
        const bad = t.w.seal({...portable.bundle, [secret]: "forbidden"}, "proofHash"); assert.throws(() => verify.verify(bad, portable.requirements));
      }
      assert.throws(() => verify.verify(portable.bundle, {...portable.requirements, challengeNonce: "d".repeat(64)}));
      assert.throws(() => verify.verify(portable.bundle, {...portable.requirements, minimumSequence: 4}));
      assert.throws(() => verify.verify(portable.bundle, {...portable.requirements, expectedDomain: "runtime"}));
      assert.throws(() => verifier({...publicConfig, now: publicConfig.now + 300000}).verify(portable.bundle, portable.requirements));
      assert.throws(() => verifier({...publicConfig, binding: {...publicConfig.binding, softwareRevision: "foreign-software"}}).verify(portable.bundle, portable.requirements));
      const text = JSON.stringify(portable.bundle); assert(!text.includes(fleet.root)); assert(!/PRIVATE KEY|"privateKey"|CREATE TABLE|sqlite_schema/.test(text));
    } finally { const root = fleet.root; await fleet.dispose(); assert(!fs.existsSync(root)); }
  }
  // A fresh child verifies only serialized public material after ALL source databases are deleted.
  {
    const isolated = new t.Fleet(); isolated.config = publicConfig;
    try { const child = await isolated.start("verifier", "verifier"); assert.equal((await child.call("verify", portable)).verified, true); const status = await child.call("status"); assert.deepEqual(status.keyRoles, []); assert.equal(status.network.externalNetworkAttempts, 0); }
    finally { await isolated.dispose(); }
  }
  {
    const fleet = await new t.Fleet().open();
    try {
      const normal = t.candidate("restore"), independent = t.candidate("independent");
      await fleet.signer.call("issue", {candidate: normal});
      const other = await fleet.start("independent", "signer", {clientId: "signer-independent"}); await other.call("issue", {candidate: independent});
      const a = await fleet.proof(normal), b = await fleet.proof(independent, other), v = verifier(fleet.config);
      assert.equal(v.verifyIndependent(a.bundle, b.bundle, a.requirements, b.requirements).verified, true);
      assert.throws(() => v.verifyIndependent(a.bundle, a.bundle, a.requirements, a.requirements));
      const bad = structuredClone(b.bundle); bad.result.envelope.attestation.evidence.actualCounts.forecasts = 0;
      assert.throws(() => v.verify(t.w.seal(bad, "proofHash"), {...b.requirements, requiredCoverage: POLICY.fullCoverage}));
      const limited = t.f.candidate("restore", false); limited.request.requestId += "-limited"; limited.request.nonce = "f".repeat(64); limited.request = t.f.t.rehash(limited.request, "requestHash"); limited.approval = t.f.approved(limited.request, limited.attestation);
      await fleet.signer.call("issue", {candidate: limited}); const partial = await fleet.proof(limited);
      assert.equal(v.verify(partial.bundle, partial.requirements).coverage.missing.length, 3);
      assert.throws(() => v.verify(partial.bundle, {...partial.requirements, requiredCoverage: POLICY.fullCoverage}));
    } finally { await fleet.dispose(); }
  }
  console.log("Public-only verification after source deletion, independent roots/challenge/freshness, all tamper classes, secret exclusion, coverage policy and independent restore separation: PASS");
})().catch(e => { console.error(e); process.exitCode = 1; });
