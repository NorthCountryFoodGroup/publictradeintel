"use strict";
const assert = require("node:assert/strict"), t = require("./fixtures/kronos-operator-evidence");
const guard = require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
(async () => {
  const mutations = {
    evidence: v => { v.candidate.attestation.evidenceHash = "a".repeat(64); },
    request: v => { v.candidate.request.requestHash = "b".repeat(64); },
    signer: v => { v.candidate.request.signerId = "runtime"; },
    registry: v => { v.registry.registryRevision++; },
    policy: v => { v.candidate.attestation.binding.qualificationPolicyVersion = "changed-policy"; },
    software: v => { v.candidate.attestation.binding.softwareRevision = "changed-software"; },
    environment: v => { v.candidate.attestation.binding.environmentId = "changed"; },
    stream: v => { v.candidate.attestation.binding.streamId = "changed"; },
    expiry: v => { v.candidate.request.expiresAt = "2026-09-20T16:04:00.000Z"; },
    researchMetadata: v => { v.research.researchContractVersion = "changed-research-contract"; },
    state: v => { v.issuanceState = "RESERVED"; }
  };
  for (const [name, change] of Object.entries(mutations)) {
    const root = t.temp(); let changed = false, x;
    try { x = t.setup(root, {mutateSource: v => { if (changed) change(v); return v; }}); const session = await x.session(), review = await x.inspect(session); changed = true;
      await assert.rejects(x.approve(session, review.reviewHash)); assert.equal(x.signatures(), 0); assert.equal(x.store.counts().attempts, 0);
    } finally { x?.close(); t.remove(root); }
    console.log("TOCTOU " + name + ": PASS");
  }
  for (const response of [null, "", "yes", "APPROVE", false]) {
    const root = t.temp(); let x; try { x = t.setup(root, {confirm: async () => response}); const session = await x.session(), review = await x.inspect(session); await assert.rejects(x.approve(session, review.reviewHash)); assert.equal(x.signatures(), 0); } finally { x?.close(); t.remove(root); }
  }
  // Mutation during deliberate confirmation is also rejected.
  const root = t.temp(); let x; try { x = t.setup(root, {confirm: async v => { x.research.modelRevision = "after-inspection"; return v.phrase; }}); const session = await x.session(), review = await x.inspect(session); await assert.rejects(x.approve(session, review.reviewHash)); assert.equal(x.signatures(), 0); } finally { x?.close(); t.remove(root); }
  for (const elapsed of [299999, 300000, 300001]) {
    const root = t.temp(); let x; try { x = t.setup(root); const session = await x.session(), review = await x.inspect(session); x.advance(elapsed);
      if (elapsed < 300000) assert.equal((await x.approve(session, review.reviewHash)).decision.action, "APPROVED");
      else { await assert.rejects(x.approve(session, review.reviewHash)); assert.equal(x.signatures(), 0); }
    } finally { x?.close(); t.remove(root); }
  }
  // A correctly signed but stale witness view cannot be used even with the right challenge.
  const staleRoot = t.temp(); let stale;
  try { let captured; stale = t.setup(staleRoot, {mutateSource: v => { if (!captured) captured = structuredClone(v.view); else v.view = captured; return v; }});
    const session = await stale.session(); await stale.inspect(session); await assert.rejects(stale.inspect(session)); assert.equal(stale.signatures(), 0);
  } finally { stale?.close(); t.remove(staleRoot); }
  // Validly rehashed restore coverage change still violates the prior review.
  const coverageRoot = t.temp(); let covered, changedCoverage = false;
  try { covered = t.setup(coverageRoot, {kind: "restore", mutateSource: v => {
    if (changedCoverage) { const a = v.candidate.attestation; a.evidence.actualCounts.forecasts = 0; a.evidence.expectedCounts.forecasts = 0; a.evidence.scopeEvidence.forecast = null;
      v.candidate.attestation = t.n.f.t.f.rehash(a); const r = v.candidate.request; r.canonicalEvidenceHash = a.evidenceHash; r.attestationHash = a.attestationHash; v.candidate.request = t.n.f.t.rehash(r, "requestHash"); }
    return v;
  }}); const session = await covered.session(), review = await covered.inspect(session); changedCoverage = true;
    await assert.rejects(covered.approve(session, review.reviewHash)); assert.equal(covered.signatures(), 0);
  } finally { covered?.close(); t.remove(coverageRoot); }
  for (const remaining of [1, 0, -1]) {
    const root = t.temp(); let x, staleView = false;
    try { x = t.setup(root, {mutateSource: v => { if (staleView) {
      const body = v.view.body; body.expiresAt = new Date(t.n.f.t.f.time + remaining).toISOString(); body.issuedAt = new Date(t.n.f.t.f.time + remaining - t.w.LEASE_MS).toISOString();
      v.view.signature = x.fixture.cfg.signWitness(t.w.signedBytes(body)); } return v; }});
      const session = await x.session(), review = await x.inspect(session); staleView = true;
      if (remaining > 0) await x.approve(session, review.reviewHash); else { await assert.rejects(x.approve(session, review.reviewHash)); assert.equal(x.signatures(), 0); }
    } finally { x?.close(); t.remove(root); }
  }
  // An inspected request cannot bypass retention; completed issuance cannot be inspected as pending.
  const completeRoot = t.temp(); let completed;
  try { completed = t.setup(completeRoot); const session = await completed.session(), review = await completed.inspect(session);
    assert.throws(() => completed.x.signer.issue(completed.fixture.data), /RETENTION_REQUIRED/);
    const record = await completed.approve(session, review.reviewHash); completed.issue(record); const count = completed.signatures();
    await assert.rejects(completed.inspect(session)); assert.equal(completed.signatures(), count);
  } finally { completed?.close(); t.remove(completeRoot); }
  guard.assertClean(); console.log("Operator TOCTOU, confirmation and expiry boundaries: PASS");
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => guard.restore());
