# Congress Feed Status

Congressional disclosures are not real-time trading signals. They are delayed public disclosures and are treated as supporting context.

## User-Facing Statuses

- Live
- Saved Data Only
- Stale
- Unavailable
- Failed

If `CONGRESS_TRADES_FEED_URL` is not configured, the Dashboard shows:

`Live congressional feed is not connected. Predictions are using saved congressional disclosures.`

It does not show environment-variable setup instructions to normal users.

## Admin Status Details

Admin-facing data includes:

- current status
- provider/source
- last refresh
- latest disclosure date
- records available
- live feed URL configured: yes/no
- saved fallback available: yes/no
- configuration instructions

## Freshness Rules

Stored congressional rows include:

- disclosureDate
- transactionDate
- fetchedAt
- source
- sourceURL
- dataAge
- freshnessStatus

Signals decay as disclosures age. Short-term predictions use congressional data only as a weak secondary catalyst, while monthly and yearly models may treat it as a larger but still capped supporting input.
