"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),{execFileSync}=require("node:child_process");
const root=path.resolve(__dirname,".."),base="82089d470602b01a3a8cc0a245d99fe5a9c3ef74";
const modules=["research-canonical","research-hash","research-db-schema","research-corrections","research-store"];
const portable=["research-qualification-policy","research-qualification-contracts","research-qualification-authority","research-backup-s3","research-backup-retention","research-backup-transport","research-backup-deadline","research-backup-io","research-backup-journal","research-backup-discovery","research-backup-delivery-v2","research-backup-snapshot-v2","research-backup-qualification","research-backup-contracts","research-backup-adapter","research-backup-delivery","research-backup-verification","research-backup-checkpoint","research-snapshot","research-backup-health","research-recovery-bundle","research-archive","research-replay","research-artifact-store","research-inventory"];
const originals=["research-contracts","research-guards","constants"];
const sources=Object.fromEntries([...modules,...originals].map(name=>[name,fs.readFileSync(path.join(root,"kronos",`${name}.js`),"utf8")]));
let effects=0;const deny=()=>{effects++;throw Error("Forbidden import capability")};const cache=new Map();
function load(name){if(cache.has(name))return cache.get(name).exports;const module={exports:{}};cache.set(name,module);
 vm.runInNewContext(sources[name],{module,exports:module.exports,Buffer,process:new Proxy({},{get:deny}),fetch:deny,setTimeout:deny,setInterval:deny,setImmediate:deny,queueMicrotask:deny,require:dependency=>{
  if(dependency==="node:fs")return new Proxy({},{get:deny});
  if(["node:path","node:crypto"].includes(dependency))return require(dependency);
  if(dependency.startsWith("./") && Object.hasOwn(sources,dependency.slice(2)))return load(dependency.slice(2));
  return deny();
 }});return module.exports;
}
modules.forEach(load);assert.equal(effects,0,"Imports must not access data, open SQLite, start services or write files");
const protectedPaths=["server.js","app.js","historical-market.js","render.yaml","config","lib","discovery","decision","kronos-service","kronos/service.js","kronos/schema.js","kronos/persistence.js","kronos/analytics.js","kronos/outcomes.js","kronos/client.js","kronos/constants.js","kronos/research-contracts.js","kronos/research-guards.js"];
assert.equal(execFileSync("git",["diff",base,"--",...protectedPaths],{cwd:root,encoding:"utf8"}),"","No new storage integration or Legacy changes in Slice 2A");
const files=execFileSync("git",["ls-files","--cached","--others","--exclude-standard","*.js"],{cwd:root,encoding:"utf8"}).trim().split(/\r?\n/);
for(const file of new Set(files)){if(file.startsWith("scripts/")||[...modules,...portable].some(name=>file===`kronos/${name}.js`))continue;assert.doesNotMatch(fs.readFileSync(path.join(root,file),"utf8"),/require\s*\([^)]*research-(?:canonical|hash|db-schema|corrections|store)["']/,`${file} must not depend on storage foundation`);}
require("./smoke-test-prediction-engine-boundary");
console.log("Slice 2A zero-capability imports, no server wiring, Legacy isolation, and protected fingerprint: PASS");
