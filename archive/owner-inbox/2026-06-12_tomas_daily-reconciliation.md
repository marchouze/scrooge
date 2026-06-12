---
agent: Tomas
trigger: daily-reconciliation
asOf: 2026-06-12T05:01:25.041Z
decision-required: false
---

# Tomas — daily three-way reconciliation, 2026-06-12

Autonomous run of the three-way reconciliation (PROC-PAY-RBH-01): trade-leg (SettlementInstructionReceived) ↔ payment-leg (PaymentSettled) ↔ ledger-leg (JournalEntryPosted). Events emitted: ReconciliationBreak (per break) + DailyReconciliationReport (summary).

**Headline:** 0 trade IDs processed · 0 matched · 0 breaks detected

## Result: Clean

_All trade IDs present in the event store have matching payment and ledger legs with consistent amounts. No ReconciliationBreak events emitted._

## Build-phase posture

The bank is an indirect payments participant (memory: project_indirect_participant_posture.md). Correspondent bank model — NPS RTGS / BankservAfrica / CLS access is via sponsor banks. Live event flows (SettlementInstructionReceived, PaymentSettled, JournalEntryPosted) activate at licence-day. In build phase, counts reflect synthetic or seeded events only.

## Provenance

Event store replay up to `asOf=2026-06-12T05:01:25.041Z` for types: `SettlementInstructionReceived`, `PaymentSettled`, `JournalEntryPosted`. Authority: PROC-PAY-RBH-01, NPS-ACT-78-1998, BANKS-ACT-94-1990, ISO-20022.
