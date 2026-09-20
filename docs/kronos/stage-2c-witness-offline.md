# Stage 2C Witness Slice A: offline foundation

Status: implemented for offline review, uncommitted. Architecture commit/base: `97fa56b6e225f7fbf4621b061d277ba6e113b4b7`. Branch: `codex/kronos-witness-offline`. No operational witness, signer, transport, cloud vault, account or key has been provisioned. No production startup, backup worker, inference or live V3 consumer imports these modules.

## Contracts and trust boundary

| Version | Role |
| --- | --- |
| KRONOS_WITNESS_IDENTITY_V1 | Independently configured public witness key/fingerprint/epoch, environment/stream, policy and store/domain/writer-epoch registrations |
| KRONOS_WITNESS_APPEND_V1 | Exact contiguous batch of original durable issuance events, journal hashes, preceding checkpoint, requested time and checkpoint commitment |
| KRONOS_WITNESS_CHECKPOINT_V1 | Namespace/store/domain/epoch, journal sequence/hash, predecessor checkpoint, registry revision/hash, consumed-identifier hash and issuance-core hash |
| KRONOS_WITNESS_RECEIPT_V1 | Global receipt sequence/predecessor, append hash, checkpoint, namespace/epoch/policy and durable acceptance time |
| KRONOS_WITNESS_ACK_V1 | Receipt plus exact fake-vault receipt and pinned witness fingerprint, authenticated by a detached Ed25519 signature |
| KRONOS_WITNESS_VIEW_V1 | Challenge-bound authenticated latest global receipt and selected-store checkpoint, current registry, issue/expiry time and pinned fingerprint |
| KRONOS_WITNESS_POLICY_V1 | Offline policy: five-minute requested-append window and fresh-view lease; bounded batch and fixed registered writer epochs |
| KRONOS_WITNESS_FAKE_VAULT_RECEIPT_V1 | Test-only retained publication ID, sequence/predecessor and exact entry hash |

`KRONOS_ISSUANCE_CHECKPOINT_V1` and the original signer/attestation/approval contracts are unchanged. The new witness checkpoint is a separate authenticated-context commitment, not a replacement for the original signer journal. Shapes use explicit allowlists, canonical JSON and hashes. A batch is capped at 256 events and 2 MiB; single-message Ed25519 semantics are unchanged.

Witness signatures cover `body.version + newline + canonicalize(body)` as UTF-8. The verifier closes over an independently supplied identity pin and vault ID; proof payloads cannot choose another key. Acknowledgment, view and other version prefixes are distinct. Foreign identity/key, fingerprint mismatch, signature tampering and arbitrary proof publicKey fields fail.

There is no operational key loader. The store receives an explicit signing callback and validates its result against the pinned public key before releasing it. Only test fixtures supply a callback, using a fixed fictional Ed25519 seed; no random or real key is generated. Witness keys must differ from attestation keys and configured operator approval keys. Production readiness fields are literal false, and status identifies the foundation as simulated.

Trusted constructor configuration (identity, registry pins, binding, operator public authority, vault adapter and signing callback) is outside the untrusted append API. No browser/Node route exposes constructor configuration. It is not an implemented hardware login, mTLS service, key custody system or governance root distribution mechanism.

## Journal validation and durable commitments

`research-qualification-witness-state.js` replays every accepted append before a decision. It validates original `KRONOS_DURABLE_ISSUANCE_V1` events: REGISTRY, RESERVED, ENVELOPE, RECEIPT and COMPLETED. It recomputes canonical event hashes, requires exact sequence/predecessor continuity and checks event chronology. Registry events require approved hashes, valid lifetimes and existing monotonic lifecycle/rotation rules. All stores share the current registry lineage; a stale local registry must be updated before further issuance events.

Reservations require exact environment/stream/software/policy binding, permitted domain, original request validation and external operator signature. Approval must be valid at both reservation time and witness acceptance time. Request ID, request nonce and approval nonce are permanently consumed across every registered store in the environment/stream namespace. Entries cannot silently remove earlier consumption. Envelope signatures and context signatures are verified; receipt/completion transitions recheck permitted signer lifecycle at their event times.

