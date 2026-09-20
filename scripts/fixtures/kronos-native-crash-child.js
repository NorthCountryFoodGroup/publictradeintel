"use strict";
require("./kronos-s3-network-guard").denyExternalNetwork();
const t = require("./kronos-native-evidence");
const [root, stage] = process.argv.slice(2);
const x = t.open(root, {hook(at) { if (at === stage) process.exit(73); }});
x.signer.issue(x.fixture.data);
throw Error("CRASH_HOOK_NOT_REACHED");
