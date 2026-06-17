# Money-bearing non-financial TAIL — classification of the 288 v1-only types

**Author:** Atlas (Core banking platform architect, engineering)
**Workstream:** WS-V2-MIGRATION-MONEY-TAIL
**Authority:** `D-BANK-WIDE-V2-MIGRATION` + `D-V1-REMOVAL-FLIP-BASIS-RBC` + `D-V2-CORE-MONEY-DECIMAL-NATIVE`; Marc "sweep the money-bearing tail", 2026-06-17.
**Charter:** `D-ENGINEERING-INTEGRITY-CHARTER`.

## Method

Imported `EVENT_TYPE_REGISTRY`, filtered `v2Status === "v1-only"` (**288 rows**), and walked every
type's Zod `payloadSchema` for money-leaf fields (a money-lexicon name — `amount`, `*Zar`, `*Minor`,
`notional`, `netCash`, `exposure`, `premium`, `pnl`, `cash`, `principal`, `fee`, `proceeds`,
`balance`, … — that is **not** a known false-positive: `*Pct`/`*Bps`/`*Ratio`/`*Count`/`*Days`/`*Id`/
`*Hash`/`*Ref`/`*Deadline`/`*Date`/`*At`/`*Version`/`previousValue`/`newValue`/`currency`). Then
classified each money-bearing type by domain. Buckets A (money-bearing non-financial, 13 types) and
C (substrate, 197 types) are **already CLOSED**; this sweep targets only the residual money-bearing
**operational/non-financial migratable-now** stragglers.

Honest under-inclusion beats mis-sweeping a financial type (brief instruction). The result is a very
small SWEEP-NOW set — **2 types** — because the money-bearing remainder of the 288 is, by class,
overwhelmingly financial-FIL (markets 179) and risk-analytics (the audit/governance money fields are
all credit-risk / liquidity / collateral / capital figures that flip at licence-day with real data).

## SWEEP-NOW (this batch) — 2 types

Both are **payments three-way reconciliation** output (trade-leg ↔ payment-leg ↔ ledger-leg match),
emitted by `platform/payments/reconciliation.ts` (issuer Tomas), cited to `PROC-PAY-RBH-01` /
`NPS-ACT-78-1998` / `BANKS-ACT-94-1990`. They are **operational reconciliation**, NOT trading /
GL / capital / liquidity analytics — exactly the brief's "audit/payments recon" candidate class. The
money fields are **optional minor-unit integers** named `tradeAmount` / `paymentAmount` (NOT
`*Minor`-suffixed → they do not trip `recon:no-residual-minor-encoding`), present only on an
`"amount"` break. Path: **emittable numeric-money → store-tee + MoneyWire codec** (bucket-A2 pattern).

| Type | Class | Money field(s) | Path | Currency source |
|---|---|---|---|---|
| `ReconciliationBreak` | audit | `tradeAmount?`, `paymentAmount?` (minor-unit int) | store-tee + MoneyWire codec | new `currency` field sourced from `trade.currency` at the amount-break site (Charter cmd 4, never `?? "ZAR"`) |
| `DailyReconciliationReport` | audit | `breaks[].tradeAmount?`, `breaks[].paymentAmount?` (minor-unit int) | store-tee + MoneyWire codec (nested over `breaks[]`) | per-break `currency` field, same source |

Live population (canonical home store, 2026-06-17): `ReconciliationBreak` = **0**;
`DailyReconciliationReport` = **7** (all with empty `breaks` → zero money values recorded). The
flip therefore rests on the dual-write + decoded-decimal parity gate (PASS-on-empty / vacuous on the
absent money), with codec MAJOR/MINOR-unit + currency-source correctness proven by a **unit test**
(`v2-core/money-tail/codec.test.ts`), not a forced legacy seed. This is a batch-level **tracked gap**
for licence-day re-validation when amount-breaks with real money land.

## EXCLUDED — financial-FIL / risk-analytics (licence-day, needs real data)

Everything else money-bearing in the 288 is financial-FIL or risk-analytics that flips at licence-day
with real data — left `v1-only`, NOT swept. By area:

- **Markets / trading / settlement (markets class, 179):** all FX / equity / bond / IRS / IRD / FRA /
  swap / repo / order / quote / RFQ / deposit / interbank-loan / funding-line trade, position,
  settlement, coupon, accrual, revaluation, realised-PnL events
  (`FxSettlementInstructed`, `EquityTradeExecuted`, `BondTradeExecuted`, `IrsTradeBooked`,
  `IrdSwap*`, `Repo*`, `Deposit*`, `InterbankLoan*`, `FundingLine*`/`FundingDrawn*`, `Order*`,
  `RfqRequested`, `QuoteResponded`, `RealisedPnlRecognised`, `PrincipalPayment`,
  `SettlementInstruction{Issued,Received}`, `PaymentInitiated`, `PaymentSettled`,
  `NdfFixingObserved`, `SwaptionTradeBooked`, `BasisSwapTradeBooked`, `CrossCurrencySwapTradeBooked`,
  `FraTradeBooked`, `FxForwardPointsAccrued`, …).
- **GL / accounting (markets / governance):** `JournalEntryPosted`, `ManualJournalEntry`,
  `TrialBalanceSnapshotted`, `AccrualBooked`, `TransactionPosted`, `TradePosted`,
  `Accounting*Closed/Opened`, `PeriodClosed`, `BalanceSheetSubstantiationCompleted`,
  `RestatementProposed`, `FinancialPositionSnapshot`, `CapitalEvent`, `CapitalActionTrigger`.
