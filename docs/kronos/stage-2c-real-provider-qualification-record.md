# Trusted real-provider qualification records (offline implementation)

## Scope and compatibility

Base: 5f03eaf6cd57ae31af31bec8a76ffa6f4c165252.
This change adds internal offline verification and record construction only.
No existing adapter, V2 record, service startup, UI, API, production data, or
readiness behavior changes. No signing key, AWS call, or automatic issuance is
installed. Old V2 records retain their existing validation and permanently
untrusted status; they are not upgraded by relabeling or rehashing.

New contracts:
- KRONOS_PROVIDER_ATTESTATION_V1 / REAL_PROVIDER_ATTESTATION
- KRONOS_RUNTIME_QUALIFICATION_V1 / REAL_RUNTIME_ATTESTATION
- KRONOS_RESTORE_ATTESTATION_V1 / REAL_RESTORE_DRILL_ATTESTATION
- KRONOS_PROVIDER_QUALIFICATION_V3
- KRONOS_QUALIFICATION_POLICY_V1
- SIMULATED_TEST_ATTESTATION is a separate, non-authoritative test envelope.

V3 is necessary because V2 does not bind all domain attestations, exact coverage,
issuer authority, revisions, or partial qualification states.

## Root cause

The S3 helper collectQualificationEvidence marks its observations simulated,
even when a real transport is used. Its qualificationRecord requires simulated
runtime/restore inputs and returns simulated, non-runtime-qualified results.
The runtime/restore inputs there are caller hash envelopes, not authenticated
measurements. V2 qualificationStatus explicitly has no trusted authority and
returns trusted=false. The health drill validator checks consistency and
freshness but not an issuer. isQualifiedRealProvider always returns false.
A WeakSet inside the old adapter is useful process provenance, but cannot
authenticate external or historical runtime/restore observations.

## Authority and threat boundary

createQualificationAuthority is an explicit internal server/operator composition
root. Its pinned issuer registry and expected binding MUST come from separately
approved server configuration, never an HTTP payload, UI field, untrusted
transcript, or attestation. There is no default registry and no production
registration in this change. There is deliberately no signer or private key in
application code.

Trust is authenticated operator/collector observation, not a claim that a hash
proves reality. Each approved domain issuer must review or collect real results
and sign the exact canonical attestation with its protected Ed25519 key. A
provider issuer cannot sign runtime or restore evidence. The verifier enforces
the configured domain and public key, a domain-separated signing message,
strict schemas, semantic consistency, current bindings, and freshness. The
signing bytes are:
  KRONOS_SIGNED_OBSERVATION_V1 + newline + canonicalized attestation
Evidence hash covers observations; attestation hash covers the entire body
including kind, run, binding and times; the signature authenticates that body.

This model trusts the approved attester's measurements and key custody. It does
not magically verify that an operator's signed filesystem observation happened.
Someone controlling a pinned private key, server trust configuration, or the
Node process is inside the trust boundary. A caller can create its own isolated
authority with its own keys, but its handles and records are foreign to the
configured authority and cannot qualify anything there. Test signing keys live
only in scripts/fixtures and are fictional, fixed seed keys; they must never be
registered in an operational authority.

accept verifies signed envelopes and returns deeply frozen, privately registered
attestation handles. build requires those exact handles. Caller-created,
rehashed, copied, modified, simulated or foreign handles fail. Final records have
private per-authority provenance as well as a hash binding every component,
authority fingerprint, policy, run and binding. verify requires an explicit,
current binding; omitting it fails closed. The host must supply current deployed
Node/SQLite/runtime/deployment/adapter/software/storage-policy identity.

Serialized records are inspectable evidence, not portable authority. A copied
record is untrusted. Across process restarts, reauthenticate the signed evidence
against the pinned registry and current binding, then issue a new record. There
is no public endpoint and no automatic lifecycle hook.

## Evidence and coverage

Provider evidence binds the exact bucket, owner, region, environment, stream,
conditional creation, encryption, retention requirement and observation,
VersionId, artifact hash, size, logical identity, exact readback, clean history,
and no-write idempotent reuse. ETag is not used as an integrity hash.

Runtime evidence is a separate signed observation of Node and SQLite versions,
SQLite/backup support, persistent storage, filesystem write, writer lock,
fsync, atomic rename, one writer process, free space and headroom. Missing or
failed checks are rejected. Historical Phase 4 alone did not measure this full
runtime profile; it must not be promoted into a passing runtime attestation.

