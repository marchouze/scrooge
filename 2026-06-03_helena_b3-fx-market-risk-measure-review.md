---
title: B3 FX market-risk measure — basis & best-practice review
author: Helena (Chief Risk Officer, governance)
contributors: Rohan (Risk engineer)
date: 2026-06-03
trigger: CEO request (Marc) — "research the basis for why the B3 measure was chosen and advise best practice"
workstream: WS-MARKET-RISK-PROCEDURES
decision-required: false
---

# B3 FX market-risk measure — basis & best-practice review

> ⚠️ **Form-number correction (Mira, Compliance / RegTech engineer, 2026-06-07; `D-BA-330-REATTRIBUTION-IRRBB`).** This record cites **BA 330** as the SARB market-risk / FX-net-open-position return. That attribution is **incorrect** and is superseded: per the Regulations relating to Banks form schedule, **BA 330 is the IRRBB repricing-gap return**; the FX-NOP / market-risk return is **BA 320 (Market risk)**, with the daily effective net open position attested on **BA 325 under regulation 29(3)**. The body below is retained unchanged as a historical record; read "BA 330" in the market-risk context as "BA 320 / BA 325 reg 29(3)". See `Regulations/SARB-PA/large-exposures.md` §7.

**For:** Marc (CEO) — awareness. **Owner:** Helena (Chief Risk Officer, governance).
**Engineer:** Rohan (Risk engineer). **Authority chain:** D-MARKETS-SCHEMA-FOUNDATION
(Slice 5) → D-BRC-INTERIM-MR-1-FX (2026-05-21).

## 0. Disambiguation — "B3" names two different things

Two unrelated B-cluster numbering schemes coexist and collide on every label:

| Code | **RAS document** (Helena's RAF) | **Trading engine** (markets schema) |
|---|---|---|
| B3 | **Liquidity buffers (LCR/NSFR)** | **Market risk — FX** |

This review concerns the **trading-engine B3 = FX market risk**, computed in
`platform/projections/markets/limit-utilisation.ts`. The collision itself is **Finding F1**.

## 1. The basis — how B3 was chosen

- **Origin:** D-MARKETS-SCHEMA-FOUNDATION Slice 5 (CEO-approved 2026-05-07) defined the
  B1–B5 pre-trade limit taxonomy. B3 was seeded as a flat **R200m** placeholder
  (`scripts/seed-ras-limits.ts`, schedule `…-SEED-2026-05-14`).
- **Live calibration:** superseded by **MR-1-FX** (D-BRC-INTERIM-MR-1-FX, CEO-approved
  2026-05-21; `scripts/seed-mr-1-fx-ras-schedule.ts`, schedule `…-MR-1-FX-2026-05-21`).
  Live B3 limit = **R18.5m** (USD 1m EOD open-position ceiling, Helena §1.4), Amber 0.80 /
  Red 1.00. Latest-effective-wins, so **R18.5m is the binding line today, not R200m.**
- **True appetite:** Helena's MR-1-FX appetite is a **1-day 99% VaR of ZAR 350,000**. There
  is no VaR engine yet, so the schedule uses the notional/open-position ceiling as a
  **deliberate proxy**, with the gap already logged as Vera finding
  `vera:mr-1-fx-var-projection-gap` (open; closure = build VaR projection, set limit to
  R350k). **This is good practice already in motion** — the VaR intent is documented, the
  proxy is labelled, and the gap is tracked.
- **The measure actually computed:** `computeB3Exposure()` (`limit-utilisation.ts:319`)
  computes **Net Open Position (NOP)**: `Σ |net position(CCY)| × rate(CCY/ZAR)`, ZAR
  excluded, position persists past settlement. NOP is the correct regulatory FX-risk
  primitive (SARB BA 330; Basel market-risk framework).

## 2. Findings beyond the known VaR gap

**F1 — Namespace collision (NEW).** RAS §B3 (Liquidity) vs trading B3 (FX market risk) — a
Principle-2 (single-graph) breach. Namespace the clusters (e.g. `MKT-B3` / `MR-FX`).

**F2 — Mis-citation (NEW, FIXED this turn).** `computeB3Exposure` cited **BA 600** for the
home-currency exclusion; BA 600 is the **operational-risk** return in this codebase. The FX
NOP rule is **BA 330** (market-risk return). Corrected in this PR (comment-only; no value
change).

**F3 — NOP-redesign drift (NEW, HIGH-VALUE).** The engine was redesigned to compute **NOP**
(net) — but the live MR-1-FX schedule label, its rationale comments, *and* the Vera finding
all still describe B3 as **"gross notional."** Consequences: (a) the proxy calibration
(R18.5m) and the "24,660% spurious red" example in the seed were reasoned on a gross-notional
accumulator that no longer exists — under NOP the magnitude is materially smaller, so the
proxy may now be **mis-calibrated**; (b) the Vera finding's own description is stale. Rohan
to reconcile (rename label "gross notional" → "net open position", re-check the R18.5m proxy
against the NOP magnitude, update the Vera finding text). This is **R2 from the brief.**

**F4 — Absolute limit, not capital-linked.** The regulatory FX-NOP ceiling is ~10% of net
qualifying capital, so it scales. A flat ZAR amount has no regulatory anchor. Express B3 as
**% of CET1** with the regulatory 10% as the outer hard limit. (Capital base already
projected — `capital-metrics.ts`.)

**F5 — Aggregation method undocumented.** Engine sums `Σ|net per CCY|` (conservative
gross-of-nets); Basel's "shorthand" is `max(|Σlong|,|Σshort|)` + net gold. Fine choice, but
make it an explicit, documented decision.

**F6 — No per-currency sub-limits.** An aggregate NOP hides offsetting single-CCY positions;
BA 330 reports per currency. Add per-CCY (and per-pair) sub-lines.

**F7 — Sibling B4 (IR) is notional, not sensitivity.** Best practice is PV01/DV01 or
repricing-gap (already computed for BCBS-319). Wire B4 to a sensitivity measure.

**F8 — Uniform RAG bands.** 70/90 across all clusters is a placeholder; calibrate per
cluster volatility (MR-1-FX already moved B3 to 80/100).

**F9 — Single-entity scope.** Schedule is `LE-ZA-HOZ-BANK` only; Principle 5 needs
per-entity schedules as the LE tree extends.

## 3. Target measurement stack (best practice)

Market-risk appetite is a layered stack, not one gate. B3 today is the bottom rung:

| Layer | Measure | B3 status |
|---|---|---|
| Hard regulatory cap | Aggregate NOP ≤ ~10% qualifying capital (BA 330) | **missing** (absolute R18.5m) |
| Day-to-day limit | NOP, aggregate + **per-CCY** sub-limits | aggregate only |
| Risk-calibrated | **VaR / Expected Shortfall**, or **FRTB-SA SBM delta** | **intended** (MR-1-FX → R350k VaR, pending engine) |
| Tail protection | Stressed VaR + scenario shocks (ZAR crisis replays) | missing |
| Operational | **Intraday peak** NOP; settlement/Herstatt (B1/B2) | end-state only |

Direction of travel: keep NOP as the foundation, add the per-CCY + capital-% rungs next,
then deliver the VaR/ES projection (already the documented MR-1-FX target) and FRTB-SA SBM
delta as the book scales.

## 4. Disposition

- **F2** — fixed this turn (BA 330 re-citation).
- **F1, F3** — routed to Rohan (Risk engineer) brief under Helena's governance.
- **F4, F5, F8, F9** — Helena calibration items, folded into WS-MARKET-RISK-PROCEDURES
  alongside the existing `vera:mr-1-fx-var-projection-gap` closure (VaR engine).
- **F6, F7** — substrate items for Rohan, sequenced after the VaR projection.

No calibration changes are made by this review; R18.5m stays live until Helena re-tables.

---
*Filed via RecordFiled (RMS Phase 3). Canonical artefact is the event; this markdown is its render.*
