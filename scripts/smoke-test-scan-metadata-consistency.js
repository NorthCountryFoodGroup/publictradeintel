const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

assert.match(server, /function validateScanMetadata/, "server should validate scan metadata before publishing");
assert.match(server, /Universe Source Matches Symbol Counts/, "consistency checks should catch fallback/count contradictions");
assert.match(server, /Screened Count Within Universe/, "consistency checks should catch screened > available");
assert.match(server, /Deep Analysis Within Screened Count/, "consistency checks should catch deep > screened");
assert.match(server, /Predictions Match Successful Analysis/, "consistency checks should catch prediction > deep");
assert.match(server, /Freshness Timestamp Order/, "consistency checks should catch quote/fetch timestamp contradictions");
assert.match(server, /expected/, "consistency checks should record expected values");
assert.match(server, /actual/, "consistency checks should record actual values");
assert.match(server, /sourceField/, "consistency checks should record source fields");
assert.match(server, /scanHealth\.metadataConsistency = validateScanMetadata\(scanHealth\)/, "scan health should store consistency results");
assert.match(server, /scanHealth\.consistencyAudit = scanHealth\.metadataConsistency/, "scan health should expose consistency audit");
assert.match(server, /summaryWarning/, "scan health should expose a warning instead of contradictory claims");
assert.match(server, /emergencyPresetUsed[\s\S]*symbolsAvailable must equal|emergencyPresetUsed/, "scan health should track actual emergency preset usage");

console.log("Scan metadata consistency smoke test passed.");
