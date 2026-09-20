"use strict";
const assert=require("node:assert/strict"),guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
try {
  const f=require("./fixtures/kronos-qualified-evidence"),s=f.setup(),a=s.authority;
  const provider=s.accept("provider"),runtime=s.accept("runtime"),restore=s.accept("restore");
  const mechanics=a.build({provider});assert.equal(mechanics.providerState,"S3_MECHANICS_QUALIFIED");assert.equal(mechanics.storageState,"INCOMPLETE");
  const partial=a.build({provider,runtime,restore});
  assert.equal(partial.state,"PARTIALLY_QUALIFIED");assert.equal(partial.restoreState,"REMOTE_RESTORE_PARTIAL");
  assert.deepEqual(partial.coverage,["transaction","audit","outbox"]);assert.deepEqual(partial.missingCoverage,["forecast","correction","outcome"]);
  for(const scope of partial.missingCoverage)assert.ok(partial.reasons.includes("RESTORE_SCOPE_MISSING:"+scope));
  const claimed=f.restoreEvidence();for(const k of ["forecast","correction","outcome"])claimed.scopeEvidence[k]=f.hashValue(k);
  assert.deepEqual(a.build({provider,runtime,restore:s.accept("restore",claimed)}).missingCoverage,["forecast","correction","outcome"]);
  const fullRestore=s.accept("restore",f.restoreEvidence(true));
  const withoutIndependent=a.build({provider,runtime,restore:fullRestore});
  assert.equal(withoutIndependent.storageState,"INCOMPLETE");assert.ok(withoutIndependent.reasons.includes("INDEPENDENT_EXERCISE_REQUIRED"));
  const independent=a.accept(f.sign(f.attestation("restore",f.restoreEvidence(true,true)),"independent"));
  const full=a.build({provider,runtime,restore:fullRestore,independentRestore:independent});
  assert.equal(full.state,"QUALIFIED");assert.equal(full.storageState,"FULL_STORAGE_QUALIFIED");assert.equal(full.productionReady,false);
  const sameIssuer=a.accept(f.sign(f.attestation("restore",f.restoreEvidence(true,true))));
  assert.throws(()=>a.build({provider,runtime,restore:fullRestore,independentRestore:sameIssuer}));
  const weeklyEvidence=f.restoreEvidence(true);weeklyEvidence.exerciseKind="WEEKLY";const weekly=s.accept("restore",weeklyEvidence);
  assert.ok(a.build({provider,runtime,restore:weekly,independentRestore:independent}).reasons.includes("INITIAL_DRILL_REQUIRED"));
  assert.equal(a.build({provider,runtime,restore:weekly,independentRestore:independent,initialRestore:fullRestore}).state,"QUALIFIED");
  s.advance(3600000);assert.equal(a.verify(full,f.binding).trusted,false);assert.throws(()=>a.build({provider,runtime,restore}));
  for(const domain of ["provider","runtime","restore"]) {
    const t=f.setup(),expired=f.attestation(domain);expired.observedAt="2026-09-19T16:00:00.000Z";expired.expiresAt=f.instant;
    if(domain==="restore")expired.evidence.startedAt=expired.evidence.completedAt=expired.observedAt;
    assert.throws(()=>t.authority.accept(f.sign(f.rehash(expired))));
  }
  const future=f.attestation("runtime");future.observedAt=new Date(f.time+1000).toISOString();future.expiresAt=new Date(f.time+2000).toISOString();
  assert.throws(()=>f.setup().authority.accept(f.sign(f.rehash(future))));
  const old=f.attestation("restore");old.evidence.startedAt=old.evidence.completedAt=new Date(f.time-9*86400000).toISOString();
  assert.throws(()=>f.setup().authority.accept(f.sign(f.rehash(old))));
  const independentOld=f.attestation("restore",f.restoreEvidence(true,true));independentOld.evidence.startedAt=independentOld.evidence.completedAt=new Date(f.time-93*86400000).toISOString();
  assert.throws(()=>f.setup().authority.accept(f.sign(f.rehash(independentOld),"independent")));
  assert.equal(f.POLICY.weeklyDrillDueMs,7*86400000);assert.equal(f.POLICY.restoreMaxAgeMs,8*86400000);assert.equal(f.POLICY.independentMaxAgeMs,92*86400000);
  guard.assertClean();console.log("Limited Phase-4 coverage, explicit mechanics/partial/full states, independent authority and freshness expiry: PASS");
} finally {guard.restore();}
