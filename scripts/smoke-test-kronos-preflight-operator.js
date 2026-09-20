"use strict";
const assert=require("node:assert/strict"),guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
try{
 const f=require("./fixtures/kronos-preflight-evidence"),data=f.candidate(),reg=f.t.registry(),auth=f.authority();
 const h=f.grant(auth,data);assert.equal(auth.inspect(h,reg,f.t.f.time).request.requestHash,data.request.requestHash);
 assert.throws(()=>auth.inspect({...h},reg,f.t.f.time));assert.throws(()=>auth.inspect(f.grant(f.authority(),data),reg,f.t.f.time));
 for(const k of ["operatorId","domain","environmentId","streamId","requestHash","evidenceHash","signerId","registryHash","runId","auditRef"]){
  const bad=structuredClone(data);bad.approval.approval[k]=k.endsWith("Hash")?"0".repeat(64):"foreign";
  assert.throws(()=>f.grant(auth,bad),k);
 }
 const badSignature=structuredClone(data);badSignature.approval.signature=Buffer.alloc(64).toString("base64");assert.throws(()=>f.grant(auth,badSignature));
 const unsigned=structuredClone(data);delete unsigned.approval.signature;assert.throws(()=>f.grant(auth,unsigned));
 const badEvidence=structuredClone(data);badEvidence.attestation.evidence.encryption="aws:kms";assert.throws(()=>f.grant(auth,badEvidence));
 assert.throws(()=>f.grant(auth,data,reg,f.t.f.time+300000));
 const revoked=f.authority([{...f.operator,status:"REVOKED"}]);assert.throws(()=>f.grant(revoked,data));
 for(const name of ["LOGIN_PIN","ADMIN_PIN","KRONOS_SERVICE_TOKEN","privateKey","sessionToken","Authorization","cookies","environmentDump"]){
  const bad=structuredClone(data);bad.approval.approval[name]="forbidden";assert.throws(()=>f.grant(auth,bad));
 }
 const shared=f.authority([{...f.operator,publicKey:reg.signers[0].publicKey,keyFingerprint:reg.signers[0].keyFingerprint}]);
 assert.throws(()=>shared.assertIndependent(reg),{code:"OPERATOR_NOT_INDEPENDENT"});
 for(const field of ["domain","environmentId","streamId","requestId","requestHash","evidenceHash","signerId","registryHash","runId","auditRef"]){
  const bad=structuredClone(data),body=bad.approval.approval;body[field]=field.endsWith("Hash")?"0".repeat(64):field==="domain"?"runtime":field==="environmentId"?"staging":"foreign";
  bad.approval=f.signApproval(body);assert.throws(()=>f.grant(auth,bad),field+" correctly signed but wrong binding");
 }
 const badRequest=structuredClone(data);badRequest.request.serviceIdentity="unapproved-observer";
 badRequest.request=f.t.rehash(badRequest.request,"requestHash");badRequest.approval=f.approved(badRequest.request,badRequest.attestation);
 assert.throws(()=>f.grant(auth,badRequest),{code:"SIGNER_UNAUTHORIZED"});
 assert.equal(Object.hasOwn(auth,"sign"),false);
 guard.assertClean();console.log("Operator signature, independent trust root, exact scope/request approval, private grants, dual authorization, expiry and secret rejection: PASS");
}finally{guard.restore();}
