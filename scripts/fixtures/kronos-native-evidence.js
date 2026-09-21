"use strict";
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const t = require("./kronos-witness-evidence"), f = t.f;
const native = require("../../kronos/research-qualification-native-signer");
const sizes = require("./kronos-signer-sizes");
function setup({kind = "provider", profile = "typical", mutateRegistry = x => x} = {}) {
  const attestation = sizes.make(kind, profile), binding = attestation.binding;
  const reg = f.t.registry();
  for (const row of reg.signers) { row.allowedStreamIds = [binding.streamId]; row.softwareRevisions = [binding.softwareRevision]; }
  const registry = f.t.rehash(mutateRegistry(reg), "registryHash");
  const operator = {...f.operator, streamIds: [binding.streamId]};
  const authority = f.p.createOperatorAuthority({operators: [operator], binding});
  const id = kind === "independent-restore" ? "independent" : attestation.domain;
  const request = f.t.request(attestation, registry, id), approval = f.approved(request, attestation);
  const identity = t.identity(); identity.streamId = binding.streamId;
  const cfg = t.config({identity, binding, registryPins: [registry.registryHash], operatorAuthority: authority});
  return {data: {request, attestation, approval}, registry, cfg, storeId: id === "independent" ? "independent-store" : "ordinary-store"};
}
function keyRows(registry = f.t.registry()) {
  return registry.signers.map(({signerId, domain, issuer, publicKey, keyFingerprint}) => ({signerId, domain, issuer, publicKey, keyFingerprint, privateKey: f.t.f.keys[signerId].privateKey}));
}
function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), "pti-signer-native-")); }
function open(root, {fixture = setup(), mode = "initialize-new", wrap = x => x, provider, hook, vaultWrap, now, deferRetention = false} = {}) {
  const x = t.open(root, {mode, cfg: fixture.cfg, ...(vaultWrap ? {vaultWrap} : {})});
  const retentionFixture = require("./kronos-operator-retention-evidence");
  const retentionConfig = retentionFixture.config({binding: fixture.cfg.binding, registry: fixture.registry, identity: fixture.cfg.identity, operators: [{...f.operator, streamIds: [fixture.cfg.binding.streamId]}]});
  const retained = retentionFixture.open(root, {mode, config: retentionConfig, now: now || fixture.cfg.now});
  try {
    const adapter = wrap({
      history() { const n = x.vault.latest()?.sequence || 0; return Array.from({length: n}, (_, i) => ({entry: x.vault.read(i + 1).entry, ack: x.witness.acknowledgment(i + 1)})); },
      view: input => x.witness.freshView(input), append: input => x.witness.append(input)
    });
    const keys = provider || native.createFixtureKeyProvider({testOnly: true, keys: keyRows(fixture.registry)});
    const signer = native.openOfflineSigner({mode, journalFile: path.join(root, "signer.sqlite"), storeId: fixture.storeId, writerEpoch: 1,
      provider: keys, operatorAuthority: fixture.cfg.operatorAuthority, binding: fixture.cfg.binding, initialRegistry: fixture.registry,
      registryPins: fixture.cfg.registryPins, witnessIdentity: fixture.cfg.identity, vaultId: fixture.cfg.vaultId,
      retentionConfig, operatorRetention: retained.gate, witnessAdapter: adapter, now: now || fixture.cfg.now, hook});
    const exposed = Object.freeze({...signer, issue(input) { if (!deferRetention) retained.ensure(input, fixture.registry); return signer.issue(input); }});
    return {...x, signer: exposed, rawSigner: signer, retained, retentionConfig, keys, adapter, fixture, close() { signer.close(); retained.close(); x.close(); }};
  } catch (e) { retained.close(); x.close(); throw e; }
}
function recoverLocks(root) {
  t.recoverLocks(root);
  for (const name of ["operator-vault", "operator-witness"]) { const file = path.join(root, name + ".sqlite"), lock = file + ".writer.lock"; if (fs.existsSync(lock)) require("../../kronos/research-qualification-witness-disk").recoverOwnership(file, {expectedOwnerId: JSON.parse(fs.readFileSync(lock)).ownerId, operatorRef: "explicit-dead-fixture"}); }
  const file = path.join(root, "signer.sqlite.control.sqlite"), lock = file + ".writer.lock";
  if (fs.existsSync(lock)) require("../../kronos/research-qualification-witness-disk").recoverOwnership(file, {expectedOwnerId: JSON.parse(fs.readFileSync(lock)).ownerId, operatorRef: "explicit-dead-fixture"});
}
module.exports = {t, f, native, setup, keyRows, temp, open, recoverLocks, remove: f.removeTemp};
