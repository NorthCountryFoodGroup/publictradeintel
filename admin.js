const state = {
  pin: "",
  config: null,
};

const loginForm = document.querySelector("#adminLogin");
const loginMessage = document.querySelector("#loginMessage");
const saveMessage = document.querySelector("#saveMessage");
const marketMessage = document.querySelector("#marketMessage");
const policyMessage = document.querySelector("#policyMessage");
const importMessage = document.querySelector("#importMessage");
const congressFeedMessage = document.querySelector("#congressFeedMessage");
const predictionHealthMessage = document.querySelector("#predictionHealthMessage");
const scanSettingsMessage = document.querySelector("#scanSettingsMessage");
const adminPanel = document.querySelector("#adminPanel");
const plansEditor = document.querySelector("#plansEditor");
const goalsEditor = document.querySelector("#goalsEditor");
const stocksEditor = document.querySelector("#stocksEditor");
const congressEditor = document.querySelector("#congressEditor");
const predictionHealthPanel = document.querySelector("#predictionHealthPanel");

const thresholdFields = {
  firstEmergencyTarget: document.querySelector("#firstEmergencyTarget"),
  fullEmergencyTarget: document.querySelector("#fullEmergencyTarget"),
  debtInvestCap: document.querySelector("#debtInvestCap"),
};
const scanUniverse = document.querySelector("#scanUniverse");
const customTickers = document.querySelector("#customTickers");
const activeScanUniverse = document.querySelector("#activeScanUniverse");
const scanCandidateCount = document.querySelector("#scanCandidateCount");
const adminBreadcrumb = document.querySelector("#adminBreadcrumb");
const adminPageTitle = document.querySelector("#adminPageTitle");
const adminProfileMenuButton = document.querySelector("#adminProfileMenuButton");
const adminProfileDropdown = document.querySelector("#adminProfileDropdown");
const adminAlertsMenuButton = document.querySelector("#adminAlertsMenuButton");
const adminAlertsDropdown = document.querySelector("#adminAlertsDropdown");

const universeLabels = {
  watchlist: "Watchlist only",
  sp500: "S&P 500",
  nasdaq100: "Nasdaq-100",
  etfs: "ETFs",
  combined: "Combined universe",
};

const adminSectionLabels = {
  overview: "Admin Dashboard",
  engine: "Prediction Engine",
  market: "Market Data",
  universe: "Prediction Scan Settings",
  users: "Users",
  congress: "Congress Feed",
  policy: "Policy Feed",
  health: "System Health",
};

const adminHashTargets = {
  "admin-dashboard": "overview",
  "prediction-engine": "engine",
  "prediction-scan-settings": "universe",
  "scan-universe": "universe",
  "market-data": "market",
  users: "users",
  "congress-feed": "congress",
  "policy-feed": "policy",
  "system-health": "health",
  health: "health",
};

const universeBaseCounts = {
  watchlist: 0,
  sp500: 60,
  nasdaq100: 48,
  etfs: 28,
  combined: 90,
};

document.addEventListener("click", (event) => {
  const navButton = event.target.closest("[data-admin-target]");
  if (navButton) setAdminSection(navButton.dataset.adminTarget);
  if (!event.target.closest(".topbar-menu-wrap")) closeAdminTopbarMenus();
});

function closeAdminTopbarMenus() {
  if (adminProfileDropdown) adminProfileDropdown.hidden = true;
  if (adminAlertsDropdown) adminAlertsDropdown.hidden = true;
  adminProfileMenuButton?.setAttribute("aria-expanded", "false");
  adminAlertsMenuButton?.setAttribute("aria-expanded", "false");
}

function toggleAdminTopbarMenu(menuName) {
  const isProfile = menuName === "profile";
  const dropdown = isProfile ? adminProfileDropdown : adminAlertsDropdown;
  const button = isProfile ? adminProfileMenuButton : adminAlertsMenuButton;
  if (!dropdown || !button) return;
  const willOpen = dropdown.hidden;
  closeAdminTopbarMenus();
  dropdown.hidden = !willOpen;
  button.setAttribute("aria-expanded", String(willOpen));
}

function adminSectionFromHash() {
  const key = String(location.hash || "").replace("#", "").trim().toLowerCase();
  return adminHashTargets[key] || "overview";
}

function adminHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Admin-Pin": state.pin,
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function fetchAdmin(path) {
  const response = await fetch(path, { headers: adminHeaders() });
  if (!response.ok) throw new Error("Admin PIN was not accepted.");
  return response.json();
}

function renderSummary(summary) {
  document.querySelector("#adminSummaryTitle").textContent = `${summary.total} weekly checks recorded`;
  document.querySelector("#totalChecks").textContent = summary.total;
  document.querySelector("#investChecks").textContent = summary.invest;
  document.querySelector("#saveChecks").textContent = summary.save;
  document.querySelector("#protectChecks").textContent = summary.protect;
}

function parseCustomTickerCount(value) {
  return new Set(
    String(value || "")
      .toUpperCase()
      .split(/[\s,]+/)
      .map((ticker) => ticker.replace(/[^A-Z.-]/g, ""))
      .filter(Boolean),
  ).size;
}

function renderScanSettingsStatus() {
  if (!scanUniverse || !activeScanUniverse || !scanCandidateCount) return;
  const mode = scanUniverse.value || "combined";
  const customCount = parseCustomTickerCount(customTickers?.value || "");
  const watchlistCount = state.config?.stockIdeas?.length || 0;
  const baseCount = mode === "watchlist" ? watchlistCount : universeBaseCounts[mode] || 0;
  const total = Math.min(90, baseCount + customCount);
  activeScanUniverse.value = universeLabels[mode] || "Combined universe";
  scanCandidateCount.value = `${total} candidate${total === 1 ? "" : "s"}${customCount ? `, including ${customCount} custom` : ""}`;
}

function renderPredictionHealth(health) {
  if (!predictionHealthPanel) return;
  if (!health) {
    predictionHealthPanel.innerHTML = `<article class="editor-row"><p class="muted-copy">Run a prediction scan to generate health checks.</p></article>`;
    return;
  }
  const top25 = health.top25Counts || {};
  const quality = health.dataQualityStatusCounts || {};
  const averages = health.averageUnifiedPredictionScoreByTimeframe || {};
  const checks = health.rankingSanityChecks || {};
  predictionHealthPanel.innerHTML = `
    <article class="editor-row stock-editor-row">
      <label>
        <span>Prediction Engine Status</span>
        <input readonly value="${escapeHtml(health.predictionEngineStatus || health.status || "Unknown")}" />
      </label>
      <label>
        <span>Data Quality Status</span>
        <input readonly value="${escapeHtml(health.dataQualityStatus || "Unknown")} (${Number(health.incompleteMarketDataPercent) || 0}% incomplete)" />
      </label>
      <label>
        <span>Scan completed</span>
        <input readonly value="${escapeHtml(health.scanCompletedAt ? new Date(health.scanCompletedAt).toLocaleString() : "Not run")}" />
      </label>
      <label>
        <span>Tickers / predictions</span>
        <input readonly value="${Number(health.tickersScanned) || 0} / ${Number(health.predictionsGenerated) || 0}" />
      </label>
      <label class="wide-field">
        <span>Top 25 counts</span>
        <input readonly value="1d ${Number(top25.top25OneDay) || 0}, 7d ${Number(top25.top25SevenDay) || 0}, 1m ${Number(top25.top25OneMonth) || 0}, 1y ${Number(top25.top25OneYear) || 0}" />
      </label>
      <label class="wide-field">
        <span>Data quality counts</span>
        <input readonly value="good ${Number(quality.good) || 0}, partial ${Number(quality.partial) || 0}, stale ${Number(quality.stale) || 0}, failed ${Number(quality.failed) || 0}" />
      </label>
      <label class="wide-field">
        <span>Average unified score</span>
        <input readonly value="1d ${Number(averages.top25OneDay) || 0}, 7d ${Number(averages.top25SevenDay) || 0}, 1m ${Number(averages.top25OneMonth) || 0}, 1y ${Number(averages.top25OneYear) || 0}" />
      </label>
      <label class="wide-field">
        <span>High / low ticker</span>
        <input readonly value="${escapeHtml(health.highestScoringTicker?.ticker || "n/a")} ${Number(health.highestScoringTicker?.score) || 0}/100 / ${escapeHtml(health.lowestScoringTicker?.ticker || "n/a")} ${Number(health.lowestScoringTicker?.score) || 0}/100" />
      </label>
      <label class="wide-field">
        <span>Engine failed tickers</span>
        <input readonly value="${escapeHtml((health.failedTickers || []).map((item) => `${item.ticker}: ${item.reason}`).join("; ") || "None")}" />
      </label>
      <label class="wide-field">
        <span>Incomplete market data</span>
        <input readonly value="${escapeHtml((health.incompleteMarketDataTickers || []).slice(0, 20).map((item) => `${item.ticker}: ${item.status}`).join("; ") || "None")}" />
      </label>
      <label class="wide-field">
        <span>Ranking sanity checks</span>
        <input readonly value="${escapeHtml(Object.entries(checks).map(([name, passed]) => `${name}: ${passed ? "pass" : "fail"}`).join("; "))}" />
      </label>
    </article>
  `;
}

