const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  DISCOVERY_BUCKET_DEFINITIONS,
  DISCOVERY_READINESS_HISTORY_VERSION,
  DISCOVERY_READINESS_MAXIMUM_OBSERVATIONS,
  DISCOVERY_READINESS_OBSERVATION_MAX_BYTES,
  DISCOVERY_READINESS_OBSERVATION_VERSION,
} = require("./constants");

const MAXIMUM_QUARANTINE_FILES = 3;
let uniqueNameCounter = 0;
let mutationQueue = Promise.resolve();
let pendingMutations = 0;

function nullableBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function nullableNumber(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : null;
}

function boundedText(value, maximum = 120) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, maximum) : null;
}

function isoTimestamp(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeCriticalDiagnostics(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((item) => ({
      reasonCode: boundedText(item?.reasonCode, 100),
      message: boundedText(item?.message, 240),
      preExisting: item?.preExisting === true,
    }))
    .filter((item) => item.reasonCode)
    .sort((left, right) =>
      left.reasonCode.localeCompare(right.reasonCode) ||
      String(left.message).localeCompare(String(right.message)))
    .filter((item) => {
      const key = JSON.stringify(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

function normalizeBucketAvailability(value) {
  return Object.fromEntries(Object.keys(DISCOVERY_BUCKET_DEFINITIONS).map((bucketId) => [
    bucketId,
    nullableBoolean(value?.[bucketId]),
  ]));
}

function normalizeReadinessObservation(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  if (input.source !== "production-scan" || input.completedScan !== true) return null;
  const observedAt = isoTimestamp(input.observedAt);
  const scanIdentifier = boundedText(input.scanIdentifier || input.scanId, 120);
  if (!observedAt || !scanIdentifier) return null;
  const observation = {
    observationVersion: DISCOVERY_READINESS_OBSERVATION_VERSION,
    source: "production-scan",
    completedScan: true,
    observedAt,
    scanIdentifier,
    activeEngine: boundedText(input.activeEngine, 40),
    requestedEngine: boundedText(input.requestedEngine, 80),
    resolvedEngine: boundedText(input.resolvedEngine, 40),
    shadowEnabled: nullableBoolean(input.shadowEnabled),
    v3ExecutionAttempted: nullableBoolean(input.v3ExecutionAttempted),
    v3ExecutionSucceeded: nullableBoolean(input.v3ExecutionSucceeded),
    explicitV3Requested: nullableBoolean(input.explicitV3Requested),
    selectorActivatedV3: nullableBoolean(input.selectorActivatedV3),
    durationMs: nullableNumber(input.durationMs, 0, 120000),
    runtimeLimitMs: nullableNumber(input.runtimeLimitMs, 1, 120000),
    qualifiedCandidateCount: nullableNumber(input.qualifiedCandidateCount, 0, 2000),
    deepAnalysisCandidateCount: nullableNumber(input.deepAnalysisCandidateCount, 0, 2000),
    minimumViableCandidateCount: nullableNumber(input.minimumViableCandidateCount, 1, 1000),
    selectedCandidateCount: nullableNumber(input.selectedCandidateCount, 0, 2000),
    ineligibleSelectedCount: nullableNumber(input.ineligibleSelectedCount, 0, 2000),
    unqualifiedSelectedCount: nullableNumber(input.unqualifiedSelectedCount, 0, 2000),
    duplicateTickerCount: nullableNumber(input.duplicateTickerCount, 0, 2000),
    fatalErrorCount: nullableNumber(input.fatalErrorCount, 0, 2000),
    explanationRequiredCount: nullableNumber(input.explanationRequiredCount, 0, 2000),
    explanationCompleteCount: nullableNumber(input.explanationCompleteCount, 0, 2000),
    explanationErrorCount: nullableNumber(input.explanationErrorCount, 0, 2000),
    eligibleEvaluatedCount: nullableNumber(input.eligibleEvaluatedCount, 0, 100000),
    sufficientEvidenceCount: nullableNumber(input.sufficientEvidenceCount, 0, 100000),
    bucketAvailability: normalizeBucketAvailability(input.bucketAvailability),
    availableBucketCount: nullableNumber(input.availableBucketCount, 0, 8),
    fallbackApplied: nullableBoolean(input.fallbackApplied),
    fallbackReason: boundedText(input.fallbackReason, 100),
    fallbackRequired: nullableBoolean(input.fallbackRequired),
    fallbackSucceeded: nullableBoolean(input.fallbackSucceeded),
    hybridPoolUsed: nullableBoolean(input.hybridPoolUsed),
    scanInterrupted: nullableBoolean(input.scanInterrupted),
    shadowExpected: nullableBoolean(input.shadowExpected),
    shadowAvailable: nullableBoolean(input.shadowAvailable),
    apiCompatible: nullableBoolean(input.apiCompatible),
    persistenceCompatible: nullableBoolean(input.persistenceCompatible),
    predictionBoundaryCompatible: nullableBoolean(input.predictionBoundaryCompatible),
    selectorAmbiguous: nullableBoolean(input.selectorAmbiguous),
    deterministicPassed: nullableBoolean(input.deterministicPassed),
    unresolvedCriticalDiagnostics: normalizeCriticalDiagnostics(input.unresolvedCriticalDiagnostics),
    knownDataProvenanceBlocker: input.knownDataProvenanceBlocker === true,
  };
  return Buffer.byteLength(JSON.stringify(observation), "utf8") <= DISCOVERY_READINESS_OBSERVATION_MAX_BYTES
    ? observation
    : null;
}

function normalizeReadinessHistory(input = {}) {
  const rawObservations = Array.isArray(input?.observations) ? input.observations : [];
  const valid = rawObservations.map(normalizeReadinessObservation).filter(Boolean);
  const malformedObservationsDropped = rawObservations.length - valid.length;
  const byScan = new Map();
  valid
    .sort((left, right) =>
      left.observedAt.localeCompare(right.observedAt) ||
      left.scanIdentifier.localeCompare(right.scanIdentifier))
    .forEach((observation) => byScan.set(observation.scanIdentifier, observation));
  const deduplicatedCount = valid.length - byScan.size;
  const observations = [...byScan.values()]
    .sort((left, right) =>
      left.observedAt.localeCompare(right.observedAt) ||
      left.scanIdentifier.localeCompare(right.scanIdentifier))
    .slice(-DISCOVERY_READINESS_MAXIMUM_OBSERVATIONS);
  return {
    history: {
      historyVersion: DISCOVERY_READINESS_HISTORY_VERSION,
      observations,
    },
    malformedObservationsDropped,
    deduplicatedCount,
  };
}

function readReadinessHistory(file, fileSystem = fs) {
  try {
    if (!fileSystem.existsSync(file)) {
      return {
        ...normalizeReadinessHistory({ observations: [] }),
        storageAvailable: true,
        readError: null,
        malformedSourceDetected: false,
      };
    }
    const parsed = JSON.parse(fileSystem.readFileSync(file, "utf8"));
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      parsed.historyVersion !== DISCOVERY_READINESS_HISTORY_VERSION ||
      !Array.isArray(parsed.observations)
    ) {
      throw new Error("Invalid readiness-history structure.");
    }
    return {
      ...normalizeReadinessHistory(parsed),
      storageAvailable: true,
      readError: null,
      malformedSourceDetected: false,
    };
  } catch {
    return {
      ...normalizeReadinessHistory({ observations: [] }),
      storageAvailable: false,
      readError: "Readiness history could not be read; an empty history was used.",
      malformedSourceDetected: true,
    };
  }
}

function uniqueSiblingName(file, label) {
  uniqueNameCounter = (uniqueNameCounter + 1) % Number.MAX_SAFE_INTEGER;
  const random = crypto.randomBytes(8).toString("hex");
  const timestamp = String(Date.now()).padStart(16, "0");
  const counter = String(uniqueNameCounter).padStart(16, "0");
  return `${file}.${label}.${process.pid}.${timestamp}.${counter}.${random}`;
}

function atomicWriteHistory(file, history, fileSystem = fs) {
  const directory = path.dirname(file);
  const temporary = uniqueSiblingName(file, "tmp");
  try {
    fileSystem.mkdirSync(directory, { recursive: true });
    fileSystem.writeFileSync(temporary, `${JSON.stringify(history, null, 2)}\n`, "utf8");
    fileSystem.renameSync(temporary, file);
    return { writeError: null, storageAvailable: true };
  } catch {
    try {
      if (fileSystem.existsSync(temporary)) fileSystem.unlinkSync(temporary);
    } catch {
      // Cleanup failure is intentionally non-fatal.
    }
    return {
      writeError: "Readiness history could not be written; scan and prediction output were unaffected.",
      storageAvailable: false,
    };
  }
}

function quarantineFiles(file, fileSystem = fs) {
  const directory = path.dirname(file);
  const prefix = `${path.basename(file)}.malformed.`;
  try {
    return {
      files: fileSystem.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.startsWith(prefix))
      .map((entry) => {
        const candidate = path.join(directory, entry.name);
        let modifiedAt = 0;
        try {
          modifiedAt = Number(fileSystem.statSync(candidate).mtimeMs) || 0;
        } catch {
          // A deterministic filename tiebreaker remains available.
        }
        return { candidate, modifiedAt };
      })
      .sort((left, right) =>
        left.modifiedAt - right.modifiedAt || left.candidate.localeCompare(right.candidate)),
      error: false,
    };
  } catch {
    return { files: [], error: true };
  }
}

function quarantineMalformedSource(file, fileSystem = fs) {
  const quarantine = uniqueSiblingName(file, "malformed");
  try {
    fileSystem.renameSync(file, quarantine);
  } catch {
    return {
      malformedSourceQuarantined: false,
      quarantineError: "Malformed readiness history could not be quarantined; the source file was preserved.",
    };
  }
  const listed = quarantineFiles(file, fileSystem);
  const candidates = listed.files;
  const excess = Math.max(0, candidates.length - MAXIMUM_QUARANTINE_FILES);
  let cleanupFailed = listed.error;
  candidates.slice(0, excess).forEach(({ candidate }) => {
    try {
      fileSystem.unlinkSync(candidate);
    } catch {
      cleanupFailed = true;
    }
  });
  return {
    malformedSourceQuarantined: true,
    quarantineError: cleanupFailed
      ? "Malformed readiness-history quarantine cleanup was incomplete."
      : null,
  };
}

function mutateReadinessObservation({ file, observation, fileSystem, writeQueued }) {
  const read = readReadinessHistory(file, fileSystem);
  const normalized = normalizeReadinessObservation(observation);
  if (!normalized) {
    return {
      history: read.history,
      status: {
        observationRecorded: false,
        deduplicated: false,
        malformedObservationsDropped: read.malformedObservationsDropped + 1,
        readError: read.readError,
        writeError: null,
        storageAvailable: read.storageAvailable,
        malformedSourceDetected: read.malformedSourceDetected,
        malformedSourceQuarantined: false,
        quarantineError: null,
        writeQueued,
      },
    };
  }
  let quarantine = {
    malformedSourceQuarantined: false,
    quarantineError: null,
  };
  if (read.malformedSourceDetected) {
    quarantine = quarantineMalformedSource(file, fileSystem);
    if (!quarantine.malformedSourceQuarantined) {
      return {
        history: read.history,
        status: {
          observationRecorded: false,
          deduplicated: false,
          malformedObservationsDropped: read.malformedObservationsDropped,
          readError: read.readError,
          writeError: "Readiness history was not written because malformed source quarantine failed.",
          storageAvailable: false,
          malformedSourceDetected: true,
          ...quarantine,
          writeQueued,
        },
      };
    }
  }
  const existing = read.history.observations.find((item) => item.scanIdentifier === normalized.scanIdentifier);
  if (existing) {
    return {
      history: read.history,
      status: {
        observationRecorded: false,
        deduplicated: true,
        malformedObservationsDropped: read.malformedObservationsDropped,
        readError: read.readError,
        writeError: null,
        storageAvailable: read.storageAvailable,
        malformedSourceDetected: read.malformedSourceDetected,
        ...quarantine,
        writeQueued,
      },
    };
  }
  const merged = normalizeReadinessHistory({
    observations: [...read.history.observations, normalized],
  });
  const write = atomicWriteHistory(file, merged.history, fileSystem);
  return {
    history: merged.history,
    status: {
      observationRecorded: !write.writeError,
      deduplicated: false,
      malformedObservationsDropped: read.malformedObservationsDropped + merged.malformedObservationsDropped,
      readError: read.readError,
      writeError: write.writeError,
      storageAvailable: write.storageAvailable,
      malformedSourceDetected: read.malformedSourceDetected,
      ...quarantine,
      writeQueued,
    },
  };
}

function recordReadinessObservation({ file, observation, fileSystem = fs }) {
  const writeQueued = pendingMutations > 0;
  pendingMutations += 1;
  const mutation = mutationQueue
    .catch(() => undefined)
    .then(() => mutateReadinessObservation({
      file,
      observation,
      fileSystem,
      writeQueued,
    }));
  mutationQueue = mutation.then(
    () => undefined,
    () => undefined,
  );
  return mutation.finally(() => {
    pendingMutations = Math.max(0, pendingMutations - 1);
  });
}

function readinessHistoryDiagnostics(history, status) {
  const observations = history?.observations || [];
  return {
    historyVersion: DISCOVERY_READINESS_HISTORY_VERSION,
    storageEnabled: true,
    storageAvailable: status.storageAvailable === true,
    retainedObservationCount: observations.length,
    maximumObservationCount: DISCOVERY_READINESS_MAXIMUM_OBSERVATIONS,
    oldestObservationAt: observations[0]?.observedAt || null,
    newestObservationAt: observations.at(-1)?.observedAt || null,
    observationRecorded: status.observationRecorded === true,
    deduplicated: status.deduplicated === true,
    malformedObservationsDropped: Number(status.malformedObservationsDropped) || 0,
    readError: status.readError || null,
    writeError: status.writeError || null,
    malformedSourceDetected: status.malformedSourceDetected === true,
    malformedSourceQuarantined: status.malformedSourceQuarantined === true,
    quarantineError: status.quarantineError || null,
    writeQueued: status.writeQueued === true,
    warnings: [status.readError, status.quarantineError, status.writeError].filter(Boolean),
    limitations: [
      "The normal API exposes history status only, not stored observations.",
      "History contains bounded diagnostic summaries and no raw evidence, provider payloads, or prediction records.",
      "Mutation serialization protects overlapping scans in one application process; multiple independent writers require external coordination.",
    ],
  };
}

module.exports = {
  atomicWriteHistory,
  normalizeReadinessHistory,
  normalizeReadinessObservation,
  quarantineMalformedSource,
  readReadinessHistory,
  readinessHistoryDiagnostics,
  recordReadinessObservation,
  uniqueSiblingName,
};
