---
title: FinSurv URN cluster wave-1 — current-account + capital-account categories landed
author: Mira (Compliance / RegTech engineer)
date: 2026-05-09
summary: Domain FX added to the obligations register with 9 wave-1 FinSurv URNs (current-account 4 + capital-account 5) and 5 wave-2-deferred placeholders. Authority CEO decision D-M4-FX-SUB-DECISIONS Sub-2. Citation-TBC items routed to Imani + external counsel for licence-application.
decision-required: false
---

# FinSurv URN cluster wave-1 — completion brief

**Author:** Mira (Compliance / RegTech engineer) — reporting to Zara (Chief Compliance Officer)
**Date:** 2026-05-09
**Authority:** CEO decision `D-M4-FX-SUB-DECISIONS` Sub-2 (approved 2026-05-09; record `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-m4-fx-sub-decisions.md` / PR #54)
**Source proposal:** `Owner Inbox/2026-05-07_saskia-kai_fx-product-family.md` §5–6 (FX product family — "the FinSurv URN cluster is the largest single citation addition this product family makes")
**Prior context:** `Owner Inbox/2026-05-07_mira_m1-regulator-citation-urns_completion.md` (M1 register-citation completion — flagged FinSurv as the largest single citation extension at M4)

## What landed

The new section **Domain FX — FinSurv reporting (cross-border flows, Authorised Dealer)** has been added to `Regulations/_obligations-register.md` immediately before Domain N. The register version moves to `v1.4`. URN format follows the canonical pattern:

```
urn:obligation:bank:mk:finsurv:<category-slug>:v1
```

The `mk` infix is consistent with the existing markets-cluster URNs (Domain J `ORG-MK-*`).

### Wave-1 — current-account categories (4 entries, high-volume)

| Register ID | URN | Category |
|---|---|---|
| ORG-FX-FIN-01 | `urn:obligation:bank:mk:finsurv:current-account-trade-payments:v1` | Trade in goods (imports / exports) |
| ORG-FX-FIN-02 | `urn:obligation:bank:mk:finsurv:current-account-services:v1` | Services (transport, travel, communication, financial, professional) |
| ORG-FX-FIN-03 | `urn:obligation:bank:mk:finsurv:current-account-investment-income:v1` | Investment income (interest, dividends, rent, distributed earnings) |
| ORG-FX-FIN-04 | `urn:obligation:bank:mk:finsurv:current-account-transfers:v1` | Current transfers (remittances, personal / government transfers) |

### Wave-1 — capital-account categories (5 entries, high-volume)

| Register ID | URN | Category |
|---|---|---|
| ORG-FX-FIN-05 | `urn:obligation:bank:mk:finsurv:capital-account-fdi:v1` | Foreign direct investment (≥10% equity) |
| ORG-FX-FIN-06 | `urn:obligation:bank:mk:finsurv:capital-account-portfolio-investment:v1` | Portfolio investment (equity <10%, debt securities) |
| ORG-FX-FIN-07 | `urn:obligation:bank:mk:finsurv:capital-account-other-investment:v1` | Other investment (loans, deposits, trade credits) |
| ORG-FX-FIN-08 | `urn:obligation:bank:mk:finsurv:capital-account-financial-derivatives:v1` | Financial derivatives (premiums, settlement, margin, MTM) |
| ORG-FX-FIN-09 | `urn:obligation:bank:mk:finsurv:capital-account-reserve-assets:v1` | Reserve assets (gold / IMF / SARB-agency narrow cases) |

### Wave-2-deferred — long-tail placeholders (5 entries)

Each carries `[citation: TBC]` and status `wave-2-deferred`. Trigger for full curation: commencement-of-trading.

| Register ID | URN | Category |
|---|---|---|
| ORG-FX-FIN-10 | `urn:obligation:bank:mk:finsurv:gold-accounts:v1` | Gold accounts / loans / leasing |
| ORG-FX-FIN-11 | `urn:obligation:bank:mk:finsurv:gift-donation-flows:v1` | Gifts / donations / inheritance flows |
| ORG-FX-FIN-12 | `urn:obligation:bank:mk:finsurv:asset-swap-flows:v1` | Institutional asset-swap dispensation |
| ORG-FX-FIN-13 | `urn:obligation:bank:mk:finsurv:exempt-flow-attestation:v1` | Excon-exempt categories with reportability |
| ORG-FX-FIN-14 | `urn:obligation:bank:mk:finsurv:no-charge-flows:v1` | No-charge / nil-value flows (samples, replacements) |

## Citation-TBC items routed

Every wave-1 entry carries `[citation: TBC]` against:
- the precise Excon Manual sub-section reference within the relevant Section (B for current-account, H/I for capital-account)
- the precise FinSurv Reporting System Manual BoP category-cluster codes

These route to **Imani (Legal-as-code engineer)** for clause-library + Excon Manual sub-section determination, and to **external counsel (engaged at licence-application moment per `Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md`)** for FinSurv Reporting System Manual precise category codes.

I deliberately did not invent FinSurv category codes or Excon Manual sub-section numbers (Principle 2). The numeric-cluster ranges I named (100-series merchandise trade, 200-series services, 300-series investment income, 400-series unrequited transfers) reflect SARB BoP Reporting System Manual high-level taxonomy organisation but the *precise* per-category codes are intentionally `[citation: TBC]`.

## Wave-2 cadence trigger

**Commencement-of-trading.** Until then, the wave-2-deferred entries preserve the URN namespace and decision-trail. The wave-2 work-package — populating exact Excon Manual sub-section references and FinSurv BoP category codes for the long-tail — fires at commencement-of-trading per memory `project_rules_bind_at_commencement.md` and the approved CEO decision Sub-2.

## Substrate gaps surfaced

1. **No FinSurv-acknowledgement integration.** The bank emits `TradeReportSubmitted { regulator: "SARB-FinSurv" }` per the FX product-family proposal §6, but the regulator-side acknowledgement integration (Authorised Dealer reporting interface) is unbuilt. Required at M4. Marked DRAFTING. Routed to my own engineering backlog.
2. **No `Procedures/by-policy/finsurv-reporting.md`.** All 14 entries point to a procedure that does not yet exist. The procedure is planned per the FX product-family proposal §6 — I will author it as a follow-on PR before M4 substrate work begins.
3. **No FinSurv category-derivation system capability.** The per-trade FinSurv category-code assignment logic (input: `TradeExecuted` event with FX `productTaxonomy`, counterparty, jurisdiction, stated purpose; output: BoP category code) is unbuilt. Will be a discrete `prototype/domains/markets/finsurv-category-derivation.ts` module owned by Mira engineering.
4. **External-counsel engagement on Excon Manual is a hard dependency.** The `[citation: TBC]` items cannot be cleared without external-counsel input on the *current* Excon Manual revision (the Manual is amended by SARB Exchange Control Department circulars on a rolling basis; we need the as-of date the Authorised Dealer relies on). This connects to `Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md`.
5. **No live SARB FinSurv test environment.** Submission integration testing requires a SARB-side test environment which is not provisioned in the build phase. Marked as a roadmap item — coordinate with Tomas (Operations / payments engineer) on integration timing.

## Recon + dashboard

`prototype/seeds/dashboard-state.json` re-derived (not hand-edited) using `prototype/scripts/derive-dashboard-state-2026-05-09.ts`. Obligations metric advanced **181 → 195** (Δ +14 = 9 wave-1 + 5 wave-2-deferred). `bun run recon:dashboard` passes after re-derivation.

The obligations-dashboard page (PR #48) will pick up the new entries on next refresh; no schema changes — the `Domain FX` and the `wave-2-deferred` status both flow through the existing `obligations-view.ts` parser without modification.

## Cross-references

- `Regulations/_obligations-register.md` — Domain FX section added; v1.4
- `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-m4-fx-sub-decisions.md` — decision authority (PR #54)
- `Owner Inbox/2026-05-07_saskia-kai_fx-product-family.md` §5–6 — source proposal
- `Owner Inbox/2026-05-07_mira_m1-regulator-citation-urns_completion.md` — M1 register-citation completion (FinSurv flagged for M4)
- `Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md` — counsel engagement that will clear the `[citation: TBC]` items
- `Procedures/by-policy/finsurv-reporting.md` — planned, mine to author next
