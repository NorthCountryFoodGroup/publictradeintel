# Stage 2C S3 compatibility hardening (offline)

Base: 884b58ccc5f50febcb5aae773029fb8badc42032.
Branch: codex/kronos-stage2c-s3-compatibility.

This slice has no AWS SDK, credentials, account calls, real provider, environment
reads, service wiring, inference, production migration, or automatic collection.
Existing JSON remains authoritative. Production readiness and runtime qualification
remain false. Nothing in this document approves production retention or deployment.

## Compatibility and versions

Existing V1 bundle, archive, canonicalization, database schema, research records,
and old backup readers remain supported. New behavior is explicit in:

- KRONOS_RETENTION_REQUIREMENT_V1
- KRONOS_BACKUP_TRANSPORT_V2
- KRONOS_REMOTE_RECEIPT_V2
- KRONOS_REMOTE_CHECKPOINT_V2
- KRONOS_SNAPSHOT_MANIFEST_V2
- KRONOS_SNAPSHOT_CHUNK_V1
- KRONOS_DELIVERY_JOURNAL_V1
- KRONOS_EXPECTED_TAIL_WITNESS_V1
- KRONOS_RECOVERY_BOOTSTRAP_V1
- KRONOS_PROVIDER_QUALIFICATION_V1

The provider-version validator is shared by V1 and V2. It preserves the exact
well-formed Unicode string, permits opaque punctuation, bounds UTF-8 to 1,024
bytes, and rejects empty/null identities, C0/C1 controls and lone surrogates.
Internal labels, object keys and hashes retain their stricter validation. Opaque
version fields are validated separately from path/secret-shaped evidence fields;
they are never interpreted as paths or normalized. The byte bound follows
[AWS version-ID documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/versioning-workflows.html);
public documentation was researched without S3 API or account access.

## Original retention, not a moving expiry

Each V2 descriptor binds its original approved-at time, minimum retention expiry,
policy identifier/class/hash and FIXTURE_ONLY approval. Descriptor hashes and
checkpoint references bind the requirement; readback compares actual retention to
that stored minimum. Reading never computes a new expiry from the current date.

PROSPECTIVE_EVIDENCE_V1 has no automatic duration: a fixture duration is required.
Seven years remains proposed outside this implementation. SNAPSHOT_DAILY_V1,
SNAPSHOT_WEEKLY_V1 and SNAPSHOT_MONTHLY_V1 use 30, 90 and 400 days respectively;
QUALIFICATION_SHORT_V1 uses one day. All requirements explicitly have
productionApproved=false. Real configuration approval is a future contract gate.

New uploads require unexpired protection. Historical required evidence must still
be present and match its original retention metadata even after its lock period.
An expired lock is not permission to delete required evidence. No lifecycle or
cleanup worker exists here.

## Dependency classes and optional expiry

Reference class is derived and checked from artifact type, not freely chosen.
Bundles, receipts, checkpoints and archives are REQUIRED_EVIDENCE. Snapshot
manifests and chunks are RECOVERY_ACCELERATOR. Required evidence cannot be
relabelled optional. V1 checkpoints retain their original strict dependency rules.

V2 checkpoint verification verifies unexpired snapshot manifests and their chunks.
Before the original approved expiry, an absent accelerator fails verification.
After that expiry, historical verification may skip it and reconstruct entirely
from mandatory original bundles. No missing required artifact is forgiven.
The chosen snapshot must pass full byte hash, SQLite integrity, relationships,
watermark, count and transaction-prefix validation. The new manifest wraps the
existing independently validated SQLite manifest plus exact chunk references.

## Bounded transport and memory

Snapshots no longer require base64 JSON envelopes. A local file-source abstraction
opens an explicitly supplied regular file/range, reads at most 128 KiB at a time,
and closes handles in finally blocks. SHA-256 is incremental. Snapshot chunks are
at most 4 MiB, identified by descriptor/content hashes and protected independently.
A manifest pins chunk order, exact versions, sizes and total SQLite byte hash.
The local filesystem path never enters a portable descriptor or receipt.

The snapshot transport supports at most 4,096 chunks (16 GiB). Structured JSON
artifacts are bounded to 16 MiB. These are explicit operational limits, not
unlimited capacity claims. The fake provider persists bytes to local files and
metadata to a separate SQLite database; it does not retain an entire snapshot in
memory. Readback hashes chunks incrementally without accumulating binary bodies.

Transport buffers are bounded. The existing research-store logical integrity
inventory still materializes records, and discovery retains a bounded history;
this is not a claim that the complete research application uses constant memory.
Discovery caps aggregate bundle transport size at 128 MiB, 10,000 checkpoints and
1,000 listing pages. Larger research histories fail closed pending a separately
reviewed streaming replay extension. No legacy size limit was silently removed.

## Durable delivery journal and writer ownership

Operational status uses a separate SQLite database, never research transactions.
Its schema/version, append-only triggers, canonical event payloads, global hash
chain and integrity are checked on reopen. journal_mode=DELETE and
synchronous=EXTRA are required. Each event records transaction/artifact identity,
attempt, state, time, bounded failure, receipt/checkpoint references and the
immutable original delivery plan. There is no recursive backup obligation.

