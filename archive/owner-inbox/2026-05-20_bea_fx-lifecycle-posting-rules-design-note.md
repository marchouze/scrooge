---
title: FX lifecycle posting rules — design note
author: Bea (Accounting & financial reporting engineer, engineering)
authored-on: 2026-05-20
workstream: WS-FX-NEW-PRODUCT
brief: brief:bea:author-fx-lifecycle-posting-rules-pr-fx-instruct:2026-05-20
citations:
  - urn:decision:D-MARKETS-SCHEMA-FOUNDATION
  - urn:decision:D-FX-CLS-MEMBERSHIP
  - urn:ifrs:9#3.1.1
  - urn:ifrs:9#3.2
  - urn:ifrs:9#3.2.3
  - urn:ifrs:9#5.7.1
  - urn:ias:21#21
  - urn:ias:21#28
  - urn:excon:sarb-circ-3-2020
---

# FX lifecycle posting rules — design note (PR-FX-INSTRUCT, PR-FX-PRIN, PR-FX-LIFECYCLE-CLOSE, PR-FX-REGREPORT)

## §1 — Summary

Four FX lifecycle events were previously flagged in Marc (CEO)'s worked-journal-entries register as "missing — substrate gap". This note documents the posting-rule decisions taken, the GL-impact taxonomy, and the `TradeMatured` open question.

All four new posting rules deliberately return `[]` (no GL legs). Each is **load-bearing**: the rule's existence asserts that the GL impact is *intentionally* zero — distinct from "no posting rule has been authored yet". This closes four entries in the register.

| Event | Posting rule | GL impact | Owner |
|---|---|---|---|
| `FxSettlementInstructed` (CDM) | PR-FX-INSTRUCT | `[]` — memorandum | Bea |
| `PrincipalPayment` (CDM, per-leg) | PR-FX-PRIN | `[]` — memorandum | Bea |
| `SettlementConfirmed` (CDM, lifecycle close) | PR-FX-LIFECYCLE-CLOSE | `[]` — memorandum | Bea |
| `FxSettlementConfirmed` (accounting projection) | PR-FX-003 | **GL-significant** (already authored) | Bea (existing) |
| `TradeReportSubmitted` | PR-FX-REGREPORT | `[]` — memorandum | Bea |
| `TradeMatured` | — | substrate gap (event-type does not exist) | Atlas + Camille + Bea (see §4) |

## §2 — CDM `SettlementConfirmed` vs accounting `FxSettlementConfirmed`

Two settlement-completion event types co-exist and are **not duplicates**. They sit at different layers of the stack and carry different payloads.

### Layer 1 — CDM lifecycle event (`SettlementConfirmed`)

- **Schema:** `prototype/platform/markets/cdm/fx.ts:544`
- **Payload:** `tradeId`, `currencyPair`, `settledDate`, `realisedPnlDelta` (ZAR minor), `settlementRef`, `finsurvReportingRef`.
- **Trigger:** emitted by the FX lifecycle engine once both `PrincipalPayment` events have been recorded by the correspondent bank.
- **Semantics:** lifecycle marker — "the trade is closed". Does not carry the per-currency settled amounts or the nostro-account IDs required for a balanced GL derecognition entry.
- **Posting rule:** **PR-FX-LIFECYCLE-CLOSE → `[]`** (memorandum).

### Layer 2 — Accounting projection event (`FxSettlementConfirmed`)

- **Schema:** `prototype/platform/event-store/event-types/fx-accounting.ts:112`
- **Payload:** `tradeId`, `currencyPair`, `legKind`, `settledBaseCurrencyMinor`, `settledQuoteCurrencyMinor`, `settledAt`, `nostroAccountBase`, `nostroAccountQuote`, `realisedPnlZarMinor`, `correspondentRef`.
- **Trigger:** projected from CDM `SettlementConfirmed` (and the two upstream `PrincipalPayment` events) by Bea's settlement-projection handler. The projection enriches the lifecycle marker with per-currency settled amounts and nostro-account IDs.
- **Semantics:** the GL-significant event. Carries everything required for a balanced derecognition entry under IFRS 9 §3.2.3 and IAS 21 §28.
- **Posting rule:** **PR-FX-003 → balanced legs** (already authored at `fx-spot.ts:306` — unchanged by this note).

### Why this split

