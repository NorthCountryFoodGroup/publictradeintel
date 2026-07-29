const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PERIODS = Object.freeze({
  "7D": { range: "1mo", months: 0, days: 7, interval: "1d", ttlMs: 4 * 60 * 60 * 1000 },
  "1M": { range: "3mo", months: 1, days: 0, interval: "1d", ttlMs: 6 * 60 * 60 * 1000 },
  "6M": { range: "1y", months: 6, days: 0, interval: "1d", ttlMs: 12 * 60 * 60 * 1000 },
  "1Y": { range: "2y", months: 12, days: 0, interval: "1d", ttlMs: 18 * 60 * 60 * 1000 },
  "2Y": { range: "5y", months: 24, days: 0, interval: "1wk", ttlMs: 24 * 60 * 60 * 1000 },
});
const MAX_TICKERS = 10;
const MAX_CACHE_ENTRIES = 500;
const MAX_CACHE_BYTES = 8 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 8_000;
const FAILURE_TTLS = Object.freeze({ timeout: 20 * 60 * 1000, throttled: 60 * 60 * 1000, unavailable: 90 * 60 * 1000, unsupported_symbol: 24 * 60 * 60 * 1000, invalid_symbol: 24 * 60 * 60 * 1000 });

function normalizeTicker(value) {
  const ticker = String(value || "").trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,11}$/.test(ticker) ? ticker : null;
}

function validateRequest(searchParams) {
  const allowed = new Set(["tickers", "period", "benchmark", "horizon"]);
  for (const key of searchParams.keys()) if (!allowed.has(key)) throw Object.assign(new Error("Unexpected query parameter."), { code: "invalid_request" });
  const raw = searchParams.get("tickers") || "";
  const inputs = raw.split(",").map((value) => value.trim()).filter(Boolean);
  if (!inputs.length || inputs.length > MAX_TICKERS) throw Object.assign(new Error("Provide between 1 and 10 tickers."), { code: "invalid_ticker_count" });
  const tickers = [...new Set(inputs.map(normalizeTicker))];
  if (tickers.some((ticker) => !ticker) || tickers.length !== inputs.length) throw Object.assign(new Error("Ticker input is invalid or duplicated."), { code: "invalid_symbol" });
  const period = String(searchParams.get("period") || "1M").toUpperCase();
  if (!PERIODS[period]) throw Object.assign(new Error("Unsupported period."), { code: "invalid_period" });
  const benchmark = searchParams.get("benchmark") === "SPY" ? "SPY" : null;
  const horizon = searchParams.get("horizon") || "1-Day";
  if (!["1-Day", "7-Day", "1-Month", "1-Year"].includes(horizon)) throw Object.assign(new Error("Unsupported prediction horizon."), { code: "invalid_period" });
  return { tickers, period, benchmark, horizon };
}

function targetStartDate(endDate, period) {
  const target = new Date(`${endDate}T12:00:00.000Z`);
  const definition = PERIODS[period];
  if (definition.days) target.setUTCDate(target.getUTCDate() - definition.days);
  if (definition.months) target.setUTCMonth(target.getUTCMonth() - definition.months);
  return target.toISOString().slice(0, 10);
}

function normalizeSeries(result, period) {
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const quote = result?.indicators?.quote?.[0] || {};
  const adjusted = result?.indicators?.adjclose?.[0]?.adjclose || quote.close || [];
  const rows = timestamps.map((timestamp, index) => ({
    date: new Date(Number(timestamp) * 1000).toISOString().slice(0, 10),
    adjustedClose: Number(adjusted[index]),
  })).filter((row) => Number.isFinite(row.adjustedClose) && row.adjustedClose > 0);
  if (!rows.length) return [];
  const end = rows.at(-1).date;
  const target = targetStartDate(end, period);
  let startIndex = 0;
  for (let index = 0; index < rows.length; index += 1) if (rows[index].date <= target) startIndex = index;
  const bounded = rows.slice(startIndex);
  const base = bounded[0]?.adjustedClose;
  return bounded.map((row) => ({ ...row, cumulativeReturn: Number((((row.adjustedClose / base) - 1) * 100).toFixed(4)) }));
}

