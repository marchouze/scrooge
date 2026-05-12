# Hoz Intranet — Site Map

**Author:** Noa (Intranet Product Owner & UI Architect)
**Date:** 2026-05-12
**Status:** v1.0 — first production run
**Canonical source:** `prototype/dashboard/docs/site-map.md`

This document is the canonical site map for the Hoz intranet (`prototype/dashboard/public/`).
Every page must have an assigned nav group; no orphans. Maintained by Noa; drift from the
actual file tree is a Vera finding.

---

## 1. Page inventory

| Page | URL path | Title | Department | Primary persona | Status | Nav group |
|---|---|---|---|---|---|---|
| `home.html` | `/home.html` | home · Hoz | Executive / CEO Office | Marc (CEO) | Covered — functional launcher with tiles, decisions, inbox | Executive |
| `index.html` | `/index.html` | operations · Hoz | Executive / CEO Office | Marc (CEO) | Scaffolded — legacy shell using `styles.css`; pre-dates `_brand.css` / `_shell.css` migration | Executive |
| `finance.html` | `/finance.html` | Capital & Liquidity · Hoz | Finance | Camille (CFO, finance) | Scaffolded — improved in this PR; shows key metrics + capital/liquidity tables from `/api/state` | Finance |
| `risk.html` | `/risk.html` | Risk Watch · Hoz | Risk | Helena (Chief Risk Officer, governance) | Scaffolded — improved in this PR; RAS clusters B1–B5, stress-test, limit utilisations, open risk decisions | Risk |
| `compliance.html` | `/compliance.html` | Obligations & Compliance · Hoz | Compliance / Legal | Mira (Compliance / RegTech engineer) | Scaffolded — improved in this PR; obligations summary, traffic-light indicators, top obligations table | Compliance & Legal |
| `ops.html` | `/ops.html` | Ops Dashboard · Hoz | Operations | Devon (COO, governance) | Scaffolded — improved in this PR; settlement status, fleet health, substrate gaps, recent events | Operations |
| `audit.html` | `/audit.html` | Audit & Recon · Hoz | Internal Audit | Thandiwe (Chief Audit Executive, governance) / Vera (Internal audit engineer) | Scaffolded — improved in this PR; findings by severity, recon pipelines, substrate gaps, event links | Audit |
| `markets/fx/desk.html` | `/markets/fx/desk.html` | (FX desk) | Markets / Trading | Saskia (Head of Global Markets) / Kai (Trading systems engineer) | Covered — functional FX desk with RFQ, live rates, counterparties | Markets & Trading |
| `events.html` | `/events.html` | Event store · Hoz | Platform Engineering | Atlas (Core banking platform architect) | Covered — full paginated event browser | Platform |
| `agents.html` | `/agents.html` | agents · Hoz | Platform Engineering / AgentOps | Sade (AgentOps, engineering) | Scaffolded — uses legacy `styles.css`; no `_shell.css` migration | Platform |
| `activity.html` | `/activity.html` | activity · Hoz | Platform Engineering | Atlas | Scaffolded — uses legacy `styles.css` | Platform |
| `architecture.html` | `/architecture.html` | architecture · Hoz | Platform Engineering | Atlas | Scaffolded — uses legacy `styles.css` | Platform |
| `decision.html` | `/decision.html` | decision · Hoz | Executive / CEO Office | Marc (CEO) | Covered — decision drill-down page with comments | Executive |
| `escalations.html` | `/escalations.html` | escalations · Hoz | Executive / CEO Office | Marc (CEO) | Scaffolded — uses legacy `styles.css` | Executive |
| `fleet.html` | `/fleet.html` | fleet · Hoz | Platform Engineering / AgentOps | Sade (AgentOps) | Scaffolded — uses legacy `styles.css`; displays agent fleet status | Platform |
| `health.html` | `/health.html` | health · Hoz | Platform Engineering | Atlas / Vera (Internal audit engineer) | Covered — recon pipeline conclusions, build status, substrate gaps | Platform |
| `rms.html` | `/rms.html` | RMS registers · Hoz | Platform Engineering | Atlas / Owen (Company Secretary, governance) | Covered — seven RMS registers projected from event log | Platform |
| `policies.html` | `/policies.html` | policies · Hoz | Compliance / Legal | Owen (Company Secretary, governance) | Covered — full policy library from event-derived projection | Compliance & Legal |
| `procedures.html` | `/procedures.html` | Procedures index · Hoz | Operations | Devon (COO, governance) | Covered — procedures index with populated/planned counts | Operations |
| `obligations.html` | `/obligations.html` | Obligations · Bank operations dashboard | Compliance / Legal | Mira (Compliance / RegTech engineer) | Covered — full obligations register | Compliance & Legal |
| `onboarding.html` | `/onboarding.html` | Onboarding · Bank operations dashboard | Operations | Niko (CRM engineer — paused, licence-day) | Scaffolded — uses legacy `styles.css`; build-phase placeholder | Markets & Trading |
| `forward-obligations.html` | `/forward-obligations.html` | Forward obligations · Bank operations dashboard | Compliance / Legal | Mira / Zara (CCO, governance) | Covered — forward-looking obligations calendar view | Compliance & Legal |

