"use strict";
const assert=require("node:assert/strict"),guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
try {
  const f=require("./fixtures/kronos-qualified-evidence"),s=f.setup(),a=s.authority;
  const provider=s.accept("provider"),runtime=s.accept("runtime"),restore=s.accept("restore");
  const record=a.build({provider,runtime,restore});assert.equal(a.verify(record,f.binding).trusted,true);assert.equal(a.verify(record).trusted,false);
  assert.equal(a.verify({...record},f.binding).trusted,false);assert.equal(a.verify(JSON.parse(JSON.stringify(record)),f.binding).trusted,false);
  assert.throws(()=>a.build({provider:{...provider},runtime,restore}));
  assert.throws(()=>a.build({provider:f.setup().accept("provider"),runtime,restore}));
  assert.equal(f.setup().authority.verify(record,f.binding).trusted,false);
  const modified=f.sign(f.attestation("provider"));modified.attestation.evidence.input.sizeBytes++;assert.throws(()=>a.accept(modified));
  const badHash=f.sign(f.attestation("runtime"));badHash.attestation.attestationHash="0".repeat(64);assert.throws(()=>a.accept(badHash));
  const fake=f.sign(f.attestation("provider"));fake.signature=Buffer.alloc(64).toString("base64");assert.throws(()=>a.accept(fake));
  const foreign=f.sign(f.attestation("provider"));foreign.issuerId="unknown";assert.throws(()=>a.accept(foreign));
  assert.throws(()=>a.accept(f.sign(f.attestation("provider"),"runtime")));
  for(const field of ["bucket","containerRef","environmentId","streamId","region","expectedOwner","softwareRevision","deploymentRevision","runtimeRevision","adapterVersion","nodeVersion","sqliteVersion","storagePolicyHash","retentionPolicyHash","qualificationPolicyVersion"]) {
    const bad=f.attestation("provider");bad.binding[field]=field.endsWith("Hash")?"0".repeat(64):"wrong";
    assert.throws(()=>a.accept(f.sign(f.rehash(bad))),field);
    assert.equal(a.verify(record,{...f.binding,[field]:"wrong"}).trusted,false,field);
  }
  for(const slot of ["provider","runtime","restore"]) {
    const components={provider,runtime,restore};components[slot]=f.contracts.simulated(slot,{fixture:true,value:"test"});
    assert.throws(()=>a.build(components));
  }
  const otherRun=f.attestation("restore");otherRun.runId="different-run";const accepted=a.accept(f.sign(f.rehash(otherRun)));
  assert.throws(()=>a.build({provider,runtime,restore:accepted}));
  const otherVersion=f.attestation("restore");otherVersion.evidence.inputs[0].versionId="other-version";
  assert.throws(()=>a.build({provider,runtime,restore:a.accept(f.sign(f.rehash(otherVersion)))}));
  assert.ok(Object.isFrozen(provider.evidence.input));assert.throws(()=>{provider.evidence.input.sizeBytes=4;});
  // Durable evidence can be reauthenticated; serialized final records cannot self-establish authority.
  const next=f.setup(),p=next.authority.accept(JSON.parse(JSON.stringify(f.sign(f.attestation("provider")))));
  assert.equal(next.authority.verify(next.authority.build({provider:p}),f.binding).trusted,true);
  guard.assertClean();console.log("Pinned Ed25519 domain authority, binding, signature/hash tampering, foreign/copied/mixed-run and simulated spoof rejection: PASS");
} finally {guard.restore();}
