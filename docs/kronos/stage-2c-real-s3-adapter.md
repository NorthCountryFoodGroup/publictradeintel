# Stage 2C real S3 adapter: code and offline tests

Base: `9eabf6a3968efc920387a86e9f13b7b3da7d7697`.
Branch: `codex/kronos-stage2c-real-s3-adapter`.
Worktree: `C:\Projects\publictradeintel-phase1`.

This is an unconnected implementation for later, separately authorized synthetic
qualification. No AWS account, bucket, credentials, metadata endpoint or S3 API was
accessed. No production startup wiring exists. Existing JSON remains authoritative.
Production durability, automatic storage readiness and runtime qualification remain
false. Neither importing the module nor constructing an injected adapter resolves
credentials. Default SDK construction is deferred until an explicit operation.

## Provider-neutral boundary

`kronos/research-backup-s3.js` implements `KRONOS_BACKUP_ADAPTER_V1` with
`providerType=s3`, `classification=REAL_UNQUALIFIED`, and an explicit
`REAL-PROVIDER-CAPABLE` implementation label. Capability declarations describe
implemented methods, not successful bucket qualification.

The V1 surface is capabilities, putImmutable, headExact, getExact,
describeRetention and listPrefix. Existing createAdapter/verifyExact produce
`KRONOS_REMOTE_RECEIPT_V1` after independent GET verification. ETag is opaque,
optional metadata; it is never treated as an integrity hash. Receipts retain
normalized context, hashed container reference, key/version, byte/hash identity,
upload/readback timestamps, original retention/encryption and software revision.
Raw SDK response objects, owner account ID and request IDs do not enter receipts.

`streamProvider` implements the approved V2 byte-source interface for file/chunk
transport and existing createIO/discovery/delivery. The one generic core change
allows REAL_UNQUALIFIED implementations alongside NON_PRODUCTION providers in
createIO. It adds no AWS-specific core structures and grants no readiness.
V2 receipts retain their existing V2 schema and literal productionDurability=false;
V1 and V2 records are not silently conflated. V1 buffered objects are capped at
16 MiB at this adapter; larger snapshots use the V2 file/chunk transport.

## Explicit configuration and credentials

Configuration has exactly: bucket, region, expectedBucketOwner, environmentId,
streamId, purpose, retentionPolicies, requestMs and softwareRevision. Unknown
fields (including credential fields) fail. This release accepts purpose
`qualification`, non-production environment IDs, and streams starting with
`qualification-`; production namespaces cannot be accidentally selected.

Retention requirements use the already-approved versioned contract. Their policy
hashes must be explicitly present in configuration. Evidence duration has no
seven-year default; snapshot requirements remain 30/90/400 days. Qualification
requirements are separate, fixture-only policy inputs. Expired historical evidence
is verified against its original requirement; new uploads with expired protection
fail. Real retention-policy approval remains a separate future gate.

The lazy S3Client uses standard Node credential discovery without a credentials
argument. It sets maxAttempts=1 and disables region redirects. There is no custom
endpoint, credential logger, environment reader or STS client in adapter code.
Standard SDK transitive credential providers remain installed but were not invoked.
Future Render OIDC availability, trust configuration and runtime suitability are
not established by these tests.

## Immutable publication and reconciliation

Before PUT, bounded ListObjectVersions inspects exact key history. Any delete
marker, non-latest/extra version or ambiguous identity fails. A new object uses
IfNoneMatch="*", validated ContentLength, SSE-S3 AES256, explicit COMPLIANCE expiry,
and SHA-256 checksum headers. The metadata stores the canonical descriptor and
original retention requirement, subject to S3's 2 KiB user-metadata budget.

A 412 response alone is not success. The adapter relists, pins the existing exact
version, verifies descriptor/context/size, retention, encryption and independently
streams/recomputes its SHA-256. Identical objects reconcile; differing identity or
bytes conflict. HTTP 409 does not count as a proved 412 condition. Successful new
PUTs also require exact-version readback before returning a candidate.

Checksums supplied to S3 are an additional transport signal. Independent local
GET hashing remains authoritative. ETags are never substituted for SHA-256.
There is no overwrite, deletion, multipart manager or retention-update operation.
Each existing 4 MiB snapshot chunk uses a streaming PutObject, so larger aggregate
snapshots do not require multipart upload or a giant Buffer/base64 envelope.

