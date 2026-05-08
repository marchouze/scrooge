# Brief — M1 handler: `anya:m1-projection-runtime-mapping`

**From:** Scrooge (Chief of Staff)
**To:** Anya (data / analytics engineer) — handler owner.
**Cc:** Kai (CDM bindings), Bea (IFRS sub-ledger), Atlas (projection runtime).
**Date:** 2026-05-07
**Authority:** `D-MARKETS-SCHEMA-FOUNDATION` (CEO approved 2026-05-07).
**Source proposal:** `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §7 (projections) and §9 (semantic-layer mapping).
**Trigger kind:** event-driven. Subscribes to `CeoDecision` (D-MARKETS-SCHEMA-FOUNDATION) and to `CdmBindingsRegenerated` from Kai's handler.

## What the handler does

1. Map CDM equity event types (from Kai's bindings) to the projection runtime: trade-record, position, sub-ledger.
2. Define data contracts for each projection: typed input event set, typed output row shape, idempotency key, citation set. Contracts live under `prototype/platform/projections/markets/` and are consumed by Bea (IFRS classifier) and by the dashboard's markets surface.
3. Add semantic-layer entries for every named quantity — equity position quantity, average cost, mark-to-market, unrealised P&L — with citation chain (CDM primitive → projection rule → presentation field). Entries integrate with the existing semantic layer Anya curates.
4. Build the projection-replay harness for the markets projections: replay the equity event set as-of any past timestamp and assert deterministic projection output. Round-trip recon.
5. Register handler in `runtime/handlers-metadata.ts` + `handler-callables.ts`. Emit `MarketsProjectionRegistered` per projection, plus `MarketsProjectionRefreshed` on each refresh.

## Dependencies

- Kai's CDM bindings + equity event types must land first (handler is gated on `CdmBindingsRegenerated`).
- Atlas A0 schema-freeze for the M1 lifecycle event types.

## Out of scope for M1

- Bond, repo, IRS, FX, optionality projections — those land at M2–M5 with the same shape.

## What good looks like

- Projection-replay harness passes deterministically across 100 random equity event streams.
- Semantic-layer entries reconcile bidirectionally: every dashboard markets field traces to a projection rule, every projection rule traces to its CDM primitives.
- Bea's IFRS classifier consumes the trade-record projection without bespoke plumbing.

## Reconciliation

- Vera asserts the round-trip property as a recon (M1 addition to `dashboard-derivation-recon` or a new `markets-projection-recon`).
- Anya's `projection-drift` recon picks up the new projections.

## Owner Inbox deliverable on completion

`Owner Inbox/<date>_anya_m1-projection-runtime-mapping_completion.md`.
