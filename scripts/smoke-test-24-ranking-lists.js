const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const server = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");

assert.match(server, /STOCKS_TO_BUY_TIMEFRAMES[\s\S]*oneDay[\s\S]*sevenDay[\s\S]*oneMonth[\s\S]*oneYear/, "four timeframes should be defined");
assert.match(server, /STOCKS_TO_BUY_PRICE_CATEGORIES[\s\S]*overall[\s\S]*under5[\s\S]*5to10[\s\S]*10to25[\s\S]*25to100[\s\S]*over100/, "six price categories should be defined");
assert.match(server, /for \(const timeframe of STOCKS_TO_BUY_TIMEFRAMES\)[\s\S]*for \(const category of STOCKS_TO_BUY_PRICE_CATEGORIES\)/, "builder should create category x timeframe lists");
assert.match(server, /diagnostics\.totalListsBuilt \+= 1/, "diagnostics should count every list built");
assert.match(server, /totalListsBuilt/, "diagnostics should expose total list count");

console.log("24 ranking lists smoke test passed.");
