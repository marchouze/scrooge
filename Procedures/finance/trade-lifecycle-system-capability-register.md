---
title: Trade Lifecycle System Capability Register
authority: D-TRADE-LIFECYCLE-IFRS-CHAIN
approved: 2026-05-18
owner: Bea (Chief Financial Officer, finance); Owen (Company Secretary, governance)
status: ACTIVE
version: "1.0"
date: 2026-05-18
author: Owen (Company Secretary, governance)
citations:
  - D-TRADE-LIFECYCLE-IFRS-CHAIN
  - accounting-policies-ifrs-v1
  - pricing-policy-v1
  - "IFRS 9: Financial Instruments"
  - "IFRS 13: Fair Value Measurement"
  - "IAS 21: The Effects of Changes in Foreign Exchange Rates"
  - "ISDA Master Agreement"
---

# Trade Lifecycle System Capability Register

> **Authority:** D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)  
> **Owner:** Bea (Chief Financial Officer, finance) — accounting entries | Owen (Company Secretary, governance) — policy citations  
> **Recon gate:** `recon:trade-lifecycle-coverage` (Vera Wave-5, planned)  
> **Status:** ACTIVE | v1.0 | 2026-05-18

This register is the single authoritative mapping of the trade lifecycle across all instrument types. It ties each lifecycle stage to its policy authority, procedure reference, event type, GL posting rule, GL accounts, IFRS authority, and instrument scope.

**Instrument abbreviations used in this register:**

- FX: FX spot, FX forwards, FX swaps, FX NDFs (all carried by `FxTradeExecuted` with `productTaxonomy` discriminator)
- Bonds-T: JSE bonds, trading book (FVTPL)
- Bonds-AC: JSE bonds, banking book (amortised cost)
- Eq-FVTPL: JSE equities, FVTPL election
- Eq-FVOCI: JSE equities, FVOCI irrevocable election
- IRD: OTC interest rate derivatives (swaps)

**Stub rows** (marked `[stub — Slice 4]`) are placeholders for instrument types whose procedures are not yet POPULATED. The posting rules and GL account codes are specified; the procedure drafting is roadmap item Slice 4 of D-TRADE-LIFECYCLE-IFRS-CHAIN.

---

## Stage mapping

