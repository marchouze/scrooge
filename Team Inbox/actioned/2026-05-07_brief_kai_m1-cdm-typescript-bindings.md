# Brief — M1 handler: `kai:m1-cdm-typescript-bindings`

**From:** Scrooge (Chief of Staff)
**To:** Kai (trading systems engineer) — handler owner.
**Cc:** Atlas (substrate), Anya (projection mapping), Bea (IFRS classification).
**Date:** 2026-05-07
**Authority:** `D-MARKETS-SCHEMA-FOUNDATION` (CEO approved 2026-05-07; `Owner Inbox/2026-05-07_ceo-decision_markets-schema-foundation.md`); `D-AGENT-RUNTIME-AUTHORIZE`.
**Source proposal:** `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §6 (lifecycle event types) and §7 (TypeScript binding shape).
**Trigger kind:** event-driven. Subscribes to `CeoDecision` with `decisionId === "D-MARKETS-SCHEMA-FOUNDATION"` (initial fan-out) and to subsequent M1 schema-update events.
**Substrate gap closed:** registers as a runtime handler so Scrooge's follow-on-router resolves `agent:kai:m1-cdm-typescript-bindings` automatically next CEO approval.

## What the handler does

1. Generate the ISDA CDM TypeScript bindings under `prototype/platform/markets/cdm/`. Use the published CDM JSON schema (latest stable). Bindings are pure types + Zod validators; no runtime logic.
2. Define Zod validators at the event-store boundary for each CDM event payload (TradeBooked, ContractFormation, BusinessEvent, Reset, Termination, etc. — full §6 list). Validators sit in front of `eventStore.append`.
3. Build the primitive registry: a typed map of CDM primitives (Identifier, Party, Quantity, Price, Date, Schedule, Index, etc.) used to compose product types. Primitives are versioned and citable per Anya's semantic layer.
4. Author the equity event types for M1: `EquityTradeBooked`, `EquityCorporateActionApplied`, `EquitySettlementInstructed`. Each has a fully-typed payload, a citation set, and a Zod schema.
5. Wire the handler entry into `prototype/runtime/handlers-metadata.ts` and `prototype/runtime/handler-callables.ts`. Subscribe to `CeoDecision`. The handler runs on parent-event fan-out, generates / refreshes bindings, and emits a `CdmBindingsRegenerated` event recording bytes-written and primitive count.

## Out of scope for M1

- Listed bonds / repo (M2)
- OTC IRS (M3)
- FX swaps + HQLA repo financing (M4)
- Optionality / structured products / FRTB-IMA prep (M5)

## What good looks like

- Equity event types validate against CDM upstream. Round-trip: `cdm-source.json → bindings → Zod schema → equity event payload → eventStore.append → replay → identical payload`.
- Primitive registry is consumable by Anya's projection-runtime-mapping handler without extra plumbing.
- IFRS classification rules (Bea) consume the equity event types directly.
- Ad-hoc `bun run agent:kai-m1-cdm-typescript-bindings` runs cleanly; CI exercises a smoke test.

## Reconciliation

- Vera's audit pipeline asserts: every CDM primitive in the registry has a citation; every event type emits with a typed payload (no `Record<string,unknown>` leaks at the boundary).
- Atlas substrate-state recon picks up the new event types in its weekly snapshot.

## Owner Inbox deliverable on completion

`Owner Inbox/<date>_kai_m1-cdm-typescript-bindings_completion.md` — what was generated, what's next on the M1 critical path, what's blocked on Atlas A0–A2.
