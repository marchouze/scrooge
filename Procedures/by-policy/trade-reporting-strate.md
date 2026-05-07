# Procedure — OTC derivative trade reporting (Strate Trade Repository)

**Procedure ID:** PROC-MK-ODP-02
**Owner:** Mira (compliance / RegTech, regulatory mapping) · Tomas (operations & payments, reporting pipeline) · Anya (data, schemas) · Kai (trading systems, event emit)
**Approval:** BRC (under the Risk Management Framework / Trade Reporting Policy)
**Cadence:** Per-transaction (live post-licence); daily reconciliation
**Version:** v0.1 — 2026-05-07 — STUB
**Status:** STUB · system capability `DRAFTING` (event schemas being modelled by Anya; pipeline by Tomas)

## 1. Source policy

Trade Reporting Policy (planned, markets bundle).

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FMA-003` (FMA Regs reg 3) | Report OTC derivative transactions to a licensed Trade Repository. |
| `ORG-CS2-001` (CS 2/2018 + Strate TR) | 169-element schema; aligned with EMIR / EMIR Refit; live by 1 March 2027. |

## 3. Purpose

Submit every OTC derivative transaction the bank executes (as principal) to Strate, the FSCA-designated Trade Data Repository, with all 169 prescribed data elements, within the regulatory deadline.

## 4. Trigger

- `OtcTradeExecuted` event (Kai's OMS/EMS) — initiates reporting.
- Daily reconciliation tick — confirms submitted ↔ executed.

## 5. Steps (planned)

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Capture all 169 fields at trade booking | Kai (OMS/EMS) | `@trading/oms` (event-emit) | All fields validated at emission; missing fields fail booking |
| 2 | Transform to Strate schema | Anya / Tomas | `@regulatory/strate-mapper` (PLANNED) | EMIR-Refit-aligned; field-by-field mapping documented |
| 3 | Submit to Strate | Tomas | `@regulatory/strate-client` (PLANNED) | Per Strate's submission protocol; ACK required |
| 4 | Persist `TradeReported { strateId, fields, ack }` event | system | `@platform/event-store` | Replayable; audit-evidence |
| 5 | Daily reconciliation of executed ↔ reported | Tomas | `@platform/recon` | Discrepancies surface as findings |
| 6 | Late / failed submission escalation | Mira → Zara → BRC | `@platform/escalation` (PLANNED) | Late submissions carry regulatory penalty risk |

## 6. Build-phase posture

Schema modelling and pipeline build run during build-only; rehearsed against synthetic flows. Strate test-environment access is gated on FSCA application progress — flagged in `Owner Inbox/2026-05-07_mira_fsca-odp-compliance-preparation.md` §9 as a substrate gap that may force an early licence-application dependency for full rehearsed-readiness.

## 7. Reconciliation

Daily executed-trade ↔ reported-trade reconciliation; Vera consumes as continuous-controls evidence.
