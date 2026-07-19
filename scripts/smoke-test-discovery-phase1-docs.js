const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const docsDir = path.join(root, "docs", "discovery");
const requiredDocs = [
  "README.md",
  "architecture.md",
  "execution-flow.md",
  "promotion-guide.md",
  "rollback-guide.md",
  "runbook.md",
  "engineering-assumptions.md",
  "phase-2-roadmap.md",
];

for (const filename of requiredDocs) {
  const file = path.join(docsDir, filename);
  assert.ok(fs.existsSync(file), `${filename} must exist`);
  assert.ok(fs.readFileSync(file, "utf8").trim().length > 100, `${filename} must contain substantive documentation`);
}

const combined = requiredDocs
  .map((filename) => fs.readFileSync(path.join(docsDir, filename), "utf8"))
  .join("\n");
for (const phrase of [
  "v3-phase1-architecture-1",
  "Current default engine: `legacy`",
  "INSUFFICIENT_OBSERVATIONS",
  "CONTINUE_SHADOW_VALIDATION",
  "Evidence layer",
  "Regime layer",
  "Candidate pool",
  "Shadow comparison",
  "Readiness gate",
  "buildPrediction()",
  "V3_RUNTIME_LIMIT_EXCEEDED",
  "UNRESOLVED_DATA_PROVENANCE_FAILURE",
  "Phase 2",
]) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(combined, new RegExp(escaped, "i"), `documentation must cover ${phrase}`);
}

const readme = fs.readFileSync(path.join(docsDir, "README.md"), "utf8");
for (const link of [...readme.matchAll(/\]\(([^)]+\.md)\)/g)].map((match) => match[1])) {
  assert.ok(fs.existsSync(path.join(docsDir, link)), `README link must resolve: ${link}`);
}

const constants = fs.readFileSync(path.join(root, "discovery", "constants.js"), "utf8");
assert.match(constants, /discoveryEngineVersion:\s*"legacy"/, "checked-in default must remain legacy");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.equal(packageJson.scripts["smoke:discovery:phase1-docs"], "node scripts/smoke-test-discovery-phase1-docs.js");
assert.equal(packageJson.scripts["validate:discovery:phase1"], "node scripts/validate-discovery-phase1.js");

console.log("Discovery Phase 1 documentation contract passed.");
