const fields = {
  cashOnHand: document.querySelector("#cashOnHand"),
  billsDue: document.querySelector("#billsDue"),
  foodGas: document.querySelector("#foodGas"),
  debtPayments: document.querySelector("#debtPayments"),
  emergencyFund: document.querySelector("#emergencyFund"),
  expectedIncome: document.querySelector("#expectedIncome"),
  minimumCushion: document.querySelector("#minimumCushion"),
  debtBalance: document.querySelector("#debtBalance"),
  alreadyInvested: document.querySelector("#alreadyInvested"),
  dividendsEarned: document.querySelector("#dividendsEarned"),
  netWorthIncrease: document.querySelector("#netWorthIncrease"),
};

const output = {
  statusChip: document.querySelector("#statusChip"),
  title: document.querySelector("#recommendationTitle"),
  text: document.querySelector("#recommendationText"),
  invest: document.querySelector("#investAmount"),
  save: document.querySelector("#saveAmount"),
  hold: document.querySelector("#holdAmount"),
  debt: document.querySelector("#debtAmount"),
  goalsGrid: document.querySelector("#goalsGrid"),
  pathsGrid: document.querySelector("#pathsGrid"),
  stockGrid: document.querySelector("#stockGrid"),
  bestStocksGrid: document.querySelector("#bestStocksGrid"),
  dayTradeGrid: document.querySelector("#dayTradeGrid"),
  tradeForm: document.querySelector("#tradeForm"),
  tradeTicker: document.querySelector("#tradeTicker"),
  tradeAmount: document.querySelector("#tradeAmount"),
  tradeBuyPrice: document.querySelector("#tradeBuyPrice"),
  tradeDate: document.querySelector("#tradeDate"),
  refreshPortfolio: document.querySelector("#refreshPortfolio"),
  portfolioPin: document.querySelector("#portfolioPin"),
  portfolioMessage: document.querySelector("#portfolioMessage"),
  portfolioSummary: document.querySelector("#portfolioSummary"),
  portfolioList: document.querySelector("#portfolioList"),
  predictionSummary: document.querySelector("#predictionSummary"),
  predictionGrid: document.querySelector("#predictionGrid"),
  predictionSort: document.querySelector("#predictionSort"),
  runPredictionScan: document.querySelector("#runPredictionScan"),
  predictionScanMessage: document.querySelector("#predictionScanMessage"),
  alertsList: document.querySelector("#alertsList"),
  policySummary: document.querySelector("#policySummary"),
  policySignalsGrid: document.querySelector("#policySignalsGrid"),
  congressGrid: document.querySelector("#congressGrid"),
  memberSummary: document.querySelector("#memberSummary"),
  memberOptions: document.querySelector("#memberOptions"),
  logoutButton: document.querySelector("#logoutButton"),
};

const defaultPlans = [
  {
    name: "$5/week starter plan",
    weekly: 5,
    tone: "Start tiny, prove the habit, and let consistency do the first job.",
  },
  {
    name: "$10/week starter plan",
    weekly: 10,
    tone: "A gentle automatic amount once bills and emergency cash are covered.",
  },
  {
    name: "$25/week momentum plan",
    weekly: 25,
    tone: "A steady step when your cushion is growing and debt is not crowding you.",
  },
  {
    name: "$50/week wealth builder plan",
    weekly: 50,
    tone: "A stronger habit for weeks when your cash buffer has real breathing room.",
  },
];

const defaultGoals = [
  { name: "First $100 saved", target: 100, source: "emergency" },
  { name: "First $500 emergency fund", target: 500, source: "emergency" },
  { name: "First $100 invested", target: 100, source: "invested" },
  { name: "First dividend earned", target: 1, source: "dividend" },
  { name: "First $1,000 net worth increase", target: 1000, source: "netWorth" },
];

const defaultStockIdeas = [
  {
    ticker: "VOO",
    name: "Vanguard S&P 500 ETF",
    type: "ETF",
    risk: "balanced",
    minimumWeekly: 5,
    valuationScore: 72,
    momentumScore: 68,
    qualityScore: 86,
    volatilityScore: 74,
    pressScore: 55,
    pressNotes: "Broad market ETF; no single-company press catalyst.",
    committeeScore: 30,
    committeeNotes: "Low single-policy exposure because it tracks a broad index.",
    aiOutlook: "Broad U.S. market exposure can fit a beginner habit when cash is protected and the holding period is long.",
    riskNote: "Market-wide drawdowns can still happen, so this is not for emergency money.",
  },
];

const defaultCongressTrades = [
  {
    representative: "Nancy Pelosi",
    state: "CA",
    party: "D",
    ticker: "NVDA",
    company: "NVIDIA",
    transaction: "Buy",
    reportedRange: "$1,000,001 - $5,000,000",
    reportedDate: "2024-07-03",
    entryPrice: 123.54,
    entryPriceSource: "Estimated market close near report date",
    sourceUrl: "https://disclosures-clerk.house.gov/FinancialDisclosure",
    watchReason: "Large technology exposure by a high-profile member household.",
    signalScore: 88,
    conflictRisk: "High visibility",
  },
];

const demoValues = {
  cashOnHand: 125,
  billsDue: 40,
  foodGas: 45,
  debtPayments: 20,
  emergencyFund: 60,
  expectedIncome: 0,
  minimumCushion: 25,
  debtBalance: 150,
  alreadyInvested: 35,
  dividendsEarned: 0,
  netWorthIncrease: 0,
};

const settings = {
  thresholds: {
    firstEmergencyTarget: 100,
    fullEmergencyTarget: 500,
    debtInvestCap: 10,
  },
  plans: defaultPlans,
  goals: defaultGoals,
  stockIdeas: defaultStockIdeas,
  congressTrades: defaultCongressTrades,
};

let lastEventKey = "";
let latestRecommendation = null;
let policySignals = { updatedAt: null, signals: [], errors: [] };
let congressFeedStatus = { updatedAt: null, imported: 0, totalTrades: 0, source: null, error: null };
let predictionEngine = { updatedAt: null, predictions: [], sections: {}, modelVersion: "" };
let predictionView = "top25OneDay";
let portfolio = [];

function dollars(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.floor(value)));
}

function dollarsPrecise(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(Number(value) || 0))}`;
}

function percent(value) {
  if (!Number.isFinite(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function parsePercent(value) {
  const parsed = Number(String(value || "").replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function readMoney(id) {
  return Number(fields[id]?.value) || 0;
}

function closestPlan(amount) {
  return settings.plans.reduce((best, plan) => {
    if (amount >= plan.weekly) return plan;
    return best;
  }, null);
}

function calculate() {
  const totals = portfolioTotals();
  const activeInvestAmount = Math.max(50, Math.round(totals.invested || 0));
  const recommendation = {
    status: "Portfolio HUD",
    title: "Track current value",
    text: "Your dashboard now focuses on positions you bought, their current value, and daily profit or loss.",
    invest: activeInvestAmount,
    save: 0,
    hold: 0,
    debt: 0,
  };

  latestRecommendation = recommendation;
  renderRecommendation(recommendation);
  renderGoals({ emergency: 0, invested: totals.invested, dividend: 0, netWorth: totals.totalGain });
  renderPlans(activeInvestAmount);
  renderStockIdeas(activeInvestAmount);
  renderBestStocks(activeInvestAmount);
  renderPredictions();
  renderDayTrades();
  renderCongressAlerts();
  renderPolicySignals();
  renderPortfolio();
  renderMemberOptions();
  renderCongressTrades();
}

function renderRecommendation(recommendation) {
  if (!output.statusChip || !output.title || !output.text) return;
  output.statusChip.textContent = recommendation.status;
  output.title.textContent = recommendation.title;
  output.text.textContent = recommendation.text;
  if (output.invest) output.invest.textContent = dollars(recommendation.invest);
  if (output.save) output.save.textContent = dollars(recommendation.save);
  if (output.hold) output.hold.textContent = dollars(recommendation.hold);
  if (output.debt) output.debt.textContent = dollars(recommendation.debt);
}

function renderGoals(progress) {
  if (!output.goalsGrid) return;
  output.goalsGrid.innerHTML = settings.goals
    .map((goal) => {
      const current = Math.max(0, progress[goal.source] || 0);
      const percent = Math.min(100, Math.round((current / goal.target) * 100));
      const label = goal.source === "dividend" && current === 0 ? "Not yet, and that is okay" : `${dollars(current)} of ${dollars(goal.target)}`;

      return `
        <article class="goal-card">
          <span>${label}</span>
          <strong>${escapeHtml(goal.name)}</strong>
          <div class="meter" aria-label="${escapeHtml(goal.name)}: ${percent}% complete">
            <div class="meter-fill" style="width: ${percent}%"></div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderPlans(investAmount) {
  if (!output.pathsGrid) return;
  output.pathsGrid.innerHTML = settings.plans
    .map((plan) => {
      const yearly = plan.weekly * 52;
      const active = investAmount >= plan.weekly ? " is-active" : "";

      return `
        <article class="path-card${active}">
          <span>${dollars(plan.weekly)} per week</span>
          <strong>${escapeHtml(plan.name)}</strong>
          <p>${escapeHtml(plan.tone)}</p>
          <small>${dollars(yearly)} contributed in one year before market changes</small>
        </article>
      `;
    })
    .join("");
}

