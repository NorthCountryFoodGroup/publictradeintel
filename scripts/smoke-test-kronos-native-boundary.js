"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), cp = require("node:child_process");
const guard = require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
try {
  let effects = 0;
  const original = Module._load, timers = [global.setTimeout, global.setInterval, global.setImmediate];
  const deny = () => { effects++; throw Error("NATIVE_IMPORT_EFFECT"); };
  global.setTimeout = global.setInterval = global.setImmediate = deny;
  Module._load = function(name, ...args) {
    if (name === "node:sqlite" || name.startsWith("@aws-sdk/")) return deny();
    const value = original.call(this, name, ...args);
    if (name === "node:fs") return new Proxy(value, {get: () => deny});
    if (name === "node:crypto") return new Proxy(value, {get: (obj, key) => ["sign", "createPrivateKey", "generateKeyPair", "generateKeyPairSync", "randomUUID", "randomBytes"].includes(key) ? deny : obj[key]});
    return value;
  };
  try { for (const name of ["proofs", "signer"]) require("../kronos/research-qualification-native-" + name); }
  finally { Module._load = original; [global.setTimeout, global.setInterval, global.setImmediate] = timers; }
  assert.equal(effects, 0);
  const root = path.resolve(__dirname, ".."), files = cp.execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "*.js"], {cwd: root, encoding: "utf8"}).trim().split(/\r?\n/);
  for (const file of new Set(files)) {
    if (file.startsWith("scripts/")) continue;
    const source = fs.readFileSync(path.join(root, file), "utf8");
    if (/^kronos\/research-qualification-native-(?:proofs|signer)\.js$/.test(file)) {
      assert.doesNotMatch(source, /process\.env|@aws-sdk|\bfetch\s*\(|https?:\/\/|createPrivateKey|generateKeyPair|setTimeout|setInterval|require\s*\([^)]*fixtures/);
      if (file.endsWith("proofs.js")) assert.doesNotMatch(source, /\.sign\(/);
    } else assert.doesNotMatch(source, /require\s*\([^)]*research-qualification-native-/);
  }
  const protectedPaths = ["server.js", "app.js", "render.yaml", "config", "lib", "discovery", "decision", "kronos-service", "kronos/service.js", "kronos/schema.js", "kronos/client.js", "kronos/persistence.js", "kronos/research-qualification-contracts.js", "kronos/research-qualification-authority.js", "kronos/research-qualification-policy.js", "kronos/research-qualification-signer-contracts.js", "kronos/research-qualification-signer-verifier.js", "kronos/research-qualification-preflight-contracts.js", "kronos/research-qualification-preflight-journal.js", "kronos/research-qualification-preflight-gate.js", "kronos/research-qualification-witness-contracts.js", "kronos/research-qualification-witness-state.js", "kronos/research-qualification-witness-disk.js", "kronos/research-qualification-witness-store.js", "kronos/research-backup-adapter.js", "kronos/research-backup-health.js", "package-lock.json"];
  assert.equal(cp.execFileSync("git", ["diff", "12118d8f4302c25cbac578045fcfda7cbeaafc40", "--", ...protectedPaths], {cwd: root, encoding: "utf8"}), "");
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"))), prior = JSON.parse(cp.execFileSync("git", ["show", "HEAD:package.json"], {cwd: root, encoding: "utf8"}));
  for (const key of ["dependencies", "devDependencies", "engines"]) assert.deepEqual(pkg[key], prior[key]);
  assert.equal(require("../kronos/research-backup-adapter").isQualifiedRealProvider(), false);
  require("./smoke-test-prediction-engine-boundary"); guard.assertClean();
  console.log("Native zero-effect import, no production/secret/network wiring, unchanged contracts/dependencies/Legacy fingerprint and false readiness: PASS");
} finally { guard.restore(); }
