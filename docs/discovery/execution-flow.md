# Execution Flows

## Legacy mode

```text
Build legacy discovery
  -> preserve legacy candidate array
  -> selector resolves legacy
  -> copy resolved legacy candidates
  -> call unchanged buildPrediction() once per candidate
  -> sort, persist, and return predictions
  -> optionally run isolated v3 shadow diagnostics
  -> calculate readiness diagnostic
```

## Explicit v3 mode

```text
Build and preserve complete legacy fallback
  -> exact configuration requests v3-evidence-buckets
  -> build evidence
  -> build regime context
  -> evaluate eight buckets
  -> build candidate pool
  -> build explanations
  -> measure duration and apply every selector safeguard
     -> all pass: resolve only v3 candidates
     -> any fail: resolve complete legacy pool
  -> call unchanged buildPrediction() once over resolved pool
  -> sort, persist, and return predictions
```

## Shadow mode

```text
Resolve production pool
  -> generate production predictions
  -> execute or reuse isolated v3 output
  -> compare canonical legacy and v3 ticker sets
  -> expose bounded scanHealth.discoveryShadowComparison
  -> never insert or remove production candidates
```

## Failure mode

```text
V3 error, malformed output, empty/undersized pool,
ineligible candidate, duplicate, fatal diagnostic,
or runtime-limit violation
  -> record stable selector fallback code
  -> discard entire v3 production result
  -> use complete preserved legacy pool
  -> continue one normal prediction pass

Diagnostic error
  -> return structured ERROR/failed diagnostic
  -> do not propagate into selection or prediction generation
```
