# Operational signer and trusted issuance: design and offline contracts

Base: cc740efb196b70de3c7ffefe371756653c64482d.
Branch: codex/kronos-operational-signer-design.
No operational signer, key, registry, authorization endpoint, durable issuance
service, real attestation or production integration is installed by this slice.

## Recommendation and boundary

Use an isolated, operator-only issuance controller with separate domain keys,
an independently administered pinned registry, and a durable append-only issuance
journal. Prefer KMS-backed Ed25519 keys where the exact existing signed message
fits KMS limits. The production Node service has neither private material nor
kms:Sign permission, and cannot assume the controller role. Its Render identity
must not be accepted as the controller identity. An operator-controlled offline
Ed25519 signer is the reviewed fallback for larger messages or unavailable KMS
support; do not silently substitute another algorithm.

Application/observer -> candidate canonical request + evidence -> operator review
-> isolated controller -> durable reservation -> external signer -> local public
verification -> durable receipt -> signed envelope -> pinned public verifier.

The application can describe observations. A request hash, operatorRef, service
identity string, an eligible assessment, or a valid schema does NOT authorize
signing. assess() always returns authorized:false. There is no sign() export,
signing callback, private-key loader, client or endpoint in application modules.
Future operator authorization and the actual signer remain separately approved work.

The external controller must independently validate the provenance of measured
evidence and the authenticated observer identity. For example, provider evidence
must come from the reviewed exact-version/configuration observations, runtime
claims from a controlled measurement procedure, and restore results from a witnessed
source-removed drill. Signed review approval binds the exact requestHash, evidence
hash, run, operator, allowed observer/service, intended key and five-minute window.
Do not authorize using a boolean or a serviceIdentity string supplied in JSON.

## Threat model and roots of trust

| Threat | Required control |
| --- | --- |
| Node self-signs arbitrary observations | No key or signing IAM authority in Node; registry administered outside Node; external verification |
| Browser or public API asks for a signature | No public signing API; restricted operator tool and separate authorization |
| One service impersonates another | Authenticated workload identity checked against request.serviceIdentity and per-key allowlist |
| Altered evidence, context or issuance timestamp | Existing attestation signature plus separately signed issuance context |
| Foreign environment/stream/revision | Exact current binding plus registry scope restrictions |
| Replay or duplicate mutation | Globally unique requestId and nonce, durable atomic reservation, terminal receipts |
| Mixed evidence/runs | Complete attestation/run/binding signed; existing V3 checks retained; independent pair checks same run |
| Stale registry or rollback | Pinned hash/revision; monotonic updates; registry/journal snapshots expire within 24 hours |
| Retired/revoked signer | Lifecycle enforced on every verification against current pinned snapshot |
| Stolen signing key and backdating | Independent pinned issuance journal; no acceptance of unrecorded envelopes; compromise revokes all key signatures |
| Signer leaks raw provider errors or secrets | Exact schemas, sanitized bounded errors, no freeform receipt fields |
| Untrusted caller supplies key/registry/journal | Only trusted composition-root configuration may supply pins or update trust |
| Compromised signer silently rewrites history | Preserve tombstones/immutable key identity, independent audit journal, explicit revocation and re-review |

Registry pins and journal pins are trust configuration, not evidence supplied
alongside a request. Their hashes prove integrity only AFTER an external
administrator has approved/pinned them. Creating another verifier with attacker
pins does not create authority in a correctly configured verifier. A compromised
Node process can lie about its own output; independently operated verification
and the external trust roots are necessary to detect that. No software running
inside a compromised process can promise otherwise.

The journal and registry administration must be separate from the signer private
key. A signer compromise alone cannot publish trusted new receipts or authorize
new pins. Compromise of both administrative roots is outside this model and
requires incident response, revocation and independently reviewed reconstruction.
Signatures authenticate attestations, not the physical truth of observations.

## Key material placement and alternatives

