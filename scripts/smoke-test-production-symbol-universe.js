const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const snapshot = JSON.parse(fs.readFileSync(path.join(root, "data", "publicSymbolSnapshot.json"), "utf8"));

assert.ok(snapshot.symbols.length >= 2500, "packaged snapshot should include at least 2,500 symbols");
assert.equal(snapshot.snapshotMetadata.source, "Cached public listing snapshot");
assert.match(server, /PUBLIC_SYMBOL_SNAPSHOT_FILE/, "server should know packaged snapshot file");
assert.match(server, /packagedSymbolUniverse/, "server should load packaged snapshot");
assert.match(server, /Emergency preset fallback/, "117-symbol preset should be emergency fallback only");
assert.match(server, /Nasdaq Trader exchange listing files/, "live refresh should still target Nasdaq Trader listing files");
assert.match(server, /symbolUniverseStatus/, "admin/user status should expose active universe source");

console.log("Production symbol universe smoke test passed.");