A delete-marker race between listing and PUT cannot be eliminated by a client-side
precheck. Post-write version inspection fails closed; future bucket IAM/policy must
prohibit deletion/overwrites. Ambiguous network outcomes still require reconciliation.
No live S3 consistency, policy or permission behavior has been claimed as verified.

## Exact reads, discovery and cancellation

All object HEAD, GET and retention calls pin VersionId and ExpectedBucketOwner.
Opaque versions are preserved without normalization. Required null/missing versions
fail. Metadata cannot establish OFF_DISK_VERIFIED; exact GET and recomputed hash/size
remain mandatory. Missing/wrong AES256 or insufficient retention fails.

ListObjectVersions is used rather than ListObjectsV2 because the latter hides
historical versions and delete markers. The mock covers every operation actually
used; no unused ListObjectsV2 method is introduced. Pages are capped at 1,000 rows,
public discovery cursors at 1,000 pages; exact-key inspection is at most four pages
of two rows. Cursors bind prefix and both version markers. Loops, backward keys,
duplicates, unexpected old versions and markers fail. Existing discovery imposes
its own aggregate history and expected-tail witness bounds.

Every SDK command receives abortSignal. Request scopes are bounded to configured
requestMs (maximum 60 seconds) and inherit core cancellation. GET bodies are
streamed in at most 128 KiB slices, independently hashed and destroyed on abort,
error or completion. Upload streams are also destroyed on cancellation. A late
SDK result is rejected; a late response body is destroyed. The SDK does not retry;
core delivery retains four attempts and its overall 60-second budget.

An external service may have accepted an aborted PUT; this does not authorize a
success acknowledgement. Subsequent reconciliation is required. Synchronous CPU
work cannot be interrupted mid-instruction; deadline assertions reject late results.

## Qualification evidence and limits

inspectCapabilities observes GetBucketVersioning, GetObjectLockConfiguration and
GetBucketEncryption and requires enabled versioning, Object Lock and SSE-S3.
collectQualificationEvidence additionally performs synthetic immutable creation,
a deliberate second conditional PUT that must receive 412, exact readback/hash,
retention checks and bounded listing. It returns a private-instance-branded observed
evidence object. Copies, caller-made booleans and claimed provider names cannot
substitute for that object.

qualificationRecord requires that observed evidence plus context/container-bound,
hashed runtime and restore fixture attestations. Missing attestations fail. This
release accepts only simulated attestations and labels every result SIMULATED,
productionQualified=false and runtimeQualified=false. Hashes are integrity checks,
not trusted signatures or proof that a live restore/runtime was qualified.

The generated KRONOS_PROVIDER_QUALIFICATION_V1 is credential-free, versioned and
hashed. Existing qualificationStatus remains untrusted; isQualifiedRealProvider
and isAutomaticCollectionStorageReady remain false. No environment boolean bypass
exists. Later live qualification requires a separately reviewed trusted evidence
issuer, actual runtime and restore drills, explicit policy approval and activation.
This code does not contain or claim those production approvals.

## Error and secret boundaries

AWS error name/status metadata is mapped to the existing nine bounded BACKUP_*
classes. Raw error text, SDK metadata, signed headers and credential details are
never forwarded. Authentication, permissions, version absence, Object Lock,
checksum, conflicts, timeout, throttling/5xx and unknown failures are covered.

Tests inject fake credential-shaped configuration, signed URLs and raw error
sentinels. Unknown config fields and unsafe portable metadata fail. Captured
normalized receipts, qualification/readiness outputs and errors omit those inputs.
The adapter logs nothing and does not serialize an SDK object.

## Dependency review

One exact direct dependency was added: @aws-sdk/client-s3 3.1136.0. A new lockfile v3
pins 26 installed packages (25 transitive), with integrity hashes. No unrelated
packages or engine constraints changed. The app still requires Node >=24.18.0 <25.
The SDK declares Node >=20. Standard credential-provider and nested-client packages
are SDK transitive dependencies, not separately added application clients.

