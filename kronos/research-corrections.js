"use strict";
const { canonicalize } = require("./research-canonical");
const { hashValue } = require("./research-hash");
function fail(message) { throw Object.assign(new Error(message), { code: "invalid_correction" }); }
function validateCorrection(event, original, originalHash, effective, latestCorrectionId) {
  canonicalize(event);
  const fields = ["recordContractVersion", "id", "targetId", "originalHash", "changes", "reason", "actor", "timestamp", "softwareVersion", "priorCorrectionId", "productionInfluence"];
  if (!event || Object.keys(event).length !== fields.length || Object.keys(event).some(key => !fields.includes(key))) fail("Unsupported correction envelope.");
  if (event.recordContractVersion !== "KRONOS_CORRECTION_V1" || event.productionInfluence !== false) fail("Invalid correction contract or influence.");
  for (const key of ["id", "reason", "actor", "softwareVersion"]) if (typeof event[key] !== "string" || !event[key].trim() || event[key].length > 240 || /[\x00-\x1f]/.test(event[key])) fail(`Invalid ${key}.`);
  if (event.targetId !== original.id || event.originalHash !== originalHash || event.priorCorrectionId !== latestCorrectionId) fail("Correction target/chain conflict.");
  if (typeof event.timestamp !== "string" || !Number.isFinite(Date.parse(event.timestamp)) || new Date(event.timestamp).toISOString() !== event.timestamp) fail("Invalid correction time.");
  if (!Array.isArray(event.changes) || event.changes.length !== 1) fail("Exactly one allowlisted metadata change is required.");
  const change = event.changes[0];
  if (!change || Object.keys(change).sort().join(",") !== "path,previousValueHash,value" || change.path !== "/securityName") fail("Evidence-changing corrections are prohibited; use a disposition event.");
  if (change.previousValueHash !== hashValue(effective.securityName)) fail("Previous-value hash conflict.");
  if (typeof change.value !== "string" || !change.value.trim() || change.value.length > 200 || /[\x00-\x1f]/.test(change.value)) fail("Invalid display name.");
  return { ...effective, securityName: change.value };
}
module.exports = Object.freeze({ validateCorrection });
