"use strict";
// Same explicit disk and retained-vault interface as the signer witness, in a disjoint lane.
const w = require("./research-qualification-witness-contracts"), r = require("./research-qualification-operator-retention-contracts");
const {openDisk} = require("./research-qualification-witness-disk");
function openWitness(file, {mode, config, vault, signWitness, now = Date.now, hook = () => {}}) {
  const cfg = r.config(config), disk = openDisk(file, {mode, metadata: {version: r.V.store, config: cfg}}); let frozen = false;
  function inspect(allowPending = false) {
    const data = disk.read(), model = r.replay(data.entries, cfg), head = vault.latest();
    if (head) w.vaultReceipt(head);
    const remote = head?.sequence || 0;
    w.check(remote <= data.entries.length, "RETENTION_WITNESS_ROLLBACK");
    w.check(remote === data.entries.length || (allowPending && remote === data.completed && data.entries.length === remote + 1), "RETENTION_PUBLICATION_REQUIRED");
    let previous = null;
    for (let n = 1; n <= remote; n++) { const row = vault.read(n); w.vaultReceipt(row.receipt);
      w.check(row.receipt.vaultId === cfg.vaultId && row.receipt.sequence === n && row.receipt.previousHash === previous && row.receipt.entryHash === w.hashValue(row.entry) && w.canonicalize(row.entry) === w.canonicalize(data.entries[n - 1]), "RETENTION_VAULT_FORK"); previous = row.receipt.receiptHash;
    }
    w.check((head?.receiptHash || null) === previous, "RETENTION_VAULT_HEAD");
    if (!allowPending) w.check(data.completed === data.entries.length, "RETENTION_PUBLICATION_REQUIRED");
    return {data, model, head};
  }
  function guarded(fn) { w.check(!frozen, "RETENTION_FROZEN"); try { return fn(); } catch (e) { frozen = true; throw e; } }
  function signed(body) { return {body, signature: signWitness(w.signedBytes(body))}; }
  function ack(n) {
    const {data} = inspect(), entry = data.entries[n - 1]; w.check(entry, "RETENTION_SEQUENCE");
    const result = signed({version: r.V.ack, ...r.common(cfg), witnessId: cfg.witnessIdentity.witnessId, witnessEpoch: cfg.witnessIdentity.epoch, keyFingerprint: cfg.witnessIdentity.keyFingerprint, receipt: entry.receipt, vaultReceipt: vault.read(n).receipt});
    r.acknowledgment(result, entry, cfg); return result;
  }
  return Object.freeze({
    append(input) { return guarded(() => {
      const a = structuredClone(r.append(input, cfg)), {data, model} = inspect();
      // Reconciliation is exact; it never constructs or signs another operator decision.
      const existing = data.entries[a.sequence - 1];
      if (existing) { w.check(existing.append.appendHash === a.appendHash && w.canonicalize(existing.append) === w.canonicalize(a), "RETENTION_FORK"); return ack(a.sequence); }
      const receipt = w.seal({version: r.V.receipt, ...r.common(cfg), sequence: a.sequence, previousReceiptHash: model.receiptHash, appendHash: a.appendHash, acceptedAt: new Date(now()).toISOString()}, "receiptHash");
      const entry = {append: a, receipt}; r.replay([...data.entries, entry], cfg);
      hook("before-witness-commit"); const n = disk.append(entry); hook("after-witness-commit");
      const accepted = vault.append(entry); hook("after-vault-publication");
      const checked = inspect(true); w.check(accepted.receiptHash === checked.head.receiptHash, "RETENTION_READBACK");
      disk.complete(n); hook("after-witness-completion"); return ack(n);
    }); },
    proof(challengeNonce) { return guarded(() => {
      require("./research-backup-contracts").digest(challengeNonce); const {data, model, head} = inspect();
      const at = now(); w.check(at >= model.at, "RETENTION_TIME");
      const view = signed({version: r.V.view, ...r.common(cfg), witnessId: cfg.witnessIdentity.witnessId, witnessEpoch: cfg.witnessIdentity.epoch, keyFingerprint: cfg.witnessIdentity.keyFingerprint,
        sequence: model.sequence, checkpoint: model.checkpoint, writerStoreId: model.writerStoreId, writerEpoch: model.writerEpoch, vaultHeadHash: head?.receiptHash || null, challengeNonce, issuedAt: new Date(at).toISOString(), expiresAt: new Date(at + w.LEASE_MS).toISOString()});
      return {version: r.V.proof, history: data.entries.map((entry, i) => ({entry, ack: ack(i + 1)})), view};
    }); },
    recoverPublication({operatorRef}) {
      require("./research-backup-contracts").label(operatorRef);
      const {data} = inspect(true); w.check(data.entries.length === data.completed + 1, "RETENTION_RECOVERY_REQUIRED");
      vault.append(data.entries.at(-1)); inspect(true); disk.complete(data.entries.length); frozen = false; inspect(); return {recovered: true};
    },
    status() { try { if (!frozen) inspect(); } catch { frozen = true; } return {state: frozen ? "FROZEN" : "READY", simulated: true, offDiskVerified: false}; },
    close: disk.close
  });
}
module.exports = {openWitness};
