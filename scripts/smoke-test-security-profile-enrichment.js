"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { createSecurityProfileService } = require("../security-profile");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (["'", '"', "`"].includes(character)) quote = character;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

function yahoo(symbol, overrides = {}) {
  return {
    chart: {
      result: [{ meta: { symbol, regularMarketPrice: 25, longName: `${symbol} Holdings`, instrumentType: "EQUITY", fullExchangeName: "NYSE", ...overrides } }],
    },
  };
}

function fixtureFetch(routes, calls) {
  return async (url) => {
    const value = String(url);
    calls.push(value.replace(/apikey=[^&]+/, "apikey=REDACTED"));
    const route = Object.entries(routes).find(([key]) => value.includes(key));
    if (!route) throw new Error("not found");
    const result = typeof route[1] === "function" ? await route[1](value) : route[1];
    if (result instanceof Error) throw result;
    return response(result.data ?? result, result.status ?? 200);
  };
}

function service(temp, name, routes, universe = [], options = {}) {
  const calls = [];
  return {
    calls,
    instance: createSecurityProfileService({
      cacheFile: path.join(temp, `${name}.json`),
      fetchImpl: fixtureFetch(routes, calls),
      apiKey: options.apiKey === false ? "" : "test-key",
      universeLoader: () => ({ symbols: universe }),
      now: options.now || (() => new Date("2026-07-21T20:00:00.000Z")),
      timeoutMs: 300,
      concurrency: 2,
      maximumAuthenticatedRequestsPerDay: options.maximumAuthenticatedRequestsPerDay,
    }),
  };
}

function clock(value) {
  let current = new Date(value);
  return {
    now: () => new Date(current),
    advance: (milliseconds) => { current = new Date(current.getTime() + milliseconds); },
    iso: () => current.toISOString(),
  };
}

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pti-security-profile-"));
  try {
    const full = service(temp, "full", {
      "/chart/ACME": yahoo("ACME", { longName: "Acme Manufacturing Corporation" }),
      "function=OVERVIEW": {
        Symbol: "ACME",
        Name: "Acme Manufacturing Corporation",
        AssetType: "Common Stock",
        Description: "Acme manufactures verified industrial components for commercial customers.",
        Industry: "Industrial Machinery",
        Sector: "Industrials",
        Exchange: "NYSE",
        Address: "100 Main Street",
        City: "Chicago",
        Country: "United States",
        OfficialSite: "https://example.com",
      },
    });
    const company = await full.instance.getProfile("ACME");
    assert.equal(company.profileStatus, "verified");
    assert.equal(company.securityName, "Acme Manufacturing Corporation");
    assert.match(company.companyDescription, /manufactures verified industrial components/);
    assert.equal(company.industry, "Industrial Machinery");
    assert.equal(company.sector, "Industrials");
    assert.equal(company.exchange, "NYSE");
    assert.match(company.headquarters, /Chicago/);

    const partial = service(temp, "partial", { "/chart/PART": yahoo("PART", { longName: "Partial Industries" }) }, [], { apiKey: false });
    const partialProfile = await partial.instance.getProfile("PART");
    assert.equal(partialProfile.profileStatus, "partially_verified");
    assert.equal(partialProfile.profileResultClassification, "ordinary_partial_profile");
    assert.equal(partialProfile.securityName, "Partial Industries");
    assert.equal(partialProfile.companyDescription, null);

    const etf = service(temp, "etf", {
      "/chart/AVXX": yahoo("AVXX", { longName: "Defiance Daily Target 2X Long AVAV ETF", instrumentType: "ETF", fullExchangeName: "NasdaqGM" }),
      "function=ETF_PROFILE": {
        symbol: "AVXX",
        net_assets: "10000000",
        leveraged: "true",
        holdings: [{ symbol: "AVAV", description: "AeroVironment exposure" }],
        sectors: { Industrials: "0.90", Cash: "0.10" },
      },
    });
    const etfProfile = await etf.instance.getProfile("AVXX");
    assert.equal(etfProfile.profileStatus, "verified");
    assert.equal(etfProfile.securityType, "ETF");
    assert.match(etfProfile.companyDescription, /leveraged fund/);
    assert.match(etfProfile.companyDescription, /approximately 2 times the daily performance of AVAV/);
    assert.match(etfProfile.companyDescription, /AeroVironment exposure/);

    const fund = service(temp, "fund", {
      "/chart/FUNDX": yahoo("FUNDX", { longName: "Verified Balanced Fund", instrumentType: "MUTUALFUND" }),
      "function=OVERVIEW": { Symbol: "FUNDX", Name: "Verified Balanced Fund", AssetType: "Mutual Fund", Description: "The fund maintains a verified diversified allocation." },
    }, [{ ticker: "FUNDX", securityType: "Mutual Fund", exchange: "NASDAQ" }]);
    assert.equal((await fund.instance.getProfile("FUNDX")).securityType, "Mutual Fund");

    const adr = service(temp, "adr", {
      "/chart/ADRX": yahoo("ADRX", { longName: "Verified Global Depositary Shares" }),
      "function=OVERVIEW": { Symbol: "ADRX", Name: "Verified Global Depositary Shares", AssetType: "ADR", Description: "Depositary shares representing a verified foreign issuer." },
    }, [{ ticker: "ADRX", securityType: "ADR", exchange: "NYSE" }]);
    assert.equal((await adr.instance.getProfile("ADRX")).securityType, "ADR");

    const unresolvedClock = clock("2026-07-21T20:00:00.000Z");
    const unresolved = service(temp, "unresolved", {
      "/chart/MISS": { chart: { result: null } },
    }, [], { apiKey: false, now: unresolvedClock.now });
    const missing = await unresolved.instance.getProfile("MISS");
    assert.equal(missing.profileStatus, "unresolved");
    assert.equal(missing.profileResultClassification, "unresolved_symbol");
    assert.equal(missing.companyDescription, null);

    const timeout = service(temp, "timeout", {
      "/chart/SLOW": new Error("request timeout"),
      "function=OVERVIEW": new Error("request timeout"),
    });
    assert.equal((await timeout.instance.getProfile("SLOW")).profileError, "timeout");

    const limited = service(temp, "limited", {
      "/chart/LIMIT": yahoo("LIMIT", { longName: "Rate Limited Company" }),
      "function=OVERVIEW": { Information: "API rate limit reached" },
    });
    const limitedProfile = await limited.instance.getProfile("LIMIT");
    assert.equal(limitedProfile.profileStatus, "partially_verified");
    assert.equal(limitedProfile.profileError, "rate_limited");
    assert.equal(limitedProfile.profileResultClassification, "provider_information_rate_limit");
    assert.equal(Date.parse(limitedProfile.profileNextRetryAt) - Date.parse(limitedProfile.profileFetchedAt), 60 * 60 * 1000);

    const classificationFixtures = [
      ["http429", { data: {}, status: 429 }, "provider_http_429"],
      ["note", { Note: "API call frequency limit reached" }, "provider_note_rate_limit"],
      ["information", { Information: "Standard API requests per day limit reached" }, "provider_information_rate_limit"],
      ["error", { "Error Message": "Rate limit exceeded" }, "provider_error_rate_limit"],
      ["invalid", { Information: "Invalid API key" }, "provider_invalid_or_restricted_key"],
      ["entitled", { Information: "Premium endpoint subscription required" }, "endpoint_not_entitled"],
      ["empty", {}, "empty_valid_response"],
    ];
    for (const [name, alphaResult, expected] of classificationFixtures) {
      const classified = service(temp, `classified-${name}`, {
        [`/chart/${name.toUpperCase()}`]: yahoo(name.toUpperCase()),
        "function=OVERVIEW": alphaResult,
      });
      const result = await classified.instance.getProfile(name.toUpperCase());
      assert.equal(result.profileResultClassification, expected, `${name} classification should remain distinct`);
      assert.ok(!JSON.stringify(result).includes("test-key"), `${name} response must not expose credentials`);
    }

    const ttlClock = clock("2026-07-21T20:00:00.000Z");
    let rateResponses = 0;
    const retryingRateLimit = service(temp, "retry-rate", {
      "/chart/RETRY": yahoo("RETRY", { longName: "Retry Identity" }),
      "function=OVERVIEW": () => { rateResponses += 1; return { Information: "API rate limit reached" }; },
    }, [], { now: ttlClock.now });
    const firstLimited = await retryingRateLimit.instance.getProfile("RETRY");
    assert.equal(firstLimited.securityName, "Retry Identity", "Yahoo identity should survive Alpha throttling");
    ttlClock.advance(59 * 60 * 1000);
    await retryingRateLimit.instance.getProfile("RETRY");
    assert.equal(rateResponses, 1, "rate-limited profile should remain cached for its initial one-hour TTL");
    ttlClock.advance(61 * 60 * 1000);
    const secondLimited = await retryingRateLimit.instance.getProfile("RETRY");
    assert.equal(rateResponses, 2, "rate-limited profile should retry after the short TTL");
    assert.equal(secondLimited.profileTransientFailureCount, 2);
    assert.equal(Date.parse(secondLimited.profileNextRetryAt) - Date.parse(secondLimited.profileFetchedAt), 2 * 60 * 60 * 1000, "repeated rate limits should back off exponentially");

    const resetClock = clock("2026-07-21T23:30:00.000Z");
    const resetLimited = service(temp, "reset-cap", {
      "/chart/RESET": yahoo("RESET"),
      "function=OVERVIEW": { Note: "API call frequency limit reached" },
    }, [], { now: resetClock.now });
    const resetResult = await resetLimited.instance.getProfile("RESET");
    assert.equal(resetResult.profileNextRetryAt, "2026-07-22T00:15:00.000Z", "rate-limit backoff should never extend beyond the next likely UTC allowance reset plus 15 minutes");

    const ordinaryClock = clock("2026-07-21T20:00:00.000Z");
    const ordinary = service(temp, "ordinary-ttl", { "/chart/PLAIN": yahoo("PLAIN") }, [], { apiKey: false, now: ordinaryClock.now });
    await ordinary.instance.getProfile("PLAIN");
    const ordinaryCalls = ordinary.calls.length;
    ordinaryClock.advance(7 * 24 * 60 * 60 * 1000 - 1);
    await ordinary.instance.getProfile("PLAIN");
    assert.equal(ordinary.calls.length, ordinaryCalls, "ordinary partial profile should retain seven-day TTL");
    ordinaryClock.advance(2);
    await ordinary.instance.getProfile("PLAIN");
    assert.ok(ordinary.calls.length > ordinaryCalls, "ordinary partial profile should refresh after seven days");

    const transientCases = [
      ["timeout-ttl", new Error("request timeout"), "provider_timeout", 30 * 60 * 1000],
      ["unavailable-ttl", { data: {}, status: 503 }, "provider_unavailable", 2 * 60 * 60 * 1000],
    ];
    for (const [name, alphaResult, expected, ttl] of transientCases) {
      const transientClock = clock("2026-07-21T20:00:00.000Z");
      let attempts = 0;
      const transient = service(temp, name, {
        [`/chart/${name.toUpperCase()}`]: yahoo(name.toUpperCase()),
        "function=OVERVIEW": () => { attempts += 1; if (alphaResult instanceof Error) throw alphaResult; return alphaResult; },
      }, [], { now: transientClock.now });
      const first = await transient.instance.getProfile(name.toUpperCase());
      assert.equal(first.profileResultClassification, expected);
      transientClock.advance(ttl - 1);
      await transient.instance.getProfile(name.toUpperCase());
      assert.equal(attempts, 1, `${expected} should remain cached for its distinct TTL`);
      transientClock.advance(2);
      await transient.instance.getProfile(name.toUpperCase());
      assert.equal(attempts, 2, `${expected} should retry after its distinct TTL`);
    }

    const unresolvedCalls = unresolved.calls.length;
    unresolvedClock.advance(6 * 60 * 60 * 1000 - 1);
    await unresolved.instance.getProfile("MISS");
    assert.equal(unresolved.calls.length, unresolvedCalls, "unresolved symbol should retain six-hour TTL");
    unresolvedClock.advance(2);
    await unresolved.instance.getProfile("MISS");
    assert.ok(unresolved.calls.length > unresolvedCalls, "unresolved symbol should retry after six hours");

    const cached = service(temp, "cached", {
      "/chart/CACHE": yahoo("CACHE", { longName: "Cached Company" }),
      "function=OVERVIEW": { Symbol: "CACHE", Name: "Cached Company", AssetType: "Common Stock", Description: "A verified cached description." },
    });
    await cached.instance.getProfile("CACHE");
    const callCount = cached.calls.length;
    const cachedProfile = await cached.instance.getProfile("CACHE");
    assert.equal(cached.calls.length, callCount, "fresh cache should prevent repeated provider requests");
    assert.equal(cachedProfile.profileCacheUsed, true);
    const restartedCache = service(temp, "cached", {
      "/chart/CACHE": new Error("provider should not be called after restart"),
      "function=OVERVIEW": new Error("provider should not be called after restart"),
    });
    assert.equal((await restartedCache.instance.getProfile("CACHE")).profileCacheUsed, true);
    assert.equal(restartedCache.calls.length, 0, "persistent cache should survive a service restart");

    const unsupportedClock = clock("2026-07-21T20:00:00.000Z");
    const unsupported = service(temp, "unsupported", {
      "/chart/WRTX": yahoo("WRTX", { longName: "Verified Issuer Warrant", instrumentType: "WARRANT" }),
      "function=OVERVIEW": {},
    }, [{ ticker: "WRTX", name: "Verified Issuer Warrant", securityType: "Warrant", exchange: "NASDAQ" }], { now: unsupportedClock.now });
    const unsupportedProfile = await unsupported.instance.getProfile("WRTX");
    assert.equal(unsupportedProfile.profileStatus, "unsupported_type");
    assert.equal(unsupportedProfile.profileResultClassification, "unsupported_type");
    const unsupportedCalls = unsupported.calls.length;
    unsupportedClock.advance(30 * 24 * 60 * 60 * 1000 - 1);
    await unsupported.instance.getProfile("WRTX");
    assert.equal(unsupported.calls.length, unsupportedCalls, "unsupported type should retain 30-day TTL");

    const preservationClock = clock("2026-01-01T12:00:00.000Z");
    const verifiedSeed = service(temp, "preserved", {
      "/chart/KEEP": yahoo("KEEP", { longName: "Keep Verified Corporation" }),
      "function=OVERVIEW": {
        Symbol: "KEEP", Name: "Keep Verified Corporation", AssetType: "Common Stock",
        Description: "Original verified business description.", Industry: "Verified Industry", Sector: "Verified Sector",
        Exchange: "NYSE", Address: "1 Verified Way", Country: "United States", OfficialSite: "https://verified.example",
      },
    }, [], { now: preservationClock.now });
    const originalVerified = await verifiedSeed.instance.getProfile("KEEP");
    const originalTimestamp = originalVerified.profileFetchedAt;
    const originalSource = originalVerified.profileSource;
    preservationClock.advance(31 * 24 * 60 * 60 * 1000);
    const rateRefresh = service(temp, "preserved", {
      "/chart/KEEP": yahoo("KEEP", { longName: "Keep Verified Corporation" }),
      "function=OVERVIEW": { Information: "API rate limit reached" },
    }, [], { now: preservationClock.now });
    const staleRate = await rateRefresh.instance.getProfile("KEEP");
    assert.equal(staleRate.profileStatus, "stale");
    assert.equal(staleRate.companyDescription, originalVerified.companyDescription);
    assert.equal(staleRate.industry, "Verified Industry");
    assert.equal(staleRate.sector, "Verified Sector");
    assert.equal(staleRate.profileSource, originalSource);
    assert.equal(staleRate.profileFetchedAt, originalTimestamp, "verified source timestamp should remain unchanged");
    assert.equal(staleRate.profileSourceFetchedAt, originalTimestamp);
    assert.equal(staleRate.profileRefreshClassification, "provider_information_rate_limit");
    assert.equal(staleRate.profileRefreshError, "rate_limited");
    assert.equal(staleRate.profileRefreshAttemptedAt, preservationClock.iso());
    assert.ok(Date.parse(staleRate.profileNextRetryAt) > Date.parse(staleRate.profileRefreshAttemptedAt));

    preservationClock.advance(2 * 60 * 60 * 1000);
    const unavailableRefresh = service(temp, "preserved", {
      "/chart/KEEP": yahoo("KEEP", { longName: "Keep Verified Corporation" }),
      "function=OVERVIEW": { data: {}, status: 503 },
    }, [], { now: preservationClock.now });
    const staleUnavailable = await unavailableRefresh.instance.getProfile("KEEP");
    assert.equal(staleUnavailable.companyDescription, originalVerified.companyDescription, "verified details should survive provider unavailability");
    assert.equal(staleUnavailable.profileRefreshClassification, "provider_unavailable");
    assert.equal(staleUnavailable.profileFetchedAt, originalTimestamp);

    preservationClock.advance(2 * 60 * 60 * 1000 + 1);
    const timeoutRefresh = service(temp, "preserved", {
      "/chart/KEEP": yahoo("KEEP", { longName: "Keep Verified Corporation" }),
      "function=OVERVIEW": new Error("request timeout"),
    }, [], { now: preservationClock.now });
    const staleTimeout = await timeoutRefresh.instance.getProfile("KEEP");
    assert.equal(staleTimeout.companyDescription, originalVerified.companyDescription, "verified details should survive a provider timeout");
    assert.equal(staleTimeout.profileRefreshClassification, "provider_timeout");
    assert.equal(staleTimeout.profileFetchedAt, originalTimestamp);

    const avxxClock = clock("2026-01-01T12:00:00.000Z");
    const avxxSeed = service(temp, "avxx-preserved", {
      "/chart/AVXX": yahoo("AVXX", { longName: "Defiance Daily Target 2X Long AVAV ETF", instrumentType: "ETF", fullExchangeName: "NasdaqGM" }),
      "function=ETF_PROFILE": { symbol: "AVXX", net_assets: "10000000", leveraged: "true", holdings: [{ symbol: "AVAV" }] },
    }, [], { now: avxxClock.now });
    const avxxVerified = await avxxSeed.instance.getProfile("AVXX");
    avxxClock.advance(31 * 24 * 60 * 60 * 1000);
    const avxxLimited = service(temp, "avxx-preserved", {
      "/chart/AVXX": yahoo("AVXX", { longName: "Defiance Daily Target 2X Long AVAV ETF", instrumentType: "ETF", fullExchangeName: "NasdaqGM" }),
      "function=ETF_PROFILE": { Note: "API call frequency limit reached" },
    }, [], { now: avxxClock.now });
    const avxxStale = await avxxLimited.instance.getProfile("AVXX");
    assert.equal(avxxStale.securityName, "Defiance Daily Target 2X Long AVAV ETF");
    assert.equal(avxxStale.securityType, "ETF");
    assert.equal(avxxStale.companyDescription, avxxVerified.companyDescription);
    assert.equal(avxxStale.profileStatus, "stale");

    const budget = service(temp, "budget", {
      "/chart/": (url) => yahoo(new URL(url).pathname.split("/").pop()),
      "function=OVERVIEW": (url) => {
        const symbol = new URL(url).searchParams.get("symbol");
        return { Symbol: symbol, Name: `${symbol} Company`, AssetType: "Common Stock", Description: "Verified budget profile." };
      },
    }, [], { maximumAuthenticatedRequestsPerDay: 1 });
    await budget.instance.getProfile("ONE");
    const budgetCallsAfterFirst = budget.calls.filter((url) => url.includes("function=OVERVIEW")).length;
    await budget.instance.getProfile("ONE");
    assert.equal(budget.calls.filter((url) => url.includes("function=OVERVIEW")).length, budgetCallsAfterFirst, "cache hits must not consume provider budget");
    const capped = await budget.instance.getProfile("TWO");
    assert.equal(capped.profileResultClassification, "application_daily_cap");
    assert.equal(budget.calls.filter((url) => url.includes("function=OVERVIEW")).length, 1, "application cap should block the next actual Alpha request");

    let duplicateLookups = 0;
    const duplicate = service(temp, "duplicate", {
      "/chart/DUPL": async () => { duplicateLookups += 1; await new Promise((resolve) => setTimeout(resolve, 20)); return yahoo("DUPL", { longName: "Duplicate Company" }); },
      "function=OVERVIEW": { Symbol: "DUPL", Name: "Duplicate Company", AssetType: "Common Stock", Description: "One verified lookup shared across horizons." },
    });
    const duplicateProfiles = await Promise.all([1, 2, 3, 4].map(() => duplicate.instance.getProfile("DUPL")));
    assert.equal(duplicateLookups, 1, "four horizon references should share one profile lookup");
    assert.ok(duplicateProfiles.every((profile) => profile.securityName === "Duplicate Company"));
    assert.equal(duplicate.calls.filter((url) => url.includes("function=OVERVIEW")).length, 1, "duplicate in-flight requests must consume one Alpha request");

    const legacyCacheFile = path.join(temp, "legacy-cache.json");
    fs.writeFileSync(legacyCacheFile, JSON.stringify({ version: 1, profiles: { LEGACY: {
      ticker: "LEGACY", securityName: "Legacy Cached Company", securityType: "Operating Company", exchange: "NYSE",
      profileStatus: "partially_verified", profileFetchedAt: "2026-07-20T20:00:00.000Z", profileSource: "Yahoo chart metadata",
    } } }));
    const legacyCacheCalls = [];
    const legacyCacheService = createSecurityProfileService({
      cacheFile: legacyCacheFile,
      fetchImpl: fixtureFetch({}, legacyCacheCalls),
      apiKey: "test-key",
      now: () => new Date("2026-07-21T20:00:00.000Z"),
    });
    const compatibleLegacy = await legacyCacheService.getProfile("LEGACY");
    assert.equal(compatibleLegacy.profileCacheUsed, true);
    assert.equal(compatibleLegacy.securityName, "Legacy Cached Company");
    assert.equal(legacyCacheCalls.length, 0, "legacy cache entries should load without new fields or provider calls");

    const oldPrediction = { ticker: "OLD", aiOpportunityScore: 77, rank: 4 };
    const oldBefore = JSON.stringify(oldPrediction);
    await unresolved.instance.getProfile("OLD");
    assert.equal(JSON.stringify(oldPrediction), oldBefore, "profile failure must not mutate prediction scores or ranks");

    const context = { settings: { stockIdeas: [] }, normalizeTicker: (value) => String(value || "").trim().toUpperCase() };
    vm.createContext(context);
    vm.runInContext(`${extractFunction(app, "securityProfileForTradeBrief")}; this.securityProfileForTradeBrief = securityProfileForTradeBrief;`, context);
    const legacy = context.securityProfileForTradeBrief({ ticker: "OLD" });
    assert.match(legacy.description, /could not be matched to a verified current security profile/);
    const enriched = context.securityProfileForTradeBrief({ ticker: "ACME", ...company });
    assert.equal(enriched.securityName, "Acme Manufacturing Corporation");
    assert.doesNotMatch(enriched.description, /not currently available/);
    const knownNoDescription = context.securityProfileForTradeBrief({ ticker: "ETFZ", securityType: "ETF", profileStatus: "partially_verified" });
    assert.match(knownNoDescription.description, /identified as a ETF/);
    assert.doesNotMatch(app, /fabricat(?:e|ed).*description/i);
    assert.match(app, /api\/security-profile/);
    assert.match(app, /Loading verified security details/);
    for (const label of ["Verified", "Partially verified", "Unresolved", "Stale profile", "Unsupported security type"]) assert.match(app, new RegExp(label));
    assert.doesNotMatch(app, /<h2>\$\{escapeHtml\(item\.ticker\)\} \| \$\{escapeHtml\(item\.name \|\| item\.company \|\| item\.ticker\)\}/, "Trade Brief headings should use enriched security names");
    assert.match(server, /SECURITY_PROFILE_CACHE_FILE = path\.join\(DATA_DIR, "securityProfiles\.json"\)/);
    assert.match(server, /pathname\.startsWith\("\/api\/security-profile\/"\)/);
    assert.doesNotMatch(extractFunction(server, "runPredictionScan"), /securityProfile|profile enrichment/i, "prediction scans must not call or wait for profile enrichment");

    const fingerprint = crypto.createHash("sha256").update(extractFunction(server, "buildPrediction")).digest("hex");
    assert.equal(fingerprint, "72714872ed27c9c7d1ceac407a87e67d753afb9f6c7cec8f0051cc80631fb1bc");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  console.log("Security profile enrichment smoke test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
