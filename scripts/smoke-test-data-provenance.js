const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const { resolveUniverseProvenance } = require("../discovery/provenance");

const cached = resolveUniverseProvenance({
  source: "Cached public listing snapshot",
  refreshStatus: "packaged-snapshot",
  packagedSnapshot: true,
});
assert.equal(cached.label, "Cached public listing snapshot");
assert.equal(cached.sourceType, "cached");

const live = resolveUniverseProvenance({
  source: "Nasdaq Trader exchange listing files",
  refreshStatus: "live",
});
assert.equal(live.label, "Live listing source (Nasdaq Trader exchange listing files)");
assert.equal(live.sourceType, "live");

const emergency = resolveUniverseProvenance({
  source: "Generated fixture fallback",
  refreshStatus: "emergency-preset-fallback",
  emergencyFallbackActive: true,
});
assert.equal(emergency.label, "Emergency Preset Fallback");

const mixed = resolveUniverseProvenance({
  refreshStatus: "mixed",
  primarySource: "Nasdaq Trader exchange listing files",
  sources: ["Nasdaq Trader exchange listing files", "Saved public snapshot"],
});
assert.equal(mixed.label, "Mixed sources (primary: Nasdaq Trader exchange listing files)");
assert.equal(mixed.primarySource, "Nasdaq Trader exchange listing files");

assert.equal(resolveUniverseProvenance({}).label, "Unknown");

const stale = resolveUniverseProvenance({
  source: "Nasdaq Trader exchange listing files",
  refreshStatus: "stale",
  lastRefreshError: "Provider unavailable",
});
assert.equal(stale.sourceType, "saved");
assert.doesNotMatch(stale.label, /^Live /);
assert.match(stale.label, /^Saved listing data/);

assert.match(app, /scan\.universeSourceStatus \|\| scan\.universeSource \|\| "Unknown"/, "frontend should display the completed scan API label");
assert.match(server, /universeSourceStatus:\s*activeUniverseSource/, "API should persist the same resolved source label");
assert.match(server, /resolveUniverseProvenance\(metadata\)/, "server should use the tested provenance resolver");
assert.match(app, /Source: \$/, "market cards should include source lines");
assert.match(app, /updated \$/, "market cards should include freshness age");
assert.match(app, /Using saved congressional disclosures|Live congressional disclosures are not connected/, "Congress source state should be explicit");
assert.match(server, /freshness: quoteFreshness/, "quote freshness should be persisted in diagnostics");
assert.match(server, /latestProviderError/, "provider errors should be reported");

const unavailableMarketDataScan = {
  scanCompletedAt: "2026-07-19T16:00:00.000Z",
  universeSourceStatus: cached.label,
  dataFreshness: "Unavailable",
};
assert.equal(unavailableMarketDataScan.universeSourceStatus, "Cached public listing snapshot");

console.log("Data provenance smoke test passed.");
