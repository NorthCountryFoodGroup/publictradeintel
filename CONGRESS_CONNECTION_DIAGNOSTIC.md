# Congress Connection Diagnostic

The Congress feed supports these connection types:

- JSON API
- CSV feed
- official public disclosure files when a documented URL is configured
- authenticated third-party API through environment variables

## Current Default

If `CONGRESS_TRADES_FEED_URL` is not configured, the app reports:

`Saved Data Only`

User-facing message:

`Live congressional disclosures are not connected. Predictions are using saved disclosure records.`

## Admin Diagnostics

Admin diagnostics report:

- provider name
- requested URL presence without exposing secrets
- HTTP status
- content type
- authentication requirement
- parse result
- latest successful refresh
- live record count
- saved fallback record count
- latest disclosure date
- saved data age
- exact failure reason

Secret values are never sent to the frontend.

## Freshness

Congressional disclosures are delayed public records. Short-term models treat them as weak secondary catalysts and apply age decay.
