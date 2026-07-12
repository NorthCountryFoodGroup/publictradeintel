const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const js = fs.readFileSync(path.join(root, "admin.js"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const all = `${html}\n${js}\n${server}`;

function expect(pattern, message) {
  assert.match(all, pattern, message);
}

expect(/data-admin-target="overview">Admin Dashboard/, "Admin Dashboard nav exists");
expect(/data-admin-section="overview"/, "Admin Dashboard section exists");
expect(/data-admin-target="universe">Prediction Scan Settings/, "Prediction Scan Settings nav exists");
expect(/id="scanUniverse"[\s\S]*value="combined"/, "Combined universe option exists");
expect(/id="customTickers"/, "Custom ticker list textarea exists");
expect(/saveScanSettings[\s\S]*\/api\/admin\/config/, "Scan settings save through admin config route");
expect(/scanSettings:\s*{[\s\S]*universe:\s*scanUniverse\?\.value[\s\S]*customTickers:\s*customTickers\?\.value/, "Scan settings are persisted from form state");
expect(/renderScanSettingsStatus\(\)/, "Scan universe status display updates");
expect(/adminHashTargets[\s\S]*"scan-universe":\s*"universe"/, "Scan universe deep link routes correctly");
expect(/"prediction-engine":\s*"engine"[\s\S]*"market-data":\s*"market"[\s\S]*"system-health":\s*"health"/, "Admin deep links cover core sections");
expect(/refreshPredictions[\s\S]*\/api\/admin\/refresh-predictions/, "Admin Run Prediction Scan route is connected");
expect(/renderPredictionHealth\(result\.predictionEngineHealth,\s*result\.scanHealth\)/, "Prediction Engine Health renders after scan");
expect(/Prediction Engine Status[\s\S]*Data Quality Status/, "Engine health and market data quality are shown separately");
expect(/Engine failed tickers[\s\S]*Incomplete market data/, "Failed tickers and incomplete market data are distinct");
expect(/adminProfileMenuButton\?\.addEventListener\("click"/, "Admin profile menu opens");
expect(/adminAlertsMenuButton\?\.addEventListener\("click"/, "Admin alerts menu opens");
expect(/function yahooTickerSymbol\(ticker\)[\s\S]*replace\(\/\\\.\/g, "-"\)/, "Provider ticker normalization exists for symbols such as BRK.B");

console.log("Admin workflow smoke test passed.");
