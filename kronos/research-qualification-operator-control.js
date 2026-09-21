"use strict";
// The provider is a trusted local composition dependency, never a request/CLI parameter.
const crypto = require("node:crypto"), w = require("./research-qualification-witness-contracts");
const p = require("./research-qualification-preflight-contracts"), s = require("./research-qualification-signer-contracts");
const c = require("./research-backup-contracts"), contracts = require("./research-qualification-operator-contracts");
const providers = new WeakMap(), sessions = new WeakMap();
function createAuthProvider({identity, authenticate, signApproval, signDecision, now = Date.now}) {
  const op = p.freeze(structuredClone(identity)); w.check(op.keyFingerprint === s.fingerprint(op.publicKey), "OPERATOR_KEY");
  w.check([authenticate, signApproval, signDecision, now].every(v => typeof v === "function"), "OPERATOR_PROVIDER");
  const state = {identity: op, signApproval, signDecision, now, closed: false};
  const handle = Object.freeze({identity: () => structuredClone(op), available: () => !state.closed,
    async authenticate(input) {
      w.check(!state.closed && await authenticate(input) === true, "OPERATOR_AUTH_REQUIRED");
      const at = now(); w.check(op.status === "ACTIVE" && s.time(op.notBefore) <= at && at < s.time(op.notAfter), "OPERATOR_AUTH_EXPIRED");
      const session = Object.freeze({operatorId: op.operatorId});
      sessions.set(session, {provider: handle, issuedAt: at, expiresAt: Math.min(at + 300000, s.time(op.notAfter))}); return session;
    }, close() { state.closed = true; }});
  providers.set(handle, state); return handle;
}
function createFixtureAuthProvider({testOnly, identity, privateKey, now = Date.now}) {
  w.check(testOnly === true && privateKey?.type === "private" && privateKey.asymmetricKeyType === "ed25519", "OPERATOR_FIXTURE_ONLY");
  w.check(s.fingerprint(crypto.createPublicKey(privateKey).export({format: "pem", type: "spki"})) === identity.keyFingerprint, "OPERATOR_KEY");
  return createAuthProvider({identity, now, authenticate: input => input?.fixtureUserPresence === true,
    signApproval: v => crypto.sign(null, p.approvalBytes(v), privateKey).toString("base64"),
    signDecision: v => crypto.sign(null, contracts.decisionBytes(v), privateKey).toString("base64")});
}
function authority(provider, session, expected, at) {
  const state = providers.get(provider), grant = sessions.get(session);
  w.check(state && !state.closed && grant?.provider === provider, "OPERATOR_AUTH_REQUIRED");
  contracts.equal(state.identity, expected);
  w.check(grant.issuedAt <= at && at < grant.expiresAt && grant.issuedAt <= state.now() && state.now() < grant.expiresAt, "OPERATOR_AUTH_EXPIRED"); return {state, grant};
}
function createController(options) {
  const {store, provider, source, retention, now = Date.now, confirm, hook = () => {}, nonce = () => crypto.randomBytes(32).toString("hex")} = options;
  w.check(retention && typeof retention.current === "function" && typeof retention.retain === "function", "OPERATOR_RETENTION_REQUIRED");
  const config = p.freeze(structuredClone(options.config)), op = config.operators.find(v => v.operatorId === provider.identity().operatorId);
  w.check(op && typeof confirm === "function", "OPERATOR_CONFIG"); contracts.equal(op, provider.identity());
  const operatorAuthority = p.createOperatorAuthority({operators: config.operators, binding: config.binding});
  operatorAuthority.assertIndependent({signers: [{keyFingerprint: config.witnessIdentity.keyFingerprint}]});
  const witness = w.createVerifier({identity: config.witnessIdentity, vaultId: config.vaultId});
  const publicVerifier = require("./research-qualification-operator-proof").createVerifier({...config, now});
  function auth(session) { return authority(provider, session, op, now()); }
  function audit(action, id, ctx, result, reason) {
    return {operatorId: op.operatorId, requestId: id || null, requestHash: ctx?.requestHash || null, evidenceHash: ctx?.evidenceHash || null,
      action, domain: ctx?.domain || null, environmentId: ctx?.environmentId || config.binding.environmentId, streamId: ctx?.streamId || config.binding.streamId,
      signerId: ctx?.signerId || null, registryRevision: ctx?.registryRevision || null, timestamp: new Date(now()).toISOString(), result, reason};
  }
  async function snapshot(id, requirePending = false) {
    await retention.current();
    c.label(id); const challengeNonce = nonce(); c.digest(challengeNonce);
    const v = structuredClone(await source.snapshot(id, challengeNonce));
    c.shape(v, "candidate,registry,research,issuanceState,history,view,signerAvailable");
    const ctx = contracts.context(v.candidate, v.registry, v.research); w.check(ctx.requestId === id, "OPERATOR_REQUEST_ID");
    contracts.equal(v.candidate.attestation.binding, config.binding);
    w.check(config.registryPins.includes(v.registry.registryHash), "OPERATOR_REGISTRY"); operatorAuthority.assertIndependent(v.registry);
    w.check(v.registry.signers.every(row => row.keyFingerprint !== config.witnessIdentity.keyFingerprint), "OPERATOR_KEY_SEPARATION");
    w.check(Array.isArray(v.history) && v.history.length > 0 && v.history.length <= 10000, "OPERATOR_WITNESS_HISTORY");
    let previous = null;
    for (const h of v.history) { witness.acknowledgment(h.ack, h.entry); w.check(h.ack.body.vaultReceipt.previousHash === previous, "OPERATOR_WITNESS_HISTORY"); previous = h.ack.body.vaultReceipt.receiptHash; }
    const model = require("./research-qualification-witness-state").replay(v.history.map(h => h.entry), {identity: config.witnessIdentity, binding: config.binding, registryPins: config.registryPins, operatorAuthority});
    contracts.equal(model.registry, v.registry);
    witness.freshView(v.view, {storeId: config.storeId, challengeNonce, now: now(), minimumSequence: 1, expectedReceiptHash: model.receiptHash});
    contracts.equal(v.view.body.checkpoint, model.lanes.get(config.storeId)?.checkpoint);
    w.check(v.view.body.sequence === model.sequence && v.view.body.registryHash === ctx.registryHash && v.view.body.registryRevision === ctx.registryRevision, "OPERATOR_WITNESS_VIEW");
    const remoteState = model.requests.get(id)?.state || "ABSENT";
    w.check(v.issuanceState === remoteState, "OPERATOR_STATE_MISMATCH");
    if (requirePending) {
      w.check(v.issuanceState === "ABSENT" && v.signerAvailable === true && store.state(id) === "PENDING", "OPERATOR_NOT_PENDING");
      s.assess(v.candidate.request, v.candidate.attestation, v.registry, config.binding, now());
    }
    return {v, ctx, sequence: model.sequence};
  }
  function reviewBody(ctx) { return {operatorId: op.operatorId, context: ctx, state: "PENDING"}; }
  async function inspect(id) {
    const {v, ctx} = await snapshot(id, true), review = w.seal(reviewBody(ctx), "reviewHash");
    store.review(review, audit("inspect", id, ctx, "REVIEWED", null));
    return {...contracts.summary(v.candidate, v.registry, v.research), state: store.state(id), issuanceState: v.issuanceState, reviewHash: review.reviewHash};
  }
  async function decide(action, id, reviewHash, reason, session) {
    c.digest(reviewHash); const review = store.getReview(reviewHash);
    w.check(review && review.operatorId === op.operatorId && review.context.requestId === id, "OPERATOR_REVIEW_REQUIRED");
    const existing = store.decision(id);
    if (existing) {
      w.check(existing.decision.action === action && existing.decision.reviewHash === reviewHash && existing.decision.reason === reason, "OPERATOR_TERMINAL");
      contracts.verifyDecision(existing, config, existing.decision.decisionHash);
      // Exact durable response recovery only: no second signing or dispatch.
      store.audit(audit((action === "APPROVED" ? "approve" : "deny"), id, review.context, "EXACT_PERSISTED", null)); return await retention.retain(existing);
    }
    const first = await snapshot(id, true); contracts.equal(first.ctx, review.context);
    w.check(!contracts.summary(first.v.candidate, first.v.registry, first.v.research).evidence.omittedInputs, "OPERATOR_FULL_REVIEW_REQUIRED");
    const phrase = `${action === "APPROVED" ? "APPROVE" : "DENY"} ${id} ${first.ctx.requestHash} ${reviewHash}`;
    const response = await confirm({phrase, summary: contracts.summary(first.v.candidate, first.v.registry, first.v.research), action, reason});
    w.check(response === phrase, "OPERATOR_CANCELLED");
    auth(session); const fresh = await snapshot(id, true); auth(session); contracts.equal(fresh.ctx, review.context);
    const {state, grant} = auth(session), at = now(), issuedAt = new Date(at).toISOString(), value = nonce(); c.digest(value);
    w.check(op.domains.includes(fresh.ctx.domain) && op.deploymentIds.includes(fresh.ctx.environmentId) && op.streamIds.includes(fresh.ctx.streamId), "OPERATOR_SCOPE");
    const {request: r, attestation: a} = fresh.v.candidate;
    const body = action === "APPROVED" ? s.seal({version: p.VERSION.approval, operatorId: op.operatorId, scope: "ISSUE_ATTESTATION",
      domain: fresh.ctx.domain, environmentId: fresh.ctx.environmentId, streamId: fresh.ctx.streamId, requestId: id, requestHash: r.requestHash,
      evidenceHash: a.evidenceHash, signerId: r.signerId, registryHash: r.registryHash, runId: a.runId, issuedAt,
      expiresAt: new Date(Math.min(s.time(r.expiresAt), grant.expiresAt, at + 300000)).toISOString(), nonce: value, auditRef: r.operatorRef}, "approvalHash") : null;
    if (body) p.approval(body);
    store.reserve({requestId: id, nonce: value, action, reviewHash}, audit((action === "APPROVED" ? "approve" : "deny"), id, fresh.ctx, "SIGN_ATTEMPT", null));
    hook("before-sign");
    let approval = null;
    if (body) { approval = {approval: body, signature: await state.signApproval(structuredClone(body))}; hook("after-approval-sign"); }
    auth(session); s.assess(r, a, fresh.v.registry, config.binding, now());
    const decision = w.seal({version: contracts.VERSION, storeId: config.operatorStoreId, operatorId: op.operatorId, action, reason,
      context: fresh.ctx, reviewHash, nonce: value, issuedAt, approvalHash: body?.approvalHash || null}, "decisionHash");
    const record = {decision, signature: await state.signDecision(structuredClone(decision)), approval, candidate: fresh.v.candidate, registry: fresh.v.registry};
    auth(session); const final = await snapshot(id); auth(session); contracts.equal(final.ctx, fresh.ctx); w.check(final.v.issuanceState === "ABSENT", "OPERATOR_NOT_PENDING");
    s.assess(r, a, final.v.registry, config.binding, now()); if (approval) operatorAuthority.validate(approval, r, a, final.v.registry, now());
    contracts.verifyDecision(record, config, decision.decisionHash);
    hook("before-decision-commit");
    store.complete(record, audit((action === "APPROVED" ? "approve" : "deny"), id, fresh.ctx, action, reason)); hook("after-persist"); return await retention.retain(record);
  }
  async function execute(command, args, session) {
    let id = null, ctx = null;
    try {
      auth(session); w.check(["pending", "inspect", "approve", "deny", "result", "status"].includes(command), "OPERATOR_COMMAND");
      c.shape(args, command === "approve" ? "requestId,reviewHash" : command === "deny" ? "requestId,reviewHash,reason" : ["inspect", "result"].includes(command) ? "requestId" : "");
      if (args.requestId !== undefined) { c.label(args.requestId); id = args.requestId; }
      if (args.reviewHash) ctx = store.getReview(args.reviewHash)?.context || null;
      if (command === "inspect") return await inspect(id);
      if (["approve", "deny"].includes(command)) {
        if (command === "deny") w.check(contracts.REASONS.includes(args.reason), "OPERATOR_REASON");
        return await decide(command === "approve" ? "APPROVED" : "DENIED", id, args.reviewHash, command === "deny" ? args.reason : null, session);
      }
      if (command === "result") {
        const record = store.decision(id); w.check(record?.decision.action === "APPROVED", "OPERATOR_RESULT_UNAVAILABLE"); ctx = record.decision.context;
        const current = await snapshot(id); contracts.equal(current.ctx, ctx); w.check(current.v.issuanceState === "COMPLETED", "OPERATOR_RESULT_INCOMPLETE");
        const challengeNonce = nonce(), bundle = await source.result(id, record.approval, challengeNonce);
        const proof = {version: "KRONOS_OPERATOR_PUBLIC_PROOF_V1", decision: record, issuance: bundle};
        publicVerifier.verify(proof, {expectedDecisionHash: record.decision.decisionHash, challengeNonce, minimumSequence: current.sequence, expectedDomain: ctx.domain});
        store.audit(audit(command, id, ctx, "COMPLETED", null)); return proof;
      }
      const ids = await source.pending(26); w.check(Array.isArray(ids) && ids.length <= 26 && new Set(ids).size === ids.length, "OPERATOR_PENDING_LIMIT");
      const rows = [];
      for (const requestId of ids.slice(0, 25)) { c.label(requestId); const row = await snapshot(requestId); if (store.state(requestId) === "PENDING" && row.v.issuanceState === "ABSENT") rows.push({...row.ctx, state: "PENDING", issuanceState: "ABSENT"}); }
      const counts = store.counts();
      const result = command === "pending" ? {requests: rows, limit: 25, hasMore: ids.length > 25} : {journal: "HEALTHY", witness: ids.length > 0 ? "VERIFIED" : "UNOBSERVED", freshViewValid: ids.length > 0, pendingCount: rows.length, countIsLowerBound: ids.length > 25, recoveryRequiredCount: counts.attempts - store.retained().length, operatorAuthAvailable: provider.available(), signerAvailable: (await source.available()) === true, simulated: true, automaticCollectionReady: false, offDiskVerified: false};
      store.audit(audit(command, null, null, "READ", null)); return result;
    } catch (error) {
      // Never reflect arbitrary provider errors, tokens, evidence blobs or paths.
      store.audit(audit(["pending", "inspect", "approve", "deny", "result", "status"].includes(command) ? command : "invalid", id, ctx, "REFUSED", "VALIDATION_FAILED"));
      throw Object.assign(new Error("OPERATOR_REFUSED"), {code: "OPERATOR_REFUSED"});
    }
  }
  return Object.freeze({execute});
}
module.exports = {createAuthProvider, createFixtureAuthProvider, createController};
