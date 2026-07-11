const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.js"), "utf8");

assert.match(server, /congressConnectionDiagnostic/, "Congress connection diagnostic should exist");
assert.match(server, /httpStatus/, "Congress feed HTTP status should be recorded");
assert.match(server, /contentType/, "Congress feed content type should be recorded");
assert.match(server, /CONGRESS_TRADES_API_KEY/, "API key env var should be supported without exposing value");
assert.match(server, /savedFallbackRecordCount/, "saved fallback count should be reported");
assert.match(admin, /Connection diagnostic/, "Admin should show Congress connection diagnostic");
assert.doesNotMatch(admin, /CONGRESS_TRADES_API_KEY.*value=/, "secret values should not be exposed in admin markup");

console.log("Congress connection smoke test passed.");
