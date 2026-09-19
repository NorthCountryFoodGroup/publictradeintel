"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { canonicalize, CANONICALIZATION_VERSION } = require("./research-canonical");
const { hashBytes, hashValue, assertHash, recordEnvelope } = require("./research-hash");
const schema = require("./research-db-schema");
const { validateCorrection } = require("./research-corrections");
const { PROTOCOL, PROTOCOL_VERSION, TRANSITIONS, assertTransition, validateCohort } = require("./research-contracts");
const { HORIZON_MAPPINGS } = require("./constants");
const BUSY_TIMEOUT_MS = 1000;
function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function requireValue(condition, message) { if (!condition) fail("invalid_research_record", message); }
function text(value, maximum = 240) { requireValue(typeof value === "string" && value.length > 0 && value.length <= maximum && value.trim() === value && !/[\x00-\x1f]/.test(value), "Invalid bounded text."); }
function time(value) { requireValue(typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, "Invalid UTC timestamp."); }
function researchDatabasePath(dataDir) { text(dataDir, 4096); return path.join(path.resolve(dataDir), "kronos-research", "research.sqlite"); }
function normalizeSql(sql) { return sql.trim().replace(/\s+/g, " "); }
function validateShape(table, record) {
  const spec = schema.TABLES[table];
  requireValue(spec && table !== "backup_outbox", "Unsupported writable record class.");
  const expected = ["id", "recordContractVersion", "productionInfluence", ...(spec.noCreatedAt ? [] : ["createdAt"]), ...Object.keys(spec.columns), ...spec.extra].sort();
  requireValue(canonicalize(Object.keys(record).sort()) === canonicalize(expected), `Invalid ${table} envelope fields.`);
  requireValue(record.productionInfluence === false, "productionInfluence must be literal false.");
  requireValue(record.recordContractVersion === spec.version, "Unsupported record contract.");
  text(record.id); if (!spec.noCreatedAt) time(record.createdAt);
  for (const [key, sql] of Object.entries(spec.columns)) {
    if (record[key] === null && !sql.includes("NOT NULL")) continue;
    if (sql.startsWith("INTEGER")) requireValue(Number.isSafeInteger(record[key]) && record[key] >= 0, "Invalid integer.");
    else text(record[key]);
  }
}
function openResearchStore(file, { mode, busyTimeoutMs = BUSY_TIMEOUT_MS } = {}) {
  requireValue(["initialize-new", "open-existing", "restore-validation"].includes(mode), "Explicit store mode required.");
  requireValue(busyTimeoutMs === BUSY_TIMEOUT_MS, "Durability profile timeout cannot be weakened.");
  const [major, minor] = process.versions.node.split(".").map(Number);
  requireValue(major === 24 && minor >= 18, "Validated Node runtime range is >=24.18.0 <25; no fallback binding.");
  text(file, 4096); requireValue(path.isAbsolute(file) && file !== ":memory:", "Absolute on-disk path required.");
  const filename = path.resolve(file), lockfile = `${filename}.writer.lock`, readOnly = mode === "restore-validation";
  let db, lockToken, closed = false, quarantined = false;
  const { DatabaseSync } = require("node:sqlite"); // Lazy: importing this module never opens SQLite.
  function fileStat() {
    let stat; try { stat = fs.lstatSync(filename); } catch (error) { if (error.code === "ENOENT") fail("research_store_missing", "Expected research database is missing."); throw error; }
    requireValue(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, "Database must be a regular, unaliased file."); return stat;
  }
  function checkSchema() {
    if (db.prepare("PRAGMA application_id").get().application_id !== schema.APPLICATION_ID || db.prepare("PRAGMA user_version").get().user_version !== schema.DATABASE_SCHEMA_VERSION) fail("unsupported_research_schema", "Research database identity/schema is incompatible.");
    const metadata = db.prepare("SELECT * FROM store_metadata").all();
    if (metadata.length !== 1 || metadata[0].databaseSchemaVersion !== schema.DATABASE_SCHEMA_VERSION || metadata[0].canonicalizationVersion !== CANONICALIZATION_VERSION || metadata[0].compressionVersion !== schema.COMPRESSION_VERSION) fail("unsupported_research_schema", "Unsupported research encoding/schema.");
    const actual = db.prepare("SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").all().map(row => normalizeSql(row.sql)).sort();
    const expected = schema.SCHEMA_STATEMENTS.map(normalizeSql).sort();
    if (canonicalize(actual) !== canonicalize(expected)) fail("research_schema_mismatch", "Schema, indexes or immutability triggers changed.");
  }
  function configure() {
    db.exec(`PRAGMA foreign_keys=ON; PRAGMA synchronous=EXTRA; PRAGMA busy_timeout=${BUSY_TIMEOUT_MS}; PRAGMA trusted_schema=OFF;`);
    if (db.prepare("PRAGMA journal_mode").get().journal_mode !== "delete" || db.prepare("PRAGMA synchronous").get().synchronous !== 3 || db.prepare("PRAGMA foreign_keys").get().foreign_keys !== 1 || db.prepare("PRAGMA busy_timeout").get().timeout !== BUSY_TIMEOUT_MS) fail("unsafe_sqlite_profile", "Required SQLite durability profile unavailable.");
    if (readOnly) db.exec("PRAGMA query_only=ON");
  }
  function releaseLock() {
    if (lockToken && fs.existsSync(lockfile) && fs.readFileSync(lockfile, "utf8") === lockToken) fs.unlinkSync(lockfile);
    lockToken = null;
  }
  function getRecord(table, id) {
    requireValue(Object.hasOwn(schema.TABLES, table), "Unknown record table.");
    const row = db.prepare(`SELECT hash,payload FROM ${table} WHERE id=?`).get(id);
    if (!row) return null;
    const record = JSON.parse(row.payload); assertHash(record, row.hash);
    requireValue(canonicalize(record) === row.payload, "Noncanonical stored record.");
    return { record, hash: row.hash };
  }
  function blob(hash) {
    const row = db.prepare("SELECT * FROM content_blobs WHERE hash=?").get(hash);
    if (!row) fail("missing_content_blob", "Referenced evidence is missing.");
    if (row.canonicalizationVersion !== CANONICALIZATION_VERSION || row.compressionVersion !== schema.COMPRESSION_VERSION || row.byteLength !== row.data.length || hashBytes(row.data) !== hash) fail("hash_mismatch", "Content blob failed verification.");
    const value = JSON.parse(Buffer.from(row.data).toString("utf8"));
    if (!Buffer.from(canonicalize(value), "utf8").equals(Buffer.from(row.data))) fail("hash_mismatch", "Content blob is not canonical UTF-8.");
    return value;
  }
  function effectiveForecast(id) {
    const original = getRecord("forecasts", id); if (!original) return null;
    let effective = original.record, prior = null;
    const corrections = db.prepare("SELECT id FROM correction_events WHERE targetId=? ORDER BY rowid").all(id);
    for (const correction of corrections) {
      const event = getRecord("correction_events", correction.id).record;
      effective = validateCorrection(event, original.record, original.hash, effective, prior); prior = event.id;
    }
    return { ...original, effective, latestCorrectionId: prior };
  }
  function validateForecast(record) {
    time(record.generatedAt); time(record.inputCutoff);
    requireValue(record.inputCutoff <= record.generatedAt && record.generatedAt <= record.createdAt, "Invalid forecast chronology.");
    requireValue(/^[A-Z][A-Z0-9.-]{0,11}$/.test(record.ticker), "Invalid ticker.");
    requireValue(record.securityName === null || (typeof record.securityName === "string" && record.securityName.length <= 200), "Invalid security name.");
    requireValue(record.analytics && typeof record.analytics === "object" && !Array.isArray(record.analytics) && record.providerProvenance && typeof record.providerProvenance === "object" && !Array.isArray(record.providerProvenance), "Analytics/provider provenance required.");
    requireValue(["manual", "automatic_shadow"].includes(record.triggerMode) && ["real_model", "deterministic_adapter"].includes(record.executionMode), "Invalid research provenance.");
    const mapping = HORIZON_MAPPINGS[record.horizon]; requireValue(mapping && record.sampleCount >= 1 && record.sampleCount <= 16, "Invalid forecast dimensions.");
    const input = blob(record.inputHash), raw = blob(record.rawPathsHash), normalized = blob(record.normalizedPathsHash);
    requireValue(Array.isArray(input) && input.length >= 1 && input.length <= 512, "Invalid input observations.");
    let previous = "";
    function bar(row, normalizedBar) {
      requireValue(row && typeof row === "object", "Invalid bar."); time(row.timestamp);
      for (const key of ["open", "high", "low", "close", "volume"]) requireValue(typeof row[key] === "number" && Number.isFinite(row[key]), "Finite numeric OHLCV required.");
      if (normalizedBar) requireValue(Math.min(row.open,row.high,row.low,row.close) > 0 && row.volume >= 0 && row.high >= Math.max(row.open,row.close,row.low) && row.low <= Math.min(row.open,row.close), "Invalid normalized OHLCV.");
    }
    for (const row of input) { bar(row, true); requireValue(row.timestamp > previous && row.timestamp <= record.inputCutoff, "Input chronology/cutoff violated."); previous = row.timestamp; }
    requireValue(Array.isArray(raw) && Array.isArray(normalized) && raw.length === record.sampleCount && normalized.length === record.sampleCount, "Sample count mismatch.");
    for (let i=0;i<raw.length;i++) {
      requireValue(Array.isArray(raw[i]) && Array.isArray(normalized[i]) && raw[i].length === mapping.bars && normalized[i].length === mapping.bars, "Path dimensions mismatch."); previous = record.inputCutoff;
      for (let j=0;j<mapping.bars;j++) { bar(raw[i][j],false); bar(normalized[i][j],true); requireValue(raw[i][j].timestamp === normalized[i][j].timestamp && raw[i][j].timestamp > previous, "Path chronology mismatch."); previous = raw[i][j].timestamp; }
    }
    if (record.triggerMode === "manual") requireValue(record.protocolVersion === null && record.sessionId === null && record.jobId === null, "Manual research must not enter the primary automatic cohort.");
    else {
      const job = getRecord("jobs",record.jobId)?.record, session = getRecord("sessions",record.sessionId)?.record;
      requireValue(job && session && job.sessionId === session.id && job.ticker === record.ticker && job.horizon === record.horizon && session.protocolVersion === record.protocolVersion, "Automatic forecast linkage mismatch.");
      if (record.protocolVersion === PROTOCOL_VERSION) requireValue(input.length >= PROTOCOL.minimumObservations && record.horizon === PROTOCOL.horizon && record.sampleCount === PROTOCOL.samplePaths, "Protocol V1 dimensions violated.");
    }
  }
  function validateRecord(table, record, { existing = false } = {}) {
    validateShape(table, record);
    if (table === "protocols") { requireValue(record.id === record.protocolVersion && record.definition.protocolVersion === record.protocolVersion && record.definition.productionInfluence === false, "Protocol identity mismatch."); if (record.protocolVersion === PROTOCOL_VERSION) requireValue(hashValue(record.definition) === hashValue(PROTOCOL), "Protocol V1 is immutable."); }
    if (["legacy_snapshots","regime_snapshots"].includes(table)) { time(record.capturedAt); blob(record.blobHash); }
    if (table === "cohorts") { const snapshot = blob(record.blobHash); if(record.protocolVersion === PROTOCOL_VERSION) { validateCohort(snapshot); blob(snapshot.universeSnapshot.hash); requireValue(snapshot.legacySnapshot.ref === record.legacySnapshotId && snapshot.legacySnapshot.hash === getRecord("legacy_snapshots",record.legacySnapshotId)?.record.blobHash,"Cohort Legacy snapshot mismatch."); } }
    if (table === "sessions") requireValue(getRecord("cohorts",record.cohortId)?.record.protocolVersion === record.protocolVersion, "Session/cohort protocol mismatch.");
    if (table === "forecasts") validateForecast(record);
    if (["job_revisions","session_revisions"].includes(table)) {
      const kind = table === "job_revisions" ? "job" : "session", key = `${kind}Id`;
      requireValue(Object.hasOwn(TRANSITIONS[kind],record.state) && record.revision > 0, "Invalid lifecycle state/revision.");
      const previous = db.prepare(`SELECT payload FROM ${table} WHERE ${key}=? AND revision=?`).get(record[key], record.revision-1);
      if (record.revision === 1) requireValue(record.state === "PLANNED", "Initial state must be planned.");
      else { requireValue(previous, "Revision gap."); const prior = JSON.parse(previous.payload); if(prior.state === record.state) requireValue(kind === "session" && record.state === "RUNNING" && hashValue(prior.jobCounts) !== hashValue(record.jobCounts),"Only running-session projection changes may retain a state."); else assertTransition(kind,prior.state,record.state); requireValue(record.createdAt >= prior.createdAt,"Revision time moved backwards."); }
      if (!existing) requireValue(!db.prepare(`SELECT id FROM ${table} WHERE ${key}=? AND revision>=?`).get(record[key],record.revision), "Revision conflict.");
      if (["FAILED","SKIPPED","CANCELLED"].includes(record.state)) text(record.reason); else requireValue(record.reason === null,"Unexpected reason.");
      if (kind === "job" && record.state === "COMPLETED") requireValue(getRecord("forecasts",record.forecastId)?.record.jobId === record.jobId,"Completed job requires its forecast.");
      if (kind === "session") {
        requireValue(canonicalize(Object.keys(record.jobCounts).sort()) === canonicalize(Object.keys(TRANSITIONS.job).sort()),"Invalid job counts.");
        for (const count of Object.values(record.jobCounts)) requireValue(Number.isSafeInteger(count) && count >= 0,"Invalid job count.");
      }
    }
    if (table === "outcome_attempts") {
      requireValue(Object.hasOwn(TRANSITIONS.outcome,record.state),"Invalid outcome state.");
      if (record.state === "EVALUATED") { const evidence = blob(record.evidenceHash); requireValue(evidence.complete === true && evidence.observedBars === evidence.expectedBars && evidence.observedBars === HORIZON_MAPPINGS[getRecord("forecasts",record.forecastId).record.horizon].bars,"Incomplete outcome evidence."); const forecast = getRecord("forecasts",record.forecastId).record; requireValue(record.createdAt >= blob(forecast.normalizedPathsHash)[0].at(-1).timestamp,"Outcome evidence predates forecast maturity."); }
      else if (record.evidenceHash !== null) blob(record.evidenceHash);
      if (!["PENDING","MATURED","EVALUATED"].includes(record.state)) text(record.reason); else requireValue(record.reason === null,"Unexpected outcome reason.");
    }
    if (table === "accepted_outcomes") { const attempt = getRecord("outcome_attempts",record.attemptId)?.record; requireValue(attempt && attempt.forecastId === record.forecastId && attempt.state === "EVALUATED" && record.createdAt >= attempt.createdAt,"Only a matching evaluated attempt may be accepted."); requireValue(record.revision > 0,"Invalid accepted revision."); if (record.revision > 1) requireValue(db.prepare("SELECT id FROM accepted_outcomes WHERE forecastId=? AND revision=?").get(record.forecastId,record.revision-1),"Accepted outcome revision gap."); }
    if (table === "forecast_dispositions") { requireValue(["INVALIDATED","SUPERSEDED"].includes(record.kind),"Invalid disposition."); text(record.reason); text(record.actor); text(record.softwareVersion); requireValue(record.kind === "INVALIDATED" ? record.replacementForecastId === null : record.replacementForecastId !== null && record.replacementForecastId !== record.forecastId,"Invalid supersession."); }
    if (table === "audit_events") { text(record.actor); text(record.softwareVersion); requireValue(record.details && typeof record.details === "object","Audit details required."); }
    if (table === "archive_manifests") { requireValue(/^[a-f0-9]{64}$/.test(record.artifactHash) && record.sequenceEnd >= record.sequenceStart,"Invalid archive metadata."); text(record.formatVersion); }
  }
  function checkRelationships() {
    if (db.prepare("PRAGMA foreign_key_check").all().length) fail("research_foreign_key_failure","Research relationships are invalid.");
    for (const row of db.prepare("SELECT id,jobId FROM forecasts WHERE triggerMode='automatic_shadow'").all()) {
      const latest = db.prepare("SELECT state,forecastId FROM job_revisions WHERE jobId=? ORDER BY revision DESC LIMIT 1").get(row.jobId);
      requireValue(latest?.state === "COMPLETED" && latest.forecastId === row.id,"Automatic forecast and completed job must commit together.");
    }
    for (const session of db.prepare("SELECT id FROM sessions").all()) {
      const latest = db.prepare("SELECT payload FROM session_revisions WHERE sessionId=? ORDER BY revision DESC LIMIT 1").get(session.id);
      requireValue(latest,"Session requires a revision."); const revision = JSON.parse(latest.payload);
      const counts = Object.fromEntries(Object.keys(TRANSITIONS.job).map(state=>[state,0]));
      for (const job of db.prepare("SELECT id FROM jobs WHERE sessionId=?").all(session.id)) {
        const state = db.prepare("SELECT state FROM job_revisions WHERE jobId=? ORDER BY revision DESC LIMIT 1").get(job.id)?.state;
        requireValue(state,"Job requires a revision."); counts[state]++;
      }
      requireValue(hashValue(counts) === hashValue(revision.jobCounts),"Session projection does not match jobs.");
      const total = Object.values(counts).reduce((a,b)=>a+b,0);
      const sessionRecord = getRecord("sessions",session.id).record;
      if(sessionRecord.protocolVersion === PROTOCOL_VERSION) { const cohort = blob(getRecord("cohorts",sessionRecord.cohortId).record.blobHash); const tickers = db.prepare("SELECT ticker FROM jobs WHERE sessionId=? ORDER BY ticker").all(session.id).map(row=>row.ticker); requireValue(total === PROTOCOL.cohortTarget && canonicalize(tickers) === canonicalize(cohort.selected.map(row=>row.ticker).sort()),"Session jobs differ from frozen cohort."); }
      if (revision.state === "COMPLETED") requireValue(total > 0 && counts.COMPLETED === total,"Session completion mismatch.");
      if (revision.state === "COMPLETED_WITH_FAILURES") requireValue(counts.COMPLETED > 0 && counts.COMPLETED < total && counts.PLANNED+counts.QUEUED+counts.RUNNING === 0,"Mixed completion mismatch.");
    }
  }
  function verifyIntegrity() {
    const result = db.prepare("PRAGMA integrity_check").all();
    if (result.length !== 1 || Object.values(result[0])[0] !== "ok") fail("research_integrity_failure","SQLite integrity check failed.");
    checkSchema(); checkRelationships();
    for (const row of db.prepare("SELECT hash FROM content_blobs").all()) blob(row.hash);
    for (const table of Object.keys(schema.TABLES)) {
      for (const row of db.prepare(`SELECT * FROM ${table}`).all()) {
        const stored = getRecord(table,row.id), record = stored.record;
        requireValue(row.productionInfluence === 0 && record.productionInfluence === false,"Unsafe influence in storage.");
        for (const key of Object.keys(schema.TABLES[table].columns)) requireValue(row[key] === record[key],"Index projection mismatch.");
        if (table === "correction_events") effectiveForecast(record.targetId);
        else if (table !== "backup_outbox") validateRecord(table,record,{existing:true});
        else { requireValue(db.prepare("SELECT hash FROM research_transactions WHERE id=?").get(record.transactionId)?.hash === record.transactionHash,"Outbox transaction hash mismatch."); for(const reference of record.recordReferences) requireValue(getRecord(reference.table,reference.id)?.hash === reference.hash,"Outbox reference mismatch."); }
      }
    }
    for (const transaction of db.prepare("SELECT id FROM research_transactions").all()) requireValue(db.prepare("SELECT id FROM backup_outbox WHERE transactionId=?").get(transaction.id),"Transaction outbox missing.");
    return { integrity: "ok", databaseSchemaVersion: schema.DATABASE_SCHEMA_VERSION };
  }
  function committedTransactions() {
    ensureOpen(); requireValue(!db.isTransaction,"Recovery cannot export an uncommitted transaction.");
    return guardedRead(() => {
      const entries = db.prepare("SELECT id FROM backup_outbox").all().map(row => getRecord("backup_outbox",row.id).record);
      return entries.map(outbox => {
        const recovery=outbox.recovery;
        requireValue(recovery?.version === "KRONOS_COMMITTED_TRANSACTION_V1", "Older outbox lacks an exact recovery request; explicit future migration required.");
        requireValue(recovery.request.id === outbox.transactionId && hashValue(recovery.request) === outbox.transactionHash,"Recovery request hash mismatch.");
        for (const item of recovery.request.records) requireValue(getRecord(item.table,item.record.id)?.hash === hashValue(item.record),"Recovery record mismatch.");
        requireValue(getRecord("audit_events",recovery.request.audit.id)?.hash === hashValue(recovery.request.audit),"Recovery audit mismatch.");
        for (const value of recovery.request.blobs) requireValue(hashValue(blob(hashValue(value))) === hashValue(value),"Recovery blob mismatch.");
        return {sequence:recovery.sequence,transactionHash:outbox.transactionHash,request:recovery.request};
      }).sort((a,b)=>a.sequence-b.sequence).map((entry,index)=>{requireValue(entry.sequence===index+1,"Recovery sequence gap or duplicate.");return entry;});
    });
  }
  function ensureOpen(write = false) { if (closed) fail("research_store_closed","Research store is closed."); if (quarantined) fail("research_store_quarantined","Integrity failure requires offline review."); if (write && readOnly) fail("research_store_readonly","Restore validation cannot write."); }
  function guardedRead(operation) { ensureOpen(); try { return operation(); } catch(error) { quarantined=true; throw error; } }
  function insertBlob(value) {
    const bytes = Buffer.from(canonicalize(value),"utf8"), hash = hashBytes(bytes);
    const previous = db.prepare("SELECT data FROM content_blobs WHERE hash=?").get(hash);
    if (previous) { if (!Buffer.from(previous.data).equals(bytes)) fail("research_identity_conflict","Content address conflict."); }
    else db.prepare("INSERT INTO content_blobs VALUES(?,?,?,?,?)").run(hash,CANONICALIZATION_VERSION,schema.COMPRESSION_VERSION,bytes.length,bytes);
    return hash;
  }
  function insertRecord(table, record) {
    const envelope = recordEnvelope(record), previous = getRecord(table,record.id);
    if (previous) { if (previous.hash !== envelope.hash) fail("research_identity_conflict",`${table} identity already has different evidence.`); return false; }
    if (table === "correction_events") {
      validateShape(table,record); const target = effectiveForecast(record.targetId); requireValue(target,"Correction target missing.");
      validateCorrection(record,target.record,target.hash,target.effective,target.latestCorrectionId);
    } else validateRecord(table,record);
    const columns = Object.keys(schema.TABLES[table].columns);
    db.prepare(`INSERT INTO ${table}(id,hash,payload,productionInfluence,${columns.join(",")}) VALUES(${Array(columns.length+4).fill("?").join(",")})`).run(record.id,envelope.hash,envelope.json,0,...columns.map(key=>record[key]));
    return true;
  }
  function writeTransaction(request) {
    ensureOpen(true); recordEnvelope(request); text(request.id);
    requireValue(Object.keys(request).sort().join(",") === "audit,blobs,id,records" && Array.isArray(request.records) && Array.isArray(request.blobs),"Invalid transaction envelope.");
    const hash = hashValue(request);
    db.exec("BEGIN IMMEDIATE");
    try {
      const existing = db.prepare("SELECT hash FROM research_transactions WHERE id=?").get(request.id);
      if (existing) { if (existing.hash !== hash) fail("research_identity_conflict","Transaction identity conflict."); db.exec("ROLLBACK"); return { inserted:0, idempotent:true }; }
      db.prepare("INSERT INTO research_transactions VALUES(?,?)").run(request.id,hash);
      request.blobs.forEach(insertBlob);
      let inserted=0;
      for (const item of request.records) { requireValue(item && Object.keys(item).sort().join(",") === "record,table" && Object.hasOwn(schema.TABLES,item.table) && !["backup_outbox","audit_events"].includes(item.table),"Invalid transaction record class."); if (insertRecord(item.table,item.record)) inserted++; }
      insertRecord("audit_events",request.audit);
      checkRelationships();
      const outbox = { id:request.id,recordContractVersion:schema.TABLES.backup_outbox.version,productionInfluence:false,createdAt:request.audit.createdAt,transactionId:request.id,transactionHash:hash,recovery:{version:"KRONOS_COMMITTED_TRANSACTION_V1",sequence:db.prepare("SELECT count(*) AS n FROM research_transactions").get().n,request},recordReferences:[...request.records.map(item=>({table:item.table,id:item.record.id,hash:hashValue(item.record)})),{table:"audit_events",id:request.audit.id,hash:hashValue(request.audit)}] };
      const envelope = recordEnvelope(outbox);
      db.prepare("INSERT INTO backup_outbox VALUES(?,?,?,?,?)").run(outbox.id,envelope.hash,envelope.json,0,request.id);
      db.exec("COMMIT"); return { inserted,idempotent:false };
    } catch (error) { if (db.isTransaction) db.exec("ROLLBACK"); if (["hash_mismatch","research_integrity_failure","research_schema_mismatch"].includes(error.code)) quarantined=true; throw error; }
  }
  try {
    if (mode === "initialize-new") {
      if (fs.existsSync(filename)) fail("research_store_exists","Initialization cannot overwrite an existing store.");
      fs.mkdirSync(path.dirname(filename),{recursive:true});
    } else fileStat();
    if (!readOnly) {
      const token = canonicalize({pid:process.pid,nonce:crypto.randomUUID()});
      let descriptor; try { descriptor=fs.openSync(lockfile,"wx",0o600); } catch(error) { if(error.code==="EEXIST") fail("research_writer_conflict","Writer lock exists; never steal a stale lock automatically."); throw error; }
      lockToken=token; try { fs.writeFileSync(descriptor,token); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
    }
    if (mode === "initialize-new") { const descriptor=fs.openSync(filename,"wx",0o600); fs.closeSync(descriptor); }
    const before=fileStat();
    db=new DatabaseSync(filename,{readOnly,timeout:BUSY_TIMEOUT_MS,enableForeignKeyConstraints:true,allowExtension:false,defensive:true});
    const after=fileStat(); requireValue(before.ino===after.ino && before.dev===after.dev,"Database path changed during opening.");
    configure();
    if (mode === "initialize-new") {
      db.exec("BEGIN IMMEDIATE");
      try { for(const statement of schema.SCHEMA_STATEMENTS) db.exec(statement); db.prepare("INSERT INTO store_metadata VALUES(1,?,?,?)").run(schema.DATABASE_SCHEMA_VERSION,CANONICALIZATION_VERSION,schema.COMPRESSION_VERSION); db.exec(`PRAGMA application_id=${schema.APPLICATION_ID}; PRAGMA user_version=${schema.DATABASE_SCHEMA_VERSION}; COMMIT`); }
      catch(error) { if(db.isTransaction) db.exec("ROLLBACK"); throw error; }
    }
    verifyIntegrity();
  } catch(error) { if(db) db.close(); releaseLock(); throw error; }
  return Object.freeze({
    writeTransaction,
    committedTransactions,
    readRecord(table,id) { return guardedRead(() => getRecord(table,id)); },
    readForecast(id,{effective=false}={}) { return guardedRead(() => { const value=effectiveForecast(id); return value ? (effective ? value.effective : value.record) : null; }); },
    readBlob(hash) { return guardedRead(() => blob(hash)); },
    count(table) { ensureOpen(); requireValue(Object.hasOwn(schema.TABLES,table) || table === "content_blobs" || table === "research_transactions","Unknown table."); return db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n; },
    findForecasts(filters={}) { return guardedRead(() => {
      ensureOpen(); const allowed=["ticker","securityId","triggerMode","protocolVersion","sourceRevision","modelRevision","tokenizerRevision","outputNormalization","sessionId","jobId","generatedAt"];
      requireValue(Object.keys(filters).every(key=>allowed.includes(key)),"Unsupported query filter.");
      const keys=Object.keys(filters), where=keys.length ? ` WHERE ${keys.map(key=>`${key} IS ?`).join(" AND ")}` : "";
      return db.prepare(`SELECT id FROM forecasts${where} ORDER BY generatedAt,id`).all(...keys.map(key=>filters[key])).map(row=>getRecord("forecasts",row.id).record);
    }); },
    integrity() { ensureOpen(); try { return verifyIntegrity(); } catch(error) { quarantined=true; throw error; } },
    diagnostics() { ensureOpen(); return { mode,databaseSchemaVersion:schema.DATABASE_SCHEMA_VERSION,canonicalizationVersion:CANONICALIZATION_VERSION,compressionVersion:schema.COMPRESSION_VERSION,journalMode:db.prepare("PRAGMA journal_mode").get().journal_mode,synchronous:db.prepare("PRAGMA synchronous").get().synchronous,foreignKeys:db.prepare("PRAGMA foreign_keys").get().foreign_keys,busyTimeoutMs:db.prepare("PRAGMA busy_timeout").get().timeout,offDiskDurability:false }; },
    close() { if(!closed) { db.close(); releaseLock(); closed=true; } }
  });
}
module.exports=Object.freeze({researchDatabasePath,openResearchStore,BUSY_TIMEOUT_MS});
