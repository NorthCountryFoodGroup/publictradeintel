const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");

assert.match(html, /<option value="beginner">Beginner Picks<\/option>/, "Beginner investor view should exist");
assert.match(app, /beginnerQualification\(item\)\.qualifies/, "Beginner view should apply qualification logic");
assert.match(app, /Beginner rank eligible/, "Beginner card explanation should render");
assert.match(app, /clarity, liquidity, quality, and risk screens/, "Beginner summary should mention safeguards");

console.log("Beginner Stocks to Buy smoke test passed.");
