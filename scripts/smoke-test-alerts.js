const assert = require("node:assert/strict");

function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 12);
}

function createAlertRule({ ticker, type, priority = "High", threshold = "" }) {
  return {
    id: `rule-${Date.now()}-${normalizeTicker(ticker)}`,
    ticker: normalizeTicker(ticker),
    type,
    priority,
    threshold,
    active: true,
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

function triggerAlerts(rules, predictions, history) {
  for (const rule of rules.filter((item) => item.active)) {
    const prediction = predictions.find((item) => normalizeTicker(item.ticker) === normalizeTicker(rule.ticker));
    if (!prediction) continue;
    const score = Number(prediction.unifiedPredictionScore) || 0;
    const threshold = Number(rule.threshold);
    const triggered =
      rule.type === "scoreAbove" ||
      rule.type === "scoreIncrease"
        ? score >= threshold
        : rule.type === "recommendationChange"
          ? Boolean(prediction.recommendationChanged)
          : false;
    if (!triggered) continue;
    history.unshift({
      id: `alert-${rule.id}-${new Date().toISOString().slice(0, 10)}`,
      ruleId: rule.id,
      ticker: rule.ticker,
      type: rule.type,
      priority: rule.priority,
      explanation: `${rule.ticker} triggered ${rule.type}.`,
      suggestedAction: "Open the Trade Brief.",
      timestamp: new Date().toISOString(),
      read: false,
      resolved: false,
    });
  }
}

const rules = [];
const history = [];

rules.push(createAlertRule({ ticker: "NVDA", type: "scoreAbove", priority: "Critical", threshold: "80" }));
assert.equal(rules.length, 1);
assert.equal(rules[0].delivery.inApp, true);
assert.equal(rules[0].delivery.email, false);

triggerAlerts(rules, [{ ticker: "NVDA", unifiedPredictionScore: 88 }], history);
assert.equal(history.length, 1);
assert.equal(history[0].ticker, "NVDA");
assert.equal(history[0].read, false);

history[0].read = true;
assert.equal(history[0].read, true);

history[0].resolved = true;
assert.equal(history[0].resolved, true);

assert.ok(history[0].explanation.includes("triggered"));
console.log("Alerts smoke test passed.");
