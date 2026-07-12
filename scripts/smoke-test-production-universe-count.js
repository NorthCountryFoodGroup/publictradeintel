const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

assert.match(server, /mode === "combined"[\s\S]*broadUniverse[\s\S]*watchlist\.keys\(\)[\s\S]*universePresetTickers\("combined"\)/, "combined mode should include the broad symbol master before preset/watchlist rows");
assert.match(server, /const broadUniverse = symbolMasterTickers\(config\)/, "configured universe should load the symbol master");
assert.match(server, /savedCount >= MIN_PUBLIC_SYMBOL_SNAPSHOT_COUNT/, "saved universe should only win when it is broad enough");
assert.match(server, /writeJson\(SYMBOL_UNIVERSE_FILE,\s*packaged\)/, "valid packaged snapshot should replace undersized saved universe");
assert.match(server, /symbolsAvailable/, "scan health should expose symbolsAvailable");
assert.match(server, /totalSymbolsAvailable/, "scan health should expose totalSymbolsAvailable");
assert.match(server, /broadScreenTarget/, "scan health should expose broadScreenTarget");
assert.match(server, /deepAnalysisTarget/, "scan health should expose deepAnalysisTarget");
assert.match(server, /deepCandidatesSelected/, "scan health should expose deepCandidatesSelected");
assert.match(server, /universeSource/, "scan health should expose universeSource");
assert.match(server, /Broad-market discovery is unavailable\. Results currently use 117 preset symbols\./, "emergency fallback should be explicit and honest");

console.log("Production universe count smoke test passed.");
