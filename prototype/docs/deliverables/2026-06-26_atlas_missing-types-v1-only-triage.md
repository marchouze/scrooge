---
title: "missing-types.ts v1-only estate — three-fate triage + money-free flip-now batch"
author: "Atlas (Substrate Architect, engineering)"
date: "2026-06-26"
category: "engineering-design"
decision: "D-V1-REMOVAL-MISSING-TYPES-TRIAGE"
brief: "brief:atlas:triage-missing-types-ts-placeholder-estate-flip-:2026-06-26"
authority:
  - "D-V1-REMOVAL-MISSING-TYPES-TRIAGE (CEO-approved 2026-06-26)"
  - "D-V1-REMOVAL-STANDING-DIRECTIVE"
  - "D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16)"
  - "D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16)"
  - "D-ENGINEERING-INTEGRITY-CHARTER"
---

# `missing-types.ts` v1-only estate — three-fate triage + money-free flip-now batch

**Author:** Atlas (Substrate Architect, engineering).
**Reviewer-of-shape:** Vera (Internal audit engineer, third line) — recon-gate authorship.
**Decision:** `D-V1-REMOVAL-MISSING-TYPES-TRIAGE` (CEO-approved 2026-06-26).

## 1. Premise — CONFIRMED with one correction

The brief's premise held against the code on three of four claims, with one
material correction (recorded here, Charter cmd 5 — no silent execution of a
wrong premise, PROC-GOV-ADC-01):

| Premise claim | Verdict | Evidence |
|---|---|---|
| `missing-types.ts` is a 2026-05-16 F-032 placeholder file | **CONFIRMED** | File header; Vera finding `event-type-registry-coverage`. |
| 78 rows are still `v2Status: "v1-only"` | **CONFIRMED** | `grep -c 'v2Status: "v1-only"'` = 78 (of 160 total; 80 already `v2-replaced`, 2 `v2-parallel`). |
| The money-free subset flips via the Bucket C store-tee + byte-clean parity mechanism | **CORRECTED → retired-by-construction `v2-replaced` flip** | The Bucket C tee path is for types **emitted on the canonical seed path** that need live v2 mirroring. **None of the 78 placeholder types is emitted into the canonical `ci:migrate` store** (verified empirically — see §3). The store-tee + byte-parity ceremony would mirror an empty set. The correct, precedent-matching mechanism for an un-emitted placeholder is the **bare `v2Status` flip to `v2-replaced`, retired-by-construction** — exactly what the 80 already-flipped rows in this same file did (`FxPositionRevalued`, `LegalDocumentationSigned`, …). No tee, no new parity gate, no v2-core registry row is required: the `missing-types.ts` registry row **is** the type's canonical home, and the ratchet counts `EVENT_TYPE_REGISTRY` rows by `v2Status` directly. |
| Money-bearing `*Minor`/amount rows are un-emittable and stay `v1-only` | **CONFIRMED** | `recon:no-residual-minor-encoding` blocks numeric `*Minor` keys; money-bearing rows carry `amount`+`currency` that the V2-core money-decimal-native directive requires be `MoneyWire`, not bare `number`. They flip retired-by-construction only when their domain V2 wave + real data lands at licence-day. |

**Second correction (registry-integrity finding):** `BacktestTriggered` is registered
**twice** — section C (line 1269) and section L (line 2405) — with identical `type`
and `payloadSchema`. The file's own `addRows`/`SEEN` dedup keeps section C and
silently drops section L, so the section-L row never reaches the exported
`MISSING_EVENT_TYPES` / `EVENT_TYPE_REGISTRY`. It is **dead** (Fate 3) and is pruned
in this PR. It was never counted in the ratchet (dedup runs before the count), so
its removal does not change the ratchet number.

## 2. Money-bearing test (the deciding axis)

A row is **money-bearing** iff its payload carries a numeric **currency amount** —
any `*Minor` integer key, a `MoneyWire`, or a `number` field denominated in a
currency (`amount`, `postingAmount`, `principalAmount`, `shortfallAmount`,
`hqlaAmount`, `fillPrice`, `bookingPrice`, `limitAmount`/`positionAmount`,
`metricValue`/`limitValue` money, `eveWorstDeltaZar`, `niiWorstDeltaZar`,
`totalAssets`/`equity`/`netPnL`, `estimatedImpact`, `stage1/2/3Amount`,
`changeAmount`, `collateralAmount`, …) paired with a `currency`.

