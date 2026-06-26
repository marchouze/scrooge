# Bucket A — Money-bearing non-financial event types: V2 scope + pilot design

**Authority:** `D-BANK-WIDE-V2-MIGRATION` (CEO-approved 2026-06-16); Marc's in-session pick of bucket A, 2026-06-16.
**Flip basis (money-bearing):** `D-V1-REMOVAL-FLIP-BASIS-RBC` (CEO-approved 2026-06-16) — retired-by-construction.
**Money encoding:** `D-V2-CORE-MONEY-DECIMAL-NATIVE` (MoneyWire `{ __money, amount, currency }`, MAJOR units).
**Engineering Charter:** `D-ENGINEERING-INTEGRITY-CHARTER` (CEO-approved 2026-06-14).
**Author:** Atlas (Core banking platform architect, engineering).
**Status:** Scoping + design note. No production code, no flips, no new types registered.

---

## 0. TL;DR

- The bank-wide migration sits at **v1-only = 481**. Bucket A is the **money-bearing,
  non-financial** slice (money-free sweeps are exhausted; financial-FIL = bucket B; dispatch/RMS
  substrate = bucket C).
- The widely-quoted **~60 estimate is a loose over-count**. After scanning all 481 v1-only types,
  excluding bucket B / bucket C, and pruning false-positive numeric fields (deadlines, %, bps,
  ratios, counts, IDs, hashes, prior/new values), the precise bucket-A set is **13 event types**.
- Of those 13, only **3 carry a `*Minor` integer money field** and are therefore **un-emittable on
  main** (the `recon:no-residual-minor-encoding` gate has no allowlist) → they need the
  **retired-by-construction** path: `RwaComputed`, `OperationalLossEvent`, `V2RiskAppetiteSet`.
  The other 10 carry money as plain numeric `amount`/`value`/`netCash`/`fee` fields (no `*Minor`),
  so they are *not* gate-blocked — but they are still pre-decimal and must be lifted to MoneyWire.
- **Recommended pilot: `RwaComputed`** (regulatory-reporting) — a single self-contained type, a
  clean four-field `*Minor` payload, one live emitter (`emitRwaComputed`), one read projection,
  zero shared-infra collisions, and it is the canonical analogue of how the financial wave's S2
  types flipped.
- **Biggest risk/gap (surfaced, not hidden):** **12 of the 13 bucket-A types have ZERO events in
  the canonical store** — they are seeded-only / data-empty in the build phase, exactly as capital
  was. A parity/coverage recon gate over an empty population is *vacuously* green. The flip is only
  honest if it rests on the retired-by-construction construction conditions (V1 un-emittable + V2
  sole live path), not on a vacuous byte-parity assertion.

---

## 1. Method

The inventory was produced by importing `EVENT_TYPE_REGISTRY`
(`platform/event-store/registry/index.ts`), filtering `v2Status === "v1-only"` (481 types),
introspecting each type's Zod `payloadSchema` for money-leaf fields, mapping each type to the
registry module that declares it, and classifying each into bucket A / B / C by domain. Money-leaf
detection: any leaf key ending in `Minor`, a `MoneyWire` `__money` discriminant, or a **numeric**
leaf whose name matches a money lexicon (`amount`, `Zar`, `notional`, `premium`, `loss`, `proceeds`,
`principal`, `exposure`, `fee`, `cash`, `nominal`, `pnl`, `consideration`, `coupon`, `dividend`,
`rwa`, `ead`, `value`/`output`, …) and is **not** a known false-positive (`*Pct`, `*Bps`, `*Ratio`,
`*Count`, `*Days`, `*Id`, `*Hash`, `*Ref`, `*Deadline`, `*Date`, `*At`, `*Version`, `previousValue`,
`newValue`, `metricValue`, `limitValue`, `actualValue`).

The `recon:no-residual-minor-encoding` constraint was **verified, not assumed**
(`platform/recon/no-residual-minor-encoding.ts`): it walks every event payload and **fails** on any
key ending in `Minor` whose value is a JSON number, with **no allowlist**. Therefore any type whose
schema requires a numeric `*Minor` field cannot be freshly emitted on main — the money-free
dual-write + byte-parity pattern is structurally impossible for it.

Data-presence counts below are from the canonical store
(`$HOME/.local/share/bank/event.db`) at the time of writing.

---

## 2. Precise bucket-A inventory (13 types)

