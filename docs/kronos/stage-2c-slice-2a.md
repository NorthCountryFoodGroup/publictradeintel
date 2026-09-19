# Stage 2C Slice 2A: local SQLite research foundation

Base: `82089d470602b01a3a8cc0a245d99fe5a9c3ef74`.
This slice is an offline storage foundation only. The Node server still uses the
existing JSON persistence. There is no production initialization, migration,
AAPL import, cutover, model call, selector, scheduler, outcome calculation,
statistics, archive artifact generation, object storage, or backup delivery.

## Binding decision

Use built-in `node:sqlite` / `DatabaseSync`, loaded only by an explicit open call.
The repository requires Node >=24.18.0 <25, has no external runtime dependencies,
and documents `npm install` / `node server.js` on Render. Node's v24 documentation
marks SQLite as a release candidate since 24.15.0:
https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html

Local validation used Node 24.18.0 and SQLite 3.53.1. This is not evidence of the
live production runtime. Runtime compatibility must be verified independently
before any future cutover. Open rejects a different Node major or a minor below
24.18. There is no fallback binding and no production runtime change.

The built-in binding avoids native addon installation, ABI/prebuilt-binary risk,
and transitive dependencies. No dependency, engine declaration or lockfile changed.
A dependency audit is not applicable; no install is required. Synchronous calls
are suitable for the bounded single writer, but expensive integrity scans must
not be inserted into interactive production requests without later profiling.

## Module boundaries

- research-canonical.js: strict deterministic canonical JSON.
- research-hash.js: SHA-256 and separate record hash envelopes.
- research-db-schema.js: fixed strict tables, constraints, indexes and triggers.
- research-corrections.js: allowlisted correction validation.
- research-store.js: explicit open, transactions, verified reads and integrity.

Importing these modules does not open SQLite, access runtime data, start a
service, read environment variables, create timers, or write files. The existing
Slice 1 boundary test now permits research-store.js to consume shared research
contracts; this does not permit any Legacy consumer or server integration.

## Location and opening

Canonical future location: DATA_DIR/kronos-research/research.sqlite.
`researchDatabasePath(dataDir)` only computes the path. No implicit default
DATA_DIR or process environment is used. All tests use temporary directories.

- initialize-new: explicit creation; exclusive file creation refuses an existing
  file, including corrupt or empty files. Schema initialization is transactional.
- open-existing: missing file fails with research_store_missing. A corrupt,
  incomplete or incompatible file is never replaced or initialized.
- restore-validation: opens an existing file read-only and enables query_only;
  no writer lock is created and writeTransaction is prohibited.

The file must be regular, not a symbolic link or hard-linked alias. Opening checks
file identity before/after the SQLite constructor. A cooperating writer lock
protects normal application open/create races. Filesystem administrators replacing
files outside this protocol remain outside the protection boundary; the directory
must not be writable by untrusted actors. A failed new initialization can leave a
reserved incomplete file requiring explicit operator review, never silent retry.

Every open validates application_id, user_version, schema definitions (including
all indexes/triggers), SQLite integrity, foreign keys, record/blob hashes,
canonical encodings, indexed projections, correction chains and current links.
Unknown versions or modified schema fail visibly. No downgrade/migration occurs.

## Durability profile

Required and verified on each connection:

- journal_mode=DELETE
- synchronous=EXTRA (numeric 3)
- foreign_keys=ON
- busy_timeout=1000 ms
- trusted_schema=OFF
- defensive binding mode; extension loading disabled
- STRICT tables

An incompatible journal mode fails rather than being silently changed. No weaker
profile is accepted. EXTRA provides rollback-journal directory synchronization;
actual disk/fsync behavior still requires deployment-specific validation. See:
https://www.sqlite.org/pragma.html#pragma_synchronous

## Independent versions and hashes

- databaseSchemaVersion: 1
- per-table recordContractVersion: independently named KRONOS_STORED_*_V1 or event version
- protocolVersion: nullable only for manual forecasts; registered protocol for automatic records
- canonicalizationVersion: KRONOS_JCS_STRICT_V1
- compressionVersion: UTF8_NONE_V1
- hash algorithm: SHA-256

No compression is implemented in 2A. Blobs are exact canonical UTF-8 BLOBs.
A future codec/version cannot silently reinterpret existing content.

Canonicalization follows RFC 8785 ECMAScript string/number serialization and
UTF-16 key ordering for a deliberately stricter JSON subset. Arrays preserve
order. No Unicode normalization occurs. Reject nonfinite numbers, unsafe integer
values, unsupported types, custom prototypes, accessors, toJSON methods, symbol
properties, hidden properties, sparse/decorated arrays, cycles, unpaired Unicode
surrogates, and nesting beyond 128 levels. Negative zero serializes as zero.
This is not a parser for arbitrary duplicate-key JSON text; callers pass plain
JSON values. Future import tooling must reject duplicate keys before parsing.
Reference: https://www.rfc-editor.org/info/rfc8785/

Hashes are outside record payloads. A record's own hash/contentHash field is
rejected; evidence references use inputHash/rawPathsHash/normalizedPathsHash or
blobHash. Hashes cover original forecasts, protocol definitions, snapshots,
revisions, outcomes, corrections and audits. Content deduplication requires exact
canonical bytes, not approximate similarity. A hash collision/content conflict
is an explicit error. Returned objects are detached; editing one cannot change
the database.

