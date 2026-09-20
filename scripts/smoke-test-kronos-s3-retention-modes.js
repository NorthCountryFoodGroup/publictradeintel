"use strict";
const assert = require("node:assert/strict");
const guard = require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
const f = require("./fixtures/kronos-s3-mock");
const { createS3Adapter } = require("../kronos/research-backup-s3");
const { createIO } = require("../kronos/research-backup-io");
const { hashValue } = require("../kronos/research-hash");
const { canonicalize } = require("../kronos/research-canonical");
const q = require("../kronos/research-backup-qualification");
const now = () => Date.parse(f.instant);
function requirement(mode, policy = "QUALIFICATION_SHORT_V1", days) {
  return f.r.fixtureRequirement(policy, f.instant, days, mode);
}
function setup(required) {
  const mock = f.mockS3(), config = { ...f.config, retentionPolicies: [required] };
  const provider = createS3Adapter(config, { transport: mock, now });
  const artifact = f.t.jsonArtifact(f.context, "archive", { fixture: "retention-modes" }, required);
  return { mock, config, provider, artifact, io: createIO(provider.streamProvider, f.context, { now }) };
}
function attest(kind, containerRef) {
  const body = { kind, ...f.context, containerRef, passed: true, simulated: true, id: `fixture-${kind}` };
  return { ...body, hash: hashValue(body) };
}
async function main() {
  const governance = requirement("GOVERNANCE"), compliance = requirement("COMPLIANCE");
  assert.notEqual(governance.policyHash, compliance.policyHash);
  assert.equal(Date.parse(governance.minimumRetainUntil) - now(), 86400000);
  for (const mode of [undefined, null, "", "governance", "Compliance", "LEGAL_HOLD", "UNKNOWN", false]) {
    assert.throws(() => requirement(mode));
    const bad = { ...governance, mode }; delete bad.policyHash;
    // Rehash malformed values where JSON permits them; validation must still reject.
    if (mode !== undefined) bad.policyHash = hashValue(bad);
    assert.throws(() => createS3Adapter({ ...f.config, retentionPolicies: [bad] }));
  }
  const missing = { ...governance }; delete missing.mode;
  assert.throws(() => f.r.validate(missing));
  assert.throws(() => createS3Adapter({ ...f.config, retentionPolicies: [] }));
  assert.throws(() => createS3Adapter({ ...f.config, retentionPolicies: [governance, compliance] }));
  assert.throws(() => createS3Adapter({ ...f.config, environmentId: "production", retentionPolicies: [compliance] }));
  for (const required of [governance, compliance, requirement("COMPLIANCE", "PROSPECTIVE_EVIDENCE_V1", 17)]) {
    const s = setup(required), published = await s.io.publish(s.artifact);
    const put = s.mock.calls.find(x => x.name === "PutObject").input;
    assert.equal(put.ObjectLockMode, required.mode);
    assert.equal(put.ObjectLockRetainUntilDate.toISOString(), required.minimumRetainUntil);
    assert.equal(published.receipt.retention.mode, required.mode);
    assert.equal(published.receipt.retention.retainUntil, required.minimumRetainUntil);
    assert.deepEqual(published.receipt.requiredRetention, required);
    assert.equal(published.receipt.productionDurability, false);
    const row = s.mock.objects.get(published.ref.descriptor.objectKey);
    row.mode = required.mode === "GOVERNANCE" ? "COMPLIANCE" : "GOVERNANCE";
    await assert.rejects(() => s.io.read(published.ref, { fresh: true }), { code: "BACKUP_RETENTION_UNVERIFIED" });
    row.mode = required.mode; row.retention = new Date(Date.parse(required.minimumRetainUntil) - 1);
    await assert.rejects(() => s.io.read(published.ref, { fresh: true }), { code: "BACKUP_RETENTION_UNVERIFIED" });
  }
  // Untrusted descriptors cannot select even another configured class's weaker policy.
  const s = setup(compliance), forged = f.t.jsonArtifact(f.context, "archive", { fixture: "spoof" }, governance);
  await assert.rejects(() => s.provider.streamProvider.put(forged.descriptor, forged.source));
  await assert.rejects(() => s.provider.collectQualificationEvidence(forged));
  for (const override of [{ mode: "GOVERNANCE" }, { ObjectLockMode: "GOVERNANCE" }, { requiredRetention: governance }]) {
    await assert.rejects(() => s.provider.streamProvider.put(s.artifact.descriptor, s.artifact.source, override));
  }
  assert.equal(s.mock.calls.length, 0);
  const evidencePolicy = requirement("COMPLIANCE", "PROSPECTIVE_EVIDENCE_V1", 17);
  const mixed = createS3Adapter({ ...f.config, retentionPolicies: [evidencePolicy, governance] }, { transport: s.mock, now });
  await assert.rejects(() => mixed.streamProvider.put(forged.descriptor, forged.source));
  assert.equal(s.mock.calls.length, 0);
  const metadataSpoof = f.t.jsonArtifact(f.context, "archive", { mode: "GOVERNANCE", fixture: "payload-is-not-policy" }, compliance);
  await s.io.publish(metadataSpoof);
  assert.equal(s.mock.calls.find(x => x.name === "PutObject").input.ObjectLockMode, "COMPLIANCE");
  const published = await s.io.publish(s.artifact), row = s.mock.objects.get(published.ref.descriptor.objectKey);
  row.metadata["pti-retention"] = canonicalize(governance);
  await assert.rejects(() => s.provider.describeRetention(published.ref));
  row.metadata["pti-retention"] = canonicalize(compliance);
  // The adapter snapshots trusted configuration: later caller mutation cannot lower retention.
  const isolated = setup(compliance); isolated.config.retentionPolicies[0] = governance;
  await isolated.io.publish(isolated.artifact);
  assert.equal(isolated.mock.calls.find(x => x.name === "PutObject").input.ObjectLockMode, "COMPLIANCE");
  for (const required of [governance, compliance]) {
    const x = setup(required), evidence = await x.provider.collectQualificationEvidence(x.artifact);
    assert.equal(x.mock.state.defaultMode, "GOVERNANCE"); assert.equal(x.mock.state.defaultDays, 1);
    const containerRef = x.provider.capabilities().containerRef;
    const input = { runtime: attest("RUNTIME", containerRef), drill: attest("RESTORE", containerRef), expiresAt: "2026-09-30T00:00:00.000Z" };
    const result = x.provider.qualificationRecord(evidence, input), binding = result.record.retentionEvidence[0];
    assert.equal(result.record.qualificationVersion, q.VERSION);
    assert.deepEqual(binding.requiredRetention, required);
    assert.equal(binding.observedRetention.mode, required.mode);
    assert.equal(binding.observedRetention.retainUntil, required.minimumRetainUntil);
    assert.deepEqual(result.record.policyHashes, [required.policyHash]);
    assert.equal(result.record.containerRef, containerRef);
    assert.equal(result.record.environmentId, f.context.environmentId);
    assert.equal(result.record.streamId, f.context.streamId);
    assert.equal(result.productionQualified, false); assert.equal(result.status.trusted, false);
    assert.throws(() => { evidence.retentionEvidence.observedRetention.mode = "UNKNOWN"; });
    assert.throws(() => x.provider.qualificationRecord({ ...evidence }, input));
    const other = setup(required.mode === "GOVERNANCE" ? compliance : governance);
    assert.throws(() => other.provider.qualificationRecord(evidence, input));
    const otherBucket = createS3Adapter({ ...x.config, bucket: "different-qualification-fixture" }, { transport: f.mockS3(), now });
    assert.throws(() => otherBucket.qualificationRecord(evidence, input));
    assert.throws(() => f.r.verify(required.mode === "GOVERNANCE" ? compliance : governance, binding.observedRetention));
    const tampered = structuredClone(result.record);
    tampered.retentionEvidence[0].observedRetention.mode = required.mode === "GOVERNANCE" ? "COMPLIANCE" : "GOVERNANCE";
    const { qualificationHash, ...body } = tampered;
    assert.throws(() => q.validate({ ...body, qualificationHash: hashValue(body) }, f.context));
  }
  // V1 interoperability preserves observed Governance only with an explicit requirement.
  const legacy = require("./fixtures/kronos-backup-compatibility").setup();
  try {
    const x = setup(governance), object = f.c.encodeObject(f.context, "bundle", "KRONOS_RECOVERY_BUNDLE_V1", legacy.bundle);
    const adapter = require("../kronos/research-backup-adapter").createAdapter(x.provider, f.context);
    const put = await adapter.putImmutable(object.descriptor, object.bytes);
    const locator = { ...f.context, objectKey: object.descriptor.objectKey, versionId: put.versionId };
    const options = { now, retainUntil: governance.minimumRetainUntil, retentionPolicyVersion: governance.policyId, softwareRevision: "fixture-v1" };
    await assert.rejects(() => adapter.verifyExact(locator, object.descriptor, options));
    const receipt = await adapter.verifyExact(locator, object.descriptor, { ...options, requiredRetention: governance });
    assert.equal(receipt.retentionMode, "GOVERNANCE"); assert.equal(receipt.retainUntil, governance.minimumRetainUntil);
  } finally { legacy.cleanup(); }
  guard.assertClean();
  console.log("Retention modes: explicit Governance/1-day and Compliance, exact readback, fail-closed modes, spoof/config/metadata isolation, V1/V2 receipts, bound qualification evidence: PASS; external network/real credential access: 0");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => guard.restore());
