"use strict";
const {canonicalize,CANONICALIZATION_VERSION}=require("./research-canonical");
const {hashValue}=require("./research-hash");
const {TABLES}=require("./research-db-schema");
const RECOVERY_BUNDLE_VERSION="KRONOS_RECOVERY_BUNDLE_V1";
const COMPRESSION_VERSION="UTF8_NONE_V1";
function check(ok,message){if(!ok)throw Object.assign(new Error(message),{code:"invalid_recovery_artifact"});}
function keys(value,expected){check(value && typeof value==="object" && !Array.isArray(value) && Object.keys(value).sort().join(",")===expected.split(",").sort().join(","),"Unexpected artifact fields.");}
function safeEvidence(value){
  canonicalize(value);
  function walk(item,key=""){
    check(!/(?:token$|password|secret|credential|cookie|(?:login|admin)_?pin|environment|^env$)/i.test(key),"Secret-shaped field excluded from portable evidence.");
    if(typeof item==="string"){
      check(!/(?:KRONOS_SERVICE_TOKEN|LOGIN_PIN|ADMIN_PIN|Bearer\s|-----BEGIN .*PRIVATE KEY)/i.test(item),"Secret-shaped value excluded.");
      check(!/(?:[a-z]:[\\/]|\\\\|(?:^|\s)\/(?!securityName$)[\w.~-]+(?:\/|$))/i.test(item),"Absolute filesystem path excluded.");
      check(!/[a-z][a-z0-9+.-]*:\/\/[^\s/]*@/i.test(item) && !/[?&](?:token|key|api_key|password|signature|credential)=/i.test(item),"Credential-bearing URL excluded.");
    }else if(Array.isArray(item)) item.forEach(v=>walk(v));
    else if(item && typeof item==="object") for(const [k,v] of Object.entries(item))walk(v,k);
  }
  walk(value);
}
function recordShape(table,record){
  const spec=TABLES[table];check(spec && table!=="backup_outbox","Unknown recovery record class.");
  keys(record,["id","recordContractVersion","productionInfluence",...(spec.noCreatedAt?[]:["createdAt"]),...Object.keys(spec.columns),...spec.extra].join(","));
  check(record.recordContractVersion===spec.version && record.productionInfluence===false,"Invalid record version/influence.");
}
function blobReferences(value,set=new Set()){
  if(Array.isArray(value))value.forEach(v=>blobReferences(v,set));
  else if(value && typeof value==="object")for(const [key,v] of Object.entries(value)){
    if(["blobHash","inputHash","rawPathsHash","normalizedPathsHash","evidenceHash"].includes(key) && v!==null)set.add(v);
    if(key==="hash" && typeof value.ref==="string")set.add(v);
    blobReferences(v,set);
  }
  return set;
}
function contentObject(value){return {hash:hashValue(value),mediaType:"application/json",canonicalizationVersion:CANONICALIZATION_VERSION,compressionVersion:COMPRESSION_VERSION,value};}
function envelope(logical){const logicalContentHash=hashValue(logical);return {bundleId:`sha256:${logicalContentHash}`,logicalContentHash,logical};}
function validateBundle(bundle){
  keys(bundle,"bundleId,logicalContentHash,logical");const l=bundle.logical;
  keys(l,"bundleVersion,canonicalizationVersion,transactionId,transactionSequence,transactionType,createdAt,softwareRevision,transactionHash,request,contents");
  check(l.bundleVersion===RECOVERY_BUNDLE_VERSION && l.canonicalizationVersion===CANONICALIZATION_VERSION,"Unsupported recovery bundle version.");
  check(l.transactionType==="RESEARCH_TRANSACTION" && Number.isSafeInteger(l.transactionSequence) && l.transactionSequence>0,"Invalid transaction sequence/type.");
  check(typeof l.createdAt==="string" && new Date(l.createdAt).toISOString()===l.createdAt && typeof l.softwareRevision==="string" && l.softwareRevision.length>0,"Invalid bundle timestamp/revision.");
  keys(l.request,"id,records,blobs,audit");check(l.transactionId===l.request.id && hashValue(l.request)===l.transactionHash,"Transaction identity/hash mismatch.");
  check(Array.isArray(l.request.records) && Array.isArray(l.request.blobs) && Array.isArray(l.contents),"Invalid transaction collections.");
  for(const item of l.request.records){keys(item,"table,record");check(!["audit_events","backup_outbox"].includes(item.table),"Invalid transaction record class.");recordShape(item.table,item.record);}
  recordShape("audit_events",l.request.audit);
  check(l.createdAt===l.request.audit.createdAt && l.softwareRevision===l.request.audit.softwareVersion,"Bundle metadata must derive from committed audit.");
  const contents=new Map();let previous="";
  for(const item of l.contents){
    keys(item,"hash,mediaType,canonicalizationVersion,compressionVersion,value");
    check(item.mediaType==="application/json" && item.canonicalizationVersion===CANONICALIZATION_VERSION && item.compressionVersion===COMPRESSION_VERSION,"Unsupported content encoding.");
    check(item.hash===hashValue(item.value) && item.hash>previous,"Blob hash/order/duplicate mismatch.");previous=item.hash;contents.set(item.hash,item.value);
  }
  for(const value of l.request.blobs)check(contents.has(hashValue(value)),"Transaction content missing.");
  const required=blobReferences(l.request.records);
  for(const value of l.request.blobs)blobReferences(value,required);
  const queue=[...required];for(let i=0;i<queue.length;i++){const hash=queue[i];check(contents.has(hash),"Referenced content missing.");for(const child of blobReferences(contents.get(hash)))if(!required.has(child)){required.add(child);queue.push(child);}}
  for(const value of l.request.blobs)required.add(hashValue(value));
  check(required.size===contents.size,"Extraneous content is prohibited.");
  safeEvidence(l);
  check(hashValue(l)===bundle.logicalContentHash && bundle.bundleId===`sha256:${bundle.logicalContentHash}`,"Bundle logical hash mismatch.");
  return bundle;
}
function createBundle(store,transactionId){
  const transaction=store.committedTransactions().find(row=>row.request.id===transactionId);check(transaction,"Committed transaction not found.");
  const values=new Map(transaction.request.blobs.map(value=>[hashValue(value),value]));
  const required=blobReferences(transaction.request.records);for(const value of values.values())blobReferences(value,required);
  const queue=[...required];for(let i=0;i<queue.length;i++){const hash=queue[i],value=values.has(hash)?values.get(hash):store.readBlob(hash);values.set(hash,value);for(const child of blobReferences(value))if(!required.has(child)){required.add(child);queue.push(child);}}
  const request=transaction.request;
  return validateBundle(envelope({bundleVersion:RECOVERY_BUNDLE_VERSION,canonicalizationVersion:CANONICALIZATION_VERSION,transactionId:request.id,transactionSequence:transaction.sequence,transactionType:"RESEARCH_TRANSACTION",createdAt:request.audit.createdAt,softwareRevision:request.audit.softwareVersion,transactionHash:transaction.transactionHash,request,contents:[...values.values()].map(contentObject).sort((a,b)=>a.hash.localeCompare(b.hash))}));
}
function serializeBundle(bundle){validateBundle(bundle);return canonicalize(bundle)+"\n";}
function parseBundle(bytes){check(Buffer.byteLength(bytes)<=64*1024*1024,"Bundle size limit exceeded.");const text=Buffer.isBuffer(bytes)?bytes.toString("utf8"):bytes,bundle=JSON.parse(text);validateBundle(bundle);check(text===serializeBundle(bundle),"Noncanonical or truncated bundle encoding.");return bundle;}
module.exports={RECOVERY_BUNDLE_VERSION,COMPRESSION_VERSION,createBundle,validateBundle,serializeBundle,parseBundle,check,keys,safeEvidence};
