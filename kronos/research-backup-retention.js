"use strict";
const c=require("./research-backup-contracts"),{hashValue}=require("./research-hash");
const VERSION="KRONOS_RETENTION_REQUIREMENT_V2";
const POLICIES=Object.freeze({PROSPECTIVE_EVIDENCE_V1:null,SNAPSHOT_DAILY_V1:30,SNAPSHOT_WEEKLY_V1:90,SNAPSHOT_MONTHLY_V1:400,QUALIFICATION_SHORT_V1:1});
function validate(r){
 c.shape(r,"retentionVersion,policyId,mode,artifactClass,approvedAt,minimumRetainUntil,approval,productionApproved,policyHash");
 c.check(r.retentionVersion===VERSION&&Object.hasOwn(POLICIES,r.policyId)&&r.approval==="FIXTURE_ONLY"&&r.productionApproved===false);
 c.check(["GOVERNANCE","COMPLIANCE"].includes(r.mode),"BACKUP_RETENTION_UNVERIFIED");
 c.iso(r.approvedAt);c.iso(r.minimumRetainUntil);c.check(r.minimumRetainUntil>r.approvedAt);
 const kind=r.policyId.startsWith("SNAPSHOT_")?"SNAPSHOT":r.policyId.startsWith("QUALIFICATION_")?"QUALIFICATION":"EVIDENCE";c.check(r.artifactClass===kind);
 const days=(Date.parse(r.minimumRetainUntil)-Date.parse(r.approvedAt))/86400000;c.check(days>0&&days<=36500&&(POLICIES[r.policyId]===null||days===POLICIES[r.policyId]));
 const {policyHash,...body}=r;c.check(hashValue(body)===policyHash);c.safe(r);return r;
}
function fixtureRequirement(policyId,approvedAt,evidenceDays,mode){
 c.check(Object.hasOwn(POLICIES,policyId));const days=POLICIES[policyId]===null?evidenceDays:POLICIES[policyId];c.check(Number.isSafeInteger(days)&&days>0);
 const body={retentionVersion:VERSION,policyId,mode,artifactClass:policyId.startsWith("SNAPSHOT_")?"SNAPSHOT":policyId.startsWith("QUALIFICATION_")?"QUALIFICATION":"EVIDENCE",approvedAt:c.iso(approvedAt),minimumRetainUntil:new Date(Date.parse(approvedAt)+days*86400000).toISOString(),approval:"FIXTURE_ONLY",productionApproved:false};return validate({...body,policyHash:hashValue(body)});
}
function appropriate(r,type){validate(r);c.check(r.artifactClass==="QUALIFICATION"||(type.startsWith("snapshot")?r.artifactClass==="SNAPSHOT":r.artifactClass==="EVIDENCE"));}
function verify(required,actual){validate(required);c.shape(actual,"mode,retainUntil,policyHash,encryptionStatus");c.iso(actual.retainUntil);c.check(actual.mode===required.mode&&actual.retainUntil>=required.minimumRetainUntil&&actual.policyHash===required.policyHash&&actual.encryptionStatus==="PROVIDER_MANAGED","BACKUP_RETENTION_UNVERIFIED");}
module.exports={VERSION,POLICIES,validate,fixtureRequirement,appropriate,verify};
