"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),{spawnSync}=require("node:child_process");
const {openResearchStore}=require("../kronos/research-store");
const {createBundle}=require("../kronos/research-recovery-bundle");
const {createArchive}=require("../kronos/research-archive");
const {publishBundle,publishArchive}=require("../kronos/research-artifact-store");
const {inventory}=require("../kronos/research-inventory");
const f=require("./fixtures/kronos-research-store");
const options={sealedAt:f.timestamp,softwareRevision:"fixture-v1"};
if(process.argv[2]==="child"){
 const dir=process.argv[3],phase=process.argv[4],root=path.join(dir,"recovery"),store=openResearchStore(path.join(dir,"source.sqlite"),{mode:"initialize-new"});store.writeTransaction(f.transaction("first",[f.entry("forecasts",f.forecast("manual-1"))],f.evidence));
 if(phase==="after-local-commit")process.exit(73);
 const bundle=createBundle(store,"first");store.close();
 const die=point=>{if((phase==="during-bundle"&&point==="during-write")||(phase==="after-bundle"&&point==="after-seal"))process.exit(73);};publishBundle(root,bundle,{hook:die});
 const segment=createArchive([bundle],null,options);publishArchive(root,segment,{hook:point=>{if((phase==="during-archive"&&point==="during-write")||(phase==="during-seal"&&point==="before-seal")||(phase==="after-archive"&&point==="after-seal"))process.exit(73);}});process.exit(74);
}
const base=fs.mkdtempSync(path.join(os.tmpdir(),"pti-publication-crash-"));
try{
 for(const phase of ["after-local-commit","during-bundle","after-bundle","during-archive","during-seal","after-archive"]){
  const dir=path.join(base,phase);fs.mkdirSync(dir);const child=spawnSync(process.execPath,[__filename,"child",dir,phase],{encoding:"utf8",timeout:30000});assert.equal(child.status,73,child.stderr);
  // Child exit has been independently observed. Only these fixture-owned locks are explicitly released.
  const file=path.join(dir,"source.sqlite"),root=path.join(dir,"recovery");
  if(fs.existsSync(`${file}.writer.lock`)){assert.throws(()=>openResearchStore(file,{mode:"open-existing"}),/lock exists/);fs.unlinkSync(`${file}.writer.lock`);}
  const store=openResearchStore(file,{mode:"open-existing"});try{
   assert.equal(store.count("forecasts"),1);const bundle=createBundle(store,"first"),state=inventory(root,{store});
   assert.equal(state.transactions[0].durability,["after-local-commit","during-bundle"].includes(phase)?"LOCAL_COMMITTED":"PORTABLE_RECOVERY_READY");assert.equal(state.latestSealedSequence,phase==="after-archive"?1:0);assert.equal(state.offDiskVerified,false);
   const lock=path.join(root,"publication.writer.lock");if(fs.existsSync(lock)){assert.throws(()=>publishBundle(root,bundle),/EEXIST/);fs.unlinkSync(lock);}
   publishBundle(root,bundle);publishArchive(root,createArchive([bundle],null,options));const reconciled=inventory(root,{store});assert.equal(reconciled.integrity,"VERIFIED");assert.equal(reconciled.latestSealedSequence,1);
   if(["during-bundle","during-archive","during-seal"].includes(phase))assert.ok(reconciled.stagingEntries>0,"Unfinished evidence retained, not silently deleted");
  }finally{store.close();}
 }
 console.log("Slice 2B six process-interruption boundaries, stale-lock refusal, atomic publication, staging retention and truthful reconciliation without inference: PASS");
}finally{fs.rmSync(base,{recursive:true,force:true});}
