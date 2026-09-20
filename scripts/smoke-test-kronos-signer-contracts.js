"use strict";
const assert=require("node:assert/strict"),guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
try {
  const t=require("./fixtures/kronos-signer-evidence"),{s,f}=t,x=t.setup();
  for(const id of ["provider","runtime","restore","independent"]) {
    const e=x.envelopes[id]; assert.equal(x.verifier.verify(e).trusted,true);
    assert.deepEqual(s.assess(e.request,e.attestation,x.reg,f.binding,f.time),{eligible:true,authorized:false});
    assert.throws(()=>s.reserve(x.j,e.request,e.attestation,f.time),{code:"SIGNING_REQUEST_REPLAY"});
    const altered=t.clone(e.request);altered.requestId+="other";altered.requestHash=t.rehash(altered,"requestHash").requestHash;
    assert.throws(()=>s.reserve(x.j,altered,e.attestation,f.time),{code:"SIGNING_REQUEST_REPLAY"});
  }
  for(const [field,value,code] of [["environmentId","production","ENVIRONMENT_NOT_ALLOWED"],["streamId","foreign-stream","STREAM_NOT_ALLOWED"],["softwareRevision","foreign-revision","POLICY_MISMATCH"]]) {
    const a=f.attestation("runtime");a.binding[field]=value;f.rehash(a);
    assert.throws(()=>s.assess(t.request(a,x.reg),a,x.reg,a.binding,f.time),{code});
  }
  const domainRequest=t.request(x.envelopes.provider.attestation,x.reg,"runtime");
  assert.throws(()=>s.assess(domainRequest,x.envelopes.provider.attestation,x.reg,f.binding,f.time),{code:"DOMAIN_NOT_ALLOWED"});
  const e=x.envelopes.provider;
  for(const edit of [
    r=>r.signerId="runtime",r=>r.signerId="unknown",r=>r.expiresAt=t.iso(f.time+300001),
    r=>r.binding.environmentId="production",r=>r.binding.streamId="foreign-stream",
    r=>r.binding.softwareRevision="foreign-revision",r=>r.registryHash="0".repeat(64),
    r=>r.canonicalEvidenceHash="0".repeat(64),r=>r.runId="other-run",r=>r.serviceIdentity="other-service"
  ]) { const r=t.clone(e.request);edit(r);assert.throws(()=>s.assess(t.rehash(r,"requestHash"),e.attestation,x.reg,f.binding,f.time)); }
  assert.throws(()=>s.assess(e.request,e.attestation,x.reg,f.binding,f.time+300000),{code:"SIGNING_REQUEST_EXPIRED"});
  for(const field of ["encryption","observedRetention","exactReadback"]) {
    const a=t.clone(e.attestation);delete a.evidence[field];f.rehash(a);
    assert.throws(()=>s.assess(t.request(a,x.reg),a,x.reg,f.binding,f.time));
  }
  for(const id of ["runtime","restore"]) {
    const a=t.clone(x.envelopes[id].attestation);
    if(id==="runtime")a.evidence.fsync=false;else a.evidence.result="FAIL";
    f.rehash(a);assert.throws(()=>s.assess(t.request(a,x.reg),a,x.reg,f.binding,f.time));
  }
  const limited=f.attestation("restore",f.restoreEvidence(false,true));
  assert.throws(()=>s.assess(t.request(limited,x.reg,"independent"),limited,x.reg,f.binding,f.time));
  for(const field of ["privateKey","credentials","LOGIN_PIN","ADMIN_PIN","KRONOS_SERVICE_TOKEN","cookie","Authorization","environmentDump","sourcePath"]) {
    for(const [value,validate] of [[e.request,r=>s.request(r,e.attestation)],[e,s.envelope],[t.receipt(e),s.receipt]]) {
      const bad=t.clone(value);bad[field]="fictional-secret";assert.throws(()=>validate(bad));
    }
    const bad=t.clone(x.reg);bad.signers[0][field]="fictional-secret";assert.throws(()=>s.registry(t.rehash(bad,"registryHash")));
  }
  const badPem=t.clone(x.reg);badPem.signers[0].publicKey="-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----";
  assert.throws(()=>s.registry(t.rehash(badPem,"registryHash")));
  const rejected=t.receipt(e);rejected.result="REJECTED";rejected.signedEnvelopeHash=null;rejected.reason="SIGNER_UNAVAILABLE";
  s.receipt(t.rehash(rejected,"receiptHash"));rejected.reason="raw provider error";assert.throws(()=>s.receipt(t.rehash(rejected,"receiptHash")));
  assert.equal(s.normalized(new Error("raw secret provider error")),"EVIDENCE_INVALID");
  const fresh=t.journal(),reserved=s.reserve(fresh,e.request,e.attestation,f.time);
  const finished=s.complete(reserved,e.request,t.receipt(e),f.time);
  assert.throws(()=>s.complete(finished,e.request,t.receipt(e),f.time),{code:"SIGNING_REQUEST_REPLAY"});
  assert.throws(()=>s.reserve(reserved,e.request,e.attestation,f.time),{code:"SIGNING_REQUEST_REPLAY"});
  guard.assertClean();console.log("Signer schemas, validation before signing, no implicit authorization, one-time IDs/nonces, failed receipts and secret exclusion: PASS");
} finally {guard.restore();}
