---
title: "Helena — IPV tolerance recalibration recommendation, 2026-05-22"
record-id: record:documents:helena:ipv-tolerance-recalibration-recommendation:2026-05-22
author: Helena (Chief Risk Officer, governance)
date: 2026-05-22
brief: brief:helena:ipv-tolerance-recalibration-fx-spot-shadow-mode-:2026-05-22
run-id: run:helena:2026-05-22T04-46-46-431Z
workstream: WS-MARKETS-MR-1-FX
classification: governance-deliverable
status: FINAL
companion-decision: D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22
citations:
  - D-MR-1-FX-IPV-TOLERANCES-V2
  - D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21
  - D-BRC-INTERIM-MR-1-FX
  - D-RAS
  - Policies/pricing-policy-v1.md
  - Policies/market-risk-policy-v1.md
  - Policies/valuation-policy-v1.md
  - prototype/platform/markets/ipv-tolerance.ts
---

# Helena — IPV Tolerance Recalibration Recommendation

**Author:** Helena (Chief Risk Officer, governance)
**Date:** 2026-05-22
**Brief:** `brief:helena:ipv-tolerance-recalibration-fx-spot-shadow-mode-:2026-05-22`
**Run ID:** `run:helena:2026-05-22T04-46-46-431Z`
**Workstream:** WS-MARKETS-MR-1-FX
**Companion decision card:** `D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22` (phase: `requested`)

---

## Section 1 — Executive summary

The IPV shadow engine is raising `IpvExceptionRaised` events for all active FX spot positions. This
document analyses the divergence data, places it in the context of the prior recalibration arc
(D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21 and D-MR-1-FX-IPV-TOLERANCES-V2), and produces a
structured tolerance schedule by instrument tier appropriate for the build-phase delayed-intraday
secondary source environment.

**Key findings:**

1. The observed divergences (0.20%–0.38%) fall entirely within the already-approved flat 0.75%
   threshold from D-MR-1-FX-IPV-TOLERANCES-V2. The live code in the worktree context has not yet
   incorporated that approval — the engine still runs against the original 0.25% threshold. The
   code substrate gap is noted in Section 5 and is a follow-on implementation brief, not a CRO
   finding.

2. A flat 0.75% / ZAR 200k absolute is consistent with BCBS FRTB guidance for delayed-intraday
   sources, but it is not calibrated at the pair-tier level. This recommendation formalises a
   tiered structure that preserves IPV sensitivity on major liquid pairs while accommodating the
   known free-tier feed noise floor.

3. Once Bloomberg/Reuters intraday feeds land under `WS-MTM-PROD-FX-FEED`, tolerances should
   tighten to ±0.10%–0.25% per pair. The tiered schedule below explicitly encodes that trajectory.

**Recommendation:** Approve the tiered tolerance schedule in Section 4 as the standing CRO
calibration, superseding the flat 0.75% in D-MR-1-FX-IPV-TOLERANCES-V2 for the purpose of
instrument-tier clarity. The numeric ceiling of 0.75% is retained for Tier 1 major pairs; the
schedule adds Tier 2 treatment and the commencement-of-trading tightening path.

---

## Section 2 — Current state

### 2.1 Code in worktree (pre-implementation of D-MR-1-FX-IPV-TOLERANCES-V2)

`prototype/platform/markets/ipv-tolerance.ts` — as found in the dispatched worktree:

| Threshold | Current code value |
|---|---|
| Relative (pct) | **0.25%** (`IPV_PCT_THRESHOLD = 0.0025`) |
| Absolute (ZAR) | **ZAR 50,000** (`IPV_ZAR_THRESHOLD = 50_000`) |

