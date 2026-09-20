"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),Module=require("node:module");
const guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
try {
  const original=Module._load;let blocked=0;
  Module._load=function(name,...args){if(name.startsWith("@aws-sdk/")||name==="node:sqlite"){blocked++;throw Error("IMPURE_IMPORT");}return original.call(this,name,...args);};
  try {for(const p of ["policy","contracts","authority"])require("../kronos/research-qualification-"+p);} finally {Module._load=original;}
  assert.equal(blocked,0);
  const f=require("./fixtures/kronos-qualified-evidence"),s=f.setup(),provider=s.accept("provider"),runtime=s.accept("runtime"),restore=s.accept("restore");
  const q=s.authority.build({provider,runtime,restore});assert.equal(q.productionOffDiskVerified,false);assert.equal(q.automaticCollectionReady,false);
  const mock=require("./fixtures/kronos-s3-mock"),adapter=require("../kronos/research-backup-s3").createS3Adapter(mock.config,{transport:mock.mockS3()});
  const health=require("../kronos/research-backup-health"),context=mock.context;
  const result=health.storageReadiness({adapter,health:{...context,durabilityReady:true,deadlineBreached:false},context,now:f.time,primaryHealthy:true,portableHealthy:true,schemaCompatible:true,diskFraction:0.1,freeBytes:10000,requiredStagingBytes:100,backupFresh:true,qualification:q});
  assert.equal(result.ready,false);assert.ok(result.reasons.includes("REAL_PROVIDER_NOT_QUALIFIED"));
  assert.equal(require("../kronos/research-backup-adapter").isQualifiedRealProvider({trusted:true,qualified:true,qualification:q}),false);
  const root=require("node:path").resolve(__dirname,"..");
  const files=require("node:child_process").execFileSync("git",["ls-files","--cached","--others","--exclude-standard","*.js"],{cwd:root,encoding:"utf8"}).trim().split(/\r?\n/);
  for(const file of new Set(files)) {
    if(file.startsWith("scripts/")||/^kronos\/research-qualification-(?:policy|contracts|authority|signer-contracts|signer-verifier)\.js$/.test(file))continue;
    assert.doesNotMatch(fs.readFileSync(require("node:path").join(root,file),"utf8"),/require\s*\([^)]*research-qualification-/,file);
  }
  const server=fs.readFileSync(require.resolve("../server"),"utf8");assert.ok(!server.includes("research-qualification-authority"));
  // The old V2 validator/issuer retains its old untrusted semantics.
  assert.equal(require("../kronos/research-backup-qualification").VERSION,"KRONOS_PROVIDER_QUALIFICATION_V2");
  const {performance}=require("node:perf_hooks"),policy=require("../kronos/research-qualification-policy");
  const iterations=200;let start=performance.now();for(let i=0;i<iterations;i++)s.authority.build({provider,runtime,restore});const buildMs=(performance.now()-start)/iterations;
  start=performance.now();for(let i=0;i<iterations;i++)assert.equal(s.authority.verify(q,f.binding).trusted,true);const verifyMs=(performance.now()-start)/iterations;
  start=performance.now();for(let i=0;i<iterations;i++)policy.evaluateCoverage(restore.evidence);const coverageMs=(performance.now()-start)/iterations;
  guard.assertClean();console.log(JSON.stringify({result:"PASS",iterations,meanBuildMs:buildMs,meanVerifyMs:verifyMs,meanCoverageMs:coverageMs,...guard.counts()}));
} finally {guard.restore();}