The journal requires the current research-store writer and claims its sole backup
lease. A separate exclusive journal lock prevents competing journal processes.
Every event and checkpoint publication checks ownership. The research writer
cannot close while the journal lease is active. Releasing/losing ownership blocks
further work. Stale locks are never automatically stolen; crash ambiguity requires
explicit operator review. The fixture proves refusal first, then explicitly
removes its own stale locks after confirming the child exited.

Fresh processes reopen the research store, journal and persistent fake-provider
objects. They recover the original plan and attempt count, reconcile an existing
checkpoint first, and reuse immutable artifacts. Previously acknowledged checkpoint
references anchor subsequent publication. A caller cannot start a detached second
sequence on a new journal. Restoring a lost operational journal for resumed writing
requires separately reviewed recovery/adoption; isolated research restoration is
already implemented here.

## Deadlines, abort and retry ownership

The core owns four attempts and the 60-second budget from the original commit
instant. Attempt counts survive restart. Provider capabilities require CORE retry
ownership and maxAttempts=1; each provider operation receives that bound.
Runtime-only AbortControllers/timers enforce request/body budgets (10 seconds by
default, no more than the remaining delivery budget), and monotonically measured
scope deadlines bound late resolutions. Timers are cancelled and listeners removed.
No timers, SQLite or filesystem access occur at module import.

The provider must honor AbortSignal before finalizing a write and while returning
body chunks. Hung uploads/downloads/metadata and a hung/partial body are exercised.
A noncooperating asynchronous result cannot pass a closed/expired scope or later
acknowledge success. A future remote PUT can still have an ambiguous outcome after
cancellation; it must be reconciled before retry, not assumed absent.

Authentication/integrity/retention/version failures are terminal. Transient provider
failures use capped injected jitter. No SDK is installed; the future S3 client must
disable nested SDK retries and pass the same cancellation contract throughout.

## Verified immutable cache

Cache state is private and bound to the provider instance, container and context.
Keys include full descriptor, exact opaque version, dependency class and original
retention requirement. The default cache is bounded to 2,048 entries / 32 MiB with
a maximum 30-second reuse window, shortened by artifact retention expiry.
Clock reversal and expiry invalidate entries. Newly uploaded or reconciled objects
always receive a fresh independent readback before publication is acknowledged.

The cache reuses verified payloads or small chunk-verification records, not arbitrary
caller assertions. Restore byte reconstruction performs fresh chunk downloads.
A fresh process has an empty cache; unexpected remote loss is detected then or
when the bounded window expires. This is explicitly a verification-evidence window,
not a claim to instantly detect deletion after every successful read.

## Remote discovery and independent witness

The bootstrap fixes context, container, namespace and V2 genesis. Paginated listing
is bounded, cursor loops and duplicate slots fail, and exact slot order, descriptor
identity, ancestry, required evidence and final checkpoint hash are checked.
The witness independently pins checkpoint number, sequence, key/version/hash,
context, time, software revision and optional previous-witness hash. Witness chains
must increase in sequence and link hashes. Exclusive file creation prevents
rewriting a witness in place; production operator storage remains future work.

A known witness makes missing tails detectable. This implementation requires exact
agreement with its witness: additional remote checkpoints require a newer reviewed
witness, rather than silently advancing expected state. A hash provides integrity,
not independent authenticity; future operator custody/signature trust is required.

Restore starts with code, non-secret bootstrap, independent witness and fake-provider
access only. It discovers references itself. Snapshot plus tail or genesis replay
runs in an isolated staging directory; only a fully verified result is published
by same-parent rename. The exclusively owned restore store replays contiguous
tail sequences without rescanning its full history for each transaction; prior
blob dependencies and the final complete transaction-hash inventory are checked.
Failure never creates an accepted destination. No production
replacement is implemented. Platform-specific directory fsync caveats remain.

## Qualification and remaining production gates

The qualification record includes provider/container/region/context, capability,
versioning/lock/encryption/conditional-write/readback results, restore-drill ID,
runtime reference, policy hashes, timestamps/revision and a canonical record hash.
Expiry is bounded to 30 days. Secret-shaped fields and unsafe portable values fail.

Even a caller-generated record naming S3 with every boolean true is untrusted.
FAKE_FILE can never qualify. isQualifiedRealProvider remains unconditionally false;
there is no issuer registration or environment override. Hashing is not signing.
Later qualification needs a reviewed trust root, signed operator evidence, exact
configuration binding, revocation/expiry and live runtime/restore qualification.

Production runtime gates remain: exact Render Node version, built-in SQLite/backup,
SQLite version, persistent filesystem, permissions, locks, fsync/rename, free disk
and a single Node writer. There is no live Render access in this slice.

## Tests and interpretation

