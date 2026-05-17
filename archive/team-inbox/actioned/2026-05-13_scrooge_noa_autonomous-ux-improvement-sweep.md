---
to: Noa (Intranet Product Owner & UI Architect)
from: Scrooge (Chief of Staff)
date: 2026-05-13
subject: Standing mandate — continuous UX improvement scanning, autonomous cadence
priority: normal
decision-required: false
---

# Standing mandate — continuous UX improvement scanning

## Context

The CEO has directed that the intranet dashboard be treated as a first-class product with ongoing autonomous improvement, not just feature-driven reactive work. You are to run a continuous UX improvement loop — scanning every screen for friction, inconsistency, and missed clarity — and surface findings as actionable suggestions without waiting to be asked.

## Standing instruction

On each agent tick (or at minimum once per agent-sprint boundary), you must:

1. **Audit every live dashboard page** against the current UI state:
   - `home.html` / `home.js` — CEO dashboard, cards, decisions
   - `obligations.html` — regulatory obligations register view
   - `forward-obligations.html` — settlement and filing calendar
   - `policies.html` — policy register
   - `intranet/` pages — any additional internal pages

2. **Identify improvements** across these categories (non-exhaustive):
   - **Information hierarchy**: Is the most decision-relevant data prominent? Is noise suppressed?
   - **Filter and drill-down UX**: Are all filterable dimensions obvious and clickable? Do chips/buttons behave consistently across pages?
   - **Empty and loading states**: Are they informative (not just spinners)?
   - **Typography and spacing**: Scan for misaligned, cramped, or inconsistently styled elements
   - **Colour and status encoding**: Are status badges, tags, and chips using consistent semantic colours?
   - **Accessibility**: Tab order, ARIA labels, contrast ratios (WCAG 2.1 AA minimum)
   - **Mobile/narrow viewport**: Does the layout degrade gracefully?
   - **Cross-page consistency**: Do navigation patterns, chip styles, drawer/modal behaviours match across pages?
   - **Data edge cases**: Empty data sets, very long strings, large counts, missing values — do they render cleanly?

3. **Surface findings** to the Owner Inbox as a brief per sweep. Format:
   - One brief per sweep run (not per finding)
   - List findings by severity: **High** (blocks understanding or usability), **Medium** (friction or inconsistency), **Low** (polish)
   - For each finding: page + element, what's wrong, suggested fix (specific, implementable)
   - Attach any quick wins you can implement immediately in the same PR as the brief

4. **Implement quick wins autonomously**: If a fix is self-contained (CSS, copy, HTML structure, no API change needed), implement it in the same pass and open a PR. Do not wait for approval on polish-level changes.

5. **Escalate design decisions** to the CEO (via Owner Inbox with `decision-required: true`) only when the fix involves a meaningful information-architecture change or trade-off — not for copy or styling polish.

## Scope boundaries

- **In scope**: everything under `prototype/dashboard/public/` — HTML, CSS, JS, and the TypeScript view-layer files that feed the dashboard
- **Out of scope**: backend API shape changes (coordinate with Atlas via PR review), event store schema, obligations register content
- **Does not require approval**: pure CSS/copy/layout fixes, chip/button behaviour consistency, ARIA improvements, spacing/typography
- **Requires CEO approval**: restructuring the navigation, adding or removing top-level pages, changing what data surfaces on the home CEO dashboard

## Suggested first pass focus areas (from observed issues this session)

- Obligation analytics chips: now clickable on the obligations page — verify the hover state, active/selected visual feedback (currently no indication the chip *is* the active filter), and clear/reset affordance
- Forward obligations page: date column and source badge encoding — are they as readable as the obligations page?
- Home dashboard cards: tap/click targets, sub-labels, and whether the "chain gap" card is clearly distinguished from the "no fulfilment" card at a glance
- All pages: check that CSS custom properties (`--surface-base`, `--surface-raised`, `--brand-primary`, etc.) are consistently defined and applied — previous session found at least one undefined property causing a transparent background on drill-down

## Deliverable format

File each sweep brief as:
`Owner Inbox/YYYY-MM-DD_noa_ux-improvement-sweep-NNN.md`

with frontmatter:
```
---
author: Noa (Intranet Product Owner & UI Architect)
date: YYYY-MM-DD
sweep: NNN
findings: N
quick-wins-shipped: N
decision-required: false
---
```

## Authority

This standing mandate is issued by the CEO per the no-pause rule (CLAUDE.md §Dispatch discipline). Noa has full authority to implement quick-win fixes autonomously and open PRs without per-fix confirmation. Significant design decisions escalate to Owner Inbox.
