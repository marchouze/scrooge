---
title: Controlled-Launch MR-1-FX Limit Proposal + Compensating-Control Attestation Block
record-id: record:documents:helena:controlled-launch-mr1-fx-limit-proposal:2026-05-20
author: Helena (Chief Risk Officer, governance)
date: 2026-05-20
brief: brief:helena:controlled-launch-mr-1-fx-limit-proposal-compens:2026-05-20
workstream: WS-MARKET-RISK-PROCEDURES
classification: governance-deliverable
status: FINAL
citations:
  - Policies/market-risk-policy-v1.md
  - Policies/trading-mandate-v1.md
  - Procedures/by-policy/npa-gate.md
  - Procedures/markets/pre-licence-go-live-gate.md
  - Procedures/by-policy/market-risk-limit-monitoring.md
  - 2026-05-20_helena_fx-spot-only-market-risk-scope-review.md
---

# Controlled-Launch MR-1-FX Limit Proposal + Compensating-Control Attestation Block

**Author:** Helena (Chief Risk Officer, governance)
**Date:** 2026-05-20
**Brief:** `brief:helena:controlled-launch-mr-1-fx-limit-proposal-compens:2026-05-20`
**Workstream:** WS-MARKET-RISK-PROCEDURES
**Supervisory test:** This document is the BRC-tabled limit framework and compensating-control attestation for the first FX-spot trade under a `controlled-launch` NPA gate. It must be defensible to a SARB supervisor asking "what numbers govern your first FX-spot trade, why those numbers, and what controls stand in for the substrate you have not yet built?"

