"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { loadFeatureFlags } = require("../config/feature-flags");
const { createKronosShadowService } = require("../kronos/service");
const { validateForecastRequest } = require("../kronos/schema");
const root = path.resolve(__dirname, "..");
const flagNames = ["KRONOS_SHADOW_ENABLED", "KRONOS_AUTO_COLLECTION_ENABLED", "KRONOS_OUTCOME_EVALUATION_ENABLED"];
const flagKeys = ["kronosShadowEnabled", "kronosAutoCollectionEnabled", "kronosOutcomeEvaluationEnabled"];
for (let index = 0; index < flagNames.length; index++) {
  for (const value of [undefined, null, "", " ", "false", "FALSE", " false ", "yes", "1", 1, "tru", "true false", {}, []]) assert.equal(loadFeatureFlags({ [flagNames[index]]: value })[flagKeys[index]], false);
  for (const value of ["true", "TRUE", " true ", true]) assert.equal(loadFeatureFlags({ [flagNames[index]]: value })[flagKeys[index]], true);
}
for (const field of ["triggerMode", "productionInfluence", "sessionId", "jobId"]) assert.throws(() => validateForecastRequest({ ticker: "AAPL", [field]: "automatic_shadow" }));

// Execute imports in an isolated CommonJS context: every capability except local
// contract imports is forbidden, including process/env access and service startup.
let sideEffects = 0;
const deny = () => { sideEffects++; throw new Error("Unexpected module side effect"); };
const cache = new Map();
function importPure(name) {
  if (cache.has(name)) return cache.get(name).exports;
  const module = { exports: {} }; cache.set(name, module);
  const context = { module, exports: module.exports, require: dependency => {
    if (dependency !== "./research-guards") return deny();
    return importPure("research-guards");
  }, fetch: deny, setTimeout: deny, setInterval: deny, setImmediate: deny, queueMicrotask: deny,
  process: new Proxy({}, { get: deny }), console: new Proxy({}, { get: deny }) };
  vm.runInNewContext(fs.readFileSync(path.join(root, "kronos", `${name}.js`), "utf8"), context);
  return module.exports;
}
importPure("research-contracts"); importPure("research-guards"); assert.equal(sideEffects, 0);

(async () => {
  const stored = Object.freeze({ id: "7676c5fe-a320-4007-9353-3e98b5e9143f", ticker: "AAPL", triggerMode: "manual", productionInfluence: false, forecastHorizon: "7-Day" });
  for (let mask = 0; mask < 8; mask++) {
    const flags = loadFeatureFlags(Object.fromEntries(flagNames.map((key, i) => [key, String(Boolean(mask & (1 << i)))])));
    const calls = { history: 0, readiness: 0, infer: 0, write: 0 };
    const service = createKronosShadowService({ enabled: flags.kronosShadowEnabled,
      client: { readiness: () => { calls.readiness++; throw Error("forbidden"); }, infer: () => { calls.infer++; throw Error("forbidden"); } },
      store: { latest: ticker => ticker === "AAPL" ? stored : null, addForecast: () => { calls.write++; throw Error("forbidden"); } },
      historyLoader: () => { calls.history++; throw Error("forbidden"); } });
    await assert.rejects(service.forecast({ ticker: "AAPL" }, { triggerMode: "automatic_shadow" }), { code: "automatic_execution_unavailable" });
    if (!flags.kronosShadowEnabled) await assert.rejects(service.forecast({ ticker: "AAPL" }, { triggerMode: "manual" }), { code: "feature_disabled" });
    assert.equal(service.latest("aapl"), stored); assert.equal(service.latest("MSFT"), null);
    assert.deepEqual(calls, { history: 0, readiness: 0, infer: 0, write: 0 });
  }
  // Golden manual-service comparison against the approved pre-Slice-1 source.
  // Both services receive inert model output fixtures; no Python or network exists.
  const { execFileSync } = require("node:child_process");
  const baselineSource = execFileSync("git", ["show", "03b0878680cce139b7ae14f5b51bf257ca34ca55:kronos/service.js"], { cwd: root, encoding: "utf8" });
  const load = source => {
    const module = { exports: {} };
    vm.runInNewContext(source, { module, require: name => name === "crypto" ? { randomUUID: () => "fixed-id" } : require(path.join(root, "kronos", name)), Date });
    return module.exports.createKronosShadowService;
  };
  const input = Array.from({ length: 512 }, (_, i) => ({ timestamp: new Date(Date.UTC(2024, 0, 1 + i)).toISOString(), open: 100, high: 101, low: 99, close: 100, volume: 1000 }));
  const samples = Array.from({ length: 8 }, () => Array.from({ length: 5 }, (_, i) => ({ ...input[0], timestamp: new Date(Date.UTC(2026, 8, 21 + i)).toISOString() })));
  const legacy = { predictions: [{ ticker: "AAPL", timeframe: "7-Day", unifiedDirection: "bullish", confidenceScore: 70, rank: 1 }] };
  const before = JSON.stringify(legacy);
  async function run(factory) {
    let record;
    const service = factory({ enabled: true, store: { addForecast: async value => { record = value; } },
      client: { infer: async () => ({ rawSamples: samples, samples, executionMode: "real_model", outputNormalization: "deterministic_ohlcv_envelope_v1", serviceContractVersion: "KRONOS_SHADOW_SERVICE_V1" }) },
      historyLoader: async () => ({ bars: input, source: "fixture" }), predictionLoader: () => legacy, now: () => "2026-09-19T00:00:00.000Z" });
    await service.forecast({ ticker: "AAPL", horizon: "7-Day", sampleCount: 8 }, { triggerMode: "manual" });
    return JSON.parse(JSON.stringify(record));
  }
  const current = load(fs.readFileSync(path.join(root, "kronos/service.js"), "utf8"));
  assert.deepEqual(await run(current), await run(load(baselineSource)));
  assert.equal(JSON.stringify(legacy), before);
  console.log("Slice 1 flags (8 combinations), zero automatic calls, stored reads, import purity, and golden manual compatibility: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
