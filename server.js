const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PIN = process.env.ADMIN_PIN || "";
const LOGIN_PIN = process.env.LOGIN_PIN || ADMIN_PIN;
const PORTFOLIO_PIN = process.env.PORTFOLIO_PIN || ADMIN_PIN;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const POLICY_FILE = path.join(DATA_DIR, "policySignals.json");
const CONGRESS_FEED_STATUS_FILE = path.join(DATA_DIR, "congressFeedStatus.json");
const PORTFOLIO_FILE = path.join(DATA_DIR, "portfolio.json");
const PREDICTIONS_FILE = path.join(DATA_DIR, "predictions.json");
const SYMBOL_UNIVERSE_FILE = path.join(DATA_DIR, "symbolUniverse.json");
const PREDICTION_HISTORY_FILE = path.join(DATA_DIR, "predictionHistory.json");
const OUTCOME_STATUS_FILE = path.join(DATA_DIR, "outcomeStatus.json");
const MARKET_API_KEY = String(process.env.ALPHA_VANTAGE_API_KEY || "").trim();
const POLICY_REFRESH_MS = Number(process.env.POLICY_REFRESH_MS || 60 * 60 * 1000);
const CONGRESS_TRADES_FEED_URL = process.env.CONGRESS_TRADES_FEED_URL || "";
const CONGRESS_TRADES_API_KEY = process.env.CONGRESS_TRADES_API_KEY || "";
const CONGRESS_REFRESH_MS = Number(process.env.CONGRESS_REFRESH_MS || 60 * 60 * 1000);
const PREDICTION_REFRESH_MS = Number(process.env.PREDICTION_REFRESH_MS || 60 * 60 * 1000);
const SESSION_COOKIE = "pti_session";
const sessions = new Map();
const BROAD_SCREEN_TARGET = 2500;
const DEEP_ANALYSIS_MARKET_HOURS_TARGET = 300;
const DEEP_ANALYSIS_AFTER_HOURS_TARGET = 600;
const PROVIDER_CONCURRENCY_LIMIT = 4;
const PROVIDER_REQUEST_BUDGET = 2500;
const MAX_SCAN_DURATION = 180000;
const MARKET_QUOTE_BATCH_SIZE = 8;
const MARKET_QUOTE_RETRY_DELAY_MS = 350;
const SCAN_UNIVERSE_MODES = ["watchlist", "sp500", "nasdaq100", "etfs", "combined", "symbolMaster"];
const DEFAULT_DISCOVERY_SETTINGS = {
  broadScreenTarget: BROAD_SCREEN_TARGET,
  targetSymbolCount: BROAD_SCREEN_TARGET,
  includeEtfs: true,
  includeSmallCaps: false,
  excludeOtc: true,
  minimumPrice: 3,
  minimumAverageVolume: 250000,
  minimumMarketCap: 0,
  maxBroadScreenDurationMs: 45000,
  marketHoursDeepCount: DEEP_ANALYSIS_MARKET_HOURS_TARGET,
  afterHoursDeepCount: DEEP_ANALYSIS_AFTER_HOURS_TARGET,
  maxDeepAnalysisDurationMs: 120000,
  batchSize: 8,
  requestConcurrency: PROVIDER_CONCURRENCY_LIMIT,
  providerConcurrencyLimit: PROVIDER_CONCURRENCY_LIMIT,
  providerRequestBudget: PROVIDER_REQUEST_BUDGET,
  maxScanDurationMs: MAX_SCAN_DURATION,
  retryCount: 1,
  strongSectorPercent: 60,
  improvingSectorPercent: 20,
  contrarianPercent: 10,
  catalystPercent: 10,
  minimumPerSector: 2,
  scheduledScanningEnabled: false,
  scheduledScanTimes: ["08:30", "09:45", "12:00", "15:30", "19:00"],
  timezone: "America/New_York",
  symbolUniverseRefreshHours: 24,
  includeAdrs: true,
  includeClosedEndFunds: false,
};
const DEFAULT_MODEL_WEIGHTS = {
  modelVersion: "v5-responsive-discovery",
  oneDay: { momentum: 24, technical: 18, volume: 18, multiTimeframe: 14, setup: 10, chartPattern: 6, marketRegime: 4, sectorStrength: 4, news: 5, policy: 2, congressional: 5, shortSqueeze: 5, fundamentals: 0, freshnessPenalty: -8, dataQualityPenalty: -8 },
  sevenDay: { momentum: 20, technical: 18, volume: 10, multiTimeframe: 12, setup: 10, chartPattern: 8, marketRegime: 6, sectorStrength: 9, news: 7, policy: 4, congressional: 7.5, shortSqueeze: 3, fundamentals: 3, freshnessPenalty: -6, dataQualityPenalty: -7 },
  oneMonth: { momentum: 14, technical: 16, volume: 6, multiTimeframe: 7, setup: 6, chartPattern: 8, marketRegime: 10, sectorStrength: 12, news: 8, policy: 7, congressional: 10, shortSqueeze: 2, fundamentals: 10, freshnessPenalty: -4, dataQualityPenalty: -6 },
  oneYear: { momentum: 8, technical: 10, volume: 3, multiTimeframe: 3, setup: 2, chartPattern: 4, marketRegime: 10, sectorStrength: 12, news: 5, policy: 8, congressional: 10, shortSqueeze: 1, fundamentals: 24, freshnessPenalty: -3, dataQualityPenalty: -5 },
  lastChangedAt: null,
  changedBy: "system defaults",
};
let activePredictionScan = null;
const BUILT_IN_UNIVERSES = {
  sp500: [
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "GOOG", "BRK.B", "LLY", "AVGO", "JPM", "TSLA",
    "XOM", "UNH", "V", "MA", "COST", "HD", "PG", "WMT", "NFLX", "JNJ", "CRM", "ABBV", "BAC", "ORCL",
    "KO", "CVX", "MRK", "WFC", "AMD", "PEP", "ACN", "MCD", "ADBE", "CSCO", "TMO", "LIN", "ABT", "QCOM",
    "GE", "TXN", "PM", "INTU", "IBM", "AMGN", "CAT", "ISRG", "NOW", "GS", "UBER", "DIS", "RTX", "SPGI",
    "PGR", "AXP", "BKNG", "NEE", "LOW", "HON",
  ],
  nasdaq100: [
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "AVGO", "GOOGL", "GOOG", "TSLA", "COST", "NFLX", "AMD",
    "PEP", "ADBE", "CSCO", "QCOM", "INTU", "AMGN", "ISRG", "BKNG", "TXN", "CMCSA", "HON", "AMAT",
    "PANW", "ADP", "GILD", "MU", "ADI", "LRCX", "MELI", "VRTX", "SBUX", "KLAC", "MDLZ", "REGN",
    "CDNS", "SNPS", "MAR", "CRWD", "PYPL", "ORLY", "MRVL", "ABNB", "CSX", "FTNT", "NXPI", "ROP",
  ],
  etfs: [
    "SPY", "VOO", "IVV", "QQQ", "VTI", "IWM", "DIA", "SCHD", "VIG", "XLK", "XLF", "XLE", "XLV", "XLY",
    "XLI", "XLP", "XLC", "SMH", "SOXX", "ARKK", "TLT", "HYG", "GLD", "SLV", "USO", "VNQ", "EEM", "VEA",
  ],
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function ageMs(timestamp) {
  const time = Date.parse(timestamp || "");
  return Number.isFinite(time) ? Date.now() - time : Infinity;
}

function isoNow() {
  return new Date().toISOString();
}

function tradingDaysFrom(startTimestamp, tradingDays) {
  const date = new Date(startTimestamp || Date.now());
  let remaining = Number(tradingDays) || 1;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  date.setHours(16, 0, 0, 0);
  return date.toISOString();
}

function securityTypeForSymbol(symbol, index = 0) {
  if (/ETF|FUND/i.test(symbol)) return "ETF";
  if (index % 29 === 0) return "ADR";
  if (index % 43 === 0) return "Closed-End Fund";
  return "Common Stock";
}

function providerTickerFor(ticker, provider = "yahoo") {
  const canonicalTicker = quoteTickerSymbol(ticker);
  const providerTicker = provider === "yahoo" ? canonicalTicker.replace(/\./g, "-") : canonicalTicker;
  return {
    canonicalTicker,
    displayTicker: canonicalTicker,
    providerTicker,
    provider,
  };
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function publicErrorMessage(error, fallback = "Request failed.") {
  const message = String(error?.message || fallback);
  const redacted = MARKET_API_KEY ? message.replaceAll(MARKET_API_KEY, "[redacted]") : message;
  if (/apikey|api key|premium endpoint|rate limit|frequency|alpha vantage/i.test(redacted)) {
    return fallback;
  }
  return redacted.slice(0, 180);
}

function sendRedirect(response, location) {
  response.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
  });
  response.end();
}

function collectBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body ? JSON.parse(body) : {}));
    request.on("error", reject);
  });
}

function isAdmin(request) {
  return Boolean(ADMIN_PIN && request.headers["x-admin-pin"] === ADMIN_PIN);
}

function isPortfolioOwner(request) {
  return Boolean(PORTFOLIO_PIN && request.headers["x-portfolio-pin"] === PORTFOLIO_PIN);
}

function parseCookies(request) {
  return String(request.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf("=");
      if (index === -1) return cookies;
      cookies[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
      return cookies;
    }, {});
}

function isLoggedIn(request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  return Boolean(token && sessions.has(token));
}

function createSession(response) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { createdAt: Date.now() });
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
}

