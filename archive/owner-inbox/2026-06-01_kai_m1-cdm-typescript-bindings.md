---
agent: Kai
trigger: m1-cdm-typescript-bindings
asOf: 2026-06-01T06:27:32.779Z
decision-required: false
---

# Kai — CDM bindings v1 slice, 2026-06-01

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
- Round-trip succeeded; event_id=afbc9274-0205-4091-b590-ffe54160c29c; type=EquityTradeBooked.

_Self-test exercises the M1 round-trip: synthetic `EquityTradeBooked` payload → Zod validation → envelope construction. Validates that downstream consumers (Anya projections, Bea IFRS classifier) can build against the surface immediately._

## What's NOT in v1

- **Upstream ISDA CDM JSON-schema import.** v1 hand-curates primitives + equity event types from the canonical CDM section names; full upstream import (CDM JSON → generated TypeScript → diff against hand-curated) is the next-cycle work.
- **M2 product types (listed bonds, repo, GMRA).** Land at M2 with the same pattern: typed primitive extensions + bond / repo event types + factories.
- **M3 product types (OTC IRS).** Land at M3, gated on Atlas A0–A2 substrate work.
- **Event-store registration.** v1 emits `EquityTradeBooked` etc. through the existing `eventSchema.parse` validator; integration into `platform/event-store/registry.ts` (the per-type Zod registry) lands when Anya / Bea wire downstream consumers.

## Kai's narrative

Headline: the M1 CDM TypeScript surface is bind-able for the equity lifecycle — six event types (EquityTradeBooked, EquityTradeExecuted, EquityCorporateActionApplied, EquitySettlementInstructed, EquitySettlementConfirmed, EquityPositionRevalued) are defined with Zod schemas, factory exports, and a passing round-trip self-test (event_id afbc9274-0205-4091-b590-ffe54160c29c, type EquityTradeBooked). That is enough for Anya's projection-runtime-mapping and Bea's IFRS classifier to build against today on the equity leg. Bond, IRS and FX event types from CDM `Event Model → Business Event` remain upstream-import-pending against the M2–M5 forward-load; they are named in the CDM but not imported, not validated, not factory-exported here, and downstream consumers must not assume them.

The load-bearing observations, ranked: (1) the eight primitives cover trade/settlement scalars but do not yet include a `Money`-with-FX-pair or a rate-index primitive — both are blockers for the M2 bond cash-flow shape and the M3 IRS reset event, and that gap is the single most consequential omission for Anya's projection runtime under Principle 1 (the bindings are the canonical authoring location, so the absence here *is* the absence everywhere downstream); (2) the self-test exercised the validator through the EquityTradeBooked round-trip — schema → factory → serialise → parse → schema — which confirms the Zod path Bea's IFRS classifier will hit on ingest, but it does *not* yet exercise EquityCorporateActionApplied, whose payload shape (CDM `Corporate Action Event`) will need extension when dividend-in-kind and spin-off variants land; (3) EquitySettlementConfirmed currently models cash settlement only, and will need a delivery-vs-payment branch before the bond settlement events arrive at M2.

Next M1 move, concrete: wire Anya's projection-runtime-mapping against the six exported equity event types this week, using EquityTradeBooked as the pilot (the self-test path is the contract); in parallel, import CDM `Product Model → Asset Class → InterestRate` to seed the rate-index primitive ahead of M3, and add a round-trip self-test for EquityCorporateActionApplied so the validator path is proven on a non-trivial payload before Bea's classifier binds to it. Per Principle 5, I'll surface the primitive gap and the corporate-action test coverage to Saskia in the next governance pass rather than treating either as silently deferred.

## Next moves

- **Anya** wires `m1-projection-runtime-mapping` against this surface — trade-record + position + sub-ledger projections from the equity event stream.
- **Bea** wires `m1-ifrs-classification-rules` against this surface — IFRS 9 dispatch (FVTPL / FVOCI) on `EquityTradeBooked`; sub-ledger postings on `EquitySettlementInstructed`.
- **Atlas** registers the equity event types in `platform/event-store/registry.ts` once the downstream consumers are live (substrate gate before append-validation goes hard).
- **Kai (next-cycle)** imports the upstream ISDA CDM JSON schema and diffs against the hand-curated v1 surface; reconciles divergences.

## Provenance

Read `prototype/platform/markets/cdm/primitives.ts` and `prototype/platform/markets/cdm/equity.ts` for the inventory; ran the round-trip self-test against the live `EquityTradeBooked` factory; cross-referenced `Team Inbox/2026-05-07_brief_kai_m1-cdm-typescript-bindings.md` for scope and `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §6 for the lifecycle event types.
