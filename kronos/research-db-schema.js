"use strict";
const DATABASE_SCHEMA_VERSION = 1;
const APPLICATION_ID = 0x4b525332;
const COMPRESSION_VERSION = "UTF8_NONE_V1";
// Fixed SQL identifiers only. All user data is bound, never interpolated.
const TABLES = Object.freeze({
  protocols: { version: "KRONOS_STORED_PROTOCOL_V1", columns: { protocolVersion: "TEXT NOT NULL UNIQUE" }, extra: ["definition"] },
  legacy_snapshots: { version: "KRONOS_STORED_LEGACY_SNAPSHOT_V1", columns: { blobHash: "TEXT NOT NULL REFERENCES content_blobs(hash)" }, extra: ["capturedAt"] },
  regime_snapshots: { version: "KRONOS_STORED_REGIME_SNAPSHOT_V1", columns: { blobHash: "TEXT NOT NULL REFERENCES content_blobs(hash)" }, extra: ["capturedAt"] },
  cohorts: { version: "KRONOS_STORED_COHORT_V1", columns: { protocolVersion: "TEXT NOT NULL REFERENCES protocols(protocolVersion)", blobHash: "TEXT NOT NULL REFERENCES content_blobs(hash)", legacySnapshotId: "TEXT NOT NULL REFERENCES legacy_snapshots(id)", regimeSnapshotId: "TEXT NOT NULL REFERENCES regime_snapshots(id)" }, extra: [] },
  sessions: { version: "KRONOS_STORED_SESSION_V1", columns: { protocolVersion: "TEXT NOT NULL REFERENCES protocols(protocolVersion)", cohortId: "TEXT NOT NULL REFERENCES cohorts(id)", idempotencyKey: "TEXT NOT NULL UNIQUE" }, extra: [] },
  jobs: { version: "KRONOS_STORED_JOB_V1", columns: { sessionId: "TEXT NOT NULL REFERENCES sessions(id)", ticker: "TEXT NOT NULL", horizon: "TEXT NOT NULL", idempotencyKey: "TEXT NOT NULL UNIQUE" }, extra: [], constraints: ["UNIQUE(sessionId,ticker,horizon)"] },
  forecasts: { version: "KRONOS_STORED_FORECAST_V1", columns: {
    ticker: "TEXT NOT NULL", securityId: "TEXT NOT NULL", generatedAt: "TEXT NOT NULL", inputCutoff: "TEXT NOT NULL",
    triggerMode: "TEXT NOT NULL CHECK(triggerMode IN ('manual','automatic_shadow'))", protocolVersion: "TEXT REFERENCES protocols(protocolVersion)",
    sessionId: "TEXT REFERENCES sessions(id)", jobId: "TEXT UNIQUE REFERENCES jobs(id)",
    inputHash: "TEXT NOT NULL REFERENCES content_blobs(hash)", rawPathsHash: "TEXT NOT NULL REFERENCES content_blobs(hash)", normalizedPathsHash: "TEXT NOT NULL REFERENCES content_blobs(hash)",
    sourceRevision: "TEXT NOT NULL", modelRevision: "TEXT NOT NULL", tokenizerRevision: "TEXT NOT NULL", outputNormalization: "TEXT NOT NULL", executionMode: "TEXT NOT NULL", horizon: "TEXT NOT NULL", sampleCount: "INTEGER NOT NULL CHECK(sampleCount > 0)"
  }, extra: ["securityName", "analytics", "providerProvenance"], constraints: ["CHECK((triggerMode='manual' AND protocolVersion IS NULL AND sessionId IS NULL AND jobId IS NULL) OR (triggerMode='automatic_shadow' AND protocolVersion IS NOT NULL AND sessionId IS NOT NULL AND jobId IS NOT NULL))"] },
  session_revisions: { version: "KRONOS_STORED_SESSION_REVISION_V1", columns: { sessionId: "TEXT NOT NULL REFERENCES sessions(id)", revision: "INTEGER NOT NULL CHECK(revision > 0)", state: "TEXT NOT NULL" }, extra: ["jobCounts", "reason"], constraints: ["UNIQUE(sessionId,revision)"] },
  job_revisions: { version: "KRONOS_STORED_JOB_REVISION_V1", columns: { jobId: "TEXT NOT NULL REFERENCES jobs(id)", revision: "INTEGER NOT NULL CHECK(revision > 0)", state: "TEXT NOT NULL", forecastId: "TEXT REFERENCES forecasts(id)" }, extra: ["reason"], constraints: ["UNIQUE(jobId,revision)", "CHECK((state='COMPLETED' AND forecastId IS NOT NULL) OR (state<>'COMPLETED' AND forecastId IS NULL))"] },
  outcome_attempts: { version: "KRONOS_STORED_OUTCOME_ATTEMPT_V1", columns: { forecastId: "TEXT NOT NULL REFERENCES forecasts(id)", attemptKey: "TEXT NOT NULL UNIQUE", state: "TEXT NOT NULL", evaluatorVersion: "TEXT NOT NULL", evidenceHash: "TEXT REFERENCES content_blobs(hash)" }, extra: ["reason"] },
  accepted_outcomes: { version: "KRONOS_STORED_ACCEPTED_OUTCOME_V1", columns: { forecastId: "TEXT NOT NULL REFERENCES forecasts(id)", attemptId: "TEXT NOT NULL REFERENCES outcome_attempts(id)", revision: "INTEGER NOT NULL CHECK(revision > 0)" }, extra: [], constraints: ["UNIQUE(forecastId,revision)"] },
  correction_events: { version: "KRONOS_CORRECTION_V1", columns: { targetId: "TEXT NOT NULL REFERENCES forecasts(id)", priorCorrectionId: "TEXT UNIQUE REFERENCES correction_events(id)" }, extra: ["originalHash", "changes", "reason", "actor", "timestamp", "softwareVersion"], noCreatedAt: true },
  forecast_dispositions: { version: "KRONOS_FORECAST_DISPOSITION_V1", columns: { forecastId: "TEXT NOT NULL REFERENCES forecasts(id)", replacementForecastId: "TEXT REFERENCES forecasts(id)", kind: "TEXT NOT NULL CHECK(kind IN ('INVALIDATED','SUPERSEDED'))" }, extra: ["reason", "actor", "softwareVersion"] },
  audit_events: { version: "KRONOS_RESEARCH_AUDIT_V1", columns: { action: "TEXT NOT NULL" }, extra: ["actor", "softwareVersion", "details"] },
  archive_manifests: { version: "KRONOS_ARCHIVE_METADATA_V1", columns: { artifactHash: "TEXT NOT NULL", sequenceStart: "INTEGER NOT NULL", sequenceEnd: "INTEGER NOT NULL" }, extra: ["formatVersion"] },
  backup_outbox: { version: "KRONOS_BACKUP_OUTBOX_METADATA_V1", columns: { transactionId: "TEXT NOT NULL UNIQUE REFERENCES research_transactions(id)" }, extra: ["transactionHash", "recordReferences"] }
});
for (const definition of Object.values(TABLES)) { Object.freeze(definition.columns); Object.freeze(definition.extra); if (definition.constraints) Object.freeze(definition.constraints); Object.freeze(definition); }
const definitions = [
  `CREATE TABLE store_metadata (singleton INTEGER PRIMARY KEY CHECK(singleton=1), databaseSchemaVersion INTEGER NOT NULL, canonicalizationVersion TEXT NOT NULL, compressionVersion TEXT NOT NULL) STRICT`,
  `CREATE TABLE content_blobs (hash TEXT PRIMARY KEY, canonicalizationVersion TEXT NOT NULL, compressionVersion TEXT NOT NULL, byteLength INTEGER NOT NULL, data BLOB NOT NULL CHECK(length(data)=byteLength)) STRICT`,
  `CREATE TABLE research_transactions (id TEXT PRIMARY KEY, hash TEXT NOT NULL) STRICT`
];
for (const [table, definition] of Object.entries(TABLES)) {
  const columns = Object.entries(definition.columns).map(([key, sql]) => `${key} ${sql} DEFERRABLE INITIALLY DEFERRED`.replace(/ DEFERRABLE INITIALLY DEFERRED$/, sql.includes("REFERENCES") ? " DEFERRABLE INITIALLY DEFERRED" : ""));
  const checks = Object.keys(definition.columns).map(key => `CHECK(json_extract(payload,'$.${key}') IS ${key})`);
  definitions.push(`CREATE TABLE ${table} (id TEXT PRIMARY KEY, hash TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), productionInfluence INTEGER NOT NULL CHECK(productionInfluence=0), ${columns.join(", ")}, CHECK(json_type(payload,'$.productionInfluence')='false'), CHECK(json_extract(payload,'$.id')=id), CHECK(json_extract(payload,'$.recordContractVersion')='${definition.version}'), ${[...checks, ...(definition.constraints || [])].join(", ")}) STRICT`);
}
const INDEXES = Object.freeze({
  forecast_ticker_time: ["forecasts", "ticker,generatedAt"], forecast_security: ["forecasts", "securityId"], forecast_time: ["forecasts", "generatedAt"],
  forecast_partition: ["forecasts", "triggerMode,protocolVersion,generatedAt"], forecast_protocol: ["forecasts", "protocolVersion"],
  forecast_model: ["forecasts", "sourceRevision,modelRevision,tokenizerRevision,outputNormalization,protocolVersion"], forecast_session: ["forecasts", "sessionId"],
  job_session: ["jobs", "sessionId"], outcome_state: ["outcome_attempts", "state,forecastId"], correction_target: ["correction_events", "targetId"],
  correction_first: ["correction_events", "targetId", "unique"]
});
for (const [name, [table, columns, unique]] of Object.entries(INDEXES)) definitions.push(`CREATE ${unique ? "UNIQUE " : ""}INDEX ${name} ON ${table}(${columns})${unique ? " WHERE priorCorrectionId IS NULL" : ""}`);
for (const table of ["store_metadata", "content_blobs", "research_transactions", ...Object.keys(TABLES)]) {
  for (const operation of ["UPDATE", "DELETE"]) definitions.push(`CREATE TRIGGER immutable_${table}_${operation.toLowerCase()} BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(ABORT,'immutable research evidence'); END`);
}
// BEFORE INSERT guards also prevent INSERT OR REPLACE from bypassing delete
// triggers on raw SQLite connections whose recursive_triggers setting is off.
for (const table of ["store_metadata", "content_blobs", "research_transactions", ...Object.keys(TABLES)]) {
  const uniqueKeys = [[table === "store_metadata" ? "singleton" : table === "content_blobs" ? "hash" : "id"]];
  if (TABLES[table]) {
    for (const [key, sql] of Object.entries(TABLES[table].columns)) if (sql.includes("UNIQUE")) uniqueKeys.push([key]);
    for (const constraint of TABLES[table].constraints || []) if (constraint.startsWith("UNIQUE(")) uniqueKeys.push(constraint.slice(7,-1).split(","));
  }
  const predicates = uniqueKeys.map(keys => `(${keys.map(key => `${key}=NEW.${key}`).join(" AND ")})`);
  if (table === "correction_events") predicates.push("(targetId=NEW.targetId AND priorCorrectionId IS NULL AND NEW.priorCorrectionId IS NULL)");
  definitions.push(`CREATE TRIGGER immutable_${table}_replace BEFORE INSERT ON ${table} WHEN EXISTS(SELECT 1 FROM ${table} WHERE ${predicates.join(" OR ")}) BEGIN SELECT RAISE(ABORT,'immutable research identity'); END`);
}
const SCHEMA_STATEMENTS = Object.freeze(definitions);
module.exports = Object.freeze({ DATABASE_SCHEMA_VERSION, APPLICATION_ID, COMPRESSION_VERSION, TABLES, INDEXES, SCHEMA_STATEMENTS });
