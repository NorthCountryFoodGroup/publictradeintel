# Trade Brief 2.0

Trade Brief 2.0 turns each completed prediction into a professional research report.

It answers:

- Why the stock was selected.
- Why the user might wait or avoid it.
- What could improve the outlook.
- What would invalidate the outlook.
- How reliable the underlying data is.

Trade Brief 2.0 does not change prediction scoring, ranking weights, provider integrations, or universe size. It is a presentation layer over the selected prediction, selected timeframe, completed scan metadata, and stored history.

## Main Sections

- Header: ticker, company, price, timestamp, timeframe, score, recommendation, confidence, direction, risk, data quality, data freshness, model version, and last updated.
- Executive Research Summary: concise natural-language summary using verified fields only.
- Bull Case: strongest supported positive signals.
- Reasons to Wait / Bear Case: verified risks and constraints.
- What Would Change The Outlook: invalidation and improvement conditions without fabricated levels.
- Trade Plan: entry, stop, targets, risk/reward, and position status with unavailable values labeled honestly.
- Signal Agreement: positive, neutral, negative, and unavailable signal categories.
- Ranking Explanation: rank, previous rank, rank change, score change, contribution reasons, and negative contribution.
- Market Regime Diagnostic: diagnostic only; no adaptive weighting in this sprint.
- Sector Context: sector/custom group context and sample size.
- Confidence Trend: stored scan history only.
- Data Reliability: availability, freshness, provider, cache, fallback, and missing fields.
- Consistency Audit: checks ticker, timeframe, rank metadata, score, and model version.

