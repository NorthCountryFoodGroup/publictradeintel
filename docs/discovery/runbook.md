# Discovery Operational Runbook

## Normal legacy scan

Expected:

- `scanHealth.discoverySelector.activeEngine`: `legacy`
- One prediction mapping pass
- Optional shadow diagnostic
- Readiness remains diagnostic

Action on unexpected v3 activation: immediately set explicit `legacy`, validate, and investigate configuration origin.

## Shadow scan

Inspect:

- `discoveryShadowComparison.shadowEnabled`
- `errorState`
- legacy/v3 counts and canonical overlap
- unavailable buckets
- evidence, eligibility, and explanation coverage

Overlap is not performance validation. Do not promote based on overlap alone.

## Selector diagnostics

Common fallback codes:

| Code | Operator action |
|---|---|
| `DEFAULTED_TO_LEGACY` | Expected when no engine was explicitly configured. |
| `UNKNOWN_ENGINE` / `MALFORMED_CONFIGURATION` | Correct configuration; verify legacy stayed active. |
| `V3_EXECUTION_ERROR` / `V3_INVALID_OUTPUT` | Keep legacy; inspect bounded diagnostics and provider health. |
| `V3_EMPTY_POOL` / `V3_BELOW_MINIMUM_POOL` | Keep legacy; investigate evidence and bucket availability without padding. |
| `V3_ABOVE_MAXIMUM_POOL` | Keep legacy; review pool limits and output validity. |
| `V3_INELIGIBLE_CANDIDATE` / `V3_UNQUALIFIED_CANDIDATE` | Treat as a critical integrity failure. |
| `V3_DUPLICATE_TICKER` | Investigate canonicalization and deduplication. |
| `V3_RUNTIME_LIMIT_EXCEEDED` | Keep legacy; profile synchronous v3 work. |
| `V3_FATAL_DIAGNOSTIC` | Keep legacy; resolve the underlying diagnostic. |
| `V3_ACTIVE` | Confirm this was an explicitly approved controlled validation. |

## Readiness diagnostics

Inspect:

- status and recommendation
- observation count versus minimum 20
- failed criteria and blocking reason codes
- unavailable buckets and evidence coverage
- pool, explanation, fallback, runtime, stability, comparison, and eligibility health
- known pre-existing versus new blockers

`READY` means eligible for review, not authorized for activation.

## Diagnostic failure

Structured diagnostic failures must not interrupt scans. If a diagnostic is absent or malformed, keep legacy, record the issue, and rerun validation. Never copy raw provider payloads, secrets, tokens, stack traces, or unbounded evidence into incident notes.
