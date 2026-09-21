"use strict";
// Pure public validation. No transport, files, private keys or signing capability.
const crypto = require("node:crypto");
const w = require("./research-qualification-witness-contracts");
const s = require("./research-qualification-signer-contracts");
const c = require("./research-backup-contracts");
const V = Object.freeze({challenge: "KRONOS_OFFLINE_IPC_CHALLENGE_V1", request: "KRONOS_OFFLINE_IPC_REQUEST_V1", response: "KRONOS_OFFLINE_IPC_RESPONSE_V1", epoch: "KRONOS_OFFLINE_WRITER_TRANSITION_V1"});
const operations = ["history", "view", "append"];
function bytes(body) { return Buffer.from(body.version + "\n" + w.canonicalize(body), "utf8"); }
function verify(signed, publicKey) {
  c.shape(signed, "body,signature");
  w.check(typeof signed.signature === "string" && /^[A-Za-z0-9+/]{86}==$/.test(signed.signature), "IPC_SIGNATURE");
  w.check(crypto.verify(null, bytes(signed.body), s.publicKey(publicKey), Buffer.from(signed.signature, "base64")), "IPC_SIGNATURE"); return signed.body;
}
function scope(body, client, identity) {
  w.check(client && body.signerId === client.signerId && body.storeId === client.storeId && body.writerEpoch === client.writerEpoch && body.witnessId === identity.witnessId && body.witnessEpoch === identity.epoch, "IPC_IDENTITY");
  const row = identity.stores.find(x => x.storeId === client.storeId);
  w.check(row && row.writerEpoch === client.writerEpoch, "IPC_WRITER_EPOCH");
}
function challenge(body, client, identity, now) {
  c.shape(body, "version,signerId,witnessId,witnessEpoch,storeId,writerEpoch,requestHash,nonce,issuedAt,expiresAt");
  w.check(body.version === V.challenge, "IPC_VERSION"); scope(body, client, identity);
  c.digest(body.requestHash); c.digest(body.nonce);
  w.check(s.time(body.expiresAt) - s.time(body.issuedAt) === 300000 && s.time(body.issuedAt) <= now && now < s.time(body.expiresAt), "IPC_EXPIRED"); return body;
}
function requestHash(operation, payload) { w.check(operations.includes(operation), "IPC_OPERATION"); return w.hashValue({operation, payload}); }
function verifyRequest(packet, {client, identity, now}) {
  c.shape(packet, "challenge,request");
  const ch = challenge(verify(packet.challenge, identity.publicKey), client, identity, now);
  const body = verify(packet.request, client.publicKey);
  c.shape(body, "version,signerId,witnessId,witnessEpoch,storeId,writerEpoch,challengeHash,operation,payload,requestHash");
  w.check(body.version === V.request, "IPC_VERSION"); scope(body, client, identity);
  w.check(body.challengeHash === w.hashValue(packet.challenge) && body.requestHash === ch.requestHash && body.requestHash === requestHash(body.operation, body.payload), "IPC_REQUEST_BINDING");
  if (body.operation === "append") w.check(body.payload.storeId === client.storeId && body.payload.writerEpoch === client.writerEpoch, "IPC_WRITER_EPOCH");
  if (body.operation === "view") { c.shape(body.payload, "storeId,challengeNonce"); w.check(body.payload.storeId === client.storeId, "IPC_STORE"); c.digest(body.payload.challengeNonce); }
  if (body.operation === "history") c.shape(body.payload, "");
  return body;
}
function verifyResponse(signed, packet, identity) {
  const body = verify(signed, identity.publicKey);
  c.shape(body, "version,requestHash,challengeHash,result");
  w.check(body.version === V.response && body.requestHash === packet.request.body.requestHash && body.challengeHash === w.hashValue(packet.challenge), "IPC_RESPONSE_BINDING"); return structuredClone(body.result);
}
function verifyTransition(signed, {operator, identity, current, now}) {
  const body = verify(signed, operator.publicKey);
  c.shape(body, "version,operatorId,identityHash,witnessId,witnessEpoch,fromStore,fromEpoch,toStore,toEpoch,nonce,issuedAt,expiresAt");
  w.check(operator.status === "ACTIVE" && s.time(operator.notBefore) <= now && now < s.time(operator.notAfter) && body.operatorId === operator.operatorId && body.identityHash === w.hashValue(identity), "IPC_EPOCH_AUTHORITY");
  w.check(body.version === V.epoch && body.witnessId === identity.witnessId && body.witnessEpoch === identity.epoch, "IPC_EPOCH_AUTHORITY");
  c.digest(body.nonce); w.check(s.time(body.issuedAt) <= now && now < s.time(body.expiresAt) && s.time(body.expiresAt) - s.time(body.issuedAt) <= 300000, "IPC_EXPIRED");
  w.check(body.fromStore === current.storeId && body.fromEpoch === current.writerEpoch && body.toEpoch === current.writerEpoch + 1 && body.toStore !== current.storeId, "IPC_EPOCH_TRANSITION");
  w.check(identity.stores.some(row => row.storeId === body.toStore && row.writerEpoch === body.toEpoch), "IPC_EPOCH_UNPINNED"); return body;
}
module.exports = {V, bytes, verify, challenge, requestHash, verifyRequest, verifyResponse, verifyTransition};
