---
title: CEO decision — reporting-capability build: AUTHORISED (initial)
author: Scrooge
date: 2026-05-06
summary: Initial CEO authorisation for the reporting-capability build. Superseded — D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN is the current canonical build-plan decision; old naming pattern no longer canonical.
decision-required: false
superseded-by:
  - decision-id: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
    decision-date: 2026-05-10
    note: "M2-M3 build plan (with proper D-id) supersedes this old-naming initial authorisation. Canonical CeoDecision record at 2026-05-10_scrooge_ceo-decision-record_d-reporting-capability-m2-m3-build-plan.md."
superseded-on: 2026-05-11
superseded-by-author: Owen (Company Secretary, governance) — sweep authorised by CEO 2026-05-11
---

# CEO decision — reporting-capability build: AUTHORISED

**Author:** Scrooge (Chief of Staff) — capture of CEO decision
**Date:** 2026-05-06 (end-of-day)
**For:** Marc (CEO) — record · circulated to Atlas, Anya, Bea, Camille, Helena, Eitan, Mira, Owen, Vera, Thandiwe.
**Decision authority:** CEO (executive).
**Context:** D2 in `Owner Inbox/2026-05-06_next-decisions-proposal.md`.
**Source spec:** `Owner Inbox/2026-05-06_reporting-capability-spec.md` (Anya — lead; Bea, Camille, Mira, Helena, Eitan, Owen, Vera, Atlas — contributors).

---

## The decision

**Authorised — proceed with the M-phase build of the reporting & analysis capability** per the spec. Build commences immediately on the foundation infra now in place (`@platform/event-store`, `@platform/projections`, `@platform/identity`, `@platform/citation`, `@platform/recon`, `@platform/observability`).

## Sequencing discipline

The spec defines M1–M8. The substantive build proceeds in stages, with M2 and M3 as the next discrete commits and re-authorisation gates after each:

| Phase | Scope | Owners | Gate after delivery |
|---|---|---|---|
| **M1** | Walking skeleton (delivered earlier today) | Atlas | n/a — done |
| **M1.5** | Foundation infra — projection runtime + identity (delivered today) | Atlas | n/a — done |
| **M2** | Semantic layer v1 + first BA return (BA 700-series market-risk return prioritised given strategic foundation) | Anya + Bea + Eitan | Recon harness coverage; first BA return generates from synthetic events |
| **M3** | Prudential return suite + AFS skeleton; BA 325 large exposures added | Bea + Anya + Helena | AFS skeleton generates; BA 325 reconciles |
| **M4+** | Compliance suite (RMCP / STR / CTR / FATCA / CRS); customer / counterparty MI; surveillance MI; full board / committee pack generators | Mira + Yael + Anya + Owen + Vera | Re-authorised at completion of M3 |
| **M8** | Cloud lift (Azure substrate replacement) | Atlas + Senna + future CISO | Re-authorised when M4–M7 delivered |

The spec authorises the build conceptually; the staging is operational discipline — M2 lands, then M3 lands, then M4+ is re-confirmed against the strategic foundation's actual reporting priorities at that point.

## Build-only context (D1, decided earlier today)

Reporting is built end-to-end against **synthetic event flows** clearly labelled `SIMULATED`. No live submissions to PA / FSCA / FIC / SARS / IR / Excon during the build phase. Mock regulator endpoints sit in `prototype/simulators/`. The whole capability is exercised continuously against the synthetic stream so that licence-day go-live is a configuration switch (point at real endpoints) rather than a build event.

## Strategic-foundation tilt of the priority queue

Per the strategic-foundation decision (institutional global-markets trading bank), the build prioritisation tilts:

- **Up:** BA 700-series (market-risk standardised approach), BA 325 (large exposures), BA 410 (liquidity), BA 700/720 (counterparty credit and CVA), surveillance / market-abuse MI, mark-to-market integrity, dealer-mandate compliance reporting, CSA / collateral reporting, ZARONIA-curve marts.
- **Down:** retail-credit ECL, retail-deposit BA returns, retail-customer MI, branch-network operations reports.
- **Stays as planned:** AFS, IFRS 9 hedge-accounting reporting, capital-management pack, ICAAP / ILAAP, FIC submissions, FATCA / CRS, tax (SARS), POPIA-programme MI, board / committee packs, internal-audit MI.

## Architectural enforcement

Every artefact this capability produces is a generated derivation under Principle 6 (downward chain). No spreadsheets, no manual assembly. The Reg → Policy → Procedure → System Capability chain (Principle 6, upward chain) holds bidirectionally on every output: every BA return cell, every AFS line, every STR, every FATCA/CRS XML field traces to a citation in Mira's obligations register, a policy in Owen's register, a procedure in `/Procedures/`, and a coded generator in `/prototype/`. Vera + Thandiwe consume the chain end-to-end as continuous-controls evidence.

## What changes immediately

- Atlas, Anya, Bea proceed with M2 build under the foundation infra now in place.
- Helena (RAS recalibration), Eitan (LCR / NSFR projection scope) feed the M2–M3 prioritisation.
- Vera + Thandiwe attach continuous-controls assurance to the build as it proceeds — evidence pipelines from day one, not retrofitted.
- The next-decisions proposal records D2 as resolved.
- Status summary updated.

## What still needs CEO

D3 — CISO hire kickoff (decided in parallel today; CISO role brief authored by PAX in `Team Inbox/2026-05-06_role-brief_chief-information-security-officer.md`; Nolan to recruit).

—Scrooge
