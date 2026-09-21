"use strict";
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const n = require("./kronos-native-evidence"), w = require("../../kronos/research-qualification-witness-contracts");
const control = require("../../kronos/research-qualification-operator-control"), storage = require("../../kronos/research-qualification-operator-store");
const proof = require("../../kronos/research-qualification-public-proof");
function setup(root, {mode = "initialize-new", kind = "provider", now, confirm = async v => v.phrase, hook, nonce, mutateSource = x => x, authProvider} = {}) {
  const fixture = n.setup({kind}); let at = n.f.t.f.time;
  const clock = now || (() => at), x = n.open(root, {fixture, mode, now: clock});
  const {request, attestation} = fixture.data, candidate = {request, attestation}, research = {modelRevision: null, forecastContractVersion: null, researchContractVersion: null, inputCutoff: null};
  const identity = {...n.f.operator, streamIds: [attestation.binding.streamId]};
  const config = {binding: attestation.binding, operators: [identity], registryPins: [fixture.registry.registryHash], witnessIdentity: fixture.cfg.identity, vaultId: fixture.cfg.vaultId, storeId: fixture.storeId, operatorStoreId: "fixture-operator-store"};
  const metadata = {storeId: config.operatorStoreId, identityHash: w.hashValue(config)};
  const store = storage.openStore(path.join(root, "operator.sqlite"), {mode, metadata});
  let signatures = 0;
  const provider = authProvider || control.createAuthProvider({identity, now: clock, authenticate: input => input?.fixtureUserPresence === true,
    signApproval(v) { signatures++; return crypto.sign(null, n.f.p.approvalBytes(v), n.f.t.extraKey.privateKey).toString("base64"); },
    signDecision(v) { signatures++; return crypto.sign(null, require("../../kronos/research-qualification-operator-contracts").decisionBytes(v), n.f.t.extraKey.privateKey).toString("base64"); }});
  const source = {
    pending: async () => [request.requestId], available: async () => true,
    snapshot: async (id, challengeNonce) => mutateSource({candidate: structuredClone(candidate), registry: structuredClone(fixture.registry), research: structuredClone(research),
      issuanceState: x.signer.status(id).state, history: x.adapter.history(), view: x.adapter.view({storeId: config.storeId, challengeNonce}), signerAvailable: true}),
    result: async (id, approval, challengeNonce) => proof.buildProofBundle({result: x.signer.get({...candidate, approval}), approval, registry: fixture.registry, history: x.adapter.history(), view: x.adapter.view({storeId: config.storeId, challengeNonce})})
  };
  const controller = control.createController({store, provider, config, source, now: clock, confirm, hook, nonce});
  return {root, fixture, x, candidate, research, config, metadata, store, provider, source, controller, signatures: () => signatures,
    advance(ms) { at += ms; }, async session() { return provider.authenticate({fixtureUserPresence: true}); },
    async inspect(session) { return controller.execute("inspect", {requestId: request.requestId}, session); },
    async approve(session, reviewHash) { return controller.execute("approve", {requestId: request.requestId, reviewHash}, session); },
    async deny(session, reviewHash) { return controller.execute("deny", {requestId: request.requestId, reviewHash, reason: "EVIDENCE"}, session); },
    issue(record) { return x.signer.issue({...candidate, approval: record.approval}); },
    close() { store.close(); provider.close(); x.close(); }};
}
function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), "pti-signer-operator-")); }
function initialize() { const root = temp(), fixture = setup(root); fixture.close(); fs.writeFileSync(path.join(root, "operator-fixture.json"), JSON.stringify({version: 1, fictional: true})); return root; }
function assertFixture(root) {
  if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("pti-signer-operator-") || fs.lstatSync(root).isSymbolicLink()) throw Error("FIXTURE_PATH");
  const marker = JSON.parse(fs.readFileSync(path.join(root, "operator-fixture.json"))); if (marker.version !== 1 || marker.fictional !== true) throw Error("FIXTURE_MARKER");
}
module.exports = {setup, temp, initialize, assertFixture, remove: n.remove, n, w, control, storage};