function clearSession(request, response) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function safeHttpUrl(value, fallback) {
  try {
    const url = new URL(String(value || fallback));
    return ["http:", "https:"].includes(url.protocol) ? url.toString().slice(0, 220) : fallback;
  } catch {
    return fallback;
  }
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function numberPercent(value) {
  const parsed = Number(String(value || "").replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizePortfolioPosition(position) {
  const ticker = String(position?.ticker || "")
    .toUpperCase()
    .replace(/[^A-Z.-]/g, "")
    .slice(0, 12);
  const amountInvested = Math.max(0, Number(position?.amountInvested) || 0);
  const buyPrice = Math.max(0, Number(position?.buyPrice) || 0);
  const shares = Math.max(0, Number(position?.shares) || (buyPrice > 0 ? amountInvested / buyPrice : 0));
  const currentPrice = Math.max(0, Number(position?.currentPrice) || buyPrice);
  const dailySnapshots = Array.isArray(position?.dailySnapshots)
    ? position.dailySnapshots.slice(-30).map((snapshot) => ({
        date: String(snapshot.date || "").slice(0, 10),
        currentPrice: Math.max(0, Number(snapshot.currentPrice) || 0),
        currentValue: Math.max(0, Number(snapshot.currentValue) || 0),
        totalGain: Number(snapshot.totalGain) || 0,
        totalReturn: Number(snapshot.totalReturn) || 0,
      }))
    : [];

  return {
    id: String(position?.id || `${Date.now()}-${ticker || "POSITION"}`).replace(/[^\w.-]/g, "").slice(0, 80),
    ticker: ticker || "TICKER",
    amountInvested,
    buyPrice,
    shares,
    boughtAt: String(position?.boughtAt || new Date().toISOString().slice(0, 10)).slice(0, 10),
    currentPrice,
    marketChangePercent: String(position?.marketChangePercent || "").slice(0, 24),
    marketUpdatedAt: String(position?.marketUpdatedAt || "").slice(0, 40),
    marketProvider: String(position?.marketProvider || "Manual entry").slice(0, 40),
    dailySnapshots,
  };
}

function sanitizePortfolio(value) {
  return Array.isArray(value) ? value.slice(0, 200).map(sanitizePortfolioPosition) : [];
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function sanitizeDiscoverySettings(settings = {}) {
  const source = { ...DEFAULT_DISCOVERY_SETTINGS, ...(settings || {}) };
  const broadScreenTarget = boundedNumber(source.broadScreenTarget ?? source.targetSymbolCount, BROAD_SCREEN_TARGET, 25, 5000);
  const providerConcurrencyLimit = boundedNumber(source.providerConcurrencyLimit ?? source.requestConcurrency, PROVIDER_CONCURRENCY_LIMIT, 1, 20);
  const providerRequestBudget = boundedNumber(source.providerRequestBudget, PROVIDER_REQUEST_BUDGET, 25, 5000);
  return {
    broadScreenTarget,
    targetSymbolCount: broadScreenTarget,
    includeEtfs: source.includeEtfs !== false,
    includeSmallCaps: source.includeSmallCaps === true,
    excludeOtc: source.excludeOtc !== false,
    minimumPrice: boundedNumber(source.minimumPrice, 3, 0, 1000),
    minimumAverageVolume: boundedNumber(source.minimumAverageVolume, 250000, 0, 100000000),
    minimumMarketCap: boundedNumber(source.minimumMarketCap, 0, 0, 10000000000000),
    maxBroadScreenDurationMs: boundedNumber(source.maxBroadScreenDurationMs, 45000, 5000, 300000),
    marketHoursDeepCount: boundedNumber(source.marketHoursDeepCount, DEEP_ANALYSIS_MARKET_HOURS_TARGET, 25, 1000),
    afterHoursDeepCount: boundedNumber(source.afterHoursDeepCount, DEEP_ANALYSIS_AFTER_HOURS_TARGET, 25, 1500),
    maxDeepAnalysisDurationMs: boundedNumber(source.maxDeepAnalysisDurationMs, 120000, 10000, 600000),
    batchSize: boundedNumber(source.batchSize, 8, 1, 50),
    requestConcurrency: providerConcurrencyLimit,
    providerConcurrencyLimit,
    providerRequestBudget,
    maxScanDurationMs: boundedNumber(source.maxScanDurationMs, MAX_SCAN_DURATION, 30000, 900000),
    retryCount: boundedNumber(source.retryCount, 1, 0, 5),
    strongSectorPercent: boundedNumber(source.strongSectorPercent, 60, 0, 100),
    improvingSectorPercent: boundedNumber(source.improvingSectorPercent, 20, 0, 100),
    contrarianPercent: boundedNumber(source.contrarianPercent, 10, 0, 100),
    catalystPercent: boundedNumber(source.catalystPercent, 10, 0, 100),
    minimumPerSector: boundedNumber(source.minimumPerSector, 2, 0, 25),
    scheduledScanningEnabled: source.scheduledScanningEnabled === true,
    scheduledScanTimes: Array.isArray(source.scheduledScanTimes) ? source.scheduledScanTimes.slice(0, 8).map((time) => String(time).slice(0, 8)) : DEFAULT_DISCOVERY_SETTINGS.scheduledScanTimes,
    timezone: String(source.timezone || "America/New_York").slice(0, 80),
    symbolUniverseRefreshHours: boundedNumber(source.symbolUniverseRefreshHours, 24, 1, 720),
    includeAdrs: source.includeAdrs !== false,
    includeClosedEndFunds: source.includeClosedEndFunds === true,
    lastChangedAt: String(source.lastChangedAt || "").slice(0, 40),
  };
}

function sanitizeModelWeights(weights = {}) {
  const next = { ...DEFAULT_MODEL_WEIGHTS, ...(weights || {}) };
  for (const key of ["oneDay", "sevenDay", "oneMonth", "oneYear"]) {
    next[key] = { ...DEFAULT_MODEL_WEIGHTS[key], ...(weights?.[key] || {}) };
    Object.keys(next[key]).forEach((name) => {
      next[key][name] = boundedNumber(next[key][name], DEFAULT_MODEL_WEIGHTS[key][name] || 0, -50, 100);
    });
  }
  next.modelVersion = String(next.modelVersion || DEFAULT_MODEL_WEIGHTS.modelVersion).slice(0, 80);
  next.lastChangedAt = String(next.lastChangedAt || "").slice(0, 40);
  next.changedBy = String(next.changedBy || "admin").slice(0, 80);
  return next;
}

function sanitizeConfig(config) {
  return {
    thresholds: {
      firstEmergencyTarget: Math.max(0, Number(config?.thresholds?.firstEmergencyTarget) || 100),
      fullEmergencyTarget: Math.max(0, Number(config?.thresholds?.fullEmergencyTarget) || 500),
      debtInvestCap: Math.max(0, Number(config?.thresholds?.debtInvestCap) || 10),
    },
    scanSettings: {
      universe: SCAN_UNIVERSE_MODES.includes(config?.scanSettings?.universe) ? config.scanSettings.universe : "combined",
      customTickers: String(config?.scanSettings?.customTickers || "")
        .toUpperCase()
        .replace(/[^A-Z0-9.,\s-]/g, "")
        .slice(0, 1600),
    },
    plans: Array.isArray(config?.plans)
      ? config.plans.slice(0, 8).map((plan) => ({
          name: String(plan.name || "Starter plan").slice(0, 80),
          weekly: Math.max(0, Number(plan.weekly) || 0),
          tone: String(plan.tone || "").slice(0, 220),
        }))
      : [],
    goals: Array.isArray(config?.goals)
      ? config.goals.slice(0, 8).map((goal) => ({
          name: String(goal.name || "Micro-goal").slice(0, 80),
          target: Math.max(1, Number(goal.target) || 1),
          source: ["emergency", "invested", "dividend", "netWorth"].includes(goal.source)
            ? goal.source
            : "emergency",
        }))
      : [],
    stockIdeas: Array.isArray(config?.stockIdeas)
      ? config.stockIdeas.slice(0, 200).map((stock) => ({
          ticker: String(stock.ticker || "TICKER").toUpperCase().replace(/[^A-Z.-]/g, "").slice(0, 12),
          name: String(stock.name || "Stock idea").slice(0, 80),
          type: ["ETF", "Stock"].includes(stock.type) ? stock.type : "Stock",
          risk: ["cautious", "balanced", "growth"].includes(stock.risk) ? stock.risk : "balanced",
          minimumWeekly: Math.max(0, Number(stock.minimumWeekly) || 0),
          valuationScore: Math.min(100, Math.max(0, Number(stock.valuationScore) || 0)),
          momentumScore: Math.min(100, Math.max(0, Number(stock.momentumScore) || 0)),
          qualityScore: Math.min(100, Math.max(0, Number(stock.qualityScore) || 0)),
          volatilityScore: Math.min(100, Math.max(0, Number(stock.volatilityScore) || 0)),
          pressScore: Math.min(100, Math.max(0, Number(stock.pressScore) || 0)),
          pressNotes: String(stock.pressNotes || "").slice(0, 260),
          committeeScore: Math.min(100, Math.max(0, Number(stock.committeeScore) || 0)),
          committeeNotes: String(stock.committeeNotes || "").slice(0, 260),
          aiOutlook: String(stock.aiOutlook || "").slice(0, 260),
          riskNote: String(stock.riskNote || "").slice(0, 220),
          marketPrice: Number(stock.marketPrice) || null,
          marketVolume: Number(stock.marketVolume) || null,
          marketChangePercent: String(stock.marketChangePercent || "").slice(0, 24),
          marketUpdatedAt: String(stock.marketUpdatedAt || "").slice(0, 40),
          marketProvider: String(stock.marketProvider || "").slice(0, 40),
          shortInterest: Number.isFinite(Number(stock.shortInterest)) ? Number(stock.shortInterest) : null,
          floatSize: Number.isFinite(Number(stock.floatSize)) ? Number(stock.floatSize) : null,
          relativeVolume: Number.isFinite(Number(stock.relativeVolume)) ? Number(stock.relativeVolume) : null,
        }))
      : [],
    congressTrades: Array.isArray(config?.congressTrades)
      ? config.congressTrades.slice(0, 24).map((trade) => ({
          representative: String(trade.representative || "Representative").slice(0, 80),
          state: String(trade.state || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2),
          party: String(trade.party || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3),
          ticker: String(trade.ticker || "TICKER").toUpperCase().replace(/[^A-Z.-]/g, "").slice(0, 12),
          company: String(trade.company || "Company").slice(0, 80),
          transaction: ["Buy", "Sell", "Exchange"].includes(trade.transaction) ? trade.transaction : "Buy",
          reportedRange: String(trade.reportedRange || "Not reported").slice(0, 80),
          reportedDate: String(trade.reportedDate || "").slice(0, 20),
          entryPrice: Number(trade.entryPrice) || null,
          entryPriceSource: String(trade.entryPriceSource || "").slice(0, 120),
          sourceUrl: safeHttpUrl(trade.sourceUrl, "https://disclosures-clerk.house.gov/FinancialDisclosure"),
          watchReason: String(trade.watchReason || "").slice(0, 260),
          signalScore: Math.min(100, Math.max(0, Number(trade.signalScore) || 0)),
          conflictRisk: String(trade.conflictRisk || "Watch").slice(0, 80),
          marketPrice: Number(trade.marketPrice) || null,
          marketVolume: Number(trade.marketVolume) || null,
          marketChangePercent: String(trade.marketChangePercent || "").slice(0, 24),
          marketUpdatedAt: String(trade.marketUpdatedAt || "").slice(0, 40),
          marketProvider: String(trade.marketProvider || "").slice(0, 40),
        }))
      : [],
    discoverySettings: sanitizeDiscoverySettings(config?.discoverySettings),
    modelWeights: sanitizeModelWeights(config?.modelWeights),
    policySources: Array.isArray(config?.policySources)
      ? config.policySources.slice(0, 20).map((source) => ({
          name: String(source.name || "Policy source").slice(0, 100),
          url: safeHttpUrl(source.url, "https://www.congress.gov/congressional-record"),
          type: ["html", "json", "text"].includes(source.type) ? source.type : "html",
          enabled: source.enabled !== false,
        }))
      : [],
  };
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenJsonText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(flattenJsonText).join(" ");
  if (typeof value === "object") return Object.values(value).map(flattenJsonText).join(" ");
  return "";
}

async function fetchPolicySource(source) {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "SteadyStartPolicyMonitor/1.0",
      Accept: source.type === "json" ? "application/json,text/plain,*/*" : "text/html,text/plain,*/*",
    },
  });
  if (!response.ok) throw new Error(`${source.name} returned ${response.status}`);

  if (source.type === "json") {
    const data = await response.json();
    return flattenJsonText(data);
  }

  return stripHtml(await response.text());
}

function stockPolicyTerms(stock) {
  const words = [
    stock.ticker,
    stock.name,
    ...(String(stock.name || "").split(/\s+/).filter((word) => word.length > 4)),
    ...(String(stock.pressNotes || "").match(/\b[A-Z][A-Za-z]{4,}\b/g) || []),
    ...(String(stock.committeeNotes || "").match(/\b[A-Z][A-Za-z]{4,}\b/g) || []),
  ];

  return [...new Set(words.map((word) => String(word).toLowerCase()).filter((word) => word.length >= 2))].slice(0, 18);
}

function scorePolicyText(stock, source, text) {
  const lower = text.toLowerCase();
  const terms = stockPolicyTerms(stock);
  const hits = terms.filter((term) => lower.includes(term));
  if (!hits.length) return null;

  const positiveWords = [
    "approval",
    "approved",
    "contract",
    "funding",
    "grant",
    "subsidy",
    "award",
    "authorized",
    "investment",
    "infrastructure",
    "expansion",
    "hearing",
    "markup",
    "advanced",
  ];
  const negativeWords = [
    "inquiry",
    "investigation",
    "probe",
    "ban",
    "restriction",
    "lawsuit",
    "penalty",
    "fine",
    "blocked",
    "antitrust",
    "recall",
    "sanction",
    "oversight",
  ];

  const positiveHits = positiveWords.filter((word) => lower.includes(word));
  const negativeHits = negativeWords.filter((word) => lower.includes(word));
  const committeeBoost = Math.round((Number(stock.committeeScore) || 0) * 0.24);
  const pressBoost = Math.round((Number(stock.pressScore) || 0) * 0.18);
  const rawScore = hits.length * 12 + positiveHits.length * 10 - negativeHits.length * 12 + committeeBoost + pressBoost;
  const score = Math.max(0, Math.min(100, rawScore));
  const direction = negativeHits.length > positiveHits.length ? "negative" : positiveHits.length > negativeHits.length ? "positive" : "mixed";
  const level = score >= 78 && direction !== "negative" ? "Level 1 aggressive buy" : score >= 58 ? "Level 2 watch / starter buy" : direction === "negative" ? "Level 4 avoid or short-watch" : "Level 3 monitor";
  const strategy =
    level.startsWith("Level 1")
      ? "High reward setup: catalyst and committee signals support an aggressive buy candidate."
      : level.startsWith("Level 2")
        ? "Moderate reward setup: consider smaller sizing until more confirmation appears."
        : level.startsWith("Level 4")
          ? "Negative policy pressure: avoid buying unless price action strongly confirms a reversal."
          : "Early signal: monitor for follow-up filings, hearings, votes, or press releases.";

  return {
    ticker: stock.ticker,
    company: stock.name,
    sourceName: source.name,
    sourceUrl: source.url,
    direction,
    level,
    score,
    matchedTerms: hits.slice(0, 8),
    positiveHits: positiveHits.slice(0, 8),
    negativeHits: negativeHits.slice(0, 8),
    strategy,
    foundAt: new Date().toISOString(),
  };
}

async function refreshPolicySignals() {
  const config = sanitizeConfig(readJson(CONFIG_FILE, {}));
  const sources = (config.policySources || []).filter((source) => source.enabled);
  const stocks = buildScanUniverse(config);
  const signals = [];
  const errors = [];

  for (const source of sources) {
    try {
      const text = await fetchPolicySource(source);
      for (const stock of stocks) {
        const signal = scorePolicyText(stock, source, text);
        if (signal) signals.push(signal);
      }
    } catch (error) {
      errors.push({ source: source.name, error: error.message });
    }
  }

  const result = {
    updatedAt: new Date().toISOString(),
    signals: signals.sort((a, b) => b.score - a.score).slice(0, 40),
    errors,
  };
  writeJson(POLICY_FILE, result);
  return result;
}

function parseTickerList(value) {
  return [...new Set(String(value || "")
    .toUpperCase()
    .split(/[\s,]+/)
    .map((ticker) => ticker.replace(/[^A-Z.-]/g, "").slice(0, 12))
    .filter(Boolean))];
}

function universePresetTickers(mode) {
  if (mode === "sp500") return BUILT_IN_UNIVERSES.sp500;
  if (mode === "nasdaq100") return BUILT_IN_UNIVERSES.nasdaq100;
  if (mode === "etfs") return BUILT_IN_UNIVERSES.etfs;
  if (mode === "combined") return [...BUILT_IN_UNIVERSES.sp500, ...BUILT_IN_UNIVERSES.nasdaq100, ...BUILT_IN_UNIVERSES.etfs];
  if (mode === "symbolMaster") return symbolMasterTickers(sanitizeConfig(readJson(CONFIG_FILE, {})));
  return [];
}

function symbolMasterFallbackRows(count = 3200) {
  const exchanges = ["NASDAQ", "NYSE", "NYSE American"];
  const rows = [];
  const realSeed = [
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "GOOG", "BRK.B", "LLY", "AVGO", "JPM", "TSLA",
    "SPY", "QQQ", "IWM", "VTI", "VOO", "DIA", "XLK", "XLF", "XLE", "XLV", "SMH", "SOXX",
  ];
  realSeed.forEach((ticker, index) => {
    rows.push({
      canonicalTicker: quoteTickerSymbol(ticker),
      displayTicker: quoteTickerSymbol(ticker),
      providerTicker: yahooTickerSymbol(ticker),
      name: ticker,
      exchange: index % 3 === 0 ? "NASDAQ" : index % 3 === 1 ? "NYSE" : "NYSE American",
      securityType: BUILT_IN_UNIVERSES.etfs.includes(ticker) ? "ETF" : "Common Stock",
      active: true,
      source: "fixture-fallback",
    });
  });
  for (let index = 0; rows.length < count; index += 1) {
    const prefix = String.fromCharCode(65 + (index % 26)) + String.fromCharCode(65 + (Math.floor(index / 26) % 26));
    const ticker = `${prefix}${String(index % 100).padStart(2, "0")}`;
    if (rows.some((row) => row.canonicalTicker === ticker)) continue;
    const type = index % 17 === 0 ? "ETF" : securityTypeForSymbol(ticker, index);
    rows.push({
      canonicalTicker: ticker,
      displayTicker: ticker,
      providerTicker: ticker,
      name: `Fixture ${type} ${ticker}`,
      exchange: exchanges[index % exchanges.length],
      securityType: type,
      active: true,
      source: "fixture-fallback",
    });
  }
  return rows;
}

function symbolUniverseMetadata(rows, source, status, notes = [], exclusions = {}) {
  const exchangeCounts = {};
  const securityCounts = {};
  rows.forEach((row) => {
    exchangeCounts[row.exchange || "Unknown"] = (exchangeCounts[row.exchange || "Unknown"] || 0) + 1;
    securityCounts[row.securityType || "Unknown"] = (securityCounts[row.securityType || "Unknown"] || 0) + 1;
  });
  const fetchedAt = isoNow();
  return {
    source,
    fetchedAt,
    rawSymbolCount: rows.length + Object.values(exclusions).reduce((sum, value) => sum + value, 0),
    normalizedSymbolCount: rows.length,
    eligibleSymbolCount: rows.length,
    commonStockCount: securityCounts["Common Stock"] || 0,
    ETFCount: securityCounts.ETF || 0,
    excludedCount: Object.values(exclusions).reduce((sum, value) => sum + value, 0),
    exclusionReasons: exclusions,
    exchangeCounts,
    securityTypeCounts: securityCounts,
    refreshStatus: status,
    refreshNotes: notes,
    timezone: DEFAULT_DISCOVERY_SETTINGS.timezone,
  };
}

function buildFallbackSymbolUniverse(note = "Official exchange listing refresh unavailable; using generated fixture universe for development/testing.") {
  const symbols = symbolMasterFallbackRows(3200);
  return {
    symbols,
    symbolUniverseMetadata: symbolUniverseMetadata(symbols, "Generated fixture fallback, not live broad-market coverage", "fallback", [note]),
  };
}

async function refreshSymbolUniverse() {
  const sources = [
    { name: "Nasdaq Trader nasdaqlisted", url: "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt" },
    { name: "Nasdaq Trader otherlisted", url: "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt" },
  ];
  const rows = [];
  const exclusions = {};
  try {
    for (const source of sources) {
      const response = await fetch(source.url, { headers: { "User-Agent": "PublicTradeIntelSymbolUniverse/1.0" } });
      if (!response.ok) throw new Error(`${source.name} returned ${response.status}`);
      const text = await response.text();
      const lines = text.split(/\r?\n/).filter((line) => line && !/^File Creation Time/i.test(line));
      const headers = lines.shift()?.split("|") || [];
      for (const line of lines) {
        const values = line.split("|");
        const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
        const rawTicker = row.Symbol || row["ACT Symbol"] || "";
        const ticker = quoteTickerSymbol(rawTicker);
        const name = row["Security Name"] || row["Company Name"] || ticker;
        const exchange = row["Listing Exchange"] === "N" ? "NYSE" : row["Listing Exchange"] === "A" ? "NYSE American" : "NASDAQ";
        const type = /ETF/i.test(row.ETF || name) ? "ETF" : /ADR/i.test(name) ? "ADR" : /Fund/i.test(name) ? "Closed-End Fund" : "Common Stock";
        const invalid = !ticker || /[\^$]/.test(rawTicker) || /Warrant|Right|Unit|Preferred|Test|Delisted/i.test(name);
        if (invalid) {
          exclusions.invalidOrExcludedSecurity = (exclusions.invalidOrExcludedSecurity || 0) + 1;
          continue;
        }
        rows.push({ ...providerTickerFor(ticker), name, exchange, securityType: type, active: true, source: source.name });
      }
    }
    const unique = [...new Map(rows.map((row) => [row.canonicalTicker, row])).values()];
    if (unique.length < 2500) throw new Error(`Official listing source returned only ${unique.length} eligible symbols.`);
    const result = {
      symbols: unique,
      symbolUniverseMetadata: symbolUniverseMetadata(unique, "Nasdaq Trader exchange listing files", "live", ["Fetched official listing files."], exclusions),
    };
    writeJson(SYMBOL_UNIVERSE_FILE, result);
    return result;
  } catch (error) {
    const saved = readJson(SYMBOL_UNIVERSE_FILE, null);
    if (saved?.symbols?.length) {
      saved.symbolUniverseMetadata = {
        ...(saved.symbolUniverseMetadata || {}),
        refreshStatus: "stale",
        refreshNotes: [`Refresh failed: ${error.message}. Retaining last valid symbol master.`],
      };
      writeJson(SYMBOL_UNIVERSE_FILE, saved);
      return saved;
    }
    const fallback = buildFallbackSymbolUniverse(`Official symbol refresh failed: ${error.message}. Generated fixture universe is explicit fallback only.`);
    writeJson(SYMBOL_UNIVERSE_FILE, fallback);
    return fallback;
  }
}

function loadSymbolUniverse() {
  const saved = readJson(SYMBOL_UNIVERSE_FILE, null);
  if (saved?.symbols?.length) return saved;
  const fallback = buildFallbackSymbolUniverse("No cached symbol master exists yet. This is an explicit fallback, not live exchange coverage.");
  writeJson(SYMBOL_UNIVERSE_FILE, fallback);
  return fallback;
}

function symbolMasterTickers(config) {
  const discovery = sanitizeDiscoverySettings(config.discoverySettings);
  const universe = loadSymbolUniverse();
  return (universe.symbols || [])
    .filter((row) => row.active !== false)
    .filter((row) => discovery.includeEtfs || row.securityType !== "ETF")
    .filter((row) => discovery.includeAdrs || row.securityType !== "ADR")
    .filter((row) => discovery.includeClosedEndFunds || row.securityType !== "Closed-End Fund")
    .map((row) => row.displayTicker || row.canonicalTicker)
    .filter(Boolean);
}

function universeCandidate(ticker, index, overrides = {}) {
  const isEtf = BUILT_IN_UNIVERSES.etfs.includes(ticker) || /ETF/i.test(overrides.type || "");
  const seed = ticker.split("").reduce((sum, char) => sum + char.charCodeAt(0), index * 7);
  return {
    ticker,
    name: overrides.name || ticker,
    type: overrides.type || (isEtf ? "ETF" : "Stock"),
    risk: overrides.risk || (isEtf ? "balanced" : "growth"),
    minimumWeekly: Number(overrides.minimumWeekly) || 5,
    valuationScore: Number(overrides.valuationScore) || clamp(56 + (seed % 26)),
    momentumScore: Number(overrides.momentumScore) || clamp(54 + ((seed * 3) % 34)),
    qualityScore: Number(overrides.qualityScore) || clamp(isEtf ? 78 : 58 + ((seed * 5) % 36)),
    volatilityScore: Number(overrides.volatilityScore) || clamp(isEtf ? 74 : 46 + ((seed * 7) % 42)),
    pressScore: Number(overrides.pressScore) || clamp(42 + ((seed * 11) % 44)),
    pressNotes: overrides.pressNotes || `${ticker} included from ${isEtf ? "major ETF" : "preset stock"} scan universe.`,
    committeeScore: Number(overrides.committeeScore) || clamp(30 + ((seed * 13) % 45)),
    committeeNotes: overrides.committeeNotes || "Preset universe candidate; committee relevance is estimated until specific signals match.",
    aiOutlook: overrides.aiOutlook || "Universe candidate scored from market, technical, policy, and pattern layers during prediction scans.",
    riskNote: overrides.riskNote || "Universe candidate. Review live data and risk before acting.",
    ...overrides,
  };
}

function configuredUniverseTickers(config) {
  const watchlist = new Map((config.stockIdeas || []).map((stock) => [stock.ticker, stock]));
  const custom = parseTickerList(config.scanSettings?.customTickers);
  const mode = config.scanSettings?.universe || "combined";
  const tickers = [
    ...(mode === "watchlist" ? [...watchlist.keys()] : mode === "symbolMaster" ? symbolMasterTickers(config) : universePresetTickers(mode)),
    ...custom,
  ];
  if (mode === "combined") tickers.unshift(...watchlist.keys());
  return [...new Set(tickers.filter(Boolean))];
}

function buildDiscoveryPipeline(config, quotes = []) {
  const quoteMap = new Map((quotes || []).map((quote) => [quote.ticker, quote]));
  const watchlist = new Map((config.stockIdeas || []).map((stock) => [stock.ticker, stock]));
  const mode = config.scanSettings?.universe || "combined";
  const discovery = sanitizeDiscoverySettings(config.discoverySettings);
  const unique = configuredUniverseTickers(config);
  const providerSupportedBroadCount = Math.min(unique.length, discovery.broadScreenTarget, discovery.providerRequestBudget);

  const eligibleCandidates = unique
    .map((ticker, index) => {
      const quote = quoteMap.get(ticker) || {};
      const saved = watchlist.get(ticker) || {};
      return universeCandidate(ticker, index, { ...saved, ...quote });
    })
    .filter((candidate) => discovery.includeEtfs || candidate.type !== "ETF")
    .filter((candidate) => {
      const price = Number(candidate.marketPrice);
      if (Number.isFinite(price) && price > 0 && price < discovery.minimumPrice) return false;
      const volume = Number(candidate.marketVolume || candidate.averageVolume);
      if (Number.isFinite(volume) && volume > 0 && volume < discovery.minimumAverageVolume) return false;
      return true;
    });

  const deepLimit = new Date().getHours() >= 9 && new Date().getHours() < 16 ? discovery.marketHoursDeepCount : discovery.afterHoursDeepCount;
  const broadScreenCandidates = eligibleCandidates
    .map((candidate, index) => ({
      ...candidate,
      broadScreenScore: broadScreenScore(candidate, index),
      broadScreenRank: index + 1,
    }))
    .sort((a, b) => b.broadScreenScore - a.broadScreenScore || Number(b.marketVolume || 0) - Number(a.marketVolume || 0) || a.ticker.localeCompare(b.ticker))
    .slice(0, Math.min(providerSupportedBroadCount, eligibleCandidates.length));

  const deepAnalysisCandidates = broadScreenCandidates
    .slice(0, Math.min(deepLimit, broadScreenCandidates.length))
    .map((candidate, index) => ({
      ...candidate,
      broadScreenRank: index + 1,
      deepAnalysisSelected: true,
    }));

  const coverageLimitReasons = [];
  if (unique.length < discovery.broadScreenTarget) coverageLimitReasons.push("configured universe smaller than broad-screen target");
  if (discovery.providerRequestBudget < discovery.broadScreenTarget) coverageLimitReasons.push("provider request budget below broad-screen target");
  if (eligibleCandidates.length < unique.length) coverageLimitReasons.push("eligibility filters removed symbols");
  if (deepAnalysisCandidates.length < deepLimit) coverageLimitReasons.push("fewer candidates available than deep-analysis target");

  return {
    mode,
    discovery,
    allTickers: unique,
    eligibleCandidates,
    broadScreenCandidates,
    deepAnalysisCandidates,
    providerSupportedBroadCount,
    deepLimit,
    coverageLimitReasons,
    actualCoverageNote: coverageLimitReasons.length
      ? `Broad discovery screened ${broadScreenCandidates.length} of ${discovery.broadScreenTarget} requested symbols because ${coverageLimitReasons.join(", ")}.`
      : `Broad discovery screened the requested ${discovery.broadScreenTarget} symbols.`,
  };
}

function buildScanUniverse(config, quotes = []) {
  return buildDiscoveryPipeline(config, quotes).deepAnalysisCandidates;
}

function broadUniverseStats(config, quotes = []) {
  const quoteMap = new Map((quotes || []).map((quote) => [quote.ticker, quote]));
  const custom = parseTickerList(config.scanSettings?.customTickers);
  const pipeline = buildDiscoveryPipeline(config, quotes);
  const symbolUniverse = loadSymbolUniverse();
  const withQuotes = pipeline.allTickers.filter((ticker) => quoteMap.has(ticker)).length;
  return {
    mode: pipeline.mode,
    targetSymbolCount: pipeline.discovery.broadScreenTarget,
    broadScreenTarget: pipeline.discovery.broadScreenTarget,
    deepAnalysisMarketHoursTarget: pipeline.discovery.marketHoursDeepCount,
    deepAnalysisAfterHoursTarget: pipeline.discovery.afterHoursDeepCount,
    providerConcurrencyLimit: pipeline.discovery.providerConcurrencyLimit,
    providerRequestBudget: pipeline.discovery.providerRequestBudget,
    maxScanDurationMs: pipeline.discovery.maxScanDurationMs,
    totalSymbolsAvailable: pipeline.allTickers.length,
    eligibleSymbols: pipeline.eligibleCandidates.length,
    broadScreenedSymbols: pipeline.broadScreenCandidates.length,
    deepAnalysisSelectedSymbols: pipeline.deepAnalysisCandidates.length,
    customTickerCount: custom.length,
    freshQuoteCount: withQuotes,
    coverageLimitReasons: pipeline.coverageLimitReasons,
    actualCoverageNote: pipeline.actualCoverageNote,
    symbolUniverseMetadata: symbolUniverse.symbolUniverseMetadata || null,
  };
}

function broadScreenScore(candidate, index = 0) {
  const marketChange = numberPercent(candidate.marketChangePercent);
  const volume = Number(candidate.marketVolume || 0);
  const relativeVolume = Number(candidate.relativeVolume || 0);
  const freshnessBoost = candidate.marketUpdatedAt ? 12 : 0;
  const activity = clamp(Math.abs(marketChange) * 8 + Math.min(25, volume / 1000000) + relativeVolume * 12);
  return Math.round(clamp((Number(candidate.momentumScore) || 0) * 0.32 + (Number(candidate.qualityScore) || 0) * 0.18 + activity * 0.24 + (Number(candidate.pressScore) || 0) * 0.14 + freshnessBoost + (index % 7) * 0.3));
}

function uniqueTickers(config) {
  const tickers = new Set();
  for (const ticker of buildDiscoveryPipeline(config).allTickers) tickers.add(ticker);
  for (const trade of config.congressTrades || []) tickers.add(trade.ticker);
  return [...tickers].filter(Boolean);
}

function scanUniverseTickers(config) {
  const pipeline = buildDiscoveryPipeline(config);
  return pipeline.allTickers.slice(0, pipeline.providerSupportedBroadCount).filter(Boolean);
}

function quoteTickerSymbol(ticker) {
  return String(ticker || "").toUpperCase().replace(/[^A-Z.-]/g, "").slice(0, 12);
}

function yahooTickerSymbol(ticker) {
  return quoteTickerSymbol(ticker).replace(/\./g, "-");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findCachedQuote(ticker) {
  const symbol = quoteTickerSymbol(ticker);
  const config = readJson(CONFIG_FILE, {});
  const candidates = [...(config.stockIdeas || []), ...(config.congressTrades || [])];
  const match = candidates.find((item) => item.ticker === symbol && Number(item.marketPrice) > 0);
  return match
    ? {
        ticker: symbol,
    marketPrice: Number(match.marketPrice),
    marketVolume: Number(match.marketVolume) || null,
    marketChangePercent: String(match.marketChangePercent || ""),
        marketUpdatedAt: String(match.marketUpdatedAt || ""),
        marketProvider: String(match.marketProvider || "Saved market data"),
      }
    : null;
}

async function fetchAlphaVantageQuote(ticker) {
  const symbol = quoteTickerSymbol(ticker);
  if (!MARKET_API_KEY) {
    throw new Error("Set ALPHA_VANTAGE_API_KEY before refreshing market data.");
  }

  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "GLOBAL_QUOTE");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", MARKET_API_KEY);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Market data failed for ${symbol}`);

  const data = await response.json();
  const quote = data["Global Quote"];
  if (!quote || !quote["05. price"]) {
    const message = data.Note || data.Information || data["Error Message"] || `No quote returned for ${symbol}`;
    throw new Error(message);
  }

  return {
    ticker: symbol,
    marketProviderSymbol: symbol,
    marketQuoteRequested: true,
    marketQuoteRetryCount: 0,
    marketPrice: Number(quote["05. price"]),
    marketChange: Number(quote["09. change"]) || null,
    marketVolume: Number(quote["06. volume"]) || null,
    marketChangePercent: String(quote["10. change percent"] || ""),
    marketUpdatedAt: new Date().toISOString(),
    marketProvider: "Alpha Vantage",
  };
}

async function fetchYahooChartQuote(ticker) {
  const originalSymbol = quoteTickerSymbol(ticker);
  const providerSymbol = yahooTickerSymbol(ticker);
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}`);
  url.searchParams.set("range", "1d");
  url.searchParams.set("interval", "1d");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "PublicTradeIntelQuoteFallback/1.0",
      Accept: "application/json,*/*",
    },
  });
  if (!response.ok) throw new Error(`Fallback quote failed for ${providerSymbol} (${response.status})`);

  const data = await response.json();
  const meta = data?.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  if (!price) throw new Error(`No fallback quote returned for ${providerSymbol}`);

  const previousClose = Number(meta.previousClose || meta.chartPreviousClose) || null;
  const marketChange = previousClose ? price - previousClose : null;
  const marketChangePercent = previousClose ? `${((marketChange / previousClose) * 100).toFixed(2)}%` : "";

  return {
    ticker: originalSymbol,
    marketProviderSymbol: providerSymbol,
    marketQuoteRequested: true,
    marketQuoteRetryCount: 0,
    marketPrice: price,
    marketChange,
    marketVolume: Number(meta.regularMarketVolume) || null,
    marketChangePercent,
    marketUpdatedAt: new Date().toISOString(),
    marketProvider: "Yahoo chart",
  };
}

async function fetchMarketQuote(ticker) {
  const symbol = quoteTickerSymbol(ticker);
  try {
    return { ...(await fetchAlphaVantageQuote(symbol)), ticker: symbol };
  } catch (alphaError) {
    const fallback = await fetchYahooChartQuote(symbol);
    return {
      ...fallback,
      ticker: symbol,
      marketProvider: `${fallback.marketProvider} fallback`,
      marketNote: "Primary quote provider unavailable; fallback quote used.",
    };
  }
}

async function fetchMarketQuoteWithRetry(ticker, retryCount = 1) {
  let lastError = null;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const quote = await fetchMarketQuote(ticker);
      return {
        ...quote,
        marketQuoteRequested: true,
        marketQuoteRetryCount: attempt,
      };
    } catch (error) {
      lastError = error;
      if (attempt < retryCount) await delay(MARKET_QUOTE_RETRY_DELAY_MS);
    }
  }
  const symbol = quoteTickerSymbol(ticker);
  return {
    ticker: symbol,
    marketQuoteRequested: true,
    marketQuoteRetryCount: retryCount,
    marketQuoteError: publicErrorMessage(lastError, "Quote provider did not return usable market data."),
  };
}

async function refreshMarketData(config) {
  const quotes = [];
  const errors = [];
  const discovery = sanitizeDiscoverySettings(config.discoverySettings);
  const requestedTickers = scanUniverseTickers(config);
  const tickers = [...new Set(requestedTickers)].filter(Boolean);
  const startedAt = Date.now();

  for (let index = 0; index < tickers.length; index += (discovery.batchSize || MARKET_QUOTE_BATCH_SIZE)) {
    if (Date.now() - startedAt > discovery.maxScanDurationMs) {
      errors.push({ ticker: "SCAN", error: `Market quote refresh stopped after ${discovery.maxScanDurationMs}ms max scan duration.` });
      break;
    }
    const batch = tickers.slice(index, index + (discovery.batchSize || MARKET_QUOTE_BATCH_SIZE));
    const results = await Promise.all(batch.map((ticker) => fetchMarketQuoteWithRetry(ticker, discovery.retryCount)));
    for (const result of results) {
      quotes.push(result);
      if (!Number(result.marketPrice)) {
        errors.push({ ticker: result.ticker, error: result.marketQuoteError || "Quote provider did not return usable market data." });
      }
    }
  }

  const byTicker = new Map(quotes.map((quote) => [quote.ticker, quote]));
  const requested = new Set(tickers);
  const applyQuote = (item) => {
    const symbol = quoteTickerSymbol(item.ticker);
    const quote = byTicker.get(symbol);
    return quote
      ? { ...item, ...quote, ticker: symbol, marketQuoteRequested: requested.has(symbol) }
      : { ...item, ticker: symbol, marketQuoteRequested: requested.has(symbol) };
  };

  return {
    config: sanitizeConfig({
      ...config,
      stockIdeas: (config.stockIdeas || []).map(applyQuote),
      congressTrades: (config.congressTrades || []).map(applyQuote),
    }),
    quotes,
    errors,
    requestedTickers: tickers,
    providerLimits: {
      broadScreenTarget: discovery.broadScreenTarget,
      providerRequestBudget: discovery.providerRequestBudget,
      providerConcurrencyLimit: discovery.providerConcurrencyLimit,
      batchSize: discovery.batchSize,
      retryCount: discovery.retryCount,
      maxScanDurationMs: discovery.maxScanDurationMs,
      requestedTickerCount: tickers.length,
      quoteResultCount: quotes.length,
    },
  };
}

function predictionCongressMetrics(ticker, trades) {
  const related = (trades || []).filter((trade) => trade.ticker === ticker);
  const buys = related.filter((trade) => trade.transaction === "Buy");
  const sells = related.filter((trade) => trade.transaction === "Sell");
  const latestDate = related.map((trade) => trade.disclosureDate || trade.reportedDate || trade.transactionDate).filter(Boolean).sort().reverse()[0] || null;
  const dataAgeDays = latestDate ? Math.max(0, Math.floor(ageMs(latestDate) / 86400000)) : null;
  const ageDecay = dataAgeDays === null ? 0.5 : dataAgeDays <= 14 ? 1 : dataAgeDays <= 45 ? 0.7 : dataAgeDays <= 120 ? 0.45 : 0.25;
  const visibility = related.reduce((sum, trade) => sum + (Number(trade.signalScore) || 0), 0) / Math.max(1, related.length);
  const bipartisan = new Set(related.map((trade) => trade.party).filter(Boolean)).size > 1 ? 12 : 0;
  const cluster = Math.min(22, buys.length * 8 + related.length * 3);
  const sellPenalty = Math.min(30, sells.length * 14);
  return {
    count: related.length,
    buys: buys.length,
    sells: sells.length,
    members: [...new Set(related.map((trade) => trade.representative).filter(Boolean))],
    score: clamp((visibility * 0.58 + cluster + bipartisan - sellPenalty) * ageDecay),
    latestDate,
    dataAgeDays,
    freshnessStatus: dataAgeDays === null ? "unavailable" : dataAgeDays <= 45 ? "fresh" : dataAgeDays <= 120 ? "stale" : "very stale",
    ageDecay,
    disclosureLagNotes: related
      .map((trade) => {
        const transactionDate = trade.transactionDate || trade.reportedDate;
        const disclosureDate = trade.disclosureDate || trade.reportedDate;
        const lag = Math.max(0, Math.floor((Date.parse(disclosureDate || "") - Date.parse(transactionDate || "")) / 86400000));
        return Number.isFinite(lag) && lag > 0 ? `Disclosure filed ${lag} days after the reported transaction.` : "";
      })
      .filter(Boolean)
      .slice(0, 3),
  };
}

function congressFeedPublicStatus(config = sanitizeConfig(readJson(CONFIG_FILE, {}))) {
  const savedTrades = config.congressTrades || [];
  const status = readJson(CONGRESS_FEED_STATUS_FILE, {});
  const latestDisclosureDate = savedTrades.map((trade) => trade.disclosureDate || trade.reportedDate).filter(Boolean).sort().reverse()[0] || null;
  const dataAgeDays = latestDisclosureDate ? Math.max(0, Math.floor(ageMs(latestDisclosureDate) / 86400000)) : null;
  let label = "Unavailable";
  if (status.error) label = "Failed";
  else if (CONGRESS_TRADES_FEED_URL && status.updatedAt) label = dataAgeDays !== null && dataAgeDays > 45 ? "Stale" : "Live";
  else if (savedTrades.length) label = dataAgeDays !== null && dataAgeDays > 120 ? "Stale" : "Saved Data Only";
  return {
    status: label,
    userMessage:
      label === "Saved Data Only"
        ? "Live congressional feed is not connected. Predictions are using saved congressional disclosures."
        : label === "Live"
          ? "Live congressional disclosure feed is connected."
          : label === "Stale"
            ? "Congressional disclosure data is stale. Predictions use it as a lower-confidence supporting signal."
            : label === "Failed"
              ? "Congressional feed refresh failed. Saved disclosures are still used when available."
              : "Congressional disclosure data is unavailable.",
    provider: CONGRESS_TRADES_FEED_URL ? "Configured feed" : "Saved disclosures",
    source: status.source || CONGRESS_TRADES_FEED_URL || "saved config",
    lastRefresh: status.updatedAt || null,
    latestDisclosureDate,
    recordsAvailable: savedTrades.length,
    liveFeedUrlConfigured: Boolean(CONGRESS_TRADES_FEED_URL),
    savedFallbackAvailable: savedTrades.length > 0,
    dataAgeDays,
    freshnessStatus: dataAgeDays === null ? "unavailable" : dataAgeDays <= 45 ? "fresh" : dataAgeDays <= 120 ? "stale" : "very stale",
    technicalSetupInstructions: "Set CONGRESS_TRADES_FEED_URL to a JSON or CSV congressional trading feed. Optional: set CONGRESS_TRADES_API_KEY.",
  };
}

function predictionPolicyMetrics(ticker, policySignals) {
  const related = (policySignals.signals || []).filter((signal) => signal.ticker === ticker);
  const positive = related.filter((signal) => signal.direction === "positive").length;
  const negative = related.filter((signal) => signal.direction === "negative").length;
  const score = related.reduce((sum, signal) => sum + (Number(signal.score) || 0), 0) / Math.max(1, related.length);
  return {
    count: related.length,
    positive,
    negative,
    score: clamp(score + positive * 8 - negative * 10),
    strongest: related.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))[0] || null,
  };
}

function assetGroup(stock) {
  const ticker = stock.ticker;
  if (["GLD", "SLV", "GDX", "SIL", "SILJ"].includes(ticker)) return "Gold/Silver";
  if (["BTC", "ETH", "MSTR", "COIN"].includes(ticker)) return "Crypto";
  if (/energy|oil|gas/i.test(`${stock.name} ${stock.pressNotes}`)) return "Energy";
  if (/health|medical|biotech|pharma/i.test(`${stock.name} ${stock.pressNotes}`)) return "Healthcare";
  if (/defense|aerospace|military/i.test(`${stock.name} ${stock.pressNotes} ${stock.committeeNotes}`)) return "Defense";
  if (/bank|financial|insurance/i.test(`${stock.name} ${stock.pressNotes}`)) return "Financials";
  if (/industrial|manufacturing/i.test(`${stock.name} ${stock.pressNotes}`)) return "Industrials";
  if (stock.type === "ETF") return "ETF";
  return "Technology";
}

function predictionLabel(score) {
  if (score >= 82) return "Strong AI Buy Candidate";
  if (score >= 68) return "Possible Trade";
  if (score >= 52) return "Watch Only";
  return "Avoid for Now";
}

function predictionStatus(score, previousScore) {
  if (!Number.isFinite(previousScore)) return "new";
  const delta = score - previousScore;
  if (delta >= 5) return "improved";
  if (delta <= -5) return "weakened";
  return "stayed the same";
}

function weightedScore(parts) {
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  if (!totalWeight) return 0;
  return clamp(parts.reduce((sum, part) => sum + clamp(part.score) * part.weight, 0) / totalWeight);
}

function modelLabel(score, timeframe) {
  if (score >= 82) return `Strong ${timeframe} Candidate`;
  if (score >= 68) return `Possible ${timeframe} Trade`;
  if (score >= 52) return `${timeframe} Watch Only`;
  return `Avoid ${timeframe}`;
}

function modelLevels(price, upside, downside) {
  return {
    entryZone: price ? `$${(price * 0.985).toFixed(2)} - $${(price * 1.006).toFixed(2)}` : "Need live price",
    profitTarget: price ? `$${(price * (1 + upside / 100)).toFixed(2)}` : "Need live price",
    stopLevel: price ? `$${(price * (1 - downside / 100)).toFixed(2)}` : "Need live price",
  };
}

function simpleMovingAverage(values, period) {
  const slice = values.slice(-period);
  if (!slice.length) return null;
  return slice.reduce((sum, value) => sum + value, 0) / slice.length;
}

function exponentialMovingAverage(values, period) {
  if (!values.length) return null;
  const multiplier = 2 / (period + 1);
  return values.reduce((ema, value, index) => (index === 0 ? value : value * multiplier + ema * (1 - multiplier)), values[0]);
}

function roundPrice(value) {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

function syntheticTechnicalSeries(price, marketChange, volatilityRisk, momentum, length = 30) {
  if (!price) return [];
  const drift = (marketChange / 100) * 0.42 + (momentum - 50) / 5000;
  const volatility = Math.max(0.002, volatilityRisk / 10000);
  const values = [];
  for (let index = length - 1; index >= 0; index -= 1) {
    const wave = Math.sin(index * 0.73) * volatility * price;
    const trendMove = price * drift * index;
    values.push(Math.max(0.01, price - trendMove + wave));
  }
  return values;
}

function buildTechnicalSnapshot({ stock, price, marketChange, momentum, volatilityRisk, liquidity, supportResistance, timeframe }) {
  const series = syntheticTechnicalSeries(price, marketChange, volatilityRisk, momentum, timeframe === "oneYear" ? 260 : timeframe === "thirtyDay" ? 90 : 30);
  const latest = price || series.at(-1) || null;
  const ema9 = exponentialMovingAverage(series, 9);
  const ema20 = exponentialMovingAverage(series, 20);
  const sma20 = simpleMovingAverage(series, 20);
  const volume = Number(stock.marketVolume) || null;
  const vwap = latest && volume ? latest * (1 + (marketChange / 100) * 0.18) : null;
  const rangePct = Math.max(0.006, volatilityRisk / 3800 + Math.abs(marketChange) / 1000);
  const openingRangeHigh = latest ? latest * (1 + rangePct * 0.62) : null;
  const openingRangeLow = latest ? latest * (1 - rangePct * 0.62) : null;
  const nearestSupport = latest ? Math.min(latest * 0.995, latest * (1 - rangePct * (1.15 + (100 - supportResistance) / 220))) : null;
  const nearestResistance = latest ? Math.max(latest * 1.005, latest * (1 + rangePct * (1.15 + supportResistance / 220))) : null;
  const priceVs9Ema = latest && ema9 ? ((latest - ema9) / ema9) * 100 : null;
  const priceVs20Ema = latest && ema20 ? ((latest - ema20) / ema20) * 100 : null;
  const ema9Vs20Ema = ema9 && ema20 ? ((ema9 - ema20) / ema20) * 100 : null;
  const priceVsVwap = latest && vwap ? ((latest - vwap) / vwap) * 100 : null;
  const trendDirection =
    priceVs9Ema !== null && priceVs20Ema !== null && ema9Vs20Ema !== null
      ? priceVs9Ema > 0 && priceVs20Ema > 0 && ema9Vs20Ema > 0
        ? "bullish"
        : priceVs9Ema < 0 && priceVs20Ema < 0 && ema9Vs20Ema < 0
        ? "bearish"
        : "mixed"
      : "unknown";
  const technicalSignalScore = Math.round(
    weightedScore([
      { score: priceVs9Ema === null ? 50 : clamp(50 + priceVs9Ema * 8), weight: 0.18 },
      { score: priceVs20Ema === null ? 50 : clamp(50 + priceVs20Ema * 7), weight: 0.18 },
      { score: ema9Vs20Ema === null ? 50 : clamp(50 + ema9Vs20Ema * 10), weight: 0.18 },
      { score: priceVsVwap === null ? 50 : clamp(50 + priceVsVwap * 8), weight: 0.12 },
      { score: supportResistance, weight: 0.16 },
      { score: liquidity, weight: 0.1 },
      { score: 100 - volatilityRisk, weight: 0.08 },
    ]),
  );

  return {
    currentPrice: roundPrice(latest),
    trendDirection,
    priceVs9Ema: priceVs9Ema === null ? null : Number(priceVs9Ema.toFixed(2)),
    priceVs20Ema: priceVs20Ema === null ? null : Number(priceVs20Ema.toFixed(2)),
    ema9Vs20Ema: ema9Vs20Ema === null ? null : Number(ema9Vs20Ema.toFixed(2)),
    priceVsVwap: priceVsVwap === null ? null : Number(priceVsVwap.toFixed(2)),
    ema9: roundPrice(ema9),
    ema20: roundPrice(ema20),
    sma20: roundPrice(sma20),
    vwap: roundPrice(vwap),
    nearestSupport: roundPrice(nearestSupport),
    nearestResistance: roundPrice(nearestResistance),
    openingRangeHigh: roundPrice(openingRangeHigh),
    openingRangeLow: roundPrice(openingRangeLow),
    technicalSignalScore,
    source: volume ? "quote-derived estimated levels with volume-aware VWAP" : "quote-derived estimated levels; VWAP unavailable without volume",
  };
}

function buildTechnicalAnalysis({ stock, price, marketChange, momentum, volatilityRisk, liquidity, supportResistance }) {
  return {
    oneDay: buildTechnicalSnapshot({ stock, price, marketChange, momentum, volatilityRisk, liquidity, supportResistance, timeframe: "oneDay" }),
    sevenDay: buildTechnicalSnapshot({ stock, price, marketChange, momentum: momentum * 0.8 + supportResistance * 0.2, volatilityRisk: volatilityRisk * 0.9, liquidity, supportResistance, timeframe: "sevenDay" }),
    thirtyDay: buildTechnicalSnapshot({ stock, price, marketChange: marketChange * 0.55, momentum: momentum * 0.55 + supportResistance * 0.45, volatilityRisk: volatilityRisk * 0.78, liquidity, supportResistance, timeframe: "thirtyDay" }),
    oneYear: buildTechnicalSnapshot({ stock, price, marketChange: marketChange * 0.24, momentum: momentum * 0.35 + supportResistance * 0.65, volatilityRisk: volatilityRisk * 0.62, liquidity, supportResistance, timeframe: "oneYear" }),
  };
}

function buildIntradayTechnicalAnalysis({ stock, price, marketChange, momentum, volatilityRisk, liquidity, supportResistance }) {
  return {
    twoMinute: buildTechnicalSnapshot({
      stock,
      price,
      marketChange: marketChange * 1.18,
      momentum: momentum * 1.08,
      volatilityRisk: volatilityRisk * 1.16,
      liquidity,
      supportResistance,
      timeframe: "twoMinute",
    }),
    fiveMinute: buildTechnicalSnapshot({
      stock,
      price,
      marketChange: marketChange,
      momentum: momentum,
      volatilityRisk: volatilityRisk,
      liquidity,
      supportResistance,
      timeframe: "fiveMinute",
    }),
    fifteenMinute: buildTechnicalSnapshot({
      stock,
      price,
      marketChange: marketChange * 0.82,
      momentum: momentum * 0.86 + supportResistance * 0.14,
      volatilityRisk: volatilityRisk * 0.88,
      liquidity,
      supportResistance,
      timeframe: "fifteenMinute",
    }),
  };
}

function intradayAlignmentDirection(snapshots) {
  const directions = snapshots.map((snapshot) => snapshot.trendDirection);
  const bullish = directions.filter((direction) => direction === "bullish").length;
  const bearish = directions.filter((direction) => direction === "bearish").length;
  if (bullish === snapshots.length) return "bullish";
  if (bearish === snapshots.length) return "bearish";
  if (bullish || bearish) return "mixed";
  return "neutral";
}

function buildMultiTimeframeAlignment(intraday) {
  const snapshots = [intraday.twoMinute, intraday.fiveMinute, intraday.fifteenMinute];
  const alignmentDirection = intradayAlignmentDirection(snapshots);
  const averageScore = weightedScore(snapshots.map((snapshot) => ({ score: snapshot.technicalSignalScore, weight: 1 })));
  const directionalAgreement =
    alignmentDirection === "bullish" || alignmentDirection === "bearish"
      ? 100
      : alignmentDirection === "mixed"
      ? 58
      : 42;
  const allTimeframesAligned = alignmentDirection === "bullish" || alignmentDirection === "bearish";
  const alignmentScore = Math.round(weightedScore([
    { score: averageScore, weight: 0.68 },
    { score: directionalAgreement, weight: 0.32 },
  ]));
  const reasonSummary = allTimeframesAligned
    ? `2m, 5m, and 15m charts are all ${alignmentDirection}; average technical score is ${Math.round(averageScore)}/100.`
    : alignmentDirection === "mixed"
    ? `2m, 5m, and 15m charts disagree; average technical score is ${Math.round(averageScore)}/100.`
    : `Intraday charts are neutral; average technical score is ${Math.round(averageScore)}/100.`;

  return {
    twoMinute: intraday.twoMinute,
    fiveMinute: intraday.fiveMinute,
    fifteenMinute: intraday.fifteenMinute,
    alignmentDirection,
    alignmentScore,
    allTimeframesAligned,
    reasonSummary,
  };
}

function setupConfirmation(score) {
  if (score >= 76) return "confirmed";
  if (score >= 52) return "forming";
  if (score > 0) return "failed";
  return "none";
}

function distancePercent(price, level) {
  if (!price || !level) return null;
  return Math.abs((price - level) / level) * 100;
}

function buildEmaBounceSignal({ fiveMinute, marketChange, momentum, unusualVolume, volume }) {
  const priceAboveVwap = fiveMinute.priceVsVwap === null ? null : fiveMinute.priceVsVwap > 0;
  const emaBullish = Number(fiveMinute.ema9Vs20Ema) > 0;
  const emaBearish = Number(fiveMinute.ema9Vs20Ema) < 0;
  const near9Ema = Math.abs(Number(fiveMinute.priceVs9Ema) || 0) <= 1.1;
  const holds9Bullish = Number(fiveMinute.priceVs9Ema) >= -0.25;
  const holds9Bearish = Number(fiveMinute.priceVs9Ema) <= 0.25;
  const closesAbovePriorHigh = marketChange > 0.15 && momentum >= 54;
  const closesBelowPriorLow = marketChange < -0.15 && momentum <= 48;
  const volumeIncreases = volume ? unusualVolume >= 55 : momentum >= 58 || unusualVolume >= 58;
  const bullishScore = weightedScore([
    { score: priceAboveVwap === true ? 100 : priceAboveVwap === null ? 45 : 15, weight: 0.18 },
    { score: emaBullish ? 100 : 20, weight: 0.18 },
    { score: near9Ema ? 100 : 35, weight: 0.16 },
    { score: holds9Bullish ? 100 : 20, weight: 0.16 },
    { score: closesAbovePriorHigh ? 100 : 35, weight: 0.16 },
    { score: volumeIncreases ? 100 : 38, weight: 0.16 },
  ]);
  const bearishScore = weightedScore([
    { score: priceAboveVwap === false ? 100 : priceAboveVwap === null ? 45 : 15, weight: 0.18 },
    { score: emaBearish ? 100 : 20, weight: 0.18 },
    { score: near9Ema ? 100 : 35, weight: 0.16 },
    { score: holds9Bearish ? 100 : 20, weight: 0.16 },
    { score: closesBelowPriorLow ? 100 : 35, weight: 0.16 },
    { score: volumeIncreases ? 100 : 38, weight: 0.16 },
  ]);
  const direction = bullishScore >= 58 || bearishScore >= 58 ? (bullishScore >= bearishScore ? "bullish" : "bearish") : "none";
  const score = Math.round(Math.max(bullishScore, bearishScore));

  return {
    detected: direction !== "none" && score >= 52,
    direction,
    score,
    confirmationStatus: setupConfirmation(score),
    conditions: {
      priceAboveVwap,
      emaBullish,
      emaBearish,
      near9Ema,
      holds9Ema: direction === "bearish" ? holds9Bearish : holds9Bullish,
      nextCandleBreaksPriorExtreme: direction === "bearish" ? closesBelowPriorLow : closesAbovePriorHigh,
      volumeIncreases,
    },
    reasonSummary:
      direction === "bullish"
        ? `Bullish 5-minute 9 EMA bounce ${setupConfirmation(score)}: price/VWAP ${priceAboveVwap === null ? "unavailable" : priceAboveVwap ? "supportive" : "not supportive"}, 9 EMA vs 20 EMA supportive, score ${Math.round(score)}/100.`
        : direction === "bearish"
        ? `Bearish 5-minute 9 EMA rejection ${setupConfirmation(score)}: price is below/near VWAP with weak EMA structure, score ${Math.round(score)}/100.`
        : `No clear 5-minute 9 EMA bounce yet; score ${Math.round(score)}/100.`,
  };
}

function buildBreakAndRetestSignal({ fiveMinute, marketChange, momentum }) {
  const price = Number(fiveMinute.currentPrice) || null;
  const supportDistance = distancePercent(price, Number(fiveMinute.nearestSupport));
  const resistanceDistance = distancePercent(price, Number(fiveMinute.nearestResistance));
  const brokeAboveResistance = marketChange > 0.35 && resistanceDistance !== null && resistanceDistance <= 1.4;
  const retestsResistance = resistanceDistance !== null && resistanceDistance <= 0.95;
  const holdsAsSupport = Number(fiveMinute.priceVs20Ema) >= -0.2 && Number(fiveMinute.priceVs9Ema) >= -0.35;
  const closesUpward = marketChange > 0.15 && momentum >= 55;
  const brokeBelowSupport = marketChange < -0.35 && supportDistance !== null && supportDistance <= 1.4;
  const retestsSupport = supportDistance !== null && supportDistance <= 0.95;
  const holdsAsResistance = Number(fiveMinute.priceVs20Ema) <= 0.2 && Number(fiveMinute.priceVs9Ema) <= 0.35;
  const closesDownward = marketChange < -0.15 && momentum <= 48;
  const bullishScore = weightedScore([
    { score: brokeAboveResistance ? 100 : 35, weight: 0.28 },
    { score: retestsResistance ? 100 : 40, weight: 0.22 },
    { score: holdsAsSupport ? 100 : 30, weight: 0.24 },
    { score: closesUpward ? 100 : 35, weight: 0.26 },
  ]);
  const bearishScore = weightedScore([
    { score: brokeBelowSupport ? 100 : 35, weight: 0.28 },
    { score: retestsSupport ? 100 : 40, weight: 0.22 },
    { score: holdsAsResistance ? 100 : 30, weight: 0.24 },
    { score: closesDownward ? 100 : 35, weight: 0.26 },
  ]);
  const direction = bullishScore >= 58 || bearishScore >= 58 ? (bullishScore >= bearishScore ? "bullish" : "bearish") : "none";
  const score = Math.round(Math.max(bullishScore, bearishScore));

  return {
    detected: direction !== "none" && score >= 52,
    direction,
    score,
    confirmationStatus: setupConfirmation(score),
    conditions: {
      brokeAboveResistance,
      retestsResistance,
      holdsResistanceAsSupport: holdsAsSupport,
      closesBackUpward: closesUpward,
      brokeBelowSupport,
      retestsSupport,
      holdsSupportAsResistance: holdsAsResistance,
      closesBackDownward: closesDownward,
    },
    reasonSummary:
      direction === "bullish"
        ? `Bullish break/retest ${setupConfirmation(score)} near resistance ${fiveMinute.nearestResistance || "n/a"}; score ${score}/100.`
        : direction === "bearish"
        ? `Bearish break/retest ${setupConfirmation(score)} near support ${fiveMinute.nearestSupport || "n/a"}; score ${score}/100.`
        : `No clear break/retest setup yet; score ${score}/100.`,
  };
}

function buildSetupSignals({ multiTimeframeAlignment, marketChange, momentum, unusualVolume, volume }) {
  const fiveMinute = multiTimeframeAlignment.fiveMinute;
  const emaBounce = buildEmaBounceSignal({ fiveMinute, marketChange, momentum, unusualVolume, volume });
  const breakAndRetest = buildBreakAndRetestSignal({ fiveMinute, marketChange, momentum });
  const bullishCount = [emaBounce, breakAndRetest].filter((signal) => signal.direction === "bullish" && signal.detected).length;
  const bearishCount = [emaBounce, breakAndRetest].filter((signal) => signal.direction === "bearish" && signal.detected).length;
  const setupDirection = bullishCount && bearishCount ? "mixed" : bullishCount ? "bullish" : bearishCount ? "bearish" : "none";
  const setupScore = Math.round(weightedScore([
    { score: emaBounce.score, weight: 0.52 },
    { score: breakAndRetest.score, weight: 0.48 },
  ]));
  const confirmationStatus =
    setupDirection === "none"
      ? "none"
      : emaBounce.confirmationStatus === "confirmed" || breakAndRetest.confirmationStatus === "confirmed"
      ? "confirmed"
      : emaBounce.confirmationStatus === "forming" || breakAndRetest.confirmationStatus === "forming"
      ? "forming"
      : "failed";

  return {
    emaBounce,
    breakAndRetest,
    setupDirection,
    setupScore,
    confirmationStatus,
    reasonSummary:
      setupDirection === "none"
        ? `No EMA bounce or break/retest setup is active. Combined setup score ${setupScore}/100.`
        : `${setupDirection} setup ${confirmationStatus}: ${emaBounce.reasonSummary} ${breakAndRetest.reasonSummary}`,
  };
}

function squeezeRiskLabel(score) {
  if (score >= 85) return "extreme";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function numericOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildShortSqueezeSignal({ stock, marketChange, momentum, unusualVolume, technicalAnalysis, multiTimeframeAlignment, setupSignals }) {
  const fiveMinute = multiTimeframeAlignment?.fiveMinute || {};
  const oneDay = technicalAnalysis?.oneDay || {};
  const shortInterest = numericOrNull(stock.shortInterest);
  const floatSize = numericOrNull(stock.floatSize);
  const relativeVolume = numericOrNull(stock.relativeVolume) || Number(Math.max(0.4, unusualVolume / 42).toFixed(2));
  const currentPrice = numericOrNull(fiveMinute.currentPrice) || numericOrNull(oneDay.currentPrice) || numericOrNull(stock.marketPrice);
  const vwapDistance = numericOrNull(fiveMinute.priceVsVwap);
  const resistance = numericOrNull(fiveMinute.nearestResistance) || numericOrNull(oneDay.nearestResistance);
  const support = numericOrNull(fiveMinute.nearestSupport) || numericOrNull(oneDay.nearestSupport);
  const priceReclaimingVWAP = vwapDistance !== null ? vwapDistance > 0.08 && marketChange > 0 : marketChange > 0.8;
  const breakingKeyResistance = currentPrice !== null && resistance !== null
    ? currentPrice >= resistance * 0.992 || marketChange > 1.3
    : marketChange > 1.3 && momentum >= 62;
  const failedBreakdowns = Boolean(
    setupSignals?.emaBounce?.direction === "bullish" &&
      setupSignals?.emaBounce?.confirmationStatus !== "failed" &&
      (support === null || currentPrice === null || currentPrice >= support * 1.003),
  );
  const highShortInterest = shortInterest === null ? null : shortInterest >= 15;
  const lowFloat = floatSize === null ? null : floatSize <= 50000000;
  const strongUpwardMove = marketChange > 1 || momentum >= 68;
  const relativeVolumeScore = clamp(relativeVolume * 34);
  const shortInterestScore = shortInterest === null ? 52 : clamp(shortInterest * 3.4);
  const floatScore = floatSize === null ? 52 : clamp(100 - Math.log10(Math.max(floatSize, 1000000)) * 9);
  const squeezeScore = Math.round(weightedScore([
    { score: relativeVolumeScore, weight: 0.22 },
    { score: strongUpwardMove ? clamp(62 + Math.max(0, marketChange) * 8 + momentum * 0.2) : clamp(momentum * 0.55), weight: 0.18 },
    { score: priceReclaimingVWAP ? 82 : 34, weight: 0.14 },
    { score: breakingKeyResistance ? 84 : 36, weight: 0.14 },
    { score: failedBreakdowns ? 76 : 38, weight: 0.1 },
    { score: shortInterestScore, weight: 0.12 },
    { score: floatScore, weight: 0.1 },
  ]));
  const positives = [
    relativeVolume >= 1.5 ? `relative volume ${relativeVolume.toFixed(2)}x` : "",
    strongUpwardMove ? "strong upward price move" : "",
    priceReclaimingVWAP ? "VWAP reclaim" : "",
    breakingKeyResistance ? "key resistance breakout" : "",
    failedBreakdowns ? "failed breakdowns holding support" : "",
    highShortInterest === true ? `short interest ${shortInterest}%` : "",
    lowFloat === true ? `low float ${Math.round(floatSize).toLocaleString("en-US")}` : "",
  ].filter(Boolean);
  const missing = [
    shortInterest === null ? "short interest unavailable" : "",
    floatSize === null ? "float unavailable" : "",
  ].filter(Boolean);

  return {
    squeezeRisk: squeezeRiskLabel(squeezeScore),
    squeezeScore,
    shortInterest,
    floatSize,
    relativeVolume,
    priceReclaimingVWAP,
    breakingKeyResistance,
    failedBreakdowns,
    reasonSummary: `${positives.length ? positives.join(", ") : "No major squeeze trigger is confirmed yet"}. ${missing.length ? `${missing.join("; ")}; scored from available signals.` : "Short-interest and float inputs were included."}`,
  };
}

function patternDirection(pattern) {
  return ["bear flag", "descending triangle", "double top", "wedge breakdown", "head and shoulders"].includes(pattern)
    ? "bearish"
    : "bullish";
}

function buildPatternLevel({ direction, price, support, resistance }) {
  if (price === null) return { invalidationLevel: null, targetLevel: null };
  const range = support !== null && resistance !== null ? Math.max(price * 0.015, Math.abs(resistance - support)) : price * 0.045;
  if (direction === "bullish") {
    return {
      invalidationLevel: support !== null ? roundPrice(support) : roundPrice(price * 0.965),
      targetLevel: resistance !== null && resistance > price ? roundPrice(resistance + range * 0.55) : roundPrice(price + range),
    };
  }
  if (direction === "bearish") {
    return {
      invalidationLevel: resistance !== null ? roundPrice(resistance) : roundPrice(price * 1.035),
      targetLevel: support !== null && support < price ? roundPrice(support - range * 0.55) : roundPrice(price - range),
    };
  }
  return { invalidationLevel: null, targetLevel: null };
}

function buildChartPatternSignal({ stock, marketChange, momentum, technicalAnalysis, multiTimeframeAlignment, setupSignals }) {
  const oneDay = technicalAnalysis?.oneDay || {};
  const fiveMinute = multiTimeframeAlignment?.fiveMinute || {};
  const price = numericOrNull(fiveMinute.currentPrice) || numericOrNull(oneDay.currentPrice) || numericOrNull(stock.marketPrice);
  const support = numericOrNull(fiveMinute.nearestSupport) || numericOrNull(oneDay.nearestSupport);
  const resistance = numericOrNull(fiveMinute.nearestResistance) || numericOrNull(oneDay.nearestResistance);
  const priceVs9 = numericOrNull(fiveMinute.priceVs9Ema) ?? numericOrNull(oneDay.priceVs9Ema) ?? 0;
  const priceVs20 = numericOrNull(fiveMinute.priceVs20Ema) ?? numericOrNull(oneDay.priceVs20Ema) ?? 0;
  const emaSpread = numericOrNull(fiveMinute.ema9Vs20Ema) ?? numericOrNull(oneDay.ema9Vs20Ema) ?? 0;
  const vwapDistance = numericOrNull(fiveMinute.priceVsVwap) ?? numericOrNull(oneDay.priceVsVwap) ?? 0;
  const technicalScore = Number(oneDay.technicalSignalScore) || 0;
  const alignment = multiTimeframeAlignment?.alignmentDirection || "neutral";
  const rangePercent = price !== null && support !== null && resistance !== null ? ((resistance - support) / price) * 100 : 5;
  const nearResistance = price !== null && resistance !== null ? Math.abs((resistance - price) / price) * 100 <= 2.4 : false;
  const nearSupport = price !== null && support !== null ? Math.abs((price - support) / price) * 100 <= 2.4 : false;
  const bullishStructure = priceVs9 > -0.4 && priceVs20 > -0.8 && emaSpread >= -0.2 && vwapDistance >= -0.25;
  const bearishStructure = priceVs9 < 0.4 && priceVs20 < 0.8 && emaSpread <= 0.2 && vwapDistance <= 0.25;
  const breakoutConfirmed = setupSignals?.breakAndRetest?.direction === "bullish" && setupSignals?.breakAndRetest?.detected;
  const breakdownConfirmed = setupSignals?.breakAndRetest?.direction === "bearish" && setupSignals?.breakAndRetest?.detected;
  const compactRangeScore = clamp(100 - Math.max(0, rangePercent - 2) * 7);

  const candidates = [
    {
      name: "bull flag",
      score: weightedScore([
        { score: momentum, weight: 0.28 },
        { score: marketChange > 0 ? clamp(58 + marketChange * 7) : 28, weight: 0.18 },
        { score: bullishStructure ? 78 : 34, weight: 0.22 },
        { score: compactRangeScore, weight: 0.16 },
        { score: alignment === "bullish" ? 82 : 48, weight: 0.16 },
      ]),
    },
    {
      name: "bear flag",
      score: weightedScore([
        { score: 100 - momentum, weight: 0.28 },
        { score: marketChange < 0 ? clamp(58 + Math.abs(marketChange) * 7) : 28, weight: 0.18 },
        { score: bearishStructure ? 78 : 34, weight: 0.22 },
        { score: compactRangeScore, weight: 0.16 },
        { score: alignment === "bearish" ? 82 : 48, weight: 0.16 },
      ]),
    },
    {
      name: "ascending triangle",
      score: weightedScore([
        { score: nearResistance ? 82 : 42, weight: 0.26 },
        { score: bullishStructure ? 76 : 36, weight: 0.24 },
        { score: compactRangeScore, weight: 0.18 },
        { score: technicalScore, weight: 0.18 },
        { score: breakoutConfirmed ? 88 : 48, weight: 0.14 },
      ]),
    },
    {
      name: "descending triangle",
      score: weightedScore([
        { score: nearSupport ? 82 : 42, weight: 0.26 },
        { score: bearishStructure ? 76 : 36, weight: 0.24 },
        { score: compactRangeScore, weight: 0.18 },
        { score: 100 - technicalScore, weight: 0.18 },
        { score: breakdownConfirmed ? 88 : 48, weight: 0.14 },
      ]),
    },
    {
      name: "double top",
      score: weightedScore([
        { score: nearResistance ? 84 : 34, weight: 0.3 },
        { score: momentum < 58 ? 72 : 40, weight: 0.22 },
        { score: marketChange <= 0 ? 76 : 42, weight: 0.18 },
        { score: priceVs9 < 0 ? 76 : 38, weight: 0.16 },
        { score: alignment === "bearish" ? 80 : 44, weight: 0.14 },
      ]),
    },
    {
      name: "double bottom",
      score: weightedScore([
        { score: nearSupport ? 84 : 34, weight: 0.3 },
        { score: momentum > 42 ? 68 : 38, weight: 0.22 },
        { score: marketChange >= 0 ? 76 : 42, weight: 0.18 },
        { score: vwapDistance > 0 ? 76 : 38, weight: 0.16 },
        { score: alignment === "bullish" ? 80 : 44, weight: 0.14 },
      ]),
    },
    {
      name: "wedge breakout",
      score: weightedScore([
        { score: breakoutConfirmed || nearResistance ? 82 : 42, weight: 0.24 },
        { score: bullishStructure ? 78 : 38, weight: 0.22 },
        { score: compactRangeScore, weight: 0.18 },
        { score: momentum, weight: 0.2 },
        { score: vwapDistance > 0 ? 78 : 40, weight: 0.16 },
      ]),
    },
    {
      name: "wedge breakdown",
      score: weightedScore([
        { score: breakdownConfirmed || nearSupport ? 82 : 42, weight: 0.24 },
        { score: bearishStructure ? 78 : 38, weight: 0.22 },
        { score: compactRangeScore, weight: 0.18 },
        { score: 100 - momentum, weight: 0.2 },
        { score: vwapDistance < 0 ? 78 : 40, weight: 0.16 },
      ]),
    },
    {
      name: "head and shoulders",
      score: weightedScore([
        { score: nearResistance ? 74 : 36, weight: 0.22 },
        { score: priceVs20 < 0 ? 82 : 34, weight: 0.24 },
        { score: emaSpread < 0 ? 78 : 38, weight: 0.2 },
        { score: marketChange < 0 ? 76 : 42, weight: 0.18 },
        { score: alignment === "bearish" ? 78 : 44, weight: 0.16 },
      ]),
    },
    {
      name: "inverse head and shoulders",
      score: weightedScore([
        { score: nearSupport ? 74 : 36, weight: 0.22 },
        { score: priceVs20 > 0 ? 82 : 34, weight: 0.24 },
        { score: emaSpread > 0 ? 78 : 38, weight: 0.2 },
        { score: marketChange > 0 ? 76 : 42, weight: 0.18 },
        { score: alignment === "bullish" ? 78 : 44, weight: 0.16 },
      ]),
    },
  ].map((pattern) => ({
    name: pattern.name,
    direction: patternDirection(pattern.name),
    score: Math.round(clamp(pattern.score)),
  }));

  const detectedPatterns = candidates
    .filter((pattern) => pattern.score >= 55)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const primary = detectedPatterns[0] || candidates.sort((a, b) => b.score - a.score)[0] || null;
  const primaryPattern = primary && primary.score >= 45 ? primary.name : "none";
  const bullishCount = detectedPatterns.filter((pattern) => pattern.direction === "bullish").length;
  const bearishCount = detectedPatterns.filter((pattern) => pattern.direction === "bearish").length;
  const patternDirectionValue =
    primaryPattern === "none"
      ? "none"
      : bullishCount && bearishCount
      ? "mixed"
      : primary?.direction || "none";
  const patternScore = primaryPattern === "none" ? 0 : primary.score;
  const levels = buildPatternLevel({ direction: patternDirectionValue === "mixed" ? primary.direction : patternDirectionValue, price, support, resistance });

  return {
    detectedPatterns,
    primaryPattern,
    patternDirection: patternDirectionValue,
    patternScore,
    invalidationLevel: levels.invalidationLevel,
    targetLevel: levels.targetLevel,
    reasonSummary:
      primaryPattern === "none"
        ? "No high-quality chart pattern is confirmed from the current technical snapshot."
        : `${primaryPattern} is the strongest chart pattern at ${patternScore}/100 using EMA/VWAP position, support/resistance, range compression, and trend alignment.`,
  };
}

function normalizeSignalDirection(direction) {
  if (["bullish", "bearish", "mixed", "neutral"].includes(direction)) return direction;
  if (direction === "none" || !direction) return "neutral";
  return "neutral";
}

function confidenceTier(unifiedScore, confidence, conflicts) {
  const adjusted = clamp(unifiedScore * 0.55 + confidence * 0.45 - conflicts * 5);
  if (adjusted >= 82) return "very high";
  if (adjusted >= 68) return "high";
  if (adjusted >= 50) return "medium";
  return "low";
}

function lowerConfidenceTier(tier) {
  const order = ["low", "medium", "high", "very high"];
  const index = order.indexOf(tier);
  return index <= 0 ? "low" : order[index - 1];
}

function capConfidenceTier(tier, cap) {
  const order = ["low", "medium", "high", "very high"];
  return order[Math.min(order.indexOf(tier), order.indexOf(cap))] || "low";
}

function buildUnifiedPredictionLayer({ baseScore, confidence, technicalAnalysis, multiTimeframeAlignment, setupSignals, shortSqueezeSignal, chartPatternSignal, dataQuality }) {
  const technical = technicalAnalysis?.oneDay || {};
  const technicalScore = Number(technical.technicalSignalScore) || 0;
  const alignmentScore = Number(multiTimeframeAlignment?.alignmentScore) || 0;
  const setupScore = Number(setupSignals?.setupScore) || 0;
  const squeezeScore = Number(shortSqueezeSignal?.squeezeScore) || 0;
  const patternScore = Number(chartPatternSignal?.patternScore) || 0;
  const layers = [
    {
      name: "Base prediction",
      score: baseScore,
      weight: 0.3,
      direction: baseScore >= 62 ? "bullish" : baseScore <= 38 ? "bearish" : "neutral",
      reason: `Base AI score ${Math.round(baseScore)}/100`,
    },
    {
      name: "Technical analysis",
      score: technicalScore,
      weight: 0.2,
      direction: normalizeSignalDirection(technical.trendDirection),
      reason: `Technical score ${Math.round(technicalScore)}/100 with ${technical.trendDirection || "unknown"} trend`,
    },
    {
      name: "Multi-timeframe alignment",
      score: alignmentScore,
      weight: 0.2,
      direction: normalizeSignalDirection(multiTimeframeAlignment?.alignmentDirection),
      reason: `2m/5m/15m alignment ${multiTimeframeAlignment?.alignmentDirection || "unknown"} at ${Math.round(alignmentScore)}/100`,
    },
    {
      name: "Setup signals",
      score: setupScore,
      weight: 0.15,
      direction: normalizeSignalDirection(setupSignals?.setupDirection),
      reason: `Setup ${setupSignals?.setupDirection || "none"} ${setupSignals?.confirmationStatus || "none"} at ${Math.round(setupScore)}/100`,
    },
    {
      name: "Chart pattern",
      score: patternScore,
      weight: 0.1,
      direction: normalizeSignalDirection(chartPatternSignal?.patternDirection),
      reason: `${chartPatternSignal?.primaryPattern || "No pattern"} pattern at ${Math.round(patternScore)}/100`,
    },
    {
      name: "Short squeeze",
      score: squeezeScore,
      weight: 0.05,
      direction: squeezeScore >= 55 ? "bullish" : "neutral",
      reason: `Short squeeze risk ${shortSqueezeSignal?.squeezeRisk || "low"} at ${Math.round(squeezeScore)}/100`,
    },
  ];
  const unifiedPredictionScore = Math.round(weightedScore(layers.map((layer) => ({ score: layer.score, weight: layer.weight }))));
  const bullishWeight = layers.reduce((sum, layer) => sum + (layer.direction === "bullish" ? layer.weight : 0), 0);
  const bearishWeight = layers.reduce((sum, layer) => sum + (layer.direction === "bearish" ? layer.weight : 0), 0);
  const mixedWeight = layers.reduce((sum, layer) => sum + (layer.direction === "mixed" ? layer.weight : 0), 0);
  const unifiedDirection =
    mixedWeight >= 0.18 || (bullishWeight >= 0.25 && bearishWeight >= 0.2)
      ? "mixed"
      : bullishWeight > bearishWeight && bullishWeight >= 0.3
      ? "bullish"
      : bearishWeight > bullishWeight && bearishWeight >= 0.25
      ? "bearish"
      : "neutral";
  const strongestSignals = [...layers]
    .sort((a, b) => b.score * b.weight - a.score * a.weight)
    .slice(0, 4)
    .map((layer) => layer.reason);
  const conflictingSignals = layers
    .filter((layer) => {
      if (unifiedDirection === "mixed") return layer.direction === "bullish" || layer.direction === "bearish";
      if (unifiedDirection === "bullish") return layer.direction === "bearish";
      if (unifiedDirection === "bearish") return layer.direction === "bullish";
      return layer.direction === "mixed";
    })
    .map((layer) => layer.reason);
  let tier = confidenceTier(unifiedPredictionScore, confidence, conflictingSignals.length);
  const guardrailNotes = [];
  if (unifiedDirection === "mixed") {
    tier = capConfidenceTier(tier, "medium");
    guardrailNotes.push("Mixed unified direction caps confidence at medium.");
  }
  if (conflictingSignals.length > 2) {
    tier = capConfidenceTier(tier, "high");
    guardrailNotes.push("More than two conflicting signals prevents very high confidence.");
  }
  if (["partial", "stale", "failed"].includes(dataQuality?.dataQualityStatus)) {
    tier = lowerConfidenceTier(tier);
    guardrailNotes.push(`Data quality is ${dataQuality.dataQualityStatus}, so confidence was lowered one tier.`);
  }

  return {
    unifiedPredictionScore,
    unifiedDirection,
    confidenceTier: tier,
    strongestSignals,
    conflictingSignals,
    finalReasonSummary: `${unifiedDirection} unified read at ${unifiedPredictionScore}/100. Strongest support: ${strongestSignals.slice(0, 2).join("; ")}.${conflictingSignals.length ? ` Conflicts: ${conflictingSignals.slice(0, 2).join("; ")}.` : " No major conflicting layer detected."}${guardrailNotes.length ? ` Guardrails: ${guardrailNotes.join(" ")}` : ""}`,
  };
}

function buildTimeframeModel({ name, score, confidence, risk, upside, downside, price, reasons, failureRisks, metrics }) {
  const levels = modelLevels(price, upside, downside);
  return {
    name,
    score: Math.round(clamp(score)),
    label: modelLabel(score, name),
    confidenceScore: Math.round(clamp(confidence)),
    riskScore: Math.round(clamp(risk)),
    expectedUpside: Number(Math.max(0.1, upside).toFixed(2)),
    downsideRisk: Number(Math.max(0.1, downside).toFixed(2)),
    riskRewardRatio: Number((Math.max(0.1, upside) / Math.max(0.1, downside)).toFixed(2)),
    entryZone: levels.entryZone,
    profitTarget: levels.profitTarget,
    stopLevel: levels.stopLevel,
    suggestedEntryZone: levels.entryZone,
    suggestedProfitTarget: levels.profitTarget,
    suggestedStopLevel: levels.stopLevel,
    reasons: reasons.filter(Boolean).slice(0, 5),
    failureRisks: failureRisks.filter(Boolean).slice(0, 5),
    metrics,
  };
}

function signalAlignment(dailyScore, weeklyScore, monthlyScore) {
  const dailyBullish = dailyScore >= 70;
  const weeklyBullish = weeklyScore >= 70;
  const monthlyBullish = monthlyScore >= 70;
  const dailyWeak = dailyScore < 55;
  const weeklyWeak = weeklyScore < 55;
  const monthlyWeak = monthlyScore < 55;

  if (dailyBullish && weeklyBullish && monthlyBullish) {
    return {
      label: "High-Alignment Opportunity",
      type: "high-alignment",
      action: "All three timeframes are bullish. This is the cleanest multi-timeframe setup.",
    };
  }

  if (dailyBullish && monthlyWeak) {
    return {
      label: "Short-Term Only",
      type: "short-term-only",
      action: "Daily signal is bullish, but the monthly model is weak. Treat this as a fast trade, not a hold.",
    };
  }

  if (monthlyBullish && dailyWeak) {
    return {
      label: "Wait for Better Entry",
      type: "wait-for-entry",
      action: "Monthly signal is bullish, but today is weak. Watch for a better entry instead of chasing.",
    };
  }

  if (dailyWeak && weeklyWeak && monthlyWeak) {
    return {
      label: "Avoid",
      type: "avoid",
      action: "Daily, weekly, and monthly models are all weak. The setup does not have enough support.",
    };
  }

  if (weeklyBullish && (dailyBullish || monthlyBullish)) {
    return {
      label: "Partial Alignment",
      type: "partial-alignment",
      action: "Two timeframes are supportive. Size and timing matter more than with a full-alignment setup.",
    };
  }

  return {
    label: "Mixed Signals",
    type: "mixed",
    action: "The timeframes disagree. Use the strongest model, but keep risk tighter.",
  };
}

function researchSubModel(name, bullish, bearish, confidence, reason, dataQuality) {
  return {
    name,
    bullishScore: Math.round(clamp(bullish)),
    bearishScore: Math.round(clamp(bearish)),
    confidenceScore: Math.round(clamp(confidence)),
    dataQualityScore: Math.round(clamp(dataQuality)),
    reason,
  };
}

function dataQualityBreakdown({ price, stock, policy, congress, liquidity, volatilityRisk, marketChange }) {
  const sourceReliability = price ? 78 : 44;
  const marketUpdatedAt = stock.marketUpdatedAt ? Date.parse(stock.marketUpdatedAt) : NaN;
  const marketAgeHours = Number.isFinite(marketUpdatedAt) ? (Date.now() - marketUpdatedAt) / 3600000 : null;
  const staleMarketData = marketAgeHours !== null && marketAgeHours > 24;
  const freshness = staleMarketData ? 42 : stock.marketUpdatedAt ? 82 : price ? 64 : 38;
  const duplicateNewsRisk = policy.count > 3 ? 56 : 82;
  const socialMediaNoise = 72;
  const delayedReporting = congress.count ? 48 : 76;
  const lowVolumeRisk = clamp(100 - liquidity);
  const abnormalSpreadRisk = clamp(volatilityRisk * 0.72 + Math.abs(marketChange) * 4);
  const missingData = clamp((price ? 0 : 28) + (stock.marketChangePercent ? 0 : 14) + (stock.pressNotes ? 0 : 10));
  const score = weightedScore([
    { score: sourceReliability, weight: 0.18 },
    { score: freshness, weight: 0.18 },
    { score: duplicateNewsRisk, weight: 0.1 },
    { score: socialMediaNoise, weight: 0.08 },
    { score: delayedReporting, weight: 0.1 },
    { score: 100 - lowVolumeRisk, weight: 0.12 },
    { score: 100 - abnormalSpreadRisk, weight: 0.12 },
    { score: 100 - missingData, weight: 0.12 },
  ]);
  const dataQualityNotes = [
    price ? "" : stock.marketQuoteRequested === false ? "Market quote was not requested for this ticker." : "Current market price is missing after quote refresh.",
    stock.marketUpdatedAt ? "" : "Market update timestamp is missing.",
    staleMarketData ? `Market data is ${Math.round(marketAgeHours)} hours old.` : "",
    stock.marketChangePercent ? "" : "Market change percentage is missing.",
    Number(stock.marketVolume) ? "" : "Volume data is missing or unavailable.",
    stock.marketQuoteError ? `Quote provider response: ${stock.marketQuoteError}` : "",
    policy.count ? "" : "No fresh policy/news signal matched this ticker.",
  ].filter(Boolean);
  const dataQualityStatus = !price
    ? "failed"
    : staleMarketData
    ? "stale"
    : missingData >= 24 || score < 62
    ? "partial"
    : "good";

  return {
    score: Math.round(score),
    dataQualityStatus,
    dataQualityNotes,
    sourceReliability: Math.round(sourceReliability),
    freshness: Math.round(freshness),
    duplicateNewsRisk: Math.round(duplicateNewsRisk),
    socialMediaNoise: Math.round(socialMediaNoise),
    delayedReporting: Math.round(delayedReporting),
    lowVolumeRisk: Math.round(lowVolumeRisk),
    abnormalSpreadRisk: Math.round(abnormalSpreadRisk),
    missingData: Math.round(missingData),
  };
}

function marketRegimeForStock({ stock, marketChange, momentum, trend, volatilityRisk, macro, sectorStrength }) {
  const regimes = [];
  if (trend >= 65 && momentum >= 60) regimes.push("bull market");
  if (trend <= 42 && momentum <= 45) regimes.push("bear market");
  if (trend > 42 && trend < 62 && Math.abs(marketChange) < 1.4) regimes.push("sideways market");
  regimes.push(volatilityRisk >= 55 ? "high volatility" : "low volatility");
  regimes.push(macro >= 62 ? "risk-on market" : "risk-off market");
  if (assetGroup(stock) === "Gold/Silver") regimes.push("inflation-sensitive market");
  if (sectorStrength >= 65) regimes.push("strong sector tape");
  if (marketChange >= 1) regimes.push("falling rate environment");
  if (marketChange <= -1) regimes.push("rising rate environment");
  regimes.push(marketChange >= 0 ? "weak dollar environment" : "strong dollar environment");

  return {
    primary: regimes[0] || "sideways market",
    regimes: [...new Set(regimes)].slice(0, 7),
    weightAdjustment:
      volatilityRisk >= 55
        ? "Higher volatility: daily scores demand stronger liquidity and tighter downside controls."
        : macro >= 62
        ? "Risk-on tape: momentum, breakout, and sector rotation receive more credit."
        : "Risk-off or mixed tape: valuation, liquidity, and data quality receive more credit.",
  };
}

function similarSetupAnalysis(stock, previousPredictions, currentScores) {
  const matches = (previousPredictions || []).filter((item) => {
    if (!item || item.ticker === stock.ticker) return false;
    const sameGroup = item.assetGroup === assetGroup(stock);
    const sameAlignment = item.signalAlignment?.type === currentScores.alignmentType;
    const closeScore = Math.abs((Number(item.aiOpportunityScore) || 0) - currentScores.overall) <= 12;
    const closeTimeframe =
      Math.abs((Number(item.oneDayScore || item.dailyScore) || 0) - currentScores.oneDay) <= 15 ||
      Math.abs((Number(item.sevenDayScore || item.weeklyScore) || 0) - currentScores.sevenDay) <= 15 ||
      Math.abs((Number(item.thirtyDayScore || item.monthlyScore) || 0) - currentScores.thirtyDay) <= 15;
    return sameGroup && (sameAlignment || closeScore || closeTimeframe);
  });
  const count = matches.length;

  if (!count) {
    return {
      similarPastSetups: 0,
      averageReturnAfter1Day: null,
      averageReturnAfter3Days: null,
      averageReturnAfter7Days: null,
      averageReturnAfter30Days: null,
      winRate: null,
      averageDrawdown: null,
      bestCase: null,
      worstCase: null,
      confidenceLevel: "Low - not enough saved historical setups yet",
      note: "The app will build this history as scans and outcomes accumulate.",
    };
  }

  const impliedReturns = matches.map((item) => Number(item.forecasts?.sevenDay?.expectedUpside) || Number(item.expectedUpside) || 0);
  const avg = impliedReturns.reduce((sum, value) => sum + value, 0) / count;
  const wins = matches.filter((item) => Number(item.aiOpportunityScore) >= 68).length;
  const drawdowns = matches.map((item) => Number(item.forecasts?.sevenDay?.downsideRisk) || Number(item.downsideRisk) || 0);
  const avgDrawdown = drawdowns.reduce((sum, value) => sum + value, 0) / Math.max(1, drawdowns.length);

  return {
    similarPastSetups: count,
    averageReturnAfter1Day: Number((avg * 0.2).toFixed(2)),
    averageReturnAfter3Days: Number((avg * 0.52).toFixed(2)),
    averageReturnAfter7Days: Number(avg.toFixed(2)),
    averageReturnAfter30Days: Number((avg * 1.7).toFixed(2)),
    winRate: Number(((wins / count) * 100).toFixed(1)),
    averageDrawdown: Number(avgDrawdown.toFixed(2)),
    bestCase: Number(Math.max(...impliedReturns).toFixed(2)),
    worstCase: Number(Math.min(...impliedReturns).toFixed(2)),
    confidenceLevel: count >= 20 ? "High" : count >= 8 ? "Medium" : "Low - limited sample",
    note: "Early-stage similar setup analysis uses saved scan history until full outcome tracking matures.",
  };
}

function portfolioImpact(stock, config, scores) {
  const holdings = readJson(PORTFOLIO_FILE, { positions: [] }).positions || [];
  const sameTicker = holdings.filter((position) => String(position.ticker).toUpperCase() === stock.ticker);
  const sameSector = holdings.filter((position) => assetGroup({ ticker: position.ticker, name: position.name || position.ticker, pressNotes: "" }) === assetGroup(stock));
  const invested = holdings.reduce((sum, position) => sum + (Number(position.amountInvested) || 0), 0);
  const overlapValue = sameTicker.reduce((sum, position) => sum + (Number(position.amountInvested) || 0), 0);
  const betterLowerRisk = (config.stockIdeas || []).some((candidate) => {
    if (candidate.ticker === stock.ticker) return false;
    const candidateRisk = 100 - (Number(candidate.volatilityScore) || 0);
    const candidateQuality = (Number(candidate.qualityScore) || 0) + (Number(candidate.momentumScore) || 0);
    const currentRisk = 100 - (Number(stock.volatilityScore) || 0);
    const currentQuality = (Number(stock.qualityScore) || 0) + (Number(stock.momentumScore) || 0);
    return candidateRisk < currentRisk && candidateQuality >= currentQuality + 8;
  });

  return {
    positionOverlap: sameTicker.length ? `${sameTicker.length} existing position(s), about $${Math.round(overlapValue)} already invested` : "No same-ticker overlap found",
    sectorConcentration: sameSector.length ? `${sameSector.length} holding(s) overlap this asset group` : "No obvious sector concentration from saved portfolio",
    cashImpact: "App does not have brokerage cash connected yet; size manually before trading.",
    volatilityImpact: scores.riskScore >= 65 ? "Would raise portfolio volatility." : "Volatility impact appears manageable from available signals.",
    betterLowerRiskOpportunityExists: betterLowerRisk,
    bestForTimeframe: scores.bestTimeframe,
  };
}

function buildPrediction(stock, config, policySignals, previousByTicker) {
  const ticker = stock.ticker;
  const congress = predictionCongressMetrics(ticker, config.congressTrades || []);
  const policy = predictionPolicyMetrics(ticker, policySignals);
  const marketChange = numberPercent(stock.marketChangePercent);
  const price = Number(stock.marketPrice) || null;
  const momentum = clamp((Number(stock.momentumScore) || 0) + marketChange * 1.4);
  const trend = clamp((Number(stock.qualityScore) || 0) * 0.45 + momentum * 0.55);
  const breakout = clamp(momentum * 0.58 + (Number(stock.pressScore) || 0) * 0.26 + policy.score * 0.16);
  const newsImpact = clamp((Number(stock.pressScore) || 0) * 0.55 + policy.score * 0.45);
  const sentiment = clamp((Number(stock.pressScore) || 0) * 0.42 + momentum * 0.4 + policy.positive * 8 - policy.negative * 10);
  const macro = clamp(assetGroup(stock) === "Gold/Silver" ? 70 + Math.max(0, marketChange) * 2 : (Number(stock.committeeScore) || 0) * 0.52 + policy.score * 0.48);
  const sectorStrength = clamp((Number(stock.committeeScore) || 0) * 0.34 + newsImpact * 0.34 + momentum * 0.32);
  const relativeStrength = clamp(momentum * 0.7 + (Number(stock.qualityScore) || 0) * 0.3);
  const institutionalFlow = clamp(congress.score * 0.12 + (Number(stock.qualityScore) || 0) * 0.48 + (Number(stock.pressScore) || 0) * 0.4);
  const volatilityRisk = clamp(100 - (Number(stock.volatilityScore) || 0));
  const liquidity = stock.type === "ETF" ? 84 : clamp((Number(stock.qualityScore) || 0) * 0.48 + (Number(stock.momentumScore) || 0) * 0.52);
  const congressionalActivity = congress.score;
  const unusualVolume = clamp(momentum * 0.42 + Math.abs(marketChange) * 8 + volatilityRisk * 0.18);
  const gapSignal = clamp(Math.abs(marketChange) * 13 + momentum * 0.35);
  const premarketProxy = clamp(marketChange > 0 ? momentum + marketChange * 5 : momentum * 0.55);
  const intradayTrend = clamp(momentum * 0.62 + trend * 0.38);
  const supportResistance = clamp((Number(stock.valuationScore) || 0) * 0.35 + trend * 0.35 + liquidity * 0.3);
  const technicalAnalysis = buildTechnicalAnalysis({ stock, price, marketChange, momentum, volatilityRisk, liquidity, supportResistance });
  const multiTimeframeAlignment = buildMultiTimeframeAlignment(
    buildIntradayTechnicalAnalysis({ stock, price, marketChange, momentum, volatilityRisk, liquidity, supportResistance }),
  );
  const setupSignals = buildSetupSignals({
    multiTimeframeAlignment,
    marketChange,
    momentum,
    unusualVolume,
    volume: Number(stock.marketVolume) || null,
  });
  const shortSqueezeSignal = buildShortSqueezeSignal({
    stock,
    marketChange,
    momentum,
    unusualVolume,
    technicalAnalysis,
    multiTimeframeAlignment,
    setupSignals,
  });
  const chartPatternSignal = buildChartPatternSignal({
    stock,
    marketChange,
    momentum,
    technicalAnalysis,
    multiTimeframeAlignment,
    setupSignals,
  });
  const earningsComing = clamp((Number(stock.pressScore) || 0) * 0.55 + volatilityRisk * 0.25 + momentum * 0.2);
  const analystUpgradeProxy = clamp(newsImpact * 0.62 + sentiment * 0.38);
  const sectorRotation = clamp(sectorStrength * 0.72 + macro * 0.28);
  const fiveDayTrend = clamp(momentum * 0.6 + trend * 0.4);
  const optionsActivityProxy = clamp(volatilityRisk * 0.36 + momentum * 0.4 + newsImpact * 0.24);
  const technicalBreakout = clamp(breakout * 0.76 + supportResistance * 0.24);
  const revenueGrowthProxy = clamp((Number(stock.qualityScore) || 0) * 0.42 + (Number(stock.pressScore) || 0) * 0.34 + trend * 0.24);
  const earningsGrowthProxy = clamp((Number(stock.qualityScore) || 0) * 0.5 + trend * 0.28 + newsImpact * 0.22);
  const valuation = clamp(Number(stock.valuationScore) || 0);
  const insiderBuyingProxy = clamp(congressionalActivity * 0.18 + institutionalFlow * 0.82);
  const thirtyNinetyMomentum = clamp(momentum * 0.45 + relativeStrength * 0.4 + trend * 0.15);
  const companyGuidance = clamp(newsImpact * 0.55 + (Number(stock.qualityScore) || 0) * 0.45);
  const profitMargins = clamp((Number(stock.qualityScore) || 0) * 0.64 + valuation * 0.18 + liquidity * 0.18);
  const debtLevels = clamp((Number(stock.volatilityScore) || 0) * 0.46 + (Number(stock.qualityScore) || 0) * 0.34 + valuation * 0.2);
  const freeCashFlow = clamp((Number(stock.qualityScore) || 0) * 0.56 + valuation * 0.24 + trend * 0.2);
  const marketPosition = clamp((Number(stock.qualityScore) || 0) * 0.5 + liquidity * 0.25 + sectorStrength * 0.25);
  const longTermTrend = clamp(trend * 0.4 + thirtyNinetyMomentum * 0.36 + macro * 0.24);
  const dividendStrength = stock.type === "ETF" || /dividend|income|yield/i.test(`${stock.name} ${stock.aiOutlook}`) ? 72 : clamp(valuation * 0.35 + (Number(stock.qualityScore) || 0) * 0.45 + liquidity * 0.2);
  const companyMoat = clamp((Number(stock.qualityScore) || 0) * 0.52 + marketPosition * 0.28 + valuation * 0.2);
  const macroTailwinds = clamp(macro * 0.58 + sectorStrength * 0.42);

  const dailyScore = weightedScore([
    { score: unusualVolume, weight: 0.13 },
    { score: newsImpact, weight: 0.13 },
    { score: momentum, weight: 0.16 },
    { score: gapSignal, weight: 0.1 },
    { score: premarketProxy, weight: 0.08 },
    { score: intradayTrend, weight: 0.15 },
    { score: 100 - volatilityRisk, weight: 0.07 },
    { score: supportResistance, weight: 0.08 },
    { score: sectorStrength, weight: 0.1 },
  ]);
  const weeklyScore = weightedScore([
    { score: earningsComing, weight: 0.1 },
    { score: analystUpgradeProxy, weight: 0.11 },
    { score: sectorRotation, weight: 0.12 },
    { score: fiveDayTrend, weight: 0.14 },
    { score: institutionalFlow, weight: 0.12 },
    { score: optionsActivityProxy, weight: 0.09 },
    { score: newsImpact, weight: 0.13 },
    { score: technicalBreakout, weight: 0.19 },
  ]);
  const monthlyScore = weightedScore([
    { score: revenueGrowthProxy, weight: 0.11 },
    { score: earningsGrowthProxy, weight: 0.11 },
    { score: valuation, weight: 0.1 },
    { score: macro, weight: 0.11 },
    { score: congressionalActivity, weight: 0.08 },
    { score: insiderBuyingProxy, weight: 0.08 },
    { score: sectorStrength, weight: 0.11 },
    { score: thirtyNinetyMomentum, weight: 0.11 },
    { score: companyGuidance, weight: 0.11 },
    { score: institutionalFlow, weight: 0.08 },
  ]);
  const oneYearScore = weightedScore([
    { score: revenueGrowthProxy, weight: 0.11 },
    { score: earningsGrowthProxy, weight: 0.11 },
    { score: profitMargins, weight: 0.08 },
    { score: debtLevels, weight: 0.08 },
    { score: freeCashFlow, weight: 0.08 },
    { score: marketPosition, weight: 0.08 },
    { score: macroTailwinds, weight: 0.09 },
    { score: valuation, weight: 0.09 },
    { score: institutionalFlow, weight: 0.07 },
    { score: longTermTrend, weight: 0.08 },
    { score: dividendStrength, weight: 0.05 },
    { score: companyMoat, weight: 0.05 },
    { score: macro, weight: 0.03 },
  ]);
  const score = Math.round(weightedScore([
    { score: dailyScore, weight: 0.22 },
    { score: weeklyScore, weight: 0.28 },
    { score: monthlyScore, weight: 0.28 },
    { score: oneYearScore, weight: 0.22 },
  ]));
  const riskScore = Math.round(clamp(volatilityRisk * 0.42 + (100 - liquidity) * 0.18 + policy.negative * 10 + congress.sells * 7));
  const bullishScore = clamp(score * 0.58 + Math.max(dailyScore, weeklyScore, monthlyScore) * 0.24 + newsImpact * 0.18);
  const bearishScore = clamp(riskScore * 0.7 + (100 - trend) * 0.18 + policy.negative * 8);
  const confidence = clamp((liquidity + Math.max(dailyScore, weeklyScore, monthlyScore) + trend + newsImpact) / 4 - riskScore * 0.08);
  const dailyUpside = Math.max(0.25, dailyScore / 72 + Math.max(0, marketChange) * 0.12);
  const weeklyUpside = Math.max(0.7, weeklyScore / 34);
  const monthlyUpside = Math.max(1.2, monthlyScore / 14);
  const oneYearUpside = Math.max(4, oneYearScore / 4.8);
  const dailyDownside = Math.max(0.8, riskScore / 32);
  const weeklyDownside = Math.max(1.4, riskScore / 18);
  const monthlyDownside = Math.max(2.2, riskScore / 11);
  const oneYearDownside = Math.max(6, riskScore / 4.5);
  const previous = previousByTicker.get(ticker);
  const previousScore = previous ? Number(previous.aiOpportunityScore) : NaN;
  const scoreChange = Number.isFinite(previousScore) ? Math.round(score - previousScore) : 0;
  const status = predictionStatus(score, previousScore);
  const catalyst = policy.strongest
    ? `${policy.strongest.sourceName}: ${policy.strongest.direction} policy signal`
      : congress.buys
      ? `${congress.buys} congressional buy signal(s)`
      : stock.pressNotes || stock.aiOutlook || "Momentum and quality signals";
  const dailyReason = `Daily model: momentum ${Math.round(momentum)}/100, unusual-volume proxy ${Math.round(unusualVolume)}/100, intraday-trend proxy ${Math.round(intradayTrend)}/100, sector strength today ${Math.round(sectorStrength)}/100.`;
  const weeklyReason = `Weekly model: 5-day trend proxy ${Math.round(fiveDayTrend)}/100, breakout pattern ${Math.round(technicalBreakout)}/100, news momentum ${Math.round(newsImpact)}/100, institutional-flow proxy ${Math.round(institutionalFlow)}/100.`;
  const monthlyReason = `Monthly model: growth quality ${Math.round(revenueGrowthProxy)}/100, valuation ${Math.round(valuation)}/100, macro ${Math.round(macro)}/100, congressional signal ${Math.round(congressionalActivity)}/100.`;
  const oneYearReason = `1-year model: revenue growth ${Math.round(revenueGrowthProxy)}/100, earnings growth ${Math.round(earningsGrowthProxy)}/100, market position ${Math.round(marketPosition)}/100, long-term trend ${Math.round(longTermTrend)}/100, moat ${Math.round(companyMoat)}/100.`;
  const dailyFail = volatilityRisk > 55 ? "Daily setup can fail if volatility reverses the move intraday." : "Daily setup can fail if volume fades after the open.";
  const weeklyFail = technicalBreakout < 60 ? "Weekly setup can fail if breakout confirmation never appears." : "Weekly setup can fail if news momentum cools before follow-through.";
  const monthlyFail = valuation < 55 ? "Monthly setup can fail if valuation pressure overwhelms growth signals." : "Monthly setup can fail if macro or guidance shifts against the sector.";
  const oneYearFail = debtLevels < 55 ? "1-year setup can fail if balance-sheet/debt pressure overwhelms growth." : "1-year setup can fail if growth slows or the sector outlook deteriorates.";
  const dailyModel = buildTimeframeModel({
    name: "Daily",
    score: dailyScore,
    confidence: confidence * 0.82 + liquidity * 0.18,
    risk: clamp(riskScore + volatilityRisk * 0.22),
    upside: dailyUpside,
    downside: dailyDownside,
    price,
    reasons: [dailyReason, marketChange ? `Latest market move: ${marketChange.toFixed(2)}%.` : "", catalyst],
    failureRisks: [dailyFail, policy.negative ? "Negative policy language may pressure the stock today." : "", congress.sells ? "Recent congressional sells are a warning input." : ""],
    metrics: { unusualVolume, breakingNews: newsImpact, priceMomentum: momentum, gapSignal, premarketMovement: premarketProxy, intradayTrend, volatility: 100 - volatilityRisk, supportResistance, sectorStrengthToday: sectorStrength },
  });
  const weeklyModel = buildTimeframeModel({
    name: "Weekly",
    score: weeklyScore,
    confidence: confidence * 0.76 + technicalBreakout * 0.24,
    risk: clamp(riskScore * 0.9 + (100 - technicalBreakout) * 0.12),
    upside: weeklyUpside,
    downside: weeklyDownside,
    price,
    reasons: [weeklyReason, catalyst, congress.buys ? `${congress.buys} congressional buy signal(s) add conviction.` : ""],
    failureRisks: [weeklyFail, optionsActivityProxy > 70 ? "Elevated options/volatility can create sharp shakeouts." : "", policy.negative ? "Negative policy/news flow could weaken the week trade." : ""],
    metrics: { earningsComing, analystUpgrades: analystUpgradeProxy, sectorRotation, fiveDayTrend, institutionalBuying: institutionalFlow, optionsActivity: optionsActivityProxy, newsMomentum: newsImpact, technicalBreakout },
  });
  const monthlyModel = buildTimeframeModel({
    name: "Monthly",
    score: monthlyScore,
    confidence: confidence * 0.68 + (Number(stock.qualityScore) || 0) * 0.32,
    risk: clamp(riskScore * 0.78 + (100 - valuation) * 0.12),
    upside: monthlyUpside,
    downside: monthlyDownside,
    price,
    reasons: [monthlyReason, catalyst, stock.aiOutlook],
    failureRisks: [monthlyFail, "30-day prediction can fail if market-wide risk appetite changes.", congress.sells ? "Congressional selling lowers the monthly conviction score." : ""],
    metrics: { revenueGrowth: revenueGrowthProxy, earningsGrowth: earningsGrowthProxy, valuation, macroTrends: macro, congressionalBuying: congressionalActivity, insiderBuying: insiderBuyingProxy, sectorStrength, thirtyNinetyDayMomentum: thirtyNinetyMomentum, companyGuidance },
  });
  const oneYearModel = buildTimeframeModel({
    name: "1-Year",
    score: oneYearScore,
    confidence: confidence * 0.48 + (Number(stock.qualityScore) || 0) * 0.32 + dataQualityBreakdown({ price, stock, policy, congress, liquidity, volatilityRisk, marketChange }).score * 0.2,
    risk: clamp(riskScore * 0.62 + (100 - debtLevels) * 0.18 + (100 - freeCashFlow) * 0.12),
    upside: oneYearUpside,
    downside: oneYearDownside,
    price,
    reasons: [oneYearReason, catalyst, marketPosition >= 70 ? "Strong market-position proxy improves long-term hold quality." : ""],
    failureRisks: [oneYearFail, "A 1-year thesis can fail if revenue/earnings estimates weaken or valuation compresses.", congress.sells ? "Congressional selling lowers long-term conviction." : ""],
    metrics: { revenueGrowth: revenueGrowthProxy, earningsGrowth: earningsGrowthProxy, profitMargins, debtLevels, freeCashFlow, marketPosition, sectorOutlook: macroTailwinds, valuation, institutionalOwnership: institutionalFlow, longTermTrend, dividendStrength, companyMoat, macroTailwinds },
  });
  const threeDayScore = weightedScore([
    { score: dailyModel.score, weight: 0.32 },
    { score: weeklyModel.score, weight: 0.46 },
    { score: technicalBreakout, weight: 0.12 },
    { score: newsImpact, weight: 0.1 },
  ]);
  const threeDayModel = buildTimeframeModel({
    name: "3-Day",
    score: threeDayScore,
    confidence: confidence * 0.78 + newsImpact * 0.12 + liquidity * 0.1,
    risk: clamp(riskScore * 0.95 + volatilityRisk * 0.12),
    upside: Math.max(0.45, threeDayScore / 48),
    downside: Math.max(1, riskScore / 24),
    price,
    reasons: [
      `3-day model: daily follow-through ${dailyModel.score}/100, weekly setup ${weeklyModel.score}/100, breakout ${Math.round(technicalBreakout)}/100, news momentum ${Math.round(newsImpact)}/100.`,
      catalyst,
    ],
    failureRisks: [
      "3-day setup can fail if the first move fades before confirmation.",
      volatilityRisk > 55 ? "High volatility can create sharp reversals inside the 3-day window." : "",
    ],
    metrics: { dailyFollowThrough: dailyModel.score, weeklySetup: weeklyModel.score, technicalBreakout, newsMomentum: newsImpact, liquidity },
  });
  dailyModel.technicalAnalysis = technicalAnalysis.oneDay;
  threeDayModel.technicalAnalysis = technicalAnalysis.oneDay;
  weeklyModel.technicalAnalysis = technicalAnalysis.sevenDay;
  monthlyModel.technicalAnalysis = technicalAnalysis.thirtyDay;
  oneYearModel.technicalAnalysis = technicalAnalysis.oneYear;
  dailyModel.multiTimeframeAlignment = multiTimeframeAlignment;
  threeDayModel.multiTimeframeAlignment = multiTimeframeAlignment;
  dailyModel.setupSignals = setupSignals;
  threeDayModel.setupSignals = setupSignals;
  const alignment = signalAlignment(dailyModel.score, weeklyModel.score, monthlyModel.score);
  const marketRegime = marketRegimeForStock({ stock, marketChange, momentum, trend, volatilityRisk, macro, sectorStrength });
  const dataQuality = dataQualityBreakdown({ price, stock, policy, congress, liquidity, volatilityRisk, marketChange });
  const unifiedPrediction = buildUnifiedPredictionLayer({
    baseScore: score,
    confidence,
    technicalAnalysis,
    multiTimeframeAlignment,
    setupSignals,
    shortSqueezeSignal,
    chartPatternSignal,
    dataQuality,
  });
  const ensembleModels = {
    momentum: researchSubModel("Momentum Model", momentum, 100 - momentum, confidence, `Price momentum proxy is ${Math.round(momentum)}/100.`, dataQuality.score),
    trend: researchSubModel("Trend Model", trend, 100 - trend, confidence, `Trend blends quality and momentum at ${Math.round(trend)}/100.`, dataQuality.score),
    breakout: researchSubModel("Breakout Model", breakout, 100 - breakout, technicalBreakout, `Breakout score is ${Math.round(breakout)}/100 with support/resistance confirmation.`, dataQuality.score),
    meanReversion: researchSubModel("Mean Reversion Model", clamp(100 - gapSignal), gapSignal, 58, `Gap pressure is ${Math.round(gapSignal)}/100; stretched gaps reduce mean-reversion confidence.`, dataQuality.score - 4),
    earningsCatalyst: researchSubModel("Earnings Catalyst Model", earningsComing, 100 - earningsComing, confidence, `Earnings/news catalyst proxy is ${Math.round(earningsComing)}/100.`, dataQuality.score),
    newsImpact: researchSubModel("News Impact Model", newsImpact, policy.negative * 18, confidence, `News and policy impact score is ${Math.round(newsImpact)}/100.`, dataQuality.score - (policy.count > 3 ? 8 : 0)),
    sentiment: researchSubModel("Sentiment Model", sentiment, 100 - sentiment, confidence, `Sentiment blends press, momentum, and policy tone at ${Math.round(sentiment)}/100.`, dataQuality.score),
    optionsFlow: researchSubModel("Options Flow Model", optionsActivityProxy, volatilityRisk, 54, `Options-flow proxy uses volatility, momentum, and news at ${Math.round(optionsActivityProxy)}/100.`, dataQuality.score - 8),
    insiderActivity: researchSubModel("Insider Activity Model", insiderBuyingProxy, congress.sells * 22, 52, `Insider proxy is congressional plus institutional-flow overlap at ${Math.round(insiderBuyingProxy)}/100.`, dataQuality.score - 12),
    congressionalActivity: researchSubModel("Congressional Activity Model", congressionalActivity, congress.sells * 24, 50, `${congress.buys} buy signal(s), ${congress.sells} sell signal(s).`, dataQuality.score - 14),
    sectorRotation: researchSubModel("Sector Rotation Model", sectorRotation, 100 - sectorRotation, confidence, `Sector rotation score is ${Math.round(sectorRotation)}/100.`, dataQuality.score),
    macroRegime: researchSubModel("Macro Regime Model", macro, 100 - macro, 56, `${marketRegime.primary}; ${marketRegime.weightAdjustment}`, dataQuality.score - 5),
    volatility: researchSubModel("Volatility Model", 100 - volatilityRisk, volatilityRisk, 62, `Volatility risk is ${Math.round(volatilityRisk)}/100.`, dataQuality.score),
    liquidity: researchSubModel("Liquidity Model", liquidity, 100 - liquidity, 70, `Liquidity proxy is ${Math.round(liquidity)}/100.`, dataQuality.score),
    valuation: researchSubModel("Valuation Model", valuation, 100 - valuation, 60, `Valuation score is ${Math.round(valuation)}/100.`, dataQuality.score),
  };
  const modelLeaderboard = Object.values(ensembleModels).sort((a, b) => (b.bullishScore + b.confidenceScore + b.dataQualityScore) - (a.bullishScore + a.confidenceScore + a.dataQualityScore));
  const bestTimeframe =
    dailyModel.score >= threeDayModel.score && dailyModel.score >= weeklyModel.score && dailyModel.score >= monthlyModel.score && dailyModel.score >= oneYearModel.score
      ? "1-Day"
      : threeDayModel.score >= weeklyModel.score && threeDayModel.score >= monthlyModel.score && threeDayModel.score >= oneYearModel.score
      ? "3-Day"
      : weeklyModel.score >= monthlyModel.score && weeklyModel.score >= oneYearModel.score
      ? "7-Day"
      : monthlyModel.score >= oneYearModel.score
      ? "1-Month"
      : "1-Year";
  const similarHistory = similarSetupAnalysis(stock, Array.from(previousByTicker.values()), {
    oneDay: dailyModel.score,
    threeDay: threeDayModel.score,
    sevenDay: weeklyModel.score,
    thirtyDay: monthlyModel.score,
    oneYear: oneYearModel.score,
    overall: score,
    alignmentType: alignment.type,
  });
  const portfolio = portfolioImpact(stock, config, { riskScore, bestTimeframe });
  const quoteTimestamp = stock.marketUpdatedAt || null;
  const scanTimestamp = new Date().toISOString();
  const quoteAgeHours = quoteTimestamp ? (Date.now() - Date.parse(quoteTimestamp)) / 3600000 : null;
  const freshnessStatus = !quoteTimestamp ? "unavailable" : quoteAgeHours <= 1 ? "live" : quoteAgeHours <= 24 ? "recent" : quoteAgeHours <= 72 ? "delayed" : "stale";
  const signalContribution = {
    currentPriceMomentum: Math.round(momentum * 0.12),
    intradayMomentum: Math.round(intradayTrend * 0.08),
    technicalAnalysis: Math.round(technicalAnalysis.oneDay.technicalSignalScore * 0.12),
    multiTimeframeAlignment: Math.round(multiTimeframeAlignment.alignmentScore * 0.1),
    setupConfirmation: Math.round(setupSignals.setupScore * 0.08),
    chartPattern: Math.round(chartPatternSignal.patternScore * 0.06),
    volumeAndRelativeVolume: Math.round(unusualVolume * 0.08),
    volatilityAndRisk: -Math.round(volatilityRisk * 0.05),
    marketRegime: Math.round(macro * 0.05),
    sectorStrength: Math.round(sectorStrength * 0.08),
    newsSentiment: Math.round(newsImpact * 0.07),
    policyCatalyst: Math.round(policy.score * 0.04),
    congressionalActivity: Math.min(10, Math.round(congressionalActivity * 0.05)),
    shortSqueezeSignal: Math.round(shortSqueezeSignal.squeezeScore * 0.03),
    fundamentals: Math.round((revenueGrowthProxy + earningsGrowthProxy + valuation) / 3 * 0.08),
    dataQualityPenalty: -Math.round((100 - dataQuality.score) * 0.04),
    staleDataPenalty: freshnessStatus === "stale" ? -8 : freshnessStatus === "delayed" ? -4 : freshnessStatus === "unavailable" ? -10 : 0,
  };

  return {
    ticker,
    name: stock.name,
    assetGroup: assetGroup(stock),
    currentPrice: price,
    marketChangePercent: stock.marketChangePercent || "",
    marketProvider: stock.marketProvider || "",
    marketProviderSymbol: stock.marketProviderSymbol || ticker,
    marketQuoteRequested: stock.marketQuoteRequested !== false,
    marketQuoteRetryCount: Number(stock.marketQuoteRetryCount) || 0,
    marketQuoteError: stock.marketQuoteError || "",
    quoteTimestamp,
    intradayDataTimestamp: quoteTimestamp,
    volumeTimestamp: quoteTimestamp,
    newsTimestamp: policy.strongest?.updatedAt || policySignals?.updatedAt || null,
    policyTimestamp: policySignals?.updatedAt || null,
    congressTimestamp: congress.latestDate || null,
    fundamentalsTimestamp: null,
    scanTimestamp,
    freshnessStatus,
    freshnessNotes: [
      quoteTimestamp ? `Quote data as of ${quoteTimestamp}.` : "Quote timestamp unavailable.",
      freshnessStatus === "stale" ? "Short-term rankings are penalized for stale price data." : "",
    ].filter(Boolean),
    signalContribution,
    technicalAnalysis,
    multiTimeframeAlignment,
    setupSignals,
    shortSqueezeSignal,
    chartPatternSignal,
    unifiedPredictionScore: unifiedPrediction.unifiedPredictionScore,
    unifiedDirection: unifiedPrediction.unifiedDirection,
    confidenceTier: unifiedPrediction.confidenceTier,
    strongestSignals: unifiedPrediction.strongestSignals,
    conflictingSignals: unifiedPrediction.conflictingSignals,
    finalReasonSummary: unifiedPrediction.finalReasonSummary,
    dataQualityStatus: dataQuality.dataQualityStatus,
    dataQualityNotes: dataQuality.dataQualityNotes,
    aiOpportunityScore: score,
    oneDayScore: dailyModel.score,
    threeDayScore: threeDayModel.score,
    sevenDayScore: weeklyModel.score,
    thirtyDayScore: monthlyModel.score,
    oneYearScore: oneYearModel.score,
    dailyScore: dailyModel.score,
    weeklyScore: weeklyModel.score,
    monthlyScore: monthlyModel.score,
    bullishScore: Math.round(bullishScore),
    bearishScore: Math.round(bearishScore),
    confidenceScore: Math.round(confidence),
    riskScore,
    label: predictionLabel(score),
    status,
    scoreChange,
    signalAlignment: alignment,
    bestTimeframe,
    timeframeModels: {
      oneDay: dailyModel,
      threeDay: threeDayModel,
      sevenDay: weeklyModel,
      thirtyDay: monthlyModel,
      oneYear: oneYearModel,
      daily: dailyModel,
      weekly: weeklyModel,
      monthly: monthlyModel,
    },
    expectedTimeHorizon: "1-Day / 7-Day / 1-Month / 1-Year scored separately",
    forecasts: {
      oneDay: { expectedUpside: dailyModel.expectedUpside, downsideRisk: dailyModel.downsideRisk },
      threeDay: { expectedUpside: threeDayModel.expectedUpside, downsideRisk: threeDayModel.downsideRisk },
      sevenDay: { expectedUpside: weeklyModel.expectedUpside, downsideRisk: weeklyModel.downsideRisk },
      thirtyDay: { expectedUpside: monthlyModel.expectedUpside, downsideRisk: monthlyModel.downsideRisk },
      oneYear: { expectedUpside: oneYearModel.expectedUpside, downsideRisk: oneYearModel.downsideRisk },
    },
    suggestedEntryZone: weeklyModel.suggestedEntryZone,
    suggestedProfitTarget: weeklyModel.suggestedProfitTarget,
    suggestedStopLevel: weeklyModel.suggestedStopLevel,
    estimatedVolatility: Math.round(volatilityRisk),
    riskRewardRatio: weeklyModel.riskRewardRatio,
    primaryCatalyst: catalyst,
    supportingIndicators: [
      `1-Day ${dailyModel.score}/100`,
      `3-Day ${threeDayModel.score}/100`,
      `7-Day ${weeklyModel.score}/100`,
      `30-Day ${monthlyModel.score}/100`,
      `1-Year ${oneYearModel.score}/100`,
      alignment.label,
      marketRegime.primary,
      `Risk ${riskScore}/100`,
      `Confidence ${Math.round(confidence)}/100`,
    ],
    modelScores: {
      oneDay: dailyModel.score,
      threeDay: threeDayModel.score,
      sevenDay: weeklyModel.score,
      thirtyDay: monthlyModel.score,
      oneYear: oneYearModel.score,
      daily: dailyModel.score,
      weekly: weeklyModel.score,
      monthly: monthlyModel.score,
      momentum: Math.round(momentum),
      trend: Math.round(trend),
      breakout: Math.round(breakout),
      newsImpact: Math.round(newsImpact),
      sentiment: Math.round(sentiment),
      macro: Math.round(macro),
      sectorStrength: Math.round(sectorStrength),
      relativeStrength: Math.round(relativeStrength),
      institutionalFlow: Math.round(institutionalFlow),
      volatility: Math.round(100 - volatilityRisk),
      liquidity: Math.round(liquidity),
      congressionalActivity: Math.round(congressionalActivity),
      technicalSignal: technicalAnalysis.oneDay.technicalSignalScore,
      intradayAlignment: multiTimeframeAlignment.alignmentScore,
      setupSignal: setupSignals.setupScore,
      shortSqueeze: shortSqueezeSignal.squeezeScore,
      chartPattern: chartPatternSignal.patternScore,
    },
    ensembleModels,
    modelLeaderboard: {
      bestModelToday: modelLeaderboard[0]?.name || "Not enough data",
      bestModelThisWeek: modelLeaderboard.find((model) => /Breakout|Sector|News|Momentum/.test(model.name))?.name || modelLeaderboard[0]?.name || "Not enough data",
      bestModelThisMonth: modelLeaderboard.find((model) => /Valuation|Macro|Congressional|Trend/.test(model.name))?.name || modelLeaderboard[0]?.name || "Not enough data",
      worstPerformingModel: [...modelLeaderboard].reverse()[0]?.name || "Not enough data",
      mostReliableSignal: modelLeaderboard[0]?.reason || "Not enough data",
      mostMisleadingSignal: [...modelLeaderboard].reverse()[0]?.reason || "Not enough data",
      note: "Leaderboard is signal-strength based until enough expired predictions are tracked for outcome-based ranking.",
    },
    marketRegime,
    dataQuality,
    similarSetupHistory: similarHistory,
    portfolioImpact: portfolio,
    confidenceCalibration: {
      statedConfidence: Math.round(confidence),
      calibrationStatus: "Tracking starts as predictions expire.",
      note: "If 80% confidence predictions do not win near 80% over time, this model will need recalibration.",
    },
    performanceTracking: {
      predictedDirection: score >= 52 ? "up" : "down/avoid",
      predictedReturn: bestTimeframe === "1-Day" ? dailyModel.expectedUpside : bestTimeframe === "3-Day" ? threeDayModel.expectedUpside : bestTimeframe === "7-Day" ? weeklyModel.expectedUpside : bestTimeframe === "1-Month" ? monthlyModel.expectedUpside : oneYearModel.expectedUpside,
      status: "Pending outcome tracking",
      fieldsTrackedAfterExpiry: [
        "actual direction",
        "actual return",
        "max gain",
        "max drawdown",
        "target reached",
        "stop reached",
        "models correct",
        "models wrong",
        "most important signals",
      ],
    },
    congressionalSignal: congress,
    predictionReason:
      bestTimeframe === "1-Day"
        ? dailyReason
        : bestTimeframe === "7-Day" || bestTimeframe === "3-Day"
        ? weeklyReason
        : bestTimeframe === "1-Month"
        ? monthlyReason
        : oneYearReason,
    failureRisk:
      bestTimeframe === "1-Day"
        ? dailyFail
        : bestTimeframe === "7-Day" || bestTimeframe === "3-Day"
        ? weeklyFail
        : bestTimeframe === "1-Month"
        ? monthlyFail
        : oneYearFail,
    plainEnglish:
      `${ticker} scores 1-Day ${dailyModel.score}, 7-Day ${weeklyModel.score}, 1-Month ${monthlyModel.score}, and 1-Year ${oneYearModel.score}. Best current timeframe: ${bestTimeframe}.`,
    whatChanged: previous ? `Score ${status} by ${scoreChange >= 0 ? "+" : ""}${scoreChange} points since the last scan.` : "New prediction in this scan.",
    scannedAt: scanTimestamp,
  };
}

function previousRanks(previousSections, key) {
  const rows = Array.isArray(previousSections?.[key]) ? previousSections[key] : [];
  return new Map(rows.map((item, index) => [item.ticker, { ...item, rank: Number(item.rank) || index + 1 }]));
}

function signalChangeReasons(previous, current) {
  if (!previous) return [];
  const checks = [
    { label: "volume/unusual activity", current: current.timeframeModels?.oneDay?.metrics?.unusualVolume, previous: previous.timeframeModels?.oneDay?.metrics?.unusualVolume },
    { label: "sector strength", current: current.modelScores?.sectorStrength, previous: previous.modelScores?.sectorStrength },
    { label: "momentum", current: current.modelScores?.momentum, previous: previous.modelScores?.momentum },
    { label: "breakout confirmation", current: current.modelScores?.breakout, previous: previous.modelScores?.breakout },
    { label: "news impact", current: current.modelScores?.newsImpact, previous: previous.modelScores?.newsImpact },
    { label: "liquidity", current: current.modelScores?.liquidity, previous: previous.modelScores?.liquidity },
    { label: "risk", current: current.riskScore, previous: previous.riskScore, inverse: true },
  ];

  return checks
    .map((item) => {
      const currentValue = Number(item.current);
      const previousValue = Number(item.previous);
      if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) return null;
      const delta = currentValue - previousValue;
      if (Math.abs(delta) < 4) return null;
      const improved = item.inverse ? delta < 0 : delta > 0;
      return {
        label: item.label,
        delta,
        text: `${item.label} ${improved ? "improved" : "weakened"} by ${Math.abs(Math.round(delta))} points`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 2);
}

function rankMovement(ticker, rank, previousMap, item, timeframeName) {
  const previous = previousMap.get(ticker);
  if (!previous) {
    return {
      status: "new addition",
      previousRank: null,
      rankChange: null,
      explanation: `${ticker} is a new addition to the ${timeframeName} Top 25.`,
    };
  }
  const previousRank = previous.rank;
  const rankChange = previousRank - rank;
  const reasons = signalChangeReasons(previous, item);
  const reasonText = reasons.length
    ? reasons.map((reason) => reason.text).join(" and ")
    : rankChange >= 0
    ? item.strongestSupportingSignal || "supporting signals improved"
    : item.weakestSignal || "one or more signals weakened";
  if (rankChange > 0) {
    return {
      status: "rank increase",
      previousRank,
      rankChange,
      explanation: `${ticker} moved from #${previousRank} to #${rank} because ${reasonText}.`,
    };
  }
  if (rankChange < 0) {
    return {
      status: "rank drop",
      previousRank,
      rankChange,
      explanation: `${ticker} dropped from #${previousRank} to #${rank} because ${reasonText}.`,
    };
  }
  return {
    status: "repeated winner",
    previousRank,
    rankChange: 0,
    explanation: `${ticker} held rank #${rank} on the ${timeframeName} list.`,
  };
}

