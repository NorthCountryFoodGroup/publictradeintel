"use strict";
const {spawnSync} = require("node:child_process"), scripts = require("../package.json").scripts;
const names = [
  ...["flow", "transport", "recovery", "continuity", "proof", "boundary"].map(n => "smoke:kronos-integration-" + n),
  ...["keys", "authorization", "witness", "recovery", "boundary"].map(n => "smoke:kronos-native-" + n),
  ...["contracts", "continuity", "vault", "recovery", "boundary"].map(n => "smoke:kronos-witness-" + n),
  ...["sizes", "operator", "journal", "gate", "boundary"].map(n => "smoke:kronos-preflight-" + n),
  "smoke:kronos-signer-contracts", "smoke:kronos-signer-lifecycle", "smoke:kronos-signer-boundary",
  "smoke:kronos-real-attestations", "smoke:kronos-qualification-authority", "smoke:kronos-qualification-coverage", "smoke:kronos-qualification-boundary",
  ...Object.keys(scripts).filter(n => /^smoke:kronos-(s3-|backup-|recovery-bundle$|research-(archive$|replay$|artifact-recovery$|portable-boundary$|canonical$|store$|recovery$|storage-boundary$|contracts$|guards$|boundary$))/.test(n))
];
if (names.length !== 57 || new Set(names).size !== 57) throw Error("OFFLINE_SUITE_COUNT");
for (const name of names) {
  console.log("\nSUITE " + name);
  const args = scripts[name].split(" "); if (args.shift() !== "node") throw Error("OFFLINE_SUITE_COMMAND");
  const result = spawnSync(process.execPath, args, {cwd: require("node:path").resolve(__dirname, ".."), stdio: "inherit", timeout: 900000});
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log("ALL 57 OFFLINE SUITES PASSED");
