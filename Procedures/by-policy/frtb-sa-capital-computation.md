---
procedureId: PROC-RISK-FRTB-SA-01
title: FRTB Standardised Approach (SA) — daily market risk capital computation
author: Rohan (Market risk quantitative engineer, engineering)
date: 2026-05-20
owner: Helena (Chief Risk Officer, governance) · Rohan (Market risk quantitative engineer, engineering)
status: POPULATED
policy-cited: market-risk-policy-v1
parent-policy: Policies/market-risk-policy-v1.md
citationOwner: Mira (Regulatory intelligence engineer, compliance)
version: v1.1 — 2026-05-20
last-updated: 2026-05-20
system-capability: "@platform/risk-engine/frtb-sa (PLANNED)"
change-log:
  - v1.1 — 2026-05-20 — Rohan + Helena — v1.1 amendment per Bea (Independent Validation engineer, engineering) review on PR #610 ([comment 4497901020](https://github.com/marchouze/scrooge/pull/610#issuecomment-4497901020)); authoring brief `brief:rohan:amend-frtb-sa-mrl-procedures-per-bea-v1-0-review:2026-05-20`. Three gaps closed (i) SBM three-correlation-scenarios pass (×1.25 / ×1.0 / ×0.75; max-across; per-risk-class) added as Step 7a, with Step 9 SBM-total redefined as the max-of-scenarios aggregate; without this, SA SBM systematically under-states. (ii) DRC net-JTD-per-obligor + hedge-benefit-ratio (HBR) made explicit in Step 11 (gross JTD → net JTD = max(gross long − gross short, 0) → HBR = sum(net long) / [sum(net long) + sum(net short)] → HBR-scaled bucket capital). (iii) Step 13 CVA-SA expanded to surface SA-CVA's internal SBM-like structure: per-counterparty CVA delta + vega sensitivities to each CVA risk class (IR / FX / counterparty credit spread / reference credit spread / equity / commodity); bucket-level aggregation; cross-bucket aggregation; CVA RW table reference. Step 15 day-on-day attribution expanded to add an FX-revaluation-of-foreign-currency-limit-deltas category per Bea's minor observation. All numerical parameters retain `[citation: TBC]` markers per Principle 2 (BCBS d457 paragraph indices, BCBS d507 CVA RW table, PA D/2025 SA-fallback floor).
  - v1 — 2026-05-20 — Rohan + Helena — Initial POPULATED procedure per `brief:rohan:draft-four-market-risk-procedures-policy-v1-8-2:2026-05-20` (Market Risk Policy v1 §8.2; CEO authorisation 2026-05-20).
---

# Procedure — FRTB Standardised Approach (SA) — daily market risk capital computation

**Procedure ID:** PROC-RISK-FRTB-SA-01
**Owner:** Helena (Chief Risk Officer, governance) — methodology · Rohan (Market risk quantitative engineer, engineering) — computation
**Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) approves the SA capital methodology elections (which products feed which risk classes; the choice of CVA-SA vs CVA-BA per netting set); PA approval is required only for IMA desk elections (see PROC-RISK-PLA-01 / PROC-RISK-BACKTEST-01), not for SA computation itself.
**Cadence:** Daily (every business day end-of-day) — produces the canonical FRTB SA capital figure that Camille (Chief Financial Officer, governance) integrates into BA-325. Monthly aggregation for the BA-return cycle.
**Version:** v1.1 — 2026-05-20
**Status:** POPULATED

---

## 1. Source policy

- `Policies/market-risk-policy-v1.md` — Market Risk Policy v1, §4 (FRTB Capital Framework), §4.1 (SA Capital Computation), §1 (Overarching — SA-as-default principle), §8.1 (Substrate dependencies — FRTB SA engine).

The obligation chain (Principle 2):

```
Regulation (Banks Act 94/1990 + Reg 32; BCBS FRTB Jan 2019; PA D/2025)
  → Policy (Market Risk Policy v1 §4)
    → PROC-RISK-FRTB-SA-01 (this procedure)
      → @platform/risk-engine/frtb-sa (PLANNED)
      → @platform/events/frtb-sa-capital-computed (PLANNED)
```

