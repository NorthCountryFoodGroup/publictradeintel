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
  alertsList: document.querySelector("#alertsList"),
  policySummary: document.querySelector("#policySummary"),
  policySignalsGrid: document.querySelector("#policySignalsGrid"),
  congressGrid: document.querySelector("#congressGrid"),
  memberSummary: document.querySelector("#memberSummary"),
  memberOptions: document.querySelector("#memberOptions"),
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

function dollars(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.floor(value)));
}

function percent(value) {
  if (!Number.isFinite(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
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
  return Number(fields[id].value) || 0;
}

function closestPlan(amount) {
  return settings.plans.reduce((best, plan) => {
    if (amount >= plan.weekly) return plan;
    return best;
  }, null);
}

function calculate() {
  const cash = readMoney("cashOnHand");
  const bills = readMoney("billsDue");
  const foodGas = readMoney("foodGas");
  const debtPayments = readMoney("debtPayments");
  const emergencyFund = readMoney("emergencyFund");
  const expectedIncome = readMoney("expectedIncome");
  const cushion = readMoney("minimumCushion");
  const debtBalance = readMoney("debtBalance");
  const alreadyInvested = readMoney("alreadyInvested");
  const dividendsEarned = readMoney("dividendsEarned");
  const netWorthIncrease = readMoney("netWorthIncrease");

  const requiredCash = bills + foodGas + debtPayments + cushion;
  const availableAfterNeeds = cash + expectedIncome - requiredCash;
  const safeSurplus = Math.max(0, Math.floor(availableAfterNeeds));
  const emergencyGap = Math.max(0, settings.thresholds.fullEmergencyTarget - emergencyFund);

  let recommendation = {
    status: "Protect cash first",
    title: "Hold cash this week",
    text:
      "Your safest move is to keep cash available for bills, food, gas, debt payments, and your minimum cushion. Holding steady is progress.",
    invest: 0,
    save: 0,
    hold: Math.max(0, cash + expectedIncome),
    debt: 0,
  };

  if (safeSurplus > 0 && emergencyFund < settings.thresholds.firstEmergencyTarget) {
    const save = Math.min(safeSurplus, emergencyGap);
    recommendation = {
      status: "Build the first safety layer",
      title: `Save ${dollars(save)} this week`,
      text:
        "Before investing, get your first emergency cash layer started. Even a small transfer makes next week less fragile.",
      invest: 0,
      save,
      hold: requiredCash,
      debt: 0,
    };
  } else if (safeSurplus > 0 && debtBalance > 0 && emergencyFund < settings.thresholds.fullEmergencyTarget) {
    const save = Math.min(Math.ceil(safeSurplus * 0.65), emergencyGap);
    const debt = Math.max(0, safeSurplus - save);
    recommendation = {
      status: "Split safety and debt",
      title: `Save ${dollars(save)} and pay ${dollars(debt)} to debt`,
      text:
        "Your cash cushion is protected, so this week can strengthen emergency savings while trimming high-interest debt.",
      invest: 0,
      save,
      hold: requiredCash,
      debt,
    };
  } else if (safeSurplus > 0 && debtBalance > 0) {
    const invest = safeSurplus >= settings.thresholds.debtInvestCap ? Math.min(settings.thresholds.debtInvestCap, safeSurplus) : 0;
    const debt = safeSurplus - invest;
    recommendation = {
      status: "Debt first, tiny investing allowed",
      title: invest > 0 ? `Invest ${dollars(invest)} this week` : "Pay down debt instead",
      text:
        "Your emergency base is in place. Keep investing tiny and automatic only if it does not slow down urgent debt progress.",
      invest,
      save: 0,
      hold: requiredCash,
      debt,
    };
  } else if (safeSurplus >= 5) {
    const plan = closestPlan(safeSurplus);
    const invest = plan ? plan.weekly : 0;
    const save = Math.max(0, safeSurplus - invest);
    recommendation = {
      status: "Safe to invest small",
      title: `Invest ${dollars(invest)} this week`,
      text:
        "Your near-term cash is protected. Use a broad, diversified automatic investment habit and keep the rest as extra safety.",
      invest,
      save,
      hold: requiredCash,
      debt: 0,
    };
  }

  renderRecommendation(recommendation);
  latestRecommendation = recommendation;
  recordRecommendation(recommendation);
  renderGoals({
    emergency: emergencyFund + recommendation.save,
    invested: alreadyInvested + recommendation.invest,
    dividend: dividendsEarned,
    netWorth: netWorthIncrease + recommendation.save + recommendation.invest + recommendation.debt,
  });
  renderPlans(recommendation.invest);
  renderStockIdeas(recommendation.invest);
  renderBestStocks(recommendation.invest);
  renderDayTrades();
  renderCongressAlerts();
  renderPolicySignals();
  renderMemberOptions();
  renderCongressTrades();
}

function renderRecommendation(recommendation) {
  output.statusChip.textContent = recommendation.status;
  output.title.textContent = recommendation.title;
  output.text.textContent = recommendation.text;
  output.invest.textContent = dollars(recommendation.invest);
  output.save.textContent = dollars(recommendation.save);
  output.hold.textContent = dollars(recommendation.hold);
  output.debt.textContent = dollars(recommendation.debt);
}

function renderGoals(progress) {
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
    .join("");
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

Object.values(fields).forEach((field) => {
  field.addEventListener("input", calculate);
});

document.querySelector("#riskProfile").addEventListener("change", () => {
  renderStockIdeas(latestRecommendation?.invest || 0);
});

document.querySelector("#timeHorizon").addEventListener("change", () => {
  renderStockIdeas(latestRecommendation?.invest || 0);
});

document.querySelector("#memberSearch").addEventListener("input", renderCongressTrades);
document.querySelector("#memberTradeFilter").addEventListener("change", renderCongressTrades);

document.querySelector("#resetDemo").addEventListener("click", () => {
  Object.entries(demoValues).forEach(([id, value]) => {
    fields[id].value = value;
  });
  calculate();
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

Promise.all([loadSettings(), loadPolicySignals()]).then(calculate);
