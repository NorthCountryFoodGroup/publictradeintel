const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const doc = fs.readFileSync(path.join(root, "QUOTE_COVERAGE_DIAGNOSTIC.md"), "utf8");

[
  "totalDeepAnalysisSymbols",
  "yahooAttemptedSymbols",
  "yahooNotAttemptedSymbols",
  "yahooSuccessfulSymbols",
  "yahooAttemptSuccessRate",
  "yahooContributionPercent",
  "symbolsServedFromCache",
  "symbolsServedFromSavedQuoteFallback",
  "symbolsServedFromPreviouslyRefreshedBroadScreenData",
  "symbolsServedFromAnotherProvider",
  "symbolsWithFallbackGeneratedValues",
  "symbolsWithNoFreshProviderQuote",
  "reasonYahooSubset",
].forEach((field) => assert.match(server, new RegExp(field), `${field} should be included in quote coverage diagnostic`));

assert.match(server, /function providerStatusFromAttemptRate/, "provider status should be based on provider attempt metrics");
assert.match(server, /return "Not Needed"/, "provider status should support Not Needed");
assert.match(server, /return "Rate Limited"/, "provider status should support Rate Limited");
assert.match(server, /quoteCoverageDiagnostic: quoteDiagnostic/, "scan health should expose quote coverage diagnostic");
assert.match(doc, /What 29 of 300 Means/, "diagnostic doc should explain confusing provider-success counts");
assert.match(doc, /provider-specific quote coverage/i, "diagnostic doc should distinguish provider-specific coverage");

console.log("Quote coverage diagnostic smoke test passed.");