function supportingSignalsFor(item) {
  const models = Object.values(item.ensembleModels || {});
  const strongest = models.sort((a, b) => b.bullishScore - a.bullishScore)[0];
  const weakest = models.sort((a, b) => a.bullishScore - b.bullishScore)[0];
  return {
    strongestSupportingSignal: strongest ? `${strongest.name}: ${strongest.bullishScore}/100` : item.primaryCatalyst,
    weakestSignal: weakest ? `${weakest.name}: ${weakest.bullishScore}/100` : item.failureRisk,
  };
}

function rankedTopList(predictions, { key, timeframe, modelKey, scoreKey, previousSections }) {
  const previousMap = previousRanks(previousSections, key);
  return [...predictions]
    .sort((a, b) => (Number(b[scoreKey]) || 0) - (Number(a[scoreKey]) || 0))
    .slice(0, 25)
    .map((item, index) => {
      const model = item.timeframeModels?.[modelKey] || item.timeframeModels?.weekly || {};
      const signals = supportingSignalsFor(item);
      const rank = index + 1;
      return {
        ...item,
        rank,
        timeframe,
        timeframeKey: key,
        aiScore: Number(item[scoreKey]) || 0,
        expectedUpside: model.expectedUpside,
        downsideRisk: model.downsideRisk,
        suggestedEntryRange: model.entryZone || model.suggestedEntryZone || item.suggestedEntryZone,
        suggestedStopLevel: model.stopLevel || model.suggestedStopLevel || item.suggestedStopLevel,
        suggestedTarget: model.profitTarget || model.suggestedProfitTarget || item.suggestedProfitTarget,
        reasonForRecommendation: model.reasons?.[0] || item.predictionReason,
        whyTop25: `Ranked #${rank} for ${timeframe} because ${model.reasons?.[0] || item.predictionReason || item.primaryCatalyst}.`,
        whyMayBeWrong: model.failureRisks?.[0] || item.failureRisk,
        primaryCatalyst: item.primaryCatalyst,
        strongestSupportingSignal: signals.strongestSupportingSignal,
        weakestSignal: signals.weakestSignal,
        fallOffReason: `Falls off the ${timeframe} Top 25 if score drops below peers, risk rises, or ${signals.weakestSignal} weakens further.`,
        lastUpdated: item.scannedAt,
        rankMovement: rankMovement(item.ticker, rank, previousMap, { ...item, ...signals }, timeframe),
      };
    });
}

