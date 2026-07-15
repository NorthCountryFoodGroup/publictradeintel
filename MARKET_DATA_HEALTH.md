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

## VIX Handling

VIX is supplemental. If VIX fails, the app shows Volatility Index Unavailable and logs the provider error. Missing VIX does not make market data unavailable and does not stop stock prediction processing.
