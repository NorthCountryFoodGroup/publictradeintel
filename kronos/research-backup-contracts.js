"use strict";
const {canonicalize}=require("./research-canonical");
const {hashValue,hashBytes}=require("./research-hash");
const {safeEvidence,validateBundle}=require("./research-recovery-bundle");
const VERSIONS=Object.freeze({adapter:"KRONOS_BACKUP_ADAPTER_V1",receipt:"KRONOS_REMOTE_RECEIPT_V1",checkpoint:"KRONOS_REMOTE_CHECKPOINT_V1",snapshot:"KRONOS_SNAPSHOT_MANIFEST_V1",drill:"KRONOS_RESTORE_DRILL_V1",object:"KRONOS_BACKUP_OBJECT_V1"});
const ERRORS=Object.freeze(["BACKUP_UNAVAILABLE","BACKUP_AUTH_FAILED","BACKUP_PERMISSION_DENIED","BACKUP_CONFLICT","BACKUP_CHECKSUM_MISMATCH","BACKUP_RETENTION_UNVERIFIED","BACKUP_VERSION_UNAVAILABLE","BACKUP_TIMEOUT","BACKUP_PROVIDER_ERROR"]);
const STATES=Object.freeze(["PENDING","UPLOADING","UPLOADED","VERIFYING","CHECKPOINT_PENDING","OFF_DISK_VERIFIED","FAILED_RETRYABLE","FAILED_TERMINAL"]);
const POLICY=Object.freeze({deadlineMs:60000,maxAttempts:4,maxBackoffMs:8000,drillExpiryMs:8*86400000,independentDrillExpiryMs:92*86400000,rtoTargetMs:3600000,criticalDiskFraction:0.85});
const CONFIG_NAMES=Object.freeze(["KRONOS_BACKUP_PROVIDER","KRONOS_BACKUP_CONTAINER_REF","KRONOS_BACKUP_REGION","KRONOS_BACKUP_ENVIRONMENT_ID","KRONOS_BACKUP_STREAM_ID","KRONOS_BACKUP_RETENTION_POLICY","KRONOS_BACKUP_CREDENTIAL_REF"]);
function failure(code,retryable=false){return Object.assign(new Error(ERRORS.includes(code)?code:"BACKUP_PROVIDER_ERROR"),{code:ERRORS.includes(code)?code:"BACKUP_PROVIDER_ERROR",retryable:Boolean(retryable)&&["BACKUP_TIMEOUT","BACKUP_UNAVAILABLE","BACKUP_PROVIDER_ERROR"].includes(code)});}
function check(ok,code="BACKUP_CONFLICT"){if(!ok)throw failure(code);}
function shape(value,names){check(value&&typeof value==="object"&&!Array.isArray(value)&&Object.keys(value).sort().join(",")===names.split(",").sort().join(","));canonicalize(value);}
function safe(value){
 function scrub(v){if(Array.isArray(v))return v.map(scrub);if(v&&typeof v==="object")return Object.fromEntries(Object.entries(v).map(([k,x])=>{if(k==="environmentId"){check(["production","staging","development","fixture"].includes(x));return ["deploymentIdentity",x];}return [k,scrub(x)];}));return v;}
 try{canonicalize(value);safeEvidence(scrub(value));}catch{throw failure("BACKUP_CONFLICT");}
}
function identity(context){shape(context,"environmentId,streamId");check(["production","staging","development","fixture"].includes(context.environmentId));check(typeof context.streamId==="string"&&/^[a-z][a-z0-9-]{2,63}$/.test(context.streamId)&&!context.streamId.includes("--")&&context.streamId!=="latest");return context;}
function sameContext(a,b){identity({environmentId:a.environmentId,streamId:a.streamId});check(a.environmentId===b.environmentId&&a.streamId===b.streamId);}
function iso(value){check(typeof value==="string"&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);return value;}
function digest(value){check(typeof value==="string"&&/^[a-f0-9]{64}$/.test(value));return value;}
function label(value){check(typeof value==="string"&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value));safe(value);return value;}
function prefix(context){identity({environmentId:context.environmentId,streamId:context.streamId});return `pti/${context.environmentId}/${context.streamId}/`;}
function objectKey(context,kind,version,hash){check(["bundle","archive","snapshot","receipt","checkpoint"].includes(kind));check(version===({bundle:"KRONOS_RECOVERY_BUNDLE_V1",archive:"KRONOS_RESEARCH_JSONL_V1",snapshot:VERSIONS.snapshot,receipt:VERSIONS.receipt,checkpoint:VERSIONS.checkpoint})[kind]);return `${prefix(context)}${kind}/${version}/${digest(hash)}`;}
function slotKey(context,number){check(Number.isSafeInteger(number)&&number>0&&number<1e12);return `${prefix(context)}checkpoint/${VERSIONS.checkpoint}/slots/${String(number).padStart(12,"0")}`;}
function validatePayload(kind,payload,context){
 if(kind==="snapshot"){
  shape(payload,"manifest,sqliteBase64");require("./research-snapshot").validateSnapshot(payload.manifest,context);
  check(typeof payload.sqliteBase64==="string"&&payload.sqliteBase64.length<=128*1024*1024,"BACKUP_CHECKSUM_MISMATCH");
  const bytes=Buffer.from(payload.sqliteBase64,"base64");check(bytes.toString("base64")===payload.sqliteBase64&&bytes.length===payload.manifest.sizeBytes&&hashBytes(bytes)===payload.manifest.artifactSha256,"BACKUP_CHECKSUM_MISMATCH");
 }else if(kind==="archive"){
  shape(payload,"manifest,gzipBase64");check(typeof payload.gzipBase64==="string"&&payload.gzipBase64.length<=128*1024*1024);const bytes=Buffer.from(payload.gzipBase64,"base64");check(bytes.toString("base64")===payload.gzipBase64);require("./research-archive").validateArchive({manifest:payload.manifest,artifact:bytes});
 }else{safe(payload);if(kind==="bundle")validateBundle(payload);if(kind==="receipt")validateReceipt(payload,context);if(kind==="checkpoint")require("./research-backup-checkpoint").validateCheckpoint(payload,context);}

}
function encodeObject(context,kind,version,payload){
 identity(context);validatePayload(kind,payload,context);
 const logicalHash=hashValue(payload),envelope={objectVersion:VERSIONS.object,...context,artifactType:kind,formatVersion:version,logicalHash,payload},bytes=Buffer.from(canonicalize(envelope)+"\n");
 const descriptor={...context,artifactType:kind,formatVersion:version,logicalHash,artifactSha256:hashBytes(bytes),sizeBytes:bytes.length,objectKey:objectKey(context,kind,version,logicalHash)};
 return {descriptor,bytes};
}
function descriptor(value){shape(value,"environmentId,streamId,artifactType,formatVersion,logicalHash,artifactSha256,sizeBytes,objectKey");digest(value.artifactSha256);check(Number.isSafeInteger(value.sizeBytes)&&value.sizeBytes>0&&value.sizeBytes<=128*1024*1024);const expected=objectKey(value,value.artifactType,value.formatVersion,value.logicalHash);check(value.objectKey===expected||(value.artifactType==="checkpoint"&&value.objectKey.startsWith(`${prefix(value)}checkpoint/${VERSIONS.checkpoint}/slots/`)&&/^\d{12}$/.test(value.objectKey.split("/").at(-1))&&value.objectKey===slotKey(value,Number(value.objectKey.split("/").at(-1)))));return value;}
function decodeObject(d,bytes){descriptor(d);check(Buffer.isBuffer(bytes)&&bytes.length===d.sizeBytes&&hashBytes(bytes)===d.artifactSha256,"BACKUP_CHECKSUM_MISMATCH");let object;try{object=JSON.parse(bytes.toString("utf8"));}catch{throw failure("BACKUP_CHECKSUM_MISMATCH");}shape(object,"objectVersion,environmentId,streamId,artifactType,formatVersion,logicalHash,payload");sameContext(object,d);check(object.objectVersion===VERSIONS.object&&object.artifactType===d.artifactType&&object.formatVersion===d.formatVersion&&object.logicalHash===d.logicalHash&&hashValue(object.payload)===d.logicalHash,"BACKUP_CHECKSUM_MISMATCH");check(Buffer.from(canonicalize(object)+"\n").equals(bytes),"BACKUP_CHECKSUM_MISMATCH");validatePayload(d.artifactType,object.payload,d);return object.payload;}
function validateReceipt(r,context){
 shape(r,"receiptVersion,providerType,containerRef,environmentId,streamId,objectKey,versionId,providerETag,logicalHash,artifactSha256,sizeBytes,uploadedAt,verifiedAt,verificationMethod,retentionMode,retainUntil,retentionPolicyVersion,encryptionStatus,softwareRevision,descriptor");
 check(r.receiptVersion===VERSIONS.receipt);sameContext(r,context);descriptor(r.descriptor);sameContext(r.descriptor,context);for(const k of ["objectKey","logicalHash","artifactSha256","sizeBytes"])check(r[k]===r.descriptor[k]);for(const k of ["providerType","containerRef","versionId","softwareRevision","retentionPolicyVersion"])label(r[k]);check(r.providerETag===null||typeof r.providerETag==="string");safe(r.providerETag);iso(r.uploadedAt);iso(r.retainUntil);check(r.retentionMode==="COMPLIANCE"&&r.encryptionStatus==="PROVIDER_MANAGED","BACKUP_RETENTION_UNVERIFIED");if(r.verifiedAt!==null){iso(r.verifiedAt);check(r.verifiedAt>=r.uploadedAt&&r.verifiedAt<r.retainUntil&&r.verificationMethod==="EXACT_GET_SHA256");}else check(r.verificationMethod===null);return r;
}
module.exports={VERSIONS,ERRORS,STATES,POLICY,CONFIG_NAMES,failure,check,shape,safe,identity,sameContext,iso,digest,label,prefix,objectKey,slotKey,encodeObject,descriptor,decodeObject,validateReceipt};
