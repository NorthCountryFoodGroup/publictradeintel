const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const doc = fs.readFileSync(path.join(root, "PRICE_BAND_RANKINGS.md"), "utf8");

assert.match(app, /function priceBandForPrice/, "price band helper should exist");
assert.match(app, /price <= 5[\s\S]*under5/, "$5 and under band should exist");
assert.match(app, /price <= 10[\s\S]*5to10/, "$5.01-$10 band should exist");
assert.match(app, /price <= 50[\s\S]*10to50/, "$10.01-$50 band should exist");
assert.match(app, /price <= 100[\s\S]*50to100/, "$50.01-$100 band should exist");
assert.match(app, /over100/, "$100.01 and up band should exist");
assert.match(app, /priceBandRank/, "cards should include price-band rank metadata");
assert.match(app, /Overall Rank/, "cards or Trade Brief should show overall rank");
assert.match(app, /Price-Band Rank/, "Trade Brief should show price-band rank");
assert.match(html, /id="opportunityPriceBand"/, "price band selector should exist");
assert.match(doc, /Price-band rank/, "price-band documentation should describe ranks");

console.log("Price band rankings smoke test passed.");