This deliverable is a follow-on to my FX-spot-only market-risk scope review filed 2026-05-20 (`record:documents:helena:fx-spot-only-market-risk-scope-review:2026-05-20`, PR #631). The ten substrate gaps in §6 of that review are the input to this proposal: gap G-4 is closed by Section 1 below; gaps G-1, G-2, G-5 are covered by Section 2 below; gaps G-3, G-6, G-7, G-8, G-9, G-10 are out of scope per the brief.

---

## Section 1 — MR-1-FX Controlled-Launch Limit Proposal

### 1.0 Scope and assumptions

Per the brief, the controlled-launch limit framework covers **FX spot only**. I scope it tighter than the brief suggests: the launch pair set is **USD/ZAR only**, not USD/ZAR + EUR/ZAR + GBP/ZAR. Reasoning:

1. `Policies/trading-mandate-v1.md §2.5` permits FX spot only in USD/ZAR. EUR/ZAR and GBP/ZAR are not in the positive enumeration. Adding them requires either (a) a Trading Mandate amendment or (b) a fresh NPA gate per `Procedures/by-policy/npa-gate.md`. Neither has happened.
2. Settlement-rail concentration risk (the dominant settlement risk per my scope review §1.2) is uniformly through the same SWIFT correspondent (Standard Bank primary, FirstRand backup) regardless of pair, so the multi-pair argument adds operational complexity without diversifying the rail.
3. Controlled-launch discipline is to constrain optionality. The MVP path is one pair, one product, one rail.

If the BRC wishes to extend to EUR/ZAR / GBP/ZAR, that is a Trading Mandate amendment + a follow-on limit calibration; this proposal does not cover it.

Counterparties at controlled-launch are restricted to the **first-trade counterparty whitelist** of two named names (Standard Bank Corporate Treasury and Investec Bank Treasury). Both carry approved counterparty mandates per `Procedures/by-policy/counterparty-onboarding-markets.md` and live credit headroom per `@platform/risk/credit-limit-engine` (D-CREDIT-LIMIT-ENGINE-BUILD Phase 4 complete).

### 1.1 Recommended 1-day 99% VaR limit (MR-1-FX)

**Recommendation: ZAR 350,000 (one-day 99% VaR) on the FX-spot book at controlled launch.**

Calibration workings:

| Step | Input | Value | Source |
|---|---|---|---|
| 1 | Maximum end-of-day open USD/ZAR position (controlled-launch ceiling — see §1.4) | USD 1,000,000 ≈ ZAR 18.5m | This proposal §1.4 |
| 2 | USD/ZAR realised daily volatility (lookback approach — see calibration basis §1.6) | 0.85% (1-day standard deviation) | SARB historical daily fixing series, 250 business days ending 2026-05-19 (Rohan to verify; figure used here is conservative round-number consistent with the SARB historical band of 0.6–1.2% across recent regimes) |
| 3 | Parametric 99% one-tailed z-score | 2.326 | Standard normal |
| 4 | Parametric 1-day 99% VaR on 18.5m at 0.85% × 2.326 | ZAR 365,824 | 18,500,000 × 0.0085 × 2.326 |
| 5 | Rounded down for limit clarity | **ZAR 350,000** | This proposal |

This is the **operational** MR-1-FX desk sub-limit. The bank-wide MR-1 aggregate (`Policies/market-risk-policy-v1.md §3 MR-1`) is a separate line item; in the controlled-launch period FX spot is the only trading-book activity, so the desk sub-limit and the bank-wide aggregate coincide.

Amber-Alert at 80% utilisation = ZAR 280,000 (`Policies/market-risk-policy-v1.md §1.4`). Hard Breach at 100% (ZAR 350,001). Critical tier per the policy.

### 1.2 Recommended per-currency-pair sub-limits

Single-pair scope. No sub-allocation is needed.

| Pair | MR-1-FX sub-limit | Note |
|---|---|---|
| USD/ZAR | ZAR 350,000 (full envelope) | Only permitted pair per `Policies/trading-mandate-v1.md §2.5` |
| EUR/ZAR | Not permitted at controlled-launch | Out of mandate |
| GBP/ZAR | Not permitted at controlled-launch | Out of mandate |

### 1.3 Recommended per-counterparty notional cap

**Recommendation: USD 500,000 per single counterparty per trading day (gross executed notional, USD-leg basis).**

Workings:

- The controlled-launch end-of-day open-position ceiling is USD 1,000,000 (§1.4). To honour that ceiling without saturating it on a single counterparty, intraday gross execution per counterparty is capped at 50% of the EOD envelope.
- This is independent of, and **tighter than**, the credit-limit-engine headroom: the credit-limit-engine check (PROC-MK-PCG-01 Check 1) governs counterparty credit risk; this notional cap governs FX-desk concentration on the **settlement rail**.
- Re-cap: a hard-breach of this counterparty notional cap blocks the next trade with that counterparty (the pre-trade conduct gate enforces). It does not reduce the EOD envelope.

For controlled launch, two named counterparties only:

| Counterparty | Daily gross notional cap (USD) | ZAR equivalent at 18.50 | Trigger |
|---|---|---|---|
| Standard Bank Corporate Treasury | 500,000 | ZAR 9.25m | Hard at 100%; Amber at 80% |
| Investec Bank Treasury | 500,000 | ZAR 9.25m | Hard at 100%; Amber at 80% |
| Aggregate (both counterparties same day) | 1,000,000 | ZAR 18.50m | = EOD envelope ceiling |

### 1.4 Recommended end-of-day open FX position limit

**Recommendation: USD 1,000,000 (notional, net long-or-short USD/ZAR) carried overnight.**

This is the absolute EOD open-position cap, distinct from VaR. It binds even on days where VaR utilisation is low.

Workings:

- `Policies/trading-mandate-v1.md §5.2` v1 placeholder for FX intraday is `≤ R500m equiv.` That figure is sized for steady-state franchise flows after the desk is established with multiple dealer mandates, multiple counterparties, and an active client book. Controlled launch is none of those.
- Controlled-launch tightening factor: **2.7% of the eventual steady-state placeholder**. I have applied a 37× tightening (R500m / R18.5m) to reflect (i) zero operating history on FX spot; (ii) the manual nature of the B-cluster settlement monitoring (G-5 compensating control, §2.3); (iii) the un-validated state of the FRTB SA engine for FX spot (G-2 compensating control, §2.2); (iv) the absence of a live production FX feed (G-1 compensating control, §2.1).
- USD 1,000,000 is also chosen as a round, BRC-explainable figure that comfortably sits below the SARB ExCon Authorised Dealer net-open-position daily limit for an entity at our capital tier (the precise ExCon limit is a Zara monitoring item under `Policies/trading-mandate-v1.md §6`; nothing in this proposal contradicts ExCon).

| Limit | Value | Trigger |
|---|---|---|
| EOD open USD/ZAR net position | USD 1,000,000 | Hard at 100% |
| Amber Alert | USD 800,000 | Notify Helena + Saskia (Head of Global Markets, governance) within 1 business hour |

### 1.5 Recommended intraday peak position limit

**Recommendation: USD 1,500,000 (intraday peak gross open USD/ZAR position at any point during the trading day).**

Workings:

- Intraday must give the desk some headroom over EOD to manage transient warehousing while a hedge or client offset is being arranged (`Policies/trading-mandate-v1.md §3` warehoused franchise hedge concept).
- Headroom is 1.5× EOD, not the larger multiples used in steady-state franchises, because the warehousing window at controlled-launch is short (one or two named counterparties, same-day matching).
- A `Hard` breach of the intraday cap is an immediate halt on incremental risk-adding trades (offset trades are still permitted to bring the position down). Per `Policies/trading-mandate-v1.md §5.2` and `Procedures/markets/dealer-mandate-breach-handling.md §5 Step 2`, Saskia performs Level-1 triage within 30 minutes; I perform Level-2 review within 4 business hours if material (> 10% of the intraday cap = > USD 150,000).

| Limit | Value | Trigger |
|---|---|---|
| Intraday peak gross open USD/ZAR position | USD 1,500,000 | Hard at 100% — block incremental risk-adders |
| Amber Alert | USD 1,200,000 | Notify Helena + Saskia within 30 minutes |

### 1.6 Calibration basis — explicit declaration

The MR-1-FX limit in §1.1 is calibrated under a **parametric volatility-scaled approach** anchored on a **conservative judgemental position ceiling**, not on a historical-simulation VaR of an existing book.

Specifically:

1. **Why not historical simulation.** The bank has zero history of FX-spot positions. A historical simulation requires a 250-business-day P&L series (`Policies/market-risk-policy-v1.md §4.3` for IMA; analogous lookback for the SA-consistent VaR methodology used at controlled-launch). The series does not exist. A simulation over an empty book is meaningless.
2. **Why not the full FRTB SA SBM (FX delta sensitivity).** The SA engine exists per `PROC-RISK-FRTB-SA-01` and Rohan (Market risk quantitative engineer, engineering) has implemented FX product → FX risk class mapping, but the engine has not been independently validated for the FX spot product (G-2 of my scope review). I refuse to anchor the limit number on an engine that has not been validated. The SA engine will run and produce typed `MarketRiskMeasureComputed` events from day one (per `Policies/market-risk-policy-v1.md §1 events-first`), but those events are advisory under controlled-launch — the binding limit is the parametric calibration in §1.1 above.
3. **Why parametric.** The parametric approach takes (i) a conservative judgemental ceiling on open position (§1.4), (ii) a published, widely-validated FX volatility input (SARB daily-fixing realised volatility), and (iii) standard parametric VaR mathematics. Every step is BRC-explainable.
4. **Why the 0.85% volatility input is conservative.** USD/ZAR realised daily volatility over the past five years has cycled between approximately 0.5% (calm 2020–21) and 1.4% (March 2020 COVID dislocation; February 2023 inflation spike). The 0.85% figure sits comfortably in the middle of the range and is consistent with the 250-business-day rolling window. Rohan will confirm the precise number from the SARB series before the BRC sitting; the limit number in §1.1 has been rounded down for conservatism, and small movements in the volatility input do not change the BRC-tabled limit of ZAR 350,000.
5. **Why round down rather than up.** Conservative-bank principle for first-trade calibration. A first FX-spot trade should not be calibrated against the upper bound of what the maths supports.

### 1.7 Controlled-launch tightening factor (vs. eventual `live` limit)

The controlled-launch limit MUST be more conservative than the eventual `live` limit (per the brief). The gap I am proposing:

| Dimension | Controlled-launch (this proposal) | Eventual steady-state `live` target | Tightening factor |
|---|---|---|---|
| MR-1-FX 1-day 99% VaR | ZAR 350,000 | ZAR 5,000,000 (illustrative; subject to BRC at activation) | ~14× tighter |
| EOD open position USD/ZAR | USD 1,000,000 | USD 27,000,000 (illustrative; consistent with R500m steady-state placeholder in trading-mandate §5.2) | ~27× tighter |
| Intraday peak position USD/ZAR | USD 1,500,000 | USD 40,000,000 (illustrative) | ~27× tighter |
| Per-counterparty daily notional | USD 500,000 | Subject to credit-limit engine + concentration policy at `live` | tighter |
| Counterparty whitelist | 2 names | All approved markets counterparties per `PROC-MK-CO-01` | Concentrated |
| Pair set | USD/ZAR only | All approved pairs (Trading Mandate dependent) | Concentrated |

The `live` numbers above are **illustrative** — they are not part of this proposal's request. The point is that the controlled-launch ceiling is between 14× and 27× tighter than the steady-state placeholder in the trading mandate. The bank cannot quietly drift from controlled-launch to steady-state — the trigger to lift (§1.8) is a separate BRC decision.

### 1.8 Trigger to upgrade from controlled-launch to live limits

The criteria for asking the BRC to lift to steady-state. **All must be met** before BRC tabling; tabling and approval are separate events.

| # | Criterion | Owner of evidence |
|---|---|---|
| 1 | **20 consecutive business days clean** of MR-1-FX VaR or EOD position breaches at controlled-launch limits. "Clean" = no Amber Alert that persisted into a second business day, no Hard Breach at all. | Rohan (daily) + Helena (sign-off) |
| 2 | **G-1 closed.** Production FX quote feed live; SARB daily fixing tagged `provenance = "production"` in `MarketDataStore`; staleness-threshold control firing typed events (depends on G-6 — defer if G-6 not closed in parallel). | Devon (Chief Operating Officer, governance) + Helena |
| 3 | **G-2 closed.** Nadia (Independent-validation engineer, peer-in-second-line under Helena) has produced an independent validation report on the FRTB SA engine for FX spot product; `ModelValidationCompleted` typed event in the log. | Nadia |
| 4 | **G-5 closed.** Vera (internal audit engineer) Wave-4 B-cluster recon pipeline deployed and green for 5 consecutive trading days, computing L-B8a-1 through L-B8a-5 from live `FxSettlementInstructed` events. | Vera (deployment) + Helena (5-day clean attestation) |
| 5 | **G-7 closed.** SA-CCR engine produces a non-zero (or explicitly justified zero) exposure event for at least one FX spot trade during controlled-launch; calculation reviewed by Rohan against the BCBS SA-CCR FX product factors. | Rohan |
| 6 | **G-3 closed.** `FxTradeExecuted` event schema carries `clientFlowRef` and `hedgeProgrammeRef` attribution fields; MR-5 daily no-prop sweep returns 100% attributed across the controlled-launch period. | Atlas (Core banking platform architect) + Kai (Structured rates trader, markets) + Rohan |
| 7 | **Post-implementation review complete.** The 90-day PIR per `Procedures/by-policy/npa-gate.md` Step 13 has been tabled at the Market Risk Committee with no open material findings. | Saskia + Helena |
| 8 | **Operational-loss tally clean.** No FX-settlement-related operational loss event during controlled-launch (any Herstatt-window failure, any failed-trade event escalated under `Procedures/finance/fx-settlement-reconciliation.md`). | Tomas (Operations & payments engineer) + Helena |

When all eight criteria are met, I will table a Trading Mandate amendment + a fresh MR-1-FX `live` limit calibration at the BRC. Until then, controlled-launch numbers stand.

---

## Section 2 — Compensating-Control Attestation Block

This block covers the three substrate gaps being deferred past first trade, per the brief: **G-1, G-2, G-5**. For each gap, the same six sub-fields are populated. The attestation is the entire basis on which I am willing to recommend that the BRC approve a first FX-spot trade despite the gap.

### 2.1 G-1 — No production FX quote feed

**Gap (verbatim from scope review §6 G-1):** No production FX quote feed (`Policies/valuation-policy-v1.md §9 Gap 1`). `MarketDataSources.FX_SIM` is `provenance = "simulated"`. SARB daily fixing is the current operative fallback. The SARB fixing must be tagged explicitly as `provenance = "production"` in the `MarketDataStore` and the valuation query pipeline verified.

**Risk left uncovered if the compensating control fails (one sentence):** End-of-day MTM and IPV of the FX-spot book use stale or simulated market data, producing a mis-stated daily P&L, an invalid VaR/ES input, and a regulatory-return error on BA-325.

**Compensating control:** EOD valuation is performed manually against the SARB daily fixing. Helena (or Helena's delegated risk-officer alternate per `Procedures/by-policy/market-risk-monitoring.md`) confirms the SARB fixing has been published for that day, retrieves the figure from the SARB website (or, if unavailable by EOD, escalates and uses the prior-day fixing with an explicit `MarketDataStaleEntry` log line — pending the typed event under G-6), and supplies the figure to Rohan for the daily MTM run. The figure is recorded in a daily log alongside the source URL and the retrieval timestamp.

**Detection cadence:** Daily, at EOD (16:30 SAST). Manual confirmation occurs as part of the daily MR pack closeout.

**Failure mode:** If Helena misses an EOD cycle, the desk is operating without a confirmed reference rate. In that case, Saskia is empowered to issue a "no-add" directive — no new FX-spot positions until the rate is sourced. Existing positions continue to use the most recent confirmed fixing for the overnight MTM; the next morning's first action by Helena is to confirm the missed fixing and back-MTM the prior EOD.

**Reactivation trigger (this control is removed when):** Production FX quote feed live; SARB daily fixing (or a higher-priority production feed e.g. Bloomberg BFIX once live) tagged `provenance = "production"` in `MarketDataStore`; staleness-threshold typed event (`MarketDataStaleAlert`, G-6) firing on `recon:staleness-threshold-compliance`; 5 consecutive trading days clean of stale-data exceptions.

**Audit evidence for a SARB supervisor:** (i) Daily MR pack containing the dated SARB fixing entry with source URL and retrieval timestamp; (ii) Helena's signature line on the daily MR pack confirming the fixing; (iii) the `MarketRiskMeasureComputed` event emitted by Rohan for that day, which carries the fixing rate in its inputs payload (audit-trace from event to MR pack).

---

### 2.2 G-2 — FRTB SA engine: FX product → risk class mapping not production-validated for spot

**Gap (verbatim from scope review §6 G-2):** FRTB SA engine: FX product → risk class mapping not production-validated for spot (`Policies/market-risk-policy-v1.md §8.1`). The SA engine exists per `PROC-RISK-FRTB-SA-01` and the procedure maps FX spot to the FX risk class (SBM delta). But the engine has not been independently validated (Nadia) against a live FX-spot fixture.

**Risk left uncovered if the compensating control fails (one sentence):** FRTB SA capital reported on BA-325 is materially misstated, either understating the capital requirement (regulatory under-reporting → PA finding) or overstating it (capital inefficiency, no regulatory finding but operational concern).

**Compensating control:** Dual-track capital computation. (i) Rohan's FRTB SA engine produces `FrtbSaCapitalComputed` events daily — these are recorded but **not used as the binding capital number** for internal limit governance during controlled-launch. (ii) Helena computes a **manual SA capital number** for the FX-spot book using a spreadsheet-based SBM-delta-only calculation (per BCBS FRTB SA Ch. 5: FX delta sensitivity × prescribed FX risk weight, with no curvature, vega, or other components — FX spot has none). The manual figure is cross-checked against Rohan's engine figure each day. Any divergence > 5% triggers an investigation; divergence > 15% triggers a Helena escalation to the Market Risk Committee.

**Detection cadence:** Daily, at EOD, in parallel with the daily MTM/MR pack. The cross-check is part of the daily MR pack template.

**Failure mode:** If Helena misses the manual cross-check cycle, the engine's figure runs unchecked for that day. The procedure permits up to two consecutive missed cycles before the controlled-launch limit framework is suspended (no new trades) pending a Saskia + Helena dual sign-off. Three missed cycles → automatic suspension; reactivation requires a fresh Market Risk Committee sign-off.

**Reactivation trigger (this control is removed when):** Nadia has produced an independent validation report on the FRTB SA engine for the FX spot product (`ModelValidationCompleted` event with `modelId: 'frtb-sa-engine-v1'`, `productScope: 'fx-spot'`, `outcome: 'validated'`); the validation report has been tabled at the Market Risk Committee with no open material findings; 10 consecutive trading days clean of > 5% divergence between manual and engine figures.

**Audit evidence for a SARB supervisor:** (i) Daily MR pack containing both the engine figure (from the typed event) and the manual figure (from Helena's spreadsheet) side-by-side, with the divergence calculation; (ii) the daily `FrtbSaCapitalComputed` event for the FX spot book; (iii) Helena's spreadsheet checked into a secure share with a daily snapshot retained per the document-retention schedule; (iv) the monthly BA-325 submission consistent with the manual figure (with a footnote stating the engine is unvalidated and the manual figure governs).

---

### 2.3 G-5 — FX settlement risk limit (MR-B8a — B-cluster continuous controls) not automated

**Gap (verbatim from scope review §6 G-5):** FX settlement risk limit (MR-B8a — B-cluster continuous controls) not automated (`Policies/trading-mandate-v1.md §9 Gap 3`). The B-cluster recon harness computing L-B8a-1 to L-B8a-5 over live `FxSettlementInstructed` events is a Vera Wave-4 backlog item. Until it lands, Helena monitors manually.

**Risk left uncovered if the compensating control fails (one sentence):** Settlement-rail concentration on Standard Bank (or the FirstRand backup) breaches the B8a RAS lines silently — the dominant Herstatt-risk exposure on an FX-spot book is unmonitored.

**Compensating control:** Daily manual B-cluster settlement-exposure review. Tomas (Operations & payments engineer) produces a daily settlement-exposure summary from the `FxSettlementInstructed` event log (event type per the FX messaging layer, project_continuation_2026_05_19_fx_messaging memory). The summary shows: (a) gross intraday settlement exposure to Standard Bank (USD-leg + ZAR-leg); (b) gross intraday settlement exposure to FirstRand (if used as backup); (c) the position relative to the L-B8a-1 to L-B8a-5 limit lines. Helena reviews the summary and signs off each business day before the next-day trading window opens. Controlled-launch settlement volume is sufficiently low (max one or two trades per day, max USD 1.5m intraday peak per §1.5) that manual review remains tractable.

**Detection cadence:** Daily, at start-of-business (08:00 SAST) before the trading window opens for the day. Any breach detected blocks the trading window from opening until Helena has signed off a remediation plan.

**Failure mode:** If Helena misses the morning sign-off, Saskia issues a "no-add" directive: the trading window does not open for that day. Existing positions are held until the next confirmed sign-off. If the morning sign-off is missed for two consecutive days, the controlled-launch is suspended pending a Market Risk Committee meeting.

**Reactivation trigger (this control is removed when):** Vera Wave-4 B-cluster recon pipeline deployed and green for 5 consecutive trading days, computing L-B8a-1 to L-B8a-5 from live `FxSettlementInstructed` events; a typed `BClusterReconCompleted { date, B8a1..B8a5: pct, status: green|amber|red }` event in the log; Market Risk Committee sign-off on automation cutover.

**Audit evidence for a SARB supervisor:** (i) Daily B-cluster settlement-exposure summary, archived in the daily MR pack; (ii) Helena's morning sign-off entry (timestamp + signature line); (iii) the underlying `FxSettlementInstructed` events in the event log, audit-traceable from the summary; (iv) the Saskia "no-add" directives issued on any day the sign-off was missed, with the next-day catch-up entry.

---

## Section 3 — BRC Submission Pack (one-page, for board tabling)

**To:** Board Risk Committee (BRC) — Marc (CEO) chairing the interim BRC seat per `D-THIN-HUMAN-LAYER-MINIMUM`
**From:** Helena (Chief Risk Officer, governance)
**Subject:** Controlled-launch limit framework for first FX-spot trade — recommendation to approve
**Date:** 2026-05-20

**The product.** FX spot, USD/ZAR only, T+2 deliverable, SWIFT-correspondent settlement (Standard Bank primary; FirstRand backup). One Trading Mandate-listed product, one currency pair, one settlement rail. Counterparty whitelist of two named institutional counterparties (Standard Bank Corporate Treasury and Investec Bank Treasury); both onboarded under `PROC-MK-CO-01`. First trade is a controlled launch under `Procedures/by-policy/npa-gate.md` stage-5 handoff to `product-controlled-launch.md`, not a full `live` activation.

**The proposed limits.**

| Limit | Value | Type |
|---|---|---|
| MR-1-FX (1-day 99% VaR) — FX-spot book | **ZAR 350,000** | Risk-measure ceiling |
| EOD open position USD/ZAR | **USD 1,000,000 (≈ ZAR 18.5m)** | Notional ceiling |
| Intraday peak position USD/ZAR | **USD 1,500,000** | Notional ceiling |
| Per-counterparty daily gross notional cap | **USD 500,000** | Concentration cap |
| Counterparty whitelist | **2 names** | Discrete |
| Pair set | **USD/ZAR only** | Discrete |

Calibration is parametric (volatility-scaled) anchored on a conservative judgemental position ceiling, not historical simulation (no history exists). The volatility input is the SARB daily-fixing realised 1-day standard deviation over 250 business days, used at a conservative 0.85% (mid-range of recent regimes). Tightening factor versus the eventual steady-state target is 14× to 27× across the limit lines. Workings in Section 1 above.

**The compensating controls (and why they are acceptable for controlled launch).** Three substrate gaps are being deferred past first trade: (i) no production FX quote feed (G-1); (ii) FRTB SA engine for FX-spot not independently validated (G-2); (iii) B-cluster settlement-recon harness not automated (G-5). Compensating controls in §2 above: G-1 covered by Helena daily-confirmed SARB fixing; G-2 covered by dual-track manual SA-SBM-delta computation cross-checked against the engine; G-5 covered by Tomas-produced manual B-cluster summary with Helena morning sign-off. Each control has explicit detection cadence, failure mode, reactivation trigger, and audit evidence. The acceptable-for-controlled-launch judgement rests on three points: (a) the controlled-launch volume is small enough for manual review to be tractable; (b) the limits in §1 above are tight enough that an undetected control failure cannot translate to a material loss in a single cycle; (c) the trigger to lift to live (§1.8 above) requires each gap to be closed, so the controls cannot persist into steady-state.

**The trigger to lift to live.** Eight criteria, all of which must be met before I will table a `live` limit calibration at the BRC: 20 consecutive business days clean at controlled-launch limits; G-1, G-2, G-3, G-5, G-7 closed (substrate complete); 90-day post-implementation review tabled at the Market Risk Committee with no open material findings; no FX-settlement-related operational loss event during controlled-launch. Full list in §1.8 above.

**Recommendation.** The BRC is asked to **approve the controlled-launch MR-1-FX limit framework** in Section 1 above, **approve the compensating-control attestation block** in Section 2 above as standing controls for the controlled-launch period, and **note the trigger criteria** in §1.8 above as the basis for any future request to lift to live limits.

---

## Section 4 — Gaps I Cannot Answer

The brief asks me to surface anything I cannot determine from current artefacts. I do not paper over these.

1. **Precise 250-day realised volatility of the SARB daily fixing.** I used 0.85% in §1.1 as a conservative round-number consistent with the historical band. The actual figure must be computed by Rohan from the SARB historical-fixing series before the BRC sitting. If the actual figure is materially higher (> 1.0%) the limit number must be lowered or the position ceiling must be tightened; if materially lower (< 0.7%) the proposal stands unchanged (conservatism direction).

2. **Precise USD/ZAR conversion rate for the limit reference.** I used 18.50 throughout. The actual conversion at the time of BRC sitting will differ; the limits in §1 are denominated in USD on the position side and ZAR on the VaR side, so the conversion ambiguity affects only the cross-check arithmetic, not the limits themselves.

3. **The exact ExCon Authorised Dealer net-open-position daily limit for the bank.** This is a Zara (Chief Compliance Officer, governance) monitoring item under `Policies/trading-mandate-v1.md §6`. The USD 1,000,000 EOD figure in §1.4 is comfortably below any plausible ExCon limit for a bank at our capital tier, but I have not retrieved the exact ExCon figure — Zara should confirm before the BRC sitting that the proposed EOD limit sits comfortably inside the ExCon envelope (it certainly does at first FX-spot trade volumes, but the explicit confirmation is the cleaner audit trail).

4. **The precise documentation of the "first-trade counterparty whitelist".** I have named Standard Bank Corporate Treasury and Investec Bank Treasury based on the typical onboarding pipeline for an FX-spot institutional book in South Africa. I have not verified that both are actually onboarded under `PROC-MK-CO-01` with live credit-limit-engine headroom as of 2026-05-20. Saskia + Yusuf (Onboarding officer, markets) should confirm before the BRC sitting; if either name is not onboarded, the whitelist needs to be adjusted (the limit numbers are unchanged — they govern the desk-wide envelope, not per-counterparty allocation beyond the §1.3 daily notional cap).

5. **The trigger criterion #5 (G-7 closure) requires at least one FX spot trade.** This is a tautology: G-7 (SA-CCR engine producing an FX-spot exposure event) cannot be tested without an FX-spot trade. The implicit dependency is that G-7 is verified during the controlled-launch period itself, not before first trade. This is intentional and consistent with the controlled-launch concept, but the BRC should note it.

6. **The illustrative "eventual `live`" numbers in §1.7.** Those numbers are scaffolding for the tightening-factor argument; they are not part of the request. Helena (me) will recalibrate the `live` numbers in a separate proposal when the trigger criteria in §1.8 are met. The numbers shown are not commitments to specific future limits.

7. **The BRC's intra-controlled-launch monitoring cadence.** `Procedures/by-policy/npa-gate.md` Step 12–13 prescribes "minimum: daily for first 90 days" controlled-launch monitoring. The cadence for BRC reporting (vs. Market Risk Committee daily) during the 90-day controlled-launch period is implicit. I would propose: daily Market Risk Committee touch-point (chair: Helena); fortnightly BRC update with limit-utilisation summary; immediate BRC convening on any Hard Breach or any compensating-control failure. The BRC may set a different cadence.

---

*Helena (Chief Risk Officer, governance)*
*2026-05-20*
*Brief: `brief:helena:controlled-launch-mr-1-fx-limit-proposal-compens:2026-05-20`*
*Workstream: WS-MARKET-RISK-PROCEDURES*
