---
title: "Canonical-LCR-Engine Recommendation (G1–G4) for CEO Ratification"
author: "Office of the Treasurer (governance)"
date: "2026-06-02"
workstream: "WS-LCR-ENGINE-RECONCILIATION"
brief: "brief:eitan:joint-canonical-lcr-engine-recommendation-for-ce:2026-06-02"
authority: "D-LCR-TILE-PROVENANCE"
register: "documents"
classification: "governance-recommendation"
status: "for-ceo-ratification"
run-role-class: "decider"
independent-review: "Chief Risk Officer (governance) — reviewer-class; this recommendation does not finalise until the CRO challenge lands"
decision-support-for:
  - "Chief Executive Officer — ratification authority (crosses RAS thresholds)"
upstream-deliverable: "record:documents:ravi:lcr-engine-reconciliation:2026-06-02 (PR #1004, 9ec730ae)"
citations:
  - "D-LCR-TILE-PROVENANCE"
  - "D-PROVENANCE-FILTER-ENFORCEMENT"
  - "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN"
  - "D-BUILD-PHASE-SYNTHETIC-RESPONSE"
  - "Regulations Relating to Banks Reg 26"
  - "Regulations Relating to Banks Reg 26A"
  - "BCBS D295"
  - "brief:eitan:joint-canonical-lcr-engine-recommendation-for-ce:2026-06-02"
  - "brief:ravi:reconcile-the-two-lcr-engines-recommend-canonica:2026-06-02"
---

# Canonical-LCR-Engine Recommendation (G1–G4)

