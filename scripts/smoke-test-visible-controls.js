const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const js = fs.readFileSync(path.join(root, "app.js"), "utf8");
const adminJs = fs.readFileSync(path.join(root, "admin.js"), "utf8");
const all = `${html}\n${adminHtml}\n${js}\n${adminJs}`;

function expect(pattern, message) {
  assert.match(all, pattern, message);
}

expect(/id="profileMenuButton"[\s\S]*id="profileDropdown"/, "Profile menu exists");
expect(/profileMenuButton\?\.addEventListener\("click"/, "Profile menu opens");
expect(/document\.addEventListener\("keydown"[\s\S]*Escape[\s\S]*closeTopbarMenus/, "Profile and alert menus close on Escape");
expect(/id="alertsMenuButton"[\s\S]*id="alertsDropdown"/, "Alerts bell exists");
expect(/alertsMenuButton\?\.addEventListener\("click"/, "Alerts bell opens");
expect(/data-page-target="alerts">View All Alerts/, "View All Alerts has a real destination");
expect(/id="profileSignOutButton"[\s\S]*Sign Out/, "Sign Out control exists");
expect(/profileSignOutButton\?\.addEventListener\("click"[\s\S]*api\/logout/, "Sign Out calls logout");
expect(/id="globalSearch"[\s\S]*function runGlobalSearch\(\)/, "Global search is functional");
expect(/data-quick-compare="\$\{escapeHtml\(item\.ticker\)\}"/, "Quick Compare controls exist");
expect(/data-quick-compare[\s\S]*currently appears on this selected list only/, "Quick Compare gives user feedback");
expect(/Share Report <small>Coming Soon<\/small>[\s\S]*disabled/, "Share Report is disabled and labeled Coming Soon");
expect(/data-create-alert-for[\s\S]*addAlertRuleForTicker/, "Create Alert is functional");
expect(/data-add-watchlist[\s\S]*addTickerToActiveWatchlist/, "Add to Watchlist is functional");
expect(/data-view-brief[\s\S]*openTradeBrief/, "View Trade Brief is functional");
expect(/data-run-prediction-scan[\s\S]*runPredictionScan/, "Run Prediction Scan is functional");
expect(/mobile-nav[\s\S]*data-page-target="dashboard"[\s\S]*data-page-target="alerts"/, "Mobile navigation exists");
expect(/disabled>Profile <small>Coming Soon<\/small>/, "Future profile destination is disabled");
expect(/id="adminProfileMenuButton"[\s\S]*id="adminProfileDropdown"/, "Admin profile menu exists");
expect(/id="adminAlertsMenuButton"[\s\S]*id="adminAlertsDropdown"/, "Admin alerts menu exists");
expect(/id="adminGlobalSearch"[\s\S]*function runAdminSearch\(\)/, "Admin global search is functional");

console.log("Visible controls smoke test passed.");
