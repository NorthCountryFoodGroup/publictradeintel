# Symbol Universe

Public Trade Intel now has a symbol-master layer separate from the prediction scoring engine.

## Sources

Primary configured sources:

- Nasdaq Trader `nasdaqlisted.txt`
- Nasdaq Trader `otherlisted.txt`

These cover Nasdaq-listed securities plus NYSE and NYSE American securities represented through the exchange listing files.

## Cache

The app stores the current symbol master in `data/symbolUniverse.json`.

If refresh fails:

- the last valid symbol master is retained
- refresh status becomes `stale`
- refresh notes show the failure
- the app does not silently fall back to the small preset universe

If no valid cache exists, the app creates an explicit generated fixture fallback so scans and tests can still exercise 2,500+ symbols. That fallback is labeled as fixture data, not live broad-market coverage.

## Metadata

The symbol master includes:

- source
- fetchedAt
- rawSymbolCount
- normalizedSymbolCount
- eligibleSymbolCount
- commonStockCount
- ETFCount
- excludedCount
- exclusionReasons
- exchangeCounts
- refreshStatus
- refreshNotes

## Filtering

Default exclusions:

- OTC securities
- warrants
- rights
- units
- preferred shares
- inactive listings
- test symbols
- delisted securities
- malformed symbols

Configurable inclusions:

- ETFs
- ADRs
- closed-end funds

## Production Baseline

Production now ships `data/publicSymbolSnapshot.json` as a packaged cached public listing snapshot. This prevents Render deploys or restarts from reducing the universe back to the old preset-only list when runtime cache files are absent.

Source order:

1. Live Nasdaq Trader listing refresh
2. Runtime cache at `data/symbolUniverse.json`
3. Packaged cached public listing snapshot
4. Emergency preset fallback

The packaged snapshot is not labeled live coverage. Admin diagnostics show the active source, snapshot age, exchange counts, and whether emergency fallback is active.