Compatibility suites: contracts, abort, restart, integrity, large, discovery and
boundary. Prior Slice 1/2A/2B/offline-2C suites remain separate regression gates.
The large transport fixture is a 136 MiB synthetic file; the discovery fixture uses
a real research SQLite database with 1,001 forecasts and 1,006 transactions.
These complement each other: the binary stress file is not misrepresented as a
large populated production database. Fresh child processes receive no checkpoint
list or local research artifact. Fixture compression/latency is not a production
storage, network or RTO estimate.

No commit, push, deployment, AWS contact, production data access, inference,
forecast endpoint call, prediction scan or automatic collection is authorized.

## Final offline validation results

All seven compatibility suites passed. Prior suites passed: Slice 1 (3), Slice 2A
(4), Slice 2B (5), offline Slice 2C (5). The final writer-lease change was followed
by successful reruns of storage/recovery and storage/portable/backup boundaries.

All 12 approved offline regressions passed: Kronos shadow, security, UI,
raw-normalized, trigger provenance, worker lifecycle; Trade Brief selection,
consistency, V2 and Phase 3; prediction semantics; autonomous-decision
compatibility. Discovery validation passed 24/24 plus provenance.

The first large recovery run exceeded its 240-second child timeout due to repeated
full-history scans during replay. The corrected isolated replay retains sequence,
prior-content and final full-history verification; the complete drill then passed.

| Fixture | Measurement |
| --- | --- |
| Research history | 1,001 forecasts, 1,006 transactions, 3,020 remote objects |
| 20 distinct bundles, each requested twice | 20 GETs; 733,782 bytes |
| 1,000 distinct bundles, each requested twice | 1,000 GETs; 35,729,301 bytes |
| Snapshot at sequence 500 plus tail | 69,440 ms; 11 discovery lists; 3,021 GETs; 48,298,224 bytes |
| Full genesis replay after accelerator deletion/expiry | 78,119 ms; 11 discovery lists; 3,018 GETs; 40,620,135 bytes |
| Snapshot restore process RSS at completion | 403,464,192 bytes |
| Full restore process RSS at completion | 393,416,704 bytes |
| Synthetic binary transport | 142,606,336 bytes (136 MiB); 34 chunks; 68 GETs; 285,212,672 bytes read |
| Binary transport buffer | 131,072 bytes maximum; 4,194,304 bytes per object |
| Binary transport sampled RSS | 43,024,384 bytes baseline; 64,536,576 bytes observed maximum |

Both fresh restore processes matched the original state hash:
`c3af2049c97d1e74a8745e4929071f2c3b8f68934a267641a458261b8fb62a77`.
The complete local research directory was deleted first. The snapshot-based result
was also deleted before full replay. Premature accelerator loss and witnessed tail
loss both failed without publishing an accepted target. Restore made zero PUTs.
RSS figures are sampled/completion observations, not rigorous allocation peaks.
The cache experiment measures consecutive repeated reads inside its policy window;
it does not claim zero repeated GETs during a complete cold chain traversal.

JavaScript syntax passed for all 27 changed JavaScript files. Package JSON parsed;
dependencies, devDependencies and engines matched the base. Git diff --check and
whitespace checks including untracked files passed. Protected buildPrediction SHA-256:
`72714872ed27c9c7d1ceac407a87e67d753afb9f6c7cec8f0051cc80631fb1bc`.
No Render, environment, frontend, inference or production persistence changes.
All changes remain uncommitted for review; main and origin/main remain at the base.

## Exact review file inventory

- `docs/kronos/stage-2c-s3-compatibility.md`
- `kronos/research-backup-adapter.js`
- `kronos/research-backup-checkpoint.js`
- `kronos/research-backup-contracts.js`
- `kronos/research-backup-deadline.js`
- `kronos/research-backup-delivery-v2.js`
- `kronos/research-backup-discovery.js`
- `kronos/research-backup-io.js`
- `kronos/research-backup-journal.js`
- `kronos/research-backup-qualification.js`
- `kronos/research-backup-retention.js`
- `kronos/research-backup-snapshot-v2.js`
- `kronos/research-backup-transport.js`
- `kronos/research-store.js`
- `package.json`
- `scripts/fixtures/kronos-backup-compatibility.js`
- `scripts/fixtures/kronos-backup-discovery-child.js`
- `scripts/fixtures/kronos-backup-file-provider.js`
- `scripts/fixtures/kronos-backup-restart-child.js`
- `scripts/smoke-test-kronos-backup-boundary.js`
- `scripts/smoke-test-kronos-research-portable-boundary.js`
- `scripts/smoke-test-kronos-research-storage-boundary.js`
- `scripts/smoke-test-kronos-s3-compatibility-abort.js`
- `scripts/smoke-test-kronos-s3-compatibility-boundary.js`
- `scripts/smoke-test-kronos-s3-compatibility-contracts.js`
- `scripts/smoke-test-kronos-s3-compatibility-discovery.js`
- `scripts/smoke-test-kronos-s3-compatibility-integrity.js`
- `scripts/smoke-test-kronos-s3-compatibility-large.js`
- `scripts/smoke-test-kronos-s3-compatibility-restart.js`
