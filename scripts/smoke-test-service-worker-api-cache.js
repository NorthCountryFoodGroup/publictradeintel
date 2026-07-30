const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
const server = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
const listeners = {};
const stores = new Map();
const deletedCaches = [];
const fetchCalls = [];

function requestKey(request) { return typeof request === "string" ? request : request.url; }
function cache(name) {
  if (!stores.has(name)) stores.set(name, new Map());
  const entries = stores.get(name);
  return {
    addAll: async (assets) => assets.forEach((asset) => entries.set(new URL(asset, "https://publictradeintel.test/").href, { asset })),
    put: async (request, response) => entries.set(requestKey(request), response),
    match: async (request) => entries.get(requestKey(request)),
    keys: async () => [...entries.keys()].map((url) => ({ url })),
  };
}
const caches = {
  open: async (name) => cache(name),
  keys: async () => [...stores.keys()],
  delete: async (name) => { deletedCaches.push(name); return stores.delete(name); },
  match: async (request) => {
    const key = new URL(requestKey(request), "https://publictradeintel.test/").href;
    for (const entries of stores.values()) if (entries.has(key)) return entries.get(key);
    return undefined;
  },
};
const self = {
  location: { origin: "https://publictradeintel.test" },
  addEventListener: (type, handler) => { listeners[type] = handler; },
};
function response(body, status = 200) { return { body, status, clone() { return response(body, status); } }; }
let fetchMode = "normal";
async function fetchMock(request) {
  fetchCalls.push(requestKey(request));
  if (fetchMode === "offline") throw new Error("offline");
  return response(fetchMode === "empty" ? "[]" : "network-data");
}
vm.runInNewContext(source, { self, caches, fetch: fetchMock, URL, Promise }, { filename: "sw.js" });

function dispatchFetch(url, method = "GET") {
  let promise = null;
  const event = { request: { url, method }, respondWith(value) { promise = Promise.resolve(value); } };
  listeners.fetch(event);
  return { intercepted: Boolean(promise), response: promise };
}

(async () => {
  assert.equal(typeof listeners.install, "function", "service worker install handler exists");
  assert.equal(typeof listeners.activate, "function", "service worker activate handler exists");
  assert.equal(typeof listeners.fetch, "function", "service worker fetch handler exists");
  assert.match(source, /publictradeintel-performance-v2/, "cache version increments to v2");
  assert.doesNotMatch(source.match(/const ASSETS = \[[\s\S]*?\];/)?.[0] || "", /\.\/api\//, "precache excludes API routes");

  for (const url of [
    "https://publictradeintel.test/api/test",
    "https://publictradeintel.test/api/test?fresh=1",
    "https://publictradeintel.test/api/predictions",
  ]) {
    const before = fetchCalls.length;
    const result = dispatchFetch(url);
    assert.equal(result.intercepted, false, `${url} bypasses respondWith`);
    assert.equal(fetchCalls.length, before, "service worker does not fetch, read, or write bypassed API requests");
  }
  assert.equal(dispatchFetch("https://publictradeintel.test/api/test", "POST").intercepted, false, "non-GET API bypasses interception");
  assert.equal(dispatchFetch("https://publictradeintel.test/apiary.js").intercepted, true, "apiary.js remains a static filename");
  assert.equal(dispatchFetch("https://provider.example/api/test").intercepted, false, "cross-origin GET is not newly cached");

  for (const asset of ["app.js", "styles.css", "icon.svg", "performance-explorer.js"]) {
    const result = dispatchFetch(`https://publictradeintel.test/${asset}`);
    assert.equal(result.intercepted, true, `${asset} remains cacheable`);
    await result.response;
  }
  const current = stores.get("publictradeintel-performance-v2");
  assert(current.has("https://publictradeintel.test/app.js"));
  assert(current.has("https://publictradeintel.test/styles.css"));
  assert(current.has("https://publictradeintel.test/icon.svg"));
  assert(current.has("https://publictradeintel.test/performance-explorer.js"));
  assert(![...current.keys()].some((url) => new URL(url).pathname.startsWith("/api/")), "current cache has no API entries");

  stores.set("publictradeintel-performance-v1", new Map([
    ["https://publictradeintel.test/api/predictions", response("[]")],
    ["https://publictradeintel.test/index.html", response("old shell")],
  ]));
  let activation;
  listeners.activate({ waitUntil(value) { activation = Promise.resolve(value); } });
  await activation;
  assert(deletedCaches.includes("publictradeintel-performance-v1"), "activation removes the obsolete cache containing API data");
  assert(stores.has("publictradeintel-performance-v2"), "activation preserves the current static cache");

  fetchMode = "empty";
  assert.equal(dispatchFetch("https://publictradeintel.test/api/predictions").intercepted, false, "empty API response remains network-owned");
  fetchMode = "normal";
  assert.equal(dispatchFetch("https://publictradeintel.test/api/predictions").intercepted, false, "restored API data cannot be replaced by stale cache");
  fetchMode = "offline";
  assert.equal(dispatchFetch("https://publictradeintel.test/api/predictions").intercepted, false, "offline API cannot receive index fallback");
  const staticOffline = dispatchFetch("https://publictradeintel.test/app.js");
  assert.equal((await staticOffline.response).body, "network-data", "cached static shell remains available offline");

  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|cookie/i, "browser storage and sessions are not cleared");
  const sendJson = server.match(/function sendJson\([\s\S]*?\n\}/)?.[0] || "";
  assert.match(sendJson, /"Cache-Control": "no-store"/, "authenticated JSON already has defense-in-depth no-store headers");
  function extractFunction(input, name) { const start=input.indexOf(`function ${name}(`);let brace=input.indexOf("{",start),depth=0;for(let i=brace;i<input.length;i++){if(input[i]==="{")depth++;if(input[i]==="}"&&!--depth)return input.slice(start,i+1);}throw new Error("function end"); }
  assert.equal(crypto.createHash("sha256").update(extractFunction(server, "buildPrediction")).digest("hex"), "72714872ed27c9c7d1ceac407a87e67d753afb9f6c7cec8f0051cc80631fb1bc");
  console.log("Service-worker API cache exclusion contract passed.");
})().catch((error) => { console.error(error); process.exit(1); });