npm audit reported zero vulnerabilities. Declared package licenses: Apache-2.0
(24), MIT (1), 0BSD (1). No license concern was identified in that inventory; this
is not an independent legal/security audit. Installation used --ignore-scripts.
Registry/package-audit access was authorized; it was not an AWS API connection.

## Validation and interpretation

Four new focused suites cover contracts, qualification, streaming and boundaries.
Their guard blocks HTTP/HTTPS, sockets/TLS, UDP, DNS and fetch, and rejects known
credential/token file paths, including promise-based reads. Commands use an injected
mock transport; no real S3Client credential chain is invoked. Tests assert zero
external-network attempts and zero real credential-file accesses. Import tests also
fail if the SDK loads during adapter module evaluation.

A 9 MiB file was streamed through three S3 mock chunks, maximum upload chunk
131,072 bytes, then exactly reconstructed after deleting its source. Existing
136 MiB transport and 1,001-forecast remote-discovery fixtures are rerun separately.
These are deterministic software checks, not S3 durability or capacity estimates.

Official API references used for implementation review:
- https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html
- https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectVersions.html
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html

No commit, push, deployment, production migration, Render/environment changes,
production data access, model inference, real forecast call or prediction scan was
performed. Review must precede commit. Manual AWS setup remains separately authorized.

## Final offline results

- New adapter suites: 4/4 passed (contracts, qualification, streaming, boundary).
- Compatibility suites: 7/7 passed.
- Prior Slice suites: 17/17 passed (3 Slice 1, 4 Slice 2A, 5 Slice 2B, 5 offline 2C).
- Approved offline regressions: 12/12 passed (Kronos shadow/security/UI/raw-normalized/
  provenance/worker lifecycle; Trade Brief selection/consistency/V2/Phase 3;
  prediction semantics; autonomous-decision compatibility).
- Discovery: 24/24 plus provenance passed.
- All 12 changed JavaScript files passed syntax checks; package and lockfile parsed.
- git diff --check and whitespace checks including new files passed.
- npm audit: zero vulnerabilities; no audit fix or unrelated upgrades performed.

The existing large discovery fixture retained 1,001 forecasts, 1,006 transactions
and 3,020 fake remote objects. Snapshot/tail restore used 3,021 GETs, 48,298,224 bytes
and 11 lists (35.876 seconds); genesis restore after snapshot expiry used 3,018 GETs,
40,620,135 bytes and 11 lists (53.232 seconds). Both restored the original state
hash with zero uploads. These run-specific times do not replace historical figures
in the prior slice document or represent production performance.

The 136 MiB binary fixture passed with 34 chunks, 68 GETs and a 128 KiB maximum
read buffer. The independent new S3 mock fixture passed 9 MiB / 3 chunks / 128 KiB
maximum upload chunks. No model regeneration occurred.

Protected buildPrediction fingerprint:
`72714872ed27c9c7d1ceac407a87e67d753afb9f6c7cec8f0051cc80631fb1bc`.

AWS API calls: 0. S3 network requests: 0. Real credentials resolved/read: 0.
Resources created: 0. A deliberate network-guard probe was rejected before any
request transmission; all injected adapter operations recorded zero external
network attempts. Public API documentation and npm registry/audit access only.
No production, Render, environment, inference, forecast or scan action occurred.
No commit, push or deployment occurred.

## Exact review inventory

- `.gitignore`
- `docs/kronos/stage-2c-real-s3-adapter.md`
- `kronos/research-backup-io.js`
- `kronos/research-backup-s3.js`
- `package-lock.json`
- `package.json`
- `scripts/fixtures/kronos-s3-mock.js`
- `scripts/fixtures/kronos-s3-network-guard.js`
- `scripts/smoke-test-kronos-backup-boundary.js`
- `scripts/smoke-test-kronos-research-portable-boundary.js`
- `scripts/smoke-test-kronos-research-storage-boundary.js`
- `scripts/smoke-test-kronos-s3-adapter-boundary.js`
- `scripts/smoke-test-kronos-s3-adapter-contracts.js`
- `scripts/smoke-test-kronos-s3-adapter-qualification.js`
- `scripts/smoke-test-kronos-s3-adapter-streaming.js`
- `scripts/smoke-test-kronos-s3-compatibility-boundary.js`
