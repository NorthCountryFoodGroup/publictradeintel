const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const doc = fs.readFileSync(path.join(root, "PENNY_SPECULATIVE.md"), "utf8");

assert.match(app, /function pennySpeculativeQualification/, "Penny Speculative qualification function should exist");
assert.match(app, /price > 0 && price <= 5/, "Penny Speculative should be limited to $5 and under");
assert.match(app, /isExchangeListed/, "Penny Speculative should exclude OTC/unsupported securities");
assert.match(app, /marketVolume/, "Penny Speculative should require available volume");
assert.match(app, /Penny and speculative stocks can be highly volatile/, "cards should display the high-risk penny warning");
assert.match(html, /value="penny">Penny &amp; Speculative/, "Penny & Speculative option should exist");
assert.match(doc, /high-risk research only/i, "Penny Speculative doc should include risk caveat");

console.log("Penny Speculative smoke test passed.");
