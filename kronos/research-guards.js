"use strict";

function guardError(code, message) { return Object.assign(new Error(message), { code }); }
function assertNoProductionInfluence(record) {
  if (!record || record.productionInfluence !== false) {
    throw guardError("production_influence_prohibited", "Research requires literal productionInfluence=false.");
  }
  return record;
}
function assertManualExecution(triggerMode) {
  if (triggerMode === "automatic_shadow") {
    throw guardError("automatic_execution_unavailable", "Automatic shadow execution is not implemented in Slice 1.");
  }
  if (triggerMode !== "manual") throw guardError("invalid_trigger_mode", "Trusted manual provenance is required.");
}
module.exports = Object.freeze({ assertNoProductionInfluence, assertManualExecution });
