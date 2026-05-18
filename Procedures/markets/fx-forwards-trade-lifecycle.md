---
procedureId: PROC-MK-FXFL-01
title: FX forwards — trade lifecycle (booking, MtM revaluation, fixing, settlement)
author: Saskia (Markets franchise lead, engineering) · Rohan (Market risk quant, engineering) · Bea (Finance engineer, accounting)
date: 2026-05-17
owner: Saskia (Markets franchise lead, engineering)
status: POPULATED
version: "0.2"
last-updated: "2026-05-18"
policy-cited: TRADING-MANDATE-V1
system-capability: "@platform/markets/cdm/fx + @platform/markets/eod/fx-revaluation + @platform/finance/ifrs9/classifier"
citations:
  - D-MARKETS-SCHEMA-FOUNDATION
  - D-MARKETS-CAPITAL-TIME-SHAPE
  - D-FX-AD-STATUS
  - D-FX-BOOK-BOUNDARY
  - D-FX-CLS-MEMBERSHIP
  - EXCON-SARB-CIRC-3-2020
  - ORG-EXCON-ODP-001
  - IAS-21-§28
  - IFRS-9-§5.7.1
  - IFRS-9-§3.2.3
---

# Procedure — FX forwards trade lifecycle

**Procedure ID:** PROC-MK-FXFL-01
**Owner:** Saskia (Markets franchise lead, engineering)
**Approval:** BRC (TRADING-MANDATE-V1)
**Cadence:** Per-trade lifecycle (booking → daily MtM revaluation over life → settlement at maturity)
**Version:** v0.1 — 2026-05-17
**Status:** POPULATED

## 1. Source policy

- TRADING-MANDATE-V1 — defines dealer categories, product scope, tenor limits.
- D-MARKETS-SCHEMA-FOUNDATION — CDM event families; FX events reused for forwards via `productTaxonomy: "FX-forward"` discriminator.
- D-MARKETS-CAPITAL-TIME-SHAPE — daily MtM revaluation cadence for trading-book FX positions.

The obligation chain:

```
Regulation (Banks Act Reg 39; Excon AD rules; IFRS 9 / IAS 21)
  → TRADING-MANDATE-V1 (trading mandate framework)
    → PROC-MK-FXFL-01 (this procedure)
      → @platform/markets/cdm/fx (event factory)
      → @platform/markets/eod/fx-revaluation (Anya EOD runner)
      → @platform/finance/ifrs9/classifier (Bea IFRS classifier)
      → FxTradeExecuted / FxSettlementInstructed / FxPositionRevalued /
        PrincipalPayment / SettlementConfirmed / NdfFixingObserved events
```

**Build-phase posture:** No live trading. The lifecycle is exercised by scenario 07 (`bun run scenario:fx-forward`) for both deliverable forwards and the NDF variant. Production-readiness is gated by the pre-licence go-live readiness substrate.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Banks Act Regulation 39 | Trading authority must be formally delegated; FX forwards bound by the dealer mandate. |
| EXCON-SARB-CIRC-3-2020 | Cross-border FX flows (incl. forwards) reportable to SARB FinSurv. |
| ORG-EXCON-ODP-001 | Excon AD rules — OTC derivatives with non-resident counterparties. |
| IFRS 9 §5.7.1 | FVTPL trading book: changes in fair value through P&L (no OCI). |
| IAS 21 §28 | Monetary items retranslated at closing rate at each reporting date. |
| IFRS 9 §3.2.3 | Derecognition on settlement. |
| Principle 5 | Multi-currency / multi-entity at the type level — every leg carries its currency pair. |
| Principle 6 | Default actor is an agent; human steps are P6-cited in the steps table. |

## 3. Scope

This procedure covers:

- **Deliverable FX forwards** — both legs settle gross at maturity (T+N, typically weeks-to-years). Uses the same `FxTradeExecuted` / `FxSettlementInstructed` / `PrincipalPayment` / `SettlementConfirmed` event lifecycle as FX spot, with `productTaxonomy: "FX-forward"` and a longer-dated `settlementDate`.
- **Non-Deliverable Forwards (NDFs)** — single-currency net cash settlement against an observed fixing rate. Replaces the two `PrincipalPayment` events with one `NdfFixingObserved` event.
- **MtM revaluation over the life of the forward** — daily FVTPL revaluation cycles via Anya's EOD runner (`runEodFxRevaluation`), emitting `FxPositionRevalued` for each open position not yet revalued for the valuation date.