A bare `currency` LABEL with **no amount**, a **ratio/percentage** (`lcrRatioPct`,
`nsfrRatioPct`, `cet1Ratio`, `deltaPct`), a **score** (`matchScore`, `threshold`),
a **count** (`missingTickCount`, `breachCount`), an **instrument quantity**
(`quantityBefore/After`), or a **string** field (`bankValue`/`oldValue`) is
**money-free**. Verified by reading each schema body, not by field-name heuristic.

## 3. Domain-truth oracle — emit-site grounding

Two facts grounded per row (not guessed):

1. **Emit-site** — grep the whole tree for `make<Type>(` production callsites
   (`runtime/`, `platform/`, `domains/`; excluding `/event-types/`, `/registry/`,
   tests, `/simulation/`, `scripts/sim-*`).
2. **Canonical-store presence** — built the canonical CI-seeded store via
   `bun run ci:migrate` (the exact store `recon:*` runs against) and queried
   `SELECT type, COUNT(*) FROM events GROUP BY type`.

**Result: ZERO of the 78 placeholder types appear in the canonical `ci:migrate`
store.** 10 types have a *dormant* code emitter (an unwired subscriber, attestation
runner, or sim handler not on the seed/runtime path); the other 68 have no emitter
anywhere. Either way, no canonical producer wires any of them into the live event
log on `main`. This is the empirical basis for "retired-by-construction".

Dormant emitters (recorded, not hidden): `RealisedPnlRecognised`
(`rohan-daily-mtm.ts`), `FxSettlementFailed` / `SettlementFailureClassified`
(`fx-settlement-subscriber.ts`), `NostroDesignationMissing`
(`otc-failure-handlers.ts`), `HQLACompositionDrift` (`ravi-intraday-stress.ts`,
`atlas-collateral-snapshot.ts`), `IcaapIlaapInputReady` (`atlas-ilaap-run.ts`),
`ModelRegistered` (`pricing-model-definitions.ts`), `ClientCandidateRegistered`
(`kyc/orchestrator.ts`), `FundingDrawnDown` (`correspondent-nostro-sim.ts`),
`MissedExpectedReceipt` (`fx-settlement-subscriber.ts`).

## 4. Three-fate result

| Fate | Count | Mechanism | Ratchet effect |
|---|---:|---|---|
| **1 — FLIP-NOW (money-free, retired-by-construction)** | **49** | `v2Status: "v1-only" → "v2-replaced"` in place; registry row is canonical home; no tee (un-emitted). | **−49** |
| **2 — LICENCE-DAY-GATED (money-bearing)** | **28** | Stay `v1-only` with per-row reason; flip retired-by-construction when domain V2 wave + real data lands. | 0 |
| **3 — DEAD / SHADOW** | **1** | Prune section-L duplicate `BacktestTriggered` (deduped-away, never exported). | 0 (already excluded by dedup) |
| **Total rows** | **78** | | **−49** |

**Ratchet: 286 → 237** (49 money-free flips). The brief's ~268 estimate assumed
~15–20 flip-now; grounding found 49 money-free rows — the estimate is overridden by
the evidence, as the brief instructed.

## 5. Full classification — all 78 rows

Legend: **§** = domain section (A FX/markets/trading · B ALM/treasury/liquidity ·
C Risk · D Accounting/IFRS · E Compliance/AML · K Client-lifecycle · L
model-validation). **Emitter** = production callsite path or `none`. **$?** = money
field cited. **Fate**: 1=flip-now `v2-replaced`, 2=licence-day-gated, 3=dead.

### Fate 1 — money-free, FLIP-NOW → `v2-replaced` (49)

