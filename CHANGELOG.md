# Public Trade Intel Changelog

## Version 2.2 Sprint 1 - Institutional Research Experience

- Added Trade Brief 2.0 as an institutional-style research report.
- Added Bull Case, Reasons to Wait, outlook invalidation, honest Trade Plan availability, Signal Agreement, ranking explanation, score limiters, market-regime diagnostic, sector context, confidence trend, data reliability, and Trade Brief consistency audit.
- Added compact opportunity-card reasons and caution labels.
- Rewrote AI Market Brief language as natural prose.
- Reorganized the dashboard with progressive disclosure and remembered collapsed state.
- Added methodology documentation and smoke tests for the new research experience.

## Version 2.1.2 Final Reliability and Opportunities Hub

- Locked market-data availability display to the shared backend thresholds.
- Added quote coverage diagnostics so provider-specific quote success is not confused with overall prediction data availability.
- Added clearer Yahoo/cache/fallback wording on the user dashboard while keeping full diagnostics in Admin.
- Added Saved Data Only congressional feed wording when live refresh fails but saved disclosures exist.
- Reworded market summary language to separate prediction universe bias from broad-market claims.
- Added the beta Opportunities Hub with investor view, timeframe, price-band, ranking, and investment-access preview controls.
- Added Beginner Picks, Penny Speculative, and price-band ranking documentation.
- Added smoke tests for final availability consistency, quote diagnostics, Opportunities Hub controls, beginner filtering, penny speculative filtering, price bands, and investment access preview.

## Fix Production Symbol Coverage and External Data Connections

- Added packaged cached public symbol snapshot so production does not shrink to the 117-symbol preset universe after Render deploy/restart.
- Added production symbol-universe diagnostics and emergency preset fallback labeling.
- Added market index/proxy diagnostics for `^GSPC`, `^IXIC`, `^DJI`, `^RUT`, `^VIX`, `SPY`, `QQQ`, `DIA`, and `IWM`.
- Renamed internal Fear / Greed style wording to Prediction Universe Sentiment.
- Separated Broad Market Trend from Prediction Universe Bias.
- Added source/freshness lines and explicit unavailable states for market cards.
- Added Congress connection diagnostics with HTTP status, content type, saved fallback count, and non-secret auth status.
- Added Render persistence documentation for packaged snapshot, runtime cache, and JSON-history limitations.

## Version 2.0 Live Coverage and Outcome Tracking

- Added exact and relative scan timestamps across the dashboard.
- Added persistent scan freshness metadata: last attempt, last successful scan, completion time, market data timestamp, and scan duration.
- Added cached U.S. stock/ETF symbol-universe ingestion with Nasdaq Trader listing-source support and explicit fixture fallback when live listing data is unavailable.
- Added provider-specific ticker normalization, including Yahoo-compatible symbols such as `BRK-B`.
- Added admin symbol-universe status and refresh controls.
- Added user-safe Congress Feed statuses: Live, Saved Data Only, Stale, Unavailable, and Failed.
- Removed environment-variable setup language from the user-facing Congress dashboard status.
- Added congressional disclosure freshness, age decay, disclosure-date tracking, transaction-date tracking, and source metadata.
- Added persistent prediction history records for Top 25 rankings.
- Added outcome settlement foundation for 1-day, 7-day, 1-month, and 1-year predictions.
- Added sample-size-aware performance wording so the app does not imply accuracy before predictions have settled.
- Added `SYMBOL_UNIVERSE.md`, `SYMBOL_UNIVERSE_DIAGNOSTIC.md`, `OUTCOME_TRACKING.md`, and `CONGRESS_FEED_STATUS.md`.
- Added smoke tests for symbol-universe coverage, outcome tracking, performance status, and Congress feed status.

## Version 2.0 Prediction Responsiveness and Broad Discovery

- Added Dashboard AI Market Brief guidance.
- Added visible scan progress lifecycle and duplicate-scan prevention.
- Added scan health metadata with duration, candidate counts, data freshness, provider capacity, and sector allocation.
- Added broad discovery settings targeting 2,500 symbols with a 5,000-symbol system ceiling.
- Added two-stage broad screen then deep-analysis selection.
- Added Admin Prediction Discovery Settings.
- Added Admin Prediction Model Weights.
- Added signal contribution transparency to prediction records.
- Reduced congressional signal dominance and capped congressional contribution reporting.
- Added prediction freshness metadata.
- Added dashboard opportunity diversity so one ticker does not dominate every role.
- Added `PREDICTION_RESPONSIVENESS.md`, `PREDICTION_RESPONSIVENESS_DIAGNOSTIC.md`, and `DISCOVERY_PIPELINE.md`.
- Added `npm run smoke:broad` and `npm run smoke:scan-progress`.

