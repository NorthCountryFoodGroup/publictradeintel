"use strict";
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto");
const f=require("./kronos-preflight-evidence"),w=require("../../kronos/research-qualification-witness-contracts"),state=require("../../kronos/research-qualification-witness-state");
const {openWitness}=require("../../kronos/research-qualification-witness-store"),{recoverOwnership}=require("../../kronos/research-qualification-witness-disk"),{openFakeVault}=require("./kronos-witness-vault");
// Deterministic fictional seed, never operational key generation.
const privateKey=crypto.createPrivateKey({key:Buffer.concat([Buffer.from("302e020100300506032b657004220420","hex"),Buffer.alloc(32,102)]),format:"der",type:"pkcs8"});
const publicKey=crypto.createPublicKey(privateKey).export({format:"pem",type:"spki"});
function identity(){return {version:w.V.identity,witnessId:"fictional-witness",epoch:1,publicKey,keyFingerprint:f.t.s.fingerprint(publicKey),environmentId:f.t.f.binding.environmentId,streamId:f.t.f.binding.streamId,policyVersion:w.V.policy,qualificationPolicyVersion:f.t.f.binding.qualificationPolicyVersion,
 stores:[{storeId:"ordinary-store",writerEpoch:1,domains:["provider","runtime","restore"]},{storeId:"independent-store",writerEpoch:1,domains:["independent-restore"]}]};}
function config(extra={}){return {identity:identity(),binding:f.t.f.binding,registryPins:[f.t.registry().registryHash],operatorAuthority:f.authority(),vaultId:"fictional-vault",signWitness:bytes=>crypto.sign(null,bytes,privateKey).toString("base64"),now:()=>f.t.f.time,...extra};}
function eventHistory(id="provider",reg=f.t.registry()){
 const candidate=f.candidate(id,false,reg),envelope=f.t.signed(candidate.attestation,candidate.request,reg),receipt=f.t.receipt(envelope);let prior=null;
 return [["REGISTRY",null,{registry:reg,provenanceRef:"reviewed-fixture"}],["RESERVED",candidate.request.requestId,candidate],["ENVELOPE",candidate.request.requestId,envelope],["RECEIPT",candidate.request.requestId,receipt],["COMPLETED",candidate.request.requestId,{envelopeHash:envelope.envelopeHash,receiptHash:receipt.receiptHash}]].map(([kind,requestId,data],i)=>{const event={version:f.p.VERSION.journal,sequence:i+1,previousHash:prior,kind,requestId,at:f.t.f.instant,data};const hash=w.hashValue(event);prior=hash;return {event,hash};});
}
function rechain(events,start=1,prior=null){return events.map(row=>{const event={...structuredClone(row.event),sequence:start++,previousHash:prior};prior=w.hashValue(event);return {event,hash:prior};});}
function request(events,{entries=[],storeId="ordinary-store",cfg=config()}={}){
 const model=state.replay(entries,cfg),row=cfg.identity.stores.find(x=>x.storeId===storeId),lane=model.lanes.get(storeId);
 const body={version:w.V.append,...w.common(cfg.identity,row),fromSequence:events[0].event.sequence,toSequence:events.at(-1).event.sequence,previousCheckpointHash:lane?.checkpointHash||null,events:structuredClone(events),checkpoint:null,requestedAt:f.t.f.instant};
 body.checkpoint=state.consume(model,body,cfg,f.t.f.time,false);return w.seal(body,"appendHash");
}
function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),"pti-signer-witness-"));}
function open(root,{mode="initialize-new",cfg=config(),vaultWrap=v=>v,...extra}={}){const vault=openFakeVault(path.join(root,"vault.sqlite"),{mode});try{const witness=openWitness(path.join(root,"witness.sqlite"),{...cfg,...extra,mode,vault:vaultWrap(vault)});return {vault,witness,close(){witness.close();vault.close();}};}catch(e){vault.close();throw e;}}
function recoverLocks(root){for(const name of ["vault","witness"]){const file=path.join(root,name+".sqlite"),lock=file+".writer.lock";if(fs.existsSync(lock))recoverOwnership(file,{expectedOwnerId:JSON.parse(fs.readFileSync(lock)).ownerId,operatorRef:"reviewed-dead-process-fixture"});}}
module.exports={f,w,state,identity,config,eventHistory,rechain,request,temp,open,openWitness,openFakeVault,recoverLocks,remove:f.removeTemp};
