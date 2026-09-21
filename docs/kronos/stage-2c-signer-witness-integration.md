# Stage 2C offline signer/witness integration — Slice C

Review-only implementation on `codex/kronos-signer-witness-integration`.
Base: `14f88bfea908cf535bd91bc69ec26a99a75f93d4` (`Add offline Kronos native signer`).
Slice C must remain uncommitted pending review. No provisioning is included.

## Process and key boundaries

The integration harness launches separate signer, witness and retained-vault Node
child processes, using serialized bounded UTF-8 JSON over anonymous stdin/stdout
pipes. A fourth, disposable verifier process consumes public proof material only.
No sockets, HTTP clients, network service, production database or shared mutable
object references are used. Each role has a distinct PID and its own directory.

The signer owns its original issuance SQLite database and sibling control ledger.
The witness owns its original witness SQLite database. The vault owns a separately
persisted fake retained-vault database and immutable writer-transition ledger.
The parent routes only signer-to-witness and witness-to-vault protocol traffic.
Fixture control commands (clock, crash, recovery and shutdown) are a distinct
trusted test-harness interface, not an application endpoint or operator product.

Each signer child constructs only the fictional keys for its configured domains
and its separate transport identity. The independent-restore child owns the
independent domain key. The witness child constructs only its fictional witness
key. The vault and public verifier construct no private keys. Operator approval
is supplied by the external test operator fixture. Configuration sent to children
contains public authority material, not private keys or seeds.

Deterministic fixture keys are intentionally reproducible, not secrets. Separate
PIDs and owned files demonstrate process composition; they do not establish OS
access-control isolation, hardware custody, real retained storage, cross-host
fencing or production readiness. The test parent is trusted and can simulate disk
rollback and transport faults. No real witness/signer/vault service is provisioned.

## Authenticated offline transport

The pure `research-qualification-integration-contracts` module defines:

- `KRONOS_OFFLINE_IPC_CHALLENGE_V1`
- `KRONOS_OFFLINE_IPC_REQUEST_V1`
- `KRONOS_OFFLINE_IPC_RESPONSE_V1`
- `KRONOS_OFFLINE_WRITER_TRANSITION_V1`

The witness issues a signed, five-minute challenge bound to the pinned signer and
witness identities, witness epoch, writer epoch, store and exact operation/payload
hash. The caller signs the challenge hash and request with its pinned transport
key. The witness verifies both signatures and exact bindings before dispatch.
Responses are witness-signed and bound to the same challenge and request hash.
Only history, fresh view and immutable append are available through this protocol.
Raw unauthenticated append commands are rejected. The challenge endpoint accepts
only known active writer identities and SHA-256 request hashes.

Duplicate exact append delivery retrieves the already committed acknowledgment;
it never calls the underlying witness append operation twice. Conflicting
continuations still reach the original fail-closed witness validation. A lost
append response triggers one bounded authenticated history reconciliation. If the
exact append is present, its verified acknowledgment is reused; otherwise issuance
fails closed. There is no unbounded retry loop or automatic signing retry.

Fault tests cover dropped requests, dropped reservation/final responses, duplicate
delivery, delayed delivery, reversed independent operations, response substitution,
and partitions before reservation acknowledgment, after witness commit, after the
signature, and before final acknowledgment. Dependency reordering and competing
continuations are covered by the fork test. Transport timeouts are bounded; a
silent child is terminated rather than trusted. UTF-8 chunk boundaries preserve
existing large evidence bytes, including the 95,793-byte preflight case.

## End-to-end ordering and exactly-once safety

The existing native signer, durable journal, approval and witness implementations
are unchanged. The observed order remains:

1. Evidence/request and signed operator approval validation.
2. Durable request-ID/request-nonce/approval-nonce reservation.
3. Witness reservation publication and verified acknowledgment.
4. Durable signing-attempt marker, then native Ed25519 attestation/context signatures.
5. Signature verification, exact envelope and receipt persistence.
6. Durable completion intent, witness completion publication and final acknowledgment.
7. Exact local completion, release marker and usable result release.

A completed request has one reservation, one witnessed reservation, one V3
attestation signature plus its required context signature, one envelope, one
receipt, one witnessed completion, and one unique released result hash. Repeated
retrieval can return that same result. Test-only signature telemetry is observed
outside the signer process and is never used as authority or recovery state.

Exactly-once here is a safety property, not guaranteed progress through a partition.
A lost pre-sign path may remain RESERVED and require explicit reconciliation.
If signing might have happened without a persisted envelope, neither restart nor
retry signs again. Post-envelope recovery finishes only the exact persisted result.
No abandonment or ambiguous-reservation repair workflow is added.

## Crashes, rollback, forks and writer epochs

Eight signer process-loss tests stop after reservation, witness acknowledgment,
signature, envelope, receipt, completion intent, final acknowledgment and completion.
Five witness tests stop around local commit, vault publication, completion marker,
acknowledgment generation and response. Explicit dead-owner recovery and witness
publication reconciliation use the existing APIs; no active lock is stolen.

Tests restore earlier signer files, earlier witness files, or both to a mutually
consistent old state while leaving the independent retained vault current. Every
case fails closed. The dual rollback is detected against the vault even though the
two rolled-back components agree with each other.

