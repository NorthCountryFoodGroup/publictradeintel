"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SUCCESS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PARTIAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const UNRESOLVED_TTL_MS = 6 * 60 * 60 * 1000;
const RATE_LIMIT_TTL_MS = 60 * 60 * 1000;
const TIMEOUT_TTL_MS = 30 * 60 * 1000;
const UNAVAILABLE_TTL_MS = 2 * 60 * 60 * 1000;
const CONFIGURATION_TTL_MS = 24 * 60 * 60 * 1000;
const UNSUPPORTED_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_CONCURRENCY = 2;
const MAX_CACHE_ENTRIES = 5000;
const UNSUPPORTED_PROFILE_TYPES = new Set(["warrant", "unit", "index", "cryptocurrency"]);
const RATE_LIMIT_CLASSIFICATIONS = new Set([
  "application_daily_cap",
  "provider_http_429",
  "provider_note_rate_limit",
  "provider_information_rate_limit",
  "provider_error_rate_limit",
]);
const TRANSIENT_CLASSIFICATIONS = new Set([
  ...RATE_LIMIT_CLASSIFICATIONS,
  "provider_timeout",
  "provider_unavailable",
  "empty_valid_response",
]);
const VERIFIED_DETAIL_FIELDS = [
  "companyDescription",
  "industry",
  "sector",
  "headquarters",
  "domicile",
  "website",
];

function boundedText(value, maximum = 4000) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maximum) : null;
}

function canonicalTicker(value) {
  const ticker = String(value || "").trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker) ? ticker : "";
}

function usefulName(value, ticker) {
  const name = boundedText(value, 240);
  return name && canonicalTicker(name) !== ticker ? name : null;
}

function normalizedSecurityType(value) {
  const type = String(value || "").toLowerCase();
  if (/exchange[- ]traded|\betf\b/.test(type)) return "etf";
  if (/closed[- ]end/.test(type)) return "closed_end_fund";
  if (/mutual/.test(type)) return "mutual_fund";
  if (/\badr\b|depositary/.test(type)) return "adr";
  if (/preferred/.test(type)) return "preferred_share";
  if (/warrant/.test(type)) return "warrant";
  if (/\bunit\b/.test(type)) return "unit";
  if (/index/.test(type)) return "index";
  if (/crypto|digital asset/.test(type)) return "cryptocurrency";
  if (/equity|common|stock|operating|corporation/.test(type)) return "operating_company";
  return type ? "other" : null;
}

function publicSecurityType(type) {
  return {
    operating_company: "Operating Company",
    etf: "ETF",
    mutual_fund: "Mutual Fund",
    closed_end_fund: "Closed-End Fund",
    adr: "ADR",
    preferred_share: "Preferred Share",
    warrant: "Warrant",
    unit: "Unit",
    index: "Index",
    cryptocurrency: "Cryptocurrency",
    other: "Other Security",
  }[type] || null;
}

function readCache(cacheFile) {
  try {
    const parsed = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    return parsed && parsed.version === 1 && parsed.profiles && typeof parsed.profiles === "object"
      ? parsed
      : { version: 1, profiles: {} };
  } catch {
    return { version: 1, profiles: {} };
  }
}

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.renameSync(temporary, file);
  } finally {
    try {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    } catch {}
  }
}

function pruneCache(cache) {
  const entries = Object.entries(cache.profiles || {});
  if (entries.length <= MAX_CACHE_ENTRIES) return cache;
  const retained = entries
    .sort((left, right) => Date.parse(right[1]?.profileFetchedAt || 0) - Date.parse(left[1]?.profileFetchedAt || 0) || left[0].localeCompare(right[0]))
    .slice(0, MAX_CACHE_ENTRIES);
  return { version: 1, profiles: Object.fromEntries(retained) };
}

function classifiedError(classification, message = classification) {
  const error = new Error(message);
  error.profileClassification = classification;
  return error;
}

function errorClassification(error) {
  if (error?.profileClassification) return error.profileClassification;
  const message = String(error?.message || error || "").toLowerCase();
  if (/abort|timeout|timed out/.test(message)) return "provider_timeout";
  if (/429/.test(message)) return "provider_http_429";
  if (/invalid api|invalid key|api key.*invalid|unauthorized|restricted key/.test(message)) return "provider_invalid_or_restricted_key";
  if (/premium endpoint|not entitled|subscription|upgrade.*plan/.test(message)) return "endpoint_not_entitled";
  if (/not found|no profile|unresolved|404/.test(message)) return "unresolved_symbol";
  if (/rate|limit|frequency/.test(message)) return "provider_information_rate_limit";
  return "provider_unavailable";
}