| Type | § | Emitter | $? | Reason |
|---|---|---|---|---|
| PreTradeGatewayBlock | A | none | money-free | placeholder, no emitter; envelope is IDs/enums |
| OrderRoutingAnomaly | A | none | money-free | `latencyMs` count, not money |
| SurveillanceFeedGap | A | none | money-free | `missingTickCount` count, not money |
| MarketDataOutage | A | none | money-free | IDs/enums/arrays only |
| ExchangeRuleChange | A | none | money-free | IDs/dates/arrays only |
| PositionAdjusted | A | none | money-free | `quantityBefore/After` instrument qty, not currency |
| LimitBreachActioned | A | none | money-free | `limitName`/action strings, no amount |
| PortfolioReclassification | A | none | money-free | IDs/enums/IFRS ref only |
| DealerMandateBreach | A | none | money-free | IDs/enums only |
| SurveillanceAlert | A | none | money-free | IDs/enums/booleans only |
| CurveSourceAnomaly | A | none | money-free | IDs/enums/tenor array only |
| CounterpartyEvent | A | none | money-free | IDs/enums only |
| RASCalibrationChange | A | none | money-free | `limitScheduleId` + enums, no amount |
| LicenceGranted | A | none | money-free | IDs/dates/conditions array only |
| ConfirmationMatched | A | none | money-free | IDs/enum only |
| ConfirmationMismatch | A | none | money-free | `bankValue`/`counterpartyValue` STRINGS |
| SettlementFailed | A | none | money-free | IDs/enums/dates only |
| SettlementReversed | A | none | money-free | IDs/dates/reason only |
| FxTradeCancelled | A | none | money-free | IDs/reason only |
| FxSettlementFailed | A | `fx-settlement-subscriber.ts` (dormant) | money-free | cash facts recorded elsewhere; payload is leg-status booleans |
| SettlementFailureClassified | A | `fx-settlement-subscriber.ts` (dormant) | money-free | classification enum + evidence refs |
| NostroDesignationMissing | A | `otc-failure-handlers.ts` (dormant) | money-free | tradeRef/legKind/reason only |
| FxForwardDefaulted | A | none | money-free | refs/dates/booleans only |
| FxForwardExtensionRequested | A | none | money-free | refs/dates/reason only |
| TradeCancelled | A | none | money-free | IDs/enum/date only |
| TradeAmended | A | none | money-free | `oldValue`/`newValue` STRINGS |
| HQLACompositionDrift | B | `ravi-intraday-stress.ts` (dormant) | money-free | `l1/l2a/l2bHQLAPct` percentages, not amounts |
| LCRRatioProjection | B | none | money-free | `lcrRatioPct` ratio + `currency` LABEL, no amount |
| NSFRRatioProjection | B | none | money-free | `nsfrRatioPct` ratio + `currency` LABEL, no amount |
| CapitalActionTrigger | B | none | money-free | `cet1Ratio`/`threshold` ratios + `currency` LABEL |
| IRRBBChecked | B | none | money-free | `deltaPct`/`limitPct` ratios + `currency` LABEL |
| MaterialIFRSClassificationChange | B | none | money-free | classification enums + IFRS ref |
| ModelRiskDecisionRequired | C | none | money-free | IDs/enums/dates only |
| IcaapIlaapInputReady | C | `atlas-ilaap-run.ts` (dormant) | money-free | input-kind enum + file path |
| RiskRunCompleted | C | none | money-free | counts/enums/nullable strings |
| RiskAppetiteSnapshot | C | none | money-free | percentages/counts/enums |
| ModelRegistered | C | `pricing-model-definitions.ts` (dormant) | money-free | model metadata; no amount |
| BacktestTriggered | C | none | money-free | `windowDays` count + IDs |
| AlertOpened | E | none | money-free | IDs/enums/strings only |
| SanctionsHit | E | none | money-free | `matchScore` score, not money |
| PEPMatchExceedsThreshold | E | none | money-free | `matchScore`/`threshold` scores |
| FAISConductBreachSuspected | E | none | money-free | IDs/provision/enum only |
| SanctionsHoldRaised | E | none | money-free | IDs/enums/refs only |
| LeadCaptured | K | none | money-free | IDs/enums/names only |
| SuitabilityAssessmentRequired | K | none | money-free | IDs/obligation/dates only |
| AdviceRecordRequested | K | none | money-free | IDs/obligation/dates only |
| OnboardingHandoffPending | K | none | money-free | IDs/enums/notes only |
| ClientCandidateRegistered | K | `kyc/orchestrator.ts` (dormant) | money-free | entity-type/kyc-status enums, no amount |
| ClientReviewTriggered | K | none | money-free | IDs/enums/dates only |

### Fate 2 — money-bearing, LICENCE-DAY-GATED → stay `v1-only` (28)

Each carries a numeric currency amount; the V2-core money-decimal-native directive
requires `MoneyWire`, not bare `number`+`currency`, so a faithful V2 form needs the
domain money codec + real data. Flips retired-by-construction when the domain V2
wave + real data lands at licence-day. (Charter cmd 5 — explicit per-row reason.)

