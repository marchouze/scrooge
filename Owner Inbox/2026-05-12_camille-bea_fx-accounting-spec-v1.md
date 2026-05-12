---
title: "FX Spot — Accounting Specification v1"
authors:
  - "Camille (CFO, finance)"
  - "Bea (Accounting & financial reporting engineer, engineering)"
date: "2026-05-12"
status: "approved"
decision-required: false
authority:
  - "D-MARKETS-SCHEMA-FOUNDATION"
  - "D-MARKETS-CAPITAL-TIME-SHAPE"
version: "v1.0"
---

# FX Spot — Accounting Specification v1

**Authors:** Camille (CFO, finance) · Bea (Accounting & financial reporting engineer, engineering)  
**Date:** 2026-05-12  
**Status:** Approved — implementation complete  
**Authority:** D-MARKETS-SCHEMA-FOUNDATION (CEO-approved) · D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)

---

## Authority Chain

Per Principle 2 (single-graph discipline), every accounting treatment traces upward:

```
Regulation / Bank Objective
  └── Banks Act 94 of 1990 §70 (capital adequacy)
  └── Regulations Relating to Banks Reg 28(5) (FX standardised approach)
  └── IFRS 9 — Financial Instruments (classification & measurement)
  └── IAS 21 — The Effects of Changes in Foreign Exchange Rates
  └── IFRS 13 — Fair Value Measurement
      ↓
  Policy
  └── Accounting Policies (IFRS) v0.1 (stub: Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md)
  └── Trading Book Policy (Pricing: mid-market; spread: P&L immediately)
      ↓
  Procedure
  └── Posting-rule register (_posting-rules.md) — PR-FX-001, PR-FX-002, PR-FX-003
  └── Daily revaluation cadence (Bea spec §6)
      ↓
  System Capability
  └── prototype/platform/accounting/posting-rules/fx-spot.ts
  └── prototype/platform/accounting/fx-calculators.ts
  └── prototype/platform/event-store/event-types/fx-accounting.ts
```

---

## Section A — IFRS 9 Classification

### A.1 Classification Rationale

**FX Spot traded by the dealing desk: FVTPL — mandatorily, trading book.**

The SPPI test (whether contractual cash flows are "solely payments of principal and interest") does not apply to FX instruments. Per IFRS 9 §4.1.1, the SPPI test is confined to debt instruments; FX spot is a derivative/foreign-currency-denominated financial instrument whose cash flows are exchange of principal in two currencies, not interest. Therefore:

- IFRS 9 §4.1.1 SPPI gate: **not applicable** (FX instruments are not debt instruments)
- IFRS 9 §4.1.5 mandatory FVTPL: applies because the instrument does not qualify for amortised cost (SPPI test fails/not applicable) and does not qualify for FVOCI (no irrevocable election made; trading book)
- IFRS 9 §4.2.2 trading book designation: instrument held-for-trading (dealing desk, short-term P&L intent)

**Classification: FVTPL (mandatory, trading book).**

Changes in fair value flow through profit or loss immediately (IFRS 9 §5.7.1). No OCI.

### A.2 Recognition — Trade Date Accounting

The bank applies **trade-date accounting** per IFRS 9 §B3.1.3 (trade date = date on which the entity commits to purchase or sell an asset). At trade date, the bank recognises:

- A financial asset (FX Trading Receivable) for the currency to be received
- A financial liability (FX Trading Payable) for the currency to be delivered

Settlement date T+2 is when the physical exchange occurs; the asset/liability are derecognised at settlement.

### A.3 Initial Measurement

Per IFRS 9 §5.1.1: financial instruments are initially measured at **fair value**. For an FX Spot deal struck at mid-market:

- Fair value at inception = 0 (arm's-length dealing at mid-market rate)
- Trade receivable = counterNotional (currency received) × mid-market rate
- Trade payable = notional (currency delivered)
- Bid/offer spread captured as Realised FX P&L (ACC-2100-006) at trade booking or at settlement (bank choice; this spec defers to settlement for spot)

### A.4 Subsequent Measurement

Per IFRS 9 §5.7.1: FVTPL instruments re-measured at fair value at each reporting date. Changes recognised immediately in profit or loss.

**Rate source:** daily closing mid-market fix (Reuters WM 4pm London / Bloomberg BFIX). Stub rate used in build-phase (`rateSource: "stub"`); production integration deferred to Bea substrate gap §7.

### A.5 FX Forward — Differences from Spot

For reference only (out of scope here):

| Aspect | FX Spot | FX Forward |
|---|---|---|
| Settlement date | T+2 | T+N (typically 1m, 3m, 6m) |
| Initial fair value | ~0 at mid | Non-zero (includes forward points) |
| IFRS 9 classification | FVTPL | FVTPL (same — dealing desk) |
| Carrying amount | Spot rate | Forward rate interpolated from yield curves |
| Day 1 P&L | Spread only | Forward points ± credit valuation adjustment |

---

## Section B — Chart of Accounts (FX)

All accounts follow the YAML format defined in `_chart-of-accounts.md` and validate against `chart-of-accounts.schema.json`.

### Accounts Added

| ID | Name | Category | IFRS | BA Return |
|---|---|---|---|---|
| ACC-2100-001 | FX Trading Receivable — ZAR | asset-trading | FVTPL | BA 300 Item 3 |
| ACC-2100-002 | FX Trading Receivable — USD | asset-trading | FVTPL | BA 300 Item 3 |
| ACC-2100-003 | FX Trading Payable — ZAR | liability-trading | FVTPL | BA 300 Item 18 |
| ACC-2100-004 | FX Trading Payable — USD | liability-trading | FVTPL | BA 300 Item 18 |
| ACC-2100-005 | Unrealised FX P&L — FVTPL | income-trading | FVTPL | BA 300 / Income statement |
| ACC-2100-006 | Realised FX P&L | income-trading | FVTPL | Income statement |
| ACC-1100-002 | Nostro — USD (correspondent) | asset-cash-equivalents | amortised-cost | BA 300 Item 1 / BA 325 HQLA |
| ACC-1100-003 | Nostro — EUR (correspondent) | asset-cash-equivalents | amortised-cost | BA 300 Item 1 |
| ACC-1100-004 | FX Settlement Suspense — ZAR | asset-suspense | amortised-cost | BA 300 |
| ACC-1100-005 | FX Settlement Suspense — USD | asset-suspense | amortised-cost | BA 300 |

Full YAML definitions are appended to `_chart-of-accounts.md`.

---

## Section C — Trade Lifecycle Events and Posting Rules

### (i) Trade Booking — `FxTradeExecuted`

Posting rule **PR-FX-001** (`fxTradeBookingJournals`):

```
For each near leg (FX Spot = single near leg):

  // Pay currency sub-entry:
  Dr  payableAccountFor(payCurrency)     [notional.amountMinor]  payCurrency
  Cr  receivableAccountFor(payCurrency)  [notional.amountMinor]  payCurrency

  // Receive currency sub-entry:
  Dr  receivableAccountFor(receiveCcy)   [counterNotional.amountMinor]  receiveCcy
  Cr  payableAccountFor(receiveCcy)      [counterNotional.amountMinor]  receiveCcy
```

Each sub-entry balances in its own currency. Net P&L at inception = 0 (arm's-length mid-market).

**For the canonical ZAR/USD buy-USD example** (bank pays ZAR 19m, receives USD 1m):
```
Dr  ACC-2100-003  FX Trading Payable — ZAR    ZAR 19,000,000   (derecognise future ZAR payment)
Cr  ACC-2100-001  FX Trading Receivable — ZAR ZAR 19,000,000
Dr  ACC-2100-002  FX Trading Receivable — USD USD 1,000,000    (recognise future USD receipt)
Cr  ACC-2100-004  FX Trading Payable — USD    USD 1,000,000
```

### (ii) Daily Revaluation — `FxPositionRevalued`

Posting rule **PR-FX-002** (`fxRevaluationJournals`):

New event type defined in this slice: `FxPositionRevalued`. Emitted daily by Bea's close engine for each open position.

```
If unrealisedPnlZarMinor > 0 (gain):
  Dr  ACC-2100-001  FX Trading Receivable — ZAR  [|Δ|]  ZAR
  Cr  ACC-2100-005  Unrealised FX P&L — FVTPL    [|Δ|]  ZAR

If unrealisedPnlZarMinor < 0 (loss):
  Dr  ACC-2100-005  Unrealised FX P&L — FVTPL    [|Δ|]  ZAR
  Cr  ACC-2100-001  FX Trading Receivable — ZAR  [|Δ|]  ZAR

If unrealisedPnlZarMinor = 0: no posting.
```

All revaluation entries in ZAR (functional currency). FVTPL → income statement (not OCI).

**No OCI:** Per IFRS 9 §5.7.1, trading book FVTPL changes are always P&L. The optional FVOCI election (§4.1.2A) applies only to equity instruments not held-for-trading, not to FX positions.

### (iii) Settlement — T+2 `FxSettlementConfirmed`

Posting rule **PR-FX-003** (`fxSettlementJournals`):

New event type defined in this slice: `FxSettlementConfirmed`. Emitted when the correspondent bank confirms cash exchange.

```
(i) Base currency leg (e.g. bank paid ZAR → nostro ZAR decreases):
  Dr  payableAccountFor(baseCcy)   [|settledBaseCurrencyMinor|]  baseCcy
  Cr  nostroAccountFor(baseCcy)    [|settledBaseCurrencyMinor|]  baseCcy
  — or if bank received base:
  Dr  nostroAccountFor(baseCcy)    [|settledBaseCurrencyMinor|]  baseCcy
  Cr  receivableAccountFor(baseCcy)[|settledBaseCurrencyMinor|]  baseCcy

(ii) Quote currency leg (e.g. bank received USD → nostro USD increases):
  Dr  nostroAccountFor(quoteCcy)   [|settledQuoteCurrencyMinor|]  quoteCcy
  Cr  payableAccountFor(quoteCcy)  [|settledQuoteCurrencyMinor|]  quoteCcy
  — or reverse if bank paid

(iii) Realised P&L (if any residual between carrying amount and cash):
  If realisedPnlZarMinor > 0:
    Dr  ACC-1100-001  Nostro ZAR         [realisedPnlZarMinor]  ZAR
    Cr  ACC-2100-006  Realised FX P&L    [realisedPnlZarMinor]  ZAR
  If realisedPnlZarMinor < 0:
    Dr  ACC-2100-006  Realised FX P&L    [|realisedPnlZarMinor|]  ZAR
    Cr  ACC-1100-001  Nostro ZAR         [|realisedPnlZarMinor|]  ZAR
```

### (iv) Revaluation Reversal on Settlement

**No separate reversal entry required.** The settlement entries derecognise the FVTPL asset/liability at their current carrying amount, which already reflects all prior revaluations. Any residual (intraday rate movement after the last fix) is the `realisedPnlZarMinor` in the settlement event.

---

## Section D — Calculators

Four pure-function calculators are implemented in `prototype/platform/accounting/fx-calculators.ts`.

### D.1 FX Position Calculator (`fxPositionCalculator`)

**Purpose:** Net long/short per currency pair from open (unsettled) FX trade events.

**Input:**
- `trades`: array of `FxTradeExecutedPayload` with tradeId
- `settledTradeIds`: set of trade IDs with confirmed settlement
- `zarRates`: map from currency → ZAR rate for conversion
- `asOf`: snapshot timestamp

**Output:** `FxPositionResult[]` — per-pair net position in base and ZAR minor units.

### D.2 Unrealised P&L Calculator (`unrealisedPnlCalculator`)

**Purpose:** Mark-to-market unrealised P&L for each open position.

**Calculation:** `(currentRate - bookRate) × notional × direction`

**Input:** open trades + latest `FxPositionRevalued` revaluation events (or fallback rate map).

**Output:** `UnrealisedPnlResult[]` — per-trade unrealised P&L in ZAR minor units.

### D.3 Realised P&L Calculator (`realisedPnlCalculator`)

**Purpose:** Settled P&L from `FxSettlementConfirmed` events.

**Calculation:** Reads `realisedPnlZarMinor` field directly from the settlement event. This field is pre-computed at settlement time as `(settledCashZarEquivalent - carryingAmountAtLastRevaluation)`.

**Output:** `RealisedPnlResult[]` — per-trade realised P&L and settlement timestamp.

### D.4 FX RWA Calculator (`fxRwaCalculator`)

**Purpose:** Standardised-approach FX RWA and capital charge.

**Regulation:** Regulations Relating to Banks Reg 28(5) + BCBS D352 §718(xiii).

**Calculation:**
```
FX capital charge = 8% × max(Σ net longs, Σ net shorts)  [all in ZAR]
FX RWA = 12.5 × capital charge
```

Functional currency (ZAR) excluded from the FX charge.

**Output:** `FxRwaSummary` — per-currency breakdown + totals.

---

## Section E — BA Return Mappings

### BA 325 (Daily SARB — Market Risk / LCR)

- **FX open positions:** Feed the FX delta section via `fxPositionsToBa350Input()` adapter.
- **Nostro balances (ACC-1100-002, ACC-1100-003):** Feed HQLA classification:
  - ZAR at SARB (ACC-1100-001): Level 1 HQLA (central-bank reserves)
  - Foreign-currency nostros: Highly Liquid Assets — Level 1 foreign currency per BA 325 treatment (Basel III LCR)
- Adapter: `prototype/platform/reporting/ba-350-fx-adapter.ts → fxPositionsToBa350Input()`

### BA 700 (Capital Adequacy)

- **FX RWA:** `fxRwaCalculator` output feeds the market-risk capital charge section.
- Total FX capital charge → `Ba700GeneratorInput.rwaDecomposition.marketRiskMinor`
- Reference: `prototype/platform/reporting/ba-700-capital.ts`
- Standardised approach capital factor: 8% per Reg 28(5) / BCBS D352

### BA 350 (Market Risk Detail)

- **FX open positions:** `fxPositionsToBa350Input()` → `Ba350GeneratorInput.fxPositions`
- Capital computation within `generateBa350MarketRisk()` uses `8% × max(Σlongs, Σshorts)`
- Per-currency lines in `Ba350FxSection.currencyLines`
- Reference: `prototype/platform/reporting/ba-350-market-risk.ts`

### IFRS Income Statement

- **ACC-2100-005** (Unrealised FX P&L — FVTPL) → Net trading income line
- **ACC-2100-006** (Realised FX P&L) → Net trading income line
- Combined: "Net FX trading income" sub-line within "Net trading income" (IAS 1 §85)
- IFRS account class: `income`; cash-flow class: `operating` (indirect method)

### IFRS Balance Sheet

- **ACC-2100-001, ACC-2100-002** (FX Trading Receivables) → Trading assets (IAS 1 §54)
- **ACC-2100-003, ACC-2100-004** (FX Trading Payables) → Trading liabilities (IAS 1 §54)
- **ACC-1100-002, ACC-1100-003** (Nostro USD, EUR) → Cash and cash equivalents (IAS 7 §7) or Highly liquid assets depending on tenor and restrictions
- IFRS account class: `asset` / `liability` per account

---

## Substrate Gaps (Forward-Linked)

| Gap | Description | Owner | Target |
|---|---|---|---|
| G-FX-ACC-001 | Rate-feed integration (rateSource: "stub" → live Reuters/Bloomberg) | Bea | Post-licence-day |
| G-FX-ACC-002 | Multi-currency receivable accounts beyond ZAR/USD/EUR | Bea + Atlas | M5 |
| G-FX-ACC-003 | `ChartAccountPublished` events for the 10 new accounts | Bea | M5 |
| G-FX-ACC-004 | `PostingRulePublished` events for PR-FX-001/002/003 | Bea | M5 |
| G-FX-ACC-005 | BA 325 HQLA nostro-balance integration (nostro balance from BankAccountOpened events) | Tomas + Bea | M5 |
| G-FX-ACC-006 | FX forward: forward-point P&L + day-1 fair value calculation | Camille + Bea | M5 |
