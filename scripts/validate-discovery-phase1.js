const { spawnSync } = require("node:child_process");

const contracts = [
  "smoke:discovery:api-contract",
  "smoke:discovery:prediction-boundary",
  "smoke:discovery:persistence-contract",
  "smoke:discovery:config",
  "smoke:discovery:schema",
  "smoke:discovery:evidence",
  "smoke:discovery:regime",
  "smoke:discovery:buckets",
  "smoke:discovery:candidate-pool",
  "smoke:discovery:explanations",
  "smoke:discovery:shadow-comparison",
  "smoke:discovery:selector",
  "smoke:discovery:readiness-gate",
  "smoke:discovery:readiness-history",
  "smoke:discovery:readiness-admin",
  "smoke:discovery:phase1-docs",
  "smoke:broad",
  "smoke:scan-metadata-consistency",
  "smoke:scan-summary-display",
  "smoke:prediction-data-usability",
  "smoke:packaged-symbol-first-run",
];

function run(script, options = {}) {
  const windows = process.platform === "win32";
  const executable = windows ? (process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe") : "npm";
  const args = windows ? ["/d", "/s", "/c", `npm.cmd run ${script}`] : ["run", script];
  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    encoding: options.capture ? "utf8" : undefined,
    stdio: options.capture ? "pipe" : "inherit",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}

for (const contract of contracts) {
  const result = run(contract);
  if (result.status !== 0) {
    console.error(`Phase 1 validation failed: ${contract}`);
    process.exit(result.status || 1);
  }
}

const provenance = run("smoke:data-provenance");
if (provenance.status !== 0) {
  console.error("Phase 1 validation failed: smoke:data-provenance");
  process.exit(provenance.status || 1);
}
console.log(`Phase 1 validation passed ${contracts.length} contracts; legacy remains the default and no runtime data was written.`);