- **P&L / valuation / product-control (markets):** `PnL*` (`PnLAttributionGenerated`,
  `PnLFlashRecorded`, `PnLSignedOff`, `PnLCommentaryRecorded`, …), `MtmRunCompleted`,
  `ValuationAdjustmentComputed`, `Day1PnLDeferralRecorded`, `PrudentValuationAvaAggregated`,
  `IpvExceptionRaised`, `OfficialMarkAdopted`.
- **Capital / RWA / regulatory figures (governance / markets):** `BalanceSheetProjected`,
  `MaterialityBenchmarkApproved`.
- **Liquidity — LCR/NSFR/ILAAP/ICAAP/intraday/ALM (governance / markets):** `LCRComputed`,
  `NSFRComputed`, `LCR/NSFRRatioProjection`, `ILAAPScenarioRun`, `ILAAPSummaryCompleted`,
  `IcaapIlaapInputReady`, `IntradayLiquidity*`, `IntradayHQLAStressProjection`,
  `CollateralInventorySnapshotted`, `LiquiditySnapshot`, `HQLACompositionDrift`, `ALMRunCompleted`,
  `IRRBBChecked`/`IRRBBExcursion`, `FundingConcentrationAlertTriggered`,
  `CriticalSettlementObligationAtRisk`, `NostroFundingShortfall`, `MissedExpectedReceipt`,
  `RecoveryEarlyWarningTriggered`, `IntradayStressDetected`, `LcrRatioBreach`, `NsfrRatioBreach`.
- **Credit-risk — credit-limit / LEX / SICR / Basel-class / counterparty (audit / markets):**
  `CreditLimit*` (`Proposed`, `Breached`, `BreachDisposed`, `ApplicationSubmitted`,
  `AnnualReviewCompleted`, `ExtensionRequested`), `Lex{UtilisationComputed,ExceptionApproved}`,
  `Crc*`, `Sicr*`, `CounterpartyBaselClassAssigned`, `CounterpartyEligibility*`,
  `CounterpartyEvent`, `CreditAnalysisCompleted`, `CreditAssessmentCompleted`,
  `SubInvestmentGradeCounterpartyApproved`, `ExternalCreditEventDetected`.
- **Market-risk / VaR (markets):** `MarketRiskMeasureComputed`, `RiskRunCompleted`, `FXPositionBreach`,
  `DealerMandateBreach`, `SurveillanceAlert`.
- **ODP / collateral / segregation / ISDA-CSA (governance):** `Odp*` (recon-run / break / dispute /
  report-submission family), `CollateralSegregation*`, `CollateralSubstitution*`,
  `CollateralSufficiencyChecked`, `CollateralUpdated`, `IsdaCsaElected`/`Superseded`,
  `IsdaScheduleElected`, `ISDACSAAssessmentCompleted`, `TradeUtiAllocated`.
- **IFRS9 / ECL / staging (governance / markets):** `Ifrs9StageAssigned`, `IFRS9ECLPublished`,
  `IFRS9ECLChange`, `IfrsClassificationApplied`, `MaterialIFRSClassificationChange`,
  `PortfolioReclassification`.
- **FTP / treasury curves (markets):** `FtpAttributionRecorded`, `FtpCurvePublished`.
- **Liquidity-limit (audit):** `LiquidityLimitBreached`, `LiquidityLimitBreachDisposed`,
  `AppetiteBreach`, `RiskAppetiteSnapshot`.

These are bucket-B financial-FIL / risk-analytics and flip at licence-day under their own data-bearing
parity, exactly as capital/SA-CCR did. Count: the money-bearing financial/risk-analytics deferred set
is the large majority of the markets-179 class plus the credit/liquidity/ODP money-bearing
audit+governance rows — all left `v1-only`.

## EXCLUDED — `CalculationPerformed`

`CalculationPerformed` (audit class) — separate decimal-correctness track (chip `task_7fbdd8c9`),
polymorphic numeric `value`+string `unit`. Out of scope per brief.

## EXCLUDED — ambiguous (deferred, needs explicit classification)

None. Every money-bearing v1-only type resolves cleanly to either the SWEEP-NOW operational-recon
pair or the financial-FIL / risk-analytics / CalculationPerformed exclusions above. The
money-**free** remainder of the 288 (governance / runtime substrate, e.g. `BankAccountOpened`,
`TenantMeterEvent`, `AlertOpened`) is out of scope for *this* money-bearing sweep and is bucket-C
substrate (already closed) territory — not re-touched here.

## Migration plan (Step 2)

1. New `v2-core/money-tail/` sub-package (mirrors `v2-core/bucket-a-a2/`): v2-native re-declared
   schemas with `tradeAmount`/`paymentAmount` lifted to `moneyWireSchema` + a per-type `V2TeeCodec`
   that reads minor-unit ints and the `currency` field → `moneyWireFromMinorNumber`. Codec omits the
   money field when absent (optional). `DailyReconciliationReport` codec maps over `breaks[]`.
2. Add `currency` to the **V1** `reconciliationBreakPayloadSchema` and
   `reconciliationBreakSummarySchema` (optional, ISO-4217), populated at the amount-break site from
   `trade.currency` in `platform/payments/reconciliation.ts`.
3. Register both types in `V2_EVENT_TYPE_REGISTRY` with `tee: { codec }` (`v2-parallel`).
4. New `recon:money-tail-v2-parity` (decoded-decimal parity, modelled on `recon:bucket-a-a2-v2-parity`)
   + package.json script + register in `run-recon-suite.ts`.
5. Generic `backfill:v2-store-tee` mirrors history (registry-driven; no new backfill script).
6. Codec unit test (`v2-core/money-tail/codec.test.ts`) proving MINOR→MAJOR conversion + currency
   sourcing on a positive figure (NOT a forced legacy seed).
7. Flip both rows `v1-only → v2-replaced`; harden ratchet `288 → 286` (−2 rows); gate enforcing.
   One batch-level tracked gap for the empty-money-population flip.