function publicError(classification) {
  if (RATE_LIMIT_CLASSIFICATIONS.has(classification)) return "rate_limited";
  if (classification === "provider_timeout") return "timeout";
  if (classification === "unresolved_symbol") return "not_found";
  if (classification === "unsupported_type") return null;
  if (classification === "ordinary_partial_profile") return null;
  return classification ? "provider_unavailable" : null;
}

function alphaResponseClassification(data) {
  const entries = [
    ["Note", data?.Note, "provider_note_rate_limit"],
    ["Information", data?.Information, "provider_information_rate_limit"],
    ["Error Message", data?.["Error Message"], "provider_error_rate_limit"],
  ];
  for (const [field, value, rateClassification] of entries) {
    if (!value) continue;
    const message = String(value).toLowerCase();
    if (/invalid api|invalid key|api key.*invalid|unauthorized|restricted key/.test(message)) return "provider_invalid_or_restricted_key";
    if (/premium endpoint|not entitled|subscription required|upgrade.*plan/.test(message)) return "endpoint_not_entitled";
    if (/rate|limit|frequency|call volume|requests per day/.test(message)) return rateClassification;
    return "provider_unavailable";
  }
  return null;
}

async function jsonRequest(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "User-Agent": "PublicTradeIntelSecurityProfile/1.0", Accept: "application/json,*/*" },
    });
    if (response.status === 429) throw classifiedError("provider_http_429");
    if (!response.ok) throw classifiedError("provider_unavailable");
    return await response.json();
  } catch (error) {
    if (error?.name === "AbortError") throw classifiedError("provider_timeout");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function yahooProfile(data, ticker) {
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta || canonicalTicker(meta.symbol) !== ticker) return null;
  const securityType = normalizedSecurityType(meta.instrumentType);
  return {
    securityName: usefulName(meta.longName || meta.shortName, ticker),
    securityType,
    exchange: boundedText(meta.fullExchangeName || meta.exchangeName, 120),
    providerValidated: Boolean(Number(meta.regularMarketPrice) || meta.exchangeName || meta.instrumentType),
  };
}

function alphaCompanyProfile(data, ticker) {
  if (!data || canonicalTicker(data.Symbol) !== ticker) return null;
  const headquarters = [boundedText(data.Address, 240), boundedText(data.City, 100), boundedText(data.State, 100), boundedText(data.Country, 100)]
    .filter(Boolean)
    .join(", ");
  return {
    securityName: usefulName(data.Name, ticker),
    securityType: normalizedSecurityType(data.AssetType) || "operating_company",
    companyDescription: boundedText(data.Description),
    industry: boundedText(data.Industry, 180),
    sector: boundedText(data.Sector, 160),
    exchange: boundedText(data.Exchange, 120),
    headquarters: boundedText(headquarters, 400),
    domicile: boundedText(data.Country, 120),
    website: /^https?:\/\//i.test(String(data.OfficialSite || "")) ? boundedText(data.OfficialSite, 500) : null,
  };
}

function alphaFundProfile(data, ticker) {
  if (!data || (data.symbol && canonicalTicker(data.symbol) !== ticker)) return null;
  const holdings = Array.isArray(data.holdings)
    ? data.holdings.slice(0, 5).map((holding) => boundedText(holding.description || holding.name || holding.symbol, 100)).filter(Boolean)
    : [];
  const allocations = data.sectors && typeof data.sectors === "object"
    ? Object.entries(data.sectors).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 3).map(([name]) => boundedText(name, 80)).filter(Boolean)
    : [];
  const facts = [
    /^(true|yes|1)$/i.test(String(data.leveraged || "")) ? "The provider identifies it as a leveraged fund." : "",
    holdings.length ? `Its largest reported holdings include ${holdings.join(", ")}.` : "",
    allocations.length ? `Its largest reported sector exposures include ${allocations.join(", ")}.` : "",
  ].filter(Boolean);
  if (!facts.length && !data.net_assets && !data.asset_class) return null;
  return {
    securityType: "etf",
    companyDescription: facts.length ? `This exchange-traded fund reports portfolio exposure through its configured provider. ${facts.join(" ")}` : null,
    sector: boundedText(allocations[0], 160),
  };
}

function mergeProfile(base, addition) {
  const result = { ...base };
  for (const [key, value] of Object.entries(addition || {})) {
    if (value !== null && value !== undefined && value !== "" && !result[key]) result[key] = value;
  }
  return result;
}

