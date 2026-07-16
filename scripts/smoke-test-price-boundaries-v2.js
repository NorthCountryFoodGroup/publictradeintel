const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const server = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

for (const source of [server, app]) {
  assert.match(source, /price > 0 && price <= 5/, "$5 and under boundary should be exact");
  assert.match(source, /price > 5 && price <= 10/, "$5.01-$10 boundary should be exact");
  assert.match(source, /price > 10 && price <= 25/, "$10.01-$25 boundary should be exact");
  assert.match(source, /price > 25 && price <= 100/, "$25.01-$100 boundary should be exact");
  assert.match(source, /price > 100/, "$100.01 and above boundary should exist");
}

console.log("Stocks to Buy price boundaries smoke test passed.");