Restore evidence binds pinned remote inputs, matching expected/actual state
hashes and counts, source removal, remote-only retrieval, no cache fallback,
relationships, provenance, start/end times and exercise kind. Exact coverage is
derived from positive expected/actual counts plus per-class evidence hashes.
There is no accepted caller coverage list. A signed scope digest with zero
records cannot expand coverage.

The fictionalized Phase-4 fixture has one transaction, one audit, one linked
outbox and zero forecasts/corrections/outcomes. It yields:
- providerState: S3_MECHANICS_QUALIFIED
- restoreState: REMOTE_RESTORE_PARTIAL
- state: PARTIALLY_QUALIFIED
- storageState: INCOMPLETE
- coverage: transaction, audit, outbox
- missingCoverage: forecast, correction, outcome

FULL_STORAGE_QUALIFIED requires a valid provider, runtime, current initial or
weekly drill, an initial drill reference, all six restore scopes, and an
independent full-scope drill signed by a different issuer with a different key.
These are evidence qualifications for the bound context, NOT production
activation. Missing components remain explicit reasons. A limited drill is
never full coverage. Mixed run IDs or incompatible bindings are rejected;
restore inputs must include the exact provider-observed immutable input.
One authority is scoped to one qualification campaign/run binding. A new
campaign reattests/reverifies rather than combining unrelated runs.

## Freshness

Provider maximum: 30 days, additionally limited by the observed retention end.
Runtime maximum: 24 hours. Normal restore: at most 8 days from completion,
weekly due at 7 days. Independent exercise: at most 92 days from completion.
Initial evidence in this conservative first implementation also must remain
fresh (8 days), even when accompanied by a weekly drill. Renew the initial
baseline evidence rather than relying on an expired initial handle.
Future observations, stale handles and expired qualifications fail. Qualification
expiry is the earliest component expiry or retention end. Every domain binds
software, deployment, runtime, Node, SQLite, adapter and storage/retention policy
revisions; changes require matching fresh evidence and a new record.
Caller labels or extending an unsigned date cannot refresh trust.

## Secret exclusion

All observation objects have exact allowlisted fields, including nested
structures. No SDK object, arbitrary metadata bag, private key, credential,
Authorization header, cookie, environment dump or local path is accepted.
Canonical evidence safety checks plus credential/JWT/signed-URL pattern checks
apply to allowed string values. Issuer public keys are configuration only;
signatures and key IDs authenticate envelopes and contain no AWS secret.

## Production gates remain closed

Neither QUALIFIED nor a V3 record registers an adapter with the existing health
gate. isQualifiedRealProvider still returns false. Production startup never
loads these modules. All V3 records and verification results explicitly keep
productionReady, automaticCollectionReady and productionOffDiskVerified false.

Future production activation needs separate approved integration: runtime
measurement/attestation, full real restore coverage, initial/weekly/independent
drills, migration and production configuration approval, healthy primary and
portable storage, current backups/checkpoints, no integrity conflict, disk
headroom, production-specific pinned evidence and retention policy. No production
AAPL research is made OFF_DISK_VERIFIED by qualification-only observations.

## Operational next steps (not performed)

After review, commit/merge and separately approved deployment:
1. Establish an approved, protected domain signer registry through a separate
   operator/server configuration task. Do not trust key IDs/public keys supplied
   inside evidence or use test keys.
2. Assemble strict allowlisted observations from retained real evidence. Have
   the approved issuers verify and sign them; do not fabricate simulated=true.
3. Obtain missing runtime observations and any expired/revision-mismatched
   evidence. The one-day retained artifact cannot provide perpetual freshness.
4. Accept envelopes, build V3, verify with the current binding. The existing
   limited restore remains partial with forecast/correction/outcome gaps.
5. Complete full coverage/independent exercises and separate production gates
   before any activation. No code here activates backup, migration or collection.

Existing raw Phase-4 result JSON is not a signed attestation and cannot simply
be passed to accept. Metadata review and signing are explicit authority actions.
All testing in this implementation uses fictional signed evidence only.

## Validation

Four focused offline suites cover contracts, authentication/provenance, partial
coverage/freshness/state transitions, import purity and readiness boundaries.
Network/credential guards assert zero external network attempts and credential
file access. Benchmarks measure build, verify and coverage evaluation over 200
iterations; these are local fixture timings, not production estimates.
The previous S3/slice suites, discovery (24 contracts plus provenance), prediction
boundary, audit, syntax and diff checks are required before review.