The procedure operationalises the SA computation governance defined in §4.1 of Market Risk Policy v1. It does not restate regulatory text; it sets out the daily run discipline, the input contracts, the per-risk-class computation order, the event signal emitted, and the failure-mode escalation that connects the engine output to Helena's daily review.

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-19` | Measure trading-book market risk per FRTB; hold capital under SA or IMA. SA is the regulatory baseline; this procedure is the operational realisation of the SA limb. |
| `ORG-PR-33` | Implement FRTB + revised CVA per PA D/2025 (1 July 2025 effective). The SA SBM, DRC, RRAO, and CVA-SA limbs are required from the first trade date. |
| `ORG-PR-60` | SA/IMA capital reporting to PA via BA-325 (SA) / BA-326 (IMA, if approved). This procedure produces the canonical SA total that feeds BA-325. |
| BCBS FRTB (January 2019) — Chapter "Standardised Approach": SBM (delta, vega, curvature), DRC, RRAO `[citation: TBC — precise paragraph indices; Imani (Legal-as-code engineer, engineering) + external counsel ratify at the licence-application gate]` | Sensitivity-based method risk classes (GIRR, FX, equity, CSR non-securitisation, CSR securitisation non-CTP, CSR securitisation CTP, commodity); SA aggregation rules; DRC bucket structure; RRAO scope. |
| BCBS *Minimum capital requirements for CVA risk* (July 2020) | CVA-SA / CVA-BA methodology; counterparty-credit-spread buckets `[citation: TBC]`. |
| PA Directive D/2025 | FRTB + revised CVA implementation timeline; SA fallback floor for IMA-revoked desks `[citation: TBC]`. |

---

## 3. Purpose

Produce, on every business day, a defensible FRTB SA market risk capital charge for the Bank's trading book — broken down by the three SA components (SBM, DRC, RRAO) and aggregated to a single `totalSaCapital` figure — and emit it as a `FrtbSaCapitalComputed` event in the canonical event store. Without this procedure the Bank cannot (i) demonstrate ongoing compliance with `ORG-PR-19`; (ii) populate BA-325; (iii) compare RAS-utilisation against the capital trajectory in the Capital Management Policy; (iv) provide PA submissions with a verifiable capital figure.

The procedure also specifies, for every FX product the Bank trades (spot, forward, swap, NDF, vanilla option, exotic option), which SA risk class(es) the position feeds — because FX-linked instruments do not feed a single class. A spot trades in the FX risk class only; a forward feeds FX (the pair) and GIRR (the implicit ZAR-leg and counter-currency-leg discount factors). Documenting this once, in this procedure, prevents the engine from being re-derived per dispatch.

---

## 4. Trigger

- **Daily** (every business day at 17:30 SAST, after market close): scheduled trigger; full SA cycle for all in-perimeter desks and instruments.
- **Re-run** (on any `MarketDataCorrected` event affecting the same business date): the SA cycle re-runs for the affected date; an amended `FrtbSaCapitalComputed { amended: true }` event supersedes the original.
- **Ad-hoc** (PA request, ICAAP cycle, ad-hoc stress request from Helena): out-of-cycle run permitted; the resulting event is tagged with the requestor and rationale.
- **Re-run on IMA revocation** (`ImaDeskApprovalRevoked` event for any desk): per Market Risk Policy v1 §4.3, the affected desk reverts to SA; the engine re-runs that desk's positions on the SA basis from the effective date forward.

---

## 5. Steps

Default actor is the FRTB SA engine agent (`@platform/risk-engine/frtb-sa`) unless a step is explicitly marked as a human-approval step.

### 5.1 Inputs (Steps 1–3)

**Step 1 — End-of-day position snapshot.**

The engine pulls the close-of-business position snapshot from the front-office system. Every trading-book position is in scope (per Market Risk Policy v1 §2 — trading-book / banking-book boundary). For each position, the engine retrieves: trade-ID, ISIN or product code, notional, currency, counterparty (if relevant), maturity, payoff structure (vanilla / exotic / structured), and accounting classification (trading-book confirmation flag).

Positions on desks where IMA is PA-approved per `ImaDeskApprovalGranted` and where back-testing is in the green or amber zone are excluded from the SA capital total for those desks (IMA capital governs); however, the engine still computes SA for those desks for dual-run / pre-submission validation purposes, and emits the result tagged `purpose: dual-run` rather than `purpose: regulatory`. Helena (Chief Risk Officer, governance) reviews the dual-run delta monthly per Market Risk Policy v1 §4.2.

**Step 2 — Market data snapshot.**

The engine consumes the end-of-day market data snapshot from the market data feed: yield curves per currency (ZAR ZARONIA, USD SOFR, EUR €STR, GBP SONIA — and any other in-scope currency from `Policies/trading-mandate-v1.md`); FX spot rates and tenor-point forward points; FX implied volatility surfaces; equity prices for JSE-listed stocks; equity implied volatility; credit spread curves per reference name / index for OTC IRD counterparty CVA computation. Each input carries a `MarketDataSnapshotted` event reference (per PROC-MK-ODP-03 mark-to-market data discipline) so the SA computation is fully traceable.

**Step 3 — Risk-class mapping.**

The engine maps every position to one or more SA risk classes per the BCBS FRTB SA `[citation: TBC]`. The risk class taxonomy:

| Risk class | Code | Scope |
|---|---|---|
| General interest rate risk | GIRR | Interest rate sensitivity of any interest-rate-linked instrument: bonds, OTC IRD, FX forward discount legs, FX swap discount legs, FX option discount legs |
| Foreign exchange risk | FX | FX-pair sensitivity: spot, forward, swap, NDF, vanilla option, exotic option (all currency pairs vs ZAR reporting currency) |
| Credit spread risk — non-securitisation | CSR | Credit-spread sensitivity for OTC IRD counterparty CVA; bond credit-spread (corporate bonds only; SA government bonds attract a different treatment per FRTB SA) |
| Credit spread risk — securitisation (non-CTP) | CSR-S-non-CTP | Out of scope at v0 — the Bank does not trade securitisations |
| Credit spread risk — securitisation (CTP) | CSR-S-CTP | Out of scope at v0 |
| Equity risk | EQ | JSE-listed equities held for client facilitation |
| Commodity risk | COM | Out of primary franchise scope; positions only arise via residual cross-currency flow, and are held at a lower MR-3 sensitivity sub-limit per Market Risk Policy v1 §3 |

**FX product → risk class mapping (specific to the Bank's mandate per `Policies/trading-mandate-v1.md`):**

| FX product | Primary risk class(es) | Notes |
|---|---|---|
| FX spot (e.g. EUR/ZAR) | FX (delta) | Pure FX-pair sensitivity; no discount sensitivity (settlement T+2 small enough to ignore for SA delta — but full DV01 captured under GIRR for the T+2 discount factor) |
| FX forward (outright) | FX (delta) + GIRR (delta) | Two discount-leg sensitivities (ZAR discount + counter-currency discount); the FX-pair delta is the spot equivalent at the forward date |
| FX swap (spot + forward leg, or two forward legs) | FX (delta) + GIRR (delta) | Same as forward × 2; SA aggregation across the legs handled by the SA correlation matrix within GIRR |
| Non-deliverable forward (NDF) | FX (delta) + GIRR (delta) | Same as forward; settlement convention does not affect risk-class mapping; CSR may apply if the reference rate is fixing-based and creates counterparty credit exposure |
| FX vanilla option (call/put on a pair) | FX (delta + vega + curvature) + GIRR (delta — both discount legs) | Vega and curvature feed FX-class SBM vega and curvature limbs |
| FX exotic option (barrier, digital, lookback, basket) | FX (delta + vega + curvature) + GIRR (delta — both discount legs) + RRAO | Exotic payoff triggers RRAO add-on per FRTB SA; the RRAO scope is defined in §5.4 below |

### 5.2 SBM — sensitivity-based method (Steps 4–9)

**Step 4 — Compute delta sensitivities per risk class.**

For each in-scope risk class, the engine computes the delta sensitivity of every position to the prescribed risk factors (per the BCBS FRTB SA `[citation: TBC]`):

- **GIRR delta:** sensitivity to a 1bp parallel shift at each tenor on each currency yield curve. Tenor grid per BCBS FRTB: 0.25y, 0.5y, 1y, 2y, 3y, 5y, 10y, 15y, 20y, 30y.
- **FX delta:** sensitivity to a 1% relative move in each FX pair (currency vs ZAR reporting currency).
- **Equity delta:** sensitivity to a 1% relative move in the equity spot price for each JSE-listed equity.
- **CSR delta:** sensitivity to a 1bp shift in the credit spread for each reference name and tenor on each curve.
- **Commodity delta:** sensitivity to a 1% relative move (in-scope only if positions exist).

Each delta is computed by the front-office risk model for the position, then sent to the SA engine. The engine does not re-price; it consumes the model's sensitivities (consistent with the position's official trading model). Provenance: every sensitivity carries the source-position trade-ID and the `RiskSensitivityCalculated` event reference.

**Step 5 — Apply SA risk weights to deltas.**

Each delta is multiplied by the SA-prescribed risk weight per risk class and bucket per `[citation: TBC — FRTB Table on risk weights and bucket assignments]`. Risk weights are versioned in `Regulations/frtb-sa-weights.json` (Mira's regulatory intelligence pipeline; refreshed on PA-published amendments).

**Step 6 — Bucket-level aggregation.**

Within each risk class, weighted sensitivities are aggregated by bucket using the FRTB SA bucket correlation matrix. The bucket-level capital contribution is `Kb = sqrt(Σ WSi² + Σ Σ ρij × WSi × WSj)` with the correlation `ρij` per the SA table. This computation is repeated for each bucket in each risk class.

**Step 7 — Risk-class-level aggregation.**

Across buckets within a risk class, the capital contribution `Kclass = sqrt(Σ Kb² + Σ Σ γbc × Sb × Sc)` with cross-bucket correlation `γbc` per the SA table. This produces the SBM delta capital charge for each risk class **under a single (medium) correlation scenario**. Step 7a applies the three-scenarios pass.

**Step 7a — Three correlation scenarios (high / medium / low).**

Per BCBS d457 `[citation: TBC — BCBS d457 SA SBM three-correlation-scenarios paragraph; Imani (Legal-as-code engineer, engineering) + external counsel ratify the precise paragraph indices]`, the SBM capital charge under each risk class is computed three times. The bucket-level correlations `ρij` (Step 6) and the cross-bucket correlations `γbc` (Step 7) are each multiplied by a scenario coefficient and the bucket-level + risk-class-level aggregations re-run:

| Scenario | Coefficient applied to ρ and γ |
|---|---|
| High correlation | `min(1.25 × ρ, 1)` and `min(1.25 × γ, 1)` — floored at 1 where the unmodified value already approaches 1 (the cap prevents correlations from exceeding mathematical bounds) |
| Medium correlation | `1.0 × ρ` and `1.0 × γ` — the baseline computation already produced in Steps 6–7 |
| Low correlation | `max(0.75 × ρ, 2 × ρ − 1)` and `max(0.75 × γ, 2 × γ − 1)` — the d457 floor formula for low-correlation scenario `[citation: TBC]` |

For each risk class the engine retains:

```
Kclass(scenario) = sqrt(Σ Kb(scenario)² + Σ Σ γbc(scenario) × Sb × Sc)
SBM_delta_class = max( Kclass(high), Kclass(medium), Kclass(low) )
```

The SBM delta capital charge for each risk class is the **maximum** across the three scenarios. This applies to delta, vega, and curvature limbs independently (Step 8 re-runs the three-scenarios pass for vega and curvature).

**Implementation note:** the three-scenarios pass is per-risk-class, not at the top-of-SBM level. The bank's total SBM delta capital is `Σ_class max(Kclass(high), Kclass(medium), Kclass(low))` — i.e. the maximum is taken inside each risk class before summation, not after. Without Step 7a, the SA SBM charge systematically under-states vs the regulatory definition.

**Step 8 — Vega and curvature.**

The engine repeats Steps 4–7 (including the Step 7a three-scenarios pass) for vega (sensitivity to a 1% relative move in implied volatility) and curvature (the difference between full revaluation under a stress shock and the linear delta approximation, capturing convexity not captured by delta). Vega applies to options (FX vanilla, FX exotic, equity option if any). Curvature applies to the same population. The three-scenarios pass is independent across the three limbs (delta, vega, curvature) within each risk class.

**Step 9 — SBM total.**

The total SBM capital charge is the sum across risk classes of the per-class SBM-delta + SBM-vega + SBM-curvature charges, where each per-class limb has already taken the max across the three correlation scenarios at Step 7a. Per the FRTB SA aggregation rule, there is zero correlation across delta / vega / curvature dimensions within a risk class, but full intra-dimensional correlation per the bucket / cross-bucket tables under each scenario:

```
SBM_total = Σ_class ( SBM_delta_class + SBM_vega_class + SBM_curvature_class )
```

where each per-class limb is the max-across-scenarios value from Step 7a.

### 5.3 DRC — default risk charge (Steps 10–11)

**Step 10 — DRC perimeter and gross jump-to-default loss.**

The DRC captures jump-to-default risk for instruments with credit-default exposure: corporate bonds, OTC IRD counterparty exposure (covered separately via CVA — DRC for OTC counterparty default is the FRTB SA DRC limb), and securitisations (out of v0 scope). For each in-scope position, the engine computes the **gross** jump-to-default loss (`gross_JTD = LGD × notional × position scaling`) per the FRTB SA DRC rules `[citation: TBC — BCBS d457 DRC paragraph defining gross JTD scaling rules; Imani + external counsel ratify]`. Gross JTDs are signed: a long credit position produces a positive (loss-on-default) gross JTD; a short credit position produces a negative gross JTD (gain-on-default).

**Step 11 — DRC bucket, net JTD per obligor, hedge-benefit ratio, and aggregation.**

Per BCBS d457 `[citation: TBC]`, the DRC bucket capital is built up in four sub-steps from the gross JTDs of Step 10. The net-JTD-per-obligor + hedge-benefit-ratio (HBR) structure is required; absent it, the DRC charge ignores intra-obligor hedging and over-states.

**Step 11.1 — Net JTD per obligor.** Within each obligor (same legal entity, same seniority class — the d457 hedging-recognition rule applies only where the short hedge is pari-passu or junior to the long position `[citation: TBC]`), gross long and gross short JTDs are netted:

```
net_JTD_long_obligor  = max( Σ gross_JTD_long_obligor − Σ |gross_JTD_short_obligor|, 0 )
net_JTD_short_obligor = max( Σ |gross_JTD_short_obligor| − Σ gross_JTD_long_obligor, 0 )
```

Per d457 hedging-recognition rules, only one of these is non-zero for any given obligor (an obligor is either net long or net short, not both).

**Step 11.2 — DRC bucket assignment.** Each net-JTD-per-obligor figure is assigned to a DRC bucket per the BCBS FRTB SA DRC bucket table (sovereign / financial / corporate, with sub-buckets by credit quality `[citation: TBC]`). The prescribed default risk weight per bucket is applied to the net-JTD-per-obligor:

```
WS_obligor = RW_bucket × net_JTD_obligor
```

**Step 11.3 — Hedge-benefit ratio (HBR) at the bucket level.** Per BCBS d457 `[citation: TBC]`, the bucket-level capital recognises hedging across obligors within the bucket via the HBR:

```
HBR_bucket = Σ_obligor net_JTD_long_obligor  /  ( Σ_obligor net_JTD_long_obligor + Σ_obligor net_JTD_short_obligor )
```

The HBR is between 0 (only short positions remain in the bucket — no hedge benefit recognised on shorts) and 1 (only long positions — short hedge benefit fully absent because there are no shorts). The HBR-scaled bucket capital is:

```
DRC_bucket = max( Σ_obligor RW_bucket × net_JTD_long_obligor − HBR_bucket × Σ_obligor RW_bucket × net_JTD_short_obligor , 0 )
```

The HBR allows partial offset of long-default risk by short-default positions in the same bucket; the offset is scaled by the relative magnitude of long vs short net JTDs so that a small short hedge against a large long position is recognised proportionally, not fully.

**Step 11.4 — Cross-bucket aggregation.** Per BCBS d457 `[citation: TBC]`, there is **no diversification across DRC buckets** (the cross-bucket correlation is zero for default risk):

```
DRC_total = Σ_bucket DRC_bucket
```

The DRC total is added to the SBM total at Step 14.

### 5.4 RRAO — residual risk add-on (Step 12)

**Step 12 — RRAO scope and computation.**

The RRAO is a flat capital add-on for instruments with "complex" residual risks not captured by SBM or DRC — per BCBS FRTB SA `[citation: TBC — RRAO scope paragraph]`. The Bank's RRAO perimeter at v0:

- **Exotic FX options** (barrier, digital, lookback, basket) — 1% of notional.
- **Bermudan / American-style exotic IRD** — 1% of notional.
- **Securitisation positions** — 1% of notional (out of v0 scope but reserved).
- **Instruments with payoffs not measurable as deterministic functions of standard risk factors** — 0.1% of notional (residual residual).

The engine maintains an RRAO scope register keyed by instrument-template; new products added to the trading book are assessed by Rohan (Market risk quantitative engineer, engineering) for RRAO scope as part of the New Product Approval gate (PROC-NPA-GATE-01).

### 5.5 CVA capital (Step 13)

**Step 13 — CVA-SA computation (SA-CVA + BA-CVA limbs).**

Per Market Risk Policy v1 §5, CVA capital is computed under the BCBS revised CVA framework (BCBS d507, July 2020 `[citation: TBC — BCBS d507 paragraph indices; Imani + external counsel ratify]`). The framework has two limbs:

- **SA-CVA** (Standardised Approach for CVA) — the default, with its own internal SBM-like structure (delta + vega per CVA risk class). Applies to netting sets above the materiality threshold per Market Risk Policy v1 §5.
- **BA-CVA** (Basic Approach for CVA) — permissible for sub-materiality-threshold netting sets at Helena's election. Reduced-form computation; does not require the SA-CVA SBM apparatus below.

Helena (Chief Risk Officer, governance) determines applicability per netting set; the assignment is recorded as `CvaApproachAssignmentSet { nettingSetId, approach: SA | BA, effectiveDate, citations[] }`.

**Step 13.1 — Per-counterparty CVA sensitivities (SA-CVA only).**

For each netting set assigned `approach: SA`, the CVA engine computes the CVA-side delta and vega sensitivities to each CVA risk class. The CVA risk class taxonomy per d507 `[citation: TBC]`:

| CVA risk class | Code | Delta sensitivity | Vega sensitivity |
|---|---|---|---|
| Interest rate | CVA-IR | 1bp shift on each tenor of the discounting curve in each currency | 1% shift on implied vol of the underlying rate |
| Foreign exchange | CVA-FX | 1% shift on each FX pair vs ZAR | 1% shift on FX implied vol |
| Counterparty credit spread | CVA-CCS | 1bp shift on the counterparty's CDS / proxy credit spread curve per tenor | n/a (CVA-CCS is delta-only per d507) |
| Reference credit spread | CVA-RCS | 1bp shift on each reference name credit spread curve (where the netting set has credit-referenced exposures) | n/a |
| Equity | CVA-EQ | 1% shift on each underlying equity (where the netting set has equity-referenced exposures) | 1% shift on equity implied vol |
| Commodity | CVA-COM | 1% shift on each underlying commodity (out of v0 primary franchise scope) | 1% shift on commodity implied vol |

The sensitivities are the partial derivatives of the netting-set CVA value w.r.t. each risk factor — computed by the CVA engine on the daily EOD market data snapshot (Step 2).

**Step 13.2 — Bucket-level aggregation (per CVA risk class).**

Within each CVA risk class, weighted sensitivities `WS_i = RW_i × s_i` are aggregated by bucket using the prescribed bucket correlation matrix `ρ_CVA_ij` from the d507 CVA risk-weight (RW) table `[citation: TBC — BCBS d507 CVA RW + correlation table; Mira maintains in `Regulations/cva-sa-weights.json` (PLANNED) once ratified]`:

```
K_b_CVA(class) = sqrt( Σ WS_i² + Σ Σ ρ_CVA_ij × WS_i × WS_j )
```

Eligible CVA hedges (Market Risk Policy v1 §5) enter as sensitivities of opposite sign within the same risk-class bucket, reducing `K_b_CVA` proportionally — this is the SA-CVA mechanism by which CVA hedges receive capital relief.

**Step 13.3 — Cross-bucket aggregation (per CVA risk class).**

```
K_class_CVA = sqrt( Σ K_b_CVA² + Σ Σ γ_CVA_bc × S_b × S_c )
```

with cross-bucket correlation `γ_CVA_bc` per d507 `[citation: TBC]`. Computed per limb (delta + vega) — vega does not apply to CVA-CCS / CVA-RCS per Step 13.1.

**Step 13.4 — SA-CVA total.**

The CVA-SA capital charge is the sum across CVA risk classes of the per-class delta + vega charges:

```
CVA_SA = Σ_class ( K_class_CVA_delta + K_class_CVA_vega )
```

**Note on three-correlation-scenarios.** BCBS d507 `[citation: TBC]` indicates that the same high / medium / low scenarios pass that applies to SBM (Step 7a) **also applies inside SA-CVA**. The engine runs Steps 13.2–13.4 three times under the scenario coefficients and takes the max per CVA risk class before summation at Step 13.4. This is consistent with Step 7a's pattern.

**Step 13.5 — BA-CVA fallback.**

For netting sets assigned `approach: BA`, the basic CVA capital is computed under d507's reduced-form formula `[citation: TBC]` — counterparty-level CVA notional × CVA risk weight, with limited hedge recognition. The output is added directly to the daily `cvaComponent` field without entering the SBM-like apparatus above.

**Step 13.6 — Forward reference and separation from BA-325 input.**

The daily `FrtbSaCapitalComputed` event includes a `cvaComponent` field aggregating SA-CVA + BA-CVA across all netting sets for internal risk-appetite monitoring against MR-4 (Market Risk Policy v1 §3). However, the canonical CVA capital figure that feeds BA-325 / BA-326 flows through a separate monthly computation cycle (Market Risk Policy v1 §6.2 reporting) — the daily figure here is a continuous-monitoring estimate; the monthly figure is the reportable capital number. The split prevents double-counting and respects the d507 + PA D/2025 reporting cadence. **A follow-on PROC-RISK-CVA-SA-01 may, at Helena's discretion, lift Steps 13.1–13.5 into a standalone procedure** once the CVA engine is sufficiently complex to merit a dedicated procedure file — this procedure cross-references rather than duplicates if that lift happens.

### 5.6 Aggregation, validation, and event emission (Steps 14–17)

**Step 14 — Total SA capital.**

`totalSaCapital = sbmComponent + drcComponent + rraoComponent + cvaComponent`, with no diversification across the four components (per FRTB SA aggregation rule).

**Step 15 — Reconciliation against prior business day.**

The engine produces a day-on-day delta report (`ΔSBM`, `ΔDRC`, `ΔRRAO`, `ΔCVA`, `ΔtotalSaCapital`) attributed to:

- **New trades booked / closed** — `ΔtotalSaCapital` attributable to position changes since the prior business day.
- **Market data movements** — curve / FX / equity / spread shifts since the prior business day.
- **FX revaluation of foreign-currency limit deltas** — because the bank reports in ZAR but trades multi-currency positions per `Policies/trading-mandate-v1.md`, day-on-day FX moves revalue every foreign-currency sensitivity, risk weight, and DRC notional into ZAR terms. This category isolates the ZAR-translation effect from the underlying-FX-pair delta effect (the latter already captured under "market data movements"). Without this isolation, FX revaluation noise contaminates the other attribution categories.
- **Model parameter updates** — risk weights, correlations refreshed on regulatory amendments (Mira's regulatory-intelligence pipeline).
- **Three-correlation-scenarios switch** — when the binding scenario flips between high / medium / low across business days for a given risk class (Step 7a), the per-class capital can move materially even with no other change. Flagged separately so the delta is not mis-attributed to market or position factors.
- **Other** — residual.

Any unattributed material delta (more than `[calibration: pending RAS-calibration by Rohan under Helena's direction]` ZAR or `[calibration: pending]`%) is flagged for Rohan's review before event emission.

**Step 16 — Independent validation gate.**

Once per calendar month (and ad-hoc on material methodology change), Nadia (Independent-validation engineer, engineering — peer-in-second-line under Helena) reviews the SA engine output against an independent recomputation on a sample portfolio (per `PROC-RSK-MV-01 — Model validation`). A `ModelValidationCompleted { modelId: 'frtb-sa-engine', modelVersion, scope[], findings[] }` event closes the monthly validation cycle. Any open critical validation finding holds the SA engine in `degraded` status until cleared; daily computation continues with Helena's written acknowledgement of the finding.

**Step 17 — Event emission.**

The engine emits `FrtbSaCapitalComputed { date, totalSaCapital, sbmComponent, drcComponent, rraoComponent, cvaComponent, deskBreakdown[], riskClassBreakdown[], purpose: regulatory | dual-run, amended: boolean, citations: [policy + regulation refs] }` to the canonical event store. Camille (Chief Financial Officer, governance) consumes this event for BA-325 generation (PROC-FIN-BA-01). Helena reviews the daily report by 09:00 the next business day (per Market Risk Policy v1 §6.2).

---

## 6. Outputs (events)

The procedure emits and consumes the following typed events.

**Emitted by this procedure:**

- `FrtbSaCapitalComputed { date, totalSaCapital, sbmComponent, drcComponent, rraoComponent, cvaComponent, deskBreakdown[], riskClassBreakdown[], purpose, amended, citations[] }` — the canonical daily SA capital figure (one event per business day per `purpose` value).
- `FrtbSaCapitalAmended { date, originalEventId, amendedTotalSaCapital, reason, citations[] }` — issued when a re-run supersedes a prior business date's figure (e.g. on `MarketDataCorrected`); references the original event so the audit chain is intact.
- `RrasScopeAssessed { productTemplate, rraoCharge, effectiveDate, citations[] }` — issued when a new product template enters RRAO scope (NPA gate downstream).
- `CvaApproachAssignmentSet { nettingSetId, approach: SA | BA, effectiveDate, citations[] }` — Helena's CVA approach assignment per netting set.
- `FrtbSaEngineDegraded { reason, openFindings[], effectiveFrom, citations[] }` — issued when an open critical validation finding holds the engine in degraded status; cleared by `FrtbSaEngineCleared { findingResolvedEventId, citations[] }`.

**Consumed by this procedure (read dependencies):**

- `MarketDataSnapshotted` (per PROC-MK-ODP-03) — end-of-day curves, FX, equity, spreads.
- `TradeBooked`, `TradeAmended`, `TradeClosed`, `TradeCancelled` — position deltas vs prior business day.
- `ImaDeskApprovalGranted` / `ImaDeskApprovalRevoked` — desk-level SA vs IMA scope toggle.
- `ModelValidationCompleted { modelId: 'frtb-sa-engine' }` — monthly validation cycle.

---

## 7. Controls / approvers

| Control | Frequency | Owner |
|---|---|---|
| Daily completeness check: `FrtbSaCapitalComputed { purpose: regulatory }` event present for every business day | Daily | Rohan (Market risk quantitative engineer, engineering) — first line; Vera (internal audit engineer) — third line via `recon:frtb-sa-daily-completeness` (PLANNED) |
| Day-on-day delta attribution review | Daily | Rohan |
| RRAO scope register completeness (every new product template assessed before first trade) | Per new product (NPA gate) | Rohan + Saskia (Head of Global Markets) at NPA gate |
| CVA approach assignment register (every netting set has an assignment) | On counterparty enable + quarterly | Helena |
| Independent validation of SA engine | Monthly + ad-hoc on material methodology change | Nadia (Independent-validation engineer, engineering) |
| Methodology change approval | Per change | Helena (CRO) approves methodology elections; Board (CEO interim) approves material elections per Market Risk Policy v1 §4 |
| Reconciliation of SA total to BA-325 input | Monthly | Camille (Chief Financial Officer, governance) + Bea (Financial-reporting engineer, engineering) |
| External audit review of SA methodology | Annual (at year-end audit) | Camille co-ordinates; external auditor opines |

---

## 8. Escalation

| Condition | Action | Timeframe |
|---|---|---|
| **No `FrtbSaCapitalComputed` event by 06:00 next business day** | Rohan investigates immediately; Helena notified by 07:00; Camille notified by 07:30 (BA-325 timeline at risk). Vera opens incident if cause is process-level. | 6h to first event; 24h to remediation |
| **Material unattributed day-on-day delta** (above the threshold in Step 15) | Rohan + Nadia investigate; event withheld until attribution complete; Helena's written acknowledgement required if same-day emission proceeds with partial attribution | Same business day |
| **Open critical validation finding (Nadia)** | `FrtbSaEngineDegraded` event emitted; Helena writes the acknowledgement; daily computation continues with the finding tagged in every subsequent event until cleared | Within 1 business day of finding raise; clearance per validation cycle |
| **Material restatement (`FrtbSaCapitalAmended`) crossing the capital headroom threshold per ICAAP trajectory** | Helena escalates to Camille and CEO same day; BRC informed at next meeting; PA pre-notification assessed by Imani (Legal-as-code engineer, engineering) | Same business day |
| **RRAO scope gap: new product traded without prior NPA-gate RRAO assessment** | Position frozen at the order-management layer (per PROC-MK-MA-01 mandate attestation); Rohan emits a corrective RRAO scope assessment within 1 business day; Vera files a finding | 1 business day |
| **CVA approach assignment missing for a netting set with active OTC derivative exposure** | Helena defaults the netting set to CVA-SA pending review; alert raised to Helena; assignment formalised within 5 business days | 5 business days |

---

## 9. Substrate dependencies

| Capability | Status | Description |
|---|---|---|
| `@platform/risk-engine/frtb-sa` | PLANNED | SA engine: consumes positions + market data + sensitivities; computes SBM, DRC, RRAO, CVA; emits `FrtbSaCapitalComputed` |
| `@platform/market-data/eod-snapshot` | PLANNED | Canonical EOD market data feed (curves, FX, equity, spreads, vols) — consumed by SA engine |
| `@platform/risk-engine/sensitivities` | PLANNED | Front-office model sensitivities feed (delta, vega, curvature per risk factor) |
| `@platform/risk-engine/drc-bucket` | PLANNED | DRC bucket assignment and jump-to-default loss computation |
| `@platform/risk-engine/cva-sa` | PLANNED | CVA-SA computation per netting set |
| `@platform/risk-engine/cva-ba` | PLANNED | CVA-BA fallback for sub-materiality netting sets |
| `@platform/risk-engine/rrao-scope` | PLANNED | RRAO scope register; new-product template assessment hook into NPA gate |
| `@platform/events/frtb-sa-capital-computed` | PLANNED | Typed event schema: `FrtbSaCapitalComputed`, `FrtbSaCapitalAmended`, `FrtbSaEngineDegraded`, `FrtbSaEngineCleared`, `RrasScopeAssessed`, `CvaApproachAssignmentSet` |
| `@platform/recon/frtb-sa-validation` | PLANNED | Recon pipeline asserting daily completeness, delta-attribution, BA-325 reconciliation |

---

## 10. Citations

- **Policy:** `Policies/market-risk-policy-v1.md` §1 (Overarching — SA-default principle), §4 (FRTB Capital Framework), §4.1 (SA Capital Computation), §5 (CVA Capital), §6.2 (Reporting), §8.1 (Substrate dependencies — FRTB SA engine).
- **Regulation:** `ORG-PR-19`, `ORG-PR-33`, `ORG-PR-60`; BCBS *Minimum capital requirements for market risk* (January 2019) — SA Chapter `[citation: TBC]`; BCBS *Minimum capital requirements for CVA risk* (July 2020) `[citation: TBC]`; PA D/2025 `[citation: TBC]`; Regulations Relating to Banks 2012 Reg 32 `[citation: TBC]`.
- **Related procedures:** `PROC-RISK-MRM-01` (`market-risk-monitoring.md`) — daily VaR/ES/limit monitoring consumes SA output; `PROC-RISK-BACKTEST-01` (`backtesting-governance.md`) — back-testing zone determines IMA vs SA capital basis per desk; `PROC-RISK-PLA-01` (`pla-test-governance.md`) — PLA test failure reverts a desk to SA; `PROC-RISK-MRL-01` (`market-risk-limit-monitoring.md`) — SA output feeds MR-1/MR-2/MR-3 limit checks; `PROC-FIN-BA-01` (`ba-return-generation.md`) — SA total feeds BA-325; `PROC-MK-ODP-03` (`margin-vm.md`) — market data discipline upstream; `PROC-RSK-MV-01` (`model-validation.md`) — Nadia's validation gate; `PROC-NPA-GATE-01` (`npa-gate.md`) — RRAO scope assessment at new-product approval.

---

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1 | 2026-05-20 | Rohan (Market risk quantitative engineer, engineering) + Helena (Chief Risk Officer, governance) — via Scrooge dispatch `brief:rohan:draft-four-market-risk-procedures-policy-v1-8-2:2026-05-20` | Initial POPULATED procedure. Authors the daily FRTB SA capital computation discipline per Market Risk Policy v1 §4.1 and §8.2. Eleven sections per agent-spec template. Specifies the FX product → SA risk class mapping (spot / forward / swap / NDF / vanilla option / exotic option). Specifies the SBM → DRC → RRAO → CVA aggregation order. Specifies the `FrtbSaCapitalComputed` event signal as the canonical daily artefact. Identity discipline per CLAUDE.md. Citation gaps marked `[citation: TBC]` per Principle 2; calibration parameters marked `[calibration: pending]` per the brief's no-invented-numerics rule. |
