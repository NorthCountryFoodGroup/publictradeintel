# Stage 2C operational signer provisioning preflight

Status: design and offline implementation for review only. Base: `791c41f88963f26814c18daf51c01a51e0c6b3dc`. No provisioning, real keys, real issuance, cloud calls, production integration, or readiness change is included.

## Decision before provisioning

**Decision B: valid canonical attestation signing inputs exceed the KMS RAW 4,096-byte limit.** Preserve the existing Ed25519 signing semantics. Recommend an isolated native Ed25519 signer if every currently valid input must be supported. Choose its isolation and key custody architecture in a separate review before provisioning any operational key.

The earlier signer design identifies the candidate KMS key/algorithm as `ECC_NIST_EDWARDS25519` / `ED25519_SHA_512`, using RAW messages. This slice makes no KMS call and does not qualify that service. `kmsRawInput()` measures the unchanged bytes and rejects anything larger than 4,096. It does not hash, truncate, or transform the message. DIGEST/Ed25519ph is not a transparent replacement for the current signatures.

Alternatives requiring separate review:

| Alternative | Consequence |
| --- | --- |
| Isolated native Ed25519 signer | Preserves current message and verifier semantics; requires reviewed key custody, process isolation, backup, and recovery. Recommended for full contract support. |
| KMS RAW with a separately approved bounded input policy | Supports only a subset of currently valid evidence; explicit rejection and coverage consequences must be accepted before deployment. |
| Contract-defined canonical digest | Requires a new reviewed signing representation/version and verifier migration; not implemented. |
| Bounded attestation representation | Requires schema/version, completeness, and canonicalization review; not implemented. |

## Exact signing-byte study

Each number is `research-qualification-contracts.signingBytes(attestation).length`, after contract validation. The buffer includes `KRONOS_SIGNED_OBSERVATION_V1` and its newline, followed by canonical UTF-8 JSON. Tests compare exact buffers; these are measurements, not estimates.

| Attestation | Minimum fixture | Typical fixture | Maximum-field fixture | Worst tested | Profiles exceeding 4,096 |
| --- | ---: | ---: | ---: | ---: | --- |
| Provider | 2,388 | 2,772 | 10,186 | 67,455 | Maximum-field, worst |
| Runtime | 1,294 | 1,408 | 1,938 | 65,564 | Worst |
| Limited restore | 2,265 | 2,521 | 39,515 | 95,793 | Maximum-field, worst |
| Full restore | 2,451 | 2,707 | 39,791 | 95,793 | Maximum-field, worst |
| Independent full restore | 2,455 | 2,711 | 39,795 | 95,793 | Maximum-field, worst |

Maximum observed: **95,793 bytes**. All minimum and typical fixtures fit. The separate existing issuance-context signature input remains 91 bytes.

“Minimum” means the smallest constructed representative fixture, not a proven global lower bound. Typical fixtures represent the reviewed fictional qualification flow. Maximum-field fixtures use permitted 1,024-character ASCII object keys, 1,024-byte version IDs, 128-character labels, and 16 restore inputs where applicable. They exercise the contract's field limits, not proof that every combination originates from today's artifact builder. The large declared snapshot size is contract-valid; upstream chunking may impose tighter constraints.

Worst fixtures exercise allowed Unicode object keys, escaped version IDs, and unusually long numeric runtime-version strings, filling the canonical-character budget. These are adversarial contract-valid inputs, not realistic installed Node versions or a proof of the global byte maximum. The contract's 65,536-character ceiling is not a UTF-8 byte ceiling. The realistic maximum-field restore/provider cases already establish incompatibility without the adversarial runtime case.

## Offline durable issuance journal

New storage contract: `KRONOS_DURABLE_ISSUANCE_V1`. It stores existing signing requests, envelopes and receipts without changing their cryptographic semantics. Opening a database requires an explicit absolute path, store identity, environment/stream/software binding, independently approved registry hash pins, an operator authority, and an explicit initialize-new/open-existing mode. Existing opens require an external checkpoint.

