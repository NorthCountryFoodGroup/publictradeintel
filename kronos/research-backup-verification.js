"use strict";
const c=require("./research-backup-contracts");
const {assertCapabilities}=require("./research-backup-adapter");
async function verifyExact(adapter,locator,expected,{now,retainUntil,retentionPolicyVersion,softwareRevision}){
 c.check(assertCapabilities(adapter.capabilities()),"BACKUP_RETENTION_UNVERIFIED");c.descriptor(expected);c.sameContext(locator,expected);c.check(locator.objectKey===expected.objectKey);c.iso(retainUntil);c.label(retentionPolicyVersion);c.label(softwareRevision);
 const head=await adapter.headExact(locator),download=await adapter.getExact(locator),retention=await adapter.describeRetention(locator);
 for(const actual of [head,download]){c.check(actual&&actual.versionId===locator.versionId,"BACKUP_VERSION_UNAVAILABLE");c.check(actual.objectKey===expected.objectKey&&actual.sizeBytes===expected.sizeBytes,"BACKUP_CHECKSUM_MISMATCH");c.sameContext(actual,expected);c.check(actual.artifactSha256===expected.artifactSha256&&actual.logicalHash===expected.logicalHash,"BACKUP_CHECKSUM_MISMATCH");}
 c.decodeObject(expected,download.bytes);c.check(retention?.versionId===locator.versionId,"BACKUP_VERSION_UNAVAILABLE");c.check(retention.mode==="COMPLIANCE"&&retention.retainUntil>=retainUntil&&retention.policyVersion===retentionPolicyVersion&&retention.encryptionStatus==="PROVIDER_MANAGED","BACKUP_RETENTION_UNVERIFIED");
 const cap=adapter.capabilities(),verifiedAt=new Date(now()).toISOString();
 return c.validateReceipt({receiptVersion:c.VERSIONS.receipt,providerType:cap.providerType,containerRef:cap.containerRef,environmentId:expected.environmentId,streamId:expected.streamId,objectKey:expected.objectKey,versionId:locator.versionId,providerETag:head.providerETag,logicalHash:expected.logicalHash,artifactSha256:expected.artifactSha256,sizeBytes:expected.sizeBytes,uploadedAt:head.uploadedAt,verifiedAt,verificationMethod:"EXACT_GET_SHA256",retentionMode:retention.mode,retainUntil:retention.retainUntil,retentionPolicyVersion:retention.policyVersion,encryptionStatus:retention.encryptionStatus,softwareRevision,descriptor:structuredClone(expected)},expected);
}
module.exports={verifyExact};
