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

Symbol-universe resolution keeps immutable and mutable sources separate. The checked-in
public snapshot is read from the application package, while `symbolUniverse.json` and the
saved `publicSymbolSnapshot.json` are rooted beneath `DATA_DIR`. Normal scans resolve a valid
saved universe, then a valid saved public snapshot, then the checked-in public snapshot, and
only then use the emergency preset. Explicit live refreshes attempt both Nasdaq Trader listing
files with bounded timeouts and response-format validation, then persist a validated result to
both mutable files. Snapshots older than 45 days or missing truthful source/timestamp metadata
are not treated as valid broad-market evidence.

An emergency-preset scan remains a structurally valid readiness observation because the scan
completed and exercised fallback behavior. Its limited universe and evidence coverage continue
to reduce the applicable readiness-quality metrics; it is not rewritten, deleted, or converted
into a passing broad-market observation.

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