SQLite uses DELETE journaling, synchronous EXTRA, integrity/schema checks, and BEGIN IMMEDIATE write transactions. Metadata, reservations, and events have UPDATE/DELETE rejection triggers. Events are canonical and hash chained with contiguous sequence numbers. Reservations contain unique request ID, request nonce, and approval nonce, bound to request/evidence hashes, signer, and approved request payload. Every read used for decisions takes a consistent transaction snapshot.

The reservation INSERT and RESERVED event COMMIT form the consumption boundary. A successful reservation permanently consumes identifiers even if signing subsequently fails. All mutating transitions revalidate the journal within one write transaction. SQLite excludes concurrent writers; it is not an exclusive process lifetime lock. Competing processes either see the consumed request or receive JOURNAL_BUSY; no automatic retry/signing loop is implemented.

Transitions are RESERVED -> ENVELOPE -> RECEIPT -> COMPLETED. Only externally signed, fully verified attestation and issuance-context signatures can become an ENVELOPE. Receipt creation derives exact binding fields internally; a caller cannot submit a successful receipt. Completion binds envelope and receipt hashes. Replay, altered evidence, duplicate request nonce and duplicate approval nonce are rejected after restart.

The new durable contract explicitly permits `exactResult(requestId)` for COMPLETED entries only. It returns a clone of the original envelope and receipt without any signing operation. Retrieval is an audit capability, not a fresh trust decision; qualification consumption must still run the lifecycle/freshness gate. Repeated reservation is always rejected, including for completed entries.

| Abrupt fresh-process exit boundary | Recovered state | Recovery policy |
| --- | --- | --- |
| Validated/accepted in memory, before durable write | ABSENT | No signing authorization was durably consumed. Original approval can be resubmitted; changed evidence cannot reuse it. |
| Reservation committed, before signing | RESERVED | Request and nonces remain consumed; no automatic signing retry. |
| Signing completed, before envelope commit | RESERVED | Signature may have been lost; fail closed, manual reconciliation required. |
| Envelope committed, before receipt | ENVELOPE | Verify stored signatures and current lifecycle before recording receipt. |
| Receipt committed, before completion | RECEIPT | Verify current lifecycle before completing exact issuance. |
| Completion committed | COMPLETED | Exact envelope/receipt retrieval only; re-reservation fails. |

Tests also abruptly exit with an uncommitted SQLite write, verify rollback on reopen, and race two child processes for the same reservation. Exactly one can consume it. This demonstrates process-crash behavior and transaction durability offline, not filesystem, hardware, power-loss, network-filesystem, or production-volume qualification. Before reservation COMMIT there is no durable claim of consumption; do not represent in-memory acceptance as issuance authorization.

A trusted directory and restrictive operational filesystem ACLs remain provisioning prerequisites. No production Node access to the future signer database is intended. SQLite triggers and local hash chains alone are not protection against an administrator replacing the entire database.

## Operator authorization and authentication

`KRONOS_OPERATOR_APPROVAL_V1` is separate from application authentication. LOGIN_PIN, ADMIN_PIN, browser sessions and API user privileges convey no signer authorization.

The exact allowlisted approval contains operator identity, ISSUE_ATTESTATION scope, domain, environment, stream, request ID/hash, evidence hash, signer ID, registry hash, run ID, issue/expiry times (at most five minutes), one-time approval nonce, approval hash, and audit reference. A separate pinned operator public key verifies its signature. Operator scopes and ACTIVE/REVOKED status are checked; operator key fingerprints must differ from every attestation signer key. Approval signing has its own versioned domain prefix. This new authorization format does not alter attestation signing bytes.

A valid request/evidence assessment **and** a valid external operator signature are both mandatory. Approval binds the exact reviewed evidence, not a generic permission to sign future content. Successful authorization yields a process-private WeakMap-backed grant; copying its public fields does not copy authority. Reservation revalidates that grant against current registry and time. Node-style callers can construct evidence/request data but cannot mint an approval, sign an envelope, or create trusted issuance by constructing matching JSON.

