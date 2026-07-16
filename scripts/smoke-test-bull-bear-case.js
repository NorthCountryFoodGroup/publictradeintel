const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(app, /function briefBullCaseFactors/, "Bull Case should be generated from prediction fields");
assert.match(app, /function briefBearCaseFactors/, "Bear Case should be generated from prediction fields");
assert.match(app, /Bullish Multi-Timeframe Alignment/, "Bull Case should include supported alignment");
assert.match(app, /Price Above 9 EMA/, "Bull Case should include supported EMA signal");
assert.match(app, /Reasons to Wait/, "mixed evidence should use Reasons to Wait wording");
assert.match(app, /Near Resistance/, "Bear Case should include supported resistance concern");
assert.match(app, /Missing Critical Data/, "Bear Case should include real missing-data concern");
assert.match(app, /renderEvidenceList/, "Bull/Bear factors should show title, explanation, strength, source");

console.log("Bull/Bear Case smoke test passed.");

