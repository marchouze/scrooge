# Procedure — OTC derivative dispute resolution

**Procedure ID:** PROC-MK-ODP-07
**Owner:** Imani (legal-as-code) · Saskia (front-office) · Zara (CCO, conduct dimension)
**Approval:** BRC
**Cadence:** Continuous (event-triggered); >R5m or >5BD escalates to senior level
**Version:** v0.1 — 2026-05-07 — STUB
**Status:** STUB · system capability `PLANNED`

## 1. Source policy

OTC Trading Policy; Counterparty Onboarding Policy; ISDA Master + Schedule + CSA-aligned dispute clauses.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CS3-004` (CS 3/2018 §6) | Dispute-resolution procedures in place before transaction commencement. |
| `ORG-JS2-006` (JS 2/2020 §8) | Margin-specific dispute-resolution procedures. |

## 3. Purpose

Identify, escalate, and resolve disputes on OTC derivative trades — material terms, valuations, or margin calls — through ISDA-aligned dispute-resolution channels, with senior escalation when amount or duration thresholds are crossed.

## 4. Trigger

- `PortfolioReconciliationDiscrepancy` event (material).
- `MarginCallDisputed` event from counterparty.
- `ConfirmationDiscrepancy` event from Tomas's reconciliation.

## 5. Steps (planned)

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Open `DisputeOpened { tradeId / netting-set, type, amount, counterparty }` | system | `@platform/event-store` | |
| 2 | Working-level resolution attempt | Tomas / Kai (per type) | `@trading/dispute-comms` | |
| 3 | Escalate after 5BD or >R5m | Saskia (front-office) | `@platform/escalation` | Senior-level engagement |
| 4 | ISDA Reconciliation / Valuation Dispute (where applicable) | Imani | (manual until automated) | Per ISDA 2017 protocol |
| 5 | Resolution + adjustment | system | event-driven | Post `DisputeResolved` |
| 6 | Material disputes feed Helena's risk reporting | Rohan / Helena | `@risk/dispute-aggregation` | Counterparty-credit signal |

## 6. Build-phase posture

Dispute pathway rehearsed against synthetic dispute events triggered by the recon harness.

## 7. Reconciliation

Open-dispute aging report; Vera tests escalation-channel discipline (Wave-4 pipeline #14, planned).
