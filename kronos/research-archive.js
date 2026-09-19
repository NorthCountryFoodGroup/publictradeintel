"use strict";
const {gzipSync,gunzipSync}=require("node:zlib");
const {canonicalize,CANONICALIZATION_VERSION}=require("./research-canonical");
const {hashBytes,hashValue}=require("./research-hash");
const {validateBundle,parseBundle,serializeBundle,check,keys,safeEvidence}=require("./research-recovery-bundle");
const ARCHIVE_FORMAT_VERSION="KRONOS_RESEARCH_JSONL_V1",COMPRESSION_VERSION="GZIP_V1",GENESIS="KRONOS_ARCHIVE_GENESIS_V1";
const MAX_BYTES=128*1024*1024,MAX_TRANSACTIONS=2048;
function summarize(bundles){
  const recordCounts={},content=new Set(),partitions=new Map();
  for(const {logical:l} of bundles){
    for(const item of [...l.request.records,{table:"audit_events",record:l.request.audit}])recordCounts[item.table]=(recordCounts[item.table]||0)+1;
    for(const item of l.contents)content.add(item.hash);
    for(const {table,record:r} of l.request.records)if(table==="forecasts"){
      const p={triggerMode:r.triggerMode,protocolVersion:r.protocolVersion,sourceRevision:r.sourceRevision,modelRevision:r.modelRevision,tokenizerRevision:r.tokenizerRevision,outputNormalization:r.outputNormalization};partitions.set(canonicalize(p),p);
    }
  }
  return {recordCounts,contentDependencies:[...content].sort(),partitions:[...partitions].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,v])=>v)};
}
function manifestEnvelope(value){return {manifestHash:hashValue(value),manifest:value};}
function validateManifest(envelope){
  keys(envelope,"manifestHash,manifest");const m=envelope.manifest;
  keys(m,"archiveId,archiveFormatVersion,canonicalizationVersion,compressionVersion,firstTransactionSequence,lastTransactionSequence,previousManifestHash,transactionCount,recordCounts,logicalContentHash,artifactHash,contentDependencies,partitions,sealedAt,softwareRevision,remoteReceipt");
  check(m.archiveFormatVersion===ARCHIVE_FORMAT_VERSION && m.canonicalizationVersion===CANONICALIZATION_VERSION && m.compressionVersion===COMPRESSION_VERSION,"Unsupported archive version/encoding.");
  check(Number.isSafeInteger(m.firstTransactionSequence) && m.firstTransactionSequence>0 && Number.isSafeInteger(m.lastTransactionSequence) && m.lastTransactionSequence>=m.firstTransactionSequence && m.transactionCount===m.lastTransactionSequence-m.firstTransactionSequence+1 && m.transactionCount<=MAX_TRANSACTIONS,"Invalid archive sequence range.");
  check(m.remoteReceipt===null && typeof m.softwareRevision==="string" && m.softwareRevision.length>0 && new Date(m.sealedAt).toISOString()===m.sealedAt,"Invalid archive metadata.");
  check(m.archiveId===`sha256:${m.logicalContentHash}` && /^[a-f0-9]{64}$/.test(m.logicalContentHash) && /^[a-f0-9]{64}$/.test(m.artifactHash),"Invalid archive hashes.");
  check(m.previousManifestHash===GENESIS || /^[a-f0-9]{64}$/.test(m.previousManifestHash),"Invalid manifest predecessor.");
  check(hashValue(m)===envelope.manifestHash,"Manifest hash mismatch.");safeEvidence(m);return envelope;
}
function contiguous(bundles,start){
  check(Array.isArray(bundles) && bundles.length>0 && bundles.length<=MAX_TRANSACTIONS,"Invalid archive transaction count.");
  const ids=new Set();for(let i=0;i<bundles.length;i++){validateBundle(bundles[i]);check(bundles[i].logical.transactionSequence===start+i && !ids.has(bundles[i].logical.transactionId),"Duplicate, reordered or missing transaction.");ids.add(bundles[i].logical.transactionId);}
}
function createArchive(bundles,previous=null,{sealedAt,softwareRevision}={}){
  if(previous)validateManifest(previous);const start=previous?previous.manifest.lastTransactionSequence+1:1;contiguous(bundles,start);
  const logical=Buffer.from(bundles.map(serializeBundle).join(""),"utf8");check(logical.length<=MAX_BYTES,"Archive expansion limit exceeded.");
  const artifact=gzipSync(logical,{level:6}),logicalContentHash=hashBytes(logical);
  const manifest=manifestEnvelope({archiveId:`sha256:${logicalContentHash}`,archiveFormatVersion:ARCHIVE_FORMAT_VERSION,canonicalizationVersion:CANONICALIZATION_VERSION,compressionVersion:COMPRESSION_VERSION,firstTransactionSequence:start,lastTransactionSequence:start+bundles.length-1,previousManifestHash:previous?previous.manifestHash:GENESIS,transactionCount:bundles.length,...summarize(bundles),logicalContentHash,artifactHash:hashBytes(artifact),sealedAt,softwareRevision,remoteReceipt:null});
  validateManifest(manifest);return {manifest,artifact};
}
function validateArchive({manifest,artifact}){
  validateManifest(manifest);check(Buffer.isBuffer(artifact) && artifact.length<=MAX_BYTES && hashBytes(artifact)===manifest.manifest.artifactHash,"Archive artifact hash/size mismatch.");
  const logical=gunzipSync(artifact,{maxOutputLength:MAX_BYTES});check(hashBytes(logical)===manifest.manifest.logicalContentHash,"Archive logical hash mismatch.");
  const text=logical.toString("utf8");check(text.endsWith("\n"),"Truncated JSONL archive.");const lines=text.slice(0,-1).split("\n");check(lines.length<=MAX_TRANSACTIONS,"Too many archive transactions.");
  const bundles=lines.map(line=>parseBundle(line+"\n"));contiguous(bundles,manifest.manifest.firstTransactionSequence);
  check(bundles.length===manifest.manifest.transactionCount && canonicalize(summarize(bundles))===canonicalize({recordCounts:manifest.manifest.recordCounts,contentDependencies:manifest.manifest.contentDependencies,partitions:manifest.manifest.partitions}),"Manifest inventory mismatch.");return bundles;
}
function validateChain(segments,{expectedLastSequence}={}){
  check(Array.isArray(segments) && segments.length>0,"Archive chain required.");let previous=GENESIS,sequence=1;const result=[],ids=new Set();
  for(const segment of segments){const bundles=validateArchive(segment),m=segment.manifest.manifest;check(m.previousManifestHash===previous && m.firstTransactionSequence===sequence,"Broken, missing or reordered archive chain.");for(const b of bundles){check(!ids.has(b.logical.transactionId),"Duplicate transaction identity.");ids.add(b.logical.transactionId);result.push(b);}previous=segment.manifest.manifestHash;sequence=m.lastTransactionSequence+1;}
  if(expectedLastSequence!==undefined)check(sequence-1===expectedLastSequence,"Archive tail missing.");return result;
}
module.exports={ARCHIVE_FORMAT_VERSION,COMPRESSION_VERSION,GENESIS,createArchive,validateManifest,validateArchive,validateChain};
