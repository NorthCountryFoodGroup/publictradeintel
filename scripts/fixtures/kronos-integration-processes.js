"use strict";
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto"), cp = require("node:child_process");
const networkGuard = require("./kronos-s3-network-guard").denyExternalNetwork();
const nativeFixture = require("./kronos-native-evidence"), f = nativeFixture.f;
const ipc = require("../../kronos/research-qualification-integration-contracts"), w = nativeFixture.t.w;
function privateKey(seed) { return crypto.createPrivateKey({key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.alloc(32, seed)]), format: "der", type: "pkcs8"}); }
function signed(body, key) { return {body, signature: crypto.sign(null, ipc.bytes(body), key).toString("base64")}; }
function config() {
  const x = nativeFixture.setup(), identity = x.cfg.identity;
  identity.stores.push({storeId: "ordinary-store-next", writerEpoch: 2, domains: ["provider", "runtime", "restore"]});
  const clients = [["signer-one", "ordinary-store", 1, 121], ["signer-two", "ordinary-store-next", 2, 122], ["signer-independent", "independent-store", 1, 123]].map(([signerId, storeId, writerEpoch, seed]) => ({signerId, storeId, writerEpoch, publicKey: crypto.createPublicKey(privateKey(seed)).export({type: "spki", format: "pem"})}));
  return {identity, binding: x.cfg.binding, registry: x.registry, operators: [f.operator], vaultId: x.cfg.vaultId, now: f.t.f.time, clients,
    activeWriters: [{storeId: "ordinary-store", writerEpoch: 1}, {storeId: "independent-store", writerEpoch: 1}]};
}
function candidate(id = "provider", suffix = "") {
  const value = f.candidate(id, true);
  if (suffix) { value.request.requestId += "-" + suffix; value.request.nonce = w.hashValue(value.request.nonce + suffix); value.request = f.t.rehash(value.request, "requestHash"); value.approval = f.approved(value.request, value.attestation); }
  return value;
}
class Worker {
  constructor(fleet, name, role, root, clientId) {
    this.fleet = fleet; this.name = name; this.role = role; this.root = root; this.clientId = clientId; this.sequence = 0; this.pending = new Map(); this.tail = Promise.resolve(); this.buffer = ""; this.closed = false;
    this.child = cp.spawn(process.execPath, [path.join(__dirname, "kronos-integration-child.js")], {stdio: ["pipe", "pipe", "pipe"], windowsHide: true});
    this.decoder = new (require("node:string_decoder").StringDecoder)("utf8");
    this.stderr = ""; this.child.stderr.on("data", bytes => { this.stderr = (this.stderr + bytes.toString()).slice(-4000); });
    this.exit = new Promise(resolve => this.child.on("close", code => { this.closed = true; for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(Object.assign(Error("IPC_PROCESS_LOST"), {code: "IPC_PROCESS_LOST"})); } this.pending.clear(); resolve(code); }));
    this.child.stdin.on("error", () => {});
    this.child.stdout.on("data", bytes => {
      this.buffer += this.decoder.write(bytes);
      while (this.buffer.includes("\n")) { const end = this.buffer.indexOf("\n"), line = this.buffer.slice(0, end); this.buffer = this.buffer.slice(end + 1); this.message(JSON.parse(line)); }
    });
  }
  write(data) { if (!this.closed) this.child.stdin.write(JSON.stringify(data) + "\n"); }
  message(message) {
    if (message.kind === "rpc") {
      this.fleet.route(this, message).then(result => this.write({kind: "rpc-result", id: message.id, result}), error => this.write({kind: "rpc-result", id: message.id, error: /^[A-Z_]+$/.test(error.code || "") ? error.code : "IPC_UNAVAILABLE"}));
    } else if (message.kind === "result") {
      const entry = this.pending.get(message.id); if (!entry) return; this.pending.delete(message.id); clearTimeout(entry.timer);
      if (message.error) entry.reject(Object.assign(Error(message.error), {code: message.error})); else entry.resolve(message.result);
    } else { this.fleet.events.push({...message, worker: this.name, role: this.role, pid: this.child.pid}); this.fleet.onEvent?.(this, message); }
  }
  call(command, payload = {}) {
    if (this.role === "signer" && command === "issue" && !this.fleet.config.requireOperatorProcess) {
      const fixture = require("./kronos-operator-retention-evidence"), cfg = fixture.config({binding: this.fleet.config.binding, registry: this.fleet.config.registry, identity: this.fleet.config.identity, operators: this.fleet.config.operators});
      return this.fleet.witness.call("operator-retain", {record: fixture.record(payload.candidate, this.fleet.config.registry, cfg)}).then(() => this.call("retained-issue", payload));
    }
    if (command === "retained-issue") command = "issue";
    const run = () => new Promise((resolve, reject) => {
      if (this.closed) return reject(Object.assign(Error("IPC_PROCESS_LOST"), {code: "IPC_PROCESS_LOST"}));
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.pending.delete(id); this.child.kill(); reject(Object.assign(Error("IPC_TIMEOUT"), {code: "IPC_TIMEOUT"})); }, 60000);
      this.pending.set(id, {resolve, reject, timer}); this.write({id, command, payload});
    });
    const result = this.tail.then(run, run); this.tail = result.catch(() => {}); return result;
  }
  async close() { if (!this.closed) { await this.call("close").catch(() => {}); if (!this.closed) this.child.stdin.end(); } await this.exit; }
  async kill() { if (!this.closed) this.child.kill(); await this.exit; }
}
class Fleet {
  constructor(configuration = config()) { this.root = fs.mkdtempSync(path.join(os.tmpdir(), "pti-signer-integration-")); this.config = structuredClone(configuration); this.workers = new Map(); this.events = []; this.fault = null; }
  async route(from, message) {
    w.check((from.role === "operator" && ((message.to === "witness" && ["operator-source", "operator-proof", "operator-append"].includes(message.command)) || (message.to === "signer" && message.command === "issuance-state"))) || (from.role === "signer" && message.to === "witness" && ["challenge", "authenticated", "operator-proof"].includes(message.command)) || (from.role === "witness" && message.to === "vault" && ["latest", "read", "append", "epoch-state", "operator-latest", "operator-read", "operator-append"].includes(message.command)), "IPC_ROUTE_DENIED");
    const target = this.workers.get(message.to); w.check(target && !target.closed, "IPC_UNAVAILABLE");
    const deliver = () => target.call(message.command, message.payload);
    return this.fault ? this.fault({from, ...message}, deliver) : deliver();
  }
  async start(name, role, {mode = "initialize-new", clientId = "signer-one"} = {}) {
    const root = path.join(this.root, name); fs.mkdirSync(root, {recursive: true});
    const worker = new Worker(this, name, role, root, clientId); this.workers.set(name, worker);
    try { await worker.call("init", {role, root, mode, clientId, config: this.config}); return worker; }
    catch (error) { await worker.kill(); throw error; }
  }
  async open() { await this.start("vault", "vault"); await this.start("witness", "witness"); await this.start("signer", "signer"); return this; }
  get signer() { return this.workers.get("signer"); }
  get witness() { return this.workers.get("witness"); }
  get vault() { return this.workers.get("vault"); }
  recoverLocks(name) {
    const root = path.resolve(this.root, name); w.check(path.dirname(root) === path.resolve(this.root), "UNSAFE_TEMP_ROOT");
    for (const file of fs.readdirSync(root).filter(x => x.endsWith(".writer.lock"))) {
      const lock = path.join(root, file), record = JSON.parse(fs.readFileSync(lock));
      require("../../kronos/research-qualification-witness-disk").recoverOwnership(lock.slice(0, -12), {expectedOwnerId: record.ownerId, operatorRef: "explicit-dead-process-fixture"});
    }
  }
  async restart(name) { const old = this.workers.get(name); await old.kill(); this.recoverLocks(name); return this.start(name, old.role, {mode: "open-existing", clientId: old.clientId}); }
  capture(name) { const root = path.join(this.root, name); return Object.fromEntries(fs.readdirSync(root).filter(x => x.endsWith(".sqlite")).map(x => [x, fs.readFileSync(path.join(root, x))])); }
  restore(name, files) {
    const root = path.resolve(this.root, name); w.check(path.dirname(root) === path.resolve(this.root) && this.workers.get(name)?.closed !== false, "UNSAFE_TEMP_ROOT"); fs.mkdirSync(root, {recursive: true});
    for (const [file, bytes] of Object.entries(files)) { w.check(path.basename(file) === file && file.endsWith(".sqlite"), "UNSAFE_TEMP_ROOT"); fs.writeFileSync(path.join(root, file), bytes); }
  }
  async packet(operation, payload, clientId = "signer-one") {
    const client = this.config.clients.find(x => x.signerId === clientId), requestHash = ipc.requestHash(operation, payload);
    const challenge = await this.witness.call("challenge", {signerId: clientId, requestHash});
    return {challenge, request: signed({version: ipc.V.request, signerId: clientId, witnessId: this.config.identity.witnessId, witnessEpoch: this.config.identity.epoch, storeId: client.storeId, writerEpoch: client.writerEpoch,
      challengeHash: w.hashValue(challenge), operation, payload, requestHash}, privateKey({"signer-one": 121, "signer-two": 122, "signer-independent": 123}[client.signerId]))};
  }
  async proof(data, signer = this.signer) {
    const challengeNonce = crypto.randomBytes(32).toString("hex"), bundle = await signer.call("bundle", {candidate: data, challengeNonce});
    return {bundle, requirements: {challengeNonce, minimumSequence: bundle.view.body.sequence, expectedDomain: f.t.s.role(data.attestation)}};
  }
  async dispose() { this.fault = null; for (const role of ["operator", "signer", "verifier", "witness", "vault"]) for (const worker of this.workers.values()) if (worker.role === role) await worker.close(); for (const name of this.workers.keys()) this.recoverLocks(name); f.removeTemp(this.root); networkGuard.assertClean(); }
}
function unavailable(code = "IPC_UNAVAILABLE") { throw Object.assign(Error(code), {code}); }
module.exports = {Fleet, Worker, candidate, config, signed, privateKey, unavailable, f, ipc, w};
