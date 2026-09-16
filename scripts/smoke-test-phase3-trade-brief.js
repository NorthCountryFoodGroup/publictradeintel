"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
assert.equal((source.match(/function renderTradeBrief\s*\(/g) || []).length, 1, "exactly one authoritative Trade Brief renderer must remain");
assert.doesNotMatch(source, /legacyTradeBriefReference|non-invoked reference|older markup/);
for (const contract of [
  "About this company",
  "About this ETF",
  "About this fund",
  "About this security",
  "Detailed company profile information is not currently available",
  "profileSource",
  "profileFetchedAt",
]) assert.ok(source.includes(contract), `Trade Brief preserves ${contract}`);
console.log("Phase 3 single-authority Trade Brief contract passed.");
