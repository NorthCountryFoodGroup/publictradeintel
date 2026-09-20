"use strict";
const { Readable } = require("node:stream");
const c = require("../../kronos/research-backup-contracts");
const r = require("../../kronos/research-backup-retention");
const t = require("../../kronos/research-backup-transport");
const instant = "2026-09-29T00:00:00.000Z";
const context = { environmentId: "fixture", streamId: "qualification-s3-fixture" };
const required = r.fixtureRequirement("QUALIFICATION_SHORT_V1", instant, undefined, "GOVERNANCE");
const config = { bucket: "pti-qualification-fixture", region: "us-east-2", expectedBucketOwner: "000000000000", ...context, purpose: "qualification", retentionPolicies: [required], requestMs: 2000, softwareRevision: "fixture-v1" };
function aws(name, status) { return Object.assign(new Error("fake secret Authorization=NEVER_EXPORT"), { name, $metadata: { httpStatusCode: status, requestId: "NEVER_EXPORT" } }); }
function mockS3() {
  const objects = new Map(), calls = [], faults = new Map(); let serial = 0;
  const state = { versioning: "Enabled", lock: "Enabled", defaultMode: "GOVERNANCE", defaultDays: 1, encryption: "AES256", owner: config.expectedBucketOwner, ignoreConditional: false, deleteMarker: false, extraVersion: false, cursorLoop: false, active: 0, aborted: 0, maxUploadChunk: 0, bodyDestroyed: 0 };
  function inject(name, action) { const q = faults.get(name) || []; q.push(action); faults.set(name, q); }
  async function send(command, { abortSignal }) {
    const name = command.constructor.name.replace(/Command$/, ""), input = command.input;
    calls.push({ name, input });
    c.check(input.Bucket === config.bucket && input.ExpectedBucketOwner === state.owner, "BACKUP_PERMISSION_DENIED");
    if (abortSignal.aborted) throw aws("AbortError", 0);
    const action = (faults.get(name) || []).shift();
    if (action instanceof Error) throw action;
    if (action === "hang") {
      state.active++;
      return new Promise((resolve, reject) => abortSignal.addEventListener("abort", () => { state.active--; state.aborted++; reject(aws("AbortError", 0)); }, { once: true }));
    }
    if (typeof action === "function") return action(input, abortSignal);
    if (name === "GetBucketVersioning") return { Status: state.versioning };
    if (name === "GetObjectLockConfiguration") return { ObjectLockConfiguration: { ObjectLockEnabled: state.lock, Rule: { DefaultRetention: { Mode: state.defaultMode, Days: state.defaultDays } } } };
    if (name === "GetBucketEncryption") return { ServerSideEncryptionConfiguration: { Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: state.encryption } }] } };
    if (name === "ListObjectVersions") {
      const all = [...objects.values()].filter(o => o.key.startsWith(input.Prefix)).sort((a,b) => a.key.localeCompare(b.key));
      const rows = all.filter(o => !input.KeyMarker || o.key > input.KeyMarker);
      const page = rows.slice(0, input.MaxKeys), truncated = rows.length > page.length || state.cursorLoop;
      const versions = page.map(o => ({ Key: o.key, VersionId: o.version, IsLatest: true }));
      if (state.extraVersion && page.length) versions.push({ Key: page[0].key, VersionId: "old/version", IsLatest: false });
      return { Versions: versions, DeleteMarkers: state.deleteMarker ? [{ Key: input.Prefix, VersionId: "deleted", IsLatest: true }] : [], IsTruncated: truncated, ...(truncated ? { NextKeyMarker: state.cursorLoop && input.KeyMarker ? input.KeyMarker : page.at(-1)?.key, NextVersionIdMarker: state.cursorLoop && input.VersionIdMarker ? input.VersionIdMarker : page.at(-1)?.version } : {}) };
    }
    if (name === "PutObject") {
      if (objects.has(input.Key) && !state.ignoreConditional) throw aws("PreconditionFailed", 412);
      c.check(input.IfNoneMatch === "*" && input.ServerSideEncryption === "AES256" && ["GOVERNANCE", "COMPLIANCE"].includes(input.ObjectLockMode));
      const parts = []; for await (const bytes of input.Body) { if (abortSignal.aborted) throw aws("AbortError", 0); state.maxUploadChunk = Math.max(state.maxUploadChunk, bytes.length); parts.push(Buffer.from(bytes)); }
      const bytes = Buffer.concat(parts); c.check(bytes.length === input.ContentLength);
      c.check(require("node:crypto").createHash("sha256").update(bytes).digest("base64") === input.ChecksumSHA256);
      const version = `opaque/+\u03b2=${++serial}`;
      objects.set(input.Key, { key: input.Key, version, bytes, metadata: structuredClone(input.Metadata), retention: input.ObjectLockRetainUntilDate, mode: input.ObjectLockMode, encryption: "AES256", etag: '"opaque-multipart-7"' });
      return { VersionId: version, ETag: '"opaque-multipart-7"' };
    }
    const object = objects.get(input.Key);
    if (!object || object.version !== input.VersionId) throw aws("NoSuchVersion", 404);
    if (name === "GetObjectRetention") return { Retention: { Mode: object.mode, RetainUntilDate: object.retention } };
    const head = { VersionId: object.version, ContentLength: object.bytes.length, Metadata: structuredClone(object.metadata), ServerSideEncryption: object.encryption, LastModified: new Date(instant), ETag: object.etag };
    if (name === "HeadObject") return head;
    if (name === "GetObject") {
      const body = Readable.from((async function* () { for (let n=0;n<object.bytes.length;n+=t.BLOCK) yield object.bytes.subarray(n,n+t.BLOCK); })(), { objectMode: false });
      body.on("close", () => state.bodyDestroyed++); return { ...head, Body: body };
    }
    throw Error("UNEXPECTED_MOCK_COMMAND");
  }
  return { send, objects, calls, state, inject };
}
function artifact(value = { fixture: "evidence" }) { return t.jsonArtifact(context, "archive", value, required); }
module.exports = { mockS3, aws, config, context, instant, required, artifact, c, r, t };
