# Prediction Responsiveness

Public Trade Intel now treats prediction scanning as a visible workflow instead of a silent backend action.

## What Changed

- Added a dashboard AI Market Brief that summarizes the current prediction environment.
- Added visible scan progress stages: preparing, broad screening, candidate selection, market/news refresh, analysis, ranking, validation, saving, and completion.
- Added scan health metadata with candidate counts, duration, data freshness, sector allocation, failed/skipped symbols, and provider capacity notes.
- Added freshness metadata to prediction records: quote timestamp, scan timestamp, freshness status, and freshness notes.
- Added signal contribution transparency so each prediction can show which layers helped or hurt the final score.
- Added dashboard role diversity so the same ticker is less likely to fill every opportunity card.
- Added admin controls for Prediction Discovery Settings and Prediction Model Weights.

## Discovery Capacity

The backend now separates discovery into explicit limits:

- `BROAD_SCREEN_TARGET`: 2,500 symbols
- `DEEP_ANALYSIS_MARKET_HOURS_TARGET`: 300 candidates
- `DEEP_ANALYSIS_AFTER_HOURS_TARGET`: 600 candidates
- `PROVIDER_CONCURRENCY_LIMIT`: 4 concurrent quote requests by default
- `PROVIDER_REQUEST_BUDGET`: 2,500 quote requests per scan by default
- `MAX_SCAN_DURATION`: 180,000 ms by default

The app does not run full prediction analysis on every broad-screen symbol. It screens the available provider-supported universe first, then runs full prediction analysis only on the selected deep-analysis candidates.

The currently bundled preset universe contains 114 unique symbols:

- 60 S&P 500 preset symbols
- 48 Nasdaq-100 preset symbols
- 28 major ETFs
- 114 unique combined symbols after duplicate removal

Until a larger universe provider or custom ticker list is connected, the app will report the actual available universe instead of pretending it screened 2,500 stocks.

## Completion Status

Completed:

- Metadata/progress improvements
- Dashboard role selection improvements
- Real broad-screen pipeline structure
- Real deep-analysis selection stage
- Provider request budget, concurrency, and scan-duration controls
- Honest scan-health reporting when coverage falls below target

Deferred due to provider/universe limits:

- True 2,500-symbol coverage from a live U.S. stock/ETF universe provider
- Provider-specific usage/remaining-quota reporting
- Forced sector allocation inside the candidate selector

## Congressional Signal Guardrail

Congressional trading data is now treated as a secondary catalyst, not the main driver.

- Contribution reporting caps the congressional layer at 10 points.
- Institutional-flow and insider-activity proxy formulas were reduced so congressional data cannot dominate them.
- Admin Model Weights exposes congressional caps for future tuning.

## Scan Health

Scan health now separates engine completion from data quality.

- Engine status answers: did the scan run and generate predictions?
- Data quality answers: how fresh and complete was the market data?

This prevents incomplete quote data from incorrectly making the whole prediction engine look broken.

## Scan Freshness

Dashboard scan reporting now shows both:

- exact scan completion time
- relative scan age, refreshed once per minute

Prediction records also store the market-data timestamp used during the scan. This makes it clear whether a recommendation is based on fresh, delayed, stale, or incomplete provider data.

## Outcome Tracking Foundation

Each completed scan appends Top 25 prediction records into persistent history. Outcome settlement is timeframe-aware:

- 1-day predictions settle after the next trading day
- 7-day predictions settle after seven trading days
- 1-month predictions settle after about 21 trading days
- 1-year predictions settle after about 252 trading days

Performance screens distinguish live forward results from future backtest work, and they avoid showing accuracy claims until enough predictions have settled.

## External Market Labels

Dashboard and Market Intelligence now separate:

- Broad Market Trend: external index/proxy quotes
- Prediction Universe Bias: analyzed prediction candidates
- Prediction Universe Sentiment: internal unified-score estimate

ETF proxies are labeled as proxies. Internal sentiment is not called Fear / Greed.
# July 2026 Update

Prediction scans now store provider coverage, freshness distributions, fallback/cache counts, and stage durations. A completed scan can remain Engine Healthy while market data is Partial, Degraded, Delayed, or Stale.
