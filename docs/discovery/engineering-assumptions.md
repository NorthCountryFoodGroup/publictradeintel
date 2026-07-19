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
- Production compatibility observations remain unknown until measured in completed production scans

Symbol-universe provenance now uses the completed scan's source metadata. Cached, saved,
live, mixed, emergency, and unknown states remain distinct; missing metadata never implies a
live or cached source.

The former `UNRESOLVED_DATA_PROVENANCE_FAILURE` blocker is no longer emitted after the
truthful resolver and frontend/API consistency contract pass. Future provenance failures must
fail their contract or appear as a new bounded diagnostic rather than being silently ignored.

## Intentionally deferred to Phase 2

- New historical, fundamental, sector, macro, and earnings providers
- Prediction-engine replacement or recalibration
- Outcome-based performance claims
- Readiness-history performance and operational monitoring beyond the bounded JSON store
- Canary deployment automation
- Automatic promotion
- Frontend/admin controls for v3 promotion