All 13 are `v2Status: "v1-only"`, money-bearing, non-financial. None has a V2 counterpart yet
(except `V2RiskAppetiteSet`, which is itself V2-*named* but `*Minor`-encoded — see note). "Live
events" = count in the canonical store.

### 2a. Un-emittable `*Minor` subset — retired-by-construction required (3)

| Registry file | Type | Money field(s) | Encoding | Emittable on main? | Live events | V2 counterpart |
|---|---|---|---|---|---|---|
| `regulatory-reporting.ts` | `RwaComputed` | `creditRwaMinor`, `marketRwaMinor`, `operationalRwaMinor`, `totalRwaMinor` | `*Minor` int | **No** (gate-blocked) | **0** | none |
| `operational-risk.ts` | `OperationalLossEvent` | `grossLossMinor`, `recoveryMinor` | `*Minor` int | **No** (gate-blocked) | **0** | none |
| `v2-banking.ts` | `V2RiskAppetiteSet` | `floorZarMinor` | `*Minor` int | **No** (gate-blocked) | **0** | n/a (V2-named but `*Minor`) |

> Note on `V2RiskAppetiteSet`: despite the `V2` name it is *not* decimal-native — its schema
> (`platform/event-store/event-types/v2-banking.ts`, `v2RiskAppetiteSetSchema`) carries
> `floorZarMinor`. It is a mis-named legacy type; the correct fix is a decimal-native re-mint, not
> a rename. Its live emitters are the anchor standing-data seeds
> (`scripts/seed-v2-anchor-bank-standing-data.ts`, `scripts/v2-anchor-migration-rehearsal.ts`),
> which therefore cannot run against a gated store — confirming the 0-count.

### 2b. Emittable numeric-money subset — pre-decimal, not gate-blocked (10)

These carry money as plain `z.number()` fields (no `*Minor` suffix), so the `*Minor` gate does not
fire and they *are* emittable. They still need lifting to MoneyWire for decimal-native correctness,
but the flip mechanics differ (they can dual-write).

| Registry file | Type | Money field(s) | Live events | Domain |
|---|---|---|---|---|
| `model-risk.ts` | `CalculationPerformed` | `inputs[].value` + `output` (numeric, `unit`-tagged: `"ZAR-minor"`/`"pct"`/`"ratio"`) | **2193** | trusted-figures provenance |
| `climate-risk.ts` | `ClimateScenarioRun` | `portfolioSnapshot.totalExposureZAR`, `carbonIntensiveExposureZAR`, `stressLossZAR` | 0 | climate risk |
| `conduct.ts` | `FeeDisclosureEvent` | `notional`, `feeAmount` (+ `currency` sibling) | 0 | FAIS conduct |
| `correspondent-settlement.ts` | `CorrespondentSettlementInstructionSent` | `instructedAmount` | 0 | nostro / correspondent |
| `correspondent-settlement.ts` | `NostroStatementReceived` | `closingBalance` | 0 | nostro / correspondent |
| `counterparty-exposure.ts` | `CounterpartyExposureCalculated` | `grossExposure`, `netExposure`, `uncoveredExposure` | 0 | counterparty exposure |
| `missing-types.ts` | `STRCandidate` | `amount` | 0 | AML / FIC |
| `missing-types.ts` | `RelatedPartyTransactionProposed` | `amount` | 0 | governance / IFRS related-party |
| `missing-types.ts` | `InterEntityTransactionProposed` | `amount` | 0 | inter-entity / IFRS |
| `missing-types.ts` | `PAIARequest` | `fee` | 0 | privacy / PAIA |

> `CalculationPerformed` is special: its money is a **polymorphic numeric `value` with a string
> `unit`** (`platform/event-store/event-types/calculation.ts` — `value: z.number().nullable()`,
> `unit: z.string()`, e.g. `"ZAR-minor"`, `"pct"`, `"ratio"`, `"count"`). Because the field is named
> `value` (not `*Minor`), the `*Minor` gate does not catch it even when the unit *is* `"ZAR-minor"` —
> so it slips through as emittable and there are 2193 live events. It is the **only** bucket-A type
> with real data, and the **hardest** to migrate cleanly (mixed money/non-money values under one
> field). See §4 — it is explicitly **not** the recommended pilot.

### 2c. Why "~60" was an over-count

