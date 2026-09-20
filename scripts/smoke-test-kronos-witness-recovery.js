"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork(),t=require("./fixtures/kronos-witness-evidence");
const child=path.join(__dirname,"fixtures/kronos-witness-crash-child.js");
function run(root,stage){return cp.spawnSync(process.execPath,[child,JSON.stringify({root,stage})],{encoding:"utf8",timeout:20000});}
try{
 const stages={"before-local-transaction":"READY","local-transaction-committed":"UNACKNOWLEDGED_LOCAL_STATE","vault-append-accepted":"RECOVERY_REQUIRED","local-completion-committed":"READY","acknowledgment-generated":"READY","acknowledgment-returned":"READY"};
 for(const [stage,expected] of Object.entries(stages)){const root=t.temp();let x;
  try{x=t.open(root);x.close();x=null;const result=run(root,stage);assert.equal(result.status,77,result.stdout+result.stderr);assert.throws(()=>t.open(root,{mode:"open-existing"}),{code:"WRITER_OWNED"});
   t.recoverLocks(root);x=t.open(root,{mode:"open-existing"});assert.equal(x.witness.status().state,expected);
   if(expected!=="READY"){assert.throws(()=>x.witness.acknowledgment(1));assert.throws(()=>x.witness.freshView({storeId:"ordinary-store",challengeNonce:"a".repeat(64)}));x.witness.recoverPublication({operatorRef:"explicit-reviewed-recovery"});}
   if(stage==="before-local-transaction")x.witness.append(t.request(t.eventHistory()));
   assert.equal(x.witness.status().state,"READY");assert.equal(x.vault.latest().sequence,1);const ack=x.witness.acknowledgment(1);assert.deepEqual(x.witness.acknowledgment(1),ack);
   assert.equal(t.w.createVerifier({identity:t.identity(),vaultId:"fictional-vault"}).acknowledgment(ack,x.vault.read(1).entry),true);
   x.close();x=null;x=t.open(root,{mode:"open-existing"});assert.deepEqual(x.witness.acknowledgment(1),ack);assert.throws(()=>x.witness.append(t.request(t.eventHistory())),{code:"DUPLICATE_APPEND"});assert.equal(x.vault.latest().sequence,1);
   console.log("Crash "+stage+": "+expected+"; exact one-checkpoint recovery PASS");
  }finally{if(x)x.close();t.remove(root);}
 }
 const root=t.temp();let x;
 try{x=t.open(root);const r=run(root,"ownership-only");assert.equal(r.status,2);assert.match(r.stdout,/WRITER_OWNED/);const witnessOwner=run(root,"witness-owner-only");assert.equal(witnessOwner.status,2);assert.match(witnessOwner.stdout,/WRITER_OWNED/);
  const {recoverOwnership}=require("../kronos/research-qualification-witness-disk"),file=path.join(root,"witness.sqlite"),owner=JSON.parse(fs.readFileSync(file+".writer.lock"));
  assert.throws(()=>recoverOwnership(file,{expectedOwnerId:owner.ownerId,operatorRef:"live-owner-not-fenced"}),{code:"OWNER_ACTIVE"});
  assert.throws(()=>recoverOwnership(file,{expectedOwnerId:"wrong-owner",operatorRef:"wrong-owner"}));
  // An uncommitted raw test write is rolled back on process exit; witness schema remains append-only.
  x.witness.append(t.request(t.eventHistory()));x.close();x=null;
  const raw=cp.spawnSync(process.execPath,["-e","const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);db.exec(\"BEGIN IMMEDIATE; INSERT INTO entries VALUES(99,'{}','bad');\");process.exit(77)",file],{encoding:"utf8"});assert.equal(raw.status,77,raw.stderr);
  x=t.open(root,{mode:"open-existing"});assert.equal(x.witness.status().state,"READY");assert.equal(x.vault.latest().sequence,1);
  const {DatabaseSync}=require("node:sqlite"),db=new DatabaseSync(file);assert.throws(()=>db.exec("DELETE FROM entries"));assert.throws(()=>db.exec("UPDATE completions SET hash='bad'"));db.close();
  assert.doesNotMatch(fs.readFileSync(file).toString("utf8"),/BEGIN PRIVATE KEY|LOGIN_PIN|ADMIN_PIN|SessionToken|secret raw provider/);
 }finally{if(x)x.close();t.remove(root);}
 guard.assertClean();console.log("Six fresh-process crash boundaries, explicit stale-owner recovery, live/second-writer denial, restart replay and uncommitted-write recovery: PASS");
}finally{guard.restore();}
