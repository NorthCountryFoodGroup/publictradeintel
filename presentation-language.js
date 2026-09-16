(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PublicTradeIntelLanguage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const TERMS = Object.freeze({
    analyzed: { primary: "Stocks analyzed", technical: "Analytical records" },
    storedResearch: { primary: "Research saved", technical: "Research records stored" },
    qualified: { primary: "Enough reliable data", technical: "Meets current evidence requirements" },
    qualifiedCount: { primary: "Stocks with enough reliable data", technical: "Qualified count" },
    usableMarketData: { primary: "Current market data available", technical: "Usable market-data records" },
    marketDataAvailability: { primary: "Market data", technical: "Market Data Availability" },
    marketDataQuality: { primary: "Data quality", technical: "Market Data Quality" },
    marketDataFreshness: { primary: "Data freshness", technical: "Market Data Freshness" },
    marketDataProvider: { primary: "Market data source", technical: "Primary Market Data Provider" },
    predictionBias: { primary: "Overall outlook", technical: "Prediction Universe Bias" },
    predictionSentiment: { primary: "Outlook strength", technical: "Prediction Universe Sentiment" },
    strongestGroup: { primary: "Strongest area", technical: "Highest-Scoring Qualified Group" },
    unifiedScore: { primary: "Overall score", technical: "Unified Score" },
    technicalSnapshot: { primary: "Chart setup", technical: "Technical Snapshot" },
    dataReliability: { primary: "Data quality", technical: "Data Reliability" },
    formingSetup: { primary: "Still developing", technical: "Forming Setup" },
    invalidation: { primary: "Price that changes our view", technical: "Invalidation / Stop" },
    cacheReuse: { primary: "Recent saved data used", technical: "Cached Fresh Data Reused" },
    fallbackUsage: { primary: "Backup data used", technical: "Fallback Usage" },
    insufficient_evidence: { primary: "Not enough reliable data to make a call", technical: "Insufficient evidence" },
    stale: { primary: "Market data is out of date", technical: "Stale" },
    provider_unavailable: { primary: "Market data provider unavailable", technical: "Provider unavailable" },
  });
  const SCORE_BANDS = Object.freeze([{ minimum: 85, label: "Very strong" }, { minimum: 75, label: "Strong" }, { minimum: 60, label: "Moderate" }, { minimum: 40, label: "Limited" }, { minimum: 0, label: "Weak" }]);
  function scoreBand(value) { const score = Number(value); return Number.isFinite(score) ? SCORE_BANDS.find((band) => score >= band.minimum).label : "Unavailable"; }
  function score(value) { const number = Number(value); return Number.isFinite(number) ? `${Math.round(number)}/100 — ${scoreBand(number)}` : "Unavailable"; }
  function confidence(value) { const level = String(value || "").toLowerCase(); if (level.includes("high")) return { label: "High confidence", explanation: "Most of the available evidence agrees." }; if (level.includes("medium")) return { label: "Medium confidence", explanation: "Some important signals disagree or are missing." }; return { label: "Low confidence", explanation: "Evidence is limited or conflicting." }; }
  function risk(value) { const normalized = String(value ?? "").toLowerCase(); const scoreValue = Number(value); if (/low|lower/.test(normalized)) return { label: "Lower model risk", explanation: "Fewer risk flags were detected relative to other analyzed stocks." }; if (/high|higher|extreme/.test(normalized)) return { label: "Higher model risk", explanation: "Several important risk flags are present." }; if (/moderate|medium/.test(normalized)) return { label: "Moderate model risk", explanation: "Some meaningful risk flags are present." }; if (!Number.isFinite(scoreValue)) return { label: "Model risk unavailable", explanation: "The record does not contain enough information to compare model risk." }; if (scoreValue < 40) return { label: "Lower model risk", explanation: "Fewer risk flags were detected relative to other analyzed stocks." }; if (scoreValue < 70) return { label: "Moderate model risk", explanation: "Some meaningful risk flags are present." }; return { label: "Higher model risk", explanation: "Several important risk flags are present." }; }
  function dataQuality(value) { const state = String(value || "unavailable").toLowerCase(); if (["live", "available", "good", "complete"].includes(state)) return { label: "Live", explanation: "Market data is current enough for this analysis." }; if (state === "stale") return { label: "Stale", explanation: "Market data is older than the allowed freshness window." }; if (["partial", "recent", "delayed"].includes(state)) return { label: "Partial", explanation: "Some required market data is missing or delayed." }; return { label: "Unavailable", explanation: "Current market data was not available." }; }
  function recommendation(value) { const state = String(value || "").toLowerCase(); if (/buy|possible trade/.test(state)) return { label: "Possible trade", explanation: "Meets the current evidence and setup requirements. Review the Trade Brief before acting." }; if (/avoid|sell|bear/.test(state)) return { label: "Avoid / caution", explanation: "Important negative signals are present. Review the risks and evidence before acting." }; return { label: "Watch only", explanation: "Interesting, but one or more conditions are not strong enough yet." }; }
  function emptyState({ hasScan = false, outcome = "", sectionSpecific = false, recommendationCount = 0 } = {}) {
    if (sectionSpecific) return { title: "No stocks matched this ranking", explanation: "Try another timeframe or ranking view." };
    if (!hasScan) return { title: "No scan yet", explanation: "Run a scan to look for opportunities." };
    if (String(outcome).toUpperCase() === "FAILED") return { title: "Scan failed", explanation: "The scan could not safely complete." };
    if (String(outcome).toUpperCase() === "DEGRADED") return { title: "No recommendation", explanation: "Not enough reliable market data was available in the latest scan." };
    if (!recommendationCount) return { title: "No recommendation right now", explanation: "No stocks met the current requirements in the latest scan." };
    return { title: "Recommendations available", explanation: "Review the current results and supporting evidence." };
  }
  function direction(value) { const state = String(value || "mixed").toLowerCase(); if (state === "bullish") return { label: "Bullish", explanation: "More of the modeled price behavior leans upward." }; if (state === "bearish") return { label: "Bearish", explanation: "More of the modeled price behavior leans downward." }; return { label: "Mixed", explanation: "The forecast paths do not point clearly in one direction." }; }
  function agreement(value) { const state = String(value || "unavailable").toLowerCase(); if (state.includes("partial")) return { label: "Partially aligned", explanation: "The two models agree on some parts of the outlook but not all." }; if (state.includes("align")) return { label: "Aligned", explanation: "PublicTradeIntel and Kronos currently point in the same direction." }; if (state.includes("conflict") || state.includes("diverg")) return { label: "Conflicting", explanation: "PublicTradeIntel and Kronos currently point in different directions." }; return { label: "Unavailable", explanation: "Not enough comparable information is available yet." }; }
  return { TERMS, SCORE_BANDS, scoreBand, score, confidence, risk, dataQuality, recommendation, emptyState, direction, agreement };
});