function metricsForSeries(series) {
  if (!series.length) return null;
  let peak = series[0].adjustedClose;
  let maximumDrawdown = 0;
  let bestSessionReturn = null;
  let worstSessionReturn = null;
  for (let index = 0; index < series.length; index += 1) {
    const value = series[index].adjustedClose;
    peak = Math.max(peak, value);
    maximumDrawdown = Math.min(maximumDrawdown, (value / peak) - 1);
    if (index) {
      const session = (value / series[index - 1].adjustedClose) - 1;
      bestSessionReturn = bestSessionReturn === null ? session : Math.max(bestSessionReturn, session);
      worstSessionReturn = worstSessionReturn === null ? session : Math.min(worstSessionReturn, session);
    }
  }
  const prices = series.map((row) => row.adjustedClose);
  return {
    beginningAdjustedPrice: prices[0], endingAdjustedPrice: prices.at(-1),
    totalReturn: Number((((prices.at(-1) / prices[0]) - 1) * 100).toFixed(4)),
    periodHigh: Math.max(...prices), periodLow: Math.min(...prices),
    maximumDrawdown: Number((maximumDrawdown * 100).toFixed(4)),
    bestSessionReturn: bestSessionReturn === null ? null : Number((bestSessionReturn * 100).toFixed(4)),
    worstSessionReturn: worstSessionReturn === null ? null : Number((worstSessionReturn * 100).toFixed(4)),
    observations: series.length, resolvedStartDate: series[0].date, resolvedEndDate: series.at(-1).date,
  };
}

