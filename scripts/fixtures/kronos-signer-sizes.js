"use strict";
const f=require("./kronos-qualified-evidence"),{canonicalize}=require("../../kronos/research-canonical");
function make(kind,profile="typical") {
  const domain=kind.includes("restore")?"restore":kind;
  const a=f.attestation(domain,domain==="restore"?f.restoreEvidence(kind!=="limited-restore",kind==="independent-restore"):undefined);
  const b=a.binding,e=a.evidence;
  if(profile==="minimum") {
    b.bucket="aaa";b.streamId="aaa";b.softwareRevision=b.deploymentRevision=b.runtimeRevision="a";a.runId="a";
    b.containerRef="s3-"+f.hashValue({bucket:b.bucket,region:b.region,owner:b.expectedOwner}).slice(0,32);
    const rows=domain==="provider"?[e.input]:domain==="restore"?e.inputs:[];
    for(const row of rows){row.objectKey="pti/fixture/aaa/a";row.versionId="a";row.sizeBytes=1;}
  }
  if(["maximum","worst"].includes(profile)) {
    b.bucket="b".repeat(63);b.streamId="s".repeat(64);
    b.softwareRevision=b.deploymentRevision=b.runtimeRevision=a.runId="r".repeat(128);
    b.containerRef="s3-"+f.hashValue({bucket:b.bucket,region:b.region,owner:b.expectedOwner}).slice(0,32);
    const rows=domain==="provider"?[e.input]:domain==="restore"?Array.from({length:16},()=>structuredClone(e.inputs[0])):[];
    rows.forEach((row,i)=>{const prefix="pti/fixture/"+b.streamId+"/"+i+"/";row.objectKey=prefix+(profile==="worst"?"界":"k").repeat(1024-prefix.length);row.versionId=(profile==="worst"?'"':"v").repeat(1024);row.sizeBytes=128*1024*1024;row.artifactType="snapshot-chunk";});
    if(domain==="restore"){e.inputs=rows;for(const k of Object.keys(e.actualCounts))if(e.actualCounts[k])e.actualCounts[k]=e.expectedCounts[k]=Number.MAX_SAFE_INTEGER;}
    if(domain==="runtime"){e.freeBytes=Number.MAX_SAFE_INTEGER;e.requiredStagingBytes=1000000000;}
  }
  if(domain==="provider") {
    e.conditionalCreation.versionId=e.input.versionId;e.exactReadback={versionId:e.input.versionId,sha256:e.input.artifactSha256,sizeBytes:e.input.sizeBytes,logicalHash:e.input.logicalHash};
    e.idempotency.versionId=e.input.versionId;e.versionHistory.before=e.versionHistory.after=[e.input.versionId];
  }
  f.rehash(a);
  if(profile==="worst") {
    // Deliberately adversarial accepted version strings fill the existing character budget.
    // This is a contract stress case, not a realistic installed Node version.
    let low=3,high=65536,best=structuredClone(a);
    while(low<=high){const mid=(low+high)>>1;const test=structuredClone(a);test.binding.nodeVersion="24."+"9".repeat(mid)+".0";
      if(domain==="runtime")test.evidence.nodeVersion=test.binding.nodeVersion;f.rehash(test);
      try{f.contracts.validateAttestation(test);best=test;low=mid+1;}catch{high=mid-1;}
    }
    f.contracts.validateAttestation(best);return best;
  }
  f.contracts.validateAttestation(a);return a;
}
function measurements(){
  return ["provider","runtime","limited-restore","full-restore","independent-restore"].map(kind=>{
    const result={kind};for(const profile of ["minimum","typical","maximum","worst"]){const a=make(kind,profile);result[profile]={bytes:f.contracts.signingBytes(a).length,canonicalCharacters:canonicalize(a).length,kmsFits:f.contracts.signingBytes(a).length<=4096};}return result;
  });
}
module.exports={make,measurements};
