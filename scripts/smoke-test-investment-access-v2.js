const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");

for (const amount of ["25", "50", "100", "250", "500", "1000", "custom"]) {
  assert.match(html, new RegExp(`value="${amount}"`), `investment amount ${amount} should exist`);
}
assert.match(app, /function stocksToBuyInvestmentPreview/, "Stocks to Buy investment preview should exist");
assert.match(app, /wholeShares/, "preview should show whole shares");
assert.match(app, /fractionalRequired/, "preview should show fractional requirement");
assert.match(app, /remainingCash/, "preview should show remaining cash");
assert.match(app, /not position-size advice/i, "preview should avoid advice framing");

console.log("Investment access v2 smoke test passed.");
