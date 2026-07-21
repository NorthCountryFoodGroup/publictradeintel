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
    }),
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

    const unresolved = service(temp, "unresolved", {
      "/chart/MISS": new Error("not found"),
      "function=OVERVIEW": {},
    });
    const missing = await unresolved.instance.getProfile("MISS");
    assert.equal(missing.profileStatus, "unresolved");
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

    const unsupported = service(temp, "unsupported", {
      "/chart/WRTX": yahoo("WRTX", { longName: "Verified Issuer Warrant", instrumentType: "WARRANT" }),
      "function=OVERVIEW": {},
    }, [{ ticker: "WRTX", name: "Verified Issuer Warrant", securityType: "Warrant", exchange: "NASDAQ" }]);
    assert.equal((await unsupported.instance.getProfile("WRTX")).profileStatus, "unsupported_type");

    let duplicateLookups = 0;
    const duplicate = service(temp, "duplicate", {
      "/chart/DUPL": async () => { duplicateLookups += 1; await new Promise((resolve) => setTimeout(resolve, 20)); return yahoo("DUPL", { longName: "Duplicate Company" }); },
      "function=OVERVIEW": { Symbol: "DUPL", Name: "Duplicate Company", AssetType: "Common Stock", Description: "One verified lookup shared across horizons." },
    });
    const duplicateProfiles = await Promise.all([1, 2, 3, 4].map(() => duplicate.instance.getProfile("DUPL")));
    assert.equal(duplicateLookups, 1, "four horizon references should share one profile lookup");
    assert.ok(duplicateProfiles.every((profile) => profile.securityName === "Duplicate Company"));

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
