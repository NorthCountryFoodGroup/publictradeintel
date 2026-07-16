const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const server = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");

assert.match(server, /try \{[\s\S]*buildStocksToBuyCenter/, "Stocks to Buy publish should be guarded");
assert.match(server, /previousSections\.stocksToBuyCenter/, "publish fallback should retain previous center");
assert.match(server, /publishStatus/, "diagnostics should explain retained previous publish");
assert.match(server, /latestError/, "diagnostics should record latest build error");

console.log("Stocks to Buy atomic publish smoke test passed.");
