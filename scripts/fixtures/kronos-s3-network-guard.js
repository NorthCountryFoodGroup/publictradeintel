"use strict";
const assert = require("node:assert/strict");
function denyExternalNetwork() {
  const restores = []; let attempts = 0, credentials = 0;
  function patch(object, key, replacement) { const old = object[key]; object[key] = replacement; restores.push(() => { object[key] = old; }); }
  const denied = () => { attempts++; throw Error("EXTERNAL_NETWORK_FORBIDDEN"); };
  for (const name of ["node:http", "node:https"]) { const m = require(name); patch(m, "request", denied); patch(m, "get", denied); }
  patch(require("node:net").Socket.prototype, "connect", denied);
  patch(require("node:tls"), "connect", denied);
  patch(require("node:dgram"), "createSocket", denied);
  for (const name of ["lookup", "resolve", "resolve4", "resolve6"]) patch(require("node:dns"), name, denied);
  for (const name of ["lookup", "resolve", "resolve4", "resolve6"]) patch(require("node:dns").promises, name, denied);
  patch(globalThis, "fetch", denied);
  const fs = require("node:fs");
  for (const name of ["readFile", "readFileSync", "open", "openSync"]) {
    const original = fs[name]; patch(fs, name, function(file, ...args) {
      if (typeof file === "string" && /[\\/]\.aws[\\/]|web.identity|token.fixture/i.test(file)) { credentials++; throw Error("CREDENTIAL_ACCESS_FORBIDDEN"); }
      return original.call(this, file, ...args);
    });
  }
  const promises = fs.promises;
  for (const name of ["readFile", "open"]) {
    const original = promises[name]; patch(promises, name, async function(file, ...args) {
      if (typeof file === "string" && /[\\/]\.aws[\\/]|web.identity|token.fixture/i.test(file)) { credentials++; throw Error("CREDENTIAL_ACCESS_FORBIDDEN"); }
      return original.call(this, file, ...args);
    });
  }
  return { assertClean() { assert.equal(attempts, 0); assert.equal(credentials, 0); }, restore() { restores.reverse().forEach(fn => fn()); }, counts: () => ({ externalNetworkAttempts: attempts, realCredentialFileAccesses: credentials }) };
}
module.exports = { denyExternalNetwork };
