"use strict";
const w = require("./research-qualification-witness-contracts"), c = require("./research-backup-contracts");
const q = require("./research-qualification-contracts");
function parse(argv) {
  w.check(Array.isArray(argv) && argv.every(x => typeof x === "string") && argv.length <= 4, "OPERATOR_COMMAND");
  const [command, requestId, reviewHash, reason] = argv;
  w.check(["pending", "inspect", "approve", "deny", "result", "status"].includes(command), "OPERATOR_COMMAND");
  const length = {pending: 1, inspect: 2, approve: 3, deny: 4, result: 2, status: 1}[command]; w.check(argv.length === length, "OPERATOR_COMMAND");
  if (requestId !== undefined) c.label(requestId); if (reviewHash !== undefined) c.digest(reviewHash);
  return {command, args: command === "approve" ? {requestId, reviewHash} : command === "deny" ? {requestId, reviewHash, reason} : requestId ? {requestId} : {}};
}
function render(value) {
  // Render only bounded summaries. Public artifacts are retrieved via the typed result API.
  let out = value;
  if (value.decision?.decision) out = {state: "COMPLETED", requestId: value.decision.decision.context.requestId, decisionHash: value.decision.decision.decisionHash, proofHash: value.issuance?.proofHash || null};
  else if (value.decision) out = {state: value.decision.action, requestId: value.decision.context.requestId, decisionHash: value.decision.decisionHash, approvalHash: value.decision.approvalHash};
  q.safe(out); const text = JSON.stringify(out, null, 2); w.check(Buffer.byteLength(text) <= 65536, "OPERATOR_OUTPUT_LIMIT");
  w.check(!/PRIVATE KEY|AWS_ACCESS|AWS_SECRET|SessionToken|AccessKeyId|Authorization|LOGIN_PIN|ADMIN_PIN|KRONOS_SERVICE_TOKEN|cookie|oidc|bearer/i.test(text), "OPERATOR_OUTPUT_SECRET"); return text;
}
async function run({argv, controller, session, write}) {
  try { let parsed; try { parsed = parse(argv); } catch { await controller.execute("invalid", {}, session); throw Error("OPERATOR_COMMAND"); } const {command, args} = parsed; const value = await controller.execute(command, args, session); write(render(value)); return 0; }
  catch { write('{"error":"OPERATOR_REFUSED"}'); return 1; }
}
module.exports = {parse, render, run};
