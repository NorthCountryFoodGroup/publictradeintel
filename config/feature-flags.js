"use strict";

function strictBoolean(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return false;
}

function loadFeatureFlags(environment = process.env) {
  const flags = Object.freeze({
    decisionLabEnabled: strictBoolean(environment.DECISION_LAB_ENABLED),
    v3ShadowEnabled: strictBoolean(environment.V3_SHADOW_ENABLED),
    productionOrderExecutionEnabled: strictBoolean(environment.PRODUCTION_ORDER_EXECUTION_ENABLED),
  });
  if (flags.productionOrderExecutionEnabled) {
    const error = new Error("Production order execution is prohibited.");
    error.code = "ORDER_EXECUTION_PROHIBITED";
    throw error;
  }
  return flags;
}

module.exports = Object.freeze({
  loadFeatureFlags,
  strictBoolean,
});
