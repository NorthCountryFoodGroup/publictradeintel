const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const server = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

assert.match(server, /rankStocksToBuyRows\(predictions, timeframe, category/, "server should rank each category directly from predictions");
assert.doesNotMatch(server, /top25.*filter.*priceCategory/s, "category rankings should not be filtered from an existing Top 25 list");
assert.match(app, /fallbackStocksToBuyCenter[\s\S]*predictions[\s\S]*filter\(.*category\.test/s, "fallback should rank from all predictions by category");
assert.match(app, /qualifiedCount: allRows\.length/, "fallback should preserve full qualified counts");
assert.match(server, /qualifiedRows: rows/, "server should preserve all qualified rows for alternate ranking views");
assert.match(app, /list\.qualifiedRows \|\| list\.rows/, "frontend should sort from all qualified rows when available");

console.log("Independent price rankings smoke test passed.");