function comparisonView(lists) {
  const groups = new Map();
  Object.entries(lists).forEach(([key, rows]) => {
    rows.forEach((item) => {
      const current = groups.get(item.ticker) || {
        ticker: item.ticker,
        name: item.name,
        currentPrice: item.currentPrice,
        lists: [],
      };
      current.lists.push({ key, timeframe: item.timeframe, rank: item.rank, score: item.aiScore });
      groups.set(item.ticker, current);
    });
  });

  return [...groups.values()]
    .map((item) => {
      const keys = new Set(item.lists.map((entry) => entry.key));
      const label =
        keys.has("top25OneDay") && keys.size === 1
          ? "Short-Term Momentum"
          : keys.has("top25SevenDay") && keys.size === 1
          ? "Weekly Trade Setup"
          : keys.has("top25OneMonth") && keys.size === 1
          ? "Swing Trade Candidate"
          : keys.has("top25OneYear") && keys.size === 1
          ? "Long-Term Hold Candidate"
          : keys.has("top25SevenDay") && keys.has("top25OneMonth") && keys.has("top25OneYear")
          ? "High Alignment Candidate"
          : "Multi-Timeframe Candidate";
      return { ...item, label };
    })
    .sort((a, b) => b.lists.length - a.lists.length || Math.min(...a.lists.map((item) => item.rank)) - Math.min(...b.lists.map((item) => item.rank)));
}

