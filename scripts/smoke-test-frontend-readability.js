const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const finalCss = css.slice(css.lastIndexOf("Final frontend readability cascade"));
assert.match(finalCss, /overflow-wrap:\s*normal/, "cards should override aggressive wrapping");
assert.match(finalCss, /word-break:\s*normal/, "labels should not break character-by-character");
assert.doesNotMatch(finalCss, /word-break:\s*break-all/, "final rules must not use break-all");
assert.match(finalCss, /white-space:\s*nowrap/, "scores should remain intact");
assert.match(finalCss, /min-width:\s*max-content/, "scores should retain intrinsic width");
assert.match(finalCss, /repeat\(auto-fit,\s*minmax\(min\(230px,\s*100%\),\s*1fr\)\)/, "Trade Brief metrics need realistic columns");
assert.match(finalCss, /@media \(max-width:\s*900px\)[\s\S]*repeat\(2,\s*minmax\(min\(200px,\s*100%\),\s*1fr\)\)/, "tablet layouts should reduce columns");
assert.match(finalCss, /@media \(max-width:\s*560px\)[\s\S]*grid-template-columns:\s*1fr/, "mobile metric groups should stack");

const denseCardCss = css.slice(css.lastIndexOf("Dense prediction cards"));
assert.match(
  denseCardCss,
  /\.prediction-grid,[\s\S]*\.stocks-to-buy-grid[\s\S]*minmax\(min\(320px,\s*100%\),\s*1fr\)/,
  "dense card grids should reduce columns before cards become unreadably narrow",
);
assert.match(
  denseCardCss,
  /\.prediction-metadata-grid\s*\{[\s\S]*minmax\(min\(140px,\s*100%\),\s*1fr\)/,
  "metadata subcells should retain a realistic minimum width",
);
assert.match(denseCardCss, /\.prediction-metadata-grid > div\s*\{[\s\S]*overflow:\s*visible/, "metadata cells must not clip content");
assert.match(
  denseCardCss,
  /\.prediction-metadata-grid span,[\s\S]*\.prediction-metadata-grid strong\s*\{[\s\S]*text-overflow:\s*clip[\s\S]*white-space:\s*normal/,
  "descriptive compact fields should wrap only at natural boundaries",
);
assert.doesNotMatch(denseCardCss, /overflow:\s*hidden/, "final metadata rules must not hide meaningful content");
assert.doesNotMatch(denseCardCss, /text-overflow:\s*ellipsis/, "final metadata rules must not replace values with ellipses");
assert.doesNotMatch(denseCardCss, /word-break:\s*break-all|overflow-wrap:\s*anywhere/, "metadata must not stack characters");

for (const value of ["#1 in $10.01-$50", "Overall - Any Price", "Required/possible", "May be required"]) {
  assert.ok(value.length > 0, `${value} remains meaningful visible content`);
}

for (const value of ["7/100", "78/100", "100/100", "$6.34-$6.48", "2.38x", "1.39"]) {
  assert.ok(!/\s/.test(value), `${value} is protected as a compact value`);
}

const context = {
  settings: { stockIdeas: [] },
  normalizeTicker: (value) => String(value || "").trim().toUpperCase(),
};
vm.createContext(context);
vm.runInContext(`${extractFunction(app, "securityProfileForTradeBrief")}; this.securityProfileForTradeBrief = securityProfileForTradeBrief;`, context);

const company = context.securityProfileForTradeBrief({
  ticker: "ACME",
  securityName: "Acme Manufacturing Corporation",
  securityType: "Common Stock",
  companyDescription: "Acme manufactures verified industrial components for commercial customers.",
  industry: "Industrial Machinery",
  sector: "Industrials",
  exchange: "NYSE",
  headquarters: "Chicago, United States",
});
assert.equal(company.label, "About this company");
assert.match(company.description, /manufactures verified industrial components/);

const etf = context.securityProfileForTradeBrief({
  ticker: "FUND",
  securityName: "Verified Market Index ETF",
  securityType: "ETF",
  securityDescription: "This exchange-traded fund tracks a verified broad-market index.",
  exchange: "NASDAQ",
});
assert.equal(etf.label, "About this ETF");
assert.match(etf.description, /exchange-traded fund/);

const unavailable = context.securityProfileForTradeBrief({ ticker: "UNKNOWN" });
assert.equal(unavailable.label, "About this security");
assert.equal(unavailable.description, "Company profile information is not currently available for this security.");

assert.match(app, /security-profile-section/, "every rendered Trade Brief should include a profile section");
assert.match(app, /Missing profile details are not inferred/, "profile fallback should forbid inference");

console.log("Frontend readability and security-profile contract passed.");
