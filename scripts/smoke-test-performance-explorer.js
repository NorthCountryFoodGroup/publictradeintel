const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8"), app=fs.readFileSync(path.join(root,"performance-explorer.js"),"utf8"), server=fs.readFileSync(path.join(root,"server.js"),"utf8"), css=fs.readFileSync(path.join(root,"styles.css"),"utf8");
assert.match(html,/id="performanceExplorer"/); assert.match(html,/Performance Explorer/); assert.match(html,/value="trend">Trend/); assert.match(html,/Return Ranking/);
for(const period of ["7D","1M","6M","1Y","2Y"]) assert.match(html,new RegExp(`>${period}<|>${period}</option>`));
for(const group of ["Best 10 Today","My Watchlist","Top 25 Selection","Single Stock Focus"]) assert(html.includes(group));
assert.match(app,/slice\(0, 10\)/); assert.match(app,/data-performance-select/); assert.match(app,/of 10 selected/); assert.match(app,/localStorage\.setItem\("ptiPerformanceSelection"/); assert.match(app,/publicTradeIntelExplorerContext/);
assert.match(app,/cumulativeReturn/); assert.match(app,/chart-series/); assert.match(app,/Return Ranking horizontal bar chart/); assert.match(html,/Historical market performance, not a forecast/); assert.match(html,/PublicTradeIntel confidence is a model assessment/);
assert.match(app,/predictionHistory/); assert.match(app,/events/); assert.match(app,/causation is not established/); assert.match(html,/Accessible analytical table/); assert.match(app,/aria-label/); assert.match(css,/performance-explorer/); assert.match(css,/overflow-x:auto/);
assert.doesNotMatch(app,/predictions\/scan|buildPrediction|unifiedScore\s*=|fetch\([^)]*scan/); assert.doesNotMatch(app,/https?:\/\//); assert.match(server,/\/api\/market-history/);
function extractFunction(source,name){const start=source.indexOf(`function ${name}(`);assert(start>=0);let brace=source.indexOf("{",start),depth=0;for(let i=brace;i<source.length;i++){if(source[i]==="{")depth++;if(source[i]==="}"){depth--;if(depth===0)return source.slice(start,i+1);}}throw new Error('function end');}
assert.equal(crypto.createHash("sha256").update(extractFunction(server,"buildPrediction")).digest("hex"),"72714872ed27c9c7d1ceac407a87e67d753afb9f6c7cec8f0051cc80631fb1bc");
console.log("Performance Explorer contract passed.");
