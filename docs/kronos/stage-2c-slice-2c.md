# Stage 2C Slice 2C: offline backup contracts and verification

Base: ed0d7f33e9779838c4dfff491bf554a2360a79da.
Branch: codex/kronos-stage2c-slice2c-offdisk-contracts.
This is an OFFLINE implementation. No real provider, AWS SDK, credentials,
operational environment access, production data, migration or automatic worker
is present. Existing production JSON persistence remains authoritative.

## Versions and capabilities

Independent contracts:

- KRONOS_BACKUP_ADAPTER_V1
- KRONOS_REMOTE_RECEIPT_V1
- KRONOS_REMOTE_CHECKPOINT_V1
- KRONOS_SNAPSHOT_MANIFEST_V1
- KRONOS_RESTORE_DRILL_V1
- KRONOS_BACKUP_OBJECT_V1 (environment-bound transport envelope)

Existing database schema 1, record contracts, protocol versions,
KRONOS_JCS_STRICT_V1, recovery bundle and archive formats remain independent.
Canonicalization and SHA-256 reuse the existing implementations.

The provider-neutral adapter exposes capabilities, putImmutable, headExact,
getExact, verifyExact, describeRetention and bounded listPrefix. Required
capabilities explicitly cover conditional creation, version identity, exact
retrieval, readback, retention, encryption evidence and bounded listing.
No core contract exposes SDK response shapes or bucket-administration operations.

The sole provider is the test fixture FAKE_MEMORY, classification NON_PRODUCTION.
It always reports its real fixture identity even if capability overrides are used.
It supports deterministic exact versions, conditional creation, retention and
encryption metadata, independent put/get paths and paginated listing. Fault
controls are outside the adapter interface. There is no application deletion API.
The fixture-only removeForTest helper simulates lost remote evidence.

## Identity and environment isolation

Every transport object, receipt and checkpoint binds environmentId and streamId.
Environments are production, staging, development or fixture. Stream IDs use a
restricted internal alphabet; traversal, absolute paths, ambiguous separators,
mutable latest names and caller filenames are prohibited.

    pti/<environment>/<stream>/<artifact-type>/<format-version>/<logical-hash>

Checkpoint slots instead end in slots/<12-digit-checkpoint-number>. They have a
single immutable value. The hash of their logical payload remains in the descriptor.
Artifact classes and format versions are allowlisted. Existing Slice 2B bundle
bytes/identities remain unchanged inside the new context-bound transport envelope.
For snapshots, base64 carries exact SQLite bytes with an independent inner byte
hash; the transport descriptor hashes the full canonical envelope. Archives can
similarly carry exact gzip bytes and the original manifest. This encoding trades
some size for one consistent offline identity/validation contract.

A context mismatch fails before access. Fake providers reject production context.
No production environment is configured, and no bypass mode is exposed here.

## Immutable put and receipts

Absent identity creates an object. Identical bytes/descriptor reuse its version.
Different bytes under the same identity fail with BACKUP_CONFLICT. No overwrite
or delete is available through the adapter. Listing is bounded and paginated;
reconciliation rejects duplicate identities and repeated pagination cursors.

Normalized receipts contain provider/container, environment/stream, object key,
exact version, opaque ETag, logical hash, transport artifact SHA-256/size,
upload/verification timestamps, verification method, retention mode/expiry/policy,
encryption status, software revision and exact descriptor. Upload events are
separate from verification events. ETags never substitute for SHA-256.

Verification requires capability validation, exact HEAD metadata, a separate
getExact, exact version/context/size, recomputed SHA-256, canonical logical identity,
class-specific payload validation, compliance retention and provider-managed
encryption evidence. HEAD alone cannot succeed. Missing/stale metadata, changed
bytes, wrong versions and retention mismatches fail. Checkpoint validation also
checks receipt provider/container against the adapter.

## Delivery, retries and acknowledgments

States: PENDING, UPLOADING, UPLOADED, VERIFYING, CHECKPOINT_PENDING,
OFF_DISK_VERIFIED, FAILED_RETRYABLE and FAILED_TERMINAL. The local test journal is
append-only, hash-linked and validates transitions. It is an in-memory operational
journal, not a research transaction and not a claim of a production durable journal.
Remote reconciliation works with a newly empty journal after interruption.

All journal events and delivery results are explicitly simulated and have
productionDurability=false. OFF_DISK_VERIFIED is exercised only as a test state.
Actual maximum production-relevant architecture durability remains
PORTABLE_RECOVERY_READY; no production record is protected by this implementation.

