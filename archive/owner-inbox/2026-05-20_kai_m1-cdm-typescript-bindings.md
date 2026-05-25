---
agent: Kai
trigger: m1-cdm-typescript-bindings
asOf: 2026-05-20T06:55:23.701Z
decision-required: false
---

# Kai — CDM bindings v1 slice, 2026-05-20

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
- Round-trip succeeded; event_id=3306f1d2-31ec-43aa-9d3f-63751e720f39; type=EquityTradeBooked.

_Self-test exercises the M1 round-trip: synthetic `EquityTradeBooked` payload → Zod validation → envelope construction. Validates that downstream consumers (Anya projections, Bea IFRS classifier) can build against the surface immediately._

## What's NOT in v1

- **Upstream ISDA CDM JSON-schema import.** v1 hand-curates primitives + equity event types from the canonical CDM section names; full upstream import (CDM JSON → generated TypeScript → diff against hand-curated) is the next-cycle work.
- **M2 product types (listed bonds, repo, GMRA).** Land at M2 with the same pattern: typed primitive extensions + bond / repo event types + factories.
- **M3 product types (OTC IRS).** Land at M3, gated on Atlas A0–A2 substrate work.
- **Event-store registration.** v1 emits `EquityTradeBooked` etc. through the existing `eventSchema.parse` validator; integration into `platform/event-store/registry.ts` (the per-type Zod registry) lands when Anya / Bea wire downstream consumers.

## Kai's narrative

Headline: the M1 CDM TypeScript surface is bind-able for the equity trade lifecycle end-to-end — `EquityTradeExecuted` → `EquityTradeBooked` → `EquityPositionRevalued` / `EquityCorporateActionApplied` → `EquitySettlementInstructed` → `EquitySettlementConfirmed` — six event types, eight primitives, and a Zod round-trip that passed on `EquityTradeBooked` (event_id `3306f1d2…`). That is enough surface for Anya's M1 projection-runtime-mapping and Bea's M1 IFRS classifier to author against today, on the equity slice only. Everything M2-and-beyond — bonds, IRS, FX — is upstream-import-pending; nothing in this inventory is load-bearing for those yet (Principle 1: the CDM bindings are the canonical authoring location, so M2 product lift starts there, not in consumer code).

Two observations rank above the rest. First, the self-test exercised the validator on the booking event specifically, which is the right path — `EquityTradeBooked` is the join point Anya's projection runtime and Bea's classifier both read from, so a passing round-trip there de-risks both M1 consumers in one shot. Second, the primitive set (eight) is sized for equity cash and corporate actions; it does *not* yet carry a `RateIndex` / `DayCountFraction` / `BusinessDayConvention` triple, which means the moment an IRS or bond coupon event lands at M2, the payload shape for a `RatesTradeBooked` cannot be authored without first importing from ISDA CDM `observable/asset/rates` and the schedule primitives under `base/datetime`. That is the next upstream pull, and it should precede any M2 event-type drafting (Principle 5: don't widen the consumer contract ahead of the upstream binding).

Next M1 move, concrete: (1) wire Anya's projection-runtime-mapping against the six equity event types as-is, with `EquityTradeBooked` as the primary read path the self-test just validated; (2) hand Bea the same six for the IFRS classifier so she can author the equity-cash classification arm of the decision table; (3) write a second round-trip self-test against `EquityCorporateActionApplied`, because its payload shape is the one most likely to need extension when scrip/DRIP/spin-off variants arrive, and a green test now anchors the schema before M2 churn. Upstream import target for the M2 prep slice: ISDA CDM `product/asset/rates` plus `base/datetime` schedules. Nothing else in this inventory is doing work it isn't already doing.

## Next moves

- **Anya** wires `m1-projection-runtime-mapping` against this surface — trade-record + position + sub-ledger projections from the equity event stream.
- **Bea** wires `m1-ifrs-classification-rules` against this surface — IFRS 9 dispatch (FVTPL / FVOCI) on `EquityTradeBooked`; sub-ledger postings on `EquitySettlementInstructed`.
- **Atlas** registers the equity event types in `platform/event-store/registry.ts` once the downstream consumers are live (substrate gate before append-validation goes hard).
- **Kai (next-cycle)** imports the upstream ISDA CDM JSON schema and diffs against the hand-curated v1 surface; reconciles divergences.

## Provenance

Read `prototype/platform/markets/cdm/primitives.ts` and `prototype/platform/markets/cdm/equity.ts` for the inventory; ran the round-trip self-test against the live `EquityTradeBooked` factory; cross-referenced `Team Inbox/2026-05-07_brief_kai_m1-cdm-typescript-bindings.md` for scope and `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §6 for the lifecycle event types.