---

## 2. Department coverage matrix

Target departments per PAX role brief (§3 §2). Coverage assessed 2026-05-12.

| Department | Coverage status | Page(s) | Notes / Spec (if Scaffolded or Missing) |
|---|---|---|---|
| CEO Office | **Covered** | `home.html`, `decision.html`, `escalations.html` | Functional launcher + decisions drill-down; escalations page uses legacy shell |
| Finance | **Scaffolded** | `finance.html` | Improved in this PR. Primary widget: capital/liquidity metrics. Primary data source: `/api/state → capitalPositions, liquidityMetrics`. Primary user action: review Tier 1 capital position and LCR/NSFR ratios. Full BA-325/BA-700 derivation pipeline deferred to M-phase (Camille + Bea). |
| Risk | **Scaffolded** | `risk.html` | Improved in this PR. Primary widget: RAS cluster B1–B5 traffic lights. Primary data source: `/api/state → rasMetrics, stressTestResults`. Primary user action: review appetite-statement status and open risk decisions. |
| Markets / Trading | **Covered** | `markets/fx/desk.html` | Functional FX desk with RFQ and live rates. JSE bonds/equities desk and OTC IRD desk are Missing — see below. |
| Compliance / Legal | **Covered** | `compliance.html`, `obligations.html`, `forward-obligations.html`, `policies.html` | Multiple pages; `compliance.html` improved in this PR. |
| Operations | **Scaffolded** | `ops.html` | Improved in this PR. Primary widget: settlement-system status + fleet health. Primary data source: `/api/state`, `/api/events`, `/api/fleet`, `/api/substrate-gaps`. Primary user action: monitor settlement and agent fleet health. |
| Platform Engineering | **Covered** | `events.html`, `health.html`, `rms.html`, `agents.html`, `activity.html`, `architecture.html` | Most pages functional; `agents.html`, `activity.html`, `architecture.html` use legacy shell. |
| Internal Audit | **Scaffolded** | `audit.html` | Improved in this PR. Primary widget: findings by severity P1/P2/P3. Primary data source: `/api/state → findings`, `/api/substrate-gaps`. Primary user action: review open findings and recon pipeline status. |
| AgentOps | **Missing** | — | No dedicated page. Spec: primary widget = agent lifecycle register (registered / active / paused / retired agents); primary data source = `/api/fleet` + agent registry; primary user action = trigger agent registration or retirement. Sade (HR systems engineer, reshaped to AgentOps) is the primary persona. |
| Party / Identity | **Missing** | — | No dedicated page. Spec: primary widget = party register table (natural-person, legal-entity, counterparty, agent); primary data source = `/api/rms/parties` (Party register, D-PARTY-REGISTER); primary user action = inspect a party's event history. Owen (Company Secretary, governance) is the primary persona. |

### Missing-page specs

**AgentOps (`/agentops.html`)**
- Purpose: Sade (AgentOps, engineering) — agent lifecycle operations dashboard.
- Primary widget: tabbed view — Active / Paused / Retired agents; per-agent status card with last-tick timestamp.
- Data source: `/api/fleet` + `/api/state → agents` array.
- Required API: `/api/fleet` already exists; per-agent retirement/registration actions need `POST /api/agent/retire` (Atlas task).
- Acceptance criteria: all 27 roster agents visible; pause/active state derivable from agent registry events; no dead links.