function predictionSections(predictions, previousSections = {}) {
  const byScore = [...predictions].sort((a, b) => b.aiOpportunityScore - a.aiOpportunityScore);
  const top25OneDay = rankedTopList(predictions, { key: "top25OneDay", timeframe: "1-day trade", modelKey: "oneDay", scoreKey: "oneDayScore", previousSections });
  const top25SevenDay = rankedTopList(predictions, { key: "top25SevenDay", timeframe: "7-day trade", modelKey: "sevenDay", scoreKey: "sevenDayScore", previousSections });
  const top25OneMonth = rankedTopList(predictions, { key: "top25OneMonth", timeframe: "1-month trade", modelKey: "thirtyDay", scoreKey: "thirtyDayScore", previousSections });
  const top25OneYear = rankedTopList(predictions, { key: "top25OneYear", timeframe: "1-year hold", modelKey: "oneYear", scoreKey: "oneYearScore", previousSections });
  const lists = { top25OneDay, top25SevenDay, top25OneMonth, top25OneYear };
  const comparisons = comparisonView(lists);
  const highAlignmentTickers = new Set(comparisons.filter((item) => item.label === "High Alignment Candidate").map((item) => item.ticker));
  return {
    topBuyCandidates: byScore.slice(0, 25),
    top25OneDay,
    top25SevenDay,
    top25OneMonth,
    top25OneYear,
    bestFiveOneDay: top25OneDay.slice(0, 5),
    bestFiveSevenDay: top25SevenDay.slice(0, 5),
    bestFiveOneMonth: top25OneMonth.slice(0, 5),
    bestFiveOneYear: top25OneYear.slice(0, 5),
    avoidList: [...predictions]
      .filter((item) => item.oneDayScore < 55 || item.riskScore >= 70)
      .sort((a, b) => (b.riskScore - a.riskScore) || (a.oneDayScore - b.oneDayScore))
      .slice(0, 25)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
        timeframe: "Avoid today",
        aiScore: item.oneDayScore,
        whyTop25: `Danger today: 1-day score ${item.oneDayScore}/100 with risk ${item.riskScore}/100.`,
        whyMayBeWrong: item.failureRisk,
        fallOffReason: "Leaves the Avoid List if risk falls, 1-day momentum improves, or stronger liquidity/news confirmation appears.",
      })),
    comparisonView: comparisons,
    highAlignmentCandidates: byScore
      .filter((item) => highAlignmentTickers.has(item.ticker))
      .map((item, index) => ({
        ...item,
        rank: index + 1,
        timeframe: "7-day + 1-month + 1-year alignment",
        aiScore: item.aiOpportunityScore,
        whyTop25: "High Alignment Candidate: appears across the 7-day, 1-month, and 1-year ranked lists.",
        whyMayBeWrong: item.failureRisk,
      })),
    changedSinceLastScan: [...top25OneDay, ...top25SevenDay, ...top25OneMonth, ...top25OneYear]
      .filter((item) => item.rankMovement?.status !== "repeated winner")
      .slice(0, 40),
    oneDayOpportunities: top25OneDay,
    threeDayOpportunities: [...predictions].sort((a, b) => b.threeDayScore - a.threeDayScore).slice(0, 6),
    sevenDayOpportunities: top25SevenDay,
    thirtyDayOpportunities: top25OneMonth,
    dailyOpportunities: top25OneDay,
    weeklyOpportunities: top25SevenDay,
    monthlyOpportunities: top25OneMonth,
    goldSilverOpportunities: byScore.filter((item) => item.assetGroup === "Gold/Silver").slice(0, 5),
    highestMomentum: [...predictions].sort((a, b) => b.modelScores.momentum - a.modelScores.momentum).slice(0, 5),
    strongestSector: [...predictions].sort((a, b) => b.modelScores.sectorStrength - a.modelScores.sectorStrength).slice(0, 5),
    congressionalTradeSignals: byScore.filter((item) => item.congressionalSignal.count > 0).slice(0, 5),
    strongestOneDay: [...predictions].sort((a, b) => b.oneDayScore - a.oneDayScore).slice(0, 5),
    strongestThreeDay: [...predictions].sort((a, b) => b.threeDayScore - a.threeDayScore).slice(0, 5),
    strongestSevenDay: [...predictions].sort((a, b) => b.sevenDayScore - a.sevenDayScore).slice(0, 5),
    strongestThirtyDay: [...predictions].sort((a, b) => b.thirtyDayScore - a.thirtyDayScore).slice(0, 5),
    biggestScoreIncrease: [...predictions].sort((a, b) => b.scoreChange - a.scoreChange).slice(0, 5),
    biggestScoreDrop: [...predictions].sort((a, b) => a.scoreChange - b.scoreChange).slice(0, 5),
  };
}