## Tables

The schema contains 19 strict tables:
store_metadata, content_blobs, research_transactions, protocols, legacy_snapshots,
regime_snapshots, cohorts, sessions, jobs, forecasts, session_revisions,
job_revisions, outcome_attempts, accepted_outcomes, correction_events,
forecast_dispositions, audit_events, archive_manifests, backup_outbox.

Sessions/jobs have immutable identities and append-only revisions. The highest
revision is their operational projection; no mutable replacement is needed.
Archive and outbox tables are metadata foundations only. There is no artifact,
transport, acknowledgment, backup scheduler, or off-disk success claim.

## Transaction API and immutability

`writeTransaction({id, records, blobs, audit})` is synchronous. Each record is
`{table, record}` using a fixed allowlist and a versioned envelope. Values use SQL
parameters. It atomically inserts transaction identity, exact blobs, records,
audit, and an outbox reference manifest, then checks current relationships before
COMMIT. Any failure rolls back all effects. A repeated transaction identity with
identical content is idempotent; different content conflicts. Record identities
have the same rule. No INSERT OR REPLACE/UPSERT is used.

All evidence tables reject UPDATE and DELETE. BEFORE INSERT identity guards also
reject raw INSERT OR REPLACE, even when a connection disables recursive triggers.
Application APIs never return a raw connection or an arbitrary SQL executor.
These controls protect ordinary writers, not a privileged actor who drops
triggers or replaces files. Independent off-disk evidence remains necessary.

Forecast fields, provenance, input/path references, timestamps and original
analytics are immutable. Application validation requires boolean false, and SQL
requires both numeric zero in the projection and JSON type false in the payload.
True, 1, string false, null and missing influence fail.

Automatic fixture records require a matching session/job/ticker/horizon/protocol
and a completed job revision in the same committed state. Session counts reconcile
to all latest job revisions. V1 jobs match the frozen cohort, and input/path
dimensions match V1. A RUNNING session may append a changed count projection while
remaining RUNNING; that is a new projection revision, not a self-transition in
Slice 1's lifecycle graph. Terminal sessions cannot reopen.

Manual forecasts require null protocol/session/job associations. Storing fixture
automatic records is not execution: no storage API imports the model client or
invokes a forecast. Existing production automatic-execution guards are unchanged.

## Corrections and outcomes

Corrections append original hash, target ID, prior correction reference, field
path, previous-value hash, replacement value, reason, actor, timestamp and software
version. Only /securityName is currently allowlisted. Stale chains or previous
value hashes conflict. Original reads remain original; effective reads explicitly
materialize validated correction chains.

Inputs, paths, generation time, triggerMode, protocol and influence cannot be
corrected. In particular manual cannot become automatic_shadow. Evidence defects
use separate INVALIDATED/SUPERSEDED disposition records with reasons, preserving
the original. Supersession references existing different evidence; it never
creates a forecast or rewrites statistical membership.

Outcome attempts are separate immutable records with retry/attempt identity,
evaluator version, exception state and optional evidence blob. Accepted-outcome
revisions must reference a matching EVALUATED attempt. Evaluated evidence requires
complete matching bar counts and a timestamp after the forecast terminal bar;
acceptance cannot precede that attempt. No prices are fetched or metrics computed.
Settlement and detailed corporate-action evaluation remain future work.

## Single writer and recovery limits

A sibling exclusive writer.lock contains a PID and random ownership token. A second
writer, including another process, fails visibly. Stale locks are never stolen
based on elapsed time or PID reuse. Normal close removes only its own token.
A crash retains the lock. Recovery requires independently establishing the owner
is gone, preserving evidence, and explicitly releasing the stale lock before
SQLite recovery. The fixture crash test does this only after awaiting child exit.
Multiple independent writers/hosts require a future shared transactional store.

The crash fixture kills a child after writes but before COMMIT. Reopening restores
only the baseline forecast/audit/outbox state. Corrupt bytes, altered schema,
missing foreign keys and hash mismatches fail without empty-store fallback.
Explicit integrity/read failures quarantine that open handle. No automatic repair,
file replacement, or corruption reset exists.

Restore-validation verifies a closed fixture database copied to an isolated
location. This is NOT a live SQLite backup method or off-disk recovery proof.
Diagnostics report offDiskDurability=false. Slice 2B must design portable recovery
bundles; later backup/restore slices must prove total primary-disk-loss recovery.

## Validation and production gates

Focused suites: research-canonical, research-store, research-recovery,
research-storage-boundary. Tests cover 1,028 retained synthetic forecasts,
manual/current-protocol/future-protocol partitions, two atomic results in one
session, deduplication, conflicting identities, corrections, outcomes, query plans,
open modes, altered schema/content, second-process writers, killed-writer rollback,
read-only fixture recovery, and capability-denied imports.

Production server, existing JSON persistence, Python, frontend, feature flags,
Legacy scoring/ordering, and protected buildPrediction remain untouched.
Protected SHA-256:
72714872ed27c9c7d1ceac407a87e67d753afb9f6c7cec8f0051cc80631fb1bc

Before production use: verify actual runtime, disk profile, capacity, backup and
restore controls, migration/import design, and explicit cutover approval. None of
those production actions is included here. Original AAPL data has not been read.
