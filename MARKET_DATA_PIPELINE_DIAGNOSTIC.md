# Market Data Pipeline Diagnostic

Public Trade Intel now records market-data diagnostics for each completed prediction scan.

## Pipeline Stages

- Broad-screen quote request: the active scan universe is selected before quote refresh.
- Deep-analysis quote request: the same active scan candidates are refreshed through the provider-safe quote pipeline.
- Intraday bars: recorded when provider timestamps are intraday-capable; otherwise marked unavailable without failing the scan.
- Daily bars: represented by `latestUnderlyingQuoteAt` and `latestDailyBarAt`.
- Volume: tracked through `marketVolume`.
- Market cap: optional; missing market cap does not fail market-data availability.
- Index/proxy requests: tracked separately in market-index diagnostics.
- Provider priority request: Yahoo is attempted first, Alpha Vantage is attempted second when configured, cached snapshot is attempted third, and saved quote fallback is attempted fourth.
- Cached-data retrieval: fresh saved quotes may be reused and marked as cache/fallback usage.
- Final normalized object: each prediction stores provider, price, volume, fetch time, underlying timestamp, fallback/cache flags, and missing-field lists.

## Recorded Fields

For each scan, `scanHealth.providerHealth.stages` records provider name, operation, symbols requested, returned, missing, latency, retry count, rate-limit responses, timeout count, parse failures, fallback usage, cache usage, and oldest/newest underlying timestamps.

`scanHealth.providerHealth.requestLog` records provider-level attempts newest-first with request, provider, latency, success, failure, retry, cache, fallback, and symbol count.

`scanHealth.marketDataQualityScore` is a 0-100 score combining quote coverage, freshness, provider health, fallback usage, and missing critical fields.

## Current Root Cause Pattern

When production shows a provider fetch time during market hours but an old underlying timestamp, the likely cause is provider quote refresh returning little or no usable current data, causing predictions to use saved or fallback market fields. The app now reports this as coverage/freshness distribution instead of collapsing it into a single misleading status.

## Version 2.1.2 Quote Coverage Note

Quote coverage diagnostics now distinguish Yahoo attempted symbols from total deep-analysis symbols. This prevents a provider-specific number such as 29 of 300 from being read as overall prediction coverage when cached fresh data, broad-screen data, or saved fallback data also contributed to the completed scan.
