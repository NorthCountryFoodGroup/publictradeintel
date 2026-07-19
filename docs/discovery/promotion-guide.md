# Operational Promotion Guide

## Current state

- Default engine: `legacy`
- V3 state: selectable only for controlled validation, with complete legacy fallback
- Readiness: `INSUFFICIENT_OBSERVATIONS`
- Recommendation: `CONTINUE_SHADOW_VALIDATION`
- Automatic promotion: not implemented

## Status meanings

- `READY`: every required readiness criterion passed over the configured observation window. This permits promotion review; it does not activate v3.
- `NOT_READY`: enough observations exist, but one or more required criteria failed.
- `INSUFFICIENT_OBSERVATIONS`: fewer than 20 reliable observations exist.
- `ERROR`: readiness input or calculation was malformed. Fail closed.

## Requirements before promotion

1. Accumulate at least 20 reliable real-world observations through a separately approved bounded history mechanism.
2. Resolve the known data-provenance mismatch.
3. Meet every readiness threshold, including evidence, bucket, pool, runtime, explanation, determinism, compatibility, and fallback reliability.
4. Confirm zero selected ineligible, unqualified, generated, unsupported, inactive, fallback-only, or duplicate securities.
5. Run `npm run validate:discovery:phase1`.
6. Review current shadow comparison and selector diagnostics.
7. Obtain explicit approval for a controlled canary. A READY result alone is not authorization.

## Controlled promotion

1. Preserve a verified rollback path and current legacy configuration.
2. Start with a bounded canary environment, not the default production configuration.
3. Set the engine only to exact `v3-evidence-buckets`.
4. Monitor selector fallback codes, runtime, evidence and explanation coverage, pool viability, API/persistence checks, and prediction outcomes.
5. Stop the canary if any rollback condition occurs.
6. Change the default only in a separately reviewed commit after sustained READY observations.

No Phase 1 code automatically changes configuration.
