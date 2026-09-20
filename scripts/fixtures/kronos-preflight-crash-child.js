"use strict";
const f=require("./kronos-preflight-evidence"),data=JSON.parse(process.argv[2]);
let journal;
try{
 const auth=f.authority(),candidate=f.candidate();
 journal=f.openDurableJournal(data.file,f.config({mode:"open-existing",witness:data.witness,operatorAuthority:auth}));
 const grant=f.grant(auth,candidate);
 if(data.stage==="accepted")process.exit(77);
 journal.reserve(grant);if(data.stage==="reserved")process.exit(77);
 const envelope=f.t.signed(candidate.attestation,candidate.request,f.t.registry());
 if(data.stage==="signed")process.exit(77);
 journal.recordEnvelope(candidate.request.requestId,envelope);if(data.stage==="envelope")process.exit(77);
 journal.recordReceipt(candidate.request.requestId);if(data.stage==="receipt")process.exit(77);
 journal.complete(candidate.request.requestId);process.exit(77);
}catch(error){console.log(error.code||"FAILED");process.exit(2);}