## Version 2.0 Functional Stabilization

- Froze feature development and focused on core workflow reliability.
- Wired main global search to the Opportunities workflow.
- Wired admin global search to route to the matching admin section.
- Repaired Trade Brief `Add to Watchlist` so it adds the selected ticker.
- Repaired Trade Brief `Create Alert` so it creates an in-app alert rule immediately.
- Added validation for blank alert ticker submissions.
- Corrected mobile admin navigation to open Admin Dashboard first.
- Added `FUNCTIONAL_STABILIZATION.md` and `BETA_READINESS.md`.
- Added smoke tests for core workflows, visible controls, and admin workflow.

## Public Trade Intel UX Acceptance Pass

- Added cache-busting query strings for `styles.css`, `app.js`, and `admin.js`.
- Added `UX_ACCEPTANCE.md` with page, viewport, interaction, and validation results.
- Added a real Admin Dashboard overview panel.
- Added admin deep-link routing for Prediction Engine, Prediction Scan Settings, Market Data, Congress Feed, Policy Feed, and System Health.
- Added functional admin topbar profile and alerts dropdowns.
- Confirmed Hybrid C light-shell checks through syntax and smoke tests.

## Completed Major Phases

### Prediction Scan Flow

- Added prediction scan route.
- Connected frontend scan button to backend prediction generation.
- Created prediction records for multiple timeframes.
- Added smoke testing for the prediction scan flow.

### Technical Analysis

- Added EMA and SMA calculations.
- Added 9 EMA and 20 EMA fields.
- Added VWAP where market data supports volume.
- Added support and resistance detection.
- Added opening range high/low fields.

### Multi-Timeframe Alignment

- Added 2-minute, 5-minute, and 15-minute technical layers.
- Added alignment direction, alignment score, and all-timeframes-aligned flag.
- Added reason summaries for multi-timeframe alignment.

### Setup Detection

- Added 5-minute 9 EMA bounce detection.
- Added break-and-retest setup detection.
- Added setup direction, setup score, and confirmation status.

### Short Squeeze Scanner

- Added short-squeeze signal layer.
- Added squeeze risk, squeeze score, relative volume, VWAP reclaim, resistance breakout, and failed-breakdown fields.
- Supported missing short-interest and float data without failing scans.

### Chart Pattern Recognition

- Added chart pattern signal layer.
- Added bull flag, bear flag, triangles, double top/bottom, wedges, head and shoulders, and inverse head and shoulders recognition.
- Added primary pattern, pattern score, invalidation level, and target level.

### Unified Confidence Scoring

- Added unified prediction score.
- Added unified direction.
- Added confidence tier.
- Added strongest signals, conflicting signals, and final reason summary.

### Quality Guardrails

- Prevented mixed-direction predictions from showing high confidence.
- Prevented very-high confidence when too many conflicts exist.
- Lowered confidence for stale or incomplete market data.
- Added data quality status and notes.

### Prediction Engine Health

- Added authenticated prediction engine health panel.
- Added scan timestamp, tickers scanned, predictions generated, Top 25 counts, data quality counts, average scores, high/low scoring tickers, failed tickers, and ranking sanity checks.
- Separated prediction engine status from market data quality status.

### Configurable Scan Universe

- Added scan universe options for watchlist, S&P 500, Nasdaq-100, ETFs, and combined universe.
- Added custom ticker list support.
- Expanded prediction scan candidate coverage.

### Prediction Scan Settings UI

- Added admin UI section for Prediction Scan Settings.
- Added scan universe dropdown.
- Added custom ticker textarea.
- Added active universe and candidate count display.
- Added save settings action.
# July 2026

- Added market-data coverage and freshness distributions for completed scans.
- Added provider-health diagnostics and scan-stage duration reporting.
- Separated Engine Health from Market Data Availability and Market Data Freshness.
- Added per-prediction data-usability flags for fallback, stale, missing critical fields, and confidence downgrade reasons.
# Version 2.2 Sprint 2 - Stocks to Buy Center

- Added the Stocks to Buy Center as the flagship ranked-buy-ideas page.
- Added 24 independent price-category/timeframe ranking lists from completed scan results.
- Added AI Best Ideas with quality, risk, fallback, confidence, and diversification checks.
- Added Beginner and Penny & Speculative investor views inside Stocks to Buy.
- Added Investment Access Preview for small-dollar share accessibility.
- Added quick comparison, category summaries, and atomic publish diagnostics.
- Added Sprint 2 documentation and smoke tests.
