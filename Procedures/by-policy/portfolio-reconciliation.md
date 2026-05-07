# Procedure — OTC derivative portfolio reconciliation

**Procedure ID:** PROC-MK-ODP-05
**Owner:** Tomas (operations) · Anya (data) · Rohan (valuation)
**Approval:** BRC (under RMF / OTC Trading Policy)
**Cadence:** Counterparty-tier-based per CS 3/2018: weekly (≥500 trades), monthly (51–499), quarterly (≤50)
**Version:** v0.1 — 2026-05-07 — STUB
**Status:** STUB · system capability `DRAFTING` (Tomas's reconciliation harness extends to OTC IRD)

## 1. Source policy

OTC Trading Policy (planned, markets bundle); Counterparty Onboarding Policy.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CS3-003` (CS 3/2018 §5) | Portfolio reconciliation at specified intervals; identifies discrepancies in material terms + valuation. |

## 3. Purpose

Identify and resolve discrepancies between the bank's records and counterparty records of open OTC derivative positions — material terms (notional, dates, currency, fixed/float) and valuations (MTM).

## 4. Trigger

Scheduler tick per counterparty's reconciliation tier (weekly / monthly / quarterly).

## 5. Steps (planned)

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Generate per-counterparty position file | Tomas | `@settlement/recon-position` | Open trades + MTM at as-of date |
| 2 | Exchange with counterparty (ISDA Reconciliation Communications) | Tomas | `@settlement/recon-comms` | Standard formats |
| 3 | Diff materially — terms + valuation | Anya | `@settlement/recon-diff` | Tolerance per Helena's RMF |
| 4 | Open `PortfolioReconciliationDiscrepancy` event for material differences | system | `@platform/event-store` | |
| 5 | Resolve via dispute-resolution procedure where required | Imani | (cross-reference `otc-dispute-resolution.md`) | |
| 6 | Close `PortfolioReconciliationCompleted` event | system | | Vera consumes |

## 6. Build-phase posture

Reconciliation harness extends Tomas's existing settlement-reconciliation pattern to OTC IRD. Rehearsed against synthetic counterparty position files.

## 7. Reconciliation (meta)

Vera's recon pipelines independently verify that every CSA-counterparty had its scheduled reconciliation in the period.
