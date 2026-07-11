const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(app, /Broad Market Trend/, "dashboard should show broad market trend");
assert.match(app, /Prediction Universe Bias/, "dashboard should separate prediction universe bias");
assert.match(app, /Prediction Universe Sentiment/, "internal score should be renamed");
assert.doesNotMatch(app, /Fear \/ Greed/, "internal metric should not be labeled Fear / Greed");
assert.doesNotMatch(app, /Bull market/, "candidate scores should not claim bull market");
assert.match(app, /Highest-Scoring Group in Current Scan/, "sector/group strength should be scoped");
assert.match(app, /deeply analyzed securities/, "sector strength should show sample-size language");

console.log("Market overview labels smoke test passed.");
