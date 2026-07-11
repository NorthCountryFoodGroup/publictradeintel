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

When exchange listing refresh is unavailable and no cache exists, the app creates a generated fixture universe of 3,200 symbols. This is only for development/testing coverage and is explicitly labeled as fallback data.

The app must not call fixture fallback live broad-market coverage.