function profileStatus(profile, providerValidated) {
  if (UNSUPPORTED_PROFILE_TYPES.has(profile.securityType)) return "unsupported_type";
  if (profile.securityName && profile.companyDescription && providerValidated) return "verified";
  if (providerValidated && (profile.securityName || profile.securityType || profile.exchange)) return "partially_verified";
  return "unresolved";
}

function nextUtcResetCeiling(nowDate) {
  const ceiling = new Date(nowDate);
  ceiling.setUTCDate(ceiling.getUTCDate() + 1);
  ceiling.setUTCHours(0, 15, 0, 0);
  return ceiling.getTime();
}

function retryMetadata(classification, fetchedAt, previousProfile = null) {
  const fetchedMs = Date.parse(fetchedAt);
  const previousClassification = previousProfile?.profileRefreshClassification || previousProfile?.profileResultClassification;
  const previousCount = Number(previousProfile?.profileTransientFailureCount) || 0;
  const repeated = RATE_LIMIT_CLASSIFICATIONS.has(classification) && RATE_LIMIT_CLASSIFICATIONS.has(previousClassification);
  const failureCount = RATE_LIMIT_CLASSIFICATIONS.has(classification) ? (repeated ? previousCount + 1 : 1) : 0;
  let ttl = classification === "provider_timeout" ? TIMEOUT_TTL_MS
    : ["provider_unavailable", "empty_valid_response"].includes(classification) ? UNAVAILABLE_TTL_MS
    : ["provider_invalid_or_restricted_key", "endpoint_not_entitled"].includes(classification) ? CONFIGURATION_TTL_MS
    : RATE_LIMIT_CLASSIFICATIONS.has(classification) ? RATE_LIMIT_TTL_MS * (2 ** Math.max(0, failureCount - 1))
    : null;
  if (RATE_LIMIT_CLASSIFICATIONS.has(classification)) {
    ttl = Math.min(ttl, Math.max(0, nextUtcResetCeiling(new Date(fetchedAt)) - fetchedMs));
  }
  return ttl === null ? {} : {
    profileTransientFailureCount: failureCount,
    profileNextRetryAt: new Date(fetchedMs + ttl).toISOString(),
  };
}

function resultClassification(profileStatusValue, providerFailure = null) {
  if (profileStatusValue === "unsupported_type") return "unsupported_type";
  if (providerFailure) return providerFailure;
  if (profileStatusValue === "unresolved") return "unresolved_symbol";
  if (profileStatusValue === "partially_verified") return "ordinary_partial_profile";
  return null;
}

function cacheTtl(profile) {
  const classification = profile.profileRefreshClassification || profile.profileResultClassification;
  if (profile.profileNextRetryAt && TRANSIENT_CLASSIFICATIONS.has(classification)) {
    return Math.max(0, Date.parse(profile.profileNextRetryAt) - Date.parse(profile.profileFetchedAt || profile.profileRefreshAttemptedAt));
  }
  if (RATE_LIMIT_CLASSIFICATIONS.has(classification)) return RATE_LIMIT_TTL_MS;
  if (classification === "provider_timeout") return TIMEOUT_TTL_MS;
  if (["provider_unavailable", "empty_valid_response"].includes(classification)) return UNAVAILABLE_TTL_MS;
  if (["provider_invalid_or_restricted_key", "endpoint_not_entitled"].includes(classification)) return CONFIGURATION_TTL_MS;
  if (classification === "unsupported_type" || profile.profileStatus === "unsupported_type") return UNSUPPORTED_TTL_MS;
  if (classification === "unresolved_symbol" || profile.profileStatus === "unresolved") return UNRESOLVED_TTL_MS;
  if (profile.profileStatus === "verified") return SUCCESS_TTL_MS;
  return PARTIAL_TTL_MS;
}

function preserveVerifiedDetails(saved, refreshed, failureClassification, attemptedAt) {
  const retained = { ...refreshed };
  for (const field of VERIFIED_DETAIL_FIELDS) {
    if (saved?.[field]) retained[field] = saved[field];
  }
  retained.profileStatus = "stale";
  retained.profileSource = saved.profileSource || refreshed.profileSource;
  retained.profileFetchedAt = saved.profileFetchedAt;
  retained.profileSourceFetchedAt = saved.profileSourceFetchedAt || saved.profileFetchedAt;
  retained.profileRefreshAttemptedAt = attemptedAt;
  retained.profileRefreshClassification = failureClassification;
  retained.profileRefreshError = publicError(failureClassification);
  retained.profileError = publicError(failureClassification);
  Object.assign(retained, retryMetadata(failureClassification, attemptedAt, saved));
  return retained;
}

