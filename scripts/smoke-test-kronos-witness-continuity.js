"use strict";
const assert=require("node:assert/strict"),guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork(),t=require("./fixtures/kronos-witness-evidence");
function scenario(fn,cfg){const root=t.temp();let x;try{x=t.open(root,{cfg:cfg||t.config()});fn(x);}finally{if(x)x.close();t.remove(root);}}
function altered(a,edit){const v=structuredClone(a);edit(v);for(const row of v.events)row.hash=t.w.hashValue(row.event);return t.w.seal((({appendHash,...body})=>body)(v),"appendHash");}
try{
 const all=t.eventHistory();
 scenario(x=>{const first=t.request(all.slice(0,2));x.witness.append(first);const entries=[x.vault.read(1).entry],rest=t.request(all.slice(2),{entries});x.witness.append(rest);assert.equal(x.vault.latest().sequence,2);assert.throws(()=>x.witness.append(rest),{code:"DUPLICATE_APPEND"});assert.equal(x.vault.latest().sequence,2);});
 for(const edit of [a=>a.fromSequence=2,a=>a.toSequence=99,a=>a.previousCheckpointHash="a".repeat(64),a=>a.events[1].event.sequence=3,a=>a.events.reverse(),a=>a.events[1].event.previousHash="a".repeat(64),a=>a.environmentId="staging",a=>a.streamId="foreign-stream",a=>a.storeId="unknown-store",a=>a.writerEpoch=2,a=>a.events[1].event.data.request.privateKey="forbidden"]){
  scenario(x=>{assert.throws(()=>x.witness.append(altered(t.request(all),edit)));assert.equal(x.vault.latest(),null);assert.notEqual(x.witness.status().state,"READY");});
 }
 // Signer rollback and a conflicting continuation never obtain another acknowledgment.
 scenario(x=>{x.witness.append(t.request(all));assert.throws(()=>x.witness.append(t.request(all.slice(0,2))));assert.equal(x.vault.latest().sequence,1);});
 scenario(x=>{x.witness.append(t.request(all.slice(0,2)));const alternate=t.eventHistory();alternate[0].event.data.provenanceRef="conflicting-lineage";const fork=t.rechain(alternate);assert.throws(()=>x.witness.append(t.request(fork)));assert.equal(x.vault.latest().sequence,1);});
 // Each consumed identifier is independently permanent, including across registered stores.
 for(const field of ["requestId","nonce","approvalNonce"]){scenario(x=>{
  x.witness.append(t.request(all));const entries=[x.vault.read(1).entry],candidate=t.f.candidate("runtime");
  if(field==="requestId")candidate.request.requestId="request-provider";if(field==="nonce")candidate.request.nonce=t.f.candidate().request.nonce;
  candidate.request=t.f.t.rehash(candidate.request,"requestHash");candidate.approval=t.f.approved(candidate.request,candidate.attestation);
  if(field==="approvalNonce")candidate.approval=t.f.signApproval({...candidate.approval.approval,nonce:t.f.candidate().approval.approval.nonce});
  const event={version:t.f.p.VERSION.journal,sequence:6,previousHash:all.at(-1).hash,kind:"RESERVED",requestId:candidate.request.requestId,at:t.f.t.f.instant,data:candidate};
  assert.throws(()=>t.request([{event,hash:t.w.hashValue(event)}],{entries}),{code:"IDENTIFIER_REPLAY"});assert.equal(x.vault.latest().sequence,1);
 });}
 // The same approval/request namespace is enforced across ordinary and independent store lanes.
 scenario(x=>{x.witness.append(t.request(all));const independent=t.eventHistory("independent").slice(0,2),data=independent[1].event.data;
  data.request.nonce=t.f.candidate().request.nonce;data.request=t.f.t.rehash(data.request,"requestHash");data.approval=t.f.approved(data.request,data.attestation);
  const cross=t.request(t.rechain(independent),{storeId:"independent-store"});assert.throws(()=>x.witness.append(cross),{code:"IDENTIFIER_REPLAY"});assert.equal(x.vault.latest().sequence,1);
 });
 scenario(x=>{x.witness.append(t.request(all));const independent=t.eventHistory("independent"),entries=[x.vault.read(1).entry];x.witness.append(t.request(independent,{storeId:"independent-store",entries}));assert.equal(x.vault.latest().sequence,2);assert.equal(x.witness.freshView({storeId:"independent-store",challengeNonce:"b".repeat(64)}).body.checkpoint.storeId,"independent-store");});
 const reg=t.f.t.registry(),next=structuredClone(reg);next.registryRevision=2;next.createdAt=t.f.t.f.instant;const revised=t.f.t.rehash(next,"registryHash"),cfg=t.config({registryPins:[reg.registryHash,revised.registryHash]});
 scenario(x=>{x.witness.append(t.request(all));const entries=[x.vault.read(1).entry],event={version:t.f.p.VERSION.journal,sequence:6,previousHash:all.at(-1).hash,kind:"REGISTRY",requestId:null,at:t.f.t.f.instant,data:{registry:revised,provenanceRef:"approved-renewal"}};
  x.witness.append(t.request([{event,hash:t.w.hashValue(event)}],{entries,cfg}));assert.equal(x.witness.freshView({storeId:"ordinary-store",challengeNonce:"a".repeat(64)}).body.registryRevision,2);
  const old={...event,sequence:7,previousHash:t.w.hashValue(event),data:{registry:reg,provenanceRef:"rollback"}};assert.throws(()=>t.request([{event:old,hash:t.w.hashValue(old)}],{entries:[...entries,x.vault.read(2).entry],cfg}));
 },cfg);
 scenario(x=>{const bad=structuredClone(reg);bad.registryRevision=2;const events=t.eventHistory("provider",t.f.t.rehash(bad,"registryHash"));assert.throws(()=>t.request(events),{code:"REGISTRY_UNPINNED"});});
 guard.assertClean();console.log("Witness journal continuity, gaps/reordering/forks, signer rollback, registry pins/lineage and all consumed identifiers: PASS");
}finally{guard.restore();}
