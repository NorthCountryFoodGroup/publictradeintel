const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(app, /function marketRegimeDiagnostic/, "market regime diagnostic should exist");
assert.match(app, /Trending Bullish/, "regime should include Trending Bullish");
assert.match(app, /Trending Bearish/, "regime should include Trending Bearish");
assert.match(app, /Sideways \/ Range-Bound/, "regime should include range-bound");
assert.match(app, /Mixed \/ Transitioning/, "regime should include mixed state");
assert.match(app, /Diagnostic only\. This sprint does not dynamically change prediction weights/, "regime should not alter scoring weights");
assert.doesNotMatch(app, /marketRegimeDiagnostic[\s\S]*unifiedPredictionScore\s*=/, "regime diagnostic must not modify unified scores");

console.log("Market regime diagnostic smoke test passed.");

