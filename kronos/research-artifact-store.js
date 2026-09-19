"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {canonicalize}=require("./research-canonical");
const {serializeBundle,parseBundle,check}=require("./research-recovery-bundle");
const {validateArchive}=require("./research-archive");
function directory(file){const s=fs.lstatSync(file);check(s.isDirectory()&&!s.isSymbolicLink(),"Artifact directory must not be a symlink.");}
function syncDirectory(file){
  let fd;try{fd=fs.openSync(file,"r");fs.fsyncSync(fd);return true;}
  catch(error){if(process.platform==="win32" && ["EISDIR","EPERM","EACCES","EINVAL"].includes(error.code))return false;throw error;}
  finally{if(fd!==undefined)fs.closeSync(fd);}
}
function recoveryPaths(dataDir){check(typeof dataDir==="string"&&path.isAbsolute(dataDir),"Explicit absolute DATA_DIR required.");const root=path.join(dataDir,"kronos-research","recovery");return {root,bundles:path.join(root,"bundles"),archives:path.join(root,"archives"),staging:path.join(root,"staging")};}
function prepareRoot(root){check(path.isAbsolute(root),"Explicit absolute recovery root required.");fs.mkdirSync(root,{recursive:true});directory(root);for(const name of ["bundles","archives","staging"]){fs.mkdirSync(path.join(root,name),{recursive:true});directory(path.join(root,name));}}
function regularRead(file){const s=fs.lstatSync(file);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=128*1024*1024,"Unsafe artifact file or size.");return fs.readFileSync(file);}
function publish(root,kind,name,files,hook=()=>{}){
  prepareRoot(root);check(["bundles","archives"].includes(kind)&&/^\d{12}$/.test(name),"Invalid artifact location.");
  const lock=path.join(root,"publication.writer.lock"),token=crypto.randomUUID(),fd=fs.openSync(lock,"wx",0o600);fs.writeFileSync(fd,token);fs.fsyncSync(fd);fs.closeSync(fd);
  try{
    const final=path.join(root,kind,name),names=Object.keys(files).sort();
    check(names.every(n=>/^[a-z]+\.(?:json|gz)$/.test(n)),"Invalid artifact filename.");
    if(fs.existsSync(final)){directory(final);check(canonicalize(fs.readdirSync(final).sort())===canonicalize(names),"Immutable artifact collision.");for(const n of names)check(regularRead(path.join(final,n)).equals(Buffer.from(files[n])),"Immutable artifact collision.");return {path:final,idempotent:true,directorySyncAvailable:syncDirectory(path.dirname(final))};}
    const staging=fs.mkdtempSync(path.join(root,"staging",`${kind}-`));
    for(const n of names){const handle=fs.openSync(path.join(staging,n),"wx",0o600);try{const data=Buffer.from(files[n]),half=Math.floor(data.length/2);fs.writeSync(handle,data,0,half);hook("during-write");fs.writeSync(handle,data,half,data.length-half);fs.fsyncSync(handle);}finally{fs.closeSync(handle);}}
    const stagingSynced=syncDirectory(staging);hook("before-seal");
    // Same-volume directory rename publishes all files together under a cooperative lock.
    fs.renameSync(staging,final);const parentSynced=syncDirectory(path.dirname(final));hook("after-seal");
    return {path:final,idempotent:false,directorySyncAvailable:stagingSynced&&parentSynced};
  }finally{if(fs.existsSync(lock)&&fs.readFileSync(lock,"utf8")===token)fs.unlinkSync(lock);}
}
function sequenceName(sequence){check(Number.isSafeInteger(sequence)&&sequence>0&&sequence<1e12,"Sequence outside artifact range.");return String(sequence).padStart(12,"0");}
function publishBundle(root,bundle,{hook}={}){return publish(root,"bundles",sequenceName(bundle.logical.transactionSequence),{"bundle.json":serializeBundle(bundle)},hook);}
function publishArchive(root,segment,{hook}={}){validateArchive(segment);return publish(root,"archives",sequenceName(segment.manifest.manifest.firstTransactionSequence),{"archive.gz":segment.artifact,"manifest.json":canonicalize(segment.manifest)+"\n"},hook);}
function readArtifacts(root){
  if(!fs.existsSync(root))return {bundles:[],segments:[],stagingEntries:0};
  directory(root);const bundles=[],segments=[];
  for(const kind of ["bundles","archives"]){const folder=path.join(root,kind);directory(folder);for(const name of fs.readdirSync(folder).sort()){
    check(/^\d{12}$/.test(name),"Unknown finalized artifact entry.");const folderPath=path.join(folder,name);directory(folderPath);
    const expected=kind==="bundles"?["bundle.json"]:["archive.gz","manifest.json"];check(canonicalize(fs.readdirSync(folderPath).sort())===canonicalize(expected),"Unexpected artifact files.");
    if(kind==="bundles"){const bundle=parseBundle(regularRead(path.join(folderPath,"bundle.json")));check(name===sequenceName(bundle.logical.transactionSequence),"Bundle filename sequence mismatch.");bundles.push(bundle);}
    else{const bytes=regularRead(path.join(folderPath,"manifest.json")),manifest=JSON.parse(bytes.toString("utf8"));check(bytes.equals(Buffer.from(canonicalize(manifest)+"\n")),"Noncanonical manifest.");const segment={manifest,artifact:regularRead(path.join(folderPath,"archive.gz"))};validateArchive(segment);check(name===sequenceName(manifest.manifest.firstTransactionSequence),"Archive filename sequence mismatch.");segments.push(segment);}
  }}
  return {bundles,segments,stagingEntries:fs.existsSync(path.join(root,"staging"))?fs.readdirSync(path.join(root,"staging")).length:0};
}
module.exports={recoveryPaths,publishBundle,publishArchive,readArtifacts,syncDirectory};
