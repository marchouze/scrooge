---
title: B3/B4 market-risk measure — CRO calibration decisions (R1, R2, R4, R5, R8, R9)
author: Helena (Chief Risk Officer, governance)
date: 2026-06-03
workstream: WS-MARKET-RISK-PROCEDURES
register: decisions
authority: CRO (risk-appetite calibration — within the approved RAS)
decision-required: false
---

# B3/B4 market-risk measure — CRO calibration decisions

Disposes the governance items from the B3 FX market-risk review
(`record:documents:helena:b3-fx-market-risk-measure-review:2026-06-03`). These are
**calibrations within the already-approved RAS**, so they sit under standing CRO authority
(decision-authority routing: "Risk-appetite calibration → CRO") and do not require a fresh
CEO gate. None crosses a RAS or Board threshold. The implementing substrate is PR #1016.

## Decisions

**D-B3-1 (R1) — Cluster namespace.** The trading-engine clusters B1–B5 are formally distinct
from the RAS-document sections §B1–§B16. To end the collision (trading "B3" = FX market risk
vs RAS "§B3" = liquidity), human-facing renders (limit names, dashboards, briefs) carry the
**semantic measure name** as the primary label (e.g. "FX net open position") with the Bn code
secondary. A full enum rename to semantic codes (MR-FX, MR-IR, CR-CP…) is approved **in
principle** but staged as a separate mechanical substrate task (≈35 call sites) to avoid
bundling a wide rename with measure changes — issued to Rohan.

**D-B3-2 (R2) — Appetite basis is Net Open Position.** The B3 FX measure is NOP (Σ|net per
CCY|×rate, ZAR excluded), not gross notional. All labels, comments, and the
`vera:mr-1-fx-var-projection-gap` finding are reconciled to NOP (PR #1016). The R18.5m
MR-1-FX open-position proxy is **retained unchanged** as the live line.

**D-B3-3 (R4) — FX-NOP expressed as % of qualifying capital.** The FX-NOP appetite line is to
be expressed as a percentage of net qualifying capital, with the SARB/Basel regulatory outer
limit at **≤10% of qualifying capital**. The schema + projection now support this
(`limitBasis: "pct-capital"`, PR #1016). Helena will publish the capital-linked line in the
next MR schedule revision; until then the absolute R18.5m proxy stands.

**D-B3-4 (R5) — Aggregation method ratified.** The aggregate NOP uses the conservative
**gross-of-nets** method (Σ|net per CCY|), not the Basel "shorthand" (max of aggregate
long/short). Ratified as the bank's standing convention; documented in the engine.

**D-B3-5 (R8) — VaR/ES + stress adopted as the risk-calibrated rung.** Market-risk appetite is
a layered stack: NOP (position limit) → VaR/ES (risk-calibrated) → stressed VaR + scenario →
intraday peak. The VaR/SVaR/ES engine already exists (`platform/market-risk/var-engine.ts`);
the next slice wires a `MarketRiskMeasureComputed` event + projection as a **separate** line
(keeping NOP as the position limit) and sets it to the R350k VaR once live + validated. This
closes `vera:mr-1-fx-var-projection-gap`. Issued to Rohan.

**D-B3-6 (R9) — RAG bands per cluster.** Uniform 70/90 is retired as the standing default;
each cluster's amber/red bands are calibrated to its volatility (MR-1-FX already moved B3 to
80/100). Helena sets per-cluster bands in the next schedule revision.

## Out of scope / deferred

R10 (per-entity schedules) tracked under Principle 5 as the legal-entity tree extends.

## Provenance

Filed via RecordFiled (RMS Phase 3), registerKey `decisions`. Canonical artefact is the
event; this markdown is its render. Implementing PR: #1016.
