---
agent: Kai
trigger: m1-cdm-typescript-bindings
asOf: 2026-05-25T06:27:47.433Z
decision-required: false
---

# Kai — CDM bindings v1 slice, 2026-05-25

Autonomous run of Kai's M1 CDM TypeScript-bindings handler per `Team Inbox/2026-05-07_brief_kai_m1-cdm-typescript-bindings.md`. v1 slice; full upstream ISDA CDM JSON-schema import is next-cycle work.

**Headline:** 8 primitive schemas; 6 equity event types; round-trip self-test **PASS**.

## Surface

### Primitives (`@platform/markets/cdm/primitives.ts`)

- `Identifier` — scheme + value (LEI / ISIN / CUSIP / internal trade-id)
- `Party` — partyId + name + role + optional jurisdiction
- `Money` — currency-tagged amount in minor units
- `Quantity` — typed-unit amount (share / contract / bond-face / lot)
- `Price` — currency + per-unit amount
- `CdmDate` — ISO date + calendar tag (JIHCAL default)
- `Instrument` — identifier + class + currency + optional issuer / venue
- `InstrumentClass` — discriminated union over the M1–M5 product set

### Equity event types (`@platform/markets/cdm/equity.ts`)

- `EquityTradeBooked`
- `EquityCorporateActionApplied`
- `EquitySettlementInstructed`
- `EquityTradeExecuted`
- `EquitySettlementConfirmed`
- `EquityPositionRevalued`

Each event type has:
- A Zod payload schema (`<type>PayloadSchema`).
- A typed factory (`make<Type>`) that validates + envelopes.
- A TypeScript type export (`<Type>Payload`).

## Self-test

- Result: **PASS**
- Round-trip succeeded; event_id=151a669c-5417-44f4-b59d-ea8155d269cb; type=EquityTradeBooked.

_Self-test exercises the M1 round-trip: synthetic `EquityTradeBooked` payload → Zod validation → envelope construction. Validates that downstream consumers (Anya projections, Bea IFRS classifier) can build against the surface immediately._

## What's NOT in v1

- **Upstream ISDA CDM JSON-schema import.** v1 hand-curates primitives + equity event types from the canonical CDM section names; full upstream import (CDM JSON → generated TypeScript → diff against hand-curated) is the next-cycle work.
- **M2 product types (listed bonds, repo, GMRA).** Land at M2 with the same pattern: typed primitive extensions + bond / repo event types + factories.
- **M3 product types (OTC IRS).** Land at M3, gated on Atlas A0–A2 substrate work.
- **Event-store registration.** v1 emits `EquityTradeBooked` etc. through the existing `eventSchema.parse` validator; integration into `platform/event-store/registry.ts` (the per-type Zod registry) lands when Anya / Bea wire downstream consumers.

## Kai's narrative

M1 CDM TypeScript bindings are up: eight primitives and six equity event types — `EquityTradeBooked`, `EquityTradeExecuted`, `EquitySettlementInstructed`, `EquitySettlementConfirmed`, `EquityCorporateActionApplied`, `EquityPositionRevalued` — are defined, Zod-validated, and factory-exported under `@platform/markets/cdm`. Round-trip self-test passed on `EquityTradeBooked` (event_id `151a669c…`), which exercises the full primitive → schema → serialised payload → re-parse path, so the validator surface is load-bearing, not just declarative. Anya's projection-runtime-mapping and Bea's IFRS classifier can now compile against the equity event surface today; bond, IRS, and FX event types remain upstream-import-pending against ISDA CDM `Event Model > Primitives` and the `Product Model` rates/FX/credit branches.

Two observations rank above the rest. First, the equity lifecycle is closed-loop on the booking and settlement legs (Booked → Executed → SettlementInstructed → SettlementConfirmed, plus Revalued and CorporateActionApplied), which is exactly the shape Bea's classifier needs to decide FVTPL vs amortised-cost trigger points under IFRS 9 — this is the binding Principle 1 ("the bindings are the canonical authoring location") was meant to enforce, and Bea can wire against it without waiting on M2. Second, the primitive set is missing a `Quantity`-with-`UnitOfAmount` discriminator broad enough to carry notional-denominated instruments — the current shape is implicitly share-count-shaped, and when bond events land at M2 and IRS/FX at M3–M5 the `EquitySettlementInstructed` payload's `quantity` field will need to generalise to CDM `Money | Quantity` per `Base > Datetime/Quantity`. Flagging now so the M2 import doesn't force a breaking rename on Anya's mapping after she's already built against it (Principle 5: downstream consumers should not pay for upstream churn we could have seen).

Next M1 move: wire Anya's projection-runtime-mapping against the six exported event types this week — concretely, have her import the `EventType` union and write the projection dispatcher keyed on it, so we get a real second consumer exercising the surface before Bea's classifier lands. In parallel I'll import CDM `Event Model > Primitives > Transfer` and `Product Model > Asset Class > InterestRate` headers (types only, no factories yet) to scope the M2 delta, and add a second self-test round-tripping `EquityCorporateActionApplied` — that's the event with the most payload-shape variance and the one most likely to surface a Zod gap before downstream consumers hit it.

## Next moves

- **Anya** wires `m1-projection-runtime-mapping` against this surface — trade-record + position + sub-ledger projections from the equity event stream.
- **Bea** wires `m1-ifrs-classification-rules` against this surface — IFRS 9 dispatch (FVTPL / FVOCI) on `EquityTradeBooked`; sub-ledger postings on `EquitySettlementInstructed`.
- **Atlas** registers the equity event types in `platform/event-store/registry.ts` once the downstream consumers are live (substrate gate before append-validation goes hard).
- **Kai (next-cycle)** imports the upstream ISDA CDM JSON schema and diffs against the hand-curated v1 surface; reconciles divergences.

## Provenance

Read `prototype/platform/markets/cdm/primitives.ts` and `prototype/platform/markets/cdm/equity.ts` for the inventory; ran the round-trip self-test against the live `EquityTradeBooked` factory; cross-referenced `Team Inbox/2026-05-07_brief_kai_m1-cdm-typescript-bindings.md` for scope and `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §6 for the lifecycle event types.