| Option | Extractability and identity | Audit / rotation | Availability / cost / complexity / blast radius |
| --- | --- | --- | --- |
| KMS asymmetric Ed25519 | Private material stays within KMS; controller-only IAM and workload federation; no production Sign role | KMS operation audit plus separate semantic issuance receipts; new asymmetric key and registry revision for rotation | Managed availability, metered key/request cost, IAM and ledger engineering; controller compromise permits misuse until revoked but not plaintext key export |
| Isolated private service with KMS/HSM | HSM/KMS keeps private material outside service; separate deployment, administrators and identity | Service decisions and device/KMS events both audited; staged public-key replacement | Hosting/device costs and patching/availability burden; isolation fails if production shares signer permissions or administrative secrets |
| Operator offline hardware key | Prefer non-extractable hardware supporting exact Ed25519; physical/operator authorization | Independently anchored receipts and explicit replacement/retirement | Low request volume suits manual operation; device/recovery costs, human availability, custody and loss risks |
| Operator offline software key | Extractable encrypted key on separately controlled offline host; never production | Same registry/journal rules, offline audit export | Lower service cost but greater exfiltration and backup-custody risk; requires hardened host and protected backups |

Private material is prohibited in application config, Render environment,
evidence, qualification records, logs, browser payloads, SQLite/JSON persistence,
or S3 research artifacts. Public SPKI keys, key IDs and SHA-256 public-key
fingerprints are metadata. No private-key copy between signers is a rotation.

### KMS compatibility research

