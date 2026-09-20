"use strict";
const assert=require("node:assert/strict"),guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
try {
  const f=require("./fixtures/kronos-qualified-evidence"),s=f.setup();
  for(const domain of ["provider","runtime","restore"]) {
    const a=s.accept(domain);assert.equal(a.attestationType,f.contracts.TYPES[domain]);assert.equal(Object.hasOwn(a,"simulated"),false);
    assert.throws(()=>s.authority.accept(f.contracts.simulated(domain,{fixture:true,value:"fixture"})));
    assert.throws(()=>f.contracts.simulated(domain,a));
    assert.throws(()=>f.contracts.simulated(domain,{fixture:true,value:a}));
    const trustedClaim=f.attestation(domain);trustedClaim.trusted=true;assert.throws(()=>s.authority.accept(f.sign(trustedClaim)));
    for(const secret of [{credentials:"FAKE"},{Authorization:"FAKE"},{sessionToken:"FAKE"},{cookie:"FAKE"},{environmentDump:{}},{sourcePath:"C:\\private\\fixture"},{url:"https://example.invalid/?X-Amz-Signature=fake"}]) {
      const bad=f.attestation(domain);Object.assign(bad.evidence,secret);assert.throws(()=>s.authority.accept(f.sign(f.rehash(bad))));
    }
  }
  function reject(domain,edit) {const a=f.attestation(domain);edit(a);assert.throws(()=>s.authority.accept(f.sign(f.rehash(a))));}
  for(const name of ["exactReadback","observedRetention","idempotency","encryption","conditionalCreation"])
    reject("provider",a=>delete a.evidence[name]);
  for(const edit of [
    a=>a.evidence.input.versionId="",a=>a.evidence.exactReadback.sha256="0".repeat(64),
    a=>a.evidence.observedRetention.mode="COMPLIANCE",a=>a.evidence.versionHistory.after.push("second"),
    a=>a.evidence.idempotency.newVersions=1,a=>a.evidence.encryption="aws:kms",
    a=>a.evidence.conditionalCreation.ifNoneMatch=null,a=>a.evidence.versionHistory.deleteMarkers=1
  ]) reject("provider",edit);
  for(const name of ["sqliteAvailable","backupAvailable","persistentDataDir","filesystemWrite","writerLock","fsync","atomicRename"])
    reject("runtime",a=>a.evidence[name]=false);
  reject("runtime",a=>a.evidence.processCount=2);reject("runtime",a=>a.evidence.freeBytes=1);
  reject("runtime",a=>a.evidence.nodeVersion="24.18.0");reject("runtime",a=>a.evidence.sqliteVersion="3.49.0");
  for(const name of ["relationshipsMatch","provenanceMatch","sourceRemoved","remoteOnly"]) reject("restore",a=>a.evidence[name]=false);
  reject("restore",a=>a.evidence.localCacheFallback=true);reject("restore",a=>a.evidence.result="FAIL");
  reject("restore",a=>a.evidence.actualStateHash="0".repeat(64));reject("restore",a=>a.evidence.inputs[0].versionId="");
  reject("restore",a=>a.evidence.coverage=["forecast"]);reject("restore",a=>a.evidence.actualCounts.forecasts=1);
  // Unknown nested fields and credential-looking values in otherwise allowed fields are also rejected.
  reject("provider",a=>a.evidence.input.versionId="ASIA"+"A".repeat(16));
  reject("provider",a=>a.evidence.input.versionId="https://x.invalid/?X-Amz-Signature=fake");
  guard.assertClean();console.log("Real provider/runtime/restore contracts, observed consistency, explicit allowlists and secret exclusion: PASS");
} finally {guard.restore();}