| Stage | Policy ref | Procedure ref | Event type | Posting rule | GL accounts | IFRS authority | Instruments |
|-------|-----------|---------------|------------|-------------|-------------|----------------|-------------|
| Pre-trade mandate check | [`pricing-policy-v1`](../../Policies/pricing-policy-v1.md) §3; [`trading-mandate-v1`](../../Policies/trading-mandate-v1.md) | [`dealer-mandate-issuance`](../markets/dealer-mandate-issuance.md) | (control gate — no event) | — | — | IFRS 9 §3.1.1 preamble | All |
| Trade execution — FX | [`accounting-policies-ifrs-v1`](../../Policies/accounting-policies-ifrs-v1.md) §3.1A (trade-date) | [`fx-forwards-trade-lifecycle`](../markets/fx-forwards-trade-lifecycle.md) §4A Step 2 | `FxTradeExecuted` | PR-FX-001 | ACC-2100-001 (FX receivable), ACC-2100-003 (FX payable) | IFRS 9 §3.1.1; IFRS 9 §5.1.1 | FX spot/fwd/swap/NDF |
| Trade execution — bonds | [`accounting-policies-ifrs-v1`](../../Policies/accounting-policies-ifrs-v1.md) §3.1A (trade-date) | [stub — Slice 4] | `BondTradeExecuted` | PR-BOND-001 (FVTPL); PR-BOND-001T (amortised cost) | ACC-3100 (bonds FVTPL), ACC-3101 (bonds FVOCI/AC) | IFRS 9 §3.1.1; IFRS 9 §5.1.1 | Bonds-T; Bonds-AC |
| Trade execution — equities | [`accounting-policies-ifrs-v1`](../../Policies/accounting-policies-ifrs-v1.md) §3.1A (trade-date) | [stub — Slice 4] | `EquityTradeExecuted` | PR-EQ-001 (FVTPL); PR-EQ-001F (FVOCI) | ACC-3200 (equities FVTPL), ACC-3201 (equities FVOCI) | IFRS 9 §3.1.1; IFRS 9 §5.1.1 | Eq-FVTPL; Eq-FVOCI |
| Trade execution — OTC IRD | [`accounting-policies-ifrs-v1`](../../Policies/accounting-policies-ifrs-v1.md) §3.1A (trade-date) | [stub — Slice 4] | `IrdSwapTradeExecuted` | PR-IRD-001 | ACC-3300 (IRD asset), ACC-3301 (IRD liability) | IFRS 9 §3.1.1; IFRS 9 §5.1.1 | IRD |
| Confirmation matching | [`Policies/trade-reporting-policy-v1`](../../Policies/trade-reporting-policy-v1.md) | [`fx-forwards-trade-lifecycle`](../markets/fx-forwards-trade-lifecycle.md) §4A Step 3 | `ConfirmationMatched` | — (audit trail only) | — | ISDA Master Agreement §1 | FX; IRD |
| Confirmation mismatch / dispute | [`Policies/trade-reporting-policy-v1`](../../Policies/trade-reporting-policy-v1.md) | [`dealer-mandate-breach-handling`](../markets/dealer-mandate-breach-handling.md) | `ConfirmationMismatch` | — | — | ISDA Master Agreement §14 | FX; IRD |
| Daily MTM — FX FVTPL | [`pricing-policy-v1`](../../Policies/pricing-policy-v1.md) §3.3A; [`accounting-policies-ifrs-v1`](../../Policies/accounting-policies-ifrs-v1.md) §3.1C | [`fx-period-close-runbook`](fx-period-close-runbook.md) (automated chain); [`fx-forwards-trade-lifecycle`](../markets/fx-forwards-trade-lifecycle.md) §4A Step 4 | `FxPositionRevalued` | PR-FX-002 | ACC-2100-001 (FX receivable), ACC-2100-005 (unrealised FX P&L) | IAS 21 §23; IFRS 9 §5.7.1 | FX spot/fwd/swap/NDF |
| Daily MTM — bonds FVTPL | [`pricing-policy-v1`](../../Policies/pricing-policy-v1.md) §3.3A | [stub — Slice 4] | `BondPositionRevalued` | PR-BOND-002 | ACC-3101 (bonds FVTPL MTM), ACC-3105 (unrealised bond P&L) | IFRS 9 §5.7.1 | Bonds-T |
| Daily EIR accrual — bonds amortised cost | [`pricing-policy-v1`](../../Policies/pricing-policy-v1.md) §3.3A; [`accounting-policies-ifrs-v1`](../../Policies/accounting-policies-ifrs-v1.md) §3.1.2 | [stub — Slice 4] | `BondInterestAccrued` | PR-BOND-EIR | ACC-3102 (bonds AC carrying amount), ACC-4101 (interest income) | IFRS 9 §5.4.1 | Bonds-AC |
| Daily MTM — equities FVTPL | [`pricing-policy-v1`](../../Policies/pricing-policy-v1.md) §3.3A | [stub — Slice 4] | `EquityPositionRevalued` | PR-EQ-002 | ACC-3200 (equities FVTPL), ACC-3205 (unrealised equity P&L FVTPL) | IFRS 9 §5.7.1 | Eq-FVTPL |
| Daily MTM — equities FVOCI | [`pricing-policy-v1`](../../Policies/pricing-policy-v1.md) §3.3A; [`accounting-policies-ifrs-v1`](../../Policies/accounting-policies-ifrs-v1.md) §3.1.3 | [stub — Slice 4] | `EquityPositionRevalued` | PR-EQ-002F | ACC-3201 (equities FVOCI), ACC-3206 (OCI reserve — equity FVOCI) | IFRS 9 §5.7.5 | Eq-FVOCI |
| Daily MTM — OTC IRD FVTPL | [`pricing-policy-v1`](../../Policies/pricing-policy-v1.md) §3.3A | [stub — Slice 4] | `IrdSwapPositionRevalued` | PR-IRD-002 | ACC-3300/ACC-3301 (IRD asset/liability), ACC-3305 (unrealised IRD P&L) | IFRS 9 §5.7.1 | IRD |
| Settlement instruction | [`Policies/fx-settlement-reconciliation`](fx-settlement-reconciliation.md) | [`fx-forwards-trade-lifecycle`](../markets/fx-forwards-trade-lifecycle.md) §4A Step 5; [`fx-settlement-reconciliation`](fx-settlement-reconciliation.md) | `SettlementInstructionReceived` | PR-SET-001 | ACC-2100-004 (settlement suspense), ACC-2100-001/003 | IFRS 9 §3.2 | FX |
| Settlement confirmation / derecognition — FX | [`accounting-policies-ifrs-v1`](../../Policies/accounting-policies-ifrs-v1.md) §3.1B (derecognition) | [`fx-forwards-trade-lifecycle`](../markets/fx-forwards-trade-lifecycle.md) §4A Step 6 | `FxSettlementConfirmed` | PR-FX-003 | ACC-2100-001/003 (derecognise), ACC-1100-x (nostro), ACC-2100-006 (realised FX P&L) | IFRS 9 §3.2.3 | FX spot/fwd |
| Bond maturity / derecognition | [`accounting-policies-ifrs-v1`](../../Policies/accounting-policies-ifrs-v1.md) §3.1B (derecognition) | [stub — Slice 4] | `BondMatured` | PR-BOND-MAT | ACC-3100/3101 (derecognise bond), ACC-1100-x (cash) | IFRS 9 §3.2.3 | Bonds-T; Bonds-AC |
| Bond sale / derecognition | [`accounting-policies-ifrs-v1`](../../Policies/accounting-policies-ifrs-v1.md) §3.1B (derecognition) | [stub — Slice 4] | `BondSold` | PR-BOND-SALE | ACC-3100/3101 (derecognise bond), ACC-1100-x (cash), P&L | IFRS 9 §3.2.3 | Bonds-T; Bonds-AC |
| Equity sale — FVTPL | [`accounting-policies-ifrs-v1`](../../Policies/accounting-policies-ifrs-v1.md) §3.1B (derecognition) | [stub — Slice 4] | `EquitySold` | PR-EQ-SALE | ACC-3200 (derecognise), ACC-1100-x (cash), ACC-3205 (close unrealised P&L → realised) | IFRS 9 §3.2.3 | Eq-FVTPL |
| Equity sale — FVOCI (irrevocable) | [`accounting-policies-ifrs-v1`](../../Policies/accounting-policies-ifrs-v1.md) §3.1B; §3.1.3 (no recycling) | [stub — Slice 4] | `EquitySold` | PR-EQ-SALE-F | ACC-3201 (derecognise), ACC-1100-x (cash), ACC-3206 → retained earnings (OCI balance transferred, not recycled to P&L) | IFRS 9 §5.7.5 (no P&L recycling on sale) | Eq-FVOCI |
| IRD swap coupon settlement | [`accounting-policies-ifrs-v1`](../../Policies/accounting-policies-ifrs-v1.md) §3.1B | [stub — Slice 4] | `IrdSwapCouponSettled` | PR-IRD-COUP | ACC-3300/3301 (coupon leg), ACC-1100-x (cash) | IFRS 9 §5.4 | IRD |
| IRD swap termination / derecognition | [`accounting-policies-ifrs-v1`](../../Policies/accounting-policies-ifrs-v1.md) §3.1B (derecognition) | [stub — Slice 4] | `IrdSwapTerminated` | PR-IRD-TERM | ACC-3300/3301 (derecognise), ACC-1100-x (cash) | IFRS 9 §3.2.3 | IRD |
| Settlement failure | [`Procedures/finance/fx-settlement-reconciliation`](fx-settlement-reconciliation.md) | [`fx-forwards-trade-lifecycle`](../markets/fx-forwards-trade-lifecycle.md) §4A Step 7; [`fx-settlement-reconciliation`](fx-settlement-reconciliation.md) | `SettlementFailed` | — (no GL; asset/liability continues) | — | IFRS 9 §3.2.1 | FX |
| Settlement reversal | [`accounting-policies-ifrs-v1`](../../Policies/accounting-policies-ifrs-v1.md) §3.1B (derecognition reversal) | [`fx-settlement-reconciliation`](fx-settlement-reconciliation.md) | `SettlementReversed` | PR-FX-REV | (mirror of PR-FX-003 in reverse — reinstate receivable/payable) | IFRS 9 §3.2.1 | FX |
| Trade cancellation — FX | [`accounting-policies-ifrs-v1`](../../Policies/accounting-policies-ifrs-v1.md) §3.1B | [`fx-forwards-trade-lifecycle`](../markets/fx-forwards-trade-lifecycle.md) §4A Step 8 | `TradeCancelled` | PR-FX-CANCEL | (net-zero reversal of PR-FX-001; close PR-FX-002 cumulative MTM to realised P&L) | IFRS 9 §3.2.3 | FX |
| Trade amendment — FX | [`accounting-policies-ifrs-v1`](../../Policies/accounting-policies-ifrs-v1.md) §3.1B | [`fx-forwards-trade-lifecycle`](../markets/fx-forwards-trade-lifecycle.md) §4A Step 9 | `TradeAmended` | PR-FX-AMD | (delta booking — difference between original and amended carrying amount) | IFRS 9 §3.2 | FX |
| ECL staging | [`ifrs9-ecl-provisioning-policy-v1`](../../Policies/ifrs9-ecl-provisioning-policy-v1.md) | [`Procedures/finance/ecl-staging-cycle`](ecl-staging-cycle.md) [stub] | `EclStageChanged` | PR-ECL-001 | ACC-ECL (expected credit loss provision) | IFRS 9 §5.5 | Bonds-AC; counterparty |

