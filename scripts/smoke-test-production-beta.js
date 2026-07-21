"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { loadFeatureFlags, strictBoolean } = require("../config/feature-flags");
const { SlidingWindowLimiter, constantTimeEqual } = require("../lib/security");
const { resolveDataDirectory, validateDataDirectory } = require("../lib/json-store");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const render = fs.readFileSync(path.join(root, "render.yaml"), "utf8");
const packageJson = require("../package.json");
const dashboard = fs.readFileSync(path.join(root, "index.html"), "utf8");

function fileHash(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function extractFunction(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `${name} exists`);
  let open = source.indexOf("{", source.indexOf(")", match.index));
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"' || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return source.slice(match.index, index + 1);
  }
  assert.fail(`${name} body is balanced`);
}

for (const value of [undefined, "", "yes", "1", "TRUE-ish"]) assert.equal(strictBoolean(value), false);
assert.equal(strictBoolean("true"), true);
assert.equal(strictBoolean(" false "), false);
assert.deepEqual(loadFeatureFlags({}), {
  decisionLabEnabled: false,
  v3ShadowEnabled: false,
  productionOrderExecutionEnabled: false,
});
assert.throws(() => loadFeatureFlags({ PRODUCTION_ORDER_EXECUTION_ENABLED: "true" }), /prohibited/i);

assert.doesNotMatch(dashboard, /decision lab/i);
assert.match(server, /pathname\.startsWith\("\/api\/decision-lab"\)/);
assert.match(server, /url\.pathname === "\/decision-lab"/);
assert.match(server, /if \(!FEATURE_FLAGS\.v3ShadowEnabled\)[\s\S]*discoveryShadowComparisonEnabled = false/);
assert.match(fs.readFileSync(path.join(root, "discovery", "constants.js"), "utf8"), /discoveryEngineVersion:\s*"legacy"/);