Checked public AWS documentation on 2026-09-20; no authenticated AWS API call.
AWS documents ECC_NIST_EDWARDS25519 and ED25519_SHA_512 with MessageType RAW.
This is the pure Ed25519 path appropriate to the current Node crypto.verify(null)
contract. ED25519_PH_SHA_512 / DIGEST is a different path and is NOT substituted.
[Key specifications](https://docs.aws.amazon.com/kms/latest/developerguide/symm-asymm-choose-key-spec.html)
and [Sign API](https://docs.aws.amazon.com/kms/latest/APIReference/API_Sign.html).

The Sign API accepts at most 4,096 message bytes. Existing V3 signs the full
domain-prefixed canonical attestation, whose contract can exceed that size.
A future KMS adapter MUST measure exact UTF-8 bytes and reject oversized input.
Do not prehash that legacy message or change MessageType to bypass the limit.
The fictional provider/runtime/restore/independent messages are respectively
2,772 / 1,408 / 2,521 / 2,711 bytes; these are fixtures, not operational limits.
The additional context message is 91 bytes. Larger legacy attestations require
the approved isolated/offline Ed25519 implementation or a separately reviewed
versioned signing-format change. Live region/account availability and byte-for-byte
KMS/Node interoperability remain future qualification gates.

AWS states asymmetric private material never leaves KMS unencrypted:
[Asymmetric keys](https://docs.aws.amazon.com/kms/latest/developerguide/symmetric-asymmetric.html).
Asymmetric keys require manual replacement rather than automatic key rotation:
[Rotation](https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html).
KMS audit records complement, but do not replace, semantic issuance receipts:
[Public-key operations](https://docs.aws.amazon.com/kms/latest/developerguide/offline-public-key.html).
No prices, account permissions or operational availability were assumed.

## Versioned contracts

- KRONOS_SIGNER_REGISTRY_V1: registry ID/revision/hash, bounded freshness and
  domain-scoped signer records containing only public keys, JWK fingerprints,
  issuer, algorithm, lifecycle times/reason/replacement, allowed attestation
  types, environments, streams, observer identities and software/policy versions.
- KRONOS_ATTESTATION_SIGNING_REQUEST_V1: request ID, nonce, signer ID,
  attestation type/contract/hash, canonical evidence hash, complete binding,
  run, operator approval reference, service identity, registry pin, request time,
  expiry and requestHash. Exact fields only; expiry maximum five minutes.
- KRONOS_SIGNED_ATTESTATION_V1: complete attestation and request, signer,
  fingerprint, algorithm, original signature, signedAt, contextSignature and
  envelopeHash. No caller public key is accepted in an envelope.
- KRONOS_ISSUANCE_RECEIPT_V1: request ID/hash/nonce, attestation/evidence
  hashes and type, envelope hash, signer/fingerprint, issuedAt, ISSUED or REJECTED,
  normalized reason and receiptHash.
- KRONOS_ISSUANCE_JOURNAL_V1: pure bounded snapshot/transition specification;
  identity, monotonic revision/hash, freshness and append-only reservations/receipts.

Existing V2, V3 and the three existing attestation formats are unchanged.
Registry public-key fingerprints use the same SHA-256 hash of canonical public
JWK as the current authority. Exactly Ed25519 is permitted.

## Signing and verification bytes

Reuse the approved canonicalize() serialization and hashValue() SHA-256.
Existing attestation bytes remain:
  UTF8("KRONOS_SIGNED_OBSERVATION_V1\n" + canonicalize(attestation))

The new context signature is Ed25519 over:
  UTF8("KRONOS_ISSUANCE_CONTEXT_V1\n" + hashValue(envelopeBody))

envelopeBody includes version, full attestation, full canonical signing request,
signerId, keyFingerprint, algorithm, original signature and signedAt. It excludes
contextSignature and envelopeHash. envelopeHash covers body + contextSignature.
Thus a hash alone never qualifies: both signatures, the pinned key and a pinned
ISSUED receipt for the exact envelope are required. It takes two signing operations
in a future issuer, not one ambiguous signature over arbitrary JSON.

A request does not expire an already issued signature at five minutes. signedAt
must be within the request window, while verification applies attestation,
registry and journal freshness at the current time. Registry lifecycle and the
pinned external receipt prevent using a newly forged backdated envelope as history.

## Validation before signing

assess() reuses all current provider/runtime/restore schema, evidence/hash,
retention/encryption, VersionId, PASS, counts/state hash, source removal and
remote-only checks. It checks complete current binding, registry scopes,
observer identity, run, request hash, active signer and fresh evidence.
Independent restore must cover all six scopes. Missing required provider/runtime
measurements or failed drills are rejected. A narrow ordinary restore is valid
evidence of partial coverage, never evidence of full storage qualification.

Passing this pure function is only schema/policy eligibility. The external
controller must additionally authenticate the operator and observer, validate
review approval, and independently assess observed provenance before reservation
and signing. Neither a hash nor a signature proves the observation happened.

## Replay, durability and audit

The offline reserve()/complete() functions specify these transitions:
unused -> RESERVED -> terminal ISSUED or REJECTED. A reservation burns both
requestId and nonce, including identical replay. No identical-replay re-signing
or automatic retry after ambiguous signing is allowed. Recovery may deliver an
already durably recorded original envelope, but must not invoke signing again.
A partially completed two-signature attempt is burned and requires explicit
operator reconciliation and a new approved request.

These functions DO NOT implement durable storage, multi-process exclusion or
production authorization. Resetting an in-memory journal is NOT replay protection.
Before provisioning an issuer, implement and review atomic unique constraints
for requestId and nonce, compare-and-swap revisions, a durable commit before
either signature, fsync/transaction semantics, immutable receipt persistence and
crash recovery. The signer cannot reset the journal, erase old IDs or publish
its own trusted pins. Failed and reserved requests remain tombstones. The V1
snapshot is bounded to 10,000 entries; exhaustion fails closed. Safe sharding,
compaction or archival of nonce uniqueness requires separate review.

Receipts record all requested audit fields without arbitrary messages. Issued
receipt time equals signedAt, hashes match the request and envelope, and audit
history must be pinned through a separately controlled channel. Bad transport
payloads that cannot satisfy even the request identity schema get a sanitized
rejection in the future controller's intake audit; never persist the raw payload.
REJECTED receipts have a null envelope hash and a bounded reason code.

## Activation, retirement, revocation and rotation

No activation is performed. Future activation requires approved key provenance,
SPKI/fingerprint out-of-band verification, domain and workload scopes, operator
approval, and externally pinned registry revision. Four roles are distinct:
provider, runtime, restore, independent-restore. V1 requires unique key
fingerprints across all registry records. Independent pair verification also
requires distinct signer IDs AND issuer identities AND keys, plus the same run.

ACTIVE permits new eligible requests within notBefore/notAfter.
RETIRED forbids new signing; a previously issued signature before retiredAt
remains acceptable while its evidence and pinned metadata remain fresh.
A signer's later natural notAfter expiry does not erase legitimate history:
signedAt must have been within the key's validity interval.

REVOKED denies ALL signatures of that key in V1, including historical ones.
This explicit conservative policy applies to COMPROMISE, MISISSUANCE and
ADMINISTRATIVE reasons; routine rotation must use RETIRED instead. RevokedAt,
reason, replacement and registry revision are preserved. A compromised key must
not be able to backdate around revocation. Unaffected keys and their evidence
are not invalidated.

Rotation appends a separately approved new key/signer record, optionally with
an overlap window, then retires the old key and links replacementSignerId.
No silent signature migration, public-key substitution under an old ID, removal
of historical keys, resurrection or revision rollback is allowed. Old signer
scopes/constraints are immutable; changing them requires a new approved record/key.
Journal updates cannot remove reservations or alter completed receipts.

Every verify() uses the current pinned registry and journal, not a cached true
flag. Replacing trust is an explicit administrator-only composition operation,
never a browser route. Both snapshots expire within 24 hours; this bounds but
does not eliminate revocation propagation delay. Future issuance must refresh
authoritative pins before every operation and emergency revocation must invalidate
cached trust immediately. Initial pins/high-water marks must survive restarts
through the independently administered configuration channel.

## Integration and readiness limits

The new verifier is not wired to the existing V3 authority or production startup.
Do not strip the new envelope down to the legacy three-field envelope and then
treat a V3 result as having passed lifecycle checks. A future approved integration
must enforce current signer/journal verification on issuance AND on every use of
a qualification, bind its receipt/envelope and registry revision, and invalidate
cached qualifications on revocation. This slice deliberately does not change
persisted V3 semantics or claim that its old verifier learned revocation.

ProductionReady, automaticCollectionReady and productionOffDiskVerified remain
false. Neither the new verifier nor an eligible request enables production
storage, migration, collection or OFF_DISK_VERIFIED. No real provider record is
issued. Existing gates remain closed and the Legacy fingerprint is protected.

## Errors and provisioning gates

Bounded errors include SIGNER_UNAVAILABLE, SIGNER_UNAUTHORIZED, SIGNER_REVOKED,
SIGNER_RETIRED, SIGNER_EXPIRED, SIGNING_REQUEST_EXPIRED, SIGNING_REQUEST_REPLAY,
EVIDENCE_INVALID, POLICY_MISMATCH, DOMAIN_NOT_ALLOWED, ENVIRONMENT_NOT_ALLOWED,
STREAM_NOT_ALLOWED, SIGNATURE_INVALID, REGISTRY_MISMATCH and JOURNAL_MISMATCH.
Verifier results and eligibility errors normalize unexpected failures and never
return raw provider errors. No provider is called by this implementation.

This slice is ready for review as an offline contract/design foundation.
Commit/merge does not authorize provisioning. The next separately approved task
must review concrete controller identity/IAM, key custodian and recovery plan,
durable journal implementation, approval authentication, registry delivery and
rollback defense, KMS exact-byte interoperability/size policy, and the V3 lifecycle
integration described above. Provisioning is not equivalent to issuing evidence;
each real evidence/issuance operation still needs its own approved scope.

## Validation and safety

Three focused suites cover contracts/replay, lifecycle/pinned verification and
import/production isolation. Fixed fictional keys are test fixtures only; no
random or operational key generation is used. Existing trusted-qualification,
S3, prior slices, discovery, Legacy/prediction and compatibility checks are rerun.
No private signing material is loaded by the offline application modules.
Public documentation research and npm audit are the only non-Git external reads;
no authenticated AWS, STS, S3, KMS or Render operation is performed.
