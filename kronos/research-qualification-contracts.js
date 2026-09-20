"use strict";
const c = require("./research-backup-contracts");
const { hashValue } = require("./research-hash");
const { canonicalize } = require("./research-canonical");
const retention = require("./research-backup-retention");
const { POLICY, coverage } = require("./research-qualification-policy");
const VERSIONS = Object.freeze({
  provider: "KRONOS_PROVIDER_ATTESTATION_V1",
  runtime: "KRONOS_RUNTIME_QUALIFICATION_V1",
  restore: "KRONOS_RESTORE_ATTESTATION_V1",
  qualification: "KRONOS_PROVIDER_QUALIFICATION_V3"
});
const TYPES = Object.freeze({
  provider: "REAL_PROVIDER_ATTESTATION",
  runtime: "REAL_RUNTIME_ATTESTATION",
  restore: "REAL_RESTORE_DRILL_ATTESTATION"
});
const COUNT_KEYS = "research_transactions,audit_events,backup_outbox,forecasts,correction_events,accepted_outcomes";
function equal(a, b) { c.check(canonicalize(a) === canonicalize(b)); }
function safe(value) {
  c.safe(value);
  const text = canonicalize(value);
  c.check(text.length <= 65536 && !/(?:AKIA|ASIA)[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|X-Amz-|Authorization|sessionToken|accessKeyId|secretAccessKey|webIdentityToken|cookie|environmentDump/i.test(text));
}
function binding(b) {
  c.shape(b, "providerType,bucket,containerRef,region,expectedOwner,environmentId,streamId,softwareRevision,deploymentRevision,runtimeRevision,nodeVersion,sqliteVersion,adapterVersion,storagePolicyHash,retentionPolicyHash,qualificationPolicyVersion");
  c.identity({ environmentId: b.environmentId, streamId: b.streamId });
  c.check(b.providerType === "s3" && /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(b.bucket));
  c.check(/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(b.region) && /^\d{12}$/.test(b.expectedOwner));
  c.check(b.containerRef === "s3-" + hashValue({ bucket: b.bucket, region: b.region, owner: b.expectedOwner }).slice(0, 32));
  for (const key of ["softwareRevision", "deploymentRevision", "runtimeRevision", "adapterVersion"]) c.label(b[key]);
  c.check(/^24\.(?:1[89]|[2-9]\d|\d{3,})\.\d+$/.test(b.nodeVersion));
  c.check(/^\d+\.\d+\.\d+$/.test(b.sqliteVersion));
  c.check(b.adapterVersion === c.VERSIONS.adapter && b.qualificationPolicyVersion === POLICY.version);
  c.digest(b.storagePolicyHash); c.digest(b.retentionPolicyHash); safe(b);
  return b;
}
function input(row, b) {
  c.shape(row, "objectKey,versionId,artifactSha256,sizeBytes,logicalHash,artifactType");
  c.providerVersion(row.versionId); c.digest(row.artifactSha256); c.digest(row.logicalHash);
  c.check(Number.isSafeInteger(row.sizeBytes) && row.sizeBytes > 0 && row.sizeBytes <= 128 * 1024 * 1024);
  c.check(["bundle", "archive", "snapshot", "snapshot-chunk"].includes(row.artifactType));
  c.check(typeof row.objectKey === "string" && row.objectKey.startsWith(c.prefix(b)) &&
    row.objectKey.length <= 1024 && !/[\\\x00-\x20\x7f%?#]/.test(row.objectKey) &&
    !row.objectKey.includes("..") && !row.objectKey.includes("//"));
  safe(row);
}
function counts(value) {
  c.shape(value, COUNT_KEYS);
  for (const n of Object.values(value)) c.check(Number.isSafeInteger(n) && n >= 0);
}
function provider(e, b) {
  c.shape(e, "versioning,objectLock,defaultRetention,encryption,requiredRetention,observedRetention,input,conditionalCreation,exactReadback,idempotency,versionHistory");
  c.check(e.versioning === "Enabled" && e.objectLock === "Enabled" && e.encryption === "AES256");
  c.shape(e.defaultRetention, "mode,days");
  c.check(["GOVERNANCE", "COMPLIANCE"].includes(e.defaultRetention.mode) &&
    Number.isSafeInteger(e.defaultRetention.days) && e.defaultRetention.days > 0);
  retention.verify(e.requiredRetention, e.observedRetention);
  c.check(e.defaultRetention.mode === e.requiredRetention.mode);
  c.check(e.requiredRetention.policyHash === b.retentionPolicyHash &&
    e.observedRetention.encryptionStatus === "PROVIDER_MANAGED");
  input(e.input, b);
  c.shape(e.conditionalCreation, "ifNoneMatch,httpStatus,versionId");
  c.check(e.conditionalCreation.ifNoneMatch === "*" && e.conditionalCreation.httpStatus === 200);
  c.check(e.conditionalCreation.versionId === e.input.versionId);
  c.shape(e.exactReadback, "versionId,sha256,sizeBytes,logicalHash");
  equal(e.exactReadback, { versionId: e.input.versionId, sha256: e.input.artifactSha256,
    sizeBytes: e.input.sizeBytes, logicalHash: e.input.logicalHash });
  c.shape(e.idempotency, "versionId,putCalls,newVersions");
  c.check(e.idempotency.versionId === e.input.versionId && e.idempotency.putCalls === 0 && e.idempotency.newVersions === 0);
  c.shape(e.versionHistory, "before,after,deleteMarkers");
  equal(e.versionHistory.before, [e.input.versionId]); equal(e.versionHistory.after, [e.input.versionId]);
  c.check(e.versionHistory.deleteMarkers === 0);
}
function runtime(e, b) {
  c.shape(e, "nodeVersion,sqliteAvailable,sqliteVersion,backupAvailable,persistentDataDir,filesystemWrite,writerLock,fsync,atomicRename,processCount,diskFraction,freeBytes,requiredStagingBytes");
  c.check(e.nodeVersion === b.nodeVersion && e.sqliteVersion === b.sqliteVersion);
  for (const key of ["sqliteAvailable", "backupAvailable", "persistentDataDir", "filesystemWrite", "writerLock", "fsync", "atomicRename"])
    c.check(e[key] === true);
  c.check(e.processCount === 1 && Number.isFinite(e.diskFraction) && e.diskFraction >= 0 &&
    e.diskFraction < c.POLICY.criticalDiskFraction && Number.isSafeInteger(e.freeBytes) &&
    Number.isSafeInteger(e.requiredStagingBytes) && e.requiredStagingBytes > 0 && e.freeBytes >= 2 * e.requiredStagingBytes);
}
function restore(e, b) {
  c.shape(e, "inputs,expectedStateHash,actualStateHash,expectedCounts,actualCounts,scopeEvidence,relationshipsMatch,provenanceMatch,sourceRemoved,remoteOnly,localCacheFallback,startedAt,completedAt,exerciseKind,result");
  c.check(Array.isArray(e.inputs) && e.inputs.length > 0 && e.inputs.length <= 16);
  e.inputs.forEach(row => input(row, b));
  c.check(new Set(e.inputs.map(row => row.objectKey)).size === e.inputs.length);
  c.digest(e.expectedStateHash); c.digest(e.actualStateHash); c.check(e.expectedStateHash === e.actualStateHash);
  counts(e.expectedCounts); counts(e.actualCounts); equal(e.expectedCounts, e.actualCounts);
  c.shape(e.scopeEvidence, POLICY.fullCoverage.join(","));
  for (const digest of Object.values(e.scopeEvidence)) if (digest !== null) c.digest(digest);
  for (const key of ["relationshipsMatch", "provenanceMatch", "sourceRemoved", "remoteOnly"]) c.check(e[key] === true);
  c.check(e.localCacheFallback === false && e.result === "PASS");
  c.check(["INITIAL", "WEEKLY", "INDEPENDENT"].includes(e.exerciseKind));
  c.iso(e.startedAt); c.iso(e.completedAt); c.check(e.completedAt >= e.startedAt);
  const scopes = coverage(e);
  c.check(["transaction", "audit", "outbox"].every(scope => scopes.includes(scope)));
  // A coverage label alone is never accepted. Counts and per-class evidence are signed.
  c.check(e.actualCounts.research_transactions === e.actualCounts.audit_events &&
    e.actualCounts.research_transactions === e.actualCounts.backup_outbox);
}
function validateAttestation(a) {
  c.shape(a, "attestationVersion,attestationType,domain,runId,binding,observedAt,expiresAt,evidence,evidenceHash,attestationHash");
  c.check(Object.hasOwn(VERSIONS, a.domain) && Object.hasOwn(TYPES, a.domain));
  c.check(a.attestationVersion === VERSIONS[a.domain] && a.attestationType === TYPES[a.domain]);
  c.label(a.runId); binding(a.binding); c.iso(a.observedAt); c.iso(a.expiresAt);
  const age = Date.parse(a.expiresAt) - Date.parse(a.observedAt);
  const maximum = a.domain === "provider" ? POLICY.providerMaxAgeMs : a.domain === "runtime" ? POLICY.runtimeMaxAgeMs :
    a.evidence.exerciseKind === "INDEPENDENT" ? POLICY.independentMaxAgeMs : POLICY.restoreMaxAgeMs;
  c.check(age > 0 && age <= maximum);
  ({ provider, runtime, restore })[a.domain](a.evidence, a.binding);
  if (a.domain === "restore") c.check(a.evidence.completedAt <= a.observedAt &&
    Date.parse(a.expiresAt) - Date.parse(a.evidence.completedAt) <= maximum);
  if (a.domain === "provider") c.check(a.observedAt < a.evidence.observedRetention.retainUntil);
  c.check(hashValue(a.evidence) === a.evidenceHash);
  const { attestationHash, ...body } = a; c.check(hashValue(body) === attestationHash); safe(a);
  return a;
}
function signingBytes(a) {
  validateAttestation(a);
  return Buffer.from("KRONOS_SIGNED_OBSERVATION_V1\n" + canonicalize(a));
}
function simulated(domain, evidence) {
  c.check(Object.hasOwn(TYPES, domain));
  // Deliberately separate envelope: no real-attestation relabeling or downgrade.
  c.check(evidence && evidence.fixture === true && Object.keys(evidence).sort().join(",") === "fixture,value");
  c.check(typeof evidence.value === "string" && evidence.value.length <= 128);
  safe(evidence);
  const body = { type: "SIMULATED_TEST_ATTESTATION", domain, evidence: structuredClone(evidence) };
  return Object.freeze({ ...body, hash: hashValue(body) });
}
module.exports = { VERSIONS, TYPES, binding, input, validateAttestation, signingBytes, simulated, safe, equal };