function stockFitScore(stock, investAmount) {
  const riskProfile = document.querySelector("#riskProfile").value;
  const timeHorizon = document.querySelector("#timeHorizon").value;
  const weights =
    riskProfile === "cautious"
      ? { valuation: 0.22, momentum: 0.1, quality: 0.32, volatility: 0.36 }
      : riskProfile === "growth"
        ? { valuation: 0.18, momentum: 0.34, quality: 0.3, volatility: 0.18 }
        : { valuation: 0.24, momentum: 0.22, quality: 0.32, volatility: 0.22 };
  const horizonBonus =
    timeHorizon === "long" && stock.type === "ETF" ? 6 : timeHorizon === "short" && stock.risk === "growth" ? -8 : 0;
  const riskPenalty = riskProfile === "cautious" && stock.risk === "growth" ? 14 : 0;
  const affordabilityPenalty = investAmount > 0 && investAmount < stock.minimumWeekly ? 18 : 0;

  return Math.max(
    0,
    Math.round(
      stock.valuationScore * weights.valuation +
        stock.momentumScore * weights.momentum +
        stock.qualityScore * weights.quality +
        stock.volatilityScore * weights.volatility +
        horizonBonus -
        riskPenalty -
        affordabilityPenalty,
    ),
  );
}

function renderStockIdeas(investAmount) {
  if (!output.stockGrid) return;

  if (!investAmount) {
    output.stockGrid.innerHTML = `
      <article class="stock-card">
        <span>Safety gate</span>
        <strong>No stock ideas this week</strong>
        <p>The cash check says to save, hold cash, or handle debt first. That is the right call before any stock suggestion.</p>
      </article>
    `;
    return;
  }

  const ranked = settings.stockIdeas
    .map((stock) => ({ ...stock, fitScore: stockFitScore(stock, investAmount) }))
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 4);

  output.stockGrid.innerHTML = ranked
    .map((stock) => {
      const action = stock.fitScore >= 76 ? "Consider first" : stock.fitScore >= 62 ? "Watchlist" : "Research only";

      return `
        <article class="stock-card">
          <div class="stock-card-top">
            <span>${escapeHtml(stock.type)} | ${escapeHtml(stock.risk)}</span>
            <strong>${escapeHtml(stock.ticker)}</strong>
          </div>
          <h3>${escapeHtml(stock.name)}</h3>
          <div class="score-line">
            <span>${action}</span>
            <strong>${stock.fitScore}/100</strong>
          </div>
          <p>${escapeHtml(stock.aiOutlook)}</p>
          <small>${escapeHtml(stock.riskNote)}</small>
          ${stock.marketPrice ? `<small class="market-line">Market: $${Number(stock.marketPrice).toFixed(2)} ${escapeHtml(stock.marketChangePercent || "")} | ${escapeHtml(stock.marketProvider || "Market data")} ${escapeHtml(stock.marketUpdatedAt || "")}</small>` : ""}
        </article>
      `;
    })
    .join("");
}

function congressionalMetricsForTicker(ticker) {
  const trades = settings.congressTrades.filter((trade) => trade.ticker === ticker);
  const buys = trades.filter((trade) => trade.transaction === "Buy");
  const performanceTrades = trades.filter((trade) => Number(trade.entryPrice) > 0 && Number(trade.marketPrice) > 0);
  const avgReturn = performanceTrades.length
    ? performanceTrades.reduce((sum, trade) => sum + ((Number(trade.marketPrice) - Number(trade.entryPrice)) / Number(trade.entryPrice)) * 100, 0) /
      performanceTrades.length
    : 0;
  const visibility = trades.reduce((sum, trade) => sum + (Number(trade.signalScore) || 0), 0) / Math.max(1, trades.length);

  return {
    tradeCount: trades.length,
    buyCount: buys.length,
    avgReturn,
    visibility,
    members: [...new Set(trades.map((trade) => trade.representative))].filter(Boolean),
  };
}

function bestStockScore(stock) {
  const metrics = congressionalMetricsForTicker(stock.ticker);
  const congressBuyScore = Math.min(100, metrics.buyCount * 38 + metrics.visibility * 0.62);
  const growthAfterTradeScore = Math.max(0, Math.min(100, 56 + metrics.avgReturn * 1.25));
  const momentumScore = Number(stock.momentumScore) || 0;
  const qualityScore = Number(stock.qualityScore) || 0;
  const catalystScore = (Number(stock.pressScore) || 0) * 0.52 + (Number(stock.committeeScore) || 0) * 0.48;
  const volatilityBoost = stock.risk === "growth" ? Math.max(0, 100 - (Number(stock.volatilityScore) || 0)) * 0.28 : 0;

  const score =
    congressBuyScore * 0.3 +
    growthAfterTradeScore * 0.16 +
    catalystScore * 0.24 +
    momentumScore * 0.22 +
    qualityScore * 0.06 +
    volatilityBoost * 0.02;

  return {
    score: Math.round(score),
    congressBuyScore: Math.round(congressBuyScore),
    growthAfterTradeScore: Math.round(growthAfterTradeScore),
    catalystScore: Math.round(catalystScore),
    momentumScore: Math.round(momentumScore),
    qualityScore: Math.round(qualityScore),
    volatilityBoost: Math.round(volatilityBoost),
    metrics,
  };
}

function renderBestStocks(investAmount) {
  if (!output.bestStocksGrid) return;

  const ranked = settings.stockIdeas
    .map((stock) => ({ ...stock, best: bestStockScore(stock) }))
    .sort((a, b) => b.best.score - a.best.score)
    .slice(0, 5);

  output.bestStocksGrid.innerHTML = ranked
    .map((stock, index) => {
      const mode = investAmount > 0 ? "Buy recommendation" : "Growth watch recommendation";
      const action =
        stock.best.score >= 82
          ? "Highest growth potential"
          : stock.best.score >= 72
            ? "Aggressive buy candidate"
            : stock.best.score >= 62
              ? "Momentum watch"
              : "Speculative research";
      const memberLine = stock.best.metrics.members.length
        ? `Tracked members: ${stock.best.metrics.members.map(escapeHtml).join(", ")}`
        : "No tracked congressional buyers yet.";
      const recommendation = stock.best.score >= 72 ? "Suggested action: consider buying before lower-ranked ideas." : "Suggested action: research before buying.";

      return `
        <article class="stock-card best-card">
          <div class="stock-card-top">
            <span>#${index + 1} | ${mode}</span>
            <strong>${escapeHtml(stock.ticker)}</strong>
          </div>
          <h3>${escapeHtml(stock.name)}</h3>
          <div class="score-line">
            <span>${action}</span>
            <strong>${stock.best.score}/100</strong>
          </div>
          <div class="signal-list">
            <span>Congress buys: ${stock.best.metrics.buyCount} (${stock.best.congressBuyScore}/100)</span>
            <span>After-trade growth: ${percent(stock.best.metrics.avgReturn)} (${stock.best.growthAfterTradeScore}/100)</span>
            <span>Press/committee catalysts: ${stock.best.catalystScore}/100</span>
            <span>Momentum: ${stock.best.momentumScore}/100</span>
            <span>Quality: ${stock.best.qualityScore}/100</span>
          </div>
          <p><strong>${recommendation}</strong></p>
          <p>${escapeHtml(stock.pressNotes || "No press catalyst note yet.")}</p>
          <p>${escapeHtml(stock.committeeNotes || "No committee relevance note yet.")}</p>
          <small>${memberLine}</small>
          ${stock.marketPrice ? `<small class="market-line">Market: $${Number(stock.marketPrice).toFixed(2)} ${escapeHtml(stock.marketChangePercent || "")}</small>` : ""}
        </article>
      `;
    })
    .join("");
}

