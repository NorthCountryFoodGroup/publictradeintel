"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const guard = require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
const t = require("./fixtures/kronos-integration-processes"), f = require("./fixtures/kronos-operator-retention-evidence");
const r = require("../kronos/research-qualification-operator-retention-contracts"), d = require("../kronos/research-qualification-operator-contracts"), w = t.w;
const suite = process.argv[2], now = t.f.t.f.time, nonce = "c".repeat(64);
function cfgFor(cfg) { return f.config({binding: cfg.binding, registry: cfg.registry, identity: cfg.identity, operators: cfg.operators}); }
async function open(extra = {}) {
  const config = {...t.config(), requireOperatorProcess: true, operatorCandidate: t.candidate(), ...extra};
  const fleet = await new t.Fleet(config).open(); await fleet.start("operator", "operator");
  fleet.op = (command, args = {}) => fleet.workers.get("operator").call("execute", {command, args});
  fleet.id = config.operatorCandidate.request.requestId;
  fleet.decide = async (action = "approve", review) => { review ||= await fleet.op("inspect", {requestId: fleet.id}); return fleet.op(action, {requestId: fleet.id, reviewHash: review.reviewHash, ...(action === "deny" ? {reason: "EVIDENCE"} : {})}); };
  fleet.retentionProof = () => fleet.witness.call("operator-proof", {challengeNonce: nonce}); return fleet;
}
async function withFleet(fn, extra) { const x = await open(extra); try { return await fn(x); } finally { await x.dispose(); } }
function direct(fn) {
  const cfg = t.config(), config = cfgFor(cfg), root = require("./fixtures/kronos-native-evidence").temp(), x = f.open(root, {mode: "initialize-new", config, now: () => now});
  try { return fn({x, cfg, config, record: f.record(t.candidate(), cfg.registry, config)}); } finally { x.close(); t.f.removeTemp(root); }
}
function req(record, config, proof) { const model = r.verifyProof(proof, config, {challengeNonce: nonce, now}); return r.request(record, model, config); }
function entry(a, previous = null) { return {append: a, receipt: w.seal({version: r.V.receipt, ...r.common({ledgerId: a.ledgerId, binding: {environmentId: a.environmentId, streamId: a.streamId}}), sequence: a.sequence, previousReceiptHash: previous, appendHash: a.appendHash, acceptedAt: new Date(now).toISOString()}, "receiptHash")}; }
async function run() {
  if (suite === "contracts") direct(({x, config, record}) => {
    const a = req(record, config, x.witness.proof(nonce)); assert.equal(a.domain, r.V.domain); assert.equal(a.sequence, 1); assert.equal(a.previousCheckpointHash, null);
    r.append(a, config); for (const [k,v] of [["domain", w.V.append],["ledgerId","foreign"],["streamId","foreign"],["environmentId","production"]]) assert.throws(() => r.append(w.seal({...a,[k]:v},"appendHash"), config));
    assert.throws(() => r.append({...a, privateKey: "forbidden"}, config));
    const original = x.witness.proof(nonce), sign = require("./fixtures/kronos-witness-evidence").config().signWitness; let calls = 0, markers = 0;
    const client = require("../kronos/research-qualification-operator-retention").createClient({config, now: () => now, writerStoreId: config.writerStoreId, writerEpoch: 1,
      store: {decision: () => record, retained: () => [], markRetained: () => { markers++; }},
      adapter: {append: value => x.witness.append(value), proof(challengeNonce) { if (!calls++) return x.witness.proof(challengeNonce); const stale = structuredClone(original); stale.view.body.challengeNonce = challengeNonce; stale.view.signature = sign(w.signedBytes(stale.view.body)); return stale; }}});
    assert.throws(() => client.retain(record), /ACK_NOT_CURRENT/); assert.equal(markers, 0);
  });
  else if (["approval", "denial", "process"].includes(suite)) await withFleet(async x => {
    const record = await x.decide(suite === "denial" ? "deny" : "approve"), proof = await x.retentionProof();
    const out = require("../kronos/research-qualification-operator-retention-proof").verifyDecisionProof(proof, cfgFor(x.config), {challengeNonce: nonce, now, expectedDecisionHash: record.decision.decisionHash});
    assert.equal(out.action, record.decision.action); assert.equal(proof.history.length,1);
    const review = {reviewHash: record.decision.reviewHash}; assert.deepEqual(await x.decide(suite === "denial" ? "deny" : "approve",review),record);
    await assert.rejects(x.decide(suite === "denial" ? "approve" : "deny",review));
    assert.equal((await x.workers.get("operator").call("retained-markers")).length,1);
    if (suite === "denial") { await assert.rejects(x.signer.call("issue",{candidate:x.config.operatorCandidate})); assert.equal((await x.signer.call("status")).native.signCalls,0); }
    else { const value = {...record.candidate,approval:record.approval};const out = await x.signer.call("issue",{candidate:value}); assert.equal(out.version,"KRONOS_NATIVE_SIGNER_RESULT_V2"); assert.deepEqual(await x.signer.call("issue",{candidate:value}),out); }
    if(suite === "process") { const rows = await Promise.all(["operator","signer","witness","vault"].map(n=>x.workers.get(n).call("status")));assert.equal(new Set(rows.map(v=>v.pid)).size,4);assert(rows.every(v=>v.pid!==process.pid));assert.deepEqual(rows[0].keyRoles,["operator"]);assert.deepEqual(rows[2].keyRoles,["witness"]);assert.deepEqual(rows[3].keyRoles,[]); }
  });
  else if (["rollback","dual-rollback"].includes(suite)) for (const rollbackTarget of (suite === "rollback" ? ["operator", "witness"] : ["both"])) for (const action of ["approve","deny"]) await withFleet(async x => {
    const beforeOperator = x.capture("operator"), beforeWitness = x.capture("witness"), record = await x.decide(action);
    await x.workers.get("operator").close(); if(rollbackTarget!=="witness") x.restore("operator",beforeOperator);
    if(rollbackTarget!=="operator") { await x.witness.close();x.restore("witness",beforeWitness);await x.start("witness","witness",{mode:"open-existing"}); }
    await x.start("operator","operator",{mode:"open-existing"});
    await assert.rejects(x.op("pending"));await assert.rejects(x.decide("approve",{reviewHash:record.decision.reviewHash}));
    assert.equal((await x.vault.call("operator-latest")).sequence,1);
  });
  else if (suite === "fork") for(const actions of [["APPROVED","DENIED"],["APPROVED","APPROVED"],["DENIED","DENIED"]]) direct(({x,cfg,config,record})=>{
    const a = actions[0]==="APPROVED"?record:f.record(t.candidate(),cfg.registry,config,{action:"DENIED",reason:"EVIDENCE"});
    const b = structuredClone(actions[1]==="APPROVED"?record:f.record(t.candidate(),cfg.registry,config,{action:"DENIED",reason:"POLICY"}));
    if(actions[0]===actions[1]&&actions[0]==="APPROVED") { b.approval=t.f.signApproval({...b.approval.approval,nonce:"e".repeat(64)});b.decision=w.seal({...b.decision,nonce:b.approval.approval.nonce,approvalHash:b.approval.approval.approvalHash},"decisionHash");b.signature=crypto.sign(null,d.decisionBytes(b.decision),t.f.t.extraKey.privateKey).toString("base64"); }
    const initial=x.witness.proof(nonce), ra=req(a,config,initial), rb=req(b,config,initial);x.witness.append(ra);assert.throws(()=>x.witness.append(rb));assert.equal(x.vault.latest().sequence,1);assert.equal(x.witness.status().state,"FROZEN");
  });
  else if(suite === "sequence") direct(({x,config,record})=>{
    const a=req(record,config,x.witness.proof(nonce));
    for(const change of [{sequence:2},{sequence:0},{sequence:100},{previousCheckpointHash:"f".repeat(64)},{writerEpoch:2},{writerStoreId:"foreign"},{ledgerId:"foreign"}]){const b=w.seal({...a,...change},"appendHash");assert.throws(()=>r.replay([entry(b)],config));}
    const e=entry(a);assert.throws(()=>r.replay([e,e],config));
    x.witness.append(a);assert.deepEqual(x.witness.append(a),x.witness.append(a));assert.equal(x.vault.latest().sequence,1);
  });
  else if(suite === "epoch") direct(({x,config,record})=>{
    const a=req(record,config,x.witness.proof(nonce));x.witness.append(a);
    const body={version:t.ipc.V.epoch,operatorId:config.operators[0].operatorId,identityHash:w.hashValue(config.witnessIdentity),witnessId:config.witnessIdentity.witnessId,witnessEpoch:1,fromStore:"ordinary-store",fromEpoch:1,toStore:"ordinary-store-next",toEpoch:2,nonce,issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+300000).toISOString()};
    const legacyTransition=t.signed(body,t.f.t.extraKey.privateKey);
    const bare=w.seal({...a,kind:"TRANSITION",record:null,transition:legacyTransition,sequence:2,previousCheckpointHash:a.appendHash},"appendHash");assert.throws(()=>r.append(bare,config));
    const transition=t.signed({version:r.V.transition,...r.common(config),operatorId:config.operators[0].operatorId,transition:legacyTransition},t.f.t.extraKey.privateKey);
    const request=w.seal({...bare,transition},"appendHash");x.witness.append(request);
    const proof=x.witness.proof(nonce);assert.throws(()=>r.verifyProof(proof,config,{challengeNonce:nonce,now,writerStoreId:"ordinary-store",writerEpoch:1}));assert.equal(r.verifyProof(proof,config,{challengeNonce:nonce,now,writerStoreId:"ordinary-store-next",writerEpoch:2}).writerEpoch,2);
    assert.throws(()=>require("../kronos/research-qualification-operator-retention").consume(x.gate,{...record.candidate,approval:record.approval},now));
    const newer=t.candidate("runtime","new-epoch"), next=f.record(newer,record.registry,config), newRequest=req(next,config,proof);x.witness.append(newRequest);
    assert.equal(require("../kronos/research-qualification-operator-retention").consume(x.gate,newer,now).decisionHash,next.decision.decisionHash);
    const old=w.seal({...a,sequence:4,previousCheckpointHash:newRequest.appendHash},"appendHash");assert.throws(()=>x.witness.append(old));
  });
  else if(suite === "lost-response") for(const lostRole of ["operator","witness"]) for(const action of ["approve","deny"]) await withFleet(async x=>{
    let lost=false;x.fault=async(message,deliver)=>{const value=await deliver();if(!lost&&message.from.role===lostRole&&message.command==="operator-append"){lost=true;t.unavailable("IPC_LOST_RESPONSE");}return value;};
    const review=await x.op("inspect",{requestId:x.id});await assert.rejects(x.decide(action,review));x.fault=null;
    if(lostRole==="witness") await x.witness.call("operator-recover");
    assert.equal((await x.op("status")).recoveryRequiredCount,1);
    const original=await x.workers.get("operator").call("local-decision",{requestId:x.id}), count=x.events.filter(e=>e.kind==="operator-sign").length, recovered=await x.decide(action,review);assert.deepEqual(recovered,original);assert.equal(x.events.filter(e=>e.kind==="operator-sign").length,count);assert.equal((await x.vault.call("operator-latest")).sequence,1);
  });
  else if(suite === "crash") for(const stage of ["before-decision-commit","after-persist","after-witness-commit","after-vault-publication","after-witness-ack","after-retained-marker"]) await withFleet(async x=>{
    const witnessStage=["after-witness-commit","after-vault-publication"].includes(stage), target=witnessStage?x.witness:x.workers.get("operator"), review=await x.op("inspect",{requestId:x.id});
    await target.call("crash-at",{stage});await assert.rejects(x.decide("deny",review));
    await x.restart(witnessStage?"witness":"operator");
    if(witnessStage) await x.witness.call("operator-recover");
    if(stage==="before-decision-commit") {await assert.rejects(x.decide("deny",review));assert.equal(await x.vault.call("operator-latest"),null);}
    else {const original=await x.workers.get("operator").call("local-decision",{requestId:x.id});assert.deepEqual(await x.decide("deny",review),original);assert.equal((await x.vault.call("operator-latest")).sequence,1);}
  });
  else if(suite === "freshness") direct(({x,config,record})=>{
    const a=req(record,config,x.witness.proof(nonce));x.witness.append(a);const proof=x.witness.proof(nonce);
    for(const requirements of [{challengeNonce:"d".repeat(64),now},{challengeNonce:nonce,now:now+300000},{challengeNonce:nonce,now,minimumSequence:2},{challengeNonce:nonce,now,writerStoreId:"foreign",writerEpoch:1},{challengeNonce:nonce,now,expectedCheckpoint:"d".repeat(64)}])assert.throws(()=>r.verifyProof(proof,config,requirements));
    const sign=require("./fixtures/kronos-witness-evidence").config().signWitness;
    for(const change of [{sequence:0},{checkpoint:"b".repeat(64)},{writerEpoch:2},{ledgerId:"foreign"},{challengeNonce:"f".repeat(64)}]) {const bad=structuredClone(proof);Object.assign(bad.view.body,change);bad.view.signature=sign(w.signedBytes(bad.view.body));assert.throws(()=>r.verifyProof(bad,config,{challengeNonce:nonce,now}));}
    const gate = require("../kronos/research-qualification-operator-retention");
    const moving = gate.createGate({config, adapter: x.adapter, now: () => now + 50});
    assert.equal(gate.consume(moving, {...record.candidate, approval: record.approval}, now).consumedAt, new Date(now + 50).toISOString());
    const backwards = gate.createGate({config, adapter: x.adapter, now: () => now - 1});assert.throws(() => gate.consume(backwards, {...record.candidate, approval: record.approval}, now));
    const expired = gate.createGate({config, adapter: x.adapter, now: () => now + 300000});assert.throws(() => gate.consume(expired, {...record.candidate, approval: record.approval}, now));
    assert.throws(() => gate.consume({}, {...record.candidate, approval: record.approval}, now));
    const forged=structuredClone(proof);forged.view.body.sequence=0;forged.view.signature=t.f.t.extraKey.publicKey;assert.throws(()=>r.verifyProof(forged,config,{challengeNonce:nonce,now}));
    assert.throws(()=>r.verifyProof(proof,{...config,ledgerId:"other"},{challengeNonce:nonce,now}));
  });
  else if(suite === "signer") await withFleet(async x=>{
    await assert.rejects(x.signer.call("issue",{candidate:x.config.operatorCandidate}),/RETENTION_REQUIRED/);assert.equal((await x.signer.call("status")).native.signCalls,0);
    const record=await x.decide();const value={...record.candidate,approval:record.approval};const out=await x.signer.call("issue",{candidate:value});
    assert.equal(out.operatorRetention.body.decisionHash,record.decision.decisionHash);assert.equal((await x.signer.call("status")).native.signCalls,3);
    assert.deepEqual(await x.signer.call("issue",{candidate:value}),out);assert.equal((await x.signer.call("status")).native.signCalls,3);
  });
  else if(suite === "proof") {
    let saved;await withFleet(async x=>{const record=await x.decide("deny"),proof=await x.retentionProof();saved={config:x.config,proof,requirements:{challengeNonce:nonce,now,expectedDecisionHash:record.decision.decisionHash}};});
    const fleet=new t.Fleet(saved.config);try{const v=await fleet.start("verifier","verifier");assert.equal((await v.call("verify-retention",saved)).verified,true);const bad=structuredClone(saved);bad.proof.history[0].entry.append.record.decision.reason="POLICY";await assert.rejects(v.call("verify-retention",bad));}finally{await fleet.dispose();}
  }
  else if(suite === "provenance") await withFleet(async x=>{
    const record=await x.decide(),proof=await x.retentionProof();assert.deepEqual(proof.history[0].entry.append.record.decision.context.research,x.config.research);
    for(const key of Object.keys(x.config.research)){const bad=structuredClone(proof);bad.history[0].entry.append.record.decision.context.research[key]=null;assert.throws(()=>r.verifyProof(bad,cfgFor(x.config),{challengeNonce:nonce,now}));}
  },{research:{version:"KRONOS_OPERATOR_RESEARCH_CONTEXT_V2",modelIdentifier:"kronos-fixture",modelRevision:"model-v1",runtimeRevision:t.config().binding.runtimeRevision,forecastTimestamp:new Date(now-1000).toISOString(),forecastContractVersion:"FORECAST_V1",researchContractVersion:"KRONOS_AUTO_SHADOW_PROTOCOL_V1",inputCutoff:new Date(now-2000).toISOString()}});
  else if(suite === "secrets") direct(({x,config,record})=>{
    const a=req(record,config,x.witness.proof(nonce));for(const key of ["privateKey","AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY","SessionToken","OIDC_TOKEN","Authorization","LOGIN_PIN","ADMIN_PIN","KRONOS_SERVICE_TOKEN","cookies","environmentDump","path"]){assert.throws(()=>r.append({...a,[key]:"forbidden"},config));assert.throws(()=>r.safe({[key]:key==="path"?"C:\\secret\\file":"Bearer forbidden"}));}
    r.safe(a);assert.throws(()=>r.safe({value:"eyJabcdefghijk.abcdefgh.abcdefgh"}));assert.throws(()=>r.safe({value:"https://example.test/?token=forbidden"}));
  });
  else if(suite === "boundary") {
    const cp=require("node:child_process");const result=cp.spawnSync(process.execPath,[path.join(__dirname,"smoke-test-kronos-operator-boundary.js")],{encoding:"utf8",timeout:180000,windowsHide:true});assert.equal(result.status,0,result.stderr+result.stdout);
    assert.equal(require("../kronos/research-backup-adapter").isQualifiedRealProvider(),false);
  } else throw Error("UNKNOWN_SUITE");
  guard.assertClean();console.log("Operator retention " + suite + ": PASS");
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>guard.restore());
