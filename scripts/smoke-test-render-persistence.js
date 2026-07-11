const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const docs = fs.readFileSync(path.join(root, "RENDER_PERSISTENCE.md"), "utf8");

assert.match(server, /PUBLIC_SYMBOL_SNAPSHOT_FILE/, "production should ship packaged symbol snapshot");
assert.match(server, /SYMBOL_UNIVERSE_FILE/, "runtime symbol cache should remain optional");
assert.match(docs, /Render filesystem/i, "Render persistence docs should explain filesystem behavior");
assert.match(docs, /ephemeral/i, "docs should warn about ephemeral JSON storage");
assert.match(docs, /packaged public snapshot/i, "docs should explain packaged snapshot fallback");
assert.match(docs, /database/i, "docs should identify database need for durable history");

console.log("Render persistence smoke test passed.");
