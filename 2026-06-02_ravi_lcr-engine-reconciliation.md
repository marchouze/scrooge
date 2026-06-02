---
title: "LCR Engine Reconciliation — Tile (computeLCR/ALM) vs BA 325 Return"
author: "Ravi (Treasury / ALM engineer, engineering)"
date: "2026-06-02"
workstream: "WS-LCR-ENGINE-RECONCILIATION"
brief: "brief:ravi:reconcile-the-two-lcr-engines-recommend-canonica:2026-06-02"
authority: "D-LCR-TILE-PROVENANCE"
register: "documents"
classification: "engineering-analysis"
status: "for-governance-review"
reviewers:
  - "Eitan (Treasurer, governance) — LCR methodology owner; canonical-source decision"
  - "Helena (Chief Risk Officer, governance) — RAS / liquidity appetite owner"
citations:
  - "D-LCR-TILE-PROVENANCE"
  - "D-PROVENANCE-FILTER-ENFORCEMENT"
  - "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN"
  - "Regulations Relating to Banks Reg 26"
  - "Regulations Relating to Banks Reg 26A"
  - "BCBS D295"
---

# LCR Engine Reconciliation

## 0. Executive summary

The bank computes its Liquidity Coverage Ratio through **two independent engines that, on the same event store at the same as-of, see disjoint event universes and produce non-comparable results**:

| | Dashboard **LCR (T+30) tile** | **BA 325** regulatory return |
|---|---|---|
| Engine | `computeLCR` over `getALMPositionSnapshot` | `generateBa325Lcr` / `generateBa325LcrWithEvents` |
| Result on home store @ `2026-06-02T17:46Z` | **HQLA R50,043,950 / net-outflow R35,000,000 → LCR 142.98%** | **HQLA R0 / net-outflow R0 → LCR ∞, `completenessClass: "empty"`** |
| Denominator events | `DepositTaken`, `FundingLineDrawn`, `SettlementInstructionIssued`, `InterbankLoanPlaced`, buy-side `TradeBooked` | `FxSettlementInstructed`, `TradeMatured`, `EquitySettlementInstructed` |
| Provenance treatment | keep `production` + `simulated`; **drop `build-phase-fixture`** (`liveFlowView`) | `production-only` → keep `production` + `build-phase-fixture`; **drop `simulated`** |
| Numerator (HQLA) | repo-cash + `BondTradeExecuted` + `CollateralInventorySnapshotted` folds | instrument-level positions × SecurityMaster + custodian-derived cash, off the **trial balance** |
| Entity scope | (was) **store-wide, no filter** → now `LE-ZA-HOZ-BANK` (this PR) | `LE-ZA-HOZ-BANK` only, enforced (`assertBankEntity`) |

The gap is **not a calibration difference** — it is structural: the two engines are wired to different event vocabularies and **opposite provenance axes**, so they will almost never agree by construction. The same 34 `FxSettlementInstructed` events that the BA 325 engine drops (all `simulated`) would, if admitted, swing its net-outflow from R0 to **R265.6bn** (combined-mode reproduction) — i.e. the divergence is order-of-magnitude, not marginal.