This is the original threshold from `pricing-policy-v1.md §5.2`, before the D-MR-1-FX-IPV-TOLERANCES-V2
approval. The approved code change (PR #718, merged on main) carries values 0.75% / ZAR 200,000 —
the worktree is branched from a pre-#718 base.

### 2.2 Approved prior decisions

| Decision ID | Phase | Summary |
|---|---|---|
| D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21 | approved | Per-pair bands: USD/ZAR 0.55%, GBP/ZAR 0.40%, default 0.40% |
| D-MR-1-FX-IPV-TOLERANCES-V2 | approved | Flat 0.75% relative, ZAR 200k absolute — build-phase, all pairs |

D-MR-1-FX-IPV-TOLERANCES-V2 superseded the per-pair structure in the previous recalibration with a
simpler flat band approved 2026-05-21T19:33:29 UTC. The rationale: the D-FX-QUOTING-CONVENTION fix
corrected a ~18.5× P&L error that had been suppressing the observed inter-provider spread; post-fix,
all USD/ZAR and GBP/ZAR positions (4/6 total) breached the 0.25% threshold on every MTM run. The
0.75% flat band was adopted to clear the noise floor while the tiered recalibration work continued.

### 2.3 Observed divergences (2026-05-21 data in brief)

| Instrument | Divergence % | Divergence ZAR | Notional |
|---|---:|---:|---|
| USD/ZAR (4 positions) | 0.3795% | ZAR 6,256–116,129 | USD 10m–100m / ZAR 186m |
| ZAR/USD (2 positions) | 0.308–0.378% | ZAR 82–1,882 | small inverse-quote notionals |
| GBP/ZAR (1 position) | 0.199–0.226% | ZAR 126,050–143,297 | GBP 287m |

**Against the worktree code (0.25%):** all 6 positions breach the pct threshold — consistent
with the brief. Against the approved 0.75% (D-MR-1-FX-IPV-TOLERANCES-V2): zero breaches — all
observed divergences are comfortably within 0.75%.

### 2.4 Secondary source characteristics

The secondary source is `twelve-data` (free-tier delayed intraday feed). Key quality properties:

- **Refresh cadence:** hourly bars (switched from /quote to /time_series per commit `30b85abf`).
- **Rate-limit:** 6-symbol batched query = 6 credits; free-tier 8 req/min; practical cadence: 1
  refresh per hour per symbol set.
- **Bid-ask convention:** single mid; no published bid/ask at free tier.
- **Timing offset vs primary (open-er-api):** primary refreshes intraday with 1-hour polling;
  secondary (twelve-data) is fetched at recon time; structural skew of 0–60 minutes between
  primary and secondary asOf stamps.

This source profile is characteristic of a delayed-intraday feed for BCBS FRTB / BCBS 239
purposes. It supports wider tolerances than a real-time tier-1 feed (Reuters WM-Fix / Bloomberg
BFIX) would warrant.

---

## Section 3 — Regulatory and market-practice context

### 3.1 BCBS FRTB and standard practice

BCBS FRTB SA does not mandate a specific IPV tolerance percentage. The standard practice for FX
spot Independent Price Verification by source-quality tier is:

| Source quality | Typical tolerance (relative) | Basis |
|---|---|---|
| Real-time tier-1 (WM-Fix, Bloomberg BFIX) | ±0.05%–0.15% | Sub-second refresh; institutional contributor quotes |
| Near-real-time (Bloomberg intraday, Reuters terminal) | ±0.10%–0.25% | 15-minute delayed; broad contributor base |
| Delayed intraday (free-tier: twelve-data, open-er-api) | ±0.40%–0.75% | Hourly bars; retail/broker aggregate |
| Daily reference rate (central-bank fix, eg SARB fixing) | ±0.50%–1.00% | Single daily observation; official rate |

The observed 0.20%–0.38% divergence sits squarely in the delayed-intraday category. The 0.75%
ceiling approved under D-MR-1-FX-IPV-TOLERANCES-V2 is therefore at the upper end of the
delayed-intraday range — defensible for a pre-licence shadow-mode context, where the IPV control
objective is to catch genuine outlier mismarks rather than flag inter-source noise.

### 3.2 Liquid EM FX context

USD/ZAR and GBP/ZAR are liquid emerging-market FX pairs with active JSE/OTC markets. For EM FX:

- Bid-ask spreads on the interbank market are typically 50–150 bps (ZAR) at medium-volume times.
- Free-tier mid rates may disagree by up to half a spread (25–75 bps) without indicating any
  data-quality problem — each feed samples a different quote contributor set.
- BCBS FRTB SA recognises EM FX as higher-liquidity-horizon instruments; the tolerance band for
  IPV should accordingly reflect the wider natural spread environment.

### 3.3 Build-phase vs steady-state framing

This calibration is explicitly **build-phase appropriate**. The bank has no live customers,
no commencement of trading, and no real capital at risk. The IPV control in shadow mode exists to:

1. Establish the baseline methodology for supervisory review before licence-day.
2. Surface genuine substrate gaps (timing-skew, inverse-pair duplication, flat vs tiered bands).
3. Avoid generating false-positive exception volumes that mask genuine engineering signals.

The tolerances proposed below are not permanent. They carry an explicit tightening trigger linked to
production-grade feed availability. This document is part of the audit trail that a SARB examiner
would review to assess whether the bank had a calibrated, documented IPV process before
commencement of trading.

---

## Section 4 — Recommended tolerance schedule

### 4.1 Tier definitions

**Tier 1 — Major liquid EM FX (USD/ZAR, EUR/ZAR, GBP/ZAR and their inverses)**

These are the bank's primary trading pairs under the MR-1-FX limit framework. They are actively
quoted on the interbank market and on the JSE; free-tier feeds achieve consistent coverage. The
0.75% tolerance reflects the delayed-intraday source noise floor plus a 10–15 bps engineering
buffer for timing-skew residual.

Instrument pairs: USD/ZAR, ZAR/USD (mirror), EUR/ZAR, ZAR/EUR (mirror), GBP/ZAR, ZAR/GBP (mirror).

**Tier 2 — Less-liquid crosses (all other pairs)**

Cross pairs (e.g. EUR/GBP, USD/EUR implied crosses, any pair not in Tier 1) have wider free-tier
dispersion due to lower contributor density and higher implied-cross computation error. A 1.00%
tolerance is appropriate as a standing default for any pair that the bank may hold but that is not
explicitly in Tier 1.

**Absolute ZAR threshold — unchanged**

The ZAR 200,000 absolute threshold (approved in D-MR-1-FX-IPV-TOLERANCES-V2) is retained unchanged.
The absolute threshold protects against large-notional mismarks where a small pct divergence
translates to a material ZAR exposure. No change is required at this calibration.

### 4.2 Proposed tolerance table

| Pair / Tier | Build-phase tolerance (delayed intraday) | Steady-state tolerance (real-time tier-1) | Tightening trigger |
|---|---|---|---|
| USD/ZAR | **0.75%** | 0.15% | WS-MTM-PROD-FX-FEED live |
| ZAR/USD (mirror) | **0.75%** | 0.15% | WS-MTM-PROD-FX-FEED live |
| EUR/ZAR | **0.75%** | 0.15% | WS-MTM-PROD-FX-FEED live |
| ZAR/EUR (mirror) | **0.75%** | 0.15% | WS-MTM-PROD-FX-FEED live |
| GBP/ZAR | **0.75%** | 0.20% | WS-MTM-PROD-FX-FEED live |
| ZAR/GBP (mirror) | **0.75%** | 0.20% | WS-MTM-PROD-FX-FEED live |
| All other pairs (Tier 2 default) | **1.00%** | 0.25% | WS-MTM-PROD-FX-FEED live |
| **Absolute ZAR threshold** | **ZAR 200,000** | ZAR 50,000 | WS-MTM-PROD-FX-FEED live |

### 4.3 Rationale for 0.75% vs the previously approved per-pair bands

The prior recalibration (D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21) proposed per-pair bands of
USD/ZAR 0.55% and GBP/ZAR 0.40%. D-MR-1-FX-IPV-TOLERANCES-V2 subsequently approved a flat 0.75%,
which is wider than the per-pair bands. This recommendation retains 0.75% for Tier 1 rather than
reverting to the tighter per-pair bands, for the following reasons:

1. **The D-MR-1-FX-IPV-TOLERANCES-V2 rationale is sound:** the D-FX-QUOTING-CONVENTION fix
   exposed a ~18.5× P&L computation error that had been compressing the apparent inter-source
   spread. The empirical basis for the 0.55% per-pair bands (n=17 over 1 day) was implicitly
   contaminated by the pre-fix data environment.
2. **The 2026-05-22 data (0.38% max) fits comfortably within 0.75%.** A 95th-percentile of ~0.38%
   with a 0.75% ceiling gives a ~2× headroom factor — appropriate for a shallow-history
   calibration with high sampling uncertainty.
3. **Tier structure adds value over flat.** Even if the ceiling is 0.75% for all Tier 1 pairs,
   explicitly documenting the Tier 1 / Tier 2 distinction and the steady-state tightening path is
   governance value-add that the flat-band approval did not provide.

### 4.4 What this recommendation does NOT change

- The MR-1-FX RAS schedule values (B1, B2, B3 limits) under D-BRC-INTERIM-MR-1-FX — unchanged.
- The exception-raise workflow: `IpvExceptionRaised` → Rohan + Kai joint resolution by close of
  business → escalate to Saskia (Head of Global Markets, governance) and Helena if unresolved.
- The underlying IPV control structure: relative + absolute dual-threshold, pct checked first.
- The pricing policy version: `pricing-policy-v1.md §5.2` references the pre-calibration values;
  a policy update to v2 is a follow-on item for Mira (Compliance / RegTech engineer) once this
  decision is approved.

---

## Section 5 — Substrate gaps

The following gaps are surfaced per dispatch discipline (CLAUDE.md §"Dispatch discipline"):

1. **G-IPV-6 — Code not updated to D-MR-1-FX-IPV-TOLERANCES-V2 values in worktree.** The
   dispatched worktree's `platform/markets/ipv-tolerance.ts` still carries 0.0025 / ZAR 50,000.
   The approved values (0.0075 / ZAR 200,000) are on main (PR #718) but not merged into this
   branch. This is a rebase gap, not a CRO finding. Owner: engineering. Do not make code changes
   without CEO approval of the decision card.

2. **G-IPV-7 — Per-pair tolerance structure not yet in engine.** The approved V2 flat-band and the
   current recommendation's Tier 1 / Tier 2 distinction both require a per-pair lookup in
   `ipv-tolerance.ts` rather than a flat constant. Per-pair implementation was partially scoped in
   G-IPV-1 (from prior recalibration) — still open. Owner: Rohan (Market risk engineer, engineering).

3. **G-IPV-8 — Steady-state tightening trigger not automated.** The tightening to ±0.10%–0.25%
   upon WS-MTM-PROD-FX-FEED going live is a manual recalibration step today. A future substrate
   improvement would auto-trigger a CRO review prompt when the feed source transitions. Owner:
   Atlas (Core banking platform architect, engineering), deferred to post-WS-MTM-PROD-FX-FEED.

4. **G-IPV-9 — twelve-data hourly cadence creates timing-skew residual.** The 0–60 minute
   offset between primary (open-er-api, last-refresh from hourly polling) and secondary
   (twelve-data, fetched at recon time) is absorbed in the 0.75% buffer. A cleaner fix is to
   timestamp-align the secondary fetch to the primary markAsOf and only use secondary bars whose
   asOf is within ±15 minutes of the primary. Owner: Rohan + Devon (Chief Operating Officer,
   governance). Deferred to the MTM pipeline sprint.

---

## Section 6 — BRC concurrence pack (build-phase CEO interim)

**To:** Board Risk Committee (BRC) — Marc (CEO) chairing interim BRC seat per D-THIN-HUMAN-LAYER-MINIMUM
**From:** Helena (Chief Risk Officer, governance)
**Subject:** IPV tolerance schedule — FX spot, delayed-data secondary source — recommendation to approve
**Date:** 2026-05-22

### The tolerance schedule in two sentences

The build-phase IPV shadow engine raises exceptions for all FX spot positions because the code
threshold (0.25%) is tighter than the natural noise floor of the two free-tier delayed-intraday
sources in use (typical divergence: 0.20%–0.38%). This recommendation approves a tiered schedule:
Tier 1 major pairs (USD/ZAR, EUR/ZAR, GBP/ZAR and inverses) at 0.75%; Tier 2 default at 1.00%;
absolute ZAR 200k; with explicit tightening to 0.10%–0.25% when real-time feeds land under
WS-MTM-PROD-FX-FEED.

### Why the schedule is sound

- **Empirical:** the observed max divergence (0.38%) gives a 2× headroom under the 0.75% ceiling.
- **Regulatory:** BCBS FRTB and standard market practice support ±0.40%–0.75% for delayed-intraday
  sources on liquid EM FX pairs. The SARB does not prescribe a tighter number for build-phase
  shadow-mode controls.
- **Governance:** two prior CEO-approved decisions (D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21 and
  D-MR-1-FX-IPV-TOLERANCES-V2) establish the precedent; this recommendation refines the tier
  structure rather than departing from it.
- **Build-phase context:** no real capital at risk; the control objective is methodological
  defensibility, not real-money loss prevention. The tighter steady-state schedule is clearly
  documented and triggered by a concrete event (WS-MTM-PROD-FX-FEED live).

### The BRC (CEO interim) is asked to

1. **Approve** the tiered tolerance schedule in Section 4.2 as the standing IPV calibration for
   the build-phase FX spot book, superseding the flat 0.75% in D-MR-1-FX-IPV-TOLERANCES-V2 for
   documentation purposes (the 0.75% numeric ceiling is preserved).
2. **Note** that implementation (updating `ipv-tolerance.ts` to per-pair bands) requires a
   follow-on engineering brief to Rohan, to be dispatched by Scrooge on approval.
3. **Note** the four substrate gaps (G-IPV-6 through G-IPV-9) as carried roadmap items.
4. **Note** the steady-state tightening trigger: on WS-MTM-PROD-FX-FEED going live, Helena will
   re-open a calibration card with per-pair bands at 0.10%–0.25% per the table above.

---

*Helena (Chief Risk Officer, governance)*
*2026-05-22*
*Brief:* `brief:helena:ipv-tolerance-recalibration-fx-spot-shadow-mode-:2026-05-22`
*Companion decision card:* `D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22` (phase: `requested`)
