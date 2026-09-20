"use strict";
const crypto=require("node:crypto"),c=require("./research-backup-contracts"),s=require("./research-qualification-signer-contracts"),q=require("./research-qualification-contracts");
const {hashValue}=require("./research-hash");
const VERSION=Object.freeze({approval:"KRONOS_OPERATOR_APPROVAL_V1",journal:"KRONOS_DURABLE_ISSUANCE_V1",checkpoint:"KRONOS_ISSUANCE_CHECKPOINT_V1"});
function fail(code){throw Object.assign(new Error(code),{code});}
function check(ok,code="PREFLIGHT_INVALID"){if(!ok)fail(code);}
function freeze(v){if(v&&typeof v==="object"){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function hashCheck(v,field){const {[field]:digest,...body}=v;c.digest(digest);check(hashValue(body)===digest);}
function approval(a){
 c.shape(a,"version,operatorId,scope,domain,environmentId,streamId,requestId,requestHash,evidenceHash,signerId,registryHash,runId,issuedAt,expiresAt,nonce,auditRef,approvalHash");
 check(a.version===VERSION.approval&&a.scope==="ISSUE_ATTESTATION");
 for(const k of ["operatorId","requestId","signerId","runId","auditRef"])c.label(a[k]);
 c.identity({environmentId:a.environmentId,streamId:a.streamId});
 check(["provider","runtime","restore","independent-restore"].includes(a.domain));
 for(const k of ["requestHash","evidenceHash","registryHash","nonce"])c.digest(a[k]);
 check(s.time(a.expiresAt)>s.time(a.issuedAt)&&s.time(a.expiresAt)-s.time(a.issuedAt)<=s.MAX_REQUEST_MS);
 hashCheck(a,"approvalHash");q.safe(a);return a;
}
function approvalBytes(a){approval(a);return Buffer.from("KRONOS_OPERATOR_APPROVAL_V1\n"+a.approvalHash);}
function createOperatorAuthority({operators,binding}){
 q.binding(binding);const context=freeze(structuredClone(binding)),keys=new Map(),grants=new WeakMap();
 check(Array.isArray(operators)&&operators.length>0);
 for(const op of operators){
  c.shape(op,"operatorId,publicKey,keyFingerprint,domains,deploymentIds,streamIds,notBefore,notAfter,status");
  c.label(op.operatorId);check(!keys.has(op.operatorId)&&op.keyFingerprint===s.fingerprint(op.publicKey));
  check(["ACTIVE","REVOKED"].includes(op.status)&&s.time(op.notBefore)<s.time(op.notAfter));
  for(const k of ["domains","deploymentIds","streamIds"]){check(Array.isArray(op[k])&&op[k].length>0&&op[k].length<=32);op[k].forEach(c.label);}
  keys.set(op.operatorId,freeze(structuredClone(op)));
 }
 function assertIndependent(registry){check(!registry.signers.some(row=>[...keys.values()].some(op=>op.keyFingerprint===row.keyFingerprint)),"OPERATOR_NOT_INDEPENDENT");}
 function validate(signed,r,a,registry,at){
  c.shape(signed,"approval,signature");const v=approval(signed.approval),op=keys.get(v.operatorId);
  check(op&&op.status==="ACTIVE","OPERATOR_UNAUTHORIZED");
  check(op.domains.includes(s.role(a))&&op.deploymentIds.includes(a.binding.environmentId)&&op.streamIds.includes(a.binding.streamId),"OPERATOR_SCOPE");
  check(s.time(op.notBefore)<=at&&at<s.time(op.notAfter)&&s.time(v.issuedAt)<=at&&at<s.time(v.expiresAt),"OPERATOR_EXPIRED");
  assertIndependent(registry);
  s.assess(r,a,registry,context,at);
  check(v.domain===s.role(a)&&v.environmentId===a.binding.environmentId&&v.streamId===a.binding.streamId&&
   v.requestId===r.requestId&&v.requestHash===r.requestHash&&v.evidenceHash===a.evidenceHash&&
   v.signerId===r.signerId&&v.registryHash===r.registryHash&&v.runId===a.runId&&v.auditRef===r.operatorRef,"OPERATOR_BINDING");
  check(typeof signed.signature==="string"&&/^[A-Za-z0-9+/]{86}==$/.test(signed.signature),"OPERATOR_SIGNATURE");
  check(crypto.verify(null,approvalBytes(v),s.publicKey(op.publicKey),Buffer.from(signed.signature,"base64")),"OPERATOR_SIGNATURE");
  return true;
 }
 function authorize({request,attestation,approval:authorizedApproval,registry,at}){
  validate(authorizedApproval,request,attestation,registry,at);
  const data=freeze(structuredClone({request,attestation,approval:authorizedApproval}));
  const handle=Object.freeze({requestId:request.requestId});grants.set(handle,data);return handle;
 }
 function inspect(handle,registry,at){const data=grants.get(handle);check(data,"OPERATOR_UNAUTHORIZED");validate(data.approval,data.request,data.attestation,registry,at);return structuredClone(data);}
 return Object.freeze({authorize,inspect,validate,assertIndependent});
}
function verifyEnvelope(e,r,a,registry,at){
 s.envelope(e);q.equal(e.request,r);q.equal(e.attestation,a);
 check(s.time(registry.createdAt)<=at&&at<s.time(registry.expiresAt),"REGISTRY_EXPIRED");
 const signer=registry.signers.find(row=>row.signerId===e.signerId);check(signer,"SIGNER_UNAUTHORIZED");
 s.permitted(signer,a);s.active(signer,s.time(e.signedAt),true);s.freshAttestation(a,at);
 check(s.time(e.signedAt)<=at&&e.keyFingerprint===signer.keyFingerprint,"SIGNATURE_INVALID");
 check(signer.allowedServiceIdentities.includes(r.serviceIdentity),"SIGNER_UNAUTHORIZED");
 const key=s.publicKey(signer.publicKey),{contextSignature,envelopeHash,...body}=e;
 check(crypto.verify(null,q.signingBytes(a),key,Buffer.from(e.signature,"base64"))&&crypto.verify(null,s.envelopeBytes(body),key,Buffer.from(contextSignature,"base64")),"SIGNATURE_INVALID");
}
function receipt(e){return s.seal({version:s.VERSION.receipt,requestId:e.request.requestId,nonce:e.request.nonce,
 requestHash:e.request.requestHash,attestationHash:e.attestation.attestationHash,evidenceHash:e.attestation.evidenceHash,
 attestationType:e.attestation.attestationType,signedEnvelopeHash:e.envelopeHash,signerId:e.signerId,
 keyFingerprint:e.keyFingerprint,issuedAt:e.signedAt,result:"ISSUED",reason:null},"receiptHash");}
function checkpoint(v){
 c.shape(v,"version,storeId,sequence,chainHash,registryRevision,registryHash");
 check(v.version===VERSION.checkpoint);c.label(v.storeId);
 check(Number.isSafeInteger(v.sequence)&&v.sequence>=1&&Number.isSafeInteger(v.registryRevision)&&v.registryRevision>=1);
 c.digest(v.chainHash);c.digest(v.registryHash);q.safe(v);return v;
}
function kmsRawInput(a){const bytes=q.signingBytes(a);check(bytes.length<=4096,"KMS_INPUT_TOO_LARGE");return bytes;}
module.exports={kmsRawInput,VERSION,check,fail,freeze,hashCheck,approval,approvalBytes,createOperatorAuthority,verifyEnvelope,receipt,checkpoint};
