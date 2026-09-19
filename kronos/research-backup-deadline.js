"use strict";
const c=require("./research-backup-contracts");
// Runtime-only timers: importing this module starts no work and obtains no clock.
function deadline({timeoutMs=60000,signal,monotonic=()=>performance.now(),scheduler}={}){
 c.check(Number.isFinite(timeoutMs)&&timeoutMs<=60000);c.check(timeoutMs>0,"BACKUP_TIMEOUT");const timers=scheduler||require("node:timers"),controller=new AbortController(),end=monotonic()+timeoutMs;let closed=false;
 const abort=()=>controller.abort(c.failure("BACKUP_TIMEOUT"));const timer=timers.setTimeout(abort,timeoutMs);if(signal){if(signal.aborted)abort();else signal.addEventListener("abort",abort,{once:true});}
 function assert(){c.check(!closed&&!controller.signal.aborted&&monotonic()<end,"BACKUP_TIMEOUT");}
 return Object.freeze({signal:controller.signal,assert,remaining:()=>Math.max(0,end-monotonic()),async run(operation){assert();let listener;const cancelled=new Promise((_,reject)=>{listener=()=>reject(c.failure("BACKUP_TIMEOUT"));controller.signal.addEventListener("abort",listener,{once:true});});try{const result=await Promise.race([Promise.resolve().then(()=>{assert();return operation(controller.signal);}),cancelled]);assert();return result;}finally{controller.signal.removeEventListener("abort",listener);}},close(){closed=true;timers.clearTimeout(timer);if(signal)signal.removeEventListener("abort",abort);abort();}});
}
module.exports={deadline};