function createSecurityProfileService(options = {}) {
  const cacheFile = options.cacheFile;
  const fetchImpl = options.fetchImpl || global.fetch;
  const apiKey = String(options.apiKey || "").trim();
  const universeLoader = options.universeLoader || (() => ({ symbols: [] }));
  const now = options.now || (() => new Date());
  const timeoutMs = Math.max(250, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);
  const concurrency = Math.max(1, Number(options.concurrency) || DEFAULT_CONCURRENCY);
  const maximumAuthenticatedRequestsPerDay = Math.max(1, Number(options.maximumAuthenticatedRequestsPerDay) || 20);
  const inFlight = new Map();
  let active = 0;
  const waiters = [];
  let writeQueue = Promise.resolve();
  let alphaDay = "";
  let alphaRequestsToday = 0;

  async function acquire() {
    if (active < concurrency) {
      active += 1;
      return;
    }
    await new Promise((resolve) => waiters.push(resolve));
    active += 1;
  }

  function release() {
    active = Math.max(0, active - 1);
    waiters.shift()?.();
  }

  function persist(profile) {
    if (!cacheFile) return Promise.resolve(false);
    writeQueue = writeQueue.catch(() => {}).then(() => {
      const cache = readCache(cacheFile);
      cache.profiles[profile.ticker] = profile;
      atomicWriteJson(cacheFile, pruneCache(cache));
      return true;
    });
    return writeQueue;
  }

  function cached(ticker) {
    const profile = cacheFile ? readCache(cacheFile).profiles[ticker] : null;
    if (!profile?.profileFetchedAt) return null;
    const age = now().getTime() - Date.parse(profile.profileFetchedAt);
    const retryAt = Date.parse(profile.profileNextRetryAt || "");
    const fresh = Number.isFinite(retryAt)
      ? now().getTime() < retryAt
      : Number.isFinite(age) && age >= 0 && age <= cacheTtl(profile);
    return { profile, fresh };
  }

  async function retrieve(ticker, previousProfile = null) {
    await acquire();
    const fetchedAt = now().toISOString();
      const errors = [];
    try {
      const universe = universeLoader() || {};
      const row = (universe.symbols || []).find((item) => canonicalTicker(item.ticker || item.symbol) === ticker) || {};
      let profile = {
        ticker,
        securityName: usefulName(row.name || row.companyName, ticker),
        securityType: normalizedSecurityType(row.securityType || row.type),
        companyDescription: boundedText(row.companyDescription || row.description),
        industry: boundedText(row.industry, 180),
        sector: boundedText(row.sector, 160),
        exchange: boundedText(row.exchange || row.listingExchange, 120),
        headquarters: boundedText(row.headquarters, 400),
        domicile: boundedText(row.domicile, 120),
        website: /^https?:\/\//i.test(String(row.website || "")) ? boundedText(row.website, 500) : null,
      };
      let providerValidated = false;
      const sources = [];

      try {
        const yahooSymbol = ticker.replace(/\./g, "-");
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=1d`;
        const yahoo = yahooProfile(await jsonRequest(fetchImpl, yahooUrl, timeoutMs), ticker);
        if (yahoo) {
          profile = mergeProfile(profile, yahoo);
          providerValidated = yahoo.providerValidated;
          sources.push("Yahoo chart metadata");
        }
      } catch (error) {
        errors.push(errorClassification(error));
      }

      if (apiKey) {
        const functionName = profile.securityType === "etf" ? "ETF_PROFILE" : "OVERVIEW";
        try {
          const currentDay = fetchedAt.slice(0, 10);
          if (alphaDay !== currentDay) {
            alphaDay = currentDay;
            alphaRequestsToday = 0;
          }
          if (alphaRequestsToday >= maximumAuthenticatedRequestsPerDay) throw classifiedError("application_daily_cap");
          alphaRequestsToday += 1;
          const alphaUrl = new URL("https://www.alphavantage.co/query");
          alphaUrl.searchParams.set("function", functionName);
          alphaUrl.searchParams.set("symbol", ticker);
          alphaUrl.searchParams.set("apikey", apiKey);
          const data = await jsonRequest(fetchImpl, alphaUrl, timeoutMs);
          const providerFailure = alphaResponseClassification(data);
          if (providerFailure) throw classifiedError(providerFailure);
          const alpha = functionName === "ETF_PROFILE" ? alphaFundProfile(data, ticker) : alphaCompanyProfile(data, ticker);
          if (alpha) {
            profile = mergeProfile(profile, alpha);
            providerValidated = true;
            sources.push(functionName === "ETF_PROFILE" ? "Alpha Vantage ETF Profile" : "Alpha Vantage Company Overview");
            if (functionName === "ETF_PROFILE") {
              const objective = String(profile.securityName || "").match(/Daily Target\s+(\d+(?:\.\d+)?)X\s+(Long|Short)\s+([A-Z][A-Z0-9.-]*)\s+ETF/i);
              if (objective) {
                const multiple = Number(objective[1]);
                const underlying = objective[3].toUpperCase();
                const direction = objective[2].toLowerCase() === "short" ? `the inverse of ${underlying}` : underlying;
                const objectiveText = `This leveraged exchange-traded fund seeks approximately ${multiple} times the daily performance of ${direction}.`;
                profile.companyDescription = `${objectiveText}${profile.companyDescription ? ` ${profile.companyDescription}` : ""}`;
              }
            }
          } else {
            throw classifiedError("empty_valid_response");
          }
        } catch (error) {
          errors.push(errorClassification(error));
        }
      }

      delete profile.providerValidated;
      const status = profileStatus(profile, providerValidated);
      const providerFailure = errors[0] || null;
      const classification = resultClassification(status, providerFailure);
      const result = {
        ...profile,
        securityType: publicSecurityType(profile.securityType),
        profileSource: sources.join(" + ") || (row.source ? boundedText(row.source, 160) : null),
        profileFetchedAt: fetchedAt,
        profileStatus: status,
        profileError: publicError(classification),
        profileResultClassification: classification,
        ...retryMetadata(classification, fetchedAt, previousProfile),
      };
      try {
        await persist(result);
      } catch {
        result.profileError ||= "cache_write_failed";
      }
      return result;
    } finally {
      release();
    }
  }

  async function getProfile(value) {
    const ticker = canonicalTicker(value);
    if (!ticker) return {
      ticker: null,
      profileStatus: "unresolved",
      profileError: "invalid_symbol",
      profileFetchedAt: now().toISOString(),
    };
    const saved = cached(ticker);
    if (saved?.fresh) return { ...saved.profile, profileCacheUsed: true };
    if (inFlight.has(ticker)) return inFlight.get(ticker);
    const request = retrieve(ticker, saved?.profile)
      .then(async (profile) => {
        const refreshClassification = profile.profileResultClassification;
        const savedHasVerifiedDetails = saved?.profile && VERIFIED_DETAIL_FIELDS.some((field) => saved.profile[field]);
        if (savedHasVerifiedDetails && TRANSIENT_CLASSIFICATIONS.has(refreshClassification)) {
          const stale = preserveVerifiedDetails(saved.profile, profile, refreshClassification, profile.profileFetchedAt);
          try { await persist(stale); } catch {}
          return stale;
        }
        if (profile.profileStatus === "unresolved" && saved?.profile && ["verified", "partially_verified", "stale"].includes(saved.profile.profileStatus)) {
          const stale = {
            ...saved.profile,
            profileStatus: "stale",
            profileError: profile.profileError || "provider_unavailable",
            profileRefreshClassification: refreshClassification,
            profileRefreshError: profile.profileError || "provider_unavailable",
            profileRefreshAttemptedAt: profile.profileFetchedAt,
            profileSourceFetchedAt: saved.profile.profileSourceFetchedAt || saved.profile.profileFetchedAt,
            profileCacheUsed: true,
          };
          try { await persist(stale); } catch {}
          return stale;
        }
        return profile;
      })
      .catch((error) => {
        const classification = errorClassification(error);
        const attemptedAt = now().toISOString();
        return saved?.profile
          ? { ...preserveVerifiedDetails(saved.profile, saved.profile, classification, attemptedAt), profileCacheUsed: true }
          : { ticker, profileStatus: "unresolved", profileError: publicError(classification), profileResultClassification: classification, profileFetchedAt: attemptedAt, ...retryMetadata(classification, attemptedAt) };
      })
      .finally(() => inFlight.delete(ticker));
    inFlight.set(ticker, request);
    return request;
  }

  return { getProfile };
}

module.exports = {
  createSecurityProfileService,
  normalizedSecurityType,
  yahooProfile,
  alphaCompanyProfile,
  alphaFundProfile,
};
