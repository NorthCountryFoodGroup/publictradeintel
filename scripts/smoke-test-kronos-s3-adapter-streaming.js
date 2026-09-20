"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto"),{Readable}=require("node:stream");
const guard=require("./fixtures/kronos-s3-network-guard").denyExternalNetwork(),f=require("./fixtures/kronos-s3-mock"),{createS3Adapter}=require("../kronos/research-backup-s3"),{createIO}=require("../kronos/research-backup-io");
async function main(){
 for(const method of ["PutObject","GetObject","HeadObject","ListObjectVersions","GetObjectRetention","GetBucketVersioning","GetObjectLockConfiguration","GetBucketEncryption"]){
  require("@aws-sdk/client-s3");
 const mock=f.mockS3(),p=createS3Adapter({...f.config,requestMs:300},{transport:mock,now:()=>Date.parse(f.instant)}),a=f.artifact();
  let ref;if(["GetObject","HeadObject","GetObjectRetention"].includes(method)){const out=await p.streamProvider.put(a.descriptor,a.source);ref=f.t.reference(a.descriptor,out.versionId);}
  mock.inject(method,"hang");const start=performance.now();
  const work=method.startsWith("GetBucket")||method==="GetObjectLockConfiguration"?()=>p.inspectCapabilities():ref?()=>p.streamProvider.get(ref):()=>p.streamProvider.put(a.descriptor,a.source);
  await assert.rejects(work,{code:"BACKUP_TIMEOUT"});assert.ok(performance.now()-start<2000);assert.equal(mock.state.active,0);assert.ok(mock.state.aborted>0);
 }
 const mock=f.mockS3(),p=createS3Adapter({...f.config,requestMs:100},{transport:mock,now:()=>Date.parse(f.instant)}),io=createIO(p.streamProvider,f.context,{now:()=>Date.parse(f.instant)}),a=f.artifact(),out=await io.publish(a);
 let destroyed=false;
 mock.inject("GetObject",()=>({VersionId:out.ref.versionId,ContentLength:a.descriptor.sizeBytes,ServerSideEncryption:"AES256",Body:{destroy(){destroyed=true;},[Symbol.asyncIterator](){return {next:()=>new Promise(()=>{}),return:()=>Promise.resolve({done:true})};}}}));
 await assert.rejects(()=>io.read(out.ref,{fresh:true}),{code:"BACKUP_TIMEOUT"});assert.equal(destroyed,true);
 const controller=new AbortController();controller.abort();await assert.rejects(()=>p.inspectCapabilities({signal:controller.signal}),{code:"BACKUP_TIMEOUT"});
 const late=f.mockS3(),lateProvider=createS3Adapter({...f.config,requestMs:20},{transport:late,now:()=>Date.parse(f.instant)});let finished=false;
 late.inject("PutObject",()=>new Promise(resolve=>setTimeout(()=>{finished=true;resolve({VersionId:"late"});},60)));
 await assert.rejects(()=>lateProvider.streamProvider.put(a.descriptor,a.source),{code:"BACKUP_TIMEOUT"});await new Promise(resolve=>setTimeout(resolve,80));assert.equal(finished,true);assert.equal(late.objects.size,0);
 await assert.rejects(()=>p.inspectCapabilities({maxAttempts:2}));
 // Exercise the actual core retry owner with this adapter, rather than simulating its policy.
 const setup=require("./fixtures/kronos-backup-compatibility").setup();setup.journal.close();
 const journal=require("../kronos/research-backup-journal").openJournal(path.join(setup.root,"s3-journal.sqlite"),setup.store,f.context),retry=f.mockS3(),rp=createS3Adapter(f.config,{transport:retry,now:()=>Date.parse(f.instant)}),ri=createIO(rp.streamProvider,f.context,{now:()=>Date.parse(f.instant)});
 try{for(let i=0;i<5;i++)retry.inject("PutObject",f.aws("SlowDown",503));await assert.rejects(()=>require("../kronos/research-backup-delivery-v2").deliver(ri,setup.bundle,{journal,retention:f.required,committedAt:f.instant,random:()=>0}),{code:"BACKUP_UNAVAILABLE"});assert.equal(retry.calls.filter(c=>c.name==="PutObject").length,4);assert.equal(journal.events("first").filter(e=>e.state==="UPLOADING").length,4);assert.equal(journal.events("first").some(e=>e.state==="OFF_DISK_VERIFIED"),false);}finally{journal.close();setup.cleanup();}
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"pti-s3-stream-")),file=path.join(root,"snapshot.bin"),fd=fs.openSync(file,"wx"),size=9*1024*1024;
 try{fs.ftruncateSync(fd,size);for(let offset=0;offset<size;offset+=f.t.CHUNK)fs.writeSync(fd,Buffer.from(String(offset)),0,String(offset).length,offset);fs.closeSync(fd);
  const large=f.mockS3(),lp=createS3Adapter(f.config,{transport:large,now:()=>Date.parse(f.instant)}),li=createIO(lp.streamProvider,f.context,{now:()=>Date.parse(f.instant)}),whole=await f.t.hashSource(f.t.fileSource(file)),refs=[];
  for(let offset=0;offset<size;offset+=f.t.CHUNK){const source=f.t.fileSource(file,offset,Math.min(f.t.CHUNK,size-offset)),hash=await f.t.hashSource(source),d=f.t.descriptor(f.context,"snapshot-chunk",hash.artifactSha256,source.sizeBytes,f.required);refs.push((await li.publish({descriptor:d,source})).ref);}
  fs.unlinkSync(file);const hash=crypto.createHash("sha256");let bytes=0;for(const ref of refs)await li.read(ref,{fresh:true,sink:part=>{bytes+=part.length;assert.ok(part.length<=f.t.BLOCK);hash.update(part);}});assert.equal(bytes,size);assert.equal(hash.digest("hex"),whole.artifactSha256);assert.ok(large.state.maxUploadChunk<=f.t.BLOCK);console.log(JSON.stringify({mockS3TransportBytes:bytes,chunks:refs.length,maxUploadChunk:large.state.maxUploadChunk}));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
 guard.assertClean();console.log("S3 request/body aborts, late-response rejection, four core attempts, and streamed file reconstruction: PASS; external network/real credential access: 0");
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>guard.restore());
