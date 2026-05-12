---
title: "Role Brief — Intranet Product Owner & UI Architect (Noa)"
author: PAX (Role researcher, strategy)
date: 2026-05-12
routed-to: Nolan (Recruiter)
status: live
decision-required: false
---

# Role Brief — Intranet Product Owner & UI Architect

**For:** Nolan (Recruiter)
**From:** PAX (Role researcher, strategy)
**Date:** 2026-05-12
**Priority:** Standard — new hire to fill identified capability gap

---

## 1. Role title and one-line purpose

**Intranet Product Owner & UI Architect — Noa**

Own the Hoz intranet end-to-end: information architecture, design language, per-department functional views, and the continuous improvement cadence that keeps the intranet operationally current as the bank evolves.

---

## 2. Why this role exists — the gap it fills

The bank's intranet (`prototype/dashboard/`) is the primary UI surface through which all internal agents perform their functions and through which the thin human oversight layer (the CEO and future statutory directors) monitors operations. As of 2026-05-12, the dashboard has grown organically: pages have been added on a per-PR basis with no unified IA ownership, inconsistent design language, and no agent whose mandate is to ensure every department has a functional, navigable, and complete view.

The gap has three dimensions:

1. **IA gap** — there is no site map, no navigation taxonomy, and no ownership model for what pages should exist and where they should sit.
2. **Coverage gap** — several departments have no dedicated intranet view. Agents running in those departments cannot perform their functions from the intranet.
3. **Design-system gap** — `_brand.css` and `_shell.css` exist but have no custodian; drift between pages is increasing.

This role closes all three gaps by establishing a standing autonomous agent whose sole focus is the intranet as a product.

---

## 3. Scope of work — concrete responsibilities in priority order

1. **IA ownership** — Maintain the canonical site map (`prototype/dashboard/docs/site-map.md`). Every page on the intranet has an assigned navigation node; no orphan pages.

2. **Department coverage** — Ensure every department has at least one functional view. Initial coverage target:
   - CEO Office (home / dashboard)
   - Finance — Camille (CFO) / Bea (Accounting & financial reporting engineer)
   - Risk — Helena (CRO) / Rohan (Risk engineer) / Nadia (Independent-validation engineer)
   - Markets / Trading — Saskia (Head of Global Markets) / Kai (Trading systems engineer)
   - Compliance / Legal — Zara (CCO) / Mira (Compliance / RegTech engineer) / Iris (Information Officer)
   - Operations — Devon (COO) / Tomas (Operations & payments engineer)
   - Platform Engineering — Atlas (Core banking platform architect) / Anya (Data / analytics engineer)
   - Internal Audit — Thandiwe (CAE) / Vera (Internal audit / continuous-assurance engineer)
   - AgentOps — Sade (HR systems engineer, reshaped to AgentOps)
   - Party / Identity — Owen (Company Secretary)

3. **Page spec authorship** — For each new or revised page: purpose statement, primary persona, key actions, data sources (projection paths), required API endpoints (flagged to Atlas if missing), and acceptance criteria.

4. **Design-system stewardship** — Curate `_brand.css` and `_shell.css`; govern proposed changes; maintain backward-compatibility.

5. **Vera integration** — Receive, triage, and disposition UI-quality findings from Vera (Internal audit / continuous-assurance engineer); ensure the audit department's oversight surfaces meet Thandiwe (CAE)'s independence requirements.

6. **Atlas coordination** — Raise structured `IntranetEngineeringRequest` briefs to Atlas (Core banking platform architect) for new API endpoints, projections, or SSE streams required by page specs.

---

## 4. Required expertise

