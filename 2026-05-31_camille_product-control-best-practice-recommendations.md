---
title: "Product Control — Best-Practice Reference, Gap Analysis & Recommendations Roadmap"
author: "Camille (Chief Financial Officer, governance)"
research_provenance: "PAX (Role researcher)"
date: "2026-05-31"
workstream: "WS-PRODUCT-CONTROL"
classification: "governance-seat"
status: "filed"
citations:
  - "D-RMS-PHASE-3"
  - "VALUATION-POLICY-V1"
  - "PRICING-POLICY-V1"
  - "FIN-ACCT-01"
  - "FIN-BSS-01"
  - "D-TRUSTED-FIGURES-PROGRAM-V1"
  - "IFRS-13"
  - "IFRS-9-§5.7.1"
---

# Product Control — Best-Practice Reference, Gap Analysis & Recommendations

**Prepared by:** Camille (Chief Financial Officer, governance)
**Research:** PAX (Role researcher)
**Build owners proposed:** Bea (Accounting & financial reporting engineer, engineering); Rohan (Risk engineer, engineering)
**Governance:** Camille (CFO) + Helena (Chief Risk Officer, governance)
**Date:** 2026-05-31 · **Workstream:** WS-PRODUCT-CONTROL

---

## 1. Purpose

Marc (CEO) asked for best practice on **product control calculations** and concrete suggested changes. This brief sets the reference model, maps it against the current substrate, and proposes a sequenced, citation-anchored roadmap. The conclusion up front: **the bank's product-control governance (policies) is sound; the calculation substrate is thin.** The single largest gap is the absence of **P&L Attribution ("P&L Explain")** — the discipline that makes a daily P&L number defensible.

---

## 2. Best-practice reference model

World-class product control is organised around six operating pillars. Each is a *control*, not just a report: it produces a number **and** an independent assurance that the number is right.

| # | Pillar | What best practice requires |
|---|--------|------------------------------|
| 1 | **P&L production** | Daily clean and dirty P&L across *every* asset class; a same-day **flash/predicted** P&L from risk × market moves, reconciled T+1 to **actual** P&L from books-and-records. |
| 2 | **P&L attribution / Explain** | Decompose clean P&L into additive drivers: new-trade, market-moves *by risk factor* (delta/spot, carry/theta, rate, credit-spread, vega/vol, basis), fees/commissions, and an **unexplained residual**. Residual beyond tolerance is investigated, not absorbed. For IMA desks, the **FRTB P&L Attribution test** (hypothetical vs risk-theoretical P&L; Spearman correlation + Kolmogorov–Smirnov) governs internal-model eligibility. |
| 3 | **Independent Price Verification (IPV)** | Re-mark positions from sources *independent of the trader*, by IFRS-13 level **and by parameter** (curves, vols, credit spreads — not just headline price). Capture the variance; **feed IPV differences into valuation reserves** rather than running them straight through P&L. |
| 4 | **Valuation adjustments & prudent valuation** | The reserve stack — close-out/bid-offer, model uncertainty, market-price uncertainty, concentration, unearned-credit-spread — plus **CVA/DVA/FVA**, and **Day-1 P&L deferral** for Level-3 (IFRS 13). Regulatory **prudent valuation** (Additional Valuation Adjustments / AVAs, CRR Art 105 + EBA RTS; SARB/Basel equivalent) sits over the accounting reserves as a capital deduction. |
| 5 | **Balance-sheet substantiation & sign-off** | Every GL balance traceable to source events; suspense cleared; exceptions classified and aged. *(Already implemented as FIN-BSS-01 — reference, do not rebuild.)* |
| 6 | **Commentary, sign-off & attestation** | Trader **and** product-control daily sign-off; threshold-based explain commentary on large/residual moves; exceptions escalated as first-class, typed channels (not email). |

**Citation chain:** IFRS 13 (fair value, hierarchy, Day-1), IFRS 9 §5.7.1 (FVTPL recognition), Basel FRTB (PLA test for IMA), prudent valuation (CRR Art 105 / EBA RTS 2016/101, mapped to the SA Banks-Act regulatory-capital regime).

---

## 3. Current-state map (verified against the codebase)

| Pillar | Current substrate | State |
|--------|-------------------|-------|
| 1 — P&L production | `platform/product-control/daily-pnl.ts` — `computeDailyPnL` aggregates realised + unrealised by pair/counterparty/book. **FX-spot only.** No flash/predict cycle. | **Partial** |
| 2 — P&L attribution | **None.** Explicitly deferred (comment in `platform/accounting/posting-rule-registry.ts`: "product-control domain has not yet published its book-level P&L attribution"). | **Absent** |
| 3 — IPV | `platform/markets/ipv-tolerance.ts` — two-tier FX-spot tolerance; `IpvExceptionRaised` from the daily MTM. **FX-spot only; price-level only (no parameter-level); no reserve feed.** | **Partial** |
| 4 — Valuation adjustments | `platform/market-risk/cva-engine.ts` (CVA only). DVA/FVA/bid-offer referenced in policy but **no engine**. No prudent-valuation AVA layer. No Day-1 deferral engine. | **Minimal** |
| 5 — BS substantiation | `Policies/balance-sheet-substantiation-policy-v1.md` (FIN-BSS-01) + recon suite. | **Done** |
| 6 — Sign-off & commentary | **None** as typed events. | **Absent** |

