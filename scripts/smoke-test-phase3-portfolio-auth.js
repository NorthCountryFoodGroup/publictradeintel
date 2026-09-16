"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
assert.doesNotMatch(app, /publicTradeIntelPortfolioPin|x-portfolio-pin|sessionStorage|indexedDB/i);
assert.match(app, /const requestBody = JSON\.stringify\(\{ pin \}\)/);
assert.match(app, /pin = ""/);
assert.match(app, /body: requestBody/);
assert.match(app, /output\.portfolioPin\.value = ""/);
assert.match(server, /PORTFOLIO_SESSION_DURATION_MS = 30 \* 60 \* 1000/);
assert.match(server, /HttpOnly; SameSite=Strict/);

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function stop(child) { if (child.exitCode === null) child.kill(); for (let i=0;i<30&&child.exitCode===null;i+=1) await wait(50); if(child.exitCode===null)child.kill("SIGKILL"); }
async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pti-phase3-auth-"));
  const port = 35000 + process.pid % 1000;
  const child = spawn(process.execPath, ["server.js"], { cwd: root, env: { ...process.env, NODE_ENV:"production", DATA_DIR:dataDir, PORT:String(port), LOGIN_PIN:"phase3-login-pin-2026", ADMIN_PIN:"phase3-admin-pin-2026", PORTFOLIO_PIN:"phase3-portfolio-pin-2026", POLICY_REFRESH_MS:"0", CONGRESS_REFRESH_MS:"0", PREDICTION_REFRESH_MS:"0" }, stdio:["ignore","pipe","pipe"] });
  const base=`http://127.0.0.1:${port}`;
  try {
    for(let i=0;i<80;i+=1){try{if((await fetch(`${base}/healthz`)).ok)break;}catch{}await wait(50);if(i===79)throw new Error("server health timeout");}
    let response=await fetch(`${base}/api/portfolio/auth`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({pin:"phase3-portfolio-pin-2026"})});
    assert.equal(response.status,401,"normal login is required first");
    response=await fetch(`${base}/api/login`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({pin:"phase3-login-pin-2026"})});
    const loginCookie=response.headers.get("set-cookie").split(";")[0]; assert.equal(response.status,200);
    response=await fetch(`${base}/api/portfolio/auth`,{method:"POST",headers:{cookie:loginCookie,"content-type":"application/json"},body:JSON.stringify({pin:"wrong"})});
    assert.equal(response.status,401); assert.deepEqual(await response.json(),{error:"Portfolio authorization failed."});
    response=await fetch(`${base}/api/portfolio/auth`,{method:"POST",headers:{cookie:loginCookie,"content-type":"application/json"},body:JSON.stringify({pin:"phase3-portfolio-pin-2026"})});
    assert.equal(response.status,200); const setCookie=response.headers.get("set-cookie");
    assert.match(setCookie,/pti_portfolio_session=/); assert.match(setCookie,/HttpOnly/i); assert.match(setCookie,/Secure/i); assert.match(setCookie,/SameSite=Strict/i); assert.match(setCookie,/Max-Age=1800/i); assert.doesNotMatch(setCookie,/phase3-portfolio-pin-2026/);
    const portfolioCookie=setCookie.split(";")[0]; const cookies=`${loginCookie}; ${portfolioCookie}`;
    response=await fetch(`${base}/api/portfolio`,{headers:{cookie:cookies}}); assert.equal(response.status,200);
    await fetch(`${base}/api/predictions`,{headers:{cookie:loginCookie}});
    response=await fetch(`${base}/api/admin/performance-diagnostics`,{headers:{cookie:loginCookie,"x-admin-pin":"phase3-admin-pin-2026"}}); assert.equal(response.status,200);
    const diagnostics=await response.json(); assert.ok(diagnostics.api.predictionsRead.count>=1); assert.doesNotMatch(JSON.stringify(diagnostics),/phase3-|\\|\/var\/|cookie|token/i);
    response=await fetch(`${base}/api/logout`,{method:"POST",headers:{cookie:cookies}}); assert.equal(response.status,200); assert.match(response.headers.get("set-cookie"),/pti_portfolio_session=.*Max-Age=0/i);
    response=await fetch(`${base}/api/portfolio`,{headers:{cookie:cookies}}); assert.equal(response.status,401,"logout invalidates portfolio authorization server-side");
    response=await fetch(`${base}/api/login`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({pin:"phase3-login-pin-2026"})});
    const secondLoginCookie=response.headers.get("set-cookie").split(";")[0];
    for(let attempt=0;attempt<5;attempt+=1) await fetch(`${base}/api/portfolio/auth`,{method:"POST",headers:{cookie:secondLoginCookie,"content-type":"application/json"},body:JSON.stringify({pin:"wrong"})});
    response=await fetch(`${base}/api/portfolio/auth`,{method:"POST",headers:{cookie:secondLoginCookie,"content-type":"application/json"},body:JSON.stringify({pin:"wrong"})}); assert.equal(response.status,429,"portfolio PIN attempts are rate limited");
    const combinedOutput=[]; child.stdout.on("data",chunk=>combinedOutput.push(String(chunk))); child.stderr.on("data",chunk=>combinedOutput.push(String(chunk))); await wait(20); assert.doesNotMatch(combinedOutput.join(""),/phase3-portfolio-pin-2026/);
  } finally { await stop(child); fs.rmSync(dataDir,{recursive:true,force:true}); }
  console.log("Phase 3 short-lived portfolio authorization contract passed.");
}
main().catch((error)=>{console.error(error);process.exitCode=1;});
