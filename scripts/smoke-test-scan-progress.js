const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

[
  "aiDashboardBriefStatus",
  "aiDashboardBrief",
  "scanProgressStage",
  "scanProgressBar",
  "scanProgressMessage",
  "scanProgressSummaryGrid",
].forEach((id) => {
  assert.match(html, new RegExp(`id="${id}"`), `${id} should exist in dashboard markup`);
  assert.match(app, new RegExp(id), `${id} should be wired in app.js`);
});

[
  "Preparing scan",
  "Screening broad universe",
  "Selecting deep-analysis candidates",
  "Refreshing market and news data",
  "Analyzing candidates",
  "Building timeframe rankings",
  "Validating prediction results",
  "Saving predictions",
  "Scan complete",
  "Scan failed - Retry",
].forEach((stage) => {
  assert.match(app, new RegExp(stage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${stage} stage should be visible`);
});

assert.match(app, /function setScanUi/, "scan UI updater should exist");
assert.match(app, /runPredictionScan\.active/, "scan button should prevent duplicate scan submissions");
assert.match(app, /publicTradeIntelLastSuccessfulScan/, "last successful scan should be stored locally for freshness context");
assert.match(app, /renderDashboardBrief/, "dashboard should render AI market brief");
assert.match(app, /pickDistinctOpportunity/, "dashboard should diversify opportunity roles");
assert.match(css, /\.scan-progress-track/, "scan progress CSS should exist");
assert.match(css, /\.ai-market-brief-card/, "AI market brief CSS should exist");
assert.match(server, /scanHealth/, "backend should return scan health metadata");
assert.match(server, /durationMs/, "scan health should include duration");
assert.equal(packageJson.scripts["smoke:scan-progress"], "node scripts/smoke-test-scan-progress.js");

console.log("Scan progress smoke test passed.");
