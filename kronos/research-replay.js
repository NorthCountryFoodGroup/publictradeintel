"use strict";
const fs=require("node:fs"),path=require("node:path");
const {canonicalize}=require("./research-canonical");
const {hashValue}=require("./research-hash");
const {openResearchStore}=require("./research-store");
const {validateBundle,check}=require("./research-recovery-bundle");
const {validateChain}=require("./research-archive");
const {syncDirectory}=require("./research-artifact-store");
function replayBundle(store,bundle){
  validateBundle(bundle);const l=bundle.logical,history=store.committedTransactions(),existing=history.find(row=>row.request.id===l.transactionId);
  if(existing){check(existing.sequence===l.transactionSequence&&existing.transactionHash===l.transactionHash,"Conflicting replay identity.");return {idempotent:true};}
  check(l.transactionSequence===history.length+1,"Replay must be contiguous and ordered from genesis.");
  const supplied=new Set(l.request.blobs.map(hashValue));
  for(const content of l.contents)if(!supplied.has(content.hash))check(hashValue(store.readBlob(content.hash))===content.hash,"Missing prior transaction content.");
  const result=store.writeTransaction(l.request);return result;
}
function replayHistory(targetDirectory,{bundles,segments,expectedLastSequence}={}){
  check(typeof targetDirectory==="string"&&path.isAbsolute(targetDirectory)&&!fs.existsSync(targetDirectory),"Restore target must be explicitly new.");
  check(Boolean(bundles)!==Boolean(segments),"Exactly one replay source required.");
  const history=segments?validateChain(segments,{expectedLastSequence}):bundles;
  check(Array.isArray(history)&&history.length>0,"Empty recovery history.");history.forEach((bundle,i)=>{validateBundle(bundle);check(bundle.logical.transactionSequence===i+1,"Replay sequence gap or duplicate.");});
  if(expectedLastSequence!==undefined)check(history.length===expectedLastSequence,"Missing recovery tail.");
  const parent=path.dirname(targetDirectory);check(fs.lstatSync(parent).isDirectory()&&!fs.lstatSync(parent).isSymbolicLink(),"Restore parent must be a regular directory.");
  const lock=path.join(parent,`.${path.basename(targetDirectory)}.restore.lock`),lockHandle=fs.openSync(lock,"wx",0o600);let store;
  try{
    fs.fsyncSync(lockHandle);check(!fs.existsSync(targetDirectory),"Restore target appeared during locking.");
    const stage=fs.mkdtempSync(path.join(parent,".research-restore-staging-"));
    store=openResearchStore(path.join(stage,"research.sqlite"),{mode:"initialize-new"});for(const bundle of history)replayBundle(store,bundle);
    store.integrity();const actual=store.committedTransactions();check(canonicalize(actual.map(row=>row.transactionHash))===canonicalize(history.map(b=>b.logical.transactionHash)),"Restored transaction identity mismatch.");store.close();store=null;
    // A complete receipt lives inside the atomic directory publication, never beside a partial database.
    const receipt=fs.openSync(path.join(stage,"restore.json"),"wx",0o600);try{fs.writeFileSync(receipt,canonicalize({version:"KRONOS_LOCAL_RESTORE_V1",transactionCount:history.length,lastBundleId:history.at(-1).bundleId,offDiskVerified:false})+"\n");fs.fsyncSync(receipt);}finally{fs.closeSync(receipt);}
    syncDirectory(stage);check(!fs.existsSync(targetDirectory),"Restore target appeared during replay.");fs.renameSync(stage,targetDirectory);const directorySyncAvailable=syncDirectory(parent);
    return {databasePath:path.join(targetDirectory,"research.sqlite"),transactionCount:history.length,directorySyncAvailable,offDiskVerified:false};
  }finally{if(store)store.close();fs.closeSync(lockHandle);fs.unlinkSync(lock);}
}
module.exports={replayBundle,replayHistory};
