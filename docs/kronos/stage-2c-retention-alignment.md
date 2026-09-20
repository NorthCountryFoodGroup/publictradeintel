# Stage 2C qualification retention alignment

Implementation only. No AWS, STS, S3, production-data access, deployment, or qualification action is part of this change.

## Root cause and contract

The S3 PutObject path hard-coded COMPLIANCE. The shared retention verifier also required COMPLIANCE, while the original retention requirement had no mode field. The V1 receipt validator/verifier likewise assumed Compliance.

KRONOS_RETENTION_REQUIREMENT_V2 adds a mandatory `mode`, exactly GOVERNANCE or COMPLIANCE, included in `policyHash`. Missing, null, empty, lowercase, unknown, or non-string modes fail closed. Old mode-less V1 requirements are not silently interpreted or migrated.

The constructor's trusted server/provider `retentionPolicies` array is the authority. The adapter snapshots it. It selects the artifact-class policy, with an explicit QUALIFICATION policy fallback only inside the existing non-production qualification scope. One policy per artifact class avoids ambiguous selection. Multiple snapshot schedules must therefore use separately configured adapters; no artifact can choose a weaker registered policy.

Descriptor requirements and persisted metadata must match that selected policy exactly. Neither artifact payload metadata nor request options can override it. Unknown request-option keys are rejected. No HTTP route or environment loader is added; a future caller must keep constructor configuration outside client control. A policy hash is integrity evidence, not authorization.

## Explicit synthetic policy

The offline Governance qualification fixture uses:

```js
const required = fixtureRequirement(
  "QUALIFICATION_SHORT_V1", approvedAt, undefined, "GOVERNANCE"
);
const config = { ...trustedQualificationConfig, retentionPolicies: [required] };
```

The approved minimum is exactly one day after `approvedAt`. PutObject explicitly sends the required mode and minimum-retain-until timestamp; the Governance/1-day mock bucket default is not used as a substitute. Readback must report the same mode and an expiry at least equal to the original approved minimum, with matching policy hash and provider-managed encryption.

Compliance is separately tested, including a prospective-evidence fixture with an explicitly supplied illustrative duration. That fixture does not approve or establish any production duration. Missing production configuration never falls back to Governance. The adapter still rejects production environments/purpose and real-provider production readiness remains false.

## Receipts and qualification evidence

V2 receipts preserve both the full required policy and observed mode/expiry. V1 interoperability preserves observed Governance only when its trusted verification caller supplies the explicit required policy; the historical offline V1 call form retains its Compliance-only semantics. No implicit Governance fallback exists.

KRONOS_PROVIDER_QUALIFICATION_V2 requires retention evidence containing the full required policy (version, mode, duration boundary, policy hash), observed retention mode/expiry/hash/encryption, and object key/version. The qualification hash covers that evidence along with containerRef, region, environment/stream, and runtime/restore references. The opaque containerRef binds bucket, region, and expected owner without exporting credential/provider internals.

Both mode directions require exact matching: Governance cannot satisfy Compliance, and Compliance cannot silently satisfy Governance. Evidence is deeply frozen at its flat policy/observation boundaries and privately branded to the originating adapter. Copied, foreign-adapter, other-container, altered, and opposite-policy evidence cannot become valid qualification through the adapter. Qualification records remain simulated, untrusted, runtimeQualified=false, and productionQualified=false; hashes alone never establish authority.

## Validation and production boundary

Focused command: `npm run smoke:kronos-s3-retention-modes`.

Coverage includes both PUT mappings, exact readback in both directions, one-day Governance qualification, short expiry, invalid/missing modes, descriptor/request/payload/remote-metadata spoofing, configuration mutation, receipt modes, qualification binding, and foreign-container evidence rejection. Explicit network/credential guards surround all S3 tests.

Prior S3, compatibility, offline Slice 2C, Slice 2B, Slice 2A, Slice 1, production-boundary, prediction-semantics, autonomous-decision, and discovery suites are required before review, along with npm audit and syntax/diff/package checks.

No server, frontend, Render, dependency version, feature flag, scheduler, JSON persistence, Legacy prediction logic, or production data is changed. Nothing automatically invokes the S3 adapter. This change requires review, later commit/merge, a separately authorized deployment, and separate authorization before any synthetic S3 qualification. It does not claim live OIDC, permission, Object Lock, or S3 qualification success.