function setAdminSection(sectionName) {
  const target = sectionName || "overview";
  const label = adminSectionLabels[target] || "Admin Dashboard";
  document.querySelectorAll("[data-admin-section]").forEach((section) => {
    section.classList.toggle("is-active", section.dataset.adminSection === target);
  });
  document.querySelectorAll("[data-admin-target]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminTarget === target);
  });
  if (adminBreadcrumb) adminBreadcrumb.textContent = label;
  if (adminPageTitle) adminPageTitle.textContent = label;
  closeAdminTopbarMenus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function planRow(plan, index) {
  return `
    <article class="editor-row">
      <label>
        <span>Plan name</span>
        <input data-plan="${index}" data-field="name" value="${escapeHtml(plan.name)}" />
      </label>
      <label>
        <span>Weekly amount</span>
        <input type="number" min="0" step="1" data-plan="${index}" data-field="weekly" value="${plan.weekly}" />
      </label>
      <label class="wide-field">
        <span>Plain-language guidance</span>
        <input data-plan="${index}" data-field="tone" value="${escapeHtml(plan.tone)}" />
      </label>
    </article>
  `;
}

function goalRow(goal, index) {
  return `
    <article class="editor-row">
      <label>
        <span>Goal name</span>
        <input data-goal="${index}" data-field="name" value="${escapeHtml(goal.name)}" />
      </label>
      <label>
        <span>Target</span>
        <input type="number" min="1" step="1" data-goal="${index}" data-field="target" value="${goal.target}" />
      </label>
      <label>
        <span>Progress source</span>
        <select data-goal="${index}" data-field="source">
          ${["emergency", "invested", "dividend", "netWorth"]
            .map((source) => `<option value="${source}" ${source === goal.source ? "selected" : ""}>${source}</option>`)
            .join("")}
        </select>
      </label>
    </article>
  `;
}

