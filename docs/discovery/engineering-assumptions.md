# Engineering Assumptions and Limitations

## Current evidence

Available real inputs:

- Trusted symbol-universe metadata when live source provenance exists
- Current quote data
- Normalized saved congressional disclosure records
- Ticker-specific saved policy signals

Unavailable or incomplete:

- Historical price bars and multi-period returns
- Twenty-day average and relative volume
- Breakout and reversal confirmation
- Real earnings calendar and surprise data
- Sourced sector return and breadth series
- Aggregate historical trend, breadth, and volatility regime metrics

## Bucket availability

Congressional and policy buckets can qualify candidates when real saved evidence and provenance meet thresholds. Momentum requires historical returns and market-relative strength. Relative-volume, breakout, earnings, sector-leader, and reversal buckets generally remain unavailable. Requirements are intentionally not weakened.

## Current readiness blockers

- Fewer than the required 20 validated real-world observations may be retained initially
- Minimum 20 observations not met
- Limited real-evidence and bucket coverage
- Limited candidate-pool viability
- Production determinism history unavailable
- Known data-provenance frontend-label/test mismatch

The known `smoke:data-provenance` assertion expects `Cached public listing snapshot` while the frontend uses a different label. It is pre-existing, remains unresolved, and blocks promotion under `UNRESOLVED_DATA_PROVENANCE_FAILURE`. Phase 1 records but does not fix it.

## Intentionally deferred to Phase 2

- New historical, fundamental, sector, macro, and earnings providers
- Prediction-engine replacement or recalibration
- Outcome-based performance claims
- Readiness-history performance and operational monitoring beyond the bounded JSON store
- Canary deployment automation
- Automatic promotion
- Frontend/admin controls for v3 promotion