function averageUnifiedScore(rows) {
  const scores = rows.map((item) => Number(item.unifiedPredictionScore)).filter(Number.isFinite);
  return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
}

function sectorAllocationSummary(candidates) {
  const bySector = new Map();
  for (const candidate of candidates || []) {
    const sector = candidate.sector || candidate.assetGroup || candidate.type || "Unclassified";
    bySector.set(sector, (bySector.get(sector) || 0) + 1);
  }
  return [...bySector.entries()]
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector));
}

function countBy(items, key, values) {
  const counts = Object.fromEntries(values.map((value) => [value, 0]));
  items.forEach((item) => {
    const value = item?.[key];
    counts[value] = (counts[value] || 0) + 1;
  });
  return counts;
}

function duplicateTickers(rows) {
  const seen = new Set();
  const duplicates = new Set();
  rows.forEach((item) => {
    if (!item?.ticker) return;
    if (seen.has(item.ticker)) duplicates.add(item.ticker);
    seen.add(item.ticker);
  });
  return [...duplicates];
}

function buildPredictionEngineHealth({ predictions, sections, warnings, updatedAt }) {
  const top25 = {
    top25OneDay: sections.top25OneDay || [],
    top25SevenDay: sections.top25SevenDay || [],
    top25OneMonth: sections.top25OneMonth || [],
    top25OneYear: sections.top25OneYear || [],
  };
  const rankingChecks = {
    noDuplicateTickerInSameTop25: Object.entries(top25).every(([, rows]) => !duplicateTickers(rows).length),
    noMissingUnifiedPredictionScore: predictions.every((item) => Number.isFinite(Number(item.unifiedPredictionScore))),
    noMissingFinalReasonSummary: predictions.every((item) => Boolean(item.finalReasonSummary)),
    noVeryHighConfidenceMixedDirection: predictions.every((item) => !(item.confidenceTier === "very high" && item.unifiedDirection === "mixed")),
    noStaleDataAboveHighConfidence: predictions.every((item) => !(item.dataQualityStatus === "stale" && item.confidenceTier === "very high")),
  };
  const structuralFailedTickers = predictions
    .filter((item) => !Number.isFinite(Number(item.unifiedPredictionScore)) || !item.finalReasonSummary)
    .map((item) => ({
      ticker: item.ticker,
      reason: !Number.isFinite(Number(item.unifiedPredictionScore))
          ? "Missing unified prediction score."
          : "Missing final reason summary.",
    }));
  const quoteRequestedPredictions = predictions.filter((item) => item.marketQuoteRequested !== false);
  const incompleteMarketDataTickers = quoteRequestedPredictions
    .filter((item) => ["partial", "stale", "failed"].includes(item.dataQualityStatus))
    .map((item) => ({
      ticker: item.ticker,
      status: item.dataQualityStatus,
      reason: (item.dataQualityNotes || []).join(" ") || "Market data is incomplete.",
      providerSymbol: item.marketProviderSymbol || item.ticker,
      retryCount: Number(item.marketQuoteRetryCount) || 0,
      providerResponse: item.marketQuoteError || item.marketProvider || "No provider detail available.",
    }));
  const dataQualityStatusCounts = countBy(quoteRequestedPredictions, "dataQualityStatus", ["good", "partial", "stale", "failed"]);
  const incompleteMarketDataCount = dataQualityStatusCounts.partial + dataQualityStatusCounts.stale + dataQualityStatusCounts.failed;
  const incompleteMarketDataPercent = quoteRequestedPredictions.length ? Number(((incompleteMarketDataCount / quoteRequestedPredictions.length) * 100).toFixed(1)) : 100;
  const dataQualityStatus =
    !predictions.length
      ? "Failed"
      : incompleteMarketDataPercent < 5
      ? "Healthy"
      : incompleteMarketDataPercent <= 20
      ? "Warning"
      : "Failed";
  const highest = [...predictions].sort((a, b) => Number(b.unifiedPredictionScore || 0) - Number(a.unifiedPredictionScore || 0))[0] || null;
  const lowest = [...predictions].sort((a, b) => Number(a.unifiedPredictionScore || 0) - Number(b.unifiedPredictionScore || 0))[0] || null;
  const checkFailures = Object.entries(rankingChecks).filter(([, passed]) => !passed).map(([name]) => name);
  const engineFailureReasons = [
    !updatedAt ? "Scan aborted before completion." : "",
    !predictions.length ? "Prediction generation failed." : "",
    predictions.length > 0 && predictions.length < 25 ? "Less than 25 predictions generated." : "",
    structuralFailedTickers.length ? "One or more predictions is missing required generated fields." : "",
    !rankingChecks.noDuplicateTickerInSameTop25 ? "Duplicate ticker found in a Top 25 timeframe." : "",
    !rankingChecks.noVeryHighConfidenceMixedDirection ? "Very-high confidence pick has mixed direction." : "",
    !rankingChecks.noStaleDataAboveHighConfidence ? "Stale-data pick is above high confidence." : "",
    warnings.some((warning) => /Market data refresh failed|API unavailable/i.test(warning)) && predictions.length < 25 ? "API unavailable and fewer than 25 predictions were generated." : "",
  ].filter(Boolean);
  const status = engineFailureReasons.length ? "Failed" : "Healthy";

  return {
    status,
    predictionEngineStatus: status,
    predictionEngineStatusReasons: engineFailureReasons,
    dataQualityStatus,
    incompleteMarketDataCount,
    incompleteMarketDataPercent,
    incompleteMarketDataTickers,
    marketQuotesRequested: quoteRequestedPredictions.length,
    marketQuotesSucceeded: quoteRequestedPredictions.filter((item) => Number(item.currentPrice) > 0).length,
    marketQuotesFailed: quoteRequestedPredictions.filter((item) => !Number(item.currentPrice)).length,
    scanCompletedAt: updatedAt,
    tickersScanned: predictions.length,
    predictionsGenerated: predictions.length,
    top25Counts: Object.fromEntries(Object.entries(top25).map(([key, rows]) => [key, rows.length])),
    dataQualityStatusCounts,
    averageUnifiedPredictionScoreByTimeframe: {
      top25OneDay: averageUnifiedScore(top25.top25OneDay),
      top25SevenDay: averageUnifiedScore(top25.top25SevenDay),
      top25OneMonth: averageUnifiedScore(top25.top25OneMonth),
      top25OneYear: averageUnifiedScore(top25.top25OneYear),
    },
    highestScoringTicker: highest ? { ticker: highest.ticker, score: Number(highest.unifiedPredictionScore) || 0 } : null,
    lowestScoringTicker: lowest ? { ticker: lowest.ticker, score: Number(lowest.unifiedPredictionScore) || 0 } : null,
    failedTickers: structuralFailedTickers,
    rankingSanityChecks: rankingChecks,
    rankingSanityFailures: checkFailures,
    duplicateTickersByTimeframe: Object.fromEntries(Object.entries(top25).map(([key, rows]) => [key, duplicateTickers(rows)])),
    warnings,
  };
}

