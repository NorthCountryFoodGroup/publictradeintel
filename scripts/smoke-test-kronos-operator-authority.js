"use strict";
const assert = require("node:assert/strict"), t = require("./fixtures/kronos-operator-evidence"), crypto = require("node:crypto");
const guard = require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
(async () => {
  const root = t.temp(); let x;
  try {
    x = t.setup(root); const session = await x.session();
    await assert.rejects(x.provider.authenticate({LOGIN_PIN: "fixture-not-authority", ADMIN_PIN: "fixture-not-authority"}));
    await assert.rejects(x.controller.execute("pending", {}, {operatorId: "offline-operator"}));
    assert.equal(x.provider.signApproval, undefined); assert.equal(x.provider.privateKey, undefined);
    const review = await x.inspect(session), record = await x.approve(session, review.reviewHash);
    const altered = structuredClone(record); altered.approval.approval.requestId = "other-request";
    assert.throws(() => require("../kronos/research-qualification-operator-contracts").verifyDecision(altered, x.config, record.decision.decisionHash));
    for (const row of x.fixture.registry.signers) {
      const fakeIdentity = {...x.config.operators[0], publicKey: row.publicKey, keyFingerprint: row.keyFingerprint};
      const provider = t.control.createFixtureAuthProvider({testOnly: true, identity: fakeIdentity, privateKey: t.n.f.t.f.keys[row.signerId].privateKey, now: () => t.n.f.t.f.time});
      assert.throws(() => t.control.createController({retention: {current: x.source.retentionCurrent, retain: x.source.retentionRetain}, store: x.store, source: x.source, provider, config: x.config, confirm: async v => v.phrase, now: () => t.n.f.t.f.time})); provider.close();
    }
    // Even a caller changing both its provider and operator configuration cannot reuse another role key.
    for (const row of [...x.fixture.registry.signers, x.config.witnessIdentity]) {
      const identity = {...x.config.operators[0], publicKey: row.publicKey, keyFingerprint: row.keyFingerprint};
      const provider = t.control.createAuthProvider({identity, now: () => t.n.f.t.f.time, authenticate: async () => true, signApproval: () => { throw Error("MUST_NOT_SIGN"); }, signDecision: () => { throw Error("MUST_NOT_SIGN"); }});
      const config = {...x.config, operators: [identity]};
      if (row.keyFingerprint === x.config.witnessIdentity.keyFingerprint) assert.throws(() => t.control.createController({retention: {current: x.source.retentionCurrent, retain: x.source.retentionRetain}, store: x.store, source: x.source, provider, config, confirm: async v => v.phrase, now: () => t.n.f.t.f.time}));
      else { const controller = t.control.createController({retention: {current: x.source.retentionCurrent, retain: x.source.retentionRetain}, store: x.store, source: x.source, provider, config, confirm: async v => v.phrase, now: () => t.n.f.t.f.time}); const handle = await provider.authenticate({}); await assert.rejects(controller.execute("inspect", {requestId: x.candidate.request.requestId}, handle)); }
      provider.close();
    }
    const {DatabaseSync} = require("node:sqlite"), db = new DatabaseSync(require("node:path").join(root, "operator.sqlite"));
    try { assert.throws(() => db.exec("DELETE FROM decisions")); assert.throws(() => db.exec("UPDATE attempts SET nonce='changed'")); assert.throws(() => db.exec("DELETE FROM audit")); } finally { db.close(); }
    const wrong = t.control.createFixtureAuthProvider({testOnly: true, identity: x.config.operators[0], privateKey: t.n.f.t.extraKey.privateKey, now: () => t.n.f.t.f.time});
    const otherSession = await wrong.authenticate({fixtureUserPresence: true}); await assert.rejects(x.controller.execute("pending", {}, otherSession)); wrong.close();
    assert.throws(() => t.control.createFixtureAuthProvider({testOnly: false, identity: x.config.operators[0], privateKey: t.n.f.t.extraKey.privateKey}));
    x.provider.close(); await assert.rejects(x.controller.execute("pending", {}, session));
    assert.equal(crypto.createPublicKey(t.n.f.t.extraKey.privateKey).asymmetricKeyType, "ed25519");
  } finally { x?.close(); t.remove(root); }
  // Isolate operator expiry from request/witness expiry (the latter remain valid).
  const expiryRoot = t.temp(); let expiry;
  try {
    expiry = t.setup(expiryRoot); let at = t.n.f.t.f.time;
    const identity = {...expiry.config.operators[0], notAfter: new Date(at + 1000).toISOString()};
    const provider = t.control.createFixtureAuthProvider({testOnly: true, identity, privateKey: t.n.f.t.extraKey.privateKey, now: () => at});
    const controller = t.control.createController({retention: {current: expiry.source.retentionCurrent, retain: expiry.source.retentionRetain}, store: expiry.store, source: expiry.source, provider, config: {...expiry.config, operators: [identity]}, confirm: async v => v.phrase, now: () => at});
    const session = await provider.authenticate({fixtureUserPresence: true}), review = await controller.execute("inspect", {requestId: expiry.candidate.request.requestId}, session);
    at += 1000; await assert.rejects(controller.execute("approve", {requestId: expiry.candidate.request.requestId, reviewHash: review.reviewHash}, session));
    assert.equal(expiry.store.counts().attempts, 0); await assert.rejects(provider.authenticate({fixtureUserPresence: true})); provider.close();
  } finally { expiry?.close(); t.remove(expiryRoot); }
  // Isolate request expiry: renew the session and provide a fresh signed witness view.
  const requestRoot = t.temp(); let expiredRequest;
  try {
    expiredRequest = t.setup(requestRoot); let at = t.n.f.t.f.time;
    const provider = t.control.createFixtureAuthProvider({testOnly: true, identity: expiredRequest.config.operators[0], privateKey: t.n.f.t.extraKey.privateKey, now: () => at});
    const source = {...expiredRequest.source, snapshot: async (...args) => { const value = await expiredRequest.source.snapshot(...args); value.view.body.issuedAt = new Date(at).toISOString(); value.view.body.expiresAt = new Date(at + t.w.LEASE_MS).toISOString(); value.view.signature = expiredRequest.fixture.cfg.signWitness(t.w.signedBytes(value.view.body)); return value; }};
    const controller = t.control.createController({retention: {current: expiredRequest.source.retentionCurrent, retain: expiredRequest.source.retentionRetain}, store: expiredRequest.store, source, provider, config: expiredRequest.config, confirm: async v => v.phrase, now: () => at});
    const session = await provider.authenticate({fixtureUserPresence: true}), review = await controller.execute("inspect", {requestId: expiredRequest.candidate.request.requestId}, session);
    at += 299999; const renewed = await provider.authenticate({fixtureUserPresence: true}); at++;
    await assert.rejects(controller.execute("approve", {requestId: expiredRequest.candidate.request.requestId, reviewHash: review.reviewHash}, renewed)); assert.equal(expiredRequest.store.counts().attempts, 0); provider.close();
  } finally { expiredRequest?.close(); t.remove(requestRoot); }
  guard.assertClean(); console.log("Operator authority, opaque sessions, no application PIN authority, key substitution and artifact replay rejection: PASS");
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => guard.restore());
