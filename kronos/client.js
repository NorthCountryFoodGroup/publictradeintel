"use strict";
const { DEFAULT_TIMEOUT_MS, MAX_RESPONSE_BYTES, MAX_CONCURRENCY, MAX_QUEUE } = require("./constants");
const { validateAdapterResponse } = require("./schema");
function createKronosClient({ endpoint, fetchImpl = global.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, concurrency = MAX_CONCURRENCY, maximumQueue = MAX_QUEUE } = {}) {
  let active = 0; const queue = [];
  function runNext() { if (active >= concurrency || !queue.length) return; const job = queue.shift(); active += 1; job().finally(() => { active -= 1; runNext(); }); }
  function schedule(job) { if (active >= concurrency && queue.length >= maximumQueue) return Promise.reject(Object.assign(new Error("Kronos capacity unavailable."), { code: "capacity_unavailable" })); return new Promise((resolve, reject) => { queue.push(() => Promise.resolve().then(job).then(resolve, reject)); runNext(); }); }
  async function infer(payload) {
    if (!endpoint || !/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/i.test(endpoint)) throw Object.assign(new Error("Kronos Phase 1 requires a loopback-only service URL."), { code: "service_unavailable" });
    return schedule(async () => { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); try { const response = await fetchImpl(`${endpoint.replace(/\/$/, "")}/v1/forecast`, { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) }); if (!response.ok) throw Object.assign(new Error("Kronos service rejected the request."), { code: response.status === 429 ? "capacity_unavailable" : "service_unavailable" }); const text = await response.text(); if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) throw Object.assign(new Error("Kronos response exceeded the size limit."), { code: "response_too_large" }); return validateAdapterResponse(JSON.parse(text), payload.forecastObservationCount); } catch (error) { if (error?.name === "AbortError") error.code = "timeout"; if (error instanceof SyntaxError) error.code = "invalid_model_output"; throw error; } finally { clearTimeout(timer); } });
  }
  return { infer, diagnostics: () => ({ active, queued: queue.length, concurrency, maximumQueue, timeoutMs }) };
}
module.exports = { createKronosClient };
