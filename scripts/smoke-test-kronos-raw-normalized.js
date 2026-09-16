const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createKronosShadowService } = require("../kronos/service");
const { createShadowStore } = require("../kronos/persistence");

const bar = (timestamp, open, high, low, close) => ({ timestamp, open, high, low, close, volume: 1000 });
const input = Array.from({ length: 64 }, (_, i) => bar(new Date(Date.UTC(2026, 0, 1 + i)).toISOString(), 100 + i, 102 + i, 99 + i, 101 + i));
const rawSamples = [[bar("2026-02-02T00:00:00.000Z", 132, 130, 134, 131)]];
const normalizedSamples = [[bar("2026-02-02T00:00:00.000Z", 132, 134, 130, 131)]];

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pti-kronos-representation-"));
  const store = createShadowStore(path.join(dir, "shadow.json"));
  const service = createKronosShadowService({
    enabled: true,
    store,
    historyLoader: async () => ({ bars: input, source: "isolated-fixture" }),
    client: { infer: async () => ({ rawSamples, samples: normalizedSamples, executionMode: "real_model", outputNormalization: "deterministic_ohlc_envelope_v1", modelName: "NeoQuasar/Kronos-mini", tokenizerName: "NeoQuasar/Kronos-Tokenizer-2k" }) },
  });
  const forecast = await service.forecast({ ticker: "AAPL", horizon: "1-Day" });
  assert.deepEqual(forecast.rawForecastSamples, rawSamples, "raw model output must remain unchanged");
  assert.deepEqual(forecast.normalizedForecastSamples, normalizedSamples, "normalized samples must be stored separately");
  assert.notDeepEqual(forecast.rawForecastSamples, forecast.normalizedForecastSamples);
  const normalized = forecast.normalizedForecastSamples[0][0];
  assert.ok(normalized.high >= Math.max(normalized.open, normalized.close) && normalized.low <= Math.min(normalized.open, normalized.close));
  assert.equal(forecast.executionMode, "real_model");
  assert.equal(forecast.outputNormalization, "deterministic_ohlc_envelope_v1");
  const persisted = store.latest("AAPL");
  assert.deepEqual(persisted.rawForecastSamples, rawSamples);
  assert.deepEqual(persisted.normalizedForecastSamples, normalizedSamples);
  assert.ok(persisted.signal, "analytics must be traceable on the persisted forecast");
  console.log("Kronos raw/normalized preservation and persistence round-trip: PASS");
})().catch((error) => { console.error(error); process.exitCode = 1; });
