const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const doc = fs.readFileSync(path.join(root, "BEGINNER_PICKS.md"), "utf8");

assert.match(app, /function beginnerQualification/, "Beginner Picks qualification function should exist");
assert.match(app, /isExchangeListed/, "Beginner Picks should require exchange-listed candidates");
assert.match(app, /latestUnderlyingQuoteAt/, "Beginner Picks should require a usable quote timestamp");
assert.match(app, /confidenceRank\(item\.confidenceTier\) < 2/, "Beginner Picks should require at least medium confidence");
assert.match(app, /unifiedDirection[\s\S]*mixed/, "Beginner Picks should reject mixed direction");
assert.match(app, /Extreme/, "Beginner Picks should reject extreme risk");
assert.match(app, /conflicts\.length > 2/, "Beginner Picks should reject too many conflicts");
assert.match(html, /value="beginner">Beginner Picks/, "Beginner Picks option should exist");
assert.match(doc, /not to imply that a stock is safe/i, "Beginner Picks doc should include safety caveat");

console.log("Beginner Picks smoke test passed.");

