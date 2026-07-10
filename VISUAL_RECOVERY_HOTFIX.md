# Version 2.0 Visual Recovery Hotfix

## Root Cause

The visual regression came from multiple recent UI layers defining competing layout and design-system rules in `styles.css`.

- The authenticated app shell had an early CSS grid layout, then later rules added a fixed `margin-left: 268px` to `.dashboard-main`, which made the main content behave like it was offset twice.
- Main content was capped with `width: min(1240px, calc(100% - 32px))` and mobile rules capped it again near `760px`, causing desktop pages to render like narrow tablet layouts.
- The authenticated app still used the marketing hero block with `h1 { font-size: clamp(2.45rem, 5vw, 5rem); }`, producing oversized typography and pushing useful dashboard cards below the fold.
- Design-system tokens were appended after older light-theme tokens, while older components still referenced `--ink`, `--muted`, and `--panel`; this caused dark text and muted text to land on dark surfaces in some contexts.
- Several grid definitions used `minmax(0, 1fr)` in crowded sections while parent widths were constrained, allowing cards and words to collapse into very narrow columns.

## Recovery Approach

- Added a final `Version 2.0 Visual Recovery Hotfix` CSS override section so recovery rules win over earlier conflicting declarations.
- Restored a stable desktop shell with a 236px sidebar and full-width main content.
- Removed the authenticated marketing hero from display.
- Reset application typography to safe dashboard-sized values.
- Restored readable dark-mode color tokens and card surfaces.
- Added `scripts/smoke-test-layout.js` to catch app-shell, typography, width, and contrast regressions.
