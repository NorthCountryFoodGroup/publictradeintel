# Rollback Guide

## Return to legacy

Set the discovery engine configuration to the exact supported value:

```json
{
  "discoveryEngineVersion": "legacy"
}
```

If the value is missing, malformed, or unknown, the selector also fails closed to legacy, but an explicit `legacy` value is preferred during an operational rollback.

## Expected behavior

- Existing legacy discovery supplies the complete production candidate pool.
- `buildPrediction()`, prediction ranking, persistence, API responses, and frontend behavior remain unchanged.
- Shadow comparison may remain enabled for diagnostics or be explicitly disabled.
- No v3 candidate is mixed into the legacy pool.

## Rollback triggers

- V3 execution or fatal diagnostic errors
- Runtime-limit violations
- Empty, undersized, or oversized v3 pools
- Ineligible, unqualified, generated, fallback-only, inactive, unsupported, or duplicate selected securities
- Explanation or provenance gaps affecting selected candidates
- API, persistence, prediction-boundary, or frontend regression
- Selector ambiguity or hybrid-pool evidence
- Unexpected production results or inability to explain selection

## Post-rollback validation

1. Confirm `scanHealth.discoverySelector.activeEngine` is `legacy`.
2. Confirm fallback state and reason are expected.
3. Run `npm run validate:discovery:phase1`.
4. Confirm prediction counts, row shape, ranking sections, and persistence contracts.
5. Confirm no v3 ticker entered the production pool.
6. Record the incident and preserve bounded diagnostics without provider payloads or secrets.
