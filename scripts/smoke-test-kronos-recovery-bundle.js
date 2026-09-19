"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {openResearchStore}=require("../kronos/research-store");
const {hashValue}=require("../kronos/research-hash");
const {createBundle,validateBundle,serializeBundle,parseBundle}=require("../kronos/research-recovery-bundle");
const f=require("./fixtures/kronos-research-store");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"pti-bundles-"));let store;
function rehash(b){b.logicalContentHash=hashValue(b.logical);b.bundleId=`sha256:${b.logicalContentHash}`;return b;}
try{
 const {DatabaseSync}=require("node:sqlite");
 store=openResearchStore(path.join(dir,"research.sqlite"),{mode:"initialize-new"});const request=f.transaction("first",[f.entry("forecasts",f.forecast("manual-1"))],f.evidence);
 assert.throws(()=>createBundle(store,"first"),/not found/);const exec=DatabaseSync.prototype.exec;let blocked=false;
 DatabaseSync.prototype.exec=function(sql){if(sql==="COMMIT"){assert.throws(()=>createBundle(store,"first"),/uncommitted/);blocked=true;}return exec.call(this,sql);};
 try{store.writeTransaction(request);}finally{DatabaseSync.prototype.exec=exec;}assert.equal(blocked,true);
 const b=createBundle(store,"first");assert.deepEqual(createBundle(store,"first"),b);assert.deepEqual(parseBundle(serializeBundle(b)),b);
 const reordered=Object.fromEntries(Object.entries(b).reverse());assert.equal(serializeBundle(reordered),serializeBundle(b));assert.equal(validateBundle(JSON.parse(JSON.stringify(b,null,2))).bundleId,b.bundleId);
 assert.equal(b.logical.contents.length,3);assert.notEqual(b.logical.request.records[0].record.rawPathsHash,b.logical.request.records[0].record.normalizedPathsHash);
 assert.throws(()=>parseBundle(serializeBundle(b).slice(0,-10)));
 for(const mutate of [v=>v.logical.request.records[0].record.securityName="changed",v=>v.logical.bundleVersion="future",v=>v.logical.contents.pop(),v=>v.logical.contents[0].hash="0".repeat(64)]){const bad=structuredClone(b);mutate(bad);assert.throws(()=>validateBundle(rehash(bad)));}
 for(const [key,value] of [["KRONOS_SERVICE_TOKEN","fake"],["LOGIN_PIN","0000"],["ADMIN_PIN","9999"],["sessionCookie","fake"],["environment",{x:"fake"}],["source","https://user:fake@example.invalid"],["source","C:\\private\\evidence"],["source","/tmp/private"]]){
  const id=`unsafe-${store.count("research_transactions")}`,r=f.forecast(id,{providerProvenance:{[key]:value}});store.writeTransaction(f.transaction(id,[f.entry("forecasts",r)],f.evidence));assert.throws(()=>createBundle(store,id),/excluded/);
 }
 const invalid=f.transaction("rollback",[f.entry("forecasts",f.forecast("bad",{productionInfluence:true}))],f.evidence);assert.throws(()=>store.writeTransaction(invalid));assert.throws(()=>createBundle(store,"rollback"),/not found/);
 // Exercise an actual pre-2B writer against a temporary database, then reopen with current code.
 const Module=require("node:module"),{execFileSync}=require("node:child_process"),oldModule=new Module(path.resolve(__dirname,"../kronos/research-store.js"));
 oldModule.filename=path.resolve(__dirname,"../kronos/research-store.js");oldModule.paths=module.paths;
 oldModule._compile(execFileSync("git",["show","c1c7ad48f88a515d2013541ef61882f44d87d015:kronos/research-store.js"],{cwd:path.resolve(__dirname,".."),encoding:"utf8"}),oldModule.filename);
 const oldFile=path.join(dir,"old.sqlite"),oldStore=oldModule.exports.openResearchStore(oldFile,{mode:"initialize-new"});oldStore.writeTransaction(request);oldStore.close();
 const compatible=openResearchStore(oldFile,{mode:"open-existing"});try{assert.deepEqual(compatible.readForecast("manual-1"),request.records[0].record);assert.throws(()=>compatible.committedTransactions(),/Older outbox/);}finally{compatible.close();}
 console.log("Slice 2B bundle determinism, committed-only export, embedded blobs, versions, corruption and secret/path exclusion: PASS");
}finally{if(store)store.close();fs.rmSync(dir,{recursive:true,force:true});}
