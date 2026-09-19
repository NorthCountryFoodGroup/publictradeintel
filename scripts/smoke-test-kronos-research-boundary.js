"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const baseline = "03b0878680cce139b7ae14f5b51bf257ca34ca55";
// Protect the complete existing authoritative surfaces, not a single regex slice.
// This also protects Best Ideas, ordering, portfolio paths and frontend consumers.
const protectedPaths = ["server.js", "app.js", "historical-market.js", "discovery", "decision", "lib", "kronos/analytics.js", "kronos/outcomes.js", "kronos/persistence.js", "kronos/client.js", "kronos-service", "render.yaml"];
const diff = execFileSync("git", ["diff", baseline, "--", ...protectedPaths], { cwd: root, encoding: "utf8" });
assert.equal(diff, "", "Slice 1 must not alter existing authoritative surfaces or protected implementations.");
// Check every tracked production JS module, including future imports into Legacy.
const files = execFileSync("git", ["ls-files", "*.js"], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/);
for (const file of files.filter(file => !file.startsWith("scripts/") && !["kronos/schema.js", "kronos/service.js", "kronos/research-contracts.js", "kronos/research-guards.js"].includes(file))) {
  assert.doesNotMatch(fs.readFileSync(path.join(root, file), "utf8"), /require\s*\([^)]*research-(?:contracts|guards)|from\s+["'][^"']*research-(?:contracts|guards)/, `${file} must not consume research contracts`);
}
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
assert.match(server, /forecast\(await collectBody\(request\), \{ triggerMode: "manual" \}\)/);
assert.equal((server.match(/kronosShadowService\.forecast\(/g) || []).length, 1, "Only the existing manual endpoint may call the research service.");
for (const name of ["research-contracts", "research-guards"]) {
  const source = fs.readFileSync(path.join(root, "kronos", `${name}.js`), "utf8");
  assert.doesNotMatch(source, /\b(?:fetch|setTimeout|setInterval|setImmediate|queueMicrotask)\s*\(|\.infer\s*\(|\.forecast\s*\(|\.listen\s*\(/);
}
require("./smoke-test-prediction-engine-boundary");
console.log("Slice 1 Legacy, Best Ideas, ordering, portfolio, execution, and protected fingerprint boundaries: PASS");