| Future authentication option | Assessment |
| --- | --- |
| Separate operator CLI with hardware-backed authentication/key custody | Recommended: explicit human review of canonical request/evidence hashes, isolated from application login and Node. Hardware algorithm support must be qualified separately. |
| AWS IAM / Identity Center | Useful workforce authentication and short sessions; requires separately reviewed federation/permission configuration and request-bound approval. IAM login alone is insufficient. |
| Private administrative service | Can centralize approval UI/audit but adds a privileged service, access control, availability and compromise surface. |
| Signed one-time approval artifact | Recommended transport/output of the isolated operator workflow; not by itself proof of how the operator authenticated. |

Recommendation: hardware-authenticated operator CLI produces the short-lived signed one-time artifact, delivered to an isolated issuance controller. An actual CLI, hardware enrollment, operator root distribution/revocation service, and login integration are not implemented here. Tests use pre-existing deterministic fixture keys only. Production Node receives neither private key nor an approval-signing endpoint it can authorize independently.

## Future KMS/IAM and key policy design

This is a policy design, not runnable provisioning and not approval to choose KMS despite the input-size mismatch. Native signer choice requires equivalent custody/isolation review. For a separately approved KMS subset, use exact key ARNs and separate domain principals; no wildcard signing resources.

| Principal | Proposed capability and resource | Mandatory boundary |
| --- | --- | --- |
| Isolated per-domain signer runtime | `kms:Sign` on its one approved key ARN | No key administration, grants, other domain keys, or Node-assumable role. Controller checks evidence plus external operator approval before each call. |
| Independent restore signer | `kms:Sign` on a distinct independent key ARN | Separate issuer/runtime trust; ordinary restore runtime cannot assume this role or access this key. |
| Public-key registry importer | `kms:GetPublicKey`, `kms:DescribeKey` on exact approved ARNs | Compare Ed25519 SPKI fingerprint against independently reviewed pin; record provenance and key metadata. No signing. |
| Operator authorization principal | Approval workflow only, separate hardware/operator key | No attestation-key signing permission; no journal/database administration. |
| Key lifecycle administrator | Reviewed exact-key `kms:DescribeKey`, `kms:EnableKey`, `kms:DisableKey`; policy change by controlled separate administration | No routine `kms:Sign` or `kms:CreateGrant`. PutKeyPolicy can escalate privilege and requires independent change review and organizational guardrails. |
| Production Node | Verified public registry and signatures only | No `kms:Sign`, key grants, key administration, signer-role assumption, operator private material, or signer DB access. No KMS access is required. |
| Break-glass administrator | Time-bound emergency disable/revoke; separately approved delayed deletion operations if ever necessary | Two-person approval, independent audit, no informal issuance bypass. Preserve public verification history. |

Key policy and identity policies must name exact approved principals and keys. Deny production Node signing/grant/administrative paths using enforceable organizational boundaries as well as absence of Allow. A policy-editing administrator can otherwise grant itself signing access; this residual power must be separately governed. Do not equate a role label with cryptographic separation.

Runtime role trust must match the isolated signer's exact workload subject and audience, never the production Render Node subject. Operator federation must use the approved workforce issuer, audience, and hardware-backed authentication policy. Do not authorize from caller-controlled session tags. Separate domain roles must not assume each other. Credential session duration should be bounded. Before provisioning, validate actual supported IAM condition keys and resulting effective policies; this document intentionally does not invent an algorithm condition key. Enforce RAW/algorithm choice in the controller and qualify any supported policy condition independently.

Creation/bootstrap actions, some of which require resource `*` before a key exists, belong in a separately reviewed one-time provisioning role. They are not granted to the signer runtime. No executable policy with placeholder resources is applied by this slice.

Rotation: independent approval of new public-key fingerprint/provenance and registry revision; activate only after verifying exact signature compatibility; retire the old signer with its cutoff; preserve public history. RETIRED allows only historically permitted issuance, never new issuance. Revocation: publish REVOKED in a new approved registry revision and independently witness it; disable the backend key where applicable. REVOKED denies historical consumption under the existing contract. Never resurrect or silently roll back a revoked registry.

Audit must bind operator ID/approval hash, request/evidence hashes, signer/key fingerprint, registry revision/hash, issued envelope/receipt hashes, event sequence, backend operation outcome, and independent witness acknowledgment. Preserve backend security logs separately. Never log credentials, tokens, private keys, headers, environment dumps, or raw provider errors. Reconciliation and break-glass actions require distinct reason/audit references.

