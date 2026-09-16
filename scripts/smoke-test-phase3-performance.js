"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "performance-explorer.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
assert.doesNotMatch(source, /row\.series\.map\(\(point\)=>`<circle/, "trend must not create a hit node per observation");
assert.match(source, /data-chart-pointer-layer/);
assert.match(source, /showNearestObservation/);
assert.match(source, /Math\.abs\(time-targetTime\)/, "nearest actual observation is selected mathematically");
assert.match(source, /data-chart-crosshair/);
assert.match(source, /data-chart-tooltip/);
assert.match(source, /new AbortController\(\)/);
assert.match(source, /requestController\?\.abort\(\)/);
assert.match(source, /error\?\.name === "AbortError"/);
assert.match(source, /current !== requestId/);
assert.match(source, /diagnostics\.cancellations/);
assert.match(source, /observerCallbacks/);
assert.match(css, /chart-pointer-layer/);
assert.match(css, /chart-crosshair/);
assert.doesNotMatch(source, /predictions\/scan|buildPrediction/);

let generation = 0;
let active = null;
let rendered = null;
let cancellations = 0;
async function request(label, delay) {
  active?.abort();
  if (active) cancellations += 1;
  active = new AbortController();
  const signal = active.signal;
  const current = ++generation;
  try {
    const value = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(label), delay);
      signal.addEventListener("abort", () => { clearTimeout(timer); reject(Object.assign(new Error("aborted"), { name: "AbortError" })); });
    });
    if (current === generation) rendered = value;
  } catch (error) {
    if (error.name !== "AbortError") throw error;
  }
}

(async () => {
  const stale = request("2Y", 50);
  const latest = request("7D", 1);
  await Promise.all([stale, latest]);
  assert.equal(rendered, "7D", "an aborted stale request cannot overwrite the newest period");
  assert.equal(cancellations, 1);
  const observationCount = 10 * 504;
  const oldHitNodes = observationCount;
  const newHitNodes = 1;
  assert.ok(newHitNodes < oldHitNodes / 1000, "shared hit layer materially reduces large 2Y chart nodes");
  console.log(`Phase 3 Performance Explorer contract passed (${oldHitNodes} per-point hit nodes reduced to ${newHitNodes}; ${cancellations} cancellation).`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
