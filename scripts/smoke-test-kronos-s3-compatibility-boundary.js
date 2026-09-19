"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
require("./smoke-test-kronos-backup-boundary");
const directory=path.join(__dirname,"../kronos");for(const name of fs.readdirSync(directory).filter(n=>/^research-backup-.*\.js$/.test(n))){const source=fs.readFileSync(path.join(directory,name),"utf8");if(!["research-backup-deadline.js","research-backup-delivery-v2.js"].includes(name))assert.doesNotMatch(source,/\bsetTimeout\s*\(|node:timers/,name);assert.doesNotMatch(source,/@aws-sdk|process\.env|\bfetch\s*\(/,name);}
assert.equal(require("../kronos/research-backup-adapter").isQualifiedRealProvider(),false);
console.log("S3 compatibility import purity, scoped runtime timers, no SDK/env/network/service wiring, trusted qualification absent and Legacy boundary: PASS");
