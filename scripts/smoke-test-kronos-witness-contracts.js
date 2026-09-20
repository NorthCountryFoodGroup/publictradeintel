"use strict";
const assert=require("node:assert/strict"),guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork(),t=require("./fixtures/kronos-witness-evidence");
const root=t.temp();let x;
try{
 x=t.open(root);const a=t.request(t.eventHistory()),ack=x.witness.append(a),entry=x.vault.read(1).entry,verify=t.w.createVerifier({identity:t.identity(),vaultId:"fictional-vault"});
 assert.equal(verify.acknowledgment(ack,entry),true);assert.deepEqual(x.witness.acknowledgment(1),ack);
 for(const edit of [v=>v.body.receipt.acceptedAt="2020-01-01T00:00:00.000Z",v=>v.body.keyFingerprint="0".repeat(64),v=>v.signature=Buffer.alloc(64).toString("base64"),v=>v.body.publicKey=t.f.t.extraKey.publicKey]){const v=structuredClone(ack);edit(v);assert.throws(()=>verify.acknowledgment(v,entry));}
 const foreign={...t.identity(),witnessId:"other-witness"};assert.throws(()=>t.w.createVerifier({identity:foreign,vaultId:"fictional-vault"}).acknowledgment(ack,entry));
 const foreignKey={...t.identity(),publicKey:t.f.t.extraKey.publicKey,keyFingerprint:t.f.t.s.fingerprint(t.f.t.extraKey.publicKey)};assert.throws(()=>t.w.createVerifier({identity:foreignKey,vaultId:"fictional-vault"}).acknowledgment(ack,entry));
 const nonce="a".repeat(64),view=x.witness.freshView({storeId:"ordinary-store",challengeNonce:nonce}),opts={storeId:"ordinary-store",challengeNonce:nonce,now:t.f.t.f.time,minimumSequence:1,expectedReceiptHash:ack.body.receipt.receiptHash};
 assert.equal(verify.freshView(view,opts),true);assert.throws(()=>verify.freshView(view,{...opts,now:opts.now+300000}),{code:"VIEW_EXPIRED"});assert.throws(()=>verify.freshView(view,{...opts,now:opts.now-1}));assert.throws(()=>verify.freshView(view,{...opts,minimumSequence:2}));assert.throws(()=>verify.freshView(view,{...opts,challengeNonce:"b".repeat(64)}));
 for(const field of ["privateKey","AWS_ACCESS_KEY_ID","sessionToken","OIDC_TOKEN","Authorization","LOGIN_PIN","ADMIN_PIN","KRONOS_SERVICE_TOKEN","cookies","environmentDump","sourcePath"]){
  for(const [obj,validate] of [[a,v=>t.w.append(v,t.identity())],[a.checkpoint,v=>t.w.checkpoint(v,t.identity())],[ack.body,v=>t.w.ackBody(v,t.identity())],[view.body,v=>t.w.viewBody(v,t.identity())],[t.identity(),t.w.identity]]){const bad=structuredClone(obj);bad[field]="forbidden";assert.throws(()=>validate(bad));}
 }
 const otherRoot=t.temp();try{const id={...t.identity(),publicKey:t.f.t.extraKey.publicKey,keyFingerprint:t.f.t.s.fingerprint(t.f.t.extraKey.publicKey)};assert.throws(()=>t.open(otherRoot,{cfg:t.config({identity:id})}),{code:"OPERATOR_NOT_INDEPENDENT"});}finally{t.remove(otherRoot);}
 const crypt=require("node:crypto");assert.equal(crypt.verify(null,t.w.signedBytes({...view.body,version:t.w.V.ack}),t.identity().publicKey,Buffer.from(view.signature,"base64")),false);
 assert.equal(x.witness.status().productionReady,false);guard.assertClean();console.log("Witness contracts, canonical domain-separated acknowledgments, pinned/foreign keys, tampering, five-minute challenged views, secret allowlists: PASS");
}finally{if(x)x.close();t.remove(root);guard.restore();}