| Type | § | Emitter | Money field | Reason (stays v1-only) |
|---|---|---|---|---|
| RealisedPnlRecognised | A | `rohan-daily-mtm.ts` (dormant) | `amountClosedMinor`,`realisedPnlZarMinor` (+MoneyWire) | un-emittable `*Minor`; V2 = FIL valuation path at licence-day |
| FxForwardPointsAccrued | A | none | `notionalFcyMinor`,`*ZarMinor` | un-emittable `*Minor` |
| TradeMatured | A | `pr-fx-memo.ts`/settlement (dormant) | FX product notional (union) | money-bearing FX; V2 FIL instance at licence-day |
| TradeBooked | A | none | `bookingPrice`+`currency` | money-bearing trade; licence-day |
| TradePosted | A | none | `postingAmount`+`currency` | money-bearing posting; licence-day |
| FundingDrawn | A | none | `amount`+`currency` | money-bearing funding; licence-day |
| FundingDrawnDown | A | `correspondent-nostro-sim.ts` (dormant) | `amount`+`currency` | money-bearing funding; licence-day |
| OrderSubmitted | A | none | `limitPrice` | money-bearing order; licence-day |
| OrderFilled | A | none | `fillPrice`+`currency` | money-bearing fill; licence-day |
| CollateralUpdated | A | none | `collateralAmount`+`currency`,`exposureAfter` | money-bearing collateral; licence-day |
| LimitBreachProposed | A | none | `limitValue`,`actualValue` (currency) | money-bearing limit; licence-day |
| LoanBooked | A | none | `principalAmount`+`currency` | money-bearing loan; licence-day |
| DepositReceived | A | none | `amount`+`currency` | money-bearing deposit; licence-day |
| AccrualBooked | A | none | `amount`+`currency` | money-bearing accrual; licence-day |
| MissedExpectedReceipt | A | `fx-settlement-subscriber.ts` (dormant) | `expectedAmountMinor` | un-emittable `*Minor` |
| NostroFundingShortfall | B | none | `shortfallAmount`+`currency` | money-bearing shortfall; licence-day |
| IRRBBExcursion | B | none | `metricValue`,`limitValue`+`currency` | money-bearing IRRBB; licence-day |
| FXPositionBreach | B | none | `positionAmount`,`limitAmount` | money-bearing position; licence-day |
| HedgeIneffective | B | none | `ineffectivenessAmount`+`currency` | money-bearing hedge; licence-day |
| CapitalEvent | B | none | `amount`+`currency` | money-bearing capital; licence-day |
| FinancialPositionSnapshot | B | none | `totalAssets`,`equity`,`netPnL`+`currency` | money-bearing balance sheet; licence-day |
| LiquiditySnapshot | B | none | `hqlaAmount`+`currency` | money-bearing liquidity; licence-day |
| ALMRunCompleted | B | none | `eveWorstDeltaZar`,`niiWorstDeltaZar` | money-bearing ALM; licence-day |
| RestatementProposed | B | none | `estimatedImpact`+`currency` | money-bearing restatement; licence-day |
| AppetiteBreach | C | none | `limitValue`,`actualValue` (currency) | money-bearing appetite; licence-day |
| IFRS9ECLPublished | D | none | `totalECL`,`stage1/2/3Amount`+`currency` | money-bearing ECL; licence-day |
| IFRS9ECLChange | D | none | `priorECL`,`currentECL`,`changeAmount` | money-bearing ECL; licence-day |
| TransactionPosted | E | none | `amount`+`currency` | money-bearing transaction; licence-day |

### Fate 3 — DEAD / SHADOW → prune (1)

| Type | § | Reason |
|---|---|---|
| BacktestTriggered (section L) | L | Duplicate registry row; `addRows`/`SEEN` dedup drops it before export. Never in `EVENT_TYPE_REGISTRY`, never counted in the ratchet. Pruned to remove the dead duplicate; the section-C row remains as the live `BacktestTriggered` (Fate 1, flipped). |

## 6. Substrate gaps surfaced (Charter cmd 5)

- **Dormant emitters not on the canonical path.** 10 types have code emitters
  (subscribers / attestation runners / sim handlers) that are not wired into any
  seed or runtime tick. When their domains activate, each must be (a) wired into
  the canonical path and (b) re-homed in V2 (money-bearing) or confirmed verbatim
  (money-free). Tracked here, not deferred silently.
- **Money-free placeholders have no V2-core registry row.** The flip is a bare
  `v2-replaced` status change; the type has no `v2-core/` schema. This is correct
  for an un-emitted placeholder (the row is its canonical home), but when a dormant
  money-free emitter is wired live at licence-day it must be onboarded to the
  store-tee verbatim path (Bucket C mechanism) so the V2 store mirrors it. Recorded
  as the licence-day onboarding step for the 10 dormant-emitter types.
- **`missing-types.ts` is a single 2,500-line lump.** The file header already flags
  the per-domain-module split as F-032 follow-on. Out of scope for this flip.
