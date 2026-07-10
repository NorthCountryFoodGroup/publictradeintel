# Public Trade Intel UX Acceptance Pass

Date: July 10, 2026

## Live Deployment

- Expected deployed commit before this pass: `56c43c23dc7a5fb014c041923ac1d2a593b91c70`
- Live HTTP fetch from this sandbox: failed because outbound access to `https://publictradeintel.com` was unavailable.
- Cache-busting applied: `styles.css?v=20260710-ux-acceptance`, `app.js?v=20260710-ux-acceptance`, and `admin.js?v=20260710-ux-acceptance`.

## Page Acceptance Matrix

| Page tested | Viewport tested | Result | Defect found | Fix applied | Remaining limitation |
| --- | --- | --- | --- | --- | --- |
| Dashboard | Static desktop/mobile CSS acceptance | Pass | Browser could serve stale CSS/JS | Added asset query cache-busting | Live visual screenshot unavailable in sandbox |
| Markets | Static desktop/mobile CSS acceptance | Pass | None in inspected shell/layout | No change | Live visual screenshot unavailable in sandbox |
| Opportunities | Static desktop/mobile CSS acceptance | Pass | None in inspected shell/layout | No change | Live visual screenshot unavailable in sandbox |
| AI Trade Brief | Static desktop/mobile CSS acceptance | Pass | Share Report looked active but had no implementation | Disabled and labeled Coming Soon in prior reset | Live visual screenshot unavailable in sandbox |
| Watchlists | Smoke test and static layout acceptance | Pass | None in inspected shell/layout | No change | Live visual screenshot unavailable in sandbox |
| Alerts | Smoke test and static layout acceptance | Pass | View All Alerts needed dropdown-safe routing | Confirmed dropdown navigation handling | Live visual screenshot unavailable in sandbox |
| AI Performance | Static desktop/mobile CSS acceptance | Pass | None in inspected shell/layout | No change | Live visual screenshot unavailable in sandbox |
| Settings | Static desktop/mobile CSS acceptance | Pass | None in inspected shell/layout | No change | Live visual screenshot unavailable in sandbox |
| Admin Dashboard | Static admin acceptance | Pass | Admin defaulted to Prediction Engine instead of dashboard | Added Admin Dashboard overview panel | Requires admin login to view live |
| Prediction Scan Settings | Static admin acceptance | Pass | Sidebar hash link was not routed by admin.js | Added hash-to-section routing | Requires admin login to view live |
| Prediction Engine Health | Static admin acceptance | Pass | Deep link did not select health panel | Added hash routing and health alias | Requires admin login to view live |
| Market Data | Static admin acceptance | Pass | Deep link did not select market panel | Added hash routing | Requires admin login to view live |
| Congress Feed | Static admin acceptance | Pass | Deep link did not select congress panel | Added hash routing | Requires admin login to view live |
| Policy Feed | Static admin acceptance | Pass | Deep link did not select policy panel | Added hash routing | Requires admin login to view live |
| System Health | Static admin acceptance | Pass | Deep link did not select health panel | Added hash routing | Requires admin login to view live |

## Interaction Acceptance

| Control | Result | Fix applied | Remaining limitation |
| --- | --- | --- | --- |
| Profile dropdown | Pass by static hook and JS validation | Main app profile menu opens, closes on outside click, closes on Escape, and supports Sign Out | Browser click-through unavailable in sandbox |
| Alerts dropdown | Pass by static hook and JS validation | Main app alerts menu opens, closes, renders alert summary, and routes View All Alerts | Browser click-through unavailable in sandbox |
| Admin topbar dropdowns | Pass by static hook and JS validation | Added admin alerts/profile dropdowns with outside click and Escape handling | Browser click-through unavailable in sandbox |
| Sidebar links | Pass by static hook and JS validation | Admin links now route to real hash destinations | Browser click-through unavailable in sandbox |
| Prediction Scan Settings link | Pass | `#scan-universe` maps to admin `universe` panel | Requires admin login |
| Run Prediction Scan | Pass | Prediction smoke test passed | External live API availability may vary |
| View Trade Brief | Pass by existing route hooks | No change | Browser click-through unavailable in sandbox |
| Add to Watchlist | Pass | Watchlist smoke test passed | None |
| Quick Compare | Pass | Existing message behavior remains active | None |
| Coming Soon items | Pass | Profile/admin future items are disabled and labeled Coming Soon | None |

## Viewport Acceptance

| Viewport | Result | Notes |
| --- | --- | --- |
| 1920 x 1080 | Pass by responsive CSS/static smoke | Sidebar fixed at 232px; main content uses `minmax(0, 1fr)` |
| 1440 x 900 | Pass by responsive CSS/static smoke | Topbar has flexible search column and action area |
| 1280 x 720 | Pass by responsive CSS/static smoke | Grids use `auto-fit` and `minmax(min(..., 100%), 1fr)` |
| 1024 x 768 | Pass by responsive CSS/static smoke | Main content remains beside sidebar until mobile breakpoint |
| 768 x 1024 | Pass by responsive CSS/static smoke | Sidebar hidden; bottom mobile navigation shown |
| 430 x 932 | Pass by responsive CSS/static smoke | Cards stack; dropdown width constrained to viewport |
| 390 x 844 | Pass by responsive CSS/static smoke | Mobile nav and topbar stay compact |
| 360 x 800 | Pass by responsive CSS/static smoke | One-column cards and safe dropdown sizing |

## Fixes Applied

- Added cache-busting to main and admin CSS/JS assets.
- Added a real Admin Dashboard overview panel.
- Added admin hash routing for:
  - `#admin-dashboard`
  - `#prediction-engine`
  - `#prediction-scan-settings`
  - `#scan-universe`
  - `#market-data`
  - `#congress-feed`
  - `#policy-feed`
  - `#system-health`
- Added working admin topbar alerts/profile dropdowns.
- Added focused admin overview cards so backend controls are not presented as one long page.

## Validation

- `app.js` syntax check: pass
- `admin.js` syntax check: pass
- `server.js` syntax check: pass
- prediction smoke test: pass
- watchlist smoke test: pass
- alerts smoke test: pass
- layout smoke test: pass
