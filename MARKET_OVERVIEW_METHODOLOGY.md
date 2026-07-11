# Market Overview Methodology

The app separates external market data from prediction-universe data.

## Broad Market Trend

Uses external market quote diagnostics when available:

- S&P 500 exact index: `^GSPC`
- S&P 500 proxy: `SPY`
- Nasdaq Composite exact index: `^IXIC`
- Nasdaq-100 proxy: `QQQ`
- Dow exact index: `^DJI`
- Dow proxy: `DIA`
- Russell 2000 exact index: `^RUT`
- Russell 2000 proxy: `IWM`
- Volatility index: `^VIX`

ETF proxies are labeled as proxies. The app does not label `SPY`, `QQQ`, `DIA`, or `IWM` as exact cash indexes.

## Prediction Universe Bias

Uses the stocks actually screened and deeply analyzed by the prediction engine.

Possible values:

- Bullish
- Bearish
- Mixed
- Neutral

## Prediction Universe Sentiment

This replaces the old Fear / Greed wording.

It is an internal estimate based on unified prediction scores only. It does not claim to use external breadth, volatility, or macro data unless those sources are connected and explicitly shown.

## Sector Strength

Sector/group strength is scoped as:

`Highest-Scoring Group in Current Scan`

It reports sample count and average score from deeply analyzed securities. It is not presented as definitive whole-market sector leadership.
