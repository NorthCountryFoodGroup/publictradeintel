# Production Symbol Universe

Public Trade Intel now ships with a packaged baseline symbol universe so production does not shrink back to the old preset universe after a Render deploy or restart.

## Source Order

1. Live Nasdaq Trader listing refresh
2. Runtime cache at `data/symbolUniverse.json`
3. Packaged cached public listing snapshot at `data/publicSymbolSnapshot.json`
4. Emergency preset fallback

The packaged file is labeled:

`Cached public listing snapshot`

It is not labeled live exchange coverage.

## Packaged Snapshot

- File: `data/publicSymbolSnapshot.json`
- Count: 3,200 symbols
- Contains: canonical ticker, display ticker, provider ticker, name, exchange, security type, ETF flag, test-issue flag, active status, source
- Does not contain: prices, predictions, watchlists, credentials, API keys, personal data, or prediction history

## Emergency Fallback

If only the preset universe is active, Admin shows:

`Emergency Preset Fallback`

and the user-facing message:

`Broad-market discovery is unavailable. Results currently use 117 preset symbols.`
