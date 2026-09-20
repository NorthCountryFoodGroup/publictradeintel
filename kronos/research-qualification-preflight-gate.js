"use strict";
const {assertJournal}=require("./research-qualification-preflight-journal");
const p=require("./research-qualification-preflight-contracts"),q=require("./research-qualification-contracts");
const {createPinnedVerifier}=require("./research-qualification-signer-verifier");
const {createQualificationAuthority}=require("./research-qualification-authority");
function consumeQualification({journal,witness,operatorAuthority,binding,requestIds,now=Date.now}){
 try{
  assertJournal(journal);const at=now(),material=journal.material(witness),registry=material.registry;
  const verifier=createPinnedVerifier({registry,registryPin:{hash:registry.registryHash,revision:registry.registryRevision},
   journal:material.journal,journalPin:{hash:material.journal.journalHash,revision:material.journal.revision},binding,now:()=>at});
  const authority=createQualificationAuthority({binding,issuers:registry.signers.map(row=>({id:row.signerId,domain:row.domain==="independent-restore"?"restore":row.domain,publicKey:row.publicKey})),now:()=>at});
  const components={},envelopes={};
  p.check(Array.isArray(requestIds)&&new Set(requestIds).size===requestIds.length);
  for(const id of requestIds){
   const r=material.records.find(row=>row.request.requestId===id);p.check(r,"ISSUANCE_INCOMPLETE");
   operatorAuthority.validate(r.approval,r.request,r.attestation,r.registry,Date.parse(r.reservedAt));
   p.check(verifier.verify(r.envelope).trusted,"LIFECYCLE_DENIED");
   const role=r.attestation.domain==="restore"?(r.attestation.evidence.exerciseKind==="INDEPENDENT"?"independentRestore":r.attestation.evidence.exerciseKind==="INITIAL"?"initialRestore":"restore"):r.attestation.domain;
   p.check(!components[role],"DUPLICATE_DOMAIN");
   envelopes[role]=r.envelope;
   components[role]=authority.accept({issuerId:r.envelope.signerId,attestation:r.attestation,signature:r.envelope.signature});
  }
  if(!components.restore&&components.initialRestore){components.restore=components.initialRestore;envelopes.restore=envelopes.initialRestore;}
  if(envelopes.independentRestore)p.check(envelopes.restore&&verifier.verifyIndependent(envelopes.restore,envelopes.independentRestore).trusted,"INDEPENDENCE_DENIED");
  const record=authority.build(components),result=authority.verify(record,binding);
  p.check(result.trusted,"QUALIFICATION_DENIED");
  // Only a fresh assessment leaves this boundary; no cached authority handle is exported.
  return p.freeze({...result,qualificationVersion:q.VERSIONS.qualification,qualificationHash:record.qualificationHash,
   registryHash:registry.registryHash,witnessSequence:witness.sequence,productionReady:false,automaticCollectionReady:false,productionOffDiskVerified:false});
 }catch{return Object.freeze({trusted:false,state:"UNQUALIFIED",productionReady:false,automaticCollectionReady:false,productionOffDiskVerified:false});}
}
module.exports={consumeQualification};