**What is genuinely strong already:** the **no-silent-zero discipline** (`FinancialInput<T>` / `present` / `absent` / `requireWeight` in `platform/types/financial-input.ts`, enforced by `recon:calc-no-silent-zero`), the **model-registry binding** (`CALC_BINDINGS` in `platform/model-registry/calculation-binding.ts` with `CalculationPerformed` status ok/degraded/failed), and the **MTM mark-adoption chain** (`OfficialMarkAdopted` → `FxPositionRevalued`, provenance-gated to production data). Every recommendation below builds *on* these primitives rather than around them.

---

## 4. Recommendations roadmap (prioritised)

Each recommendation names its owning seat, regulatory citation, and the **substrate gap** that prevents a fully-autonomous run today (per the operating model — gaps are roadmap items, not omissions to hide).

### R1 — P&L Attribution / "P&L Explain" engine *(highest value; lead build)*
**Owner:** Bea · **Governance:** Camille + Helena · **Cites:** IFRS 9 §5.7.1, FRTB PLA, D-TRUSTED-FIGURES-PROGRAM-V1.

Decompose the day-over-day clean P&L move for the FX-spot desk into additive components that reconcile to the total: **new-trade**, **market-move** (Σ per-position `FxPositionRevalued` deltas — the delta×spot-move term), **carry/funding** (flagged-absent until an FTP curve exists), **realised** (settlement increment), and **unexplained residual**. A residual beyond tolerance raises a typed `PnLAttributionExceptionRaised`. The additive invariant — `actualMove = newTrade + marketMove + carry + realised + residual` — is enforced both at event construction (zod refine) and by a new `recon:pnl-attribution-reconciles` gate. Missing prior-day marks route through `FinancialInput`, never to a silent zero. Architected so the component interface holds risk-factor sub-decomposition (rate/spread/vega) for non-FX later.

**Substrate gap:** sensitivities (Greeks) are not first-class events for non-FX, so the MVP uses the full-reval (P&L-vector) method for FX-spot; a Taylor/Greeks split waits on curve/vol mark events. No FTP curve → carry is a declared-absent placeholder.

### R2 — Valuation-adjustment / prudent-valuation reserve framework
**Owner:** Rohan · **Governance:** Helena + Camille · **Cites:** IFRS 13, accounting-policies-ifrs-v1 §3.3, valuation-policy-v1 §7, prudent valuation (CRR Art 105 / SA-Basel equivalent).

Generalise the single CVA engine into a reserve framework: a `ValuationAdjustmentComputed` event family with a **close-out/bid-offer reserve** (most material for the current FX book), a **Day-1 P&L deferral** record for any Level-3 mark, CVA folded in as one adjustment type, and a **prudent-valuation AVA** aggregation umbrella (even if only one AVA is populated at MVP). Each adjustment routes through `FinancialInput`; the reserve total is consumable by daily P&L. **IPV differences feed the market-price-uncertainty AVA** — closing the R3↔R4 loop.

**Substrate gap:** model-uncertainty and concentration AVAs need model-inventory and position-concentration inputs not yet eventised; MVP scaffolds the umbrella and populates close-out + Day-1.

### R3 — All-asset-class P&L + IPV coverage
**Owner:** Bea + Rohan · **Cites:** pricing-policy-v1 §5, valuation-policy-v1 §3/§7.

Extend `computeDailyPnL` and IPV beyond FX-spot to the bank's actual product set — **JSE bonds, equities, OTC IRD**. Introduce a `SecurityMaster`-keyed position-source abstraction so the P&L engine is asset-class-agnostic, with per-asset mark sourcing per the valuation-policy §3 hierarchy. Extend the IPV tolerance schedule per IFRS-13 level and per parameter type (price, curve point, vol point, credit spread).

**Substrate gap:** bond/equity/IRD mark feeds (valuation-policy Gaps 4–5: JSE bond-price and rate-curve ingest agents) are not built; coverage lands behind those feeds.

### R4 — P&L sign-off & commentary *(sequenced after R1)*
**Owner:** Bea · **Cites:** FIN-BSS-01 sign-off pattern, conduct/TCF.

T+1 trader and product-control sign-off (`PnLSignedOff`), threshold-based explain commentary (`PnLCommentaryRecorded`) attached to residual/component breaches from R1, and a flash/predict-vs-actual reconciliation. Depends on R1's attribution output, so it follows R1's merge rather than running in the first wave.

---

## 5. Sequencing & dispatch

R1 lands first (it defines the product-control event types and the registry binding R2–R4 build on). R2 and R3 then dispatch in parallel, rebased on R1's merge; they share three infrastructure files (`event-types/index.ts`, `package.json`, `calculation-binding.ts`) and so carry the standard shared-file concurrency caveat (resolve manually + `recon:runtime-handler-sync`). R4 follows R1. Every dispatch follows the events-first discipline (`AgentBriefIssued` → run lifecycle events) and the full `bun run ci` + `citation-gate` gates.

---

## 6. Out of scope (this round)
- Full FRTB PLA statistical test (Spearman/KS) — a follow-on once sensitivities-as-events exist.
- Greeks-based market-move sub-decomposition for non-FX — interface is ready; population waits on curve/vol mark events.
- A real production market-data feed — unchanged; SARB fixing remains the operative FX source (valuation-policy Gap 1).
