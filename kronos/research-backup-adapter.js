"use strict";
const c=require("./research-backup-contracts");
const methods=["capabilities","putImmutable","headExact","getExact","describeRetention","listPrefix"];
const needed=["conditionalCreation","exactVersionIdentity","exactRetrieval","readbackVerification","retentionEvidence","boundedListing","encryptionEvidence"];
function assertCapabilities(cap){c.shape(cap,"adapterVersion,providerType,containerRef,classification,conditionalCreation,exactVersionIdentity,exactRetrieval,readbackVerification,retentionEvidence,boundedListing,encryptionEvidence");c.check(cap.adapterVersion===c.VERSIONS.adapter);c.label(cap.providerType);c.label(cap.containerRef);c.check(["NON_PRODUCTION","REAL_UNQUALIFIED"].includes(cap.classification));for(const name of needed)c.check(typeof cap[name]==="boolean");return needed.every(name=>cap[name]);}
function createAdapter(provider,context){
 c.identity(context);c.check(methods.every(name=>typeof provider[name]==="function"));const capabilities=structuredClone(provider.capabilities());assertCapabilities(capabilities);
 async function invoke(name,args){try{return await provider[name](...args);}catch(error){throw c.failure(error?.code,error?.retryable===true);}}
 function scoped(locator){c.sameContext(locator,context);c.check(typeof locator.objectKey==="string"&&locator.objectKey.startsWith(c.prefix(context)));c.check(!locator.objectKey.includes("..")&&!locator.objectKey.includes("\\"));}
 const adapter={capabilities:()=>structuredClone(capabilities),putImmutable(d,bytes){c.descriptor(d);scoped(d);c.decodeObject(d,bytes);return invoke("putImmutable",[structuredClone(d),Buffer.from(bytes)]);},headExact(l){scoped(l);c.providerVersion(l.versionId);return invoke("headExact",[structuredClone(l)]);},getExact(l){scoped(l);c.providerVersion(l.versionId);return invoke("getExact",[structuredClone(l)]);},describeRetention(l){scoped(l);c.providerVersion(l.versionId);return invoke("describeRetention",[structuredClone(l)]);},listPrefix(prefix,cursor=null,limit=100){c.check(prefix===c.prefix(context)||prefix.startsWith(c.prefix(context)));c.check(!prefix.includes("..")&&!prefix.includes("\\")&&Number.isInteger(limit)&&limit>0&&limit<=1000);return invoke("listPrefix",[prefix,cursor,limit]);},verifyExact(l,expected,policy){return require("./research-backup-verification").verifyExact(adapter,l,expected,policy);}};
 return Object.freeze(adapter);
}
// Offline-only release: no registration or caller-supplied boolean can qualify a real provider.
function isQualifiedRealProvider(){return false;}
module.exports={createAdapter,assertCapabilities,isQualifiedRealProvider};
