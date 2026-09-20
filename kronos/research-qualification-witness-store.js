"use strict";
const w=require("./research-qualification-witness-contracts"),state=require("./research-qualification-witness-state"),{openDisk}=require("./research-qualification-witness-disk");
const c=require("./research-backup-contracts"),q=require("./research-qualification-contracts"),s=require("./research-qualification-signer-contracts");
function openWitness(file,options){
 const {mode,vault,signWitness,operatorAuthority,now=Date.now,hook=()=>{}}=options;
 const config={identity:structuredClone(w.identity(options.identity)),binding:structuredClone(options.binding),registryPins:[...options.registryPins],operatorAuthority};
 q.binding(config.binding);w.check(config.binding.environmentId===config.identity.environmentId&&config.binding.streamId===config.identity.streamId&&config.binding.qualificationPolicyVersion===config.identity.qualificationPolicyVersion);
 config.registryPins.forEach(c.digest);operatorAuthority.assertIndependent({signers:[{keyFingerprint:config.identity.keyFingerprint}]});c.label(options.vaultId);w.check(typeof signWitness==="function"&&vault&&typeof vault.latest==="function");const vaultId=options.vaultId;
 const disk=openDisk(file,{mode,metadata:{version:"KRONOS_WITNESS_STORE_V1",identity:config.identity,binding:config.binding,vaultId}});let frozen=null;
 function safe(fn){try{return fn();}catch(e){const allowed=["ROLLBACK_DETECTED","UNACKNOWLEDGED_LOCAL_STATE","FORK","VAULT_UNAVAILABLE","VAULT_READBACK","VAULT_RECEIPT","WITNESS_SIGNATURE","WRITER_OWNERSHIP_LOST","SIGNER_ROLLBACK_OR_GAP","CHECKPOINT_FORK","IDENTIFIER_REPLAY","REGISTRY_UNPINNED","REGISTRY_STALE","WRITER_EPOCH","VIEW_EXPIRED","RECOVERY_REQUIRED","WITNESS_INVALID","APPEND_EXPIRED","DUPLICATE_APPEND","EVENT_CONTINUITY","EVENT_HASH","EVENT_TIME","ISSUANCE_STATE","DOMAIN_DENIED","WITNESS_KEY_REUSE","REGISTRY_EXPIRED"];
  frozen=allowed.includes(e.code)?e.code:"WITNESS_INVALID";w.fail(frozen);}}
 function vaultCall(fn){try{return fn();}catch{w.fail("VAULT_UNAVAILABLE");}}
 function inspect(){
  disk.assertOwned();const data=disk.read(),model=state.replay(data.entries,config),head=vaultCall(()=>vault.latest());
  if(head!==null)w.vaultReceipt(head);
  const remote=head?.sequence||0,local=data.entries.length;
  w.check(remote<=local,"ROLLBACK_DETECTED");w.check(remote>=local,"UNACKNOWLEDGED_LOCAL_STATE");
  let previous=null;
  for(let i=0;i<local;i++){
   const record=vaultCall(()=>vault.read(i+1));c.shape(record,"entry,receipt");w.vaultReceipt(record.receipt);
   w.check(record.receipt.vaultId===vaultId&&record.receipt.sequence===i+1&&record.receipt.previousHash===previous,"VAULT_RECEIPT");
   w.check(record.receipt.entryHash===w.hashValue(record.entry),"VAULT_READBACK");w.check(w.canonicalize(record.entry)===w.canonicalize(data.entries[i]),"FORK");previous=record.receipt.receiptHash;
  }
  if(head)w.check(head.vaultId===vaultId&&head.receiptHash===previous,"VAULT_RECEIPT");
  return {data,model,head};
 }
 function ready(){w.check(!frozen,frozen||"WITNESS_INVALID");const v=inspect();w.check(v.data.completed===v.data.entries.length,"RECOVERY_REQUIRED");return v;}
 function signed(body,kind){const signature=signWitness(w.signedBytes(body));const out={body,signature};w.verifySigned(out,config.identity,kind);return out;}
 function acknowledgment(sequence){return safe(()=>{const {data}=ready();w.check(Number.isSafeInteger(sequence)&&sequence>0&&sequence<=data.completed);const entry=data.entries[sequence-1],remote=vaultCall(()=>vault.read(sequence));
  const result=signed({version:w.V.ack,receipt:entry.receipt,vaultReceipt:remote.receipt,keyFingerprint:config.identity.keyFingerprint},"ack");
  w.createVerifier({identity:config.identity,vaultId}).acknowledgment(result,entry);hook("acknowledgment-generated");return structuredClone(result);
 });}
 function append(request){return safe(()=>{
  const a=structuredClone(w.append(request,config.identity)),{data,model}=ready();w.check(!data.entries.some(e=>e.append.appendHash===a.appendHash),"DUPLICATE_APPEND");
  const at=now();w.check(Number.isFinite(at)&&(!data.entries.length||at>=s.time(data.entries.at(-1).receipt.acceptedAt)),"EVENT_TIME");state.consume(model,a,config,at);
  const receipt=w.seal({version:w.V.receipt,witnessId:config.identity.witnessId,witnessEpoch:config.identity.epoch,environmentId:config.identity.environmentId,streamId:config.identity.streamId,policyVersion:w.V.policy,
   sequence:model.sequence+1,previousReceiptHash:model.receiptHash,appendHash:a.appendHash,checkpoint:a.checkpoint,acceptedAt:new Date(at).toISOString()},"receiptHash");
  const entry={append:a,receipt};hook("before-local-transaction");const sequence=disk.append(entry);hook("local-transaction-committed");
  const accepted=vaultCall(()=>vault.append(entry));w.vaultReceipt(accepted);hook("vault-append-accepted");
  const checked=inspect();w.check(checked.head.receiptHash===accepted.receiptHash,"VAULT_RECEIPT");
  disk.complete(sequence);hook("local-completion-committed");const ack=acknowledgment(sequence);hook("acknowledgment-returned");return ack;
 });}
 function recoverPublication({operatorRef}){
  c.label(operatorRef);return safe(()=>{const data=disk.read();state.replay(data.entries,config);w.check(data.entries.length===data.completed+1,"RECOVERY_REQUIRED");
   const head=vaultCall(()=>vault.latest());if(head)w.vaultReceipt(head);const remote=head?.sequence||0;
   w.check(remote===data.completed||remote===data.entries.length,"ROLLBACK_DETECTED");
   if(remote===data.completed)vaultCall(()=>vault.append(data.entries.at(-1)));
   inspect();disk.complete(data.entries.length);frozen=null;return {recovered:true,operatorRef};
  });
 }
 function freshView({storeId,challengeNonce}){return safe(()=>{
  c.digest(challengeNonce);const {model,data}=ready(),lane=model.lanes.get(storeId);w.check(lane&&model.registry,"WITNESS_INVALID");const at=now();
  w.check(at>=s.time(data.entries.at(-1).receipt.acceptedAt)&&s.time(model.registry.createdAt)<=at&&at<s.time(model.registry.expiresAt),"REGISTRY_EXPIRED");
  const row=config.identity.stores.find(x=>x.storeId===storeId);return signed({version:w.V.view,...w.common(config.identity,row),sequence:model.sequence,receiptHash:model.receiptHash,checkpoint:lane.checkpoint,
   registryRevision:model.registry.registryRevision,registryHash:model.registry.registryHash,challengeNonce,issuedAt:new Date(at).toISOString(),expiresAt:new Date(at+w.LEASE_MS).toISOString(),keyFingerprint:config.identity.keyFingerprint},"view");
 });}
 // Startup can report a frozen state for explicit recovery, but never releases proofs from it.
 try{const v=inspect();if(v.data.completed!==v.data.entries.length)frozen="RECOVERY_REQUIRED";}catch(e){try{safe(()=>{throw e;});}catch{}}
 return Object.freeze({append,acknowledgment,freshView,recoverPublication,status(){if(!frozen)try{ready();}catch(e){try{safe(()=>{throw e;});}catch{}}return Object.freeze({state:frozen||"READY",simulated:true,productionReady:false,automaticCollectionReady:false,productionOffDiskVerified:false});},close:disk.close});
}
module.exports={openWitness};