At most four attempts fit inside a 60-second budget measured from the supplied
local commit timestamp. Full-jitter delays are capped at 8 seconds using an
injected clock/random/scheduler. No real timers exist. An overdue result cannot
receive a new delivery acknowledgment. Health continues to show its unverified
age and deadline breach. Provider outages do not erase evidence or rerun inference.

Retryable: timeout, temporary unavailability, explicitly transient provider error
(including fixture throttling/5xx). Terminal: authentication, permission, identity
conflict, checksum mismatch, retention mismatch, unavailable/wrong version.
Errors expose only bounded code/message and retryability, never raw provider text.

Before retrying publication, inspect the exact immutable key. If the object was
stored but its response was lost, retrieve and verify that version. Once verified,
publish its immutable receipt, then a checkpoint, then perform full checkpoint
readback and record the simulated acknowledgment. Existing checkpoint recovery is
attempted first. No successful HTTP/put-like result alone confers acknowledgment.

## Checkpoints and independent expected sequence

Each transaction has a corresponding monotonically numbered checkpoint slot.
Checkpoint number equals highest contiguous verified research sequence. Fields
include environment/stream, bundle ID, exact receipt reference, optional latest
verified snapshot/archive, timestamp/revision and predecessor hash. Genesis is
KRONOS_BACKUP_CHECKPOINT_GENESIS_V1. Supplementary snapshot/archive watermarks must
not exceed the checkpoint sequence and must verify before checkpoint publication.

Local checkpoint creation is serialized per adapter. Same slot/different content
is a split-brain conflict. A validated in-process predecessor is privately tracked;
after restart, a caller must supply the complete predecessor reference chain for
verification. Merely providing a detached claimed predecessor is insufficient.

Chain verification reads every checkpoint, receipt and referenced artifact through
exact versions. Missing/reordered entries, forks, duplicate slots, bad predecessor
hashes and environment/stream mismatches fail. The highest valid checkpoint defines
the expected sequence independently of the primary database. A local sequence below
it fails; a missing referenced remote artifact fails. An independently known final
checkpoint hash detects a missing checkpoint suffix.

A single provider cannot prove that its entire account/history was not rolled back.
An independent witness/copy remains necessary for that stronger threat model.
Real-provider checkpoint discovery/bootstrap configuration is not implemented here.
The offline restore accepts explicitly supplied checkpoint reference inventories.

## Supported SQLite snapshots

The store gains one narrow backupSnapshot method using node:sqlite backup(). It
holds a write barrier for the asynchronous backup; writes and close are rejected
until completion. It never exposes the SQL connection. Destination creation is
exclusive; an existing destination cannot be overwritten. The completed file is
flushed using a writable file handle (required on Windows).

The snapshot is independently reopened read-only. Integrity, schema, foreign keys,
record/blob hashes, relationships, counts and explicit transaction watermark are
verified before creating the manifest. Logical transaction requests are checked
for secret-shaped evidence before any portable snapshot is returned. Binary bytes
are checked by exact size, canonical base64 and SHA-256, not text-secret regexes.
An unsafe local fixture snapshot can remain in the caller's staging path after
rejection; it is never returned or uploaded as a valid artifact.

Manifest fields: snapshot ID, environment/stream, database schema, Node/SQLite
runtime versions, watermark, last transaction ID/hash, transaction-hash root,
integrity result, class counts, SQLite byte SHA-256/size, timestamp/revision and
optional receipt reference. The receipt is normally separate, avoiding circular
self-reference. No live production database is copied or backed up.

## Snapshot plus tail restoration

The offline orchestrator first verifies checkpoint ancestry and the expected final
hash. It retrieves and verifies the pinned snapshot object and writes its exact
bytes only into a new isolated staging directory. The snapshot is reopened through
the research store; counts, integrity, watermark and all prefix transaction hashes
must match the verified checkpoint history. Then original bundles N+1 through the
expected sequence replay through the existing transaction API.

Final integrity and every transaction hash must match. Only then is the closed
staging directory atomically renamed to a new target. A cooperating restore lock
prevents duplicate publishers; it is not automatically stolen. Failure creates no
accepted destination, although staging evidence may remain for review. Original
IDs, timestamps, manual/automatic and protocol partitions, corrections, outcomes
and audit are preserved. No inference occurs. Retrying existing bundle contents
is idempotent; conflicting evidence remains an error.

