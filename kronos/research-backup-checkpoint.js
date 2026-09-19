"use strict";
const c=require("./research-backup-contracts"),{hashValue}=require("./research-hash");
const GENESIS="KRONOS_BACKUP_CHECKPOINT_GENESIS_V1";
function validateCheckpoint(p,context){
 c.shape(p,"checkpointVersion,environmentId,streamId,checkpointNumber,verifiedSequence,latestBundleId,receiptReferences,latestSealedArchive,latestVerifiedSnapshot,createdAt,softwareRevision,previousCheckpointHash");c.sameContext(p,context);c.check(p.checkpointVersion===c.VERSIONS.checkpoint&&Number.isSafeInteger(p.checkpointNumber)&&p.checkpointNumber>0&&p.verifiedSequence===p.checkpointNumber);c.check(/^sha256:[a-f0-9]{64}$/.test(p.latestBundleId));c.iso(p.createdAt);c.label(p.softwareRevision);c.check(p.previousCheckpointHash===GENESIS||/^[a-f0-9]{64}$/.test(p.previousCheckpointHash));c.check(Array.isArray(p.receiptReferences)&&p.receiptReferences.length===1);for(const ref of p.receiptReferences)validateReference(ref,context,"receipt");if(p.latestSealedArchive!==null)validateReference(p.latestSealedArchive,context,"archive");if(p.latestVerifiedSnapshot!==null)validateReference(p.latestVerifiedSnapshot,context,"snapshot");c.safe(p);return p;
}
function validateReference(ref,context,kind){c.shape(ref,"descriptor,locator");c.descriptor(ref.descriptor);c.sameContext(ref.descriptor,context);c.shape(ref.locator,"environmentId,streamId,objectKey,versionId");c.sameContext(ref.locator,context);c.providerVersion(ref.locator.versionId);c.check(ref.locator.objectKey===ref.descriptor.objectKey&&(!kind||ref.descriptor.artifactType===kind));return ref;}
function reference(d,result){return {descriptor:structuredClone(d),locator:{environmentId:d.environmentId,streamId:d.streamId,objectKey:d.objectKey,versionId:result.versionId}};}
async function findObject(adapter,d){
 let cursor=null,found=[],pages=0;const seen=new Set();do{c.check(++pages<=1000&&!seen.has(cursor));seen.add(cursor);const page=await adapter.listPrefix(d.objectKey,cursor,100);c.check(page&&Array.isArray(page.items)&&page.items.length<=100);found.push(...page.items.filter(v=>v.objectKey===d.objectKey));c.check(found.length<=1);c.check(page.cursor===null||typeof page.cursor==="string");c.check(page.cursor===null||page.cursor!==cursor);cursor=page.cursor;}while(cursor!==null);return found[0]?reference(d,found[0]):null;
}
async function readReference(adapter,ref,policy){validateReference(ref,ref.descriptor);const receipt=await adapter.verifyExact(ref.locator,ref.descriptor,policy);const result=await adapter.getExact(ref.locator);c.check(result.versionId===ref.locator.versionId,"BACKUP_VERSION_UNAVAILABLE");return {payload:c.decodeObject(ref.descriptor,result.bytes),receipt};}
function validateSupplement(ref,payload,sequence){if(ref.descriptor.artifactType==="snapshot")c.check(payload.manifest.watermark<=sequence);else if(ref.descriptor.artifactType==="archive")c.check(payload.manifest.manifest.lastTransactionSequence<=sequence);}
async function readCheckpoint(adapter,ref,context,policy){
 validateReference(ref,context,"checkpoint");const {payload}=await readReference(adapter,ref,policy),p=validateCheckpoint(payload,context);c.check(ref.descriptor.objectKey===c.slotKey(context,p.checkpointNumber));
 const rr=await readReference(adapter,p.receiptReferences[0],policy),receipt=c.validateReceipt(rr.payload,context);c.check(receipt.verifiedAt!==null&&receipt.providerType===adapter.capabilities().providerType&&receipt.containerRef===adapter.capabilities().containerRef);const evidence=await readReference(adapter,reference(receipt.descriptor,receipt),policy);c.check(evidence.payload.bundleId===p.latestBundleId&&evidence.payload.logical.transactionSequence===p.verifiedSequence);
 for(const extra of [p.latestSealedArchive,p.latestVerifiedSnapshot])if(extra){const value=await readReference(adapter,extra,policy);validateSupplement(extra,value.payload,p.verifiedSequence);}
 return {checkpoint:p,hash:hashValue(p),reference:ref,bundle:evidence.payload};
}
async function verifyCheckpointChain(adapter,refs,context,policy,{expectedCheckpointHash,localSequence}={}){
 c.check(Array.isArray(refs)&&refs.length>0);let previous=GENESIS;const values=[];
 for(let i=0;i<refs.length;i++){const value=await readCheckpoint(adapter,refs[i],context,policy);c.check(value.checkpoint.checkpointNumber===i+1&&value.checkpoint.previousCheckpointHash===previous);previous=value.hash;values.push(value);}
 if(expectedCheckpointHash!==undefined)c.check(previous===expectedCheckpointHash);const expectedSequence=values.at(-1).checkpoint.verifiedSequence;
 if(localSequence!==undefined)c.check(localSequence>=expectedSequence,"BACKUP_CONFLICT");return {expectedSequence,checkpointHash:previous,values};
}
module.exports={GENESIS,validateCheckpoint,validateReference,reference,findObject,readReference,readCheckpoint,verifyCheckpointChain,validateSupplement};
