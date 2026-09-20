"use strict";
// Deterministic fictional observations and test-only signing keys. Never imported by application code.
const crypto = require("node:crypto");
const { canonicalize } = require("../../kronos/research-canonical");
const { hashValue } = require("../../kronos/research-hash");
const contracts = require("../../kronos/research-qualification-contracts");
const { POLICY } = require("../../kronos/research-qualification-policy");
const { createQualificationAuthority } = require("../../kronos/research-qualification-authority");
const instant = "2026-09-20T16:00:00.000Z", time = Date.parse(instant);
const required = require("../../kronos/research-backup-retention").fixtureRequirement("QUALIFICATION_SHORT_V1", instant, undefined, "GOVERNANCE");
const bucket = "fictional-qualification-bucket", region = "us-east-2", owner = "000000000000";
const binding = {
  providerType: "s3", bucket, containerRef: "s3-" + hashValue({bucket, region, owner}).slice(0,32),
  region, expectedOwner: owner, environmentId: "fixture", streamId: "qualification-test-v1",
  softwareRevision: "fixture-software-v1", deploymentRevision: "fixture-deployment-v1",
  runtimeRevision: "fixture-runtime-v1", nodeVersion: "24.21.0", sqliteVersion: "3.50.4",
  adapterVersion: "KRONOS_BACKUP_ADAPTER_V1", storagePolicyHash: hashValue("fixture-storage-policy-v1"),
  retentionPolicyHash: required.policyHash, qualificationPolicyVersion: POLICY.version
};
const input = { objectKey: "pti/fixture/qualification-test-v1/bundle/KRONOS_RECOVERY_BUNDLE_V1/" + hashValue("logical"),
  versionId: "fictional-exact-version-v1", artifactSha256: hashValue("fictional-bytes"), sizeBytes: 1406,
  logicalHash: hashValue("logical"), artifactType: "bundle" };
const keys = Object.fromEntries(["provider", "runtime", "restore", "independent"].map((id, i) => {
  const seed = Buffer.alloc(32, i + 1);
  const privateKey = crypto.createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"),seed]),format:"der",type:"pkcs8" });
  return [id, { privateKey, publicKey: crypto.createPublicKey(privateKey).export({type:"spki",format:"pem"}) }];
}));
const issuers = Object.entries(keys).map(([id,k]) => ({id,domain:id==="independent"?"restore":id,publicKey:k.publicKey}));
function counts(full = false) { return {research_transactions:1,audit_events:1,backup_outbox:1,forecasts:full?1:0,correction_events:full?1:0,accepted_outcomes:full?1:0}; }
function providerEvidence() { return {
  versioning:"Enabled",objectLock:"Enabled",defaultRetention:{mode:"GOVERNANCE",days:1},encryption:"AES256",
  requiredRetention:structuredClone(required),observedRetention:{mode:"GOVERNANCE",retainUntil:required.minimumRetainUntil,policyHash:required.policyHash,encryptionStatus:"PROVIDER_MANAGED"},
  input:structuredClone(input),conditionalCreation:{ifNoneMatch:"*",httpStatus:200,versionId:input.versionId},
  exactReadback:{versionId:input.versionId,sha256:input.artifactSha256,sizeBytes:input.sizeBytes,logicalHash:input.logicalHash},
  idempotency:{versionId:input.versionId,putCalls:0,newVersions:0},versionHistory:{before:[input.versionId],after:[input.versionId],deleteMarkers:0}
}; }
function runtimeEvidence() { return {nodeVersion:binding.nodeVersion,sqliteAvailable:true,sqliteVersion:binding.sqliteVersion,backupAvailable:true,persistentDataDir:true,filesystemWrite:true,writerLock:true,fsync:true,atomicRename:true,processCount:1,diskFraction:0.1,freeBytes:1000000,requiredStagingBytes:1000}; }
function restoreEvidence(full = false, independent = false) { return {
  inputs:[structuredClone(input)],expectedStateHash:hashValue("fictional-state"),actualStateHash:hashValue("fictional-state"),
  expectedCounts:counts(full),actualCounts:counts(full),
  scopeEvidence:Object.fromEntries(POLICY.fullCoverage.map((s,i)=>[s,full||i<3?hashValue("verified-"+s):null])),
  relationshipsMatch:true,provenanceMatch:true,sourceRemoved:true,remoteOnly:true,localCacheFallback:false,
  startedAt:instant,completedAt:instant,exerciseKind:independent?"INDEPENDENT":"INITIAL",result:"PASS"
}; }
function attestation(domain, evidence = ({provider:providerEvidence,runtime:runtimeEvidence,restore:restoreEvidence})[domain]()) {
  const body={attestationVersion:contracts.VERSIONS[domain],attestationType:contracts.TYPES[domain],domain,runId:"fictional-run-1",
    binding:structuredClone(binding),observedAt:instant,expiresAt:new Date(time+3600000).toISOString(),evidence,evidenceHash:hashValue(evidence)};
  return {...body,attestationHash:hashValue(body)};
}
function rehash(a) { a.evidenceHash=hashValue(a.evidence);const {attestationHash,...body}=a;a.attestationHash=hashValue(body);return a; }
function sign(a, issuerId=a.domain) {
  return {issuerId,attestation:structuredClone(a),signature:crypto.sign(null,Buffer.from("KRONOS_SIGNED_OBSERVATION_V1\n"+canonicalize(a)),keys[issuerId].privateKey).toString("base64")};
}
function setup() {
  let current=time;
  const authority=createQualificationAuthority({binding,issuers,now:()=>current});
  return {authority,advance:ms=>current+=ms,at:value=>current=value,
    accept:(domain,evidence)=>authority.accept(sign(attestation(domain,evidence)))};
}
module.exports={contracts,POLICY,instant,time,binding,input,required,issuers,keys,providerEvidence,runtimeEvidence,restoreEvidence,attestation,rehash,sign,setup,hashValue};
