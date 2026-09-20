"use strict";
const assert = require("node:assert/strict");
const guard = require("./fixtures/kronos-s3-network-guard").denyExternalNetwork();
const f = require("./fixtures/kronos-s3-mock");
const { createS3Adapter, validateConfig, normalize } = require("../kronos/research-backup-s3");
const { createIO } = require("../kronos/research-backup-io");
async function main() {
  const mock = f.mockS3(), provider = createS3Adapter(f.config, { transport: mock, now: () => Date.parse(f.instant) }), io = createIO(provider.streamProvider, f.context, { now: () => Date.parse(f.instant) });
  assert.equal(provider.capabilities().providerType, "s3"); assert.equal(provider.capabilities().classification, "REAL_UNQUALIFIED");
  require("../kronos/research-backup-adapter").assertCapabilities(provider.capabilities());
  for (const change of [{ bucket: "../escape" }, { expectedBucketOwner: "wrong" }, { region: "https://evil.invalid" }, { purpose: "production" }, { environmentId: "production" }, { streamId: "research-production" }, { requestMs: 60001 }, { retentionPolicies: [] }, { credentials: "fake" }]) assert.throws(() => validateConfig({ ...f.config, ...change }));
  let constructed = 0;
  const lazy = createS3Adapter(f.config, { clientFactory(options) { constructed++; assert.equal(options.maxAttempts, 1); assert.equal(options.credentials, undefined); return mock; } });
  assert.equal(constructed, 0); await lazy.inspectCapabilities(); assert.equal(constructed, 1);
  const artifact = f.artifact(), uploaded = await io.publish(artifact), ref = uploaded.ref;
  assert.equal(uploaded.receipt.providerType, "s3"); assert.equal(uploaded.receipt.productionDurability, false); assert.match(ref.versionId, /\u03b2/);
  const put = mock.calls.find(c => c.name === "PutObject").input;
  assert.equal(put.IfNoneMatch, "*"); assert.equal(put.ContentLength, artifact.descriptor.sizeBytes); assert.equal(put.ChecksumAlgorithm, "SHA256");
  assert.equal((await provider.streamProvider.put(artifact.descriptor, artifact.source)).idempotent, true);
  mock.inject("ListObjectVersions", () => ({ Versions: [], IsTruncated: false }));
  assert.equal((await provider.streamProvider.put(artifact.descriptor, artifact.source)).conditionalRejected, true);
  for (const call of mock.calls.filter(c => ["HeadObject", "GetObject", "GetObjectRetention"].includes(c.name))) assert.equal(call.input.VersionId, ref.versionId);
  const stored = mock.objects.get(ref.descriptor.objectKey);
  stored.bytes[0] ^= 1; await assert.rejects(() => io.read(ref, { fresh: true }), { code: "BACKUP_CHECKSUM_MISMATCH" }); stored.bytes[0] ^= 1;
  const originalExpiry=stored.retention.toISOString();
  const historical=createS3Adapter(f.config,{transport:mock,now:()=>Date.parse(f.instant)+40*86400000});
  const historicalIO=createIO(historical.streamProvider,f.context,{now:()=>Date.parse(f.instant)+40*86400000});
  await historicalIO.read(ref,{fresh:true});assert.equal(stored.retention.toISOString(),originalExpiry);
  await assert.rejects(()=>historical.streamProvider.put(artifact.descriptor,artifact.source),{code:"BACKUP_RETENTION_UNVERIFIED"});
  const savedDescriptor = stored.metadata["pti-descriptor"];
  stored.metadata["pti-descriptor"] = savedDescriptor.replace('"fixture"', '"staging"');
  await assert.rejects(() => provider.streamProvider.put(artifact.descriptor, artifact.source), { code: "BACKUP_CONFLICT" }); stored.metadata["pti-descriptor"] = savedDescriptor;
  const expiry = stored.retention; stored.retention = new Date(Date.parse(f.instant)); await assert.rejects(() => io.read(ref, { fresh: true }), { code: "BACKUP_RETENTION_UNVERIFIED" }); stored.retention = expiry;
  stored.encryption = "aws:kms"; await assert.rejects(() => io.read(ref, { fresh: true }), { code: "BACKUP_RETENTION_UNVERIFIED" }); stored.encryption = "AES256";
  for (const flag of ["deleteMarker", "extraVersion"]) { mock.state[flag] = true; await assert.rejects(() => io.read(ref, { fresh: true })); const count = mock.calls.filter(c=>c.name==="PutObject").length; await assert.rejects(() => provider.streamProvider.put(artifact.descriptor, artifact.source)); assert.equal(mock.calls.filter(c=>c.name==="PutObject").length,count); mock.state[flag] = false; }
  await assert.rejects(() => provider.headExact({ ...f.context, objectKey: ref.descriptor.objectKey, versionId: "null" }));
  await assert.rejects(() => provider.listPrefix("pti/production/other/"));
  await assert.rejects(() => provider.listPrefix(f.c.prefix(f.context)+"../escape"));
  await io.publish(f.artifact({ fixture: "second" }));
  const page = await provider.listPrefix(f.c.prefix(f.context), null, 1); assert.ok(page.cursor);
  const next = await provider.listPrefix(f.c.prefix(f.context), page.cursor, 1); assert.equal(next.cursor, null); assert.notEqual(next.items[0].versionId,page.items[0].versionId);
  mock.state.cursorLoop = true; await assert.rejects(() => provider.listPrefix(f.c.prefix(f.context), page.cursor, 1)); mock.state.cursorLoop = false;
  mock.state.owner = "111111111111"; await assert.rejects(() => provider.inspectCapabilities(), { code: "BACKUP_PERMISSION_DENIED" }); mock.state.owner = f.config.expectedBucketOwner;
  const cases = [["AccessDenied",403,"BACKUP_PERMISSION_DENIED"],["InvalidAccessKeyId",403,"BACKUP_AUTH_FAILED"],["ExpiredToken",403,"BACKUP_AUTH_FAILED"],["NoSuchBucket",404,"BACKUP_UNAVAILABLE"],["NoSuchKey",404,"BACKUP_VERSION_UNAVAILABLE"],["NoSuchVersion",404,"BACKUP_VERSION_UNAVAILABLE"],["PreconditionFailed",412,"BACKUP_CONFLICT"],["SlowDown",503,"BACKUP_UNAVAILABLE"],["RequestTimeout",400,"BACKUP_TIMEOUT"],["InternalError",500,"BACKUP_UNAVAILABLE"],["AbortError",0,"BACKUP_TIMEOUT"],["ObjectLockConfigurationNotFoundError",404,"BACKUP_RETENTION_UNVERIFIED"],["Unrecognized",400,"BACKUP_PROVIDER_ERROR"]];
  for(const [name,status,code] of cases) { const e=normalize(f.aws(name,status)); assert.equal(e.code,code); assert.equal(e.message,code); assert.equal(e.$metadata,undefined); }
  // V1 API interoperability and normalized receipt; ETag is never a digest.
  const setup = require("./fixtures/kronos-backup-compatibility").setup();
  try { const object=f.c.encodeObject(f.context,"bundle","KRONOS_RECOVERY_BUNDLE_V1",setup.bundle), adapter=require("../kronos/research-backup-adapter").createAdapter(provider,f.context), candidate=await adapter.putImmutable(object.descriptor,object.bytes), l={...f.context,objectKey:object.descriptor.objectKey,versionId:candidate.versionId};
    const receipt=await adapter.verifyExact(l,object.descriptor,{now:()=>Date.parse(f.instant),retainUntil:f.required.minimumRetainUntil,retentionPolicyVersion:f.required.policyId,softwareRevision:"fixture-v1"});
    assert.equal(receipt.receiptVersion,"KRONOS_REMOTE_RECEIPT_V1"); assert.equal(receipt.providerType,"s3"); assert.equal(receipt.providerETag,'"opaque-multipart-7"'); assert.equal(receipt.verificationMethod,"EXACT_GET_SHA256"); assert.notEqual(receipt.providerETag,receipt.artifactSha256);
    assert.doesNotMatch(JSON.stringify(receipt),/NEVER_EXPORT|000000000000|Authorization/);
  } finally { setup.cleanup(); }
  assert.equal(require("../kronos/research-backup-adapter").isQualifiedRealProvider(),false);
  assert.ok(mock.calls.every(call=>call.input.ExpectedBucketOwner===f.config.expectedBucketOwner));
  guard.assertClean(); console.log("S3 adapter contracts: config, V1/V2, immutable PUT/412, pinned versions, GET/hash, retention, encryption, owner, pagination, delete markers, errors and receipt: PASS; external network/real credential access: 0");
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>guard.restore());
