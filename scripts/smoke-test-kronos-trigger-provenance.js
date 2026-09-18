"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { validateForecastRequest, validateTriggerMode } = require("../kronos/schema");
const { createShadowStore } = require("../kronos/persistence");
const { createKronosShadowService } = require("../kronos/service");

const id = "7676c5fe-a320-4007-9353-3e98b5e9143f";
const expected = {
  id, ticker: "AAPL", horizon: "7-Day", generatedAt: "2026-09-18T17:55:21.433Z",
  executionMode: "real_model", productionInfluence: false, sampleCount: 8, forecastBars: 5,
  sourceRevision: "67b630e67f6a18c9e9be918d9b4337c960db1e9a",
  modelRevision: "f4e68697d9d5aed55cef5c96aabc3376bcad9f81",
  tokenizerRevision: "26966d0035065a0cae0ebad7af8ece35bc1fb51c",
};
const rawForecastSamples = Array.from({ length: 8 }, (_, sample) => Array.from({ length: 5 }, (_, bar) => ({ timestamp: `2026-09-${21 + bar}T13:30:00.000Z`, open: 100 + sample, high: 102 + sample, low: 99 + sample, close: 101 + sample, volume: 1000 })));
const normalizedForecastSamples = JSON.parse(JSON.stringify(rawForecastSamples));
const signal = { direction: "bearish", medianExpectedReturn: -0.023755 };
const forecast = {
  id, ticker: "AAPL", forecastHorizon: "7-Day", createdAt: expected.generatedAt,
  executionMode: "real_model", productionInfluence: false, forecastObservationCount: 5,
  sourceRevision: expected.sourceRevision, modelVersion: expected.modelRevision,
  tokenizerVersion: expected.tokenizerRevision, rawForecastSamples, normalizedForecastSamples, signal,
};

(async () => {
  assert.throws(() => validateForecastRequest({ ticker: "AAPL", horizon: "7-Day", triggerMode: "automatic_shadow" }), /unsupported fields/, "client trigger provenance must be rejected");
  assert.equal(validateTriggerMode("manual"), "manual");
  assert.throws(() => validateTriggerMode("unknown"), /invalid/);

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pti-kronos-trigger-"));
  const file = path.join(directory, "kronosShadowForecasts.json");
  fs.writeFileSync(file, `${JSON.stringify({ version: 1, forecasts: [forecast], outcomes: [], comparisons: [] }, null, 2)}\n`);
  const store = createShadowStore(file);
  assert.equal(store.latest("AAPL").triggerMode, undefined, "legacy forecast without provenance remains readable");
  const before = store.latest("AAPL");
  const result = await store.repairForecastTriggerMode({ id, expected, triggerMode: "manual" });
  assert.equal(result.repaired, true);
  const after = createShadowStore(file).latest("AAPL");
  assert.equal(after.triggerMode, "manual", "manual provenance survives persistence reload");
  const { triggerMode, ...afterWithoutTrigger } = after;
  assert.deepEqual(afterWithoutTrigger, before, "metadata repair must change only triggerMode");
  assert.deepEqual(after.rawForecastSamples, rawForecastSamples);
  assert.deepEqual(after.normalizedForecastSamples, normalizedForecastSamples);
  assert.deepEqual(after.signal, signal);
  assert.equal(after.productionInfluence, false);
  assert.equal((await store.repairForecastTriggerMode({ id, expected, triggerMode: "manual" })).alreadyApplied, true, "repair is idempotent");
  await assert.rejects(store.repairForecastTriggerMode({ id, expected: { ...expected, sampleCount: 9 }, triggerMode: "manual" }), (error) => error.code === "repair_predicate_mismatch");
  assert.equal(store.latest("AAPL").triggerMode, "manual");

  let inferenceCalls = 0;
  const persistedBeforeRead = fs.readFileSync(file, "utf8");
  const disabledService = createKronosShadowService({
    enabled: false,
    store,
    client: { infer: async () => { inferenceCalls += 1; }, diagnostics: () => ({}) },
    historyLoader: async () => { throw new Error("read path must not load history"); },
  });
  assert.equal(disabledService.latest("AAPL").id, id, "disabled inference must not hide stored research");
  assert.equal(disabledService.latest("MSFT"), null, "missing research remains a truthful empty result");
  assert.equal(inferenceCalls, 0, "stored-research reads must not call Python inference");
  assert.equal(fs.readFileSync(file, "utf8"), persistedBeforeRead, "stored-research reads must not mutate persistence");
  await assert.rejects(disabledService.forecast({ ticker: "AAPL", horizon: "7-Day" }, { triggerMode: "manual" }), (error) => error.code === "feature_disabled");
  assert.equal(inferenceCalls, 0, "disabled forecast creation must fail before Python inference");

  const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.match(server, /forecast\(await collectBody\(request\), \{ triggerMode: "manual" \}\)/, "manual route assigns provenance server-side");
  assert.match(server, /classification: "not_found"/, "missing read-only research must remain a truthful not-found result while inference is disabled");
  assert.doesNotMatch(server, /FEATURE_FLAGS\.kronosShadowEnabled \? "not_found" : "feature_disabled"/, "read-only absence must not inherit the inference feature gate");
  assert.doesNotMatch(server.slice(server.indexOf("async function runPredictionScan"), server.indexOf("function summarizeEvents")), /kronosShadowService\.forecast/, "automatic collection must remain absent");
  assert.match(app, /Trigger: Manual shadow research\./);
  console.log("Server-authoritative Kronos trigger provenance and guarded metadata repair: PASS");
})().finally(() => {}).catch((error) => { console.error(error); process.exitCode = 1; });
