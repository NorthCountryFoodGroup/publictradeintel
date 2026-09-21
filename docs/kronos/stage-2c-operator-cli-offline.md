# Stage 2C Slice D: offline operator CLI

Slice D adds an offline operator interface on top of the unchanged Slice C public
proof and native signer/witness protocol. It provisions nothing. All executable
examples and tests use published deterministic fictional Ed25519 fixture keys.
The prompt in the fixture executable models user presence; it is not hardware
security or an operational authentication mechanism.

## Scope and invocation

Five new runtime modules implement public review/decision contracts, an explicit
SQLite operator store, an authentication/controller abstraction, public proof
composition, and CLI parsing/rendering. They perform no I/O, key generation,
credential reads, network access, or timer creation on import. Existing runtime
modules, service startup, routes, flags, Render configuration, dependencies and
package lock remain unchanged. Existing boundary tests admit only these five
new modules. Seven focused suites join the previous 57 suites (64 total).

The fixture-only executable is `scripts/kronos-operator-cli-offline.js`. It requires
`--fixture <initialized-temp-directory>` and a marker created by the test fixture's
`initialize()` helper. It accepts only direct temporary directories prefixed
`pti-signer-operator-`; no production path or arbitrary credential configuration
is accepted. No fixture is initialized merely by importing or invoking help.
The fixture clock is fixed at 2026-09-20T16:00:00Z for repeatable offline evidence.
It must never be used as an operational clock or provider.

Commands after the fixture selector:

| Command | Behavior |
| --- | --- |
| `pending` | At most 25 request summaries; explicit `hasMore`, no evidence blobs |
| `inspect <id>` | Validated bounded evidence summary and durable `reviewHash` |
| `approve <id> <reviewHash>` | Exact reviewed request, fresh revalidation, explicit confirmation, durable approval |
| `deny <id> <reviewHash> <reason>` | Durable terminal denial; reason is POLICY, EVIDENCE, SCOPE or OPERATOR_CANCELLED |
| `result <id>` | Only an existing completed native issuance with matching approval, envelope, receipt and public proof |
| `status` | Bounded journal/witness/auth/signer state and recovery count; no database dump |

The explicit review hash extends the proposed command model so the CLI cannot
approve whichever request happens to exist when a stale screen is confirmed.
Approval confirmation repeats `APPROVE <id> <requestHash> <reviewHash>` exactly;
denial repeats the equivalent DENY phrase. The preceding summary includes the
chosen action and reason through the typed confirmation interface. Empty input,
no response, cancellation or a generic 'yes' cannot approve anything.

No arbitrary signing, key generation/export, registry/history mutation,
force-completion, bypass, recovery clearing, or application PIN authority exists.
The CLI emits bounded summaries/hashes, not serialized signature artifacts. Its
typed result API returns public verification material, never private keys.

Approval produces the existing `KRONOS_OPERATOR_APPROVAL_V1` artifact. It does not
call the native issuer automatically. The independently controlled native issuer
consumes that exact artifact through its existing interface. The tests explicitly
exercise this bridge and final result retrieval. There is no production bridge.

## Inspection and exact bindings

A review binds the entire validated request and evidence hashes, attestation hash,
domain, environment, stream, signer, pinned registry revision/hash, software and
policy revisions, timestamps, expiry, coverage, evidence type/version and optional
research provenance. It also requires absent native/witness issuance state and a
pending operator state. A request ID cannot be re-inspected with a different
context in the same immutable store; changed evidence requires a new request ID.

Provider summaries include bucket/region, encryption, retention, exact VersionId,
readback hashes and idempotency observations. Runtime summaries include Node,
SQLite, storage/lock/fsync observations and freshness. Restore summaries include
exact remote versions/hashes, counts, expected/actual state hashes, remote-only
and source-removal evidence, PASS/FAIL, and coverage. At most ten restore inputs
are displayed, with the total and omitted count explicit. Approval/denial of an
omitted-input review is refused; broader review needs a separately designed
interface. Limited coverage is never relabeled as full recovery.