assert.match(server, /request\.method === "GET" && url\.pathname === "\/healthz"/);
const healthBlock = server.match(/if \(request\.method === "GET" && url\.pathname === "\/healthz"\) \{[\s\S]*?\n  \}/)?.[0] || "";
assert.doesNotMatch(healthBlock, /runPredictionScan|fetch\(|writeJson|DATA_DIR|PIN|API_KEY/);
assert.match(healthBlock, /status:\s*"healthy"/);
assert.match(healthBlock, /persistence:/);

const predictionGet = server.match(/if \(request\.method === "GET" && pathname === "\/api\/predictions"\) \{[\s\S]*?\n  \}/)?.[0] || "";
assert.match(predictionGet, /readJson\(PREDICTIONS_FILE/);
assert.doesNotMatch(predictionGet, /await|runPredictionScan|refresh|writeJson|fetch\(/);
const scanPost = server.match(/if \(request\.method === "POST" && pathname === "\/api\/predictions\/scan"\) \{[\s\S]*?\n  \}/)?.[0] || "";
assert.match(scanPost, /activePredictionScan/);
assert.match(scanPost, /429/);
assert.match(scanPost, /runPredictionScan/);

assert.match(server, /HttpOnly; SameSite=Lax; Max-Age=604800/);
assert.match(server, /PRODUCTION \? "; Secure" : ""/);
assert.match(server, /SESSION_DURATION_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
assert.match(server, /expiresAt: issuedAt \+ SESSION_DURATION_MS/);
assert.match(server, /session\.expiresAt <= Date\.now\(\)/);
assert.match(server, /crypto\.randomBytes\(32\)/);
assert.match(server, /loginLimiter\.recordFailure/);

assert.equal(constantTimeEqual("same-secret", "same-secret"), true);
assert.equal(constantTimeEqual("same-secret", "different"), false);
let now = 1000;
const limiter = new SlidingWindowLimiter({ windowMs: 1000, maximumAttempts: 2, lockoutMs: 5000, now: () => now });
assert.equal(limiter.check("ip").allowed, true);
limiter.recordFailure("ip");
assert.equal(limiter.check("ip").allowed, true);
limiter.recordFailure("ip");
assert.equal(limiter.check("ip").allowed, false);
now += 5001;
assert.equal(limiter.check("ip").allowed, true);

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "pti-beta-storage-"));
try {
  assert.equal(resolveDataDirectory("/repo", " /var/data "), path.resolve("/var/data"));
  assert.deepEqual(validateDataDirectory(temporary, { production: true, configured: true }), { healthy: true });
  assert.throws(() => validateDataDirectory(temporary, { production: true, configured: false }), /DATA_DIR is required/);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

assert.match(render, /healthCheckPath:\s*\/healthz/);
assert.match(render, /mountPath:\s*\/var\/data/);
assert.match(render, /key:\s*DATA_DIR[\s\S]*value:\s*"\/var\/data"/);
assert.match(render, /key:\s*DECISION_LAB_ENABLED[\s\S]*value:\s*"false"/);
assert.match(render, /key:\s*V3_SHADOW_ENABLED[\s\S]*value:\s*"false"/);
assert.match(render, /key:\s*PRODUCTION_ORDER_EXECUTION_ENABLED[\s\S]*value:\s*"false"/);
assert.equal(packageJson.engines.node, ">=24.18.0 <25");

const buildPredictionHash = crypto.createHash("sha256").update(extractFunction(server, "buildPrediction")).digest("hex");
assert.equal(buildPredictionHash, "72714872ed27c9c7d1ceac407a87e67d753afb9f6c7cec8f0051cc80631fb1bc");

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForHealth(baseUrl, child) {
  let lastError = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Server exited before health (${child.exitCode}).`);
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await wait(100);
  }
  throw new Error(`Server health timeout: ${lastError?.message || "unavailable"}`);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  for (let attempt = 0; attempt < 30 && child.exitCode === null; attempt += 1) await wait(50);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function runProductionModeIntegration() {
  const integrationRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pti-production-beta-"));
  const predictionsPath = path.join(integrationRoot, "predictions.json");
  const storedPredictions = {
    updatedAt: "2026-07-19T12:00:00.000Z",
    predictions: [{ ticker: "TSTQ", score: 77 }],
    sections: {},
  };
  fs.writeFileSync(predictionsPath, `${JSON.stringify(storedPredictions, null, 2)}\n`, "utf8");
  const originalPredictionHash = fileHash(predictionsPath);
  const port = 33000 + (process.pid % 1000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const environment = {
    ...process.env,
    NODE_ENV: "production",
    DATA_DIR: integrationRoot,
    PORT: String(port),
    LOGIN_PIN: "audit-login-pin-2026",
    ADMIN_PIN: "audit-admin-pin-2026",
    PORTFOLIO_PIN: "audit-portfolio-pin-2026",
    DECISION_LAB_ENABLED: "false",
    V3_SHADOW_ENABLED: "false",
    PRODUCTION_ORDER_EXECUTION_ENABLED: "false",
    POLICY_REFRESH_MS: "0",
    PREDICTION_REFRESH_MS: "0",
    CONGRESS_REFRESH_MS: "0",
  };
  let child = null;
  let stderr = "";
  const startServer = () => {
    const processHandle = spawn(process.execPath, ["server.js"], {
      cwd: root,
      env: environment,
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    processHandle.stderr.on("data", (chunk) => { stderr += String(chunk).slice(0, 4096); });
    return processHandle;
  };

  try {
    child = startServer();
    const healthResponse = await waitForHealth(baseUrl, child);
    const health = await healthResponse.json();
    assert.deepEqual(Object.keys(health).sort(), ["persistence", "serverTime", "status", "uptime"].sort());
    assert.equal(health.status, "healthy");
    assert.equal(health.persistence, "healthy");
    assert.equal(fileHash(predictionsPath), originalPredictionHash, "health must not write predictions");

    const loginResponse = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin: environment.LOGIN_PIN }),
    });
    assert.equal(loginResponse.status, 200);
    const setCookie = loginResponse.headers.get("set-cookie") || "";
    assert.match(setCookie, /pti_session=[^;]+/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Secure/i);
    assert.match(setCookie, /SameSite=Lax/i);
    const cookie = setCookie.split(";")[0];

    const dashboardResponse = await fetch(`${baseUrl}/`, { headers: { cookie } });
    assert.equal(dashboardResponse.status, 200);
    assert.match(await dashboardResponse.text(), /Public Trade Intel/i);

    const predictionsResponse = await fetch(`${baseUrl}/api/predictions`, { headers: { cookie } });
    assert.equal(predictionsResponse.status, 200);
    const predictions = await predictionsResponse.json();
    assert.equal(predictions.predictions[0].ticker, "TSTQ");
    assert.equal(fileHash(predictionsPath), originalPredictionHash, "GET predictions must remain read-only");

    const decisionLabResponse = await fetch(`${baseUrl}/api/decision-lab`, { headers: { cookie } });
    assert.equal(decisionLabResponse.status, 404);

    await stopChild(child);
    child = startServer();
    await waitForHealth(baseUrl, child);
    const expiredSessionResponse = await fetch(`${baseUrl}/api/session`, { headers: { cookie } });
    assert.equal(expiredSessionResponse.status, 200);
    assert.equal((await expiredSessionResponse.json()).loggedIn, false);
    assert.equal(JSON.parse(fs.readFileSync(predictionsPath, "utf8")).predictions[0].ticker, "TSTQ");
    assert.equal(fileHash(predictionsPath), originalPredictionHash, "restart must preserve predictions");
  } catch (error) {
    if (stderr) error.message += `; bounded server stderr: ${stderr.slice(0, 500)}`;
    throw error;
  } finally {
    await stopChild(child);
    fs.rmSync(integrationRoot, { recursive: true, force: true });
  }
}

runProductionModeIntegration()
  .then(() => console.log("Controlled production beta contract passed."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