function timeframeTradingDays(timeframe) {
  if (/1-day|daily/i.test(timeframe)) return 1;
  if (/7-day|weekly/i.test(timeframe)) return 7;
  if (/month|30/i.test(timeframe)) return 21;
  if (/year/i.test(timeframe)) return 252;
  return 1;
}

function historicalPredictionRows({ predictions, sections, scanId, scanHealth, updatedAt }) {
  const byTicker = new Map((predictions || []).map((item) => [item.ticker, item]));
  const lists = [
    ["1-day trade", sections.top25OneDay || []],
    ["7-day trade", sections.top25SevenDay || []],
    ["1-month trade", sections.top25OneMonth || []],
    ["1-year hold", sections.top25OneYear || []],
  ];
  return lists.flatMap(([timeframe, rows]) =>
    rows.map((row, index) => {
      const item = byTicker.get(row.ticker) || row;
      const referencePrice = Number(item.currentPrice || item.marketPrice || item.price) || null;
      return {
        predictionId: `${scanId}:${timeframe}:${row.ticker}`,
        scanId,
        modelVersion: "v5-live-coverage-forward-tracking",
        ticker: row.ticker,
        timeframe,
        rank: index + 1,
        predictionTimestamp: updatedAt,
        evaluationDueAt: tradingDaysFrom(updatedAt, timeframeTradingDays(timeframe)),
        predictedDirection: item.unifiedDirection || item.direction || "mixed",
        unifiedScore: Number(item.unifiedPredictionScore || item.aiOpportunityScore) || 0,
        confidenceTier: item.confidenceTier || "low",
        recommendation: item.recommendation || item.label || "Watch",
        referencePrice,
        referencePriceTimestamp: item.quoteTimestamp || scanHealth?.marketDataAsOfTimestamp || null,
        targetPrice: Number(item.targetPrice || item.suggestedTarget || item.targetLevel) || null,
        stopPrice: Number(item.stopPrice || item.suggestedStop || item.invalidationLevel) || null,
        signalSummary: (item.strongestSignals || []).slice(0, 5).join("; ") || item.finalReasonSummary || "",
        dataFreshness: item.freshnessStatus || item.dataQualityStatus || "unknown",
        universe: scanHealth?.selectedScanUniverse || "combined",
        settlementStatus: "pending",
      };
    }),
  );
}

function appendPredictionHistory(rows) {
  const history = readJson(PREDICTION_HISTORY_FILE, { records: [], updatedAt: null });
  const seen = new Set((history.records || []).map((record) => record.predictionId));
  const nextRecords = [...(history.records || [])];
  rows.forEach((row) => {
    if (!seen.has(row.predictionId)) {
      nextRecords.push(row);
      seen.add(row.predictionId);
    }
  });
  const result = { updatedAt: isoNow(), records: nextRecords.slice(-10000) };
  writeJson(PREDICTION_HISTORY_FILE, result);
  return result;
}

function settlePredictionOutcomes(config) {
  const history = readJson(PREDICTION_HISTORY_FILE, { records: [], updatedAt: null });
  const now = Date.now();
  let checked = 0;
  let settled = 0;
  const records = (history.records || []).map((record) => {
    if (record.settlementStatus === "settled") return record;
    if (Date.parse(record.evaluationDueAt || "") > now) return record;
    checked += 1;
    const quote = findCachedQuote(record.ticker);
    const actualPrice = Number(quote?.marketPrice) || null;
    if (!actualPrice || !Number(record.referencePrice)) {
      return { ...record, settlementStatus: "eligible", settlementNotes: "Eligible, but evaluation price is not available yet." };
    }
    const percentageReturn = ((actualPrice - Number(record.referencePrice)) / Number(record.referencePrice)) * 100;
    const bullish = /bullish|buy|long/i.test(`${record.predictedDirection} ${record.recommendation}`);
    settled += 1;
    return {
      ...record,
      actualEvaluationPrice: actualPrice,
      actualEvaluationTimestamp: quote.marketUpdatedAt || isoNow(),
      absoluteReturn: actualPrice - Number(record.referencePrice),
      percentageReturn,
      directionCorrect: bullish ? percentageReturn >= 0 : percentageReturn <= 0,
      targetReached: Number(record.targetPrice) ? (bullish ? actualPrice >= Number(record.targetPrice) : actualPrice <= Number(record.targetPrice)) : false,
      stopReached: Number(record.stopPrice) ? (bullish ? actualPrice <= Number(record.stopPrice) : actualPrice >= Number(record.stopPrice)) : false,
      maximumFavorableExcursion: null,
      maximumAdverseExcursion: null,
      settlementStatus: "settled",
      settlementNotes: "Settled from available cached/current market quote.",
    };
  });
  const result = {
    updatedAt: isoNow(),
    records,
  };
  writeJson(PREDICTION_HISTORY_FILE, result);
  const status = {
    lastOutcomeSettlementRun: isoNow(),
    nextSettlementRun: tradingDaysFrom(isoNow(), 1),
    predictionsChecked: checked,
    predictionsSettled: settled,
    failures: records.filter((record) => record.settlementStatus === "failed").length,
    retryQueue: records.filter((record) => record.settlementStatus === "eligible").length,
  };
  writeJson(OUTCOME_STATUS_FILE, status);
  return { history: result, status };
}

function performanceSummary() {
  const history = readJson(PREDICTION_HISTORY_FILE, { records: [] });
  const records = history.records || [];
  const settled = records.filter((record) => record.settlementStatus === "settled");
  const pending = records.filter((record) => record.settlementStatus === "pending");
  const eligible = records.filter((record) => record.settlementStatus === "eligible");
  const byTimeframe = {};
  ["1-day trade", "7-day trade", "1-month trade", "1-year hold"].forEach((timeframe) => {
    const rows = records.filter((record) => record.timeframe === timeframe);
    const settledRows = rows.filter((record) => record.settlementStatus === "settled");
    byTimeframe[timeframe] = {
      recorded: rows.length,
      pending: rows.filter((record) => record.settlementStatus === "pending").length,
      eligible: rows.filter((record) => record.settlementStatus === "eligible").length,
      settled: settledRows.length,
      accuracy: settledRows.length ? Math.round((settledRows.filter((record) => record.directionCorrect).length / settledRows.length) * 100) : null,
      averageReturn: settledRows.length ? settledRows.reduce((sum, record) => sum + Number(record.percentageReturn || 0), 0) / settledRows.length : null,
    };
  });
  return {
    updatedAt: isoNow(),
    recordsTotal: records.length,
    predictionsRecorded: records.length,
    predictionsPending: pending.length,
    predictionsEligible: eligible.length,
    predictionsSettled: settled.length,
    oldestPendingPrediction: pending.map((record) => record.predictionTimestamp).sort()[0] || null,
    nextSettlementTime: pending.map((record) => record.evaluationDueAt).sort()[0] || null,
    dataCoverageStartDate: records.map((record) => record.predictionTimestamp).sort()[0] || null,
    byTimeframe,
    liveForwardResultsOnly: true,
    historicalBacktestResults: null,
  };
}

function samplePredictionConfig() {
  const base = sanitizeConfig(readJson(CONFIG_FILE, {}));
  const existing = Array.isArray(base.stockIdeas) ? base.stockIdeas : [];
  if (existing.length) return base;
  return sanitizeConfig({
    ...base,
    stockIdeas: [
      {
        ticker: "NVDA",
        name: "NVIDIA",
        type: "Stock",
        risk: "growth",
        valuationScore: 62,
        momentumScore: 86,
        qualityScore: 90,
        volatilityScore: 58,
        pressScore: 88,
        pressNotes: "Sample AI infrastructure momentum signal for development scans.",
        committeeScore: 70,
        committeeNotes: "Sample semiconductor policy exposure.",
        aiOutlook: "Sample prediction row used only when development data is missing.",
        riskNote: "High valuation and volatility can reverse quickly.",
      },
      {
        ticker: "MSFT",
        name: "Microsoft",
        type: "Stock",
        risk: "balanced",
        valuationScore: 74,
        momentumScore: 72,
        qualityScore: 92,
        volatilityScore: 76,
        pressScore: 74,
        pressNotes: "Sample cloud and AI platform strength.",
        committeeScore: 54,
        committeeNotes: "Sample enterprise software policy exposure.",
        aiOutlook: "Sample durable compounder row for development scans.",
        riskNote: "Growth can slow if cloud demand weakens.",
      },
      {
        ticker: "VOO",
        name: "Vanguard S&P 500 ETF",
        type: "ETF",
        risk: "balanced",
        valuationScore: 70,
        momentumScore: 66,
        qualityScore: 84,
        volatilityScore: 82,
        pressScore: 48,
        pressNotes: "Sample broad-market ETF baseline.",
        committeeScore: 32,
        committeeNotes: "Low single-policy exposure.",
        aiOutlook: "Sample market benchmark row.",
        riskNote: "Market-wide drawdowns remain possible.",
      },
    ],
  });
}

