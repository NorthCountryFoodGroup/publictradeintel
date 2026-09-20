"use strict";
// Trusted constructor configuration is not a Node/browser request API. Fixture keys only.
const crypto = require("node:crypto"), path = require("node:path");
const s = require("./research-qualification-signer-contracts");
const p = require("./research-qualification-preflight-contracts");
const q = require("./research-qualification-contracts");
const c = require("./research-backup-contracts");
const w = require("./research-qualification-witness-contracts");
const {openDurableJournal} = require("./research-qualification-preflight-journal");
const {openDisk} = require("./research-qualification-witness-disk");
const {journalEvents, createProofs, equal} = require("./research-qualification-native-proofs");
const providers = new WeakMap();
const VERSION = "KRONOS_NATIVE_SIGNER_RESULT_V1", CONTROL = "KRONOS_NATIVE_SIGNER_CONTROL_V1";
const phases = ["PRE_SIGN_ACK", "SIGN_ATTEMPT", "COMPLETION_INTENT", "FINAL_ACK", "RELEASED"];
function createFixtureKeyProvider({testOnly, keys}) {
  w.check(testOnly === true && Array.isArray(keys), "NATIVE_FIXTURE_ONLY");
  const values = new Map(), fingerprints = new Set();
  for (const item of keys) {
    w.check(item && Object.keys(item).sort().join(",") === "domain,issuer,keyFingerprint,privateKey,publicKey,signerId", "NATIVE_KEY_CONFIGURATION");
    c.label(item.signerId); c.label(item.issuer);
    w.check(["provider", "runtime", "restore", "independent-restore"].includes(item.domain), "NATIVE_KEY_DOMAIN");
    w.check(item.privateKey instanceof crypto.KeyObject && item.privateKey.type === "private" && item.privateKey.asymmetricKeyType === "ed25519", "NATIVE_PRIVATE_MATERIAL");
    const publicKey = crypto.createPublicKey(item.privateKey).export({type: "spki", format: "pem"});
    w.check(s.fingerprint(publicKey) === item.keyFingerprint && s.fingerprint(item.publicKey) === item.keyFingerprint, "NATIVE_KEY_FINGERPRINT");
    w.check(!values.has(item.signerId) && !fingerprints.has(item.keyFingerprint), "NATIVE_KEY_REUSE");
    values.set(item.signerId, {...item, publicKey}); fingerprints.add(item.keyFingerprint);
  }
  const identities = [...values.values()].map(({privateKey, ...identity}) => identity);
  const independent = identities.find(k => k.domain === "independent-restore");
  if (independent) w.check(identities.every(k => k === independent || k.issuer !== independent.issuer), "NATIVE_INDEPENDENCE");
  const internal = {values, available: true, signCalls: 0, messageBytes: []};
  const handle = Object.freeze({
    publicIdentities: () => structuredClone(identities),
    metrics: () => ({signCalls: internal.signCalls, messageBytes: [...internal.messageBytes]}),
    close() { internal.available = false; internal.values.clear(); }
  });
  providers.set(handle, internal); return handle;
}
function keyFor(provider, request, attestation, registry) {
  const internal = providers.get(provider);
  w.check(internal?.available, "NATIVE_KEY_UNAVAILABLE");
  const key = internal.values.get(request.signerId);
  w.check(key, "NATIVE_KEY_MISSING");
  const row = registry.signers.find(k => k.signerId === request.signerId);
  w.check(row && key.domain === s.role(attestation) && row.domain === key.domain, "NATIVE_KEY_DOMAIN");
  w.check(row.keyFingerprint === key.keyFingerprint && row.issuer === key.issuer && s.fingerprint(row.publicKey) === key.keyFingerprint, "NATIVE_KEY_FINGERPRINT");
  if (key.domain === "independent-restore") w.check(registry.signers.filter(k => k.domain !== key.domain).every(k => k.signerId !== key.signerId && k.keyFingerprint !== key.keyFingerprint && k.issuer !== key.issuer), "NATIVE_INDEPENDENCE");
  return {key, internal};
}
function openOfflineSigner(options) {
  const {mode, journalFile, storeId, writerEpoch, provider, operatorAuthority, witnessAdapter, now = Date.now, hook = () => {}} = options;
  const binding = structuredClone(options.binding), initialRegistry = structuredClone(options.initialRegistry);
  const config = {identity: structuredClone(w.identity(options.witnessIdentity)), binding,
    registryPins: [...options.registryPins], operatorAuthority, vaultId: options.vaultId};
  w.check(path.isAbsolute(journalFile) && providers.has(provider), "NATIVE_CONFIGURATION");
  const lane = config.identity.stores.find(r => r.storeId === storeId);
  w.check(lane && lane.writerEpoch === writerEpoch, "NATIVE_WRITER_EPOCH");
  w.check(binding.environmentId === config.identity.environmentId && binding.streamId === config.identity.streamId, "NATIVE_CONFIGURATION");
  // All authority key classes must remain separate, including fixture configuration.
  operatorAuthority.assertIndependent({signers: [...provider.publicIdentities(), {keyFingerprint: config.identity.keyFingerprint}]});
  w.check(provider.publicIdentities().every(k => k.keyFingerprint !== config.identity.keyFingerprint), "NATIVE_KEY_REUSE");
  const proofs = createProofs({config, adapter: witnessAdapter, storeId, now});
  let disk, journal, closed = false, busy = false, journalClock = null;
  const metadata = {version: CONTROL, storeId, writerEpoch, binding, identity: config.identity, vaultId: config.vaultId,
    registryPins: config.registryPins, keys: provider.publicIdentities()};
  function controls() {
    const data = disk.read();
    w.check(data.completed === data.entries.length, "NATIVE_CONTROL_RECOVERY_REQUIRED");
    const seen = new Map();
    for (const entry of data.entries) {
      c.shape(entry, "version,phase,requestId,candidateHash,at,data");
      w.check(entry.version === CONTROL && phases.includes(entry.phase), "NATIVE_CONTROL_INTEGRITY");
      c.digest(entry.candidateHash); c.label(entry.requestId); c.iso(entry.at);
      const prior = seen.get(entry.requestId);
      w.check(phases.indexOf(entry.phase) === (prior ? phases.indexOf(prior.phase) + 1 : 0) && (!prior || prior.candidateHash === entry.candidateHash), "NATIVE_CONTROL_ORDER");
      if (["PRE_SIGN_ACK", "FINAL_ACK"].includes(entry.phase)) c.shape(entry.data, "ack");
      if (entry.phase === "SIGN_ATTEMPT") { c.shape(entry.data, "preReceiptHash"); w.check(entry.data.preReceiptHash === prior.data.ack.body.receipt.receiptHash, "NATIVE_CONTROL_BINDING"); }
      if (entry.phase === "COMPLETION_INTENT") { c.shape(entry.data, "event,hash"); w.check(w.hashValue(entry.data.event) === entry.data.hash, "NATIVE_CONTROL_BINDING"); }
      if (entry.phase === "RELEASED") { c.shape(entry.data, "resultHash"); c.digest(entry.data.resultHash); }
      seen.set(entry.requestId, entry);
    }
    return data.entries;
  }
  function record(phase, candidate, data) {
    const n = disk.append({version: CONTROL, phase, requestId: candidate.request.requestId,
      candidateHash: w.hashValue(candidate), at: new Date(now()).toISOString(), data});
    disk.complete(n);
  }
  function events() { disk.assertOwned(); return journalEvents(journalFile); }
  function historyCheck(local, entries) {
    const h = proofs.history();
    let minimum = 1;
    for (const entry of entries) if (["PRE_SIGN_ACK", "FINAL_ACK"].includes(entry.phase)) {
      const ack = entry.data.ack;
      const actual = h.proofs.find(x => x.entry.receipt.sequence === ack.body.receipt.sequence);
      w.check(actual, "NATIVE_WITNESS_ROLLBACK"); equal(ack, actual.ack);
      w.check(ack.body.receipt.checkpoint.storeId === storeId, "NATIVE_ACK_STORE");
      const source = local.find(e => e.event.requestId === entry.requestId && e.event.kind === "RESERVED");
      w.check(source && w.hashValue(source.event.data) === entry.candidateHash, "NATIVE_CONTROL_BINDING");
      if (entry.phase === "PRE_SIGN_ACK") {
        w.check(actual.entry.append.events.at(-1).hash === source.hash, "NATIVE_PRE_SIGN_BINDING");
      } else {
        const intent = entries.find(e => e.requestId === entry.requestId && e.phase === "COMPLETION_INTENT");
        w.check(intent, "NATIVE_COMPLETION_INTENT_MISSING"); equal(actual.entry.append.events.at(-1), intent.data);
      }
      minimum = Math.max(minimum, ack.body.receipt.sequence);
    }
    proofs.fresh(h, minimum);
    const remote = proofs.match(local, h, true);
    if (remote.length > local.length) {
      const intent = entries.find(e => e.phase === "COMPLETION_INTENT" && e.data.event.sequence === local.length + 1);
      w.check(intent && remote.length === local.length + 1 && !entries.some(e => e.requestId === intent.requestId && e.phase === "RELEASED"), "NATIVE_SIGNER_ROLLBACK");
      equal(remote.at(-1), intent.data);
      w.check(local.at(-1).event.kind === "RECEIPT" && intent.requestId === local.at(-1).event.requestId, "NATIVE_SIGNER_ROLLBACK");
    }
    w.check(h.model.registry.registryHash === local.filter(e => e.event.kind === "REGISTRY").at(-1).event.data.registry.registryHash, "NATIVE_REGISTRY_DRIFT");
    return h;
  }
  function candidate(input) {
    c.shape(input, "request,attestation,approval");
    const value = structuredClone(input);
    q.validateAttestation(value.attestation); s.request(value.request, value.attestation);
    return value;
  }
  function context(value) {
    const local = events(), entries = controls(), h = historyCheck(local, entries);
    const reserved = local.find(e => e.event.kind === "RESERVED" && e.event.requestId === value.request.requestId);
    if (reserved) equal(reserved.event.data, value);
    const own = entries.filter(e => e.requestId === value.request.requestId);
    own.forEach(e => w.check(e.candidateHash === w.hashValue(value), "NATIVE_ALTERED_REPLAY"));
    const registry = local.filter(e => e.event.kind === "REGISTRY").at(-1).event.data.registry;
    return {local, entries, h, own, registry, reserved};
  }
  function result(value, ctx) {
    const exact = journal.exactResult(value.request.requestId);
    p.verifyEnvelope(exact.envelope, value.request, value.attestation, ctx.registry, now());
    equal(exact.receipt, p.receipt(exact.envelope));
    const pre = ctx.own.find(e => e.phase === "PRE_SIGN_ACK"), final = ctx.own.find(e => e.phase === "FINAL_ACK");
    w.check(pre && final, "NATIVE_COMPLETION_UNWITNESSED");
    const witnessed = ctx.h.model.requests.get(value.request.requestId);
    w.check(witnessed?.state === "COMPLETED" && witnessed.storeId === storeId, "NATIVE_COMPLETION_UNWITNESSED");
    equal(witnessed.envelope, exact.envelope); equal(witnessed.receipt, exact.receipt); equal(witnessed.approval, value.approval);
    return w.seal({version: VERSION, ...exact, approvalHash: value.approval.approval.approvalHash,
      preSignAcknowledgment: pre.data.ack, completionAcknowledgment: final.data.ack,
      simulated: true, automaticCollectionReady: false, offDiskVerified: false}, "resultHash");
  }
  function get(value) {
    const ctx = context(value), release = ctx.own.find(e => e.phase === "RELEASED");
    w.check(release, "NATIVE_RESULT_UNRELEASED");
    const out = result(value, ctx); w.check(out.resultHash === release.data.resultHash, "NATIVE_ALTERED_REPLAY"); return out;
  }
  function finish(value) {
    const id = value.request.requestId;
    let ctx = context(value), status = journal.state(id);
    if (ctx.own.some(e => e.phase === "RELEASED")) return get(value);
    w.check(["ENVELOPE", "RECEIPT", "COMPLETED"].includes(status), "NATIVE_SIGNING_AMBIGUOUS");
    w.check(ctx.own.some(e => e.phase === "SIGN_ATTEMPT"), "NATIVE_SIGNING_AUTHORITY_MISSING");
    const envelope = ctx.local.find(e => e.event.kind === "ENVELOPE" && e.event.requestId === id).event.data;
    p.verifyEnvelope(envelope, value.request, value.attestation, ctx.registry, now());
    if (status === "ENVELOPE") { journal.recordReceipt(id); hook("receipt"); }
    ctx = context(value);
    let intent = ctx.own.find(e => e.phase === "COMPLETION_INTENT");
    if (!intent) {
      w.check(journal.state(id) === "RECEIPT", "NATIVE_COMPLETION_INTENT_MISSING");
      const receipt = p.receipt(envelope), last = ctx.local.at(-1);
      const event = {version: p.VERSION.journal, sequence: last.event.sequence + 1, previousHash: last.hash,
        kind: "COMPLETED", requestId: id, at: new Date(now()).toISOString(), data: {envelopeHash: envelope.envelopeHash, receiptHash: receipt.receiptHash}};
      record("COMPLETION_INTENT", value, {event, hash: w.hashValue(event)}); hook("completion-intent");
      intent = controls().find(e => e.requestId === id && e.phase === "COMPLETION_INTENT");
    }
    ctx = context(value);
    const intended = intent.data;
    w.check(intended.hash === w.hashValue(intended.event) && intended.event.kind === "COMPLETED" && intended.event.requestId === id, "NATIVE_COMPLETION_INTENT");
    const target = journal.state(id) === "COMPLETED" ? ctx.local : [...ctx.local, intended];
    if (journal.state(id) === "COMPLETED") equal(ctx.local.find(e => e.event.sequence === intended.event.sequence), intended);
    const ack = proofs.publish(target);
    const final = ctx.own.find(e => e.phase === "FINAL_ACK");
    if (final) equal(final.data.ack, ack); else record("FINAL_ACK", value, {ack});
    hook("final-witness");
    // Witness accepts the exact planned completion first. Original V1 journal remains unchanged.
    if (journal.state(id) !== "COMPLETED") {
      p.verifyEnvelope(envelope, value.request, value.attestation, ctx.registry, now());
      journalClock = Date.parse(intended.event.at);
      try { journal.complete(id); } finally { journalClock = null; }
      equal(events().at(-1), intended); hook("completion");
    }
    ctx = context(value);
    const out = result(value, ctx), release = ctx.own.find(e => e.phase === "RELEASED");
    if (release) w.check(release.data.resultHash === out.resultHash, "NATIVE_ALTERED_REPLAY");
    else record("RELEASED", value, {resultHash: out.resultHash});
    hook("returned"); return out;
  }
  function operation(fn) {
    w.check(!closed && !busy, "NATIVE_SIGNER_UNAVAILABLE"); busy = true;
    try { disk.assertOwned(); return fn(); }
    catch (error) { w.fail(typeof error?.code === "string" && /^[A-Z_]+$/.test(error.code) ? error.code : "NATIVE_OPERATION_FAILED"); }
    finally { busy = false; }
  }
  try {
    disk = openDisk(journalFile + ".control.sqlite", {mode, metadata});
    const entries = controls();
    let anchor;
    if (mode === "open-existing") {
      const local = events(), h = historyCheck(local, entries);
      anchor = proofs.anchor(local, h);
    }
    journal = openDurableJournal(journalFile, {mode, storeId, binding, operatorAuthority,
      approvedRegistryPins: config.registryPins, initialRegistry, provenanceRef: "native-offline-fixture",
      witness: anchor, now: () => journalClock ?? now()});
    if (mode === "initialize-new") proofs.publish(events());
    return Object.freeze({
      issue(input) { return operation(() => {
        const value = candidate(input), ctx = context(value), id = value.request.requestId;
        if (journal.state(id) === "COMPLETED") return get(value);
        w.check(journal.state(id) === "ABSENT", "NATIVE_SIGNING_AMBIGUOUS");
        w.check(ctx.local.filter(e => e.event.kind === "RESERVED").every(e => ctx.entries.some(x => x.requestId === e.event.requestId && x.phase === "RELEASED")), "NATIVE_RECOVERY_REQUIRED");
        const grant = operatorAuthority.authorize({...value, registry: ctx.registry, at: now()});
        keyFor(provider, value.request, value.attestation, ctx.registry); hook("validated");
        journal.reserve(grant); hook("reserved");
        const ack = proofs.publish(events()); record("PRE_SIGN_ACK", value, {ack}); hook("pre-sign-witness");
        const current = context(value);
        operatorAuthority.validate(value.approval, value.request, value.attestation, current.registry, now());
        const {key, internal} = keyFor(provider, value.request, value.attestation, current.registry);
        w.check(lane.domains.includes(key.domain), "NATIVE_KEY_DOMAIN");
        record("SIGN_ATTEMPT", value, {preReceiptHash: ack.body.receipt.receiptHash}); hook("before-sign");
        context(value);
        operatorAuthority.validate(value.approval, value.request, value.attestation, current.registry, now());
        keyFor(provider, value.request, value.attestation, current.registry);
        const bytes = q.signingBytes(value.attestation);
        internal.signCalls++; internal.messageBytes.push(bytes.length);
        const body = {version: s.VERSION.envelope, attestation: value.attestation, request: value.request,
          signerId: key.signerId, keyFingerprint: key.keyFingerprint, algorithm: "Ed25519",
          signature: crypto.sign(null, bytes, key.privateKey).toString("base64"), signedAt: new Date(now()).toISOString()};
        internal.signCalls++;
        const envelope = s.seal({...body, contextSignature: crypto.sign(null, s.envelopeBytes(body), key.privateKey).toString("base64")}, "envelopeHash");
        p.verifyEnvelope(envelope, value.request, value.attestation, current.registry, now()); hook("signed");
        journal.recordEnvelope(id, envelope); hook("envelope");
        return finish(value);
      }); },
      get(input) { return operation(() => get(candidate(input))); },
      recover(input, {operatorRef} = {}) { return operation(() => { c.label(operatorRef); return finish(candidate(input)); }); },
      status(id) { return operation(() => ({state: journal.state(id), simulated: true, automaticCollectionReady: false, offDiskVerified: false})); },
      close() { if (!closed) { journal.close(); disk.close(); closed = true; } }
    });
  } catch (error) {
    if (journal) journal.close(); if (disk) disk.close();
    w.fail(typeof error?.code === "string" && /^[A-Z_]+$/.test(error.code) ? error.code : "NATIVE_OPEN_FAILED");
  }
}
module.exports = {VERSION, createFixtureKeyProvider, openOfflineSigner};
