const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  SNAPSHOT_MAXIMUM_AGE_MS,
  boundedSourceDiagnostic,
  classifySourceFailure,
  fetchLiveListingRecords,
  parseNasdaqListingText,
  resolveSnapshotCandidates,
  snapshotDocumentStatus,
} = require("../discovery/symbol-universe-source");
const { resolveUniverseProvenance } = require("../discovery/provenance");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const evaluatedAt = "2026-07-19T20:30:00.000Z";

function document({
  source = "Nasdaq Trader exchange listing files",
  refreshStatus = "live",
  timestamp = "2026-07-19T20:00:00.000Z",
  count = 2500,
  emergencyFallbackActive = false,
} = {}) {
  return {
    symbols: Array.from({ length: count }, (_, index) => ({ ticker: `T${index}` })),
    symbolUniverseMetadata: {
      source,
      refreshStatus,
      fetchedAt: timestamp,
      eligibleSymbolCount: count,
      emergencyFallbackActive,
    },
  };
}

async function main() {
const live = document();
assert.equal(snapshotDocumentStatus(live, { evaluatedAt }).usable, true, "valid live universe should qualify");
assert.equal(resolveSnapshotCandidates({ saved: live, evaluatedAt }).source, "saved-symbol-universe", "successful live universe should remain authoritative after persistence");

const cached = document({ source: "Saved public listing snapshot", refreshStatus: "saved-snapshot" });
assert.equal(resolveSnapshotCandidates({ persistedSnapshot: cached, evaluatedAt }).source, "saved-public-snapshot", "restart should use a valid saved snapshot");
assert.equal(resolveSnapshotCandidates({ saved: null, persistedSnapshot: cached, evaluatedAt }).source, "saved-public-snapshot", "live unavailable should not defeat a valid saved snapshot");
assert.equal(classifySourceFailure(new SyntaxError("malformed provider response")), "PARSE_ERROR");
assert.equal(resolveSnapshotCandidates({ saved: null, persistedSnapshot: cached, evaluatedAt }).source, "saved-public-snapshot", "malformed live input should still permit a valid saved snapshot");

const stale = document({ timestamp: new Date(Date.parse(evaluatedAt) - SNAPSHOT_MAXIMUM_AGE_MS - 1).toISOString() });
assert.equal(snapshotDocumentStatus(stale, { evaluatedAt }).failureCategory, "STALE_SNAPSHOT");
const invalidMetadata = document();
delete invalidMetadata.symbolUniverseMetadata.source;
assert.equal(snapshotDocumentStatus(invalidMetadata, { evaluatedAt }).failureCategory, "INVALID_METADATA");
assert.equal(resolveSnapshotCandidates({ evaluatedAt, emergencySymbolCount: 117 }).source, "emergency-preset", "missing legitimate sources should fail safely to emergency");
assert.equal(resolveSnapshotCandidates({ saved: stale, persistedSnapshot: invalidMetadata, evaluatedAt, emergencySymbolCount: 117 }).source, "emergency-preset", "unusable sources should fail safely to emergency");

const listingText = (header, prefix, count) => [
  header,
  ...Array.from({ length: count }, (_, index) => header.startsWith("Symbol")
    ? `${prefix}${index}|${prefix} Company ${index}|N|N|100|N|N`
    : `${prefix}${index}|${prefix} Company ${index}|N|N|N|100|N`),
  "File Creation Time: 202607192030",
].join("\n");
assert.throws(() => parseNasdaqListingText("<html>not a listing</html>", "malformed"), /format is not recognized/);

let concurrentCalls = 0;
let maximumConcurrentCalls = 0;
const successfulFetch = async (url) => {
  concurrentCalls += 1;
  maximumConcurrentCalls = Math.max(maximumConcurrentCalls, concurrentCalls);
  await new Promise((resolve) => setTimeout(resolve, 10));
  concurrentCalls -= 1;
  const other = url.includes("otherlisted");
  return {
    ok: true,
    status: 200,
    text: async () => other
      ? listingText("ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue", "O", 1300)
      : listingText("Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF", "N", 1300),
  };
};
const liveResult = await fetchLiveListingRecords({ fetchImpl: successfulFetch, deadlineMs: 200 });
assert.equal(liveResult.allSourcesSucceeded, true);
assert.equal(liveResult.records.length, 2600);
assert.equal(maximumConcurrentCalls, 2, "listing requests should execute concurrently");

let timedOutCalls = 0;
const timeoutFetch = async (url, options) => {
  timedOutCalls += 1;
  if (!url.includes("otherlisted")) {
    return {
      ok: true,
      status: 200,
      text: async () => listingText("Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF", "N", 1300),
    };
  }
  return new Promise((resolve, reject) => {
    const safetyTimer = setTimeout(() => reject(new Error("test deadline was not enforced")), 200);
    options.signal.addEventListener("abort", () => {
      clearTimeout(safetyTimer);
      reject(options.signal.reason);
    }, { once: true });
  });
};
const timeoutStartedAt = Date.now();
const timeoutResult = await fetchLiveListingRecords({ fetchImpl: timeoutFetch, deadlineMs: 25 });
assert.equal(timedOutCalls, 2);
assert.equal(timeoutResult.allSourcesSucceeded, false);
assert.ok(Date.now() - timeoutStartedAt < 250, "shared deadline should bound a timed-out endpoint");
assert.equal(timeoutResult.diagnostics.find((item) => item.source.includes("otherlisted")).failureCategory, "TIMEOUT");

const failedResult = await fetchLiveListingRecords({
  fetchImpl: async () => { throw new Error("provider unavailable"); },
  deadlineMs: 50,
});
assert.equal(failedResult.allSourcesSucceeded, false);
assert.equal(failedResult.diagnostics.filter((item) => item.success).length, 0);

assert.equal(resolveUniverseProvenance(live.symbolUniverseMetadata).label, "Live listing source (Nasdaq Trader exchange listing files)");
assert.equal(resolveUniverseProvenance(cached.symbolUniverseMetadata).sourceType, "saved");
assert.equal(resolveUniverseProvenance(document({ source: "Cached Public Snapshot", refreshStatus: "packaged-snapshot" }).symbolUniverseMetadata).sourceType, "cached");
assert.equal(resolveUniverseProvenance(document({ source: "Emergency preset fallback", refreshStatus: "emergency-preset-fallback", count: 117, emergencyFallbackActive: true }).symbolUniverseMetadata).sourceType, "emergency");

const bounded = boundedSourceDiagnostic({
  source: "provider",
  attempted: true,
  failureCategory: "HTTP_ERROR",
  httpStatus: 503,
  symbolCount: 0,
});
const serialized = JSON.stringify(bounded);
assert.equal(bounded.httpStatus, 503);
assert.doesNotMatch(serialized, /ADMIN_PIN|API_KEY|[A-Z]:\\|\/var\/data|\/opt\/render|payload/i, "bounded diagnostics must not disclose secrets, paths, or payloads");

assert.match(server, /PACKAGED_PUBLIC_SYMBOL_SNAPSHOT_FILE = path\.join\(ROOT, "data", "publicSymbolSnapshot\.json"\)/, "packaged snapshot should remain repository-rooted");
assert.match(server, /PUBLIC_SYMBOL_SNAPSHOT_FILE = path\.join\(DATA_DIR, "publicSymbolSnapshot\.json"\)/, "saved snapshot should remain DATA_DIR-rooted");
assert.match(server, /seedSymbolUniversePersistence\(result\)/, "successful live universe should persist the symbol master and public snapshot");
assert.match(server, /writeJsonAtomic\(PUBLIC_SYMBOL_SNAPSHOT_FILE, universe\)[\s\S]*writeJsonAtomic\(SYMBOL_UNIVERSE_FILE, universe\)/, "both mutable universe files should use atomic replacement");
assert.match(server, /function persistedSnapshotUniverse\(\)/, "saved snapshot should be available after restart");
assert.match(server, /const persisted = persistedSnapshotUniverse\(\)[\s\S]*const packaged = packagedSymbolUniverse\(\)/, "saved snapshot should precede packaged fallback");
assert.match(server, /loadSymbolUniverse\(\{ allowEmergency: false \}\)[\s\S]*refreshSymbolUniverse\(\)/, "normal scans should attempt live refresh only after legitimate local sources fail");
assert.match(server, /await ensureSymbolUniverseForScan\(\)/, "normal prediction scans should enforce the sustainable source lifecycle");
assert.match(server, /LIVE_REFRESH_DEADLINE_MS/, "live listing requests should share a bounded overall deadline");
assert.match(server, /unique\.length < MIN_PUBLIC_SYMBOL_SNAPSHOT_COUNT/, "live results below the minimum count should be rejected");
assert.match(server, /Packaged snapshot is usable in memory, but persistent seeding failed\./, "packaged seeding failure should not prevent in-memory use");
assert.doesNotMatch(server.match(/function symbolUniverseStatus[\s\S]*?\n}/)?.[0] || "", /processCwd|serverDirname|resolvedSnapshotPath|PUBLIC_SYMBOL_SNAPSHOT_FILE/, "admin diagnostics must not expose absolute storage paths");

console.log("Symbol-universe source resolution contract passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
