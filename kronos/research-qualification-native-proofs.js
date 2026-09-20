"use strict";
// Explicit reads only; importing this module opens no database or authority.
const crypto = require("node:crypto");
const w = require("./research-qualification-witness-contracts");
const state = require("./research-qualification-witness-state");
const p = require("./research-qualification-preflight-contracts");
const equal = (a, b) => w.check(w.canonicalize(a) === w.canonicalize(b), "NATIVE_HISTORY_MISMATCH");
function journalEvents(file) {
  const {DatabaseSync} = require("node:sqlite");
  const db = new DatabaseSync(file, {readOnly: true});
  try {
    let previous = null;
    return db.prepare("SELECT sequence,payload,hash FROM events ORDER BY sequence").all().map((r, i) => {
      const event = JSON.parse(r.payload);
      w.check(r.sequence === i + 1 && event.sequence === r.sequence && event.previousHash === previous && r.hash === w.hashValue(event) && r.payload === w.canonicalize(event), "NATIVE_JOURNAL_INTEGRITY");
      previous = r.hash;
      return {event, hash: r.hash};
    });
  } finally { db.close(); }
}
function createProofs({config, adapter, storeId, now}) {
  const verifier = w.createVerifier({identity: config.identity, vaultId: config.vaultId});
  const row = config.identity.stores.find(r => r.storeId === storeId);
  w.check(row, "NATIVE_STORE_UNKNOWN");
  function history() {
    const proofs = structuredClone(adapter.history());
    w.check(Array.isArray(proofs) && proofs.length <= 10000, "NATIVE_HISTORY_LIMIT");
    let vaultPrevious = null;
    for (const proof of proofs) {
      verifier.acknowledgment(proof.ack, proof.entry);
      w.check(proof.ack.body.vaultReceipt.previousHash === vaultPrevious, "NATIVE_VAULT_CONTINUITY");
      vaultPrevious = proof.ack.body.vaultReceipt.receiptHash;
    }
    return {proofs, model: state.replay(proofs.map(p => p.entry), config)};
  }
  function fresh(h, minimumSequence = 1) {
    const challengeNonce = crypto.randomBytes(32).toString("hex");
    const view = structuredClone(adapter.view({storeId, challengeNonce}));
    verifier.freshView(view, {storeId, challengeNonce, now: now(), minimumSequence, expectedReceiptHash: h.model.receiptHash});
    equal(view.body.checkpoint, h.model.lanes.get(storeId)?.checkpoint);
    w.check(view.body.sequence === h.model.sequence && view.body.registryHash === h.model.registry.registryHash && view.body.registryRevision === h.model.registry.registryRevision, "NATIVE_REGISTRY_DRIFT");
    return view;
  }
  function laneEvents(h) { return h.proofs.flatMap(p => p.entry.append.storeId === storeId ? p.entry.append.events : []); }
  function match(events, h, allowAhead = false) {
    const remote = laneEvents(h);
    w.check(allowAhead || remote.length <= events.length, "NATIVE_SIGNER_ROLLBACK");
    for (let i = 0; i < Math.min(remote.length, events.length); i++) equal(remote[i], events[i]);
    return remote;
  }
  function publish(events, minimumSequence = 1) {
    let h = history();
    const remote = match(events, h);
    if (h.model.lanes.has(storeId)) fresh(h, minimumSequence);
    if (events.length > remote.length) {
      const pending = events.slice(remote.length), lane = h.model.lanes.get(storeId);
      const body = {version: w.V.append, ...w.common(config.identity, row), fromSequence: pending[0].event.sequence,
        toSequence: pending.at(-1).event.sequence, previousCheckpointHash: lane?.checkpointHash || null,
        events: pending, checkpoint: null, requestedAt: new Date(now()).toISOString()};
      body.checkpoint = state.consume(h.model, body, config, now(), false);
      const append = w.seal(body, "appendHash");
      w.append(append, config.identity);
      const ack = structuredClone(adapter.append(structuredClone(append)));
      verifier.acknowledgment(ack, {append, receipt: ack.body.receipt});
      h = history();
      const actual = h.proofs.find(p => p.entry.append.appendHash === append.appendHash);
      w.check(actual, "NATIVE_ACK_MISSING"); equal(actual.ack, ack);
    }
    equal(laneEvents(h), events); fresh(h, minimumSequence);
    return h.proofs.filter(p => p.entry.append.storeId === storeId).at(-1).ack;
  }
  function anchor(events, h) {
    match(events, h, true);
    const proof = h.proofs.filter(p => p.entry.append.storeId === storeId && p.entry.append.toSequence <= events.length).at(-1);
    w.check(proof, "NATIVE_ANCHOR_MISSING");
    const cp = proof.entry.append.checkpoint;
    return {version: p.VERSION.checkpoint, storeId, sequence: cp.journalSequence, chainHash: cp.journalHash, registryRevision: cp.registryRevision, registryHash: cp.registryHash};
  }
  return Object.freeze({history, fresh, laneEvents, match, publish, anchor});
}
module.exports = {journalEvents, createProofs, equal};
