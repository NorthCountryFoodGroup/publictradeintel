# PublicTradeIntel UX language guide

Primary copy leads with meaning rather than implementation. It uses ordinary investing language, one main idea per sentence, restrained capitalization, and avoids unexplained acronyms or schema terms. Technical detail remains available under **View details**, **Technical details**, **Forecast details**, or **What does this mean?**

## Core rules

1. “Qualified” means a stock has enough current evidence to participate safely in ranking and recommendation evaluation. It does not mean buy, purchase, or trade recommendation. Primary UI says “Enough reliable data” and displays recommendation categories separately.
2. Analysis, evidence eligibility, recommendation state, confidence, direction, and risk are separate concepts.
3. Uncertainty is direct: “Not enough reliable data to make a call.” When the system cannot make a reliable recommendation, it says so plainly.
4. Stale, delayed, unavailable, fallback, sample, or cached data is never described as current or live unless it passes the existing freshness semantics.
5. Market session (open/closed) is separate from market data for an analysis (live/partial/stale/unavailable).
6. Scores retain exact values and add a display-only interpretation. These bands do not alter prediction-engine thresholds.
7. Confidence describes model/evidence agreement, not statistical certainty. Risk describes detected model-risk conditions, not guaranteed future loss.
8. Sample frequency is not probability. “50% of forecast paths finished higher” is valid; “50% chance of profit” is not valid without calibration.
9. Kronos is always an independent shadow/research forecast with zero recommendation influence. Deterministic-adapter output is identified as development/test output.
10. PublicTradeIntel research is not personalized financial advice.

## Central terms

| Primary UI | Technical detail |
| --- | --- |
| Stocks analyzed | Analytical records |
| Research saved | Research records stored |
| Enough reliable data | Qualified / meets evidence requirements |
| Market data | Market Data Availability |
| Data quality | Market Data Quality / Data Reliability |
| Data freshness | Market Data Freshness |
| Market data source | Primary Market Data Provider |
| Overall outlook | Prediction Universe Bias |
| Outlook strength | Prediction Universe Sentiment |
| Strongest area | Highest-Scoring Qualified Group |
| Overall score | Unified Score |
| Chart setup | Technical Snapshot |
| Still developing | Forming Setup |
| Price that changes our view | Invalidation / Stop |
| Recent saved data used | Cached Fresh Data Reused |
| Backup data used | Fallback Usage |

## Display-only interpretation

Overall and component scores use: 85–100 Very strong, 75–84 Strong, 60–74 Moderate, 40–59 Limited, and 0–39 Weak. Exact values remain visible.

- High confidence: Most of the available evidence agrees.
- Medium confidence: Some important signals disagree or are missing.
- Low confidence: Evidence is limited or conflicting.
- Lower model risk: Fewer risk flags were detected relative to other analyzed stocks.
- Moderate model risk: Some meaningful risk flags are present.
- Higher model risk: Several important risk flags are present.
- Live: Market data is current enough for this analysis.
- Partial: Some required market data is missing or delayed.
- Stale: Market data is older than the allowed freshness window.
- Unavailable: Current market data was not available.

Primary surfaces answer: What happened? What does it mean? Is it reliable? What deserves attention? Why? What could change the conclusion? Exact providers, coverage, timestamps, fallback/cache use, thresholds, ranks, indicators, and model provenance remain available in technical details.