A loose money-lexicon scan over the 481 v1-only types yields ~149 "money-ish" hits and ~46 after a
first non-financial cut. The remainder collapse to 13 once the following are removed:
**deadlines/dates** (`responseDeadline`, `complianceDeadline`, `remediationDeadline` on
`RegulatorInquiry`, `DSARReceived`, `SBOMRequired`, `ResolutionRequired`, …), **percentages / bps /
ratios** (`limitUtilisationPct`, `spreadBps`, `capitalAdequacyRatio`, `breachRatePct`), **IDs /
hashes / refs** (`leadId`, `feedbackId`, `trialBalanceDocumentHash`, `limitScheduleId`),
**prior/new value pairs** on config-change events (`LegalEntityChanged`, `PreTradeLimitChanged`),
and **bucket-B/C reclassification** (next section).

---

## 3. Explicit bucket-B / bucket-C exclusions

The following money-bearing v1-only types were surfaced by the scan and are **excluded** from bucket
A because they are financial-FIL (bucket B) or dispatch/RMS substrate (bucket C).

### Bucket B — financial-FIL trading / risk / GL / liquidity / settlement (excluded)

- **Markets / trading** (`markets.ts`): `FxTradeExecuted`, `FxSettlementInstructed`,
  `NdfFixingObserved`, `SettlementRealisedPnlCorrected`, `EquityTradeBooked/Executed`,
  `EquitySettlementInstructed/Confirmed`, `EquityPositionRevalued`, `EquityCorporateActionApplied`,
  `IrsTradeBooked`, `IrsCouponScheduleGenerated`, `IrsCouponPaymentInstructed`,
  `IrsCouponSettlementConfirmed`, `IrsPositionRevalued`, `ManualJournalEntry`,
  `TrialBalanceSnapshotted`.
- **Bonds** (`bonds.ts`): `BondTradeExecuted`, `BondInterestAccrued`, `BondPositionRevalued`,
  `BondMatured`, `BondSold`, `BondSettlementInstructed`, `BondCustodianSettlementConfirmed`.
- **Equities** (`equities.ts`): `EquityDividendAccrued`, `EquitySold`.
- **IRD / OTC swaps** (`ird-swaps.ts`, `isda-odp.ts`): `IrdSwap*`, `FraTradeBooked`,
  `SwaptionTradeBooked`, `BasisSwapTradeBooked`, `CrossCurrencySwapTradeBooked`, `IsdaScheduleElected`,
  `IsdaCsaElected`.
- **ODP recon / collateral** (`odp-portfolio-recon.ts`, `odp-collateral-segregation.ts`,
  `odp-umoja-uti.ts`): `Odp*ReconRun`, `OdpReconBreakRaised`, `OdpReconDisputeResolved`,
  `CollateralSegregation*`, `CollateralSubstitution*`, `CollateralSufficiencyChecked`,
  `TradeUtiAllocated`.
- **Product control / MtM / valuation** (`product-control.ts`, `mtm.ts`, `valuation-adjustment.ts`):
  `PnLAttributionGenerated`, `PnLAttributionExceptionRaised`, `PnLSignedOff`, `PnLCommentaryRecorded`,
  `PnLFlashRecorded`, `PnLFlashActualReconciled`, `MtmRunCompleted`, `ValuationAdjustmentComputed`,
  `Day1PnLDeferralRecorded`, `PrudentValuationAvaAggregated`.
- **Treasury / liquidity / ALM / settlement** (`repo-mmd-ibl.ts`, `liquidity.ts`,
  `liquidity-limit.ts`, `cfp-triggers.ts`, `intraday-liquidity.ts`, `ilaap.ts`, `alco.ts`,
  `balance-sheet.ts`, `collateral.ts`, `settlement.ts`, `ifrs9-staging.ts`, `payments.ts`, plus
  placeholder rows in `missing-types.ts`): `FundingLineCommitmentRecorded`, `LCRComputed`,
  `NSFRComputed`, `BalanceSheetProjected`, `CollateralInventorySnapshotted`,
  `SettlementInstructionIssued`, `Repo*`, `Deposit*`, `FundingLine*`, `Interbank*`,
  `JournalEntryPosted`, `Ifrs9StageAssigned`, `FxForwardPointsAccrued`, `MissedExpectedReceipt`,
  `RealisedPnlRecognised`, and the `missing-types.ts` treasury/settlement placeholders
  (`TradePosted`, `FundingDrawn`, `FundingDrawnDown`, `CollateralUpdated`, `LoanBooked`,
  `DepositReceived`, `AccrualBooked`, `PaymentSettled`, `PaymentInitiated`,
  `SettlementInstructionReceived`, `ReconciliationBreak`, `NostroFundingShortfall`, `IRRBBExcursion`,
  `FXPositionBreach`, `HedgeIneffective`, `CapitalEvent`, `FinancialPositionSnapshot`,
  `LiquiditySnapshot`, `ALMRunCompleted`, `IntradayHQLAStressProjection`, `AppetiteBreach`,
  `IFRS9ECLPublished`, `IFRS9ECLChange`, `TransactionPosted`, `LimitBreachProposed`,
  `LimitBreachActioned`, `RASCalibrationChange`, `MarketRiskMeasureComputed`).