function daysSince(dateText) {
  const time = Date.parse(dateText);
  if (!Number.isFinite(time)) return 9999;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function sameDayCongressPatternForTicker(ticker) {
  const trades = settings.congressTrades.filter((trade) => trade.ticker === ticker);
  const buys = trades.filter((trade) => trade.transaction === "Buy");
  const recentBuys = buys.filter((trade) => daysSince(trade.reportedDate) <= 45);
  const avgSignal = trades.reduce((sum, trade) => sum + (Number(trade.signalScore) || 0), 0) / Math.max(1, trades.length);
  const highVisibilityBuys = buys.filter((trade) => (Number(trade.signalScore) || 0) >= 70).length;

  return {
    trades,
    buys,
    recentBuys,
    avgSignal,
    highVisibilityBuys,
    members: [...new Set(trades.map((trade) => trade.representative))].filter(Boolean),
  };
}

function dayTradeScore(stock) {
  const pattern = sameDayCongressPatternForTicker(stock.ticker);
  const momentum = Number(stock.momentumScore) || 0;
  const press = Number(stock.pressScore) || 0;
  const committee = Number(stock.committeeScore) || 0;
  const volatilityOpportunity = Math.max(0, 100 - (Number(stock.volatilityScore) || 0));
  const congressPatternScore = Math.min(
    100,
    pattern.recentBuys.length * 22 + pattern.highVisibilityBuys * 18 + pattern.avgSignal * 0.42,
  );
  const catalystUrgency = press * 0.58 + committee * 0.42;
  const marketSpark = stock.marketChangePercent
    ? Math.min(100, Math.abs(Number(String(stock.marketChangePercent).replace("%", ""))) * 14 + 48)
    : momentum;

  const score =
    momentum * 0.3 +
    volatilityOpportunity * 0.22 +
    catalystUrgency * 0.22 +
    congressPatternScore * 0.2 +
    marketSpark * 0.06;

  return {
    score: Math.round(score),
    momentum: Math.round(momentum),
    volatilityOpportunity: Math.round(volatilityOpportunity),
    catalystUrgency: Math.round(catalystUrgency),
    congressPatternScore: Math.round(congressPatternScore),
    marketSpark: Math.round(marketSpark),
    pattern,
  };
}

function renderDayTrades() {
  if (!output.dayTradeGrid) return;

  const ranked = settings.stockIdeas
    .filter((stock) => stock.type === "Stock")
    .map((stock) => ({ ...stock, day: dayTradeScore(stock) }))
    .sort((a, b) => b.day.score - a.day.score)
    .slice(0, 5);

  output.dayTradeGrid.innerHTML = ranked
    .map((stock, index) => {
      const action =
        stock.day.score >= 82
          ? "Best same-day candidate"
          : stock.day.score >= 70
            ? "High-alert day trade"
            : stock.day.score >= 58
              ? "Watch for breakout"
              : "Only if volume confirms";
      const members = stock.day.pattern.members.length
        ? stock.day.pattern.members.map(escapeHtml).join(", ")
        : "No tracked member overlap";

      return `
        <article class="stock-card best-card">
          <div class="stock-card-top">
            <span>#${index + 1} | Buy today / sell today</span>
            <strong>${escapeHtml(stock.ticker)}</strong>
          </div>
          <h3>${escapeHtml(stock.name)}</h3>
          <div class="score-line">
            <span>${action}</span>
            <strong>${stock.day.score}/100</strong>
          </div>
          <div class="signal-list">
            <span>Momentum: ${stock.day.momentum}/100</span>
            <span>Volatility opportunity: ${stock.day.volatilityOpportunity}/100</span>
            <span>Fresh catalyst urgency: ${stock.day.catalystUrgency}/100</span>
            <span>Congress pattern match: ${stock.day.congressPatternScore}/100</span>
            <span>Recent congressional buys: ${stock.day.pattern.recentBuys.length}</span>
          </div>
          <p><strong>Same-day thesis:</strong> ${escapeHtml(stock.pressNotes || stock.aiOutlook || "Momentum and catalyst signal are driving this candidate.")}</p>
          <p>Congress overlap: ${members}</p>
          ${stock.marketPrice ? `<small class="market-line">Current reference: $${Number(stock.marketPrice).toFixed(2)} ${escapeHtml(stock.marketChangePercent || "")}</small>` : ""}
        </article>
      `;
    })
    .join("");
}

function pct(value) {
  if (value === null || value === undefined || value === "") return "n/a";
  return `${Number(value || 0).toFixed(2)}%`;
}

function compactValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "n/a";
  return `${value}${suffix}`;
}

function predictionToneClass(label) {
  if (label === "Strong AI Buy Candidate" || label === "Strong Daily Setup" || label === "Strong Weekly Setup" || label === "Strong Monthly Setup") return "gain";
  if (label === "Possible Trade" || label === "Possible Daily Trade" || label === "Possible Weekly Trade" || label === "Possible Monthly Trade") return "possible";
  if (label === "Avoid for Now" || label === "Bad for Today" || label === "Weak This Week" || label === "Weak This Month") return "loss";
  return "";
}

function alignmentToneClass(type) {
  if (type === "high-alignment") return "gain";
  if (type === "short-term-only" || type === "wait-for-entry" || type === "partial-alignment") return "possible";
  if (type === "avoid") return "loss";
  return "";
}

function fallbackAlignment(item) {
  const daily = scoreValue(item.oneDayScore || item.dailyScore);
  const weekly = scoreValue(item.sevenDayScore || item.weeklyScore);
  const monthly = scoreValue(item.thirtyDayScore || item.monthlyScore);
  const dailyBullish = daily >= 70;
  const weeklyBullish = weekly >= 70;
  const monthlyBullish = monthly >= 70;
  const dailyWeak = daily < 55;
  const weeklyWeak = weekly < 55;
  const monthlyWeak = monthly < 55;

  if (dailyBullish && weeklyBullish && monthlyBullish) return { label: "High-Alignment Opportunity", type: "high-alignment", action: "All three timeframes are bullish." };
  if (dailyBullish && monthlyWeak) return { label: "Short-Term Only", type: "short-term-only", action: "Daily is bullish, but monthly is weak." };
  if (monthlyBullish && dailyWeak) return { label: "Wait for Better Entry", type: "wait-for-entry", action: "Monthly is bullish, but today is weak." };
  if (dailyWeak && weeklyWeak && monthlyWeak) return { label: "Avoid", type: "avoid", action: "All three timeframes are weak." };
  if (weeklyBullish && (dailyBullish || monthlyBullish)) return { label: "Partial Alignment", type: "partial-alignment", action: "Two timeframes are supportive." };
  return { label: "Mixed Signals", type: "mixed", action: "The timeframes disagree." };
}

function predictionModelForView(item) {
  const models = item.timeframeModels || {};
  if (predictionView === "top25OneDay" || predictionView === "bestFiveOneDay" || predictionView === "oneDayOpportunities" || predictionView === "dailyOpportunities" || predictionView === "strongestOneDay" || predictionView === "avoidList") return models.oneDay || models.daily || null;
  if (predictionView === "threeDayOpportunities" || predictionView === "strongestThreeDay") return models.threeDay || null;
  if (predictionView === "top25SevenDay" || predictionView === "bestFiveSevenDay" || predictionView === "sevenDayOpportunities" || predictionView === "weeklyOpportunities" || predictionView === "strongestSevenDay") return models.sevenDay || models.weekly || null;
  if (predictionView === "top25OneMonth" || predictionView === "bestFiveOneMonth" || predictionView === "thirtyDayOpportunities" || predictionView === "monthlyOpportunities" || predictionView === "strongestThirtyDay") return models.thirtyDay || models.monthly || null;
  if (predictionView === "top25OneYear" || predictionView === "bestFiveOneYear") return models.oneYear || null;
  const best = String(item.bestTimeframe || "").toLowerCase();
  if (best.includes("year")) return models.oneYear || null;
  if (best.includes("month")) return models.thirtyDay || models.monthly || null;
  if (best.includes("7")) return models.sevenDay || models.weekly || null;
  if (best.includes("1-day")) return models.oneDay || models.daily || null;
  return models[best] || models[best.replace("-", "")] || models.sevenDay || models.weekly || models.oneDay || models.daily || models.thirtyDay || models.monthly || null;
}

