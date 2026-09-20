"use strict";
const w=require("./research-qualification-witness-contracts"),c=require("./research-backup-contracts"),s=require("./research-qualification-signer-contracts"),q=require("./research-qualification-contracts"),p=require("./research-qualification-preflight-contracts");
function empty(){return {lanes:new Map(),requests:new Map(),nonces:new Set(),approvalNonces:new Set(),registry:null,sequence:0,receiptHash:null};}
function consume(model,a,config,at,checkCheckpoint=true){
 const id=config.identity,row=w.lane(a,id);w.check(s.time(a.requestedAt)<=at&&at-s.time(a.requestedAt)<w.LEASE_MS,"APPEND_EXPIRED");
 let lane=model.lanes.get(a.storeId);if(!lane){lane={sequence:0,hash:null,checkpointHash:null,registry:null,at:null};model.lanes.set(a.storeId,lane);}
 w.check(a.previousCheckpointHash===lane.checkpointHash,"CHECKPOINT_FORK");w.check(a.fromSequence===lane.sequence+1,"SIGNER_ROLLBACK_OR_GAP");
 for(const item of a.events){const e=item.event;c.shape(e,"version,sequence,previousHash,kind,requestId,at,data");
  w.check(e.version===p.VERSION.journal&&e.sequence===lane.sequence+1&&e.previousHash===lane.hash&&item.hash===w.hashValue(e),"EVENT_CONTINUITY");
  const eventAt=s.time(e.at);w.check(eventAt<=at&&(!lane.at||eventAt>=s.time(lane.at)),"EVENT_TIME");
  if(e.kind==="REGISTRY"){
   c.shape(e.data,"registry,provenanceRef");c.label(e.data.provenanceRef);w.check(e.requestId===null);const reg=s.registry(e.data.registry);
   w.check(config.registryPins.includes(reg.registryHash),"REGISTRY_UNPINNED");config.operatorAuthority.assertIndependent(reg);
   w.check(!reg.signers.some(k=>k.keyFingerprint===id.keyFingerprint),"WITNESS_KEY_REUSE");
   if(lane.registry)s.rotation(lane.registry,reg);
   if(model.registry&&model.registry.registryHash!==reg.registryHash)s.rotation(model.registry,reg);
   w.check(s.time(reg.createdAt)<=eventAt&&eventAt<s.time(reg.expiresAt),"REGISTRY_EXPIRED");lane.registry=reg;model.registry=reg;
  }else{
   c.label(e.requestId);w.check(lane.registry&&model.registry.registryHash===lane.registry.registryHash,"REGISTRY_STALE");
   if(e.kind==="RESERVED"){
    c.shape(e.data,"request,attestation,approval");const {request:r,attestation,approval}=e.data;
    q.equal(attestation.binding,config.binding);w.check(row.domains.includes(s.role(attestation)),"DOMAIN_DENIED");
    config.operatorAuthority.validate(approval,r,attestation,lane.registry,eventAt);config.operatorAuthority.validate(approval,r,attestation,lane.registry,at);w.check(r.requestId===e.requestId);
    w.check(!model.requests.has(r.requestId)&&!model.nonces.has(r.nonce)&&!model.approvalNonces.has(approval.approval.nonce),"IDENTIFIER_REPLAY");
    model.requests.set(r.requestId,{...e.data,storeId:a.storeId,registry:lane.registry,reservedAt:e.at,state:"RESERVED",envelope:null,receipt:null});model.nonces.add(r.nonce);model.approvalNonces.add(approval.approval.nonce);
   }else{
    const r=model.requests.get(e.requestId);w.check(r&&r.storeId===a.storeId,"ISSUANCE_UNKNOWN");
    if(e.kind==="ENVELOPE"){
     w.check(r.state==="RESERVED"&&s.time(e.data.signedAt)>=s.time(r.reservedAt),"ISSUANCE_STATE");p.verifyEnvelope(e.data,r.request,r.attestation,r.registry,eventAt);p.verifyEnvelope(e.data,r.request,r.attestation,lane.registry,eventAt);r.envelope=e.data;r.state="ENVELOPE";
    }else if(e.kind==="RECEIPT"){
     w.check(r.state==="ENVELOPE","ISSUANCE_STATE");p.verifyEnvelope(r.envelope,r.request,r.attestation,lane.registry,eventAt);s.receipt(e.data);q.equal(e.data,p.receipt(r.envelope));r.receipt=e.data;r.state="RECEIPT";
    }else if(e.kind==="COMPLETED"){
     w.check(r.state==="RECEIPT","ISSUANCE_STATE");p.verifyEnvelope(r.envelope,r.request,r.attestation,lane.registry,eventAt);c.shape(e.data,"envelopeHash,receiptHash");w.check(e.data.envelopeHash===r.envelope.envelopeHash&&e.data.receiptHash===r.receipt.receiptHash);r.state="COMPLETED";
    }else w.fail("EVENT_KIND");
   }
  }
  lane.sequence=e.sequence;lane.hash=item.hash;lane.at=e.at;
 }
 w.check(lane.registry&&a.toSequence===lane.sequence);w.check(s.time(lane.registry.createdAt)<=at&&at<s.time(lane.registry.expiresAt),"REGISTRY_EXPIRED");
 const requests=[...model.requests.values()].filter(r=>r.storeId===a.storeId).sort((x,y)=>x.request.requestId<y.request.requestId?-1:x.request.requestId>y.request.requestId?1:0);
 const checkpoint=w.seal({version:w.V.checkpoint,...w.common(id,row),journalSequence:lane.sequence,journalHash:lane.hash,previousCheckpointHash:lane.checkpointHash,
  registryRevision:lane.registry.registryRevision,registryHash:lane.registry.registryHash,
  consumedHash:w.hashValue(requests.map(r=>({requestId:r.request.requestId,nonce:r.request.nonce,approvalNonce:r.approval.approval.nonce,requestHash:r.request.requestHash,evidenceHash:r.attestation.evidenceHash,signerId:r.request.signerId}))),
  issuanceCoreHash:w.hashValue(requests.filter(r=>r.state==="COMPLETED").map(r=>({request:r.request,attestation:r.attestation,approval:r.approval,envelope:r.envelope,receipt:r.receipt})))},"checkpointHash");
 if(checkCheckpoint)q.equal(a.checkpoint,checkpoint);lane.checkpointHash=checkpoint.checkpointHash;lane.checkpoint=checkpoint;return checkpoint;
}
function replay(entries,config){const model=empty();for(const entry of entries){c.shape(entry,"append,receipt");w.append(entry.append,config.identity);w.receipt(entry.receipt,config.identity);const r=entry.receipt;
 w.check(r.sequence===model.sequence+1&&r.previousReceiptHash===model.receiptHash&&r.appendHash===entry.append.appendHash,"RECEIPT_CONTINUITY");
 consume(model,entry.append,config,s.time(r.acceptedAt));q.equal(r.checkpoint,entry.append.checkpoint);model.sequence=r.sequence;model.receiptHash=r.receiptHash;
 }return model;}
module.exports={empty,consume,replay};
