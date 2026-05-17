---
title: FX sales & trading front-end Slice 2 — RFQ form + trade-emit
author: Kai (Trading systems engineer, engineering — reports to Saskia, Head of Global Markets) + Saskia (Head of Global Markets, governance) + Anya (Data / analytics engineer, engineering — projection / derivation pattern review)
date: 2026-05-10
summary: Second slice of D-FX-SALES-TRADING-FRONTEND lands. The FX desk page (PR #154) gains an RFQ form (counterparty / currencyPair / side / notional / valueDate), a synthetic-quote stub (fixed mid + symmetric half-spread for ZAR/USD spot — real pricer is Slice 3), a trade-emit button that POSTs to a new `/api/markets/fx/trade` endpoint, and a confirmation panel showing the emitted event-id + provenance tag. The endpoint emits an `FxTradeExecuted` event from the existing FX CDM (PR #49) with the simulated provenance tag `kind: 'simulated', scenario: 'first-dry-run-2026-Q1', sourceLineage: 'agent-runtime:kai-fx-rfq'`. Single currency pair (USD/ZAR spot only) for the first dry-run; multi-pair, forwards, NDFs, real pricer, NPA badge, sales attribution, risk-officer view all defer to Slice 3+ behind named substrate gaps.
decision-required: false
decision-id: D-FX-SALES-TRADING-FRONTEND-SLICE-2
decision-category: substrate-foundational
decision-owner: Kai (Trading systems engineer, engineering) + Saskia (Head of Global Markets, governance) + Anya (Data / analytics engineer, engineering)
---

# FX sales & trading front-end Slice 2 — RFQ form + trade-emit

> **Standing authority:** `D-FX-SALES-TRADING-FRONTEND` (CEO-approved 2026-05-10). Slice authorisation: `D-FX-SALES-TRADING-FRONTEND-SLICE-2`. No new CEO decision required — this slice executes the substrate the parent decision authorised; per the no-pause rule, downstream slices of an approved decision dispatch without per-item CEO confirmation.
>
> **Pack:** [`Owner Inbox/2026-05-10_kai-saskia_fx-sales-trading-front-end-proposal.md`](2026-05-10_kai-saskia_fx-sales-trading-front-end-proposal.md), §6 row 2 (Slice 2).
>
> **Scenario context:** First Dry-Run Scenario pack §6 dispatch #A3 — [`Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md`](2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md). The trade endpoint is the surface dispatch #A4 (scenario script `03-fx-end-to-end-rehearsal.ts`) consumes via the API contract.

## What landed

Slice 2 stands up the RFQ → quote → trade-emit pipeline on the FX desk page. The Slice-1 picker (live) remains read-only; Slice 2 adds the form + endpoint that fires an `FxTradeExecuted` event at the moment the dealer clicks "Trade".

### Files touched / created

| File | Status | Purpose |
|---|---|---|
| `prototype/dashboard/markets-fx-trade.ts` | created | Trade-emit module — RFQ shape, validation, synthetic quote stub, eligibility re-check at emit time, FxTradeExecuted-payload builder, provenance-tagged append. |
| `prototype/dashboard/server.ts` | extended | Two new routes: `POST /api/markets/fx/quote` (synthetic quote without append) and `POST /api/markets/fx/trade` (validate → eligibility-gate → quote → append → confirm). |
| `prototype/dashboard/public/markets/fx/desk.html` | extended | Replaces the Slice-2 placeholder card with a live RFQ form section + confirmation panel. |
| `prototype/dashboard/public/markets/fx/desk.css` | extended | Form layout, quote-panel styles, confirmation-panel styles. |
| `prototype/dashboard/public/markets/fx/desk.js` | extended | Form-submission round-trip — wires the picker selection into the form, calls `/api/markets/fx/quote` on input changes, calls `/api/markets/fx/trade` on submit, renders the confirmation panel with the emitted event-id + provenance tag. |
| `prototype/tests/markets-fx-trade-emit.test.ts` | created | 21 cases covering validation (8), synthetic quote (3), payload shape (2), eligibility gate (2), emit round-trip (4), and quote-only (2). |
| `prototype/scripts/record-d-fx-sales-trading-frontend-slice-2.ts` | created | One-shot CeoDecision-emitter; idempotent. |

### Trade-emit pipeline

The trade-emit endpoint follows a deterministic four-step pipeline:

1. **Validate** RFQ body shape — non-empty `counterpartyId`, `currencyPair` matches `BASE/QUOTE` ISO-4217 regex AND equals `USD/ZAR` (first-dry-run constraint per dispatch brief), `side` in `{buy, sell}`, `notional` finite + positive, `valueDate` matches `YYYY-MM-DD`.
2. **Re-check counterparty eligibility** at emit time using the same Slice-1 fold (`buildCounterpartiesView`). Mirrors pack §3 G1: a counterparty that breached after the form was opened is rejected before the trade event is appended.
3. **Price** a synthetic quote — fixed mid (`SYNTHETIC_USDZAR_MID = 18.5`) ± symmetric half-spread (`SYNTHETIC_HALF_SPREAD = 0.0025`); bank-side rate is the offer for buys, the bid for sells.
4. **Build + append** the `FxTradeExecuted` event from the FX CDM (`prototype/platform/markets/cdm/fx.ts`, `makeFxTradeExecuted`). The payload carries `productTaxonomy: "FX-spot"`, single near-leg with USD/ZAR currencies, `bookType: "trading"` (per `D-FX-BOOK-BOUNDARY`), `settlementForm: "physical"`, `settlementPath: "correspondent"` (per `D-FX-CLS-MEMBERSHIP` default). Provenance tag: `kind: 'simulated', scenario: 'first-dry-run-2026-Q1', sourceLineage: 'agent-runtime:kai-fx-rfq'`.

### Form fields

The RFQ form mirrors the FX CDM's spot shape so the user inputs map 1:1 onto the appended payload:

| Field | UI | CDM mapping |
|---|---|---|
| Counterparty | Select; populated from the Slice-1 picker (eligibility-passing only). | `counterparty.partyId` + `counterparty.name` (jurisdiction defaults to ZA). |
| Currency pair | Read-only `USD/ZAR` for first dry-run. | `currencyPair: { base: "USD", quote: "ZAR" }`. |
| Side | Buy / Sell radio. | `side`. |
| Notional (USD) | Number input, positive. | `legs[0].notional` (when side=sell, USD is the pay leg) or `counterNotional` (when side=buy). |
| Value date | Date input (defaults to T+2). | `legs[0].settlementDate.iso`. |

### Event emitted

```jsonc
{
  "type": "FxTradeExecuted",
  "actor": { "type": "service", "id": "agent:kai:fx-rfq" },
  "citations": [
    "D-FX-SALES-TRADING-FRONTEND",
    "D-MARKETS-SCHEMA-FOUNDATION",
    "D-FX-BOOK-BOUNDARY",
    "Owner Inbox/2026-05-10_kai-saskia_fx-sales-trading-front-end-proposal.md",
    "Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md",
    "[citation: TBC pending counsel — FAIS s.45 sub-section refs]"
  ],
  "payload": {
    "tradeId": { "scheme": "internal-trade-id", "value": "trd:..." },
    "productTaxonomy": "FX-spot",
    "currencyPair": { "base": "USD", "quote": "ZAR" },
    "side": "buy",
    "legs": [{
      "legKind": "near",
      "payCurrency": "ZAR",
      "receiveCurrency": "USD",
      "notional": { "currency": "ZAR", "amountMinor": 1850250000 },
      "counterNotional": { "currency": "USD", "amountMinor": 100000000 },
      "rate": { "currency": "ZAR", "amount": 18.5025 },
      "settlementDate": { "iso": "2026-05-12", "calendar": "JIHCAL" }
    }],
    "tradeDate": { "iso": "2026-05-10", "calendar": "JIHCAL" },
    "counterparty": {
      "partyId": "cp:standard-bank-za",
      "name": "cp:standard-bank-za",
      "role": "counterparty",
      "jurisdiction": "ZA"
    },
    "venue": "OTC",
    "trader": "agent:kai:fx-pricer",
    "bookId": "fx-spot-zaru-trading-book-1",
    "bookType": "trading",
    "settlementForm": "physical",
    "settlementPath": "correspondent",
    "finsurvCategory": "[citation: TBC]"
  },
  "provenance": {
    "kind": "simulated",
    "scenario": "first-dry-run-2026-Q1",
    "sourceLineage": "agent-runtime:kai-fx-rfq",
    "tags": ["fx-desk", "slice-2", "rfq:..."]
  }
}
```

### Provenance tag

Per `D-DATA-PROVENANCE-SUBSTRATE` Slice 6+1 (PR #161) and the dispatch brief: `kind: 'simulated', scenario: 'first-dry-run-2026-Q1', sourceLineage: 'agent-runtime:kai-fx-rfq'`. The `agent-runtime:<...>` parameterised pattern is already registered in `platform/event-store/provenance-lineage.registry.ts`. The substrate-active flag is currently `false`, so untagged events would be tolerated; we tag explicitly so the audit trail is self-describing the moment the flag flips.

### Slice-2-specific design choices

- **Single canonical event type — `FxTradeExecuted`.** The dispatch brief constrains us against touching `event-types.ts`; pack §4.2 lists only `OrderProposed` (existing schema) for v1. The FX-CDM `FxTradeExecuted` event is the canonical typed FX trade event (PR #49), and the dry-run pack §A3 acceptance explicitly names "emitted `TradeExecuted` event has all required CDM payload fields per `prototype/platform/markets/cdm/fx.ts`". We use `FxTradeExecuted` directly. The `RfqRequested` / `QuoteResponded` / `OrderProposed` / `GatewayCheckRequested` / `OrderApprovedAtGateway` chain proposed in pack §3 J1–J3 (with `RfqRequested` + `QuoteResponded` as new typed events) is preserved as a substrate gap (pack §9 #2) for the deeper Slice 3+ work after RMS Slice 2 lands on `event-types.ts`.
- **Synthetic quote stub.** Fixed mid + symmetric half-spread, deterministic (same RFQ → same quote across replays). Real pricer wired in Slice 3.
- **Trade-emit re-checks eligibility.** A counterparty breached between picker-load and trade-emit is rejected before the event lands. Defence-in-depth on top of the picker filter.
- **First-dry-run constraint enforced at validation.** The endpoint rejects every pair that is not `USD/ZAR`. When Slice 3 lifts the constraint, the validator changes; the FxTradeExecuted payload shape needs no change.

## Substrate gaps surfaced (pack §9 + Slice-2-specific)

| # | Gap | Owner | Notes |
|---|---|---|---|
| 1 | **`RfqRequested` + `QuoteResponded` event types** — pack §9 #2. The full RFQ → quote → order chain proposed in pack §3 J1–J3 needs two new typed events. Slice 2 ships the trade-emit collapsed onto a single `FxTradeExecuted` event so the dry-run pack §A3 acceptance (typed CDM payload) is met without touching `event-types.ts`. | Kai (schema author) · Atlas (substrate authority); queued behind RMS Slice 2 to avoid the `event-types.ts` three-way clash documented in `feedback_handlers_metadata_three_way_clash`. | Slice 3 introduces the events + threads the pricer into the chain. |
| 2 | **Real pricer.** Synthetic-stub quote is deterministic; no market-data wiring. Pack §11 Q3 deferred this to Slice 3 (and beyond — Saskia's franchise design `WS-MARKETS-FRANCHISE` resolves the internal-vs-external-feed question). | Kai · Saskia | Slice 3 substrate. |
| 3 | **Multi-pair / forwards / NDFs / swaps.** First dry-run constraint per dispatch brief — only USD/ZAR spot. The FxTradeExecuted CDM already supports the full taxonomy; the v1 form just doesn't expose it. | Kai | Slice 3 expands the form once the dry-run wedge ships. |
| 4 | **Sales-rep attribution / FAIS rep id.** The trade event currently records `actor: agent:kai:fx-rfq` and `trader: agent:kai:fx-pricer`. Sales attribution at licence-day requires a third axis (`agent:niko:sales-desk` per pack §2). | Niko (Sales / CRM engineer; paused in build phase per `_team-roster.json`) — activates at licence-day. | Currently no separate sales actor; trade event blurs sales + trader into the FX-RFQ agent identity. |
| 5 | **NPA Policy attestation badge.** Pack §6 Slice 7 — informational badge on the pricer surface. Defers per pack §11 Q4 (informational v1, gating v2). | Kai · Saskia (NPA Policy authority) | Slice 7. |
| 6 | **Risk-officer view + rejection feed.** Pack §6 Slice 5. The trade-emit endpoint validates + gates locally; the broader pre-trade-gateway surface (G2) is wired in Slice 4 and the read-view in Slice 5. | Kai · Helena (CRO) · Tomas (Operations & payments engineer) | Slices 4-5. |
| 7 | **`OrderProposed` → gateway fan-out.** Pack §6 Slice 4 — the existing `OrderProposed` event (event-types.ts:1547) + the pre-trade gateway aggregator (`runtime/agents/kai-pre-trade-gateway-aggregator.ts`) are not invoked by Slice 2's trade-emit. Slice 2 emits `FxTradeExecuted` directly — the rehearsal optic is "trade is recorded", not "trade went through every pre-trade check". | Kai | Slice 4 inserts the OrderProposed → gateway → FxTradeExecuted causal chain once the pricer (Slice 3) lands. |
| 8 | **Composition-mode flag.** Inherited from Slice 1 — Atlas follow-on. The substrate-mode banner is still static. | Atlas | Pack §9 #1. |

## Tests

`prototype/tests/markets-fx-trade-emit.test.ts` — 21 cases:

- **validateRfqInput (8):** valid input, non-USD/ZAR pair, malformed pair, malformed valueDate, non-positive notional (zero + negative), missing counterpartyId, invalid side, non-object body.
- **quoteRfq synthetic stub (3):** fixed mid + symmetric spread, side-flipped rateUsed, source label.
- **buildSpotPayload (2):** single near-leg + USD/ZAR pair + physical settlement + correspondent path + bookType=trading; pay/receive currencies flip with side.
- **isCounterpartyEligible (2):** passing counterparty, unknown counterparty.
- **emitTrade (4):** happy path appends one event; provenance tag is `simulated/first-dry-run-2026-Q1/agent-runtime:kai-fx-rfq`; eligibility-gated counterparty rejected; validation-failure rejected without append.
- **quoteOnly (2):** valid round-trip; rejection propagation.

## What this enables

- **Dispatch #A4 (scenario script)** can call `POST /api/markets/fx/trade` with the synthetic-counterparty + synthetic-RFQ corpus and observe the FxTradeExecuted appear on the event log under the named scenario.
- **Bea's IFRS sub-ledger** (when wired downstream of FxTradeExecuted) can dispatch on `bookType: trading` and project sub-ledger postings filtered by `provenance.scenario`.
- **Tomas's settlement chain** can pick up FxTradeExecuted from the scenario stream and emit `FxSettlementInstructed` (Phase B of the dry-run pack) without further substrate.

## Change log

- 2026-05-10 — Initial slice land. Authors: Kai (Trading systems engineer, engineering — reports to Saskia, Head of Global Markets) + Saskia (Head of Global Markets, governance) + Anya (Data / analytics engineer, engineering). Dispatched by Scrooge (Chief of Staff / Orchestrator) under `D-FX-SALES-TRADING-FRONTEND` standing authority + First Dry-Run pack §6 dispatch #A3.