Immediately before reserving the signing opportunity, the controller re-fetches
and validates the candidate, pinned registry, full signed witness history, fresh
challenge-bound view and current state. It compares the new context to the stored
review. After authentication/signing it repeats context, state, witness and expiry
checks before persisting the decision. Invalid or unavailable evidence fails
closed. No caller-provided claim of completion or witness freshness is trusted.

## Operator authority and custody boundary

`createAuthProvider` is a trusted composition-time dependency: it accepts a pinned
public identity, a presence/authentication callback, and separate typed approval
and decision signing callbacks. It exposes no raw signing or private-key method.
Future hardware integration must supply these callbacks inside the operator trust
boundary. Constructing a provider is not proof of real hardware presence.
`createFixtureAuthProvider` requires explicit test-only mode and a fictional
Ed25519 KeyObject matching the pinned public key. No key is generated or exported.

Session handles are private WeakMap capabilities, limited to five minutes and the
operator's validity interval; a caller's object with an operatorId is not a grant.
Operator keys must differ from all four attestation keys and the witness key.
Signature verification enforces the independently pinned key and scope even if
an untrusted caller supplies a fake provider or altered artifact. LOGIN_PIN,
ADMIN_PIN, web sessions and Node application authority have no role here.

This is an in-process trusted composition abstraction, not an OS isolation claim.
A future privileged operator process must own the provider and store. An attacker
with the operator private key or trusted composition control is outside this
fixture boundary. Node callers possessing only public/request data cannot mint
valid operator signatures, change the pinned key, bypass the witness or release
an incomplete native result.

## Durable transitions, races and recovery

The explicitly opened operator SQLite database uses DELETE journaling,
synchronous=EXTRA, foreign keys, schema/application identity checks and immutable
UPDATE/DELETE triggers. Reviews, attempts, decisions and audit rows are append
only. BEGIN IMMEDIATE serializes competing transitions across processes. Each
request has one attempt slot and each attempt nonce is globally unique within
that store. Approval and denial compete for the same slot.

A committed attempt precedes any operator signature. A crash before signing or
after the approval signature but before decision persistence leaves
RECOVERY_REQUIRED. The CLI never clears or automatically signs that request again.
Once a decision is committed, loss of its response is reconciled by returning the
exact persisted artifact for the same command, review and reason, with zero new
signatures or native dispatch. An opposite action, altered review or reused nonce
fails. Durable denial prevents later approval under that request ID.

Approval requires two domain-separated operator signatures: the unchanged V1
approval signature and a companion decision signature. Denial requires only its
decision signature. Native attestation signature semantics remain unchanged.
Exactly-once here is a safety property, not guaranteed progress after failures.

Every controller action appends bounded audit metadata, including refusals and
exact response recovery. Rows contain operator/request identity and known hashes,
action, domain/environment/stream, signer/registry, time, result and bounded
reason. Aggregate reads use null request fields. Invalid/unreadable requests may
have null unavailable metadata. Audit persistence failure prevents successful
authorization; no system can promise a durable failure log when the store itself
is unavailable. Provider exception text and arbitrary CLI input are not copied
into audit or terminal output.

SQLite immutability is not an independent anti-rollback witness for the operator
store. A privileged adversary restoring the entire operator store could remove
unpublished denials. There is deliberately no such CLI operation. Retained
operator decision heads, operational backup/fencing, filesystem ownership,
authentication transport and clock assurance remain provisioning-readiness
review subjects. Native issuance retains its existing independent witness and
vault rollback protections. Do not claim this fixture closes those operational
custody questions.

## Public proof and future research

The original strict `KRONOS_OFFLINE_PUBLIC_PROOF_V1` format and verifier are
unchanged. The exact V1 approval is embedded in the native proof as before.
A new `KRONOS_OPERATOR_PUBLIC_PROOF_V1` companion binds a signed
`KRONOS_OPERATOR_DECISION_V1` record to that proof. Its verifier checks external
operator/registry/witness trust pins and an independently retained expected
decision hash, then runs the original public verifier for completed approvals.
Denial proofs require null issuance and null approval. An approval-only decision
is not a completed result.

