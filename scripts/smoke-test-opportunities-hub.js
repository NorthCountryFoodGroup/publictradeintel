const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const doc = fs.readFileSync(path.join(root, "OPPORTUNITIES_HUB.md"), "utf8");

[
  "opportunityInvestorView",
  "opportunityTimeframe",
  "opportunityPriceBand",
  "opportunityRankingView",
  "investmentAmountPreview",
  "investmentAmountCustom",
].forEach((id) => assert.match(html, new RegExp(`id="${id}"`), `${id} control should exist`));

assert.match(html, /Opportunities Hub/, "Predictions page should include Opportunities Hub");
assert.match(html, /Beta/, "Opportunities Hub should be marked beta");
assert.match(app, /function opportunityRowsForHub/, "hub filtering should be centralized");
assert.match(app, /renderCompactPredictionCard/, "hub should render compact prediction cards");
assert.match(app, /rankMetadataForTicker/, "Trade Brief should be able to read hub rank metadata");
assert.match(doc, /does not change prediction scoring/i, "hub doc should say scoring is unchanged");

console.log("Opportunities Hub smoke test passed.");

