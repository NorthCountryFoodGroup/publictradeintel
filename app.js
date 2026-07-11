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
  watchlistActiveName: document.querySelector("#watchlistActiveName"),
  watchlistOverviewGrid: document.querySelector("#watchlistOverviewGrid"),
  watchlistCreateForm: document.querySelector("#watchlistCreateForm"),
  watchlistNameInput: document.querySelector("#watchlistNameInput"),
  watchlistCardsGrid: document.querySelector("#watchlistCardsGrid"),
  watchlistDetailTitle: document.querySelector("#watchlistDetailTitle"),
  watchlistAddTickerForm: document.querySelector("#watchlistAddTickerForm"),
  watchlistTickerInput: document.querySelector("#watchlistTickerInput"),
  watchlistFilter: document.querySelector("#watchlistFilter"),
  watchlistSort: document.querySelector("#watchlistSort"),
  watchlistDetailGrid: document.querySelector("#watchlistDetailGrid"),
  watchlistAlertForm: document.querySelector("#watchlistAlertForm"),
  alertTickerInput: document.querySelector("#alertTickerInput"),
  alertTypeInput: document.querySelector("#alertTypeInput"),
  alertThresholdInput: document.querySelector("#alertThresholdInput"),
  watchlistAlertsList: document.querySelector("#watchlistAlertsList"),
  predictionSummary: document.querySelector("#predictionSummary"),
  predictionGrid: document.querySelector("#predictionGrid"),
  predictionSort: document.querySelector("#predictionSort"),
  runPredictionScan: document.querySelector("#runPredictionScan"),
  predictionScanMessage: document.querySelector("#predictionScanMessage"),
  predictionSearch: document.querySelector("#predictionSearch"),
  globalSearch: document.querySelector("#globalSearch"),
  filterTimeframe: document.querySelector("#filterTimeframe"),
  filterRecommendation: document.querySelector("#filterRecommendation"),
  filterConfidence: document.querySelector("#filterConfidence"),
  filterScoreMin: document.querySelector("#filterScoreMin"),
  filterSector: document.querySelector("#filterSector"),
  filterIndustry: document.querySelector("#filterIndustry"),
  filterPattern: document.querySelector("#filterPattern"),
  filterCongress: document.querySelector("#filterCongress"),
  filterPolicy: document.querySelector("#filterPolicy"),
  filterTrend: document.querySelector("#filterTrend"),
  filterDataQuality: document.querySelector("#filterDataQuality"),
  alertsList: document.querySelector("#alertsList"),
  alertsDashboardStatus: document.querySelector("#alertsDashboardStatus"),
  alertsOverviewGrid: document.querySelector("#alertsOverviewGrid"),
  alertRuleForm: document.querySelector("#alertRuleForm"),
  alertRuleTicker: document.querySelector("#alertRuleTicker"),
  alertRuleType: document.querySelector("#alertRuleType"),
  alertRulePriority: document.querySelector("#alertRulePriority"),
  alertRuleThreshold: document.querySelector("#alertRuleThreshold"),
  alertRuleList: document.querySelector("#alertRuleList"),
  alertFilterStatus: document.querySelector("#alertFilterStatus"),
  alertFilterPriority: document.querySelector("#alertFilterPriority"),
  alertFilterTicker: document.querySelector("#alertFilterTicker"),
  alertFilterWatchlist: document.querySelector("#alertFilterWatchlist"),
  alertFilterSector: document.querySelector("#alertFilterSector"),
  alertFilterDate: document.querySelector("#alertFilterDate"),
  alertFilterType: document.querySelector("#alertFilterType"),
  alertFeedCount: document.querySelector("#alertFeedCount"),
  deliveryPreferencesGrid: document.querySelector("#deliveryPreferencesGrid"),
  alertHistorySearch: document.querySelector("#alertHistorySearch"),
  exportAlertsButton: document.querySelector("#exportAlertsButton"),
  alertHistoryList: document.querySelector("#alertHistoryList"),
  policySummary: document.querySelector("#policySummary"),
  policySignalsGrid: document.querySelector("#policySignalsGrid"),
  congressGrid: document.querySelector("#congressGrid"),
  memberSummary: document.querySelector("#memberSummary"),
  memberOptions: document.querySelector("#memberOptions"),
  logoutButton: document.querySelector("#logoutButton"),
  dashboardSummaryGrid: document.querySelector("#dashboardSummaryGrid"),
  dashboardScanTime: document.querySelector("#dashboardScanTime"),
  dashboardScanSummary: document.querySelector("#dashboardScanSummary"),
  dashboardAlerts: document.querySelector("#dashboardAlerts"),
  dashboardAlertCount: document.querySelector("#dashboardAlertCount"),
  marketOverviewTone: document.querySelector("#marketOverviewTone"),
  marketOverviewGrid: document.querySelector("#marketOverviewGrid"),
  marketIntelligenceStatus: document.querySelector("#marketIntelligenceStatus"),
  marketSummaryGrid: document.querySelector("#marketSummaryGrid"),
  marketBreadthGrid: document.querySelector("#marketBreadthGrid"),
  sectorRotationGrid: document.querySelector("#sectorRotationGrid"),
  sectorHeatmapGrid: document.querySelector("#sectorHeatmapGrid"),
  selectedSectorLabel: document.querySelector("#selectedSectorLabel"),
  sectorPicksPanel: document.querySelector("#sectorPicksPanel"),
  marketCongressGrid: document.querySelector("#marketCongressGrid"),
  marketPolicyGrid: document.querySelector("#marketPolicyGrid"),
  economicCalendarGrid: document.querySelector("#economicCalendarGrid"),
  aiMarketSummary: document.querySelector("#aiMarketSummary"),
  predictionEngineGrid: document.querySelector("#predictionEngineGrid"),
  aiDashboardBriefStatus: document.querySelector("#aiDashboardBriefStatus"),
  aiDashboardBrief: document.querySelector("#aiDashboardBrief"),
  scanProgressStage: document.querySelector("#scanProgressStage"),
  scanProgressBar: document.querySelector("#scanProgressBar"),
  scanProgressMessage: document.querySelector("#scanProgressMessage"),
  scanProgressSummaryGrid: document.querySelector("#scanProgressSummaryGrid"),
  opportunityCount: document.querySelector("#opportunityCount"),
  todayOpportunitiesGrid: document.querySelector("#todayOpportunitiesGrid"),
  watchlistSummaryGrid: document.querySelector("#watchlistSummaryGrid"),
  congressActivityCount: document.querySelector("#congressActivityCount"),
  congressActivityGrid: document.querySelector("#congressActivityGrid"),
  policyActivityCount: document.querySelector("#policyActivityCount"),
  policyActivityGrid: document.querySelector("#policyActivityGrid"),
  predictionPerformanceGrid: document.querySelector("#predictionPerformanceGrid"),
  performanceOverviewGrid: document.querySelector("#performanceOverviewGrid"),
  performanceChartsGrid: document.querySelector("#performanceChartsGrid"),
  signalAnalysisGrid: document.querySelector("#signalAnalysisGrid"),
  performanceSearch: document.querySelector("#performanceSearch"),
  predictionAuditList: document.querySelector("#predictionAuditList"),
  aiLearningSummary: document.querySelector("#aiLearningSummary"),
  performanceVersionGrid: document.querySelector("#performanceVersionGrid"),
  tradeBriefPanel: document.querySelector("#tradeBriefPanel"),
  pageBreadcrumb: document.querySelector("#pageBreadcrumb"),
  pageTitle: document.querySelector("#pageTitle"),
  profileMenuButton: document.querySelector("#profileMenuButton"),
  profileDropdown: document.querySelector("#profileDropdown"),
  profileSignOutButton: document.querySelector("#profileSignOutButton"),
  alertsMenuButton: document.querySelector("#alertsMenuButton"),
  alertsDropdown: document.querySelector("#alertsDropdown"),
  topbarAlertCount: document.querySelector("#topbarAlertCount"),
  alertsDropdownCount: document.querySelector("#alertsDropdownCount"),
  alertsDropdownContent: document.querySelector("#alertsDropdownContent"),
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
let predictionLayout = "cards";
let portfolio = [];
let selectedBriefTicker = "";
let selectedMarketSector = "All sectors";
let watchlists = [];
let watchlistAlerts = [];
let alertHistory = [];
let selectedWatchlistId = "core-holdings";

const pageLabels = {
  dashboard: "Dashboard",
  predictions: "Opportunities",
  briefs: "AI Trade Briefs",
  watchlist: "Watchlists",
  market: "Markets",
  admin: "Admin",
  congress: "Congress",
  policy: "Policy",
  performance: "Performance",
  alerts: "Alerts",
  settings: "Settings",
};

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
  if (!watchlists.length) loadWatchlists();
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
  renderAlertsCenter();
  renderPolicySignals();
  renderPortfolio();
  renderWatchlists();
  renderMemberOptions();
  renderCongressTrades();
  renderDashboard();
  renderMarketIntelligence();
  renderPerformanceCenter();
  renderTradeBrief();
}

function statusTone(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("healthy") || normalized === "good") return "good";
  if (normalized.includes("failed") || normalized === "failed") return "bad";
  if (normalized.includes("partial") || normalized.includes("warning") || normalized.includes("stale")) return "warn";
  return "neutral";
}

function firstFromSection(sectionName) {
  const section = predictionEngine.sections?.[sectionName];
  return Array.isArray(section) && section.length ? section[0] : null;
}

function compactPickCard(label, item) {
  if (!item) {
    return `
      <article class="summary-tile empty-tile clickable-card" data-page-target="predictions">
        <span>${escapeHtml(label)}</span>
        <strong>No pick yet</strong>
        <small>Run a prediction scan.</small>
      </article>
    `;
  }
  const score = Number(item.unifiedPredictionScore || item.aiOpportunityScore || 0);
  const timeframe = item.bestTimeframe || item.timeframe || "Research";
  const direction = item.unifiedDirection || item.signalAlignment?.type || "neutral";
  const pattern = item.chartPatternSignal?.primaryPattern || item.primaryPattern || item.setupSignals?.setupDirection || "setup pending";
  const rankChange = Number(item.rankChange ?? item.rankMovement?.change ?? item.scoreChange ?? 0);
  return `
    <article class="summary-tile pick-tile clickable-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(item.ticker)} ${score}/100</strong>
      <small>${escapeHtml(item.name || item.company || item.ticker)}</small>
      <small>${escapeHtml(item.label || item.recommendation || "Research candidate")} | ${escapeHtml(item.confidenceTier || "confidence pending")} | ${escapeHtml(direction)}</small>
      <small>${escapeHtml(timeframe)} | ${escapeHtml(pattern)} | ${rankChange ? `Rank/score change ${rankChange > 0 ? "+" : ""}${rankChange}` : "No prior change yet"}</small>
      ${item.roleQualificationReason ? `<small>${escapeHtml(item.roleQualificationReason)}</small>` : ""}
      <button type="button" data-view-brief="${escapeHtml(item.ticker)}">View Trade Brief</button>
    </article>
  `;
}

function metricCard(label, value, note = "", target = "") {
  const targetAttr = target ? ` data-page-target="${escapeHtml(target)}"` : "";
  return `
    <article class="summary-tile metric-tile clickable-card"${targetAttr}>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${note ? `<small>${escapeHtml(note)}</small>` : ""}
    </article>
  `;
}