> Borderline calls made explicit: `IFRS9ECLPublished/Change` and `Ifrs9StageAssigned` are
> credit-risk GL figures → **bucket B**. `CapitalEvent` is capital/GL → **bucket B**.
> `CounterpartyExposureCalculated` is kept in **bucket A** as a counterparty-exposure
> *control/reporting* output (not a trade/position fold), but it sits adjacent to the SA-CCR/credit
> engine already migrated under bucket B — if the migration owner prefers, it folds into bucket B
> with the credit-limit family. It is the single most debatable inclusion.

### Bucket C — dispatch / RMS substrate (excluded by brief)

`AgentBriefIssued`, `AgentRunStarted/Completed`, all dispatch run-lifecycle events, and RMS
register-orchestration events. Scrooge owns the run lifecycle; out of scope per the brief.

---

## 4. Recommended pilot: `RwaComputed`

**One-line why:** the cleanest self-contained un-emittable `*Minor` money type — one schema, one
live emitter, one read projection, zero shared-infra collisions — so it establishes the
retired-by-construction pattern with the least surface, exactly as `posture` did for the money-free
pattern.

Assessment of the memory-flagged candidates:

| Candidate | Verdict | Reason |
|---|---|---|
| **`RwaComputed`** (regulatory-reporting) | ✅ **PILOT** | Single type; flat 4-field `*Minor` payload (`creditRwaMinor` / `marketRwaMinor` / `operationalRwaMinor` / `totalRwaMinor`); one emitter (`emitRwaComputed` in `platform/risk/rwa-computed-engine.ts`, called from `runtime/agents/bea-rwa-period-close.ts`); `latest-wins-per-key` replay; clear V2 decimal target; no cross-domain fan-out. Closest analogue to the financial wave's S2 `FxPositionRevalued`/`DailyPnLReportGenerated` retired-by-construction flips. |
| `CalculationPerformed` (model-risk) | ❌ reject | **Hardest, not cleanest.** Polymorphic `value` + string `unit` (money *and* non-money under one field); 2193 live events (real migration risk, not seeded); a clean MoneyWire lift requires per-unit discrimination (`"ZAR-minor"` → MoneyWire, `"pct"`/`"ratio"`/`"count"` → leave numeric). Good *second/third* target once the pattern is proven, not first. |
| `OperationalLossEvent` (op-risk) | ◻ batch-2 | Clean 2-field `*Minor` payload, but newer (FX held-dims sweep) and its emitter sits behind op-risk attestation gates — slightly more wiring than `RwaComputed`. Strong fast-follow. |
| `V2RiskAppetiteSet` (v2-banking) | ◻ batch-2 | Mis-named legacy `*Minor` type; the fix is a decimal-native **re-mint** (not a rename), which is a heavier change than a pure flip and touches the anchor standing-data seeds. Defer until the re-mint convention is set. |

---

## 5. Emission-path design for the `RwaComputed` pilot

This mirrors the financial wave's S2 retired-by-construction flips (recorded verbatim in
`platform/event-store/registry/missing-types.ts` on `FxPositionRevalued`) and reuses the
money-codec + dual-run + parity machinery built for credit-limit S4
(`scripts/backfill-credit-limit-v2-dual-run.ts`).

### 5.1 V2 decimal-native event type + codec

- **New type:** `RwaComputedV2` (suffix convention, as `CreditLimitApprovedV2`), declared in a new
  `platform/event-store/event-types/regulatory-reporting-v2.ts`, registered in
  `regulatory-reporting.ts` as `v2-parallel`.
