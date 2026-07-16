const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(app, /function rankingExplanation/, "ranking explanation helper should exist");
assert.match(app, /signalContribution|signalContributions|modelScores/, "ranking explanation should use existing contribution fields");
assert.match(app, /Overall Rank/, "overall rank should render");
assert.match(app, /Timeframe Rank/, "timeframe rank should render");
assert.match(app, /Price-Band Rank/, "price-band rank should render");
assert.match(app, /Beginner Picks Rank/, "Beginner Picks rank should render when applicable");
assert.match(app, /Penny & Speculative Rank/, "Penny & Speculative rank should render when applicable");
assert.match(app, /Largest negative contribution/, "largest negative contribution should render");
assert.match(app, /What Limited The Score/, "score limiter section should render");

console.log("Ranking explanation smoke test passed.");