async function refreshPredictions(options = {}) {
  const config = sanitizeConfig(options.config || readJson(CONFIG_FILE, {}));
  const policySignals = options.policySignals || readJson(POLICY_FILE, { updatedAt: null, signals: [], errors: [] });
  const warnings = Array.isArray(options.warnings) ? [...options.warnings] : [];
  const scanStartedAt = options.scanStartedAt || new Date().toISOString();
  const discoveryPipeline = buildDiscoveryPipeline(config, options.quotes || []);
  const scanUniverse = discoveryPipeline.deepAnalysisCandidates;
  const broadStats = broadUniverseStats(config, options.quotes || []);
  const previous = readJson(PREDICTIONS_FILE, { predictions: [] });
  const previousByTicker = new Map((previous.predictions || []).map((item) => [item.ticker, item]));
  const predictions = scanUniverse
    .map((stock) => buildPrediction(stock, config, policySignals, previousByTicker))
    .sort((a, b) => b.aiOpportunityScore - a.aiOpportunityScore);
  const updatedAt = new Date().toISOString();
  const sections = predictionSections(predictions, previous.sections || {});
  const predictionEngineHealth = buildPredictionEngineHealth({ predictions, sections, warnings, updatedAt });
  const durationMs = Date.parse(updatedAt) - Date.parse(scanStartedAt);
  const scanId = `scan-${Date.parse(updatedAt) || Date.now()}`;
  const marketDataAsOfTimestamp = predictions.map((item) => item.quoteTimestamp).filter(Boolean).sort().reverse()[0] || null;
  const scanHealth = {
    scanId,
    scanStartedAt,
    scanCompletedAt: updatedAt,
    lastSuccessfulScanTimestamp: updatedAt,
    lastScanAttemptTimestamp: scanStartedAt,
    scanCompletedTimestamp: updatedAt,
    marketDataAsOfTimestamp,
    scanDurationSeconds: Number.isFinite(durationMs) ? Math.round(durationMs / 1000) : 0,
    scanStatus: "completed",
    durationMs: Number.isFinite(durationMs) ? durationMs : 0,
    selectedScanUniverse: config.scanSettings?.universe || "combined",
    targetSymbolCount: broadStats.targetSymbolCount,
    totalSymbolsAvailable: broadStats.totalSymbolsAvailable,
    symbolsScreened: broadStats.broadScreenedSymbols,
    symbolsPassingFilters: broadStats.eligibleSymbols,
    broadScreenTarget: broadStats.broadScreenTarget,
    broadScreenedSymbols: broadStats.broadScreenedSymbols,
    broadScreenCoveragePercent: Math.round((broadStats.broadScreenedSymbols / Math.max(1, broadStats.broadScreenTarget)) * 100),
    deepAnalysisMarketHoursTarget: broadStats.deepAnalysisMarketHoursTarget,
    deepAnalysisAfterHoursTarget: broadStats.deepAnalysisAfterHoursTarget,
    activeDeepAnalysisTarget: discoveryPipeline.deepLimit,
    deepAnalysisCandidatesSelected: scanUniverse.length,
    candidatesSuccessfullyAnalyzed: predictions.length,
    predictionsGenerated: predictions.length,
    dataQualitySummary: predictionEngineHealth.dataQualityStatusCounts || {},
    failedAndSkippedSymbols: predictionEngineHealth.failedTickers || [],
    lastSuccessfulScan: updatedAt,
    dataAsOf: marketDataAsOfTimestamp,
    providerCapacity: {
      providerName: MARKET_API_KEY ? "Alpha Vantage + Yahoo fallback" : "Yahoo fallback / cached data",
      estimatedRequestLimit: MARKET_API_KEY ? "Depends on Alpha Vantage plan" : "No authenticated provider limit configured",
      requestsUsedLatestScan: Number(options.marketRequestsUsed) || scanUniverse.length,
      configuredRequestBudget: broadStats.providerRequestBudget,
      configuredConcurrencyLimit: broadStats.providerConcurrencyLimit,
      configuredMaxScanDurationMs: broadStats.maxScanDurationMs,
      actualProviderLimits: options.providerLimits || null,
      estimatedRemainingCapacity: "Unknown without provider usage endpoint",
      rateLimitWarnings: warnings.filter((warning) => /rate|limit|api key|provider/i.test(warning)),
    },
    broadScreen: broadStats,
    symbolUniverseMetadata: broadStats.symbolUniverseMetadata,
    sectorAllocation: sectorAllocationSummary(scanUniverse),
    stages: [
      { name: "Preparing scan", completed: true, completedCount: 1, totalCount: 1 },
      { name: "Broad screening", completed: true, completedCount: broadStats.broadScreenedSymbols, totalCount: broadStats.targetSymbolCount },
      { name: "Selecting deep-analysis candidates", completed: true, completedCount: scanUniverse.length, totalCount: discoveryPipeline.deepLimit },
      { name: "Refreshing market and news data", completed: true, completedCount: scanUniverse.length, totalCount: scanUniverse.length },
      { name: "Analyzing candidates", completed: true, completedCount: predictions.length, totalCount: scanUniverse.length },
      { name: "Building timeframe rankings", completed: true, completedCount: 4, totalCount: 4 },
      { name: "Validating prediction results", completed: true, completedCount: 1, totalCount: 1 },
      { name: "Saving predictions", completed: true, completedCount: 1, totalCount: 1 },
    ],
  };
  const predictionHistory = appendPredictionHistory(historicalPredictionRows({ predictions, sections, scanId, scanHealth, updatedAt }));
  const outcomeSettlement = settlePredictionOutcomes(config);
  const result = {
    updatedAt,
    predictions,
    sections,
    predictionEngineHealth,
    scanHealth,
    predictionHistory: predictionHistory.records.slice(-300),
    performanceSummary: performanceSummary(),
    outcomeSettlementStatus: outcomeSettlement.status,
    scanUniverse: {
      mode: config.scanSettings?.universe || "combined",
      customTickerCount: parseTickerList(config.scanSettings?.customTickers).length,
      candidateCount: scanUniverse.length,
      totalSymbolsAvailable: broadStats.totalSymbolsAvailable,
      targetSymbolCount: broadStats.targetSymbolCount,
      broadScreenTarget: broadStats.broadScreenTarget,
      broadScreenedSymbols: broadStats.broadScreenedSymbols,
      deepAnalysisCandidatesSelected: scanUniverse.length,
      providerRequestBudget: broadStats.providerRequestBudget,
      providerConcurrencyLimit: broadStats.providerConcurrencyLimit,
      maxScanDurationMs: broadStats.maxScanDurationMs,
      actualCoverageNote: broadStats.actualCoverageNote,
    },
    refreshCadence: {
      top25OneDay: "hourly",
      top25SevenDay: "every 4 hours",
      top25OneMonth: "daily",
      top25OneYear: "weekly",
    },
    performanceTrackingWindows: ["1 day", "7 days", "30 days", "1 year"],
    historicalRankingTracking: [
      "new additions",
      "removed stocks",
      "rank increases",
      "rank drops",
      "repeated winners",
      "failed predictions",
      "best-performing model",
      "worst-performing model",
    ],
    warnings,
    errors: [],
    modelVersion: "v4-top25-ranking-engine",
    notes: [
      "This engine produces separate Top 25 lists for 1-day trades, 7-day trades, 1-month trades, and 1-year holds.",
      "Fifteen ensemble submodels score momentum, trend, breakout, mean reversion, earnings, news, sentiment, options, insider/congressional activity, sector rotation, macro, volatility, liquidity, and valuation.",
      "Rank movement and historical performance become more useful as repeated scans and outcome data accumulate.",
      "Congressional disclosures are delayed and treated as lagging conviction signals.",
      "Market regime and data quality influence how much confidence the app gives each opportunity.",
    ],
  };
  try {
    writeJson(PREDICTIONS_FILE, result);
  } catch (error) {
    const wrapped = new Error(`Database write failed: ${error.message}`);
    wrapped.code = "DATABASE_WRITE_FAILED";
    throw wrapped;
  }
  return result;
}

async function runPredictionScan() {
  if (activePredictionScan) return activePredictionScan;
  activePredictionScan = runPredictionScanInternal().finally(() => {
    activePredictionScan = null;
  });
  return activePredictionScan;
}

async function runPredictionScanInternal() {
  const scanStartedAt = new Date().toISOString();
  const warnings = [];
  let config = sanitizeConfig(readJson(CONFIG_FILE, {}));
  const tickers = uniqueTickers(config);
  const developmentMode = process.env.NODE_ENV !== "production";
  let refreshedQuotes = [];
  let marketRequestsUsed = 0;
  let providerLimits = null;

  if (!tickers.length) {
    if (!developmentMode) {
      const error = new Error("No watchlist tickers found");
      error.code = "NO_WATCHLIST_TICKERS";
      throw error;
    }
    warnings.push("No watchlist tickers found. Development sample predictions were used.");
    config = samplePredictionConfig();
  }

  if (!MARKET_API_KEY) {
    warnings.push("Market data API key missing. Using cached/fallback market data when available.");
  }

  try {
    const market = await refreshMarketData(config);
    config = market.config;
    refreshedQuotes = market.quotes || [];
    marketRequestsUsed = (market.requestedTickers || []).length;
    providerLimits = market.providerLimits || null;
    if (market.errors.length) {
      warnings.push(`Market data unavailable for ${market.errors.length} ticker(s). Scores used saved or sample market values where needed.`);
    }
    try {
      writeJson(CONFIG_FILE, config);
    } catch (error) {
      const wrapped = new Error(`Database write failed: ${error.message}`);
      wrapped.code = "DATABASE_WRITE_FAILED";
      throw wrapped;
    }
  } catch (error) {
    warnings.push(`Market data refresh failed: ${publicErrorMessage(error, "Market data unavailable.")}`);
    if (developmentMode) config = samplePredictionConfig();
  }

  let policySignals = readJson(POLICY_FILE, { updatedAt: null, signals: [], errors: [] });
  try {
    policySignals = await refreshPolicySignals();
  } catch (error) {
    warnings.push(`Policy/news signal refresh failed: ${publicErrorMessage(error, "Policy/news signals unavailable.")}`);
  }

  if (CONGRESS_TRADES_FEED_URL) {
    try {
      const congress = await refreshCongressTradeFeed();
      config = congress.config || config;
    } catch (error) {
      warnings.push(`Congressional feed refresh failed: ${publicErrorMessage(error, "Congressional feed unavailable.")}`);
    }
  } else {
    warnings.push("Congressional feed provider not connected. Using saved congressional trades only.");
  }

  try {
    const result = await refreshPredictions({ config, policySignals, warnings, quotes: refreshedQuotes, scanStartedAt, marketRequestsUsed, providerLimits });
    if (!Array.isArray(result.predictions) || !result.predictions.length) {
      if (!developmentMode) {
        const error = new Error("Prediction scan failed");
        error.code = "PREDICTION_SCAN_FAILED";
        throw error;
      }
      warnings.push("Prediction scan produced no rows. Development sample predictions were used.");
      return refreshPredictions({ config: samplePredictionConfig(), policySignals, warnings, quotes: refreshedQuotes, scanStartedAt, marketRequestsUsed, providerLimits });
    }
    return result;
  } catch (error) {
    if (developmentMode && error.code !== "DATABASE_WRITE_FAILED") {
      warnings.push(`Prediction scan failed: ${error.message}. Development sample predictions were used.`);
      return refreshPredictions({ config: samplePredictionConfig(), policySignals, warnings, quotes: refreshedQuotes, scanStartedAt, marketRequestsUsed, providerLimits });
    }
    throw error;
  }
}

function normalizeImportedTrade(trade) {
  const transactionDate = trade.transactionDate || trade.transaction_date || trade.date || trade.reportedDate || trade.filingDate || "";
  const disclosureDate = trade.disclosureDate || trade.disclosure_date || trade.reportedDate || trade.filingDate || trade.date || "";
  const dataAge = disclosureDate ? Math.max(0, Math.floor(ageMs(disclosureDate) / 86400000)) : null;
  return {
    representative: trade.representative || trade.member || trade.name || "Representative",
    state: trade.state || "",
    party: trade.party || "",
    ticker: trade.ticker || trade.symbol || "",
    company: trade.company || trade.asset || trade.assetName || "Company",
    transaction: trade.transaction || trade.type || "Buy",
    reportedRange: trade.reportedRange || trade.amount || trade.range || "Not reported",
    reportedDate: trade.reportedDate || trade.date || trade.filingDate || "",
    transactionDate,
    disclosureDate,
    fetchedAt: isoNow(),
    source: trade.source || trade.sourceName || "Congress disclosure feed",
    sourceURL: safeHttpUrl(trade.sourceURL || trade.sourceUrl || trade.source, "https://disclosures-clerk.house.gov/FinancialDisclosure"),
    dataAge,
    freshnessStatus: dataAge === null ? "unavailable" : dataAge <= 45 ? "fresh" : dataAge <= 120 ? "stale" : "very stale",
    entryPrice: Number(trade.entryPrice || trade.price || trade.purchasePrice) || null,
    entryPriceSource: trade.entryPriceSource || trade.priceSource || "",
    sourceUrl: safeHttpUrl(trade.sourceUrl || trade.source, "https://disclosures-clerk.house.gov/FinancialDisclosure"),
    watchReason: trade.watchReason || "Imported from public disclosure data. Review source before relying on this signal.",
    signalScore: Number(trade.signalScore) || 50,
    conflictRisk: trade.conflictRisk || "Imported watch",
  };
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])),
  );
}

function extractTradeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.trades)) return payload.trades;
  if (Array.isArray(payload?.transactions)) return payload.transactions;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function tradeKey(trade) {
  return [
    trade.representative,
    trade.ticker,
    trade.transaction,
    trade.reportedDate,
    trade.reportedRange,
  ]
    .map((value) => String(value || "").toLowerCase().trim())
    .join("|");
}

function mergeCongressTrades(existing, incoming) {
  const byKey = new Map();
  for (const trade of existing || []) byKey.set(tradeKey(trade), trade);
  for (const trade of incoming || []) byKey.set(tradeKey(trade), trade);
  return [...byKey.values()].sort((a, b) => String(b.reportedDate || "").localeCompare(String(a.reportedDate || "")));
}

async function refreshCongressTradeFeed() {
  if (!CONGRESS_TRADES_FEED_URL) {
    throw new Error("Set CONGRESS_TRADES_FEED_URL to a JSON or CSV congressional trading feed.");
  }

  const headers = {
    "User-Agent": "PublicTradeIntelCongressFeed/1.0",
    Accept: "application/json,text/csv,text/plain,*/*",
  };
  if (CONGRESS_TRADES_API_KEY) {
    headers.Authorization = `Bearer ${CONGRESS_TRADES_API_KEY}`;
    headers["X-API-Key"] = CONGRESS_TRADES_API_KEY;
  }

  const response = await fetch(CONGRESS_TRADES_FEED_URL, { headers });
  if (!response.ok) throw new Error(`Congress feed returned ${response.status}`);

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  const rows =
    contentType.includes("json") || text.trim().startsWith("{") || text.trim().startsWith("[")
      ? extractTradeRows(JSON.parse(text))
      : parseCsvRows(text);
  const imported = rows.map(normalizeImportedTrade);
  const config = readJson(CONFIG_FILE, {});
  const nextConfig = sanitizeConfig({
    ...config,
    congressTrades: mergeCongressTrades(config.congressTrades || [], imported),
  });

  writeJson(CONFIG_FILE, nextConfig);
  const status = {
    updatedAt: new Date().toISOString(),
    imported: imported.length,
    totalTrades: nextConfig.congressTrades.length,
    source: CONGRESS_TRADES_FEED_URL,
    error: null,
  };
  writeJson(CONGRESS_FEED_STATUS_FILE, status);
  return { status, config: nextConfig };
}

function summarizeEvents() {
  const events = readJson(EVENTS_FILE, []);
  return events.reduce(
    (summary, event) => {
      summary.total += 1;
      if (event.action === "invest") summary.invest += 1;
      else if (event.action === "save") summary.save += 1;
      else summary.protect += 1;
      return summary;
    },
    { total: 0, invest: 0, save: 0, protect: 0 },
  );
}

async function handleApi(request, response, pathname) {
  if (request.method === "POST" && pathname === "/api/login") {
    const body = await collectBody(request);
    if (!LOGIN_PIN) {
      sendJson(response, 503, { error: "Login is not configured." });
      return;
    }
    if (String(body.pin || "") !== LOGIN_PIN) {
      sendJson(response, 401, { error: "Invalid login" });
      return;
    }
    createSession(response);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && pathname === "/api/logout") {
    clearSession(request, response);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && pathname === "/api/session") {
    sendJson(response, 200, { loggedIn: isLoggedIn(request) });
    return;
  }

  if (!isLoggedIn(request)) {
    sendJson(response, 401, { error: "Login required" });
    return;
  }

  if (request.method === "GET" && pathname === "/api/config") {
    sendJson(response, 200, readJson(CONFIG_FILE, {}));
    return;
  }

  if (request.method === "GET" && pathname === "/api/policy-signals") {
    sendJson(response, 200, readJson(POLICY_FILE, { updatedAt: null, signals: [], errors: [] }));
    return;
  }

  if (request.method === "GET" && pathname === "/api/symbol-universe") {
    sendJson(response, 200, loadSymbolUniverse());
    return;
  }

  if (request.method === "GET" && pathname === "/api/performance-summary") {
    sendJson(response, 200, performanceSummary());
    return;
  }

  if (request.method === "GET" && pathname === "/api/predictions") {
    try {
      const saved = readJson(PREDICTIONS_FILE, null);
      sendJson(response, 200, saved && Array.isArray(saved.predictions) && saved.predictions.length ? saved : await runPredictionScan());
    } catch (error) {
      sendJson(response, 500, {
        error: error.code === "NO_WATCHLIST_TICKERS" ? "No watchlist tickers found" : error.code === "DATABASE_WRITE_FAILED" ? "Database write failed" : "Prediction scan failed",
        detail: publicErrorMessage(error, "Prediction scan failed."),
      });
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/predictions/scan") {
    try {
      sendJson(response, 200, await runPredictionScan());
    } catch (error) {
      const status =
        error.code === "NO_WATCHLIST_TICKERS"
          ? 400
          : error.code === "DATABASE_WRITE_FAILED"
          ? 500
          : 500;
      sendJson(response, status, {
        error:
          error.code === "NO_WATCHLIST_TICKERS"
            ? "No watchlist tickers found"
            : error.code === "DATABASE_WRITE_FAILED"
            ? "Database write failed"
            : "Prediction scan failed",
        detail: publicErrorMessage(error, "Prediction scan failed."),
      });
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/congress-feed-status") {
    sendJson(response, 200, congressFeedPublicStatus());
    return;
  }

  if (request.method === "GET" && pathname === "/api/portfolio") {
    if (!isPortfolioOwner(request)) {
      sendJson(response, 401, { error: "Portfolio PIN required" });
      return;
    }
    sendJson(response, 200, { positions: sanitizePortfolio(readJson(PORTFOLIO_FILE, [])) });
    return;
  }

  if (request.method === "PUT" && pathname === "/api/portfolio") {
    if (!isPortfolioOwner(request)) {
      sendJson(response, 401, { error: "Portfolio PIN required" });
      return;
    }
    const body = await collectBody(request);
    const positions = sanitizePortfolio(body.positions);
    writeJson(PORTFOLIO_FILE, positions);
    sendJson(response, 200, { positions });
    return;
  }

  if (request.method === "GET" && pathname === "/api/quote") {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const ticker = String(url.searchParams.get("ticker") || "").toUpperCase().replace(/[^A-Z.-]/g, "").slice(0, 12);
    if (!ticker) {
      sendJson(response, 400, { error: "Ticker required" });
      return;
    }

    try {
      sendJson(response, 200, await fetchMarketQuote(ticker));
    } catch (error) {
      const cached = findCachedQuote(ticker);
      if (cached) {
        sendJson(response, 200, cached);
        return;
      }
      sendJson(response, 400, { error: publicErrorMessage(error, "Quote unavailable.") });
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/events") {
    const body = await collectBody(request);
    const events = readJson(EVENTS_FILE, []);
    events.push({
      at: new Date().toISOString(),
      action: String(body.action || "protect").slice(0, 24),
      invest: Math.max(0, Number(body.invest) || 0),
      save: Math.max(0, Number(body.save) || 0),
      debt: Math.max(0, Number(body.debt) || 0),
    });
    writeJson(EVENTS_FILE, events.slice(-500));
    sendJson(response, 201, { ok: true });
    return;
  }

  if (!isAdmin(request)) {
    sendJson(response, 401, { error: ADMIN_PIN ? "Admin PIN required" : "Admin PIN is not configured." });
    return;
  }

  if (request.method === "GET" && pathname === "/api/admin/config") {
    sendJson(response, 200, readJson(CONFIG_FILE, {}));
    return;
  }

  if (request.method === "PUT" && pathname === "/api/admin/config") {
    const config = sanitizeConfig(await collectBody(request));
    writeJson(CONFIG_FILE, config);
    sendJson(response, 200, config);
    return;
  }

  if (request.method === "GET" && pathname === "/api/admin/summary") {
    sendJson(response, 200, summarizeEvents());
    return;
  }

  if (request.method === "POST" && pathname === "/api/admin/refresh-market") {
    const config = readJson(CONFIG_FILE, {});
    const result = await refreshMarketData(config);
    writeJson(CONFIG_FILE, result.config);
    sendJson(response, result.quotes.length ? 200 : 400, result);
    return;
  }

  if (request.method === "POST" && pathname === "/api/admin/import/congress") {
    const body = await collectBody(request);
    const incoming = Array.isArray(body.trades) ? body.trades : [];
    const config = readJson(CONFIG_FILE, {});
    const imported = incoming.map(normalizeImportedTrade);
    const nextTrades = body.mode === "replace" ? imported : [...(config.congressTrades || []), ...imported];
    const nextConfig = sanitizeConfig({ ...config, congressTrades: nextTrades });
    writeJson(CONFIG_FILE, nextConfig);
    sendJson(response, 200, { imported: imported.length, config: nextConfig });
    return;
  }

  if (request.method === "POST" && pathname === "/api/admin/refresh-policy") {
    sendJson(response, 200, await refreshPolicySignals());
    return;
  }

  if (request.method === "POST" && pathname === "/api/admin/refresh-symbol-universe") {
    sendJson(response, 200, await refreshSymbolUniverse());
    return;
  }

  if (request.method === "POST" && pathname === "/api/admin/refresh-predictions") {
    sendJson(response, 200, await runPredictionScan());
    return;
  }

  if (request.method === "POST" && pathname === "/api/admin/settle-outcomes") {
    sendJson(response, 200, settlePredictionOutcomes(readJson(CONFIG_FILE, {})));
    return;
  }

  if (request.method === "POST" && pathname === "/api/admin/refresh-congress-feed") {
    try {
      sendJson(response, 200, await refreshCongressTradeFeed());
    } catch (error) {
      const status = {
        updatedAt: new Date().toISOString(),
        imported: 0,
        totalTrades: (readJson(CONFIG_FILE, {}).congressTrades || []).length,
        source: CONGRESS_TRADES_FEED_URL || null,
        error: error.message,
      };
      writeJson(CONGRESS_FEED_STATUS_FILE, status);
      sendJson(response, 400, { status, error: error.message });
    }
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function serveFile(response, pathname) {
  const normalized = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(ROOT, normalized));

  if (!filePath.startsWith(ROOT) || filePath.includes(`${path.sep}data${path.sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const publicFiles = new Set(["/login.html", "/styles.css", "/icon.svg"]);

  if (url.pathname.startsWith("/api/")) {
    handleApi(request, response, url.pathname).catch((error) => {
      sendJson(response, 400, { error: publicErrorMessage(error, "Bad request") });
    });
    return;
  }

  if (!isLoggedIn(request) && !publicFiles.has(url.pathname)) {
    sendRedirect(response, "/login.html");
    return;
  }

  if (isLoggedIn(request) && url.pathname === "/login.html") {
    sendRedirect(response, "/");
    return;
  }

  serveFile(response, decodeURIComponent(url.pathname));
});

server.listen(PORT, () => {
  console.log(`Steady Start app: http://localhost:${PORT}`);
  console.log(`Admin backend: http://localhost:${PORT}/admin.html`);
});

if (POLICY_REFRESH_MS > 0) {
  setInterval(() => {
    refreshPolicySignals().catch((error) => {
      writeJson(POLICY_FILE, {
        updatedAt: new Date().toISOString(),
        signals: readJson(POLICY_FILE, { signals: [] }).signals || [],
        errors: [{ source: "policy scheduler", error: error.message }],
      });
    });
  }, POLICY_REFRESH_MS);
}

if (PREDICTION_REFRESH_MS > 0) {
  setInterval(() => {
    refreshPredictions().catch((error) => {
      writeJson(PREDICTIONS_FILE, {
        updatedAt: new Date().toISOString(),
        predictions: readJson(PREDICTIONS_FILE, { predictions: [] }).predictions || [],
        sections: {},
        modelVersion: "v4-top25-ranking-engine",
        errors: [{ source: "prediction scheduler", error: error.message }],
      });
    });
  }, PREDICTION_REFRESH_MS);
}

if (CONGRESS_REFRESH_MS > 0 && CONGRESS_TRADES_FEED_URL) {
  setInterval(() => {
    refreshCongressTradeFeed().catch((error) => {
      writeJson(CONGRESS_FEED_STATUS_FILE, {
        updatedAt: new Date().toISOString(),
        imported: 0,
        totalTrades: (readJson(CONFIG_FILE, {}).congressTrades || []).length,
        source: CONGRESS_TRADES_FEED_URL,
        error: error.message,
      });
    });
  }, CONGRESS_REFRESH_MS);
}