function atomicWrite(file, value) {
  const directory = path.dirname(file);
  const temporary = path.join(directory, `.${path.basename(file)}.${process.pid}.${Date.now()}.${crypto.randomBytes(8).toString("hex")}.tmp`);
  fs.mkdirSync(directory, { recursive: true });
  try { fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`); fs.renameSync(temporary, file); }
  finally { try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch {} }
}

function createHistoricalMarketService({ cacheFile, fetchImpl = global.fetch, now = () => Date.now(), timeoutMs = DEFAULT_TIMEOUT_MS, predictionHistoryLoader = () => [], evidenceLoader = () => [] }) {
  const inFlight = new Map();
  let mutationQueue = Promise.resolve();
  function readCache() {
    try { const value = JSON.parse(fs.readFileSync(cacheFile, "utf8")); return value?.version === 1 && Array.isArray(value.entries) ? value : { version: 1, entries: [] }; }
    catch { return { version: 1, entries: [] }; }
  }
  function persist(entries) {
    let bounded = entries.sort((a, b) => Date.parse(b.cachedAt || 0) - Date.parse(a.cachedAt || 0)).slice(0, MAX_CACHE_ENTRIES);
    while (Buffer.byteLength(JSON.stringify({ version: 1, entries: bounded })) > MAX_CACHE_BYTES && bounded.length) bounded.pop();
    atomicWrite(cacheFile, { version: 1, updatedAt: new Date(now()).toISOString(), entries: bounded });
  }
  function persistEntry(entry) {
    mutationQueue = mutationQueue.catch(() => {}).then(() => {
      const latest = readCache();
      persist([entry, ...latest.entries.filter((item) => item.key !== entry.key)]);
    });
    return mutationQueue;
  }
  async function provider(ticker, period) {
    const definition = PERIODS[period];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const providerTicker = ticker.replace(".", "-");
      const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerTicker)}`);
      url.searchParams.set("range", definition.range); url.searchParams.set("interval", definition.interval); url.searchParams.set("events", "div,splits");
      const response = await fetchImpl(url, { signal: controller.signal, headers: { "User-Agent": "PublicTradeIntelHistory/1.0", Accept: "application/json" } });
      if (response.status === 429) throw Object.assign(new Error("Provider throttled."), { code: "throttled" });
      if (!response.ok) throw Object.assign(new Error("Provider unavailable."), { code: response.status === 404 ? "unsupported_symbol" : "unavailable" });
      const body = await response.json();
      const result = body?.chart?.result?.[0];
      if (!result) throw Object.assign(new Error("Historical data unavailable."), { code: "unsupported_symbol" });
      const series = normalizeSeries(result, period);
      if (series.length < 2) throw Object.assign(new Error("Insufficient historical observations."), { code: "insufficient_history" });
      const fetchedAt = new Date(now()).toISOString();
      return { ticker, securityName: result.meta?.longName || result.meta?.shortName || ticker, source: "Yahoo Finance chart", sourceTimestamp: fetchedAt, fetchedAt, adjusted: true, interval: definition.interval, downsampling: period === "2Y" ? "provider weekly observations; first and last retained" : "none; daily provider observations retained", series, metrics: metricsForSeries(series), partialData: false, stale: false };
    } catch (error) {
      if (error?.name === "AbortError") error.code = "timeout";
      throw error;
    } finally { clearTimeout(timer); }
  }
  async function getOne(ticker, period) {
    const dateBoundary = new Date(now()).toISOString().slice(0, 10);
    const key = `${ticker}|${period}|Yahoo Finance chart|${dateBoundary}`;
    const cache = readCache(); const cached = cache.entries.find((entry) => entry.key === key);
    const age = cached ? now() - Date.parse(cached.cachedAt || 0) : Infinity;
    if (cached?.data && age <= PERIODS[period].ttlMs) return { ...cached.data, cache: { hit: true, stale: false } };
    if (cached?.failure && age <= (FAILURE_TTLS[cached.failure.classification] || FAILURE_TTLS.unavailable)) return { ticker, error: cached.failure.classification, partialData: true, cache: { hit: true, stale: false } };
    if (inFlight.has(key)) return inFlight.get(key);
    const request = (async () => {
      try {
        const data = await provider(ticker, period);
        await persistEntry({ key, ticker, period, source: data.source, cachedAt: new Date(now()).toISOString(), data });
        return { ...data, cache: { hit: false, stale: false } };
      } catch (error) {
        const classification = error.code || "unavailable";
        try { await persistEntry({ key, ticker, period, source: "Yahoo Finance chart", cachedAt: new Date(now()).toISOString(), failure: { classification } }); } catch {}
        if (cached?.data) return { ...cached.data, stale: true, partialData: true, error: classification, cache: { hit: true, stale: true } };
        return { ticker, error: classification, partialData: true, cache: { hit: false, stale: false } };
      } finally { inFlight.delete(key); }
    })();
    inFlight.set(key, request); return request;
  }
  async function getHistory({ tickers, period, benchmark, horizon = "1-Day" }) {
    const requested = benchmark && !tickers.includes(benchmark) ? [...tickers, benchmark] : tickers;
    const results = [];
    for (let index = 0; index < requested.length; index += 3) results.push(...await Promise.all(requested.slice(index, index + 3).map((ticker) => getOne(ticker, period))));
    const history = predictionHistoryLoader(); const evidence = evidenceLoader();
    return { requestedPeriod: period, requestedHorizon: horizon, requestedTickers: tickers, benchmark, generatedAt: new Date(now()).toISOString(), results: results.map((item) => ({ ...item, predictionHistory: item.ticker ? history.filter((row) => row.ticker === item.ticker && String(row.timeframe || row.horizon || "") === horizon).slice(-100) : [], events: item.ticker ? evidence.filter((event) => event.ticker === item.ticker && event.timestamp).slice(-100) : [] })), disclosure: "Historical market performance, not a forecast." };
  }
  return { getHistory, getOne, readCache };
}

module.exports = { PERIODS, MAX_TICKERS, MAX_CACHE_ENTRIES, MAX_CACHE_BYTES, FAILURE_TTLS, normalizeTicker, validateRequest, targetStartDate, normalizeSeries, metricsForSeries, createHistoricalMarketService };
