# Stage 2C native signer offline Slice B

Implementation review only. This slice is deliberately uncommitted. Base is
`12118d8f4302c25cbac578045fcfda7cbeaafc40`, the merged Witness Slice A.

## Scope and trust boundary

Two isolated modules implement an offline Ed25519 signer and its witness-proof
reader. There is no endpoint, daemon, production startup import, network transport,
credential provider, provisioning operation, operational key loader or real key.
Deterministic fictional keys exist only in test fixtures. The fake independent
vault is not an operational retained vault. Local-process ownership is not
cross-host fencing. No real witness key or witness service exists.

The constructor and injected operator authority, pinned registry, witness identity,
public keys, clock and adapter are trusted configuration. The untrusted issuance
API accepts exactly request, attestation and signed operator approval. Node/browser
login alone grants no authority. This in-process fixture does not claim memory or
OS isolation from an administrator who controls the constructor or the process.
Production isolation requires the separately reviewed service architecture.

## Key custody and exact bytes

`createFixtureKeyProvider` requires `testOnly: true` and existing native private
Ed25519 KeyObjects. It derives the public key and verifies the configured public
fingerprint. A module-private WeakMap retains the handles. Public methods expose
only cloned public identities, byte/call metrics and close; no sign or export
method exists. No private serialization or operational generation is implemented.
Missing/unavailable/malformed keys, wrong fingerprints, wrong domains and reused
keys fail closed without fallback.

Domains retain the existing wire spelling: provider, runtime, restore and
`independent-restore` (the requested independent_restore domain). Independent
restore requires a different signer, fingerprint and issuer. Operator, signer and
witness keys are separate. Signer lifecycle and service/software/environment/
stream/policy scopes use the unchanged contracts.

The native signer passes the unchanged V3 `signingBytes(attestation)` Buffer to
Ed25519 with algorithm null. It also signs the unchanged issuance-context bytes.
It does not digest-sign the V3 input, truncate it, alter canonicalization or impose
the KMS 4096-byte limit. Tests cover typical/maximum provider, typical/maximum full
restore, runtime, independent restore and the preflight worst case of 95,793 bytes.
Both signatures must verify against the pinned public key before envelope storage.

## Durable issuance and witnessed completion

1. Validate exact request/evidence and independent operator approval.
2. Validate the selected internal key and registry/domain binding.
3. Use the unchanged `KRONOS_DURABLE_ISSUANCE_V1` journal to atomically reserve
   request ID, request nonce and approval nonce, with all original bindings.
4. Publish the reservation to the offline witness. Verify its signed acknowledgment,
   immutable vault receipt, complete contiguous history and fresh challenged view.
5. Persist PRE_SIGN_ACK and then SIGN_ATTEMPT in an immutable control ledger.
   Recheck current authorization, key availability and witness before native signing.
6. Verify and persist the exact existing envelope and receipt contracts.
7. Durably record the exact prospective COMPLETED event as COMPLETION_INTENT.
   Publish envelope, receipt and this exact event to the witness. Verify the final
   acknowledgment and fresh view, then persist FINAL_ACK.
8. Commit the identical COMPLETED event in the original journal, verify its hash,
   persist RELEASED and only then return the usable result.

This ordering preserves final witness acknowledgment before local completion
without changing the original journal schema. The control ledger uses the existing
explicit local SQLite disk implementation and owns the signer journal for the
controller lifetime. Its fixed sibling name prevents choosing a second lock name.
Public records contain proofs and hashes only, not keys or unnecessary paths.

The result wrapper `KRONOS_NATIVE_SIGNER_RESULT_V1` binds the original envelope,
receipt, approval hash, pre-sign and completion acknowledgments. Existing envelope,
receipt, approval, journal and witness versions are unchanged. Every result is
explicitly simulated; automaticCollectionReady and offDiskVerified are literal false.

## Recovery and rollback

Eleven fresh-process interruption tests cover validated, reserved, pre-sign witness,
before-sign marker, signed but unpersisted, envelope, receipt, completion intent,
final witness, completion and returned states. The six inherited witness crash
boundaries remain tested independently.

A RESERVED request is never automatically signed again, even when the process
might have stopped before signing. A new request is blocked while any issuance
is unresolved. No abandonment or reconciliation authorization workflow is invented
in this slice. Explicit recovery with a public operator reference can finish an
already persisted, verified envelope without access to a signing operation. It
cannot sign or clear an ambiguous reservation. This reference is an audit label,
not a replacement for operational recovery authorization; no recovery endpoint exists.

Witness history may lead the local journal by exactly one completion event only
when the matching durable intent exists and RELEASED does not. Every other rollback,
fork, missing acknowledgment or prefix mismatch is rejected. Completed retrieval
requires the exact original candidate, public source records, pinned witness history,
fresh view and result hash, and never signs again. Altered replay is rejected.

Incomplete control-ledger append/completion pairs fail closed and require a future
explicit repair procedure; this slice does not automatically repair them. Dead
ownership locks require existing explicit owner-ID/PID recovery. Active writers are
rejected. No cross-host fencing or hardware custody claim is made. The proof reader
bounds history at 10,000 witness entries; pagination and registry rotation handling
are deferred. Registry drift requires reconciliation rather than automatic adoption.

## Validation and safety

Five native suites cover keys/large bytes, authorization, witness failures, recovery
and boundaries. They run with external-network guards, alongside the 46 existing
witness/preflight/signer/qualification/S3/research suites. Boundary allowlists admit
only the two new isolated modules. Existing production code, crypto contracts,
SQLite journal/witness implementation, dependencies and lockfile stay unchanged.

Offline npm audit uses cached/local advisory information only; it is not a fresh
advisory lookup. No real keys, AWS/STS/S3/KMS operations, credentials, Render changes,
production data changes, deployment, inference or scans are involved.
`OFF_DISK_VERIFIED` and automatic collection readiness remain false.

Next proposed slice: offline signer/witness integration hardening and operator CLI,
including operational recovery authorization, bounded history retrieval and explicit
publication repair. No provisioning or production integration is included here.
