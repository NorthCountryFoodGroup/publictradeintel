const assert = require("node:assert/strict");

function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 12);
}

function createWatchlist(name) {
  return {
    id: `${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    name,
    tickers: [],
  };
}

function addTicker(list, ticker) {
  const normalized = normalizeTicker(ticker);
  if (normalized && !list.tickers.includes(normalized)) list.tickers.push(normalized);
}

function removeTicker(list, ticker) {
  const normalized = normalizeTicker(ticker);
  list.tickers = list.tickers.filter((item) => item !== normalized);
}

function watchlistHealth(list, predictions, alerts) {
  const rows = list.tickers.map((ticker) => {
    const prediction = predictions.find((item) => normalizeTicker(item.ticker) === ticker);
    const score = Number(prediction?.unifiedPredictionScore) || 0;
    const scoreChange = Number(prediction?.scoreChange) || 0;
    const confidence = prediction?.confidenceTier || "low";
    const dataQuality = prediction?.dataQualityStatus || "partial";
    const badges = [];
    if (scoreChange > 2) badges.push("Improving");
    if (scoreChange < -2) badges.push("Weakening");
    if (prediction?.recommendationChanged) badges.push("Changed");
    if (["partial", "stale", "failed"].includes(dataQuality)) badges.push("Needs Attention");
    if (alerts.some((alert) => normalizeTicker(alert.ticker) === ticker && alert.active !== false)) badges.push("Alert");
    return { ticker, score, scoreChange, confidence, dataQuality, direction: prediction?.unifiedDirection || "neutral", badges };
  });
  const averageUnifiedScore = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0;
  const highConfidenceCount = rows.filter((row) => ["high", "very high"].includes(row.confidence)).length;
  const weakeningCount = rows.filter((row) => row.badges.includes("Weakening")).length;
  const dataIssueCount = rows.filter((row) => ["partial", "stale", "failed"].includes(row.dataQuality)).length;
  const bullish = rows.filter((row) => row.direction === "bullish").length;
  const bearish = rows.filter((row) => row.direction === "bearish").length;
  return {
    healthScore: Math.max(0, Math.min(100, averageUnifiedScore + highConfidenceCount * 3 - weakeningCount * 6 - dataIssueCount * 4)),
    direction: bullish > bearish ? "bullish" : bearish > bullish ? "bearish" : rows.length ? "mixed" : "neutral",
    averageUnifiedScore,
    highConfidenceCount,
    weakeningCount,
    dataIssueCount,
    reasonSummary: `${list.name} averages ${averageUnifiedScore}/100.`,
    rows,
  };
}

const watchlist = createWatchlist("Smoke Test");
addTicker(watchlist, "nvda");
addTicker(watchlist, "msft");
assert.deepEqual(watchlist.tickers, ["NVDA", "MSFT"]);

removeTicker(watchlist, "msft");
assert.deepEqual(watchlist.tickers, ["NVDA"]);

const alerts = [
  { id: "a1", ticker: "NVDA", type: "scoreAbove", threshold: "75", active: true, createdAt: new Date().toISOString() },
];
const health = watchlistHealth(
  watchlist,
  [
    {
      ticker: "NVDA",
      unifiedPredictionScore: 82,
      scoreChange: 5,
      confidenceTier: "high",
      dataQualityStatus: "good",
      unifiedDirection: "bullish",
      recommendationChanged: true,
    },
  ],
  alerts
);

assert.equal(typeof health.healthScore, "number");
assert.equal(health.direction, "bullish");
assert.equal(health.averageUnifiedScore, 82);
assert.equal(health.highConfidenceCount, 1);
assert.ok(health.rows[0].badges.includes("Improving"));
assert.ok(health.rows[0].badges.includes("Changed"));
assert.ok(health.rows[0].badges.includes("Alert"));
assert.equal(alerts.length, 1);

console.log("Watchlists smoke test passed.");
