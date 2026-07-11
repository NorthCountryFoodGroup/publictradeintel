const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

["SPY", "QQQ", "DIA", "IWM", "^GSPC", "^IXIC", "^DJI", "^RUT", "^VIX"].forEach((ticker) => {
  assert.ok(server.includes(ticker), `${ticker} should be part of market diagnostics`);
});
assert.match(server, /marketIndexDiagnostics/, "market index diagnostics function should exist");
assert.match(server, /exactOrProxy/, "exact index vs ETF proxy should be recorded");
assert.match(server, /Volatility index unavailable/, "VIX unavailable state should be explicit");
assert.match(server, /const connectionStatus = quote\.marketPrice && quote\.marketUpdatedAt \? "Connected" : "Unavailable"/, "connected status should require a valid quote path");
assert.match(server, /quoteFreshness/, "quote freshness should be classified");

console.log("Market index data smoke test passed.");
