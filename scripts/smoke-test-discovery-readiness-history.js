const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const fixture = require("./fixtures/discovery-readiness-history.json");
const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const {
  DISCOVERY_BUCKET_DEFINITIONS,
  DISCOVERY_READINESS_MAXIMUM_OBSERVATIONS,
  DISCOVERY_READINESS_OBSERVATION_MAX_BYTES,
} = require("../discovery/constants");
const {
  normalizeReadinessHistory,
  normalizeReadinessObservation,
  readReadinessHistory,
  readinessHistoryDiagnostics,
  recordReadinessObservation,
  uniqueSiblingName,
} = require("../discovery/readiness-history");
const { evaluateReadiness } = require("../discovery/readiness-gate");

function passingObservation(index, overrides = {}) {
  return {
    source: "production-scan",
    completedScan: true,
    observedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    scanIdentifier: `scan-${String(index).padStart(3, "0")}`,
    activeEngine: "legacy",
    requestedEngine: "v3-evidence-buckets",
    resolvedEngine: "v3-evidence-buckets",
    shadowEnabled: true,
    v3ExecutionAttempted: true,
    v3ExecutionSucceeded: true,
    explicitV3Requested: true,
    selectorActivatedV3: true,
    durationMs: 1000,
    runtimeLimitMs: 5000,
    qualifiedCandidateCount: 40,
    deepAnalysisCandidateCount: 40,
    minimumViableCandidateCount: 20,
    selectedCandidateCount: 40,
    ineligibleSelectedCount: 0,
    unqualifiedSelectedCount: 0,
    duplicateTickerCount: 0,
    fatalErrorCount: 0,
    explanationRequiredCount: 40,
    explanationCompleteCount: 40,
    explanationErrorCount: 0,
    eligibleEvaluatedCount: 100,
    sufficientEvidenceCount: 90,
    bucketAvailability: Object.fromEntries(
      Object.keys(DISCOVERY_BUCKET_DEFINITIONS).map((bucket) => [bucket, true]),
    ),
    availableBucketCount: 8,
    fallbackApplied: true,
    fallbackReason: "V3_OUTPUT_INSUFFICIENT",
    fallbackRequired: true,
    fallbackSucceeded: true,
    hybridPoolUsed: false,
    scanInterrupted: false,
    shadowExpected: true,
    shadowAvailable: true,
    apiCompatible: true,
    persistenceCompatible: true,
    predictionBoundaryCompatible: true,
    selectorAmbiguous: false,
    deterministicPassed: true,
    unresolvedCriticalDiagnostics: [],
    knownDataProvenanceBlocker: false,
    ...overrides,
  };
}

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "pti-readiness-history-"));
const historyFile = path.join(temporaryDirectory, "history.json");

