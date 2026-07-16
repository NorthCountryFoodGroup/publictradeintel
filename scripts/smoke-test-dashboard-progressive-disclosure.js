const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

["scan-details", "market-overview", "engine-details", "watchlist-congress", "policy-performance"].forEach((id) => {
  assert.match(html, new RegExp(`data-dashboard-disclosure="${id}"`), `${id} dashboard disclosure should exist`);
});

assert.match(html, /Today's Opportunities/, "Top Opportunities should remain visible by default");
assert.match(app, /function initDashboardDisclosures/, "dashboard disclosure state helper should exist");
assert.match(app, /localStorage\.setItem\(key, detail\.open \? "open" : "closed"\)/, "dashboard disclosure state should persist");

console.log("Dashboard progressive disclosure smoke test passed.");

