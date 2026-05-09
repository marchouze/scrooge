---
title: Bank UI v0 — home shell, app launcher, brand tokens
author: Atlas (Core banking platform architect) + Anya (Data / analytics engineer) + Linnea (Brand & design lead)
date: 2026-05-09
summary: First foundational UI for the bank — `/home.html` lands a launcher with seven categories (Dashboards, Reports, Decisions, Registers, Substrate ops, Markets, Compliance), Linnea's brand tokens applied, identity stub for Marc · CEO, audit-log stub. Substrate gaps named, not hidden.
decision-required: false
---

# Bank UI v0 — home shell, app launcher, brand tokens

**From:** Atlas (Core banking platform architect) + Anya (Data / analytics engineer) + Linnea (Brand & design lead).
**To:** Marc (CEO) — via Scrooge.
**Authority:** CEO directive 2026-05-09 ("Start building the bank UI — this should be the base from which humans interact with the bank.").
**Cites:** the inaugural brand package (`Owner Inbox/2026-05-07_linnea_inaugural-brand-package.md`); Principle 6 (single-graph discipline); Principle 7 (autonomous-by-default — humans use this UI; agents don't); the `feedback_dashboards_live_reports_as_of` IA convention.

---

## What landed

A new launcher at `/home.html`, served as the root of `prototype/dashboard` (i.e. `/` redirects to `/home.html`). Existing pages (`/index.html`, `/agents.html`, `/policies.html`, etc.) keep their old chrome — retrofit to the new shell is a v1 follow-on, sequenced behind the parallel client-refresh PR Anya is shipping today.

New files only — no edits to the in-flight surface (`app.js`, `index.html`, per-page `*.js`):

- `prototype/dashboard/public/_brand.css` — Linnea's tokens (palette, typography, spacing, elevation, motion).
- `prototype/dashboard/public/_shell.css` — header, sidebar, footer, tile system. Tokens-only.
- `prototype/dashboard/public/_shell.js` — identity stub, audit-log stub, fetch helpers, nav-click instrumentation.
- `prototype/dashboard/public/home.html` — launcher page, seven categories.
- `prototype/dashboard/public/home.js` — tile catalogue + live-counts integration.
- `prototype/dashboard/public/brand/logo-direction-a.svg` — active mark (also inlined in the header SVG).
- `prototype/dashboard/public/brand/logo-direction-b.svg`, `logo-direction-c.svg` — inactive alternates.
- `prototype/dashboard/server.ts` — single addition: `/` → `/home.html` 302 redirect.

---

## Information architecture

Seven categories. The split between **Dashboards (live)** and **Reports (as-of-date)** follows the existing `feedback_dashboards_live_reports_as_of` convention.

| Category | Kind | Tiles |
|---|---|---|
| Dashboards | Live | Obligations · Policies · Activity · Agents · Escalations · Fleet · Health |
| Reports | As-of-date | Owner Inbox · BA returns · Board packs · Financial statements · Audit reports |
| Decisions | Live | CEO decisions · Board decisions (placeholder) |
| Registers | Canonical | Obligations register · Policy register · Procedures index · Agent registry · Regulations index |
| Substrate ops | Live | Architecture · Fleet · Health · Agents · Escalations · Substrate gaps |
| Markets | M-phase | Trading desks · Portfolios · Exposures · Risk positions (all placeholders, flagged) |
| Compliance | Procedures | FIC submissions · Sanctions · KYC / onboarding · Conduct surveillance (all placeholders, flagged) |

Marc-can-override rationale: every category and tile is data, not code. The catalogue lives at the top of `home.js`. Re-ordering, renaming, hiding, and adding tiles is a single-file edit with no dependent moving parts. Future reshape (e.g. when M2 lands the Markets tiles) is a config change, not a rewrite.

## Identity stub

Hardcoded `Marc · CEO`, surfaced in the header with a visible `stub` badge so the substrate gap is impossible to overlook. Same `marc@tgv.co.za` actor binding the dashboard server already uses for `/api/decide`. Exposed at `window.bankShell.user` and `window.bankShell.canSee(tileId)`; tiles use the latter so v1 role-gating is a single function-body change.

**v1 plan (real auth):**
- Senna (Security engineer) wires zero-trust + WebAuthn / FIDO2 per Joint Standard 1 of 2024 and Principle 4 (defence in depth).
- Iris (Information Officer, governance) authors the lawful-processing register entry (POPIA s.19 + s.71) — UI-session telemetry as a processing purpose.
- Capabilities array (`identity.capabilities`) becomes role-bound; `canSee()` dispatches on capability tokens (`view:obligations`, `decide:ceo`, etc.).
- Future six-human layer (D-THIN-HUMAN-LAYER-MINIMUM): Independent Chair, two NEDs, CoSec, triple-hatted compliance lead, separate CRO each get their own role with a pruned tile set.

## Audit-log stub

Every nav click + every page load fires an in-memory `UiInteraction.stub` event with `{ user, role, route, sessionId, timestamp, payload }`. Last 200 events kept in `window.bankShell.audit.buffer()`; console-logged with `[shell:audit]` prefix.

**v1 plan (audit-trail UI):**
- Add `UiInteraction` event type to `prototype/platform/event-store/event-types.ts` + `registry.ts` — Atlas substrate work.
- Server-side endpoint `POST /api/audit/ui-interaction` (debounced) writes events to the canonical store.
- A `/audit-trail.html` viewer renders the trail per session, per user, per route — surfacing any "what did Marc click last Tuesday?" query at audit time.
- Vera (Internal-audit / continuous-assurance engineer) consumes the stream as continuous-controls evidence (Principle 7, audit clause).
- Senna threat-models the channel before activation (PII shape, retention, redaction).

## Live-counts integration

Tiles fetch `/api/state`, `/api/obligations`, `/api/substrate-gaps`, `/api/fleet`, `/api/escalations` in parallel. **Verified live values at landing time** (2026-05-09):

- **Obligations:** 181 total · 25 empty Source · 32 UNCLASSIFIED-bind (the curation gaps PR #48 surfaced).
- **Substrate gaps:** 7 (from Atlas's most-recent substrate-state deliverable, 2026-05-08).
- **Fleet:** 35 agents in roster.
- **CEO decisions:** rendered from `state.decisionsOpen.length`.
- **Escalations:** rendered from `/api/escalations`.

No new endpoints. The shell consumes only what already exists.

## Brand tokens (Linnea, in-voice)

Tokens map row-for-row to §3 (palette) and §4 (typography) of the inaugural brand package. **Cadens Slate** `#1F2A37` for primary; **Paper** `#F7F4EE` for the surface; **Clay** `#B8654A` reserved for callouts and gap-flags. WCAG AA holds on every chrome pair the user encounters; Stone is incidental-text only.

Typography: **Inter** for display weights, **IBM Plex Sans** for body/UI, **IBM Plex Mono** for as-of strings, event-IDs, and any monospaced surface. All SIL OFL 1.1 — Google Fonts hosting in v0; Atlas's M8 cloud lift self-hosts.

Logo: **Direction A — geometric mark** (circle with horizontal chord at the upper third). Picked over Directions B (typographic monogram) and C (abstract symbol) for: (1) the chord-as-settling gesture aligns with the "Cadens" naming recommendation if accepted; (2) it works at favicon-16 without re-cutting; (3) it does not depend on the chosen letter (the bank name is unresolved). Inactive alternates ship to `prototype/dashboard/public/brand/`.

## Bank-name placeholder

The header reads **"The Bank"** with a muted `[name TBD]` suffix. D-BANK-NAME-SELECTION (Linnea's decision card from 2026-05-07) remains pending — Linnea's recommendation is **Cadens** with **Ortus** and **Perigee** as the rest of the shortlist. Once Marc picks, a one-line PR replaces the wordmark string in `home.html` and the matching brand asset.

## Retrofit plan (existing pages)

Existing pages keep their old chrome in v0. The retrofit:

1. Each page (`agents.html`, `policies.html`, `escalations.html`, `fleet.html`, `health.html`, `activity.html`, `architecture.html`, `decision.html`, `index.html`) drops its current `<header class="topbar">` and instead `<link rel="stylesheet">`s `_brand.css` + `_shell.css`, and `<script>`s `_shell.js`.
2. A small `renderShellChrome(activePage)` helper in `_shell.js` injects the same header + sidebar HTML at page load.
3. Page-specific styles continue to live in `styles.css` until they're moved to per-page CSS files.
4. The retrofit lands as one PR per page (or two batches — utility pages first, dense pages second) — sequenced behind Anya's client-refresh consolidation so the refresh-controls move cleanly into the shell.

Sequencing rationale: doing the retrofit in v0 would force conflicts with Anya's parallel client-refresh PR and triple the PR diff. Splitting v0 (new chrome) from v1 (retrofit) is the lower-risk path.

## Substrate gaps named

Per Principle 7 (gaps are roadmap items, not things to hide):

1. **Real authentication.** Identity is a hardcoded stub. Senna + Iris own the v1 wire-up.
2. **Real audit-trail UI.** Every shell click is in-memory only. `UiInteraction` event type + viewer is v1.
3. **Existing pages on legacy chrome.** Retrofit PR is v1.
4. **Customer portal substrate.** Far-future; activates as Niko (Sales / CRM engineer) lifecycle does at licence-day.
5. **Board portal substrate.** Future; sequenced with the Board / Interim Audit Forum coming online.
6. **Regulator portal substrate.** Future; reg-regulator read-only views activate when SARB Prudential Authority engagement begins.
7. **Internationalisation.** English only in v0. POPIA-required notices in other SA official languages will need a translation pipeline (Linnea voice §5 considerate-of-plurality clause).
8. **Dark mode.** Not in v0. Tokens are dark-mode-ready (paper / graphite swap), but theme-switch logic is v1.
9. **Accessibility deepening.** WCAG AA holds; AAA contrast and full ARIA-tree coverage is v1.
10. **M-phase placeholder destinations.** Markets tiles are flagged "M2 — Kai" / "M-phase — …". Each tile gets a real destination as the matching M-phase handler ships.
11. **Bank-name placeholder.** Wordmark currently "The Bank · [name TBD]". Replaces on D-BANK-NAME-SELECTION.

## Verification

`bun run ci` from `prototype/` shows three pre-existing failures, all named in the brief and present on `main`:

- `runtime — Vera overnight-recon handler > runs all pipelines and reports ok against the live repo` (pre-existing)
- `runtime — Vera overnight-recon handler > writes a deliverable when not in dry-run mode` (pre-existing)
- `runtime — Rohan backtest-harness — severity bands per fixture > fixture 'amber' produces severity amber` (pre-existing)

Confirmed against `git stash` / pre-change baseline — no new failures introduced.

Local server smoke test (port 3015):

- `/` → 302 → `/home.html` ✓
- `/home.html` → 200, 9.2 KB ✓
- `/api/state`, `/api/obligations`, `/api/substrate-gaps`, `/api/fleet`, `/api/escalations` all 200 ✓
- `/_brand.css`, `/_shell.css`, `/_shell.js`, `/home.js`, `/brand/logo-direction-a.svg` all 200 ✓

Tile counts verified against the live API responses: 181 obligations (25 empty Source · 32 UNCLASSIFIED-bind), 7 substrate gaps, 35 agents in fleet — surfaced on the home page exactly as queried.

## Closing

This is the first non-trivial human-facing surface the bank has shipped. Restraint over polish. Tokens over inline styles. Substrate gaps named, not hidden. The shell sits at `/home.html` waiting for the rest of the bank to grow into it.

—Atlas, Anya, Linnea
