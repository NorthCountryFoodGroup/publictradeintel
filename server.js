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
const MARKET_API_KEY = String(process.env.ALPHA_VANTAGE_API_KEY || "").trim();
const POLICY_REFRESH_MS = Number(process.env.POLICY_REFRESH_MS || 60 * 60 * 1000);
const CONGRESS_TRADES_FEED_URL = process.env.CONGRESS_TRADES_FEED_URL || "";
const CONGRESS_TRADES_API_KEY = process.env.CONGRESS_TRADES_API_KEY || "";
const CONGRESS_REFRESH_MS = Number(process.env.CONGRESS_REFRESH_MS || 60 * 60 * 1000);
const PREDICTION_REFRESH_MS = Number(process.env.PREDICTION_REFRESH_MS || 60 * 60 * 1000);
const SESSION_COOKIE = "pti_session";
const sessions = new Map();

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

function sanitizeConfig(config) {
  return {
    thresholds: {
      firstEmergencyTarget: Math.max(0, Number(config?.thresholds?.firstEmergencyTarget) || 100),
      fullEmergencyTarget: Math.max(0, Number(config?.thresholds?.fullEmergencyTarget) || 500),
      debtInvestCap: Math.max(0, Number(config?.thresholds?.debtInvestCap) || 10),
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
      ? config.stockIdeas.slice(0, 12).map((stock) => ({
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
          marketChangePercent: String(stock.marketChangePercent || "").slice(0, 24),
          marketUpdatedAt: String(stock.marketUpdatedAt || "").slice(0, 40),
          marketProvider: String(stock.marketProvider || "").slice(0, 40),
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
          marketChangePercent: String(trade.marketChangePercent || "").slice(0, 24),
          marketUpdatedAt: String(trade.marketUpdatedAt || "").slice(0, 40),
          marketProvider: String(trade.marketProvider || "").slice(0, 40),
        }))
      : [],
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
  const stocks = config.stockIdeas || [];
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

function uniqueTickers(config) {
  const tickers = new Set();
  for (const stock of config.stockIdeas || []) tickers.add(stock.ticker);
  for (const trade of config.congressTrades || []) tickers.add(trade.ticker);
  return [...tickers].filter(Boolean).slice(0, 20);
}

function findCachedQuote(ticker) {
  const symbol = String(ticker || "").toUpperCase().replace(/[^A-Z.-]/g, "").slice(0, 12);
  const config = readJson(CONFIG_FILE, {});
  const candidates = [...(config.stockIdeas || []), ...(config.congressTrades || [])];
  const match = candidates.find((item) => item.ticker === symbol && Number(item.marketPrice) > 0);
  return match
    ? {
        ticker: symbol,
        marketPrice: Number(match.marketPrice),
        marketChangePercent: String(match.marketChangePercent || ""),
        marketUpdatedAt: String(match.marketUpdatedAt || ""),
        marketProvider: String(match.marketProvider || "Saved market data"),
      }
    : null;
}

async function fetchAlphaVantageQuote(ticker) {
  if (!MARKET_API_KEY) {
    throw new Error("Set ALPHA_VANTAGE_API_KEY before refreshing market data.");
  }

  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "GLOBAL_QUOTE");
  url.searchParams.set("symbol", ticker);
  url.searchParams.set("apikey", MARKET_API_KEY);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Market data failed for ${ticker}`);

  const data = await response.json();
  const quote = data["Global Quote"];
  if (!quote || !quote["05. price"]) {
    const message = data.Note || data.Information || data["Error Message"] || `No quote returned for ${ticker}`;
    throw new Error(message);
  }

  return {
    ticker,
    marketPrice: Number(quote["05. price"]),
    marketChange: Number(quote["09. change"]) || null,
    marketChangePercent: String(quote["10. change percent"] || ""),
    marketUpdatedAt: new Date().toISOString(),
    marketProvider: "Alpha Vantage",
  };
}

async function fetchYahooChartQuote(ticker) {
  const symbol = String(ticker || "").toUpperCase().replace(/[^A-Z.-]/g, "").slice(0, 12);
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", "1d");
  url.searchParams.set("interval", "1d");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "PublicTradeIntelQuoteFallback/1.0",
      Accept: "application/json,*/*",
    },
  });
  if (!response.ok) throw new Error(`Fallback quote failed for ${symbol}`);

  const data = await response.json();
  const meta = data?.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  if (!price) throw new Error(`No fallback quote returned for ${symbol}`);

  const previousClose = Number(meta.previousClose || meta.chartPreviousClose) || null;
  const marketChange = previousClose ? price - previousClose : null;
  const marketChangePercent = previousClose ? `${((marketChange / previousClose) * 100).toFixed(2)}%` : "";

  return {
    ticker: symbol,
    marketPrice: price,
    marketChange,
    marketChangePercent,
    marketUpdatedAt: new Date().toISOString(),
    marketProvider: "Yahoo chart",
  };
}

async function fetchMarketQuote(ticker) {
  try {
    return await fetchAlphaVantageQuote(ticker);
  } catch (alphaError) {
    const fallback = await fetchYahooChartQuote(ticker);
    return {
      ...fallback,
      marketProvider: `${fallback.marketProvider} fallback`,
      marketNote: "Primary quote provider unavailable; fallback quote used.",
    };
  }
}

async function refreshMarketData(config) {
  const quotes = [];
  const errors = [];

  for (const ticker of uniqueTickers(config)) {
    try {
      const quote = await fetchMarketQuote(ticker);
      quotes.push(quote);
    } catch (error) {
      errors.push({ ticker, error: error.message });
    }
  }

  const byTicker = new Map(quotes.map((quote) => [quote.ticker, quote]));
  const applyQuote = (item) => {
    const quote = byTicker.get(item.ticker);
    return quote ? { ...item, ...quote } : item;
  };

  return {
    config: sanitizeConfig({
      ...config,
      stockIdeas: (config.stockIdeas || []).map(applyQuote),
      congressTrades: (config.congressTrades || []).map(applyQuote),
    }),
    quotes,
    errors,
  };
}

function predictionCongressMetrics(ticker, trades) {
  const related = (trades || []).filter((trade) => trade.ticker === ticker);
  const buys = related.filter((trade) => trade.transaction === "Buy");
  const sells = related.filter((trade) => trade.transaction === "Sell");
  const visibility = related.reduce((sum, trade) => sum + (Number(trade.signalScore) || 0), 0) / Math.max(1, related.length);
  const bipartisan = new Set(related.map((trade) => trade.party).filter(Boolean)).size > 1 ? 12 : 0;
  const cluster = Math.min(22, buys.length * 8 + related.length * 3);
  const sellPenalty = Math.min(30, sells.length * 14);
  return {
    count: related.length,
    buys: buys.length,
    sells: sells.length,
    members: [...new Set(related.map((trade) => trade.representative).filter(Boolean))],
    score: clamp(visibility * 0.58 + cluster + bipartisan - sellPenalty),
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

function buildPrediction(stock, config, policySignals, previousByTicker) {
  const ticker = stock.ticker;
  const congress = predictionCongressMetrics(ticker, config.congressTrades || []);
  const policy = predictionPolicyMetrics(ticker, policySignals);
  const marketChange = numberPercent(stock.marketChangePercent);
  const price = Number(stock.marketPrice) || null;
  const momentum = clamp((Number(stock.momentumScore) || 0) + marketChange * 1.4);
  const trend = clamp((Number(stock.qualityScore) || 0) * 0.45 + momentum * 0.55);
  const breakout = clamp(momentum * 0.58 + (Number(stock.pressScore) || 0) * 0.26 + policy.score * 0.16);
  const reversal = clamp((100 - (Number(stock.valuationScore) || 0)) * 0.38 + (100 - momentum) * 0.34 + (Number(stock.volatilityScore) || 0) * 0.28);
  const newsImpact = clamp((Number(stock.pressScore) || 0) * 0.55 + policy.score * 0.45);
  const sentiment = clamp((Number(stock.pressScore) || 0) * 0.42 + momentum * 0.4 + policy.positive * 8 - policy.negative * 10);
  const macro = clamp(assetGroup(stock) === "Gold/Silver" ? 70 + Math.max(0, marketChange) * 2 : (Number(stock.committeeScore) || 0) * 0.52 + policy.score * 0.48);
  const sectorStrength = clamp((Number(stock.committeeScore) || 0) * 0.34 + newsImpact * 0.34 + momentum * 0.32);
  const relativeStrength = clamp(momentum * 0.7 + (Number(stock.qualityScore) || 0) * 0.3);
  const institutionalFlow = clamp(congress.score * 0.46 + (Number(stock.qualityScore) || 0) * 0.28 + (Number(stock.pressScore) || 0) * 0.26);
  const volatilityRisk = clamp(100 - (Number(stock.volatilityScore) || 0));
  const liquidity = stock.type === "ETF" ? 84 : clamp((Number(stock.qualityScore) || 0) * 0.48 + (Number(stock.momentumScore) || 0) * 0.52);
  const congressionalActivity = congress.score;

  const opportunityScore = Math.round(
    momentum * 0.16 +
      trend * 0.11 +
      breakout * 0.1 +
      newsImpact * 0.11 +
      sentiment * 0.07 +
      macro * 0.08 +
      sectorStrength * 0.08 +
      relativeStrength * 0.08 +
      institutionalFlow * 0.07 +
      liquidity * 0.05 +
      congressionalActivity * 0.09 -
      volatilityRisk * 0.05,
  );
  const score = clamp(opportunityScore);
  const bearishScore = clamp(volatilityRisk * 0.5 + (100 - trend) * 0.28 + policy.negative * 10 + congress.sells * 8);
  const bullishScore = clamp(score * 0.74 + congress.score * 0.12 + policy.score * 0.14);
  const confidence = clamp((liquidity + trend + newsImpact + Math.max(20, congress.count * 15)) / 4 - volatilityRisk * 0.12);
  const oneDayUpside = Math.max(0.4, score / 58 + marketChange * 0.16);
  const threeDayUpside = oneDayUpside * 1.7;
  const sevenDayUpside = oneDayUpside * 2.7;
  const thirtyDayUpside = oneDayUpside * 5.8;
  const downsideRisk = Math.max(1.2, volatilityRisk / 14 + bearishScore / 38);
  const riskReward = sevenDayUpside / downsideRisk;
  const previous = previousByTicker.get(ticker);
  const previousScore = previous ? Number(previous.aiOpportunityScore) : NaN;
  const scoreChange = Number.isFinite(previousScore) ? Math.round(score - previousScore) : 0;
  const status = predictionStatus(score, previousScore);
  const catalyst = policy.strongest
    ? `${policy.strongest.sourceName}: ${policy.strongest.direction} policy signal`
    : congress.buys
      ? `${congress.buys} congressional buy signal(s)`
      : stock.pressNotes || stock.aiOutlook || "Momentum and quality signals";

  return {
    ticker,
    name: stock.name,
    assetGroup: assetGroup(stock),
    currentPrice: price,
    marketChangePercent: stock.marketChangePercent || "",
    aiOpportunityScore: score,
    bullishScore: Math.round(bullishScore),
    bearishScore: Math.round(bearishScore),
    confidenceScore: Math.round(confidence),
    label: predictionLabel(score),
    status,
    scoreChange,
    expectedTimeHorizon: score >= 82 ? "1-7 days" : score >= 68 ? "3-30 days" : "Watch for confirmation",
    forecasts: {
      oneDay: { expectedUpside: Number(oneDayUpside.toFixed(2)), downsideRisk: Number((downsideRisk * 0.55).toFixed(2)) },
      threeDay: { expectedUpside: Number(threeDayUpside.toFixed(2)), downsideRisk: Number((downsideRisk * 0.8).toFixed(2)) },
      sevenDay: { expectedUpside: Number(sevenDayUpside.toFixed(2)), downsideRisk: Number(downsideRisk.toFixed(2)) },
      thirtyDay: { expectedUpside: Number(thirtyDayUpside.toFixed(2)), downsideRisk: Number((downsideRisk * 1.55).toFixed(2)) },
    },
    suggestedEntryZone: price ? `$${(price * 0.985).toFixed(2)} - $${(price * 1.005).toFixed(2)}` : "Need live price",
    suggestedProfitTarget: price ? `$${(price * (1 + sevenDayUpside / 100)).toFixed(2)}` : "Need live price",
    suggestedStopLevel: price ? `$${(price * (1 - downsideRisk / 100)).toFixed(2)}` : "Need live price",
    estimatedVolatility: Math.round(volatilityRisk),
    riskRewardRatio: Number(riskReward.toFixed(2)),
    primaryCatalyst: catalyst,
    supportingIndicators: [
      `Momentum ${Math.round(momentum)}/100`,
      `Trend ${Math.round(trend)}/100`,
      `News/policy ${Math.round(newsImpact)}/100`,
      `Congress ${Math.round(congress.score)}/100`,
      `Liquidity ${Math.round(liquidity)}/100`,
    ],
    modelScores: {
      momentum: Math.round(momentum),
      trend: Math.round(trend),
      breakout: Math.round(breakout),
      reversal: Math.round(reversal),
      newsImpact: Math.round(newsImpact),
      sentiment: Math.round(sentiment),
      macro: Math.round(macro),
      sectorStrength: Math.round(sectorStrength),
      relativeStrength: Math.round(relativeStrength),
      institutionalFlow: Math.round(institutionalFlow),
      volatility: Math.round(100 - volatilityRisk),
      liquidity: Math.round(liquidity),
      congressionalActivity: Math.round(congressionalActivity),
    },
    congressionalSignal: congress,
    plainEnglish:
      score >= 82
        ? `${ticker} has a strong blended setup across momentum, catalysts, and conviction signals. Size carefully because short-term setups can reverse quickly.`
        : score >= 68
          ? `${ticker} has enough positive evidence to research as a possible trade, but confirmation and position sizing matter.`
          : score >= 52
            ? `${ticker} has some useful signals, but the prediction is not strong enough for an aggressive buy yet.`
            : `${ticker} is not scoring well enough right now. Waiting for better confirmation is the cleaner move.`,
    whatChanged: previous ? `Score ${status} by ${scoreChange >= 0 ? "+" : ""}${scoreChange} points since the last scan.` : "New prediction in this scan.",
    scannedAt: new Date().toISOString(),
  };
}

function predictionSections(predictions) {
  const byScore = [...predictions].sort((a, b) => b.aiOpportunityScore - a.aiOpportunityScore);
  return {
    topBuyCandidates: byScore.slice(0, 6),
    goldSilverOpportunities: byScore.filter((item) => item.assetGroup === "Gold/Silver").slice(0, 5),
    highestMomentum: [...predictions].sort((a, b) => b.modelScores.momentum - a.modelScores.momentum).slice(0, 5),
    strongestSector: [...predictions].sort((a, b) => b.modelScores.sectorStrength - a.modelScores.sectorStrength).slice(0, 5),
    congressionalTradeSignals: byScore.filter((item) => item.congressionalSignal.count > 0).slice(0, 5),
    strongestOneDay: [...predictions].sort((a, b) => b.forecasts.oneDay.expectedUpside - a.forecasts.oneDay.expectedUpside).slice(0, 5),
    strongestSevenDay: [...predictions].sort((a, b) => b.forecasts.sevenDay.expectedUpside - a.forecasts.sevenDay.expectedUpside).slice(0, 5),
    strongestThirtyDay: [...predictions].sort((a, b) => b.forecasts.thirtyDay.expectedUpside - a.forecasts.thirtyDay.expectedUpside).slice(0, 5),
    biggestScoreIncrease: [...predictions].sort((a, b) => b.scoreChange - a.scoreChange).slice(0, 5),
    biggestScoreDrop: [...predictions].sort((a, b) => a.scoreChange - b.scoreChange).slice(0, 5),
  };
}

async function refreshPredictions() {
  const config = sanitizeConfig(readJson(CONFIG_FILE, {}));
  const policySignals = readJson(POLICY_FILE, { updatedAt: null, signals: [], errors: [] });
  const previous = readJson(PREDICTIONS_FILE, { predictions: [] });
  const previousByTicker = new Map((previous.predictions || []).map((item) => [item.ticker, item]));
  const predictions = (config.stockIdeas || [])
    .map((stock) => buildPrediction(stock, config, policySignals, previousByTicker))
    .sort((a, b) => b.aiOpportunityScore - a.aiOpportunityScore);
  const result = {
    updatedAt: new Date().toISOString(),
    predictions,
    sections: predictionSections(predictions),
    modelVersion: "v1-blended-signals",
    notes: [
      "This is a research score, not a guarantee.",
      "Congressional disclosures are delayed and treated as lagging conviction signals.",
      "The learning layer will improve after prediction outcomes are tracked over time.",
    ],
  };
  writeJson(PREDICTIONS_FILE, result);
  return result;
}

function normalizeImportedTrade(trade) {
  return {
    representative: trade.representative || trade.member || trade.name || "Representative",
    state: trade.state || "",
    party: trade.party || "",
    ticker: trade.ticker || trade.symbol || "",
    company: trade.company || trade.asset || trade.assetName || "Company",
    transaction: trade.transaction || trade.type || "Buy",
    reportedRange: trade.reportedRange || trade.amount || trade.range || "Not reported",
    reportedDate: trade.reportedDate || trade.date || trade.filingDate || "",
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

  if (request.method === "GET" && pathname === "/api/predictions") {
    const saved = readJson(PREDICTIONS_FILE, null);
    sendJson(response, 200, saved || (await refreshPredictions()));
    return;
  }

  if (request.method === "GET" && pathname === "/api/congress-feed-status") {
    sendJson(response, 200, readJson(CONGRESS_FEED_STATUS_FILE, { updatedAt: null, imported: 0, totalTrades: 0, source: null, error: null }));
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

  if (request.method === "POST" && pathname === "/api/admin/refresh-predictions") {
    sendJson(response, 200, await refreshPredictions());
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
        modelVersion: "v1-blended-signals",
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
