# Procedure — Excon (Currency & Exchanges) for OTC derivatives

**Procedure ID:** PROC-MK-ODP-09
**Owner:** Eitan (Treasurer) · Mira (Excon obligation curator) · Ravi (operational)
**Approval:** ALCO + BRC
**Cadence:** Per-trade (where in scope); reporting per SARB FinSurv cadence
**Version:** v0.1 — 2026-05-07 — STUB
**Status:** STUB · system capability `PLANNED` · external Excon-specific guidance (S5 firm) sought pre-licence

## 1. Source policy

Excon Compliance Policy (planned, markets bundle). Funding Strategy Policy.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-EXCON-ODP-001` (Currency & Exchanges Manual + SARB FinSurv) | Non-resident counterparty OTC derivative transactions: Authorised Dealer compliance + FinSurv reporting + approvals where required. |
| `ORG-MK-08` (Currency & Exchanges Manual) | FX / cross-border transactions per Authorised Dealer rules. |

## 3. Purpose

Identify Excon-implicating OTC derivative transactions (non-resident counterparty, FX-leg components, prescribed asset categories), apply Authorised-Dealer-aligned controls, and report to SARB FinSurv where required.

## 4. Trigger

- `CounterpartyOnboardingRequested` event with `nonResident=true`.
- `OtcTradeProposed` event with FX-leg component or non-resident counterparty.

## 5. Steps (planned)

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Excon-scope screening pre-trade | Mira | `@compliance/excon-screening` (PLANNED) | Authorised Dealer table |
| 2 | Identify approval requirements | Eitan + Mira | (manual until codified) | Per Excon Manual chapters |
| 3 | Apply for approval if required | Eitan | (manual until SARB FinSurv API exists) | |
| 4 | FinSurv reporting on flow | Tomas + Mira | `@regulatory/finsurv-client` (PLANNED) | Per SARB FinSurv submission spec |
| 5 | Post `ExconReported { tradeId, basis, finsurvRef }` event | system | `@platform/event-store` | |

## 6. Build-phase posture

Substrate built and rehearsed; no live FinSurv submissions until licence-day. External Excon counsel input sought via S5 to confirm sector-specific guidance for ODP non-resident dealing.

## 7. Reconciliation

Every cross-border OTC derivative trade has a corresponding Excon-screening event and (where required) a FinSurv-reporting event.
