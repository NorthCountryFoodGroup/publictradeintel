const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(server, /function marketSessionStatus/, "server should classify market session status");
assert.match(server, /Closed - Weekend/, "server should identify weekend closures");
assert.match(server, /Closed - Holiday/, "server should identify market holidays");
assert.match(server, /lastMarketClose/, "server should expose last market close");
assert.match(server, /nextMarketOpen/, "server should expose next market open");
assert.match(server, /Closed-Market Analysis/, "server should label closed-market scans");
assert.match(server, /session\.isOpen\s*\?\s*discovery\.marketHoursDeepCount\s*:\s*discovery\.afterHoursDeepCount/, "closed markets should use after-hours deep target without shrinking the universe");
assert.match(app, /Market Status/, "scan summary should show market status");
assert.match(app, /latest completed market session together with available news, policy, and saved catalyst data/, "UI should explain closed-market data behavior");
assert.match(app, /1-day rankings are based on the latest completed session/, "UI should clarify closed-market 1-day rankings");

console.log("Market closed mode smoke test passed.");
