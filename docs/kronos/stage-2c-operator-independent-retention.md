# Stage 2C: operator-decision independent retention (offline)

Implementation review candidate, 2026-09-21. **Uncommitted. No provisioning.**
Base: `17addc9fa3b606b84e6ca7aac2ea9922e19f0b80`.
Branch: `codex/kronos-operator-independent-retention`.

The provisioning-readiness review was committed as `17addc9fa3b606b84e6ca7aac2ea9922e19f0b80`
with message `Document Kronos provisioning readiness`, pushed normally, and
fast-forward merged after fetching and confirming the approved base
`c97a9fefe488cb3c3cf6babba4b23363574df895`. Local main and origin/main were equal and
clean before this implementation branch was created.

## Scope and trust claim

This slice makes independent retention mandatory for the **offline native signer**.
A valid operator approval signature alone no longer authorizes issuance. Both
APPROVED and DENIED decisions are published to a separate operator witness lane,
read back exactly from the existing fake retained-vault implementation, and
acknowledged under the pinned witness key before the controller releases success.
The operator ledger then records an immutable retained-completion marker. Status
counts a signed decision lacking that marker as recovery required.

This closes the decision-retention gap in the tested offline model. It does not
establish operational independent retention. The fixture vault is a separate store
and, in process tests, a separate process; it has no real retained-provider service,
independent administration or provider-signed anchor. Its hash receipt is enclosed
by the witness signature. A hostile witness and hostile vault together are not
made trustworthy by this signature. Real vault qualification and independent
external head authentication remain mandatory provisioning gates.

The existing witness disk, immutable vault append/read interface, strict
canonicalization, SHA-256, plain Ed25519, five-minute view policy and explicitly
signed writer-transition semantics are reused. There is no third trust service.
The operator lane uses separate disk/vault namespaces and contracts, never a
signer reservation, completion, registry or restore-evidence lane.

## Contracts and exact bindings

New identifiers:

- `KRONOS_OPERATOR_RETENTION_DOMAIN_V1`
- `KRONOS_OPERATOR_RETENTION_TRANSITION_V1`
- `KRONOS_OPERATOR_RETENTION_APPEND_V1`
- `KRONOS_OPERATOR_RETENTION_RECEIPT_V1`
- `KRONOS_OPERATOR_RETENTION_ACK_V1`
- `KRONOS_OPERATOR_RETENTION_VIEW_V1`
- `KRONOS_OPERATOR_RETENTION_PROOF_V1`
- `KRONOS_OPERATOR_RETENTION_STORE_V1`
- `KRONOS_OPERATOR_CONSUMPTION_V1`
- `KRONOS_OPERATOR_RESEARCH_CONTEXT_V2`

Changed offline result/control/public-proof versions:
`KRONOS_NATIVE_SIGNER_RESULT_V2`, `KRONOS_NATIVE_SIGNER_CONTROL_V2`,
`KRONOS_OFFLINE_PUBLIC_PROOF_V2`. Original attestation, approval and signed
operator-decision bytes retain their existing versions. No production research
schema or cryptographic algorithm was changed.

Each append binds the explicit retention domain, logical operator-ledger identity,
writer store/epoch, environment/stream, monotonic sequence, predecessor append
hash, operator key fingerprint and full signed decision record. That record binds
operator ID, exact request ID/hash, evidence/attestation hashes, review hash,
APPROVED or DENIED, bounded reason, approval/decision hashes, nonce and timestamp,
attestation domain, signer ID, registry hash/revision, software/policy revisions,
evidence time, coverage and research context. The witness receipt additionally
binds acceptedAt, exact append hash and predecessor receipt hash. A transition is
an explicitly typed alternative, not an unsigned change to configuration.
It composes the existing signed writer transition with a separately operator-signed
retention-domain wrapper binding ledger/environment/stream. A bare signer-writer
transition cannot be replayed into the operator lane; both signatures are verified.

Decision sequence and witness receipt sequence are identical within this separate
lane; transition entries also consume sequence positions. Sequence begins at one.
No gaps, reordering, future jumps or predecessor substitution are permitted.
Exact duplicate reconciliation returns the already-retained entry; it does not
create a second sequence slot. Competing continuations freeze that witness
instance. Restart does not erase the retained winning slot or make the conflicting
continuation acceptable. No client selects a winner from its own local database.

