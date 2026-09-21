"use strict";
const assert = require("node:assert/strict"), t = require("./fixtures/kronos-operator-evidence");
const guard = require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
(async () => {
  for (const kind of ["provider", "runtime", "restore", "independent-restore"]) {
    const root = t.temp(); let x;
    try {
      x = t.setup(root, {kind}); const session = await x.session(), id = x.candidate.request.requestId;
      const pending = await x.controller.execute("pending", {}, session); assert.equal(pending.requests.length, 1);
      const review = await x.inspect(session); assert.equal(review.issuanceState, "ABSENT"); assert.equal(review.evidenceHash, x.candidate.attestation.evidenceHash);
      if (kind.includes("restore")) assert.deepEqual(review.coverage, require("../kronos/research-qualification-policy").evaluateCoverage(x.candidate.attestation.evidence));
      const result = await x.approve(session, review.reviewHash); assert.equal(result.approval.approval.version, "KRONOS_OPERATOR_APPROVAL_V1");
      const signatures = x.signatures(); assert.deepEqual(await x.approve(session, review.reviewHash), result); assert.equal(x.signatures(), signatures);
      await assert.rejects(x.controller.execute("result", {requestId: id}, session));
      x.issue(result); const proof = await x.controller.execute("result", {requestId: id}, session); assert.equal(proof.issuance.version, "KRONOS_OFFLINE_PUBLIC_PROOF_V1");
      assert.deepEqual(await x.approve(session, review.reviewHash), result); assert.equal(x.signatures(), signatures);
      const status = await x.controller.execute("status", {}, session); assert.equal(status.pendingCount, 0); assert.equal(status.automaticCollectionReady, false);
      const cli = require("../kronos/research-qualification-operator-cli"), output = [];
      assert.equal(await cli.run({argv: ["status"], controller: x.controller, session, write: v => output.push(v)}), 0);
      for (const argv of [["sign", "file"], ["approve", "*"], ["export-key"], ["approve", id], ["force-completion", id]]) assert.throws(() => cli.parse(argv));
      assert(x.store.readAudit().some(v => v.action === "approve" && v.result === "APPROVED"));
      console.log(kind + " pending/inspect/approve/result/status/audit: PASS");
    } finally { x?.close(); t.remove(root); }
  }
  const root = t.temp(); let x;
  try { x = t.setup(root); const session = await x.session(), review = await x.inspect(session), denial = await x.deny(session, review.reviewHash);
    assert.equal(denial.decision.action, "DENIED"); await assert.rejects(x.approve(session, review.reviewHash)); assert.deepEqual(await x.deny(session, review.reviewHash), denial); assert.equal(x.signatures(), 1);
  } finally { x?.close(); t.remove(root); }
  guard.assertClean(); console.log("Operator command suite: PASS");
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => guard.restore());
