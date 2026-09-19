"use strict";
const {readArtifacts}=require("./research-artifact-store");
const {validateChain}=require("./research-archive");
const {createBundle,check}=require("./research-recovery-bundle");
function inventory(root,{store,expectedLastSequence}={}){
  const {bundles,segments,stagingEntries}=readArtifacts(root),archived=segments.length?validateChain(segments):[];
  const bySequence=new Map();for(const b of [...bundles,...archived]){const seq=b.logical.transactionSequence,old=bySequence.get(seq);check(!old||old.bundleId===b.bundleId,"Bundle/archive conflict.");bySequence.set(seq,b);}
  const identities=new Set();for(const b of bySequence.values()){check(!identities.has(b.logical.transactionId),"Duplicate transaction identity.");identities.add(b.logical.transactionId);}
  const committed=store?store.committedTransactions():null;
  if(committed)for(const b of bySequence.values())check(createBundle(store,b.logical.transactionId).bundleId===b.bundleId,"Artifact differs from committed evidence.");
  const last=expectedLastSequence??(committed?committed.length:Math.max(0,...bySequence.keys()));check(Number.isSafeInteger(last)&&last>=0,"Invalid inventory high-water mark.");
  check([...bySequence.keys()].every(seq=>seq<=last),"Artifact exceeds expected history.");
  const missingSequenceRanges=[];let next=1;for(const seq of [...bySequence.keys()].sort((a,b)=>a-b)){if(seq>next)missingSequenceRanges.push([next,seq-1]);next=seq+1;}if(next<=last)missingSequenceRanges.push([next,last]);
  const rows=committed?committed.map(row=>({id:row.request.id,sequence:row.sequence})):[...bySequence].sort(([a],[b])=>a-b).map(([sequence,b])=>({id:b.logical.transactionId,sequence}));
  return {integrity:missingSequenceRanges.length?"INCOMPLETE":"VERIFIED",tailCompletenessKnown:expectedLastSequence!==undefined||Boolean(committed),latestSealedSequence:segments.at(-1)?.manifest.manifest.lastTransactionSequence||0,missingSequenceRanges,stagingEntries,offDiskVerified:false,transactions:rows.map(row=>{const b=bySequence.get(row.sequence),segment=segments.find(s=>row.sequence>=s.manifest.manifest.firstTransactionSequence&&row.sequence<=s.manifest.manifest.lastTransactionSequence);return {...row,bundleId:b?.bundleId||null,hasBundleFile:bundles.some(v=>v.logical.transactionSequence===row.sequence),archiveId:segment?.manifest.manifest.archiveId||null,outboxState:b?"BUNDLE_READY":"PENDING_BUNDLE",durability:b?"PORTABLE_RECOVERY_READY":"LOCAL_COMMITTED"};})};
}
module.exports={inventory};
