"use strict";
const networkGuard = require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
const assert = require("node:assert/strict"), crypto = require("node:crypto"), path = require("node:path");
const t = require("./fixtures/kronos-native-evidence");
const {journalEvents} = require("../kronos/research-qualification-native-proofs");
function denied(mutate, options = {}) {
  const root = t.temp(), fixture = options.fixture || t.setup(); let x;
  try {
    x = t.open(root, {...options, fixture}); const data = structuredClone(fixture.data); mutate(data, x);
    assert.throws(() => x.signer.issue(data)); assert.equal(x.keys.metrics().signCalls, 0);
    assert.equal(journalEvents(path.join(root, "signer.sqlite")).length, 1);
  } finally { if (x) x.close(); t.remove(root); }
}
denied(d => { delete d.approval; });
for (const [field, value] of [["operatorId", "wrong"], ["domain", "runtime"], ["environmentId", "production"], ["streamId", "other"], ["evidenceHash", "a".repeat(64)], ["requestHash", "b".repeat(64)], ["signerId", "runtime"], ["expiresAt", t.f.t.iso(t.f.t.f.time - 1)]]) {
  denied(d => { const body = {...d.approval.approval, [field]: value}; if (field === "expiresAt") body.issuedAt = t.f.t.iso(t.f.t.f.time - 1000); d.approval = t.f.signApproval(body); });
}
denied(d => { d.approval.signature = Buffer.alloc(64).toString("base64"); });
denied(d => { d.request.serviceIdentity = "caller-only"; d.request = t.f.t.rehash(d.request, "requestHash"); d.approval = t.f.approved(d.request, d.attestation); });
denied(d => { d.request.nonce = "a".repeat(64); });
denied(d => { d.attestation.evidenceHash = "b".repeat(64); });
denied((d, x) => x.keys.close());
for (const mutate of [rows => rows.filter(r => r.signerId !== "provider"), rows => rows.map(r => r.signerId === "provider" ? {...r, domain: "runtime"} : r)]) {
  const provider = t.native.createFixtureKeyProvider({testOnly: true, keys: mutate(t.keyRows())}); denied(() => {}, {provider});
}
for (const status of ["RETIRED", "REVOKED", "EXPIRED"]) {
  const fixture = t.setup({mutateRegistry(reg) { const row = reg.signers[0];
    if (status === "EXPIRED") row.notAfter = t.f.t.iso(t.f.t.f.time - 1);
    else { row.status = status; row[status === "RETIRED" ? "retiredAt" : "revokedAt"] = reg.createdAt; if (status === "REVOKED") row.revocationReasonCode = "ADMINISTRATIVE"; }
    return reg; }});
  denied(() => {}, {fixture});
}
// An untrusted caller's own signature cannot replace the pinned operator's approval.
denied(d => { d.approval.signature = crypto.sign(null, t.f.p.approvalBytes(d.approval.approval), t.f.t.f.keys.provider.privateKey).toString("base64"); });
for (const secret of ["privateKey", "AWS_SECRET_ACCESS_KEY", "SessionToken", "OIDC_TOKEN", "Authorization", "LOGIN_PIN", "ADMIN_PIN", "KRONOS_SERVICE_TOKEN", "cookies", "environment"]) denied(d => { d[secret] = "forbidden"; });
// Cross-request approval-nonce reuse cannot create another reservation/signature.
{
  const root = t.temp(); let x;
  try { x = t.open(root); const data = x.fixture.data; x.signer.issue(data);
    const other = structuredClone(data); other.request.requestId = "another-request"; other.request.nonce = "e".repeat(64); other.request = t.f.t.rehash(other.request, "requestHash");
    other.approval = t.f.approved(other.request, other.attestation); other.approval = t.f.signApproval({...other.approval.approval, nonce: data.approval.approval.nonce});
    assert.throws(() => x.signer.issue(other)); assert.equal(x.keys.metrics().signCalls, 2);
    const altered = structuredClone(data); altered.approval = t.f.signApproval({...altered.approval.approval, nonce: "f".repeat(64)});
    assert.throws(() => x.signer.get(altered));
  } finally { if (x) x.close(); t.remove(root); }
}
// Native signature corruption is detected before envelope persistence.
{
  const root = t.temp(), original = crypto.sign; let x;
  try { x = t.open(root); crypto.sign = (algorithm, bytes, key) => key === t.f.t.f.keys.provider.privateKey ? Buffer.alloc(64) : original(algorithm, bytes, key);
    assert.throws(() => x.signer.issue(x.fixture.data)); assert.equal(x.signer.status(x.fixture.data.request.requestId).state, "RESERVED");
  } finally { crypto.sign = original; if (x) x.close(); t.remove(root); }
}
console.log("Native dual authorization, key lifecycle/failures, nonce replay, self-certification, secret rejection and signature-before-persistence: PASS");

networkGuard.assertClean(); networkGuard.restore();