function averageUnifiedScore(rows) {
  const values = (rows || []).map((item) => Number(item.unifiedPredictionScore || item.aiOpportunityScore)).filter(Number.isFinite);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function strongestBy(items, getter) {
  return [...(items || [])].sort((a, b) => Number(getter(b) || 0) - Number(getter(a) || 0))[0] || null;
}

function sectorStrengthSummary(predictions) {
  const groups = {};
  (predictions || []).forEach((item) => {
    const group = item.assetGroup || "Market";
    if (!groups[group]) groups[group] = { total: 0, count: 0 };
    groups[group].total += Number(item.unifiedPredictionScore || item.aiOpportunityScore || 0);
    groups[group].count += 1;
  });
  const best = Object.entries(groups)
    .map(([name, value]) => ({ name, score: value.count ? Math.round(value.total / value.count) : 0 }))
    .sort((a, b) => b.score - a.score)[0];
  return best ? `${best.name} leads at ${best.score}/100` : "Run scan for sector read";
}

function mostActivePoliticians(trades) {
  const counts = {};
  (trades || []).forEach((trade) => {
    const name = trade.representative || "Unknown";
    counts[name] = (counts[name] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "No activity";
}

function defaultWatchlists() {
  const starterTickers = (settings.stockIdeas || []).slice(0, 8).map((stock) => stock.ticker).filter(Boolean);
  return [
    { id: "core-holdings", name: "Core Holdings", tickers: starterTickers },
    { id: "daily-trades", name: "Daily Trades", tickers: [] },
    { id: "swing-trades", name: "Swing Trades", tickers: [] },
    { id: "long-term", name: "Long-Term", tickers: [] },
    { id: "ai-technology", name: "AI & Technology", tickers: ["NVDA", "MSFT", "AMD"].filter(Boolean) },
  ];
}

function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 12);
}

function loadWatchlists() {
  try {
    const saved = JSON.parse(localStorage.getItem("publicTradeIntelWatchlists") || "[]");
    watchlists = Array.isArray(saved) && saved.length ? saved : defaultWatchlists();
  } catch {
    watchlists = defaultWatchlists();
  }
  if (!watchlists.some((list) => list.id === selectedWatchlistId)) selectedWatchlistId = watchlists[0]?.id || "core-holdings";
  try {
    const savedAlerts = JSON.parse(localStorage.getItem("publicTradeIntelWatchlistAlerts") || "[]");
    watchlistAlerts = Array.isArray(savedAlerts) ? savedAlerts : [];
  } catch {
    watchlistAlerts = [];
  }
  try {
    const savedHistory = JSON.parse(localStorage.getItem("publicTradeIntelAlertHistory") || "[]");
    alertHistory = Array.isArray(savedHistory) ? savedHistory : [];
  } catch {
    alertHistory = [];
  }
}

function saveWatchlists() {
  localStorage.setItem("publicTradeIntelWatchlists", JSON.stringify(watchlists));
  localStorage.setItem("publicTradeIntelWatchlistAlerts", JSON.stringify(watchlistAlerts));
  localStorage.setItem("publicTradeIntelAlertHistory", JSON.stringify(alertHistory));
}

function predictionForTicker(ticker) {
  const normalized = normalizeTicker(ticker);
  return (predictionEngine.predictions || []).find((item) => normalizeTicker(item.ticker) === normalized) || null;
}

function watchlistTickerRecord(ticker) {
  const prediction = predictionForTicker(ticker);
  const model = prediction ? predictionModelForView(prediction) : null;
  const technical = model?.technicalAnalysis || prediction?.technicalAnalysis?.oneDay || {};
  const recommendation = prediction ? recommendationCategory(prediction, model) : "Watch";
  const score = prediction ? scoreValue(prediction.unifiedPredictionScore || prediction.aiOpportunityScore) : 0;
  const previousScore = Number(prediction?.previousUnifiedPredictionScore || prediction?.priorUnifiedPredictionScore || score);
  const scoreChange = Number(prediction?.scoreChange ?? prediction?.rankMovement?.change ?? (score - previousScore)) || 0;
  const confidence = prediction ? confidenceCategory(prediction) : "Low";
  const trend = technical.trendDirection || prediction?.unifiedDirection || "neutral";
  const pattern = prediction?.chartPatternSignal?.primaryPattern || "None";
  const dataQuality = prediction?.dataQualityStatus || "partial";
  const price = currentPriceForPrediction(prediction || {});
  const priceChange = Number(prediction?.priceChangePercent || prediction?.changePercent || 0);
  const activeAlerts = watchlistAlerts.filter((alert) => normalizeTicker(alert.ticker) === normalizeTicker(ticker) && alert.active !== false);
  const badges = [];
  if (!prediction) badges.push("Needs Attention");
  if (scoreChange > 2) badges.push("Improving");
  if (scoreChange < -2) badges.push("Weakening");
  if (Number(prediction?.recommendationChanged)) badges.push("Changed");
  if (Number(prediction?.newSetupDetected) || prediction?.setupSignals?.confirmationStatus === "confirmed") badges.push("New");
  if (["partial", "stale", "failed"].includes(dataQuality)) badges.push("Needs Attention");
  if (activeAlerts.length) badges.push("Alert");
  return {
    ticker: normalizeTicker(ticker),
    name: prediction?.name || ticker,
    prediction,
    price,
    priceChange,
    score,
    scoreChange,
    recommendation,
    confidence,
    trend,
    pattern,
    dataQuality,
    updatedAt: prediction?.scannedAt || predictionEngine.updatedAt || null,
    activeAlerts,
    badges,
  };
}

function watchlistHealth(list) {
  const rows = (list.tickers || []).map(watchlistTickerRecord);
  const averageUnifiedScore = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0;
  const highConfidenceCount = rows.filter((row) => ["High", "Very High"].includes(row.confidence)).length;
  const weakeningCount = rows.filter((row) => row.scoreChange < -2 || row.badges.includes("Weakening")).length;
  const dataIssueCount = rows.filter((row) => ["partial", "stale", "failed"].includes(row.dataQuality)).length;
  const bullish = rows.filter((row) => row.trend === "bullish").length;
  const bearish = rows.filter((row) => row.trend === "bearish").length;
  const direction = bullish > bearish ? "bullish" : bearish > bullish ? "bearish" : rows.length ? "mixed" : "neutral";
  const healthScore = Math.max(0, Math.min(100, Math.round(averageUnifiedScore + highConfidenceCount * 3 - weakeningCount * 6 - dataIssueCount * 4)));
  const reasonSummary = rows.length
    ? `${list.name} averages ${averageUnifiedScore}/100 with ${highConfidenceCount} high-confidence pick(s), ${weakeningCount} weakening name(s), and ${dataIssueCount} data issue(s).`
    : `${list.name} has no stocks yet. Add tickers to start monitoring.`;
  return { healthScore, direction, averageUnifiedScore, highConfidenceCount, weakeningCount, dataIssueCount, reasonSummary, rows };
}

function renderWatchlists() {
  if (!output.watchlistOverviewGrid) return;
  if (!watchlists.length) watchlists = defaultWatchlists();
  const selected = watchlists.find((list) => list.id === selectedWatchlistId) || watchlists[0];
  selectedWatchlistId = selected?.id || selectedWatchlistId;
  const allRows = watchlists.flatMap((list) => (list.tickers || []).map(watchlistTickerRecord));
  const uniqueTickers = new Set(allRows.map((row) => row.ticker));
  const highConfidence = allRows.filter((row) => ["High", "Very High"].includes(row.confidence)).length;
  const bullishChanges = allRows.filter((row) => row.scoreChange > 2 || row.badges.includes("Improving")).length;
  const bearishChanges = allRows.filter((row) => row.scoreChange < -2 || row.badges.includes("Weakening")).length;
  const dataIssues = allRows.filter((row) => ["partial", "stale", "failed"].includes(row.dataQuality)).length;
  const activeAlerts = watchlistAlerts.filter((alert) => alert.active !== false);
  if (output.watchlistActiveName) output.watchlistActiveName.textContent = selected?.name || "All watchlists";
  output.watchlistOverviewGrid.innerHTML = [
    marketMetricCard("Number of watchlists", String(watchlists.length), "Custom monitoring groups", "neutral"),
    marketMetricCard("Total tracked stocks", String(uniqueTickers.size), "Unique tickers monitored", "neutral"),
    marketMetricCard("High-confidence opportunities", String(highConfidence), "High or very high confidence", "success"),
    marketMetricCard("New bullish changes", String(bullishChanges), "Improving scores or setups", "success"),
    marketMetricCard("New bearish changes", String(bearishChanges), "Weakening scores or trend", "warning"),
    marketMetricCard("Data-quality issues", String(dataIssues), "Partial, stale, or failed data", dataIssues ? "warning" : "success"),
    marketMetricCard("Recent alerts", String(activeAlerts.length), "In-app alert rules active", "neutral"),
  ].join("");

  output.watchlistCardsGrid.innerHTML = watchlists.length
    ? watchlists
        .map((list) => {
          const health = watchlistHealth(list);
          const highest = [...health.rows].sort((a, b) => b.score - a.score)[0];
          const largestUp = [...health.rows].sort((a, b) => b.scoreChange - a.scoreChange)[0];
          const largestDown = [...health.rows].sort((a, b) => a.scoreChange - b.scoreChange)[0];
          const alerts = health.rows.reduce((sum, row) => sum + row.activeAlerts.length, 0);
          return `
            <article class="watchlist-card ${selectedWatchlistId === list.id ? "is-active" : ""}">
              <header>
                <input value="${escapeHtml(list.name)}" data-watchlist-rename="${escapeHtml(list.id)}" aria-label="Rename ${escapeHtml(list.name)}" />
                <button type="button" class="pti-button ghost" data-watchlist-delete="${escapeHtml(list.id)}">Delete</button>
              </header>
              <div class="watchlist-health-pill ${health.direction}">
                <strong>${health.healthScore}/100</strong>
                <span>${escapeHtml(health.direction)}</span>
              </div>
              <div class="watchlist-card-stats">
                <span>${health.rows.length} stocks</span>
                <span>Avg ${health.averageUnifiedScore}/100</span>
                <span>Top ${escapeHtml(highest?.ticker || "n/a")}</span>
                <span>Up ${escapeHtml(largestUp?.ticker || "n/a")} ${largestUp ? percent(largestUp.scoreChange) : ""}</span>
                <span>Down ${escapeHtml(largestDown?.ticker || "n/a")} ${largestDown ? percent(largestDown.scoreChange) : ""}</span>
                <span>${alerts} alert(s)</span>
              </div>
              <p>${escapeHtml(health.reasonSummary)}</p>
              <button type="button" data-watchlist-view="${escapeHtml(list.id)}">View Watchlist</button>
            </article>
          `;
        })
        .join("")
    : `<article class="watchlist-empty"><strong>No watchlists yet</strong><p>Create a watchlist to start monitoring tickers.</p></article>`;

  renderWatchlistDetail(selected);
  renderWatchlistAlerts();
}

function renderWatchlistDetail(list) {
  if (!output.watchlistDetailGrid || !list) return;
  if (output.watchlistDetailTitle) output.watchlistDetailTitle.textContent = list.name;
  let rows = (list.tickers || []).map(watchlistTickerRecord);
  const filter = output.watchlistFilter?.value || "";
  if (filter === "changed") rows = rows.filter((row) => row.badges.some((badge) => ["New", "Improving", "Weakening", "Changed"].includes(badge)));
  else if (filter === "alert") rows = rows.filter((row) => row.activeAlerts.length);
  else if (filter === "dataIssue") rows = rows.filter((row) => ["partial", "stale", "failed"].includes(row.dataQuality));
  else if (filter) rows = rows.filter((row) => row.recommendation === filter || row.confidence === filter || row.trend === filter);
  const sort = output.watchlistSort?.value || "score";
  rows.sort((a, b) => {
    if (sort === "scoreChange") return b.scoreChange - a.scoreChange;
    if (sort === "priceChange") return b.priceChange - a.priceChange;
    if (sort === "confidence") return ["Low", "Medium", "High", "Very High"].indexOf(b.confidence) - ["Low", "Medium", "High", "Very High"].indexOf(a.confidence);
    if (sort === "ticker") return a.ticker.localeCompare(b.ticker);
    if (sort === "company") return a.name.localeCompare(b.name);
    if (sort === "updated") return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    return b.score - a.score;
  });
  output.watchlistDetailGrid.innerHTML = rows.length
    ? rows
        .map(
          (row) => `
            <article class="watchlist-stock-card">
              <header>
                <div><strong>${escapeHtml(row.ticker)}</strong><span>${escapeHtml(row.name)}</span></div>
                <span class="pti-badge ${badgeClassForRecommendation(row.recommendation)}">${escapeHtml(row.recommendation)}</span>
              </header>
              <div class="watchlist-stock-metrics">
                <div><span>Price</span><strong>${moneyOrCalculating(row.price)}</strong><small>${percent(row.priceChange)}</small></div>
                <div><span>Score</span><strong>${row.score}/100</strong><small>${row.scoreChange ? percent(row.scoreChange) : "No change"}</small></div>
                <div><span>Confidence</span><strong>${escapeHtml(row.confidence)}</strong></div>
                <div><span>Trend</span><strong>${escapeHtml(row.trend)}</strong></div>
                <div><span>Pattern</span><strong>${escapeHtml(row.pattern)}</strong></div>
                <div><span>Data</span><strong>${escapeHtml(row.dataQuality)}</strong></div>
              </div>
              <div class="watchlist-badge-row">
                ${row.badges.length ? row.badges.map((badge) => `<span class="pti-badge ${badge === "Weakening" || badge === "Needs Attention" ? "warning" : "info"}">${escapeHtml(badge)}</span>`).join("") : `<span class="pti-badge neutral">No recent changes</span>`}
              </div>
              <footer>
                <button type="button" data-view-brief="${escapeHtml(row.ticker)}">View Trade Brief</button>
                <button type="button" data-watchlist-alert-ticker="${escapeHtml(row.ticker)}">Create Alert</button>
                <button type="button" data-quick-compare="${escapeHtml(row.ticker)}">Compare</button>
                <label class="watchlist-move-control">
                  <span>Move</span>
                  <select data-watchlist-move="${escapeHtml(row.ticker)}">
                    <option value="">Choose list</option>
                    ${watchlists
                      .filter((targetList) => targetList.id !== selectedWatchlistId)
                      .map((targetList) => `<option value="${escapeHtml(targetList.id)}">${escapeHtml(targetList.name)}</option>`)
                      .join("")}
                  </select>
                </label>
                <button type="button" class="pti-button ghost" data-watchlist-remove="${escapeHtml(row.ticker)}">Remove</button>
              </footer>
              <small>Last updated: ${row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "Tracking"}</small>
            </article>
          `
        )
        .join("")
    : `<article class="watchlist-empty"><strong>No stocks in this watchlist</strong><p>Add a ticker to start monitoring changes and alerts.</p><button type="button" data-focus-watchlist-add>Add ticker</button></article>`;
}

function alertTypeLabel(type) {
  return String(type || "alert")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function createAlertRule({ ticker = "", type = "scoreIncrease", priority = "High", threshold = "", source = "alerts" }) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}-${normalizeTicker(ticker) || "market"}`,
    ticker: normalizeTicker(ticker) || String(ticker || "Market").trim(),
    type,
    priority,
    threshold: String(threshold || "").trim(),
    active: true,
    source,
    delivery: {
      inApp: true,
      email: false,
      sms: false,
      push: false,
      slack: false,
      discord: false,
      webhook: false,
    },
    createdAt: new Date().toISOString(),
  };
}

function alertPriorityScore(priority) {
  return { Critical: 4, High: 3, Medium: 2, Low: 1 }[priority] || 1;
}

function alertIcon(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized.includes("congress")) return "$";
  if (normalized.includes("policy")) return "P";
  if (normalized.includes("market") || normalized.includes("sector")) return "M";
  if (normalized.includes("data") || normalized.includes("engine")) return "!";
  if (normalized.includes("stop") || normalized.includes("decrease")) return "-";
  return "+";
}

function alertWatchlistName(ticker) {
  const normalized = normalizeTicker(ticker);
  return watchlists.find((list) => (list.tickers || []).includes(normalized))?.name || "Unassigned";
}

function alertSector(ticker) {
  const prediction = predictionForTicker(ticker);
  return prediction ? sectorForPrediction(prediction) : "";
}

function alertEventId(parts) {
  return parts.map((part) => String(part || "").replace(/\s+/g, "-")).join(":");
}

function upsertAlertHistory(event) {
  if (!event?.id) return;
  const existing = alertHistory.find((item) => item.id === event.id);
  if (existing) {
    Object.assign(existing, { ...event, read: existing.read, resolved: existing.resolved, snoozedUntil: existing.snoozedUntil });
  } else {
    alertHistory.unshift({
      read: false,
      resolved: false,
      muted: false,
      ...event,
    });
  }
  alertHistory = alertHistory.slice(0, 250);
}

function evaluateAlertRules() {
  const now = new Date().toISOString();
  (watchlistAlerts || [])
    .filter((rule) => rule.active !== false)
    .forEach((rule) => {
      const prediction = predictionForTicker(rule.ticker);
      const record = prediction ? watchlistTickerRecord(rule.ticker) : null;
      const threshold = Number(rule.threshold);
      let triggered = false;
      let explanation = "";
      let action = "Review the signal before taking action.";
      if (rule.type === "scoreAbove" || rule.type === "scoreIncrease") {
        triggered = record ? (Number.isFinite(threshold) ? record.score >= threshold : record.scoreChange > 2) : false;
        explanation = record ? `${record.ticker} score is ${record.score}/100 with ${percent(record.scoreChange)} score change.` : "Waiting for prediction data.";
        action = "Open the Trade Brief and confirm the setup.";
      } else if (rule.type === "scoreDecrease") {
        triggered = record ? (Number.isFinite(threshold) ? record.score <= threshold : record.scoreChange < -2) : false;
        explanation = record ? `${record.ticker} score weakened to ${record.score}/100.` : "Waiting for prediction data.";
        action = "Check risk factors and support levels.";
      } else if (["recommendationChange", "confidenceChange", "trendReversal", "newChartPattern", "newSetupDetected"].includes(rule.type)) {
        triggered = record ? record.badges.some((badge) => ["New", "Changed", "Improving", "Weakening"].includes(badge)) : false;
        explanation = record ? `${record.ticker} has status badges: ${record.badges.join(", ") || "none"}.` : "Waiting for prediction data.";
      } else if (rule.type === "priceAbove") {
        triggered = record ? Number.isFinite(threshold) && record.price >= threshold : false;
        explanation = record ? `${record.ticker} price is ${moneyOrCalculating(record.price)}.` : "Waiting for price data.";
      } else if (rule.type === "priceBelow") {
        triggered = record ? Number.isFinite(threshold) && record.price > 0 && record.price <= threshold : false;
        explanation = record ? `${record.ticker} price is ${moneyOrCalculating(record.price)}.` : "Waiting for price data.";
      } else if (["congressBuy", "congressSell"].includes(rule.type)) {
        const actionType = rule.type === "congressBuy" ? "Buy" : "Sell";
        triggered = (settings.congressTrades || []).some((trade) => normalizeTicker(trade.ticker) === normalizeTicker(rule.ticker) && trade.transaction === actionType);
        explanation = `${rule.ticker || "Ticker"} has tracked congressional ${actionType.toLowerCase()} activity.`;
        action = "Open Congress tracker and review disclosure context.";
      } else if (rule.type === "policyCatalyst") {
        triggered = (policySignals.signals || []).some((signal) => normalizeTicker(signal.ticker) === normalizeTicker(rule.ticker));
        explanation = `${rule.ticker || "Ticker"} has a matching policy/news catalyst.`;
        action = "Open Policy monitor and review catalyst direction.";
      } else if (rule.type === "watchlistHealth") {
        const list = watchlists.find((item) => item.name === rule.ticker || item.id === rule.ticker) || watchlists[0];
        const health = list ? watchlistHealth(list) : null;
        triggered = health ? health.weakeningCount > 0 || health.dataIssueCount > 0 || health.healthScore < (threshold || 60) : false;
        explanation = health ? `${list.name} health is ${health.healthScore}/100. ${health.reasonSummary}` : "No watchlist available.";
        action = "Open Watchlists and review names needing attention.";
      }
      if (triggered) {
        upsertAlertHistory({
          id: alertEventId(["rule", rule.id, rule.ticker, rule.type, new Date().toISOString().slice(0, 10)]),
          ruleId: rule.id,
          icon: alertIcon(rule.type),
          priority: rule.priority || "Medium",
          timestamp: now,
          ticker: rule.ticker || "Market",
          type: alertTypeLabel(rule.type),
          explanation,
          suggestedAction: action,
          watchlist: alertWatchlistName(rule.ticker),
          sector: alertSector(rule.ticker),
          source: "Rule",
        });
      }
    });

  const health = predictionEngine.predictionEngineHealth || {};
  if (health.predictionEngineStatus === "Failed") {
    upsertAlertHistory({
      id: alertEventId(["system", "prediction-engine", new Date().toISOString().slice(0, 10)]),
      icon: "!",
      priority: "Critical",
      timestamp: now,
      ticker: "System",
      type: "Prediction Engine Issue",
      explanation: "Prediction engine reported a failed status.",
      suggestedAction: "Open Admin System Health and inspect the latest scan.",
      watchlist: "System",
      sector: "System",
      source: "System",
    });
  }
  if (["partial", "stale", "failed"].includes(health.dataQualityStatus)) {
    upsertAlertHistory({
      id: alertEventId(["system", "market-data", health.dataQualityStatus, new Date().toISOString().slice(0, 10)]),
      icon: "!",
      priority: health.dataQualityStatus === "failed" ? "High" : "Medium",
      timestamp: now,
      ticker: "Market",
      type: "Market Data Issue",
      explanation: `Market data quality is ${health.dataQualityStatus}.`,
      suggestedAction: "Review Market Intelligence before trusting short-term signals.",
      watchlist: "System",
      sector: "Market",
      source: "System",
    });
  }
  (settings.congressTrades || [])
    .slice(0, 4)
    .forEach((trade) => {
      if (!["Buy", "Sell"].includes(trade.transaction)) return;
      upsertAlertHistory({
        id: alertEventId(["congress", trade.ticker, trade.transaction, trade.reportedDate]),
        icon: "$",
        priority: trade.transaction === "Buy" ? "High" : "Medium",
        timestamp: trade.reportedDate || now,
        ticker: trade.ticker,
        type: `Congress ${trade.transaction}`,
        explanation: `${trade.representative} reported a ${trade.transaction.toLowerCase()} in ${trade.company || trade.ticker}.`,
        suggestedAction: "Review Congress tracker and compare with current prediction score.",
        watchlist: alertWatchlistName(trade.ticker),
        sector: alertSector(trade.ticker),
        source: "Congress",
      });
    });
  (policySignals.signals || [])
    .slice(0, 4)
    .forEach((signal) => {
      upsertAlertHistory({
        id: alertEventId(["policy", signal.ticker, signal.direction, signal.updatedAt || policySignals.updatedAt]),
        icon: "P",
        priority: signal.direction === "negative" ? "High" : "Medium",
        timestamp: signal.updatedAt || policySignals.updatedAt || now,
        ticker: signal.ticker || "Policy",
        type: "Policy Catalyst",
        explanation: `${signal.ticker || "A tracked industry"} has a ${signal.direction || "neutral"} policy/news catalyst.`,
        suggestedAction: "Open Policy monitor and check catalyst details.",
        watchlist: alertWatchlistName(signal.ticker),
        sector: alertSector(signal.ticker),
        source: "Policy",
      });
    });
  saveWatchlists();
}

function visibleAlerts() {
  evaluateAlertRules();
  const status = output.alertFilterStatus?.value || "";
  const priority = output.alertFilterPriority?.value || "";
  const ticker = normalizeTicker(output.alertFilterTicker?.value);
  const watchlist = output.alertFilterWatchlist?.value || "";
  const sector = String(output.alertFilterSector?.value || "").trim().toLowerCase();
  const date = output.alertFilterDate?.value || "";
  const type = String(output.alertFilterType?.value || "").trim().toLowerCase();
  return [...alertHistory]
    .filter((alert) => {
      if (status === "unread" && alert.read) return false;
      if (status === "resolved" && !alert.resolved) return false;
      if (status === "muted" && !alert.muted && !alert.snoozedUntil) return false;
      if (!status && alert.resolved) return false;
      if (priority && alert.priority !== priority) return false;
      if (ticker && normalizeTicker(alert.ticker) !== ticker) return false;
      if (watchlist && alert.watchlist !== watchlist) return false;
      if (sector && !String(alert.sector || "").toLowerCase().includes(sector)) return false;
      if (date && String(alert.timestamp || "").slice(0, 10) !== date) return false;
      if (type && !`${alert.type} ${alert.explanation}`.toLowerCase().includes(type)) return false;
      return true;
    })
    .sort((a, b) => alertPriorityScore(b.priority) - alertPriorityScore(a.priority) || new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
}

function renderAlertsCenter() {
  if (!output.alertsList) return;
  const alerts = visibleAlerts();
  const today = new Date().toISOString().slice(0, 10);
  const active = alertHistory.filter((alert) => !alert.resolved);
  const unread = active.filter((alert) => !alert.read);
  const muted = active.filter((alert) => alert.muted || alert.snoozedUntil);
  const resolved = alertHistory.filter((alert) => alert.resolved);
  const highest = active.sort((a, b) => alertPriorityScore(b.priority) - alertPriorityScore(a.priority))[0];
  if (output.alertsDashboardStatus) output.alertsDashboardStatus.textContent = highest ? `${highest.priority} priority` : "Monitoring";
  if (output.alertsOverviewGrid) {
    output.alertsOverviewGrid.innerHTML = [
      marketMetricCard("Active Alerts", String(active.length), "Open in-app alerts"),
      marketMetricCard("Triggered Today", String(alertHistory.filter((alert) => String(alert.timestamp || "").slice(0, 10) === today).length), "Generated today"),
      marketMetricCard("High Priority", String(active.filter((alert) => ["Critical", "High"].includes(alert.priority)).length), "Critical or high", "warning"),
      marketMetricCard("Unread", String(unread.length), "Need review", unread.length ? "warning" : "success"),
      marketMetricCard("Muted", String(muted.length), "Snoozed alerts"),
      marketMetricCard("Resolved", String(resolved.length), "Closed history"),
    ].join("");
  }
  if (output.alertFeedCount) output.alertFeedCount.textContent = `${alerts.length} visible`;
  if (output.alertFilterWatchlist) {
    const current = output.alertFilterWatchlist.value;
    output.alertFilterWatchlist.innerHTML = `<option value="">All watchlists</option>${watchlists.map((list) => `<option value="${escapeHtml(list.name)}">${escapeHtml(list.name)}</option>`).join("")}`;
    output.alertFilterWatchlist.value = current;
  }
  output.alertsList.innerHTML = alerts.length
    ? alerts
        .map(
          (alert) => `
            <article class="alert-feed-card priority-${String(alert.priority || "Low").toLowerCase()} ${alert.read ? "is-read" : "is-unread"}">
              <div class="alert-icon">${escapeHtml(alert.icon || "!")}</div>
              <div class="alert-feed-body">
                <div class="alert-feed-top">
                  <span class="pti-badge ${alert.priority === "Critical" ? "danger" : alert.priority === "High" ? "warning" : "neutral"}">${escapeHtml(alert.priority || "Low")}</span>
                  <strong>${escapeHtml(alert.ticker || "Market")} | ${escapeHtml(alert.type || "Alert")}</strong>
                  <small>${alert.timestamp ? new Date(alert.timestamp).toLocaleString() : "Now"}</small>
                </div>
                <p>${escapeHtml(alert.explanation || "Alert triggered.")}</p>
                <small>Suggested action: ${escapeHtml(alert.suggestedAction || "Review the related dashboard.")}</small>
                <footer>
                  <button type="button" data-view-brief="${escapeHtml(alert.ticker)}">View Trade Brief</button>
                  <button type="button" data-alert-read="${escapeHtml(alert.id)}">${alert.read ? "Mark Unread" : "Mark Read"}</button>
                  <button type="button" data-alert-snooze="${escapeHtml(alert.id)}">Snooze</button>
                  <button type="button" data-alert-dismiss="${escapeHtml(alert.id)}">Dismiss</button>
                </footer>
              </div>
            </article>
          `
        )
        .join("")
    : `<article class="watchlist-empty"><strong>No alerts match these filters</strong><p>Create a rule or clear filters to see active alerts.</p></article>`;

  if (output.alertRuleList) {
    output.alertRuleList.innerHTML = watchlistAlerts.length
      ? watchlistAlerts
          .map((rule) => `<article class="alert-rule-card"><strong>${escapeHtml(rule.ticker || "Market")}</strong><span>${escapeHtml(alertTypeLabel(rule.type))} | ${escapeHtml(rule.priority || "Medium")}</span><small>${escapeHtml(rule.threshold || "No threshold")} | In-App active</small><button type="button" class="pti-button ghost" data-alert-rule-delete="${escapeHtml(rule.id)}">Delete</button></article>`)
          .join("")
      : `<article class="watchlist-empty"><strong>No alert rules yet</strong><p>Create a rule to make the app actively monitor a ticker, sector, watchlist, or system condition.</p></article>`;
  }
  if (output.deliveryPreferencesGrid) {
    output.deliveryPreferencesGrid.innerHTML = [
      ["In-App", "Active"],
      ["Email", "Coming Soon"],
      ["SMS", "Coming Soon"],
      ["Push Notification", "Coming Soon"],
      ["Slack", "Coming Soon"],
      ["Discord", "Coming Soon"],
      ["Webhook", "Coming Soon"],
    ]
      .map(([name, status]) => `<article class="delivery-card ${status === "Active" ? "active" : ""}"><strong>${name}</strong><span>${status}</span></article>`)
      .join("");
  }
  renderAlertHistory();
  renderTopbarAlerts();
}

function renderAlertHistory() {
  if (!output.alertHistoryList) return;
  const search = String(output.alertHistorySearch?.value || "").trim().toLowerCase();
  const rows = alertHistory
    .filter((alert) => !search || `${alert.ticker} ${alert.type} ${alert.explanation} ${alert.suggestedAction}`.toLowerCase().includes(search))
    .slice(0, 80);
  output.alertHistoryList.innerHTML = rows.length
    ? rows
        .map((alert) => `<article class="alert-history-card"><strong>${escapeHtml(alert.ticker)} | ${escapeHtml(alert.type)}</strong><span>${escapeHtml(alert.priority)} | ${alert.timestamp ? new Date(alert.timestamp).toLocaleString() : "Now"}</span><small>${escapeHtml(alert.resolved ? "Resolved" : alert.read ? "Read" : "Unread")}</small></article>`)
        .join("")
    : `<article class="watchlist-empty"><strong>No alert history yet</strong><p>Triggered alerts will remain searchable here.</p></article>`;
}

function closeTopbarMenus() {
  if (output.profileDropdown) output.profileDropdown.hidden = true;
  if (output.alertsDropdown) output.alertsDropdown.hidden = true;
  output.profileMenuButton?.setAttribute("aria-expanded", "false");
  output.alertsMenuButton?.setAttribute("aria-expanded", "false");
}

function toggleTopbarMenu(menuName) {
  const isProfile = menuName === "profile";
  const dropdown = isProfile ? output.profileDropdown : output.alertsDropdown;
  const button = isProfile ? output.profileMenuButton : output.alertsMenuButton;
  if (!dropdown || !button) return;
  const willOpen = dropdown.hidden;
  closeTopbarMenus();
  dropdown.hidden = !willOpen;
  button.setAttribute("aria-expanded", String(willOpen));
}

function renderTopbarAlerts() {
  if (!output.topbarAlertCount && !output.alertsDropdownContent) return;
  const active = alertHistory.filter((alert) => !alert.resolved);
  const unread = active.filter((alert) => !alert.read);
  const highest = [...active].sort((a, b) => alertPriorityScore(b.priority) - alertPriorityScore(a.priority))[0];
  if (output.topbarAlertCount) output.topbarAlertCount.textContent = String(unread.length);
  if (output.alertsDropdownCount) output.alertsDropdownCount.textContent = `${unread.length} unread`;
  if (!output.alertsDropdownContent) return;
  if (!active.length) {
    output.alertsDropdownContent.innerHTML = `<p>No new alerts.</p>`;
    return;
  }
  output.alertsDropdownContent.innerHTML = `
    <article class="dropdown-alert-item">
      <span>${escapeHtml(highest?.priority || "Low")}</span>
      <strong>${escapeHtml(highest?.ticker || "Market")} | ${escapeHtml(highest?.type || "Alert")}</strong>
      <small>${escapeHtml(highest?.explanation || "Review the Alerts Center.")}</small>
    </article>
    ${active
      .slice(0, 3)
      .map(
        (alert) => `
          <article class="dropdown-alert-item compact">
            <strong>${escapeHtml(alert.ticker || "Market")}</strong>
            <small>${escapeHtml(alert.type || "Alert")} | ${alert.timestamp ? new Date(alert.timestamp).toLocaleString() : "Now"}</small>
          </article>
        `,
      )
      .join("")}
  `;
}

function renderWatchlistAlerts() {
  if (!output.watchlistAlertsList) return;
  const activeAlerts = watchlistAlerts.filter((alert) => alert.active !== false);
  output.watchlistAlertsList.innerHTML = activeAlerts.length
    ? activeAlerts
        .map((alert) => `<article class="watchlist-alert-card"><strong>${escapeHtml(alert.ticker)}</strong><span>${escapeHtml(alert.type)}</span><small>${escapeHtml(alert.threshold || "No threshold")} | ${new Date(alert.createdAt).toLocaleDateString()}</small><button type="button" class="pti-button ghost" data-alert-delete="${escapeHtml(alert.id)}">Remove</button></article>`)
        .join("")
    : `<article class="watchlist-empty"><strong>No active alerts</strong><p>Create an in-app alert rule for score, recommendation, confidence, trend, congress, or policy changes.</p></article>`;
}

function addAlertRuleForTicker(ticker, source = "alerts") {
  const normalized = normalizeTicker(ticker);
  if (!normalized) return null;
  const prediction = predictionForTicker(normalized);
  const score = Math.max(70, Math.round(Number(prediction?.unifiedPredictionScore) || 75));
  const rule = createAlertRule({
    ticker: normalized,
    type: "scoreAbove",
    priority: "High",
    threshold: String(score),
    source,
  });
  watchlistAlerts.unshift(rule);
  saveWatchlists();
  renderAlertsCenter();
  renderWatchlists();
  renderDashboard();
  return rule;
}

function addTickerToActiveWatchlist(ticker) {
  const normalized = normalizeTicker(ticker);
  if (!normalized) return false;
  if (!Array.isArray(settings.stockIdeas)) settings.stockIdeas = [];
  if (!settings.stockIdeas.some((stock) => normalizeTicker(stock.ticker) === normalized)) {
    const prediction = findPredictionByTicker(normalized);
    settings.stockIdeas.unshift({
      ticker: normalized,
      name: prediction?.name || normalized,
      risk: "AI watchlist",
      horizon: prediction?.bestTimeframe || prediction?.timeframe || "Research",
      priceNote: prediction?.finalReasonSummary || prediction?.plainEnglish || "Added from Predictions screener.",
    });
  }
  if (!watchlists.length) loadWatchlists();
  const list = watchlists.find((item) => item.id === selectedWatchlistId) || watchlists[0];
  if (list && !list.tickers.includes(normalized)) list.tickers.push(normalized);
  saveWatchlists();
  renderWatchlists();
  renderDashboard();
  return true;
}

function pickDistinctOpportunity(label, candidates, usedTickers, roleReason) {
  const rows = (Array.isArray(candidates) ? candidates : [candidates]).filter(Boolean);
  const preferred = rows.find((item) => !usedTickers.has(item.ticker)) || rows[0] || null;
  if (preferred) {
    usedTickers.add(preferred.ticker);
    return compactPickCard(label, {
      ...preferred,
      roleQualificationReason: preferred.roleQualificationReason || roleReason,
    });
  }
  return compactPickCard(label, null);
}

function renderDashboardBrief({ predictions, marketMood, signals, positiveSignals, negativeSignals, health }) {
  if (!output.aiDashboardBrief) return;
  const highConfidence = predictions.filter((item) => ["high", "very high"].includes(item.confidenceTier)).length;
  const sector = sectorStrengthSummary(predictions);
  const warningCount = Number(health.incompleteMarketDataCount) || predictions.filter((item) => ["partial", "stale", "failed"].includes(item.dataQualityStatus)).length;
  const risks = [
    warningCount ? `${warningCount} ticker(s) have partial, stale, or missing market data` : "",
    negativeSignals.length ? `${negativeSignals.length} negative policy/news signal(s)` : "",
    health.dataQualityStatus && !["good", "Good"].includes(health.dataQualityStatus) ? `market data quality is ${health.dataQualityStatus}` : "",
  ].filter(Boolean);
  if (output.aiDashboardBriefStatus) output.aiDashboardBriefStatus.textContent = predictions.length ? "Generated from latest scan" : "Waiting for scan";
  output.aiDashboardBrief.textContent = predictions.length
    ? `Market read: ${marketMood}. Sector leadership currently points to ${sector}. The scan found ${highConfidence} high-confidence opportunity candidate(s) across ${predictions.length} analyzed securities. Positive policy/news signals: ${positiveSignals.length}; negative signals: ${negativeSignals.length}; total active signals: ${signals.length}. Main warning: ${risks[0] || "no major data-quality warning in the saved scan"}. Review Today's Opportunities first, then open the Trade Brief before acting. This is research guidance, not a guaranteed investment outcome.`
    : "Run a prediction scan to generate a concise market brief from available market, sector, policy, news, congressional, and data-quality signals.";
}

function renderScanProgressSummary(isActive = false, stage = "Idle", percent = 0) {
  const scan = predictionEngine.scanHealth || {};
  if (output.scanProgressStage) output.scanProgressStage.textContent = stage;
  if (output.scanProgressBar) output.scanProgressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  if (output.scanProgressMessage) {
    if (isActive) {
      output.scanProgressMessage.textContent = stage;
    } else if (scan.scanCompletedAt || predictionEngine.updatedAt) {
      const completed = scan.scanCompletedAt || predictionEngine.updatedAt;
      const dataAsOf = scan.dataAsOf || "market data timestamp unavailable";
      output.scanProgressMessage.textContent = `Scan complete. Last scan: ${new Date(completed).toLocaleString()}. Data as of: ${dataAsOf === "market data timestamp unavailable" ? dataAsOf : new Date(dataAsOf).toLocaleString()}.`;
    } else {
      output.scanProgressMessage.textContent = "No successful scan is saved yet.";
    }
  }
  if (output.scanProgressSummaryGrid) {
    output.scanProgressSummaryGrid.innerHTML = [
      metricCard("Symbols Available", String(scan.totalSymbolsAvailable || predictionEngine.scanUniverse?.totalSymbolsAvailable || 0), "Actual configured provider/universe coverage", "predictions"),
      metricCard("Symbols Screened", String(scan.symbolsScreened || 0), `Target ${scan.targetSymbolCount || predictionEngine.scanUniverse?.targetSymbolCount || 2500}`, "predictions"),
      metricCard("Deep Candidates", String(scan.deepAnalysisCandidatesSelected || predictionEngine.scanUniverse?.candidateCount || 0), "Selected for full analysis", "predictions"),
      metricCard("Predictions Generated", String(scan.predictionsGenerated || predictionEngine.predictions?.length || 0), "Published after validation", "predictions"),
      metricCard("Duration", scan.durationMs ? `${(scan.durationMs / 1000).toFixed(1)}s` : "Not recorded", "Scan completion duration", "predictions"),
      metricCard("Data Quality", predictionEngine.predictionEngineHealth?.dataQualityStatus || "Not run", "Separate from engine health", "predictions"),
    ].join("");
  }
}

function setScanUi(stage, percent, message) {
  if (output.scanProgressStage) output.scanProgressStage.textContent = stage;
  if (output.scanProgressBar) output.scanProgressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  if (output.scanProgressMessage) output.scanProgressMessage.textContent = message || stage;
  if (output.predictionScanMessage) output.predictionScanMessage.textContent = message || stage;
}

function renderDashboard() {
  if (!output.marketOverviewGrid) return;
  const health = predictionEngine.predictionEngineHealth || {};
  const totals = portfolioTotals();
  const predictions = predictionEngine.predictions || [];
  const topToday = firstFromSection("top25OneDay");
  const topWeek = firstFromSection("top25SevenDay");
  const topMonth = firstFromSection("top25OneMonth");
  const topYear = firstFromSection("top25OneYear");
  const mostImproved = strongestBy(predictions, (item) => item.scoreChange || item.rankMovement?.change || 0);
  const highestConfidence = strongestBy(predictions, (item) => item.confidenceScore || item.unifiedPredictionScore || 0);
  const engineStatus = health.predictionEngineStatus || health.status || (predictionEngine.updatedAt ? "Healthy" : "Not run");
  const dataStatus = health.dataQualityStatus || "Not run";
  const marketMood = predictionEngine.marketRegime?.primary || topToday?.marketRegime?.primary || "Scanning";
  const trades = settings.congressTrades || [];
  const buys = trades.filter((trade) => trade.transaction === "Buy");
  const sells = trades.filter((trade) => trade.transaction === "Sell");
  const alerts = trades.filter((trade) => ["Buy", "Sell"].includes(trade.transaction)).slice(0, 8);
  evaluateAlertRules();
  const activeAppAlerts = alertHistory.filter((alert) => !alert.resolved);
  const unreadAppAlerts = activeAppAlerts.filter((alert) => !alert.read);
  const highestPriorityAlert = [...activeAppAlerts].sort((a, b) => alertPriorityScore(b.priority) - alertPriorityScore(a.priority))[0];
  renderTopbarAlerts();
  const recentAppAlert = [...alertHistory].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))[0];
  const signals = policySignals.signals || [];
  const positiveSignals = signals.filter((signal) => signal.direction === "positive");
  const negativeSignals = signals.filter((signal) => signal.direction === "negative");
  const watchlistRows = watchlists.flatMap((list) => (list.tickers || []).map(watchlistTickerRecord));
  const highConfidenceAlerts = watchlistRows.filter((item) => ["High", "Very High"].includes(item.confidence)).length || predictions.filter((item) => ["high", "very high"].includes(item.confidenceTier)).length;
  const movers = watchlistRows.filter((item) => item.badges.some((badge) => ["New", "Improving", "Weakening", "Changed"].includes(badge))).length || predictions.filter((item) => Number(item.scoreChange || 0) !== 0 || item.rankMovement).length;
  const needsAttention = watchlistRows.filter((item) => item.badges.includes("Needs Attention")).length;

  if (output.marketOverviewTone) output.marketOverviewTone.textContent = marketMood;
  renderDashboardBrief({ predictions, marketMood, signals, positiveSignals, negativeSignals, health });
  renderScanProgressSummary(false, predictionEngine.updatedAt ? "Scan complete" : "Idle", predictionEngine.updatedAt ? 100 : 0);
  output.marketOverviewGrid.innerHTML = [
    metricCard("Overall market sentiment", marketMood, "Based on latest prediction scan", "market"),
    metricCard("Fear / Greed", predictions.length ? `${averageUnifiedScore(predictions)}/100` : "Historical outcomes not available yet", "Using prediction-universe estimate", "market"),
    metricCard("S&P 500", "Live index data not connected", "Using prediction-universe estimate", "market"),
    metricCard("Nasdaq", "Live index data not connected", "Growth/tech tape from candidates", "market"),
    metricCard("Dow", "Live index data not connected", "Large-cap industrial read pending", "market"),
    metricCard("VIX", "Waiting for live volatility feed", "Volatility detail pending", "market"),
    metricCard("Sector strength", sectorStrengthSummary(predictions), "Top scoring asset group", "market"),
  ].join("");

  output.predictionEngineGrid.innerHTML = [
    metricCard("Prediction Engine Status", engineStatus, `${Number(health.predictionsGenerated) || predictions.length} predictions generated`, "predictions"),
    metricCard("Market Data Status", dataStatus, `${Number(health.marketQuotesSucceeded) || 0}/${Number(health.marketQuotesRequested) || 0} quotes succeeded`, "predictions"),
    metricCard("Congress Feed Status", congressFeedStatus.error ? "Warning" : "Active", congressFeedStatus.error || `${Number(congressFeedStatus.totalTrades) || trades.length} saved trades`, "congress"),
    metricCard("Policy Feed Status", policySignals.errors?.length ? "Warning" : "Active", `${signals.length} policy/news signals`, "policy"),
    metricCard("Last Scan", predictionEngine.updatedAt ? new Date(predictionEngine.updatedAt).toLocaleString() : "Not scanned", "Run scan for latest read", "predictions"),
    metricCard("Candidates Scanned", String(Number(health.tickersScanned) || predictions.length || 0), `${predictionEngine.scanUniverse?.mode || "watchlist"} universe`, "predictions"),
    metricCard("Average Unified Score", `${averageUnifiedScore(predictions)}/100`, "Across generated predictions", "predictions"),
  ].join("");

  const usedTickers = new Set();
  const byMomentum = [...predictions].sort((a, b) => Number(b.modelScores?.momentum || 0) - Number(a.modelScores?.momentum || 0));
  const byRiskReward = [...predictions].sort((a, b) => Number(b.riskRewardRatio || 0) - Number(a.riskRewardRatio || 0));
  const contrarian = [...predictions].filter((item) => item.unifiedDirection !== "bearish" && Number(item.riskScore) < 65).sort((a, b) => Number(b.scoreChange || 0) - Number(a.scoreChange || 0));
  const opportunities = [
    pickDistinctOpportunity("Top 1-Day Opportunity", predictionEngine.sections?.top25OneDay || topToday, usedTickers, "Highest qualified 1-day ranking."),
    pickDistinctOpportunity("Best 7-Day Opportunity", predictionEngine.sections?.top25SevenDay || topWeek, usedTickers, "Highest qualified 7-day setup."),
    pickDistinctOpportunity("Best 1-Month Opportunity", predictionEngine.sections?.top25OneMonth || topMonth, usedTickers, "Highest qualified 1-month swing candidate."),
    pickDistinctOpportunity("Best 1-Year Opportunity", predictionEngine.sections?.top25OneYear || topYear, usedTickers, "Highest qualified 1-year hold candidate."),
    pickDistinctOpportunity("Highest Momentum", byMomentum, usedTickers, "Highest current momentum contribution."),
    pickDistinctOpportunity("Most Improved", [...predictions].sort((a, b) => Number(b.scoreChange || 0) - Number(a.scoreChange || 0)), usedTickers, "Largest score improvement versus prior scan."),
    pickDistinctOpportunity("Highest Confidence", [...predictions].sort((a, b) => Number(b.confidenceScore || b.unifiedPredictionScore || 0) - Number(a.confidenceScore || a.unifiedPredictionScore || 0)), usedTickers, "Highest confidence among analyzed candidates."),
    pickDistinctOpportunity("Contrarian Watch", contrarian, usedTickers, "Qualified lower-risk name with improving score."),
    pickDistinctOpportunity("Best Risk/Reward", byRiskReward, usedTickers, "Strongest available risk/reward ratio."),
  ];
  if (output.opportunityCount) output.opportunityCount.textContent = opportunities.length;
  output.todayOpportunitiesGrid.innerHTML = opportunities.join("");

  if (output.dashboardScanTime) {
    output.dashboardScanTime.textContent = predictionEngine.updatedAt ? new Date(predictionEngine.updatedAt).toLocaleString() : "Not scanned yet";
  }
  if (output.dashboardAlertCount) output.dashboardAlertCount.textContent = unreadAppAlerts.length;
  output.watchlistSummaryGrid.innerHTML = [
    metricCard("Watchlists", String(watchlists.length || 1), "Open Watchlists 2.0", "watchlist"),
    metricCard("Tracked Stocks", String(new Set(watchlistRows.map((row) => row.ticker)).size || (settings.stockIdeas || []).length), "Unique monitored tickers", "watchlist"),
    metricCard("New Changes", String(movers), "Improving, weakening, or changed", "watchlist"),
    metricCard("High-Confidence Picks", String(highConfidenceAlerts), "High or very high confidence", "watchlist"),
    metricCard("Needs Attention", String(needsAttention), "Data issues or weakening names", "watchlist"),
  ].join("");

  if (output.dashboardAlerts) {
    output.dashboardAlerts.innerHTML = [
      metricCard("Unread Alerts", String(unreadAppAlerts.length), "Open Alerts Center", "alerts"),
      metricCard("Highest Priority", highestPriorityAlert?.priority || "None", highestPriorityAlert?.ticker || "No active priority alert", "alerts"),
      metricCard("Recent Alert", recentAppAlert?.type || "None", recentAppAlert?.ticker || "No alert history yet", "alerts"),
    ].join("");
  }

  if (output.congressActivityCount) output.congressActivityCount.textContent = trades.length;
  output.congressActivityGrid.innerHTML = [
    metricCard("Recent Buys", String(buys.length), buys[0] ? `${buys[0].ticker} by ${buys[0].representative}` : "No recent buys", "congress"),
    metricCard("Recent Sells", String(sells.length), sells[0] ? `${sells[0].ticker} by ${sells[0].representative}` : "No recent sells", "congress"),
    metricCard("Most Active Politicians", mostActivePoliticians(trades), "Based on saved disclosures", "congress"),
    metricCard("Largest Purchases", buys[0]?.reportedRange || "Pending", buys[0]?.ticker || "No purchase range", "congress"),
  ].join("");

  if (output.policyActivityCount) output.policyActivityCount.textContent = signals.length;
  output.policyActivityGrid.innerHTML = [
    metricCard("Major Policy Changes", String(signals.length), "Configured policy/news signals", "policy"),
    metricCard("Industries Affected", new Set(signals.map((signal) => signal.company || signal.ticker)).size || "Pending", "Matched tickers/companies", "policy"),
    metricCard("Positive Catalysts", String(positiveSignals.length), positiveSignals[0]?.ticker || "None active", "policy"),
    metricCard("Negative Catalysts", String(negativeSignals.length), negativeSignals[0]?.ticker || "None active", "policy"),
  ].join("");

  output.predictionPerformanceGrid.innerHTML = [
    metricCard("Overall Accuracy", "Tracking", "Available after outcomes are stored", "performance"),
    metricCard("1 Day", "Pending", "Outcome tracking planned", "performance"),
    metricCard("7 Day", "Pending", "Outcome tracking planned", "performance"),
    metricCard("1 Month", "Pending", "Outcome tracking planned", "performance"),
    metricCard("1 Year", "Pending", "Outcome tracking planned", "performance"),
  ].join("");
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
  const sort = output.predictionSort?.value || "unifiedScore";
  const list = [...rows];
  if (sort === "unifiedScore") return list.sort((a, b) => (Number(b.unifiedPredictionScore || b.aiOpportunityScore) || 0) - (Number(a.unifiedPredictionScore || a.aiOpportunityScore) || 0));
  if (sort === "technicalScore") return list.sort((a, b) => technicalScoreForPrediction(b) - technicalScoreForPrediction(a));
  if (sort === "confidence") return list.sort((a, b) => (Number(b.confidenceScore) || 0) - (Number(a.confidenceScore) || 0));
  if (sort === "company") return list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  if (sort === "ticker") return list.sort((a, b) => String(a.ticker || "").localeCompare(String(b.ticker || "")));
  if (sort === "timeframe") return list.sort((a, b) => String(a.bestTimeframe || a.timeframe || "").localeCompare(String(b.bestTimeframe || b.timeframe || "")));
  if (sort === "predictionDate") return list.sort((a, b) => new Date(b.scannedAt || predictionEngine.updatedAt || 0) - new Date(a.scannedAt || predictionEngine.updatedAt || 0));
  return list.sort((a, b) => (Number(a.rank) || 999) - (Number(b.rank) || 999));
}