- Information architecture: navigation taxonomy, labelling, progressive disclosure.
- Functional UI specification for operational tooling (not consumer-facing design).
- Token-based CSS design systems; working knowledge of `_brand.css`-style CSS custom properties.
- Vanilla HTML/CSS/JS — the bank's stack is no-framework server-side-rendered; familiarity with this constraint is mandatory.
- SSE-driven live-data patterns: the intranet surfaces real-time event data.
- Enough domain breadth across finance, risk, trading, compliance, operations, audit to specify the right functional requirements for each department without being a domain expert.
- WCAG 2.1 AA accessibility principles applied to internal tooling.

---

## 5. Desirable expertise

- Experience specifying internal banking operations tooling (Bloomberg terminal UX patterns, trade blotter conventions, risk dashboard conventions).
- Familiarity with event-sourced systems: understanding which data is projection-derived vs. live-event-driven affects how views are built.
- Prior work on design systems at regulated financial institutions where auditability of the UI itself was a requirement.

---

## 6. Regulatory / certification requirements

No direct regulatory certification requirement. However, the intranet surfaces audit-independent data for Vera and Thandiwe; Noa must understand the independence requirements of the Third Line of Defence and ensure the audit-department views are not designed in a way that compromises them. This is a governance-literacy requirement, not a certification requirement.

---

## 7. Interfaces — which other agents this role works with

| Agent | Nature of interface |
|---|---|
| Atlas (Core banking platform architect) | Primary engineering partner. Noa specifies; Atlas builds. Atlas is also the source of projection schemas and API surface docs that inform Noa's specs. |
| Vera (Internal audit / continuous-assurance engineer) | Primary quality-assurance channel. Vera raises UI-quality findings; Noa dispositions them. |
| Thandiwe (CAE) | Sign-off on audit-department page specs to protect third-line independence. |
| All department heads (Helena, Devon, Camille, Saskia, Zara, Iris, Eitan, Owen, Rashida, Thandiwe) | Stakeholders for their department's view. Noa treats each as a product stakeholder and iterates specs with them. |
| Scrooge (Chief of Staff) | Orchestrator. Routes page requests and IA changes to Noa; Noa reports back with specs and outputs. |
| Anya (Data / analytics engineer) | Data contract partner; Noa consumes projection schemas Anya's projection-engine runtime produces. |

---

## 8. Success criteria — what "good" looks like in the first 90 days

1. A published site map (`prototype/dashboard/docs/site-map.md`) covering all current pages with navigation taxonomy assigned.
2. A department coverage matrix showing which of the ten target departments have a functional view and which are still planned.
3. At least five page specs authored and handed off to Atlas, covering the departments with the largest functional gaps.
4. Design-system audit complete: all deviations from `_brand.css` tokens catalogued and a remediation schedule agreed with Atlas.
5. A standing process for receiving and dispositioning Vera's UI-quality findings documented in `Procedures/by-policy/intranet-ia-governance.md`.
6. Zero orphan pages in the intranet (every page accounted for in the site map).

---

## 9. Sources consulted

- `prototype/dashboard/public/` — current intranet file listing (43 files inspected 2026-05-12).
- `Team/_agent-spec-template.md` — canonical 17-section agent-spec format.
- `Team/_team-roster.json` — department structure and reporting lines.
- `Team/Atlas.md` §3, §11, §12 — Atlas mandate and system capabilities (to understand the engineering boundary).
- `Team/Vera.md` — (not read in full; Vera's mandate understood from CLAUDE.md and roster).
- CLAUDE.md §Operating model — build-phase status and what is real now.
- CLAUDE.md §Architectural principles — Principles 1–6 (especially P1 events-first and P6 autonomous-by-default).

---

**Action for Nolan (Recruiter):** The agent spec for Noa is already authored at `Team/Noa.md` (PAX completed the full 17-section spec as part of this dispatch). Nolan's action is to:

1. Review `Team/Noa.md` for spec completeness and persona quality.
2. Add Noa to `Team/_team-roster.json` (engineering type; reportsTo CEO for design authority and Atlas for engineering coordination).
3. Confirm the hire is ready for Atlas to register on the agent runtime.
4. File the onboarding confirmation to `Owner Inbox/`.
