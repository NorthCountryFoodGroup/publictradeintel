const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.js"), "utf8");
const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");

const adminGate = server.indexOf('if (!isAdmin(request))');
const readinessRoute = server.indexOf('pathname === "/api/admin/discovery-readiness"');
assert.ok(adminGate >= 0 && readinessRoute > adminGate, "readiness endpoint must remain behind the existing admin authorization gate");
assert.match(server, /boundedReadinessAdminPayload\(readJson\(PREDICTIONS_FILE, \{\}\)\)/);
assert.doesNotMatch(server.match(/function boundedReadinessAdminPayload[\s\S]*?\n}/)?.[0] || "", /\bobservation(s)?\s*:/, "admin payload must not expose observation history");
assert.match(html, /id="discoveryReadinessPanel"/);
assert.match(admin, /READY", "NOT_READY", "ERROR", "INSUFFICIENT_OBSERVATIONS"/);
assert.match(admin, /READY means eligible for human promotion review/);
assert.match(admin, /\/api\/admin\/discovery-readiness/);
assert.doesNotMatch(admin, /activate-v3|automatic promotion/i);

console.log("Discovery admin readiness authorization and display contract passed.");