function predictionModelTitle(model) {
  if (!model) return "Selected timeframe";
  return `${model.name} Model`;
}

function scoreValue(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function sortedPredictionRows(rows) {
  const sort = output.predictionSort?.value || "rank";
  const list = [...rows];
  if (sort === "upside") return list.sort((a, b) => (Number(b.expectedUpside) || Number(b.forecasts?.sevenDay?.expectedUpside) || 0) - (Number(a.expectedUpside) || Number(a.forecasts?.sevenDay?.expectedUpside) || 0));
  if (sort === "confidence") return list.sort((a, b) => (Number(b.confidenceScore) || 0) - (Number(a.confidenceScore) || 0));
  if (sort === "risk") return list.sort((a, b) => (Number(a.riskScore) || 0) - (Number(b.riskScore) || 0));
  if (sort === "riskReward") return list.sort((a, b) => (Number(b.riskRewardRatio) || 0) - (Number(a.riskRewardRatio) || 0));
  if (sort === "improved") return list.sort((a, b) => (Number(b.scoreChange) || 0) - (Number(a.scoreChange) || 0));
  if (sort === "smallAccount") return list.sort((a, b) => ((Number(b.confidenceScore) || 0) - (Number(b.riskScore) || 0)) - ((Number(a.confidenceScore) || 0) - (Number(a.riskScore) || 0)));
  return list.sort((a, b) => (Number(a.rank) || 999) - (Number(b.rank) || 999));
}

function renderComparisonRows(rows) {
  output.predictionGrid.innerHTML = rows
    .map((item) => `
      <article class="prediction-card">
        <div class="stock-card-top">
          <span>${escapeHtml(item.label || "Comparison")}</span>
          <strong>${escapeHtml(item.ticker)}</strong>
        </div>
        <h3>${escapeHtml(item.name || item.ticker)}</h3>
        <div class="signal-list">
          ${(item.lists || [])
            .map((entry) => `<span>${escapeHtml(entry.timeframe)}: #${entry.rank} (${Number(entry.score) || 0}/100)</span>`)
            .join("")}
        </div>
      </article>
    `)
    .join("");
}

function renderPredictions() {
  if (!output.predictionGrid || !output.predictionSummary) return;
  const predictions = predictionEngine.predictions || [];
  const active = predictionEngine.sections?.[predictionView] || predictions.slice(0, 25);
  const strong = predictions.filter((item) => item.label === "Strong AI Buy Candidate").length;
  const oneDayAvg = predictions.length
    ? Math.round(predictions.reduce((sum, item) => sum + scoreValue(item.oneDayScore || item.dailyScore), 0) / predictions.length)
    : 0;
  const threeDayAvg = predictions.length
    ? Math.round(predictions.reduce((sum, item) => sum + scoreValue(item.threeDayScore || item.weeklyScore), 0) / predictions.length)
    : 0;
  const sevenDayAvg = predictions.length
    ? Math.round(predictions.reduce((sum, item) => sum + scoreValue(item.sevenDayScore || item.weeklyScore), 0) / predictions.length)
    : 0;
  const thirtyDayAvg = predictions.length
    ? Math.round(predictions.reduce((sum, item) => sum + scoreValue(item.thirtyDayScore || item.monthlyScore), 0) / predictions.length)
    : 0;
  const avgScore = predictions.length
    ? Math.round(predictions.reduce((sum, item) => sum + Number(item.aiOpportunityScore || 0), 0) / predictions.length)
    : 0;

  output.predictionSummary.innerHTML = `
    <div>
      <span>Last scan</span>
      <strong>${predictionEngine.updatedAt ? new Date(predictionEngine.updatedAt).toLocaleString() : "Not scanned yet"}</strong>
    </div>
    <div>
      <span>Tracked assets</span>
      <strong>${predictions.length}</strong>
    </div>
    <div>
      <span>1-day avg</span>
      <strong>${oneDayAvg}/100</strong>
    </div>
    <div>
      <span>3-day avg</span>
      <strong>${threeDayAvg}/100</strong>
    </div>
    <div>
      <span>7-day avg</span>
      <strong>${sevenDayAvg}/100</strong>
    </div>
    <div>
      <span>30-day avg</span>
      <strong>${thirtyDayAvg}/100</strong>
    </div>
    <div>
      <span>Overall avg</span>
      <strong>${avgScore}/100</strong>
    </div>
  `;

  if (!active.length) {
    output.predictionGrid.innerHTML = `
      <article class="stock-card">
        <span>No predictions yet</span>
        <strong>Run a prediction scan</strong>
        <p>The backend will load the watchlist, refresh market/news/congressional/policy signals, score each ticker, save the prediction records, and refresh this dashboard.</p>
        <button type="button" class="inline-scan-button" data-run-prediction-scan>Run prediction scan</button>
      </article>
    `;
    return;
  }

  if (predictionView === "comparisonView") {
    renderComparisonRows(active);
    return;
  }

  output.predictionGrid.innerHTML = sortedPredictionRows(active)
    .map((item) => {
      const model = predictionModelForView(item);
      const alignment = item.signalAlignment || fallbackAlignment(item);
      const modelLabel = model?.label || item.label || "Research candidate";
      const tone = predictionToneClass(modelLabel);
      const alignmentTone = alignmentToneClass(alignment.type);
      const entryZone = model?.entryZone || item.suggestedEntryZone || "Needs current market data";
      const profitTarget = model?.profitTarget || item.suggestedProfitTarget || "Needs current market data";
      const stopLevel = model?.stopLevel || item.suggestedStopLevel || "Needs current market data";
      const reasons = Array.isArray(model?.reasons) && model.reasons.length ? model.reasons : [item.predictionReason || item.plainEnglish || item.primaryCatalyst];
      const failureRisks = Array.isArray(model?.failureRisks) && model.failureRisks.length ? model.failureRisks : [item.failureRisk || "The setup can fail if market conditions change faster than the signal updates."];
      const similar = item.similarSetupHistory || {};
      const regime = item.marketRegime || {};
      const quality = item.dataQuality || {};
      const leaderboard = item.modelLeaderboard || {};
      const technical = model?.technicalAnalysis || item.technicalAnalysis?.oneDay || {};
      const intradayAlignment = item.multiTimeframeAlignment || model?.multiTimeframeAlignment || {};
      return `
        <article class="prediction-card">
          <div class="stock-card-top">
            <span>${escapeHtml(item.assetGroup)} | Best: ${escapeHtml(item.bestTimeframe || "mixed")}</span>
            <strong>${escapeHtml(item.ticker)}</strong>
          </div>
          <h3>${item.rank ? `#${item.rank} ` : ""}${escapeHtml(item.name)}</h3>
          <div class="alignment-pill ${alignmentTone}">
            <strong>${escapeHtml(alignment.label)}</strong>
            <span>${escapeHtml(alignment.action)}</span>
          </div>
          <div class="score-line ${tone}">
            <span>${escapeHtml(modelLabel)}</span>
            <strong>${Number(item.aiOpportunityScore) || 0}/100</strong>
          </div>
          <div class="prediction-meter" aria-label="AI Opportunity Score ${Number(item.aiOpportunityScore) || 0}">
            <div style="width: ${Math.min(100, Number(item.aiOpportunityScore) || 0)}%"></div>
          </div>
          <div class="timeframe-score-grid">
            <div>
              <span>Ranked score</span>
              <strong>${scoreValue(item.aiScore || item.aiOpportunityScore)}/100</strong>
              <small>${escapeHtml(item.timeframe || item.bestTimeframe || "overall")}</small>
            </div>
            <div>
              <span>1-Day Score</span>
              <strong>${scoreValue(item.oneDayScore || item.dailyScore)}/100</strong>
              <small>1-day setup</small>
            </div>
            <div>
              <span>3-Day Score</span>
              <strong>${scoreValue(item.threeDayScore || item.weeklyScore)}/100</strong>
              <small>3-day setup</small>
            </div>
            <div>
              <span>7-Day Score</span>
              <strong>${scoreValue(item.sevenDayScore || item.weeklyScore)}/100</strong>
              <small>7-day setup</small>
            </div>
            <div>
              <span>30-Day Score</span>
              <strong>${scoreValue(item.thirtyDayScore || item.monthlyScore)}/100</strong>
              <small>30-day setup</small>
            </div>
            <div>
              <span>1-Year Score</span>
              <strong>${scoreValue(item.oneYearScore)}/100</strong>
              <small>1-year hold</small>
            </div>
          </div>
          <div class="signal-list">
            <span>Overall Opportunity Score: ${Number(item.aiOpportunityScore) || 0}/100</span>
            <span>Confidence Score: ${Number(item.confidenceScore) || 0}/100</span>
            <span>Risk Score: ${Number(item.riskScore) || 0}/100</span>
            <span>Data Quality Score: ${Number(quality.score) || 0}/100</span>
            <span>Market regime: ${escapeHtml(regime.primary || "unknown")}</span>
            <span>Technical score: ${Number(technical.technicalSignalScore) || 0}/100</span>
            <span>Trend: ${escapeHtml(technical.trendDirection || "unknown")}</span>
            <span>2m/5m/15m alignment: ${escapeHtml(intradayAlignment.alignmentDirection || "unknown")} (${Number(intradayAlignment.alignmentScore) || 0}/100)</span>
            <span>Price vs 9/20 EMA: ${compactValue(technical.priceVs9Ema, "%")} / ${compactValue(technical.priceVs20Ema, "%")}</span>
            <span>Support / resistance: ${technical.nearestSupport ? `$${Number(technical.nearestSupport).toFixed(2)}` : "n/a"} / ${technical.nearestResistance ? `$${Number(technical.nearestResistance).toFixed(2)}` : "n/a"}</span>
            <span>${escapeHtml(predictionModelTitle(model))} upside: ${pct(model?.expectedUpside)}</span>
            <span>${escapeHtml(predictionModelTitle(model))} downside: ${pct(model?.downsideRisk)}</span>
            <span>Risk/reward: ${Number(item.riskRewardRatio || 0).toFixed(2)}</span>
          </div>
          <div class="trade-levels">
            <div><span>${escapeHtml(predictionModelTitle(model))} entry</span><strong>${escapeHtml(entryZone)}</strong></div>
            <div><span>Target</span><strong>${escapeHtml(profitTarget)}</strong></div>
            <div><span>Fail line</span><strong>${escapeHtml(stopLevel)}</strong></div>
          </div>
          <div class="model-reasons">
            <strong>Why this made the Top 25</strong>
            <p>${escapeHtml(item.whyTop25 || item.reasonForRecommendation || reasons[0] || "Ranked by AI score and supporting signals.")}</p>
            ${reasons.slice(1).map((reason) => `<p>${escapeHtml(reason)}</p>`).join("")}
          </div>
          <div class="model-reasons failure-list">
            <strong>Why this may be wrong</strong>
            <p>${escapeHtml(item.whyMayBeWrong || failureRisks[0] || "The prediction can fail if market conditions change.")}</p>
            <p>${escapeHtml(item.fallOffReason || "It falls off the list if stronger opportunities outrank it.")}</p>
          </div>
          ${item.rankMovement ? `<div class="rank-change"><strong>Changed since last scan</strong><span>${escapeHtml(item.rankMovement.explanation)}</span></div>` : ""}
          <div class="research-grid">
            <div>
              <strong>Similar setup history</strong>
              <span>Past setups: ${compactValue(similar.similarPastSetups)}</span>
              <span>Win rate: ${compactValue(similar.winRate, "%")}</span>
              <span>Avg 1d / 3d / 7d / 30d: ${pct(similar.averageReturnAfter1Day)} / ${pct(similar.averageReturnAfter3Days)} / ${pct(similar.averageReturnAfter7Days)} / ${pct(similar.averageReturnAfter30Days)}</span>
              <span>Best / worst: ${pct(similar.bestCase)} / ${pct(similar.worstCase)}</span>
              <small>${escapeHtml(similar.confidenceLevel || similar.note || "Building history from saved scans.")}</small>
            </div>
            <div>
              <strong>Model leaderboard</strong>
              <span>Best today: ${escapeHtml(leaderboard.bestModelToday || "Tracking")}</span>
              <span>Best week: ${escapeHtml(leaderboard.bestModelThisWeek || "Tracking")}</span>
              <span>Best month: ${escapeHtml(leaderboard.bestModelThisMonth || "Tracking")}</span>
              <span>Weakest: ${escapeHtml(leaderboard.worstPerformingModel || "Tracking")}</span>
              <small>${escapeHtml(leaderboard.note || "Outcome leaderboard starts after predictions expire.")}</small>
            </div>
            <div>
              <strong>Portfolio impact</strong>
              <span>${escapeHtml(item.portfolioImpact?.positionOverlap || "No portfolio impact data yet")}</span>
              <span>${escapeHtml(item.portfolioImpact?.sectorConcentration || "")}</span>
              <span>${escapeHtml(item.portfolioImpact?.volatilityImpact || "")}</span>
              <small>Best timeframe: ${escapeHtml(item.portfolioImpact?.bestForTimeframe || item.bestTimeframe || "mixed")}</small>
            </div>
          </div>
          <small>${escapeHtml(item.whatChanged || item.plainEnglish || "")}</small>
        </article>
      `;
    })
    .join("");
}

function predictionErrorMessage(error, fallback = "Prediction scan failed") {
  const message = String(error?.message || fallback);
  if (/failed to fetch|network/i.test(message)) return "Backend route not connected";
  if (/No watchlist tickers found/i.test(message)) return "No watchlist tickers found";
  if (/Market data API key missing/i.test(message)) return "Market data API key missing";
  if (/Database write failed/i.test(message)) return "Database write failed";
  if (/Prediction scan failed/i.test(message)) return "Prediction scan failed";
  return message;
}

async function runPredictionScan() {
  if (!output.runPredictionScan && !output.predictionGrid) return;
  const buttons = [output.runPredictionScan, ...document.querySelectorAll("[data-run-prediction-scan]")].filter(Boolean);
  buttons.forEach((button) => {
    button.disabled = true;
    button.textContent = "Scanning...";
  });
  if (output.predictionScanMessage) output.predictionScanMessage.textContent = "Running prediction scan...";

  try {
    const response = await fetch("api/predictions/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    let result = null;
    try {
      result = await response.json();
    } catch {
      throw new Error("Backend route not connected");
    }
    if (!response.ok) throw new Error(result.error || result.detail || "Prediction scan failed");
    predictionEngine = result;
    const warningText = Array.isArray(result.warnings) && result.warnings.length ? ` Warnings: ${result.warnings.join(" ")}` : "";
    if (output.predictionScanMessage) output.predictionScanMessage.textContent = `Prediction scan complete. ${result.predictions?.length || 0} records generated.${warningText}`;
    renderPredictions();
  } catch (error) {
    if (output.predictionScanMessage) output.predictionScanMessage.textContent = predictionErrorMessage(error);
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
      button.textContent = "Run prediction scan";
    });
  }
}

function loadPortfolio() {
  try {
    const saved = JSON.parse(localStorage.getItem("publicTradeIntelPortfolio") || "[]");
    portfolio = Array.isArray(saved) ? saved : [];
  } catch {
    portfolio = [];
  }
}

async function loadPortfolioFromServer() {
  loadPortfolio();
  if (location.protocol === "file:") return;

  const pin = localStorage.getItem("publicTradeIntelPortfolioPin") || "";
  if (output.portfolioPin) output.portfolioPin.value = pin;
  if (!pin) return;

  try {
    const response = await fetch("api/portfolio", {
      cache: "no-store",
      headers: { "x-portfolio-pin": pin },
    });
    if (!response.ok) throw new Error("Portfolio unavailable");
    const data = await response.json();
    const serverPositions = Array.isArray(data.positions) ? data.positions : [];
    if (serverPositions.length) {
      portfolio = serverPositions;
      localStorage.setItem("publicTradeIntelPortfolio", JSON.stringify(portfolio));
    } else if (portfolio.length) {
      await savePortfolio();
    }
  } catch {
    // Keep the browser copy as a fallback if the backend is unavailable.
  }
}

async function savePortfolio() {
  localStorage.setItem("publicTradeIntelPortfolio", JSON.stringify(portfolio));

  if (location.protocol === "file:") return;
  const pin = localStorage.getItem("publicTradeIntelPortfolioPin") || "";
  if (!pin) {
    output.portfolioMessage.textContent = "Saved on this device. Enter your Portfolio PIN to sync it to the app backend.";
    return;
  }

  try {
    await fetch("api/portfolio", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-portfolio-pin": pin },
      body: JSON.stringify({ positions: portfolio }),
    });
  } catch {
    output.portfolioMessage.textContent = "Saved on this device. Cloud portfolio save is temporarily unavailable.";
  }
}

function cachedMarketQuote(ticker) {
  const symbol = String(ticker || "").toUpperCase();
  const candidates = [...settings.stockIdeas, ...settings.congressTrades];
  const match = candidates.find((item) => item.ticker === symbol && Number(item.marketPrice) > 0);
  return match
    ? {
        ticker: symbol,
        marketPrice: Number(match.marketPrice),
        marketChangePercent: match.marketChangePercent || "",
        marketUpdatedAt: match.marketUpdatedAt || "",
        marketProvider: match.marketProvider || "Saved market data",
      }
    : null;
}

async function fetchQuote(ticker) {
  const symbol = String(ticker || "").toUpperCase().replace(/[^A-Z.-]/g, "").slice(0, 12);
  if (!symbol) throw new Error("Enter a ticker.");

  if (location.protocol !== "file:") {
    try {
      const response = await fetch(`api/quote?ticker=${encodeURIComponent(symbol)}`, { cache: "no-store" });
      if (response.ok) return response.json();
    } catch {
      // Fall back to saved watchlist data below.
    }
  }

  const cached = cachedMarketQuote(symbol);
  if (cached) return cached;
  throw new Error("No market price available yet. Add a buy price manually or connect ALPHA_VANTAGE_API_KEY.");
}

function positionStats(position) {
  const currentPrice = Number(position.currentPrice || position.buyPrice) || 0;
  const buyPrice = Number(position.buyPrice) || 0;
  const shares = Number(position.shares) || 0;
  const invested = Number(position.amountInvested) || shares * buyPrice;
  const currentValue = shares * currentPrice;
  const totalGain = currentValue - invested;
  const totalReturn = invested > 0 ? (totalGain / invested) * 100 : 0;
  const changePercent = parsePercent(position.marketChangePercent);
  const previousClose = changePercent === null ? null : currentPrice / (1 + changePercent / 100);
  const latestSnapshot = Array.isArray(position.dailySnapshots) ? position.dailySnapshots.at(-1) : null;
  const todayGain =
    previousClose && previousClose > 0
      ? shares * (currentPrice - previousClose)
      : latestSnapshot
        ? currentValue - Number(latestSnapshot.currentValue || 0)
        : null;
  const todayReturn =
    previousClose && previousClose > 0
      ? ((currentPrice - previousClose) / previousClose) * 100
      : latestSnapshot && Number(latestSnapshot.currentValue) > 0
        ? (todayGain / Number(latestSnapshot.currentValue)) * 100
        : null;

  return { currentPrice, buyPrice, shares, invested, currentValue, totalGain, totalReturn, todayGain, todayReturn };
}

function withDailySnapshot(position) {
  const stats = positionStats(position);
  const today = new Date().toISOString().slice(0, 10);
  const snapshots = Array.isArray(position.dailySnapshots) ? [...position.dailySnapshots] : [];
  const snapshot = {
    date: today,
    currentPrice: stats.currentPrice,
    currentValue: stats.currentValue,
    totalGain: stats.totalGain,
    totalReturn: stats.totalReturn,
  };

  const lastIndex = snapshots.findIndex((item) => item.date === today);
  if (lastIndex >= 0) snapshots[lastIndex] = snapshot;
  else snapshots.push(snapshot);

  return { ...position, dailySnapshots: snapshots.slice(-30) };
}

function portfolioTotals() {
  return portfolio.reduce(
    (totals, position) => {
      const stats = positionStats(position);
      totals.invested += stats.invested;
      totals.currentValue += stats.currentValue;
      totals.totalGain += stats.totalGain;
      if (stats.todayGain !== null) totals.todayGain += stats.todayGain;
      return totals;
    },
    { invested: 0, currentValue: 0, totalGain: 0, todayGain: 0 },
  );
}

function renderPortfolio() {
  if (!output.portfolioList || !output.portfolioSummary) return;

  const totals = portfolioTotals();
  const totalReturn = totals.invested > 0 ? (totals.totalGain / totals.invested) * 100 : 0;
  const gainClass = totals.totalGain >= 0 ? "gain" : "loss";
  const todayClass = totals.todayGain >= 0 ? "gain" : "loss";

  output.portfolioSummary.innerHTML = `
    <div>
      <span>Invested</span>
      <strong>${dollarsPrecise(totals.invested)}</strong>
    </div>
    <div>
      <span>Current value</span>
      <strong>${dollarsPrecise(totals.currentValue)}</strong>
    </div>
    <div class="return-box ${gainClass}">
      <span>Total made/lost</span>
      <strong>${dollarsPrecise(totals.totalGain)}</strong>
    </div>
    <div class="return-box ${todayClass}">
      <span>Today made/lost</span>
      <strong>${dollarsPrecise(totals.todayGain)}</strong>
    </div>
    <div>
      <span>Total return</span>
      <strong>${percent(totalReturn)}</strong>
    </div>
  `;

  if (!portfolio.length) {
    output.portfolioList.innerHTML = `
      <article class="portfolio-card">
        <strong>No buys tracked yet</strong>
        <p>Add a ticker and the amount you invested. This section will become your daily profit/loss log.</p>
      </article>
    `;
    return;
  }

  output.portfolioList.innerHTML = portfolio
    .map((position) => {
      const stats = positionStats(position);
      const totalClass = stats.totalGain >= 0 ? "gain" : "loss";
      const todayClass = stats.todayGain === null || stats.todayGain >= 0 ? "gain" : "loss";
      const snapshots = Array.isArray(position.dailySnapshots) ? position.dailySnapshots.slice(-5).reverse() : [];
      return `
        <article class="portfolio-card">
          <div class="stock-card-top">
            <span>${escapeHtml(position.boughtAt || "No date")} | ${escapeHtml(position.marketProvider || "Market data")}</span>
            <strong>${escapeHtml(position.ticker)}</strong>
          </div>
          <div class="value-compare">
            <div class="compare-box original">
              <span>Original buy</span>
              <strong>${dollarsPrecise(stats.invested)}</strong>
              <small>${stats.shares.toFixed(4)} shares at ${dollarsPrecise(stats.buyPrice)}</small>
            </div>
            <div class="compare-box current ${totalClass}">
              <span>Current value</span>
              <strong>${dollarsPrecise(stats.currentValue)}</strong>
              <small>${dollarsPrecise(stats.currentPrice)} per share now</small>
            </div>
          </div>
          <div class="portfolio-values">
            <div class="return-box ${totalClass}">
              <span>Total made/lost</span>
              <strong>${dollarsPrecise(stats.totalGain)}</strong>
              <small>${percent(stats.totalReturn)}</small>
            </div>
            <div class="return-box ${todayClass}">
              <span>Today made/lost</span>
              <strong>${stats.todayGain === null ? "Need daily quote" : dollarsPrecise(stats.todayGain)}</strong>
              <small>${stats.todayReturn === null ? "Refresh prices" : percent(stats.todayReturn)}</small>
            </div>
          </div>
          <div class="daily-log">
            <span>Daily account</span>
            ${
              snapshots.length
                ? snapshots
                    .map(
                      (snapshot) => `
                        <div>
                          <small>${escapeHtml(snapshot.date)}</small>
                          <strong>${dollarsPrecise(snapshot.currentValue)}</strong>
                          <em>${dollarsPrecise(snapshot.totalGain)} (${percent(Number(snapshot.totalReturn) || 0)})</em>
                        </div>
                      `,
                    )
                    .join("")
                : `<p>Refresh prices to save the first daily value snapshot.</p>`
            }
          </div>
          <small class="market-line">Last price refresh: ${escapeHtml(position.marketUpdatedAt || "not refreshed yet")}</small>
          <button type="button" class="remove-position" data-id="${escapeHtml(position.id)}">Remove</button>
        </article>
      `;
    })
    .join("");
}

async function refreshPortfolioPrices() {
  if (!portfolio.length) {
    renderPortfolio();
    return;
  }

  output.portfolioMessage.textContent = "Refreshing portfolio prices...";
  const next = [];
  for (const position of portfolio) {
    try {
      const quote = await fetchQuote(position.ticker);
      next.push({
        ...position,
        currentPrice: Number(quote.marketPrice) || position.currentPrice || position.buyPrice,
        marketChangePercent: quote.marketChangePercent || "",
        marketUpdatedAt: quote.marketUpdatedAt || new Date().toISOString(),
        marketProvider: quote.marketProvider || "Market data",
      });
    } catch {
      next.push(position);
    }
  }
  portfolio = next.map(withDailySnapshot);
  await savePortfolio();
  renderPortfolio();
  output.portfolioMessage.textContent = "Portfolio prices refreshed.";
}

async function addPortfolioPosition(event) {
  event.preventDefault();
  const ticker = output.tradeTicker.value.trim().toUpperCase().replace(/[^A-Z.-]/g, "").slice(0, 12);
  const amountInvested = Number(output.tradeAmount.value) || 0;
  let buyPrice = Number(output.tradeBuyPrice.value) || 0;

  if (!ticker || amountInvested <= 0) {
    output.portfolioMessage.textContent = "Enter a ticker and how much you invested.";
    return;
  }

  let quote = cachedMarketQuote(ticker);
  if (!buyPrice) {
    try {
      quote = await fetchQuote(ticker);
      buyPrice = Number(quote.marketPrice) || 0;
    } catch (error) {
      output.portfolioMessage.textContent = error.message;
      return;
    }
  }

  if (buyPrice <= 0) {
    output.portfolioMessage.textContent = "Enter the price you paid per share.";
    return;
  }

  const boughtAt = output.tradeDate.value || new Date().toISOString().slice(0, 10);
  portfolio.unshift({
    id: `${Date.now()}-${ticker}`,
    ticker,
    amountInvested,
    buyPrice,
    shares: amountInvested / buyPrice,
    boughtAt,
    currentPrice: Number(quote?.marketPrice) || buyPrice,
    marketChangePercent: quote?.marketChangePercent || "",
    marketUpdatedAt: quote?.marketUpdatedAt || new Date().toISOString(),
    marketProvider: quote?.marketProvider || "Manual entry",
  });
  portfolio[0] = withDailySnapshot(portfolio[0]);

  await savePortfolio();
  output.tradeForm.reset();
  output.tradeDate.value = new Date().toISOString().slice(0, 10);
  output.portfolioMessage.textContent = `${ticker} buy added to recent activity.`;
  renderPortfolio();
}

function renderCongressAlerts() {
  if (!output.alertsList) return;

  const alerts = [...settings.congressTrades]
    .filter((trade) => ["Buy", "Sell"].includes(trade.transaction))
    .sort((a, b) => daysSince(a.reportedDate) - daysSince(b.reportedDate))
    .slice(0, 8);

  if (!alerts.length) {
    output.alertsList.innerHTML = `
      <article class="alert-card">
        <strong>No buy/sell alerts yet</strong>
        <p>Import congressional disclosure data in admin to populate alerts.</p>
      </article>
    `;
    return;
  }

  const statusCard = `
    <article class="alert-card">
      <div>
        <span>FEED STATUS</span>
        <strong>${congressFeedStatus.updatedAt ? `Last refresh ${new Date(congressFeedStatus.updatedAt).toLocaleString()}` : "No live feed connected yet"}</strong>
        <p>${congressFeedStatus.error ? `Feed error: ${escapeHtml(congressFeedStatus.error)}` : `Tracked trades: ${congressFeedStatus.totalTrades || settings.congressTrades.length}`}</p>
      </div>
    </article>
  `;

  output.alertsList.innerHTML = alerts
    .map((trade) => {
      const isBuy = trade.transaction === "Buy";
      const alertClass = isBuy ? "buy-alert" : "sell-alert";
      const alertTitle = isBuy ? "BUY ALERT" : "SELL ALERT";
      const age = daysSince(trade.reportedDate);
      const ageText = age === 0 ? "reported today" : `${age} days since reported`;

      return `
        <article class="alert-card ${alertClass}">
          <div>
            <span>${alertTitle}</span>
            <strong>${escapeHtml(trade.representative)} ${isBuy ? "bought" : "sold"} ${escapeHtml(trade.ticker)}</strong>
            <p>${escapeHtml(trade.company)} | ${escapeHtml(trade.reportedRange)} | ${escapeHtml(ageText)}</p>
          </div>
          <a href="${escapeHtml(trade.sourceUrl)}" target="_blank" rel="noreferrer">Source</a>
        </article>
      `;
    })
    .join("") + statusCard;
}

function renderPolicySignals() {
  if (!output.policySignalsGrid) return;

  const signals = policySignals.signals || [];
  const positive = signals.filter((signal) => signal.direction === "positive").length;
  const negative = signals.filter((signal) => signal.direction === "negative").length;
  const levelOne = signals.filter((signal) => String(signal.level).startsWith("Level 1")).length;

  output.policySummary.innerHTML = `
    <div>
      <span>Last scan</span>
      <strong>${policySignals.updatedAt ? new Date(policySignals.updatedAt).toLocaleString() : "Not scanned yet"}</strong>
    </div>
    <div>
      <span>Total signals</span>
      <strong>${signals.length}</strong>
    </div>
    <div>
      <span>Positive / negative</span>
      <strong>${positive} / ${negative}</strong>
    </div>
    <div>
      <span>Level 1 buys</span>
      <strong>${levelOne}</strong>
    </div>
    <div>
      <span>Source errors</span>
      <strong>${(policySignals.errors || []).length}</strong>
    </div>
  `;

  if (!signals.length) {
    output.policySignalsGrid.innerHTML = `
      <article class="stock-card">
        <span>No policy catalysts yet</span>
        <strong>Run a policy refresh in admin</strong>
        <p>The hourly monitor will also populate this section when the server is running.</p>
      </article>
    `;
    return;
  }

  output.policySignalsGrid.innerHTML = signals
    .slice(0, 9)
    .map((signal) => {
      const toneClass = signal.direction === "negative" ? "loss" : signal.direction === "positive" ? "gain" : "";
      return `
        <article class="stock-card">
          <div class="stock-card-top">
            <span>${escapeHtml(signal.direction)} | ${escapeHtml(signal.sourceName)}</span>
            <strong>${escapeHtml(signal.ticker)}</strong>
          </div>
          <h3>${escapeHtml(signal.company)}</h3>
          <div class="return-box ${toneClass}">
            <span>${escapeHtml(signal.level)}</span>
            <strong>${Number(signal.score) || 0}/100</strong>
            <small>${escapeHtml(signal.strategy)}</small>
          </div>
          <div class="signal-list">
            <span>Matched: ${(signal.matchedTerms || []).map(escapeHtml).join(", ") || "n/a"}</span>
            <span>Positive terms: ${(signal.positiveHits || []).map(escapeHtml).join(", ") || "none"}</span>
            <span>Negative terms: ${(signal.negativeHits || []).map(escapeHtml).join(", ") || "none"}</span>
          </div>
          <a href="${escapeHtml(signal.sourceUrl)}" target="_blank" rel="noreferrer">Open source</a>
        </article>
      `;
    })
    .join("");
}

function renderCongressTrades() {
  if (!output.congressGrid) return;

  const memberQuery = document.querySelector("#memberSearch").value.trim().toLowerCase();
  const tradeFilter = document.querySelector("#memberTradeFilter").value;
  const filtered = settings.congressTrades.filter((trade) => {
    const memberMatch = !memberQuery || trade.representative.toLowerCase().includes(memberQuery);
    const typeMatch = tradeFilter === "all" || trade.transaction === tradeFilter;
    return memberMatch && typeMatch;
  });

  renderMemberSummary(filtered, memberQuery);

  const ranked = [...filtered]
    .sort((a, b) => b.signalScore - a.signalScore)
    .slice(0, 12);

  if (!ranked.length) {
    output.congressGrid.innerHTML = `
      <article class="congress-card">
        <span>No matching disclosures</span>
        <strong>Try another member name</strong>
        <p>Use the admin import tool to add more public disclosure data as you collect it.</p>
      </article>
    `;
    return;
  }

  output.congressGrid.innerHTML = ranked
    .map((trade) => {
      const entryPrice = Number(trade.entryPrice);
      const marketPrice = Number(trade.marketPrice);
      const hasReturn = entryPrice > 0 && marketPrice > 0;
      const returnPercent = hasReturn ? ((marketPrice - entryPrice) / entryPrice) * 100 : null;
      const dollarMove = hasReturn ? marketPrice - entryPrice : null;
      const returnClass = hasReturn && dollarMove >= 0 ? "gain" : "loss";

      return `
      <article class="congress-card">
        <div class="stock-card-top">
          <span>${escapeHtml(trade.party)}-${escapeHtml(trade.state)} | ${escapeHtml(trade.transaction)}</span>
          <strong>${escapeHtml(trade.ticker)}</strong>
        </div>
        <h3>${escapeHtml(trade.representative)}</h3>
        <p>${escapeHtml(trade.company)} | ${escapeHtml(trade.reportedRange)} | Reported ${escapeHtml(trade.reportedDate)}</p>
        <div class="return-box ${returnClass}">
          <span>Since disclosed buy/entry</span>
          <strong>${hasReturn ? percent(returnPercent) : "Need prices"}</strong>
          <small>${hasReturn ? `${dollars(dollarMove)} per share from ${dollars(entryPrice)} to ${dollars(marketPrice)}` : "Add entry price and refresh market data to calculate growth or decline."}</small>
        </div>
        <div class="score-line">
          <span>${escapeHtml(trade.conflictRisk)}</span>
          <strong>${Number(trade.signalScore) || 0}/100</strong>
        </div>
        <p>${escapeHtml(trade.watchReason)}</p>
        ${trade.entryPrice ? `<small class="market-line">Entry: ${dollars(trade.entryPrice)} | ${escapeHtml(trade.entryPriceSource || "Entry source not noted")}</small>` : ""}
        ${trade.marketPrice ? `<small class="market-line">Market: $${Number(trade.marketPrice).toFixed(2)} ${escapeHtml(trade.marketChangePercent || "")} | ${escapeHtml(trade.marketProvider || "Market data")} ${escapeHtml(trade.marketUpdatedAt || "")}</small>` : ""}
        <a href="${escapeHtml(trade.sourceUrl)}" target="_blank" rel="noreferrer">Disclosure source</a>
      </article>
    `;
    })
    .join("");
}

function renderMemberOptions() {
  if (!output.memberOptions) return;
  const names = [...new Set(settings.congressTrades.map((trade) => trade.representative))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  output.memberOptions.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
}

function renderMemberSummary(trades, memberQuery) {
  if (!output.memberSummary) return;

  const performanceTrades = trades.filter((trade) => Number(trade.entryPrice) > 0 && Number(trade.marketPrice) > 0);
  const gains = performanceTrades.filter((trade) => Number(trade.marketPrice) >= Number(trade.entryPrice)).length;
  const losses = performanceTrades.length - gains;
  const avgReturn = performanceTrades.length
    ? performanceTrades.reduce((sum, trade) => sum + ((Number(trade.marketPrice) - Number(trade.entryPrice)) / Number(trade.entryPrice)) * 100, 0) /
      performanceTrades.length
    : null;

  output.memberSummary.innerHTML = `
    <div>
      <span>${memberQuery ? "Selected member" : "All tracked members"}</span>
      <strong>${memberQuery || "Showing highest-signal disclosures"}</strong>
    </div>
    <div>
      <span>Matching trades</span>
      <strong>${trades.length}</strong>
    </div>
    <div>
      <span>With performance data</span>
      <strong>${performanceTrades.length}</strong>
    </div>
    <div>
      <span>Gain / decline</span>
      <strong>${gains} / ${losses}</strong>
    </div>
    <div>
      <span>Average move</span>
      <strong>${avgReturn === null ? "n/a" : percent(avgReturn)}</strong>
    </div>
  `;
}

async function loadSettings() {
  try {
    const response = await fetch("api/config", { cache: "no-store" });
    if (!response.ok) throw new Error("Config unavailable");
    const config = await response.json();
    settings.thresholds = { ...settings.thresholds, ...config.thresholds };
    settings.plans = Array.isArray(config.plans) && config.plans.length ? config.plans : defaultPlans;
    settings.goals = Array.isArray(config.goals) && config.goals.length ? config.goals : defaultGoals;
    settings.stockIdeas = Array.isArray(config.stockIdeas) && config.stockIdeas.length ? config.stockIdeas : defaultStockIdeas;
    settings.congressTrades =
      Array.isArray(config.congressTrades) && config.congressTrades.length ? config.congressTrades : defaultCongressTrades;
  } catch {
    settings.plans = defaultPlans;
    settings.goals = defaultGoals;
    settings.stockIdeas = defaultStockIdeas;
    settings.congressTrades = defaultCongressTrades;
  }
}

async function loadPolicySignals() {
  try {
    const response = await fetch("api/policy-signals", { cache: "no-store" });
    if (!response.ok) throw new Error("Policy signals unavailable");
    policySignals = await response.json();
  } catch {
    policySignals = { updatedAt: null, signals: [], errors: [] };
  }
}

async function loadPredictions() {
  try {
    const response = await fetch("api/predictions", { cache: "no-store" });
    if (!response.ok) throw new Error("Predictions unavailable");
    predictionEngine = await response.json();
  } catch {
    predictionEngine = { updatedAt: null, predictions: [], sections: {}, modelVersion: "" };
  }
}

async function loadCongressFeedStatus() {
  try {
    const response = await fetch("api/congress-feed-status", { cache: "no-store" });
    if (!response.ok) throw new Error("Congress feed status unavailable");
    congressFeedStatus = await response.json();
  } catch {
    congressFeedStatus = { updatedAt: null, imported: 0, totalTrades: settings.congressTrades.length, source: null, error: null };
  }
}

function recommendationAction(recommendation) {
  if (recommendation.invest > 0) return "invest";
  if (recommendation.save > 0) return "save";
  if (recommendation.debt > 0) return "debt";
  return "hold";
}

function recordRecommendation(recommendation) {
  const action = recommendationAction(recommendation);
  const eventKey = `${action}:${recommendation.invest}:${recommendation.save}:${recommendation.debt}`;
  if (eventKey === lastEventKey) return;
  lastEventKey = eventKey;

  if (location.protocol === "file:") return;

  fetch("api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      invest: recommendation.invest,
      save: recommendation.save,
      debt: recommendation.debt,
    }),
  }).catch(() => {});
}

Object.values(fields).filter(Boolean).forEach((field) => {
  field.addEventListener("input", calculate);
});

document.querySelector("#riskProfile")?.addEventListener("change", () => {
  renderStockIdeas(latestRecommendation?.invest || 0);
});

document.querySelector("#timeHorizon")?.addEventListener("change", () => {
  renderStockIdeas(latestRecommendation?.invest || 0);
});

document.querySelector("#memberSearch")?.addEventListener("input", renderCongressTrades);
document.querySelector("#memberTradeFilter")?.addEventListener("change", renderCongressTrades);
output.tradeForm?.addEventListener("submit", addPortfolioPosition);
output.refreshPortfolio?.addEventListener("click", refreshPortfolioPrices);
output.portfolioPin?.addEventListener("change", async () => {
  const pin = output.portfolioPin.value.trim();
  if (pin) localStorage.setItem("publicTradeIntelPortfolioPin", pin);
  else localStorage.removeItem("publicTradeIntelPortfolioPin");
  await loadPortfolioFromServer();
  calculate();
  output.portfolioMessage.textContent = pin ? "Portfolio PIN saved on this device." : "Portfolio PIN removed. Saving on this device only.";
});
document.querySelectorAll("[data-prediction-view]").forEach((button) => {
  button.addEventListener("click", () => {
    predictionView = button.dataset.predictionView;
    document.querySelectorAll("[data-prediction-view]").forEach((tab) => tab.classList.toggle("is-active", tab === button));
    renderPredictions();
  });
});
output.predictionSort?.addEventListener("change", renderPredictions);
output.runPredictionScan?.addEventListener("click", runPredictionScan);
output.predictionGrid?.addEventListener("click", (event) => {
  if (event.target.closest("[data-run-prediction-scan]")) runPredictionScan();
});
output.portfolioList?.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-position");
  if (!button) return;
  portfolio = portfolio.filter((position) => position.id !== button.dataset.id);
  savePortfolio();
  renderPortfolio();
});
output.logoutButton?.addEventListener("click", async () => {
  await fetch("api/logout", { method: "POST" }).catch(() => {});
  location.href = "/login.html";
});

document.querySelector("#resetDemo")?.addEventListener("click", () => {
  Object.entries(demoValues).forEach(([id, value]) => {
    if (fields[id]) fields[id].value = value;
  });
  calculate();
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

if (output.tradeDate) output.tradeDate.value = new Date().toISOString().slice(0, 10);
Promise.all([loadSettings(), loadPolicySignals(), loadPredictions(), loadCongressFeedStatus(), loadPortfolioFromServer()]).then(calculate);