function stockRow(stock, index) {
  const marketLine = stock.marketPrice
    ? `<p class="muted-copy">Last market refresh: $${Number(stock.marketPrice).toFixed(2)} (${escapeHtml(stock.marketChangePercent || "n/a")}) via ${escapeHtml(stock.marketProvider || "provider")}</p>`
    : "";

  return `
    <article class="editor-row stock-editor-row">
      <label>
        <span>Ticker</span>
        <input data-stock="${index}" data-field="ticker" value="${escapeHtml(stock.ticker)}" />
      </label>
      <label>
        <span>Name</span>
        <input data-stock="${index}" data-field="name" value="${escapeHtml(stock.name)}" />
      </label>
      <label>
        <span>Type</span>
        <select data-stock="${index}" data-field="type">
          ${["ETF", "Stock"]
            .map((type) => `<option value="${type}" ${type === stock.type ? "selected" : ""}>${type}</option>`)
            .join("")}
        </select>
      </label>
      <label>
        <span>Risk</span>
        <select data-stock="${index}" data-field="risk">
          ${["cautious", "balanced", "growth"]
            .map((risk) => `<option value="${risk}" ${risk === stock.risk ? "selected" : ""}>${risk}</option>`)
            .join("")}
        </select>
      </label>
      <label>
        <span>Minimum weekly</span>
        <input type="number" min="0" max="1000" step="1" data-stock="${index}" data-field="minimumWeekly" value="${stock.minimumWeekly}" />
      </label>
      <label>
        <span>Valuation score</span>
        <input type="number" min="0" max="100" step="1" data-stock="${index}" data-field="valuationScore" value="${stock.valuationScore}" />
      </label>
      <label>
        <span>Momentum score</span>
        <input type="number" min="0" max="100" step="1" data-stock="${index}" data-field="momentumScore" value="${stock.momentumScore}" />
      </label>
      <label>
        <span>Quality score</span>
        <input type="number" min="0" max="100" step="1" data-stock="${index}" data-field="qualityScore" value="${stock.qualityScore}" />
      </label>
      <label>
        <span>Low-volatility score</span>
        <input type="number" min="0" max="100" step="1" data-stock="${index}" data-field="volatilityScore" value="${stock.volatilityScore}" />
      </label>
      <label>
        <span>Press/catalyst score</span>
        <input type="number" min="0" max="100" step="1" data-stock="${index}" data-field="pressScore" value="${stock.pressScore || 0}" />
      </label>
      <label>
        <span>Committee relevance score</span>
        <input type="number" min="0" max="100" step="1" data-stock="${index}" data-field="committeeScore" value="${stock.committeeScore || 0}" />
      </label>
      <label class="wide-field">
        <span>AI outlook</span>
        <input data-stock="${index}" data-field="aiOutlook" value="${escapeHtml(stock.aiOutlook)}" />
      </label>
      <label class="wide-field">
        <span>Risk note</span>
        <input data-stock="${index}" data-field="riskNote" value="${escapeHtml(stock.riskNote)}" />
      </label>
      <label class="wide-field">
        <span>Press/catalyst notes</span>
        <input data-stock="${index}" data-field="pressNotes" value="${escapeHtml(stock.pressNotes || "")}" />
      </label>
      <label class="wide-field">
        <span>Committee relevance notes</span>
        <input data-stock="${index}" data-field="committeeNotes" value="${escapeHtml(stock.committeeNotes || "")}" />
      </label>
      <div class="wide-field">${marketLine}</div>
    </article>
  `;
}

function congressRow(trade, index) {
  const marketLine = trade.marketPrice
    ? `<p class="muted-copy">Last market refresh: $${Number(trade.marketPrice).toFixed(2)} (${escapeHtml(trade.marketChangePercent || "n/a")}) via ${escapeHtml(trade.marketProvider || "provider")}</p>`
    : "";

  return `
    <article class="editor-row stock-editor-row">
      <label>
        <span>Representative</span>
        <input data-congress="${index}" data-field="representative" value="${escapeHtml(trade.representative)}" />
      </label>
      <label>
        <span>State</span>
        <input data-congress="${index}" data-field="state" value="${escapeHtml(trade.state)}" />
      </label>
      <label>
        <span>Party</span>
        <input data-congress="${index}" data-field="party" value="${escapeHtml(trade.party)}" />
      </label>
      <label>
        <span>Ticker</span>
        <input data-congress="${index}" data-field="ticker" value="${escapeHtml(trade.ticker)}" />
      </label>
      <label>
        <span>Company</span>
        <input data-congress="${index}" data-field="company" value="${escapeHtml(trade.company)}" />
      </label>
      <label>
        <span>Transaction</span>
        <select data-congress="${index}" data-field="transaction">
          ${["Buy", "Sell", "Exchange"]
            .map((type) => `<option value="${type}" ${type === trade.transaction ? "selected" : ""}>${type}</option>`)
            .join("")}
        </select>
      </label>
      <label>
        <span>Reported range</span>
        <input data-congress="${index}" data-field="reportedRange" value="${escapeHtml(trade.reportedRange)}" />
      </label>
      <label>
        <span>Reported date</span>
        <input type="date" data-congress="${index}" data-field="reportedDate" value="${escapeHtml(trade.reportedDate)}" />
      </label>
      <label>
        <span>Entry price</span>
        <input type="number" min="0" step="0.01" data-congress="${index}" data-field="entryPrice" value="${trade.entryPrice || ""}" />
      </label>
      <label>
        <span>Signal score</span>
        <input type="number" min="0" max="100" step="1" data-congress="${index}" data-field="signalScore" value="${trade.signalScore}" />
      </label>
      <label>
        <span>Visibility/risk label</span>
        <input data-congress="${index}" data-field="conflictRisk" value="${escapeHtml(trade.conflictRisk)}" />
      </label>
      <label class="wide-field">
        <span>Source URL</span>
        <input data-congress="${index}" data-field="sourceUrl" value="${escapeHtml(trade.sourceUrl)}" />
      </label>
      <label class="wide-field">
        <span>Entry price source</span>
        <input data-congress="${index}" data-field="entryPriceSource" value="${escapeHtml(trade.entryPriceSource || "")}" />
      </label>
      <label class="wide-field">
        <span>Watch reason</span>
        <input data-congress="${index}" data-field="watchReason" value="${escapeHtml(trade.watchReason)}" />
      </label>
      <div class="wide-field">${marketLine}</div>
    </article>
  `;
}