- **Payload:** identical structure to `RwaComputed` except the four `*Minor` integer fields become
  **MoneyWire** fields typed `moneyWireSchema` (`platform/core/money-codec.ts`):
  `creditRwa`, `marketRwa`, `operationalRwa`, `totalRwa` → each `{ __money: "v1", amount: "<MAJOR>",
  currency: "ZAR" }`. Non-money fields (`asOf`, `entity`, model lineage, citations) copy verbatim.
- **Codec for backfill:** `moneyWireFromMinor(minorAmount, "ZAR")`
  (`platform/core/money-codec.ts:134`) — the same converter credit-limit S4 used. It produces the
  MAJOR-unit decimal string MoneyWire from the legacy minor integer. (For the *forward* live path,
  the V2 emitter computes in decimal natively via the decimal-engine, never round-tripping through
  minor.)

### 5.2 Where the V2 emission path is invoked (V2 becomes the live source)

- Add `emitRwaComputedV2` to a `rwa-computed-engine-v2.ts` (or extend the existing engine) that
  computes the four RWA figures **decimal-native** and emits `RwaComputedV2`.
- Re-point the single live caller — `runtime/agents/bea-rwa-period-close.ts` (`emitRwaComputed` at
  line ~141) — to the V2 emitter. After the flip, the period-close run emits **only** `RwaComputedV2`;
  the V1 `RwaComputed` path is dead (and un-emittable anyway). This is the "V2 sole live path"
  condition (RBC condition 2).

### 5.3 Historical backfill (idempotent, source-event-id keyed)

- Script: `scripts/backfill-rwa-computed-v2.ts`, added to the `ci:migrate` chain (package.json
  `ci:migrate`) so it runs after V1 seeds on a clean CI store.
- Shape (copying `backfill-credit-limit-v2-dual-run.ts`): scan every V1 `RwaComputed`; for each
  with no V2 counterpart, emit a `RwaComputedV2` carrying the MoneyWire conversion via
  `moneyWireFromMinor`, **reusing the source V1 event's provenance tag** plus a
  `bank:v1-source:<eventId>` tag. Idempotency key = the source V1 event id (`INSERT OR IGNORE` /
  tag-scan-and-skip), exactly as the posture and credit-limit backfills do.
- **Reality check (gap):** there are **0** live `RwaComputed` events, so this backfill is a no-op
  today. It exists for replay-safety the moment any historical RWA figures land. See §6.

### 5.4 Parity / coverage recon gate + flip criteria

- **Gate:** `recon:rwa-computed-v2-parity` (`platform/recon/rwa-computed-v2-parity.ts`), modelled on
  `posture-v2-parity.ts`: fold the latest-per-key RWA register from the V1 store and from the V2
  store, decode both sides to a common decimal shape, and assert equality. Because byte-parity
  across a unit change (minor int vs decimal string) is meaningless, the comparison is on the
  **decoded decimal value** (financial-wave precedent: `recon:fx-v2-parity` is structural, not
  byte, for the same reason).
- **Flip criteria — retired-by-construction (the four `D-V1-REMOVAL-FLIP-BASIS-RBC` conditions, each
  recorded on the registry row):**
  1. **V1 un-emittable:** `RwaComputed` requires numeric `*RwaMinor` → trips
     `recon:no-residual-minor-encoding` (no allowlist). ✅ verified.
  2. **V2 sole emittable path produces:** `bea-rwa-period-close.ts` emits `RwaComputedV2`; verified
     non-vacuous on the seeded store (gate asserts ≥1 V2 event with a decoded RWA).
  3. **V2 has own tests:** `rwa-computed-v2-parity` + engine unit tests.
  4. **Historical V1 replay-readable:** schema + decoder stay registered; old `RwaComputed` events
     replay unchanged.
- On all four holding (asserted by the gate on a clean store), flip `RwaComputed`
  `v1-only → v2-replaced`, make the gate **enforcing**, and **harden** the v1-only ratchet
  (`-1`). Ratchets only harden (Charter cmd 3).

### 5.5 Shared-infra collisions

Same hot files as every prior wave — coordinate / serialise:

