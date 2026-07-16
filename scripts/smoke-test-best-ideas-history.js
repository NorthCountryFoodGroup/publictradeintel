const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const server = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const doc = fs.readFileSync(path.resolve(__dirname, "..", "BEST_IDEAS_HISTORY.md"), "utf8");

assert.match(server, /daysOnBestIdeas/, "Best Ideas should track days on list");
assert.match(server, /newThisScan/, "Best Ideas should flag new items");
assert.match(server, /movedUp/, "Best Ideas should flag moved-up items");
assert.match(server, /movedDown/, "Best Ideas should flag moved-down items");
assert.match(server, /archive: \[\{ scanId/, "Best Ideas should publish an archive placeholder");
assert.match(doc, /History Fields/, "history documentation should exist");

console.log("Best Ideas history smoke test passed.");
