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
  const freshness = stock.marketUpdatedAt ? 82 : price ? 64 : 38;
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

  return {
    score: Math.round(score),
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
  const institutionalFlow = clamp(congress.score * 0.46 + (Number(stock.qualityScore) || 0) * 0.28 + (Number(stock.pressScore) || 0) * 0.26);
  const volatilityRisk = clamp(100 - (Number(stock.volatilityScore) || 0));
  const liquidity = stock.type === "ETF" ? 84 : clamp((Number(stock.qualityScore) || 0) * 0.48 + (Number(stock.momentumScore) || 0) * 0.52);
  const congressionalActivity = congress.score;
  const unusualVolume = clamp(momentum * 0.42 + Math.abs(marketChange) * 8 + volatilityRisk * 0.18);
  const gapSignal = clamp(Math.abs(marketChange) * 13 + momentum * 0.35);
  const premarketProxy = clamp(marketChange > 0 ? momentum + marketChange * 5 : momentum * 0.55);
  const intradayTrend = clamp(momentum * 0.62 + trend * 0.38);
  const supportResistance = clamp((Number(stock.valuationScore) || 0) * 0.35 + trend * 0.35 + liquidity * 0.3);
  const earningsComing = clamp((Number(stock.pressScore) || 0) * 0.55 + volatilityRisk * 0.25 + momentum * 0.2);
  const analystUpgradeProxy = clamp(newsImpact * 0.62 + sentiment * 0.38);
  const sectorRotation = clamp(sectorStrength * 0.72 + macro * 0.28);
  const fiveDayTrend = clamp(momentum * 0.6 + trend * 0.4);
  const optionsActivityProxy = clamp(volatilityRisk * 0.36 + momentum * 0.4 + newsImpact * 0.24);
  const technicalBreakout = clamp(breakout * 0.76 + supportResistance * 0.24);
  const revenueGrowthProxy = clamp((Number(stock.qualityScore) || 0) * 0.42 + (Number(stock.pressScore) || 0) * 0.34 + trend * 0.24);
  const earningsGrowthProxy = clamp((Number(stock.qualityScore) || 0) * 0.5 + trend * 0.28 + newsImpact * 0.22);
  const valuation = clamp(Number(stock.valuationScore) || 0);
  const insiderBuyingProxy = clamp(congressionalActivity * 0.55 + institutionalFlow * 0.45);
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
    { score: congressionalActivity, weight: 0.13 },
    { score: insiderBuyingProxy, weight: 0.08 },
    { score: sectorStrength, weight: 0.11 },
    { score: thirtyNinetyMomentum, weight: 0.11 },
    { score: companyGuidance, weight: 0.09 },
    { score: institutionalFlow, weight: 0.05 },
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
  const alignment = signalAlignment(dailyModel.score, weeklyModel.score, monthlyModel.score);
  const marketRegime = marketRegimeForStock({ stock, marketChange, momentum, trend, volatilityRisk, macro, sectorStrength });
  const dataQuality = dataQualityBreakdown({ price, stock, policy, congress, liquidity, volatilityRisk, marketChange });
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

  return {
    ticker,
    name: stock.name,
    assetGroup: assetGroup(stock),
    currentPrice: price,
    marketChangePercent: stock.marketChangePercent || "",
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
    scannedAt: new Date().toISOString(),
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
  const previous = readJson(PREDICTIONS_FILE, { predictions: [] });
  const previousByTicker = new Map((previous.predictions || []).map((item) => [item.ticker, item]));
  const predictions = (config.stockIdeas || [])
    .map((stock) => buildPrediction(stock, config, policySignals, previousByTicker))
    .sort((a, b) => b.aiOpportunityScore - a.aiOpportunityScore);
  const result = {
    updatedAt: new Date().toISOString(),
    predictions,
    sections: predictionSections(predictions, previous.sections || {}),
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
  const warnings = [];
  let config = sanitizeConfig(readJson(CONFIG_FILE, {}));
  const tickers = uniqueTickers(config);
  const developmentMode = process.env.NODE_ENV !== "production";

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
    const result = await refreshPredictions({ config, policySignals, warnings });
    if (!Array.isArray(result.predictions) || !result.predictions.length) {
      if (!developmentMode) {
        const error = new Error("Prediction scan failed");
        error.code = "PREDICTION_SCAN_FAILED";
        throw error;
      }
      warnings.push("Prediction scan produced no rows. Development sample predictions were used.");
      return refreshPredictions({ config: samplePredictionConfig(), policySignals, warnings });
    }
    return result;
  } catch (error) {
    if (developmentMode && error.code !== "DATABASE_WRITE_FAILED") {
      warnings.push(`Prediction scan failed: ${error.message}. Development sample predictions were used.`);
      return refreshPredictions({ config: samplePredictionConfig(), policySignals, warnings });
    }
    throw error;
  }
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
    sendJson(response, 200, await runPredictionScan());
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
