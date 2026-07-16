const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(app, /function sectorContext/, "sector context helper should exist");
assert.match(app, /Classification/, "sector context should label classification");
assert.match(app, /Sector Score/, "sector score should render");
assert.match(app, /Sector Rank/, "sector rank should render");
assert.match(app, /Bullish In Sector/, "sector bullish percentage should render");
assert.match(app, /Sample Size/, "sector sample size should render");
assert.match(app, /Stock Rank In Sector/, "stock rank within sector should render");
assert.match(app, /Custom Market Group/, "custom market group label should exist");

console.log("Sector context smoke test passed.");