Directory sync uses Slice 2B's platform-aware helper. Windows may not support
folder fsync; neither fixture success nor atomic rename proves power-loss safety.
The exact Render Node/SQLite runtime and filesystem remain production gates.

## Health, readiness and restore policy

Health reports verified sequence, oldest unverified age/count, deadline breach,
last upload/readback, checkpoint/age, snapshot, provider/retention/environment state
and integrity conflicts. It uses explicit caller inputs; there is no environment,
browser, service or automatic-worker wiring.

Storage readiness requires healthy primary/portable state, compatible schema,
verified prefix, fresh backup health, no conflict, disk usage below 85%, and free
space of at least twice the supplied staging requirement. An initial passing drill
is required; weekly drills expire after 8 days. A separate independent drill is
required within 92 days. Schema, policy or software/adapter revision changes
invalidate the corresponding drill evidence. Initial RTO target is one hour,
not a deployment guarantee.

The drill contract captures context, source checkpoint, expected sequence,
snapshot, tail range, counts, hashes, relationships, corrections/outcomes,
idempotency, timestamps/revisions, independent flag and pass/fail.

CRITICAL: isQualifiedRealProvider always returns false in this offline release.
There is no registration function and no caller boolean that can override it.
Even a fully healthy fake history always fails production collection readiness.
No automatic inference gate/worker is implemented.

## Security and remaining production gates

Strict envelope/class allowlists, structural validation and bounded secret/path
checks reject tested service tokens, PINs, cookies, credentials, environment dumps,
credential-bearing URLs and absolute paths. Errors are normalized. No arbitrary
disguised-secret detection guarantee is made. Configuration names are constants
only; no environment variables or real credentials are read or set.

Long-term provider remains Amazon S3 Standard with versioning, Object Lock, exact
versions and immediate SHA-256 readback. The real S3 adapter, AWS SDK dependency,
IAM/bucket setup, credentials, provider qualification and actual off-disk recovery
are reserved for separately authorized Slice 2C-production. JSON migration/AAPL
preservation and production cutover require their own review. Older Slice 2A
outboxes without exact recovery requests still require explicit migration.

Protected buildPrediction:
72714872ed27c9c7d1ceac407a87e67d753afb9f6c7cec8f0051cc80631fb1bc

No production actions, external network calls, inference, /v1/forecast calls,
prediction scans, automatic collection, deployment or Slice 2D work are included.
No dependency or engine declaration changes. Existing regression tests may use
isolated loopback fixture servers; no external services are required.

## Validation and measurements

Five focused suites cover contracts/readback/security, delivery/checkpoints/crash
reconciliation, supported SQLite snapshot+tail reconstruction, health/drill policy,
and import/production boundaries. Faults are deterministic injected interruptions,
not evidence of real provider failure behavior. Restart tests discard the local
journal; the independent fake-provider object map survives as the remote service.
Physical machine/provider loss is not simulated by an in-process provider.

The large fixture has 1,001 forecasts across manual/current/future protocols. A
snapshot at transaction 12 and tail through transaction 28 reconstruct exact state
after both source database and local snapshot are deleted. The suite prints
verification times, transport/SQLite sizes, chain verification and restore time.
Synthetic data is highly repetitive and is not a production capacity estimate.

Measured on the local fixture runtime (Node 24.18.0 / SQLite 3.53.1):

| Operation | Duration | Artifact bytes |
| --- | ---: | ---: |
| Single bundle readback verification | 16 ms | 67,881 |
| Twenty session bundle verifications | 414 ms | 1,383,577 total |
| Complete 28-checkpoint chain verification | 2,863 ms | 52,174 checkpoint bytes, plus referenced evidence |
| 1,001-forecast snapshot + tail restoration | 17,631 ms | 5,555,555 snapshot transport bytes; 4,165,632 SQLite bytes |

Snapshot watermark: 12. Expected final sequence: 28. Restore timing includes
checkpoint verification, snapshot validation, tail replay and final validation.
These are observed fixture measurements, not production latency/RTO guarantees.

Validation completed: five Slice 2C suites; three Slice 1 suites; four Slice 2A
suites; five Slice 2B suites; twelve offline regression suites; discovery 24/24
including data provenance. JavaScript syntax checks cover all 16 changed/new JS
files. Package JSON, unchanged dependencies/engines, tracked diff whitespace and
all new-file whitespace checks pass. The protected prediction fingerprint matches.
No commit, push or deployment was performed; changes remain for review.
