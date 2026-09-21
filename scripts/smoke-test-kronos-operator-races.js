"use strict";
const assert = require("node:assert/strict"), cp = require("node:child_process"), path = require("node:path"), t = require("./fixtures/kronos-operator-evidence");
const guard = require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
async function race(actions) {
  const root = t.temp(); let x; const children = [];
  try {
    x = t.setup(root); let ready = 0;
    const results = await Promise.all(actions.map(action => new Promise((resolve, reject) => {
      const child = cp.fork(path.join(__dirname, "fixtures/kronos-operator-child.js"), ["race"], {stdio: ["ignore", "ignore", "pipe", "ipc"], windowsHide: true}); children.push(child);
      const timeout = setTimeout(() => reject(Error("RACE_TIMEOUT")), 30000);
      child.once("error", reject); child.on("message", async m => {
        if (m.rpc) { try { child.send({reply: m.rpc, value: await x.source[m.method](...m.args)}); } catch { child.send({reply: m.rpc, error: true}); } }
        else if (m.ready) { if (++ready === actions.length) children.forEach(c => c.send({go: true})); }
        else if (m.done) { clearTimeout(timeout); resolve(m); }
        else if (m.error) { clearTimeout(timeout); reject(Error(m.error)); }
      });
      child.send({start: true, root, config: x.config, metadata: x.metadata, requestId: x.candidate.request.requestId, action});
    })));
    assert.equal(results.filter(v => !v.refused).length, 1); assert.deepEqual(x.store.counts(), {attempts: 1, decisions: 1});
    const record = x.store.decision(x.candidate.request.requestId); assert.equal(record.decision.action, results.find(v => !v.refused).action);
    console.log(actions.join(" vs ") + " separate-process CAS: PASS");
  } finally { for (const child of children) if (child.exitCode === null) { child.kill(); await new Promise(resolve => child.once("exit", resolve)); } x?.close(); t.remove(root); }
}
(async () => {
  for (const actions of [["approve", "approve"], ["approve", "deny"], ["deny", "approve"]]) await race(actions);
  const root = t.temp(); let x;
  try {
    x = t.setup(root); const session = await x.session(), review = await x.inspect(session), approved = await x.approve(session, review.reviewHash);
    assert.throws(() => x.store.reserve({requestId: "new-request", nonce: approved.decision.nonce, action: "APPROVED", reviewHash: review.reviewHash}, {}));
    await assert.rejects(x.deny(session, review.reviewHash)); const count = x.signatures(); assert.deepEqual(await x.approve(session, review.reviewHash), approved); assert.equal(x.signatures(), count);
    x.issue(approved); assert.deepEqual(await x.approve(session, review.reviewHash), approved); assert.equal(x.signatures(), count);
    const altered = {...approved.approval, approval: {...approved.approval.approval, requestId: "altered"}};
    assert.throws(() => x.x.signer.issue({...x.candidate, approval: altered}));
  } finally { x?.close(); t.remove(root); }
  guard.assertClean(); console.log("Operator nonce/artifact replay and exact duplicate response policy: PASS");
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => guard.restore());
