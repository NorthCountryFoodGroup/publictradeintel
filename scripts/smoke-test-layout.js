const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const adminJs = fs.readFileSync(path.join(root, "admin.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function luminance({ r, g, b }) {
  const values = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function contrast(hexA, hexB) {
  const a = luminance(hexToRgb(hexA));
  const b = luminance(hexToRgb(hexB));
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

assert.match(html, /dashboard-frame app-layout/, "authenticated app shell exists");
assert.match(html, /side-nav app-sidebar/, "desktop sidebar exists");
assert.match(html, /mobile-nav/, "mobile navigation exists");
assert.match(html, /id="pageTitle"/, "page title exists");
assert.match(html, /executive-dashboard/, "dashboard grid exists");
assert.match(html, /id="profileMenuButton"/, "profile menu button exists");
assert.match(html, /id="profileDropdown"/, "profile dropdown exists");
assert.match(html, /id="alertsMenuButton"/, "alerts menu button exists");
assert.match(html, /id="alertsDropdown"/, "alerts dropdown exists");
assert.match(html, /Admin Area/, "admin navigation exists for authenticated admin users");
assert.match(html, /Prediction Scan Settings/, "prediction scan settings remains visible in admin navigation");
assert.match(html, /styles\.css\?v=20260710-ux-acceptance/, "main stylesheet is cache-busted");
assert.match(html, /app\.js\?v=20260710-ux-acceptance/, "main app script is cache-busted");
assert.match(adminHtml, /styles\.css\?v=20260710-ux-acceptance/, "admin stylesheet is cache-busted");
assert.match(adminHtml, /admin\.js\?v=20260710-ux-acceptance/, "admin script is cache-busted");
assert.match(adminHtml, /data-admin-target="overview">Admin Dashboard/, "admin dashboard navigation exists");
assert.match(adminHtml, /data-admin-section="overview"/, "admin dashboard panel exists");
assert.match(adminHtml, /id="adminProfileMenuButton"/, "admin profile menu button exists");
assert.match(adminHtml, /id="adminAlertsMenuButton"/, "admin alerts menu button exists");
assert.match(adminJs, /adminHashTargets/, "admin hash routing map exists");
assert.match(adminJs, /"scan-universe":\s*"universe"/, "scan-universe hash opens prediction scan settings");
assert.match(adminJs, /setAdminSection\(adminSectionFromHash\(\)\)/, "admin page initializes from hash");
assert.match(css, /Version 2\.0 Visual Recovery Hotfix/, "visual recovery override exists");
assert.match(css, /Public Trade Intel UX Reset - Hybrid C/, "Hybrid C visual reset override exists");
assert.match(css, /\.dashboard-main\.app-shell\s*{[^}]*max-width:\s*none/s, "main content is not capped to a narrow column");
assert.match(css, /\.app-hero\s*{[^}]*display:\s*none/s, "authenticated marketing hero is removed");
const recoveryCss = css.slice(css.indexOf("Version 2.0 Visual Recovery Hotfix"));
const hybridCss = css.slice(css.indexOf("Public Trade Intel UX Reset - Hybrid C"));
assert.match(recoveryCss, /h1\s*{[^}]*font-size:\s*2rem/s, "final authenticated h1 override uses safe sizing");
assert.doesNotMatch(recoveryCss, /(^|[^0-9.])5rem\b/, "final recovery override does not use marketing hero sizing");
assert.match(hybridCss, /color-scheme:\s*light/, "light theme loads by default");
assert.match(hybridCss, /--bg:\s*#f6f8fb/i, "light neutral app background is the default");
assert.match(hybridCss, /\.topbar-dropdown/, "topbar dropdown styling exists");
assert.match(hybridCss, /repeat\(auto-fit,\s*minmax\(min\(/, "dashboard grids use responsive auto-fit columns");
assert.doesNotMatch(hybridCss, /grid-template-columns:\s*repeat\(4,\s*minmax\(280px,\s*1fr\)\)/, "Hybrid C dashboard grids avoid fixed-width overflow columns");
assert.ok(contrast("#f3faf6", "#0b1411") >= 7, "dark-mode primary text contrast is readable");
assert.ok(contrast("#c7d6d0", "#0b1411") >= 4.5, "dark-mode secondary text contrast is readable");
assert.ok(contrast("#101828", "#f6f8fb") >= 7, "light-mode primary text contrast is readable");
assert.ok(contrast("#475467", "#ffffff") >= 4.5, "light-mode secondary text contrast is readable");

console.log("Layout smoke test passed.");
