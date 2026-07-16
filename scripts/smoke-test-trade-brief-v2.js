const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(app, /AI Trade Brief 2\.0/, "Trade Brief 2.0 header should render");
assert.match(app, /Executive Research Summary/, "executive research summary should exist");
assert.match(app, /Current \/ Reference Price/, "top header should show reference price");
assert.match(app, /Price Timestamp/, "top header should show price timestamp");
assert.match(app, /Model Version/, "top header should show model version");
assert.match(app, /Back to Opportunities/, "brief should include back navigation");
assert.match(app, /Previous result/, "brief should include previous result navigation");
assert.match(app, /Next result/, "brief should include next result navigation");
assert.match(app, /Share Report <small>Coming Soon/, "share report should remain Coming Soon");
assert.match(app, /Not reliably calculated/, "unavailable trade plan values should be honest");

console.log("Trade Brief V2 smoke test passed.");

