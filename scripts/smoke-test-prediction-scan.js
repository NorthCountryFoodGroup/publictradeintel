const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const configFile = path.join(dataDir, "config.json");
const predictionsFile = path.join(dataDir, "predictions.json");
const port = Number(process.env.SMOKE_PORT || 3219);
const baseUrl = `http://127.0.0.1:${port}`;
const pin = "1526";

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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/login.html`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await delay(250);
  }
  throw new Error("Backend route not connected");
}

async function request(pathname, options = {}, cookie = "") {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${baseUrl}${pathname}`, { ...options, headers });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

function testConfig() {
  const original = readJson(configFile, {});
  return {
    ...original,
    stockIdeas: [
      {
        ticker: "NVDA",
        name: "NVIDIA",
        type: "Stock",
        risk: "growth",
        minimumWeekly: 5,
        valuationScore: 62,
        momentumScore: 86,
        qualityScore: 90,
        volatilityScore: 58,
        pressScore: 88,
        pressNotes: "Smoke-test AI infrastructure momentum signal.",
        committeeScore: 72,
        committeeNotes: "Smoke-test semiconductor policy exposure.",
        aiOutlook: "Smoke-test prediction candidate.",
        riskNote: "High volatility can reverse quickly.",
      },
      {
        ticker: "MSFT",
        name: "Microsoft",
        type: "Stock",
        risk: "balanced",
        minimumWeekly: 5,
        valuationScore: 74,
        momentumScore: 72,
        qualityScore: 92,
        volatilityScore: 76,
        pressScore: 74,
        pressNotes: "Smoke-test cloud and AI platform strength.",
        committeeScore: 54,
        committeeNotes: "Smoke-test enterprise software policy exposure.",
        aiOutlook: "Smoke-test durable compounder candidate.",
        riskNote: "Growth can slow if cloud demand weakens.",
      },
    ],
    policySources: [],
    congressTrades: [
      {
        representative: "Smoke Test Member",
        ticker: "NVDA",
        company: "NVIDIA",
        transaction: "Buy",
        reportedRange: "$1,001 - $15,000",
        reportedDate: new Date().toISOString().slice(0, 10),
        signalScore: 70,
        watchReason: "Smoke-test saved congressional trade.",
      },
    ],
  };
}

function assertPredictionShape(result) {
  assert.ok(Array.isArray(result.predictions), "scan returns predictions array");
  assert.ok(result.predictions.length > 0, "scan returns predictions");
  const first = result.predictions[0];
  assert.ok(first.ticker, "prediction has ticker");
  assert.ok(Number.isFinite(Number(first.oneDayScore)), "prediction has 1-day score");
  assert.ok(Number.isFinite(Number(first.sevenDayScore)), "prediction has 7-day score");
  assert.ok(Number.isFinite(Number(first.thirtyDayScore)), "prediction has 1-month score");
  assert.ok(Number.isFinite(Number(first.oneYearScore)), "prediction has 1-year score");
  assertTechnicalShape(first.technicalAnalysis?.oneDay, "prediction has 1-day technical analysis");
  assertTechnicalShape(first.technicalAnalysis?.sevenDay, "prediction has 7-day technical analysis");
  assertTechnicalShape(first.technicalAnalysis?.thirtyDay, "prediction has 1-month technical analysis");
  assertTechnicalShape(first.technicalAnalysis?.oneYear, "prediction has 1-year technical analysis");
  assertTechnicalShape(first.timeframeModels?.oneDay?.technicalAnalysis, "1-day model has technical analysis");
  assertTechnicalShape(first.timeframeModels?.sevenDay?.technicalAnalysis, "7-day model has technical analysis");
  assertTechnicalShape(first.timeframeModels?.thirtyDay?.technicalAnalysis, "1-month model has technical analysis");
  assertTechnicalShape(first.timeframeModels?.oneYear?.technicalAnalysis, "1-year model has technical analysis");
  assert.ok(Array.isArray(result.sections?.top25OneDay), "has Top 25 1-day section");
  assert.ok(Array.isArray(result.sections?.top25SevenDay), "has Top 25 7-day section");
  assert.ok(Array.isArray(result.sections?.top25OneMonth), "has Top 25 1-month section");
  assert.ok(Array.isArray(result.sections?.top25OneYear), "has Top 25 1-year section");
}

