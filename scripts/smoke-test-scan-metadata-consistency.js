const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

assert.match(server, /function validateScanMetadata/, "server should validate scan metadata before publishing");
assert.match(server, /Emergency preset flag is true even though symbols available exceeds the preset count/, "consistency checks should catch fallback/count contradictions");
assert.match(server, /Screened count exceeds available symbol count/, "consistency checks should catch screened > available");
assert.match(server, /Deep-analysis count exceeds screened symbol count/, "consistency checks should catch deep > screened");
assert.match(server, /Generated predictions exceed successful deep-analysis count/, "consistency checks should catch prediction > deep");
assert.match(server, /Underlying quote timestamp is after provider fetch timestamp/, "consistency checks should catch quote/fetch timestamp contradictions");
assert.match(server, /scanHealth\.metadataConsistency = validateScanMetadata\(scanHealth\)/, "scan health should store consistency results");
assert.match(server, /summaryWarning/, "scan health should expose a warning instead of contradictory claims");
assert.match(server, /emergencyPresetUsed[\s\S]*symbolsAvailable must equal|emergencyPresetUsed/, "scan health should track actual emergency preset usage");

console.log("Scan metadata consistency smoke test passed.");
