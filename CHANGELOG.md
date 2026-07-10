# Public Trade Intel Changelog

## Completed Major Phases

### Prediction Scan Flow

- Added prediction scan route.
- Connected frontend scan button to backend prediction generation.
- Created prediction records for multiple timeframes.
- Added smoke testing for the prediction scan flow.

### Technical Analysis

- Added EMA and SMA calculations.
- Added 9 EMA and 20 EMA fields.
- Added VWAP where market data supports volume.
- Added support and resistance detection.
- Added opening range high/low fields.

### Multi-Timeframe Alignment

- Added 2-minute, 5-minute, and 15-minute technical layers.
- Added alignment direction, alignment score, and all-timeframes-aligned flag.
- Added reason summaries for multi-timeframe alignment.

### Setup Detection

- Added 5-minute 9 EMA bounce detection.
- Added break-and-retest setup detection.
- Added setup direction, setup score, and confirmation status.

### Short Squeeze Scanner

- Added short-squeeze signal layer.
- Added squeeze risk, squeeze score, relative volume, VWAP reclaim, resistance breakout, and failed-breakdown fields.
- Supported missing short-interest and float data without failing scans.

### Chart Pattern Recognition

- Added chart pattern signal layer.
- Added bull flag, bear flag, triangles, double top/bottom, wedges, head and shoulders, and inverse head and shoulders recognition.
- Added primary pattern, pattern score, invalidation level, and target level.

### Unified Confidence Scoring

- Added unified prediction score.
- Added unified direction.
- Added confidence tier.
- Added strongest signals, conflicting signals, and final reason summary.

### Quality Guardrails

- Prevented mixed-direction predictions from showing high confidence.
- Prevented very-high confidence when too many conflicts exist.
- Lowered confidence for stale or incomplete market data.
- Added data quality status and notes.

### Prediction Engine Health

- Added authenticated prediction engine health panel.
- Added scan timestamp, tickers scanned, predictions generated, Top 25 counts, data quality counts, average scores, high/low scoring tickers, failed tickers, and ranking sanity checks.
- Separated prediction engine status from market data quality status.

### Configurable Scan Universe

- Added scan universe options for watchlist, S&P 500, Nasdaq-100, ETFs, and combined universe.
- Added custom ticker list support.
- Expanded prediction scan candidate coverage.

### Prediction Scan Settings UI

- Added admin UI section for Prediction Scan Settings.
- Added scan universe dropdown.
- Added custom ticker textarea.
- Added active universe and candidate count display.
- Added save settings action.