function technicalScoreForPrediction(item) {
  const model = predictionModelForView(item);
  const technical = model?.technicalAnalysis || item.technicalAnalysis?.oneDay || {};
  return Number(technical.technicalSignalScore) || 0;
}

function recommendationCategory(item, model) {
  const label = String(model?.label || item.label || "").toLowerCase();
  const score = Number(item.unifiedPredictionScore || item.aiOpportunityScore || 0);
  if (label.includes("avoid") || score < 45) return "Avoid";
  if (label.includes("speculative")) return "Speculative";
  if (label.includes("watch") || score < 62) return "Watch";
  if (label.includes("strong") || score >= 78) return "Strong Buy";
  if (label.includes("buy") || label.includes("possible") || score >= 62) return "Buy";
  return "Watch";
}

function confidenceCategory(item) {
  const tier = String(item.confidenceTier || "").toLowerCase();
  if (tier.includes("very")) return "Very High";
  if (tier.includes("high")) return "High";
  if (tier.includes("medium")) return "Medium";
  return "Low";
}

function badgeClassForRecommendation(value) {
  const normalized = String(value || "").toLowerCase().replace(/\s+/g, "-");
  return `recommendation-${normalized || "watch"}`;
}

function badgeClassForConfidence(value) {
  const normalized = String(value || "").toLowerCase().replace(/\s+/g, "-");
  return `confidence-${normalized || "low"}`;
}

