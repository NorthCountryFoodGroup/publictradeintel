# Discovery Pipeline

Public Trade Intel now uses a two-stage discovery design.

## Stage 1: Broad Screen

Goal: quickly rank a large universe without running the full prediction engine on every symbol.

Default target: 2,500 eligible U.S. stocks and ETFs.

Actual count is the lower of:

- configured universe size
- broad-screen target
- provider request budget
- symbols that pass eligibility filters

Inputs:

- Active scan universe
- Watchlist symbols
- Custom ticker list
- Preset S&P 500 symbols
- Preset Nasdaq-100 symbols
- Major ETFs
- Available cached quote data
- Discovery settings from Admin

Filters:

- Minimum price
- Minimum average volume
- Include/exclude ETFs
- Include/exclude small caps
- OTC exclusion flag

Broad screen score:

- Momentum proxy
- Quality proxy
- Press/news proxy
- Committee/policy relevance proxy
- Valuation proxy
- Liquidity/volume proxy when quote data is available

## Stage 2: Deep Analysis

Goal: run the full prediction model on the best candidates from the broad screen.

Default deep-analysis counts:

- Market hours: 300 candidates
- After hours: 600 candidates

The app can support larger counts, but the current quote provider and Render runtime should be protected with batching, retries, and clear provider-capacity reporting.

The full prediction engine runs only on the selected deep-analysis candidates, not every broad-screen symbol.

## Provider Safety

The discovery settings include:

- Batch size
- Request concurrency
- Retry count
- Target symbol count
- Deep-analysis counts

These are stored in `data/config.json` and managed from Admin > Prediction Discovery Settings.

If provider limits, runtime limits, or configured-universe limits prevent the app from reaching the requested target, scan health reports the lower actual supported coverage.

## Sector Allocation Foundation

The settings include allocation targets:

- Strong sectors
- Improving sectors
- Contrarian sectors
- Catalyst sectors
- Minimum candidates per sector

The current implementation reports sector allocation in scan health. Future work can use those allocation settings to force minimum sector diversity before ranking.

## Freshness And Atomic Publishing

Each prediction scan now includes:

- Scan started timestamp
- Scan completed timestamp
- Duration
- Symbols screened
- Candidates selected for deep analysis
- Predictions generated
- Data quality summary
- Failed/skipped symbols
- Last successful scan timestamp

Prediction records include timestamp and freshness fields so users can see whether a recommendation is based on current, delayed, stale, or missing data.

## Scheduled Scan Foundation

Admin discovery settings include scheduled scan options:

- Enabled flag
- Market-hours interval
- After-hours interval
- Last scheduled scan timestamp

The current sprint stores the configuration foundation. A future worker or scheduler can use these fields to run scans automatically.

## Live Symbol Universe

The discovery pipeline now has a symbol-universe ingestion layer.

Preferred live sources:

- Nasdaq Trader `nasdaqlisted.txt`
- Nasdaq Trader `otherlisted.txt`

The app parses those listing files into canonical, display, and provider-specific ticker forms. Symbols that are malformed, OTC-only, delisted, test issues, units, rights, warrants, or unsupported preferred formatting are excluded before broad screening.

If live listing fetches fail or return too few eligible symbols, the app writes an explicit local fallback cache instead of silently pretending live coverage exists. Scan health and Admin > Prediction Scan Settings show the actual eligible count and source notes.

## Provider Ticker Normalization

Prediction candidates now keep separate ticker roles:

- canonical ticker
- display ticker
- provider ticker

Example: `BRK.B` remains readable to users, while Yahoo quote lookups use `BRK-B`.
