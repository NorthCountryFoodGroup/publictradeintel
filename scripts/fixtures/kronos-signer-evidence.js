"use strict";
// Reuses reviewed deterministic fictional keys. No random generation or operational key material.
const f = require("./kronos-qualified-evidence");
const s = require("../../kronos/research-qualification-signer-contracts");
const { createPinnedVerifier } = require("../../kronos/research-qualification-signer-verifier");
const crypto = require("node:crypto");
const extraPrivateKey=crypto.createPrivateKey({key:Buffer.concat([Buffer.from("302e020100300506032b657004220420","hex"),Buffer.alloc(32,85)]),format:"der",type:"pkcs8"});
const extraKey={privateKey:extraPrivateKey,publicKey:crypto.createPublicKey(extraPrivateKey).export({format:"pem",type:"spki"})};
const clone = structuredClone, iso = n => new Date(n).toISOString();
function rehash(value, field) { const { [field]: ignored, ...body } = value; return s.seal(body,field); }
function registry() {
  return s.seal({version:s.VERSION.registry,registryId:"fictional-registry",registryRevision:1,
    createdAt:iso(f.time-3600000),expiresAt:iso(f.time+23*3600000),
    signers:f.issuers.map(row=>({
      signerId:row.id,domain:row.id==="independent"?"independent-restore":row.domain,
      algorithm:"Ed25519",publicKey:row.publicKey,keyFingerprint:s.fingerprint(row.publicKey),
      issuer:"fictional-operator-"+row.id,status:"ACTIVE",createdAt:iso(f.time-86400000),
      notBefore:iso(f.time-3600000),notAfter:iso(f.time+30*86400000),retiredAt:null,revokedAt:null,
      revocationReasonCode:null,replacementSignerId:null,
      allowedAttestationTypes:[f.contracts.TYPES[row.domain]],allowedEnvironmentIds:["fixture"],
      allowedStreamIds:[f.binding.streamId],allowedServiceIdentities:["fictional-observer-"+row.id],softwareRevisions:[f.binding.softwareRevision],
      policyVersions:[f.POLICY.version]
    }))}, "registryHash");
}
function request(a, reg, id=s.role(a)==="independent-restore"?"independent":a.domain) {
  return s.seal({version:s.VERSION.request,requestId:"request-"+id,nonce:f.hashValue("nonce-"+id),
    signerId:id,attestationType:a.attestationType,evidenceContract:a.attestationVersion,
    canonicalEvidenceHash:a.evidenceHash,attestationHash:a.attestationHash,binding:clone(a.binding),
    runId:a.runId,requestedAt:f.instant,expiresAt:iso(f.time+300000),operatorRef:"approval-"+id,
    serviceIdentity:"fictional-observer-"+id,registryId:reg.registryId,registryRevision:reg.registryRevision,
    registryHash:reg.registryHash}, "requestHash");
}
function signed(a, r, reg, keyId=r.signerId) {
  const key=(keyId==="provider-next"?extraKey:f.keys[keyId]).privateKey;
  const body={version:s.VERSION.envelope,attestation:clone(a),request:clone(r),signerId:r.signerId,
    keyFingerprint:reg.signers.find(row=>row.signerId===r.signerId).keyFingerprint,algorithm:"Ed25519",
    signature:crypto.sign(null,f.contracts.signingBytes(a),key).toString("base64"),signedAt:f.instant};
  return s.seal({...body,contextSignature:crypto.sign(null,s.envelopeBytes(body),key).toString("base64")},"envelopeHash");
}
function receipt(e) {
  return s.seal({version:s.VERSION.receipt,requestId:e.request.requestId,nonce:e.request.nonce,
    requestHash:e.request.requestHash,attestationHash:e.attestation.attestationHash,
    evidenceHash:e.attestation.evidenceHash,attestationType:e.attestation.attestationType,
    signedEnvelopeHash:e.envelopeHash,signerId:e.signerId,keyFingerprint:e.keyFingerprint,
    issuedAt:e.signedAt,result:"ISSUED",reason:null},"receiptHash");
}
function journal() {
  return s.seal({version:s.VERSION.journal,journalId:"fictional-journal",revision:1,
    createdAt:iso(f.time-1000),expiresAt:iso(f.time+23*3600000),entries:[]},"journalHash");
}
function pins(reg,j) {return {registry:reg,registryPin:{hash:reg.registryHash,revision:reg.registryRevision},
  journal:j,journalPin:{hash:j.journalHash,revision:j.revision}};}
function setup(reg=registry()) {
  const envelopes={}; let j=journal();
  for(const id of ["provider","runtime","restore","independent"]) {
    const a=id==="independent"?f.attestation("restore",f.restoreEvidence(true,true)):f.attestation(id);
    const r=request(a,reg,id); s.assess(r,a,reg,f.binding,f.time);
    j=s.reserve(j,r,a,f.time); const e=signed(a,r,reg); envelopes[id]=e;
    j=s.complete(j,r,receipt(e),f.time);
  }
  let now=f.time;
  return {reg,j,envelopes,verifier:createPinnedVerifier({...pins(reg,j),binding:f.binding,now:()=>now}),
    at:value=>now=value};
}
module.exports={extraKey,f,s,clone,iso,rehash,registry,request,signed,receipt,journal,pins,setup,createPinnedVerifier};
