# Market Data Health

Market data health is separate from prediction-engine health.

## Availability Thresholds

- Complete: at least 95% of analyzed candidates have critical required fields.
- Good: at least 90% have critical fields.
- Partial: 70% to 89.99% have critical fields.
- Degraded: 40% to 69.99% have critical fields.
- Unavailable: fewer than 40% have critical fields or the provider returned no usable data.

Critical fields include current/reference price, quote timestamp, usable volume, and enough technical data for the prediction layer. Market cap, VIX, Congress feed freshness, and one-off optional fields are not critical for stock-level availability.

## Freshness Rules

Freshness is based on the distribution of underlying market timestamps, not provider fetch time.

- Live: during market hours, the majority of required quote data is within the live threshold.
- Recent: the majority is within the modest delay threshold.
- Delayed: the majority reflects a recent completed interval but is behind current market time.
- Stale: the majority is older than the accepted threshold.
- Unavailable: no usable underlying timestamp exists.

Each scan stores median quote age, 90th-percentile quote age, oldest quote age, newest quote age, percentage within live threshold, and percentage within recent threshold.

## Market Data Quality Score

The primary market-data quality indicator is a 0-100 score:

- Quote coverage: 35%
- Freshness: 25%
- Provider health: 20%
- Fallback usage: 10%
- Missing critical fields: 10%

Labels:

- Excellent: 85-100
- Good: 70-84
- Fair: 50-69
- Poor: below 50

This score is separate from prediction-engine health. The prediction engine can be healthy while market data quality is fair or partial.

## Provider Priority

Quote provider priority is:

1. Yahoo
2. Alpha Vantage, only when `ALPHA_VANTAGE_API_KEY` is configured and Yahoo does not return usable data
3. Cached snapshot
4. Saved quote fallback

Each provider reports Healthy, Partial, Degraded, Failed, Not Needed, Rate Limited, or Disabled.

Provider status is based on the provider's own attempted success rate and role in the completed scan. A provider can have low quote contribution and still be correctly labeled Not Needed if the scan reused cached fresh data or another provider supplied the final prediction data.

Provider-specific quote coverage must not be displayed as total market-data availability.

## VIX Handling

VIX is supplemental. If VIX fails, the app shows Volatility Index Unavailable and logs the provider error. Missing VIX does not make market data unavailable and does not stop stock prediction processing.