Out of scope (substrate gaps):

- **Hedge-accounting designation (D-FX-HEDGE-DESIGNATION)** — when a forward is designated as a cash-flow or fair-value hedge, IFRS 9 §6 effectiveness testing and OCI treatment apply. Today all forwards are classified FVTPL. The `HedgeDesignated` event family is not yet built.
- **Forward curve substrate** — the current EOD revaluation uses spot rates as a proxy for the forward MtM. Real forward MtM uses the forward curve at the residual tenor. Rohan's risk-substrate roadmap item.
- **NDF cash-leg posting rule** — Bea's `posting-rules/fx-spot.ts` handles physical settlement only. The NDF single-currency net cash posting needs a separate posting rule.

## 4. Lifecycle events

| Step | Event | Actor | Description |
|---|---|---|---|
| T0 | `FxTradeExecuted` | Saskia / dealer | Trade booked. `productTaxonomy: "FX-forward"` or `"NDF"`. `bookType: "trading"` (D-FX-BOOK-BOUNDARY). `settlementDate` is the forward date (T+N). |
| T0+1 | `FxSettlementInstructed` (×2 for deliverable; ×0 for NDF) | Tomas | Settlement instructions issued to correspondent — pacs.009 (D-FX-CLS-MEMBERSHIP). Skipped for NDF (no gross principal exchange). |
| T+1 .. T+(N-1) daily | `FxPositionRevalued` | Anya (EOD agent) | Daily MtM revaluation at closing mid-market rate. Emits unrealised P&L delta (IAS 21 §28 + IFRS 9 §5.7.1 FVTPL). Idempotent per (tradeId, valuationDate). |
| T+(N-2) | `NdfFixingObserved` (NDF only) | Saskia | Fixing rate observed; net cash settlement amount computed. Settles in `ndfSettlementCurrency`. |
| T+N | `PrincipalPayment` (deliver) | Tomas | Correspondent confirms ZAR/foreign-ccy delivered (deliverable only). |
| T+N | `PrincipalPayment` (receive) | Tomas | Correspondent confirms counter-currency received (deliverable only). |
| T+N | `SettlementConfirmed` | Tomas | Lifecycle closed; realised P&L crystallised. |

## 4A. Step-level event / posting-rule / IFRS annotations

The following annotates each procedural step with the canonical event type, GL posting rule, and IFRS authority. This section is the primary input to the [Trade Lifecycle System Capability Register](../finance/trade-lifecycle-system-capability-register.md).

---

### Step 1 — Pre-trade mandate check

**Event:** (control gate — no event emitted) | **Posting rule:** — | **IFRS:** IFRS 9 §3.1.1 preamble

The dealer confirms the trade is within the approved mandate (TRADING-MANDATE-V1: product scope, counterparty limits, tenor limits, book assignment). This is a pre-condition for recognition; no accounting entry is created. Gate failure blocks trade execution.

Policy ref: [`Policies/trading-mandate-v1.md`](../../Policies/trading-mandate-v1.md); Procedure ref: [`Procedures/markets/dealer-mandate-issuance.md`](dealer-mandate-issuance.md).

---

### Step 2 — Trade execution (T0)

**Event:** `FxTradeExecuted` | **Posting rule:** PR-FX-001 | **IFRS:** IFRS 9 §3.1.1 (trade-date recognition); IFRS 9 §5.1.1 (initial recognition at fair value)

The bank becomes party to the contractual provisions on the trade date (trade-date accounting election per [`Policies/accounting-policies-ifrs-v1.md`](../../Policies/accounting-policies-ifrs-v1.md) §3.1A). PR-FX-001 books:
- **Debit:** FX receivable (ACC-2100-001) at notional foreign-currency amount × trade rate
- **Credit:** FX payable (ACC-2100-003) at notional ZAR equivalent

