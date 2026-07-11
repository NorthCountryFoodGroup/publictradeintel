const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

assert.match(app, /Source: \$/, "market cards should include source lines");
assert.match(app, /updated \$/, "market cards should include freshness age");
assert.match(app, /Cached public listing snapshot/, "symbol source should be visible");
assert.match(app, /Using saved congressional disclosures|Live congressional disclosures are not connected/, "Congress source state should be explicit");
assert.match(server, /freshness: quoteFreshness/, "quote freshness should be persisted in diagnostics");
assert.match(server, /latestProviderError/, "provider errors should be reported");

console.log("Data provenance smoke test passed.");