Operator request IDs and decision nonces are unique across all retained epochs.
There is no supersede/delete operation for a retained decision. Logical ledger
identity remains fixed when a separately approved writer transition changes the
physical writer-store identity and advances its epoch by exactly one.

## Release and consumption flow

1. The authenticated operator inspects the exact request and research context.
2. Fresh signer history and operator-retention history are verified; remote
   decisions absent from the local operator ledger cause rollback refusal.
3. The existing deliberate approval/denial confirmation and TOCTOU checks run.
4. A local immutable signing-attempt reservation precedes operator signatures.
5. The operator signs the approval (when approving) and exact decision; the
   decision transaction commits locally.
6. The retained client constructs the exact next operator append or reconciles
   the identical retained append if a previous response was lost.
7. The witness checks signatures, scope, request/nonce uniqueness, time, sequence,
   predecessor and active writer epoch, then durably commits locally.
8. The separate vault accepts immutable evidence. The witness reads back the exact
   entry/receipt chain and checks the retained head before completing locally.
9. The witness signs a domain-separated acknowledgment. The operator independently
   validates it and rechecks the fresh retained history.
10. The operator writes an immutable completion marker. Only then does the controller
    return the decision as usable. Denials follow the same path.
11. The native signer requires an opaque configured retention gate, exact matching
    pinned configuration, a fresh challenge-bound proof and an APPROVED record for
    the exact candidate and approval. It checks again immediately before signing.
12. The signer signs `KRONOS_OPERATOR_CONSUMPTION_V1` under its own role key, binding
    candidate hash, decision hash, retained proof hash, challenge, consumption time,
    signer ID and key fingerprint. This is persisted in the native control journal.
    The original observation/context signature pair remains unchanged; the new
    consumption companion adds one signature, for three total.
13. The prior native pre-sign/completion witness protocol still gates result release.

A raw signature, caller-created gate object, wrong gate configuration, DENIED
record, missing receipt, stale view, changed research context or old writer epoch
cannot authorize issuance. The gate is a trusted composition dependency, not a CLI
argument or deserializable authority. Production imports none of these capabilities.

## Crash recovery and rollback

| Boundary | Recovery behavior |
| --- | --- |
| Before local decision commit | A committed signing attempt without a decision is ambiguous; refuse another signature. No inference from whether a CLI response appeared. |
| After local decision commit, before append | Publish the exact saved signed decision; do not regenerate its nonce/signature. |
| After witness commit, before vault publication | Explicit publication recovery checks exact local intent/retained predecessor and publishes only that entry. |
| After vault publication, before witness completion | Exact readback/reconciliation; complete the same local entry. |
| After witness acknowledgment, before operator marker | Reconcile the already-retained decision and write the same marker. |
| After operator marker, before response | Return the identical persisted decision without signing or appending another entry. |

Recovery after a dead fixture process uses the existing explicit ownership-recovery
operation; startup never steals a live lock. The fixture proves local-process
ownership and signed epoch semantics, **not real cross-host fencing**.

Operator-only rollback is detected because every retained decision must still be
present locally with exact bytes. Witness-only rollback is detected against vault
sequence/readback. Mutually consistent operator+witness rollback is rejected
against the independent fixture vault. A rollback cannot resurrect a witnessed
DENY or change a witnessed APPROVE. Recovery does not silently rebuild authority
from an older local snapshot; it freezes and requires an explicit recovery plan.

A denied/approved decision cannot change after a lost response. A lost vault
response can leave the witness frozen with one incomplete local publication;
explicit recovery reconciles the exact remote entry before normal proofs resume.
Exact append reconciliation is idempotent, not permission for a second decision.

Only completed decisions are independently retained in this slice. The earlier
local pre-decision signing attempt is still local until a signed decision reaches
the witness. This follows the authorized decision-first flow; it does not claim
rollback-proof global pre-sign operator-attempt tombstones. If operational policy
requires those attempts independently retained before any operator signature, a
separate versioned attempt protocol is still needed. An ambiguous local attempt is
never automatically retried by this implementation.

## Freshness, fencing and proof

Fresh views carry an unpredictable caller challenge, exact logical ledger, active
writer/epoch, checkpoint, sequence and retained vault-head hash. Expiry remains
exclusive at five minutes. Full replay verifies continuity and uniqueness; a signed
view below the decision or inconsistent with replay is rejected. Old writer
approvals cannot start a new consumption after a retained epoch transition.
Historical completed results remain historical evidence, not a new authorization.