1. **Pure-function contract.** Posting rules are pure functions: `(event payload) → SubLedgerLeg[]`. They cannot reach across events to reconstruct state. The CDM `SettlementConfirmed` payload alone is insufficient for a derecognition entry (no per-currency amounts; no nostro IDs). The accounting projection is the layer that gathers cross-event state into a single GL-bearing payload.
2. **Single derecognition.** Emitting GL legs on both events would double-count the cash movement. The single point of derecognition is the accounting `FxSettlementConfirmed` projection.
3. **Layered citations.** The CDM event cites D-MARKETS-SCHEMA-FOUNDATION + D-FX-CLS-MEMBERSHIP (lifecycle authority). The accounting projection adds IFRS 9 §3.2.3 + IAS 21 §28 (accounting-policy authority). The split preserves the regulation-→-policy-→-procedure chain (Principle 2).

## §3 — `PrincipalPayment` vs `FxSettlementConfirmed`

`PrincipalPayment` is the **per-leg** correspondent notification. For a Spot ZAR/USD trade there are two `PrincipalPayment` events (one for ZAR-deliver, one for USD-receive). Both upstream of the accounting projection.

### Why PR-FX-PRIN returns `[]`

- Per-leg event payload (`fx.ts:464`) carries `legKind`, `currency`, `netCash`, `settlementDate`, `correspondent`, `settlementConfirmationRef`. It does **not** carry the nostro-account ID or the realised-P&L delta required for a balanced posting.
- Choosing the other direction (PR-FX-PRIN owns GL, PR-FX-003 becomes no-op) was considered and rejected:
  - The realised-P&L residual (computed as `settledZarEquivalent - carryingAmountZar at last revaluation`) is a per-trade quantity, not a per-leg quantity. Allocating it across two leg-events introduces an arbitrary split and a second source of truth.
  - The pure-function contract forbids cross-event state in the posting rule itself.
- Per-leg events remain auditable: each is persisted, citation-bearing, and queryable. They simply carry no GL consequence.

### Round-trip invariant (tested)

```
fxPrincipalPaymentJournals(receiveLeg) === []
fxPrincipalPaymentJournals(deliverLeg) === []
fxSettlementJournals(aggregate)        === balanced legs (PR-FX-003)
```

Combined GL impact = the PR-FX-003 output only. See `fx-spot.test.ts` "round-trip" test under "PR-FX-PRIN".

## §4 — `TradeMatured` — substrate gap

`TradeMatured` is **not yet a defined event type**. The brief explicitly instructs against inventing one here. This section captures the substrate-gap question for downstream resolution.

### Why `TradeMatured` would matter

- **FX-Forward (deliverable).** Maturity = delivery date. Pure spot's `SettlementConfirmed` already closes the lifecycle, so for spot `TradeMatured` would be redundant. For a deliverable forward the maturity event coincides with the `SettlementConfirmed` of the gross-principal exchange — again redundant with `SettlementConfirmed`.
- **FX-Forward (NDF).** Maturity = fixing-date + 2 BD cash settlement. The lifecycle is `NdfFixingObserved` → `FxSettlementInstructed` (cash) → `PrincipalPayment` (single leg) → `SettlementConfirmed`. `TradeMatured` is again redundant with the final `SettlementConfirmed`.
- **FX-Swap (near + far).** Near-leg `SettlementConfirmed` does not close the trade. The trade closes at far-leg `SettlementConfirmed`. The CDM `SettlementConfirmed` carries `legKind` only on the accounting projection; the CDM event itself currently lacks a leg discriminator. A `TradeMatured` event would either be (a) redundant with the second `SettlementConfirmed` (legKind = "far"), or (b) the moment at which both legs are confirmed and the swap is fully extinguished.

### My recommendation

**`TradeMatured` is not required for spot or NDF.** It may be load-bearing for swaps if the schema cannot be enriched to carry a "both legs settled" flag on the second `SettlementConfirmed`. The cleaner alternative is to enrich the CDM `SettlementConfirmed` payload with `lifecycleStatus: "leg-closed" | "trade-closed"`, derived by the lifecycle engine that knows the swap's structure.

If the schema is enriched as above, **`TradeMatured` is not needed**, and the worked-journal-entries register row should be marked "not applicable (swap leg-status carried on `SettlementConfirmed`)" rather than "substrate gap".

If the schema is not enriched, `TradeMatured` would be a new event-type with `productTaxonomy: "FX-swap"`-only relevance, posting-rule PR-FX-MATURE → `[]` (memorandum; far-leg `SettlementConfirmed` already carries the GL impact).

### Ownership of the schema decision

- **Atlas (Event-store / schema engineer, engineering)** — event-type registration; payload schema authorship.
- **Camille (CFO, finance)** — accounting-policy view on whether maturity is a distinct accounting trigger or absorbed into settlement.
- **Bea (me)** — posting-rule authoring once the schema decision lands.

A short follow-up brief should be issued by Scrooge to Atlas + Camille + Bea jointly to close this gap. The brief should pose the binary: "enrich `SettlementConfirmed` with `lifecycleStatus`, or add a new `TradeMatured` event-type — which?"

