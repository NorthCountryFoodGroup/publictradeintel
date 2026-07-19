const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const snapshotPath = path.join(root, "data", "publicSymbolSnapshot.json");
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const symbols = Array.isArray(snapshot.symbols) ? snapshot.symbols : [];

assert.ok(symbols.length >= 2500, "packaged public symbol snapshot should include at least 2,500 rows");
assert.match(server, /PUBLIC_SYMBOL_SNAPSHOT_FILE\s*=\s*path\.join\(DATA_DIR,\s*"publicSymbolSnapshot\.json"\)/, "saved snapshot path must resolve from DATA_DIR");
assert.match(server, /PACKAGED_PUBLIC_SYMBOL_SNAPSHOT_FILE\s*=\s*path\.join\(ROOT,\s*"data",\s*"publicSymbolSnapshot\.json"\)/, "packaged snapshot must remain available from the repository");
assert.match(server, /function normalizedSnapshotRow/, "server should normalize snapshot records");
assert.match(server, /function snapshotInitializationBase/, "server should record initialization diagnostics");
assert.match(server, /function packagedSymbolUniverse/, "server should load the packaged snapshot");
assert.match(server, /function persistedSnapshotUniverse/, "server should load a saved snapshot before packaged fallback");
assert.match(server, /row\?\.canonicalTicker/, "loader should accept canonicalTicker");
assert.match(server, /row\?\.displayTicker/, "loader should accept displayTicker");
assert.match(server, /row\?\.providerTicker/, "loader should accept providerTicker");
assert.match(server, /row\?\.ticker/, "loader should accept ticker");
assert.match(server, /row\?\.symbol/, "loader should accept symbol");
assert.match(server, /row\?\.Symbol/, "loader should accept Symbol");
assert.match(server, /missingTicker/, "loader should report missing tickers");
assert.match(server, /inactiveOrTestIssue/, "loader should reject inactive or test issue rows");
assert.match(server, /unsupportedSecurity/, "loader should reject unsupported security types");

const sample = symbols[0] || {};
assert.ok("canonicalTicker" in sample || "ticker" in sample || "symbol" in sample, "snapshot rows should expose a ticker-like field");

console.log("Symbol snapshot loading smoke test passed.");
