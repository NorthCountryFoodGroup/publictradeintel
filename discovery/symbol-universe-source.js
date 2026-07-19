const SNAPSHOT_MAXIMUM_AGE_MS = 45 * 24 * 60 * 60 * 1000;
const LIVE_REFRESH_DEADLINE_MS = 15000;
const NASDAQ_LISTING_SOURCES = Object.freeze([
  Object.freeze({ name: "Nasdaq Trader nasdaqlisted", url: "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt" }),
  Object.freeze({ name: "Nasdaq Trader otherlisted", url: "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt" }),
]);

function boundedText(value, maximumLength = 160) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maximumLength) : null;
}

function sourceTimestamp(metadata = {}) {
  return metadata.fetchedAt || metadata.generatedAt || metadata.updatedAt || null;
}

function snapshotDocumentStatus(document, options = {}) {
  const minimumSymbolCount = Number(options.minimumSymbolCount) || 2500;
  const maximumAgeMs = Number(options.maximumAgeMs) || SNAPSHOT_MAXIMUM_AGE_MS;
  const evaluatedAtMs = Date.parse(options.evaluatedAt || new Date().toISOString());
  const rows = Array.isArray(document?.symbols) ? document.symbols : Array.isArray(document) ? document : [];
  const metadata = document?.symbolUniverseMetadata || document?.snapshotMetadata || {};
  const timestamp = sourceTimestamp(metadata);
  const timestampMs = Date.parse(timestamp || "");
  const ageMs = Number.isFinite(timestampMs) && Number.isFinite(evaluatedAtMs)
    ? Math.max(0, evaluatedAtMs - timestampMs)
    : null;
  const source = boundedText(metadata.source, 100);
  const emergency = metadata.emergencyFallbackActive === true || metadata.refreshStatus === "emergency-preset-fallback";
  const failureCategory =
    !rows.length ? "EMPTY_SNAPSHOT"
      : rows.length < minimumSymbolCount ? "INSUFFICIENT_SYMBOLS"
        : !source || !timestamp ? "INVALID_METADATA"
          : ageMs === null ? "INVALID_TIMESTAMP"
            : ageMs > maximumAgeMs ? "STALE_SNAPSHOT"
              : emergency ? "EMERGENCY_SOURCE"
                : null;
  return {
    usable: failureCategory === null,
    failureCategory,
    symbolCount: rows.length,
    source,
    sourceTimestamp: timestamp,
    ageMs,
    stale: failureCategory === "STALE_SNAPSHOT",
    emergency,
  };
}