- `platform/event-store/registry/index.ts` and the per-domain registry module (registration spread).
- `platform/event-store/registry/provenance-category.ts` — `RwaComputedV2` must be categorised
  (regulatory-reporting figures survive config-only purges → `"accounting"`/`"regulatory"`
  category) **before** seeding, or the seed is tagged `simulated`/scenario-required (the S3 posture
  defect: a new type missing from provenance-category breaks the seed). New event type = **3 sites**:
  registry + event-types module + provenance-category.
- `scripts/run-recon-suite.ts` (`platform/recon/run-recon-suite.ts`) — register the new gate.
- `package.json` `ci:migrate` — append the backfill script.
- ~~`ci:migrate` may rewrite `scripts/migrate/backfill-triage-log.md` → `git checkout --` it before
  commit.~~ — **resolved:** the triage log now writes to gitignored `.local/` and is no longer
  tracked, so `ci:migrate` cannot dirty the tree (Engineering Charter cmd 9).

### 5.6 Batching order for the rest of bucket A

1. **Pilot:** `RwaComputed` (proves RBC for `*Minor` non-financial).
2. **Batch 2 — remaining `*Minor`:** `OperationalLossEvent`, then `V2RiskAppetiteSet` (the latter as
   a decimal-native re-mint, separate convention decision).
3. **Batch 3 — emittable numeric-money (AML / privacy / governance):** `STRCandidate`,
   `RelatedPartyTransactionProposed`, `InterEntityTransactionProposed`, `PAIARequest` — these are
   *not* gate-blocked, so they can dual-write + (decoded) parity, closer to the money-free pattern,
   but still lift `amount`/`fee` to MoneyWire.
4. **Batch 4 — conduct / climate / correspondent:** `FeeDisclosureEvent`, `ClimateScenarioRun`,
   `CorrespondentSettlementInstructionSent`, `NostroStatementReceived`,
   `CounterpartyExposureCalculated` (or fold the last into bucket B with the credit family).
5. **Last — `CalculationPerformed`:** the only data-rich type and the hardest (polymorphic
   `value`/`unit`); migrate once the pattern is fully proven, with per-unit discrimination.

---

## 6. Honest gaps (Charter cmd 5 — no concealment)

1. **★ Biggest gap — data-empty in build phase (12 of 13 types have 0 live events).** Only
   `CalculationPerformed` (2193) has real data. Every other bucket-A type — including the pilot
   `RwaComputed` — is **seeded-only / data-empty**, exactly as capital was before its migration. A
   parity gate over an empty population is **vacuously green**. Consequence: the pilot flip cannot
   honestly rest on a byte/decoded-parity assertion (there is nothing to compare). It must rest on
   the **retired-by-construction construction conditions** (V1 un-emittable + V2 is the sole live
   emitter path), with the parity gate as standing evidence that activates *if/when* RWA figures are
   produced. The flip is correct; the *evidence shape* is "construction", not "parity over data".
   This must be stated on the Decision and the registry row, not papered over.

2. **`CalculationPerformed` is emittable today and slips the `*Minor` gate.** Its money lives in a
   numeric `value` field tagged `unit: "ZAR-minor"` (string), so the gate — which keys on the
   *field name* ending in `Minor`, not the unit string — never fires. There are 2193 such live
   events with `unit: "ZAR-minor"`. This is a latent decimal-correctness hole independent of the V2
   migration, and the type is the costliest to migrate (mixed money/non-money under one field). It
   should be flagged to Nadia (model validation) / Camille (CFO) as a trusted-figures correctness
   item regardless of migration cadence.

3. **`V2RiskAppetiteSet` is a mis-named legacy type.** A `V2`-named, `*Minor`-encoded type is a trap:
   a future reader assumes it is already decimal-native. The clean fix is a decimal-native re-mint
   under a new name, retiring the mis-named one — heavier than a flip and touching the anchor
   standing-data seeds. Needs its own small convention Decision.

4. **`CounterpartyExposureCalculated` bucket boundary is genuinely ambiguous.** It is a
   counterparty-exposure control output adjacent to the already-migrated credit-limit/SA-CCR family
   (bucket B). Including it in A vs B is a migration-owner call; this note keeps it in A but flags it
   as the single most debatable inclusion.

5. **`missing-types.ts` still houses schema-bearing placeholders.** Several bucket-A and bucket-B
   types are registered in `missing-types.ts` (the F-032 coverage backfill) rather than a typed
   per-domain module, even though they now carry full Zod schemas. The migration is a natural moment
   to relocate each migrated type to its proper domain module — tracked, not blocking.
