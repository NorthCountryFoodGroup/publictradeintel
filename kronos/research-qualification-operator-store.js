"use strict";
// Explicit SQLite open only. A committed attempt fences signing across processes and crashes.
const fs = require("node:fs"), path = require("node:path"), w = require("./research-qualification-witness-contracts");
const SQL = ["CREATE TABLE metadata (payload TEXT NOT NULL)",
  "CREATE TABLE reviews (id TEXT PRIMARY KEY, payload TEXT NOT NULL)",
  "CREATE TABLE attempts (id TEXT PRIMARY KEY, nonce TEXT UNIQUE NOT NULL, payload TEXT NOT NULL)",
  "CREATE TABLE decisions (id TEXT PRIMARY KEY REFERENCES attempts(id), payload TEXT NOT NULL)",
  "CREATE TABLE audit (sequence INTEGER PRIMARY KEY, payload TEXT NOT NULL, hash TEXT NOT NULL)"];
for (const table of ["metadata", "reviews", "attempts", "decisions", "audit"]) for (const action of ["UPDATE", "DELETE"])
  SQL.push(`CREATE TRIGGER ${table}_${action} BEFORE ${action} ON ${table} BEGIN SELECT RAISE(ABORT,'immutable'); END`);
function openStore(file, {mode, metadata}) {
  w.check(path.isAbsolute(file) && ["initialize-new", "open-existing"].includes(mode), "OPERATOR_STORE_MODE");
  const parent = fs.lstatSync(path.dirname(file)); w.check(parent.isDirectory() && !parent.isSymbolicLink(), "OPERATOR_STORE_PATH");
  if (mode === "initialize-new") { const fd = fs.openSync(file, "wx", 0o600); fs.closeSync(fd); }
  const st = fs.lstatSync(file); w.check(st.isFile() && !st.isSymbolicLink() && st.nlink === 1, "OPERATOR_STORE_PATH");
  const {DatabaseSync} = require("node:sqlite"), db = new DatabaseSync(file);
  try {
    db.exec("PRAGMA journal_mode=DELETE; PRAGMA synchronous=EXTRA; PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF; PRAGMA busy_timeout=2000;");
    if (mode === "initialize-new") { db.exec("BEGIN IMMEDIATE"); SQL.forEach(x => db.exec(x)); db.prepare("INSERT INTO metadata VALUES(?)").run(w.canonicalize(metadata)); db.exec("PRAGMA application_id=1262635603; PRAGMA user_version=1; COMMIT"); }
    w.check(db.prepare("PRAGMA application_id").get().application_id === 1262635603 && db.prepare("PRAGMA user_version").get().user_version === 1 && db.prepare("PRAGMA integrity_check").get().integrity_check === "ok", "OPERATOR_STORE_INTEGRITY");
    const schema = db.prepare("SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").all().map(x => x.sql).sort();
    w.check(w.canonicalize(schema) === w.canonicalize([...SQL].sort()), "OPERATOR_STORE_SCHEMA");
    const meta = db.prepare("SELECT payload FROM metadata").all(); w.check(meta.length === 1 && meta[0].payload === w.canonicalize(metadata), "OPERATOR_STORE_IDENTITY");
    function get(table, id) { const r = db.prepare(`SELECT payload FROM ${table} WHERE id=?`).get(id); return r ? JSON.parse(r.payload) : null; }
    function tx(fn) { db.exec("BEGIN IMMEDIATE"); try { const out = fn(); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; } }
    function audit(entry) {
      const last = db.prepare("SELECT sequence,hash FROM audit ORDER BY sequence DESC LIMIT 1").get(), sequence = (last?.sequence || 0) + 1;
      const payload = {sequence, previousHash: last?.hash || null, ...entry};
      db.prepare("INSERT INTO audit VALUES(?,?,?)").run(sequence, w.canonicalize(payload), w.hashValue(payload));
    }
    function state(id) { return get("decisions", id)?.decision.action || (get("attempts", id) ? "RECOVERY_REQUIRED" : "PENDING"); }
    function readAudit() {
      let previous = null, sequence = 0;
      return db.prepare("SELECT * FROM audit ORDER BY sequence").all().map(r => { const v = JSON.parse(r.payload);
        w.check(v.sequence === ++sequence && v.previousHash === previous && r.hash === w.hashValue(v), "OPERATOR_AUDIT_INTEGRITY"); previous = r.hash; return v; });
    }
    readAudit();
    return Object.freeze({
      review(v, entry) { return tx(() => { const previous = db.prepare("SELECT payload FROM reviews").all().map(row => JSON.parse(row.payload)).find(row => row.context.requestId === v.context.requestId);
        if (previous) w.check(w.hashValue(previous.context) === w.hashValue(v.context), "OPERATOR_IMMUTABLE_REQUEST");
        const old = get("reviews", v.reviewHash); if (old) w.check(w.hashValue(old) === w.hashValue(v), "OPERATOR_CONTEXT_CHANGED"); else db.prepare("INSERT INTO reviews VALUES(?,?)").run(v.reviewHash, w.canonicalize(v)); audit(entry); return v; }); },
      getReview: id => get("reviews", id), decision: id => get("decisions", id), state,
      reserve(v, entry) { return tx(() => { w.check(state(v.requestId) === "PENDING", "OPERATOR_TERMINAL_OR_AMBIGUOUS");
        w.check(!db.prepare("SELECT id FROM attempts WHERE nonce=?").get(v.nonce), "OPERATOR_NONCE_REPLAY");
        db.prepare("INSERT INTO attempts VALUES(?,?,?)").run(v.requestId, v.nonce, w.canonicalize(v)); audit(entry); }); },
      complete(v, entry) { return tx(() => { const a = get("attempts", v.decision.context.requestId);
        w.check(a && !get("decisions", a.requestId) && a.nonce === v.decision.nonce && a.reviewHash === v.decision.reviewHash && a.action === v.decision.action, "OPERATOR_TRANSITION");
        db.prepare("INSERT INTO decisions VALUES(?,?)").run(a.requestId, w.canonicalize(v)); audit(entry); return v; }); },
      audit: v => tx(() => audit(v)), readAudit,
      counts() { return {attempts: db.prepare("SELECT count(*) AS n FROM attempts").get().n, decisions: db.prepare("SELECT count(*) AS n FROM decisions").get().n}; },
      close() { db.close(); }
    });
  } catch (e) { db.close(); throw e; }
}
module.exports = {openStore};