function dataQualityBadgeClass(value) {
  const normalized = String(value || "partial").toLowerCase();
  return `market-${normalized}`;
}

function policyToneForPrediction(item) {
  const matching = (policySignals.signals || []).filter((signal) => signal.ticker === item.ticker);
  if (matching.some((signal) => signal.direction === "positive")) return "positive";
  if (matching.some((signal) => signal.direction === "negative")) return "negative";
  return "neutral";
}

function filteredPredictionRows(rows) {
  const search = String(output.predictionSearch?.value || "").trim().toLowerCase();
  const timeframe = output.filterTimeframe?.value || "";
  const recommendation = output.filterRecommendation?.value || "";
  const confidence = output.filterConfidence?.value || "";
  const minScore = Number(output.filterScoreMin?.value) || 0;
  const sector = String(output.filterSector?.value || "").trim().toLowerCase();
  const industry = String(output.filterIndustry?.value || "").trim().toLowerCase();
  const pattern = String(output.filterPattern?.value || "").trim().toLowerCase();
  const congress = output.filterCongress?.value || "";
  const policy = output.filterPolicy?.value || "";
  const trend = output.filterTrend?.value || "";
  const dataQuality = output.filterDataQuality?.value || "";

  return rows.filter((item) => {
    const model = predictionModelForView(item);
    const technical = model?.technicalAnalysis || item.technicalAnalysis?.oneDay || {};
    const recommendationLabel = recommendationCategory(item, model);
    const confidenceLabel = confidenceCategory(item);
    const score = Number(item.unifiedPredictionScore || item.aiOpportunityScore || 0);
    const chartPattern = String(item.chartPatternSignal?.primaryPattern || "").toLowerCase();
    const hasCongress = Number(item.congressionalSignal?.count || item.congressionalSignal?.buys || item.congressionalSignal?.sells) > 0;
    const policyTone = policyToneForPrediction(item);
    const itemText = `${item.ticker || ""} ${item.name || ""}`.toLowerCase();
    const itemTimeframe = String(item.bestTimeframe || item.timeframe || model?.name || "").toLowerCase();
    const itemSector = String(item.assetGroup || item.sector || "").toLowerCase();
    const itemIndustry = String(item.industry || item.assetGroup || "").toLowerCase();
    const itemTrend = String(technical.trendDirection || item.unifiedDirection || "").toLowerCase();
    if (search && !itemText.includes(search)) return false;
    if (timeframe && !itemTimeframe.includes(timeframe.toLowerCase())) return false;
    if (recommendation && recommendationLabel !== recommendation) return false;
    if (confidence && confidenceLabel.toLowerCase() !== confidence) return false;
    if (score < minScore) return false;
    if (sector && !itemSector.includes(sector)) return false;
    if (industry && !itemIndustry.includes(industry)) return false;
    if (pattern && !chartPattern.includes(pattern)) return false;
    if (congress === "yes" && !hasCongress) return false;
    if (congress === "no" && hasCongress) return false;
    if (policy && policyTone !== policy) return false;
    if (trend && !itemTrend.includes(trend)) return false;
    if (dataQuality && String(item.dataQualityStatus || "").toLowerCase() !== dataQuality) return false;
    return true;
  });
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

function currentPriceForPrediction(item) {
  return Number(item.currentPrice || item.marketPrice || item.price || item.quote?.price || 0);
}

function oneLineAiSummary(item, model) {
  const summary =
    item.finalReasonSummary ||
    item.whatChanged ||
    item.plainEnglish ||
    item.predictionReason ||
    model?.reason ||
    model?.reasons?.[0] ||
    "Signal stack is being monitored for a cleaner opportunity.";
  return String(summary).replace(/\s+/g, " ").trim().slice(0, 132);
}

function normalizedTimeframeForPrediction(item, model) {
  return item.timeframe || item.bestTimeframe || model?.name || "Selected timeframe";
}

function renderCompactPredictionCard(item) {
  const model = predictionModelForView(item);
  const technical = model?.technicalAnalysis || item.technicalAnalysis?.oneDay || {};
  const chartPattern = item.chartPatternSignal || {};
  const recommendation = recommendationCategory(item, model);
  const confidence = confidenceCategory(item);
  const dataQuality = item.dataQualityStatus || item.dataQuality?.dataQualityStatus || "partial";
  const score = scoreValue(item.unifiedPredictionScore || item.aiOpportunityScore);
  const technicalScore = technicalScoreForPrediction(item);
  const pattern = chartPattern.primaryPattern || "None";
  const trend = technical.trendDirection || item.unifiedDirection || "neutral";
  const price = currentPriceForPrediction(item);
  const timeframe = normalizedTimeframeForPrediction(item, model);
  return `
    <article class="prediction-screener-card">
      <header class="prediction-card-header">
        <div>
          <strong>${escapeHtml(item.ticker || "N/A")}</strong>
          <span>${escapeHtml(item.name || item.ticker || "Unknown company")}</span>
        </div>
        <em>${moneyOrCalculating(price)}</em>
      </header>
      <div class="prediction-score-block">
        <span>Unified Score</span>
        <strong>${score}</strong>
        <small>/100</small>
      </div>
      <div class="prediction-badge-row">
        <span class="pti-badge ${badgeClassForRecommendation(recommendation)}">${escapeHtml(recommendation)}</span>
        <span class="pti-badge ${badgeClassForConfidence(confidence)}">${escapeHtml(confidence)}</span>
        <span class="pti-badge ${dataQualityBadgeClass(dataQuality)}">${escapeHtml(dataQuality)}</span>
      </div>
      <div class="prediction-metadata-grid">
        <div><span>Timeframe</span><strong>${escapeHtml(timeframe)}</strong></div>
        <div><span>Pattern</span><strong>${escapeHtml(pattern)}</strong></div>
        <div><span>Trend</span><strong>${escapeHtml(trend)}</strong></div>
        <div><span>Technical</span><strong>${scoreValue(technicalScore)}/100</strong></div>
      </div>
      <p class="prediction-ai-summary">${escapeHtml(oneLineAiSummary(item, model))}</p>
      <footer class="prediction-actions">
        <button type="button" class="pti-button" data-view-brief="${escapeHtml(item.ticker)}">View Trade Brief</button>
        <button type="button" class="pti-button ghost" data-add-watchlist="${escapeHtml(item.ticker)}">Add to Watchlist</button>
        <button type="button" class="pti-button ghost" data-quick-compare="${escapeHtml(item.ticker)}">Quick Compare</button>
      </footer>
    </article>
  `;
}

function renderCompactPredictionTable(rows) {
  return `
    <div class="prediction-table-wrap">
      <table class="pti-table prediction-screener-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Company</th>
            <th>Price</th>
            <th>Score</th>
            <th>Recommendation</th>
            <th>Confidence</th>
            <th>Timeframe</th>
            <th>Pattern</th>
            <th>Trend</th>
            <th>Technical</th>
            <th>Quality</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((item) => {
              const model = predictionModelForView(item);
              const technical = model?.technicalAnalysis || item.technicalAnalysis?.oneDay || {};
              const chartPattern = item.chartPatternSignal || {};
              const recommendation = recommendationCategory(item, model);
              const confidence = confidenceCategory(item);
              const dataQuality = item.dataQualityStatus || item.dataQuality?.dataQualityStatus || "partial";
              return `
                <tr>
                  <td><strong>${escapeHtml(item.ticker || "N/A")}</strong></td>
                  <td>${escapeHtml(item.name || item.ticker || "Unknown")}</td>
                  <td>${moneyOrCalculating(currentPriceForPrediction(item))}</td>
                  <td><strong>${scoreValue(item.unifiedPredictionScore || item.aiOpportunityScore)}</strong></td>
                  <td><span class="pti-badge ${badgeClassForRecommendation(recommendation)}">${escapeHtml(recommendation)}</span></td>
                  <td><span class="pti-badge ${badgeClassForConfidence(confidence)}">${escapeHtml(confidence)}</span></td>
                  <td>${escapeHtml(normalizedTimeframeForPrediction(item, model))}</td>
                  <td>${escapeHtml(chartPattern.primaryPattern || "None")}</td>
                  <td>${escapeHtml(technical.trendDirection || item.unifiedDirection || "neutral")}</td>
                  <td>${scoreValue(technicalScoreForPrediction(item))}/100</td>
                  <td><span class="pti-badge ${dataQualityBadgeClass(dataQuality)}">${escapeHtml(dataQuality)}</span></td>
                  <td>
                    <div class="table-action-row">
                      <button type="button" class="pti-button" data-view-brief="${escapeHtml(item.ticker)}">Brief</button>
                      <button type="button" class="pti-button ghost" data-add-watchlist="${escapeHtml(item.ticker)}">Watch</button>
                      <button type="button" class="pti-button ghost" data-quick-compare="${escapeHtml(item.ticker)}">Compare</button>
                    </div>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderScreenerPredictions() {
  if (!output.predictionGrid || !output.predictionSummary) return;
  const predictions = predictionEngine.predictions || [];
  const active = predictionEngine.sections?.[predictionView] || predictions.slice(0, 25);
  const health = predictionEngine.predictionEngineHealth || {};
  const top25Counts = health.top25Counts || {};
  const qualityCounts = health.dataQualityStatusCounts || {};
  const scanUniverse = predictionEngine.scanUniverse || {};
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
    ? Math.round(predictions.reduce((sum, item) => sum + Number(item.unifiedPredictionScore || item.aiOpportunityScore || 0), 0) / predictions.length)
    : 0;

  output.predictionSummary.innerHTML = `
    <div><span>Last scan</span><strong>${predictionEngine.updatedAt ? new Date(predictionEngine.updatedAt).toLocaleString() : "Not scanned yet"}</strong></div>
    <div><span>Tracked assets</span><strong>${predictions.length}</strong></div>
    <div><span>1-day avg</span><strong>${oneDayAvg}/100</strong></div>
    <div><span>3-day avg</span><strong>${threeDayAvg}/100</strong></div>
    <div><span>7-day avg</span><strong>${sevenDayAvg}/100</strong></div>
    <div><span>30-day avg</span><strong>${thirtyDayAvg}/100</strong></div>
    <div><span>Overall avg</span><strong>${avgScore}/100</strong></div>
    <div><span>Prediction engine</span><strong>${escapeHtml(health.predictionEngineStatus || health.status || "Not run")}</strong></div>
    <div><span>Data quality</span><strong>${escapeHtml(health.dataQualityStatus || "Not run")}</strong></div>
    <div><span>Scan universe</span><strong>${escapeHtml(scanUniverse.mode || "watchlist")} (${Number(scanUniverse.candidateCount) || predictions.length})</strong></div>
    <div><span>Top 25 counts</span><strong>${Number(top25Counts.top25OneDay) || 0}/${Number(top25Counts.top25SevenDay) || 0}/${Number(top25Counts.top25OneMonth) || 0}/${Number(top25Counts.top25OneYear) || 0}</strong></div>
    <div><span>Quality counts</span><strong>G ${Number(qualityCounts.good) || 0} / P ${Number(qualityCounts.partial) || 0} / S ${Number(qualityCounts.stale) || 0} / F ${Number(qualityCounts.failed) || 0}</strong></div>
  `;

  output.predictionGrid.classList.toggle("is-table-view", predictionLayout === "table");

  if (!active.length) {
    output.predictionGrid.innerHTML = `
      <article class="stock-card">
        <span>No predictions yet</span>
        <strong>Run a prediction scan</strong>
        <p>The backend will load the active universe, refresh signals, score each ticker, save prediction records, and refresh this dashboard.</p>
        <button type="button" class="inline-scan-button" data-run-prediction-scan>Run prediction scan</button>
      </article>
    `;
    return;
  }

  if (predictionView === "comparisonView") {
    renderComparisonRows(active);
    return;
  }

  const rows = sortedPredictionRows(filteredPredictionRows(active));
  if (!rows.length) {
    output.predictionGrid.innerHTML = `
      <article class="stock-card">
        <span>No matches</span>
        <strong>Adjust the screener filters</strong>
        <p>No prediction in this list matches the current filter combination.</p>
      </article>
    `;
    return;
  }

  output.predictionGrid.innerHTML =
    predictionLayout === "table"
      ? renderCompactPredictionTable(rows)
      : rows.map(renderCompactPredictionCard).join("");
}

renderPredictions = renderScreenerPredictions;

function renderPredictions() {
  if (!output.predictionGrid || !output.predictionSummary) return;
  const predictions = predictionEngine.predictions || [];
  const active = predictionEngine.sections?.[predictionView] || predictions.slice(0, 25);
  const health = predictionEngine.predictionEngineHealth || {};
  const top25Counts = health.top25Counts || {};
  const qualityCounts = health.dataQualityStatusCounts || {};
  const unifiedAverages = health.averageUnifiedPredictionScoreByTimeframe || {};
  const sanityChecks = health.rankingSanityChecks || {};
  const failedTickers = health.failedTickers || [];
  const scanUniverse = predictionEngine.scanUniverse || {};
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
    <div>
      <span>Prediction engine</span>
      <strong>${escapeHtml(health.predictionEngineStatus || health.status || "Not run")}</strong>
    </div>
    <div>
      <span>Data quality status</span>
      <strong>${escapeHtml(health.dataQualityStatus || "Not run")}</strong>
    </div>
    <div>
      <span>Scan universe</span>
      <strong>${escapeHtml(scanUniverse.mode || "watchlist")} (${Number(scanUniverse.candidateCount) || predictions.length})</strong>
    </div>
    <div>
      <span>Predictions generated</span>
      <strong>${Number(health.predictionsGenerated) || predictions.length}</strong>
    </div>
    <div>
      <span>Top 25 counts</span>
      <strong>${Number(top25Counts.top25OneDay) || 0}/${Number(top25Counts.top25SevenDay) || 0}/${Number(top25Counts.top25OneMonth) || 0}/${Number(top25Counts.top25OneYear) || 0}</strong>
    </div>
    <div>
      <span>Data quality</span>
      <strong>G ${Number(qualityCounts.good) || 0} / P ${Number(qualityCounts.partial) || 0} / S ${Number(qualityCounts.stale) || 0} / F ${Number(qualityCounts.failed) || 0}</strong>
    </div>
  `;

  const healthCard = health.status
    ? `
      <article class="prediction-card engine-health-card ${(health.predictionEngineStatus || health.status) === "Healthy" ? "health-good" : (health.predictionEngineStatus || health.status) === "Failed" ? "health-failed" : "health-warning"}">
        <div class="stock-card-top">
          <span>Authenticated validation checklist</span>
          <strong>${escapeHtml(health.predictionEngineStatus || health.status)}</strong>
        </div>
        <h3>Prediction engine health</h3>
        <div class="signal-list">
          <span>Prediction Engine Status: ${escapeHtml(health.predictionEngineStatus || health.status || "Unknown")}</span>
          <span>Data Quality Status: ${escapeHtml(health.dataQualityStatus || "Unknown")} (${Number(health.incompleteMarketDataPercent) || 0}% incomplete)</span>
          <span>Scan completed: ${health.scanCompletedAt ? new Date(health.scanCompletedAt).toLocaleString() : "Not run yet"}</span>
          <span>Tickers scanned: ${Number(health.tickersScanned) || 0}</span>
          <span>Predictions generated: ${Number(health.predictionsGenerated) || 0}</span>
          <span>Top 25 entries: 1d ${Number(top25Counts.top25OneDay) || 0}, 7d ${Number(top25Counts.top25SevenDay) || 0}, 1m ${Number(top25Counts.top25OneMonth) || 0}, 1y ${Number(top25Counts.top25OneYear) || 0}</span>
          <span>Avg unified scores: 1d ${Number(unifiedAverages.top25OneDay) || 0}, 7d ${Number(unifiedAverages.top25SevenDay) || 0}, 1m ${Number(unifiedAverages.top25OneMonth) || 0}, 1y ${Number(unifiedAverages.top25OneYear) || 0}</span>
          <span>Highest: ${escapeHtml(health.highestScoringTicker?.ticker || "n/a")} ${Number(health.highestScoringTicker?.score) || 0}/100</span>
          <span>Lowest: ${escapeHtml(health.lowestScoringTicker?.ticker || "n/a")} ${Number(health.lowestScoringTicker?.score) || 0}/100</span>
          <span>Engine failed tickers: ${failedTickers.length ? failedTickers.map((item) => `${escapeHtml(item.ticker)} (${escapeHtml(item.reason)})`).join(", ") : "None"}</span>
          <span>Incomplete market data: ${Number(health.incompleteMarketDataCount) || 0} ticker(s)</span>
        </div>
        <details class="why-pick">
          <summary>Ranking sanity checks</summary>
          <div class="signal-list">
            ${Object.entries(sanityChecks)
              .map(([name, passed]) => `<span>${escapeHtml(name)}: ${passed ? "pass" : "fail"}</span>`)
              .join("")}
          </div>
        </details>
      </article>
    `
    : "";

  if (!active.length) {
    output.predictionGrid.innerHTML = `
      ${healthCard}
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

  output.predictionGrid.innerHTML = healthCard + sortedPredictionRows(active)
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
      const setup = item.setupSignals || model?.setupSignals || {};
      const shortSqueeze = item.shortSqueezeSignal || {};
      const chartPattern = item.chartPatternSignal || {};
      const unifiedScore = Number(item.unifiedPredictionScore) || Number(item.aiOpportunityScore) || 0;
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
            <span>Unified Prediction Score</span>
            <strong>${unifiedScore}/100</strong>
          </div>
          <div class="prediction-meter" aria-label="Unified Prediction Score ${unifiedScore}">
            <div style="width: ${Math.min(100, unifiedScore)}%"></div>
          </div>
          <div class="signal-list">
            <span>Direction: ${escapeHtml(item.unifiedDirection || "neutral")}</span>
            <span>Confidence: ${escapeHtml(item.confidenceTier || "low")}</span>
            <span>Badge: ${escapeHtml(modelLabel)}</span>
            <span>Timeframe: ${escapeHtml(item.timeframe || item.bestTimeframe || predictionModelTitle(model))}</span>
            <span>Data quality: ${escapeHtml(item.dataQualityStatus || quality.dataQualityStatus || "partial")}</span>
          </div>
          <button type="button" class="brief-button" data-view-brief="${escapeHtml(item.ticker)}">View Trade Brief</button>
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
          <details class="why-pick">
            <summary>Why this pick?</summary>
            <div class="model-reasons">
              <strong>Final read</strong>
              <p>${escapeHtml(item.finalReasonSummary || "Unified prediction summary is being built from the available signal layers.")}</p>
              ${(item.strongestSignals || []).map((signal) => `<p>${escapeHtml(signal)}</p>`).join("")}
              ${(item.conflictingSignals || []).length ? `<strong>Conflicting signals</strong>${item.conflictingSignals.map((signal) => `<p>${escapeHtml(signal)}</p>`).join("")}` : ""}
              ${(item.dataQualityNotes || quality.dataQualityNotes || []).length ? `<strong>Data quality notes</strong>${(item.dataQualityNotes || quality.dataQualityNotes || []).map((note) => `<p>${escapeHtml(note)}</p>`).join("")}` : ""}
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
            <span>Setup: ${escapeHtml(setup.setupDirection || "none")} ${escapeHtml(setup.confirmationStatus || "none")} (${Number(setup.setupScore) || 0}/100)</span>
            <span>Short squeeze risk: ${escapeHtml(shortSqueeze.squeezeRisk || "low")} (${Number(shortSqueeze.squeezeScore) || 0}/100)</span>
            <span>Chart pattern: ${escapeHtml(chartPattern.primaryPattern || "none")} ${escapeHtml(chartPattern.patternDirection || "none")} (${Number(chartPattern.patternScore) || 0}/100)</span>
            <span>Price vs 9/20 EMA: ${compactValue(technical.priceVs9Ema, "%")} / ${compactValue(technical.priceVs20Ema, "%")}</span>
            <span>Support / resistance: ${technical.nearestSupport ? `$${Number(technical.nearestSupport).toFixed(2)}` : "n/a"} / ${technical.nearestResistance ? `$${Number(technical.nearestResistance).toFixed(2)}` : "n/a"}</span>
            <span>${escapeHtml(predictionModelTitle(model))} upside: ${pct(model?.expectedUpside)}</span>
            <span>${escapeHtml(predictionModelTitle(model))} downside: ${pct(model?.downsideRisk)}</span>
            <span>Risk/reward: ${Number(item.riskRewardRatio || 0).toFixed(2)}</span>
            </div>
          </details>
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

function findPredictionByTicker(ticker) {
  const normalized = String(ticker || "").toUpperCase();
  return (predictionEngine.predictions || []).find((item) => String(item.ticker || "").toUpperCase() === normalized) || null;
}

function calculating(value) {
  if (value === null || value === undefined || value === "" || value === "Needs market data") return "Calculating";
  return String(value);
}

function moneyOrCalculating(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? dollarsPrecise(number) : "Calculating";
}

function badgeTone(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("positive") || normalized.includes("bull") || normalized.includes("buy") || normalized.includes("good")) return "positive";
  if (normalized.includes("negative") || normalized.includes("bear") || normalized.includes("sell") || normalized.includes("risk") || normalized.includes("failed")) return "negative";
  return "neutral";
}

function briefSignalItems(item, technical, setup, chartPattern) {
  const signals = [];
  const add = (label, active = true) => {
    if (active && label && !signals.includes(label)) signals.push(label);
  };
  add("Multi-Timeframe Alignment", ["bullish", "bearish"].includes(item.multiTimeframeAlignment?.alignmentDirection));
  add(chartPattern.primaryPattern, chartPattern.primaryPattern && chartPattern.primaryPattern !== "none");
  add("Above VWAP", Number(technical.priceVsVwap) > 0);
  add("Strong Relative Volume", Number(item.shortSqueezeSignal?.relativeVolume) >= 1.5);
  add("Congress Buying", Number(item.congressionalSignal?.buys) > 0);
  add("Positive Policy Signals", (policySignals.signals || []).some((signal) => signal.ticker === item.ticker && signal.direction === "positive"));
  add("High Technical Score", Number(technical.technicalSignalScore) >= 70);
  add(setup.setupDirection && setup.setupDirection !== "none" ? `${setup.setupDirection} setup` : "", setup.setupDirection && setup.setupDirection !== "none");
  (item.strongestSignals || []).slice(0, 3).forEach((signal) => add(signal));
  return signals.slice(0, 7);
}

function briefRiskItems(item, technical) {
  const risks = [];
  const add = (label, active = true) => {
    if (active && label && !risks.includes(label)) risks.push(label);
  };
  add("Near Resistance", Number(technical.nearestResistance) > 0 && Number(item.currentPrice) > 0 && Number(technical.nearestResistance) - Number(item.currentPrice) < Number(item.currentPrice) * 0.015);
  add("Weak Volume", Number(item.shortSqueezeSignal?.relativeVolume) > 0 && Number(item.shortSqueezeSignal?.relativeVolume) < 0.8);
  add("Mixed Signals", item.unifiedDirection === "mixed" || (item.conflictingSignals || []).length > 1);
  add("Policy Risk", (policySignals.signals || []).some((signal) => signal.ticker === item.ticker && signal.direction === "negative"));
  add("Data Quality", ["partial", "stale", "failed"].includes(item.dataQualityStatus));
  (item.conflictingSignals || []).slice(0, 3).forEach((signal) => add(signal));
  add(item.failureRisk || item.whyMayBeWrong || "Prediction can fail if market conditions change quickly.", !risks.length);
  return risks.slice(0, 6);
}

function tradeBriefSummary(item, signals, risks) {
  const score = Number(item.unifiedPredictionScore || item.aiOpportunityScore || 0);
  const direction = item.unifiedDirection || "neutral";
  const confidence = item.confidenceTier || "low";
  const action =
    direction === "bullish" && score >= 70
      ? "This is a stronger buy candidate, assuming position size and risk controls fit your plan."
      : direction === "bullish"
      ? "This is a watchable buy candidate, but it still needs confirmation before sizing aggressively."
      : direction === "mixed"
      ? "This is not a clean buy yet because the signal stack is mixed."
      : "This does not currently read as a strong buy candidate.";
  return [
    action,
    `${item.ticker} carries a unified score of ${score}/100 with ${confidence} confidence and a ${direction} read.`,
    signals.length ? `The biggest opportunities are ${signals.slice(0, 3).join(", ")}.` : "The opportunity case is still developing.",
    risks.length ? `The biggest risks are ${risks.slice(0, 3).join(", ")}.` : "No major risk factor is dominating the brief yet.",
    "Use the trade plan and invalidation level before acting."
  ].join(" ");
}

function renderTradeBrief() {
  if (!output.tradeBriefPanel) return;
  const firstPick = firstFromSection("top25OneDay") || firstFromSection("top25SevenDay") || (predictionEngine.predictions || [])[0];
  const item = findPredictionByTicker(selectedBriefTicker) || firstPick;
  if (!item) {
    output.tradeBriefPanel.innerHTML = `
      <article class="dashboard-card">
        <span>No trade brief selected</span>
        <h3>Run a prediction scan, then open a Trade Brief from any prediction card.</h3>
        <button type="button" data-run-prediction-scan>Run prediction scan</button>
      </article>
    `;
    return;
  }

  selectedBriefTicker = item.ticker;
  const model = predictionModelForView(item);
  const technical = model?.technicalAnalysis || item.technicalAnalysis?.oneDay || {};
  const setup = item.setupSignals || model?.setupSignals || {};
  const chartPattern = item.chartPatternSignal || {};
  const qualityNotes = item.dataQualityNotes || item.dataQuality?.dataQualityNotes || [];
  const score = Number(item.unifiedPredictionScore || item.aiOpportunityScore || 0);
  const signals = briefSignalItems(item, technical, setup, chartPattern);
  const risks = briefRiskItems(item, technical);
  const summary = tradeBriefSummary(item, signals, risks);
  const matchingPolicy = (policySignals.signals || []).filter((signal) => signal.ticker === item.ticker);
  const congress = item.congressionalSignal || {};
  const newsSentiment = matchingPolicy.some((signal) => signal.direction === "positive")
    ? "Positive"
    : matchingPolicy.some((signal) => signal.direction === "negative")
    ? "Negative"
    : "Neutral";
  const targetOne = model?.profitTarget || item.suggestedProfitTarget;
  const targetTwo = Number(item.currentPrice) && Number(item.forecasts?.thirtyDay?.expectedUpside)
    ? dollarsPrecise(Number(item.currentPrice) * (1 + Number(item.forecasts.thirtyDay.expectedUpside) / 100))
    : "";
  const relatedAlerts = alertHistory.filter((alert) => normalizeTicker(alert.ticker) === normalizeTicker(item.ticker)).slice(0, 5);

  output.tradeBriefPanel.innerHTML = `
    <article class="trade-brief-report">
      <header class="trade-brief-card brief-report-hero">
        <div>
          <span class="eyebrow">AI Trade Brief&trade;</span>
          <h2>${escapeHtml(item.ticker)} | ${escapeHtml(item.name || item.company || item.ticker)}</h2>
          <div class="brief-badge-row">
            <span class="brief-badge ${badgeTone(item.label)}">${escapeHtml(item.label || item.recommendation || "Research candidate")}</span>
            <span class="brief-badge ${badgeTone(item.unifiedDirection)}">${escapeHtml(item.unifiedDirection || "neutral")}</span>
            <span class="brief-badge neutral">${escapeHtml(item.bestTimeframe || item.timeframe || predictionModelTitle(model))}</span>
          </div>
        </div>
        <div class="brief-score">
          <span>Unified score</span>
          <strong>${score}/100</strong>
          <small>${escapeHtml(item.confidenceTier || "low")} confidence</small>
        </div>
      </header>

      <div class="brief-top-metrics">
        <div><span>Current Price</span><strong>${moneyOrCalculating(item.currentPrice)}</strong></div>
        <div><span>Prediction Timeframe</span><strong>${escapeHtml(item.bestTimeframe || item.timeframe || predictionModelTitle(model))}</strong></div>
        <div><span>Market Trend</span><strong>${escapeHtml(technical.trendDirection || item.marketRegime?.primary || "Calculating")}</strong></div>
        <div><span>Company</span><strong>${escapeHtml(item.name || item.company || item.ticker)}</strong></div>
      </div>

      <div class="brief-report-grid">
        <section class="brief-section brief-wide">
          <div class="brief-section-heading">
            <span>Executive Summary</span>
            <strong>Decision read</strong>
          </div>
          <p>${escapeHtml(summary)}</p>
        </section>

        <section class="brief-section">
          <div class="brief-section-heading">
            <span>Trade Plan</span>
            <strong>Levels</strong>
          </div>
          <div class="brief-plan-grid">
            <div><span>Suggested Entry Zone</span><strong>${escapeHtml(calculating(model?.entryZone || item.suggestedEntryZone))}</strong></div>
            <div><span>Stop Loss</span><strong>${escapeHtml(calculating(model?.stopLevel || item.suggestedStopLevel))}</strong></div>
            <div><span>Target 1</span><strong>${escapeHtml(calculating(targetOne))}</strong></div>
            <div><span>Target 2</span><strong>${escapeHtml(calculating(targetTwo))}</strong></div>
            <div><span>Risk / Reward Ratio</span><strong>${Number(item.riskRewardRatio) ? Number(item.riskRewardRatio).toFixed(2) : "Calculating"}</strong></div>
          </div>
        </section>

        <section class="brief-section">
          <div class="brief-section-heading">
            <span>Why This Pick</span>
            <strong>Strongest signals</strong>
          </div>
          <div class="brief-chip-list positive-list">
            ${signals.length ? signals.map((signal) => `<span>✓ ${escapeHtml(signal)}</span>`).join("") : "<span>Calculating signal stack</span>"}
          </div>
        </section>

        <section class="brief-section">
          <div class="brief-section-heading">
            <span>Risk Factors</span>
            <strong>Watch these</strong>
          </div>
          <div class="brief-chip-list risk-list">
            ${risks.map((risk) => `<span>! ${escapeHtml(risk)}</span>`).join("")}
          </div>
        </section>

        <section class="brief-section">
          <div class="brief-section-heading">
            <span>Technical Snapshot</span>
            <strong>${Number(technical.technicalSignalScore) || 0}/100</strong>
          </div>
          <div class="brief-fact-list">
            <div><span>Trend</span><strong>${escapeHtml(technical.trendDirection || "Calculating")}</strong></div>
            <div><span>EMA Alignment</span><strong>${Number(technical.ema9Vs20Ema) > 0 ? "9 EMA above 20 EMA" : Number(technical.ema9Vs20Ema) < 0 ? "9 EMA below 20 EMA" : "Calculating"}</strong></div>
            <div><span>VWAP Position</span><strong>${Number(technical.priceVsVwap) > 0 ? "Above VWAP" : Number(technical.priceVsVwap) < 0 ? "Below VWAP" : "Calculating"}</strong></div>
            <div><span>Chart Pattern</span><strong>${escapeHtml(chartPattern.primaryPattern || "Calculating")}</strong></div>
            <div><span>Support</span><strong>${moneyOrCalculating(technical.nearestSupport)}</strong></div>
            <div><span>Resistance</span><strong>${moneyOrCalculating(technical.nearestResistance)}</strong></div>
            <div><span>Setup Type</span><strong>${escapeHtml(setup.setupDirection && setup.setupDirection !== "none" ? setup.setupDirection : "Calculating")}</strong></div>
          </div>
        </section>

        <section class="brief-section">
          <div class="brief-section-heading">
            <span>Congress / Policy / News</span>
            <strong>Signal tone</strong>
          </div>
          <div class="brief-badge-panel">
            <div><span>Recent Congressional Activity</span><strong class="brief-badge ${Number(congress.buys) > Number(congress.sells || 0) ? "positive" : Number(congress.sells) ? "negative" : "neutral"}">${Number(congress.buys) || Number(congress.sells) ? `${Number(congress.buys) || 0} buys / ${Number(congress.sells) || 0} sells` : "Neutral"}</strong></div>
            <div><span>Policy Catalysts</span><strong class="brief-badge ${badgeTone(matchingPolicy[0]?.direction)}">${matchingPolicy.length ? matchingPolicy[0].direction : "Neutral"}</strong></div>
            <div><span>News Sentiment</span><strong class="brief-badge ${badgeTone(newsSentiment)}">${escapeHtml(newsSentiment)}</strong></div>
          </div>
        </section>

        <section class="brief-section">
          <div class="brief-section-heading">
            <span>Prediction Confidence</span>
            <strong>${score}/100</strong>
          </div>
          <div class="brief-fact-list">
            <div><span>Confidence Tier</span><strong>${escapeHtml(item.confidenceTier || "low")}</strong></div>
            <div><span>Data Quality</span><strong>${escapeHtml(item.dataQualityStatus || item.dataQuality?.dataQualityStatus || "partial")}</strong></div>
            <div><span>Strongest Signals</span><strong>${signals.slice(0, 2).map(escapeHtml).join(", ") || "Calculating"}</strong></div>
            <div><span>Conflicting Signals</span><strong>${(item.conflictingSignals || []).slice(0, 2).map(escapeHtml).join(", ") || "None flagged"}</strong></div>
          </div>
          <details class="why-pick">
            <summary>Data quality notes</summary>
            <div class="signal-list">
              ${qualityNotes.length ? qualityNotes.map((note) => `<span>${escapeHtml(note)}</span>`).join("") : "<span>No data quality warnings for this record.</span>"}
            </div>
          </details>
        </section>

        <section class="brief-section brief-wide">
          <div class="brief-section-heading">
            <span>Related Alerts</span>
            <strong>${relatedAlerts.length}</strong>
          </div>
          <div class="alert-brief-list">
            ${
              relatedAlerts.length
                ? relatedAlerts
                    .map((alert) => `<article><span class="pti-badge ${alert.priority === "Critical" ? "danger" : alert.priority === "High" ? "warning" : "neutral"}">${escapeHtml(alert.priority)}</span><strong>${escapeHtml(alert.type)}</strong><small>${alert.timestamp ? new Date(alert.timestamp).toLocaleString() : "Now"} | ${escapeHtml(alert.resolved ? "Resolved" : alert.read ? "Read" : "Unread")}</small><p>${escapeHtml(alert.explanation)}</p></article>`)
                    .join("")
                : `<article><strong>No related alerts yet</strong><p>Create an alert to track score, trend, congress, policy, or price changes for ${escapeHtml(item.ticker)}.</p></article>`
            }
          </div>
        </section>

        <section class="brief-section brief-wide">
          <div class="brief-section-heading">
            <span>Historical Performance</span>
            <strong>Coming online</strong>
          </div>
          <p>Historical tracking will become available as prediction history grows.</p>
        </section>
      </div>

      <footer class="brief-actions">
        <button type="button" data-page-target="predictions">Return to Predictions</button>
        <button type="button" data-add-watchlist="${escapeHtml(item.ticker)}">Add to Watchlist</button>
        <button type="button" data-create-alert-for="${escapeHtml(item.ticker)}">Create Alert</button>
        <button type="button" disabled>Share Report <small>Coming Soon</small></button>
      </footer>
    </article>
  `;
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

function predictionPerformanceRecords() {
  const historical =
    predictionEngine.performanceHistory ||
    predictionEngine.predictionHistory ||
    predictionEngine.history ||
    predictionEngine.outcomes ||
    [];
  const source = Array.isArray(historical) && historical.length ? historical : predictionEngine.predictions || [];
  return source.map((item, index) => {
    const model = predictionModelForView(item);
    const technical = model?.technicalAnalysis || item.technicalAnalysis?.oneDay || {};
    const chartPattern = item.chartPatternSignal || {};
    const setup = item.setupSignals || {};
    const actualReturn = Number(item.actualReturn ?? item.returnPercent ?? item.gainLossPercent);
    const predictedDirection = item.predictedDirection || item.unifiedDirection || "mixed";
    const recommendation = recommendationCategory(item, model);
    const score = scoreValue(item.unifiedPredictionScore || item.aiOpportunityScore || item.score);
    const timeframe = normalizedTimeframeForPrediction(item, model);
    const resultKnown = Number.isFinite(actualReturn) || ["won", "lost", "hit", "miss"].includes(String(item.result || "").toLowerCase());
    const isWin = resultKnown
      ? String(item.result || "").toLowerCase() === "won" ||
        String(item.result || "").toLowerCase() === "hit" ||
        (predictedDirection === "bearish" ? actualReturn <= 0 : actualReturn >= 0)
      : null;
    return {
      id: `${item.ticker || "prediction"}-${item.scannedAt || item.predictionDate || index}`,
      ticker: item.ticker || "N/A",
      name: item.name || item.companyName || item.ticker || "Unknown",
      predictionDate: item.predictionDate || item.scannedAt || predictionEngine.updatedAt || null,
      score,
      recommendation,
      confidence: confidenceCategory(item),
      timeframe,
      entryPrice: Number(item.entryPrice || item.currentPrice || item.marketPrice || 0),
      actualReturn: Number.isFinite(actualReturn) ? actualReturn : null,
      actualResult: resultKnown ? (isWin ? "Win" : "Loss") : "Tracking",
      isWin,
      reason: item.finalReasonSummary || item.predictionReason || item.plainEnglish || model?.reasons?.[0] || "Performance tracking in progress.",
      signals: [
        ...(Array.isArray(item.strongestSignals) ? item.strongestSignals : []),
        chartPattern.primaryPattern || "",
        setup.setupDirection && setup.setupDirection !== "none" ? `${setup.setupDirection} setup` : "",
        technical.trendDirection ? `${technical.trendDirection} trend` : "",
        item.multiTimeframeAlignment?.alignmentDirection ? `${item.multiTimeframeAlignment.alignmentDirection} alignment` : "",
      ].filter(Boolean),
      pattern: chartPattern.primaryPattern || "No pattern",
      setupType: setup.setupDirection && setup.setupDirection !== "none" ? setup.setupDirection : "No setup",
    };
  });
}

function knownPerformanceRecords() {
  return predictionPerformanceRecords().filter((record) => record.isWin !== null);
}

function accuracyFor(records, matcher = () => true) {
  const filtered = records.filter(matcher);
  if (!filtered.length) return null;
  const wins = filtered.filter((record) => record.isWin).length;
  return Math.round((wins / filtered.length) * 100);
}

function averageReturnFor(records, matcher = () => true) {
  const returns = records.filter(matcher).map((record) => record.actualReturn).filter((value) => Number.isFinite(value));
  if (!returns.length) return null;
  return returns.reduce((sum, value) => sum + value, 0) / returns.length;
}

function performanceMetricValue(value, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "Tracking";
  return `${typeof value === "number" ? value.toFixed(suffix === "%" ? 0 : 1) : value}${suffix}`;
}

function performanceMetricCard(title, value, subtitle, tone = "neutral") {
  return `
    <article class="performance-metric-card ${tone}">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(subtitle)}</small>
    </article>
  `;
}

function performanceChartCard(title, value, subtitle, tone = "neutral") {
  const numeric = Math.max(0, Math.min(100, Number(value) || 0));
  return `
    <article class="performance-chart-card ${tone}">
      <div class="card-heading">
        <span>${escapeHtml(title)}</span>
        <strong>${value === null || value === undefined ? "Tracking" : `${Math.round(numeric)}%`}</strong>
      </div>
      <div class="performance-bar" aria-label="${escapeHtml(title)}">
        <div style="width: ${numeric}%"></div>
      </div>
      <small>${escapeHtml(subtitle)}</small>
    </article>
  `;
}

function signalPerformance(records, extractor) {
  const groups = new Map();
  records.forEach((record) => {
    extractor(record).forEach((signal) => {
      if (!groups.has(signal)) groups.set(signal, { name: signal, total: 0, wins: 0, returns: [] });
      const group = groups.get(signal);
      group.total += 1;
      if (record.isWin) group.wins += 1;
      if (Number.isFinite(record.actualReturn)) group.returns.push(record.actualReturn);
    });
  });
  return [...groups.values()]
    .map((group) => ({
      ...group,
      winRate: group.total ? Math.round((group.wins / group.total) * 100) : 0,
      averageReturn: group.returns.length ? group.returns.reduce((sum, value) => sum + value, 0) / group.returns.length : 0,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.total - a.total);
}

function renderSignalRank(title, rows, emptyText) {
  return `
    <article class="signal-rank-card">
      <h3>${escapeHtml(title)}</h3>
      <div class="signal-rank-list">
        ${
          rows.length
            ? rows
                .slice(0, 5)
                .map(
                  (row) => `
                    <div>
                      <span>${escapeHtml(row.name)}</span>
                      <strong>${row.winRate}%</strong>
                      <small>${row.total} prediction${row.total === 1 ? "" : "s"} | ${performanceMetricValue(row.averageReturn, "%")} avg return</small>
                    </div>
                  `
                )
                .join("")
            : `<p class="muted-copy">${escapeHtml(emptyText)}</p>`
        }
      </div>
    </article>
  `;
}

function renderPredictionAudit(records) {
  if (!output.predictionAuditList) return;
  const search = String(output.performanceSearch?.value || "").trim().toLowerCase();
  const filtered = records
    .filter((record) => {
      const text = `${record.ticker} ${record.name} ${record.reason} ${record.recommendation} ${record.timeframe}`.toLowerCase();
      return !search || text.includes(search);
    })
    .slice(0, 60);
  output.predictionAuditList.innerHTML = filtered.length
    ? filtered
        .map(
          (record) => `
            <article class="prediction-audit-card">
              <div>
                <strong>${escapeHtml(record.ticker)}</strong>
                <span>${escapeHtml(record.name)}</span>
              </div>
              <div><span>Date</span><strong>${record.predictionDate ? new Date(record.predictionDate).toLocaleDateString() : "Tracking"}</strong></div>
              <div><span>Score</span><strong>${record.score}/100</strong></div>
              <div><span>Recommendation</span><strong>${escapeHtml(record.recommendation)}</strong></div>
              <div><span>Entry</span><strong>${moneyOrCalculating(record.entryPrice)}</strong></div>
              <div><span>Result</span><strong>${escapeHtml(record.actualResult)}</strong></div>
              <div><span>Gain/Loss</span><strong>${record.actualReturn === null ? "Tracking" : percent(record.actualReturn)}</strong></div>
              <p>${escapeHtml(record.reason)}</p>
            </article>
          `
        )
        .join("")
    : `
      <article class="prediction-audit-card empty">
        <strong>No audit records match that search.</strong>
        <p>Clear the search or run more scans as prediction history grows.</p>
      </article>
    `;
}

const marketSectors = [
  "Technology",
  "Healthcare",
  "Financials",
  "Energy",
  "Industrials",
  "Consumer",
  "Utilities",
  "Real Estate",
  "Materials",
  "Communication",
  "Consumer Staples",
  "Consumer Discretionary",
];

function marketMetricCard(title, value, subtitle, tone = "neutral") {
  return `
    <article class="market-metric-card ${tone}">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(subtitle)}</small>
    </article>
  `;
}

function sectorForPrediction(item) {
  const raw = String(item.sector || item.assetGroup || item.industry || "").toLowerCase();
  if (raw.includes("tech") || raw.includes("software") || raw.includes("semiconductor")) return "Technology";
  if (raw.includes("health") || raw.includes("biotech") || raw.includes("pharma")) return "Healthcare";
  if (raw.includes("financial") || raw.includes("bank") || raw.includes("insurance")) return "Financials";
  if (raw.includes("energy") || raw.includes("oil") || raw.includes("gas")) return "Energy";
  if (raw.includes("industrial") || raw.includes("aerospace") || raw.includes("defense")) return "Industrials";
  if (raw.includes("utility")) return "Utilities";
  if (raw.includes("real estate") || raw.includes("reit")) return "Real Estate";
  if (raw.includes("material") || raw.includes("mining") || raw.includes("chemical")) return "Materials";
  if (raw.includes("communication") || raw.includes("media") || raw.includes("telecom")) return "Communication";
  if (raw.includes("staple")) return "Consumer Staples";
  if (raw.includes("discretionary") || raw.includes("retail") || raw.includes("auto")) return "Consumer Discretionary";
  if (raw.includes("consumer")) return "Consumer";
  return item.ticker ? "Technology" : "Consumer";
}

function sectorStats() {
  const predictions = predictionEngine.predictions || [];
  return marketSectors.map((sector) => {
    const matches = predictions.filter((item) => sectorForPrediction(item) === sector);
    const avgScore = matches.length ? Math.round(matches.reduce((sum, item) => sum + scoreValue(item.unifiedPredictionScore || item.aiOpportunityScore), 0) / matches.length) : 0;
    const bullish = matches.filter((item) => String(item.unifiedDirection || "").toLowerCase() === "bullish").length;
    const bearish = matches.filter((item) => String(item.unifiedDirection || "").toLowerCase() === "bearish").length;
    const direction = bullish > bearish ? "Bullish" : bearish > bullish ? "Bearish" : matches.length ? "Mixed" : "Neutral";
    const relativeStrength = avgScore >= 75 ? "Strong" : avgScore >= 62 ? "Improving" : avgScore >= 45 ? "Neutral" : "Weak";
    const outlook =
      direction === "Bullish"
        ? "AI signals favor upside leadership."
        : direction === "Bearish"
        ? "AI signals show elevated downside pressure."
        : matches.length
        ? "Signals are mixed; wait for cleaner confirmation."
        : "Awaiting enough scan data.";
    return { sector, matches, avgScore, direction, relativeStrength, outlook };
  });
}

function sectorToneClass(stat) {
  if (stat.direction === "Bullish" && stat.avgScore >= 70) return "heat-strong";
  if (stat.direction === "Bullish") return "heat-positive";
  if (stat.direction === "Bearish") return "heat-negative";
  if (stat.direction === "Mixed") return "heat-mixed";
  return "heat-neutral";
}

function largestTradeSummary(trades, type) {
  const filtered = (trades || []).filter((trade) => trade.transaction === type);
  if (!filtered.length) return "No recent data";
  return filtered[0].company || filtered[0].ticker || filtered[0].representative || "Tracked";
}

function renderSectorPicks(stats) {
  if (!output.sectorPicksPanel) return;
  const sector = selectedMarketSector === "All sectors" ? stats[0]?.sector : selectedMarketSector;
  const stat = stats.find((item) => item.sector === sector) || stats[0];
  const picks = [...(stat?.matches || [])]
    .sort((a, b) => scoreValue(b.unifiedPredictionScore || b.aiOpportunityScore) - scoreValue(a.unifiedPredictionScore || a.aiOpportunityScore))
    .slice(0, 5);
  if (output.selectedSectorLabel) output.selectedSectorLabel.textContent = stat ? stat.sector : "All sectors";
  output.sectorPicksPanel.innerHTML = `
    <div class="sector-picks-header">
      <strong>${escapeHtml(stat?.sector || "All sectors")}</strong>
      <span>${picks.length ? "Strongest predicted stocks in this sector" : "Run a prediction scan for sector picks"}</span>
    </div>
    <div class="sector-pick-list">
      ${
        picks.length
          ? picks
              .map(
                (item) => `
                  <button type="button" data-view-brief="${escapeHtml(item.ticker)}">
                    <strong>${escapeHtml(item.ticker)}</strong>
                    <span>${escapeHtml(item.name || item.ticker)} | ${scoreValue(item.unifiedPredictionScore || item.aiOpportunityScore)}/100</span>
                  </button>
                `
              )
              .join("")
          : `<p class="muted-copy">No sector-specific prediction candidates are available yet.</p>`
      }
    </div>
  `;
}

function renderMarketIntelligence() {
  if (!output.marketSummaryGrid) return;
  const health = predictionEngine.predictionEngineHealth || {};
  const predictions = predictionEngine.predictions || [];
  const stats = sectorStats();
  const strongestSector = [...stats].sort((a, b) => b.avgScore - a.avgScore)[0];
  const weakestSector = [...stats].sort((a, b) => a.avgScore - b.avgScore)[0];
  const bullishCount = predictions.filter((item) => String(item.unifiedDirection || "").toLowerCase() === "bullish").length;
  const bearishCount = predictions.filter((item) => String(item.unifiedDirection || "").toLowerCase() === "bearish").length;
  const breadthScore = predictions.length ? Math.round((bullishCount / predictions.length) * 100) : 0;
  const signals = policySignals.signals || [];
  const positiveSignals = signals.filter((signal) => signal.direction === "positive");
  const negativeSignals = signals.filter((signal) => signal.direction === "negative");
  const trades = settings.congressTrades || [];
  const buys = trades.filter((trade) => trade.transaction === "Buy");
  const sells = trades.filter((trade) => trade.transaction === "Sell");
  const marketMood = predictionEngine.marketRegime?.primary || strongestSector?.direction || "Scanning";
  if (output.marketIntelligenceStatus) output.marketIntelligenceStatus.textContent = marketMood;

  output.marketSummaryGrid.innerHTML = [
    marketMetricCard("Overall Market Sentiment", marketMood, strongestSector ? `${strongestSector.sector} leads sector strength` : "Run scan for a market read", statusTone(marketMood)),
    marketMetricCard("S&P 500", "Tracking", "Live index provider placeholder"),
    marketMetricCard("Nasdaq", "Tracking", "Live index provider placeholder"),
    marketMetricCard("Dow", "Tracking", "Live index provider placeholder"),
    marketMetricCard("Russell 2000", "Tracking", "Small-cap read placeholder"),
    marketMetricCard("VIX", "Tracking", "Volatility read placeholder"),
    marketMetricCard("Prediction Engine Status", health.predictionEngineStatus || health.status || "Not run", `${Number(health.predictionsGenerated) || predictions.length} predictions generated`, statusTone(health.predictionEngineStatus || health.status)),
    marketMetricCard("Market Data Quality", health.dataQualityStatus || "Not run", `${Number(health.incompleteMarketDataPercent) || 0}% incomplete`, statusTone(health.dataQualityStatus)),
  ].join("");

  output.marketBreadthGrid.innerHTML = [
    marketMetricCard("Advancers", String(bullishCount), "Bullish prediction direction"),
    marketMetricCard("Decliners", String(bearishCount), "Bearish prediction direction", "warning"),
    marketMetricCard("New Highs", "Tracking", "Market data provider placeholder"),
    marketMetricCard("New Lows", "Tracking", "Market data provider placeholder"),
    marketMetricCard("Volume Breadth", `${Math.max(0, Math.min(100, breadthScore))}/100`, "Proxy from bullish participation"),
    marketMetricCard("Market Breadth Score", `${breadthScore}/100`, predictions.length ? "Derived from active scan directions" : "Run scan for breadth"),
  ].join("");

  output.sectorRotationGrid.innerHTML = stats
    .map(
      (stat) => `
        <article class="sector-rotation-card ${sectorToneClass(stat)}">
          <strong>${escapeHtml(stat.sector)}</strong>
          <div><span>Direction</span><b>${escapeHtml(stat.direction)}</b></div>
          <div><span>Relative Strength</span><b>${escapeHtml(stat.relativeStrength)} (${stat.avgScore}/100)</b></div>
          <p>${escapeHtml(stat.outlook)}</p>
        </article>
      `
    )
    .join("");

  output.sectorHeatmapGrid.innerHTML = stats
    .map(
      (stat) => `
        <button type="button" class="sector-heat-card ${sectorToneClass(stat)} ${selectedMarketSector === stat.sector ? "is-active" : ""}" data-market-sector="${escapeHtml(stat.sector)}">
          <strong>${escapeHtml(stat.sector)}</strong>
          <span>${stat.avgScore}/100</span>
          <small>${escapeHtml(stat.direction)}</small>
        </button>
      `
    )
    .join("");
  renderSectorPicks(stats);

  output.marketCongressGrid.innerHTML = [
    marketMetricCard("Largest Purchases", largestTradeSummary(trades, "Buy"), `${buys.length} tracked buys`),
    marketMetricCard("Largest Sales", largestTradeSummary(trades, "Sell"), `${sells.length} tracked sells`),
    marketMetricCard("Most Active Members", mostActivePoliticians(trades), "Based on imported disclosures"),
    marketMetricCard("Sector Concentration", strongestSector?.sector || "Tracking", "Matched against prediction sectors"),
  ].join("");

  output.marketPolicyGrid.innerHTML = [
    marketMetricCard("Positive Catalysts", String(positiveSignals.length), "Policy/news signals marked positive", "success"),
    marketMetricCard("Negative Catalysts", String(negativeSignals.length), "Policy/news signals marked negative", "warning"),
    marketMetricCard("Upcoming Policy Events", "Tracking", "Calendar integration placeholder"),
    marketMetricCard("Industries Impacted", String(new Set(signals.map((signal) => signal.industry || signal.sector || signal.ticker).filter(Boolean)).size), "Unique impacted groups"),
  ].join("");

  output.economicCalendarGrid.innerHTML = [
    marketMetricCard("Fed Meetings", "Tracking", "Upcoming rate decision placeholder"),
    marketMetricCard("Inflation", "Tracking", "CPI/PCE release placeholder"),
    marketMetricCard("Jobs", "Tracking", "Payrolls and unemployment placeholder"),
    marketMetricCard("GDP", "Tracking", "Growth report placeholder"),
    marketMetricCard("Major Earnings Weeks", "Tracking", "Earnings calendar placeholder"),
  ].join("");

  output.aiMarketSummary.innerHTML = `
    <p><strong>What is driving today's market?</strong> The app currently sees ${escapeHtml(marketMood)} conditions with ${bullishCount} bullish and ${bearishCount} bearish prediction reads across the active universe.</p>
    <p><strong>Strongest sectors:</strong> ${escapeHtml(strongestSector?.sector || "Tracking")} shows the best relative score at ${Number(strongestSector?.avgScore) || 0}/100. Its current read is ${escapeHtml(strongestSector?.direction || "neutral")}.</p>
    <p><strong>Weakest sectors:</strong> ${escapeHtml(weakestSector?.sector || "Tracking")} has the weakest sector score at ${Number(weakestSector?.avgScore) || 0}/100, so it deserves extra caution before chasing individual names.</p>
    <p><strong>What to watch today:</strong> Watch breadth, market data quality, policy catalysts, congressional concentration, and whether top predictions stay aligned across the 1-day, 7-day, 1-month, and 1-year lists.</p>
  `;
}

function renderPerformanceCenter() {
  if (!output.performanceOverviewGrid) return;
  const allRecords = predictionPerformanceRecords();
  const known = knownPerformanceRecords();
  const pendingCount = allRecords.length - known.length;
  const wins = known.filter((record) => record.isWin).length;
  const losses = known.length - wins;
  const overallAccuracy = accuracyFor(known);
  const oneDayAccuracy = accuracyFor(known, (record) => /1.?day/i.test(record.timeframe));
  const sevenDayAccuracy = accuracyFor(known, (record) => /7.?day|week/i.test(record.timeframe));
  const monthAccuracy = accuracyFor(known, (record) => /month|30/i.test(record.timeframe));
  const yearAccuracy = accuracyFor(known, (record) => /year/i.test(record.timeframe));
  const averageReturn = averageReturnFor(known);
  const averageWinningReturn = averageReturnFor(known, (record) => record.isWin);
  const averageLosingReturn = averageReturnFor(known, (record) => !record.isWin);
  const winLossRatio = losses ? (wins / losses).toFixed(2) : wins ? "All wins" : "Tracking";
  const signalRows = signalPerformance(known, (record) => record.signals);
  const patternRows = signalPerformance(known, (record) => [record.pattern]);
  const setupRows = signalPerformance(known, (record) => [record.setupType]);
  const recommendationRows = signalPerformance(known, (record) => [record.recommendation]);
  const confidenceRows = signalPerformance(known, (record) => [record.confidence]);

  output.performanceOverviewGrid.innerHTML = [
    performanceMetricCard("Overall Prediction Accuracy", performanceMetricValue(overallAccuracy, "%"), `${known.length} completed | ${pendingCount} tracking`, "success"),
    performanceMetricCard("1-Day Accuracy", performanceMetricValue(oneDayAccuracy, "%"), "Expired 1-day predictions"),
    performanceMetricCard("7-Day Accuracy", performanceMetricValue(sevenDayAccuracy, "%"), "Expired 7-day predictions"),
    performanceMetricCard("1-Month Accuracy", performanceMetricValue(monthAccuracy, "%"), "Expired monthly predictions"),
    performanceMetricCard("1-Year Accuracy", performanceMetricValue(yearAccuracy, "%"), "Long-term tracking"),
    performanceMetricCard("Average Return", averageReturn === null ? "Tracking" : percent(averageReturn), "All completed predictions"),
    performanceMetricCard("Average Winning Return", averageWinningReturn === null ? "Tracking" : percent(averageWinningReturn), "Winning predictions"),
    performanceMetricCard("Average Losing Return", averageLosingReturn === null ? "Tracking" : percent(averageLosingReturn), "Losing predictions", "warning"),
    performanceMetricCard("Win/Loss Ratio", winLossRatio, `${wins} wins / ${losses} losses`),
  ].join("");

  output.performanceChartsGrid.innerHTML = [
    performanceChartCard("Prediction Accuracy over Time", overallAccuracy, "Uses completed prediction outcomes.", "success"),
    performanceChartCard("Confidence vs Accuracy", accuracyFor(known, (record) => ["High", "Very High"].includes(record.confidence)), "High-confidence picks only."),
    performanceChartCard("Average Return by Timeframe", averageReturn === null ? null : Math.max(0, Math.min(100, 50 + averageReturn * 5)), "Positive return lifts the bar."),
    performanceChartCard("Signal Combination Performance", signalRows[0]?.winRate ?? null, signalRows[0] ? `Best current signal: ${signalRows[0].name}` : "Awaiting completed outcomes."),
    performanceChartCard("Recommendation Performance", recommendationRows[0]?.winRate ?? null, recommendationRows[0] ? `Best label: ${recommendationRows[0].name}` : "Awaiting completed outcomes."),
  ].join("");

  output.signalAnalysisGrid.innerHTML = [
    renderSignalRank("Best Performing Signals", signalRows, "Signal rankings appear after predictions expire."),
    renderSignalRank("Worst Performing Signals", [...signalRows].reverse(), "Weak signal rankings appear after losses are recorded."),
    renderSignalRank("Most Reliable Patterns", patternRows, "Chart pattern reliability is tracking."),
    renderSignalRank("Least Reliable Patterns", [...patternRows].reverse(), "Pattern weakness appears after more outcomes."),
    renderSignalRank("Highest Win Rate Chart Patterns", patternRows, "Chart pattern win rates need completed predictions."),
    renderSignalRank("Highest Win Rate Setup Types", setupRows, "Setup type win rates need completed predictions."),
  ].join("");

  renderPredictionAudit(allRecords);

  const bestSignal = signalRows[0]?.name || "completed high-quality signal stacks";
  const weakestSignal = signalRows.length ? signalRows[signalRows.length - 1].name : "still being measured";
  const confidenceTrend = confidenceRows[0] ? `${confidenceRows[0].name} confidence is leading at ${confidenceRows[0].winRate}% accuracy.` : "Confidence calibration will populate as predictions expire.";
  output.aiLearningSummary.innerHTML = `
    <p><strong>The AI currently performs best when</strong> ${escapeHtml(bestSignal)} appears with clean confirmation.</p>
    <p><strong>The weakest signal combinations are</strong> ${escapeHtml(weakestSignal)}.</p>
    <p><strong>Confidence has improved by</strong> tracking each score against actual outcomes over time. ${escapeHtml(confidenceTrend)}</p>
    <p><strong>Average prediction quality trend</strong> is ${known.length ? "based on completed outcomes and will become more precise with every scan." : "waiting for predictions to expire before grading accuracy."}</p>
  `;

  output.performanceVersionGrid.innerHTML = [
    performanceMetricCard("Model Version", predictionEngine.modelVersion || "Tracking", "Future model version registry"),
    performanceMetricCard("Training Dataset Version", predictionEngine.trainingDatasetVersion || "Pending", "Placeholder for historical dataset tracking"),
    performanceMetricCard("Prediction Engine Version", predictionEngine.predictionEngineVersion || predictionEngine.modelVersion || "Current production", "Future engine release tracking"),
  ].join("");
}

async function runPredictionScan() {
  if (!output.runPredictionScan && !output.predictionGrid) return;
  if (runPredictionScan.active) return;
  runPredictionScan.active = true;
  const startedAt = performance.now();
  const buttons = [output.runPredictionScan, ...document.querySelectorAll("[data-run-prediction-scan]")].filter(Boolean);
  buttons.forEach((button) => {
    button.disabled = true;
    button.textContent = "Preparing scan...";
  });
  const stages = [
    ["Preparing scan...", 8],
    ["Screening broad universe...", 20],
    ["Selecting deep-analysis candidates...", 34],
    ["Refreshing market and news data...", 48],
    ["Analyzing candidates...", 64],
    ["Building timeframe rankings...", 78],
    ["Validating prediction results...", 90],
    ["Saving predictions...", 96],
  ];
  let stageIndex = 0;
  setScanUi("Preparing scan...", 8, "Preparing scan...");
  const stageTimer = setInterval(() => {
    stageIndex = Math.min(stageIndex + 1, stages.length - 1);
    const [stage, percent] = stages[stageIndex];
    buttons.forEach((button) => {
      button.textContent = stage;
    });
    setScanUi(stage, percent, stage);
  }, 850);

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
    localStorage.setItem("publicTradeIntelLastSuccessfulScan", JSON.stringify(result.scanHealth || { scanCompletedAt: result.updatedAt }));
    const warningText = Array.isArray(result.warnings) && result.warnings.length ? ` Warnings: ${result.warnings.join(" ")}` : "";
    const duration = ((performance.now() - startedAt) / 1000).toFixed(1);
    setScanUi("Scan complete", 100, `Prediction scan complete. ${result.predictions?.length || 0} records generated in ${duration}s.${warningText}`);
    renderPredictions();
    renderMarketIntelligence();
    renderPerformanceCenter();
    renderAlertsCenter();
    renderDashboard();
  } catch (error) {
    setScanUi("Scan failed - Retry", 100, predictionErrorMessage(error));
  } finally {
    clearInterval(stageTimer);
    buttons.forEach((button) => {
      button.disabled = false;
      button.textContent = "Run prediction scan";
    });
    runPredictionScan.active = false;
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

function setPage(pageName) {
  const target = pageName || "dashboard";
  const label = pageLabels[target] || "Dashboard";
  document.querySelectorAll("[data-page]").forEach((section) => {
    section.classList.toggle("is-active", section.dataset.page === target);
  });
  document.querySelectorAll("[data-page-target]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.pageTarget === target);
  });
  if (output.pageBreadcrumb) output.pageBreadcrumb.textContent = label;
  if (output.pageTitle) output.pageTitle.textContent = label;
  if (target === "briefs") renderTradeBrief();
  if (target === "market") renderMarketIntelligence();
  if (target === "performance") renderPerformanceCenter();
  if (target === "alerts") renderAlertsCenter();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function runGlobalSearch() {
  const query = String(output.globalSearch?.value || "").trim();
  if (!query) return;
  setPage("predictions");
  if (output.predictionSearch) {
    output.predictionSearch.value = query;
    renderPredictions();
  }
  if (output.predictionScanMessage) output.predictionScanMessage.textContent = `Showing prediction matches for "${query}". Clear the search box to reset.`;
}

function openTradeBrief(ticker) {
  selectedBriefTicker = String(ticker || "").toUpperCase();
  renderTradeBrief();
  setPage("briefs");
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
output.watchlistCreateForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = output.watchlistNameInput.value.trim();
  if (!name) return;
  const id = `${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "watchlist"}`;
  watchlists.push({ id, name, tickers: [] });
  selectedWatchlistId = id;
  output.watchlistNameInput.value = "";
  saveWatchlists();
  renderWatchlists();
  renderDashboard();
});
output.watchlistAddTickerForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const ticker = normalizeTicker(output.watchlistTickerInput.value);
  const list = watchlists.find((item) => item.id === selectedWatchlistId);
  if (!ticker || !list) return;
  if (!list.tickers.includes(ticker)) list.tickers.push(ticker);
  output.watchlistTickerInput.value = "";
  saveWatchlists();
  renderWatchlists();
  renderDashboard();
});
output.watchlistAlertForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const ticker = normalizeTicker(output.alertTickerInput.value);
  if (!ticker) {
    if (output.alertsDashboardStatus) output.alertsDashboardStatus.textContent = "Enter a ticker";
    return;
  }
  watchlistAlerts.unshift(createAlertRule({
    ticker,
    type: output.alertTypeInput.value,
    priority: "High",
    threshold: output.alertThresholdInput.value.trim(),
    source: "watchlist",
  }));
  output.alertTickerInput.value = "";
  output.alertThresholdInput.value = "";
  saveWatchlists();
  renderWatchlists();
  renderAlertsCenter();
  renderDashboard();
});
output.alertRuleForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const ticker = normalizeTicker(output.alertRuleTicker.value);
  if (!ticker) {
    if (output.alertsDashboardStatus) output.alertsDashboardStatus.textContent = "Enter a ticker or sector before creating a rule.";
    output.alertRuleTicker?.focus();
    return;
  }
  watchlistAlerts.unshift(createAlertRule({
    ticker,
    type: output.alertRuleType.value,
    priority: output.alertRulePriority.value,
    threshold: output.alertRuleThreshold.value,
    source: "alerts",
  }));
  output.alertRuleTicker.value = "";
  output.alertRuleThreshold.value = "";
  saveWatchlists();
  renderAlertsCenter();
  renderWatchlists();
  renderDashboard();
});
[
  output.alertFilterStatus,
  output.alertFilterPriority,
  output.alertFilterTicker,
  output.alertFilterWatchlist,
  output.alertFilterSector,
  output.alertFilterDate,
  output.alertFilterType,
].filter(Boolean).forEach((control) => {
  control.addEventListener("input", renderAlertsCenter);
  control.addEventListener("change", renderAlertsCenter);
});
output.alertHistorySearch?.addEventListener("input", renderAlertHistory);
output.exportAlertsButton?.addEventListener("click", () => {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), alerts: alertHistory }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "publictradeintel-alert-history.json";
  link.click();
  URL.revokeObjectURL(link.href);
});
output.alertRuleList?.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-alert-rule-delete]");
  if (!deleteButton) return;
  watchlistAlerts = watchlistAlerts.filter((rule) => rule.id !== deleteButton.dataset.alertRuleDelete);
  saveWatchlists();
  renderAlertsCenter();
  renderWatchlists();
  renderDashboard();
});
output.alertsList?.addEventListener("click", (event) => {
  const readButton = event.target.closest("[data-alert-read]");
  const dismissButton = event.target.closest("[data-alert-dismiss]");
  const snoozeButton = event.target.closest("[data-alert-snooze]");
  const id = readButton?.dataset.alertRead || dismissButton?.dataset.alertDismiss || snoozeButton?.dataset.alertSnooze;
  const alert = alertHistory.find((item) => item.id === id);
  if (!alert) return;
  if (readButton) alert.read = !alert.read;
  if (dismissButton) {
    alert.read = true;
    alert.resolved = true;
  }
  if (snoozeButton) {
    alert.read = true;
    alert.muted = true;
    alert.snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }
  saveWatchlists();
  renderAlertsCenter();
  renderDashboard();
});
output.watchlistFilter?.addEventListener("change", renderWatchlists);
output.watchlistSort?.addEventListener("change", renderWatchlists);
output.watchlistCardsGrid?.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-watchlist-view]");
  if (viewButton) {
    selectedWatchlistId = viewButton.dataset.watchlistView;
    renderWatchlists();
  }
  const deleteButton = event.target.closest("[data-watchlist-delete]");
  if (deleteButton) {
    watchlists = watchlists.filter((list) => list.id !== deleteButton.dataset.watchlistDelete);
    selectedWatchlistId = watchlists[0]?.id || "core-holdings";
    saveWatchlists();
    renderWatchlists();
    renderDashboard();
  }
});
output.watchlistCardsGrid?.addEventListener("change", (event) => {
  const renameInput = event.target.closest("[data-watchlist-rename]");
  if (!renameInput) return;
  const list = watchlists.find((item) => item.id === renameInput.dataset.watchlistRename);
  if (list && renameInput.value.trim()) {
    list.name = renameInput.value.trim();
    saveWatchlists();
    renderWatchlists();
    renderDashboard();
  }
});
output.watchlistDetailGrid?.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-watchlist-remove]");
  if (removeButton) {
    const list = watchlists.find((item) => item.id === selectedWatchlistId);
    if (list) list.tickers = list.tickers.filter((ticker) => ticker !== removeButton.dataset.watchlistRemove);
    saveWatchlists();
    renderWatchlists();
    renderDashboard();
  }
  const alertButton = event.target.closest("[data-watchlist-alert-ticker]");
  if (alertButton && output.alertTickerInput) {
    output.alertTickerInput.value = alertButton.dataset.watchlistAlertTicker;
    output.alertTickerInput.focus();
  }
  const focusButton = event.target.closest("[data-focus-watchlist-add]");
  if (focusButton) output.watchlistTickerInput?.focus();
});
output.watchlistDetailGrid?.addEventListener("change", (event) => {
  const moveSelect = event.target.closest("[data-watchlist-move]");
  if (!moveSelect || !moveSelect.value) return;
  const ticker = moveSelect.dataset.watchlistMove;
  const source = watchlists.find((item) => item.id === selectedWatchlistId);
  const target = watchlists.find((item) => item.id === moveSelect.value);
  if (source && target && ticker) {
    source.tickers = source.tickers.filter((item) => item !== ticker);
    if (!target.tickers.includes(ticker)) target.tickers.push(ticker);
    selectedWatchlistId = target.id;
    saveWatchlists();
    renderWatchlists();
    renderDashboard();
  }
});
output.watchlistAlertsList?.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-alert-delete]");
  if (!deleteButton) return;
  watchlistAlerts = watchlistAlerts.filter((alert) => alert.id !== deleteButton.dataset.alertDelete);
  saveWatchlists();
  renderWatchlists();
  renderDashboard();
});
document.querySelectorAll("[data-prediction-view]").forEach((button) => {
  button.addEventListener("click", () => {
    predictionView = button.dataset.predictionView;
    document.querySelectorAll("[data-prediction-view]").forEach((tab) => tab.classList.toggle("is-active", tab === button));
    renderPredictions();
  });
});
output.predictionSort?.addEventListener("change", renderPredictions);
output.globalSearch?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") runGlobalSearch();
});
output.performanceSearch?.addEventListener("input", () => renderPredictionAudit(predictionPerformanceRecords()));
[
  output.predictionSearch,
  output.filterTimeframe,
  output.filterRecommendation,
  output.filterConfidence,
  output.filterScoreMin,
  output.filterSector,
  output.filterIndustry,
  output.filterPattern,
  output.filterCongress,
  output.filterPolicy,
  output.filterTrend,
  output.filterDataQuality,
]
  .filter(Boolean)
  .forEach((control) => {
    control.addEventListener("input", renderPredictions);
    control.addEventListener("change", renderPredictions);
  });
