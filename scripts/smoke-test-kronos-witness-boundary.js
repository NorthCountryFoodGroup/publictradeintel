"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),cp=require("node:child_process"),guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
try{
 const original=Module._load,timers=[global.setTimeout,global.setInterval,global.setImmediate];let effects=0;const deny=()=>{effects++;throw Error("WITNESS_IMPORT_EFFECT");};
 global.setTimeout=global.setInterval=global.setImmediate=deny;
 Module._load=function(name,...args){if(name==="node:sqlite"||name.startsWith("@aws-sdk/"))return deny();const value=original.call(this,name,...args);
  if(name==="node:fs")return new Proxy(value,{get:()=>deny});
  if(name==="node:crypto")return new Proxy(value,{get:(obj,key)=>["sign","createPrivateKey","generateKeyPair","generateKeyPairSync","randomUUID","randomBytes"].includes(key)?deny:obj[key]});return value;};
 try{for(const name of ["contracts","state","disk","store"])require("../kronos/research-qualification-witness-"+name);}finally{Module._load=original;[global.setTimeout,global.setInterval,global.setImmediate]=timers;}
 assert.equal(effects,0);const root=path.resolve(__dirname,".."),files=cp.execFileSync("git",["ls-files","--cached","--others","--exclude-standard","*.js"],{cwd:root,encoding:"utf8"}).trim().split(/\r?\n/);
 for(const file of new Set(files)){if(file.startsWith("scripts/"))continue;const text=fs.readFileSync(path.join(root,file),"utf8");
  if(/^kronos\/research-qualification-witness-(?:contracts|state|disk|store)\.js$/.test(file))assert.doesNotMatch(text,/process\.env|@aws-sdk|\bfetch\s*\(|\.sign\(|createPrivateKey|generateKeyPair|setTimeout|setInterval|require\s*\([^)]*fixtures/);
  else if(!/^kronos\/research-qualification-(?:native-(?:proofs|signer)|integration-contracts|public-proof)\.js$/.test(file)) assert.doesNotMatch(text,/require\s*\([^)]*research-qualification-witness-/);
 }
 const protectedPaths=["server.js","app.js","render.yaml","config","lib","discovery","decision","kronos-service","kronos/service.js","kronos/schema.js","kronos/client.js","kronos/persistence.js","kronos/research-qualification-contracts.js","kronos/research-qualification-authority.js","kronos/research-qualification-policy.js","kronos/research-qualification-signer-contracts.js","kronos/research-qualification-signer-verifier.js","kronos/research-qualification-preflight-contracts.js","kronos/research-qualification-preflight-journal.js","kronos/research-qualification-preflight-gate.js","kronos/research-backup-adapter.js","kronos/research-backup-health.js","package-lock.json"];
 assert.equal(cp.execFileSync("git",["diff","97fa56b6e225f7fbf4621b061d277ba6e113b4b7","--",...protectedPaths],{cwd:root,encoding:"utf8"}),"");
 const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"))),prior=JSON.parse(cp.execFileSync("git",["show","HEAD:package.json"],{cwd:root,encoding:"utf8"}));for(const key of ["dependencies","devDependencies","engines"])assert.deepEqual(pkg[key],prior[key]);
 assert.equal(require("../kronos/research-backup-adapter").isQualifiedRealProvider(),false);require("./smoke-test-prediction-engine-boundary");guard.assertClean();console.log("Witness imports: zero file/DB/key/timer/network effects, no secret reads or production wiring, unchanged dependencies/signing semantics/Legacy and false readiness: PASS");
}finally{guard.restore();}
