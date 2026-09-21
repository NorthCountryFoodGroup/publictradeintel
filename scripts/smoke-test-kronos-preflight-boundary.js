"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),cp=require("node:child_process");
const guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
try{
 const original=Module._load,timers=[global.setTimeout,global.setInterval,global.setImmediate];let effects=0;
 const deny=()=>{effects++;throw Error("PREFLIGHT_IMPORT_EFFECT");};global.setTimeout=global.setInterval=global.setImmediate=deny;
 Module._load=function(name,...args){if(name==="node:sqlite"||name.startsWith("@aws-sdk/"))return deny();const value=original.call(this,name,...args);
  if(name==="node:fs")return new Proxy(value,{get:()=>deny});
  if(name==="node:crypto")return new Proxy(value,{get:(obj,key)=>["sign","createPrivateKey","generateKeyPair","generateKeyPairSync","randomBytes"].includes(key)?deny:obj[key]});return value;};
 try{for(const name of ["contracts","journal","gate"])require("../kronos/research-qualification-preflight-"+name);}
 finally{Module._load=original;[global.setTimeout,global.setInterval,global.setImmediate]=timers;}
 assert.equal(effects,0);
 const root=path.resolve(__dirname,".."),files=cp.execFileSync("git",["ls-files","--cached","--others","--exclude-standard","*.js"],{cwd:root,encoding:"utf8"}).trim().split(/\r?\n/);
 for(const file of new Set(files)){
  if(file.startsWith("scripts/"))continue;const source=fs.readFileSync(path.join(root,file),"utf8");
  if(/^kronos\/research-qualification-preflight-(?:contracts|journal|gate)\.js$/.test(file))assert.doesNotMatch(source,/process\.env|@aws-sdk|\bfetch\s*\(|\.sign\(|createPrivateKey|generateKeyPair|setTimeout|setInterval/);
  else if(!/^kronos\/research-qualification-(?:witness-(?:contracts|state|disk|store)|native-(?:proofs|signer)|integration-contracts|public-proof|operator-(?:contracts|store|control|proof|cli|retention|retention-contracts|retention-witness|retention-proof))\.js$/.test(file)) assert.doesNotMatch(source,/require\s*\([^)]*research-qualification-preflight-/);
 }
 const protectedPaths=["server.js","app.js","render.yaml","config","kronos/service.js","kronos/research-qualification-authority.js","kronos/research-qualification-contracts.js","kronos/research-qualification-policy.js","kronos/research-qualification-signer-contracts.js","kronos/research-qualification-signer-verifier.js","kronos/research-backup-adapter.js","kronos/research-backup-health.js","package-lock.json"];
 assert.equal(cp.execFileSync("git",["diff","791c41f88963f26814c18daf51c01a51e0c6b3dc","--",...protectedPaths],{cwd:root,encoding:"utf8"}),"");
 assert.equal(require("../kronos/research-backup-adapter").isQualifiedRealProvider(),false);
 require("./smoke-test-prediction-engine-boundary");guard.assertClean();
 console.log("Preflight imports perform no SQLite/file/key/network/timer activity; original crypto contracts, production and readiness remain unchanged: PASS");
}finally{guard.restore();}
