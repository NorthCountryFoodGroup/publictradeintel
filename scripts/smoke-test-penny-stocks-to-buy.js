const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");

assert.match(html, /Penny &amp; Speculative/, "Penny and Speculative investor view should exist");
assert.match(app, /pennySpeculativeQualification\(item\)\.qualifies/, "Penny view should apply qualification logic");
assert.match(app, /high volatility and liquidity risk/i, "Penny warning should stay visible");
assert.match(app, /Penny & Speculative view is high-risk research/, "Penny summary should mention research-only framing");

console.log("Penny Stocks to Buy smoke test passed.");
