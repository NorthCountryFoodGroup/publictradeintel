"use strict";
const path = require("node:path"), t = require("./kronos-operator-evidence");
require("./kronos-s3-network-guard").denyExternalNetwork();
if (process.argv[2] === "crash") {
  (async () => {
    const root = process.argv[3], boundary = process.argv[4], action = process.argv[5];
    const x = t.setup(root, {mode: "open-existing", hook: point => { if (point === boundary) process.exit(77); }});
    const session = await x.session(), review = await x.inspect(session);
    if (action === "approve") await x.approve(session, review.reviewHash); else await x.deny(session, review.reviewHash);
    x.close(); process.exitCode = 1;
  })().catch(() => { process.exitCode = 2; });
} else {
  let next = 0, x, session, review, action; const requests = new Map();
  function call(method, args) { return new Promise((resolve, reject) => { const id = ++next; requests.set(id, {resolve, reject}); process.send({rpc: id, method, args}); }); }
  process.on("message", async message => {
    try {
      if (message.reply) { const pending = requests.get(message.reply); requests.delete(message.reply); if (message.error) pending.reject(Error("FIXTURE_SOURCE")); else pending.resolve(message.value); return; }
      if (message.start) {
        const {root, config, metadata} = message; action = message.action;
        const store = t.storage.openStore(path.join(root, "operator.sqlite"), {mode: "open-existing", metadata});
        const provider = t.control.createFixtureAuthProvider({testOnly: true, identity: config.operators[0], privateKey: t.n.f.t.extraKey.privateKey, now: () => t.n.f.t.f.time});
        x = {store, provider, controller: t.control.createController({store, provider, config, retention: {current: () => call("retentionCurrent", []), retain: record => call("retentionRetain", [record])}, now: () => t.n.f.t.f.time, confirm: async v => v.phrase,
          source: {snapshot: (...args) => call("snapshot", args), pending: (...args) => call("pending", args), available: (...args) => call("available", args)}})};
        session = await provider.authenticate({fixtureUserPresence: true}); review = await x.controller.execute("inspect", {requestId: message.requestId}, session); process.send({ready: true});
      } else if (message.go) {
        try { const value = await x.controller.execute(action, {requestId: review.requestId, reviewHash: review.reviewHash, ...(action === "deny" ? {reason: "EVIDENCE"} : {})}, session); process.send({done: true, action: value.decision.action}); }
        catch { process.send({done: true, refused: true}); }
        x.store.close(); x.provider.close(); process.disconnect();
      }
    } catch { process.send({error: "FIXTURE_FAILED"}); process.exitCode = 1; process.disconnect(); }
  });
}
