# Stage 2C Slice 2B: portable recovery and immutable local archives

Base: `c1c7ad48f88a515d2013541ef61882f44d87d015`.
Branch: `codex/kronos-stage2c-slice2b-recovery-archive`.
This is an isolated, local/offline implementation. Existing production JSON
persistence remains authoritative. Neither SQLite nor recovery artifacts are
wired into the server, frontend, manual forecast service, or automatic execution.
Production AAPL was not accessed and is NOT backed up by this implementation.

## Independent versions and compatibility

- SQLite database schema remains 1; no SQL schema or migration changes.
- Existing per-table record contracts remain unchanged.
- Protocol versions remain independent, including manual/null association.
- Committed request extension: `KRONOS_COMMITTED_TRANSACTION_V1`.
- Recovery bundle: `KRONOS_RECOVERY_BUNDLE_V1`.
- Archive logical format: `KRONOS_RESEARCH_JSONL_V1`.
- Canonicalization: existing `KRONOS_JCS_STRICT_V1`.
- Bundle/content encoding: `UTF8_NONE_V1`, canonical UTF-8 JSON.
- Archive compression: `GZIP_V1` using built-in node:zlib.
- Hash algorithm: existing SHA-256 helpers.

No dependencies, Node engine declaration or lockfiles change. Imports only define
functions/constants; they do not read data, create paths, open SQLite, read
operational environment, start timers or contact any service.

The exact Render production Node runtime remains unverified. Built-in node:sqlite
is approved only for this isolated foundation. Production use remains prohibited
until runtime/API compatibility, disk behavior, off-disk recovery, migration tests
and a separate explicit cutover approval have been completed.

## Committed transaction source

Slice 2A retained a transaction hash and record references, but not the exact
original blob array/request ordering needed to reproduce that hash. New local
writes therefore add a versioned `recovery` object to the immutable backup_outbox
payload in the SAME SQLite transaction. It contains the original request and an
explicit positive logical sequence (committed transaction count at insertion).
Rolled-back transactions consume no sequence. No SQLite row ID is exported.

The original transaction hash, audit, records, blobs and outbox all still commit
or roll back together. The export accessor rejects active SQL transactions and
verifies exact request/record/audit/blob hashes and contiguous sequence numbers.

Old Slice 2A outbox payloads remain readable by the existing store. They cannot
be exported through this accessor: missing exact request metadata produces a
visible failure, never a guessed reconstruction. A mixed/older history requires
a separately reviewed migration strategy. This slice performs no backfill or
production import. It does not change old evidence or reinterpret old hashes.

## Bundle representation

`createBundle(store, transactionId)` exports only a committed transaction. The
logical object contains version, canonicalization, transaction ID and sequence,
fixed RESEARCH_TRANSACTION type, original audit timestamp/software revision,
original transaction hash, exact request and embedded content objects. The
request preserves ordered records, audit, blobs, IDs, timestamps, revisions,
correction chains, outcome references and productionInfluence=false.

Each content object has canonical SHA-256, application/json media type,
canonicalization/encoding versions and logical JSON value. Required input, raw,
normalized, snapshot, cohort-universe and outcome blobs are embedded and verified.
Raw and normalized evidence remain independently addressed. Exact duplicate
content is deduplicated within a bundle. No external blob service is required.

The envelope stores logicalContentHash and bundleId=sha256:<logical hash>, outside
the hashed logical object. Logical identity is independent of object insertion
order, pretty-printing, filenames, and gzip headers. Published files use strict
canonical UTF-8 with one final newline; parsers reject duplicate-key/noncanonical
encodings, truncation and unsupported versions. Object validation can verify a
parsed pretty-printed representation without changing logical identity.

A later transaction may reference earlier records. Such dependencies are retained
as immutable record IDs/hashes in its request. A bundle reconstructs its logical
transaction against the preceding validated history; it does not invent missing
protocol/session/job/correction predecessors. Completely isolated reconstruction
requires the contiguous prefix from sequence 1. All blob values are embedded;
no original SQLite database or hidden local source is consulted during replay.

