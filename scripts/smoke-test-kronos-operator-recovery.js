"use strict";
const assert = require("node:assert/strict"), cp = require("node:child_process"), path = require("node:path"), t = require("./fixtures/kronos-operator-evidence");
const guard = require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
(async () => {
  for (const [boundary, action, persisted] of [["before-sign", "approve", false], ["after-approval-sign", "approve", false], ["after-persist", "approve", true], ["after-persist", "deny", true]]) {
    const root = t.temp(); let x;
    try {
      x = t.setup(root); const session = await x.session(), review = await x.inspect(session); x.close(); x = null;
      const child = cp.spawnSync(process.execPath, [path.join(__dirname, "fixtures/kronos-operator-child.js"), "crash", root, boundary, action], {encoding: "utf8", timeout: 30000, windowsHide: true});
      assert.equal(child.status, 77, child.stderr);
      // Explicit test-only dead-process ownership recovery; never an automatic CLI operation.
      t.n.recoverLocks(root); x = t.setup(root, {mode: "open-existing"}); const reopenedSession = await x.session();
      const invoke = () => action === "approve" ? x.approve(reopenedSession, review.reviewHash) : x.deny(reopenedSession, review.reviewHash);
      if (persisted) { const record = x.store.decision(x.candidate.request.requestId); assert.deepEqual(await invoke(), record); }
      else { assert.equal(x.store.state(x.candidate.request.requestId), "RECOVERY_REQUIRED"); await assert.rejects(invoke()); }
      assert.equal(x.signatures(), 0); assert.deepEqual(x.store.counts(), {attempts: 1, decisions: persisted ? 1 : 0});
      console.log(boundary + "/" + action + " fresh-process recovery, zero repeat signatures: PASS");
    } finally { x?.close(); t.remove(root); }
  }
  guard.assertClean();
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => guard.restore());
