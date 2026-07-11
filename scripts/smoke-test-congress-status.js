const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert.match(server, /function congressFeedPublicStatus/, "congress public status should exist");
assert.match(server, /Saved Data Only/, "saved-data-only status should exist");
assert.match(server, /Live congressional feed is not connected\. Predictions are using saved congressional disclosures\./, "user-facing saved data message should exist");
assert.doesNotMatch(app, /Set CONGRESS_TRADES_FEED_URL/, "dashboard should not show environment variable instructions");
assert.match(server, /technicalSetupInstructions/, "technical setup instructions should be reserved for admin/API data");
assert.match(server, /disclosureDate/, "congress records should store disclosure date");
assert.match(server, /transactionDate/, "congress records should store transaction date");
assert.match(server, /ageDecay/, "congress signals should decay with age");
assert.match(server, /Disclosure filed .* days after the reported transaction/, "disclosure lag note should exist");
assert.equal(pkg.scripts["smoke:congress-status"], "node scripts/smoke-test-congress-status.js");

console.log("Congress status smoke test passed.");
