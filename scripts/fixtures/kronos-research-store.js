"use strict";
const {TABLES}=require("../../kronos/research-db-schema");
const {hashValue}=require("../../kronos/research-hash");
const {PROTOCOL,PROTOCOL_VERSION,VERSIONS}=require("../../kronos/research-contracts");
const timestamp="2026-09-19T00:00:00.000Z";
const make=(table,id,fields)=>({id,recordContractVersion:TABLES[table].version,createdAt:timestamp,productionInfluence:false,...fields});
const bar=date=>({timestamp:date,open:100,high:102,low:98,close:101,volume:1000});
const input=Array.from({length:252},(_,i)=>bar(new Date(Date.UTC(2025,0,1+i)).toISOString()));
const raw=Array.from({length:8},()=>Array.from({length:5},(_,i)=>bar(new Date(Date.UTC(2026,8,21+i)).toISOString())));
const normalized=structuredClone(raw); raw[0][0].high=97; // Preserve unusual raw output independently.
const evidence=[input,raw,normalized];
function forecast(id,extra={}) {return make("forecasts",id,{ticker:"FIX",securityId:"fixture-security",securityName:"Fixture security",generatedAt:timestamp,inputCutoff:input.at(-1).timestamp,triggerMode:"manual",protocolVersion:null,sessionId:null,jobId:null,inputHash:hashValue(input),rawPathsHash:hashValue(raw),normalizedPathsHash:hashValue(normalized),sourceRevision:"source-v1",modelRevision:"model-v1",tokenizerRevision:"tokenizer-v1",outputNormalization:"deterministic_ohlcv_envelope_v1",executionMode:"deterministic_adapter",horizon:"7-Day",sampleCount:8,analytics:{medianExpectedReturn:.01},providerProvenance:{source:"synthetic fixture",priceTreatment:"unadjusted"},...extra});}
function transaction(id,records=[],blobs=[]) {return {id,records,blobs,audit:make("audit_events",`audit-${id}`,{action:"FIXTURE_WRITE",actor:"fixture",softwareVersion:"slice2a-test",details:{transactionId:id}})};}
const entry=(table,record)=>({table,record});
const counts=(extra={})=>({PLANNED:20,QUEUED:0,RUNNING:0,COMPLETED:0,SKIPPED:0,FAILED:0,...extra});
function automaticSetup(suffix="one",protocolVersion=PROTOCOL_VERSION) {
 const protocol=protocolVersion===PROTOCOL_VERSION ? PROTOCOL : {...structuredClone(PROTOCOL),protocolVersion};
 const legacy={source:"fixture",predictions:[]},regime={regime:"fixture-neutral"};
 const selected=Object.entries(PROTOCOL.strata).flatMap(([stratum,count])=>Array.from({length:count},()=>({stratum})));
 selected.forEach((row,i)=>Object.assign(row,{ticker:`T${i}`,sector:`Sector ${i%4}`,order:i}));
 const universe={tickers:selected.map(row=>row.ticker)};
 const cohort={id:`cohort-${suffix}`,contractVersion:VERSIONS.cohort,protocolVersion,triggerMode:"automatic_shadow",productionInfluence:false,createdAt:timestamp,universeSnapshot:{ref:"fixture-universe",hash:hashValue(universe)},legacySnapshot:{ref:`legacy-${suffix}`,hash:hashValue(legacy)},selectorVersion:"fixture-selector",seed:"fixture",frozenAt:timestamp,sectorConcentrationCap:.25,selected,reserves:[],rejected:[]};
 const sessionId=`session-${suffix}`;
 const records=[entry("protocols",make("protocols",protocolVersion,{protocolVersion,definition:protocol})),entry("legacy_snapshots",make("legacy_snapshots",`legacy-${suffix}`,{blobHash:hashValue(legacy),capturedAt:timestamp})),entry("regime_snapshots",make("regime_snapshots",`regime-${suffix}`,{blobHash:hashValue(regime),capturedAt:timestamp})),entry("cohorts",make("cohorts",cohort.id,{protocolVersion,blobHash:hashValue(cohort),legacySnapshotId:`legacy-${suffix}`,regimeSnapshotId:`regime-${suffix}`})),entry("sessions",make("sessions",sessionId,{protocolVersion,cohortId:cohort.id,idempotencyKey:sessionId}))];
 for(let i=0;i<20;i++) {const id=`job-${suffix}-${i}`;records.push(entry("jobs",make("jobs",id,{sessionId,ticker:`T${i}`,horizon:"7-Day",idempotencyKey:id})),entry("job_revisions",make("job_revisions",`${id}:1`,{jobId:id,revision:1,state:"PLANNED",forecastId:null,reason:null})));}
 records.push(entry("session_revisions",make("session_revisions",`${sessionId}:1`,{sessionId,revision:1,state:"PLANNED",jobCounts:counts(),reason:null})));
 return transaction(`setup-${suffix}`,records,[legacy,regime,cohort,universe]);
}
function automaticResult(suffix="one",protocolVersion=PROTOCOL_VERSION) {
 const sessionId=`session-${suffix}`,jobId=`job-${suffix}-0`,forecastId=`automatic-${suffix}`;
 return transaction(`result-${suffix}`,[
 entry("job_revisions",make("job_revisions",`${jobId}:2`,{jobId,revision:2,state:"QUEUED",forecastId:null,reason:null})),
 entry("job_revisions",make("job_revisions",`${jobId}:3`,{jobId,revision:3,state:"RUNNING",forecastId:null,reason:null})),
 entry("session_revisions",make("session_revisions",`${sessionId}:2`,{sessionId,revision:2,state:"QUEUED",jobCounts:counts({PLANNED:19,QUEUED:1}),reason:null})),
 entry("forecasts",forecast(forecastId,{ticker:"T0",triggerMode:"automatic_shadow",protocolVersion,sessionId,jobId})),
 entry("job_revisions",make("job_revisions",`${jobId}:4`,{jobId,revision:4,state:"COMPLETED",forecastId,reason:null})),
 entry("session_revisions",make("session_revisions",`${sessionId}:3`,{sessionId,revision:3,state:"RUNNING",jobCounts:counts({PLANNED:19,COMPLETED:1}),reason:null}))
 ],evidence);
}
module.exports={timestamp,make,forecast,transaction,entry,evidence,input,raw,normalized,automaticSetup,automaticResult};
