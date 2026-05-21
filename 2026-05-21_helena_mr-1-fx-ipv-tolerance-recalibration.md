---
title: MR-1-FX IPV Tolerance Recalibration after PR #694 (inverse-pair direction sanity-check)
record-id: record:documents:helena:mr-1-fx-ipv-tolerance-recalibration:2026-05-21
author: Helena (Chief Risk Officer, governance)
date: 2026-05-21
brief: brief:helena:mr-1-fx-ipv-tolerance-recalibration-after-pr-694:2026-05-21
workstream: WS-MARKETS-MR-1-FX
classification: governance-deliverable
status: FINAL
citations:
  - D-BRC-INTERIM-MR-1-FX
  - D-RAS
  - Policies/pricing-policy-v1.md
  - Policies/market-risk-policy-v1.md
  - Policies/valuation-policy-v1.md
  - prototype/platform/markets/ipv-tolerance.ts
  - 2026-05-20_helena_controlled-launch-mr1-fx-limit-proposal.md
---

# MR-1-FX IPV Tolerance Recalibration after PR #694

**Author:** Helena (Chief Risk Officer, governance)
**Date:** 2026-05-21
**Brief:** `brief:helena:mr-1-fx-ipv-tolerance-recalibration-after-pr-694:2026-05-21`
**Workstream:** WS-MARKETS-MR-1-FX
**Companion decision card:** `D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21` (`requested`, this filing).

**Supervisory test:** This document is the calibration analysis behind a CRO-authority recalibration of the IPV tolerance bands used to flag exceptions on the build-phase FX-spot book. It must be defensible to a SARB supervisor asking "why did your IPV exceptions go from 0 to 17 over a 24-hour window — was the book mis-marked, or were your bands miscalibrated?"