document.querySelectorAll("[data-prediction-layout]").forEach((button) => {
  button.addEventListener("click", () => {
    predictionLayout = button.dataset.predictionLayout || "cards";
    document.querySelectorAll("[data-prediction-layout]").forEach((toggle) => toggle.classList.toggle("is-active", toggle === button));
    renderPredictions();
  });
});
output.runPredictionScan?.addEventListener("click", runPredictionScan);
output.predictionGrid?.addEventListener("click", (event) => {
  if (event.target.closest("[data-run-prediction-scan]")) runPredictionScan();
  const briefButton = event.target.closest("[data-view-brief]");
  if (briefButton) openTradeBrief(briefButton.dataset.viewBrief);
  const watchButton = event.target.closest("[data-add-watchlist]");
  if (watchButton) {
    const ticker = normalizeTicker(watchButton.dataset.addWatchlist);
    addTickerToActiveWatchlist(ticker);
    if (output.predictionScanMessage) output.predictionScanMessage.textContent = ticker ? `${ticker} added to the watchlist view on this device.` : "Watchlist action ready.";
  }
  const compareButton = event.target.closest("[data-quick-compare]");
  if (compareButton) {
    const ticker = String(compareButton.dataset.quickCompare || "").toUpperCase();
    const rows = predictionEngine.sections?.comparisonView || [];
    const match = rows.find((item) => String(item.ticker || "").toUpperCase() === ticker);
    if (output.predictionScanMessage) {
      output.predictionScanMessage.textContent = match
        ? `${ticker} appears across ${match.lists.length} ranked list(s). Open the Comparison tab for the full view.`
        : `${ticker} currently appears on this selected list only.`;
    }
  }
});
output.profileMenuButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleTopbarMenu("profile");
});
output.profileDropdown?.addEventListener("click", (event) => {
  event.stopPropagation();
});
output.alertsMenuButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  renderTopbarAlerts();
  toggleTopbarMenu("alerts");
});
output.alertsDropdown?.addEventListener("click", (event) => {
  const navButton = event.target.closest("[data-page-target]");
  if (navButton) {
    setPage(navButton.dataset.pageTarget);
    closeTopbarMenus();
  }
  event.stopPropagation();
});
document.addEventListener("click", (event) => {
  const navButton = event.target.closest("[data-page-target]");
  if (navButton) {
    setPage(navButton.dataset.pageTarget);
    closeTopbarMenus();
  }
  const scanButton = event.target.closest("[data-run-prediction-scan]");
  if (scanButton && !output.predictionGrid?.contains(scanButton)) runPredictionScan();
  const briefButton = event.target.closest("[data-view-brief]");
  if (briefButton && !output.predictionGrid?.contains(briefButton)) openTradeBrief(briefButton.dataset.viewBrief);
  const sectorButton = event.target.closest("[data-market-sector]");
  if (sectorButton) {
    selectedMarketSector = sectorButton.dataset.marketSector || "All sectors";
    renderMarketIntelligence();
  }
  const createAlertButton = event.target.closest("[data-create-alert-for]");
  if (createAlertButton) {
    const ticker = normalizeTicker(createAlertButton.dataset.createAlertFor);
    const rule = addAlertRuleForTicker(ticker, "tradeBrief");
    setPage("alerts");
    if (output.alertsDashboardStatus) output.alertsDashboardStatus.textContent = rule ? `${ticker} alert created.` : "We could not create that alert. Please retry.";
  }
  const watchButton = event.target.closest("[data-add-watchlist]");
  if (watchButton && !output.predictionGrid?.contains(watchButton)) {
    const ticker = normalizeTicker(watchButton.dataset.addWatchlist);
    const added = addTickerToActiveWatchlist(ticker);
    setPage("watchlist");
    if (output.watchlistActiveName) output.watchlistActiveName.textContent = added ? `${ticker} added to watchlist` : "Could not add ticker";
  }
  if (!event.target.closest(".topbar-menu-wrap")) closeTopbarMenus();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeTopbarMenus();
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
output.profileSignOutButton?.addEventListener("click", async () => {
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