## Local paths and publication

Future explicit DATA_DIR contract (tests use os.tmpdir only):

    DATA_DIR/kronos-research/research.sqlite
    DATA_DIR/kronos-research/recovery/
      bundles/<12-digit-sequence>/bundle.json
      archives/<12-digit-first-sequence>/archive.gz
      archives/<12-digit-first-sequence>/manifest.json
      staging/<unique-incomplete-publication>/...

Manifest and archive are co-located to permit atomic publication of both together.
No absolute paths, process IDs, platform directories or environment values are
stored in portable artifacts. Local transient lock tokens are not exported.

Publication acquires an exclusive root writer lock, writes new files in staging
with exclusive creation, flushes file contents, syncs the staging directory where
supported, then renames that directory on the same filesystem and syncs its parent.
Readers inspect only complete final directories. No final file is edited or
replaced. Repeating identical publication is idempotent; different bytes at an
existing sequence fail. Files and final directories reject symlink aliases.

This is an ordinary cooperative-writer boundary, not protection from an operator
who bypasses the API and edits files. Hashes detect accidental modification; they
are not digital signatures against an attacker who rewrites all hashes. Filesystem
ACLs and an independently retained trusted checkpoint remain future requirements.

POSIX directory fsync failures propagate. Windows may refuse directory handles or
fsync (EISDIR/EPERM/EACCES/EINVAL); this is reported as directorySyncAvailable=false.
No universal power-loss or hardware-flush guarantee is claimed. Same-filesystem
rename and actual filesystem durability must be validated before deployment.

A crashed publisher leaves a lock and possibly staging files. Locks are NEVER
stolen automatically. An operator must independently establish the owner is gone
before explicitly removing a stale lock. Unfinished staging artifacts remain for
inspection. This slice has no automatic deletion or retention policy.

## Outbox and truthful acknowledgment

SQLite outbox rows remain immutable. Readiness is derived by validating local
artifacts against committed transactions, not a mutable delivered flag:

- LOCAL_COMMITTED / PENDING_BUNDLE: committed database evidence exists, but no
  verified portable bundle (standalone or archived) exists.
- PORTABLE_RECOVERY_READY / BUNDLE_READY: matching complete local artifact exists.
- OFF_DISK_VERIFIED: never emitted; offDiskVerified is always false.

The inventory computes transaction/bundle/archive associations, latest sealed
sequence, missing ranges, integrity status and staging count. It detects conflicts
between standalone bundles, archives and the source database. It can operate
without the source database. With a source or expectedLastSequence it can detect
missing tail artifacts; without an independent high-water mark it explicitly
reports tailCompletenessKnown=false. A valid shortened prefix alone cannot prove
that no later segment ever existed.

There is deliberately no asynchronous outbox update after publication. A crash
in that interval is reconciled from valid files and yields truthful BUNDLE_READY.
No remote delivery, receipts, credentials, scheduler or network adapter exists.

## Archives and manifests

A segment is canonical JSONL: one canonical recovery envelope per line, ordered
by contiguous transaction sequence. Gzip compresses this logical stream, never
SQLite pages. Segments can be sealed at an operator-selected monthly boundary;
no monthly scheduler is implemented. Tests use small deterministic ranges.
Limit per segment: 2,048 transactions and 128 MiB uncompressed; single parsed
bundle limit: 64 MiB. Decompression has a 128 MiB output cap.

The manifest includes archive ID, independent archive/canonicalization/compression
versions, first/last sequence, predecessor manifest hash, transaction count,
record counts by class (request occurrences, including reused records), logical
content SHA-256, compressed-byte SHA-256, embedded content hash inventory,
forecast protocol/model/normalization/provenance partitions, sealed timestamp,
software revision and remoteReceipt=null. Bundle timestamps retain creation time.

