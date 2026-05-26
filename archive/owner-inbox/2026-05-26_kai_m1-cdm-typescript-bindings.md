---
agent: Kai
trigger: m1-cdm-typescript-bindings
asOf: 2026-05-26T09:21:27.461Z
decision-required: false
---

# Kai — CDM bindings v1 slice, 2026-05-26

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
- Round-trip succeeded; event_id=0c2b7727-7f3b-4616-8ec2-8037e097a502; type=EquityTradeBooked.

_Self-test exercises the M1 round-trip: synthetic `EquityTradeBooked` payload → Zod validation → envelope construction. Validates that downstream consumers (Anya projections, Bea IFRS classifier) can build against the surface immediately._

## What's NOT in v1

- **Upstream ISDA CDM JSON-schema import.** v1 hand-curates primitives + equity event types from the canonical CDM section names; full upstream import (CDM JSON → generated TypeScript → diff against hand-curated) is the next-cycle work.
- **M2 product types (listed bonds, repo, GMRA).** Land at M2 with the same pattern: typed primitive extensions + bond / repo event types + factories.
- **M3 product types (OTC IRS).** Land at M3, gated on Atlas A0–A2 substrate work.
- **Event-store registration.** v1 emits `EquityTradeBooked` etc. through the existing `eventSchema.parse` validator; integration into `platform/event-store/registry.ts` (the per-type Zod registry) lands when Anya / Bea wire downstream consumers.

## Kai's narrative

_Narrative generation failed (credit exhausted: Anthropic credit balance exhausted: 400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."},"request_id":"req_011CbQwABm218rEumTnu7KKp"})._

## Next moves

- **Anya** wires `m1-projection-runtime-mapping` against this surface — trade-record + position + sub-ledger projections from the equity event stream.
- **Bea** wires `m1-ifrs-classification-rules` against this surface — IFRS 9 dispatch (FVTPL / FVOCI) on `EquityTradeBooked`; sub-ledger postings on `EquitySettlementInstructed`.
- **Atlas** registers the equity event types in `platform/event-store/registry.ts` once the downstream consumers are live (substrate gate before append-validation goes hard).
- **Kai (next-cycle)** imports the upstream ISDA CDM JSON schema and diffs against the hand-curated v1 surface; reconciles divergences.

## Provenance

Read `prototype/platform/markets/cdm/primitives.ts` and `prototype/platform/markets/cdm/equity.ts` for the inventory; ran the round-trip self-test against the live `EquityTradeBooked` factory; cross-referenced `Team Inbox/2026-05-07_brief_kai_m1-cdm-typescript-bindings.md` for scope and `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §6 for the lifecycle event types.
