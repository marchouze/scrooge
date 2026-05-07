# Procedure — OTC derivative confirmation (post-execution)

**Procedure ID:** PROC-MK-ODP-06
**Owner:** Kai (trading systems) · Tomas (post-trade lifecycle) · Imani (legal validity, ECTA-compliant electronic execution)
**Approval:** BRC (under OTC Trading Policy)
**Cadence:** Per-trade; SLA tracked
**Version:** v0.1 — 2026-05-07 — STUB
**Status:** STUB · system capability `DRAFTING` (ISO 20022 confirmation generation in OMS scope)

## 1. Source policy

OTC Trading Policy (planned, markets bundle).

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CS3-002` (CS 3/2018 §4) | Timely confirmation of all material terms post-execution. |

## 3. Purpose

Generate, dispatch, and reconcile ISDA-aligned confirmations of all material terms of every OTC derivative trade within the SLA window: T+1 for vanilla products, T+5 for exotic / complex.

## 4. Trigger

`OtcTradeExecuted` event from the OMS.

## 5. Steps (planned)

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Generate confirmation per ISO 20022 (or counterparty-agreed format) | Kai | `@trading/confirmation-gen` (DRAFTING) | All material terms |
| 2 | ECTA-compliant electronic dispatch | Tomas + Imani | `@trading/confirmation-dispatch` | Signature validity per ECTA |
| 3 | Track counterparty acknowledgement | Tomas | `@trading/confirmation-tracking` | T+1 SLA for vanilla |
| 4 | Late-confirmation escalation | Tomas → Saskia → Helena | `@platform/escalation` | Per OTC Trading Policy |
| 5 | Post `TradeConfirmed { tradeId, terms, ackTime }` event | system | `@platform/event-store` | |

## 6. Build-phase posture

Confirmation engine and dispatch rehearsed against synthetic counterparties; ECTA validity reviewed by Imani.

## 7. Reconciliation

Daily executed-trade ↔ confirmed-trade ↔ counterparty-ack reconciliation. Late confirmations are findings.