function classifySourceFailure(error, httpStatus = null) {
  if (Number.isInteger(httpStatus) && (httpStatus < 200 || httpStatus >= 300)) return "HTTP_ERROR";
  const name = String(error?.name || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  if (name.includes("timeout") || code.includes("timeout") || message.includes("timeout")) return "TIMEOUT";
  if (error instanceof SyntaxError || message.includes("json") || message.includes("parse")) return "PARSE_ERROR";
  if (code.includes("enoent")) return "MISSING_FILE";
  if (code.includes("eacces") || code.includes("eperm")) return "PERMISSION_ERROR";
  if (message.includes("only") && message.includes("eligible symbols")) return "INSUFFICIENT_SYMBOLS";
  if (message.includes("header") || message.includes("format")) return "RESPONSE_FORMAT";
  return error ? "NETWORK_OR_READ_ERROR" : "UNKNOWN";
}

function boundedSourceDiagnostic(input = {}) {
  return {
    source: boundedText(input.source, 100) || "unknown",
    attempted: input.attempted === true,
    success: input.success === true,
    failureCategory: boundedText(input.failureCategory, 60),
    httpStatus: Number.isInteger(input.httpStatus) ? input.httpStatus : null,
    symbolCount: Number.isFinite(Number(input.symbolCount)) ? Math.max(0, Number(input.symbolCount)) : 0,
    sourceTimestamp: input.sourceTimestamp || null,
    ageMs: Number.isFinite(Number(input.ageMs)) ? Math.max(0, Number(input.ageMs)) : null,
    savedSnapshotAvailable: input.savedSnapshotAvailable === true,
    fallbackUsed: input.fallbackUsed === true,
  };
}

function resolveSnapshotCandidates(input = {}) {
  const options = {
    evaluatedAt: input.evaluatedAt,
    minimumSymbolCount: input.minimumSymbolCount,
    maximumAgeMs: input.maximumAgeMs,
  };
  const candidates = [
    ["saved-symbol-universe", input.saved],
    ["saved-public-snapshot", input.persistedSnapshot],
    ["packaged-public-snapshot", input.packagedSnapshot],
  ];
  const diagnostics = [];
  for (const [source, document] of candidates) {
    const status = snapshotDocumentStatus(document, options);
    diagnostics.push(boundedSourceDiagnostic({
      source,
      attempted: true,
      success: status.usable,
      failureCategory: status.failureCategory || (!document ? "MISSING_FILE" : null),
      symbolCount: status.symbolCount,
      sourceTimestamp: status.sourceTimestamp,
      ageMs: status.ageMs,
      savedSnapshotAvailable: source === "saved-public-snapshot" && Boolean(document),
      fallbackUsed: source !== "saved-symbol-universe",
    }));
    if (status.usable) return { source, document, diagnostics };
  }
  diagnostics.push(boundedSourceDiagnostic({
    source: "emergency-preset",
    attempted: true,
    success: true,
    symbolCount: Number(input.emergencySymbolCount) || 0,
    fallbackUsed: true,
  }));
  return { source: "emergency-preset", document: null, diagnostics };
}

function parseNasdaqListingText(text, source) {
  const lines = String(text || "").split(/\r?\n/).filter((line) => line && !/^File Creation Time/i.test(line));
  const headers = (lines.shift() || "").split("|");
  if (!(headers.includes("Symbol") || headers.includes("ACT Symbol"))) {
    const error = new Error("Listing source response format is not recognized.");
    error.category = "RESPONSE_FORMAT";
    throw error;
  }
  return lines.map((line) => {
    const values = line.split("|");
    return {
      source,
      values: Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])),
    };
  });
}

async function fetchLiveListingRecords(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const sources = Array.isArray(options.sources) && options.sources.length ? options.sources : NASDAQ_LISTING_SOURCES;
  const deadlineMs = Math.max(1, Number(options.deadlineMs) || LIVE_REFRESH_DEADLINE_MS);
  const signal = options.signal || AbortSignal.timeout(deadlineMs);
  const results = await Promise.all(sources.map(async (source) => {
    try {
      const response = await fetchImpl(source.url, {
        headers: { "User-Agent": "PublicTradeIntelSymbolUniverse/1.0" },
        signal,
      });
      if (!response?.ok) {
        return {
          source,
          records: [],
          diagnostic: boundedSourceDiagnostic({
            source: source.name,
            attempted: true,
            failureCategory: classifySourceFailure(null, response?.status),
            httpStatus: Number.isInteger(response?.status) ? response.status : null,
          }),
        };
      }
      const records = parseNasdaqListingText(await response.text(), source.name);
      return {
        source,
        records,
        diagnostic: boundedSourceDiagnostic({
          source: source.name,
          attempted: true,
          success: true,
          httpStatus: response.status,
          symbolCount: records.length,
        }),
      };
    } catch (error) {
      return {
        source,
        records: [],
        diagnostic: boundedSourceDiagnostic({
          source: source.name,
          attempted: true,
          failureCategory: error?.category || classifySourceFailure(error),
        }),
      };
    }
  }));
  return {
    records: results.flatMap((item) => item.records),
    diagnostics: results.map((item) => item.diagnostic),
    allSourcesSucceeded: results.every((item) => item.diagnostic.success),
  };
}

module.exports = {
  LIVE_REFRESH_DEADLINE_MS,
  NASDAQ_LISTING_SOURCES,
  SNAPSHOT_MAXIMUM_AGE_MS,
  boundedSourceDiagnostic,
  classifySourceFailure,
  fetchLiveListingRecords,
  parseNasdaqListingText,
  resolveSnapshotCandidates,
  snapshotDocumentStatus,
};
