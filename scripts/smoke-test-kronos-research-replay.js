"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {performance}=require("node:perf_hooks");
const {openResearchStore}=require("../kronos/research-store");
const {hashValue}=require("../kronos/research-hash");
const {createBundle,serializeBundle}=require("../kronos/research-recovery-bundle");
const {createArchive}=require("../kronos/research-archive");
const {publishArchive,readArtifacts}=require("../kronos/research-artifact-store");
const {replayBundle,replayHistory}=require("../kronos/research-replay");
const f=require("./fixtures/kronos-research-portable");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"pti-portable-replay-"));let store;
try{
 const source=path.join(dir,"source.sqlite");store=openResearchStore(source,{mode:"initialize-new"});const requests=f.history(store),expected=f.snapshot(store),bundles=requests.map(r=>createBundle(store,r.id));assert.equal(store.count("forecasts"),1000);
 const options={sealedAt:"2026-09-29T00:00:00.000Z",softwareRevision:"fixture-v1"},a=createArchive(bundles.slice(0,2),null,options),b=createArchive(bundles.slice(2),a.manifest,options),root=path.join(dir,"portable");publishArchive(root,a);publishArchive(root,b);
 const metrics={singleForecastBundleBytes:Buffer.byteLength(serializeBundle(bundles[0])),twentyForecastSessionBundleBytes:bundles.filter(v=>v.logical.transactionId==="setup-session"||v.logical.transactionId.startsWith("result-session-")).reduce((n,v)=>n+Buffer.byteLength(serializeBundle(v)),0),thousandForecastArchiveBytes:a.artifact.length+b.artifact.length,thousandForecastManifestBytes:Buffer.byteLength(JSON.stringify(a.manifest))+Buffer.byteLength(JSON.stringify(b.manifest))};
 const sessionArchive=createArchive(bundles.filter(v=>v.logical.transactionId==="setup-session"||v.logical.transactionId.startsWith("result-session-")),a.manifest,options);metrics.twentyForecastSessionGzipBytes=sessionArchive.artifact.length;metrics.thousandForecastManifestBytes=fs.readdirSync(path.join(root,"archives")).reduce((n,entry)=>n+fs.statSync(path.join(root,"archives",entry,"manifest.json")).size,0);
 store.close();store=null;fs.unlinkSync(source);assert.equal(fs.existsSync(source),false);
 const segments=readArtifacts(root).segments,start=performance.now(),result=replayHistory(path.join(dir,"restored"),{segments,expectedLastSequence:bundles.length});metrics.thousandForecastReplayMs=Math.round(performance.now()-start);metrics.restoredDatabaseBytes=fs.statSync(result.databasePath).size;
 store=openResearchStore(result.databasePath,{mode:"open-existing"});assert.deepEqual(f.snapshot(store),expected);assert.equal(store.integrity().integrity,"ok");assert.equal(store.findForecasts({triggerMode:"manual",protocolVersion:null}).length,979);assert.equal(store.findForecasts({triggerMode:"automatic_shadow"}).length,21);
 for(const bundle of bundles)assert.equal(replayBundle(store,bundle).idempotent,true);assert.equal(store.count("forecasts"),1000);
 const bad=structuredClone(bundles[0]);bad.logical.request.records[0].record.securityName="conflict";bad.logical.transactionHash=hashValue(bad.logical.request);bad.logicalContentHash=hashValue(bad.logical);bad.bundleId=`sha256:${bad.logicalContentHash}`;assert.throws(()=>replayBundle(store,bad),/Conflicting/);
 const empty=openResearchStore(path.join(dir,"empty.sqlite"),{mode:"initialize-new"});try{assert.throws(()=>replayBundle(empty,bundles[1]),/ordered/);assert.equal(empty.count("forecasts"),0);}finally{empty.close();}
 const conflict=structuredClone(bundles[0]);conflict.logical.transactionSequence=2;conflict.logical.transactionId="duplicate-record";conflict.logical.request.id="duplicate-record";conflict.logical.request.records[0].record.securityName="conflict";conflict.logical.request.audit.id="audit-duplicate";conflict.logical.transactionHash=hashValue(conflict.logical.request);conflict.logicalContentHash=hashValue(conflict.logical);conflict.bundleId=`sha256:${conflict.logicalContentHash}`;
 assert.throws(()=>replayHistory(path.join(dir,"failed-restore"),{bundles:[bundles[0],conflict]}),/different evidence/);assert.equal(fs.existsSync(path.join(dir,"failed-restore")),false);
 assert.throws(()=>replayHistory(path.join(dir,"restored"),{segments}),/explicitly new/);
 console.log(JSON.stringify(metrics));console.log("Slice 2B portable-only reconstruction after source deletion, 1,000 forecasts, exact evidence/outcomes/corrections/partitions, replay idempotency and no partial accepted restore: PASS");
}finally{if(store)store.close();fs.rmSync(dir,{recursive:true,force:true});}
