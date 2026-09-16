"use strict";
const crypto = require("crypto"), fs = require("fs"), path = require("path");
const { STORE_VERSION, MAX_FORECASTS, MAX_OUTCOMES } = require("./constants");
function emptyStore() { return { version: STORE_VERSION, forecasts: [], outcomes: [], comparisons: [] }; }
function validStore(value) { return value?.version === STORE_VERSION && Array.isArray(value.forecasts) && Array.isArray(value.outcomes) && Array.isArray(value.comparisons); }
function createShadowStore(file, { maximumForecasts = MAX_FORECASTS, maximumOutcomes = MAX_OUTCOMES } = {}) {
  let queue = Promise.resolve();
  function read() { try { const value = JSON.parse(fs.readFileSync(file, "utf8")); return validStore(value) ? value : emptyStore(); } catch { return emptyStore(); } }
  function write(value) { const directory = path.dirname(file); const temporary = path.join(directory, `.${path.basename(file)}.${process.pid}.${Date.now()}.${crypto.randomBytes(8).toString("hex")}.tmp`); fs.mkdirSync(directory, { recursive: true }); try { fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`); fs.renameSync(temporary, file); } finally { try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch {} } }
  function mutate(operation) { const result = queue.catch(() => {}).then(() => { const next = operation(read()); write({ ...next, version: STORE_VERSION, updatedAt: new Date().toISOString(), forecasts: next.forecasts.slice(-maximumForecasts), outcomes: next.outcomes.slice(-maximumOutcomes), comparisons: next.comparisons.slice(-maximumOutcomes) }); return next; }); queue = result.then(() => undefined, () => undefined); return result; }
  const addForecast = (forecast) => mutate((store) => ({ ...store, forecasts: [...store.forecasts.filter((item) => item.id !== forecast.id), forecast] })).then(() => forecast);
  const addOutcome = (outcome, comparison = null) => mutate((store) => ({ ...store, outcomes: [...store.outcomes.filter((item) => item.forecastId !== outcome.forecastId), outcome], comparisons: comparison ? [...store.comparisons.filter((item) => item.forecastId !== outcome.forecastId), comparison] : store.comparisons }));
  const latest = (ticker) => [...read().forecasts].reverse().find((item) => item.ticker === ticker) || null;
  return { read, addForecast, addOutcome, latest };
}
module.exports = { emptyStore, validStore, createShadowStore };