(async () => {
try {
  const missing = readReadinessHistory(historyFile);
  assert.deepEqual(missing.history.observations, []);
  assert.equal(missing.storageAvailable, true);

  fs.writeFileSync(historyFile, "{ malformed", "utf8");
  const malformedFile = readReadinessHistory(historyFile);
  assert.deepEqual(malformedFile.history.observations, []);
  assert.equal(malformedFile.storageAvailable, false);
  assert.match(malformedFile.readError, /empty history/);

  fs.writeFileSync(historyFile, JSON.stringify(fixture), "utf8");
  const mixed = readReadinessHistory(historyFile);
  assert.equal(mixed.history.observations.length, 1);
  assert.equal(mixed.malformedObservationsDropped, 2);
  assert.equal(mixed.history.observations[0].scanIdentifier, "scan-valid-fixture");

  const capped = normalizeReadinessHistory({
    observations: Array.from({ length: 105 }, (_, index) => passingObservation(index)),
  });
  assert.equal(capped.history.observations.length, DISCOVERY_READINESS_MAXIMUM_OBSERVATIONS);
  assert.equal(capped.history.observations[0].scanIdentifier, "scan-005");
  assert.equal(capped.history.observations.at(-1).scanIdentifier, "scan-104");
  assert.deepEqual(
    capped.history.observations.map((item) => item.observedAt),
    [...capped.history.observations].map((item) => item.observedAt).sort(),
  );

  const duplicate = normalizeReadinessHistory({
    observations: [
      passingObservation(1, { v3ExecutionSucceeded: false }),
      passingObservation(1, { v3ExecutionSucceeded: true }),
    ],
  });
  assert.equal(duplicate.history.observations.length, 1);
  assert.equal(duplicate.deduplicatedCount, 1);

  const unknowns = normalizeReadinessObservation(passingObservation(2, {
    apiCompatible: "yes",
    durationMs: "",
    bucketAvailability: {},
  }));
  assert.equal(unknowns.apiCompatible, null);
  assert.equal(unknowns.durationMs, null);
  assert.ok(Object.values(unknowns.bucketAvailability).every((value) => value === null));
  assert.equal(normalizeReadinessObservation(passingObservation(3, { source: "smoke-fixture" })), null);
  assert.equal(normalizeReadinessObservation(passingObservation(4, { completedScan: false })), null);

  fs.rmSync(historyFile, { force: true });
  const first = await recordReadinessObservation({ file: historyFile, observation: passingObservation(10) });
  const repeated = await recordReadinessObservation({ file: historyFile, observation: passingObservation(10) });
  assert.equal(first.status.observationRecorded, true);
  assert.equal(repeated.status.observationRecorded, false);
  assert.equal(repeated.status.deduplicated, true);
  assert.equal(repeated.history.observations.length, 1);
  assert.equal(repeated.history.observations.at(-1).scanIdentifier, "scan-010");
  const replaced = await recordReadinessObservation({ file: historyFile, observation: passingObservation(11) });
  assert.equal(replaced.status.observationRecorded, true);
  assert.equal(replaced.history.observations.length, 2);
  assert.equal(JSON.parse(fs.readFileSync(historyFile, "utf8")).observations.length, 2);
  assert.equal(fs.readdirSync(temporaryDirectory).some((name) => name.endsWith(".tmp")), false);

  const serialized = JSON.stringify(repeated.history.observations[0]);
  assert.ok(Buffer.byteLength(serialized, "utf8") <= DISCOVERY_READINESS_OBSERVATION_MAX_BYTES);
  for (const forbidden of ["rawEvidence", "providerPayload", "predictions", "stack", "secret"]) {
    assert.equal(Object.hasOwn(repeated.history.observations[0], forbidden), false);
  }

  const readFailureFs = {
    existsSync: () => true,
    readFileSync: () => { throw new Error("sensitive read failure"); },
  };
  const failedRead = readReadinessHistory("ignored", readFailureFs);
  assert.deepEqual(failedRead.history.observations, []);
  assert.doesNotMatch(failedRead.readError, /sensitive/);

  const writeFailureFs = {
    existsSync: () => false,
    mkdirSync: () => {},
    writeFileSync: () => { throw new Error("sensitive write failure"); },
    unlinkSync: () => {},
  };
  const failedWrite = await recordReadinessObservation({
    file: path.join("ignored", "history.json"),
    observation: passingObservation(11),
    fileSystem: writeFailureFs,
  });
  assert.equal(failedWrite.status.storageAvailable, false);
  assert.match(failedWrite.status.writeError, /unaffected/);
  assert.equal(failedWrite.history.observations.length, 1);

  const malformedOriginal = "{ definitely malformed";
  fs.writeFileSync(historyFile, malformedOriginal, "utf8");
  const quarantined = await recordReadinessObservation({
    file: historyFile,
    observation: passingObservation(12),
  });
  assert.equal(quarantined.status.malformedSourceDetected, true);
  assert.equal(quarantined.status.malformedSourceQuarantined, true);
  assert.equal(JSON.parse(fs.readFileSync(historyFile, "utf8")).observations.length, 1);
  const quarantinesAfterSuccess = fs.readdirSync(temporaryDirectory)
    .filter((name) => name.includes(".malformed."));
  assert.ok(quarantinesAfterSuccess.length >= 1);
  assert.equal(
    quarantinesAfterSuccess.some((name) =>
      fs.readFileSync(path.join(temporaryDirectory, name), "utf8") === malformedOriginal),
    true,
  );

  const quarantineFailureFile = path.join(temporaryDirectory, "quarantine-failure.json");
  fs.writeFileSync(quarantineFailureFile, malformedOriginal, "utf8");
  const quarantineFailureFs = {
    ...fs,
    renameSync: () => { throw new Error("quarantine denied"); },
  };
  const quarantineFailed = await recordReadinessObservation({
    file: quarantineFailureFile,
    observation: passingObservation(13),
    fileSystem: quarantineFailureFs,
  });
  assert.equal(quarantineFailed.status.malformedSourceQuarantined, false);
  assert.match(quarantineFailed.status.quarantineError, /preserved/);
  assert.equal(fs.readFileSync(quarantineFailureFile, "utf8"), malformedOriginal);

  for (let index = 0; index < 5; index += 1) {
    fs.writeFileSync(historyFile, `{ malformed-${index}`, "utf8");
    const result = await recordReadinessObservation({
      file: historyFile,
      observation: passingObservation(20 + index),
    });
    assert.equal(result.status.malformedSourceQuarantined, true);
  }
  assert.equal(
    fs.readdirSync(temporaryDirectory).filter((name) =>
      name.startsWith(`${path.basename(historyFile)}.malformed.`)).length,
    3,
  );

  fs.rmSync(historyFile, { force: true });
  const overlapping = await Promise.all([
    recordReadinessObservation({ file: historyFile, observation: passingObservation(30) }),
    recordReadinessObservation({ file: historyFile, observation: passingObservation(31) }),
  ]);
  assert.equal(overlapping[1].status.writeQueued, true);
  assert.equal(readReadinessHistory(historyFile).history.observations.length, 2);

  fs.rmSync(historyFile, { force: true });
  await Promise.all([
    recordReadinessObservation({ file: historyFile, observation: passingObservation(32) }),
    recordReadinessObservation({ file: historyFile, observation: passingObservation(32) }),
  ]);
  assert.equal(readReadinessHistory(historyFile).history.observations.length, 1);

  let failNextWrite = true;
  const transientFailureFs = {
    ...fs,
    writeFileSync: (...args) => {
      if (failNextWrite) {
        failNextWrite = false;
        throw new Error("transient failure");
      }
      return fs.writeFileSync(...args);
    },
  };
  fs.rmSync(historyFile, { force: true });
  const queuedAfterFailure = await Promise.all([
    recordReadinessObservation({
      file: historyFile,
      observation: passingObservation(33),
      fileSystem: transientFailureFs,
    }),
    recordReadinessObservation({
      file: historyFile,
      observation: passingObservation(34),
      fileSystem: transientFailureFs,
    }),
  ]);
  assert.ok(queuedAfterFailure[0].status.writeError);
  assert.equal(queuedAfterFailure[1].status.observationRecorded, true);
  assert.equal(readReadinessHistory(historyFile).history.observations.at(-1).scanIdentifier, "scan-034");

  const originalNow = Date.now;
  Date.now = () => 1234567890;
  try {
    const firstName = uniqueSiblingName(historyFile, "tmp");
    const secondName = uniqueSiblingName(historyFile, "tmp");
    assert.notEqual(firstName, secondName);
  } finally {
    Date.now = originalNow;
  }
  assert.equal(fs.readdirSync(temporaryDirectory).some((name) => name.endsWith(".tmp")), false);

  const nineteen = Array.from({ length: 19 }, (_, index) => passingObservation(index));
  const twenty = Array.from({ length: 20 }, (_, index) => passingObservation(index));
  const insufficient = evaluateReadiness({ observations: nineteen });
  const sufficient = evaluateReadiness({ observations: twenty });
  assert.equal(insufficient.criteria.find((item) => item.criterionId === "observation-sufficiency").pass, false);
  assert.equal(sufficient.criteria.find((item) => item.criterionId === "observation-sufficiency").pass, true);
  assert.ok(sufficient.criteria.every((item) => item.pass));

  const blocked = evaluateReadiness({
    observations: twenty.map((item, index) => index === 19
      ? {
          ...item,
          unresolvedCriticalDiagnostics: [{
            reasonCode: "UNRESOLVED_DATA_PROVENANCE_FAILURE",
            message: "Known pre-existing blocker.",
            preExisting: true,
          }],
          knownDataProvenanceBlocker: true,
        }
      : item),
  });
  assert.equal(blocked.readyForDefaultPromotion, false);
  assert.ok(blocked.blockingReasons.some((item) => item.reasonCode === "UNRESOLVED_DATA_PROVENANCE_FAILURE"));

  const diagnostics = readinessHistoryDiagnostics(replaced.history, replaced.status);
  assert.equal(diagnostics.retainedObservationCount, 2);
  assert.equal(Object.hasOwn(diagnostics, "observations"), false);

  const refreshStart = serverSource.indexOf("async function refreshPredictions(");
  const predictionMapping = serverSource.indexOf(".map((stock) => buildPrediction(", refreshStart);
  const scanIdentifier = serverSource.indexOf("const scanId =", predictionMapping);
  const historyRecording = serverSource.indexOf("buildDiscoveryReadinessDiagnostics({", scanIdentifier);
  const predictionPersistence = serverSource.indexOf("appendPredictionHistory(", historyRecording);
  assert.ok(refreshStart >= 0 && predictionMapping > refreshStart);
  assert.ok(scanIdentifier > predictionMapping);
  assert.ok(historyRecording > scanIdentifier);
  assert.ok(predictionPersistence > historyRecording);
  assert.equal((serverSource.match(/buildDiscoveryReadinessDiagnostics\(\{/g) || []).length, 2);
  assert.match(serverSource, /discoveryReadinessHistory:\s*discoveryReadinessHistoryDiagnostics/);
  assert.match(serverSource, /apiCompatible:\s*null/);
  assert.match(serverSource, /persistenceCompatible:\s*null/);
  assert.match(serverSource, /predictionBoundaryCompatible:\s*null/);

  console.log("Discovery readiness-history smoke test passed.");
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