**Party / Identity (`/party.html`)**
- Purpose: Owen (Company Secretary, governance) — unified party register view.
- Primary widget: searchable party table; four actor-kind filters (natural-person, legal-entity, counterparty, agent).
- Data source: RMS Party register projected from event log (D-PARTY-REGISTER, approved 2026-05-11).
- Required API: `/api/rms/parties` — raise IntranetEngineeringRequest to Atlas if not yet exposed.
- Acceptance criteria: founding CEO party (Marc) visible; all legal-entity counterparties from existing events linked; party drill-down to event history.

---

## 3. Navigation taxonomy

The sidebar nav (`_shell.js → DEPT_NAV`) groups pages into eight departments. This reflects the
current structure; Noa recommends adding AgentOps and Party/Identity groups when those pages land.

| Nav group | Pages included | Notes |
|---|---|---|
| Executive | `home.html`, decisions (`index.html#decisionsOpen`), `escalations.html` | CEO-only pages; decisions is the primary action surface |
| Finance | `finance.html` | Single page today; BA-325/BA-700 sub-pages to follow |
| Risk | `risk.html` | Single page today; ICAAP/ILAAP sub-pages to follow |
| Markets & Trading | `markets/fx/desk.html`, `onboarding.html` | FX desk only; bonds/equities and IRD desks are roadmap |
| Compliance & Legal | `compliance.html`, `obligations.html`, `forward-obligations.html`, `policies.html` | Richest department coverage |
| Operations | `ops.html`, `procedures.html` | Procedures index added to this group |
| Platform | `events.html`, `health.html`, `rms.html`, `agents.html`, `activity.html`, `architecture.html` | Platform engineering + audit tooling |
| Audit | `audit.html` | Separate group for third-line independence (Thandiwe / Vera) |

**Recommended additions to `_shell.js → DEPT_NAV`:**
1. Add `AgentOps` group with `agentops.html` (when built).
2. Add `Party / Identity` group with `party.html` (when built).
3. Move `procedures.html` from unlisted to the Operations group in the sidebar.
4. Add `rms.html` to a "Records & Governance" sub-group once the register set expands.

---

## 4. Design-system audit

Scope: the five scaffolded pages touched in this PR (`finance.html/js`, `risk.html/js`,
`compliance.html/js`, `ops.html/js`, `audit.html/js`). CSS deviations from `_brand.css` tokens.

| Page | Deviation type | Detail | Recommended fix |
|---|---|---|---|
| `finance.html` | Inline `style` on `<section>` elements | `style="margin-bottom:var(--space-12)"` and `style="margin-bottom:var(--space-8)"` — uses token value but applied inline rather than via a utility class | Define `.section-gap` utility (or `.shell-section`) in `_shell.css` applying `margin-bottom:var(--space-12)` |
| `risk.html` | Inline `style` on RAS body container | `style="background:#fff;border:var(--border-subtle)..."` — hardcoded `#fff` instead of `var(--bg)` or `var(--neutral-paper)` | Replace `#fff` with `var(--neutral-paper)` (brand token §3.3) |
| `compliance.html` | Inline `style` on indicator body container | Same `background:#fff` pattern as `risk.html` | Same fix — use `var(--neutral-paper)` |
| `ops.html` | Inline `style` on settlement body container | Same `background:#fff` pattern | Use `var(--neutral-paper)` |
| `audit.html` | Inline `style` on recon body container | Same `background:#fff` pattern | Use `var(--neutral-paper)` |
| All 5 pages | Inline `style` font-size references | Some table cells use `style="font-size:var(--type-caption)"` inline rather than a shared table-cell class | Add `.dept-table td.meta` or `[data-cell="meta"]` pattern in `_shell.css` |
| `audit.html` | `status-badge` data-status value `"flagged"` | Used for P1 gaps — maps to `_shell.css` `.status-badge[data-status="flagged"]` which is crimson. Correct intent but no explicit P-severity badge variant exists | Add `.status-badge[data-status="p1"]`, `[data-status="p2"]`, `[data-status="p3"]` variants in `_shell.css` to map cleanly to semantic colours |

**No CSS framework violations found.** All five pages use exclusively `_brand.css` and `_shell.css`
tokens for colour, spacing, typography, and elevation. No hardcoded hex colours in JS-rendered
HTML except the `#fff` background instances noted above. No Tailwind, Bootstrap, or other
framework classes introduced.

---

*Maintained by Noa (Intranet Product Owner & UI Architect). Next update: on any page addition
or navigation taxonomy change. Vera Wave-4 will enforce zero-orphan-page coverage at audit time.*
