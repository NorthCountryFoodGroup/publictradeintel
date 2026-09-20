"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{execFileSync}=require("node:child_process");
const root=path.resolve(__dirname,".."),base="ed0d7f33e9779838c4dfff491bf554a2360a79da";
require("./smoke-test-kronos-research-portable-boundary");
const protectedPaths=["server.js","app.js","historical-market.js","render.yaml","config","lib","discovery","decision","kronos-service","kronos/service.js","kronos/schema.js","kronos/persistence.js","kronos/client.js","kronos/research-guards.js","kronos/research-contracts.js","kronos/research-db-schema.js"];
assert.equal(execFileSync("git",["diff",base,"--",...protectedPaths],{cwd:root,encoding:"utf8"}),"");
const files=execFileSync("git",["ls-files","--cached","--others","--exclude-standard","*.js"],{cwd:root,encoding:"utf8"}).trim().split(/\r?\n/);
for(const file of new Set(files)){if(file.startsWith("scripts/")||/^kronos\/research-(backup-[a-z0-9-]+|qualification-(?:policy|contracts|authority)|snapshot)\.js$/.test(file))continue;assert.doesNotMatch(fs.readFileSync(path.join(root,file),"utf8"),/require\s*\([^)]*research-(?:backup-|snapshot)/,file);}
for(const file of files.filter(file=>/^kronos\/research-(backup-[a-z0-9-]+|qualification-(?:policy|contracts|authority)|snapshot)\.js$/.test(file))){const s=fs.readFileSync(path.join(root,file),"utf8");assert.doesNotMatch(s.replace(file==="kronos/research-backup-s3.js"?"@aws-sdk/client-s3":"never-match", "authorized-sdk"),/@aws-sdk|https?:\/\/|\bfetch\s*\(|process\.env|\bsetInterval\s*\(/,file);}
// Request-scoped timers are now authorized in deadline/delivery-v2; import purity still denies timer execution.
const current=JSON.parse(fs.readFileSync(path.join(root,"package.json"))),prior=JSON.parse(execFileSync("git",["show",`${base}:package.json`],{cwd:root,encoding:"utf8"}));for(const key of ["devDependencies","engines"])assert.deepEqual(current[key],prior[key]);const dependencies={...(current.dependencies||{})};assert.equal(dependencies["@aws-sdk/client-s3"],"3.1136.0");delete dependencies["@aws-sdk/client-s3"];assert.deepEqual(dependencies,prior.dependencies||{});
console.log("Slice 2C offline import purity, zero SDK/network/env wiring, production/Legacy isolation, only the authorized pinned S3 dependency and protected fingerprint: PASS");