The signed decision retains optional model revision, forecast/research contract
versions and input cutoff, alongside mandatory software/policy, evidence time,
environment/stream and exact coverage. Inapplicable qualification-only metadata
is explicitly null. A supplied cutoff must not be later than evidence observation.
These fields are signed by the companion decision without changing V1 approval
semantics. Consumers requiring this provenance must require the companion proof;
the old V1-only verifier makes no claim about the new metadata or denial state.
No model execution, prediction logic or outcome evaluation is introduced.

Standalone verification needs public artifacts and separately configured trust
roots/challenges only: no source databases, private keys or network. A retained
expected decision hash prevents substituting another signed decision at this
interface; distributing and retaining that pin is an operational design concern.

## Validation and boundaries

Focused suites cover all six commands, all four attestation roles, authority and
key substitution, exact duplicate responses, denial, nonce/artifact replay,
context mutation, validly rehashed coverage drift, cancellation, request/session
and signed witness expiry, three separate-process races, four fresh-process crash
boundaries, audit, standalone proof after source deletion, metadata tampering,
coverage, safe output and import purity. The full runner retains every previous
integration/native/witness/preflight/qualification/S3/research suite.

Discovery (24 checks plus provenance), prediction semantics, autonomous
compatibility, local/cached offline npm audit, whitespace, syntax, package and
dependency validation are separate final gates. The protected buildPrediction
fingerprint remains:

`72714872ed27c9c7d1ceac407a87e67d753afb9f6c7cec8f0051cc80631fb1bc`

Real keys, hardware enrollment, cloud/API calls, provisioning, production changes,
deployments and inference/scans are zero. Only the separately authorized Slice C
Git push/merge used a remote connection. Automatic readiness and OFF_DISK_VERIFIED
remain false. Slice D must remain uncommitted for review. A provisioning-readiness
review can examine the explicit operational gaps above; it does not authorize
creating machines, enrolling hardware, generating real keys or enabling production.

## Exact review inventory

- `docs/kronos/stage-2c-operator-cli-offline.md`
- `kronos/research-qualification-operator-cli.js`
- `kronos/research-qualification-operator-contracts.js`
- `kronos/research-qualification-operator-control.js`
- `kronos/research-qualification-operator-proof.js`
- `kronos/research-qualification-operator-store.js`
- `package.json`
- `scripts/fixtures/kronos-operator-child.js`
- `scripts/fixtures/kronos-operator-evidence.js`
- `scripts/kronos-operator-cli-offline.js`
- `scripts/smoke-test-kronos-backup-boundary.js`
- `scripts/smoke-test-kronos-integration-boundary.js`
- `scripts/smoke-test-kronos-operator-authority.js`
- `scripts/smoke-test-kronos-operator-boundary.js`
- `scripts/smoke-test-kronos-operator-commands.js`
- `scripts/smoke-test-kronos-operator-proof.js`
- `scripts/smoke-test-kronos-operator-races.js`
- `scripts/smoke-test-kronos-operator-recovery.js`
- `scripts/smoke-test-kronos-operator-toctou.js`
- `scripts/smoke-test-kronos-preflight-boundary.js`
- `scripts/smoke-test-kronos-qualification-boundary.js`
- `scripts/smoke-test-kronos-research-storage-boundary.js`
- `scripts/smoke-test-kronos-signer-boundary.js`
- `scripts/smoke-test-kronos-witness-boundary.js`
- `scripts/validate-kronos-offline-integration.js`

Slice C was committed as `8ddaa386060702c1e47380c1ef257b6154cbd32e` with message
`Integrate offline Kronos signer and witness`, on
`codex/kronos-signer-witness-integration`. Its exact 19-file +943/-8 scope passed
57/57 suites before the authorized normal branch push and fast-forward main merge.
Both main refs matched that SHA, and the worktree was clean before creating
`codex/kronos-operator-cli-offline`. Slice D remains uncommitted on that branch.
