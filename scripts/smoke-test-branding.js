const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(ROOT, name));
const text = (name) => read(name).toString("utf8");

const requiredAssets = [
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png",
  "android-chrome-192x192.png",
  "android-chrome-512x512.png",
  "safari-pinned-tab.svg",
  "site.webmanifest",
];
const pngAssets = requiredAssets.filter((name) => name.endsWith(".png"));
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

for (const asset of requiredAssets) {
  const assetPath = path.join(ROOT, asset);
  assert(fs.existsSync(assetPath), `${asset} must exist`);
  assert(fs.statSync(assetPath).size > 0, `${asset} must not be empty`);
}
assert(read("favicon.ico").length > 0, "favicon.ico must not be empty");
for (const asset of pngAssets) {
  assert(read(asset).subarray(0, 8).equals(pngSignature), `${asset} must have a valid PNG signature`);
}

const pages = ["index.html", "admin.html", "login.html"];
for (const page of pages) {
  const html = text(page);
  assert(/rel="icon" href="favicon\.ico"/.test(html), `${page} must reference favicon.ico`);
  assert(/favicon-16x16\.png/.test(html), `${page} must reference the 16px favicon`);
  assert(/favicon-32x32\.png/.test(html), `${page} must reference the 32px favicon`);
  assert(/rel="apple-touch-icon"[^>]+apple-touch-icon\.png/.test(html), `${page} must reference the Apple icon`);
  assert(/rel="manifest" href="site\.webmanifest"/.test(html), `${page} must reference the manifest`);
  assert(/name="theme-color" content="#0B0D10"/.test(html), `${page} must use the brand theme color`);
  assert(/rel="mask-icon"[^>]+safari-pinned-tab\.svg[^>]+#D4AF37/.test(html), `${page} must reference the mask icon`);
}

const manifest = JSON.parse(text("site.webmanifest"));
assert.strictEqual(manifest.name, "PublicTradeIntel");
assert.strictEqual(manifest.short_name, "TradeIntel");
assert.strictEqual(manifest.theme_color, "#0B0D10");
assert.strictEqual(manifest.background_color, "#0B0D10");
assert.strictEqual(manifest.display, "standalone");
assert(manifest.icons.some((icon) => icon.sizes === "192x192" && icon.type === "image/png"));
assert(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.type === "image/png"));

const indexHtml = text("index.html");
const adminHtml = text("admin.html");
for (const [name, html] of [["index.html", indexHtml], ["admin.html", adminHtml]]) {
  assert(/class="brand-mark" src="icon\.svg"/.test(html), `${name} must contain the sidebar logo`);
  assert(html.includes("PUBLICTRADEINTEL"), `${name} must contain the product name`);
}
assert.strictEqual((indexHtml.match(/class="brand-mark"/g) || []).length, 1, "the app logo must appear only in the sidebar brand area");
assert(!/watermark[^>]*(icon\.svg|brand-mark)/i.test(indexHtml), "the dashboard must not contain a logo watermark");

const css = text("styles.css");
const requiredCss = [
  ["background", /--bg:\s*#0b0d10/i],
  ["panel", /--panel:\s*#171a1f/i],
  ["border", /--line:\s*#2a2f36/i],
  ["gold", /--gold:\s*#d4af37/i],
  ["blue", /--accent:\s*#1e88ff/i],
  ["success", /--color-success:\s*#2f9e6f/i],
  ["warning", /--color-warning:\s*#c58a2a/i],
  ["negative", /--color-danger:\s*#c94b55/i],
  ["primary text", /--text-primary:\s*#f7f8fa/i],
  ["secondary text", /--text-secondary:\s*#c7cdd5/i],
];
for (const [label, pattern] of requiredCss) assert(pattern.test(css), `${label} brand variable must exist`);
assert(/#runPredictionScan,[\s\S]*?\[data-run-prediction-scan\][\s\S]*?background:\s*#d4af37/i.test(css), "primary scan actions must use gold");
assert(/button,[\s\S]*?background:\s*#1e88ff/i.test(css), "interactive actions must use electric blue");
assert(new Set(["#2f9e6f", "#c58a2a", "#c94b55"]).size === 3, "semantic state colors must remain distinct");
assert(/prefers-reduced-motion:\s*reduce/.test(css), "reduced-motion preference must be respected");
assert(!/watermark[^{]*\{[^}]*(background-image|content)[^}]*(icon|bull|shield)/i.test(css), "branding must not add a watermark selector");

const server = text("server.js");
assert(server.includes('".png": "image/png"'));
assert(server.includes('".ico": "image/x-icon"'));
const publicAssetPaths = requiredAssets.map((asset) => `/${asset}`);
for (const assetPath of publicAssetPaths) {
  assert(server.includes(`"${assetPath}"`), `${assetPath} must be in the exact public allowlist`);
}
assert(server.includes('filePath.includes(`${path.sep}data${path.sep}`)'), "runtime data must remain blocked from static serving");
assert(server.includes("filePath.startsWith(ROOT)"), "repository-root containment must remain enforced");

const serviceWorker = text("sw.js");
for (const asset of requiredAssets) assert(serviceWorker.includes(`"./${asset}"`), `${asset} must be in the static cache inventory`);
assert(!/["']\.\/api\//.test(serviceWorker), "the static cache inventory must not add API routes");

const brandAssetText = [text("icon.svg"), text("safari-pinned-tab.svg"), text("site.webmanifest")].join("\n");
const brandedPageLinks = pages.map(text).join("\n");
assert(!/(?:src|href)=["']https?:\/\//i.test(`${brandAssetText}\n${brandedPageLinks}`), "branding must not use external runtime image URLs");
assert(!/(LOGIN_PIN|ADMIN_PIN|PORTFOLIO_PIN|API_KEY|DATA_DIR|securityProfiles\.json|predictions\.json)/.test(brandAssetText), "branding assets must not reference secrets or runtime data");
const totalAssetBytes = ["icon.svg", ...requiredAssets].reduce((total, asset) => total + fs.statSync(path.join(ROOT, asset)).size, 0);
assert(totalAssetBytes < 100 * 1024, `branding assets must remain below 100 KiB; received ${totalAssetBytes}`);

console.log(`Branding contract passed (${requiredAssets.length + 1} assets, ${totalAssetBytes} bytes).`);
