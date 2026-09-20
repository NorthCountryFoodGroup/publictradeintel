"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork(),f=require("./fixtures/kronos-preflight-evidence"),{consumeQualification}=require("../kronos/research-qualification-preflight-gate");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"pti-signer-gate-"));
const handles=[];function open(...args){const handle=f.openDurableJournal(...args);handles.push(handle);return handle;}
try{
 const reg=f.t.registry(),rev=structuredClone(reg);rev.registryRevision=2;rev.createdAt=f.t.f.instant;
 rev.signers[0].status="REVOKED";rev.signers[0].revokedAt=f.t.f.instant;rev.signers[0].revocationReasonCode="COMPROMISE";
 const revoked=f.t.rehash(rev,"registryHash"),pins=[reg.registryHash,revoked.registryHash],auth=f.authority(),file=path.join(root,"journal.sqlite");
 let j=open(file,f.config({operatorAuthority:auth,pins}));const initial=j.checkpoint();j.close();
 const oldFile=path.join(root,"old.sqlite");fs.copyFileSync(file,oldFile);
 j=open(file,f.config({mode:"open-existing",witness:initial,operatorAuthority:auth,pins}));
 assert.throws(()=>j.reserve({requestId:"request-provider"}));assert.throws(()=>j.recordReceipt("request-provider"));
 const provider=f.candidate();j.reserve(f.grant(auth,provider));
 const forged=f.t.signed(provider.attestation,provider.request,reg,"runtime");assert.throws(()=>j.recordEnvelope(provider.request.requestId,forged));
 assert.equal(j.state(provider.request.requestId),"RESERVED");
 j.recordEnvelope(provider.request.requestId,f.t.signed(provider.attestation,provider.request,reg));j.recordReceipt(provider.request.requestId);j.complete(provider.request.requestId);
 f.issue(j,auth,f.candidate("runtime"));f.issue(j,auth,f.candidate("restore"));
 const requestIds=["request-provider","request-runtime","request-restore"];
 const consume=(witness,at=f.t.f.time)=>consumeQualification({journal:j,witness,operatorAuthority:auth,binding:f.t.f.binding,requestIds,now:()=>at});
 assert.equal(consume(initial).trusted,false);const current=j.checkpoint(),partial=consume(current);
 assert.equal(partial.trusted,true);assert.equal(partial.state,"PARTIALLY_QUALIFIED");assert.deepEqual(partial.missingCoverage,["forecast","correction","outcome"]);
 assert.equal(partial.productionOffDiskVerified,false);assert.equal(partial.automaticCollectionReady,false);
 assert.equal(consume(current,f.t.f.time+3600000).trusted,false);
 const foreign={...f.t.f.binding,softwareRevision:"other-revision"};
 assert.equal(consumeQualification({journal:j,witness:current,operatorAuthority:auth,binding:foreign,requestIds,now:()=>f.t.f.time}).trusted,false);
 assert.equal(consumeQualification({journal:{material:()=>j.material(current)},witness:current,operatorAuthority:auth,binding:f.t.f.binding,requestIds}).trusted,false);
 const unsignedRegistry=structuredClone(reg);unsignedRegistry.registryRevision=3;
 assert.throws(()=>j.publishRegistry(f.t.rehash(unsignedRegistry,"registryHash"),"unapproved"));
 j.publishRegistry(revoked,"reviewed-revocation");const revWitness=j.checkpoint();assert.equal(consume(revWitness).trusted,false);
 assert.throws(()=>j.publishRegistry(reg,"rollback"));
 j.close();
 assert.throws(()=>open(oldFile,f.config({mode:"open-existing",witness:revWitness,operatorAuthority:auth,pins})),{code:"ROLLBACK_DETECTED"});
 // A fresh independent full-scope fixture is eligible, but every production readiness field remains false.
 const fullFile=path.join(root,"full.sqlite"),full=open(fullFile,f.config({operatorAuthority:auth}));
 for(const id of ["provider","runtime","restore","independent"])f.issue(full,auth,f.candidate(id,true));
 const all=consumeQualification({journal:full,witness:full.checkpoint(),operatorAuthority:auth,binding:f.t.f.binding,
  requestIds:["request-provider","request-runtime","request-restore","request-independent"],now:()=>f.t.f.time});
 assert.equal(all.trusted,true);assert.equal(all.state,"QUALIFIED");assert.equal(all.storageState,"FULL_STORAGE_QUALIFIED");
 assert.equal(all.productionReady,false);assert.equal(all.automaticCollectionReady,false);assert.equal(all.productionOffDiskVerified,false);full.close();
 guard.assertClean();console.log("Dual authority, signature-before-receipt, durable registry pins, external checkpoint rollback rejection, fresh V3 lifecycle/coverage/revision gate and closed production readiness: PASS");
}finally{for(const handle of handles)try{handle.close();}catch{}guard.restore();f.removeTemp(root);}
