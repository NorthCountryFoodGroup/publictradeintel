"use strict";
const assert=require("node:assert/strict"),guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork(),f=require("./fixtures/kronos-s3-mock"),{createS3Adapter}=require("../kronos/research-backup-s3"),{hashValue}=require("../kronos/research-hash");
function attest(kind,containerRef){const body={kind,...f.context,containerRef,passed:true,simulated:true,id:`fixture-${kind}`};return {...body,hash:hashValue(body)};}
async function main(){
 const mock=f.mockS3(),provider=createS3Adapter(f.config,{transport:mock,now:()=>Date.parse(f.instant)}),evidence=await provider.collectQualificationEvidence(f.artifact()),containerRef=provider.capabilities().containerRef;
 const input={runtime:attest("RUNTIME",containerRef),drill:attest("RESTORE",containerRef),expiresAt:"2026-09-30T00:00:00.000Z"},qualified=provider.qualificationRecord(evidence,input);
 assert.equal(qualified.record.qualificationVersion,"KRONOS_PROVIDER_QUALIFICATION_V2");assert.equal(qualified.simulated,true);assert.equal(qualified.productionQualified,false);assert.equal(qualified.status.productionReady,false);assert.equal(qualified.runtimeQualified,false);
 assert.throws(()=>provider.qualificationRecord({...evidence},input));assert.throws(()=>provider.qualificationRecord({providerType:"s3",qualified:true},input));
 for(const name of ["runtime","drill"])assert.throws(()=>provider.qualificationRecord(evidence,{...input,[name]:undefined}));
 for(const [name,value] of [["versioning","Disabled"],["versioning","Suspended"],["lock",undefined],["encryption","aws:kms"],["encryption",undefined],["owner","111111111111"]]){const bad=f.mockS3();bad.state[name]=value;const p=createS3Adapter(f.config,{transport:bad,now:()=>Date.parse(f.instant)});await assert.rejects(()=>p.collectQualificationEvidence(f.artifact()));}
 for(const scenario of ["ignoreConditional","missingVersion","shortRetention","getUnavailable","corrupt","namespace","secret"]){const bad=f.mockS3(),p=createS3Adapter(f.config,{transport:bad,now:()=>Date.parse(f.instant)});
  if(scenario==="ignoreConditional")bad.state.ignoreConditional=true;
  if(scenario==="missingVersion")bad.inject("PutObject",()=>({VersionId:"null"}));
  if(scenario==="getUnavailable")bad.inject("GetObject",f.aws("NoSuchVersion",404));
  if(scenario==="shortRetention")bad.inject("GetObjectRetention",()=>({Retention:{Mode:f.required.mode,RetainUntilDate:new Date(f.instant)}}));
  if(["corrupt","namespace","secret"].includes(scenario)){const original=bad.send;let changed=false;bad.send=async(command,options)=>{const result=await original(command,options);if(!changed&&command.constructor.name==="PutObjectCommand"){changed=true;const row=[...bad.objects.values()][0];if(scenario==="corrupt")row.bytes[0]^=1;if(scenario==="namespace")row.metadata["pti-descriptor"]=row.metadata["pti-descriptor"].replace('"fixture"','"staging"');if(scenario==="secret")row.etag="https://fixture.invalid/?X-Amz-Credential=FAKE&X-Amz-Signature=NEVER_EXPORT";}return result;};}
  await assert.rejects(()=>p.collectQualificationEvidence(f.artifact()));
 }
 const secrets=[{accessKeyId:"FAKE_ACCESS"},{secretAccessKey:"FAKE_SECRET"},{sessionToken:"FAKE_SESSION"},{webIdentityTokenFile:"C:\\token.fixture"},{Authorization:"FAKE_AUTH"}];
 for(const secret of secrets)assert.throws(()=>createS3Adapter({...f.config,...secret},{transport:mock}));
 const health=require("../kronos/research-backup-health"),status={...f.context,durabilityReady:true,deadlineBreached:false};
 const readiness={adapter:provider,health:status,context:f.context,now:Date.parse(f.instant),primaryHealthy:true,portableHealthy:true,schemaCompatible:true,diskFraction:0.1,freeBytes:10000,requiredStagingBytes:100,backupFresh:true};
 assert.equal(health.isAutomaticCollectionStorageReady(readiness),false);assert.ok(health.storageReadiness(readiness).reasons.includes("REAL_PROVIDER_NOT_QUALIFIED"));
 const text=JSON.stringify({qualified,health:health.storageReadiness(readiness)});for(const sentinel of ["FAKE_ACCESS","FAKE_SECRET","FAKE_SESSION","FAKE_AUTH","NEVER_EXPORT"])assert.ok(!text.includes(sentinel));
 guard.assertClean();console.log("S3 observed capability/conditional/readback evidence, private provenance, negative qualification, secret exclusion and permanently false production/runtime qualification: PASS; external network/real credential access: 0");
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>guard.restore());
