# Dashboard consolidation & domain-alignment proposal

**Author:** Atlas (Platform Engineering Lead, engineering)
**Date:** 2026-06-10
**Status:** Proposal (suggestion only — no page merges executed)
**Context:** CEO UI-enhancement request, items (c) "review duplicated pages/info and suggest
consolidation" and (d) "alignment to domains". Items (a) configurable display options and
(b) sidebar collapse/expand were *built* in the same change; this document is the written
deliverable for (c) and the forward scheme for (d).

---

## 1. Why this proposal

The intranet has grown to ~66 pages across 9 nav groups (`prototype/dashboard/public/_shell.js`).
Two structural problems have accumulated:

1. **Overlapping pages.** Several pages render the same underlying data along slightly different
   axes, or split one workflow across two pages. Each was reasonable when added; together they
   dilute "one obvious place" for a given task.
2. **Function-grouped, not domain-aligned nav.** Groups are organised by function (Finance, Risk,
   Compliance…), but regulatory accountability is organised by **domain (A–Q)** and **governance
   seat** (CFO, CRO, CCO, CoSec…). A seat-holder cannot see at a glance which pages they own.

This change already lands the low-risk half of the fix: **domain + owner-seat badges** on each page
header and **owner sub-labels** under each nav group (part D), plus **collapsible nav groups** so the
long nav is navigable. This document proposes the remaining, higher-touch consolidations for a future
round.

## 2. Duplication review — verdicts

Pairs assessed; **Merge** = recommend consolidation, **Keep** = intentional separation.

| Pages | Overlap | Verdict |
|---|---|---|
| Risk · Models · Risk Register | All three are CRO risk-framework surfaces | **Merge** → tabbed *Risk Framework* (Appetite \| Models \| Taxonomy) |
| Procedures · Policies | Two governance registers, near-identical drill-down UX | **Merge** → *Governance Registers* (Procedures \| Policies tabs) |
| Agents · Fleet · AgentOps | Roster vs runtime instances vs token/efficiency ops | **Merge** → *Agent Management* (Roster \| Fleet \| Operations) |
| KYC Onboarding · KYC Clients | Candidate workflow vs accepted-client register | **Merge** → *Customer Lifecycle* (Candidates \| Clients) |
| Bank-Obligations · Unadopted · Forward · Obligation Readers | All filter the obligation space on different axes | **Merge** → *Obligation Explorer* (adoption-status + horizon filters); keep Readers' migration tracker as a sub-view |
| Obligations (authored) vs Bank-Obligations (events) | Plane A reference vs Plane B event projection | **Keep** — `D-REGULATORY-ARCHITECTURE-TWO-PLANE`; distinct sources of truth |
| Decisions · Escalations | All decisions vs the urgent escalation slice | **Keep** — escalations is a high-severity interrupt surface |
| Party Registry · Party Graph | Tabular identity vs relational graph (superset) | **Keep** — different representations, both load-bearing |
| Compliance · Regulatory | CCO obligations/policies vs RegTech horizon-scanning | **Keep** — different seats (CCO vs RegTech engineer) |
| Finance · GL · Treasury | All financial, but CFO snapshot vs accounting infra vs ALM | **Keep** — distinct seats (CFO vs Treasurer); group in nav instead |
| Home · RMS · dedicated registers | Registers surface in summary, hub, and dedicated pages | **Keep** — deliberate summary→hub→drill-down tiers |

The five **Merge** recommendations collapse 13 pages into 5 tabbed hubs (net −8 nav entries). The
existing `.tab-bar` / `.tab-btn` components in `_shell.css` already support the tabbed pattern, so
execution is low-cost and non-destructive (each merged page becomes a tab; routes can redirect).

## 3. Proposed domain-aligned navigation (future round)

Re-group the top-level nav by accountable seat, with each group advertising its regulatory domains.
This converges with the merges in §2.

```
Executive (CEO)                  — Home, Decisions, Escalations
Finance & Treasury (CFO / Treasurer; Domains G, H, A-liquidity)
                                 — Finance, GL, Treasury, Product Control, Constants
Risk (CRO; Domain A)             — Risk Framework [Appetite | Models | Taxonomy]
Compliance (CCO; Domains B, C, FX) — Compliance, Obligation Explorer, Policies, Regulatory, Reg Reader
Markets (Head of Markets; Domains J, J-IRC) — Instruments, Trade Booking, Bond, FX Desk, FX Risk, Sims, Market Data, Customer Lifecycle
Governance & Ops (CoSec / COO; Domains F, L, RM, O) — Decisions, Products (NPA), Party, Briefs, Documents, RMS, Procedures+Policies, Operations
Audit (CAE; Domain F-audit) — Audit
Platform (Platform Eng) — Display, Events, Seeds, Health, Config, Agent Management, Activity, Autonomy, Architecture, Performance, Roadmap
```

The page→domain/owner map needed to drive this already exists in `_shell.js` (`PAGE_META`), seeded
from `Regulations/_obligations-register.md` (Domains A–Q) and `Team/_team-roster.json` (seats). A
future round can promote it to a shared module and a `recon:nav-domain-coverage` gate that asserts
every page carries a domain/owner attribution.

## 4. What shipped alongside this proposal

- **(a) Configurable display options** — a platform-wide `display` block in the config store
  (`platform/config/{schema,loader}.ts`), a single shared formatter (`public/_format.js`:
  `SC.fmtMoney/fmtNumber/fmtPercent/numClass`) replacing ~8 duplicated per-page formatters, controls
  on the Config page (decimals, thousands separator, negative style −/()/red, right-align, currency
  position, locale) with a live preview, applied to the key money pages (Product Control, Finance,
  Treasury, GL, Bond, FX desk/risk).
- **(b) Sidebar collapse/expand** — topbar toggle + collapsible nav groups, persisted per-viewer in
  `localStorage`.
- **(d, partial)** — domain + owner-seat badges on page headers and nav group owner sub-labels.

## 5. Recommended sequencing

1. **This round (done):** display options, collapse, domain/owner badges.
2. **Next round:** the five tabbed merges in §2 (each independent, low-risk).
3. **Following round:** the domain-aligned nav re-group in §3 + a `recon:nav-domain-coverage` gate.

Each step is independently shippable and reversible. No data model changes are required for any of it.
