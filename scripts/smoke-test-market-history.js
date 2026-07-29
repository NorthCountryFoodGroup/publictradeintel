const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { PERIODS, MAX_CACHE_ENTRIES, normalizeSeries, metricsForSeries, validateRequest, createHistoricalMarketService } = require("../historical-market");

function yahoo(ticker, values = [100, 105, 95, 110]) {
  return { chart: { result: [{ meta: { longName: `${ticker} Incorporated` }, timestamp: [1767225600, 1767312000, 1767398400, 1767484800], indicators: { quote: [{ close: values }], adjclose: [{ adjclose: values }] } }] } };
}
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

(async () => {
  assert.deepEqual(Object.keys(PERIODS), ["7D", "1M", "6M", "1Y", "2Y"]);
  assert.equal(PERIODS["2Y"].interval, "1wk");
  assert.throws(() => validateRequest(new URLSearchParams("tickers=AAPL&period=3Y")), /Unsupported period/);
  assert.throws(() => validateRequest(new URLSearchParams(`tickers=${Array.from({length:11},(_,i)=>`A${i}`).join(',')}&period=1M`)), /between 1 and 10/);
  assert.throws(() => validateRequest(new URLSearchParams("tickers=../../etc&period=1M")), /invalid/);
  assert.deepEqual(validateRequest(new URLSearchParams("tickers=aapl,msft&period=1M&horizon=1-Day")).tickers, ["AAPL", "MSFT"]);
  const series = normalizeSeries(yahoo("TEST").chart.result[0], "1M");
  assert.equal(series[0].cumulativeReturn, 0); assert(series.some((row) => row.cumulativeReturn > 0)); assert(series.some((row) => row.cumulativeReturn < 0));
  const metrics = metricsForSeries(series); assert.equal(metrics.totalReturn, 10); assert.equal(metrics.maximumDrawdown, -9.5238); assert.equal(metrics.bestSessionReturn, 15.7895); assert.equal(metrics.worstSessionReturn, -9.5238);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pti-history-")); const cacheFile = path.join(root, "historicalMarket.json"); let calls = 0;
  const service = createHistoricalMarketService({ cacheFile, fetchImpl: async (url) => { calls += 1; return response(yahoo(decodeURIComponent(url.pathname.split('/').pop()))); }, now: () => Date.parse("2026-01-05T12:00:00Z"), predictionHistoryLoader: () => [{ticker:"AAPL",timeframe:"1-Day",publishedAt:"2026-01-03T12:00:00Z",confidence:82}], evidenceLoader: () => [{ticker:"AAPL",timestamp:"2026-01-03T13:00:00Z",type:"policy_event",title:"Dated event"}] });
  const [first, duplicate] = await Promise.all([service.getOne("AAPL", "1M"), service.getOne("AAPL", "1M")]); assert.equal(calls, 1, "duplicate in-flight requests share one call"); assert.deepEqual(first.series, duplicate.series);
  const cached = await service.getOne("AAPL", "1M"); assert.equal(calls, 1); assert.equal(cached.cache.hit, true);
  const partialService = createHistoricalMarketService({ cacheFile:path.join(root,"partial.json"), fetchImpl:async(url)=>url.pathname.endsWith("/BAD")?response({},500):response(yahoo("GOOD")) });
  const partial = await partialService.getHistory({tickers:["GOOD","BAD"],period:"1M",benchmark:null,horizon:"1-Day"}); assert(partial.results.find(row=>row.ticker==="GOOD").series.length); assert.equal(partial.results.find(row=>row.ticker==="BAD").error,"unavailable");
  const timeoutService = createHistoricalMarketService({cacheFile:path.join(root,"timeout.json"),timeoutMs:10,fetchImpl:(_url,{signal})=>new Promise((_r,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'}))))}); assert.equal((await timeoutService.getOne("SLOW","1M")).error,"timeout");
  fs.writeFileSync(path.join(root,"corrupt.json"),"not json"); const corrupt=createHistoricalMarketService({cacheFile:path.join(root,"corrupt.json"),fetchImpl:async()=>response(yahoo("SAFE"))}); assert((await corrupt.getOne("SAFE","1M")).series.length);
  const source=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8"); assert.match(source,/if \(!isLoggedIn\(request\)\)[\s\S]*\/api\/market-history/); assert.doesNotMatch(source.match(/pathname === "\/api\/market-history"[\s\S]*?return;/)?.[0]||"",/runPredictionScan|writeJson\(PREDICTIONS_FILE|securityProfileService/);
  assert(MAX_CACHE_ENTRIES <= 500); assert(!fs.existsSync(path.join(__dirname,"..","data","historicalMarket.json")));
  console.log("Historical market data contract passed.");
})().catch((error)=>{console.error(error);process.exit(1);});
