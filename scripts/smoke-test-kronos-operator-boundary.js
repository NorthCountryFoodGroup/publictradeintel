"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), cp = require("node:child_process");
const guard = require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
(async () => {
  const cached = new Set(Object.keys(require.cache));
  const original = Module._load, timers = [global.setTimeout, global.setInterval, global.setImmediate]; let effects = 0;
  const deny = () => { effects++; throw Error("OPERATOR_IMPORT_EFFECT"); };
  global.setTimeout = global.setInterval = global.setImmediate = deny;
  Module._load = function(name, ...args) {
    if (name === "node:sqlite" || name.startsWith("@aws-sdk/")) return deny(); const value = original.call(this, name, ...args);
    if (name === "node:fs") return new Proxy(value, {get: () => deny});
    if (name === "node:crypto") return new Proxy(value, {get: (object, key) => ["sign", "createPrivateKey", "generateKeyPair", "generateKeyPairSync", "randomBytes", "randomUUID"].includes(key) ? deny : object[key]});
    return value;
  };
  const names = ["contracts", "store", "control", "proof", "cli", "retention", "retention-contracts", "retention-witness", "retention-proof"];
  try { names.forEach(name => require("../kronos/research-qualification-operator-" + name)); require("./kronos-operator-cli-offline"); }
  finally { Module._load = original; [global.setTimeout, global.setInterval, global.setImmediate] = timers; }
  assert.equal(effects, 0); for (const id of Object.keys(require.cache)) if (!cached.has(id)) delete require.cache[id];
  const root = path.resolve(__dirname, ".."), modules = names.map(n => "kronos/research-qualification-operator-" + n + ".js");
  const files = cp.execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "*.js"], {cwd: root, encoding: "utf8"}).trim().split(/\r?\n/);
  for (const file of new Set(files)) {
    if (file.startsWith("scripts/")) continue;
    const source = fs.readFileSync(path.join(root, file), "utf8");
    if (modules.includes(file)) assert.doesNotMatch(source, /process\.env|@aws-sdk|\bfetch\s*\(|createPrivateKey|generateKeyPair|setTimeout|setInterval|node:(?:child_process|net|http|https)|require\s*\([^)]*fixtures/);
    else if (!["kronos/research-qualification-native-signer.js", "kronos/research-qualification-public-proof.js"].includes(file)) assert.doesNotMatch(source, /require\s*\([^)]*research-qualification-operator-/);
  }
  const protectedFiles = cp.execFileSync("git", ["ls-tree", "-r", "--name-only", "8ddaa386060702c1e47380c1ef257b6154cbd32e", "kronos"], {cwd: root, encoding: "utf8"}).trim().split(/\r?\n/);
  assert.equal(cp.execFileSync("git", ["diff", "8ddaa386060702c1e47380c1ef257b6154cbd32e", "--", "server.js", "app.js", "render.yaml", "config", "lib", "discovery", "decision", "kronos-service", "package-lock.json", ...protectedFiles.filter(x => !["kronos/research-qualification-native-signer.js", "kronos/research-qualification-public-proof.js"].includes(x))], {cwd: root, encoding: "utf8"}), "");
  const cli = require("../kronos/research-qualification-operator-cli"), t = require("./fixtures/kronos-operator-evidence"), temp = t.temp(); let x;
  try {
    x = t.setup(temp); const session = await x.session(), output = [];
    for (const argv of [["pending"], ["inspect", x.candidate.request.requestId], ["status"], ["sign", "LOGIN_PIN"], ["result", x.candidate.request.requestId]]) await cli.run({argv, controller: x.controller, session, write: s => output.push(s)});
    x.source.available = async () => ({rawEnvironment: "must-not-escape"}); const status = await x.controller.execute("status", {}, session); assert.equal(status.signerAvailable, false); assert(!JSON.stringify(status).includes("must-not-escape"));
    const review = await x.inspect(session), approval = await x.approve(session, review.reviewHash); output.push(cli.render(approval)); x.issue(approval); output.push(cli.render(await x.controller.execute("result", {requestId: x.candidate.request.requestId}, session)));
    for (const secret of ["PRIVATE KEY", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "SessionToken", "AccessKeyId", "Authorization", "LOGIN_PIN", "ADMIN_PIN", "KRONOS_SERVICE_TOKEN", "cookie", "OIDC", "Bearer"]) { assert(!output.join("\n").includes(secret)); assert.throws(() => cli.render({secret})); }
    const pkg = require("../package.json"), old = JSON.parse(cp.execFileSync("git", ["show", "HEAD:package.json"], {cwd: root, encoding: "utf8"})); for (const k of ["dependencies", "devDependencies", "engines"]) assert.deepEqual(pkg[k], old[k]);
  } finally { x?.close(); t.remove(temp); }
  const cliRoot = t.initialize();
  try {
    const entry = path.join(__dirname, "kronos-operator-cli-offline.js");
    const accepted = cp.spawnSync(process.execPath, [entry, "--fixture", cliRoot, "pending"], {input: "FIXTURE OPERATOR PRESENT\n", encoding: "utf8", timeout: 30000, windowsHide: true});
    assert.equal(accepted.status, 0, accepted.stderr); assert.match(accepted.stdout, /request-provider/);
    const refused = cp.spawnSync(process.execPath, [entry, "--fixture", cliRoot, "pending"], {input: "", encoding: "utf8", timeout: 30000, windowsHide: true});
    assert.equal(refused.status, 1); assert.match(refused.stdout, /OPERATOR_REFUSED/);
  } finally { t.remove(cliRoot); }
  require("./smoke-test-prediction-engine-boundary"); guard.assertClean();
  console.log("Operator import purity, CLI output exclusion, explicit offline extensions, unchanged dependencies/production/Legacy and zero network: PASS");
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => guard.restore());