Checkpoint `consumedHash` commits sorted per-store request IDs/nonces/approval nonces plus request/evidence hashes and signer IDs. `issuanceCoreHash` commits sorted completed request/attestation/approval/envelope/receipt tuples. Sorting is deterministic code-unit order, independent of machine locale. Neither commitment substitutes for replaying/validating the actual events.

Each store has its own journal/checkpoint chain. Witness receipts additionally form one global monotonic chain. Unknown predecessors, duplicate appends, gaps, reordering, older state, sequence jumps, forks and mixed namespaces/writer epochs are denied. Different stores cannot reuse consumed identifiers. An exact result is retrieved with `acknowledgment(sequence)`; `append()` never accepts an already-consumed append as a new checkpoint. Fake-vault publication itself is idempotent for exact bytes, enabling explicit recovery.

Writer epochs are fixed by pinned identity registrations in Slice A. Online epoch rotation, new-store governance and cross-host fencing are not implemented; different configuration fails store identity validation rather than silently taking ownership.

## SQLite and ownership

Opening is explicit, with an absolute path, initialize-new/open-existing mode and pinned metadata. SQLite is required only inside explicit open. Local storage checks regular non-symlink single-link files, schema/application identity, integrity, immutable canonical payload hashes and completion continuity. DELETE journaling, synchronous EXTRA, foreign keys and BEGIN IMMEDIATE transactions are used. Metadata, entries and completion rows reject UPDATE/DELETE. Receipt entries are immutable and sequence/hash unique; publication completion is an additional append-only marker.

A persistent exclusive `.writer.lock` carries a process ID and ownership ID. A second process is rejected, and every operation checks ownership. Normal close releases the owned lock. Abrupt process exit leaves the lock, and reopen never steals it. `recoverOwnership()` requires an explicit operator reference, matching observed ownership ID and confirmed dead process; a live/reused PID is denied. The operator reference records intent in the returned recovery result, not authenticated operational administration. Actual host fencing/audited governance remains a later deployment requirement.

This is cooperative local-process ownership under trusted filesystem permissions, not protection against a privileged filesystem administrator. Directory synchronization is attempted; Windows limitations are handled explicitly. Power-loss, VM-volume durability, permission hardening and multi-host ownership remain operational qualification work.

## Independent fake vault and release rule

The fake vault is only under `scripts/fixtures/`. It uses a separate SQLite file and ownership lock outside the witness file's rollback path. It conditionally appends immutable exact `{append, receipt}` evidence, enforces global sequence/predecessor, returns a hash-bound vault receipt and supports exact readback. No S3/provider adapter, HTTP client or credentials are present. Its independence is a test-model assumption: restoring both fixture files together is not protected by a magically external anchor.

Release order:

1. Validate append shape, journal transitions, registry and consumed identifiers against full local history.
2. Commit exact unsigned receipt/checkpoint evidence in local SQLite as pending publication.
3. Conditionally append exact evidence to the separate vault.
4. Validate vault receipt, latest head and exact readback of every retained entry against local history.
5. Commit local publication-completion marker.
6. Generate the domain-separated acknowledgment signature, verify it against the pinned key and return it.

The vault retains the exact receipt/checkpoint evidence before acknowledgment signing. The acknowledgment signs that evidence and its vault receipt; it is not inserted back into the content it signs, avoiding a circular hash. The signature is deterministic for a given persisted receipt/vault receipt, so retrieval returns the exact acknowledgment even after restart. A signing callback that produces an invalid signature cannot release success, though publication may already be durable.

Vault unavailable, conflict, stale head, different same-sequence content, incorrect readback or invalid receipt freezes the instance/fails the call. No successful acknowledgment or fresh view is released. Raw adapter errors are mapped to allowlisted witness codes. Existing local mutation may remain pending and must be reconciled explicitly; errors never roll back or overwrite independent retained history.

## Startup reconciliation and rollback

| Local versus retained vault state | Startup state |
| --- | --- |
| Equal valid history, all publication markers present | READY |
| Local older than vault | ROLLBACK_DETECTED; no automatic reconstruction or new proof |
| Local ahead of vault | UNACKNOWLEDGED_LOCAL_STATE; no new proof |
| Same sequence, different content/hash | FORK; no new proof |
| Equal exact evidence, missing local publication marker | RECOVERY_REQUIRED; no new proof |
| Vault unavailable | VAULT_UNAVAILABLE; no new proof |