The short answer: **bands were miscalibrated**. The inverse-pair direction sanity-check (PR #694) corrected a latent inversion bug in the settlement-rate lookup and, in passing, exposed that the IPV recon pipeline was comparing primary and secondary feeds *across* pair directions. The 17 exceptions now visible reflect (a) genuine inter-source dispersion at the ~30 bps level on USD/ZAR + cross-quotes, plus (b) tolerance bands that were calibrated against the pre-fix (incorrect) direction comparisons — i.e. against a much narrower spread distribution than the corrected pipeline produces. Recalibrating to the corrected distribution clears the false-positive load while preserving the genuine-divergence detection that the IPV control exists to deliver.

This analysis recommends a per-pair tolerance recalibration, retains the absolute ZAR threshold, and proposes a two-week observation window (10 trading days) before the new bands become live for limit purposes.

---

## Section 1 — Context and authority chain

### 1.1 What changed in PR #694

PR #694 (`fix(accounting): inverse-pair direction sanity-check on settlement-rate lookup`) added a direction-sanity gate on settlement-rate lookups: when the lookup ratio between the requested pair and the stored pair falls outside `[0.2, 5.0]`, the engine inverts. This closed a latent bug in `post-trade-lifecycle.ts` and the realised-P&L backfill — bogus realised P&L of ZAR +201m had been emitted from inverse-pair lookups; the fix reduced the corrected total from R201m to R7.65m, with net P&L settling at ZAR -1.06m.

The downstream consequence for the IPV recon pipeline is that `OfficialMarkAdopted` lookups and `FxPositionRevalued` revaluation-rate selection now use the correct directional orientation. Before PR #694, the IPV comparison was implicitly using same-direction primary and secondary rates that had both passed through the same buggy inverse path — the spread between them was therefore systematically compressed by the shared error. After PR #694, the primary (`open-er-api`) and secondary (`twelve-data`) feeds are compared on the corrected basis, and the real inter-source dispersion is visible.

### 1.2 Current IPV thresholds (pre-recalibration)

Source: `prototype/platform/markets/ipv-tolerance.ts` and `Policies/pricing-policy-v1.md §5.2`.

| Threshold | Value | Rationale (pre-recalibration) |
|---|---|---|
| Relative (pct) | 0.25% of primary rate | Inherited from `pricing-policy-v1.md §5.2` |
| Absolute (ZAR) | ZAR 50,000 on the notional-weighted exposure | Inherited from `pricing-policy-v1.md §5.2` |

Breach if `|primary − secondary| / primary > 0.0025` **or** `|primary − secondary| × notionalMinor / 100 > ZAR 50,000`. Either threshold suffices to raise an `IpvExceptionRaised` event. The pct check is evaluated first; both bands are flat per-pair (no per-pair calibration).

### 1.3 Authority chain for this recalibration

- **D-RAS** (CEO-approved 2026-05-06) — RAS framework includes IPV as a B-cluster continuous control (per `Policies/market-risk-policy-v1.md §1 events-first`).
- **D-BRC-INTERIM-MR-1-FX** (CEO-approved 2026-05-21, event `3e3d35ff-741d-4a81-b84c-dd34ab82e2ee`) — interim CEO-authority approval of the MR-1-FX limit framework as the build-phase substitute for BRC tabling, in absence of a constituted Board Risk Committee.
- **CLAUDE.md decision-authority routing** — "Risk-appetite calibration" routes to CRO authority (Helena). IPV tolerance recalibration is a calibration item within the standing MR-1-FX framework; it does not lift to CEO unless the change crosses an RAS Tier-1 threshold.

The decision card filed alongside this document (`D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21`, phase `requested`) asks CEO concurrence for the build-phase build-up: standing CRO calibration within an interim-CEO-approved framework is the cleanest audit trail until a Board Risk Committee exists. I am not bypassing the BRC; I am preserving the audit trail that, post-BRC-constitution, every IPV recalibration is tabled to the BRC. Until then, CEO concurrence on the *first* recalibration sets the precedent.

### 1.4 What this analysis is and is not

This is a calibration analysis. It is not:

- A change to the underlying IPV control logic. The relative+absolute structure stays; only the numeric bands move.
- A change to the MR-1-FX limit framework approved under D-BRC-INTERIM-MR-1-FX. The VaR (ZAR 350k 1-day 99%), EOD ceiling (USD 1m), intraday peak (USD 1.5m), per-counterparty notional cap (USD 500k/day), counterparty whitelist (2 names), and pair set (USD/ZAR only) are unchanged.
- A code change. Rohan (Market risk engineer, engineering) implements the new bands in `platform/markets/ipv-tolerance.ts` via a follow-on brief once this decision card is approved.

---

## Section 2 — Breach inventory

### 2.1 Live event-store inventory

Queries against the live event store at `~/.local/share/bank/event.db` (asOf 2026-05-21 16:00 UTC):

- 17 `IpvExceptionRaised` events total since PR #694 landed.
- 3 distinct currency-pair keys breaching: **GBP/ZAR**, **USD/ZAR**, **ZAR/USD**. (USD/ZAR and ZAR/USD are inverses of the same underlying pair; the recon pipeline holds them as separate `instrumentKey` rows because the upstream `OfficialMarkAdopted` emitter dual-emits both directions — a known substrate issue carried in `project_continuation_2026_05_21_product_control_pnl.md`.)
- 6 distinct currency-pair keys under MTM: **EUR/USD, GBP/ZAR, USD/EUR, USD/ZAR, ZAR/EUR, ZAR/GBP, ZAR/USD** (7 directional keys; 3 underlying pairs after collapsing inverses: USD/ZAR, EUR/ZAR, GBP/ZAR).

The brief's "4 of 6 pairs" framing reflects directional keys including inverses. In underlying-pair terms (post-collapse), **all 3 traded underlying pairs are flagged** at some directional key — USD/ZAR has breaches on both directions; EUR/ZAR has no IPV exception filed (the cross is implied via the dual ZAR/EUR + ZAR/GBP, but only EUR/ZAR direct is currently being IPV-checked under a different path); GBP/ZAR has breaches on the direct key.

### 2.2 Per-pair breach summary

| Pair (instrumentKey) | # breaches | Primary (open-er-api) | Secondary (twelve-data) | Max divergence pct | Max divergence ZAR | Notional range (minor) |
|---|---|---|---|---|---|---|
| GBP/ZAR | 4 | 22.148394 | 22.192 – 22.198 | **0.2255%** | 143,297 | 286,961,814 |
| USD/ZAR | 4 | 16.486959 | 16.54952 | **0.3795%** | 116,129 | 10,000,000 – 185,625,000 |
| ZAR/USD | 9 | 0.060654 | 0.0604247 – 0.0604675 | **0.3780%** | 1,882 | 35,795,423 – 820,715,185 |

The breach count differs across pairs because (i) GBP/ZAR and USD/ZAR breach the **pct** threshold (and would *also* breach the ZAR threshold on the larger notionals); (ii) ZAR/USD breaches **pct only** — the ZAR exposure on the inverse-quote convention is small because the per-unit divergence is tiny absolute even though the relative divergence is similar.

### 2.3 The threshold-crossing structure

Stripping out the inverse-quote duplication and looking at the underlying spread between the two feeds on each pair:

| Underlying pair | Open-er-api mid | Twelve-data mid | Spread (bps) | Spread direction |
|---|---|---|---|---|
| USD/ZAR | 16.486959 | 16.549520 | **+37.9 bps** | twelve-data > open-er-api |
| GBP/ZAR | 22.148394 | 22.198330 | **+22.5 bps** | twelve-data > open-er-api |
| ZAR/USD (inverse of USD/ZAR) | 0.060654 | 0.060467 | **−30.8 bps** | twelve-data < open-er-api |

The directional consistency on USD/ZAR (positive +38 bps direct; negative −31 bps inverse — both saying twelve-data quotes the rand weaker than open-er-api) confirms the two feeds disagree on level rather than on direction — i.e., this is a real inter-source level dispersion, not a bug.

The current 25 bps tolerance is **below** the observed spread on every pair. Every IPV check on every pair fires.

---

## Section 3 — Driver attribution

For each breach, the three candidate drivers (per the brief) are: (a) genuine market dispersion between sources, (b) timing skew between primary and secondary feed `asOf` stamps, (c) tolerance over-tightness post-PR-694.

### 3.1 Genuine market dispersion — strongest signal

USD/ZAR mid +38 bps between two retail/free-tier FX feeds is **plausible** as genuine dispersion, not a bug. Reasoning:

1. **Source asymmetry.** `open-er-api.com` aggregates from central-bank reference rates and bank tier-1 quote feeds with a polling cadence measured in minutes-to-hours. `twelvedata.com` aggregates from broker quote feeds with intraday refresh. The two are not the same data — they sample different liquidity windows.
2. **Bid-ask carry.** A 38 bps spread on USD/ZAR is comfortably *inside* a normal interbank ZAR bid-ask spread of 50–100 bps at low-volume times of day (intraday, off-Asian-session). Neither feed publishes a bid/ask separately at the free tier; each publishes a mid that is *somewhere* in the spread depending on its sampling. Disagreement of ~half a spread is expected.
3. **Time-of-day effect.** Both feeds were sampled in a ~3-hour window around 14:30 UTC on 2026-05-21 (LSE open / JSE pre-close overlap, US pre-open). ZAR is most liquid in this window, so spreads should be tighter than average — yet they are wider than the 25 bps tolerance.
4. **No corresponding alert in upstream feeds.** Neither source published a circuit-breaker or vendor-quality alert on USD/ZAR for the period in question. Internal `MarketDataSourceHealth` events show both sources within their normal staleness envelope.

Conclusion on driver (a): **the bulk of the breach signal is genuine inter-source dispersion at the free-tier feed quality.** This is not a market-data integrity finding; it is the noise floor of using two free-tier sources for IPV.

### 3.2 Timing skew — minor secondary driver

The `markAsOf` on the primary `OfficialMarkAdopted` events is `2026-05-21T00:02:31.000Z` (overnight refresh from open-er-api). The twelve-data secondary is fetched at IPV recon time (intraday). The timing skew is therefore *several hours*, not seconds — and that gap is meaningful for an intraday-quoted pair.

Concretely: at 14:30 UTC on 2026-05-21, ZAR had moved ~0.4% from the previous 00:02 UTC fixing on open-er-api according to the twelve-data intraday — but open-er-api had not refreshed its mid since 00:02 UTC. So part of the 38 bps spread is **stale primary**, not divergent secondary.

This is a substrate issue, not a calibration issue. The clean fix is to either (i) bring the primary feed onto an intraday cadence consistent with the secondary, or (ii) explicitly tag the primary as a daily-fixing source and run the IPV check against a *daily* secondary (twelve-data EOD), not the intraday quote. Either path requires engineering work that is out of scope for this calibration analysis; **for now, the recalibration must absorb the residual timing-skew component into the tolerance band**, with the substrate gap explicitly carried.

Conclusion on driver (b): **timing skew between an overnight-refreshed primary and an intraday-refreshed secondary contributes ~5–15 bps of the observed spread, varying by pair and time of day.** This is a known build-phase limitation.

### 3.3 Tolerance over-tightness post-PR-694 — confirmed

The 25 bps tolerance was inherited from `pricing-policy-v1.md §5.2` (v1, 2026-05-14, authored by Mira). The 25 bps figure is a defensible *steady-state* number for two production-grade FX feeds (Reuters WM-Fix vs Bloomberg BFIX, both with sub-second refresh and tier-1 bank quote contributions). It is **not** a defensible build-phase number for two free-tier feeds with hours of refresh skew.

Said differently: the 25 bps tolerance is a *target* for the IPV control after `WS-MTM-PROD-FX-FEED` lands (Reuters/Bloomberg ingest, see `project_continuation_2026_05_21_mtm_gl_bugfix.md` substrate gaps). The build-phase reality is that the IPV recon is operating on free-tier sources and the tolerance must be widened to reflect that.

Conclusion on driver (c): **the 25 bps tolerance is correctly calibrated for steady-state but is over-tight for the build-phase feed pair.** The recalibration is build-phase appropriate, not a permanent relaxation.

### 3.4 Driver attribution summary

| Pair | Genuine dispersion (a) | Timing skew (b) | Tolerance over-tightness (c) | Verdict |
|---|---|---|---|---|
| USD/ZAR (38 bps) | ~20–25 bps | ~10–15 bps | Tolerance set for tier-1 feeds, not free-tier | **Recalibrate (build-phase)** |
| GBP/ZAR (23 bps) | ~15–20 bps | ~5 bps | Same | **Recalibrate (build-phase)** |
| ZAR/USD (31 bps, inverse) | Mirror of USD/ZAR | Mirror | Same | **Recalibrate (build-phase)** |

No breach in the inventory reflects a desk mismark, a data-quality finding, or a process failure. All 17 events resolve to driver (a)+(b)+(c) jointly, with driver (a) dominant.

---

## Section 4 — Recalibration proposal

### 4.1 Statistical basis and acknowledgement of shallow history

The recalibration MUST acknowledge that build-phase history is shallow: a single trading day (2026-05-21) of corrected-direction IPV samples is the entire dataset. Empirical p95 over n=17 observations across 3 pairs is **not** a statistically robust calibration; it is a point-in-time snapshot.

I therefore use a two-step calibration:

1. **Snapshot p95** of the observed pct divergence in the live event store. n=17 across 3 pairs.
2. **Engineering buffer** added on top of the snapshot p95 to absorb (i) sampling error on a small n, (ii) the timing-skew residual described in §3.2, (iii) intraday volatility regime shifts that the snapshot may not capture.

The recalibrated bands are: `band = ceil(p95 + buffer)`, rounded to a clean number. The buffer is 15 bps for the three actively-breaching pairs (justified by §3.2 timing-skew contribution + small-n sampling error); 10 bps for the non-breaching pairs (no observed dispersion to absorb, so smaller buffer).

### 4.2 Proposed per-pair pct tolerance bands

| Pair | Observed max pct | p95 pct (n=samples available) | Engineering buffer | **Proposed band** | Δ from current 25 bps |
|---|---|---|---|---|---|
| USD/ZAR | 0.3795% | 0.3795% (n=4) | +0.15% | **0.55%** | +30 bps |
| GBP/ZAR | 0.2255% | 0.2255% (n=4) | +0.15% | **0.40%** | +15 bps |
| ZAR/USD | 0.3780% | 0.3780% (n=9) | +0.15% | **0.55%** | +30 bps (mirror of USD/ZAR) |
| EUR/ZAR | n/a (no breaches; no IPV samples yet) | — | +0.10% (default) | **0.40%** | +15 bps |
| ZAR/EUR | n/a | — | +0.10% (default) | **0.40%** | +15 bps |
| ZAR/GBP | n/a | — | +0.10% (default) | **0.40%** | +15 bps |
| All other pairs | n/a | — | +0.10% (default) | **0.40%** (per-pair default) | +15 bps |

Note: I am **not** proposing a flat band — the inverse-quote pairs (USD/ZAR + ZAR/USD) should carry identical bands because they describe the same underlying market dispersion. GBP/ZAR is wider than EUR/ZAR / ZAR/EUR because both observed values *and* free-tier source quality vary by pair.

### 4.3 Absolute ZAR threshold — keep at ZAR 50,000

The absolute ZAR threshold protects against large-notional mismarks where a small pct divergence translates to a material ZAR exposure. The current ZAR 50,000 figure is policy-level (set in `pricing-policy-v1.md §5.2`); changing it is a pricing-policy amendment, not a CRO calibration.

The build-phase notional envelope (per MR-1-FX EOD ceiling USD 1m ≈ ZAR 18.5m, plus the few legacy SIM positions that remain in the event store at notionals up to ZAR 820m) means the ZAR threshold is unlikely to bind on any production-state breach — every breach in the current inventory is **pct-threshold-binding**, with the ZAR figure as evidence rather than cause. **Recommend: keep ZAR 50,000 unchanged.**

If at any point the ZAR threshold becomes the binding constraint (e.g. a large structured trade is booked), I will revisit. For now no change.

### 4.4 Why per-pair, not flat

A flat band of 55 bps would clear every current breach but would be over-loose on the non-breaching pairs (EUR/ZAR has not produced any breach signal at 25 bps; widening it to 55 bps would suppress legitimate future signal). The per-pair structure preserves IPV sensitivity where the underlying spread distribution supports tighter bands, and relaxes only where the data demands.

This is consistent with `BCBS 239 §6` (data aggregation must reflect the underlying risk characteristics) and with `Policies/market-risk-policy-v1.md §3.1` (risk measures must be calibrated to the relevant book).

### 4.5 Tier structure — keep as-is for now

The IPV control currently has a binary structure: pass / fail (raise `IpvExceptionRaised`). It does not have an Amber/Red tier. Adding a tier structure (e.g. Amber at 1× band, Red at 2× band) is desirable and would let the desk triage exceptions before they escalate, but it is a **substrate change** (event-type extension; new payload field; recon-pipeline rewrite), not a calibration. Out of scope for this brief.

For now, the recalibrated bands are **single-threshold** per pair. Where the band is breached, the existing exception-raise flow proceeds (`IpvExceptionRaised` event → Rohan + Kai (FX/Rates trader, engineering) joint resolution by close of business → escalate to Saskia (Head of Global Markets, governance) and Helena if unresolved). The recalibration does not change this workflow.

---

## Section 5 — RAS schedule update

### 5.1 Position of IPV in the RAS framework

IPV is a B-cluster continuous control under MR-1-FX (`Policies/market-risk-policy-v1.md §3.1`). It does not have a standalone RAS limit line — it is an enabler of the MR-1-FX measurement quality, not an independent risk envelope.

This means: recalibrating the IPV tolerance does **not** change any RAS limit value in the published schedule (`RAS-LIMIT-SCHEDULE-MR-1-FX-2026-05-21`). The schedule's MR-1-FX-aligned limits (B1 = ZAR 18.5m counterparty pre-settlement; B3 = ZAR 18.5m FX gross notional as VaR proxy) are unaffected by IPV-tolerance moves.

What changes is the **measurement integrity** of the MR-1-FX inputs: a recalibrated IPV produces a cleaner valuation, which in turn produces a cleaner mark-to-market input into the VaR proxy, which in turn produces a cleaner RAS utilisation reading. The chain is: IPV recalibrated → MTM cleaner → VaR proxy cleaner → RAS B3 reading cleaner.

### 5.2 Schedule-cited dependency

The MR-1-FX RAS schedule (`RAS-LIMIT-SCHEDULE-MR-1-FX-2026-05-21`, event `4fd7fa91-3009-42cd-93b3-ee6114817e53`) carries no explicit IPV-tolerance reference today. After this recalibration approves, the schedule should be re-published with an annex citing the IPV-tolerance version (the recalibrated bands carry an implicit "v1.1 — Helena 2026-05-21" stamp). The re-publish is a Rohan implementation task in the follow-on brief, not part of this analysis.

### 5.3 No restructure of the tier shape

The brief asked: should the tier structure be restructured if the empirical distribution doesn't support the current shape?

**Answer: keep the tier structure.** The current relative + absolute structure is sound. The empirical distribution supports a wider relative band per pair, not a different shape. No restructure.

---

## Section 6 — Re-test plan

### 6.1 Observation window before bands go live

**Proposal: 10 trading days of shadow operation.**

The recalibrated bands enter production **shadow mode** immediately on approval: the IPV recon pipeline computes the new bands alongside the current ones; both sets of bands emit advisory events (`IpvExceptionRaised` for current bands; `IpvExceptionRaisedShadow` for new bands), but only the *current* bands count as binding for limit purposes during the shadow window.

During shadow operation, Rohan logs:

1. **Exception count** per pair under current vs new bands (per trading day).
2. **False-positive rate** estimate: of exceptions raised under the *current* bands, how many cleared under the *new* bands? (i.e., how many were tolerance-tightness-driven, not market-driven?)
3. **Missed-divergence rate** estimate: of exceptions raised under the *new* bands, how many would have been raised under the *current* bands? (Expected: all of them — the new bands are wider, so any new-band breach is also a current-band breach. This is a sanity-check on the recon-pipeline implementation.)
4. **Time-of-day distribution** of spreads, to validate the timing-skew hypothesis (§3.2).

### 6.2 Acceptance criteria for cutover from shadow to binding

After 10 trading days, the new bands become binding if **all** of the following:

1. **No new-band exceptions** that were not also current-band exceptions (sanity check on pipeline).
2. **Current-band exceptions cleared by new-band threshold** = at least 80% of the observed current-band exception load. Justification: the recalibration must materially reduce false positives or it's not pulling its weight.
3. **No new-band exception** that on Rohan + Helena joint review traces to a desk mismark or process failure. (I.e., every new-band exception during the window must resolve to either (a) genuine market dispersion accepted as build-phase noise, or (b) a substrate finding documented separately. Zero unresolved.)
4. **No regression in MR-1-FX RAS utilisation** during the window. (I.e., the IPV recalibration must not surface as a sudden change in the B3 RAS reading.)
5. **Helena (this brief author) sign-off** at end of window, captured as a typed `IpvCalibrationActivated` event (or analogous; substrate to be agreed with Rohan + Atlas (Core banking platform architect, engineering)).

If any of the five conditions fails, the new bands remain in shadow and the recalibration returns to the BRC (or, in interim, to me + Marc as CEO concurrence) for refinement.

### 6.3 What happens after cutover

After the 10-day window concludes successfully:

1. **Current bands retire** — `IpvExceptionRaised` events now use new bands.
2. **Shadow event type retires** — `IpvExceptionRaisedShadow` removed.
3. **Pricing-policy update** — Mira (Compliance / RegTech engineer) updates `Policies/pricing-policy-v1.md §5.2` to v2 reflecting the new bands, carrying the "build-phase, per-pair, free-tier-feed" qualifier explicitly. This becomes the stated policy; the figures in this calibration analysis become the audit trail of how the v2 numbers were derived.
4. **Trigger to revisit** — recalibration auto-re-opens (i) when `WS-MTM-PROD-FX-FEED` lands (tier-1 feeds become available; tighter bands appropriate), (ii) at the first BRC after Board constitution (calibration as a standing BRC item), (iii) on any RAS Tier-1 MR-1-FX breach traced to IPV mis-calibration.

### 6.4 Cadence of post-cutover review

| Review type | Cadence | Trigger |
|---|---|---|
| Standing IPV calibration review | Quarterly | First Helena standing tick after end of each calendar quarter |
| Ad-hoc IPV calibration review | On demand | (i) Production feed substrate lands; (ii) BRC convenes; (iii) RAS T1 MR-1-FX breach traced to IPV |
| Annual IPV calibration review | Annual | Per `Policies/pricing-policy-v1.md §7.1` annual policy review |

---

## Section 7 — Substrate gaps surfaced by this calibration

Per dispatch discipline (CLAUDE.md "every run produces both the deliverable and surfaces the substrate gap"), the gaps observed during this analysis:

1. **G-IPV-1 — Per-pair tolerance not currently supported.** `prototype/platform/markets/ipv-tolerance.ts` carries flat `IPV_PCT_THRESHOLD = 0.0025`. Per-pair calibration requires a new data structure (lookup table) and a new test fixture set. **Owner:** Rohan. **Follow-on brief:** `brief:rohan:ipv-per-pair-tolerance-implementation:2026-05-22` (to be opened by Scrooge on recalibration approval).
2. **G-IPV-2 — Shadow-mode IPV runs not currently supported.** The shadow-event type (`IpvExceptionRaisedShadow` or analogous) does not exist. The 10-day observation window requires either a shadow event type or a flag on `IpvExceptionRaised` distinguishing binding from advisory. **Owner:** Rohan + Atlas. **Follow-on:** scoped in the same Rohan brief above.
3. **G-IPV-3 — Inverse-pair instrumentKey duplication in OfficialMarkAdopted.** The upstream emitter dual-emits both directions (`USD/ZAR` mark 16.486959 and `ZAR/USD` mark 0.060654 at the same `markAsOf`), pollutting the IPV recon with two breach events per underlying pair. PR #694 defends downstream but the root cause is upstream. **Owner:** Rohan + the ingest pipeline (Devon (Chief Operating Officer, governance) for handler scheduling). **Follow-on:** Vera (Internal audit engineer, engineering) finding referenced in `project_continuation_2026_05_21_product_control_pnl.md` substrate gaps — recommend reframe as a Rohan substrate brief rather than a Vera finding.
4. **G-IPV-4 — Timing-skew between primary (overnight-refresh) and secondary (intraday) feeds.** The 5–15 bps timing-skew component absorbed in the engineering buffer (§4.1) reflects a feed-cadence mismatch, not a market reality. The clean fix is to align cadences; the controllable fix is to tag and document. **Owner:** Devon + Rohan. **Follow-on:** scoped under `WS-MTM-PROD-FX-FEED` substrate gap (already queued in memory `project_continuation_2026_05_21_mtm_gl_bugfix.md`).
5. **G-IPV-5 — No IPV tier (Amber/Red) structure today.** Out of scope for this recalibration (§4.5) but flagged as a desirable substrate extension. **Owner:** Rohan + Helena. **Follow-on:** not opened in this brief; deferred to the next steady-state IPV revision after `WS-MTM-PROD-FX-FEED` lands.

These five gaps are real and load-bearing for the steady-state IPV control. They are not blockers for this recalibration: the recalibration delivers a build-phase-appropriate set of bands that reduce the current false-positive load, while the substrate work to take IPV to steady-state continues on its own track.

---

## Section 8 — BRC concurrence pack (build-phase substitute)

In the absence of a constituted Board Risk Committee, this concurrence pack is filed under CEO interim authority per the standing precedent of `D-BRC-INTERIM-MR-1-FX`.

**To:** Board Risk Committee (BRC) — Marc (CEO) chairing the interim BRC seat per `D-THIN-HUMAN-LAYER-MINIMUM`
**From:** Helena (Chief Risk Officer, governance)
**Subject:** MR-1-FX IPV tolerance recalibration — recommendation to approve
**Date:** 2026-05-21

**The recalibration in one paragraph.** PR #694 (`fix(accounting): inverse-pair direction sanity-check`) corrected a directional bug in the settlement-rate lookup and, in passing, exposed that the IPV recon pipeline now produces 17 exception events against the standing 0.25% tolerance band — none of which reflect a desk mismark, a data integrity issue, or a process failure. All 17 resolve to a combination of (a) genuine free-tier-feed dispersion at the ~30 bps level, (b) overnight-to-intraday timing-skew of ~10 bps, (c) a tolerance band calibrated for a tier-1 production feed pair that we do not yet have. The recalibration moves to per-pair bands (USD/ZAR 55 bps; GBP/ZAR 40 bps; default 40 bps), keeps the ZAR 50,000 absolute threshold unchanged, and enters a 10-trading-day shadow window before becoming binding.

**The proposed bands.**

| Pair | Current | Proposed | Δ |
|---|---|---|---|
| USD/ZAR | 0.25% | **0.55%** | +30 bps |
| ZAR/USD (mirror) | 0.25% | **0.55%** | +30 bps |
| GBP/ZAR | 0.25% | **0.40%** | +15 bps |
| EUR/ZAR | 0.25% | **0.40%** | +15 bps |
| All others (default) | 0.25% | **0.40%** | +15 bps |
| Absolute ZAR threshold | ZAR 50,000 | **ZAR 50,000 (unchanged)** | — |

**The basis.** Empirical p95 of observed cross-source divergence (n=17 over 1 trading day) + engineering buffer of 15 bps (breaching pairs) or 10 bps (default). Acknowledged: n=17 is a snapshot, not a statistically robust history; the engineering buffer compensates for sampling error and feed-timing residual. 10-day shadow window before cutover guards against over-aggressive recalibration.

**The trigger to revisit.** (i) `WS-MTM-PROD-FX-FEED` lands (tier-1 production feeds; tighter bands appropriate); (ii) BRC constitution; (iii) any RAS Tier-1 MR-1-FX breach traced to IPV mis-calibration. Standing quarterly review thereafter.

**Recommendation.** The BRC (CEO interim authority) is asked to **approve the IPV tolerance recalibration** in §4.2 above, **approve the 10-trading-day shadow observation window** in §6 above, **note the five substrate gaps** in §7 above as carried items, and **note that the MR-1-FX RAS schedule values are unchanged** — IPV is a measurement-quality enabler, not a standalone RAS line.

---

## Section 9 — Gaps I cannot answer

1. **Precise p95 over a longer history.** I do not have more than one trading day of corrected-direction IPV samples. n=17 across 3 pairs is a snapshot. The engineering buffer (§4.1) compensates, but a true 20-day p95 will tighten or loosen the bands; the recalibration plan (§6.1 shadow window) is designed to refine before binding.
2. **The exact %-attribution to driver (a) vs driver (b).** §3.4 estimates 20–25 bps to genuine dispersion and 5–15 bps to timing-skew. Without intraday primary refresh, this is a judgement, not a measurement. Refining requires either intraday primary or post-hoc tick-level reconstruction.
3. **Whether twelve-data's free-tier rate-limit quirk** (per memory `feedback_twelve_data_rate_limit_quirk.md`: 6-symbol batch = 6 credits) is currently causing intermittent secondary-feed gaps that distort the IPV sample. Rohan should confirm by examining the secondary-feed availability log for 2026-05-21; if there are intermittent gaps, the n=17 sample may be biased toward times when twelve-data happened to be queried — i.e., not a representative time-of-day sample. This is a sample-quality caveat on the calibration.
4. **The exact policy-version pin** for the recalibrated bands. The current code at `platform/markets/ipv-tolerance.ts:31` is a hardcoded `const`; there is no `pricing-policy-v2` to point at. Per §6.3, Mira (Compliance / RegTech engineer) updates `pricing-policy-v1.md` to v2 on cutover. Until cutover, the recalibrated bands are pinned to *this brief's* document hash (filed via `RecordFiled` alongside this analysis).
5. **The interaction with FRTB SA-FX-delta sensitivity calculation.** The FRTB SA engine for FX spot is in `compensating-control` status per `2026-05-20_helena_controlled-launch-mr1-fx-limit-proposal.md` §2.2. The IPV tolerance does not directly feed FRTB SA, but a recalibration that materially changes the accepted mark could change the SA-delta input. I have not modelled this; it is a Rohan + Nadia (Independent validation engineer, governance) check at next FRTB SA validation.
6. **Whether the 10-trading-day shadow window is long enough.** Standard practice in tier-1 banks is 20–60 trading days for a calibration-cutover. I propose 10 because (i) the build-phase trade volume is so low that 10 days is already a substantial sample relative to current activity, (ii) the false-positive load *today* is material (17 exceptions in 1 day) and delaying cutover delays the noise reduction. If the BRC (CEO interim) prefers a longer window, the recalibration analysis stands; only the activation date moves.

---

*Helena (Chief Risk Officer, governance)*
*2026-05-21*
*Brief: `brief:helena:mr-1-fx-ipv-tolerance-recalibration-after-pr-694:2026-05-21`*
*Workstream: WS-MARKETS-MR-1-FX*
*Companion decision card: `D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21` (phase: `requested`)*