function assertTechnicalShape(technical, message) {
  assert.ok(technical, message);
  assert.ok(typeof technical.trendDirection === "string", `${message}: trend direction`);
  assert.ok("priceVs9Ema" in technical, `${message}: price vs 9 EMA`);
  assert.ok("priceVs20Ema" in technical, `${message}: price vs 20 EMA`);
  assert.ok("ema9Vs20Ema" in technical, `${message}: 9 EMA vs 20 EMA`);
  assert.ok("priceVsVwap" in technical, `${message}: price vs VWAP`);
  assert.ok("nearestSupport" in technical, `${message}: nearest support`);
  assert.ok("nearestResistance" in technical, `${message}: nearest resistance`);
  assert.ok("openingRangeHigh" in technical, `${message}: opening range high`);
  assert.ok("openingRangeLow" in technical, `${message}: opening range low`);
  assert.ok(Number.isFinite(Number(technical.technicalSignalScore)), `${message}: technical signal score`);
}

async function main() {
  const originalConfig = fs.existsSync(configFile) ? fs.readFileSync(configFile, "utf8") : null;
  const originalPredictions = fs.existsSync(predictionsFile) ? fs.readFileSync(predictionsFile, "utf8") : null;
  let child = null;

  try {
    writeJson(configFile, testConfig());
    if (fs.existsSync(predictionsFile)) fs.unlinkSync(predictionsFile);

    child = spawn(process.execPath, ["server.js"], {
      cwd: root,
      env: {
        ...process.env,
        PORT: String(port),
        LOGIN_PIN: pin,
        ADMIN_PIN: pin,
        PORTFOLIO_PIN: pin,
        NODE_ENV: "development",
        ALPHA_VANTAGE_API_KEY: "",
        POLICY_REFRESH_MS: "0",
        CONGRESS_REFRESH_MS: "0",
        PREDICTION_REFRESH_MS: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let serverOutput = "";
    child.stdout.on("data", (chunk) => {
      serverOutput += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      serverOutput += chunk.toString();
    });

    await waitForServer();

    const login = await request("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    assert.equal(login.response.status, 200, "login succeeds");
    const cookie = login.response.headers.get("set-cookie")?.split(";")[0] || "";
    assert.ok(cookie, "login returns session cookie");

    const config = await request("/api/config", {}, cookie);
    assert.equal(config.response.status, 200, "watchlist config loads");
    assert.ok(Array.isArray(config.body.stockIdeas), "watchlist is an array");
    assert.ok(config.body.stockIdeas.length >= 2, "watchlist tickers load correctly");

    const scan = await request(
      "/api/predictions/scan",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      cookie,
    );
    assert.equal(scan.response.status, 200, `scan route exists and succeeds: ${JSON.stringify(scan.body)}`);
    assertPredictionShape(scan.body);
    assert.ok(fs.existsSync(predictionsFile), "predictions.json is created");

    const saved = readJson(predictionsFile, null);
    assertPredictionShape(saved);

    writeJson(predictionsFile, { updatedAt: new Date().toISOString(), predictions: [], sections: {} });
    const autoScan = await request("/api/predictions", {}, cookie);
    assert.equal(autoScan.response.status, 200, "empty predictions.json triggers new scan");
    assertPredictionShape(autoScan.body);

    const dashboard = await fetch(`${baseUrl}/index.html`, { headers: { Cookie: cookie } });
    const html = await dashboard.text();
    assert.equal(dashboard.status, 200, "dashboard loads");
    assert.ok(html.includes("runPredictionScan"), "dashboard includes scan button");

    console.log("Prediction scan smoke test passed.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    if (child) child.kill();
    if (originalConfig === null) fs.rmSync(configFile, { force: true });
    else fs.writeFileSync(configFile, originalConfig);
    if (originalPredictions === null) fs.rmSync(predictionsFile, { force: true });
    else fs.writeFileSync(predictionsFile, originalPredictions);
  }
}

main();