---

## Posting-rule index

The following posting rules are referenced in the stage mapping above. Rules marked `[PLANNED]` have their debit/credit mechanics specified but the TypeScript implementation is a Slice 4 / Slice 5 roadmap item.

| Posting rule | Description | Status |
|---|---|---|
| PR-FX-001 | FX trade booking — initial recognition (debit receivable, credit payable at trade rate) | Live (Slice 2 / PR #550) |
| PR-FX-002 | FX daily MTM revaluation — unrealised P&L delta (FVTPL; IAS 21 §23) | Live (Slice 2 / PR #550) |
| PR-FX-003 | FX settlement / derecognition — close receivable/payable; book nostro; crystallise realised P&L | Live (Slice 2 / PR #550) |
| PR-FX-REV | FX settlement reversal — reinstate prior carrying amount (mirror of PR-FX-003) | PLANNED — Slice 5 |
| PR-FX-CANCEL | FX trade cancellation — net-zero reversal of PR-FX-001; close MTM to realised P&L | PLANNED — Slice 5 |
| PR-FX-AMD | FX trade amendment — delta booking (non-substantial modification) | PLANNED — Slice 5 |
| PR-SET-001 | Settlement instruction — transfer to suspense account (pre-derecognition) | PLANNED — Slice 5 |
| PR-BOND-001 | Bond trade booking — FVTPL initial recognition | PLANNED — Slice 4 |
| PR-BOND-001T | Bond trade booking — amortised cost initial recognition | PLANNED — Slice 4 |
| PR-BOND-002 | Bond daily MTM — FVTPL fair value change | PLANNED — Slice 4 |
| PR-BOND-EIR | Bond EIR accrual — amortised cost interest income | PLANNED — Slice 4 |
| PR-BOND-MAT | Bond maturity / derecognition | PLANNED — Slice 4 |
| PR-BOND-SALE | Bond sale / derecognition | PLANNED — Slice 4 |
| PR-EQ-001 | Equity trade booking — FVTPL initial recognition | PLANNED — Slice 4 |
| PR-EQ-001F | Equity trade booking — FVOCI initial recognition (irrevocable election) | PLANNED — Slice 4 |
| PR-EQ-002 | Equity daily MTM — FVTPL fair value change through P&L | PLANNED — Slice 4 |
| PR-EQ-002F | Equity daily MTM — FVOCI fair value change through OCI | PLANNED — Slice 4 |
| PR-EQ-SALE | Equity sale — FVTPL derecognition; realise P&L | PLANNED — Slice 4 |
| PR-EQ-SALE-F | Equity sale — FVOCI derecognition; OCI to retained earnings (no recycling) | PLANNED — Slice 4 |
| PR-IRD-001 | IRD swap booking — FVTPL initial recognition (zero fair value at inception) | PLANNED — Slice 4 |
| PR-IRD-002 | IRD swap daily MTM — NPV change through P&L | PLANNED — Slice 4 |
| PR-IRD-COUP | IRD swap coupon settlement | PLANNED — Slice 4 |
| PR-IRD-TERM | IRD swap termination / derecognition | PLANNED — Slice 4 |
| PR-ECL-001 | ECL provision — stage change booking | PLANNED — Slice 4 |

---

## GL account cross-reference

The following GL accounts are referenced in the stage mapping. The canonical chart of accounts is maintained by Bea (Chief Financial Officer, finance) in the GL substrate.

| Account code | Description | Classification |
|---|---|---|
| ACC-1100-x | Nostro / cash accounts (per currency) | Balance sheet — asset |
| ACC-2100-001 | FX receivable | Balance sheet — asset |
| ACC-2100-003 | FX payable | Balance sheet — liability |
| ACC-2100-004 | FX settlement suspense | Balance sheet — current |
| ACC-2100-005 | Unrealised FX P&L (MTM) | P&L — trading income |
| ACC-2100-006 | Realised FX P&L | P&L — trading income |
| ACC-3100 | Bonds — FVTPL | Balance sheet — asset |
| ACC-3101 | Bonds — FVOCI / amortised cost | Balance sheet — asset |
| ACC-3102 | Bonds — amortised cost carrying amount | Balance sheet — asset |
| ACC-3105 | Unrealised bond P&L (MTM) | P&L — trading income |
| ACC-3200 | Equities — FVTPL | Balance sheet — asset |
| ACC-3201 | Equities — FVOCI | Balance sheet — asset |
| ACC-3205 | Unrealised equity P&L (MTM — FVTPL) | P&L — trading income |
| ACC-3206 | OCI reserve — equity FVOCI | Equity — OCI |
| ACC-3300 | OTC IRD — asset | Balance sheet — asset |
| ACC-3301 | OTC IRD — liability | Balance sheet — liability |
| ACC-3305 | Unrealised IRD P&L (MTM) | P&L — trading income |
| ACC-4101 | Interest income — bonds (amortised cost EIR) | P&L — interest income |
| ACC-ECL | Expected credit loss provision | Balance sheet — contra-asset |

---

## Substrate gaps

| Gap | Owner | Roadmap item |
|---|---|---|
| Slice 4 procedure stubs: bond / equity / IRD trade lifecycle procedures | Bea (CFO, finance); Saskia (Head of Global Markets, governance) | D-TRADE-LIFECYCLE-IFRS-CHAIN Slice 4 |
| PR-FX-REV, PR-FX-CANCEL, PR-FX-AMD, PR-SET-001 posting rule implementations | Bea (CFO, finance) | D-TRADE-LIFECYCLE-IFRS-CHAIN Slice 5 |
| Forward-curve substrate for Level 2 MTM (currently using spot rate as proxy) | Rohan (Market risk engineer) | M5 risk substrate |
| `recon:trade-lifecycle-coverage` Vera recon pipeline | Vera (Internal audit / continuous-assurance engineer, engineering) | Vera Wave-5 |
| ECL staging cycle procedure (`ecl-staging-cycle.md`) | Bea (CFO, finance) | Slice 4 |

---

## Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v1.0 | 2026-05-18 | Owen (Company Secretary, governance) | Initial register — 26 lifecycle stages across FX/bonds/equities/IRD; 22 posting rules indexed; GL account cross-reference; substrate gaps captured. Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN. |