The signed consumption companion proves which retained decision/research context
the signer attested to consuming, valid at consumption and at observation signing.
Networkless verification checks the operator signature, complete retained history,
witness signatures, exact vault receipts/readback hashes and signer consumption
signature under independently supplied public configuration. It needs no private
key or source database. Public proof tests delete the source stores first.

Default public verification requires V2 retention. V1 parsing is available only
through an explicit trusted-constructor `allowHistoricalV1: true` option; output
reports `operatorRetentionVerified: false`. It cannot supply the native signer
with an opaque retained gate. This avoids silently treating historical approval-only
proofs as new retained authorization.

This proves fixture-relative history as of the bound consumption/view. It is not
a real vault receipt, a globally current view without an independently supplied
challenge, or evidence that clock/host/provider trust has been qualified.

## Research provenance and secret exclusion

The original four-field research context remains readable and strictly validated.
The explicit optional V2 context adds modelIdentifier, runtimeRevision and
forecastTimestamp, alongside modelRevision, forecastContractVersion,
researchContractVersion and inputCutoff. Inapplicable fields must be explicitly
null. Forecast time cannot exceed evidence observation time; cutoff cannot exceed
forecast time; an applicable runtime revision must match the attestation binding.
The exact context is bound by review hash, operator decision
signature, witness append/receipt and signer consumption proof. Tampering any
field after review invalidates those bindings. No shadow collection or scientific
study machinery is introduced.

Strict schemas reject extra fields. Credential/JWT/URL/path filters remain in
place. Validated public Ed25519 PEMs/signatures and enumerated public registry
deployment scopes are normalized only for secret scanning; their original bytes
remain cryptographically validated and bound. Private keys, AWS credentials,
session/OIDC tokens, Authorization headers, application PINs/service token,
cookies, environment dumps and unnecessary paths are rejected/excluded. Imports
perform no file/DB creation, key generation, timers, network or credential reads.

## Compatibility and operational limitations

- Operator ledger schema is explicitly version 2 because retained markers add a
  table. Existing V1 operator files are rejected, not silently upgraded. No
  operational migration is performed or authorized.
- Native control metadata/result format is V2. Historical V1 fixture files are not
  silently reopened as V2. Prior public V1 verification is explicitly historical.
- Retained proof replay is bounded to 10,000 entries and 16 MiB. Capacity planning,
  monitoring and a reviewed compaction/tombstone-continuity protocol remain necessary.
- Real retained vault, externally authenticated heads, operational cross-host
  fencing, hardware authentication, all role-key custody, time-source trust, mTLS,
  private networking, OS hardening, patching, encrypted backups, two-person recovery
  and live failure drills remain unproven mandatory gates from the readiness review.
- The local SQLite immutability checks are not protection against a host administrator.
  External retained history supplies rollback detection within the tested model.
- Production migration/full six-class live restoration, research metadata/analysis
  design, real model capacity and automatic scheduler implementation remain separate.
- All readiness remains false. No operational keys, hardware enrollment, AWS/STS/S3/KMS,
  Render, production, deployment, inference or scan action was performed.

## Validation and review scope

Focused matrix: contracts; approval; denial; operator/witness rollback; competing
forks; sequence/predecessor; signed epoch transition; four-process isolation; lost
operator/vault responses; six crash boundaries; dual rollback; freshness; signer
gate; networkless public proof; research provenance; secrets; import/production boundary.
There are 17 focused suites plus the prior 64 offline suites, for 81 total.
Final measured results and exact scope are recorded below after validation.

## Exact file inventory

