const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(server, /freshnessDistribution/, "scan should store freshness distribution");
assert.match(server, /medianQuoteAgeMs/, "scan should store median quote age");
assert.match(server, /p90QuoteAgeMs/, "scan should store 90th percentile quote age");
assert.match(server, /oldestUnderlyingTimestamp/, "scan should store oldest underlying timestamp");
assert.match(server, /newestUnderlyingTimestamp/, "scan should store newest underlying timestamp");
assert.match(server, /representativeUnderlyingTimestamp/, "scan should use representative underlying timestamp");
assert.match(server, /percentageWithinLiveThreshold/, "freshness should report live threshold percentage");
assert.match(server, /percentageWithinRecentThreshold/, "freshness should report recent threshold percentage");
assert.match(app, /Underlying Data/, "UI should show representative underlying data");
assert.match(app, /Oldest Market Data/, "UI should show oldest market data");
assert.match(app, /Newest Market Data/, "UI should show newest market data");

console.log("Market data freshness smoke test passed.");
