"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process");
const guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork(),f=require("./fixtures/kronos-preflight-evidence");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"pti-signer-crashes-")),child=path.join(__dirname,"fixtures/kronos-preflight-crash-child.js");
function run(file,witness,stage){return cp.spawnSync(process.execPath,[child,JSON.stringify({file,witness,stage})],{encoding:"utf8",timeout:20000});}
async function main(){
 const states={accepted:"ABSENT",reserved:"RESERVED",signed:"RESERVED",envelope:"ENVELOPE",receipt:"RECEIPT",completed:"COMPLETED"};
 for(const [stage,state] of Object.entries(states)){
  const file=path.join(root,stage+".sqlite"),auth=f.authority();let j=f.openDurableJournal(file,f.config({operatorAuthority:auth}));const witness=j.checkpoint();j.close();
  const result=run(file,witness,stage);assert.equal(result.status,77,result.stdout+result.stderr);
  j=f.openDurableJournal(file,f.config({mode:"open-existing",witness,operatorAuthority:auth}));assert.equal(j.state("request-provider"),state);
  const original=f.candidate(),changed=f.candidate();changed.attestation.evidence.defaultRetention.days=2;f.t.f.rehash(changed.attestation);
  changed.request=f.t.request(changed.attestation,f.t.registry());
  assert.throws(()=>f.grant(auth,changed)); // Old approval cannot authorize altered evidence, including pre-write crash.
  if(state==="ABSENT"){f.issue(j,auth,original);}
  else{
   assert.throws(()=>j.reserve(f.grant(auth,original)),{code:"SIGNING_REQUEST_REPLAY"});
   changed.approval=f.approved(changed.request,changed.attestation);assert.throws(()=>j.reserve(f.grant(auth,changed)),{code:"SIGNING_REQUEST_REPLAY"});
   const other=f.candidate();other.request.requestId="other-request";other.request=f.t.rehash(other.request,"requestHash");other.approval=f.approved(other.request,other.attestation);
   assert.throws(()=>j.reserve(f.grant(auth,other)),{code:"SIGNING_REQUEST_REPLAY"}); // Same nonce, different ID.
   if(state==="RESERVED"){assert.throws(()=>j.exactResult(original.request.requestId));assert.throws(()=>j.complete(original.request.requestId));}
   if(state==="ENVELOPE")j.recordReceipt(original.request.requestId);
   if(["ENVELOPE","RECEIPT"].includes(state))j.complete(original.request.requestId);
  }
  if(!["RESERVED"].includes(state))assert.deepEqual(j.exactResult("request-provider"),j.exactResult("request-provider"));
  j.close();console.log("Crash "+stage+": "+state+"; request/nonce binding preserved");
 }
 const file=path.join(root,"concurrent.sqlite"),auth=f.authority();let j=f.openDurableJournal(file,f.config({operatorAuthority:auth}));const witness=j.checkpoint();j.close();
 function spawnReserve(){return new Promise(resolve=>{const c=cp.spawn(process.execPath,[child,JSON.stringify({file,witness,stage:"reserved"})],{stdio:["ignore","pipe","pipe"]});let out="";c.stdout.on("data",v=>out+=v);c.stderr.resume();c.on("exit",code=>resolve({code,out}));});}
 const results=await Promise.all([spawnReserve(),spawnReserve()]);assert.equal(results.filter(r=>r.code===77).length,1,JSON.stringify(results));assert.equal(results.filter(r=>r.code===2).length,1);
 j=f.openDurableJournal(file,f.config({mode:"open-existing",witness,operatorAuthority:auth}));assert.equal(j.state("request-provider"),"RESERVED");
 const reusedApproval=f.candidate("runtime"),providerApproval=f.candidate().approval.approval;
 reusedApproval.approval=f.signApproval({...reusedApproval.approval.approval,nonce:providerApproval.nonce});
 assert.throws(()=>j.reserve(f.grant(auth,reusedApproval)),{code:"SIGNING_REQUEST_REPLAY"});
 const {DatabaseSync}=require("node:sqlite"),otherDb=new DatabaseSync(file);otherDb.exec("BEGIN IMMEDIATE");
 assert.throws(()=>j.reserve(f.grant(auth,f.candidate("runtime"))),{code:"JOURNAL_BUSY"});otherDb.exec("ROLLBACK");
 assert.throws(()=>otherDb.exec("UPDATE events SET hash='bad'"));assert.throws(()=>otherDb.exec("DELETE FROM reservations"));
 otherDb.close();j.reserve(f.grant(auth,f.candidate("runtime")));j.close();
 // Abrupt exit with an uncommitted write: SQLite recovers; no partial reservation/event is visible.
 const uncommitted=cp.spawnSync(process.execPath,["-e","const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);db.exec(\"BEGIN IMMEDIATE; INSERT INTO events VALUES(999,'BAD',NULL,'{}','bad');\");process.exit(77)",file],{encoding:"utf8"});
 assert.equal(uncommitted.status,77,uncommitted.stderr);
 j=f.openDurableJournal(file,f.config({mode:"open-existing",witness,operatorAuthority:auth}));assert.equal(j.checkpoint().sequence,3);j.close();
 assert.doesNotMatch(fs.readFileSync(file).toString("utf8"),/BEGIN PRIVATE KEY|LOGIN_PIN|ADMIN_PIN|SessionToken/);
 guard.assertClean();console.log("Six fresh-process crash boundaries, atomic uniqueness, restart replay rejection, concurrent writer exclusion, rollback recovery and immutable events: PASS");
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{guard.restore();f.removeTemp(root);});
