"use strict";
const t=require("./kronos-signer-evidence"),crypto=require("node:crypto");
const p=require("../../kronos/research-qualification-preflight-contracts"),{openDurableJournal}=require("../../kronos/research-qualification-preflight-journal");
const operator={operatorId:"offline-operator",publicKey:t.extraKey.publicKey,keyFingerprint:t.s.fingerprint(t.extraKey.publicKey),
 domains:["provider","runtime","restore","independent-restore"],deploymentIds:["fixture"],streamIds:[t.f.binding.streamId],
 notBefore:t.iso(t.f.time-86400000),notAfter:t.iso(t.f.time+86400000),status:"ACTIVE"};
function authority(operators=[operator]){return p.createOperatorAuthority({operators,binding:t.f.binding});}
function signApproval(body){const approval=t.rehash(body,"approvalHash");return {approval,signature:crypto.sign(null,p.approvalBytes(approval),t.extraKey.privateKey).toString("base64")};}
function approved(r,a){return signApproval({version:p.VERSION.approval,operatorId:operator.operatorId,scope:"ISSUE_ATTESTATION",
 domain:t.s.role(a),environmentId:a.binding.environmentId,streamId:a.binding.streamId,requestId:r.requestId,requestHash:r.requestHash,
 evidenceHash:a.evidenceHash,signerId:r.signerId,registryHash:r.registryHash,runId:a.runId,issuedAt:t.f.instant,expiresAt:r.expiresAt,
 nonce:t.f.hashValue("approval-"+r.requestHash),auditRef:r.operatorRef});}
function candidate(id="provider",full=false,reg=t.registry()){
 const a=id==="independent"?t.f.attestation("restore",t.f.restoreEvidence(true,true)):id==="restore"?t.f.attestation("restore",t.f.restoreEvidence(full)):t.f.attestation(id);
 const r=t.request(a,reg,id);return {request:r,attestation:a,approval:approved(r,a)};
}
function config({mode="initialize-new",witness,reg=t.registry(),at=t.f.time,pins=[reg.registryHash],operatorAuthority=authority()}={}){
 return {mode,storeId:"offline-preflight-store",binding:t.f.binding,operatorAuthority,approvedRegistryPins:pins,
 initialRegistry:reg,provenanceRef:"reviewed-public-key-fixture",witness,now:()=>at};
}
function grant(auth,data,reg=t.registry(),at=t.f.time){return auth.authorize({...data,registry:reg,at});}
function issue(j,auth,data,reg=t.registry()){
 j.reserve(grant(auth,data,reg));const e=t.signed(data.attestation,data.request,reg);
 j.recordEnvelope(data.request.requestId,e);j.recordReceipt(data.request.requestId);j.complete(data.request.requestId);return e;
}
function removeTemp(root){const fs=require("node:fs"),path=require("node:path"),os=require("node:os");if(path.dirname(path.resolve(root))!==path.resolve(os.tmpdir())||!path.basename(root).startsWith("pti-signer-"))throw Error("UNSAFE_TEMP_ROOT");fs.rmSync(root,{recursive:true,force:true});}
module.exports={t,p,operator,authority,signApproval,approved,candidate,config,grant,issue,openDurableJournal,removeTemp};