`recoverPublication({operatorRef})` is an explicit offline recovery operation for exactly one pending local entry. It revalidates local history; publishes exact pending evidence if the vault is one entry behind, or validates already-retained matching evidence; verifies readback and adds only the missing completion marker. It never lowers a head, rewrites old entries, skips sequence, reconstructs a rolled-back DB or chooses a conflicting branch.

Ordinary failed calls freeze their current handle. Reopening revalidates persistent accepted history and the independent vault; there is no persistent incident/governance ledger for every rejected request in this slice. Database rollback/fork divergence remains detectable on every reopen. A malicious rollback of all independently configured roots and the vault itself is outside this fixture model.

## Crash boundaries

Each case exits a fresh child process abruptly and then requires explicit stale-lock recovery before reopening.

| Crash point | Reopened state | Permitted action |
| --- | --- | --- |
| Before local transaction | READY, no new entry | Append original still-valid request |
| Local commit before vault append | UNACKNOWLEDGED_LOCAL_STATE | Explicit exact publication recovery |
| Vault append before completion marker | RECOVERY_REQUIRED | Explicit exact readback and completion recovery |
| Local completion marker committed | READY | Retrieve exact acknowledgment |
| Acknowledgment generated, not returned | READY | Retrieve identical acknowledgment |
| Acknowledgment returned | READY | Retrieve identical acknowledgment; duplicate append rejected |

All cases preserve one checkpoint, contiguous sequence and consumed identifiers. Additional tests cover uncommitted SQLite write rollback, immutable-table triggers, live/second writer rejection and explicit dead-owner recovery. There is no automatic signing-authority retry or real attestation issuance in this foundation.

## Authenticated fresh views

Views bind witness identity/epoch, policy, environment/stream, selected store/domains/writer epoch, latest global receipt sequence/hash, selected checkpoint, current registry revision/hash, caller challenge, issue/expiry and fingerprint. Lease is exactly 300,000 ms. Verification rejects future, expired, wrong-challenge/store, below-minimum or unexpected-head views. New views require current valid registry, non-reversed time, completed local publication and exact vault reconciliation. Restored-old witness DB cannot mint a fresh lease.

Consumers must provision trusted witness pins and maintain external minimum sequence/head expectations. A five-minute signed lease is not instantaneous revocation or an authenticated assertion of freshness if its client accepts arbitrary roots. No current production consumer imports these contracts, and no background refresh worker exists.

## Validation and remaining work

Five focused suites cover contracts/authentication/views/secrets; journal/registry/identifier continuity; vault failures and rollback; crash/ownership recovery; import and production boundaries. Test fixtures block external network/real credential access. Existing boundary allowlists name only the four new witness modules; a new boundary test prevents runtime imports outside that set and protects original crypto, preflight and production files. Package changes add five test commands only; dependencies and lockfile are unchanged.

Required regression: five preflight, three signer, four qualification, twelve S3/retention and seventeen prior research suites, plus new witness suites (46 total); discovery 24 contracts plus provenance, prediction semantics and autonomous compatibility; syntax/package and whitespace checks. npm audit is run with `--offline` to respect this task's no-network requirement; its report is not a fresh registry advisory lookup.

Remaining operational gates: real independently administered vault and authenticated transport; retention and power-loss qualification; governance/root/epoch rotation and filesystem/host fencing; actual witness key custody; operational recovery audit; native signer Slice B; authority integration; operator CLI; live synthetic qualification; public V3 consumer integration. Nothing in Slice A establishes production OFF_DISK_VERIFIED or automatic collection readiness.

Protected buildPrediction fingerprint: `72714872ed27c9c7d1ceac407a87e67d753afb9f6c7cec8f0051cc80631fb1bc`.

No AWS/STS/S3 calls, Render changes, real keys, credential resolution, provisioning, deployment, production mutation, inference or production scans. Network was used only for the separately authorized architecture Git push/fetch/merge; Slice A implementation/tests and audit remain offline. Do not commit Slice A until separate review approval.
