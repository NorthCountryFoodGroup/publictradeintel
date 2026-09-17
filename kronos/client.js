"use strict";
const crypto = require("crypto");
const { DEFAULT_TIMEOUT_MS, MAX_RESPONSE_BYTES, MAX_CONCURRENCY, MAX_QUEUE, SERVICE_CONTRACT_VERSION } = require("./constants");
const { validateAdapterResponse } = require("./schema");
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const PRIVATE_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
function serviceError(code, message = "Kronos research service is unavailable.") { return Object.assign(new Error(message), { code }); }
function validateServiceEndpoint(value, { production = false } = {}) {
  let parsed; try { parsed = new URL(String(value || "").trim()); } catch { throw serviceError("service_unavailable"); }
  if (parsed.protocol !== "http:" || parsed.username || parsed.password || parsed.hash || parsed.search) throw serviceError("service_unavailable");
  const local = LOCAL_HOSTS.has(parsed.hostname.toLowerCase());
  if (production ? (local || !PRIVATE_HOST.test(parsed.hostname) || parsed.hostname.includes(".") || parsed.pathname !== "/") : (!local && !PRIVATE_HOST.test(parsed.hostname))) throw serviceError("service_unavailable");
  return parsed.origin;
}
function boundedRequestId(value) { const supplied = String(value || "").trim(); return /^[A-Za-z0-9_-]{8,64}$/.test(supplied) ? supplied : crypto.randomUUID(); }
function createKronosClient({ endpoint, serviceToken = "", production = false, fetchImpl = global.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, concurrency = MAX_CONCURRENCY, maximumQueue = MAX_QUEUE } = {}) {
  const configuredEndpoint = endpoint ? validateServiceEndpoint(endpoint, { production }) : null; const token = String(serviceToken || "").trim();
  let active = 0; const queue = [];
  function runNext() { if (active >= concurrency || !queue.length) return; const job = queue.shift(); active += 1; job().finally(() => { active -= 1; runNext(); }); }
  function schedule(job) { if (active >= concurrency && queue.length >= maximumQueue) return Promise.reject(Object.assign(new Error("Kronos capacity unavailable."), { code: "capacity_unavailable" })); return new Promise((resolve, reject) => { queue.push(() => Promise.resolve().then(job).then(resolve, reject)); runNext(); }); }
  async function request(pathname, { method = "GET", payload, requestId } = {}) {
    if (!configuredEndpoint || !token) throw serviceError("service_unavailable");
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${configuredEndpoint}${pathname}`, { method, signal: controller.signal, headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "X-Kronos-Request-Id": boundedRequestId(requestId), ...(payload ? { "Content-Type": "application/json" } : {}) }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
      const text = await response.text(); if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) throw serviceError("response_too_large");
      let body; try { body = JSON.parse(text); } catch { throw serviceError("invalid_model_output"); }
      if (!response.ok) { const allowed = new Set(["unauthorized", "not_ready", "invalid_request", "capacity_unavailable", "timeout", "inference_failed", "invalid_model_output", "contract_mismatch"]); throw serviceError(allowed.has(body?.error) ? body.error : "service_unavailable"); }
      if (body?.serviceContractVersion !== SERVICE_CONTRACT_VERSION) throw serviceError("contract_mismatch"); return body;
    } catch (error) { if (error?.name === "AbortError") throw serviceError("timeout"); if (error?.code) throw error; throw serviceError("service_unavailable"); }
    finally { clearTimeout(timer); }
  }
  async function readiness() { const body = await request("/readyz"); if (body.readyForInference !== true) throw serviceError("not_ready"); return body; }
  async function infer(payload, options = {}) {
    return schedule(async () => { const requestId = boundedRequestId(options.requestId); await request("/readyz", { requestId }).then((body) => { if (body.readyForInference !== true) throw serviceError("not_ready"); }); return validateAdapterResponse(await request("/v1/forecast", { method: "POST", payload: { ...payload, serviceContractVersion: SERVICE_CONTRACT_VERSION }, requestId }), payload.forecastObservationCount); });
  }
  return { infer, readiness, diagnostics: () => ({ active, queued: queue.length, concurrency, maximumQueue, timeoutMs, configured: Boolean(configuredEndpoint && token) }) };
}
module.exports = { createKronosClient, validateServiceEndpoint, boundedRequestId };
