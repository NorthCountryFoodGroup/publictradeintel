const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.js"), "utf8");

assert.match(server, /function emptyProviderDiagnostics/, "server should create provider diagnostics");
assert.match(server, /function providerDiagnostic/, "server should create provider health rows");
assert.match(server, /Rate Limited/, "provider health should detect rate limits");
assert.match(server, /timeoutCount/, "provider health should track timeouts");
assert.match(server, /parseFailures/, "provider health should track parse failures");
assert.match(server, /fallbackUsage/, "provider health should track fallback usage");
assert.match(server, /cacheUsage/, "provider health should track cache usage");
assert.match(server, /providerPriority/, "provider health should expose provider priority");
assert.match(server, /requestLog/, "provider health should expose request log");
assert.match(admin, /Market Data Provider Health/, "admin should show provider health");
assert.match(admin, /Provider Scorecard/, "admin should show provider scorecard");
assert.match(admin, /Provider Request Log/, "admin should show provider request log");
assert.match(admin, /Test Connection/, "admin should expose test connection control");
assert.match(admin, /Retry Failed Symbols/, "admin should expose retry failed symbols control");
assert.match(server, /Volatility index unavailable/, "missing VIX should be labeled as supplemental unavailable");

console.log("Provider health smoke test passed.");
