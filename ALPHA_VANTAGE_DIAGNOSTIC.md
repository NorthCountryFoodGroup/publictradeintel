# Alpha Vantage Diagnostic

## Purpose

This diagnostic explains why Alpha Vantage can show 0% market-data coverage in production and how the app now reports that condition honestly.

## Current Provider Role

Alpha Vantage is no longer treated as the primary quote source for broad scans. Provider priority is now:

1. Yahoo
2. Alpha Vantage
3. Cached snapshot
4. Saved quote fallback

Alpha Vantage is attempted only when Yahoo does not return usable quote data and `ALPHA_VANTAGE_API_KEY` is configured.

## What 0% Coverage Means

Alpha Vantage 0% coverage can now be caused by one of these reported conditions:

- Disabled: `ALPHA_VANTAGE_API_KEY` is missing.
- Rate Limited: Alpha Vantage returned rate-limit or premium-endpoint messages.
- Failed: Alpha Vantage was attempted but returned no usable quotes.
- Delayed: Alpha Vantage returned data, but timestamps were outside the live/recent threshold.
- Healthy with 0 requests: Yahoo satisfied the quote request before fallback was needed.

## Reported Metrics

The Admin provider scorecard now reports:

- Requests attempted
- Requests succeeded
- Requests failed
- Error messages
- HTTP/provider status category
- Rate-limit responses
- Timeout count
- Average latency
- Coverage percentage
- Success rate
- Fallback usage
- Last successful request
- Last failure

The Provider Request Log records provider, request, latency, success, failure, retry, cache, fallback, and symbol count newest-first.

## Production Root-Cause Guidance

If Alpha Vantage shows:

- `Disabled`: add or rotate `ALPHA_VANTAGE_API_KEY` in Render.
- `Rate Limited`: the key is valid but the plan cannot support the current scan cadence.
- `Failed`: inspect the request log for endpoint, parsing, unsupported symbol, or provider-response errors.
- `Healthy` with no attempted requests: Yahoo served the scan, so Alpha Vantage was not needed.

## Recommendation

Keep Alpha Vantage as an optional secondary provider, not the primary provider for 2,500-symbol broad discovery or 600-symbol deep analysis. The free tier is not suitable for high-volume production scans. If Alpha Vantage is upgraded to a paid plan, the provider scorecard will show whether it contributes enough successful fallback quotes to justify keeping it enabled.
