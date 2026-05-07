# Procedure — Initial Margin (phased, SIMM-aligned)

**Procedure ID:** PROC-MK-ODP-04
**Owner:** Ravi (treasury / ALM) · Rohan (IM methodology) · Eitan (governance) · Imani (CSA / segregation terms)
**Approval:** ALCO + BRC (Margin Policy + IM Methodology Policy)
**Cadence:** Per-trade IM at execution; daily IM recompute on MTM change
**Version:** v0.1 — 2026-05-07 — STUB
**Status:** STUB · system capability `PLANNED` · phased per BCBS-IOSCO; Sept 2025 final phase relevant if group notional > ZAR 100bn

## 1. Source policy

Margin Policy (planned, sub-policy of Risk Management Framework). IM Methodology Policy (planned).

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-JS2-002` (JS 2/2020 §5) | Calculate + exchange IM (phased by group notional). |
| `ORG-JS2-003` (JS 2/2020 §6) | Eligible collateral: cash, gold, SAGB. |
| `ORG-JS2-005` (JS 2/2020 §3) | Board-approved policies + procedures. |

## 3. Purpose

Calculate, exchange, and segregate IM for non-centrally cleared OTC derivative transactions where the bank's group notional crosses the prevailing JS 2/2020 phase-in threshold.

## 4. Trigger

- `OtcTradeExecuted` event for an in-scope counterparty (counterparty's group + bank's group both above the threshold).
- Daily MTM change → IM recompute.
- Quarterly group-notional reassessment.

## 5. Steps (planned)

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Quarterly group-notional reassessment | Rohan | `@risk/im-scope` (PLANNED) | Determines counterparty in-scope status |
| 2 | Compute IM per ISDA SIMM | Rohan | `@risk/im-simm` (PLANNED) | Standard methodology where licensed; schedule-based fallback |
| 3 | Reconcile IM with counterparty | Tomas | `@settlement/im-comms` | Disputed > 5BD escalates per dispute-resolution procedure |
| 4 | Post IM as eligible collateral, segregated | Tomas | `@treasury/collateral-segregation` (PLANNED) | Tri-party custody arrangement |
| 5 | Post `InitialMarginExchanged { counterparty, amount, collateral, segregationAccount }` event | system | `@platform/event-store` | |
| 6 | Daily PA Umoja-portal report (IM line) | Tomas + Anya | `@regulatory/umoja-client` | Per JN 2/2024 |

## 6. Build-phase posture

SIMM model, segregation arrangements, and PA Umoja reporting all rehearsed against synthetic counterparties during build-only. No live IM movement.

## 7. Reconciliation

Daily reconciliation of computed IM ↔ exchanged IM ↔ segregated collateral. Vera consumes as continuous-controls evidence. SIMM model under Helena's Tier 1 model-risk regime (annual independent validation).
