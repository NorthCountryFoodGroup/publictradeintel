# Prediction Responsiveness Diagnostic

## Summary

The repeated-opportunity problem came from a narrow scan universe, overlapping dashboard roles, and scoring inputs that did not clearly disclose how much each signal contributed. The scan was working, but it was selecting from too few candidates and then reusing the strongest names across multiple dashboard cards.

## Causes Found

### 1. Limited Candidate Universe

The earlier scan flow was effectively optimized around a small candidate set. Even after scan universe settings were added, the preset symbol universe remained small compared with the intended 2,500-symbol discovery target.

Current preset coverage:

- S&P 500 preset: 60 symbols
- Nasdaq-100 preset: 48 symbols
- Major ETFs: 28 symbols
- Combined unique preset universe: 114 symbols

The app is now honest about actual coverage through `scanHealth.providerCapacity` and `scanUniverse.actualCoverageNote`.

### 2. Dashboard Roles Reused the Same Tickers

The Dashboard previously allowed the same stock to appear as top pick, swing pick, long-term pick, highest confidence pick, and other opportunity roles.

Fix:

- Dashboard opportunity cards now prefer distinct tickers.
- Each opportunity role includes a reason for why that ticker was selected for that role.
- If the universe is too small, the UI can still reuse a ticker, but only after trying to diversify.

### 3. Congressional Signal Was Too Easy To Overweight

Congressional activity directly influenced monthly scoring and indirectly fed institutional-flow and insider-activity proxies.

Fix:

- Congressional contribution reporting is capped at 10 points.
- Institutional-flow proxy now uses congressional data as a small secondary input.
- Insider-activity proxy now uses congressional data as a secondary input.
- Monthly direct congressional weight was reduced.

### 4. Lack Of Freshness Visibility

The app did not clearly show whether a pick was based on fresh quote data, delayed data, stale data, or fallback data.

Fix:

- Prediction records now include `quoteTimestamp`, `scanTimestamp`, `freshnessStatus`, and `freshnessNotes`.
- Scan health reports data freshness and data quality separately from engine success.

### 5. No Visible Scan Lifecycle

When users clicked "Run prediction scan," the frontend did not explain what was happening.

Fix:

- Dashboard now displays scan progress stages.
- The frontend prevents duplicate scan submissions while a scan is already running.
- The last successful scan metadata is stored locally for freshness context.

## What Changed In The Pipeline

- The single scan-universe cap was replaced with separate broad-screen, deep-analysis, provider-concurrency, provider-budget, and max-duration limits.
- The app now creates a broad-screen candidate set first.
- The app then selects a smaller deep-analysis set for full prediction scoring.
- Market quote refresh is tied to the provider-supported broad universe, subject to budget and duration limits.
- Scan health reports requested broad coverage, actual broad-screened symbols, active deep-analysis target, selected deep-analysis candidates, and coverage-limit reasons.

## What Still Requires A Data Provider

The app now supports broad discovery architecture, but true 2,500-stock coverage needs one of these:

- A larger custom ticker list
- A market-data provider universe endpoint
- A stored full S&P 500/Russell/Nasdaq universe file
- A scheduled ingestion job that refreshes symbol coverage

Without that, the app will scan the available preset/custom universe and report the actual count. Broad discovery should not be considered truly complete at 2,500-symbol coverage until one of those sources is connected and the scan health confirms the actual screened count.

## Validation Added

- `npm run smoke:broad`
- `npm run smoke:scan-progress`

These tests confirm the broad discovery settings, scan progress UI, signal contribution fields, congressional guardrails, and scan health metadata remain wired.
