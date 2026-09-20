"use strict";
const assert=require("node:assert/strict"),guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
try {
  const t=require("./fixtures/kronos-signer-evidence"),{s,f}=t;
  const x=t.setup(),e=x.envelopes.provider;
  assert.equal(x.verifier.verifyIndependent(x.envelopes.restore,x.envelopes.independent).trusted,true);
  assert.equal(x.verifier.verifyIndependent(x.envelopes.restore,x.envelopes.restore).trusted,false);
  // Application evidence and locally held fictional foreign keys cannot mint accepted signatures.
  assert.equal(x.verifier.verify({attestation:e.attestation,trusted:true}).trusted,false);
  const foreign=t.signed(e.attestation,e.request,x.reg,"runtime");
  assert.equal(x.verifier.verify(foreign).trusted,false);
  for(const edit of [
    a=>a.signerId="unknown",a=>a.publicKey=f.keys.runtime.publicKey,
    a=>a.signature=Buffer.alloc(64).toString("base64"),a=>a.contextSignature=Buffer.alloc(64).toString("base64"),
    a=>a.attestation.evidence.input.sizeBytes++,a=>a.request.operatorRef="other",
    a=>a.signedAt=t.iso(f.time+1),a=>a.request.serviceIdentity="other-service"
  ]) {const bad=t.clone(e);edit(bad);assert.equal(x.verifier.verify(t.rehash(bad,"envelopeHash")).trusted,false);}
  const unregistered=t.clone(x.reg);unregistered.signers=unregistered.signers.filter(s=>s.signerId!=="provider");
  const otherReg=t.rehash(unregistered,"registryHash");
  assert.equal(t.createPinnedVerifier({...t.pins(otherReg,x.j),binding:f.binding,now:()=>f.time}).verify(e).trusted,false);
  assert.throws(()=>t.createPinnedVerifier({...t.pins(x.reg,x.j),registryPin:{hash:"0".repeat(64),revision:1},binding:f.binding}));
  assert.throws(()=>t.createPinnedVerifier({...t.pins(x.reg,x.j),journalPin:{hash:"0".repeat(64),revision:1},binding:f.binding}));
  const empty=t.journal();assert.equal(t.createPinnedVerifier({...t.pins(x.reg,empty),binding:f.binding,now:()=>f.time}).verify(e).trusted,false);
  for(const status of ["RETIRED","REVOKED"]) {
    const y=t.setup(),r=t.clone(y.reg),when=f.time+60000;r.registryRevision=2;r.createdAt=t.iso(when);
    r.signers[0].status=status;
    if(status==="RETIRED")r.signers[0].retiredAt=t.iso(when);
    else {r.signers[0].revokedAt=t.iso(when);r.signers[0].revocationReasonCode="COMPROMISE";}
    const next=t.rehash(r,"registryHash");y.at(when);y.verifier.replaceTrust(t.pins(next,y.j));
    assert.equal(y.verifier.verify(y.envelopes.provider).trusted,status==="RETIRED");
    const a=y.envelopes.provider.attestation,req=t.request(a,next);
    assert.throws(()=>s.assess(req,a,next,f.binding,when),{code:status==="RETIRED"?"SIGNER_RETIRED":"SIGNER_REVOKED"});
    assert.throws(()=>y.verifier.replaceTrust(t.pins(y.reg,y.j)),{code:"REGISTRY_MISMATCH"});
    const resurrect=t.clone(next);resurrect.registryRevision++;resurrect.signers[0].status="ACTIVE";
    resurrect.signers[0].retiredAt=null;resurrect.signers[0].revokedAt=null;resurrect.signers[0].revocationReasonCode=null;
    assert.throws(()=>s.rotation(next,t.rehash(resurrect,"registryHash")));
  }
  // Successful overlap and retirement retain historical receipts, never migrate old signatures.
  const rotating=t.setup(),next=t.clone(rotating.reg);next.registryRevision=2;
  const replacement=t.clone(next.signers[0]);replacement.signerId="provider-next";
  replacement.issuer="fictional-operator-provider-next";replacement.publicKey=t.extraKey.publicKey;
  replacement.keyFingerprint=s.fingerprint(replacement.publicKey);
  replacement.allowedServiceIdentities=["fictional-observer-provider-next"];next.signers.push(replacement);
  const reg2=t.rehash(next,"registryHash");s.rotation(rotating.reg,reg2);
  const req2=t.request(e.attestation,reg2,"provider-next");s.assess(req2,e.attestation,reg2,f.binding,f.time);
  const signed2=t.signed(e.attestation,req2,reg2,"provider-next");
  let journal2=s.reserve(rotating.j,req2,e.attestation,f.time);journal2=s.complete(journal2,req2,t.receipt(signed2),f.time);
  rotating.verifier.replaceTrust(t.pins(reg2,journal2));assert.equal(rotating.verifier.verify(signed2).trusted,true);
  const retired=t.clone(reg2);retired.registryRevision=3;retired.createdAt=t.iso(f.time+1000);
  retired.signers[0].status="RETIRED";retired.signers[0].retiredAt=retired.createdAt;
  retired.signers[0].replacementSignerId="provider-next";
  rotating.at(f.time+1000);rotating.verifier.replaceTrust(t.pins(t.rehash(retired,"registryHash"),journal2));
  assert.equal(rotating.verifier.verify(rotating.envelopes.provider).trusted,true);
  assert.equal(rotating.verifier.verify(signed2).trusted,true);
  const stolen=t.signed(e.attestation,e.request,x.reg,"provider-next");
  assert.equal(x.verifier.verify(stolen).trusted,false);
  const expired=t.clone(x.reg);expired.signers[0].notAfter=f.instant;
  const expiredRegistry=t.rehash(expired,"registryHash");
  assert.throws(()=>s.assess(t.request(e.attestation,expiredRegistry),e.attestation,expiredRegistry,f.binding,f.time),{code:"SIGNER_EXPIRED"});
  const duplicate=t.clone(x.reg);duplicate.signers[3].publicKey=duplicate.signers[2].publicKey;duplicate.signers[3].keyFingerprint=duplicate.signers[2].keyFingerprint;
  assert.throws(()=>s.registry(t.rehash(duplicate,"registryHash")),{code:"DOMAIN_NOT_ALLOWED"});
  const sameIssuer=t.clone(x.reg);sameIssuer.signers[3].issuer=sameIssuer.signers[2].issuer;
  const same=t.rehash(sameIssuer,"registryHash");const sameSetup=t.setup(same);
  assert.equal(sameSetup.verifier.verify(sameSetup.envelopes.restore).trusted,true);
  assert.equal(sameSetup.verifier.verify(sameSetup.envelopes.independent).trusted,true);
  assert.equal(sameSetup.verifier.verifyIndependent(sameSetup.envelopes.restore,sameSetup.envelopes.independent).trusted,false);
  // Registry identity changes cannot silently rebind already issued envelopes.
  assert.equal(t.createPinnedVerifier({...t.pins(same,x.j),binding:f.binding,now:()=>f.time}).verify(e).trusted,false);
  const newKey=t.clone(x.reg);newKey.registryRevision++;newKey.signers[0].publicKey=f.keys.runtime.publicKey;
  newKey.signers[0].keyFingerprint=s.fingerprint(newKey.signers[0].publicKey);assert.throws(()=>s.rotation(x.reg,t.rehash(newKey,"registryHash")));
  const erased=t.clone(x.j);erased.revision++;erased.entries=[];assert.throws(()=>s.journalSuccessor(x.j,t.rehash(erased,"journalHash")));
  x.at(f.time+86400000);assert.equal(x.verifier.verify(e).trusted,false);
  guard.assertClean();console.log("Pinned verification, both signatures, foreign keys, spoof/replay journal, retirement/history, compromise revocation, rollback/rotation and independent-role isolation: PASS");
} finally {guard.restore();}