For NDFs: the net forward fair value is initially zero at trade date (arm's-length execution); no Day-1 P&L arises if the rate is a market rate (IFRS 9 §5.1.1 + Day-1 P&L policy §3.3.4).

---

### Step 3 — Confirmation matching

**Event:** `ConfirmationMatched` (matched) or `ConfirmationMismatch` (disputed) | **Posting rule:** — (audit trail only) | **IFRS / Legal:** ISDA Master Agreement §1; no additional GL entry

Confirmation matching validates trade economics against the counterparty's confirm. A `ConfirmationMatched` event is an audit-trail marker. A `ConfirmationMismatch` event triggers the [OTC dispute resolution procedure](../markets/dealer-mandate-breach-handling.md). No GL impact until resolved.

---

### Step 4 — Daily MTM revaluation (each business day T+1 … T+(N-1))

**Event:** `FxPositionRevalued` | **Posting rule:** PR-FX-002 | **IFRS:** IAS 21 §23 (closing-rate translation); IFRS 9 §5.7.1 (FVTPL — changes in fair value through P&L)

Anya's EOD runner (`runEodFxRevaluation`) emits one `FxPositionRevalued` per open position per valuation date. PR-FX-002 books the unrealised P&L delta:
- **Gain (rate moved in bank's favour):** Debit FX receivable (ACC-2100-001) | Credit Unrealised FX P&L (ACC-2100-005)
- **Loss (rate moved against bank):** Debit Unrealised FX P&L (ACC-2100-005) | Credit FX receivable (ACC-2100-001)

Rate source during build phase: FX sim `revalRate`. Production: WM-Fix / Bloomberg BFIX Level 1 rates per §3.1C of the accounting policy.

---

### Step 5 — Settlement instruction

**Event:** `SettlementInstructionReceived` | **Posting rule:** PR-SET-001 (suspense transfer) | **IFRS:** IFRS 9 §3.2 (derecognition conditions met at T+N only, not at instruction time)

Tomas issues pacs.009 settlement instructions to the correspondent bank. The trade receivable/payable moves from open-trade status to settlement-pending status. PR-SET-001 transfers the balance to a settlement suspense account (ACC-2100-004) to flag pending settlement without completing derecognition prematurely.

---

### Step 6 — Settlement confirmation / derecognition (T+N)

**Event:** `FxSettlementConfirmed` | **Posting rule:** PR-FX-003 | **IFRS:** IFRS 9 §3.2.3 (derecognition on transfer of risks and rewards)

Settlement confirmation triggers derecognition of the FX receivable/payable. PR-FX-003 books:
- **Debit:** Nostro / cash account (ACC-1100-x) — foreign currency received
- **Credit:** FX receivable (ACC-2100-001) — derecognise buy leg
- **Debit:** FX payable (ACC-2100-003) — derecognise sell leg
- **Credit:** Nostro / cash account (ACC-1100-x) — ZAR delivered
- Any residual between cumulative unrealised P&L and the realised settlement difference is booked to Realised FX P&L (ACC-2100-006).

---

### Step 7 — Settlement failure path

**Settlement failure — no GL:**  
**Event:** `SettlementFailed` | **Posting rule:** — (no GL entry) | **IFRS:** IFRS 9 §3.2.1 (derecognition does not occur; asset/liability continues)

When settlement fails, the bank retains the FX receivable/payable on the balance sheet. The `SettlementFailed` event is an operational marker; no P&L impact.

**Settlement reversal — if incorrect derecognition occurred:**  
**Event:** `SettlementReversed` | **Posting rule:** PR-FX-REV | **IFRS:** IFRS 9 §3.2.1 (reinstate prior carrying amount)

PR-FX-REV mirrors PR-FX-003 in reverse (reinstate receivable/payable; reverse nostro entries). The reversal is recognised at the original derecognition date.

---

### Step 8 — Cancellation path

**Event:** `TradeCancelled` | **Posting rule:** PR-FX-CANCEL | **IFRS:** IFRS 9 §3.2.3 (extinguishment of contractual rights/obligations)

If the trade is cancelled before settlement:
- PR-FX-CANCEL reverses the PR-FX-001 initial booking (net-zero reversal).
- If MTM postings were made (PR-FX-002), the cumulative unrealised P&L balance is closed to Realised FX P&L.
- Any termination payment made/received is booked to Realised FX P&L.

---

### Step 9 — Amendment path

**Event:** `TradeAmended` | **Posting rule:** PR-FX-AMD (delta booking) | **IFRS:** IFRS 9 §3.2 (modification analysis)

Trade amendments (notional, rate, tenor) are assessed under IFRS 9 §3.2 modification analysis:
- **Quantitative change not substantial** — the existing trade is modified in-place; PR-FX-AMD books only the delta (difference between original and amended carrying amount).
- **Substantial modification** — the original trade is derecognised (PR-FX-CANCEL logic) and a new trade is recognised (PR-FX-001 logic) at the amended terms.

The modification assessment is performed by Bea (Finance / treasury engineer, engineering).

## 5. Daily MtM revaluation cycle

Anya's EOD runner (`platform/markets/eod/fx-revaluation.ts`) walks the event store nightly:

1. **Build the position set** — replay all `FxTradeExecuted` events (any product taxonomy; forwards are picked up alongside spots and swaps).
2. **Remove settled positions** — replay `FxSettlementConfirmed` events; remove their `tradeId` from the position set.
3. **Idempotency gate** — replay `FxPositionRevalued` events; skip any position already revalued for `valuationDate`.
4. **Revalue each open position** — look up the closing rate; compute unrealised P&L delta since prior revaluation (or since book rate on first revaluation); emit `FxPositionRevalued` with `unrealisedPnlZarMinor`, `bookRate`, `revalRate`, `rateSource`, `revaluedAt`.

Because the runner walks **all** `FxTradeExecuted` regardless of `productTaxonomy`, forwards inherit the spot revaluation cycle for free. The same idempotency, citation, and recon guarantees apply. **NDF positions also enter the EOD cycle** until the fixing is observed; at that point the trade should be considered settled and excluded — substrate gap: the NDF case currently relies on `FxSettlementConfirmed` to close the position; a follow-on PR should teach the runner to treat `NdfFixingObserved` as a terminal-revaluation event.

## 6. IFRS 9 classification

| Leg kind | IFRS ref | Debit | Credit |
|---|---|---|---|
| `fx-receivable` (booking) | IFRS 9 §4.1.4 | Receivable[ccy] | Payable[ccy] |
| `fx-payable` (booking) | IFRS 9 §4.1.4 | Receivable[ccy] | Payable[ccy] |
| `fx-revaluation` gain | IAS 21 §23 | Receivable[ZAR] | Unrealised P&L |
| `fx-revaluation` loss | IAS 21 §23 | Unrealised P&L | Receivable[ZAR] |
| `fx-settlement-receive` | IFRS 9 §3.2.3 | Nostro[ccy] | Receivable[ccy] |
| `fx-settlement-deliver` | IFRS 9 §3.2.3 | Payable[ccy] | Nostro[ccy] |

All forwards in this PR are FVTPL (trading book). FVOCI / hedge-accounting designation is out of scope until D-FX-HEDGE-DESIGNATION lands.

## 7. Reconciliation gates

- `recon:runtime-handler-sync` — every handler the procedure cites is registered.
- `recon:event-type-registry-coverage` — `NdfFixingObserved` registered with retention + subscribers.
- `recon:provenance-tag-coverage` — scenario 07 events all carry the simulated provenance tag.
- `citation-gate` — every emitted event carries at least one citation (Principle 2).

## 8. Substrate gaps surfaced

| Gap | Owner | Resolves under |
|---|---|---|
| Hedge-accounting designation event family + classifier branch | Bea + Camille | D-FX-HEDGE-DESIGNATION |
| Forward-curve substrate (residual-tenor pricing) | Rohan | M5 risk substrate |
| NDF cash-leg posting rule | Bea | follow-on PR (posting-rules/fx-ndf.ts) |
| EOD runner should treat `NdfFixingObserved` as terminal for the position | Anya | follow-on PR |

## 9. Change log

- 2026-05-17 — v0.1 POPULATED. Initial draft mirroring the FX spot lifecycle procedure with forward-specific extensions (MtM cycle + NDF fixing path). Author: Saskia (Markets franchise lead, engineering).
- 2026-05-18 — v0.2 ANNOTATED. Added §4A (step-level event / posting-rule / IFRS annotations for all 9 steps: pre-trade mandate check, trade execution, confirmation matching, daily MTM, settlement instruction, settlement confirmation/derecognition, settlement failure/reversal, cancellation, amendment). Cross-referenced trade-lifecycle-system-capability-register. Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN. Author: Owen (Company Secretary, governance).
