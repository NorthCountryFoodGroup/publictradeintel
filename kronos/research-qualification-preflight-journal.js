"use strict";
// Opening is explicit and isolated. SQLite transactions exclude concurrent writers; no network or signing capability.
const fs=require("node:fs"),path=require("node:path");
const p=require("./research-qualification-preflight-contracts"),s=require("./research-qualification-signer-contracts"),q=require("./research-qualification-contracts"),c=require("./research-backup-contracts");
const {canonicalize}=require("./research-canonical"),{hashValue}=require("./research-hash");
const SQL=[
 "CREATE TABLE metadata (storeId TEXT PRIMARY KEY, version TEXT NOT NULL, bindingHash TEXT NOT NULL)",
 "CREATE TABLE events (sequence INTEGER PRIMARY KEY, kind TEXT NOT NULL, requestId TEXT, payload TEXT NOT NULL, hash TEXT NOT NULL, UNIQUE(requestId,kind))",
 "CREATE TABLE reservations (requestId TEXT PRIMARY KEY, nonce TEXT UNIQUE NOT NULL, approvalNonce TEXT UNIQUE NOT NULL, requestHash TEXT NOT NULL, evidenceHash TEXT NOT NULL, signerId TEXT NOT NULL, approvalHash TEXT NOT NULL, payload TEXT NOT NULL)"
];
for(const table of ["metadata","events","reservations"])for(const action of ["UPDATE","DELETE"])SQL.push(`CREATE TRIGGER ${table}_no_${action.toLowerCase()} BEFORE ${action} ON ${table} BEGIN SELECT RAISE(ABORT,'immutable'); END`);
const APP_ID=1262635600,journals=new WeakSet();
function assertJournal(j){p.check(journals.has(j),"JOURNAL_AUTHORITY_REQUIRED");}
function openDurableJournal(file,{mode,storeId,binding,operatorAuthority,approvedRegistryPins,initialRegistry,provenanceRef,witness,now=Date.now}){
 p.check(["initialize-new","open-existing"].includes(mode));p.check(path.isAbsolute(file)&&file!==":memory:");c.label(storeId);q.binding(binding);
 p.check(Array.isArray(approvedRegistryPins)&&approvedRegistryPins.length>0);
 const pins=new Set(approvedRegistryPins);pins.forEach(c.digest);
 let db,closed=false;
 function guard(fn){try{return fn();}catch(error){if(error?.code?.startsWith("SQLITE")||error?.code==="ERR_SQLITE_ERROR"){p.fail(/locked|busy/i.test(error.message)?"JOURNAL_BUSY":/UNIQUE/i.test(error.message)?"SIGNING_REQUEST_REPLAY":"JOURNAL_INVALID");}if(error?.code&&/^[A-Z_]+$/.test(error.code))throw error;p.fail("JOURNAL_INVALID");}}
 function registryAllowed(reg){s.registry(reg);operatorAuthority.assertIndependent(reg);p.check(pins.has(reg.registryHash),"REGISTRY_UNPINNED");}
 function load(){
  const rows=db.prepare("SELECT * FROM events ORDER BY sequence").all(),requests=new Map(),history=[];let prior=null,reg=null,seq=0;
  for(const row of rows){
   const e=JSON.parse(row.payload);c.shape(e,"version,sequence,previousHash,kind,requestId,at,data");
   p.check(e.version===p.VERSION.journal&&e.sequence===++seq&&row.sequence===seq&&e.previousHash===prior&&row.kind===e.kind&&row.requestId===e.requestId&&canonicalize(e)===row.payload&&hashValue(e)===row.hash,"JOURNAL_INTEGRITY");
   s.time(e.at);p.check(!history.length||e.at>=history.at(-1).event.at,"JOURNAL_INTEGRITY");
   if(e.kind==="REGISTRY"){
    c.shape(e.data,"registry,provenanceRef");c.label(e.data.provenanceRef);p.check(e.requestId===null);
    registryAllowed(e.data.registry);if(reg)s.rotation(reg,e.data.registry);reg=e.data.registry;
   }else if(e.kind==="RESERVED"){
    p.check(reg&&!requests.has(e.requestId),"JOURNAL_INTEGRITY");c.shape(e.data,"request,attestation,approval");
    operatorAuthority.validate(e.data.approval,e.data.request,e.data.attestation,reg,s.time(e.at));
    p.check(e.requestId===e.data.request.requestId);
    requests.set(e.requestId,{...e.data,registry:reg,reservedAt:e.at,state:"RESERVED",envelope:null,receipt:null});
   }else{
    const r=requests.get(e.requestId);p.check(r,"JOURNAL_INTEGRITY");
    if(e.kind==="ENVELOPE"){p.check(r.state==="RESERVED");p.verifyEnvelope(e.data,r.request,r.attestation,r.registry,s.time(e.at));r.envelope=e.data;r.state="ENVELOPE";}
    else if(e.kind==="RECEIPT"){p.check(r.state==="ENVELOPE");s.receipt(e.data);q.equal(e.data,p.receipt(r.envelope));r.receipt=e.data;r.state="RECEIPT";}
    else if(e.kind==="COMPLETED"){p.check(r.state==="RECEIPT");c.shape(e.data,"envelopeHash,receiptHash");p.check(e.data.envelopeHash===r.envelope.envelopeHash&&e.data.receiptHash===r.receipt.receiptHash);r.state="COMPLETED";}
    else p.fail("JOURNAL_INTEGRITY");
   }
   prior=row.hash;history.push({event:e,hash:prior,registry:reg});
  }
  p.check(reg,"JOURNAL_INTEGRITY");
  const reservations=db.prepare("SELECT * FROM reservations").all();p.check(reservations.length===requests.size,"JOURNAL_INTEGRITY");
  for(const row of reservations){const r=requests.get(row.requestId);p.check(r&&row.nonce===r.request.nonce&&row.approvalNonce===r.approval.approval.nonce&&row.requestHash===r.request.requestHash&&row.evidenceHash===r.attestation.evidenceHash&&row.signerId===r.request.signerId&&row.approvalHash===r.approval.approval.approvalHash&&row.payload===canonicalize({request:r.request,attestation:r.attestation,approval:r.approval}),"JOURNAL_INTEGRITY");}
  return {requests,history,registry:reg,sequence:seq,chainHash:prior};
 }
 function checkpoint(model=load()){return {version:p.VERSION.checkpoint,storeId,sequence:model.sequence,chainHash:model.chainHash,registryRevision:model.registry.registryRevision,registryHash:model.registry.registryHash};}
 function verifyWitness(w,exact=false,model=load()){
  p.check(w,"WITNESS_REQUIRED");p.checkpoint(w);p.check(w.storeId===storeId&&w.sequence<=model.sequence,"ROLLBACK_DETECTED");
  const row=model.history[w.sequence-1];p.check(row&&row.hash===w.chainHash&&row.registry.registryRevision===w.registryRevision&&row.registry.registryHash===w.registryHash,"ROLLBACK_DETECTED");
  if(exact)q.equal(w,checkpoint(model));return true;
 }
 function owned(){p.check(!closed,"JOURNAL_CLOSED");}
 function read(fn){owned();return guard(()=>{db.exec("BEGIN");try{const result=fn(load());db.exec("COMMIT");return result;}catch(error){db.exec("ROLLBACK");throw error;}});}
 function transaction(fn){owned();return guard(()=>{db.exec("BEGIN IMMEDIATE");try{const model=load(),result=fn(model);db.exec("COMMIT");return result;}catch(error){db.exec("ROLLBACK");throw error;}});}
 function append(model,kind,requestId,data){
  const at=new Date(now()).toISOString();p.check(!model.history.length||at>=model.history.at(-1).event.at);
  const e={version:p.VERSION.journal,sequence:model.sequence+1,previousHash:model.chainHash,kind,requestId,at,data};
  db.prepare("INSERT INTO events VALUES(?,?,?,?,?)").run(e.sequence,kind,requestId,canonicalize(e),hashValue(e));
 }
 try{
  if(mode==="initialize-new"){p.check(initialRegistry);registryAllowed(initialRegistry);c.label(provenanceRef);fs.closeSync(fs.openSync(file,"wx",0o600));}
  else p.check(fs.existsSync(file),"JOURNAL_MISSING");
  const stat=fs.lstatSync(file);p.check(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1,"JOURNAL_PATH");
  const {DatabaseSync}=require("node:sqlite");db=new DatabaseSync(file);
  if(mode==="open-existing")p.check(db.prepare("PRAGMA application_id").get().application_id===APP_ID&&db.prepare("PRAGMA user_version").get().user_version===1,"JOURNAL_SCHEMA");
  db.exec("PRAGMA journal_mode=DELETE; PRAGMA synchronous=EXTRA; PRAGMA trusted_schema=OFF; PRAGMA busy_timeout=100;");
  if(mode==="initialize-new"){
   db.exec("BEGIN IMMEDIATE");try{
    SQL.forEach(sql=>db.exec(sql));db.exec(`PRAGMA application_id=${APP_ID}; PRAGMA user_version=1;`);
    db.prepare("INSERT INTO metadata VALUES(?,?,?)").run(storeId,p.VERSION.journal,hashValue(binding));
    const event={version:p.VERSION.journal,sequence:1,previousHash:null,kind:"REGISTRY",requestId:null,at:new Date(now()).toISOString(),data:{registry:initialRegistry,provenanceRef}};
    db.prepare("INSERT INTO events VALUES(?,?,?,?,?)").run(1,"REGISTRY",null,canonicalize(event),hashValue(event));db.exec("COMMIT");
   }catch(error){db.exec("ROLLBACK");throw error;}
  }
  p.check(db.prepare("PRAGMA application_id").get().application_id===APP_ID&&db.prepare("PRAGMA user_version").get().user_version===1&&db.prepare("PRAGMA synchronous").get().synchronous===3&&db.prepare("PRAGMA journal_mode").get().journal_mode==="delete","JOURNAL_SCHEMA");
  p.check(db.prepare("PRAGMA integrity_check").get().integrity_check==="ok","JOURNAL_INTEGRITY");
  const actual=db.prepare("SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").all().map(row=>row.sql).sort();q.equal(actual,[...SQL].sort());
  const metadata=db.prepare("SELECT * FROM metadata").all();p.check(metadata.length===1&&metadata[0].storeId===storeId&&metadata[0].version===p.VERSION.journal&&metadata[0].bindingHash===hashValue(binding),"JOURNAL_IDENTITY");
  const model=load();if(mode==="open-existing")verifyWitness(witness,false,model);
  function reserve(grant){return transaction(model=>{
   const data=operatorAuthority.inspect(grant,model.registry,now()),r=data.request;
   p.check(!model.requests.has(r.requestId)&&!db.prepare("SELECT 1 FROM reservations WHERE nonce=? OR approvalNonce=?").get(r.nonce,data.approval.approval.nonce),"SIGNING_REQUEST_REPLAY");
   db.prepare("INSERT INTO reservations VALUES(?,?,?,?,?,?,?,?)").run(r.requestId,r.nonce,data.approval.approval.nonce,r.requestHash,r.canonicalEvidenceHash,r.signerId,data.approval.approval.approvalHash,canonicalize(data));
   append(model,"RESERVED",r.requestId,data);return {requestId:r.requestId,state:"RESERVED"};
  });}
  function recordEnvelope(id,e){return transaction(model=>{const r=model.requests.get(id);p.check(r&&r.state==="RESERVED","SIGNING_REQUEST_REPLAY");p.check(s.time(e.signedAt)>=s.time(r.reservedAt),"SIGNATURE_TIME");p.verifyEnvelope(e,r.request,r.attestation,r.registry,now());p.verifyEnvelope(e,r.request,r.attestation,model.registry,now());append(model,"ENVELOPE",id,e);});}
  function recordReceipt(id){return transaction(model=>{const r=model.requests.get(id);p.check(r&&r.state==="ENVELOPE","ISSUANCE_STATE");p.verifyEnvelope(r.envelope,r.request,r.attestation,model.registry,now());const receipt=p.receipt(r.envelope);append(model,"RECEIPT",id,receipt);return receipt;});}
  function complete(id){return transaction(model=>{const r=model.requests.get(id);p.check(r&&r.state==="RECEIPT","ISSUANCE_STATE");p.verifyEnvelope(r.envelope,r.request,r.attestation,model.registry,now());append(model,"COMPLETED",id,{envelopeHash:r.envelope.envelopeHash,receiptHash:r.receipt.receiptHash});});}
  function exactResult(id){return read(model=>{const r=model.requests.get(id);p.check(r&&r.state==="COMPLETED","ISSUANCE_INCOMPLETE");return structuredClone({envelope:r.envelope,receipt:r.receipt});});}
  function publishRegistry(reg,provenanceRef){c.label(provenanceRef);registryAllowed(reg);return transaction(model=>{s.rotation(model.registry,reg);append(model,"REGISTRY",null,{registry:reg,provenanceRef});});}
  function material(w){
   return read(model=>{verifyWitness(w,true,model);const at=new Date(now()).toISOString();
   const entries=[...model.requests.values()].map(r=>({requestId:r.request.requestId,nonce:r.request.nonce,requestHash:r.request.requestHash,reservedAt:r.reservedAt,receipt:r.state==="COMPLETED"?r.receipt:null}));
   const journal=s.seal({version:s.VERSION.journal,journalId:storeId,revision:model.sequence,createdAt:at,expiresAt:new Date(now()+3600000).toISOString(),entries},"journalHash");s.journal(journal);
   return {registry:structuredClone(model.registry),journal,records:[...model.requests.values()].filter(r=>r.state==="COMPLETED").map(r=>structuredClone(r))};});
  }
  const handle=Object.freeze({reserve,recordEnvelope,recordReceipt,complete,exactResult,publishRegistry,
   checkpoint(){return read(model=>checkpoint(model));},verifyWitness(w,exact=false){return read(model=>verifyWitness(w,exact,model));},
   state(id){return read(model=>model.requests.get(id)?.state||"ABSENT");},material,
   close(){if(!closed){db.close();closed=true;}}});journals.add(handle);return handle;
 }catch(error){if(db)db.close();return guard(()=>{throw error;});}
}
module.exports={openDurableJournal,assertJournal,SQL};
