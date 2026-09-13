const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const explorer = fs.readFileSync(path.join(root, "performance-explorer.js"), "utf8");

assert.match(html, /id="performanceExplorerBody" hidden/, "Performance Explorer must start collapsed");
assert.match(html, /Open Performance Explorer/, "explicit explorer open action missing");
assert.doesNotMatch(explorer, /setTimeout\(\(\)=>\{if\(!controls\.body\.hidden\)load/, "explorer must not eagerly load history");
assert.match(explorer, /if\(opening\)\{load\(\)/, "explicit open must load historical data");
assert.match(explorer, /Top 10 currently published qualified recommendations/, "Best 10 source contract changed");

for (const view of ["summary", "audit", "methodology"]) {
  assert.match(html, new RegExp(`data-performance-subview="${view}"`), `${view} subview control missing`);
  assert.match(html, new RegExp(`data-performance-panel="${view}"`), `${view} subview content missing`);
}
assert.match(app, /panel\.hidden = panel\.dataset\.performancePanel !== performanceSubview/, "one-subview visibility rule missing");
assert.match(app, /panel\.classList\.toggle\("is-active", !panel\.hidden\)/, "page-level performance panels must honor subview visibility");

assert.match(html, /data-page-target="performance">AI Performance/, "mobile Performance access missing");
assert.match(html, /data-page-target="settings">Settings/, "mobile Settings access missing");
assert.doesNotMatch(html.match(/<nav class="mobile-nav"[\s\S]*?<\/nav>/)?.[0] || "", /admin\.html|data-page-target="admin"/, "mobile nav must not expose admin");

assert.match(app, /const STOCKS_TO_BUY_PAGE_SIZE = 6/, "bounded initial card count missing");
assert.match(app, /sortedRows\.slice\(stocksToBuyPage \* STOCKS_TO_BUY_PAGE_SIZE/, "stable pagination slice missing");
assert.match(html, /id="stocksPagePrevious"[\s\S]*id="stocksPageNext"/, "pagination controls missing");
assert.match(html, /<details class="best-ideas-disclosure">[\s\S]*id="bestIdeasGrid"/, "Best Ideas full cards should use accessible progressive disclosure");

const legacyLightSummaryRule = css.indexOf(".member-summary div,");
const opportunitiesSurfaceRule = css.indexOf("#predictionSummary > div {");
assert.ok(legacyLightSummaryRule >= 0, "legacy member-summary rule missing from cascade fixture");
assert.ok(opportunitiesSurfaceRule > legacyLightSummaryRule, "Opportunities surface rule must follow and override the legacy light summary rule");
assert.match(css, /#predictionSummary > div \{[\s\S]*?background: var\(--color-surface, #171a1f\);[\s\S]*?color: var\(--text-primary\);/, "rendered Opportunities cards must resolve to the dark branded surface and primary text");
assert.match(css, /#predictionSummary > div > span,[\s\S]*?#predictionSummary > div > small \{[\s\S]*?color: var\(--text-secondary\);/, "rendered Opportunities labels must use readable secondary text");
assert.match(css, /#predictionSummary > div > strong \{[\s\S]*?color: var\(--text-primary\);/, "rendered Opportunities values must use readable primary text");
assert.doesNotMatch(css, /#predictionSummary \.summary-tile/, "Opportunities rules must not target a class absent from rendered summary cards");

function rgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function luminance(hex) {
  const channels = rgb(hex).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

assert.ok(contrast("#f7f8fa", "#171a1f") >= 4.5, "Opportunities primary text contrast must meet WCAG AA");
assert.ok(contrast("#c7cdd5", "#171a1f") >= 4.5, "Opportunities secondary text contrast must meet WCAG AA");
assert.equal((app.match(/function renderTradeBrief\s*\(/g) || []).length, 1, "exactly one authoritative renderTradeBrief is required");
assert.match(app, /function legacyTradeBriefReference\s*\(/, "legacy renderer comparison reference must remain explicitly non-authoritative");
assert.doesNotMatch(css, /Phase 2[^\n]*hotfix/i, "Phase 2 must not add another hotfix layer");

console.log("Phase 2 visual consolidation contract passed.");