Genesis uses explicit KRONOS_ARCHIVE_GENESIS_V1. Every later segment begins at the
prior last sequence+1 and hashes the complete preceding manifest. Verification
rejects missing/reordered middle segments, altered manifests, duplicate sequences,
gaps, invalid gzip, truncation and content/hash mismatches. An expected final
sequence is necessary to prove tail completeness. Changing gzip metadata may
change the artifact hash but not logical content hash/archive identity.

All bundles, content and sequence ranges must validate before publication. A
sealed segment never reopens. Later corrections and outcomes are new transactions
and belong in later segments referencing original evidence.

## Offline replay

`replayHistory(newAbsoluteDirectory, {segments, expectedLastSequence})` validates
the complete archive chain before creating a staged store. Alternatively pass
`bundles` for a complete contiguous bundle history. Exactly one input is allowed.
The target must not exist; an exclusive target lock prevents cooperating replayers.

Replay applies original requests through the existing transactional store API.
All original uniqueness, lifecycle, evidence, productionInfluence and relationship
constraints still apply. Same identity/sequence/content is idempotent via
`replayBundle`; altered identities/content or out-of-order transactions fail.
Required predecessor blobs must already be present from earlier transactions.

The full staged database receives integrity/hash/relationship checks and a local
restore receipt. It is closed, flushed and atomically published as a complete new
directory only after success. Failure leaves no accepted target directory, though
an unaccepted staging directory may remain for explicit inspection. Existing
stores are never overwritten. Crash-left restore locks also require manual review.
There is no partial-success result and no model output is regenerated.

## Privacy

Record classes/envelopes are allowlisted. Recursive checks reject secret-shaped
fields/values, service tokens, login/admin PINs, cookies, environment dumps,
credential-bearing URLs, and absolute paths. Unsafe evidence is rejected as a
whole, never silently redacted (which would destroy identity). Tests insert fake
unsafe provider fields into fixture SQLite and prove export fails. This is a
bounded structural exclusion policy, not a guarantee of detecting an arbitrary
unlabelled secret disguised as ordinary research prose. Operators must never
place credentials in research evidence. Artifacts have no browser/server API.

## Validation

Five focused suites cover bundles, archives, reconstruction, process interruption
and production boundaries. The full fixture includes manual/current/future
protocol partitions, a completed 20-job automatic fixture session, snapshots,
cohorts, revisions, audits, correction, disposition and accepted outcome. It
retains 1,000 forecasts, deletes the source SQLite file, restores from saved
portable archives alone and compares exact logical snapshots, hashes and counts.

Crash tests terminate a child process after commit, during bundle writing, after
bundle sealing, during archive writing, before archive rename and after archive
rename. Parent-observed exit precedes fixture-only stale-lock release. Reconciliation
preserves staging evidence and needs no inference. These process-crash tests do
not simulate physical disk loss, power loss, or off-disk recovery.

The replay suite prints exact fixture bundle/archive/database sizes and elapsed
reconstruction time. Synthetic forecasts share content, so gzip compression ratios
are illustrative and must not be treated as production capacity estimates.

Measured fixture results (Node 24.18.0, local Windows; timing varies):

- Single-forecast canonical bundle: 67,622 bytes.
- Complete 20-forecast session: 1,397,685 bytes of bundles; 62,481 gzip bytes.
- 1,000-forecast archive: 80,675 gzip bytes plus 3,323 manifest bytes.
- Restored SQLite: 4,706,304 bytes.
- Full isolated reconstruction: 10.91 seconds on the final regression run.

Protected buildPrediction SHA-256 remains:
72714872ed27c9c7d1ceac407a87e67d753afb9f6c7cec8f0051cc80631fb1bc

No production actions, AAPL access, migration, environment changes, real inference,
/v1/forecast calls, prediction scans, automatic collection, deployments or Slice 2C
implementation are included. Commit/push require the next explicit approval.
