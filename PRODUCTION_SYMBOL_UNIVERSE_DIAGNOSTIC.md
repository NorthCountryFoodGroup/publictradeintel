# Production Symbol Universe Diagnostic

## Why Production Showed 117 Symbols

Production only had the built-in preset universe available when no durable `data/symbolUniverse.json` cache existed on Render.

Those presets came from:

- S&P 500 starter preset
- Nasdaq-100 starter preset
- major ETF preset

After duplicates, the final combined preset count was approximately 117 symbols. This was not broad-market coverage.

## Production Fix

The app now ships `data/publicSymbolSnapshot.json`.

Startup and scan flow now prefer:

1. Live Nasdaq Trader listing refresh
2. Saved runtime cache
3. Packaged cached public listing snapshot
4. Emergency preset fallback

## Live Listing Refresh

Configured URLs:

- `https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt`
- `https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt`

Diagnostics record:

- active source
- refresh status
- raw and eligible counts
- exchange counts
- security type counts
- last refresh error
- emergency fallback active yes/no

This sandbox could not connect to the listing URLs from PowerShell, so live Render success must be confirmed from the deployed Admin diagnostics.
