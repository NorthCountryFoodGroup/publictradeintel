"use strict";
const f=require("./kronos-research-store");
const {hashValue}=require("../../kronos/research-hash");
const {TABLES}=require("../../kronos/research-db-schema");
function history(store,manualCount=979){
  const requests=[f.transaction("manual-first",[f.entry("forecasts",f.forecast("manual-1"))],f.evidence)];
  if(manualCount>1)requests.push(f.transaction("manual-bulk",Array.from({length:manualCount-1},(_,i)=>f.entry("forecasts",f.forecast(`manual-${i+2}`))),[]));
  requests.push(f.automaticSetup("session"));
  for(let i=0;i<20;i++){
    const request=f.automaticResult("session");request.id=`result-session-${i}`;request.audit.id=`audit-${request.id}`;request.audit.details.transactionId=request.id;
    if(i>0)request.records=request.records.filter((_,n)=>n!==2);
    for(const {table,record:r} of request.records){
      if(table==="job_revisions"){r.jobId=`job-session-${i}`;r.id=`${r.jobId}:${r.revision}`;if(r.forecastId)r.forecastId=`automatic-session-${i}`;}
      if(table==="forecasts"){r.id=`automatic-session-${i}`;r.jobId=`job-session-${i}`;r.ticker=`T${i}`;}
      if(table==="session_revisions"&&r.state==="RUNNING"){r.revision=i+3;r.id=`session-session:${r.revision}`;r.jobCounts.PLANNED=19-i;r.jobCounts.COMPLETED=i+1;if(i===19)r.state="COMPLETED";}
    }
    requests.push(request);
  }
  const future="KRONOS_AUTO_SHADOW_PROTOCOL_FIXTURE_V2";requests.push(f.automaticSetup("future",future),f.automaticResult("future",future));
  const correction={id:"correction-1",recordContractVersion:"KRONOS_CORRECTION_V1",productionInfluence:false,targetId:"manual-1",originalHash:hashValue(f.forecast("manual-1")),changes:[{path:"/securityName",previousValueHash:hashValue("Fixture security"),value:"Corrected fixture name"}],reason:"fixture correction",actor:"test",timestamp:f.timestamp,softwareVersion:"fixture-v1",priorCorrectionId:null};
  requests.push(f.transaction("correction",[f.entry("correction_events",correction)]));
  const actual={complete:true,expectedBars:5,observedBars:5,bars:f.normalized[0]},createdAt="2026-09-28T00:00:00.000Z";
  requests.push(f.transaction("outcome",[f.entry("outcome_attempts",f.make("outcome_attempts","evaluated",{forecastId:"manual-1",attemptKey:"evaluated",state:"EVALUATED",evaluatorVersion:"fixture-v1",evidenceHash:hashValue(actual),reason:null,createdAt})),f.entry("accepted_outcomes",f.make("accepted_outcomes","accepted",{forecastId:"manual-1",attemptId:"evaluated",revision:1,createdAt}))],[actual]));
  requests.push(f.transaction("disposition",[f.entry("forecast_dispositions",f.make("forecast_dispositions","invalidated",{forecastId:"manual-1",replacementForecastId:null,kind:"INVALIDATED",reason:"fixture defect",actor:"test",softwareVersion:"v1"}))]));
  requests.forEach(request=>store.writeTransaction(request));return requests;
}
function snapshot(store){
  const transactions=store.committedTransactions(),records=new Map(),blobs=new Map();
  for(const tx of transactions){for(const item of [...tx.request.records,{table:"audit_events",record:tx.request.audit},{table:"backup_outbox",record:store.readRecord("backup_outbox",tx.request.id).record}])records.set(`${item.table}:${item.record.id}`,store.readRecord(item.table,item.record.id));for(const value of tx.request.blobs)blobs.set(hashValue(value),store.readBlob(hashValue(value)));}
  return {transactions,records:[...records].sort(),blobs:[...blobs].sort(),counts:Object.fromEntries([...Object.keys(TABLES),"content_blobs","research_transactions"].map(table=>[table,store.count(table)])),forecasts:store.findForecasts(),effective:store.readForecast("manual-1",{effective:true})};
}
module.exports={...f,history,snapshot};
