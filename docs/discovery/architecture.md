# Discovery Architecture

Architecture version: `v3-phase1-architecture-1`

## Components

| Component | Responsibility | Production role |
|---|---|---|
| Legacy discovery | Builds the established broad screen and deep-analysis pool. | Default production discovery and complete fallback. |
| Evidence layer | Builds normalized records from trusted symbol metadata, current quotes, saved congressional disclosures, and ticker-specific policy signals. | V3 input; inert unless shadow or explicit v3 execution is requested. |
| Regime layer | Describes sourced aggregate market context and bounded bucket emphasis. | Context only; cannot qualify a security. Currently neutral when historical aggregate evidence is unavailable. |
| Eight buckets | Independently qualify momentum, relative-volume, breakout, earnings, congressional, policy, sector-leader, and reversal candidates. | V3 qualification only. |
| Candidate pool | Deduplicates qualified securities and applies transparent, diversified deep-analysis selection. | V3 discovery output only. |
| Explanation engine | Produces stable reasons, evidence, provenance, missing-data, regime, and selection explanations. | Diagnostics and auditability. |
| Shadow comparison | Compares legacy and v3 candidates without changing production selection. | Diagnostics only. |
| Versioned selector | Resolves exact engine configuration and applies every v3 readiness safeguard. | Production-critical boundary; defaults and fails back to legacy. |
| Readiness history | Retains bounded summaries from completed production scans for the existing promotion gate. | Diagnostic-only JSON under `DATA_DIR`; maximum 100 observations; process-local mutation queue. |
| Readiness gate | Measures whether v3 is suitable for future promotion. | Diagnostics only; never changes configuration. |
| Prediction engine | Runs unchanged `buildPrediction()` scoring, ranking, API shaping, and persistence. | Production-critical and unchanged by Phase 1. |

## Dependency order

```text
Trusted source inputs
  -> Evidence records
  -> Neutral/sourced regime context
  -> Eight independent bucket evaluations
  -> Diversified candidate pool
  -> Structured explanations
  -> Shadow comparison
  -> Completed prediction generation
  -> Atomic readiness-observation retention and readiness diagnostics

Legacy discovery ---------------------> Versioned selector
V3 candidate pool --------------------> Versioned selector
Versioned selector -- one resolved pool --> Existing buildPrediction()
Existing buildPrediction() --> ranking --> persistence --> API
```

The selector is the only boundary allowed to change discovery inputs. It never changes prediction scoring. Candidate-pool priority is not a prediction score.

## Production-critical boundaries

- The checked-in default engine is `legacy`.
- The legacy candidate pool is built and preserved before v3 is attempted.
- Only exact `v3-evidence-buckets` configuration may request v3.
- V3 activation is all-or-nothing; there is no hybrid pool.
- `buildPrediction()` receives one resolved candidate pool once per scan.
- API required fields and prediction persistence remain governed by compatibility contracts.

Shadow comparison, explanations, evidence coverage, readiness history, and readiness are bounded additive diagnostics. Their failure cannot interrupt the legacy scan.
