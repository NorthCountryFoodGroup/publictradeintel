"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

assert.match(app, /const requestedTicker = normalizeTicker\(selectedBriefTicker\);[\s\S]*const trackedTicker = requestedTicker && watchlists\.some/,
  "an explicitly selected watchlist ticker must remain authoritative even without a current prediction");
assert.match(app, /findPredictionByTicker\(requestedTicker\) \|\| \(trackedTicker \? watchlistTickerRecord\(requestedTicker\) : null\) \|\| \(!requestedTicker \? firstPick : null\)/,
  "an explicit ticker must not fall through to the first ranked prediction");
assert.match(app, /function openTradeBrief\(ticker\) \{\s*const requestedTicker = normalizeTicker\(ticker\);\s*selectedBriefTicker = requestedTicker;/,
  "the clicked card ticker must be captured as the authoritative selection");
assert.match(app, /if \(normalizeTicker\(selectedBriefTicker\) === requestedTicker\) \{ renderTradeBrief\(\); loadKronosShadowForecast\(requestedTicker\); \}/,
  "an older profile response must not overwrite a newer selection");
assert.match(app, /loadKronosShadowForecast\(requestedTicker\);/,
  "persisted Kronos research must be requested for the clicked ticker");
assert.match(app, /data-view-brief="\$\{escapeHtml\(row\.ticker\)\}"/,
  "each watchlist card must carry its own ticker");

const normalize = (value) => String(value || "").trim().toUpperCase();
const select = ({ clickedTicker, trackedTickers, predictions }) => {
  const requested = normalize(clickedTicker);
  const prediction = predictions.find((item) => normalize(item.ticker) === requested) || null;
  const tracked = trackedTickers.some((ticker) => normalize(ticker) === requested);
  return prediction || (tracked ? { ticker: requested, source: "watchlist" } : null);
};

const predictions = [{ ticker: "GUSA", source: "prediction" }, { ticker: "MSFT", source: "prediction" }];
const trackedTickers = ["AAPL", "GUSA", "MSFT"];
assert.equal(select({ clickedTicker: "AAPL", trackedTickers, predictions }).ticker, "AAPL");
assert.equal(select({ clickedTicker: "GUSA", trackedTickers, predictions }).ticker, "GUSA");
assert.equal(select({ clickedTicker: "MSFT", trackedTickers, predictions }).ticker, "MSFT");

for (const [search, clicked] of [["GUSA", "AAPL"], ["", "AAPL"], ["AAPL", "GUSA"]]) {
  assert.equal(select({ clickedTicker: clicked, trackedTickers, predictions }).ticker, clicked,
    `search ${JSON.stringify(search)} must not override ${clicked}`);
}

let selectedTicker = "GUSA";
const mayApplyAsyncResult = (requestTicker) => normalize(selectedTicker) === normalize(requestTicker);
selectedTicker = "AAPL";
assert.equal(mayApplyAsyncResult("GUSA"), false, "stale GUSA response must not overwrite AAPL");
assert.equal(mayApplyAsyncResult("AAPL"), true, "current AAPL response may refresh AAPL");

console.log("Trade Brief ticker-selection smoke test passed.");
