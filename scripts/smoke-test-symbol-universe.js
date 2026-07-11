const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert.match(server, /SYMBOL_UNIVERSE_FILE/, "symbol universe cache file should exist");
assert.match(server, /function refreshSymbolUniverse/, "symbol universe refresh function should exist");
assert.match(server, /nasdaqlisted\.txt/, "Nasdaq official listing source should be configured");
assert.match(server, /otherlisted\.txt/, "NYSE/NYSE American listing source should be configured");
assert.match(server, /symbolMasterFallbackRows\(3200\)/, "fixture fallback should provide at least 2,500 eligible symbols");
assert.match(server, /symbolUniverseMetadata/, "symbol universe metadata should be stored");
assert.match(server, /exchangeCounts/, "exchange counts should be reported");
assert.match(server, /securityTypeCounts/, "security type counts should be reported");
assert.match(server, /includeEtfs/, "ETF filtering should be configurable");
assert.match(server, /includeAdrs/, "ADR filtering should be configurable");
assert.match(server, /includeClosedEndFunds/, "closed-end fund filtering should be configurable");
assert.match(server, /fixture fallback, not live broad-market coverage|not live exchange coverage/i, "preset/fallback warning should be explicit");
assert.equal(pkg.scripts["smoke:symbol-universe"], "node scripts/smoke-test-symbol-universe.js");

console.log("Symbol universe smoke test passed.");
