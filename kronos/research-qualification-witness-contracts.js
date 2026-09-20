"use strict";
const crypto=require("node:crypto"),c=require("./research-backup-contracts"),s=require("./research-qualification-signer-contracts"),q=require("./research-qualification-contracts");
const {canonicalize}=require("./research-canonical"),{hashValue}=require("./research-hash");
const V=Object.freeze({identity:"KRONOS_WITNESS_IDENTITY_V1",append:"KRONOS_WITNESS_APPEND_V1",checkpoint:"KRONOS_WITNESS_CHECKPOINT_V1",receipt:"KRONOS_WITNESS_RECEIPT_V1",ack:"KRONOS_WITNESS_ACK_V1",view:"KRONOS_WITNESS_VIEW_V1",vault:"KRONOS_WITNESS_FAKE_VAULT_RECEIPT_V1",policy:"KRONOS_WITNESS_POLICY_V1"});
const LEASE_MS=300000;
function fail(code){throw Object.assign(new Error(code),{code});}
function check(ok,code="WITNESS_INVALID"){if(!ok)fail(code);}
function seal(body,key){const {[key]:ignored,...value}=body;return {...value,[key]:hashValue(value)};}
function hashed(v,key){const {[key]:hash,...body}=v;c.digest(hash);check(hash===hashValue(body));}
function positive(n){check(Number.isSafeInteger(n)&&n>0);}
function digestOrNull(v){if(v!==null)c.digest(v);}
function identity(v){
 c.shape(v,"version,witnessId,epoch,publicKey,keyFingerprint,environmentId,streamId,policyVersion,qualificationPolicyVersion,stores");
 check(v.version===V.identity&&v.policyVersion===V.policy&&v.qualificationPolicyVersion==="KRONOS_QUALIFICATION_POLICY_V1");
 c.label(v.witnessId);positive(v.epoch);c.identity({environmentId:v.environmentId,streamId:v.streamId});check(v.keyFingerprint===s.fingerprint(v.publicKey));
 check(Array.isArray(v.stores)&&v.stores.length>0&&v.stores.length<=16);const ids=new Set();
 for(const row of v.stores){c.shape(row,"storeId,writerEpoch,domains");c.label(row.storeId);positive(row.writerEpoch);check(!ids.has(row.storeId));ids.add(row.storeId);
  check(Array.isArray(row.domains)&&row.domains.length>0&&new Set(row.domains).size===row.domains.length&&row.domains.every(x=>["provider","runtime","restore","independent-restore"].includes(x)));}
 return v;
}
function context(v,id){check(v.witnessId===id.witnessId&&v.witnessEpoch===id.epoch&&v.environmentId===id.environmentId&&v.streamId===id.streamId&&v.policyVersion===id.policyVersion,"WITNESS_IDENTITY");}
function lane(v,id){context(v,id);const row=id.stores.find(x=>x.storeId===v.storeId);check(row&&row.writerEpoch===v.writerEpoch,"WRITER_EPOCH");q.equal(v.domains,row.domains);return row;}
function common(id,row){return {witnessId:id.witnessId,witnessEpoch:id.epoch,environmentId:id.environmentId,streamId:id.streamId,policyVersion:id.policyVersion,storeId:row.storeId,writerEpoch:row.writerEpoch,domains:structuredClone(row.domains)};}
function checkpoint(v,id){
 c.shape(v,"version,witnessId,witnessEpoch,environmentId,streamId,policyVersion,storeId,writerEpoch,domains,journalSequence,journalHash,previousCheckpointHash,registryRevision,registryHash,consumedHash,issuanceCoreHash,checkpointHash");
 check(v.version===V.checkpoint);lane(v,id);positive(v.journalSequence);positive(v.registryRevision);for(const k of ["journalHash","registryHash","consumedHash","issuanceCoreHash"])c.digest(v[k]);digestOrNull(v.previousCheckpointHash);hashed(v,"checkpointHash");return v;
}
function append(v,id){
 c.shape(v,"version,witnessId,witnessEpoch,environmentId,streamId,policyVersion,storeId,writerEpoch,domains,fromSequence,toSequence,previousCheckpointHash,events,checkpoint,requestedAt,appendHash");
 check(v.version===V.append);lane(v,id);positive(v.fromSequence);positive(v.toSequence);check(v.toSequence>=v.fromSequence);digestOrNull(v.previousCheckpointHash);c.iso(v.requestedAt);
 check(Array.isArray(v.events)&&v.events.length>0&&v.events.length<=256&&v.events.length===v.toSequence-v.fromSequence+1);check(Buffer.byteLength(canonicalize(v))<=2097152);
 for(const row of v.events){c.shape(row,"event,hash");c.digest(row.hash);check(hashValue(row.event)===row.hash,"EVENT_HASH");}
 checkpoint(v.checkpoint,id);check(v.checkpoint.storeId===v.storeId&&v.checkpoint.journalSequence===v.toSequence&&v.checkpoint.previousCheckpointHash===v.previousCheckpointHash);hashed(v,"appendHash");return v;
}
function receipt(v,id){
 c.shape(v,"version,witnessId,witnessEpoch,environmentId,streamId,policyVersion,sequence,previousReceiptHash,appendHash,checkpoint,acceptedAt,receiptHash");
 check(v.version===V.receipt);context(v,id);positive(v.sequence);digestOrNull(v.previousReceiptHash);c.digest(v.appendHash);checkpoint(v.checkpoint,id);c.iso(v.acceptedAt);hashed(v,"receiptHash");return v;
}
function vaultReceipt(v){c.shape(v,"version,vaultId,sequence,previousHash,entryHash,receiptHash");check(v.version===V.vault);c.label(v.vaultId);positive(v.sequence);digestOrNull(v.previousHash);c.digest(v.entryHash);hashed(v,"receiptHash");return v;}
function ackBody(v,id){c.shape(v,"version,receipt,vaultReceipt,keyFingerprint");check(v.version===V.ack&&v.keyFingerprint===id.keyFingerprint);receipt(v.receipt,id);vaultReceipt(v.vaultReceipt);check(v.receipt.sequence===v.vaultReceipt.sequence);return v;}
function viewBody(v,id){
 c.shape(v,"version,witnessId,witnessEpoch,environmentId,streamId,policyVersion,storeId,writerEpoch,domains,sequence,receiptHash,checkpoint,registryRevision,registryHash,challengeNonce,issuedAt,expiresAt,keyFingerprint");
 check(v.version===V.view&&v.keyFingerprint===id.keyFingerprint);lane(v,id);positive(v.sequence);c.digest(v.receiptHash);checkpoint(v.checkpoint,id);check(v.checkpoint.storeId===v.storeId);positive(v.registryRevision);c.digest(v.registryHash);c.digest(v.challengeNonce);check(s.time(v.expiresAt)-s.time(v.issuedAt)===LEASE_MS);return v;
}
function signedBytes(body){return Buffer.from(body.version+"\n"+canonicalize(body),"utf8");}
function verifySigned(signed,id,kind){c.shape(signed,"body,signature");(kind==="ack"?ackBody:viewBody)(signed.body,id);check(typeof signed.signature==="string"&&/^[A-Za-z0-9+/]{86}==$/.test(signed.signature),"WITNESS_SIGNATURE");check(crypto.verify(null,signedBytes(signed.body),s.publicKey(id.publicKey),Buffer.from(signed.signature,"base64")),"WITNESS_SIGNATURE");return signed.body;}
function createVerifier({identity:configuredIdentity,vaultId}){
 const id=structuredClone(identity(configuredIdentity));c.label(vaultId);
 return Object.freeze({
  acknowledgment(signed,entry){const body=verifySigned(signed,id,"ack");check(body.vaultReceipt.vaultId===vaultId,"VAULT_RECEIPT");c.shape(entry,"append,receipt");append(entry.append,id);receipt(entry.receipt,id);q.equal(body.receipt,entry.receipt);check(body.vaultReceipt.entryHash===hashValue(entry)&&entry.receipt.appendHash===entry.append.appendHash,"VAULT_READBACK");q.equal(entry.receipt.checkpoint,entry.append.checkpoint);return true;},
  freshView(signed,{storeId,challengeNonce,now,minimumSequence=1,expectedReceiptHash}){const v=verifySigned(signed,id,"view");check(Number.isFinite(now)&&s.time(v.issuedAt)<=now&&now<s.time(v.expiresAt),"VIEW_EXPIRED");check(v.storeId===storeId&&v.challengeNonce===challengeNonce&&v.sequence>=minimumSequence,"VIEW_ROLLBACK");if(expectedReceiptHash!==undefined)check(v.receiptHash===expectedReceiptHash,"VIEW_ROLLBACK");return true;}
 });
}
module.exports={V,LEASE_MS,fail,check,seal,hashed,positive,identity,lane,common,checkpoint,append,receipt,vaultReceipt,ackBody,viewBody,signedBytes,verifySigned,createVerifier,canonicalize,hashValue};
