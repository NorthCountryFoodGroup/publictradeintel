const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const constants = require(path.join(root, "discovery", "constants.js"));

function extractFunction(source, name) {
  const signature = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const match = signature.exec(source);
  assert.ok(match, `${name} should exist`);
  const parametersOpen = source.indexOf("(", match.index);
  let parameterDepth = 0;
  let parametersClose = -1;
  for (let index = parametersOpen; index < source.length; index += 1) {
    if (source[index] === "(") parameterDepth += 1;
    if (source[index] === ")") {
      parameterDepth -= 1;
      if (parameterDepth === 0) {
        parametersClose = index;
        break;
      }
    }
  }
  const open = source.indexOf("{", parametersClose);
  assert.notEqual(open, -1, `${name} should have a body`);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(match.index, index + 1);
    }
  }
  assert.fail(`${name} should have a balanced body`);
}

const normalizeSource = extractFunction(server, "normalizeDiscoveryEngineVersion");
const bucketSource = extractFunction(server, "sanitizeBucketSettings");
const settingsSource = extractFunction(server, "sanitizeDiscoverySettings");

assert.deepEqual(constants.DISCOVERY_ENGINE_VERSIONS, ["legacy", "v3-evidence-buckets"], "only the approved discovery engine versions should be available");
assert.equal(constants.DEFAULT_V3_DISCOVERY_SETTINGS.discoveryEngineVersion, "legacy", "legacy should remain the default active engine");
assert.equal(constants.DEFAULT_V3_DISCOVERY_SETTINGS.discoveryShadowComparisonEnabled, true, "shadow comparison should default to enabled");
assert.deepEqual(
  Object.keys(constants.DISCOVERY_BUCKET_DEFINITIONS),
  ["momentum", "relativeVolume", "breakout", "earnings", "congressional", "policy", "sectorLeaders", "reversal"],
  "all approved discovery buckets should have configuration defaults",
);

const context = {
  BROAD_SCREEN_TARGET: 2500,
  DEEP_ANALYSIS_AFTER_HOURS_TARGET: 600,
  DEEP_ANALYSIS_MARKET_HOURS_TARGET: 300,
  MAX_SCAN_DURATION: 180000,
  PROVIDER_CONCURRENCY_LIMIT: 4,
  PROVIDER_REQUEST_BUDGET: 2500,
  DEFAULT_DISCOVERY_SETTINGS: {
    broadScreenTarget: 2500,
    targetSymbolCount: 2500,
    includeEtfs: true,
    includeSmallCaps: false,
    excludeOtc: true,
    minimumPrice: 3,
    minimumAverageVolume: 250000,
    minimumMarketCap: 0,
    maxBroadScreenDurationMs: 45000,
    marketHoursDeepCount: 300,
    afterHoursDeepCount: 600,
    maxDeepAnalysisDurationMs: 120000,
    batchSize: 8,
    requestConcurrency: 4,
    providerConcurrencyLimit: 4,
    providerRequestBudget: 2500,
    maxScanDurationMs: 180000,
    retryCount: 1,
    strongSectorPercent: 60,
    improvingSectorPercent: 20,
    contrarianPercent: 10,
    catalystPercent: 10,
    minimumPerSector: 2,
    scheduledScanningEnabled: false,
    scheduledScanTimes: ["08:30"],
    timezone: "America/New_York",
    symbolUniverseRefreshHours: 24,
    includeAdrs: true,
    includeClosedEndFunds: false,
    ...constants.DEFAULT_V3_DISCOVERY_SETTINGS,
  },
  DEFAULT_BUCKET_SETTINGS: constants.DEFAULT_BUCKET_SETTINGS,
  DEFAULT_V3_DISCOVERY_SETTINGS: constants.DEFAULT_V3_DISCOVERY_SETTINGS,
  DISCOVERY_BUCKET_DEFINITIONS: constants.DISCOVERY_BUCKET_DEFINITIONS,
  DISCOVERY_ENGINE_VERSIONS: constants.DISCOVERY_ENGINE_VERSIONS,
  boundedNumber(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  },
};

vm.runInNewContext(
  `${normalizeSource}\n${bucketSource}\n${settingsSource}\nthis.normalizeDiscoveryEngineVersion = normalizeDiscoveryEngineVersion; this.sanitizeDiscoverySettings = sanitizeDiscoverySettings;`,
  context,
);

assert.equal(context.normalizeDiscoveryEngineVersion(), "legacy", "missing versions should resolve to legacy");
assert.equal(context.normalizeDiscoveryEngineVersion("invalid"), "legacy", "invalid versions should resolve to legacy");
assert.equal(context.normalizeDiscoveryEngineVersion("legacy"), "legacy", "legacy should remain valid");
assert.equal(context.normalizeDiscoveryEngineVersion("v3-evidence-buckets"), "v3-evidence-buckets", "v3 should be selectable");

const existingConfig = context.sanitizeDiscoverySettings({});
assert.equal(existingConfig.discoveryEngineVersion, "legacy", "existing config without a version should remain on legacy");
assert.equal(existingConfig.discoveryShadowComparisonEnabled, true, "existing config should receive an in-memory shadow default");

const v3Config = context.sanitizeDiscoverySettings({
  discoveryEngineVersion: "v3-evidence-buckets",
  discoveryShadowComparisonEnabled: false,
  bucketSettings: {
    momentum: { enabled: false, minimumScore: 200, reservationTarget: -2 },
  },
});
assert.equal(v3Config.discoveryEngineVersion, "v3-evidence-buckets");
assert.equal(v3Config.discoveryShadowComparisonEnabled, false);
assert.equal(v3Config.bucketSettings.momentum.enabled, false);
assert.equal(v3Config.bucketSettings.momentum.minimumScore, 100, "bucket scores should be bounded");
assert.equal(v3Config.bucketSettings.momentum.reservationTarget, 0, "bucket reservations should be bounded");
assert.equal(v3Config.bucketSettings.breakout.enabled, true, "missing bucket settings should inherit defaults");

assert.doesNotMatch(settingsSource, /writeJson|writeFile|appendFile/, "configuration sanitization must remain read-only");
assert.doesNotMatch(bucketSource, /writeJson|writeFile|appendFile/, "bucket sanitization must remain read-only");
assert.doesNotMatch(normalizeSource, /writeJson|writeFile|appendFile/, "engine-version normalization must remain read-only");

console.log("Discovery configuration smoke test passed.");
