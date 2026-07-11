const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const adminJs = fs.readFileSync(path.join(root, "admin.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert.match(server, /BROAD_SCREEN_TARGET\s*=\s*2500/, "broad-screen target should be 2,500 symbols");
assert.match(server, /DEEP_ANALYSIS_MARKET_HOURS_TARGET\s*=\s*300/, "market-hours deep-analysis target should be 300 candidates");
assert.match(server, /DEEP_ANALYSIS_AFTER_HOURS_TARGET\s*=\s*600/, "after-hours deep-analysis target should be 600 candidates");
assert.match(server, /PROVIDER_CONCURRENCY_LIMIT\s*=\s*4/, "provider concurrency should be separately configurable");
assert.match(server, /PROVIDER_REQUEST_BUDGET\s*=\s*2500/, "provider request budget should be separately configurable");
assert.match(server, /MAX_SCAN_DURATION\s*=\s*180000/, "max scan duration should be separately configurable");
assert.doesNotMatch(server, /MAX_SCAN_UNIVERSE/, "single scan-universe hard cap should not remain");
assert.match(server, /targetSymbolCount:\s*BROAD_SCREEN_TARGET/, "default discovery target should be the broad-screen target");
assert.match(server, /function buildDiscoveryPipeline/, "backend should build an explicit discovery pipeline");
assert.match(server, /function buildScanUniverse\(config,\s*quotes\s*=\s*\[\]\)/, "buildScanUniverse should accept quote context");
assert.match(server, /broadScreenScore\(candidate/, "broad screening score should rank candidates before deep analysis");
assert.match(server, /marketHoursDeepCount/, "market-hours deep-analysis count should be configurable");
assert.match(server, /afterHoursDeepCount/, "after-hours deep-analysis count should be configurable");
assert.match(server, /providerSupportedBroadCount/, "provider-supported broad coverage should be reported honestly");
assert.match(server, /deepAnalysisCandidates/, "deep-analysis candidate selection should be separate from broad screening");
assert.match(server, /broadUniverseStats/, "scan health should report broad universe coverage");
assert.match(server, /sectorAllocationSummary/, "scan health should include sector allocation");
assert.match(server, /signalContribution/, "predictions should include signal contribution transparency");
assert.match(server, /freshnessStatus/, "predictions should include freshness status");
assert.match(server, /Math\.min\(10,\s*Math\.round\(congressionalActivity/, "congressional contribution should be capped in contribution reporting");
assert.match(server, /congress\.score\s*\*\s*0\.12/, "congress should be a secondary input to institutional-flow proxy");
assert.match(server, /congressionalActivity\s*\*\s*0\.18/, "congress should be a secondary input to insider proxy");

assert.match(adminHtml, /Prediction Discovery Settings/, "admin UI should expose discovery settings");
assert.match(adminHtml, /Prediction Model Weights/, "admin UI should expose model weights");
assert.match(adminHtml, /discoveryTargetSymbolCount/, "admin UI should include target symbol count setting");
assert.match(adminHtml, /discoveryProviderRequestBudget/, "admin UI should include provider request budget setting");
assert.match(adminHtml, /discoveryMaxScanDurationMs/, "admin UI should include max scan duration setting");
assert.match(adminHtml, /weightOneDayCongress/, "admin UI should include congressional weight caps");

assert.match(adminJs, /sanitizeDiscoverySettings|readDiscoverySettings/, "admin JS should read discovery settings");
assert.match(adminJs, /sanitizeModelWeights|readModelWeights/, "admin JS should read model weights");
assert.equal(packageJson.scripts["smoke:broad"], "node scripts/smoke-test-broad-discovery.js");

console.log("Broad discovery smoke test passed.");
