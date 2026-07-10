# Public Trade Intel Design System

Public Trade Intel uses a dashboard-first design system for stock intelligence, prediction reports, admin controls, and future subscriber workflows. The system favors fast decision-making, progressive disclosure, and professional research readability.

## Core UX Principles

- Three Click Rule: every major user function should be reachable from the Dashboard in three clicks or fewer.
- Progressive Disclosure: show the next decision first, then reveal detail through Trade Briefs, expandable panels, or drill-down pages.
- Dashboard First: summaries, alerts, and top actions belong on dashboards instead of long pages.
- Consistency Over Novelty: reuse the same cards, badges, buttons, spacing, and typography before inventing a new pattern.
- Actionable Before Technical: show recommendation, score, risk, and next action before showing model internals.

## Color System

### Core Tokens

- Primary: `--color-primary`
- Primary hover: `--color-primary-hover`
- Secondary: `--color-secondary`
- Information: `--color-info`
- Success: `--color-success`
- Warning: `--color-warning`
- Danger: `--color-danger`
- Neutral: `--color-neutral`
- Background: `--color-bg`
- Surface: `--color-surface`
- Surface raised: `--color-surface-raised`
- Border: `--color-border`
- Hover: `--color-hover`
- Disabled: `--color-disabled`

### Usage

- Primary is for main actions such as running a scan or opening a Trade Brief.
- Success is for healthy status, positive catalysts, and bullish confidence signals.
- Warning is for partial data, mixed reads, or caution states.
- Danger is for failed states, avoid calls, or negative catalysts.
- Neutral is for placeholders and tracking states.

Dark mode is the default visual direction. Light mode remains supported through the same semantic tokens.

## Typography

- Display: large app/landing-level titles.
- H1: primary page title.
- H2: section title.
- H3: card or subsection title.
- Body: normal explanatory text.
- Small: secondary labels and form help.
- Caption: timestamps, provider notes, and supporting metadata.
- Metric numbers: scores, counts, prices, and percent values.
- Card titles: compact, high-contrast labels inside dashboard cards.

Use typography hierarchy to reduce explanation length. Dashboards should rely on labels, metrics, subtitles, and actions.

## Spacing

### Tokens

- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 20px
- `--space-6`: 24px
- `--space-8`: 32px
- `--space-10`: 40px

### Layout Standards

- Card padding: `--card-padding`
- Card gap: `--card-gap`
- Grid gap: `--grid-gap`
- Section gap: `--section-gap`
- Desktop content uses multi-column grids where the content remains scannable.
- Tablet content should collapse to two columns when possible.
- Mobile content should use a single-column flow and bottom navigation.

## Component Library

### Cards

Use `.pti-card` for generic reusable cards.

Recommended structure:

```html
<article class="pti-card">
  <div class="pti-card-header">
    <span class="pti-card-icon">AI</span>
    <div>
      <h3 class="pti-card-title">Prediction Engine</h3>
      <p class="pti-card-subtitle">Healthy</p>
    </div>
  </div>
  <strong class="pti-card-value">90</strong>
  <p class="pti-card-subtitle">Candidates scanned</p>
</article>
```

Dashboard cards should always include:

- Header
- Icon
- Title
- Value
- Subtitle
- Optional action

### Buttons

Use:

- `.pti-button`
- `.pti-button.primary`
- `.pti-button.secondary`
- `.pti-button.ghost`
- `.pti-button.danger`

Buttons should be short and action-oriented.

### Badges

Use `.pti-badge` plus semantic modifiers:

- `.success`
- `.warning`
- `.danger`
- `.info`
- `.neutral`

Prediction confidence badges:

- `.confidence-very-high`
- `.confidence-high`
- `.confidence-medium`
- `.confidence-low`

Recommendation badges:

- `.recommendation-strong-buy`
- `.recommendation-buy`
- `.recommendation-watch`
- `.recommendation-speculative`
- `.recommendation-avoid`

Engine status badges:

- `.status-healthy`
- `.status-warning`
- `.status-failed`

Market data badges:

- `.market-good`
- `.market-partial`
- `.market-stale`
- `.market-failed`

### Tables

Use `.pti-table` only where a table is truly easier than cards. Prefer cards for dashboards and mobile screens.

### Forms and Dropdowns

Use `.pti-form`, `.pti-field`, and `.pti-select`. Forms should be grouped into short sections. Long admin forms should use tabs or collapsible sections.

### Navigation

Desktop:

- Fixed left navigation
- Sticky top app bar
- Breadcrumbs
- Global search
- Notifications
- User profile

Mobile:

- Top app bar
- Bottom navigation
- Single-column cards

### Tabs

Use `.pti-tabs` and `.pti-tab`. Tabs should replace long scrolling when a page grows beyond about two desktop screen heights.

### Modals

Use `.pti-modal-backdrop` and `.pti-modal`. Modals are for focused decisions, not long reports.

### Alerts

Use `.pti-alert` with `.success`, `.warning`, `.danger`, or `.info`.

### Status Indicators

Use `.pti-status-dot` with `.success`, `.warning`, `.danger`, or `.neutral`.

## Animation Guidelines

- Use fast transitions: 120ms to 180ms.
- Hover states should be subtle.
- Expandable cards should animate lightly.
- Avoid distracting animations, looping motion, or novelty effects.

## Accessibility

- Maintain high contrast in dark mode.
- Use consistent focus states.
- Keep text readable on mobile.
- Ensure buttons and links are keyboard-focusable.
- Prefer semantic buttons for actions and links for navigation.
- Avoid icon-only controls unless they include labels or accessible names.

## Page Length Rule

If a page becomes longer than approximately two screen heights on desktop, redesign it into:

- Sections
- Tabs
- Expandable panels
- Drill-down pages

Do not keep adding content to long pages.

