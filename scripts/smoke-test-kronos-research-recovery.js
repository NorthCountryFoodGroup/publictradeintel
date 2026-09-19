"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),{spawn}=require("node:child_process");
const {DatabaseSync}=require("node:sqlite");
const {openResearchStore}=require("../kronos/research-store");
const {SCHEMA_STATEMENTS}=require("../kronos/research-db-schema");
const {recordEnvelope}=require("../kronos/research-hash");
const f=require("./fixtures/kronos-research-store");
if(process.argv[2]==="--crash-child") {
 const store=openResearchStore(process.argv[3],{mode:"open-existing"});
 const exec=DatabaseSync.prototype.exec;
 DatabaseSync.prototype.exec=function(sql){if(sql==="COMMIT"){process.stdout.write("crash-ready\n");Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);}return exec.call(this,sql)};
 store.writeTransaction(f.transaction("crashed",[f.entry("forecasts",f.forecast("lost-uncommitted"))],f.evidence));
 process.exit(2);
} else if(process.argv[2]==="--second-writer") {
 assert.throws(()=>openResearchStore(process.argv[3],{mode:"open-existing"}),{code:"research_writer_conflict"});console.log("second-writer-rejected");
} else {
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"pti-sqlite-recovery-")),file=path.join(dir,"research.sqlite");let store,child;
 try {
  store=openResearchStore(file,{mode:"initialize-new"});store.writeTransaction(f.transaction("baseline",[f.entry("forecasts",f.forecast("baseline"))],f.evidence));
  await new Promise((resolve,reject)=>{const second=spawn(process.execPath,[__filename,"--second-writer",file],{windowsHide:true,stdio:["ignore","pipe","pipe"]});let output="";second.stdout.on("data",data=>output+=data);second.on("error",reject);second.on("exit",code=>{try{assert.equal(code,0);assert.match(output,/second-writer-rejected/);resolve()}catch(error){reject(error)}})});
  store.close();store=null;
  const clone=name=>{const target=path.join(dir,`${name}.sqlite`);fs.copyFileSync(file,target);return target};
  function visibleFailure(target,pattern) { const before=fs.readFileSync(target);assert.throws(()=>openResearchStore(target,{mode:"open-existing"}),pattern);assert.deepEqual(fs.readFileSync(target),before,"Failed open must not rewrite corrupt evidence");assert.throws(()=>openResearchStore(target,{mode:"initialize-new"}),{code:"research_store_exists"}); }
  const corrupt=clone("corrupt");fs.writeFileSync(corrupt,"not a SQLite database");visibleFailure(corrupt,/database|SQLite/i);
  const incompatible=clone("schema");let db=new DatabaseSync(incompatible);db.exec("PRAGMA user_version=999");db.close();visibleFailure(incompatible,{code:"unsupported_research_schema"});
  const missingTrigger=clone("trigger");db=new DatabaseSync(missingTrigger);db.exec("DROP TRIGGER immutable_forecasts_update");db.close();visibleFailure(missingTrigger,{code:"research_schema_mismatch"});
  const badHash=clone("hash");db=new DatabaseSync(badHash);db.exec("DROP TRIGGER immutable_forecasts_update; UPDATE forecasts SET hash='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'");db.exec(SCHEMA_STATEMENTS.find(sql=>sql.startsWith("CREATE TRIGGER immutable_forecasts_update ")));db.close();visibleFailure(badHash,{code:"hash_mismatch"});
  const badBlob=clone("blob");db=new DatabaseSync(badBlob);db.exec("DROP TRIGGER immutable_content_blobs_update; UPDATE content_blobs SET data=CAST(replace(CAST(data AS TEXT),'1000','2000') AS BLOB)");db.exec(SCHEMA_STATEMENTS.find(sql=>sql.startsWith("CREATE TRIGGER immutable_content_blobs_update ")));db.close();visibleFailure(badBlob,{code:"hash_mismatch"});
  const wrongFk=clone("foreign-key");db=new DatabaseSync(wrongFk);db.exec("PRAGMA foreign_keys=OFF");
  const orphan=f.make("accepted_outcomes","orphan",{forecastId:"missing",attemptId:"missing",revision:1}),envelope=recordEnvelope(orphan);
  db.prepare("INSERT INTO accepted_outcomes VALUES(?,?,?,?,?,?,?)").run(orphan.id,envelope.hash,envelope.json,0,orphan.forecastId,orphan.attemptId,1);db.close();visibleFailure(wrongFk,{code:"research_foreign_key_failure"});
  const wrongEncoding=clone("encoding");db=new DatabaseSync(wrongEncoding);db.exec("DROP TRIGGER immutable_store_metadata_update; UPDATE store_metadata SET canonicalizationVersion='unsupported'");db.exec(SCHEMA_STATEMENTS.find(sql=>sql.startsWith("CREATE TRIGGER immutable_store_metadata_update ")));db.close();visibleFailure(wrongEncoding,{code:"unsupported_research_schema"});
  const wrongJournal=clone("journal");db=new DatabaseSync(wrongJournal);db.exec("PRAGMA journal_mode=WAL");db.close();visibleFailure(wrongJournal,{code:"unsafe_sqlite_profile"});
  const liveCorruption=clone("live-corruption");store=openResearchStore(liveCorruption,{mode:"open-existing"});db=new DatabaseSync(liveCorruption);
  db.exec("DROP TRIGGER immutable_forecasts_update; UPDATE forecasts SET hash='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'");db.exec(SCHEMA_STATEMENTS.find(sql=>sql.startsWith("CREATE TRIGGER immutable_forecasts_update ")));db.close();
  assert.throws(()=>store.readRecord("forecasts","baseline"),{code:"hash_mismatch"});assert.throws(()=>store.writeTransaction(f.transaction("after-corruption")),{code:"research_store_quarantined"});store.close();store=null;
  db=new DatabaseSync(file);assert.throws(()=>db.exec("INSERT OR REPLACE INTO forecasts SELECT * FROM forecasts"),/immutable research identity/);db.close();
  // A closed, consistent fixture copy proves local recovery validation only.
  const restored=clone("restored");store=openResearchStore(restored,{mode:"restore-validation"});assert.equal(store.count("forecasts"),1);assert.equal(store.integrity().integrity,"ok");store.close();store=null;
  child=spawn(process.execPath,[__filename,"--crash-child",file],{windowsHide:true,stdio:["ignore","pipe","pipe"]});
  await new Promise((resolve,reject)=>{let output="",errors="";const timer=setTimeout(()=>reject(Error(`Crash fixture timed out: ${errors}`)),15000);child.stderr.on("data",data=>errors+=data);child.stdout.on("data",data=>{output+=data;if(output.includes("crash-ready")){clearTimeout(timer);resolve()}});child.on("error",reject);child.on("exit",code=>{if(!output.includes("crash-ready")){clearTimeout(timer);reject(Error(`Crash fixture exited ${code}: ${errors}`))}})});
  const exited=new Promise(resolve=>child.once("exit",resolve));child.kill();await exited;child=null;
  assert.throws(()=>openResearchStore(file,{mode:"open-existing"}),{code:"research_writer_conflict"});
  // Explicit fixture-only stale-lock recovery AFTER the owning child has exited.
  const lock=path.resolve(`${file}.writer.lock`);assert.ok(lock.startsWith(path.resolve(dir)+path.sep));fs.unlinkSync(lock);
  store=openResearchStore(file,{mode:"open-existing"});assert.equal(store.count("forecasts"),1);assert.equal(store.readForecast("lost-uncommitted"),null);assert.equal(store.count("research_transactions"),1);assert.equal(store.count("backup_outbox"),1);store.integrity();
  console.log("Slice 2A corruption, schema/hash/FK failures, raw replacement rejection, second-process writer rejection, killed-writer rollback and isolated recovery: PASS");
 }finally {if(child){const exited=new Promise(resolve=>child.once("exit",resolve));child.kill();await exited}if(store)store.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1});
}
