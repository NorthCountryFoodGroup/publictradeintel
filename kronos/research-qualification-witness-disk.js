"use strict";
// Explicit local storage only. Import does not open files, SQLite, or ownership locks.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),w=require("./research-qualification-witness-contracts");
const SQL=["CREATE TABLE metadata (payload TEXT NOT NULL)","CREATE TABLE entries (sequence INTEGER PRIMARY KEY, payload TEXT NOT NULL, hash TEXT UNIQUE NOT NULL)","CREATE TABLE completions (sequence INTEGER PRIMARY KEY REFERENCES entries(sequence), hash TEXT NOT NULL)"];
for(const table of ["metadata","entries","completions"])for(const action of ["UPDATE","DELETE"])SQL.push(`CREATE TRIGGER ${table}_${action} BEFORE ${action} ON ${table} BEGIN SELECT RAISE(ABORT,'immutable'); END`);
function regular(file){const s=fs.lstatSync(file);w.check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1,"STORE_PATH");}
function syncDir(file){let fd;try{fd=fs.openSync(file,"r");fs.fsyncSync(fd);}catch(e){if(!(process.platform==="win32"&&["EPERM","EISDIR","EACCES","EINVAL"].includes(e.code)))throw e;}finally{if(fd!==undefined)fs.closeSync(fd);}}
function lockRecord(file){regular(file);const r=JSON.parse(fs.readFileSync(file,"utf8"));w.check(Object.keys(r).sort().join(",")==="ownerId,pid"&&typeof r.ownerId==="string"&&/^[a-f0-9-]{36}$/.test(r.ownerId)&&Number.isSafeInteger(r.pid)&&r.pid>0,"OWNERSHIP_INVALID");return r;}
function recoverOwnership(file,{expectedOwnerId,operatorRef}){
 w.check(path.isAbsolute(file)&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(operatorRef),"RECOVERY_APPROVAL_REQUIRED");const lock=file+".writer.lock",r=lockRecord(lock);w.check(r.ownerId===expectedOwnerId,"OWNERSHIP_CHANGED");
 try{process.kill(r.pid,0);w.fail("OWNER_ACTIVE");}catch(e){w.check(e.code==="ESRCH","OWNER_ACTIVE");}
 // Explicit operator recovery after process death only; never performed by open().
 w.check(lockRecord(lock).ownerId===expectedOwnerId,"OWNERSHIP_CHANGED");fs.unlinkSync(lock);syncDir(path.dirname(file));return {recovered:true,operatorRef};
}
function openDisk(file,{mode,metadata}){
 w.check(path.isAbsolute(file)&&["initialize-new","open-existing"].includes(mode),"STORE_MODE");const parent=fs.lstatSync(path.dirname(file));w.check(parent.isDirectory()&&!parent.isSymbolicLink(),"STORE_PATH");
 const lock=file+".writer.lock",owner={ownerId:crypto.randomUUID(),pid:process.pid};let db,closed=false,owns=false;
 try{
  let fd;try{fd=fs.openSync(lock,"wx",0o600);owns=true;fs.writeFileSync(fd,JSON.stringify(owner));fs.fsyncSync(fd);}catch{w.fail("WRITER_OWNED");}finally{if(fd!==undefined)fs.closeSync(fd);}syncDir(path.dirname(file));
  if(mode==="initialize-new"){const f=fs.openSync(file,"wx",0o600);fs.closeSync(f);}else w.check(fs.existsSync(file),"STORE_MISSING");regular(file);
  const {DatabaseSync}=require("node:sqlite");db=new DatabaseSync(file);
  if(mode==="open-existing")w.check(db.prepare("PRAGMA application_id").get().application_id===1262635601&&db.prepare("PRAGMA user_version").get().user_version===1,"STORE_SCHEMA");
  db.exec("PRAGMA journal_mode=DELETE; PRAGMA synchronous=EXTRA; PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF; PRAGMA busy_timeout=100;");
  if(mode==="initialize-new"){db.exec("BEGIN IMMEDIATE");try{SQL.forEach(x=>db.exec(x));db.prepare("INSERT INTO metadata VALUES(?)").run(w.canonicalize(metadata));db.exec("PRAGMA application_id=1262635601; PRAGMA user_version=1; COMMIT;");syncDir(path.dirname(file));}catch(e){db.exec("ROLLBACK");throw e;}}
  w.check(db.prepare("PRAGMA integrity_check").get().integrity_check==="ok"&&db.prepare("PRAGMA synchronous").get().synchronous===3&&db.prepare("PRAGMA journal_mode").get().journal_mode==="delete","STORE_INTEGRITY");
  const schema=db.prepare("SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").all().map(x=>x.sql).sort();w.check(w.canonicalize(schema)===w.canonicalize([...SQL].sort()),"STORE_SCHEMA");
  const meta=db.prepare("SELECT * FROM metadata").all();w.check(meta.length===1&&meta[0].payload===w.canonicalize(metadata),"STORE_IDENTITY");
  function owned(){w.check(!closed&&lockRecord(lock).ownerId===owner.ownerId,"WRITER_OWNERSHIP_LOST");}
  function read(){owned();let seq=0;const entries=db.prepare("SELECT * FROM entries ORDER BY sequence").all().map(row=>{const entry=JSON.parse(row.payload);w.check(row.sequence===++seq&&row.hash===w.hashValue(entry)&&row.payload===w.canonicalize(entry),"STORE_INTEGRITY");return entry;});const completed=db.prepare("SELECT * FROM completions ORDER BY sequence").all();for(const r of completed)w.check(entries[r.sequence-1]&&w.hashValue(entries[r.sequence-1])===r.hash,"STORE_INTEGRITY");w.check(completed.every((r,i)=>r.sequence===i+1),"STORE_INTEGRITY");return {entries,completed:completed.length};}
  function tx(fn){owned();db.exec("BEGIN IMMEDIATE");try{const result=fn();owned();db.exec("COMMIT");return result;}catch(e){db.exec("ROLLBACK");throw e;}}
  function append(entry){return tx(()=>{const data=read();w.check(data.completed===data.entries.length,"UNACKNOWLEDGED_LOCAL_STATE");const n=data.entries.length+1;db.prepare("INSERT INTO entries VALUES(?,?,?)").run(n,w.canonicalize(entry),w.hashValue(entry));return n;});}
  function complete(sequence){return tx(()=>{const d=read();w.check(sequence===d.completed+1&&sequence===d.entries.length,"COMPLETION_SEQUENCE");db.prepare("INSERT INTO completions VALUES(?,?)").run(sequence,w.hashValue(d.entries[sequence-1]));});}
  return Object.freeze({read,append,complete,assertOwned:owned,close(){if(!closed){db.close();closed=true;if(fs.existsSync(lock)&&lockRecord(lock).ownerId===owner.ownerId){fs.unlinkSync(lock);syncDir(path.dirname(file));}}}});
 }catch(e){if(db)db.close();if(owns&&fs.existsSync(lock)){try{if(lockRecord(lock).ownerId===owner.ownerId)fs.unlinkSync(lock);}catch{}}if(["STORE_MODE","STORE_PATH","STORE_SCHEMA","STORE_INTEGRITY","STORE_IDENTITY","STORE_MISSING","WRITER_OWNED"].includes(e.code))w.fail(e.code);w.fail("STORE_INVALID");}
}
module.exports={openDisk,recoverOwnership};
