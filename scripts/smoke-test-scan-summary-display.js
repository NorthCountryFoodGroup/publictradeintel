const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.js"), "utf8");

assert.match(app, /Universe Source/, "scan summary should show universe source");
assert.match(app, /Broad Screen/, "scan summary should show a single broad screen card");
assert.match(app, /Deep Analysis/, "scan summary should show a single deep analysis card");
assert.match(app, /Provider Fetch/, "scan summary should distinguish provider fetch time");
assert.match(app, /Underlying market data as of/, "scan summary should distinguish underlying market data time");
assert.match(app, /Underlying Data/, "scan summary should show representative underlying data");
assert.match(app, /Oldest Market Data/, "scan summary should show oldest market data");
assert.match(app, /Newest Market Data/, "scan summary should show newest market data");
assert.doesNotMatch(app, /Broad Screen Target/, "scan summary should not show duplicate broad target card");
assert.doesNotMatch(app, /Symbols Screened/, "scan summary should not show duplicate symbols screened card");
assert.match(admin, /Latest scan metadata diagnostic/, "admin should expose latest scan diagnostics");
assert.match(admin, /utcTimestamps/, "admin diagnostics should show UTC timestamps");
assert.match(admin, /easternDisplay/, "admin diagnostics should show Eastern display timestamps");
assert.match(admin, /consistency/, "admin diagnostics should show consistency results");

console.log("Scan summary display smoke test passed.");
