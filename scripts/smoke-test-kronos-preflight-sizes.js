"use strict";
const assert=require("node:assert/strict"),guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
try{
 const f=require("./fixtures/kronos-signer-sizes"),q=require("../kronos/research-qualification-contracts");
 const measurements=f.measurements();
 for(const row of measurements)for(const name of ["minimum","typical","maximum","worst"]){
  const a=f.make(row.kind,name);q.validateAttestation(a);const exact=q.signingBytes(a);
  assert.equal(exact.length,row[name].bytes);assert.ok(exact.subarray(0,29).equals(Buffer.from("KRONOS_SIGNED_OBSERVATION_V1\n")));
  assert.equal(exact.length<=4096,row[name].kmsFits);
  const p=require("../kronos/research-qualification-preflight-contracts");if(exact.length<=4096)assert.ok(p.kmsRawInput(a).equals(exact));else assert.throws(()=>p.kmsRawInput(a),{code:"KMS_INPUT_TOO_LARGE"});
 }
 assert.ok(measurements.some(row=>!row.maximum.kmsFits));assert.equal(Math.max(...measurements.map(row=>row.worst.bytes)),95793);
 guard.assertClean();console.log(JSON.stringify({kmsDecision:"B",measurements}));console.log("Exact unchanged Ed25519 canonical byte study: PASS");
}finally{guard.restore();}
