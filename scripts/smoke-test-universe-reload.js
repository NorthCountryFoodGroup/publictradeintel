const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.js"), "utf8");

assert.match(server, /\/api\/admin\/reload-symbol-snapshot/, "server should expose packaged snapshot reload route");
assert.match(server, /Packaged symbol snapshot failed validation/, "reload route should report validation failure");
assert.match(server, /writeJson\(SYMBOL_UNIVERSE_FILE,\s*packaged\)/, "reload route should persist a valid packaged snapshot");
assert.match(admin, /Reload Packaged Symbol Snapshot/, "admin UI should include packaged snapshot reload control");
assert.match(admin, /\/api\/admin\/reload-symbol-snapshot/, "admin UI should call packaged snapshot reload route");
assert.match(admin, /Rejected record summary/, "admin UI should display rejected record summary");
assert.match(admin, /Last universe error/, "admin UI should display last universe error");
assert.match(admin, /Snapshot file exists/, "admin UI should display snapshot diagnostics");

console.log("Universe reload smoke test passed.");