**Recommendation:** designate the **BA 325 generator (`generateBa325Lcr`) as the single canonical LCR engine** for both the regulatory return and the dashboard tile, and converge the tile onto a **shared LCR core** rather than maintaining the parallel `computeLCR`/ALM path. This run does **not** perform that merge (it needs Eitan + Helena sign-off on the canonical designation and the tile's provenance policy); it ships the analysis, the quantified gap, the convergence path, and one safe scoped fix (entity-scoping the tile).

---

## 1. Side-by-side divergence map (file:line cited)

### 1.1 Entry points

- **Tile:** `dashboard/server.ts:367` `buildLiquidityMetrics` and `dashboard/server.ts:390` `buildTreasuryMetrics` → `getALMPositionSnapshot(eventStore, nowUtc(), 30)` (`platform/projections/alm-positions.ts:793`) → `computeLCR(...)` (`platform/liquidity/lcr.ts:138`).
- **Return:** `platform/returns/ba325/period-close-subscriber.ts:309` `generateBa325Lcr({...})` (`platform/reporting/ba-325-lcr.ts:890`), triggered by `AccountingPeriodClosed` for `LE-ZA-HOZ-BANK`.

### 1.2 Numerator (HQLA stock)

| Aspect | Tile (`alm-positions.ts`) | BA 325 (`ba-325-lcr.ts` / subscriber) |
|---|---|---|
| Source | `readHQLAFromEventStore` (`:231`): latest `CollateralInventorySnapshotted` **or** `TradeBooked`/`TradeSettled` fold, **plus always-on** repo-cash (`RepoTradeOpened.startLegCashZar`, `:296`) and `BondTradeExecuted` bond inventory (`:324`) | `hqlaStock` = instrument-level positions × SecurityMaster (`computeHqlaStockFromPositions`, subscriber `:282`) + `cashHqlaLines` custodian-derived (`:302`); fallback = trial-balance × `AccountLiquidityClassification` |
| Haircuts | applied in `computeLCR` (`lcr.ts:175`, `HAIRCUT_RATES`) | applied in `computeHqlaStockFromPositions` / `applyHqlaCaps` (`ba-325-lcr.ts:568`) |
| Caps (L2 40% / L2b 15%) | `lcr.ts:195`–`219` (L1-relative form) | `ba-325-lcr.ts:568` `applyHqlaCaps` (closed-form S-regimes) |
| Units | ZAR **major** (rands) | ZAR **minor** (cents) |

Both apply the same regulatory haircut/cap calibration; they disagree on **what positions are in scope** and how cash HQLA is sourced (repo-cash + bond folds vs custodian-cash + instrument positions).

### 1.3 Denominator (30-day net cash outflow)

| Aspect | Tile | BA 325 |
|---|---|---|
| Outflow events | `DepositTaken` (`:435`), `FundingLineDrawn` (`:457`), `InterbankLoanPlaced` (`:484`, as `inflow-contractual`), `SettlementInstructionIssued` (`:605`), buy-side `TradeBooked` w/ explicit `settlementDate` (`:567`) | `FxSettlementInstructed`, `TradeMatured`, `EquitySettlementInstructed` (`foldSettlementCashFlows`, `:673`/`:709`) |
| Run-off calibration | per-category run-off rates (`lcr.ts:71` `RUNOFF_RATES`); `FundingLineDrawn`/SI bucketed `wholesale-non-operational` (100%) | **none** — the raw `netCash` sign of the settlement event is taken at face value (`amountMinor < 0` = outflow); no run-off weighting |
| Inflow cap | 75% of outflows (`lcr.ts:247`) | 75% of outflows (`ba-325-lcr.ts:1256`) |
| Net-outflow floor | **none** | 25%-of-gross-outflows floor (`ba-325-lcr.ts:1260`) per Reg 26(11) |
| Window | `[asOf, asOf+horizonDays]` for settlement legs only; deposits/funding lines counted while open regardless of maturity date | `[periodStart, periodEnd]` on `as_of` for **all** flows; frozen-cursor `untilSequence` bound |
| Multi-currency | folds are ZAR-only (amounts already ZAR) | functional-currency (ZAR) legs only; **foreign legs silently dropped** + flagged placeholder (`:1235`) |

These are **different definitions of "30-day outflow,"** not two implementations of one definition. The BA 325 path is the Principle-1-correct one for settlement cash flows (folds primary settlement events, not GL); the ALM path models contractual/behavioural run-off (deposits, funding lines) the BA 325 path does not see at all.

### 1.4 Provenance treatment (opposite axes)

- **Tile** — `liveFlowView` (`alm-positions.ts:214`) drops only `build-phase-fixture`; keeps `production` **and** `simulated`. Rationale in-code: "every flow someone actually booked, real or rehearsed, but nothing the seed harness fabricated" (D-LCR-TILE-PROVENANCE, PR #1003).
- **BA 325** — `defaultProvenanceFilter()` = `production-only` (`filter.ts:124`), which during build-phase **admits `production` + `build-phase-fixture`** and **drops `simulated`** (`filter.ts:155`-`164`). Applied in `foldSettlementCashFlows` (`ba-325-lcr.ts:701`).

The two filters are **mutually exclusive on simulated and fixture events**: an event tagged `simulated` is in the tile and out of BA 325; an event tagged `build-phase-fixture` is out of the tile and in BA 325. Only `production`-tagged events appear in both — and there are currently **zero** production-tagged LCR-feed events in the home store.

### 1.5 Entity scope

- **BA 325** — `LE-ZA-HOZ-BANK` only; `assertBankEntity` (`ba-325-lcr.ts:520`) throws on any other entity; `foldSettlementCashFlows` replays `{ entity, asOf: periodEnd }` (`:709`); `BA_325_BANK_ENTITIES = ["LE-ZA-HOZ-BANK"]` (`:518`).
- **Tile** — **was store-wide**: `getALMPositionSnapshot` folded the whole store with no entity predicate. **Fixed in this PR** (§4) to scope the LCR-feeding folds to `LE-ZA-HOZ-BANK`, matching BA 325. The ASF/RSF capital reads remain store-wide by design (the founding `CapitalEvent` is on the legacy `LE-BANK-SA` identifier — see §3.3 data-quality finding).

---

## 2. Quantified reproduction (home store, same as-of)

Both engines reproduced read-only against `$HOME/.local/share/bank/event.db` (62,184 events) at `asOf = 2026-06-02T17:46:38Z`.

### 2.1 Event-universe census (LCR-relevant types)

| Event type | Count | Provenance | Entity | In tile? | In BA 325? |
|---|---|---|---|---|---|
| `DepositTaken` | 2 | 1 fixture, 1 simulated | 1 `LE-BANK-SA`, 1 `LE-ZA-HOZ-BANK` | sim one only | neither (fixture is `LE-BANK-SA`; sim dropped) |
| `FundingLineDrawn` | 1 | fixture | `LE-BANK-SA` | no | no¹ |
| `SettlementInstructionIssued` | 1 | simulated | `LE-ZA-HOZ-BANK` | **yes** | no (not a BA 325 source type) |
| `InterbankLoanPlaced` | 2 | fixture | `LE-BANK-SA` | no | no¹ |
| `BondTradeExecuted` | 2 | simulated | `LE-ZA-HOZ-BANK` | **yes (HQLA)** | no (not a BA 325 source type) |
| `RepoTradeOpened` | 1 | fixture | `LE-BANK-SA` | no | no¹ |
| `CollateralInventorySnapshotted` | 1 | simulated | `LE-ZA-HOZ-BANK` | **yes (HQLA)** | n/a |
| `FxSettlementInstructed` | 34 | **all simulated** | `LE-ZA-HOZ-BANK` | no (not an ALM source type) | **dropped — all simulated** |
| `TradeMatured` | 0 | — | — | — | — |

¹ Not a BA 325 source type **and** dropped by the entity/provenance filter even if it were.

### 2.2 Tile engine result

```
HQLA positions : [L1 R93,950 (repo-cash), L1 R49,950,000 (bond)]
Funding        : [R10,000,000 wholesale-non-op (DepositTaken sim),
                  R25,000,000 wholesale-non-op (SettlementInstructionIssued sim)]
hqlaZar             50,043,950
netCashOutflowsZar  35,000,000   (both outflows @ 100% run-off; no inflows)
lcrRatioPct         142.98%      status: above-minimum
```

### 2.3 BA 325 engine result (production-only default, entity LE-ZA-HOZ-BANK)

```
totalStockHqla      R0           (no TrialBalanceSnapshotted / hqlaStock in store)
grossOutflows       R0
netCashOutflows     R0
lcrRatio            Infinity     lcrCompliant: true
inputCompleteness   { hqlaInputsFound:0, outflowInputsFound:0, inflowInputsFound:0,
                      excludedByFilter:34, excludedReasons:{ "provenance-filter":34 },
                      completenessClass:"empty" }
```

**All 34 `FxSettlementInstructed` events are excluded by the provenance filter** (every one is `simulated`); the BA 325 engine therefore sees an empty denominator and reports `∞ / empty`.

### 2.4 The same settlements in combined mode

Re-running the BA 325 cash-flow fold under `combined` mode (admitting simulated) to size what is being dropped:

```
grossOutflows       R1,062,524,139,726.77
grossInflows        R1,912,408,071,626.96
netCashOutflows     R265,631,034,931.70
excludedReasons     { "foreign-currency-leg":22 }   (22 of 34 all-foreign-leg, dropped at the ZAR filter)
completenessClass   partial
```

So the divergence between the two engines on this store is not a few percent — it is **R35.0m (tile) vs R0 (BA 325 as-run) vs R265.6bn (BA 325 if simulated admitted)**. They are measuring different things on different data.

---

## 3. Findings

### 3.1 Finding A — opposite provenance axes (primary)
The tile and BA 325 select **disjoint, near-complementary** slices of the store. With today's all-`simulated` FX settlement flow, the regulatory engine is structurally blind to the only continuous cash-flow feed the bank has, while the tile is blind to all `build-phase-fixture` opening state. Neither is "wrong" for its stated purpose, but they cannot be reconciled to each other without a single agreed provenance policy. **This is the canonical-source decision Eitan + Helena must take.**

### 3.2 Finding B — disjoint denominator vocabularies
The ALM path models deposit/funding-line/IBL run-off (the behavioural liability side) and never sees FX/securities settlement legs; the BA 325 path models settlement cash flows and never sees deposits or funding lines. **A correct LCR needs both.** Whichever engine is canonical must fold the union: behavioural run-off **and** contractual settlement legs.

### 3.3 Finding C — `LE-BANK-SA` vs `LE-ZA-HOZ-BANK` identifier split (data quality)
The only `CapitalEvent` and all `build-phase-fixture` funding events sit on the legacy `LE-BANK-SA` identifier, while live (simulated) flows and the SecurityMaster instruments sit on `LE-ZA-HOZ-BANK`. This is why the entity-scoping fix in §4 deliberately scopes **only the LCR-feeding folds** and leaves the ASF/RSF capital read store-wide — scoping the whole snapshot to `LE-ZA-HOZ-BANK` would zero Tier-1 ASF. **Recommend a data-quality remediation to re-tag/rebook the `LE-BANK-SA` events onto `LE-ZA-HOZ-BANK`, after which capital reads can also be entity-scoped.** Routed to Bea (Accounting & financial reporting engineer, engineering) + Ravi.

### 3.4 Finding D — BA 325 has no run-off weighting; ALM has no net-outflow floor
BA 325 takes settlement `netCash` at face value (no run-off %), whereas the ALM engine applies BA 325 run-off rates. Conversely the ALM `computeLCR` omits the 25%-of-gross-outflows floor (Reg 26(11)) that BA 325 applies (`ba-325-lcr.ts:1260`). A shared core must carry both the run-off table **and** the floor.

---

## 4. Scoped code fix shipped in this PR — entity-scope the tile

The tile's store-wide fold is a latent defect (Finding C / brief item 5): a non-fixture flow on a sibling legal entity would silently leak into the bank LCR. **Verified no such leakage exists today** (zero non-fixture LCR-feed events on entities other than `LE-ZA-HOZ-BANK`), so the fix is **figure-neutral on the current store** while closing the latent hole.

- `platform/projections/alm-positions.ts` — `liveFlowView(store, entity?)` now injects an `entity` predicate into the proxied `replay` (in addition to dropping `build-phase-fixture`); `getALMPositionSnapshot` / `readHQLAFromEventStore` / `buildFundingPositions` / `buildSettlementOutflows` take an optional `entity`. **Omitting it preserves the legacy store-wide behaviour** — every existing caller / test is unaffected. The ASF/RSF capital reads are intentionally NOT scoped (Finding C).
- `dashboard/server.ts` — `buildLiquidityMetrics` + `buildTreasuryMetrics` now pass `"LE-ZA-HOZ-BANK"`.
- `platform/projections/alm-positions.test.ts` — regression: a sibling-entity (`LE-ZA-HOZ-SECURITIES`) deposit leaks into the store-wide snapshot but is excluded from the `LE-ZA-HOZ-BANK`-scoped snapshot.

This is **not** the engine merge — it only aligns the tile's entity scope to BA 325's.

---

## 5. Recommendation — canonical source

1. **Canonical engine: `generateBa325Lcr` (BA 325).** It is the Principle-1-correct, per-entity, regulator-shaped computation (settlement-event cash flows; instrument-level HQLA; caps + inflow cap + net-outflow floor; input-completeness disambiguation of "no-data" vs "no-stress"). The regulatory return must be authoritative; the tile must not be a second source of truth for the same number.
2. **The tile renders the canonical engine, not a parallel one.** Converge `buildLiquidityMetrics`/`buildTreasuryMetrics` onto a **shared LCR core** that `generateBa325Lcr` also calls, so the tile and the BA 325 return are the *same* computation at different cadences/granularities. Retire the divergent `computeLCR`/ALM-denominator path once the shared core folds the union of denominator events (Finding B/D).
3. **The shared core must fold the union of inputs:** behavioural run-off (`DepositTaken`/`FundingLineDrawn`/`InterbankLoanPlaced`, with the run-off table) **and** contractual settlement legs (`FxSettlementInstructed`/`TradeMatured`/`SettlementInstructionIssued`), apply the BA 325 caps + 75% inflow cap + 25% net-outflow floor.
4. **Provenance policy is a governance decision, deliberately not pre-decided here.** D-LCR-TILE-PROVENANCE governs the *tile* (keep simulated, drop fixture). The *regulatory return* legitimately uses `production-only`. A bank that is pre-commencement with only simulated flows will show `∞ / empty` on the regulatory engine and a populated ratio on the tile — that is arguably correct (no production flows yet) but must be an explicit, signed-off policy, not an accident of two filters pointing opposite ways. **Decision owners: Eitan (return provenance) + Helena (appetite-watch provenance).**

---

## 6. Convergence path — engineering vs governance split

### 6.1 Governance decisions required first (Eitan / Helena)
- **G1 (Eitan, Treasurer):** ratify `generateBa325Lcr` as the single canonical LCR engine; the tile becomes a render of it.
- **G2 (Eitan + Helena):** set the provenance policy for (a) the regulatory return and (b) the appetite-watch tile — same or deliberately different, documented either way.
- **G3 (Helena, CRO):** confirm the RAS liquidity appetite line reads the canonical engine's output (not the legacy `computeLCR`), and how it should treat the `empty`/`∞` build-phase state.
- **G4 (Eitan):** confirm the denominator vocabulary the shared core must fold (Finding B/D union) and the run-off calibration.

### 6.2 Engineering (Ravi — follow-on, gated on G1–G4)
- **E1:** extract a shared `computeLcrCore(inputs)` that both `generateBa325Lcr` and the tile call; inputs = HQLA stock + folded denominator with run-off + caps + inflow cap + net-outflow floor.
- **E2:** widen the BA 325 denominator fold to include the behavioural run-off events (`DepositTaken`/`FundingLineDrawn`/`InterbankLoanPlaced`) and `SettlementInstructionIssued`, with the run-off table, per G4.
- **E3:** rewire `buildLiquidityMetrics`/`buildTreasuryMetrics` to call the shared core (via a tile-facing wrapper at the agreed cadence/granularity); retire `computeLCR`'s independent ALM denominator.
- **E4:** add a `recon:lcr-engine-parity` gate asserting tile-LCR == BA-325-LCR for the bank entity at a given as-of under the agreed provenance policy (catch regressions of the two re-diverging).
- **E5 (Finding C, with Bea):** remediate the `LE-BANK-SA` → `LE-ZA-HOZ-BANK` identifier split, then entity-scope the ASF/RSF capital reads too.

### 6.3 Shipped now (this PR)
- Tile entity-scoping (§4) + regression test. Figure-neutral; closes the latent cross-entity leak; aligns the tile's entity axis to BA 325 ahead of the full merge.

---

## 7. Citations
- D-LCR-TILE-PROVENANCE (CEO directive, 2026-06-02; PR #1003 `c3ebec84`)
- D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12)
- D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
- Regulations Relating to Banks Reg 26 (LCR), Reg 26A (NSFR)
- BCBS D295
- brief:ravi:reconcile-the-two-lcr-engines-recommend-canonica:2026-06-02
