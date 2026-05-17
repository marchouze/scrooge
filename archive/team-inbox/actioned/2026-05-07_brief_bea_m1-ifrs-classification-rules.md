# Brief — M1 handler: `bea:m1-ifrs-classification-rules`

**From:** Scrooge (Chief of Staff)
**To:** Bea (accounting & financial reporting engineer) — handler owner.
**Cc:** Kai (CDM bindings), Anya (projections), Camille (CFO — governance signoff at M5 cutover).
**Date:** 2026-05-07
**Authority:** `D-MARKETS-SCHEMA-FOUNDATION` (CEO approved 2026-05-07).
**Source proposal:** `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §9 (IFRS classification mapping); IFRS 9 SPPI / business-model dispatch.
**Trigger kind:** event-driven. Subscribes to `CeoDecision` (D-MARKETS-SCHEMA-FOUNDATION) and to `CdmBindingsRegenerated`.

## What the handler does

1. Author IFRS 9 classification rules for the M1 equity event types: dispatch each `EquityTradeBooked` event to FVTPL / FVOCI / amortised-cost (equities are FVTPL by default for trading-book; FVOCI election by instrument is the only alternative for the M1 set).
2. Generate sub-ledger postings for the equity book: trade-date booking, settlement-date confirmation, dividend accrual, mark-to-market revaluation, realised gain/loss on disposal. Postings are typed events emitted into the event store; the GL projection (Anya) consumes them.
3. Define the FX-revaluation rule for foreign-currency equities (per Principle 5 multi-currency-from-day-one).
4. Wire IFRS 13 fair-value hierarchy classification (Level 1 for liquid JSE equities; Level 2 fallback for thin-trading days). Output is a payload field on the mark-to-market event.
5. Register handler in `runtime/handlers-metadata.ts` + `handler-callables.ts`. Emit `IfrsClassificationApplied` per trade and `SubLedgerPostingEmitted` per posting.

## Dependencies

- Kai's CDM equity event types.
- Anya's trade-record + position projections.
- Citation set from Mira: IFRS 9 classification, IFRS 13 fair-value, IAS 21 FX revaluation (URN entries from `mira:m1-regulator-citation-urns`).

## Out of scope for M1

- Bond classification (HTC vs HTC&S vs FVTPL) — M2.
- IRS classification + hedge accounting — M3.
- ECL modelling for credit RWA on counterparty exposures — separate Rohan workstream.

## What good looks like

- Round-trip: `equity trade event → IFRS 9 dispatch → sub-ledger postings → GL projection → trial balance reconciles to the event log` for 100 random equity event streams. Vera asserts.
- Every dispatch decision carries a citation to the IFRS 9 paragraph that justifies it.
- Camille's monthly-close projection includes the equity book with no manual journal entries.

## Reconciliation

- Vera asserts every `IfrsClassificationApplied` event has a citation.
- Anya's GL projection includes equity postings; trial balance reconciles to zero.

## Owner Inbox deliverable on completion

`Owner Inbox/<date>_bea_m1-ifrs-classification-rules_completion.md`.
