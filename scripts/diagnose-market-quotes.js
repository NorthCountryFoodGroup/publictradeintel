const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");

const port = Number(process.env.DIAGNOSTIC_PORT || 3227);
const pin = process.env.DIAGNOSTIC_PIN || process.env.ADMIN_PIN || "1526";
const baseUrl = `http://127.0.0.1:${port}`;

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

async function main() {
  let child = null;
  try {
    child = spawn(process.execPath, ["server.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        LOGIN_PIN: pin,
        ADMIN_PIN: pin,
        PORTFOLIO_PIN: pin,
        NODE_ENV: process.env.NODE_ENV || "development",
        POLICY_REFRESH_MS: "0",
        CONGRESS_REFRESH_MS: "0",
        PREDICTION_REFRESH_MS: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    await waitForServer();
    const login = await request("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    assert.equal(login.response.status, 200, "login succeeds");
    const cookie = login.response.headers.get("set-cookie")?.split(";")[0] || "";

    const scan = await request(
      "/api/predictions/scan",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      cookie,
    );
    assert.equal(scan.response.status, 200, `scan succeeds: ${JSON.stringify(scan.body)}`);

    const health = scan.body.predictionEngineHealth || {};
    const failures = health.incompleteMarketDataTickers || [];
    console.log(JSON.stringify({
      predictionsGenerated: scan.body.predictions?.length || 0,
      scanUniverse: scan.body.scanUniverse,
      predictionEngineStatus: health.predictionEngineStatus,
      dataQualityStatus: health.dataQualityStatus,
      marketQuotesRequested: health.marketQuotesRequested,
      marketQuotesSucceeded: health.marketQuotesSucceeded,
      marketQuotesFailed: health.marketQuotesFailed,
      incompleteMarketDataCount: health.incompleteMarketDataCount,
      incompleteMarketDataPercent: health.incompleteMarketDataPercent,
      brkB: (scan.body.predictions || []).find((item) => item.ticker === "BRK.B") || null,
      failures,
    }, null, 2));
  } finally {
    if (child) child.kill();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
