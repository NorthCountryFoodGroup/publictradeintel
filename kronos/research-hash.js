"use strict";
const { createHash } = require("node:crypto");
const { canonicalize, CANONICALIZATION_VERSION } = require("./research-canonical");
const HASH_ALGORITHM = "sha256";
function hashBytes(bytes) { return createHash(HASH_ALGORITHM).update(bytes).digest("hex"); }
function hashValue(value) { return hashBytes(Buffer.from(canonicalize(value), "utf8")); }
function assertHash(value, expected) {
  if (!/^[0-9a-f]{64}$/.test(expected) || hashValue(value) !== expected) throw Object.assign(new Error("Research content hash mismatch."), { code: "hash_mismatch" });
}
function recordEnvelope(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.hasOwn(value, "hash") || Object.hasOwn(value, "contentHash")) throw Object.assign(new Error("Record hash belongs outside its envelope."), { code: "invalid_record" });
  const json = canonicalize(value);
  return { json, hash: hashBytes(Buffer.from(json, "utf8")), canonicalizationVersion: CANONICALIZATION_VERSION };
}
module.exports = Object.freeze({ HASH_ALGORITHM, hashBytes, hashValue, assertHash, recordEnvelope });
