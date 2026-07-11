const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "app.js"), "utf8");

function expect(pattern, message) {
  assert.match(`${html}\n${js}`, pattern, message);
}

expect(/data-page-target="dashboard"[\s\S]*data-page-target="market"[\s\S]*data-page-target="predictions"/, "Discover workflow navigation exists");
expect(/id="marketOverviewGrid"/, "Dashboard market overview container exists");
expect(/id="marketSummaryGrid"/, "Markets summary container exists");
expect(/id="predictionGrid"/, "Opportunities prediction grid exists");
expect(/id="predictionSort"/, "Opportunities sorting exists");
expect(/data-prediction-layout="cards"/, "Opportunities card view exists");
expect(/data-prediction-layout="table"/, "Opportunities table view exists");
expect(/function runGlobalSearch\(\)/, "Global search is wired to a real workflow");
expect(/function openTradeBrief\(ticker\)/, "Predictions can open AI Trade Briefs");
expect(/data-view-brief="\$\{escapeHtml\(item\.ticker\)\}"/, "Prediction cards include View Trade Brief actions");
expect(/data-add-watchlist="\$\{escapeHtml\(item\.ticker\)\}"/, "Trade Brief and prediction cards can add tickers to watchlists");
expect(/function addTickerToActiveWatchlist\(ticker\)/, "Shared watchlist add workflow exists");
expect(/function addAlertRuleForTicker\(ticker, source = "alerts"\)/, "Trade Brief can create alert rules directly");
expect(/data-create-alert-for="\$\{escapeHtml\(item\.ticker\)\}"/, "Trade Brief includes Create Alert action");
expect(/No predictions yet[\s\S]*Run prediction scan/, "Predictions empty state includes retry action");
expect(/Prediction scan complete\.[\s\S]*records generated/, "Prediction scan success state is clear");
expect(/predictionErrorMessage\(error\)/, "Prediction scan error messages are normalized");
expect(/function renderWatchlists\(\)/, "Watchlists render path exists");
expect(/function renderAlertsCenter\(\)/, "Alerts render path exists");
expect(/function renderPerformanceCenter\(\)/, "AI Performance render path exists");
expect(/history\[0\]\.resolved|data-alert-dismiss/, "Alerts can be dismissed/resolved");

console.log("Core workflows smoke test passed.");
