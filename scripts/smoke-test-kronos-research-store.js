"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {DatabaseSync}=require("node:sqlite");
const {openResearchStore,researchDatabasePath}=require("../kronos/research-store");
const {hashValue}=require("../kronos/research-hash");
const {PROTOCOL_VERSION}=require("../kronos/research-contracts");
const {SCHEMA_STATEMENTS}=require("../kronos/research-db-schema");
const f=require("./fixtures/kronos-research-store");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"pti-sqlite-store-")),file=researchDatabasePath(dir);
let store;
try {
 assert.throws(()=>openResearchStore(file,{mode:"open-existing"}),{code:"research_store_missing"});assert.equal(fs.existsSync(file),false);
 assert.throws(()=>openResearchStore(file),/Explicit store mode/);
 store=openResearchStore(file,{mode:"initialize-new"});
 assert.deepEqual(store.diagnostics(),{mode:"initialize-new",databaseSchemaVersion:1,canonicalizationVersion:"KRONOS_JCS_STRICT_V1",compressionVersion:"UTF8_NONE_V1",journalMode:"delete",synchronous:3,foreignKeys:1,busyTimeoutMs:1000,offDiskDurability:false});
 assert.throws(()=>openResearchStore(file,{mode:"initialize-new"}),{code:"research_store_exists"});
 assert.throws(()=>openResearchStore(file,{mode:"open-existing"}),{code:"research_writer_conflict"});
 const record=f.forecast("manual-1"),request=f.transaction("first",[f.entry("forecasts",record)],f.evidence);
 assert.deepEqual(store.writeTransaction(request),{inserted:1,idempotent:false});
 assert.deepEqual(store.writeTransaction(request),{inserted:0,idempotent:true});
 assert.deepEqual(store.writeTransaction(f.transaction("same-record",[f.entry("forecasts",record)])),{inserted:0,idempotent:false});
 assert.equal(store.count("content_blobs"),3);assert.notDeepEqual(store.readBlob(record.rawPathsHash),store.readBlob(record.normalizedPathsHash));
 assert.deepEqual(store.readForecast("manual-1"),record);
 const beforeCounts=["forecasts","content_blobs","audit_events","backup_outbox","research_transactions"].map(table=>store.count(table));
 assert.throws(()=>store.writeTransaction(f.transaction("conflict",[f.entry("forecasts",{...record,securityName:"changed"})])),{code:"research_identity_conflict"});
 assert.deepEqual(["forecasts","content_blobs","audit_events","backup_outbox","research_transactions"].map(table=>store.count(table)),beforeCounts);
 for(const bad of [true,1,"false",null,undefined]) {
   const invalid={...record,id:`bad-${String(bad)}`,productionInfluence:bad};assert.throws(()=>store.writeTransaction(f.transaction(`bad-${String(bad)}`,[f.entry("forecasts",invalid)])));
 }
 assert.throws(()=>store.writeTransaction(f.transaction("missing-blob",[f.entry("forecasts",{...record,id:"missing",inputHash:"a".repeat(64)})])),{code:"missing_content_blob"});
 assert.throws(()=>store.writeTransaction(f.transaction("rollback",[f.entry("forecasts",f.forecast("partial")),f.entry("forecasts",{...record,securityName:"conflict"})],[{new:"must-roll-back"}])),{code:"research_identity_conflict"});
 assert.equal(store.readForecast("partial"),null);assert.equal(store.count("content_blobs"),3);
 store.writeTransaction(f.automaticSetup());store.writeTransaction(f.automaticResult());
 const future="KRONOS_AUTO_SHADOW_PROTOCOL_FIXTURE_V2";store.writeTransaction(f.automaticSetup("future",future));store.writeTransaction(f.automaticResult("future",future));
 assert.equal(store.findForecasts({triggerMode:"automatic_shadow",protocolVersion:PROTOCOL_VERSION}).length,1);
 assert.equal(store.findForecasts({triggerMode:"automatic_shadow",protocolVersion:future}).length,1);
 assert.equal(store.findForecasts({triggerMode:"manual",protocolVersion:null}).length,1);
 assert.equal(store.findForecasts({sessionId:"session-one",jobId:"job-one-0",ticker:"T0"}).length,1);
 assert.equal(store.findForecasts({sourceRevision:"source-v1",modelRevision:"model-v1",tokenizerRevision:"tokenizer-v1"}).length,3);
 const corruptProjection=f.automaticResult("one");corruptProjection.id="bad-projection";corruptProjection.records[5].record.jobCounts.COMPLETED=0;
 assert.throws(()=>store.writeTransaction(corruptProjection));
 // A later result changes the running-session projection without inventing a
 // lifecycle transition or reopening a terminal session.
 const secondResult=f.automaticResult();secondResult.id="second-result";secondResult.audit.id="audit-second-result";
 secondResult.records=secondResult.records.filter((_,index)=>index!==2);
 for(const item of secondResult.records) {
  const r=item.record;
  if(item.table==="job_revisions"){r.jobId="job-one-1";r.id=`${r.jobId}:${r.revision}`;if(r.forecastId)r.forecastId="automatic-second";}
  if(item.table==="forecasts"){r.id="automatic-second";r.jobId="job-one-1";r.ticker="T1";}
  if(item.table==="session_revisions"){r.id="session-one:4";r.revision=4;r.jobCounts.PLANNED=18;r.jobCounts.COMPLETED=2;}
 }
 store.writeTransaction(secondResult);
 assert.equal(store.findForecasts({sessionId:"session-one"}).length,2);
 const original=store.readRecord("forecasts","manual-1");
 const correction={id:"correction-1",recordContractVersion:"KRONOS_CORRECTION_V1",productionInfluence:false,targetId:"manual-1",originalHash:original.hash,changes:[{path:"/securityName",previousValueHash:hashValue(record.securityName),value:"Correct display name"}],reason:"fixture correction",actor:"test",timestamp:f.timestamp,softwareVersion:"fixture-v1",priorCorrectionId:null};
 store.writeTransaction(f.transaction("correction",[f.entry("correction_events",correction)]));
 assert.deepEqual(store.readForecast("manual-1"),record);assert.equal(store.readForecast("manual-1",{effective:true}).securityName,"Correct display name");
 for(const key of ["triggerMode","generatedAt","inputHash","rawPathsHash","normalizedPathsHash","protocolVersion","productionInfluence"]) {
  assert.throws(()=>store.writeTransaction(f.transaction(`forbidden-${key}`,[f.entry("correction_events",{...correction,id:`correction-${key}`,priorCorrectionId:correction.id,changes:[{path:`/${key}`,previousValueHash:hashValue(record[key]),value:"automatic_shadow"}]})])));
 }
 assert.throws(()=>store.writeTransaction(f.transaction("stale",[f.entry("correction_events",{...correction,id:"stale"})])),/chain conflict/);
 const correction2={...correction,id:"correction-2",priorCorrectionId:"correction-1",changes:[{path:"/securityName",previousValueHash:hashValue("Correct display name"),value:"Second display name"}]};
 store.writeTransaction(f.transaction("correction2",[f.entry("correction_events",correction2)]));
 assert.equal(store.readForecast("manual-1",{effective:true}).securityName,"Second display name");
 const failed=f.make("outcome_attempts","outcome-failed",{forecastId:record.id,attemptKey:"failed",state:"PROVIDER_UNAVAILABLE",evaluatorVersion:"fixture-eval-v1",evidenceHash:null,reason:"provider unavailable"});
 store.writeTransaction(f.transaction("failed-outcome",[f.entry("outcome_attempts",failed)]));
 assert.throws(()=>store.writeTransaction(f.transaction("accept-failure",[f.entry("accepted_outcomes",f.make("accepted_outcomes","accept-failure",{forecastId:record.id,attemptId:failed.id,revision:1}))])));
 const actual={complete:true,expectedBars:5,observedBars:5,bars:f.normalized[0]},evaluated=f.make("outcome_attempts","evaluated",{forecastId:record.id,attemptKey:"evaluated",state:"EVALUATED",evaluatorVersion:"fixture-eval-v1",evidenceHash:hashValue(actual),reason:null,createdAt:"2026-09-28T00:00:00.000Z"});
 store.writeTransaction(f.transaction("evaluated",[f.entry("outcome_attempts",evaluated),f.entry("accepted_outcomes",f.make("accepted_outcomes","accepted-1",{forecastId:record.id,attemptId:evaluated.id,revision:1,createdAt:"2026-09-28T00:00:00.000Z"}))],[actual]));
 assert.deepEqual(store.readForecast(record.id),record);assert.equal(store.count("outcome_attempts"),2);
 store.writeTransaction(f.transaction("invalidated",[f.entry("forecast_dispositions",f.make("forecast_dispositions","invalidated",{forecastId:record.id,replacementForecastId:null,kind:"INVALIDATED",reason:"fixture evidence defect",actor:"test",softwareVersion:"v1"}))]));
 assert.deepEqual(store.readForecast(record.id),record);
 for(let offset=0;offset<1024;offset+=128) store.writeTransaction(f.transaction(`scale-${offset}`,Array.from({length:128},(_,i)=>f.entry("forecasts",f.forecast(`scale-${offset+i}`,{ticker:`T${(offset+i)%20}`})))));
 assert.equal(store.count("forecasts"),1028);assert.equal(store.findForecasts({triggerMode:"manual"}).length,1025);
 assert.equal(store.integrity().integrity,"ok");store.close();store=null;
 const direct=new DatabaseSync(file);
 for(const table of ["forecasts","content_blobs","correction_events","outcome_attempts"]) {
  assert.throws(()=>direct.exec(`UPDATE ${table} SET ${table==="content_blobs"?"hash=hash":"id=id"}`),/immutable/);
  assert.throws(()=>direct.exec(`DELETE FROM ${table}`),/immutable/);
 }
 const rawRow=direct.prepare("SELECT * FROM forecasts WHERE id='manual-1'").get(),columns=Object.keys(rawRow);
 for(const unsafe of [true,1,"false"]) {
  const payload={...JSON.parse(rawRow.payload),id:`sql-unsafe-${String(unsafe)}`,productionInfluence:unsafe};
  const values={...rawRow,id:payload.id,payload:JSON.stringify(payload),productionInfluence:unsafe===true||unsafe===1?1:0};
  assert.throws(()=>direct.prepare(`INSERT INTO forecasts(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).run(...columns.map(key=>values[key])),/CHECK/);
 }
 direct.exec("PRAGMA foreign_keys=ON");
 assert.throws(()=>direct.exec("INSERT INTO backup_outbox(id,hash,payload,productionInfluence,transactionId) VALUES('orphan','x','{\"id\":\"orphan\",\"recordContractVersion\":\"KRONOS_BACKUP_OUTBOX_METADATA_V1\",\"productionInfluence\":false,\"transactionId\":\"missing\"}',0,'missing')"),/FOREIGN KEY/);
 const probes=[['ticker','ticker=?'],['security','securityId=?'],['time','generatedAt=?'],['partition','triggerMode=? AND protocolVersion=?'],['model','sourceRevision=? AND modelRevision=? AND tokenizerRevision=?'],['session','sessionId=?'],['job','jobId=?']];
 for(const [name,where] of probes) {const params=Array((where.match(/\?/g)||[]).length).fill('fixture');const detail=direct.prepare(`EXPLAIN QUERY PLAN SELECT id FROM forecasts WHERE ${where}`).all(...params).map(row=>row.detail).join(' ');assert.match(detail,/USING (?:COVERING )?INDEX/,name);}
 for(const sql of ["SELECT id FROM outcome_attempts WHERE state='EVALUATED'","SELECT id FROM correction_events WHERE targetId='manual-1'"]) assert.match(direct.prepare(`EXPLAIN QUERY PLAN ${sql}`).get().detail,/USING (?:COVERING )?INDEX/);
 direct.close();
 store=openResearchStore(file,{mode:"open-existing"});assert.equal(store.count("forecasts"),1028);store.close();store=null;
 const before=fs.readFileSync(file);store=openResearchStore(file,{mode:"restore-validation"});assert.equal(store.count("forecasts"),1028);assert.throws(()=>store.writeTransaction(request),{code:"research_store_readonly"});store.close();store=null;assert.deepEqual(fs.readFileSync(file),before);
 console.log('Slice 2A SQLite modes, pragmas, immutable evidence, atomic writes, corrections, outcomes, query indexes, 1,028 retained forecasts and reopened hashes: PASS');
} finally {if(store)store.close();fs.rmSync(dir,{recursive:true,force:true});}
