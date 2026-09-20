"use strict";
// SDK loading and credential discovery are lazy; importing this module has no effects.
const c = require("./research-backup-contracts");
const t = require("./research-backup-transport");
const r = require("./research-backup-retention");
const { hashValue } = require("./research-hash");
const { canonicalize } = require("./research-canonical");
const { deadline } = require("./research-backup-deadline");

function normalize(error) {
  const name = error?.name, status = error?.$metadata?.httpStatusCode;
  if (c.ERRORS.includes(error?.code)) return c.failure(error.code, error.retryable === true);
  if (["AbortError", "TimeoutError", "RequestTimeout"].includes(name)) return c.failure("BACKUP_TIMEOUT", true);
  if (["InvalidAccessKeyId", "ExpiredToken", "InvalidToken", "SignatureDoesNotMatch", "CredentialsProviderError"].includes(name) || status === 401) return c.failure("BACKUP_AUTH_FAILED");
  if (name === "AccessDenied" || status === 403) return c.failure("BACKUP_PERMISSION_DENIED");
  if (["PreconditionFailed", "ConditionalRequestConflict"].includes(name) || [409, 412, 405].includes(status)) return c.failure("BACKUP_CONFLICT");
  if (["NoSuchKey", "NoSuchVersion"].includes(name)) return c.failure("BACKUP_VERSION_UNAVAILABLE");
  if (["ObjectLockConfigurationNotFoundError", "InvalidRetentionPeriod", "InvalidBucketState", "InvalidRequest"].includes(name)) return c.failure("BACKUP_RETENTION_UNVERIFIED");
  if (["BadDigest", "InvalidDigest"].includes(name)) return c.failure("BACKUP_CHECKSUM_MISMATCH");
  if (["SlowDown", "NoSuchBucket", "ServiceUnavailable"].includes(name) || status >= 500 || status === 429) return c.failure("BACKUP_UNAVAILABLE", name !== "NoSuchBucket");
  return c.failure("BACKUP_PROVIDER_ERROR");
}
function validateConfig(input) {
  c.shape(input, "bucket,region,expectedBucketOwner,environmentId,streamId,purpose,retentionPolicies,requestMs,softwareRevision");
  c.identity({ environmentId: input.environmentId, streamId: input.streamId });
  c.check(typeof input.bucket === "string" && /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(input.bucket) && !/\.\.|\.-|-\.|^\d+\.\d+\.\d+\.\d+$/.test(input.bucket));
  c.check(/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(input.region));
  c.check(typeof input.expectedBucketOwner === "string" && /^\d{12}$/.test(input.expectedBucketOwner));
  c.check(input.purpose === "qualification" && input.environmentId !== "production" && input.streamId.startsWith("qualification-"));
  c.check(Number.isInteger(input.requestMs) && input.requestMs > 0 && input.requestMs <= 60000);
  c.label(input.softwareRevision);
  c.check(Array.isArray(input.retentionPolicies) && input.retentionPolicies.length > 0 && input.retentionPolicies.length <= 16);
  input.retentionPolicies.forEach(r.validate);
  c.check(new Set(input.retentionPolicies.map(p => p.policyHash)).size === input.retentionPolicies.length);
  c.check(new Set(input.retentionPolicies.map(p => p.artifactClass)).size === input.retentionPolicies.length);
  return structuredClone(input);
}
function createS3Adapter(input, { transport, clientFactory, now = Date.now } = {}) {
  const config = validateConfig(input), context = { environmentId: config.environmentId, streamId: config.streamId };
  c.check(!(transport && clientFactory));
  if (transport) c.check(typeof transport.send === "function");
  let client;
  const containerRef = `s3-${hashValue({ bucket: config.bucket, region: config.region, owner: config.expectedBucketOwner }).slice(0, 32)}`;
  const cap = { adapterVersion: c.VERSIONS.adapter, providerType: "s3", containerRef, classification: "REAL_UNQUALIFIED", conditionalCreation: true, exactVersionIdentity: true, exactRetrieval: true, readbackVerification: true, retentionEvidence: true, boundedListing: true, encryptionEvidence: true };
  const observations = new WeakSet(), preconditions = new WeakSet();
  function sdk() { return require("@aws-sdk/client-s3"); }
  function getClient() {
    if (!client) {
      // No credentials or custom endpoints: the SDK owns standard Node discovery.
      const options = { region: config.region, maxAttempts: 1, followRegionRedirects: false, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" };
      client = clientFactory ? clientFactory(options) : new (sdk().S3Client)(options);
    }
    return client;
  }
  function key(value) {
    c.check(typeof value === "string" && value.startsWith(c.prefix(context)) && value.length <= 1024 && !/[\\\x00-\x20\x7f%?#]/.test(value) && !value.includes("..") && !value.includes("//"));
    return value;
  }
  function descriptor(d) {
    if (d?.transportVersion) t.validate(d); else c.descriptor(d);
    c.sameContext(d, context); key(d.objectKey); return d;
  }
  function requirement(d, original) {
    const required = config.retentionPolicies.find(p => p.artifactClass === (d.artifactType.startsWith("snapshot") ? "SNAPSHOT" : "EVIDENCE")) || config.retentionPolicies.find(p => p.artifactClass === "QUALIFICATION");
    r.appropriate(required, d.artifactType);
    // Descriptors and remote metadata can only confirm the server-selected policy.
    for (const supplied of [d.requiredRetention, original]) {
      if (supplied !== undefined) { r.validate(supplied); c.check(canonicalize(supplied) === canonicalize(required), "BACKUP_RETENTION_UNVERIFIED"); }
    }
    return required;
  }
  function locator(l) {
    if (l.descriptor) { t.validateReference(l, context); return { ...context, objectKey: l.descriptor.objectKey, versionId: l.versionId }; }
    c.sameContext(l, context); key(l.objectKey); c.providerVersion(l.versionId); return l;
  }
  function scopeFor(options = {}) {
    c.check(Object.keys(options).every(k => ["signal", "maxAttempts"].includes(k)));
    c.check(options.maxAttempts === undefined || options.maxAttempts === 1);
    return deadline({ timeoutMs: config.requestMs, signal: options.signal });
  }
  async function send(name, fields, scope) {
    try {
      const command = new (sdk()[`${name}Command`])({ Bucket: config.bucket, ExpectedBucketOwner: config.expectedBucketOwner, ...fields });
      const result = await scope.run(signal => Promise.resolve((transport || getClient()).send(command, { abortSignal: signal })).then(value => { if (signal.aborted) { value?.Body?.destroy?.(); throw c.failure("BACKUP_TIMEOUT"); } return value; }));
      scope.assert(); return result;
    } catch (error) { const normalized = normalize(error); if (error?.$metadata?.httpStatusCode === 412 || error?.name === "PreconditionFailed") preconditions.add(normalized); throw normalized; }
  }
  function parseHead(result, objectKey, versionId) {
    c.check(result.DeleteMarker !== true, "BACKUP_CONFLICT");
    c.providerVersion(result.VersionId);
    if (versionId) c.check(result.VersionId === versionId, "BACKUP_VERSION_UNAVAILABLE");
    c.check(result.ServerSideEncryption === "AES256", "BACKUP_RETENTION_UNVERIFIED");
    let d, required;
    try {
      const metadata = result.Metadata;
      c.check(metadata && Object.keys(metadata).sort().join(",") === "pti-descriptor,pti-retention");
      c.check(Buffer.byteLength(canonicalize(metadata)) <= 4096);
      d = descriptor(JSON.parse(metadata["pti-descriptor"]));
      required = requirement(d, JSON.parse(metadata["pti-retention"]));
      c.check(canonicalize(required) === metadata["pti-retention"]);
      c.check(d.objectKey === objectKey && d.sizeBytes === result.ContentLength, "BACKUP_CHECKSUM_MISMATCH");
    } catch (error) { throw normalize(error); }
    c.check(result.LastModified instanceof Date && Number.isFinite(result.LastModified.getTime()));
    const providerETag = result.ETag === undefined ? null : result.ETag;
    c.check(providerETag === null || (typeof providerETag === "string" && providerETag.length <= 1024)); c.safe(providerETag);
    return { ...context, objectKey, versionId: result.VersionId, sizeBytes: d.sizeBytes, artifactSha256: d.artifactSha256, logicalHash: d.logicalHash, providerETag, uploadedAt: result.LastModified.toISOString(), descriptor: structuredClone(d), requiredRetention: structuredClone(required) };
  }
  async function head(l, scope) {
    return parseHead(await send("HeadObject", { Key: l.objectKey, VersionId: l.versionId }, scope), l.objectKey, l.versionId);
  }
  async function retention(l, h, scope) {
    const response = await send("GetObjectRetention", { Key: l.objectKey, VersionId: l.versionId }, scope);
    c.check(response.Retention?.RetainUntilDate instanceof Date, "BACKUP_RETENTION_UNVERIFIED");
    const actual = { mode: response.Retention.Mode, retainUntil: response.Retention.RetainUntilDate.toISOString(), policyHash: h.requiredRetention.policyHash, encryptionStatus: "PROVIDER_MANAGED" };
    r.verify(h.requiredRetention, actual); return actual;
  }
  // Version-aware enumeration is authoritative; ListObjectsV2 hides delete markers.
  async function versions(prefix, scope, { limit = 100, maxPages = 100, start = null, onePage = false } = {}) {
    key(prefix); c.check(Number.isInteger(limit) && limit > 0 && limit <= 1000);
    let cursor = start, pages = 0; const seen = new Set(), rows = [];
    do {
      c.check(++pages <= maxPages && !seen.has(canonicalize(cursor))); seen.add(canonicalize(cursor));
      const result = await send("ListObjectVersions", { Prefix: prefix, MaxKeys: limit, ...(cursor ? { KeyMarker: cursor.key, VersionIdMarker: cursor.version } : {}) }, scope);
      c.check(!result.DeleteMarkers?.length, "BACKUP_CONFLICT");
      c.check(!result.CommonPrefixes?.length && Array.isArray(result.Versions || []) && (result.Versions || []).length <= limit);
      for (const row of result.Versions || []) {
        key(row.Key); c.check(row.Key.startsWith(prefix) && row.IsLatest === true, "BACKUP_CONFLICT"); c.providerVersion(row.VersionId);
        c.check(!rows.some(old => old.Key === row.Key) && (!rows.length || row.Key > rows.at(-1).Key), "BACKUP_CONFLICT"); rows.push({ Key: row.Key, VersionId: row.VersionId });
      }
      let next = null;
      if (result.IsTruncated === true) {
        key(result.NextKeyMarker); c.providerVersion(result.NextVersionIdMarker);
        c.check(result.NextKeyMarker.startsWith(prefix));
        next = { key: result.NextKeyMarker, version: result.NextVersionIdMarker };
        c.check(!seen.has(canonicalize(next)) && (!cursor || next.key >= cursor.key));
      }
      cursor = next;
      if (onePage) return { rows, cursor };
    } while (cursor);
    return { rows, cursor: null };
  }
  async function unique(objectKey, scope, expected) {
    const { rows } = await versions(objectKey, scope, { limit: 2, maxPages: 4 });
    const exact = rows.filter(row => row.Key === objectKey);
    c.check(exact.length <= 1, "BACKUP_CONFLICT");
    if (expected) c.check(exact.length === 1 && exact[0].VersionId === expected, "BACKUP_VERSION_UNAVAILABLE");
    return exact[0] || null;
  }
  async function openBody(l, scope) {
    const response = await send("GetObject", { Key: l.objectKey, VersionId: l.versionId, ChecksumMode: "ENABLED" }, scope);
    const body = response.Body;
    try {
      c.check(response.DeleteMarker !== true, "BACKUP_CONFLICT");
      c.check(response.VersionId === l.versionId, "BACKUP_VERSION_UNAVAILABLE");
      c.check(response.ServerSideEncryption === "AES256", "BACKUP_RETENTION_UNVERIFIED");
      c.check(body && typeof body[Symbol.asyncIterator] === "function");
      return { body, response };
    } catch (error) { body?.destroy?.(); throw error; }
  }
  async function* chunks(body, scope) {
    const iterator = body[Symbol.asyncIterator]();
    const abort = () => body.destroy?.(); scope.signal.addEventListener("abort", abort, { once: true });
    try {
      while (true) {
        const row = await scope.run(() => iterator.next()); if (row.done) break;
        c.check(Buffer.isBuffer(row.value) || row.value instanceof Uint8Array);
        for (let offset = 0; offset < row.value.length; offset += t.BLOCK) { scope.assert(); yield row.value.subarray(offset, offset + t.BLOCK); }
      }
    } catch (error) { throw normalize(error); }
    finally { scope.signal.removeEventListener("abort", abort); body.destroy?.(); if (iterator.return) Promise.resolve(iterator.return()).catch(() => {}); }
  }
  async function verify(l, d, scope, collect = false) {
    await unique(l.objectKey, scope, l.versionId);
    const h = await head(l, scope); c.check(hashValue(h.descriptor) === hashValue(d), "BACKUP_CONFLICT");
    const actual = await retention(l, h, scope), { body, response } = await openBody(l, scope);
    if (response.ContentLength !== d.sizeBytes) { body.destroy?.(); throw c.failure("BACKUP_CHECKSUM_MISMATCH"); }
    const hash = require("node:crypto").createHash("sha256"), parts = []; let size = 0;
    try { for await (const bytes of chunks(body, scope)) { size += bytes.length; c.check(size <= d.sizeBytes, "BACKUP_CHECKSUM_MISMATCH"); hash.update(bytes); if (collect) parts.push(Buffer.from(bytes)); } }
    finally { body.destroy?.(); }
    c.check(size === d.sizeBytes && hash.digest("hex") === d.artifactSha256, "BACKUP_CHECKSUM_MISMATCH");
    scope.assert(); return { head: h, actual, bytes: collect ? Buffer.concat(parts) : null };
  }
  async function put(d, source, options = {}, forceConditional = false) {
    descriptor(d); const required = requirement(d), scope = scopeFor(options);
    try {
      c.check(now() < Date.parse(required.minimumRetainUntil), "BACKUP_RETENTION_UNVERIFIED");
      const existing = await unique(d.objectKey, scope);
      if (existing && !forceConditional) {
        try { await verify({ ...context, objectKey: d.objectKey, versionId: existing.VersionId }, d, scope); } catch (error) { if (error.code === "BACKUP_CHECKSUM_MISMATCH") throw c.failure("BACKUP_CONFLICT"); throw error; }
        return { versionId: existing.VersionId, idempotent: true, conditionalRejected: false };
      }
      c.check(source && source.sizeBytes === d.sizeBytes && typeof source.open === "function");
      const metadata = { "pti-descriptor": canonicalize(d), "pti-retention": canonicalize(required) };
      c.check(Object.entries(metadata).reduce((n, [k, v]) => n + Buffer.byteLength(k) + Buffer.byteLength(v), 0) <= 2048);
      const { Readable } = require("node:stream");
      const hash = require("node:crypto").createHash("sha256"); let size = 0;
      const upload = Readable.from((async function* () {
        for await (const bytes of source.open()) { scope.assert(); c.check(Buffer.isBuffer(bytes) && bytes.length <= t.BLOCK); size += bytes.length; c.check(size <= d.sizeBytes); hash.update(bytes); yield bytes; }
        c.check(size === d.sizeBytes && hash.digest("hex") === d.artifactSha256, "BACKUP_CHECKSUM_MISMATCH");
      })(), { objectMode: false, highWaterMark: t.BLOCK });
      upload.on("error", () => {});
      const abort = () => upload.destroy(c.failure("BACKUP_TIMEOUT")); scope.signal.addEventListener("abort", abort, { once: true });
      let response, rejected = false;
      try {
        response = await send("PutObject", { Key: d.objectKey, Body: upload, ContentLength: d.sizeBytes, IfNoneMatch: "*", Metadata: metadata, ServerSideEncryption: "AES256", ObjectLockMode: required.mode, ObjectLockRetainUntilDate: new Date(required.minimumRetainUntil), ChecksumAlgorithm: "SHA256", ChecksumSHA256: Buffer.from(d.artifactSha256, "hex").toString("base64") }, scope);
      } catch (error) {
        if (!preconditions.has(error)) throw error;
        const found = await unique(d.objectKey, scope); c.check(found, "BACKUP_CONFLICT");
        response = { VersionId: found.VersionId }; rejected = true;
      } finally { scope.signal.removeEventListener("abort", abort); upload.destroy(); }
      c.providerVersion(response.VersionId);
      try { await verify({ ...context, objectKey: d.objectKey, versionId: response.VersionId }, d, scope); } catch (error) { if (rejected && error.code === "BACKUP_CHECKSUM_MISMATCH") throw c.failure("BACKUP_CONFLICT"); throw error; }
      scope.assert(); return { versionId: response.VersionId, idempotent: rejected, conditionalRejected: rejected };
    } catch (error) { throw normalize(error); } finally { scope.close(); }
  }
  async function headExact(value, options) {
    const l = locator(value), scope = scopeFor(options);
    try { await unique(l.objectKey, scope, l.versionId); return await head(l, scope); }
    catch (error) { throw normalize(error); } finally { scope.close(); }
  }
  async function describeRetention(value, options) {
    const l = locator(value), scope = scopeFor(options);
    try { await unique(l.objectKey, scope, l.versionId); const h = await head(l, scope), actual = await retention(l, h, scope); return { ...actual, versionId: l.versionId, policyVersion: h.requiredRetention.policyId }; }
    catch (error) { throw normalize(error); } finally { scope.close(); }
  }
  async function getExact(value, options) {
    const l = locator(value), scope = scopeFor(options);
    try {
      const h = await head(l, scope); c.check(!h.descriptor.transportVersion && h.sizeBytes <= t.MAX_JSON);
      const verified = await verify(l, h.descriptor, scope, true); c.decodeObject(h.descriptor, verified.bytes);
      return { ...h, bytes: verified.bytes };
    } catch (error) { throw normalize(error); } finally { scope.close(); }
  }
  async function getStream(value, options) {
    const l = locator(value), scope = scopeFor(options); let body;
    try {
      await unique(l.objectKey, scope, l.versionId); const h = await head(l, scope);
      c.check(hashValue(h.descriptor) === hashValue(value.descriptor), "BACKUP_CONFLICT");
      await retention(l, h, scope);
      const result = await openBody(l, scope); body = result.body;
      c.check(result.response.ContentLength === h.sizeBytes, "BACKUP_CHECKSUM_MISMATCH");
      const destroy = () => body.destroy?.(); scope.signal.addEventListener("abort", destroy, { once: true });
      return { versionId: l.versionId, body: { async *[Symbol.asyncIterator]() {
        const hash = require("node:crypto").createHash("sha256"); let size = 0;
        try { for await (const bytes of chunks(body, scope)) { size += bytes.length; c.check(size <= h.sizeBytes, "BACKUP_CHECKSUM_MISMATCH"); hash.update(bytes); yield bytes; } c.check(size === h.sizeBytes && hash.digest("hex") === h.artifactSha256, "BACKUP_CHECKSUM_MISMATCH"); }
        finally { scope.signal.removeEventListener("abort", destroy); body.destroy?.(); scope.close(); }
      } } };
    } catch (error) { body?.destroy?.(); scope.close(); throw normalize(error); }
  }
  async function listPrefix(prefix, cursor = null, limit = 100, options) {
    const scope = scopeFor(options);
    try {
      let start = null;
      if (cursor !== null) {
        c.check(typeof cursor === "string" && cursor.length < 8192);
        const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
        c.shape(decoded, "prefix,key,version,pages"); c.check(decoded.prefix === prefix && Number.isInteger(decoded.pages) && decoded.pages > 0 && decoded.pages < 1000);
        key(decoded.key); c.providerVersion(decoded.version); start = decoded;
      }
      const page = await versions(prefix, scope, { limit, start: start ? { key: start.key, version: start.version } : null, onePage: true });
      const items = [];
      for (const row of page.rows) {
        await unique(row.Key, scope, row.VersionId);
        const h = await head({ ...context, objectKey: row.Key, versionId: row.VersionId }, scope);
        items.push(h.descriptor.transportVersion ? t.reference(h.descriptor, h.versionId) : { ...context, objectKey: row.Key, versionId: h.versionId, descriptor: h.descriptor });
      }
      const next = page.cursor ? Buffer.from(canonicalize({ prefix, ...page.cursor, pages: (start?.pages || 0) + 1 })).toString("base64url") : null;
      return { items, cursor: next };
    } catch (error) { throw normalize(error); } finally { scope.close(); }
  }
  async function inspectCapabilities(options) {
    const scope = scopeFor(options);
    try {
      const versioning = await send("GetBucketVersioning", {}, scope), lock = await send("GetObjectLockConfiguration", {}, scope), encryption = await send("GetBucketEncryption", {}, scope);
      c.check(versioning.Status === "Enabled" && lock.ObjectLockConfiguration?.ObjectLockEnabled === "Enabled", "BACKUP_RETENTION_UNVERIFIED");
      const rules = encryption.ServerSideEncryptionConfiguration?.Rules;
      c.check(Array.isArray(rules) && rules.length === 1 && rules[0].ApplyServerSideEncryptionByDefault?.SSEAlgorithm === "AES256", "BACKUP_RETENTION_UNVERIFIED");
      return { versioningVerified: true, objectLockVerified: true, encryptionVerified: true, productionQualified: false };
    } catch (error) { throw normalize(error); } finally { scope.close(); }
  }
  async function collectQualificationEvidence(artifact, options) {
    c.check(artifact.descriptor.requiredRetention?.artifactClass === "QUALIFICATION");
    const required = requirement(descriptor(artifact.descriptor));
    const inspected = await inspectCapabilities(options), first = await put(artifact.descriptor, artifact.source, options);
    c.check(!first.idempotent, "BACKUP_CONFLICT");
    const second = await put(artifact.descriptor, artifact.source, options, true);
    c.check(second.conditionalRejected === true && second.versionId === first.versionId, "BACKUP_CONFLICT");
    const listed = await listPrefix(artifact.descriptor.objectKey, null, 2, options);
    c.check(listed.cursor === null && listed.items.length === 1 && listed.items[0].versionId === first.versionId);
    const actual = await describeRetention({ ...context, objectKey: artifact.descriptor.objectKey, versionId: first.versionId }, options);
    const retentionEvidence = Object.freeze({ requiredRetention: Object.freeze(structuredClone(required)), observedRetention: Object.freeze({ mode: actual.mode, retainUntil: actual.retainUntil, policyHash: actual.policyHash, encryptionStatus: actual.encryptionStatus }), objectKey: artifact.descriptor.objectKey, versionId: first.versionId });
    const evidence = Object.freeze({ retentionEvidence, ...context, providerType: "s3", containerRef, ...inspected, conditionalWriteVerified: true, readbackVerified: true, boundedListingVerified: true, policyHash: artifact.descriptor.requiredRetention.policyHash, observedAt: new Date(now()).toISOString(), simulated: true });
    observations.add(evidence); return evidence;
  }
  function qualificationRecord(evidence, { runtime, drill, expiresAt } = {}) {
    c.check(observations.has(evidence));
    for (const [record, kind] of [[runtime, "RUNTIME"], [drill, "RESTORE"]]) {
      c.shape(record, "kind,environmentId,streamId,containerRef,passed,simulated,id,hash");
      c.sameContext(record, context); c.check(record.kind === kind && record.containerRef === containerRef && record.passed === true && record.simulated === true); c.label(record.id);
      const { hash, ...body } = record; c.check(hashValue(body) === hash);
    }
    c.check(now() >= Date.parse(evidence.observedAt) && now() - Date.parse(evidence.observedAt) < 3600000);
    const q = require("./research-backup-qualification");
    const body = { qualificationVersion: q.VERSION, providerType: "s3", containerRef, region: config.region, ...context, capabilitiesVerified: true, versioningVerified: true, objectLockVerified: true, encryptionVerified: true, conditionalWriteVerified: true, readbackVerified: true, restoreDrillId: drill.id, runtimeQualificationReference: runtime.hash, policyHashes: [evidence.policyHash], retentionEvidence: [evidence.retentionEvidence], qualifiedAt: evidence.observedAt, expiresAt, softwareRevision: config.softwareRevision };
    const record = q.validate({ ...body, qualificationHash: hashValue(body) }, context);
    return { record, simulated: true, productionQualified: false, runtimeQualified: false, status: q.qualificationStatus(record, context, now()) };
  }
  const streamProvider = Object.freeze({ capabilities: () => ({ providerType: "s3", containerRef, classification: "REAL_UNQUALIFIED", retryOwner: "CORE", maxAttempts: 1, conditionalCreation: true, exactVersionIdentity: true, exactRetrieval: true, readbackVerification: true, retentionEvidence: true, boundedListing: true, encryptionEvidence: true, abortable: true }), put, head: headExact, get: getStream, async retention(l, options) { const actual = await describeRetention(l, options); return { mode: actual.mode, retainUntil: actual.retainUntil, policyHash: actual.policyHash, encryptionStatus: actual.encryptionStatus }; }, list: listPrefix });
  return Object.freeze({ capabilities: () => ({ ...cap }), implementationClass: "REAL-PROVIDER-CAPABLE", putImmutable(d, bytes, options) { c.decodeObject(d, bytes); c.check(bytes.length <= t.MAX_JSON); return put(d, t.bytesSource(bytes), options); }, headExact, getExact, describeRetention, listPrefix, streamProvider, inspectCapabilities, collectQualificationEvidence, qualificationRecord, close() { client?.destroy?.(); } });
}
module.exports = { createS3Adapter, validateConfig, normalize };