## §5 — Worked-journal-entries register row replacements

The register at Marc's worked-journal-entries page should now show:

| Event | Posting rule | Worked entry | Source |
|---|---|---|---|
| FxTradeExecuted | PR-FX-001 | Dr FX Receivable / Cr FX Payable per currency | `fx-spot.ts:178` |
| FxSettlementInstructed | PR-FX-INSTRUCT | (no GL — instruction only; memorandum) | `fx-spot.ts` (new) |
| PrincipalPayment | PR-FX-PRIN | (no GL — per-leg memorandum; PR-FX-003 owns aggregate) | `fx-spot.ts` (new) |
| FxSettlementConfirmed (accounting projection) | PR-FX-003 | Dr Nostro / Cr Receivable; Dr Payable / Cr Nostro; ± Realised P&L | `fx-spot.ts:306` |
| SettlementConfirmed (CDM lifecycle) | PR-FX-LIFECYCLE-CLOSE | (no GL — lifecycle marker; memorandum) | `fx-spot.ts` (new) |
| TradeReportSubmitted | PR-FX-REGREPORT | (no GL — regulator dispatch only) | `fx-spot.ts` (new) |
| TradeMatured | — | substrate gap — see §4; recommendation: enrich `SettlementConfirmed` with `lifecycleStatus` and drop the event-type proposal | — |

## §6 — Citations

- **D-MARKETS-SCHEMA-FOUNDATION** (CEO-approved) — CDM event-family authority.
- **D-FX-CLS-MEMBERSHIP** (CEO-approved) — correspondent-routed settlement default; PvP confirmations.
- **D-FX-AD-STATUS** (CEO-approved) — Authorised-Dealer status; FinSurv reporting authority for PR-FX-REGREPORT.
- **IFRS 9 §3.1.1** — recognition of financial assets/liabilities at trade date (PR-FX-001 anchor).
- **IFRS 9 §3.2** — derecognition framework (PR-FX-003 anchor).
- **IFRS 9 §3.2.3** — derecognition when contractual rights expire (PR-FX-003 anchor; PR-FX-PRIN / PR-FX-LIFECYCLE-CLOSE no-op rationale).
- **IFRS 9 §5.7.1** — FVTPL classification (held-for-trading FX).
- **IAS 21 §21** — initial recognition of foreign-currency transactions.
- **IAS 21 §28** — settlement-date P&L recognition.
- **EXCON-SARB-CIRC-3-2020** — FinSurv reporting obligations (PR-FX-REGREPORT context).

---

## §5 — Erratum (2026-05-20): circularity in §3 and the Option 1 fix

**Status:** ERRATUM applied 2026-05-20 by Bea (Accounting & financial reporting engineer, engineering) following CEO review.

### What Marc found on PR #608

The PR #608 design (above) declared that:
- **PR-FX-PRIN** (on `PrincipalPayment`) returns `[]` — defers to PR-FX-003 on the aggregate `FxSettlementConfirmed`.
- **PR-FX-LIFECYCLE-CLOSE** (on CDM `SettlementConfirmed`) returns `[]` — defers to PR-FX-003 on the accounting `FxSettlementConfirmed` projection.
- **PR-FX-003** (on accounting `FxSettlementConfirmed`) carries the full GL impact.

The circularity Marc spotted: `makeFxSettlementConfirmed(...)` is called **only from test code** (`platform/markets/eod/fx-revaluation.test.ts`, `platform/markets/eod/fx-forward-revaluation.test.ts`, `tests/ba-325-lcr.test.ts`). It is **never emitted** from `platform/simulation/post-trade-lifecycle.ts`, scenarios `06-fx-spot-trade.ts` / `07-fx-forward-trade.ts`, or any production code path. There is no projection handler that listens to CDM `SettlementConfirmed` and emits the accounting `FxSettlementConfirmed` projection — the design note assumed a handler that does not exist.

**Net effect under §3:** an FX trade booked → instructed → 2× `PrincipalPayment` → CDM `SettlementConfirmed` produced **only PR-FX-001** (the booking) on the GL. The FX Trading Receivable and Payable were never derecognised; the nostro was never debited/credited; realised P&L was never recognised. The books were wrong for every settled trade.

### The CEO decision (2026-05-20, in-session)

**Option 1 — PR-FX-PRIN becomes the GL-significant rule** (per-leg cash at correspondent confirmation). PR-FX-LIFECYCLE-CLOSE owns the realised-P&L residual. PR-FX-003 + the accounting `FxSettlementConfirmed` event-type are deprecated.

