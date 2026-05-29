# Model-Registry Scope-Closure — Slice 3 (IRRBB ΔEVE + ΔNII governed)

> **Governance document** | Author: Helena (Chief Risk Officer, governance) | Owner-policy: RISK-MRP-01 (Model Risk Policy v1) §1.1 / §5 | Date: 2026-05-29
> **Authority:** D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 (CEO session-delegation, 2026-05-29). Backing brief: `brief:helena:model-registry-scope-closure-slice-3-irrbb-eve-n:2026-05-29`. Predecessors: Slice 1 (PR #886, merged) landed `model:rwa-sa-v1` + the `rwa` binding; Slice 2 (PR #888, merged) landed the six IFRS 9 ECL models + the `ecl` binding.
> **Status:** Slice 3 of N — IRRBB repricing/behavioural, ΔEVE and ΔNII models registered, governed and bound. Remaining slices (VaR/SVaR/ES, CVA) sequenced below.

This document is a *render* of a `RecordFiled` event in the Documents register (Principle 1 — events are the only source of truth). The markdown is never the canonical artefact; the event is. Identity discipline per CLAUDE.md — every agent reference pairs name + position on first mention.

---

## 1. The gap this slice closes

`Policies/model-risk-policy-v1.md` (RISK-MRP-01) §1.1 places IRRBB (interest-rate risk in the banking book) squarely in declared model scope. Two IRRBB figures were ungoverned:

- **ΔEVE** — the change in the economic value of equity of the banking book under standard interest-rate shocks (the economic-value / Pillar-2 perspective).
- **ΔNII** — the 12-month net-interest-income sensitivity (the earnings perspective).

Both feed the ICAAP, the SARB outlier test (ΔEVE against Tier-1 capital), and the BA 330 IRRBB return. Under D-TRUSTED-FIGURES-PROGRAM-V1 every *surfaced* figure must trace to a registered + approved model; an ungoverned IRRBB figure is therefore a live control weakness.

The engines themselves already existed (`platform/alm/eve.ts`, `platform/alm/nii.ts`, `platform/alm/repricing-gap.ts` — built under D-TREASURY-GAPS-WAVE1) but were *not* governed: no models registered, no `CALC_BINDINGS` entries, no `CalculationPerformed` provenance. This slice governs the existing engines rather than duplicating them, and reuses the existing `IRRBBExcursion` event type — no new excursion event was introduced.

---

## 2. What Slice 3 lands (this PR)

### 2.1 Three IRRBB models registered, tier-classified Tier-1, validated and approved

Added to `prototype/seeds/models/calc-model-seed.ts` following the established idempotent register → classify-tier → independently-validate → approve sequence. Rohan (Risk systems engineer, engineering) submits as first line; Nadia (Independent-validation engineer) classifies the tier and approves as second line. Methodology accountability sits with Helena (CRO) per RISK-MRP-01 §3.4; the ALM repricing/behavioural assumptions are owned by Eitan (Treasurer); the ΔNII earnings figure is owned by Camille (Chief Financial Officer, governance).

| Model | modelId | Tier | Methodology / input owner |
|---|---|---|---|
| IRRBB repricing / behavioural | `model:irrbb-repricing-v1` | 1 | Helena (CRO); repricing/behavioural inputs Eitan (Treasurer) |
| IRRBB ΔEVE engine | `model:irrbb-eve-engine-v1` | 1 | Helena (CRO) |
| IRRBB ΔNII engine | `model:irrbb-nii-engine-v1` | 1 | Helena (CRO); ΔNII figure Camille (CFO) |

**Tier rationale (RISK-MRP-01 §2 / SR 11-7 §V):** IRRBB measures feed Pillar-2 capital, the ICAAP and the BA 330 IRRBB return. The repricing/behavioural model is the most judgement-intensive component (NMD decay, prepayment) and is the common base both engines consume — unambiguously Tier-1, requiring full independent validation.

### 2.2 Two real (not hollow) figures bound in `CALC_BINDINGS`

Added two bindings to `prototype/platform/model-registry/calculation-binding.ts`, both output unit `ZAR-minor`, citations `[D-TRUSTED-FIGURES-PROGRAM-V1, D-MODEL-REGISTRY-SCOPE-CLOSURE-V1, BANKS-ACT-94-1990, BCBS-D368]`:

| calcKey | figure | modelId | owningAgent |
|---|---|---|---|
| `irrbb-eve` | IRRBB ΔEVE (Economic Value of Equity sensitivity) | `model:irrbb-eve-engine-v1` | Helena (Chief Risk Officer) |
| `irrbb-nii` | IRRBB ΔNII (12-month Net-Interest-Income sensitivity) | `model:irrbb-nii-engine-v1` | Camille (Chief Financial Officer) |

**ΔEVE** (`computeEVE`) computes ΔEVE = shocked NPV − base NPV across the **six BCBS d368 §III standard shocks**: parallel up, parallel down, steepener, flattener, short-rate up, short-rate down. The EVE engine was realigned to these canonical six (it previously carried two parallel-up + two parallel-down variants); the shock-shift function now applies the proper rotation (steepener/flattener) and short-end taper (short up/down). The surfaced figure is the worst-case (most adverse) ΔEVE in minor units.

**ΔNII** (`computeNII`) computes ΔNII = shocked NII − base NII over the 12-month earnings horizon across the BCBS d368 §III parallel shocks. The surfaced figure is the worst-case ΔNII in minor units.

Both engines read the banking-book repricing positions from `computeRepricingGap` (`model:irrbb-repricing-v1`), which folds `TradeBooked` / `RepoTradeOpened` / `DepositTaken` / `InterbankLoanPlaced` (and terminal events) into BCBS repricing buckets as RSA / RSL.

**NO SILENT ZEROS.** When the banking book has no repricing-sensitive positions (the current build-phase state — no banking-book trades are booked in the live store) each engine returns `status: "zero-positions"` — a loud, reasoned absence. The server's `emitCalculationProvenance()` marks the optional `repricingBaseZar` input as missing, so `buildCalculationPerformed` emits `CalculationPerformed{status:"degraded", output:null}` plus a `SubstrateAlert{integrity}`. Both figures therefore render "value unavailable" on the `/api/data-failures` banner — never an unexplained 0.

### 2.3 Recon gates stay green

- `recon:calc-model-binding` — `irrbb-eve` and `irrbb-nii` are now bound figures tracing to approved models (seeded idempotently by the gate itself).
- `recon:calc-no-silent-zero` — the IRRBB engines use a flat literal base rate, not a weight-table `?? n` collapse, so they are not in the gate's `CALC_FILES` list; the loud `zero-positions` → `degraded` path is the no-silent-zero mechanism for IRRBB.
- `recon:expected-event-watchdog` — automatically expects a `CalculationPerformed` for each new binding (derived from `CALC_BINDINGS`); the boot emitter satisfies both.
- `recon:model-risk-gap-inventory` (product-keyed, non-blocking) — unaffected.

---

## 3. Substrate gap surfaced (not hidden)

**Banking-book repricing positions are empty in the build phase.** `computeRepricingGap` reads `TradeBooked` and the bank's lending/funding events; in the current build phase no banking-book positions are booked, so both ΔEVE and ΔNII legitimately surface a loud `degraded` status rather than a number. This is the correct posture (Principle 1 — query-derived, not stored state), but it means the *non-zero* behaviour of the realigned six-shock EVE rotation/taper is exercised only by the unit tests, not yet by live data. When banking-book positions land (commencement-of-trading), the figures activate automatically with no code change — the governance, binding and provenance plumbing is already in place. No substrate change blocked a clean run.

---

## 4. Remaining-slice roadmap

| Slice | Scope | Owning seat | Sequencing note |
|---|---|---|---|
| ✅ **Slice 1 — RWA** | Risk-Weighted Assets (standardised) | Helena (CRO) | Landed (PR #886). |
| ✅ **Slice 2 — IFRS 9 ECL suite** | staging, PD, LGD, EAD, macro overlay, ECL engine | Helena (CRO); Camille (CFO) confirms accounting | Landed (PR #888). |
| ✅ **Slice 3 — IRRBB** | repricing/behavioural, ΔEVE, ΔNII | Helena (CRO); ΔNII figure Camille (CFO); ALM inputs Eitan (Treasurer) | **This PR.** |
| **Slice 4 — Market-risk VaR suite** | VaR, Stressed VaR (SVaR), Expected Shortfall (ES) | Helena (CRO) | Tier-1. Adds the internal-measure VaR family for RAS MR limits + ICAAP. |
| **Slice 5 — CVA** | Credit Valuation Adjustment | Helena (CRO) | Tier-1. Closes the zero placeholder in the RWA engine (`cvaRwaMinor`); BA 600 owns the computation. |
| Deferred — ICAAP P2A | Pillar-2A capital self-assessment model | Helena (CRO) | Activates at ICAAP rehearsal. |

**Excluded entirely (prescribed inputs, not bank models):** BA 325 haircuts, SA-CCR supervisory factors, SA standardised risk weights. These are regulator-prescribed constants the engines consume, not methodologies the bank owns, calibrates or validates.

---

## 5. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v1.0 | 2026-05-29 | Helena (Chief Risk Officer, governance) | Slice 3 of D-MODEL-REGISTRY-SCOPE-CLOSURE-V1. Registered three Tier-1 IRRBB models (repricing/behavioural, ΔEVE engine, ΔNII engine); added the `irrbb-eve` (Helena/CRO) + `irrbb-nii` (Camille/CFO) CALC_BINDINGS entries; realigned the ΔEVE engine to the six BCBS d368 standard shocks; wired no-silent-zero `CalculationPerformed` + `SubstrateAlert` emission for both figures. Surfaced the empty-banking-book substrate gap. Remaining slices: VaR/SVaR/ES (4), CVA (5). Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1. |