- [docs/kronos/stage-2c-operator-independent-retention.md](../../docs/kronos/stage-2c-operator-independent-retention.md)
- [kronos/research-qualification-native-signer.js](../../kronos/research-qualification-native-signer.js)
- [kronos/research-qualification-operator-contracts.js](../../kronos/research-qualification-operator-contracts.js)
- [kronos/research-qualification-operator-control.js](../../kronos/research-qualification-operator-control.js)
- [kronos/research-qualification-operator-retention-contracts.js](../../kronos/research-qualification-operator-retention-contracts.js)
- [kronos/research-qualification-operator-retention-proof.js](../../kronos/research-qualification-operator-retention-proof.js)
- [kronos/research-qualification-operator-retention-witness.js](../../kronos/research-qualification-operator-retention-witness.js)
- [kronos/research-qualification-operator-retention.js](../../kronos/research-qualification-operator-retention.js)
- [kronos/research-qualification-operator-store.js](../../kronos/research-qualification-operator-store.js)
- [kronos/research-qualification-public-proof.js](../../kronos/research-qualification-public-proof.js)
- [package.json](../../package.json)
- [scripts/fixtures/kronos-integration-child.js](../../scripts/fixtures/kronos-integration-child.js)
- [scripts/fixtures/kronos-integration-processes.js](../../scripts/fixtures/kronos-integration-processes.js)
- [scripts/fixtures/kronos-native-evidence.js](../../scripts/fixtures/kronos-native-evidence.js)
- [scripts/fixtures/kronos-operator-child.js](../../scripts/fixtures/kronos-operator-child.js)
- [scripts/fixtures/kronos-operator-evidence.js](../../scripts/fixtures/kronos-operator-evidence.js)
- [scripts/fixtures/kronos-operator-retention-evidence.js](../../scripts/fixtures/kronos-operator-retention-evidence.js)
- [scripts/smoke-test-kronos-backup-boundary.js](../../scripts/smoke-test-kronos-backup-boundary.js)
- [scripts/smoke-test-kronos-integration-boundary.js](../../scripts/smoke-test-kronos-integration-boundary.js)
- [scripts/smoke-test-kronos-integration-proof.js](../../scripts/smoke-test-kronos-integration-proof.js)
- [scripts/smoke-test-kronos-native-authorization.js](../../scripts/smoke-test-kronos-native-authorization.js)
- [scripts/smoke-test-kronos-native-keys.js](../../scripts/smoke-test-kronos-native-keys.js)
- [scripts/smoke-test-kronos-native-witness.js](../../scripts/smoke-test-kronos-native-witness.js)
- [scripts/smoke-test-kronos-operator-authority.js](../../scripts/smoke-test-kronos-operator-authority.js)
- [scripts/smoke-test-kronos-operator-boundary.js](../../scripts/smoke-test-kronos-operator-boundary.js)
- [scripts/smoke-test-kronos-operator-commands.js](../../scripts/smoke-test-kronos-operator-commands.js)
- [scripts/smoke-test-kronos-operator-retention.js](../../scripts/smoke-test-kronos-operator-retention.js)
- [scripts/smoke-test-kronos-operator-toctou.js](../../scripts/smoke-test-kronos-operator-toctou.js)
- [scripts/smoke-test-kronos-preflight-boundary.js](../../scripts/smoke-test-kronos-preflight-boundary.js)
- [scripts/smoke-test-kronos-qualification-boundary.js](../../scripts/smoke-test-kronos-qualification-boundary.js)
- [scripts/smoke-test-kronos-research-storage-boundary.js](../../scripts/smoke-test-kronos-research-storage-boundary.js)
- [scripts/smoke-test-kronos-signer-boundary.js](../../scripts/smoke-test-kronos-signer-boundary.js)
- [scripts/smoke-test-kronos-witness-boundary.js](../../scripts/smoke-test-kronos-witness-boundary.js)
- [scripts/validate-kronos-offline-integration.js](../../scripts/validate-kronos-offline-integration.js)

## Exact file inventory