Rationale:
- **Events match reality.** Cash moves at the correspondent → book the cash leg then. The CDM `PrincipalPayment` event is the canonical signal of that movement, and it IS emitted by production lifecycle code.
- **No Principle 1 smell.** Option 1 does not derive a synthetic event from another event; the GL fold consumes the primary CDM events directly.
- **No missing handler to write.** The settlement-projection handler the §3 design assumed does not exist. Option 1 removes the need for it.
- **Realised-P&L residual.** The CDM `SettlementConfirmed` event carries `realisedPnlDelta` in ZAR minor units — exactly the residual to recognise once both legs have confirmed.

### Why Option 1 over Option 2 (build the projection handler)

Option 2 was to write a projection handler that listens to CDM `SettlementConfirmed` (+ the prior two `PrincipalPayment` events) and emits the accounting `FxSettlementConfirmed` event. PR-FX-003 would then post against the projection. Rejected because:
- It requires a load-bearing cross-event projection (events deriving from events) — a Principle 1 anti-pattern flagged by Marc.
- It adds a second derecognition timestamp (CDM lifecycle close vs accounting projection), with no underlying economic substance.
- It is more code than Option 1 for an identical end-state GL footprint.

### Implementation summary (this PR)

- **PR-FX-PRIN rewrite** (`fxPrincipalPaymentJournals`):
    - `legKind = "receive"` → `Dr Nostro [ccy] / Cr FX Trading Receivable [ccy]`, amount `|netCash|`.
    - `legKind = "deliver"` → `Dr FX Trading Payable [ccy] / Cr Nostro [ccy]`, amount `|netCash|`.
- **PR-FX-LIFECYCLE-CLOSE rewrite** (`fxLifecycleCloseJournals`):
    - `realisedPnlDelta > 0` → `Dr Nostro ZAR / Cr Realised FX P&L`, amount `realisedPnlDelta`.
    - `realisedPnlDelta < 0` → `Dr Realised FX P&L / Cr Nostro ZAR`, amount `|realisedPnlDelta|`.
    - `realisedPnlDelta === 0` → `[]`.
- **PR-FX-001 (`fxTradeBookingJournals`) convention fix.** A pre-existing pay-leg booking inversion (`Dr Payable / Cr Receivable`) was flipped to the natural side (`Dr Receivable / Cr Payable`) so that PR-FX-PRIN's deliver leg can retire the Payable cleanly. Documented in the function docblock.
- **PR-FX-003 deprecation.** Annotated `@deprecated`; function and underlying accounting `FxSettlementConfirmed` event-type are retained for back-compat with legacy test fixtures and any historical events still in the store. No new production code path emits the event.

### Consumer migration (this PR)

The following downstream consumers folded the accounting `FxSettlementConfirmed` event and have been extended to also fold the CDM `SettlementConfirmed` (and, where useful, `PrincipalPayment`):

- `platform/accounting/gl-projection.ts` — source-event lookup map + posting-type description handlers for `fx-principal-payment` and `fx-lifecycle-close`.
- `platform/reporting/ba-350-events-adapter.ts` — settled-trade detection now folds both the CDM lifecycle-close event and the deprecated accounting event.
- `platform/markets/eod/fx-revaluation.ts` / `fx-forward-revaluation.ts` — settled-trade exclusion folds CDM `SettlementConfirmed` in addition to `FxSettlementConfirmed`. For FX-swap (which needs per-leg granularity), the accounting event remains the authoritative source.
- `platform/product-control/daily-pnl.ts` — settled-trade detection + realised-P&L accumulation folds both event types; CDM `SettlementConfirmed` contributes `realisedPnlDelta`.
- `prototype/runtime/agents/bea-gl-posting-engine.ts` — subscribes to `PrincipalPayment` and `SettlementConfirmed`; routes each to its posting rule.

`platform/event-store/event-types/fx-accounting.ts::subLedgerPostingEmittedPayloadSchema` adds two new `postingType` enum values: `"fx-principal-payment"` and `"fx-lifecycle-close"`.

### Authority

- **D-MARKETS-SCHEMA-FOUNDATION** (CEO-approved) — CDM event-family authority.
- **D-FX-CLS-MEMBERSHIP** (CEO-approved) — correspondent-routed settlement.
- **IFRS 9 §3.2.3** — derecognition on transfer of contractual cash flows (PR-FX-PRIN anchor).
- **IAS 21 §28** — settlement-date FX gain/loss (PR-FX-PRIN + PR-FX-LIFECYCLE-CLOSE anchor).
- **urn:principle:1** — events are reality, not derived from other events.
- **Brief**: `brief:bea:fix-fx-posting-rule-circularity-pr-fx-prin-becom:2026-05-20`.
- **CEO decision (in-session)**: 2026-05-20 (Marc, marc@tgv.co.za).
