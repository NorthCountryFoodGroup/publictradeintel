# Symbol Universe Diagnostic

## Why Only About 117 Symbols Were Available

The prior universe was assembled from built-in preset arrays in `server.js`:

- S&P 500 preset sample: 60 symbols
- Nasdaq-100 preset sample: 48 symbols
- ETF preset sample: 28 symbols
- Watchlist/custom symbols could add a few more

After duplicate removal, the combined universe landed around 114-117 symbols depending on saved watchlist/custom tickers.

## What That Means

That was not true broad U.S. market coverage.

It represented:

- large-cap preset examples
- Nasdaq-100 examples
- major ETFs
- saved watchlist symbols
- optional custom tickers

It did not represent all eligible Nasdaq, NYSE, and NYSE American listings.

## New Diagnosis Fields

The app now reports:

- total raw listings
- eligible listings
- exchange counts
- security type counts
- ETFs versus common stocks
- excluded symbols and reasons
- whether the source is live exchange files, stale cache, or explicit fixture fallback

## Current Fallback

When exchange listing refresh is unavailable and no runtime cache exists, production now loads the packaged cached public listing snapshot first.

Only if both live refresh and packaged snapshot are unavailable should the old preset universe be treated as emergency fallback.

The app must not call 117 preset symbols broad-market coverage.

## Production Fix

`data/publicSymbolSnapshot.json` ships with the app and contains 3,200 snapshot rows. It excludes prices, predictions, watchlists, secrets, credentials, and user data.
