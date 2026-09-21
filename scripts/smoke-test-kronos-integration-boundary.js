"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), cp = require("node:child_process");
const guard = require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
try {
  const original = Module._load, timers = [global.setTimeout, global.setInterval, global.setImmediate]; let effects = 0;
  const deny = () => { effects++; throw Error("INTEGRATION_IMPORT_EFFECT"); };
  global.setTimeout = global.setInterval = global.setImmediate = deny;
  Module._load = function(name, ...args) {
    if (name === "node:sqlite" || name.startsWith("@aws-sdk/")) return deny(); const value = original.call(this, name, ...args);
    if (name === "node:fs") return new Proxy(value, {get: () => deny});
    if (name === "node:crypto") return new Proxy(value, {get: (object, key) => ["sign", "createPrivateKey", "generateKeyPair", "generateKeyPairSync", "randomBytes", "randomUUID"].includes(key) ? deny : object[key]});
    return value;
  };
  try { require("../kronos/research-qualification-integration-contracts"); require("../kronos/research-qualification-public-proof"); }
  finally { Module._load = original; [global.setTimeout, global.setInterval, global.setImmediate] = timers; }
  assert.equal(effects, 0);
  const root = path.resolve(__dirname, ".."), newModules = ["kronos/research-qualification-integration-contracts.js", "kronos/research-qualification-public-proof.js"];
  const files = cp.execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "*.js"], {cwd: root, encoding: "utf8"}).trim().split(/\r?\n/);
  for (const file of new Set(files)) {
    if (file.startsWith("scripts/")) continue;
    const source = fs.readFileSync(path.join(root, file), "utf8");
    if (newModules.includes(file)) assert.doesNotMatch(source, /process\.env|@aws-sdk|\bfetch\s*\(|\.sign\(|createPrivateKey|generateKeyPair|setTimeout|setInterval|node:(?:fs|sqlite|child_process|net|http|https)|require\s*\([^)]*fixtures/);
    else if (!/^kronos\/research-qualification-operator-(?:contracts|store|control|proof|cli)\.js$/.test(file)) assert.doesNotMatch(source, /require\s*\([^)]*research-qualification-(?:integration-contracts|public-proof)/);
  }
  const tracked = cp.execFileSync("git", ["ls-files", "kronos"], {cwd: root, encoding: "utf8"}).trim().split(/\r?\n/).filter(x => !newModules.includes(x) && !/^kronos\/research-qualification-operator-(?:contracts|store|control|proof|cli)\.js$/.test(x));
  const protectedPaths = ["server.js", "app.js", "render.yaml", "config", "lib", "discovery", "decision", "kronos-service", "package-lock.json", ...tracked];
  assert.equal(cp.execFileSync("git", ["diff", "14f88bfea908cf535bd91bc69ec26a99a75f93d4", "--", ...protectedPaths], {cwd: root, encoding: "utf8"}), "");
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"))), old = JSON.parse(cp.execFileSync("git", ["show", "HEAD:package.json"], {cwd: root, encoding: "utf8"}));
  for (const key of ["dependencies", "devDependencies", "engines"]) assert.deepEqual(pkg[key], old[key]);
  assert.equal(require("../kronos/research-backup-adapter").isQualifiedRealProvider(), false);
  require("./smoke-test-prediction-engine-boundary"); guard.assertClean();
  console.log("Pure public modules, zero import capabilities, no production wiring, all prior runtime contracts unchanged, stable dependencies/Legacy fingerprint and false readiness: PASS");
} finally { guard.restore(); }
