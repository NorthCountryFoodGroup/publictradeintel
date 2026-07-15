const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const doc = fs.readFileSync(path.join(root, "OPPORTUNITIES_HUB.md"), "utf8");

assert.match(app, /function investmentAccessPreview/, "investment access preview helper should exist");
assert.match(app, /wholeShares = Math\.floor\(amount \/ price\)/, "preview should calculate whole shares");
assert.match(app, /fractionalRequired/, "preview should report fractional-share requirement");
assert.match(app, /oneSharePercent/, "preview should report one-share percentage of selected amount");
assert.match(app, /not a portfolio recommendation/i, "card copy should keep preview from sounding like advice");
assert.match(html, /Investment Amount/, "preview control should exist");
assert.match(html, /Custom amount/, "custom investment amount control should exist");
assert.match(doc, /convenience calculation/i, "doc should label preview as convenience calculation");

console.log("Investment access preview smoke test passed.");
