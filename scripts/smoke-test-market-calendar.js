const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const calendarCode = `${server.split("\nconst server = http.createServer")[0]}\nmodule.exports = { marketSessionStatus, easternDateParts, marketHolidayName, easternLocalDateToUtc };`;
const sandbox = {
  require,
  module: { exports: {} },
  exports: {},
  __dirname: root,
  process: { ...process, env: { ...process.env, POLICY_REFRESH_MS: "0", PREDICTION_REFRESH_MS: "0", CONGRESS_REFRESH_MS: "0" } },
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  URL,
};
vm.runInNewContext(calendarCode, sandbox, { filename: "server-calendar.vm.js" });
const { marketSessionStatus, easternDateParts, marketHolidayName, easternLocalDateToUtc } = sandbox.module.exports;

const sunday = marketSessionStatus(new Date("2026-07-12T16:27:00.000Z"));
assert.equal(sunday.status, "Closed - Weekend");
assert.equal(sunday.scanMode, "Closed-Market Analysis");
assert.equal(easternDateParts(new Date(sunday.lastRegularSessionClose)).dateKey, "2026-07-10");
assert.equal(easternDateParts(new Date(sunday.lastRegularSessionClose)).hour, 16);
assert.equal(easternDateParts(new Date(sunday.nextRegularSessionOpen)).dateKey, "2026-07-13");
assert.equal(easternDateParts(new Date(sunday.nextRegularSessionOpen)).hour, 9);
assert.equal(easternDateParts(new Date(sunday.nextRegularSessionOpen)).minute, 30);

const standard = easternLocalDateToUtc(2026, 1, 5, 9, 30).toISOString();
assert.equal(standard, "2026-01-05T14:30:00.000Z", "standard-time 9:30 ET should be 14:30 UTC");
const daylight = easternLocalDateToUtc(2026, 7, 13, 9, 30).toISOString();
assert.equal(daylight, "2026-07-13T13:30:00.000Z", "daylight-time 9:30 ET should be 13:30 UTC");

assert.equal(marketHolidayName({ year: 2026, month: 7, day: 3 }), "Independence Day");
assert.equal(marketSessionStatus(new Date("2026-07-03T16:00:00.000Z")).status, "Closed - Holiday");
const earlyClose = marketSessionStatus(new Date("2026-11-27T18:30:00.000Z"));
assert.equal(earlyClose.status, "After Hours", "day after Thanksgiving should close early at 1 PM ET");

console.log("Market calendar smoke test passed.");
