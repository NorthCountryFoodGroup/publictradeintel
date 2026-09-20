"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork(),t=require("./fixtures/kronos-witness-evidence");
try{
 for(const mode of ["unavailable","conflict","stale","fork","readback","receipt","signature"]){const root=t.temp();let x,calls=0;
  try{const original=t.config().signWitness,cfg=t.config({signWitness:b=>{calls++;return mode==="signature"?Buffer.alloc(64).toString("base64"):original(b);}});
   x=t.open(root,{cfg,vaultWrap:v=>({latest(){const h=v.latest();if(mode==="stale"&&h)return null;if(mode==="unavailable")throw Error("secret raw provider error");return h;},
    append(e){if(mode==="conflict")throw Error("secret provider conflict");const r=v.append(e);if(mode==="receipt")return {...r,entryHash:"0".repeat(64)};return r;},
    read(n){const r=v.read(n);if(mode==="readback")r.entry.append.requestedAt="invalid";if(mode==="fork"){r.entry.append.requestedAt="2020-01-01T00:00:00.000Z";r.receipt=t.w.seal({...r.receipt,entryHash:t.w.hashValue(r.entry)},"receiptHash");}return r;}})});
   assert.throws(()=>x.witness.append(t.request(t.eventHistory())));assert.notEqual(x.witness.status().state,"READY");assert.throws(()=>x.witness.freshView({storeId:"ordinary-store",challengeNonce:"a".repeat(64)}));assert.throws(()=>x.witness.acknowledgment(1));if(mode!=="signature")assert.equal(calls,0,"no witness signing before vault readback");
  }finally{if(x)x.close();t.remove(root);}
 }
 const root=t.temp();let x;
 try{
  x=t.open(root);x.close();x=null;const file=path.join(root,"witness.sqlite"),old=path.join(root,"old.sqlite");fs.copyFileSync(file,old);
  x=t.open(root,{mode:"open-existing"});const ack=x.witness.append(t.request(t.eventHistory())),entry=x.vault.read(1).entry;
  assert.deepEqual(x.vault.append(entry),x.vault.latest());const conflict=structuredClone(entry);conflict.receipt.acceptedAt="2020-01-01T00:00:00.000Z";assert.throws(()=>x.vault.append(conflict));assert.equal(x.vault.latest().sequence,1);
  x.close();x=null;fs.copyFileSync(old,file);x=t.open(root,{mode:"open-existing"});assert.equal(x.witness.status().state,"ROLLBACK_DETECTED");assert.throws(()=>x.witness.acknowledgment(1));assert.throws(()=>x.witness.freshView({storeId:"ordinary-store",challengeNonce:"b".repeat(64)}));assert.throws(()=>x.witness.recoverPublication({operatorRef:"cannot-lower-vault"}));assert.equal(x.vault.latest().entryHash,ack.body.vaultReceipt.entryHash);
 }finally{if(x)x.close();t.remove(root);}
 // Same sequence, internally valid competing local history: startup must freeze against independent vault.
 const a=t.temp(),b=t.temp();let x1,x2;
 try{x1=t.open(a);x2=t.open(b);x1.witness.append(t.request(t.eventHistory()));const events=t.eventHistory();events[0].event.data.provenanceRef="different-valid-history";x2.witness.append(t.request(t.rechain(events)));x1.close();x1=null;x2.close();x2=null;
  fs.copyFileSync(path.join(b,"witness.sqlite"),path.join(a,"witness.sqlite"));x1=t.open(a,{mode:"open-existing"});assert.equal(x1.witness.status().state,"FORK");assert.throws(()=>x1.witness.freshView({storeId:"ordinary-store",challengeNonce:"a".repeat(64)}));
 }finally{if(x1)x1.close();if(x2)x2.close();t.remove(a);t.remove(b);}
 guard.assertClean();console.log("Independent fake vault immutability/readback/receipts, unavailable/conflicting/stale/forked vault denial, no premature signing, witness self-rollback and same-sequence fork: PASS");
}finally{guard.restore();}