- [docs/kronos/stage-2c-operator-independent-retention.md](../../docs/kronos/stage-2c-operator-independent-retention.md)
- [kronos/research-qualification-native-signer.js](../../kronos/research-qualification-native-signer.js)
- [kronos/research-qualification-operator-contracts.js](../../kronos/research-qualification-operator-contracts.js)
- [kronos/research-qualification-operator-control.js](../../kronos/research-qualification-operator-control.js)
- [kronos/research-qualification-operator-retention-contracts.js](../../kronos/research-qualification-operator-retention-contracts.js)
- [kronos/research-qualification-operator-retention-proof.js](../../kronos/research-qualification-operator-retention-proof.js)
- [kronos/research-qualification-operator-retention-witness.js](../../kronos/research-qualification-operator-retention-witness.js)
- [kronos/research-qualification-operator-retention.js](../../kronos/research-qualification-operator-retention.js)
- [kronos/research-qualification-operator-store.js](../../kronos/research-qualification-operator-store.js)
- [kronos/research-qualification-public-proof.js](../../kronos/research-qualification-public-proof.js)
- [package.json](../../package.json)
- [scripts/fixtures/kronos-integration-child.js](../../scripts/fixtures/kronos-integration-child.js)
- [scripts/fixtures/kronos-integration-processes.js](../../scripts/fixtures/kronos-integration-processes.js)
- [scripts/fixtures/kronos-native-evidence.js](../../scripts/fixtures/kronos-native-evidence.js)
- [scripts/fixtures/kronos-operator-child.js](../../scripts/fixtures/kronos-operator-child.js)
- [scripts/fixtures/kronos-operator-evidence.js](../../scripts/fixtures/kronos-operator-evidence.js)
- [scripts/fixtures/kronos-operator-retention-evidence.js](../../scripts/fixtures/kronos-operator-retention-evidence.js)
- [scripts/smoke-test-kronos-backup-boundary.js](../../scripts/smoke-test-kronos-backup-boundary.js)
- [scripts/smoke-test-kronos-integration-boundary.js](../../scripts/smoke-test-kronos-integration-boundary.js)
- [scripts/smoke-test-kronos-integration-proof.js](../../scripts/smoke-test-kronos-integration-proof.js)
- [scripts/smoke-test-kronos-native-authorization.js](../../scripts/smoke-test-kronos-native-authorization.js)
- [scripts/smoke-test-kronos-native-keys.js](../../scripts/smoke-test-kronos-native-keys.js)
- [scripts/smoke-test-kronos-native-witness.js](../../scripts/smoke-test-kronos-native-witness.js)
- [scripts/smoke-test-kronos-operator-authority.js](../../scripts/smoke-test-kronos-operator-authority.js)
- [scripts/smoke-test-kronos-operator-boundary.js](../../scripts/smoke-test-kronos-operator-boundary.js)
- [scripts/smoke-test-kronos-operator-commands.js](../../scripts/smoke-test-kronos-operator-commands.js)
- [scripts/smoke-test-kronos-operator-proof.js](../../scripts/smoke-test-kronos-operator-proof.js)
- [scripts/smoke-test-kronos-operator-retention.js](../../scripts/smoke-test-kronos-operator-retention.js)
- [scripts/smoke-test-kronos-operator-toctou.js](../../scripts/smoke-test-kronos-operator-toctou.js)
- [scripts/smoke-test-kronos-preflight-boundary.js](../../scripts/smoke-test-kronos-preflight-boundary.js)
- [scripts/smoke-test-kronos-qualification-boundary.js](../../scripts/smoke-test-kronos-qualification-boundary.js)
- [scripts/smoke-test-kronos-research-storage-boundary.js](../../scripts/smoke-test-kronos-research-storage-boundary.js)
- [scripts/smoke-test-kronos-signer-boundary.js](../../scripts/smoke-test-kronos-signer-boundary.js)
- [scripts/smoke-test-kronos-witness-boundary.js](../../scripts/smoke-test-kronos-witness-boundary.js)
- [scripts/validate-kronos-offline-integration.js](../../scripts/validate-kronos-offline-integration.js)

## Final measured validation

| Check | Result |
| --- | --- |
| Focused retention suites | 17/17 PASS |
| Full offline matrix | 81/81 PASS (17 focused plus 64 prior suites) |
| Targeted hardening reruns | Contracts, epoch domain separation, lost-response status, moving-clock freshness and signer gate PASS |
| Discovery | 24/24 plus provenance PASS |
| Prediction semantics / autonomous compatibility | PASS / PASS |
| Cached offline npm audit | Zero reported vulnerabilities; no fresh advisory query |
| Whitespace, JavaScript syntax, package JSON | PASS |
| Dependencies, devDependencies, engines, lockfile | Unchanged |
| Production/Legacy/Render/feature flags/research schema | Unchanged |
| Implementation commit / push | Neither performed |

Protected buildPrediction SHA-256:
`72714872ed27c9c7d1ceac407a87e67d753afb9f6c7cec8f0051cc80631fb1bc`.

Final scope: **35 files, +931 / -65**, including this document.
All implementation changes remain unstaged and uncommitted. Local main and
origin/main remain at the approved review commit. The implementation branch is
intentionally dirty for review; no implementation was merged or pushed.

Provisioning, real attestation, automatic collection and production influence
remain NO-GO. Operational keys/hardware enrollment, real cloud calls, production
changes, deployment, inference and production scans are all zero for this slice.