Two signer children can construct different valid reservations from the same
predecessor using separately copied stores. Delivery is controlled so both
continuations exist before either is accepted. The witness accepts one; the other
fails. The losing signer cannot switch to the accepted branch or sign its candidate.

Writer transitions do not rewrite existing V1 journal events or witness metadata.
The pinned identity predeclares a new store lane at epoch 2. A distinct transport
identity remains disabled until an active pinned operator signs a transition bound
to the complete witness identity hash, old/new stores and epochs, nonce and expiry.
The independent vault immutably retains the transition. Every authenticated witness
request rechecks this retained active-writer state. Old epoch requests are rejected,
including after witness restart; replayed or unsigned transitions fail. A new signer
starts a fresh lane and preserves all old history and globally consumed identifiers.
This explicit fresh-lane handoff is not an in-place epoch migration, and does not
repair pending work in the old lane. Operational transition approval/CLI is deferred.

## Portable public proof

`KRONOS_OFFLINE_PUBLIC_PROOF_V1` contains only:

- Existing signed envelope and issuance receipt inside the exact native result.
- Signed operator approval and pinned-registry public material.
- Pre-sign and completion acknowledgments.
- Ordered logical journal event/hash proofs, witness receipts and vault receipts.
- Signed challenged witness fresh view/checkpoint and a deterministic proof hash.

There are no SQLite pages, SQL schema/internal tables, private keys, tokens,
credentials, cookies, environment dumps or local filesystem paths in the bundle.
Logical journal events are necessary public issuance proofs, not a database dump.

`createPublicVerifier` receives independent public trust roots: binding, registry
pins, operator public metadata, witness identity, vault identity and clock. Each
verification also requires an externally chosen challenge, minimum witness sequence,
expected domain and optional required coverage. A bundle cannot nominate new trust
roots or lower the verifier's freshness/high-water requirements.

Verification checks both attestation/context signatures, operator authority,
witness/vault signature and hash continuity, complete issuance event ordering,
request/evidence/approval/receipt bindings, registry and signer lifecycle, challenged
freshness, exact policy/software binding and requested coverage. Independent restore
pair verification requires full coverage, the same run and distinct signer, key and
issuer. Partial restore coverage is reported truthfully and fails a full-coverage
requirement. All verification results keep production/automatic/off-disk readiness
false. A positive fixture proof is not production provider qualification.

Tests verify a serialized proof in a fresh child after all source databases are
deleted, with private-key and SQLite capabilities denied. Mutations to attestation,
approval, receipt, registry, witness acknowledgment/view, event, sequence, checkpoint,
software, policy, coverage, signer/witness identity and readiness are rejected.
Proofs are limited to 10,000 history entries and 16 MiB; this slice does not implement
history pagination, operational archival authority or automatic key rotation.

## Slice D operator CLI contract preparation

No hardware CLI, credential loader, hardware session or operational signer is
implemented here. The future CLI should expose only these operations:

| Operation | Input | Output / authority rule |
| --- | --- | --- |
| list-pending | Opaque cursor; limit 1–25 | At most 25 IDs, request/evidence hashes, domain, registry revision, state and expiry; no full evidence or secrets |
| inspect | Exact request ID and request hash | Bounded summary: domain, signer, deployment/stream, software/policy revision, evidence hash, coverage/counts, expiry and pending/recovery state; at most 16 KiB |
| approve-exact | Exact request/evidence hashes, signer/domain, registry hash, scope, expiry, unique approval nonce and audit reference | Explicit operator confirmation, then existing `KRONOS_OPERATOR_APPROVAL_V1`; never accepts arbitrary bytes, caller keys or a replacement evidence body |
| deny | Exact request ID/hash, bounded reason code and audit reference | Durable denial record; no reservation, signature or approval; denial cannot be relabeled as approval |
| retrieve-exact | Exact original request/evidence/signer/approval bindings and fresh verifier challenge | Existing released result plus verifiable public proof, or a bounded pending/recovery-required refusal; never signs |

Approval expiry must retain the existing five-minute maximum. Operator identity and
keys come from separately pinned authority configuration, never request parameters.
Pagination cursors must bind the reviewed snapshot and namespace. Inspection must
not silently truncate a security-relevant field: indicate bounded omission and
require explicit full evidence review through a separate authorized mechanism.
Missing/stale evidence, changed hashes, expired approval, wrong role, ambiguous
reservation and stale/forked witness state must produce explicit failure codes.
Denial, recovery and transition authorization storage semantics need Slice D review;
no new operational authorization is inferred from this interface outline.

## Validation and safety

Six integration suites cover flow, transport, recovery, continuity, public proof and
boundaries. `npm run validate:kronos:offline` runs those plus all 51 prior suites
(57 total), stopping at the first failure. Discovery, production/Legacy boundaries,
prediction semantics, autonomous compatibility and offline audit are also rerun.
Offline audit uses local/cached advisory data, not a fresh network lookup.

Only two pure runtime modules are added; all previously merged runtime modules,
production startup/routes, feature flags, Render configuration, dependency versions
and lockfile remain unchanged. Boundary allowlists explicitly admit only those two
modules. All transport/process orchestration is in test fixtures.

Real keys, AWS/STS/S3/KMS calls, Render actions, production mutations, deployments,
inference and scans remain zero. Automatic collection readiness and
`OFF_DISK_VERIFIED` remain false. The authorized Slice B Git push/merge is the only
remote write in this task. Slice C is not committed or pushed.
