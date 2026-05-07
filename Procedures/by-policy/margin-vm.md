# Procedure — Variation Margin (daily, per-counterparty)

**Procedure ID:** PROC-MK-ODP-03
**Owner:** Ravi (treasury / ALM engineer) · Eitan (Treasurer, governance) · Imani (CSA terms) · Bea (accounting)
**Approval:** ALCO (Margin Policy is ALCO-approved under RMF)
**Cadence:** Daily (per-counterparty)
**Version:** v0.1 — 2026-05-07 — STUB
**Status:** STUB · system capability `DRAFTING` (margin engine in design)

## 1. Source policy

Margin Policy (planned, sub-policy of Risk Management Framework). Collateral Management Policy.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-JS2-001` (JS 2/2020 §4) | Calculate + exchange VM daily, per-counterparty, against MTM. |
| `ORG-JS2-003` (JS 2/2020 §6) | Eligible collateral: cash, gold, SAGB (+ 2022 expansion). |
| `ORG-JS2-004` (JS 2/2020 §7) | MTA aggregate (IM + VM) ≤ R5m. |
| `ORG-JN2-2024` (JN 2/2024) | Margin information reporting to PA Umoja portal from 1 April 2025. |

## 3. Purpose

Calculate, exchange, and account for daily VM with each non-centrally cleared OTC derivative counterparty, per the bank's CSA and JS 2/2020 requirements.

## 4. Trigger

- Daily `MarketClose` tick (per ZAR market calendar).
- `MTMComputed` events from Rohan's risk engine.
- CSA-driven `MarginCallReceived` events from counterparties.

## 5. Steps (planned)

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Compute MTM per CSA-netting set | Rohan | `@risk/mtm` | OIS-discounting (ZARONIA) |
| 2 | Compute VM call / return per CSA terms | Ravi | `@treasury/margin-engine` (DRAFTING) | MTA aggregate ≤ R5m enforced |
| 3 | Issue / receive margin call | Tomas | `@settlement/margin-comms` | ISDA-aligned format |
| 4 | Move eligible collateral | Tomas + Ravi | `@treasury/collateral-inventory` | Cash / gold / SAGB |
| 5 | Post `MarginExchanged { counterparty, amount, collateral }` event | system | `@platform/event-store` | Replayable; auditable |
| 6 | Daily PA Umoja-portal report | Tomas + Anya | `@regulatory/umoja-client` (PLANNED) | Per JN 2/2024 from 1 April 2025 |
| 7 | Bea's hedge-accounting boundary | Bea | `@accounting/sub-ledger` | Posted as collateral, not P&L |

## 6. Build-phase posture

Engine and pipeline rehearsed against synthetic counterparties + synthetic MTM flows. No live margin movement during build.

## 7. Reconciliation

Daily margin-exchange events ↔ collateral-inventory events ↔ counterparty acknowledgements. Discrepancies surface as findings.
