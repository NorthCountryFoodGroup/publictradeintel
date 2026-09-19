"use strict";
const c=require("./research-backup-contracts"),t=require("./research-backup-transport"),d=require("./research-backup-discovery"),{hashValue}=require("./research-hash"),{deadline}=require("./research-backup-deadline");
const active=new WeakSet();
async function deliver(io,bundle,{journal,retention,committedAt,previous=null,accelerator=null,softwareRevision="fixture-v1",hook=()=>{},timeoutMs=60000,signal,scope:injectedScope,random=Math.random}={}){
 require("./research-recovery-bundle").validateBundle(bundle);journal.assertOwned();c.check(!active.has(journal));active.add(journal);let scope;
 try{const id=bundle.logical.transactionId,sequence=bundle.logical.transactionSequence;let events=journal.events(id),plan=events[0]?.plan;
  if(!plan){if(sequence>1)c.check(previous&&hashValue(journal.lastCheckpoint())===hashValue(previous.reference));c.iso(committedAt);const artifact=t.jsonArtifact(io.context,"bundle",bundle,retention);plan={descriptor:artifact.descriptor,committedAt,previous:previous?previous.reference:null,previousHash:previous?previous.hash:d.GENESIS,accelerator,softwareRevision};journal.append(id,"PENDING",{at:new Date(io.now()).toISOString(),plan});}
  c.check(hashValue(plan.descriptor)===hashValue(t.jsonArtifact(io.context,"bundle",bundle,plan.descriptor.requiredRetention).descriptor));const remaining=Math.min(timeoutMs,60000-(io.now()-Date.parse(plan.committedAt)));c.check(remaining>0&&remaining<=60000,"BACKUP_TIMEOUT");scope=injectedScope||deadline({timeoutMs:remaining,signal});scope.assert();
  if(plan.previous){const old=await d.readCheckpoint(io,plan.previous,{scope});c.check(old.hash===plan.previousHash&&old.checkpoint.sequence+1===sequence);}else c.check(sequence===1&&plan.previousHash===d.GENESIS);
  const last=events.at(-1);if(last?.state==="FAILED_TERMINAL")throw c.failure(last.errorCode);if(last?.state==="OFF_DISK_VERIFIED"){const result=await d.readCheckpoint(io,last.checkpointReference,{scope});c.check(result.bundle.bundleId===bundle.bundleId);return {...result,simulated:true,productionDurability:false};}
  let attempt=last?.attempt||0;
  function event(state,extra={}){journal.append(id,state,{attempt,at:new Date(io.now()).toISOString(),...extra});}
  // An interrupted attempt can reconcile without starting a fifth provider attempt.
  const existing=await io.list(t.slot(io.context,sequence),null,2,scope);c.check(existing.cursor===null&&existing.items.length<=1);
  if(existing.items.length){const result=await d.readCheckpoint(io,existing.items[0],{scope});c.check(result.bundle.bundleId===bundle.bundleId&&result.checkpoint.previousHash===plan.previousHash);scope.assert();event("OFF_DISK_VERIFIED",{checkpointReference:result.reference});return {...result,simulated:true,productionDurability:false};}
  for(;attempt<4;){attempt++;scope.assert();journal.assertOwned();event("UPLOADING");try{
   const artifact={descriptor:plan.descriptor,source:t.jsonArtifact(io.context,"bundle",bundle,plan.descriptor.requiredRetention).source};const uploaded=await io.publish(artifact,{scope,hook:point=>{hook(point);if(point==="after-upload")event("UPLOADED");}});event("VERIFYING",{artifactReference:uploaded.ref});hook("verified");
   const receipt=await io.publish(t.jsonArtifact(io.context,"receipt",uploaded.receipt,plan.descriptor.requiredRetention),{scope});hook("after-receipt");event("CHECKPOINT_PENDING",{artifactReference:receipt.ref});
   if(plan.accelerator&&io.now()<Date.parse(plan.accelerator.descriptor.requiredRetention.minimumRetainUntil))await io.read(plan.accelerator,{scope});
   const p=d.checkpoint({checkpointVersion:t.FORMATS.checkpoint,...io.context,sequence,previousHash:plan.previousHash,bundle:uploaded.ref,receipt:receipt.ref,accelerator:plan.accelerator,createdAt:plan.committedAt,softwareRevision:plan.softwareRevision},io.context);hook("before-checkpoint");journal.assertOwned();
   const sealed=await io.publish(t.jsonArtifact(io.context,"checkpoint",p,plan.descriptor.requiredRetention,sequence),{scope});hook("after-checkpoint");const result=await d.readCheckpoint(io,sealed.ref,{scope});scope.assert();event("OFF_DISK_VERIFIED",{checkpointReference:sealed.ref});return {...result,simulated:true,productionDurability:false};
  }catch(error){if(error?.fixtureCrash)throw error;const normalized=c.failure(error?.code,error?.retryable===true);event(normalized.retryable?"FAILED_RETRYABLE":"FAILED_TERMINAL",{errorCode:normalized.code});if(!normalized.retryable||attempt>=4||scope.signal.aborted)throw normalized;const jitter=random();c.check(Number.isFinite(jitter)&&jitter>=0&&jitter<1);const delay=Math.floor(Math.min(1000*2**(attempt-1),8000)*jitter);await scope.run(signal=>new Promise((resolve,reject)=>{const timers=require("node:timers"),timer=timers.setTimeout(done,delay);function done(){signal.removeEventListener("abort",abort);resolve();}function abort(){timers.clearTimeout(timer);reject(c.failure("BACKUP_TIMEOUT"));}signal.addEventListener("abort",abort,{once:true});}));}
  }throw c.failure("BACKUP_PROVIDER_ERROR");
 }finally{if(scope&&!injectedScope)scope.close();active.delete(journal);}
}
module.exports={deliver};
