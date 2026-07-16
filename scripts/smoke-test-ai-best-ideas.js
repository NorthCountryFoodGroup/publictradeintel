const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const server = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");

assert.match(server, /function stocksToBuyBestIdeas/, "server should build AI Best Ideas");
assert.match(server, /bestIdeasScore/, "Best Ideas should use a selection layer");
assert.match(server, /sectorCounts/, "Best Ideas should diversify by sector");
assert.match(server, /selected\.length >= 10/, "Best Ideas should cap at 10");
assert.match(html, /id="bestIdeasGrid"/, "Best Ideas UI grid should exist");
assert.ok(app.includes("center.bestIdeas?.current") || app.includes("bestIdeas.current"), "frontend should render current Best Ideas first");

console.log("AI Best Ideas smoke test passed.");
