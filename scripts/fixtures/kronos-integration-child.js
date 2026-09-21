"use strict";
// Test transport only: each role owns its files and creates only its fictional role keys.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const guard = require("./kronos-s3-network-guard").denyExternalNetwork();
const w = require("../../kronos/research-qualification-witness-contracts");
const ipc = require("../../kronos/research-qualification-integration-contracts");
const p = require("../../kronos/research-qualification-preflight-contracts");
const {openDisk, recoverOwnership} = require("../../kronos/research-qualification-witness-disk");
const decoder = new (require("node:string_decoder").StringDecoder)("utf8");
let buffered = "", rpcSequence = 0, role, cfg, root, witness, vault, epochDisk, signer, provider, client, transportKey, witnessKey, activeStage = null, crashStage = null, crashAppend = null, appendCount = 0, requestId = null;
let operatorVault, operatorWitness, retentionGate, operatorStore, operatorController, operatorSession, operatorProvider;
const retentionFixture = require("./kronos-operator-retention-evidence");
function retentionConfig() { return retentionFixture.config({binding: cfg.binding, registry: cfg.registry, identity: cfg.identity, operators: cfg.operators}); }
const keyRoles = [], nativeKeys = new Map();
function send(value) { fs.writeSync(1, JSON.stringify(value) + "\n"); }
function read() {
  while (!buffered.includes("\n")) { const bytes = Buffer.alloc(65536); const n = fs.readSync(0, bytes, 0, bytes.length, null); if (!n) throw Error("IPC_EOF"); buffered += decoder.write(bytes.subarray(0, n)); w.check(Buffer.byteLength(buffered) <= 32 * 1024 * 1024, "IPC_FRAME_LIMIT"); }
  const end = buffered.indexOf("\n"), line = buffered.slice(0, end); buffered = buffered.slice(end + 1); return JSON.parse(line);
}
function rpc(to, command, payload) {
  const id = ++rpcSequence; send({kind: "rpc", id, to, command, payload});
  const reply = read(); w.check(reply.kind === "rpc-result" && reply.id === id, "IPC_CORRELATION");
  if (reply.error) w.fail(reply.error); return reply.result;
}
function key(seed, label) {
  keyRoles.push(label);
  return crypto.createPrivateKey({key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.alloc(32, seed)]), format: "der", type: "pkcs8"});
}
function sign(body, privateKey) { return {body, signature: crypto.sign(null, ipc.bytes(body), privateKey).toString("base64")}; }
function at() { return cfg.now; }
function authority() { return p.createOperatorAuthority({operators: cfg.operators, binding: cfg.binding}); }
function status() { return {pid: process.pid, role, keyRoles: [...keyRoles], state: witness ? witness.status().state : "READY", native: provider?.metrics() || null, network: guard.counts()}; }
function hook(stage) {
  activeStage = stage; send({kind: "stage", stage, requestId, metrics: provider?.metrics() || null});
  if (stage === crashStage && (crashAppend === null || appendCount === crashAppend)) process.exit(73);
}
function epochState() {
  const data = epochDisk.read(); w.check(data.entries.length === data.completed, "IPC_EPOCH_RECOVERY_REQUIRED");
  const active = structuredClone(cfg.activeWriters);
  for (const signed of data.entries) {
    const current = active.find(x => x.storeId === signed.body.fromStore);
    w.check(current, "IPC_EPOCH_CHAIN");
    const body = ipc.verifyTransition(signed, {operator: cfg.operators[0], identity: cfg.identity, current, now: Date.parse(signed.body.issuedAt)});
    current.storeId = body.toStore; current.writerEpoch = body.toEpoch;
  }
  return {active, transitions: data.entries};
}
function activeClient(signerId) {
  const selected = cfg.clients.find(c => c.signerId === signerId);
  w.check(selected, "IPC_CLIENT_UNKNOWN");
  const head = rpc("vault", "epoch-state", {});
  w.check(head.active.some(x => x.storeId === selected.storeId && x.writerEpoch === selected.writerEpoch), "IPC_OLD_WRITER"); return selected;
}
function history() {
  const head = rpc("vault", "latest", {}), out = [];
  for (let i = 1; i <= (head?.sequence || 0); i++) out.push({entry: rpc("vault", "read", {sequence: i}).entry, ack: witness.acknowledgment(i)});
  w.check(witness.status().state === "READY", witness.status().state); return out;
}
function witnessCall(operation, payload) {
  const requestHash = ipc.requestHash(operation, payload);
  const challenge = rpc("witness", "challenge", {signerId: client.signerId, requestHash});
  ipc.challenge(ipc.verify(challenge, cfg.identity.publicKey), client, cfg.identity, at());
  w.check(challenge.body.requestHash === requestHash, "IPC_REQUEST_BINDING");
  const body = {version: ipc.V.request, signerId: client.signerId, witnessId: cfg.identity.witnessId, witnessEpoch: cfg.identity.epoch,
    storeId: client.storeId, writerEpoch: client.writerEpoch, challengeHash: w.hashValue(challenge), operation, payload, requestHash};
  const packet = {challenge, request: sign(body, transportKey)};
  return ipc.verifyResponse(rpc("witness", "authenticated", packet), packet, cfg.identity);
}
function adapter() { return {
  history: () => witnessCall("history", {}), view: value => witnessCall("view", value),
  append(value) {
    try { return witnessCall("append", value); }
    catch (error) {
      if (!["IPC_LOST_RESPONSE", "IPC_UNAVAILABLE"].includes(error.code)) throw error;
      const exact = witnessCall("history", {}).find(x => x.entry.append.appendHash === value.appendHash);
      w.check(exact, "IPC_UNRESOLVED_APPEND"); return exact.ack;
    }
  }
}; }
function init(data) {
  role = data.role; cfg = data.config; root = data.root; client = cfg.clients.find(c => c.signerId === data.clientId);
  const mode = data.mode;
  if (role === "vault") {
    vault = require("./kronos-witness-vault").openFakeVault(path.join(root, "vault.sqlite"), {mode, vaultId: cfg.vaultId});
    operatorVault = require("./kronos-witness-vault").openFakeVault(path.join(root, "operator-vault.sqlite"), {mode, vaultId: retentionConfig().vaultId});
    epochDisk = openDisk(path.join(root, "epochs.sqlite"), {mode, metadata: {version: ipc.V.epoch, identity: cfg.identity, operator: cfg.operators[0], active: cfg.activeWriters}});
  } else if (role === "witness") {
    witnessKey = key(102, "witness");
    witness = require("../../kronos/research-qualification-witness-store").openWitness(path.join(root, "witness.sqlite"), {
      mode, identity: cfg.identity, binding: cfg.binding, registryPins: [cfg.registry.registryHash], operatorAuthority: authority(), vaultId: cfg.vaultId,
      vault: {latest: () => rpc("vault", "latest", {}), read: sequence => rpc("vault", "read", {sequence}), append: entry => rpc("vault", "append", {entry})},
      signWitness: bytes => crypto.sign(null, bytes, witnessKey).toString("base64"), now: at, hook});
    operatorWitness = require("../../kronos/research-qualification-operator-retention-witness").openWitness(path.join(root, "operator-witness.sqlite"), {mode, config: retentionConfig(), now: at, hook,
      vault: {latest: () => rpc("vault", "operator-latest", {}), read: sequence => rpc("vault", "operator-read", {sequence}), append: entry => rpc("vault", "operator-append", {entry})},
      signWitness: bytes => crypto.sign(null, bytes, witnessKey).toString("base64")});
  } else if (role === "signer") {
    w.check(client, "IPC_CLIENT_UNKNOWN"); transportKey = key({"signer-one": 121, "signer-two": 122, "signer-independent": 123}[client.signerId], "transport-" + client.signerId);
    const domains = cfg.identity.stores.find(x => x.storeId === client.storeId).domains;
    const rows = cfg.registry.signers.filter(row => domains.includes(row.domain)).map(row => {
      const seed = {provider: 1, runtime: 2, restore: 3, independent: 4}[row.signerId];
      const privateKey = key(seed, row.signerId); nativeKeys.set(privateKey, row.signerId);
      return {signerId: row.signerId, domain: row.domain, issuer: row.issuer, publicKey: row.publicKey, keyFingerprint: row.keyFingerprint, privateKey};
    });
    const originalSign = crypto.sign;
    crypto.sign = function(algorithm, bytes, privateKey) {
      if (nativeKeys.has(privateKey)) send({kind: "signature", requestId, signerId: nativeKeys.get(privateKey), signatureKind: Buffer.from(bytes).toString("utf8").startsWith("KRONOS_OPERATOR_CONSUMPTION_V1\n") ? "operator-consumption" : Buffer.from(bytes).toString("utf8").startsWith("KRONOS_ISSUANCE_CONTEXT_V1\n") ? "context" : "attestation"});
      return originalSign.call(this, algorithm, bytes, privateKey);
    };
    const native = require("../../kronos/research-qualification-native-signer");
    provider = native.createFixtureKeyProvider({testOnly: true, keys: rows});
    retentionGate = require("../../kronos/research-qualification-operator-retention").createGate({config: retentionConfig(), adapter: {proof: challengeNonce => rpc("witness", "operator-proof", {challengeNonce})}, now: at});
    signer = native.openOfflineSigner({mode, journalFile: path.join(root, "signer.sqlite"), storeId: client.storeId, writerEpoch: client.writerEpoch,
      operatorRetention: retentionGate, retentionConfig: retentionConfig(), provider, operatorAuthority: authority(), binding: cfg.binding, initialRegistry: cfg.registry, registryPins: [cfg.registry.registryHash], witnessIdentity: cfg.identity,
      vaultId: cfg.vaultId, witnessAdapter: adapter(), now: at, hook});
  } else if (role === "operator") {
    const cfgRetention = retentionConfig(), control = require("../../kronos/research-qualification-operator-control");
    operatorStore = require("../../kronos/research-qualification-operator-store").openStore(path.join(root, "operator.sqlite"), {mode, metadata: {version: "operator-retention-fixture", config: cfgRetention}});
    const operatorKey = key(85, "operator");
    operatorProvider = control.createAuthProvider({identity: cfg.operators[0], now: at, authenticate: input => input?.fixtureUserPresence === true,
      signApproval(v) { send({kind: "operator-sign", type: "approval"}); return crypto.sign(null, p.approvalBytes(v), operatorKey).toString("base64"); },
      signDecision(v) { send({kind: "operator-sign", type: "decision"}); return crypto.sign(null, require("../../kronos/research-qualification-operator-contracts").decisionBytes(v), operatorKey).toString("base64"); }});
    const adapter = {proof: challengeNonce => rpc("witness", "operator-proof", {challengeNonce}), append: value => rpc("witness", "operator-append", {value})};
    const retained = require("../../kronos/research-qualification-operator-retention").createClient({config: cfgRetention, adapter, store: operatorStore, writerStoreId: "ordinary-store", writerEpoch: 1, now: at, hook});
    const candidate = {request: cfg.operatorCandidate.request, attestation: cfg.operatorCandidate.attestation};
    const source = {pending: async () => [candidate.request.requestId], available: async () => true,
      snapshot: async (id, challengeNonce) => ({candidate, registry: cfg.registry, research: cfg.research || null, issuanceState: rpc("signer", "issuance-state", {requestId: id}).state, ...rpc("witness", "operator-source", {challengeNonce}), signerAvailable: true})};
    operatorController = control.createController({store: operatorStore, provider: operatorProvider, retention: retained, config: {binding: cfg.binding, registryPins: [cfg.registry.registryHash], operators: cfg.operators, witnessIdentity: cfg.identity, vaultId: cfg.vaultId, storeId: "ordinary-store", operatorStoreId: cfgRetention.ledgerId}, source, now: at, confirm: async v => v.phrase, hook});
  } else w.check(role === "verifier", "IPC_ROLE");
  return status();
}
function dispatch(command, data) {
  if (command === "init") return init(data);
  if (command === "status") return status();
  if (command === "crash-at") { crashStage = data.stage; crashAppend = data.appendNumber ?? null; return true; }
  if (command === "clock") { cfg.now = data.now; return true; }
  if (command === "close") { operatorStore?.close(); operatorProvider?.close(); signer?.close(); operatorWitness?.close(); witness?.close(); operatorVault?.close(); vault?.close(); epochDisk?.close(); guard.assertClean(); return status(); }
  if (role === "vault") {
    if (command === "operator-latest") return operatorVault.latest();
    if (command === "operator-read") return operatorVault.read(data.sequence);
    if (command === "operator-append") return operatorVault.append(data.entry);
    if (command === "latest") return vault.latest();
    if (command === "read") return vault.read(data.sequence);
    if (command === "append") return vault.append(data.entry);
    if (command === "epoch-state") return epochState();
    if (command === "transition") {
      const current = epochState().active.find(x => x.storeId === data.body.fromStore);
      w.check(current, "IPC_EPOCH_CHAIN"); ipc.verifyTransition(data, {operator: cfg.operators[0], identity: cfg.identity, current, now: at()});
      const seq = epochDisk.append(data); epochDisk.complete(seq); return epochState();
    }
  }
  if (role === "witness") {
    if (command === "operator-source") return {history: history(), view: witness.freshView({storeId: "ordinary-store", challengeNonce: data.challengeNonce})};
    if (command === "operator-append") return operatorWitness.append(data.value);
    if (command === "operator-recover") return operatorWitness.recoverPublication({operatorRef: "explicit-fixture-recovery"});
    if (command === "operator-proof") return operatorWitness.proof(data.challengeNonce);
    if (command === "operator-retain") {
      const r = require("../../kronos/research-qualification-operator-retention-contracts"), challengeNonce = "a".repeat(64), proof = operatorWitness.proof(challengeNonce);
      const model = r.verifyProof(proof, retentionConfig(), {challengeNonce, now: at()}), old = model.requests.get(data.record.decision.context.requestId);
      if (old) { require("../../kronos/research-qualification-operator-contracts").equal(old.append.record, data.record); return true; }
      return operatorWitness.append(r.request(data.record, model, retentionConfig()));
    }
    if (command === "challenge") {
      const selected = activeClient(data.signerId); w.check(typeof data.requestHash === "string" && /^[a-f0-9]{64}$/.test(data.requestHash), "IPC_REQUEST_BINDING");
      return sign({version: ipc.V.challenge, signerId: selected.signerId, witnessId: cfg.identity.witnessId, witnessEpoch: cfg.identity.epoch,
        storeId: selected.storeId, writerEpoch: selected.writerEpoch, requestHash: data.requestHash, nonce: crypto.randomBytes(32).toString("hex"), issuedAt: new Date(at()).toISOString(), expiresAt: new Date(at() + 300000).toISOString()}, witnessKey);
    }
    if (command === "authenticated") {
      const selected = activeClient(data.request?.body?.signerId), body = ipc.verifyRequest(data, {client: selected, identity: cfg.identity, now: at()});
      let result;
      if (body.operation === "history") result = history();
      if (body.operation === "view") result = witness.freshView(body.payload);
      if (body.operation === "append") {
        const prior = history().find(x => x.entry.append.appendHash === body.payload.appendHash);
        if (prior) result = prior.ack;
        else { appendCount++; result = witness.append(body.payload); }
      }
      hook("response"); return sign({version: ipc.V.response, requestHash: body.requestHash, challengeHash: body.challengeHash, result}, witnessKey);
    }
    if (command === "recover") return witness.recoverPublication({operatorRef: data.operatorRef});
  }
  if (role === "signer") {
    if (["issue", "recover", "get"].includes(command)) {
      requestId = data.candidate.request.requestId;
      if (command === "recover") return signer.recover(data.candidate, {operatorRef: data.operatorRef});
      return signer[command](data.candidate);
    }
    if (command === "bundle") {
      const result = signer.get(data.candidate), history = witnessCall("history", {}), view = witnessCall("view", {storeId: client.storeId, challengeNonce: data.challengeNonce});
      return require("../../kronos/research-qualification-public-proof").buildProofBundle({result, approval: data.candidate.approval, registry: cfg.registry, history, view});
    }
    if (command === "issuance-state") return signer.status(data.requestId);
  }
  if (role === "operator") {
    if (command === "execute") return (async () => { if (!operatorSession) operatorSession = await operatorProvider.authenticate({fixtureUserPresence: true}); return operatorController.execute(data.command, data.args, operatorSession); })();
    if (command === "local-decision") return operatorStore.decision(data.requestId);
    if (command === "retained-markers") return operatorStore.retained();
  }
  if (role === "verifier" && command === "verify-retention") {
    const Module = require("node:module"), load = Module._load, originalSign = crypto.sign, originalPrivate = crypto.createPrivateKey;
    Module._load = function(name, ...args) { if (name === "node:sqlite") w.fail("VERIFIER_PRIVATE_STATE"); return load.call(this, name, ...args); };
    crypto.sign = crypto.createPrivateKey = () => w.fail("VERIFIER_PRIVATE_KEY");
    try { return require("../../kronos/research-qualification-operator-retention-proof").verifyDecisionProof(data.proof, retentionConfig(), data.requirements); }
    finally { Module._load = load; crypto.sign = originalSign; crypto.createPrivateKey = originalPrivate; }
  }
  if (role === "verifier" && command === "verify") {
    const verifier = require("../../kronos/research-qualification-public-proof").createPublicVerifier({binding: cfg.binding, registryPins: [cfg.registry.registryHash], witnessIdentity: cfg.identity, operators: cfg.operators, vaultId: cfg.vaultId, retentionConfig: retentionConfig(), now: at});
    const Module = require("node:module"), load = Module._load, signOriginal = crypto.sign, privateOriginal = crypto.createPrivateKey;
    Module._load = function(name, ...args) { if (name === "node:sqlite") w.fail("VERIFIER_PRIVATE_STATE"); return load.call(this, name, ...args); };
    crypto.sign = crypto.createPrivateKey = () => w.fail("VERIFIER_PRIVATE_KEY");
    try { return verifier.verify(data.bundle, data.requirements); }
    finally { Module._load = load; crypto.sign = signOriginal; crypto.createPrivateKey = privateOriginal; }
  }
  w.fail("IPC_COMMAND_DENIED");
}
(async () => { while (true) {
  let message;
  try { message = read(); } catch { break; }
  try { const result = await dispatch(message.command, message.payload); send({kind: "result", id: message.id, result}); if (message.command === "close") break; }
  catch (error) { send({kind: "result", id: message.id, error: /^[A-Z_]+$/.test(error?.code || "") ? error.code : "IPC_FIXTURE_FAILURE"}); }
}

})().catch(() => { process.exitCode = 1; });
