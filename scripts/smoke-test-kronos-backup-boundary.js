"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{execFileSync}=require("node:child_process");
const root=path.resolve(__dirname,".."),base="ed0d7f33e9779838c4dfff491bf554a2360a79da";
require("./smoke-test-kronos-research-portable-boundary");
const protectedPaths=["server.js","app.js","historical-market.js","render.yaml","config","lib","discovery","decision","kronos-service","kronos/service.js","kronos/schema.js","kronos/persistence.js","kronos/client.js","kronos/research-guards.js","kronos/research-contracts.js","kronos/research-db-schema.js"];
assert.equal(execFileSync("git",["diff",base,"--",...protectedPaths],{cwd:root,encoding:"utf8"}),"");
const files=execFileSync("git",["ls-files","--cached","--others","--exclude-standard","*.js"],{cwd:root,encoding:"utf8"}).trim().split(/\r?\n/);
for(const file of new Set(files)){if(file.startsWith("scripts/")||/^kronos\/research-(backup-[a-z-]+|snapshot)\.js$/.test(file))continue;assert.doesNotMatch(fs.readFileSync(path.join(root,file),"utf8"),/require\s*\([^)]*research-(?:backup-|snapshot)/,file);}
for(const file of files.filter(file=>/^kronos\/research-(backup-[a-z-]+|snapshot)\.js$/.test(file))){const s=fs.readFileSync(path.join(root,file),"utf8");assert.doesNotMatch(s,/@aws-sdk|https?:\/\/|\bfetch\s*\(|process\.env|\bsetTimeout\s*\(|\bsetInterval\s*\(/,file);}
const current=JSON.parse(fs.readFileSync(path.join(root,"package.json"))),prior=JSON.parse(execFileSync("git",["show",`${base}:package.json`],{cwd:root,encoding:"utf8"}));for(const key of ["dependencies","devDependencies","engines"])assert.deepEqual(current[key],prior[key]);
console.log("Slice 2C offline import purity, zero SDK/network/env wiring, production/Legacy isolation, unchanged dependencies and protected fingerprint: PASS");
