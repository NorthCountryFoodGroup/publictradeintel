const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

[
  "Price & Momentum",
  "Technical Trend",
  "Multi-Timeframe Alignment",
  "Setup Confirmation",
  "Chart Pattern",
  "Volume",
  "Sector / Market Regime",
  "News",
  "Policy",
  "Congress",
  "Fundamentals",
  "Data Quality",
].forEach((label) => assert.match(app, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${label} agreement category should exist`));

assert.match(app, /Unavailable/, "signal agreement should support Unavailable");
assert.match(app, /unavailable: categories\.filter/, "unavailable signals should be tracked separately");
assert.doesNotMatch(app, /Unavailable[\s\S]{0,60}Negative/, "unavailable should not be hard-coded as negative");

console.log("Signal Agreement smoke test passed.");

