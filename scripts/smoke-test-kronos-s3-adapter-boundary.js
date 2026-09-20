"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),{execFileSync}=require("node:child_process");
const guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
try{
 const probe=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
 try{assert.throws(()=>require("node:https").request("https://example.invalid"),/EXTERNAL_NETWORK_FORBIDDEN/);assert.equal(probe.counts().externalNetworkAttempts,1);}finally{probe.restore();}
 require("./smoke-test-kronos-s3-compatibility-boundary");
 const source=fs.readFileSync(path.join(__dirname,"../kronos/research-backup-s3.js"),"utf8");let sdkLoads=0;
 const module={exports:{}};vm.runInNewContext(source,{module,exports:module.exports,require:name=>{if(name==="@aws-sdk/client-s3"){sdkLoads++;throw Error("SDK loaded at import");}return require(path.resolve(__dirname,"../kronos",name));}});assert.equal(sdkLoads,0);
 assert.doesNotMatch(source,/process\.env|DeleteObject|PutBucket|CreateBucket|PutObjectRetention|console\.|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN/);
 const root=path.join(__dirname,".."),files=execFileSync("git",["ls-files","--cached","--others","--exclude-standard","*.js"],{cwd:root,encoding:"utf8"}).trim().split(/\r?\n/);
 for(const file of files){if(file.startsWith("scripts/")||file==="kronos/research-backup-s3.js")continue;assert.doesNotMatch(fs.readFileSync(path.join(root,file),"utf8"),/require\s*\([^)]*(?:research-backup-s3|@aws-sdk)/,file);}
 const lock=JSON.parse(fs.readFileSync(path.join(root,"package-lock.json"))),pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json")));assert.equal(pkg.dependencies["@aws-sdk/client-s3"],"3.1136.0");assert.equal(lock.packages["node_modules/@aws-sdk/client-s3"].version,"3.1136.0");
 const {isQualifiedRealProvider}=require("../kronos/research-backup-adapter");assert.equal(isQualifiedRealProvider(),false);
 guard.assertClean();console.log("S3 lazy import, no credential resolution, isolated SDK dependency, no server wiring and false production qualification: PASS; external network/real credential access: 0");
}finally{guard.restore();}
