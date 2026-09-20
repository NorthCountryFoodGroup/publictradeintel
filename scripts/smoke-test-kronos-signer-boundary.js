"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),cp=require("node:child_process");
const guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
try {
  const original=Module._load,oldTimers=[global.setTimeout,global.setInterval,global.setImmediate];
  let effects=0;const deny=()=>{effects++;throw Error("IMPURE_SIGNER_IMPORT");};
  global.setTimeout=global.setInterval=global.setImmediate=deny;
  Module._load=function(name,...args) {
    if(name.startsWith("@aws-sdk/")||name==="node:sqlite")return deny();
    const value=original.call(this,name,...args);
    if(name==="node:fs")return new Proxy(value,{get:()=>deny});
    if(name==="node:crypto")return new Proxy(value,{get:(object,key)=>["sign","generateKeyPair","generateKeyPairSync","createPrivateKey","randomBytes"].includes(key)?deny:object[key]});
    return value;
  };
  let s,v;
  try{s=require("../kronos/research-qualification-signer-contracts");v=require("../kronos/research-qualification-signer-verifier");}
  finally{Module._load=original;[global.setTimeout,global.setInterval,global.setImmediate]=oldTimers;}
  assert.equal(effects,0);assert.equal(Object.hasOwn(s,"sign"),false);assert.equal(Object.hasOwn(v,"sign"),false);
  const root=path.resolve(__dirname,".."),files=cp.execFileSync("git",["ls-files","--cached","--others","--exclude-standard","*.js"],{cwd:root,encoding:"utf8"}).trim().split(/\r?\n/);
  for(const file of new Set(files)){
    if(file.startsWith("scripts/"))continue;
    const source=fs.readFileSync(path.join(root,file),"utf8");
    if(/^kronos\/research-qualification-signer-(?:contracts|verifier)\.js$/.test(file))
      assert.doesNotMatch(source,/process\.env|@aws-sdk|node:fs|node:https?|\bfetch\s*\(|\.sign\(|createPrivateKey|generateKeyPair|setTimeout|setInterval/);
    else if(!/^kronos\/research-qualification-preflight-(?:contracts|journal|gate)\.js$/.test(file)) assert.doesNotMatch(source,/require\s*\([^)]*research-qualification-signer-/);
  }
  const protectedPaths=["server.js","app.js","render.yaml","config","kronos/service.js","kronos/research-qualification-authority.js","kronos/research-qualification-contracts.js","kronos/research-qualification-policy.js","kronos/research-backup-adapter.js","kronos/research-backup-health.js","kronos/research-backup-qualification.js","package-lock.json"];
  assert.equal(cp.execFileSync("git",["diff","cc740efb196b70de3c7ffefe371756653c64482d","--",...protectedPaths],{cwd:root,encoding:"utf8"}),"");
  assert.equal(require("../kronos/research-backup-adapter").isQualifiedRealProvider(),false);
  require("./smoke-test-prediction-engine-boundary");guard.assertClean();
  console.log("Signer import: zero signing/key generation, files, clients, timers or secret access; no production imports, unchanged V3/Ed25519 and closed readiness: PASS");
}finally{guard.restore();}
