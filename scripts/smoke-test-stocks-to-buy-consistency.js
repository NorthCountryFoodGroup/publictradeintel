const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const server = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");

assert.match(app, /stocksToBuyCenterData\(\)[\s\S]*predictionEngine\.sections\?\.stocksToBuyCenter/, "frontend should read completed scan section first");
assert.match(app, /control\.addEventListener\("change", renderStocksToBuyCenter\)/, "filter changes should rerender locally");
assert.doesNotMatch(app, /stocksToBuyTimeframe[\s\S]{0,300}runPredictionScan/, "Stocks to Buy filters should not rerun scans");
assert.match(server, /scanReferencePriceTimestamp/, "published cards should preserve reference price timestamp");
assert.match(server, /categoryAtScanTime/, "published cards should preserve category at scan time");

console.log("Stocks to Buy consistency smoke test passed.");