function renderConfig(config) {
  state.config = config;
  thresholdFields.firstEmergencyTarget.value = config.thresholds.firstEmergencyTarget;
  thresholdFields.fullEmergencyTarget.value = config.thresholds.fullEmergencyTarget;
  thresholdFields.debtInvestCap.value = config.thresholds.debtInvestCap;
  if (scanUniverse) scanUniverse.value = config.scanSettings?.universe || "combined";
  if (customTickers) customTickers.value = config.scanSettings?.customTickers || "";
  renderScanSettingsStatus();
  plansEditor.innerHTML = config.plans.map(planRow).join("");
  goalsEditor.innerHTML = config.goals.map(goalRow).join("");
  stocksEditor.innerHTML = (config.stockIdeas || []).map(stockRow).join("");
  congressEditor.innerHTML = (config.congressTrades || []).map(congressRow).join("");
  adminPanel.hidden = false;
}

function collectConfig() {
  const config = {
    thresholds: {
      firstEmergencyTarget: Number(thresholdFields.firstEmergencyTarget.value) || 100,
      fullEmergencyTarget: Number(thresholdFields.fullEmergencyTarget.value) || 500,
      debtInvestCap: Number(thresholdFields.debtInvestCap.value) || 10,
    },
    scanSettings: {
      universe: scanUniverse?.value || "combined",
      customTickers: customTickers?.value || "",
    },
    plans: state.config.plans.map((plan) => ({ ...plan })),
    goals: state.config.goals.map((goal) => ({ ...goal })),
    stockIdeas: (state.config.stockIdeas || []).map((stock) => ({ ...stock })),
    congressTrades: (state.config.congressTrades || []).map((trade) => ({ ...trade })),
  };

  document.querySelectorAll("[data-plan]").forEach((input) => {
    const index = Number(input.dataset.plan);
    const field = input.dataset.field;
    config.plans[index][field] = field === "weekly" ? Number(input.value) || 0 : input.value;
  });

  document.querySelectorAll("[data-goal]").forEach((input) => {
    const index = Number(input.dataset.goal);
    const field = input.dataset.field;
    config.goals[index][field] = field === "target" ? Number(input.value) || 1 : input.value;
  });

  document.querySelectorAll("[data-stock]").forEach((input) => {
    const index = Number(input.dataset.stock);
    const field = input.dataset.field;
    const numberFields = [
      "minimumWeekly",
      "valuationScore",
      "momentumScore",
      "qualityScore",
      "volatilityScore",
      "pressScore",
      "committeeScore",
    ];
    config.stockIdeas[index][field] = numberFields.includes(field) ? Number(input.value) || 0 : input.value;
  });

  document.querySelectorAll("[data-congress]").forEach((input) => {
    const index = Number(input.dataset.congress);
    const field = input.dataset.field;
    const numberFields = ["signalScore", "entryPrice"];
    config.congressTrades[index][field] = numberFields.includes(field) ? Number(input.value) || 0 : input.value;
  });

  return config;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.pin = document.querySelector("#adminPin").value;
  loginMessage.textContent = "Loading admin settings...";

  try {
    const [config, summary] = await Promise.all([
      fetchAdmin("/api/admin/config"),
      fetchAdmin("/api/admin/summary"),
    ]);
    renderConfig(config);
    renderSummary(summary);
    setAdminSection(adminSectionFromHash());
    loginMessage.textContent = "Admin loaded.";
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

document.querySelector("#saveConfig").addEventListener("click", async () => {
  saveMessage.textContent = "Saving...";
  try {
    const response = await fetch("/api/admin/config", {
      method: "PUT",
      headers: adminHeaders(),
      body: JSON.stringify(collectConfig()),
    });
    if (!response.ok) throw new Error("Could not save settings.");
    renderConfig(await response.json());
    saveMessage.textContent = "Saved. The public app will use this on refresh.";
  } catch (error) {
    saveMessage.textContent = error.message;
  }
});

document.querySelector("#saveScanSettings")?.addEventListener("click", async () => {
  scanSettingsMessage.textContent = "Saving prediction scan settings...";
  try {
    const response = await fetch("/api/admin/config", {
      method: "PUT",
      headers: adminHeaders(),
      body: JSON.stringify(collectConfig()),
    });
    if (!response.ok) throw new Error("Could not save prediction scan settings.");
    renderConfig(await response.json());
    scanSettingsMessage.textContent = "Prediction scan settings saved. Run a prediction scan to use this universe.";
  } catch (error) {
    scanSettingsMessage.textContent = error.message;
  }
});

scanUniverse?.addEventListener("change", renderScanSettingsStatus);
customTickers?.addEventListener("input", renderScanSettingsStatus);

document.querySelector("#refreshMarket").addEventListener("click", async () => {
  marketMessage.textContent = "Refreshing market data...";
  try {
    const response = await fetch("/api/admin/refresh-market", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.[0]?.error || "Market refresh failed.");
    renderConfig(result.config);
    marketMessage.textContent = `Updated ${result.quotes.length} ticker quotes.`;
  } catch (error) {
    marketMessage.textContent = error.message;
  }
});

document.querySelector("#refreshPredictions")?.addEventListener("click", async () => {
  predictionHealthMessage.textContent = "Running prediction scan...";
  try {
    const response = await fetch("/api/admin/refresh-predictions", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Prediction scan failed.");
    renderPredictionHealth(result.predictionEngineHealth);
    predictionHealthMessage.textContent = `Scan complete. ${result.predictions?.length || 0} predictions generated.`;
  } catch (error) {
    predictionHealthMessage.textContent = error.message;
  }
});

document.querySelector("#refreshPolicy").addEventListener("click", async () => {
  policyMessage.textContent = "Scanning policy sources...";
  try {
    const response = await fetch("/api/admin/refresh-policy", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Policy refresh failed.");
    policyMessage.textContent = `Found ${result.signals.length} policy signals with ${result.errors.length} source errors.`;
  } catch (error) {
    policyMessage.textContent = error.message;
  }
});

document.querySelector("#refreshCongressFeed").addEventListener("click", async () => {
  congressFeedMessage.textContent = "Refreshing congressional trade feed...";
  try {
    const response = await fetch("/api/admin/refresh-congress-feed", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Congress feed refresh failed.");
    renderConfig(result.config);
    congressFeedMessage.textContent = `Imported ${result.status.imported} trades. Total tracked trades: ${result.status.totalTrades}.`;
  } catch (error) {
    congressFeedMessage.textContent = error.message;
  }
});

async function importCongress(mode) {
  importMessage.textContent = "Importing...";
  try {
    const trades = JSON.parse(document.querySelector("#congressImport").value);
    if (!Array.isArray(trades)) throw new Error("Paste a JSON array of trade objects.");
    const response = await fetch("/api/admin/import/congress", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ mode, trades }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Import failed.");
    renderConfig(result.config);
    importMessage.textContent = `Imported ${result.imported} trade entries. Save is already applied.`;
  } catch (error) {
    importMessage.textContent = error.message;
  }
}

document.querySelector("#appendCongress").addEventListener("click", () => importCongress("append"));
document.querySelector("#replaceCongress").addEventListener("click", () => importCongress("replace"));

adminProfileMenuButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleAdminTopbarMenu("profile");
});

adminProfileDropdown?.addEventListener("click", (event) => {
  event.stopPropagation();
});

adminAlertsMenuButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleAdminTopbarMenu("alerts");
});

adminAlertsDropdown?.addEventListener("click", (event) => {
  const navButton = event.target.closest("[data-admin-target]");
  if (navButton) setAdminSection(navButton.dataset.adminTarget);
  event.stopPropagation();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAdminTopbarMenus();
});

window.addEventListener("hashchange", () => {
  setAdminSection(adminSectionFromHash());
});

setAdminSection(adminSectionFromHash());
