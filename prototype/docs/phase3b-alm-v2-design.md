# Phase 3b — ALM / liquidity on V2 (money-market FIL + GL + BA-300)

**Authority:** D-V1-REMOVAL-PHASE-3B (CEO-approved 2026-06-16).
**Brief:** `brief:atlas:v1-removal-phase-3b-alm-liquidity-on-v2-money-ma:2026-06-16`.
**Charter:** D-ENGINEERING-INTEGRITY-CHARTER (ten no-shortcut commands + Definition of Done).
**Author:** Atlas (Core banking platform architect, engineering).

## Why

Phase 3b was thought blocked on missing V2 event families. It is not. All V1
schemas for deposit / funding / repo / IBL already exist
(`platform/event-store/event-types/repo-mmd-ibl.ts`) and
`platform/projections/alm-positions.ts` already reads them. The true gaps were:

1. **No V2 FIL models** for money-market instruments — built here.
2. **No V2 GL posting handlers** for the money-market lifecycle — built here.
3. **No V1↔V2 LCR-denominator parity gate** — built here (advisory at Phase 3b).

## Money is currency-agnostic by construction (WS-MULTI-BASE-CURRENCY, #1382)

Every money-market instrument values in **its own currency** (the principal /
notional currency of the deposit, loan, or repo). There is **no** `?? "ZAR"`
and no hardcoded reporting/base currency anywhere. The amortised-cost value is
denominated in the instrument's own `currency`; any reporting-currency
translation is a view-time concern resolved via the #1382 functional-currency
resolver (`v2-core/fil-models/fx-valuation/reporting-currency-resolver.ts`), the
same fail-closed `requireReporting` guard the FX models use.

## FIL taxonomy — three self-contained money-market types (asset class `ir`)

| FIL type URN | Direction | Valuable | Performable |
|---|---|---|---|
| `fil:type:ir:money-market:unsecured@1.0` | asset (lend / IBL) OR liability (borrow / funding line) | amortised cost = principal + accrued EIR | daily accrual carry |
| `fil:type:ir:money-market:deposit:fixed-term@1.0` | liability (DepositTaken) | amortised cost = principal + EIR accrual | daily accrual |
| `fil:type:ir:money-market:repo:classic@1.0` | asset OR liability (repo open/close) | amortised cost = principal + accrued repo interest | daily repo carry |

**KEY methodology choice:** Valuable = **amortised cost** (principal + EIR
accrual), NOT market-discounted. These are banking-book IFRS-9 amortised-cost
instruments — consistent with how the cash/FX FIL models avoid PV machinery. No
discount curve is introduced here; discounting is reserved for the Phase 3c
FVTPL bond.

The `unsecured` type is ONE type carrying a `direction` discriminator on its
position (asset = bank lends → interest income; liability = bank borrows →
interest expense), per the brief: IBL-placed and funding-line-drawn share the
amortised-cost economics and differ only in sign + GL accounts. The fixed-term
deposit is a DISTINCT type because its NSFR/LCR ASF treatment differs from
interbank.

## V2 lifecycle events (V2-parallel)

V2 equivalents of every V1 ALM lifecycle event are registered with:
`tenantId: TenantId` added, amounts as `MoneyWire`, `schemaVersion: 2`,
`v2Status: "v2-parallel"`. F-032 honoured at all three sites (event-types
barrel + registry domain file + provenance-category). The V1 events stay
`v1-only`; the V1-removal ratchet only fails on a v1-only-count INCREASE, so
adding v2-parallel types holds the ratchet.

Events: `DepositTakenV2`, `DepositInterestAccruedV2`, `DepositMaturedV2`,
`DepositWithdrawnEarlyV2`, `DepositRolledOverV2`, `FundingLineDrawnV2`,
`FundingLineRepaidV2`, `RepoTradeOpenedV2`, `RepoTradeTerminatedV2`,
`RepoTradeTerminatedEarlyV2`, `InterbankLoanPlacedV2`, `InterbankLoanMaturedV2`,
`InterbankLoanInterestAccruedV2`, `InterbankLoanRecalledEarlyV2`.

## V2 GL posting handlers

Added to `platform/accounting/gl-posting-engine-v2.ts`, driven off the new V2
money-market lifecycle events (mirrors the existing FX V2 double-entry /
provenance shape):

- `PR-MMD-001-V2` (DepositTakenV2 → IAS 39 liability recognition),
  `PR-MMD-ACCRUAL-V2` (interest expense), `PR-MMD-MAT-V2` (derecognition),
  `PR-MMD-CANCEL-V2` (early termination)
- `PR-FUNDING-001-V2`, `PR-FUNDING-002-V2`
- `PR-REPO-001-V2`…`PR-REPO-004-V2`
- `PR-IBL-001-V2`…`PR-IBL-003-V2`

## BA-300 wiring + parity gate

`platform/reporting/ba-300-lcr.ts` already folds the V1 ALM lifecycle events
directly via `foldProductMaturityOutflows()`. Phase 3b wires the BA-300 LCR
denominator to the canonical ALM projection (`getALMPositionSnapshot()` from
`alm-positions.ts`) as the single source, and adds
`platform/recon/ba300-v2-parity.ts` (`runParityCheck`) comparing the V1 LCR
denominator against the V2 LCR denominator derived from the ALM snapshot.
ADVISORY at Phase 3b (`ok:true`, warns on gaps). Registered in the recon suite
and `package.json`.
