"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const server = read("server.js");

function extractFunction(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `${name} should exist`);
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
  assert.fail(`${name} body should be balanced`);
}

assert.equal(hash(extractFunction(server, "buildPrediction")), "72714872ed27c9c7d1ceac407a87e67d753afb9f6c7cec8f0051cc80631fb1bc", "buildPrediction fingerprint changed");
assert.equal(hash(read("discovery/constants.js")), "a1d397035a3fa764635cf7f80aef8f6718fc2e74b00968ee4b03ac1a9f86b7a4", "discovery constants changed");
assert.equal(hash(read("discovery/selector.js")), "d67969075b393078b3e49aeb99e0ca03a0a38ff891ad36bcdff497f170e7337b", "selector safeguards changed");
assert.equal(hash(read("discovery/readiness-gate.js")), "4e26a21e4fcd07763af7c3e3b283d583d8c4fe2f63f4997fa8abac08e34bc68d", "readiness thresholds changed");
assert.equal(hash(read("scripts/smoke-test-discovery-api-contract.js")), "03ba898d0b84cd6a3ca785bcc7cf15c2c5420872b4853625bae4a0ca45a7b28d", "API compatibility fixture changed");
assert.equal(hash(read("scripts/smoke-test-discovery-persistence-contract.js")), "49b0f75fb3d541cca6696508e183ddccc1ae84a1c32efd54dfba29110003ebee", "persistence compatibility fixture changed");

assert.match(read("discovery/constants.js"), /discoveryEngineVersion:\s*"legacy"/);
assert.match(server, /shadowEnabled:\s*config\.discoverySettings\?\.discoveryShadowComparisonEnabled/);
assert.equal((server.match(/\.map\(\(stock\) => buildPrediction\(stock, config, policySignals, previousByTicker\)\)/g) || []).length, 1);

const phase2RuntimeFiles = [
  "autonomousDecisionRuns.json", "autonomousDecisionJournal.json", "autonomousDecisionOutcomes.json",
  "autonomousDecisionPerformance.json", "autonomousLearningProposals.json", "autonomousWeightVersions.json",
];
phase2RuntimeFiles.forEach((file) => assert.equal(fs.existsSync(path.join(root, "data", file)), false, `Phase 2 runtime file must not exist: ${file}`));

const runtimeFiles = ["config.json", "events.json", "policySignals.json", "congressFeedStatus.json", "portfolio.json", "predictions.json", "symbolUniverse.json", "predictionHistory.json", "outcomeStatus.json", "discoveryReadinessHistory.json"];
const before = new Map(runtimeFiles.map((file) => {
  const target = path.join(root, "data", file);
  return [file, fs.existsSync(target) ? hash(fs.readFileSync(target)) : null];
}));
let networkCalls = 0;
const priorFetch = global.fetch;
global.fetch = async () => {
  networkCalls += 1;
  throw new Error("Network prohibited in compatibility contract");
};
require("../decision/constants");
require("../decision/parameters");
require("../decision/schema");
global.fetch = priorFetch;
assert.equal(networkCalls, 0, "Phase 2 schema loading must not call the network");
runtimeFiles.forEach((file) => {
  const target = path.join(root, "data", file);
  const after = fs.existsSync(target) ? hash(fs.readFileSync(target)) : null;
  assert.equal(after, before.get(file), `Runtime data changed: ${file}`);
});

const decisionSource = ["decision/constants.js", "decision/parameters.js", "decision/schema.js"].map(read).join("\n");
assert.doesNotMatch(decisionSource, /fetch\s*\(|https?:\/\//, "schema modules must not call a network or AI service");
assert.doesNotMatch(decisionSource, /DATA_DIR|writeFile|appendFile|renameSync|broker|placeOrder|executeTrade/i, "schema modules must not persist or trade");
const routePaths = [...server.matchAll(/req\.url(?:\.startsWith\()?[\s\S]{0,80}?["'](\/api\/[^"']+)/g)].map((match) => match[1]);
assert.doesNotMatch(
  routePaths.join("\n"),
  /autonomous-decisions|brokerage|place-order|execute-trade|activate-autonomous|production-weight/i,
  "no Phase 2, brokerage, activation, or weight-mutation route may exist",
);

const frontendSource = ["app.js", "admin.js", "index.html", "admin.html", "login.html", "styles.css"].map(read).join("\n");
assert.doesNotMatch(frontendSource, /Decision Lab|autonomous decision|activate autonomous/i, "Phase 2 UI must remain unavailable");

console.log("Autonomous decision compatibility contract passed.");