**For:** Chief Executive Officer — ratification
**From:** Office of the Treasurer (governance) — canonical liquidity-reporting authority, decider-class
**Independent review:** Office of the Chief Risk Officer (governance) — reviewer-class; finalises only after CRO challenge
**Upstream:** LCR Engine Reconciliation by the Treasury / ALM engineering function (Ravi, Treasury / ALM engineer, engineering — PR #1004, `9ec730ae`; record `record:documents:ravi:lcr-engine-reconciliation:2026-06-02`)
**Authority cited:** D-LCR-TILE-PROVENANCE (CEO directive, 2026-06-02)

---

## 0. Decision in one page

The Treasury / ALM engineering reconciliation is **accepted in full**. The two LCR engines are structurally disjoint — different event vocabularies on opposite provenance axes — not miscalibrated. I have independently re-verified the engine wiring at `file:line` and reproduced the event census read-only against the home store (`$HOME/.local/share/bank/event.db`, 62,415 events @ `2026-06-02`); the figures stand.

| Item | Recommended option | Who settles |
|---|---|---|
| **G1 — Canonical engine** | Designate **`generateBa325Lcr` (BA 325) as the single canonical LCR engine**; the dashboard tile becomes a **faithful render of the same shared core**, not a parallel engine. | **CEO ratification** (Treasurer recommends; crosses RAS) |
| **G2 — Provenance policy** | **Regulatory return = `production-only`** (admits `production` + `build-phase-fixture`, drops `simulated`). **Tile = prod + simulated, no fixtures** (D-LCR-TILE-PROVENANCE, unchanged). Deliberately different, each documented with its regulatory rationale. | **Return policy: Treasurer authority.** Tile policy already CEO-set (D-LCR-TILE-PROVENANCE). **CEO notes the divergence.** |
| **G3 — RAS appetite line** | RAS liquidity appetite line **reads the canonical engine** (post-convergence). Build-phase `∞ / empty` and the R265.6bn combined-mode figure are **watch-only / excluded from breach-triggering**, surfaced via the build-phase-synthetic-response standard. **Binding RAS ruling deferred to the CRO** (owns the appetite line). | **CRO rules** (binding); Treasurer states view; **CEO ratifies the canonical-source link** |
| **G4 — Denominator vocabulary + calibration** | Confirm the **union vocabulary** (behavioural run-off **+** contractual settlement legs). Run-off / haircut / cap calibration in `financial-constants.ts` is **correct but incomplete**: the **25% net-outflow floor and 75% inflow-cap are hardcoded literals in BA 325, not constants** — must be promoted to CFO-owned constants in the convergence. | **Treasurer authority** to confirm vocabulary; **calibration-completeness fix routed to CFO** |

**No engine convergence is implemented in this run.** That is the gated engineering work (E1–E5) that begins only after CEO ratification of G1 and the CRO ruling on G3.

---

## 1. Why this crosses my desk and the CEO's

The Treasurer holds canonical liquidity-reporting authority, so the **canonical-source designation (G1)** and the **return provenance policy (G2-return)** are mine to recommend and, for G2-return, to settle. But the bank's LCR is a **RAS-threshold metric**: whether the "real" LCR is a comfortable 143% (tile) or a potential material breach (R265.6bn combined-mode denominator) is exactly the kind of question that crosses the risk-appetite boundary. Designating which engine is authoritative therefore needs **CEO ratification**, and the **appetite-line ruling (G3) belongs to the CRO**, who owns the RAS liquidity line. This memo settles what I can under Treasurer authority and routes the rest with a clear recommended option so the CEO and the CRO can act cold.

---

## 2. Verified ground truth (independent reproduction)

I did not take the reconciliation on trust. The following are re-verified by me against live source and the home store.

### 2.1 The two engines, `file:line` confirmed

- **Tile** — `computeLCR` (`platform/liquidity/lcr.ts:138`) over `getALMPositionSnapshot` (`platform/projections/alm-positions.ts:793`); provenance via `liveFlowView` (`alm-positions.ts:214`) drops `build-phase-fixture`, keeps `production` + `simulated`. Run-off / haircut / caps / inflow-cap all read from `financial-constants.ts` (`lcr.ts:71` `RUNOFF_RATES = lcrRunoffRates()`, `:79` `HAIRCUT_RATES = lcrHaircutRates()`, `:206`-equivalent `lcr.inflow-recognition-cap`). **Step 3 net-outflow has no 25% floor** (`lcr.ts` — `netCashOutflows = Math.max(stressedOutflows − recognisedInflows, 0)`). Confirmed.
- **Return** — `generateBa325Lcr` (`platform/reporting/ba-325-lcr.ts:890`), driven by `AccountingPeriodClosed` for `LE-ZA-HOZ-BANK` (`platform/returns/ba325/period-close-subscriber.ts:309`); provenance via `defaultProvenanceFilter()` = `production-only` (`platform/projections/filter.ts:124`), which during build-phase **admits `production` + `build-phase-fixture`, rejects `simulated`** (`filter.ts:147`–`164`). Inflow-cap and net-outflow floor are **hardcoded** `0.75` / `0.25` literals at `ba-325-lcr.ts:1256` and `:1260` (`floor = Math.ceil(0.25 * grossOutflows)`), **not** `financial-constants.ts` reads. Confirmed.

The two provenance filters are **near-complementary**: a `simulated` event is in the tile and out of the return; a `build-phase-fixture` event is out of the tile and in the return. Only `production`-tagged events appear in both — and there are **zero** production-tagged LCR-feed events in the store.

### 2.2 Event census (re-run read-only, home store @ 2026-06-02)

| Event type | Count | Provenance | Entity |
|---|---|---|---|
| `FxSettlementInstructed` | 34 | all `simulated` | `LE-ZA-HOZ-BANK` |
| `SettlementInstructionIssued` | 1 | `simulated` | `LE-ZA-HOZ-BANK` |
| `DepositTaken` | 2 | 1 fixture, 1 simulated | 1 `LE-BANK-SA`, 1 `LE-ZA-HOZ-BANK` |
| `FundingLineDrawn` | 1 | fixture | `LE-BANK-SA` |
| `InterbankLoanPlaced` | 2 | fixture | `LE-BANK-SA` |
| `BondTradeExecuted` | 2 | simulated | `LE-ZA-HOZ-BANK` |
| `CollateralInventorySnapshotted` | 1 | simulated | `LE-ZA-HOZ-BANK` |
| `TradeMatured` | 0 | — | — |

This is identical to the reconciliation's §2.1 — the census is stable. The consequence is stark: **the only continuous cash-flow feed the bank produces today is 34 `FxSettlementInstructed`, all `simulated`** — visible to neither engine in its as-run configuration (not an ALM source type for the tile; dropped as `simulated` by the BA 325 production-only filter). The tile's 143% rests on one simulated deposit + one simulated settlement instruction; the return's `∞ / empty` rests on seeing nothing at all.

### 2.3 The order-of-magnitude swing is real

Admitting the 34 simulated FX settlements to the BA 325 denominator (combined mode) swings net cash outflow from **R0 → R265.6bn** (with 22 of 34 all-foreign-leg flows dropped at the ZAR filter, `ba-325-lcr.ts:1228`). So the bank's LCR on the same store at the same as-of is **R35.0m outflow / 143% (tile)** vs **R0 / ∞ (return as-run)** vs **R265.6bn (return if simulated admitted)**. The number is engine- and policy-dependent, not data-dependent. That is precisely why a single canonical source must be designated.

---

## 3. G1 — Canonical engine

**Recommended (mark: Recommended): Designate `generateBa325Lcr` (BA 325) as the single canonical LCR engine. The dashboard tile becomes a faithful render of the same shared core — not a permitted parallel computation.**

Rationale:
- BA 325 is the **Principle-1-correct, regulator-shaped** computation: per-entity (`assertBankEntity`, `ba-325-lcr.ts:520`), instrument-level HQLA off positions × SecurityMaster, the full BA 325 cap stack + 75% inflow cap + **25% net-outflow floor** (Reg 26(11)), and an input-completeness block that distinguishes "no-data" from "no-stress". The regulatory return is the number the bank is accountable for to the PA; it must be the source of truth, and the tile must not be a *second* authority for the same metric (single-graph discipline, Principle 2).
- The tile's value is **cadence and behavioural coverage** (it folds deposit/funding-line/IBL run-off the return never sees), not a competing definition. The convergence preserves that coverage by widening the canonical denominator (see G4), not by keeping two engines.
- **The tile may keep a simplified *render* (presentation cadence/granularity), but not a simplified *computation*.** Post-convergence the tile must call the shared `computeLcrCore` so tile-LCR and BA-325-LCR are the *same* arithmetic under their respective provenance policies, enforced by a `recon:lcr-engine-parity` gate (Ravi's E4). A simplified render that recomputes is how the two engines diverged in the first place.

Alternatives considered:
1. *Tile (`computeLCR`/ALM) as canonical.* **Rejected.** It lacks the net-outflow floor, omits instrument-level HQLA off the SecurityMaster, and is not the regulator-facing artefact. Making the dashboard convenience-engine authoritative inverts the trust hierarchy.
2. *Keep both, reconcile by report.* **Rejected.** Two engines on opposite provenance axes will re-diverge by construction every time the event mix shifts; a periodic reconciliation report institutionalises the divergence rather than closing it.

Commits the bank to: a shared `computeLcrCore` that both the return and the tile call; retirement of the independent `computeLCR` ALM denominator; a parity recon gate. **Settlement: CEO ratification** (Treasurer recommends).

---

## 4. G2 — Provenance policy (return vs tile)

**Recommended (mark: Recommended): The regulatory return and the tile use deliberately *different* provenance universes, each documented:**

- **Regulatory return = `production-only`** (`defaultProvenanceFilter()`): admits `production` + `build-phase-fixture` during build phase, **drops `simulated`** (`filter.ts:147`–`164`). Unchanged.
- **Dashboard tile = production + simulated, no fixtures** (`liveFlowView`), exactly as **D-LCR-TILE-PROVENANCE** already directs. Unchanged.

Regulatory-defensibility rationale:
- The **return must never count simulated flows.** A regulatory LCR that admitted rehearsed/test events would be a misstatement to the PA. `production-only` is the only defensible basis for the return; that it currently shows `∞ / empty` is **correct** — the bank has no production liquidity flows yet (pre-commencement). An empty regulatory LCR pre-commencement is an accurate statement of "no production book", not a defect.
- The **tile must show the rehearsed book** so Treasury and Risk can see the bank's liquidity posture as it would be if today's simulated flows were live. Admitting `simulated` and excluding seed `build-phase-fixture` is the right lens for **operational situational awareness**, which is the tile's job. This is exactly the intent of D-LCR-TILE-PROVENANCE.
- The divergence is therefore **principled, not accidental**: the two surfaces answer two different questions ("what is our regulatory LCR?" vs "what would our LCR be on the book we are rehearsing?"). The failure mode the reconciliation flagged — two filters silently pointing opposite ways with nobody having decided so — is cured by making the divergence an **explicit, signed-off policy**.

Alternatives considered:
1. *Both surfaces `production-only`.* Defensible for the return; makes the tile blind to the entire rehearsed book during build phase (it would also read `∞ / empty`), destroying its situational-awareness value. **Rejected for the tile.**
2. *Both surfaces prod + simulated.* Would let simulated flows into the **regulatory return** — a misstatement. **Rejected outright for the return.**

Commits the bank to: documenting that the regulatory return and the appetite-watch tile read different provenance universes by design; a build-phase note on the tile explaining why its ratio differs from the BA 325 return.

**Settlement:** the **return provenance policy is settled under Treasurer authority** (it is the canonical-reporting basis, my seat). The **tile policy is already CEO-set** (D-LCR-TILE-PROVENANCE). The CEO need only **note the deliberate divergence** at ratification. The provenance lens used for the **appetite-watch** specifically is the CRO's to confirm (see G3).

---

## 5. G3 — RAS appetite line

**Recommended (mark: Recommended): The RAS liquidity appetite line reads the *canonical* engine's output (post-convergence — i.e. the BA 325 shared core), not the legacy `computeLCR`. During the build phase the `∞ / empty` (production-only) and the R265.6bn combined-mode figures are treated as *watch-only* — surfaced, never silenced, but excluded from breach-triggering — via the build-phase-synthetic-response standard. The binding RAS ruling is deferred to the Chief Risk Officer (governance), who owns the appetite line.**

My view (non-binding; the CRO rules):
- The appetite line must read **one** engine, and it must be the **canonical** one (G1). Today it reads the tile's `computeLCR`; post-convergence it should read the shared core under the **appetite-watch provenance lens** (prod + simulated, so the appetite line *can see* the rehearsed book — an all-`production-only` appetite line would be permanently `∞ / empty` during build phase and monitor nothing).
- **Build-phase `∞ / empty`:** this is "no production stress", not "infinite safety". It must **not** register as a comfortable green; it should render as **not-yet-measurable / watch-only** with an explicit build-phase annotation, per **D-BUILD-PHASE-SYNTHETIC-RESPONSE** (breach-or-anomaly on synthetic data → surface, annotate build-phase, never silence).
- **The R265.6bn combined-mode figure:** this is the appetite-relevant signal — it is what the LCR *would* show if today's rehearsed FX-settlement book were live and admitted. It must be **surfaced to the CRO as a watch item** (it would be an order-of-magnitude breach if live), but because every contributing event is `simulated` it must **not auto-trigger a RAS Tier-1 breach escalation** during the build phase. Per the synthetic-response standard, the correct response is an **AgentEscalation carrying the build-phase note**, not a silenced metric and not a live breach. Note also that 22 of the 34 flows are dropped at the ZAR filter (foreign-leg), so R265.6bn is itself a *partial* (consolidated functional-currency) figure pending the rate-enrichment step — a further reason to treat it as watch-only rather than a hard appetite trigger today.

Alternatives the CRO may weigh:
1. *Exclude simulated entirely from the appetite line (production-only).* Cleanest regulatorily, but the line monitors nothing until commencement — no rehearsal value. I do not recommend it for the *appetite-watch* (I do recommend it for the *return*).
2. *Admit simulated and treat the R265.6bn as a live breach now.* Over-reacts to rehearsed data and would spam Tier-1 escalations off the simulation harness — exactly what D-BUILD-PHASE-SYNTHETIC-RESPONSE exists to prevent.

Commits the bank to: an appetite line wired to the canonical engine; a documented build-phase treatment (watch-only, synthetic-response-annotated) until commencement, at which point the line auto-switches to live breach-triggering as the production book fills.

**Settlement:** **CRO rules (binding)** on the appetite-line provenance and the build-phase treatment; **CEO ratifies** the canonical-source link (appetite reads the canonical engine). Treasurer view recorded above.

---

## 6. G4 — Denominator vocabulary + calibration

**Recommended (mark: Recommended): Confirm the *union* denominator vocabulary; flag the calibration source as correct-but-incomplete and route the completeness fix to the CFO.**

### 6.1 Vocabulary — confirmed (Treasurer authority)

A correct LCR denominator needs **both** sides, which today live in two disjoint engines:

- **Behavioural run-off (liability side):** `DepositTaken`, `FundingLineDrawn`, `InterbankLoanPlaced` — weighted by the BA 325 run-off table. Today only the tile sees these.
- **Contractual settlement legs (cash-flow side):** `FxSettlementInstructed`, `TradeMatured`, `SettlementInstructionIssued`, `EquitySettlementInstructed` — net cash within the horizon. Today only the return sees these (FX/equity), and the tile sees `SettlementInstructionIssued`.

I confirm the **union** as the canonical denominator vocabulary. The convergence's shared core (Ravi's E2) must fold all of the above for the bank entity. **One refinement to Ravi's proposed union:** settlement legs must carry the **appropriate run-off / inflow weighting**, not face value. The BA 325 path today takes settlement `netCash` at face value (no run-off %), whereas contractual outflows in the next 30 days are themselves subject to the BA 325 treatment. The shared core must apply the run-off table to behavioural liabilities **and** the contractual-inflow/outflow rates to settlement legs — a single weighting pass over the union, not face-value for one half and weighted for the other.

### 6.2 Calibration — correct but **incomplete** (route to CFO)

The run-off / haircut / cap calibration in `financial-constants.ts` (CFO-owned, `owningRole: "Chief Financial Officer"`, `citation: "BA 325"`) is **correct for what it covers** — the run-off table (`lcr.runoff.*`), haircuts (`lcr.haircut.L1/L2a/L2b`), L2/L2b caps (`lcr.cap.*`), inflow rates (`lcr.inflow.*`), inflow-recognition-cap (`lcr.inflow-recognition-cap`), and minimum ratio (`lcr.minimum-ratio`). The tile (`computeLCR`) reads all of these.

**But it is incomplete for the canonical (BA 325) engine:** the **25% net-outflow floor** (`floor = Math.ceil(0.25 * grossOutflows)`, `ba-325-lcr.ts:1260`) and the **75% inflow cap** (`Math.floor(0.75 * grossOutflows)`, `ba-325-lcr.ts:1256`) are **hardcoded literals**, not `financial-constants.ts` reads. The tile reads `lcr.inflow-recognition-cap` from constants but **has no floor at all**. So:

- There is **no `lcr.net-outflow-floor` constant** (verified absent — no `floor`-keyed LCR constant in `financial-constants.ts`).
- The 75% inflow cap is expressed **twice with two mechanisms** (constant in the tile, literal in BA 325), a drift hazard.

**G4 action (routed to CFO, the calibration owner):** in the convergence, promote the **25% net-outflow floor** and the **75% inflow-recognition cap** to single CFO-owned `financial-constants.ts` keys (`lcr.net-outflow-floor`, reuse `lcr.inflow-recognition-cap`) cited to Reg 26(11) / Reg 26 §19, and have the shared `computeLcrCore` read them — so the floor and inflow cap have **one** calibration source, not a literal in one engine and a constant (or nothing) in the other. This is a **completeness/consistency** fix, not a re-calibration: the *values* are correct.

Alternatives:
1. *Leave the floor/cap as literals in BA 325.* Works numerically today but leaves the calibration surface split across code and constants — fails the single-canonical-source standard and re-opens drift the moment someone "fixes" one side.
2. *Curated subset (drop `InterbankLoanPlaced` / equity legs).* Rejected — the bank will hold interbank placements and may settle equities; a canonical denominator that cannot see them is incomplete by construction.

Commits the bank to: a shared core folding the union vocabulary under one weighting pass; the floor + inflow-cap promoted to CFO-owned constants. **Settlement: vocabulary confirmed under Treasurer authority; calibration-completeness fix is a CFO-owned constants change, executed in Ravi's E1/E2 under CFO sign-off.**

---

## 7. Authority split — what I settle vs what needs ratification

| Item | Treasurer settles | Needs CEO ratification | Needs CRO ruling | Needs CFO action |
|---|---|---|---|---|
| G1 canonical engine = BA 325; tile = faithful render | recommends | **yes** (crosses RAS) | — | — |
| G2 return provenance = `production-only` | **yes** | note divergence | — | — |
| G2 tile provenance (prod + simulated) | already CEO-set (D-LCR-TILE-PROVENANCE) | note | confirm for appetite-watch | — |
| G3 appetite reads canonical engine | recommends | ratify the link | — | — |
| G3 build-phase `∞`/R265.6bn treatment (watch-only, synthetic-response) | view only | — | **yes (binding)** | — |
| G4 union denominator vocabulary | **yes** | — | — | — |
| G4 floor + inflow-cap → constants | identifies | — | — | **yes (CFO)** |

---

## 8. What happens after ratification (not in this run)

On CEO ratification of G1 and the CRO ruling on G3, the gated engineering (Ravi's E1–E5) proceeds: extract `computeLcrCore`; widen the BA 325 denominator to the union with weighting (G4); rewire the tile to call the shared core; add `recon:lcr-engine-parity`; and remediate the `LE-BANK-SA → LE-ZA-HOZ-BANK` identifier split (with Bea, Accounting & financial reporting engineer, engineering) so capital reads can also be entity-scoped. **No convergence code is written until ratification.**

---

## 9. Citations
- D-LCR-TILE-PROVENANCE (CEO directive, 2026-06-02; PR #1003 `c3ebec84`) — governs the tile provenance
- D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12)
- D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
- D-BUILD-PHASE-SYNTHETIC-RESPONSE — synthetic-data breach handling (surface, annotate, never silence)
- Regulations Relating to Banks Reg 26 (LCR), Reg 26(11) net-outflow floor, Reg 26A (NSFR)
- BCBS D295
- brief:eitan:joint-canonical-lcr-engine-recommendation-for-ce:2026-06-02 (this brief)
- brief:ravi:reconcile-the-two-lcr-engines-recommend-canonica:2026-06-02 (upstream reconciliation)
