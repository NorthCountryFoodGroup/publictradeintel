const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

assert.match(html, /data-page="stocksToBuy"/, "Stocks to Buy page should exist");
assert.match(html, /Stocks to Buy Center/, "page heading should exist");
assert.match(html, /id="stocksToBuyTimeframe"/, "timeframe control should exist");
assert.match(html, /id="stocksToBuyPriceCategory"/, "price category control should exist");
assert.match(app, /function renderStocksToBuyCenter/, "Stocks to Buy renderer should exist");
assert.match(app, /renderStocksToBuyCenter\(\)/, "renderer should be called");
assert.match(server, /function buildStocksToBuyCenter/, "backend builder should exist");
assert.match(server, /stocksToBuyCenter/, "scan sections should publish Stocks to Buy data");

console.log("Stocks to Buy Center smoke test passed.");
