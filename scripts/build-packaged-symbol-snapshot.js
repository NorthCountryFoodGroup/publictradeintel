const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  NASDAQ_LISTING_SOURCES,
  fetchLiveListingRecords,
} = require("../discovery/symbol-universe-source");

const root = path.resolve(__dirname, "..");
const defaultOutputFile = path.join(root, "data", "publicSymbolSnapshot.json");
const TARGET_SYMBOL_COUNT = 3200;
const MUTABLE_FILENAMES = new Set([
  "symbolUniverse.json",
  "predictions.json",
  "predictionHistory.json",
  "discoveryReadinessHistory.json",
]);

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function safeOutputFile() {
  const requested = argument("--output");
  if (!requested) return defaultOutputFile;
  const resolved = path.resolve(requested);
  const temporaryRoot = path.resolve(os.tmpdir());
  const relativeToTemporary = path.relative(temporaryRoot, resolved);
  const isTemporary = relativeToTemporary && !relativeToTemporary.startsWith("..") && !path.isAbsolute(relativeToTemporary);
  if (!isTemporary || MUTABLE_FILENAMES.has(path.basename(resolved))) {
    throw new Error("Explicit output must be a non-runtime JSON file beneath the operating-system temporary directory.");
  }
  return resolved;
}

function ticker(value) {
  return String(value || "").trim().toUpperCase().replace(/-/g, ".");
}

function sourceTimestamp(text) {
  const match = String(text || "").match(/File Creation Time:\s*(\d{2})(\d{2})(\d{4})(\d{2}):(\d{2})/i);
  if (!match) return null;
  const [, month, day, year, hour, minute] = match;
  // Nasdaq Trader file timestamps are published in U.S. Eastern time.
  const easternOffset = ["11", "12", "01", "02"].includes(month) ? "-05:00" : "-04:00";
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:00${easternOffset}`).toISOString();
}

function normalizedRecord(record) {
  const row = record.values;
  const rawTicker = row.Symbol || row["ACT Symbol"] || "";
  const canonicalTicker = ticker(rawTicker);
  const name = row["Security Name"] || row["Company Name"] || canonicalTicker;
  const testIssue = row["Test Issue"] === "Y";
  const unsupported = !canonicalTicker ||
    testIssue ||
    /[\^$]/.test(rawTicker) ||
    /Warrant|Right|Unit|Preferred|Test|Delisted/i.test(name);
  if (unsupported) return null;
  const exchangeCode = row["Listing Exchange"] || "";
  const exchange = exchangeCode === "N"
    ? "NYSE"
    : exchangeCode === "A"
      ? "NYSE American"
      : exchangeCode === "P"
        ? "NYSE Arca"
        : exchangeCode === "Z"
          ? "Cboe BZX"
          : "NASDAQ";
  const securityType = /ETF/i.test(row.ETF || name)
    ? "ETF"
    : /ADR/i.test(name)
      ? "ADR"
      : /Fund/i.test(name)
        ? "Closed-End Fund"
        : "Common Stock";
  return {
    canonicalTicker,
    displayTicker: canonicalTicker,
    providerTicker: canonicalTicker.replace(/\./g, "-"),
    name,
    exchange,
    securityType,
    isEtf: securityType === "ETF",
    testIssue: false,
    active: true,
    source: "Cached public listing snapshot",
  };
}

async function main() {
  const outputFile = safeOutputFile();
  const nasdaqInput = argument("--nasdaq-input");
  const otherInput = argument("--other-input");
  if (Boolean(nasdaqInput) !== Boolean(otherInput)) {
    throw new Error("Both --nasdaq-input and --other-input are required when using fixed source inputs.");
  }
  const fixedInputs = nasdaqInput
    ? new Map([
      [NASDAQ_LISTING_SOURCES[0].url, fs.readFileSync(path.resolve(nasdaqInput), "utf8")],
      [NASDAQ_LISTING_SOURCES[1].url, fs.readFileSync(path.resolve(otherInput), "utf8")],
    ])
    : null;
  const responseTexts = new Map();
  const live = await fetchLiveListingRecords({
    sources: NASDAQ_LISTING_SOURCES,
    fetchImpl: async (url, options) => {
      const response = fixedInputs
        ? { ok: true, status: 200, text: async () => fixedInputs.get(url) }
        : await fetch(url, options);
      const text = await response.text();
      responseTexts.set(url, text);
      return {
        ok: response.ok,
        status: response.status,
        text: async () => text,
      };
    },
  });
  if (!live.allSourcesSucceeded) throw new Error("Official listing sources were not both available.");

  const normalized = live.records.map(normalizedRecord).filter(Boolean);
  const normalizedUniqueCount = new Set(normalized.map((row) => row.canonicalTicker)).size;
  const bySource = NASDAQ_LISTING_SOURCES.map((source) =>
    live.records.filter((record) => record.source === source.name).map(normalizedRecord).filter(Boolean));
  const selected = [];
  const seen = new Set();
  for (let index = 0; selected.length < TARGET_SYMBOL_COUNT && bySource.some((rows) => index < rows.length); index += 1) {
    for (const rows of bySource) {
      const row = rows[index];
      if (!row || seen.has(row.canonicalTicker)) continue;
      seen.add(row.canonicalTicker);
      selected.push(row);
      if (selected.length === TARGET_SYMBOL_COUNT) break;
    }
  }
  if (selected.length < TARGET_SYMBOL_COUNT) throw new Error("Official listing sources did not yield the required symbol count.");

  const timestamps = NASDAQ_LISTING_SOURCES
    .map((source) => sourceTimestamp(responseTexts.get(source.url)))
    .filter(Boolean)
    .sort();
  if (timestamps.length !== NASDAQ_LISTING_SOURCES.length) throw new Error("Official listing source timestamp was unavailable.");
  const generatedAt = timestamps.at(-1);
  const exchangeCounts = {};
  const securityTypeCounts = {};
  for (const row of selected) {
    exchangeCounts[row.exchange] = (exchangeCounts[row.exchange] || 0) + 1;
    securityTypeCounts[row.securityType] = (securityTypeCounts[row.securityType] || 0) + 1;
  }
  const snapshot = {
    snapshotMetadata: {
      source: "Cached public listing snapshot",
      sourceProvider: "Nasdaq Trader exchange listing files",
      generatedAt,
      rawSymbolCount: live.records.length,
      normalizedSymbolCount: normalizedUniqueCount,
      selectedSymbolCount: selected.length,
      eligibleSymbolCount: selected.length,
      excludedCount: live.records.length - normalizedUniqueCount,
      exchangeCounts,
      securityTypeCounts,
      refreshStatus: "packaged-snapshot",
      refreshNotes: [
        "Immutable packaged baseline built from official Nasdaq Trader exchange listing files.",
        `A deterministic ${selected.length}-symbol subset was retained from ${normalizedUniqueCount} unique eligible listings.`,
        "This cached snapshot is not a live request and retains the listing files' original generation timestamp.",
      ],
      timezone: "America/New_York",
    },
    symbols: selected,
  };
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Wrote ${selected.length} validated symbols to ${outputFile === defaultOutputFile ? "data/publicSymbolSnapshot.json" : "the requested temporary output"}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
