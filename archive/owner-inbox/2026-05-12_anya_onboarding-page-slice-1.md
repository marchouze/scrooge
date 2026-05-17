---
title: "Onboarding page — Slice 1 completion brief"
author: Anya (Data / analytics engineer, engineering)
date: 2026-05-12
decision-required: false
---

## What was built

Two new files and one updated file, opening the `/onboarding` dashboard page:

### `prototype/dashboard/public/onboarding.html`

Page shell following the same topbar / band / table conventions as `obligations.html` and `policies.html`. Sections:

1. **Intro band** — describes the 21-phase lifecycle, names authority citations (`D-PARTY-REGISTER`, `AML-CFT-POLICY-V1`, `TRADING-MANDATE-V1`, `FIC-ACT-38-2001`), and links to the backing API (`GET /api/onboarding`, PR #272).
2. **Summary tiles** — four cards: Total counterparties · Active (phase = `activated`) · In progress (not terminal, not `sounding`) · Offboarded (phase = `offboarded`).
3. **Phase funnel table** — 21-phase canonical sequence (index + phase chip + count), zero-count phases omitted.
4. **Counterparty table** — columns: counterparty ID · phase chip · last event type · last advanced (date only) · terminal badge. Sorted by `lastAdvancedAt` descending.
5. **Empty state** — if `totalCounterparties === 0`, a clear message: "No counterparties in the onboarding pipeline yet. Niko's rehearsal scenarios will appear here once seeded."
6. **As-of timestamp** in the page header, matching `obligations.html` pattern.

Phase chips use a four-tone palette: green (`activated`), red (`offboarded`), grey (`sounding`), blue (all in-progress phases).

### `prototype/dashboard/public/onboarding.js`

Vanilla JS (no external frameworks, consistent with the dashboard's established convention). Fetches `GET /api/onboarding` every 30 seconds. Renders all four sections from the `OnboardingBoardView` shape. Handles the empty-state case explicitly.

### `prototype/dashboard/public/home.js`

Two changes:

1. **New "Onboarding" tile** added to the `dashboards` section (after "Health"), linking to `/onboarding.html`. The tile shows a live count from `GET /api/onboarding` — total counterparties with active/in-progress meta chips.
2. **KYC / Onboarding compliance tile** updated: removed `placeholder: true` and `href: "#"`, now links to `/onboarding.html` and pulls the same count. Blurb updated to describe the 21-phase CDD/sanctions/FATCA/CRS/POPIA lifecycle.

## CI gate

`bun run ci` passed from `prototype/` — 1379 tests passing, typecheck clean, biome lint and format clean, all recon pipelines green.

## Deferred items

- **Niko rehearsal scenarios** — the counterparty table and phase funnel will populate once Niko (Client lifecycle / onboarding orchestrator agent) seeds rehearsal scenarios. At that point the empty-state message disappears and the phase funnel shows real distribution.
- **Phase click-through** — clicking a phase row or counterparty could navigate to a detail view showing the full event trace for that counterparty. Deferred to Slice 2.
- **Filter controls** — a phase-filter select and a counterparty-ID search input, matching the `obligations.html` pattern, are natural Slice 2 additions once there are enough rows to filter.
- **Export / snapshot** — point-in-time CSV export of the counterparty table. Deferred (RMS document register is the canonical artefact channel).

## What Niko's rehearsal scenarios will look like when they land

Each rehearsal scenario emits a sequence of typed `CounterpartyOnboarding*` events for a synthetic counterparty ID (e.g. `CP-REHEARSAL-001`). The projection that backs `GET /api/onboarding` advances the counterparty's `phase` with each event. When a scenario runs:

- The **phase funnel** will show counts distributed across the 21 phases — early rehearsals likely cluster around `prospect-registered`, `fais-categorised`, `cdd-initiated`, `sanctions-cleared`, and `activated`.
- The **counterparty table** will show each rehearsal counterparty's current phase chip, the last event type that advanced it (e.g. `CounterpartyActivated`), the date, and `yes` in the terminal column for those that reached `activated` or `offboarded`.
- The **summary tiles** will light up: Active count and In-progress count will both be non-zero, confirming the pipeline is exercised end-to-end.

The onboarding page is the natural rehearsal readout surface — Niko (Client lifecycle / onboarding orchestrator agent) and Scrooge (Chief of Staff / Orchestrator) can confirm each wave of rehearsal scenarios by glancing at this page.

## Authority

- `D-PARTY-REGISTER` — Party register substrate; counterparty identity axis.
- `AML-CFT-POLICY-V1` — CDD, sanctions, and KYC obligations that gate phase transitions.
- `TRADING-MANDATE-V1` — Eligibility and credit-assessment gates before mandate assignment.
- `FIC-ACT-38-2001` — FATCA/CRS classification and POPIA recording phases.
- API wired in PR #272 by Atlas (Core banking platform architect, engineering) + Niko (Client lifecycle / onboarding orchestrator agent).
