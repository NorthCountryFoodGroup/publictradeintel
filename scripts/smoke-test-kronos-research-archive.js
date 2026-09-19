"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {openResearchStore}=require("../kronos/research-store");
const {hashValue,hashBytes}=require("../kronos/research-hash");
const {createBundle}=require("../kronos/research-recovery-bundle");
const {createArchive,validateArchive,validateChain}=require("../kronos/research-archive");
const {publishBundle,publishArchive,readArtifacts,recoveryPaths}=require("../kronos/research-artifact-store");
const {inventory}=require("../kronos/research-inventory");
const f=require("./fixtures/kronos-research-store");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"pti-archives-"));let store;
const options={sealedAt:f.timestamp,softwareRevision:"fixture-v1"};
try{
 store=openResearchStore(path.join(dir,"source.sqlite"),{mode:"initialize-new"});
 for(let i=1;i<=3;i++)store.writeTransaction(f.transaction(`tx${i}`,[f.entry("forecasts",f.forecast(`manual-${i}`))],f.evidence));
 const bundles=[1,2,3].map(i=>createBundle(store,`tx${i}`)),a=createArchive(bundles.slice(0,2),null,options),b=createArchive(bundles.slice(2),a.manifest,options);
 const alternate={manifest:structuredClone(a.manifest),artifact:Buffer.from(a.artifact)};alternate.artifact[4]=1;alternate.manifest.manifest.artifactHash=hashBytes(alternate.artifact);alternate.manifest.manifestHash=hashValue(alternate.manifest.manifest);assert.deepEqual(validateArchive(alternate),bundles.slice(0,2));assert.equal(alternate.manifest.manifest.logicalContentHash,a.manifest.manifest.logicalContentHash);assert.notEqual(alternate.manifest.manifest.artifactHash,a.manifest.manifest.artifactHash);
 assert.deepEqual(validateChain([a,b],{expectedLastSequence:3}),bundles);assert.deepEqual(createArchive(bundles.slice(0,2),null,options),a);
 for(const segments of [[b],[b,a],[a,a]])assert.throws(()=>validateChain(segments));assert.throws(()=>validateChain([a],{expectedLastSequence:3}));
 for(const values of [[bundles[0],bundles[0]],[bundles[0],bundles[2]],[bundles[1],bundles[0]]])assert.throws(()=>createArchive(values,null,options));
 for(const mutate of [s=>s.manifest.manifest.archiveFormatVersion="future",s=>s.manifest.manifest.previousManifestHash="0".repeat(64),s=>s.manifest.manifest.recordCounts.forecasts=99,s=>s.manifest.manifest.compressionVersion="ZIP",s=>s.artifact=Buffer.from("invalid compression"),s=>s.artifact=s.artifact.subarray(0,-5)]){
  const bad={manifest:structuredClone(a.manifest),artifact:Buffer.from(a.artifact)};mutate(bad);
  if(bad.artifact.length!==a.artifact.length)bad.manifest.manifest.artifactHash=hashBytes(bad.artifact);
  bad.manifest.manifestHash=hashValue(bad.manifest.manifest);assert.throws(()=>validateChain([bad,b]));
 }
 const root=recoveryPaths(dir).root;
 publishBundle(root,bundles[0]);let state=inventory(root,{store});assert.equal(state.transactions[0].durability,"PORTABLE_RECOVERY_READY");assert.equal(state.transactions[1].outboxState,"PENDING_BUNDLE");assert.deepEqual(state.missingSequenceRanges,[[2,3]]);
 const before=fs.readFileSync(path.join(root,"bundles","000000000001","bundle.json"));assert.equal(publishBundle(root,bundles[0]).idempotent,true);assert.deepEqual(before,fs.readFileSync(path.join(root,"bundles","000000000001","bundle.json")));
 const altered=structuredClone(bundles[0]);altered.logical.request.audit.details.changed=true;altered.logical.transactionHash=hashValue(altered.logical.request);altered.logicalContentHash=hashValue(altered.logical);altered.bundleId=`sha256:${altered.logicalContentHash}`;assert.throws(()=>publishBundle(root,altered),/collision/);
 publishArchive(root,a);publishArchive(root,b);state=inventory(root,{store});assert.equal(state.latestSealedSequence,3);assert.equal(state.integrity,"VERIFIED");assert.equal(state.offDiskVerified,false);assert.equal(state.transactions[2].archiveId,b.manifest.manifest.archiveId);assert.deepEqual(state.missingSequenceRanges,[]);assert.equal(readArtifacts(root).segments.length,2);
 const second=structuredClone(a.manifest);second.manifest.softwareRevision="changed";assert.throws(()=>validateArchive({manifest:second,artifact:a.artifact}));
 console.log("Slice 2B archive JSONL/gzip, manifest fields/chaining, gaps, corruption, immutable publication and derived outbox/inventory: PASS");
}finally{if(store)store.close();fs.rmSync(dir,{recursive:true,force:true});}