## Durable registry and independent witness

Registry publication is an append-only REGISTRY event in the same durable chain. Only independently preapproved registry hashes are admitted. Existing registry validation enforces monotonic revisions, immutable key identity/history constraints, ACTIVE/RETIRED/REVOKED state, fingerprint, policy scopes, and expiry. Publication records a non-secret provenance reference. Public-key provenance itself must be verified by the independent registry approval process; a descriptive reference alone is not proof.

`KRONOS_ISSUANCE_CHECKPOINT_V1` binds store ID, global sequence/chain hash, registry revision/hash. Existing opens reject a database older than or divergent from an externally supplied minimum checkpoint. They allow an appended tail so an interrupted issuance can be recovered. Consumption requires an exact latest checkpoint, not an old prefix. Tests keep the checkpoint outside SQLite and prove rollback rejection against a copied old database.

**Later independent witness implementation:** separately administered append-only service/storage with a pinned verification key. It signs monotonically increasing checkpoints, rejects sequence rollback/forks, and retains lineage for recovery. The controller obtains a current authenticated checkpoint directly from that trust domain; Node/browser/database-provided values are not authoritative. After local reservation COMMIT, require witness acknowledgment before dispatching a signature. After completion and every registry publication, require acknowledgment before qualification consumption. Withhold issuance/qualification on witness unavailability or mismatch; never automatically reset its high-water mark from a restored local file.

Restore must compare the recovered chain against the witness's latest authenticated checkpoint, reconcile any acknowledged-but-missing transaction from independently durable history, and remain closed if it cannot. Unwitnessed tails require reconciliation, not silent signing retries. Witness storage and its key/admin credentials must not share the signer's database or administrative failure domain. Retention, recovery, audit, and two-person witness-root rotation are separate operational requirements.

This slice implements checkpoint validation and offline fixtures, **not a real witness service or authenticated checkpoint transport**. Passing `journal.checkpoint()` straight back is a fixture convenience, not operational rollback protection. Database ownership plus control of the witness/pins remains outside the defended trust boundary.

## Future V3 consumption gate

The new gate is offline and has no production/startup imports. It accepts only an actual journal handle, exact trusted checkpoint, configured operator authority, current binding, and completed request IDs. It rebuilds trusted qualification from verified current registry and completed issuance material every time. No cached “qualified” boolean or authority handle is exported.

Checks cover original attestation signature, context signature, receipt/envelope bindings, historically permitted signing time, current revocation status, approved registry revision and freshness, original operator approval, evidence expiry, environment/stream/policy/software revision, required restore coverage, and independent restore key/issuer separation. Partial scope stays partial. INITIAL and WEEKLY restore roles remain distinct; independent restoration is evaluated with the current restore component. All returned productionReady, automaticCollectionReady and productionOffDiskVerified values remain literal false, even for a fully qualified synthetic fixture.

The old production path is unchanged. Live V3 enforcement, operational signer availability, real operator authentication, and independent witness availability are not claimed.

## Verification and safety

Five focused suites cover exact byte size limits, operator approval and private grants, durable journal/crashes/concurrency, registry/witness/V3 lifecycle, and import/production boundaries. Existing signer, qualification, S3/retention, earlier research slices, prediction semantics, autonomous compatibility, discovery and audit checks must also pass before commit review.

Modules use allowlisted public structures and sanitized failure codes. Import does not open a database, create files, generate keys, read credentials, access network, or start timers. SQLite is loaded only at explicit journal open. No signer implementation or backend client is imported. Fixture signing uses existing fixed test keys, never newly generated operational keys.

Protected buildPrediction fingerprint: `72714872ed27c9c7d1ceac407a87e67d753afb9f6c7cec8f0051cc80631fb1bc`.

No commit, push, provisioning, AWS/KMS/STS/S3/Render access, environment changes, real attestations, production migration, inference, forecast calls, production scans or deployment is authorized by this implementation. Production readiness, automatic collection and OFF_DISK_VERIFIED remain unchanged and false. Production state is not queried by these offline checks.
