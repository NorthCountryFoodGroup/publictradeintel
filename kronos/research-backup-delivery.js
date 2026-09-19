"use strict";
const c=require("./research-backup-contracts"),{hashValue}=require("./research-hash");
const cp=require("./research-backup-checkpoint");
const {RECOVERY_BUNDLE_VERSION,validateBundle}=require("./research-recovery-bundle");
const active=new WeakSet(),approvedPrefixes=new WeakMap();
function remember(result){approvedPrefixes.set(result,{hash:result.hash,sequence:result.checkpoint.verifiedSequence});return result;}
const TRANSITIONS=Object.freeze({PENDING:["UPLOADING","FAILED_TERMINAL"],UPLOADING:["UPLOADED","OFF_DISK_VERIFIED","FAILED_RETRYABLE","FAILED_TERMINAL"],UPLOADED:["VERIFYING","FAILED_RETRYABLE","FAILED_TERMINAL"],VERIFYING:["CHECKPOINT_PENDING","FAILED_RETRYABLE","FAILED_TERMINAL"],CHECKPOINT_PENDING:["OFF_DISK_VERIFIED","FAILED_RETRYABLE","FAILED_TERMINAL"],FAILED_RETRYABLE:["UPLOADING","FAILED_TERMINAL"],FAILED_TERMINAL:[],OFF_DISK_VERIFIED:[]});
function createJournal(){const entries=[];return Object.freeze({append(state,details={}){c.check(c.STATES.includes(state));c.check(entries.length?TRANSITIONS[entries.at(-1).state].includes(state):state==="PENDING");c.shape(details,"transactionId,attempt,at,errorCode");c.label(details.transactionId);c.iso(details.at);c.check(Number.isInteger(details.attempt)&&details.attempt>=0&&details.attempt<=4);c.check(details.errorCode===null||c.ERRORS.includes(details.errorCode));const entry={number:entries.length+1,simulated:true,productionDurability:false,state,...structuredClone(details),previousHash:entries.length?hashValue(entries.at(-1)):null};entries.push(Object.freeze(entry));},events:()=>structuredClone(entries)});}
async function publishVerified(adapter,object,policy,hook=()=>{}){
 let ref=await cp.findObject(adapter,object.descriptor);hook("before-upload");
 if(!ref){const result=await adapter.putImmutable(object.descriptor,object.bytes);ref=cp.reference(object.descriptor,result);}hook("after-upload");
 const receipt=await adapter.verifyExact(ref.locator,object.descriptor,policy);hook("after-verification");return {ref,receipt};
}
async function deliverBundle(adapter,bundle,{context,clock,policy,previous=null,previousReferences=[],committedAt,latestVerifiedSnapshot=null,latestSealedArchive=null,journal=createJournal(),hook=()=>{}}){
 validateBundle(bundle);c.sameContext(context,context);c.check(!active.has(adapter));
 const sequence=bundle.logical.transactionSequence,started=Date.parse(c.iso(committedAt));c.check(clock.now()>=started);let attempts=0;
 function event(state,code=null){journal.append(state,{transactionId:bundle.logical.transactionId,attempt:attempts,at:new Date(clock.now()).toISOString(),errorCode:code});}
 active.add(adapter);
 try{
  const previousHash=previous?previous.hash:cp.GENESIS;c.check(sequence===(previous?previous.checkpoint.verifiedSequence:0)+1);
  if(previous){const known=approvedPrefixes.get(previous);if(known)c.check(known.hash===previousHash&&known.sequence===previous.checkpoint.verifiedSequence);else {const chain=await cp.verifyCheckpointChain(adapter,previousReferences,context,policy,{expectedCheckpointHash:previousHash});c.check(chain.expectedSequence===previous.checkpoint.verifiedSequence);}const verified=await cp.readCheckpoint(adapter,previous.reference,context,policy);c.check(verified.hash===previousHash);}
  event("PENDING");
  for(attempts=1;attempts<=c.POLICY.maxAttempts;attempts++){
   try{
    c.check(clock.now()-started<c.POLICY.deadlineMs,"BACKUP_TIMEOUT");event("UPLOADING");
    // Recover a complete remote checkpoint first, even if all local delivery events were lost.
    const slot=c.slotKey(context,sequence),page=await adapter.listPrefix(slot,null,2);c.check(page.items.length<=1&&page.cursor===null);const existing=page.items.find(v=>v.objectKey===slot);
    if(existing){const downloaded=await adapter.getExact({...context,objectKey:slot,versionId:existing.versionId});const parsed=JSON.parse(downloaded.bytes.toString("utf8"));const object=c.encodeObject(context,"checkpoint",c.VERSIONS.checkpoint,parsed.payload);object.descriptor.objectKey=slot;const recovered=await cp.readCheckpoint(adapter,cp.reference(object.descriptor,existing),context,policy);c.check(recovered.checkpoint.latestBundleId===bundle.bundleId&&recovered.checkpoint.previousCheckpointHash===previousHash);c.check(clock.now()-started<c.POLICY.deadlineMs,"BACKUP_TIMEOUT");event("OFF_DISK_VERIFIED");return remember({...recovered,journal:journal.events(),simulated:true,productionDurability:false});}
    const artifact=await publishVerified(adapter,c.encodeObject(context,"bundle",RECOVERY_BUNDLE_VERSION,bundle),policy,point=>{hook(point);if(point==="after-upload"){event("UPLOADED");event("VERIFYING");}});
    const receiptObject=await publishVerified(adapter,c.encodeObject(context,"receipt",c.VERSIONS.receipt,artifact.receipt),policy);hook("after-receipt");event("CHECKPOINT_PENDING");
    const checkpoint={checkpointVersion:c.VERSIONS.checkpoint,...context,checkpointNumber:sequence,verifiedSequence:sequence,latestBundleId:bundle.bundleId,receiptReferences:[receiptObject.ref],latestSealedArchive:latestSealedArchive||previous?.checkpoint.latestSealedArchive||null,latestVerifiedSnapshot:latestVerifiedSnapshot||previous?.checkpoint.latestVerifiedSnapshot||null,createdAt:artifact.receipt.verifiedAt,softwareRevision:policy.softwareRevision,previousCheckpointHash:previousHash};cp.validateCheckpoint(checkpoint,context);for(const extra of [checkpoint.latestSealedArchive,checkpoint.latestVerifiedSnapshot])if(extra){const value=await cp.readReference(adapter,extra,policy);cp.validateSupplement(extra,value.payload,sequence);}
    const object=c.encodeObject(context,"checkpoint",c.VERSIONS.checkpoint,checkpoint);object.descriptor.objectKey=slot;hook("before-checkpoint");const sealed=await publishVerified(adapter,object,policy);hook("after-checkpoint");
    const verified=await cp.readCheckpoint(adapter,sealed.ref,context,policy);c.check(clock.now()-started<c.POLICY.deadlineMs,"BACKUP_TIMEOUT");event("OFF_DISK_VERIFIED");return remember({...verified,journal:journal.events(),simulated:true,productionDurability:false});
   }catch(error){if(error?.fixtureCrash)throw error;const normalized=c.failure(error?.code,error?.retryable===true);event(normalized.retryable?"FAILED_RETRYABLE":"FAILED_TERMINAL",normalized.code);if(!normalized.retryable||attempts===c.POLICY.maxAttempts||clock.now()-started>=c.POLICY.deadlineMs)throw normalized;const delay=Math.floor(Math.min(c.POLICY.maxBackoffMs,1000*2**(attempts-1))*clock.random());c.check(delay>=0&&delay<=c.POLICY.maxBackoffMs);if(clock.now()+delay-started>=c.POLICY.deadlineMs)throw c.failure("BACKUP_TIMEOUT");await clock.sleep(delay);}
  }
 }finally{active.delete(adapter);}
}
module.exports={createJournal,publishVerified,deliverBundle};
