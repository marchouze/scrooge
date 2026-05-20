---
title: FX-Spot-only Market Risk Scope Review
record-id: record:documents:helena:fx-spot-only-market-risk-scope-review:2026-05-20
author: Helena (Chief Risk Officer, governance)
date: 2026-05-20
brief: brief:helena:fx-spot-only-market-risk-scope-review:2026-05-20
workstream: WS-MARKET-RISK-PROCEDURES
classification: governance-deliverable
citations:
  - Policies/market-risk-policy-v1.md
  - Policies/valuation-policy-v1.md
  - Policies/trading-mandate-v1.md
  - Policies/liquidity-risk-management-policy-v1.md
  - Policies/stress-testing-policy-v1.md
  - Policies/model-risk-policy-v1.md
  - Policies/insider-trading-pa-dealing-policy-v1.md
  - Procedures/markets/dealer-mandate-issuance.md
  - Procedures/markets/dealer-mandate-breach-handling.md
  - Procedures/markets/pre-trade-conduct-gate.md
  - Procedures/markets/fx-forwards-trade-lifecycle.md
  - Procedures/markets/franchise-posture-refresh.md
  - Procedures/markets/corporate-issuer-inclusion-list.md
  - Procedures/by-policy/market-risk-limit-monitoring.md
  - Procedures/by-policy/market-risk-monitoring.md
  - Procedures/by-policy/backtesting-governance.md
  - Procedures/by-policy/stress-test-cycle.md
  - Procedures/by-policy/model-validation.md
  - Procedures/by-policy/collateral-valuation-daily.md
  - Procedures/by-policy/counterparty-onboarding-markets.md
  - Procedures/finance/fx-settlement-reconciliation.md
  - Procedures/finance/fx-period-close-runbook.md
status: FINAL
---

# FX-Spot-only Market Risk Scope Review

**Author:** Helena (Chief Risk Officer, governance)  
**Date:** 2026-05-20  
**Brief:** `brief:helena:fx-spot-only-market-risk-scope-review:2026-05-20`  
**Workstream:** WS-MARKET-RISK-PROCEDURES  
**Supervisory test:** This document must be defensible to a SARB supervisor asking "you said FX Spot, what risk apparatus actually bites?"

---

## 1. Confirmation / Correction of FX-Spot Working Assumptions

The brief sets out a working-assumption list ("what bites / what does not"). Helena's review of the corpus below either confirms or restates each line.

### 1.1 Confirmed assumptions

| Assumption | Helena's position |
|---|---|
| Settlement: T+2 deliverable cash FX (USD/ZAR via SWIFT correspondent) | **Confirmed.** `Policies/trading-mandate-v1.md §2.5` specifies FX spot settlement as T+2 via SWIFT correspondent (Standard Bank primary; FirstRand backup). The settlement is principal-basis; both legs must complete. |
| Sensitivity: linear delta in the FX rate only | **Confirmed.** FX spot is a single-delta instrument. The risk factor is the prevailing USD/ZAR rate at EOD and intraday. There are no optionality, convexity, or tenor-curve dimensions in an FX spot book. |
| No vega, no gamma | **Confirmed.** No vega or gamma axes exist for FX spot. These sensitivity classes exist in the corpus only for FX options; FX options are explicitly excluded from the FX Desk at v1 (`Policies/trading-mandate-v1.md §2.5 "Not permitted"`). |
| Settlement (Herstatt) risk over the T+2 window | **Confirmed and load-bearing.** `Policies/trading-mandate-v1.md §6` — the bank is an indirect CLS participant; Standard Bank holds the CLS account. Between instruction of the ZAR leg and confirmation of the USD leg (or vice versa), the bank carries principal risk on the full notional. Herstatt risk is the dominant settlement-window risk for an FX spot book. |
| Concentration by currency pair | **Confirmed.** At v1, the only permissible pair is USD/ZAR (`Policies/trading-mandate-v1.md §2.5`). Concentration is by definition 100% USD/ZAR; the risk is the bilateral concentration on Standard Bank as the settlement rail. |
| Dealer-mandate breach risk | **Confirmed.** Every FX spot trade must be within the dealer's product scope, single-trade notional limit, and portfolio notional limit per `Procedures/markets/dealer-mandate-issuance.md`. Breach risk is real and continuously monitored per `Procedures/markets/dealer-mandate-breach-handling.md`. |
| IPV vs external reference rate | **Confirmed.** End-of-day FX spot positions must be valued against a production-grade reference rate per `Policies/valuation-policy-v1.md §3.1`. The IPV compares the bank's book rate against the SARB daily fixing (or next-priority source). A material deviation is a risk event. |

### 1.2 Corrections and additions

| Brief assumption | Helena's correction / addition |
|---|---|
| "no interest-rate sensitivity beyond the T+2 forward-point sliver (treated as immaterial at scope)" | **Qualified.** The T+2 forward-point differential on a cash FX spot trade is typically immaterial (measured in pips), and it is not a separate FRTB risk factor requiring a distinct limit line. However, Rohan (Market risk quantitative engineer, engineering) must confirm during limit calibration that the forward-point sliver on the 2-day horizon does not materially exceed the market data staleness threshold in `Policies/valuation-policy-v1.md §5` for the daily fixing. No correction to the substance — confirmed immaterial in normal markets; flag if repo or swap-point market is dislocated. |
| "No longer-dated counterparty PFE / SA-CCR mark-to-market beyond T+2" | **Confirmed with important nuance.** FX spot does attract SA-CCR exposure in the period between trade execution and settlement (T+0 to T+2). BCBS SA-CCR — as implemented in `Procedures/by-policy/market-risk-limit-monitoring.md §1 MR-3-CSR-cva` — uses a maturity factor that may apply a sub-1-year floor even for short-dated instruments. The exposure is small (2-day window) but is **not zero**. Rohan has implemented SA-CCR v1 for FX products; the FX spot SA-CCR calculation should flow through the engine. No procedure rewrite is required; this is a calibration footnote for Rohan's SA-CCR engine. |
| "XVA materially [does not bite]" | **Confirmed for CVA; nuanced for FVA.** CVA on a 2-day FX spot trade is negligible — the counterparty credit risk window is too short for meaningful credit-spread sensitivity. CVA-SA capital (`Policies/market-risk-policy-v1.md §5`) will produce a de-minimis charge for FX spot. FVA (funding valuation adjustment) is similarly immaterial at 2 days. The CVA limit infrastructure (MR-4, MR-4-HEDGE) remains in the stack but will show near-zero utilisation for a spot-only book. |
| "IRRBB on the trading book" | **Confirmed not applicable.** IRRBB applies to the banking book. FX spot positions are trading-book instruments per `Policies/trading-mandate-v1.md §4.3` (presumptive trading book). IRRBB framework is out of scope. |
| **Addition — ExCon (Authorised Dealer) limits** | The brief does not mention ExCon concentration risk. The bank operates as an Authorised Dealer for USD/ZAR (`Policies/trading-mandate-v1.md §2.5`). The SARB Exchange Control Manual limits apply to net open positions and flows. These limits are a binding constraint on the FX desk and must be monitored by Zara (Chief Compliance Officer, governance) alongside the market-risk limits. This is not in the brief's "what bites" list but **bites directly** on the FX desk. |
| **Addition — Settlement rail concentration (B-cluster)** | The B-cluster RAS lines (L-B8a-1 to L-B8a-5 at `Policies/trading-mandate-v1.md §6.3`) govern settlement exposure concentration at Standard Bank. These are live RAS lines that activate immediately on first FX spot trade. They are market risk-adjacent (settlement risk) and must appear in the minimum-viable envelope. |

---

## 2. Element-by-Element Scope Table

Scope key:
- **NEEDED** — this element must be live before the first FX spot trade.
- **PARTIAL** — the element applies; but a defined sub-set of its clauses is dormant until other products are added.
- **NOT-NEEDED** — this element does not bite for an FX-spot-only book; the clause stays resident but is inert.

### 2.1 Policies/market-risk-policy-v1.md

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `Policies/market-risk-policy-v1.md §1` — Overarching | FRTB framework as governing standard | NEEDED | FX spot is a trading-book instrument; FRTB SA applies from first trade. | — |
| `§1` | SA is the default; IMA is aspirational | NEEDED | SA capital governs from day one; no PA IMA approval is in place. IMA pathway exists as written. | IMA aspirational path activates once PA desk-level approval is sought. |
| `§1` | No proprietary trading principle (MR-5) | NEEDED | The no-prop attribution sweep (Step 8 of `Procedures/by-policy/market-risk-limit-monitoring.md`) must run daily from first trade. | — |
| `§1` | Trading book / banking book boundary principle | NEEDED | FX spot is presumptive trading book per BCBS FRTB. | — |
| `§1` | Events-first market risk accounting | NEEDED | `MarketRiskMeasureComputed`, `MarketRiskLimitBreached` etc. must be emitted daily. | — |
| `§1` | CVA integrated into market risk framework | PARTIAL | CVA-SA capital applies to all trading-book OTC positions with counterparty credit risk, including FX spot during the T+2 settlement window. The charge will be near-zero for spot but the framework is live. | Full CVA materiality activates on first OTC IRD trade (longer-dated counterparty exposure). |
| `§1` — Breach taxonomy (Alert / Hard / Critical) | Alert (Amber) and Hard Breach (Red) severity tiers | NEEDED | FX delta and VaR limits can be breached by FX spot positions; breach taxonomy applies immediately. | — |
| `§1` — Critical tier | Back-testing Red zone (IMA-specific) | NOT-NEEDED | FX desk is on SA from commencement; IMA back-testing Red zone is only relevant if PA IMA approval is obtained for the FX desk. | Activates on first PA IMA desk approval for FX desk. |
| `§2` — Trading Book / Banking Book Boundary | Presumptive trading-book assignment | NEEDED | FX spot instruments are presumptive trading book per BCBS FRTB d457 §3.2; `Policies/trading-mandate-v1.md §4.3` confirms. | — |
| `§2` | Reclassification requires prior PA consent | NEEDED (framework) | If any FX spot position is ever considered for banking-book reclassification, PA consent is required. Unlikely for spot but the framework stands. | — |
| `§2` | New product boundary determination | PARTIAL | No new products being added now. The boundary assessment process activates whenever the FX desk adds a new instrument type. | Activates on first NPA gate completion for any new FX product. |
| `§3` — Market Risk Appetite | MR-1 (1-day 99% VaR — FX desk) | NEEDED | MR-1-FX desk sub-limit directly bites on FX spot positions. The bank-wide MR-1 aggregate includes FX. | — |
| `§3` | MR-2 (10-day 97.5% ES) | NEEDED | ES is the primary FRTB capital measure; applies to all trading-book instruments including FX spot. For a spot-only book the ES will be dominated by FX delta exposure. | — |
| `§3` | MR-3 — FX risk class sensitivity limit (MR-3-FX) | NEEDED | FRTB SA FX delta sensitivity is the primary risk measure for FX spot. MR-3-FX is the direct operational limit. | — |
| `§3` | MR-3 — GIRR risk class (MR-3-GIRR) | NOT-NEEDED | FX spot carries no meaningful GIRR exposure. The 2-day forward-point sliver does not constitute a material GIRR position. | Activates on first OTC IRD trade or FX forward/swap. |
| `§3` | MR-3 — CSR non-securitisation corporate (MR-3-CSR-corp) | NOT-NEEDED | FX spot has no credit-spread sensitivity. | Activates on first JSE corporate bond position. |
| `§3` | MR-3 — CSR non-securitisation CVA (MR-3-CSR-cva) | PARTIAL | Technically applies for FX spot's SA-CCR exposure window (T+2). Practically near-zero utilisation. The limit exists and runs but will show negligible utilisation. | Full activation on first OTC IRD trade with material counterparty credit spread sensitivity. |
| `§3` | MR-3 — Equity risk class | NOT-NEEDED | FX spot has no equity sensitivity. | Activates on first JSE equity or equity ETF position. |
| `§3` | MR-3 — Commodity risk class | NOT-NEEDED | FX spot on USD/ZAR has no commodity sensitivity. | Activates on first commodity-linked FX or commodity derivative. |
| `§3` | MR-4 — CVA sensitivity limit | PARTIAL | Near-zero utilisation for spot. The limit line runs from first trade. | Full activation on first OTC IRD trade. |
| `§3` | MR-4-HEDGE — CVA hedge programme limit | NOT-NEEDED | No CVA hedges are needed or sensible for FX spot (settlement window too short). | Activates on first OTC IRD trade requiring CVA hedging. |
| `§3` | MR-5 — No-prop rule enforcement | NEEDED | Every FX spot position must carry a valid client-flow or franchise-hedge attribution. MR-5 daily sweep is mandatory from day one. | — |
| `§3` | MR-6 — Stress scenario loss ceiling (procedure-side) | NEEDED | Stress testing applies to the trading book including FX spot. The MR-6 stress ceiling will be dominated by FX rate shock scenarios. | — |
| `§4` — FRTB Capital Framework | §4.1 SA computation (SBM + DRC + RRAO) | PARTIAL | SBM: FX delta component bites directly. DRC: No default risk charge for FX spot (no issuer-default dimension). RRAO: No residual risk add-on for vanilla spot FX. Only SBM/FX-delta component is material. | DRC activates on first equity or credit-spread instrument. RRAO activates on first instrument with exotic residual risk. |
| `§4.2` | IMA eligibility and desk approval pathway | NOT-NEEDED (now) | SA governs from day one. IMA pathway exists as written but is aspirational. | Activates when PA desk-level approval is sought for FX desk. |
| `§4.3` | Back-testing (HPL/RTPL; 250-day history; zone thresholds) | NOT-NEEDED (now) | Back-testing is only meaningful for IMA-approved desks. Under SA, no back-testing obligation exists for capital purposes (back-testing is required for IMA eligibility only). | Activates on first PA IMA desk approval. |
| `§4.4` | PLA test | NOT-NEEDED (now) | PLA test is a pre-condition for IMA only. Not required under SA. | Activates on first PA IMA desk approval. |
| `§4.5` | NMRF / SES treatment | NOT-NEEDED (now) | NMRFs arise within IMA models. SA-only desk has no NMRF/SES obligation. | Activates on first PA IMA desk approval. |
| `§5` — CVA Capital | CVA-SA capital computation | PARTIAL | Technically runs for FX spot (T+2 window exposure), but produces a de-minimis charge. The governance machinery (§5 principles, CVA-SA monthly computation, MR-4 monitoring) runs from first trade. | Full CVA materiality on first OTC IRD trade. |
| `§5` | CVA hedges | NOT-NEEDED | CVA hedging is economically unsound at FX spot settlement window durations. | Activates on first OTC IRD trade where CVA hedge economics are viable. |
| `§6` — Market Risk Governance | §6.1 Market Risk Committee (MRC) | NEEDED | MRC must be constituted and operative before first trade. Monthly cadence; breach items from FX desk. | — |
| `§6.2` | Daily reporting (daily VaR/ES/sensitivity) | NEEDED | Daily market risk report is a first-trade obligation. | — |
| `§6.2` | Monthly capital report (FRTB SA breakdown) | NEEDED | BA-325 is filed monthly from commencement of trading. | — |
| `§6.2` | Quarterly BRC presentation (back-testing zone history, PLA results, NMRF trend, IMA progress) | PARTIAL | Back-testing zone history, PLA results, and IMA progress are not applicable for SA-only FX desk. Quarterly BRC presentation of FX desk VaR/ES/sensitivity utilisation trends is NEEDED; the IMA-specific agenda items are dormant. | IMA-specific BRC agenda items activate on IMA pursuit. |
| `§6.2` | PA regulatory returns (BA-325, BA-326) | PARTIAL | BA-325 (FRTB SA capital) is NEEDED. BA-326 (FRTB IMA capital) is NOT-NEEDED until IMA approval. | BA-326 activates on first PA IMA desk approval. |
| `§6.3` | Independent validation of FRTB SA engine | NEEDED | Nadia (Independent-validation engineer, peer-in-second-line under Helena) must validate the SA engine before first trade per `Policies/model-risk-policy-v1.md §3.3`. | — |

### 2.2 Policies/valuation-policy-v1.md

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `Policies/valuation-policy-v1.md §1` | Purpose and scope (OTC FX spot) | NEEDED | FX spot is explicitly in scope at v1 (`§1.2 "OTC FX instruments: spot"`). | — |
| `§1.2` | In scope: FX spot | NEEDED | Direct. | — |
| `§1.2` | In scope: FX forward, FX swap, NDF | NOT-NEEDED | These instruments are in the policy's scope definition but are not on the FX desk at v1 per `Policies/trading-mandate-v1.md §2.5`. The policy language stays; valuation apparatus for forwards/swaps/NDFs is dormant. | Activates on first FX forward, swap, or NDF trade. |
| `§1.3` | Out of scope: OTC IRD instruments | NOT-NEEDED | Correct; not on FX desk at v1 (separate OTC IRD desk — also not active in FX-spot-only scenario). | — |
| `§3.1` | FX Spot and Forward Rates — source hierarchy | NEEDED | The SARB daily fixing fallback is the operative production source during build phase. The full source hierarchy (Bloomberg BFIX etc.) is pre-go-live milestone. | Production FX feed activates at licence-day pre-go-live milestone. |
| `§3.2` | Interest Rate Curves (ZAR JIBAR, ZAR Swap Curve) | NOT-NEEDED | FX spot does not require interest-rate curve inputs (the forward-point sliver at T+2 is covered by the FX spot rate hierarchy). | Activates on first FX forward, swap, or OTC IRD trade. |
| `§3.3` | JSE Bond Clean Prices | NOT-NEEDED | FX spot requires no bond pricing. | Activates on first JSE bond position. |
| `§3.4` | SENS announcements (corporate action adjustments) | NOT-NEEDED | FX spot is not adjusted for corporate actions. | Activates on first JSE equity or listed bond position. |
| `§4` | Data Provenance Rule (production-only gate) | NEEDED | **Non-waivable.** All production FX spot valuations must use `provenance = "production"` market data. The SARB daily fixing must be tagged as production; the EnvSim FX_SIM source is prohibited. | — |
| `§5` | Staleness thresholds — FX spot | NEEDED | 15-minute intraday threshold; 1-business-day EOD threshold. These are the operative controls for FX spot valuation data. | — |
| `§5` | Staleness thresholds — other instrument classes | NOT-NEEDED | Forward points, swap curve, bond prices — dormant for FX spot only. | Activates on first trade in the respective instrument class. |
| `§6` | MTM run frequency — trading book (OTC FX) | NEEDED | EOD MTM run is mandatory every business day. Intraday on-demand MTM is needed for margin-call calculation (if applicable). | — |
| `§7` | IPV process — Level 1 / Level 2 instruments | NEEDED | FX spot is a Level 2 instrument (observable market data, not Level 1 exchange quote). Daily IPV applies. Secondary source must be SARB fixing or Bloomberg BFIX (once live). | — |
| `§7.3` | Level 3 instrument IPV (weekly; enhanced process) | NOT-NEEDED | FX spot USD/ZAR is not a Level 3 instrument. | Activates on first Level 3 instrument (e.g. illiquid exotic). |

### 2.3 Policies/trading-mandate-v1.md

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `Policies/trading-mandate-v1.md §1` — Overarching | Positive enumeration principle (only listed instruments permissible) | NEEDED | FX spot USD/ZAR is explicitly listed (`§2.5`). The positive-enumeration rule constrains the FX desk to spot only at v1. | — |
| `§2.2` | JSE Equity Desk | NOT-NEEDED | Out of perimeter for FX-spot-only. | Activates on first JSE equity trade. |
| `§2.3` | JSE Bond / Fixed Income Desk | NOT-NEEDED | Out of perimeter for FX-spot-only. | Activates on first JSE bond trade. |
| `§2.4` | OTC IRD Desk | NOT-NEEDED | Out of perimeter for FX-spot-only. | Activates on first OTC IRD trade. |
| `§2.5` | FX Desk — FX spot USD/ZAR | NEEDED | The permissible instrument and pair. | — |
| `§2.5` | FX Desk — FX forward, FX swap (also listed) | NOT-NEEDED (v1) | Forwards and swaps are in the v1 permissible list (`§2.5`) but the brief's scope restriction is to FX spot only. These instruments are in the mandate but are considered dormant from the brief's scoping perspective. The mandate language is broader than the brief's starting perimeter; this is flagged in section 5. | Activates when management decision is made to trade FX forwards/swaps. |
| `§3` | Client-driven mandate (institutional-only counterparties) | NEEDED | All FX spot trades must be client-initiated from eligible counterparties. | — |
| `§3.3` | Prohibition on proprietary risk-taking | NEEDED | Every FX spot position must have a client-flow or franchise-hedge origin. | — |
| `§4.1` | FX Desk — Saskia (Head of Global Markets) as accountable | NEEDED | Governance structure applies from first trade. | — |
| `§4.3` | FRTB trading-book assignment for FX instruments | NEEDED | FX spot is presumptive trading book. | — |
| `§5.1` | RAS B5 — per-desk VaR limit calibration (FX desk row) | NEEDED | MR-1-FX desk limit must be calibrated and BRC-approved before first trade (currently `[TBC — Helena to calibrate]`). | — |
| `§5.2` | Intraday limit framework — FX intraday net open position | NEEDED | ExCon Manual limits apply intraday. Helena's market-risk limit for FX intraday delta also applies. | — |
| `§5.3` | End-of-day position limits — FX desk net open position | NEEDED | Overnight FX net open position limit must be set before first trade (currently `[TBC — Helena to calibrate within ExCon Manual limits]`). | — |
| `§6` — FX Settlement Risk Framework | Settlement mechanism — indirect CLS via correspondent | NEEDED | Herstatt-risk management framework is a first-trade obligation. | — |
| `§6.3` | Herstatt risk mitigation controls (PvP netting, intraday-exposure cap, B-cluster lines) | NEEDED | All five B-cluster RAS lines (L-B8a-1 to L-B8a-5) are live from first trade. | — |
| `§6.4` | FX settlement risk reporting (daily, monthly, incident) | NEEDED | Tomas (Operations & payments engineer) must produce daily FX settlement exposure report from day one. | — |
| `§7` | New Product Gate | NEEDED (framework) | Any product beyond the positive enumeration list requires NPA gate completion. | Per each new product. |

### 2.4 Policies/liquidity-risk-management-policy-v1.md

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `Policies/liquidity-risk-management-policy-v1.md §2` | LCR governance | NEEDED | T+2 FX settlement creates 2-day settlement exposure that is a net-cash-outflow component in the LCR calculation. The LCR framework is a first-trade obligation. | — |
| `§3` | NSFR governance | NEEDED (at framework level) | FX spot positions create short-term RSF (required stable funding) obligations in the NSFR. The NSFR framework must be live from first trade. | — |
| `§4` | Intraday liquidity management | NEEDED | FX settlement (T+2 instruction cycle and same-day payment flows) creates intraday liquidity requirements. BCBS 248 tools 1–7 must be monitored from first FX trade. | — |
| `§4.3` | Intraday liquidity buffer | NEEDED | The buffer must be sized to cover the bank's peak intraday FX settlement flows. | — |
| `§5` — CFP | Tier 1 (intraday stress) — same-day liquidity measures | NEEDED | FX settlement failure or intraday stress event requires Tier 1 CFP response. | — |
| `§5` | Tier 2 and Tier 3 CFP measures | PARTIAL | The full CFP is needed in framework. Tier 2/3 are unlikely to be triggered by FX spot alone (the notional flows are small at v1), but the framework must be in place and rehearsed. | Full activation on material LCR/NSFR stress. |
| `§7` | Stress-testing integration (LCR/NSFR under FX stress) | NEEDED | Stress scenarios must include FX rate shock (e.g. ZAR devaluation scenario) affecting the LCR outflow calculation and the NSFR. | — |
| `§2.4` | Significant-currency LCR (USD) | PARTIAL | USD leg of FX spot settlement may trigger a significant-currency monitoring obligation if USD liabilities exceed 5% of total liabilities. Eitan (Treasurer, governance) must assess this threshold quarterly from first FX trade. | Activates if USD liabilities exceed 5% threshold. |

### 2.5 Policies/stress-testing-policy-v1.md

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `Policies/stress-testing-policy-v1.md §1` | Scope — market risk included | NEEDED | FX spot positions are within the market risk stress scope. | — |
| `§3.1` | Tier 1 — Regulatory stress tests (PA ICAAP/ILAAP) | NEEDED | ICAAP must include FX rate shock scenarios from first trade. | — |
| `§3.1` | Tier 2 — Internal management stress tests | NEEDED | Semi-annual; must include FX-specific shock scenarios (ZAR depreciation, USD liquidity stress). | — |
| `§3.1` | Tier 3 — Reverse stress tests | NEEDED (framework) | Annual; must model what FX rate shock or Herstatt event would trigger non-viability. | — |
| `§3.2` | Scenario taxonomy — macroeconomic (ZAR depreciation, repo rate path) | NEEDED | Directly relevant to FX spot P&L. | — |
| `§3.2` | Scenario taxonomy — market: rate shock | NOT-NEEDED (for FX only) | Interest-rate shock scenarios bite on the GIRR desk (OTC IRD). For FX spot only, GIRR scenarios produce negligible impact. | Activates on first OTC IRD trade. |
| `§3.2` | Scenario taxonomy — market: credit spread widening | NOT-NEEDED (for FX only) | No credit-spread risk in FX spot book. | Activates on first JSE bond or OTC IRD trade. |
| `§3.2` | Scenario taxonomy — market: equity crash | NOT-NEEDED (for FX only) | No equity in FX spot book. | Activates on first JSE equity trade. |
| `§3.2` | Scenario taxonomy — idiosyncratic (key counterparty default) | NEEDED | Standard Bank (settlement correspondent) default or failure is the key idiosyncratic stress event for an FX spot book. | — |
| `§3.3` | ICAAP stress integration (stressed CET1 floor 7.0%) | NEEDED | FX P&L under stress feeds ICAAP capital adequacy conclusion. | — |
| `§3.4` | ILAAP liquidity stress integration | NEEDED | FX settlement outflows under stress feed ILAAP LCR calculation. | — |

### 2.6 Policies/model-risk-policy-v1.md

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `Policies/model-risk-policy-v1.md §1` | Model definition — includes pricing and valuation models | NEEDED | The FRTB SA engine is a Tier 1 model per `§2.1`. It must be independently validated by Nadia before first trade. | — |
| `§2` | Model tiering | NEEDED | The FRTB SA engine (Tier 1 — regulatory capital) and the IPV model for FX spot (Tier 2 — pricing/valuation) must be in the model inventory and validated. | — |
| `§3` | Model lifecycle (development through deployment) | NEEDED | The FRTB SA engine must complete the full lifecycle before production use. | — |
| `§4` | Model inventory register | NEEDED | At minimum, two models must appear: the FRTB SA engine and the FX spot IPV/valuation model. | — |
| `§5` — IFRS 9 ECL Governance | ECL model suite | NOT-NEEDED | FX spot is an FVTPL instrument, not an amortised-cost or FVOCI instrument. No ECL staging or impairment model is required for FX spot positions. | Activates on first lending or FVOCI instrument. |
| `§6` | Model Risk Appetite Score (MRAS) | NEEDED | The MRAS must incorporate the FRTB SA engine as a Tier 1 model. | — |

### 2.7 Policies/insider-trading-pa-dealing-policy-v1.md

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `Policies/insider-trading-pa-dealing-policy-v1.md §1` | Market abuse prohibitions (FMA Ch. X) | NEEDED | FX spot dealing is subject to FMA s.78–88 insider trading and manipulation prohibitions. These apply regardless of product. | — |
| `§2` | Inside information identification and control | NEEDED | FX spot dealers may be aware of pending large client FX orders (material non-public information). The information barrier framework applies. | — |
| `§2.4` | Blackout periods | NEEDED | Blackout periods apply to FX spot dealings by covered persons who hold MNPI regarding currency-sensitive announcements (e.g. SARB rate decisions before public announcement). | — |
| `§3` | Personal account dealing controls | NEEDED | All covered persons dealing in FX instruments (including spot) on personal account must comply with pre-clearance requirements. | — |
| `§4` | Market surveillance | NEEDED | Front-running of client FX orders is a FMA s.80 manipulation offence. The surveillance system must cover FX spot trading patterns (unusual volume/price anomaly, front-running) from first trade. | — |

### 2.8 Procedures/markets/dealer-mandate-issuance.md (PROC-MK-MDI-01)

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `PROC-MK-MDI-01` | Mandate issuance with FX spot in product scope | NEEDED | Every dealer executing FX spot trades must have an acknowledged mandate explicitly covering FX spot, with defined single-trade notional and portfolio notional limits. | — |
| `PROC-MK-MDI-01 §5 Step 3` | Rohan limit-calibration (VaR, DV01 per tenor bucket for IRS/FX) | PARTIAL | For FX spot: VaR contribution and single-trade notional calibration apply. DV01 per tenor bucket is applicable only for OTC IRD desks. | DV01 calibration activates on first OTC IRD dealer mandate. |
| `PROC-MK-MDI-01 §10` | Annual blanket review | NEEDED | Annual review of FX desk dealer mandates must be scheduled. | — |

### 2.9 Procedures/markets/dealer-mandate-breach-handling.md (PROC-MK-MBH-01)

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `PROC-MK-MBH-01` | Full breach detection, triage, and resolution process | NEEDED | FX spot positions can breach single-trade notional, portfolio notional, and end-of-day position limits. Intraday monitoring must be live. | — |
| `PROC-MK-MBH-01 §5 Step 2` | Saskia Level-1 triage within 30 minutes | NEEDED | — | — |
| `PROC-MK-MBH-01 §5 Step 4` | Helena Level-2 review for material breaches (> 10% of limit, or product-scope breach) | NEEDED | — | — |
| `PROC-MK-MBH-01 §5 Step 10` | Regulatory notification for wilful breaches > R10m or 10% of notional limit | NEEDED (framework ready) | Wilful breach on FX spot desk requires regulatory notification. The threshold applies from first trade. | — |

### 2.10 Procedures/markets/pre-trade-conduct-gate.md (PROC-MK-PCG-01)

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `PROC-MK-PCG-01` | Full 5-check blocking gate | NEEDED | Every FX spot trade must pass all five checks before execution. This procedure was authored specifically for FX spot (`product: 'FxSpot'` in trigger). | — |
| `Check 1` — Counterparty mandate (including live credit-limit engine) | NEEDED | `@platform/risk/credit-limit-engine` is live per D-CREDIT-LIMIT-ENGINE-BUILD Phase 4. Counterparty must be approved and within credit headroom. | — |
| `Check 2` — Dealer mandate | NEEDED | FX spot must be within dealer's product scope and notional limits. | — |
| `Check 3` — Real-time sanctions screening | NEEDED | FICA ongoing monitoring obligation applies at point of execution. | — |
| `Check 4` — Counterparty capacity confirmation | NEEDED | Counterparty's FX spot mandate must be on record. | — |
| `Check 5` — Best-execution record pre-check | NEEDED | FAIS GCC §4 best-execution obligation applies from first institutional FX spot trade. | — |

### 2.11 Procedures/markets/fx-forwards-trade-lifecycle.md (PROC-MK-FXFL-01) — OUT OF PERIMETER

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `PROC-MK-FXFL-01` — entire procedure | FX forwards lifecycle | NOT-NEEDED | This procedure is the named comparator for explicit exclusion. FX forwards are listed in `Policies/trading-mandate-v1.md §2.5` but are outside the FX-spot-only brief perimeter. FX forwards introduce: (i) tenor risk beyond T+2 (forward points become a separate risk factor); (ii) IFRS 9 classification questions (hedging designation, FVTPL vs FVOCI); (iii) EXCON forward-booking obligations under the SARB ExCon Manual; (iv) a longer settlement-risk window (not just 2 days). None of these risk dimensions apply to FX spot. The procedure stays in the codebase as written; it simply does not exercise until the first FX forward trade is executed. | Activates on first FX forward trade (requires management decision; no NPA gate needed as forwards are already in the mandate). |

### 2.12 Procedures/markets/franchise-posture-refresh.md (PROC-MK-FPR-01)

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `PROC-MK-FPR-01` | Quarterly markets franchise posture refresh | NEEDED | The quarterly review applies to the FX desk's operational status, pipeline health, capital allocation, and substrate completeness from first trade. Helena's risk overlay section is a mandatory input. | — |
| `PROC-MK-FPR-01 §5 Step 6` | Scope change path (new product → Decision event) | NEEDED (framework) | If management decides to add FX forwards, swaps, or additional currency pairs, this step governs the Decision event. The framework must be live. | Per each scope change. |

### 2.13 Procedures/markets/corporate-issuer-inclusion-list.md (PROC-MK-CIL-01)

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `PROC-MK-CIL-01` — entire procedure | Corporate issuer inclusion/exclusion list | NOT-NEEDED | The brief correctly identifies this procedure as not applicable for FX spot. FX spot counterparties are institutional (banks, asset managers, pension funds — per `Policies/trading-mandate-v1.md §3.1`). The inclusion/exclusion list procedure targets corporate issuers for bond and FX transactions; it applies when corporate bond issuers or listed corporate names are added as FX counterparties. For the FX-spot-only phase, counterparty onboarding is governed by `Procedures/by-policy/counterparty-onboarding-markets.md` (PROC-MK-CO-01). The `PROC-MK-CIL-01` issuer-inclusion process (with JSE bond orientation) is not applicable. | Activates when the first JSE-listed corporate bond counterparty or corporate FX counterparty is added. |

### 2.14 Procedures/by-policy/market-risk-limit-monitoring.md (PROC-RISK-MRL-01)

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `PROC-RISK-MRL-01 §1` | Limit register structure (MR-1 through MR-6) | PARTIAL | MR-1 (VaR: bank-wide + MR-1-FX desk), MR-2 (ES), MR-3-FX (FX delta sensitivity), MR-5 (no-prop attribution), MR-6 (stress loss ceiling), and MR-4 (de-minimis) are NEEDED. MR-1-GIRR, MR-1-EQ, MR-3-GIRR, MR-3-EQ, MR-3-CSR-corp, MR-3-COM, MR-4-HEDGE are NOT-NEEDED for FX-spot-only book. | MR-1-GIRR and MR-3-GIRR activate on first OTC IRD trade; MR-1-EQ and MR-3-EQ activate on first equity trade; MR-3-CSR-corp on first bond trade; MR-3-COM on first commodity-linked trade; MR-4-HEDGE on first CVA hedging need. |
| `PROC-RISK-MRL-01 §5.2` | Daily limit-utilisation snapshot | NEEDED | Must run every business day. | — |
| `PROC-RISK-MRL-01 §5.3` | Amber Alert and Hard Breach response chains | NEEDED | These response chains are active from first trade. | — |
| `PROC-RISK-MRL-01 §5.4` | MR-5 daily no-prop attribution sweep | NEEDED | Every FX spot position must carry valid attribution. Binary 100% requirement from first trade. | — |

### 2.15 Procedures/by-policy/market-risk-monitoring.md (PROC-RISK-MRM-01)

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `PROC-RISK-MRM-01` — Steps 1–12 (VaR, ES, sensitivity, CVA, limit comparison, breach escalation, no-prop attestation) | NEEDED | These steps apply to the FX desk from first trade. Step 3 (ES per risk class) will produce results predominantly in the FX risk class. | — |
| `PROC-RISK-MRM-01` — Steps 13–15 (back-testing, PLA test — IMA desks) | NOT-NEEDED | Back-testing and PLA test are IMA-specific. SA-only FX desk has no obligation to run these. | Activates on first PA IMA desk approval for FX desk. |

### 2.16 Procedures/by-policy/backtesting-governance.md (PROC-RISK-BACKTEST-01)

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `PROC-RISK-BACKTEST-01` — entire procedure | FRTB back-testing governance | NOT-NEEDED | SA-only FX desk. Back-testing is a pre-condition for IMA eligibility (`Policies/market-risk-policy-v1.md §4.3`); it has no capital obligation under SA. | Activates when PA IMA desk approval is pursued for FX desk. |

### 2.17 Procedures/by-policy/stress-test-cycle.md (PROC-RISK-ST-01)

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `PROC-RISK-ST-01` | Full stress test cycle | NEEDED | The annual stress cycle must include FX spot P&L impact under FX rate shock scenarios. Step 5 (market risk stress: FX devaluation scenario) is directly relevant. | — |
| `PROC-RISK-ST-01 §5 Step 5` | FX devaluation shock in market risk stress module | NEEDED | Primary FX spot stress scenario. | — |
| `PROC-RISK-ST-01 §5 Steps 6–7` | Credit stress, operational risk stress | PARTIAL | Credit stress module does not bite on FX spot (no issuer risk). Operational stress (system failure, settlement failure) does bite on FX spot. | Credit stress activates on first bond/OTC IRD portfolio. |
| `PROC-RISK-ST-01 §5 Step 8` | Liquidity stress (LCR/NSFR paths) | NEEDED | FX settlement outflows under stress must feed the liquidity module. | — |
| `PROC-RISK-ST-01 §5 Step 17` | Quarterly sensitivity parameter update | NEEDED | Quarterly sensitivity updates must include FX rate assumptions. | — |

### 2.18 Procedures/by-policy/model-validation.md (PROC-RSK-MV-01)

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `PROC-RSK-MV-01` | Model validation cycle | NEEDED | The FRTB SA engine (Tier 1) and FX spot IPV model (Tier 2) must both complete validation before first trade. | — |
| `PROC-RSK-MV-01` | Tier 1 annual validation cycle | NEEDED | Annual revalidation of FRTB SA engine. | — |
| `PROC-RSK-MV-01` | Tier 2 biennial validation | NEEDED | Biennial revalidation of FX spot IPV model. | — |

### 2.19 Procedures/by-policy/collateral-valuation-daily.md (PROC-ALM-CVD-01)

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `PROC-ALM-CVD-01` — entire procedure | Daily collateral valuation and margin call management | NOT-NEEDED | FX spot under the trading mandate is uncollateralised pre-settlement (T+2 window, no CSA for spot). Variation margin (VM) and initial margin (IM) obligations under JS 2/2020 apply to OTC derivatives with longer-dated exposure profiles, not to vanilla T+2 FX spot. There is no daily margin call cycle for FX spot. Note: if the bank later agrees a CSA with any FX spot counterparty that includes a margining provision for pre-settlement exposure, this procedure would activate. | Activates on first OTC IRD trade subject to JS 2/2020 margin obligations; or if a margining CSA is agreed for FX spot exposure. |

### 2.20 Procedures/by-policy/counterparty-onboarding-markets.md (PROC-MK-CO-01)

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `PROC-MK-CO-01` | Seven-gate onboarding procedure | NEEDED | Every FX spot counterparty must complete onboarding before the first trade; `CounterpartyEnabled` is a pre-condition for `ConductGatePassed` (`PROC-MK-PCG-01 Check 1`). | — |
| `PROC-MK-CO-01 Gate 1` | KYC / CDD (FICA s.21) | NEEDED | Mandatory for all counterparties. | — |
| `PROC-MK-CO-01 Gate 2` | ISDA Master Agreement | PARTIAL | ISDA is required for OTC derivative transactions (`ORG-CS3-001`). FX spot is not technically an OTC derivative under ISDA (it is a spot FX transaction governed by SWIFT confirmations and applicable FX market conventions). However, many institutional counterparties execute FX under an ISDA Master Agreement or a bilateral FX Master Agreement. This gate should confirm whether an ISDA or equivalent FX bilateral master is in place; if not, the legal documentation gate should be satisfied by a bilateral FX trading agreement. This is a gap in PROC-MK-CO-01 for FX-spot-only: the gate currently assumes ISDA = required. | ISDA fully required on first OTC IRD trade. |
| `PROC-MK-CO-01 Gate 3` | Counterparty categorisation (FAIS) | NEEDED | Institutional counterparty classification is mandatory. | — |
| `PROC-MK-CO-01 Gate 4` | Credit limit (Helena) | NEEDED | Credit limit must be live in the engine before first trade. | — |
| `PROC-MK-CO-01 Gate 7` | JS 2/2020 margin documentation | NOT-NEEDED | As noted for `PROC-ALM-CVD-01` — T+2 FX spot is not in scope for JS 2/2020. | Activates on first OTC IRD trade. |

### 2.21 Procedures/finance/fx-settlement-reconciliation.md (PROC-FIN-FXSR-01)

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `PROC-FIN-FXSR-01` | FX spot three-way settlement reconciliation | NEEDED | This procedure is named for FX spot specifically (`"FX spot three-way settlement reconciliation"`). The three-way match (trade leg, payment leg, GL) is an operations control, not a market risk control — but it directly bounds the Herstatt risk window. Helena cites the boundary: once `FxSettlementConfirmed` is received, the settlement-risk window for that trade is closed. Until then, the principal risk is outstanding. | — |
| Herstatt risk boundary (market risk–operations boundary) | The period between `FxSettlementInstructed` and `FxSettlementConfirmed` is the live Herstatt risk window. The settlement reconciliation procedure closes that window. | NEEDED | Market risk deems settlement reconciliation output (confirmed vs unconfirmed) as an input to daily settlement-risk exposure calculations. | — |

### 2.22 Procedures/finance/fx-period-close-runbook.md (PROC-FIN-FXPC-01)

| Artefact | Element | Relevance | Reason | Reactivation trigger |
|---|---|---|---|---|
| `PROC-FIN-FXPC-01` | FX spot EOD and period-close runbook | NEEDED | Daily EOD MTM revaluation (IAS 21 closing rate) and P&L recognition (IFRS 9 FVTPL) for FX spot positions are mandatory from first trade. The FRTB SA engine's market risk capital computation depends on the EOD position and rate data produced by this runbook. | — |
| `PROC-FIN-FXPC-01` | Period-end (monthly, quarterly, annual) close for FX spot | NEEDED | Period-end FVTPL measurement and IFRS disclosure. | — |

---

## 3. Minimum-Viable Market-Risk Envelope for FX Spot

The following constitute the **minimum set** of policy clauses and procedure steps that must be fully operational before the first FX spot trade is executed. This is the pre-licence go-live gate for the FX spot market-risk framework.

### 3.1 Policies (specific clauses — mandatory)

| Policy | Minimum-required clauses |
|---|---|
| `Policies/market-risk-policy-v1.md` | §1 (Overarching — FRTB framework, SA default, no-prop principle, events-first accounting, breach taxonomy); §3 (MR-1-FX, MR-2, MR-3-FX, MR-5 no-prop, MR-6 stress ceiling); §5 (CVA-SA at de-minimis level — governance live); §6.1 MRC constituted; §6.2 daily reporting + monthly capital report live |
| `Policies/valuation-policy-v1.md` | §3.1 (FX spot rate source hierarchy — SARB fixing as operative source); §4 (production-only provenance gate — non-waivable); §5 (FX spot staleness thresholds); §6 (EOD MTM run); §7 (IPV — Level 2 daily) |
| `Policies/trading-mandate-v1.md` | §2.5 (FX spot USD/ZAR permissible instrument confirmed); §3.1 (institutional-only counterparties); §3.3 (no-prop prohibition); §4.1 (FX desk governance); §4.3 (FRTB trading-book boundary); §5.1 (MR-1-FX VaR limit calibrated and BRC-approved); §5.2 (FX intraday limit live); §5.3 (FX EOD limit live); §6 (FX settlement risk framework — Herstatt controls all active, B-cluster lines live) |
| `Policies/liquidity-risk-management-policy-v1.md` | §2 (LCR framework); §3 (NSFR framework); §4 (intraday liquidity management — BCBS 248 tools); §4.3 (intraday buffer sized); §5 (CFP Tier 1 ready) |
| `Policies/stress-testing-policy-v1.md` | §3.1 (Tier 1 and Tier 2 stress programmes — FX scenarios included); §3.3 (ICAAP integration); §3.4 (ILAAP integration); §3.5 (recovery plan link) |
| `Policies/model-risk-policy-v1.md` | §2 (FRTB SA engine classified Tier 1; IPV model Tier 2); §3.3 (validation completed before deployment); §4 (model inventory populated with at least FRTB SA engine and FX IPV model) |
| `Policies/insider-trading-pa-dealing-policy-v1.md` | Full policy — applies regardless of product shape; pre-clearance system and surveillance system must be live |

### 3.2 Procedures (mandatory)

| Procedure | Minimum requirement |
|---|---|
| `PROC-MK-MDI-01` | At least one active dealer mandate for FX spot covering the FX desk, with calibrated notional limits, acknowledged |
| `PROC-MK-MBH-01` | Breach monitoring engine live (or manual compensating control documented and attested); Level-1 / Level-2 triage paths tested |
| `PROC-MK-PCG-01` | All 5 checks live and blocking before first trade; credit-limit engine live (already is per D-CREDIT-LIMIT-ENGINE-BUILD Phase 4) |
| `PROC-MK-CO-01` | All counterparties fully onboarded (Gates 1–6 complete; Gate 7 waived for FX spot); `CounterpartyEnabled` events in the event store |
| `PROC-MK-FPR-01` | First quarterly posture review cycle scheduled (Helena risk overlay section live) |
| `PROC-RISK-MRL-01` | Limit register live with MR-1-FX, MR-2, MR-3-FX, MR-5, MR-6 calibrated values (BRC-approved); daily monitoring engine live (or manual compensating control); breach escalation paths tested |
| `PROC-RISK-MRM-01` | Daily VaR / ES / FX sensitivity calculation live (Steps 1–12 only; Steps 13–15 dormant); daily report to Helena by 09:00 |
| `PROC-RSK-MV-01` | FRTB SA engine (Tier 1) and FX IPV model (Tier 2) validation completed; `ModelValidationCompleted` + `ModelApproved` + `ModelDeployed` events in event store |
| `PROC-RISK-ST-01` | First annual stress cycle scheduled; FX rate shock scenarios included; ICAAP/ILAAP integration confirmed |
| `PROC-FIN-FXSR-01` | Three-way settlement reconciliation live from first trade; Herstatt window closure confirmed per settled trades |
| `PROC-FIN-FXPC-01` | EOD MTM run live from first trade; FVTPL P&L recognition in GL confirmed |

### 3.3 Supporting substrate — mandatory pre-conditions

| Substrate item | Status | Note |
|---|---|---|
| Production FX quote feed (or SARB fixing as interim) | Gap — `Policies/valuation-policy-v1.md §9 Gap 1` | SARB daily fixing is the operative fallback; must be tagged `provenance: "production"` |
| Credit-limit engine (`checkHeadroom`) | LIVE | D-CREDIT-LIMIT-ENGINE-BUILD Phase 4 — already complete |
| FRTB SA engine — FX delta/sensitivity component | PLANNED | Must be complete and validated before first trade |
| FX spot valuation model (IPV) | PLANNED | Must be validated (Nadia) before first trade |
| No-prop attribution metadata at trade booking | PLANNED | Every `FxTradeExecuted` event must carry a `clientFlowRef` or `hedgeProgrammeRef` field; registry of named franchise hedge programmes must be live |
| Dealer mandate registry | PLANNED | Pre-trade query must be live |
| Party register with counterparties at `CounterpartyEnabled` status | LIVE (Phase 3) | Must be populated before first trade |

---

## 4. Dormant-but-Resident Clauses

The following clauses remain in the policies and procedures **as written** (no edits, no deletion). They are dormant in an FX-spot-only book. The rationale for keeping each resident (rather than removing) is given.

| Policy / Procedure | Dormant clause | Why kept resident |
|---|---|---|
| `Policies/market-risk-policy-v1.md §4.3` | Back-testing (HPL/RTPL, 250-day exception count, zone thresholds) | Required for IMA eligibility once PA approval is sought. Removing would require a policy amendment before IMA pursuit; keeping is the lower-friction path. |
| `§4.4` | PLA test (Spearman correlation, variance ratio, desk-level monthly) | Same rationale as back-testing — IMA pre-condition. |
| `§4.5` | NMRF / SES treatment | Same rationale — IMA pre-condition. |
| `§4.2` | IMA desk approval pathway | IMA is the aspirational approach per the policy's stated principles. Keeping it resident signals strategic intent to the PA. |
| `§5` — CVA hedges | CVA hedge programme limit (MR-4-HEDGE) | Hedge mechanics are already codified in the procedure. Removing and re-adding for the first OTC IRD trade would require policy amendment; keeping is lower friction. |
| `Policies/trading-mandate-v1.md §2.2` | JSE Equity Desk instruments | Mandate covers all four desks. The positive-enumeration structure means inactive desks are dormant but the framework is complete. |
| `§2.3` | JSE Bond / Fixed Income Desk instruments | Same rationale. |
| `§2.4` | OTC IRD Desk instruments | Same rationale. |
| `§2.5 (FX forwards, swaps)` | FX forward (outright and client hedge delivery) and FX swap instruments | These are already in the v1 trading mandate. They are dormant only from the brief's perimeter restriction; they activate on management decision without requiring an NPA gate (already approved in the mandate). Keeping resident avoids a mandate amendment cycle when management decides to trade forwards/swaps. |
| `Policies/valuation-policy-v1.md §3.2–3.4` | Interest rate curves, JSE bond prices, SENS announcements | These source hierarchies are defined for completeness of the policy; they do not add cost and will be needed immediately when other products activate. |
| `Policies/stress-testing-policy-v1.md §3.2` | Scenario types: rate shock, credit spread widening, equity crash | These scenarios run in the full annual stress cycle but produce negligible output for FX spot. They remain resident because the stress cycle is integrated across all risk types; removing them for a spot-only phase and reinstating them on first OTC IRD/equity trade would create unnecessary policy churn. |
| `Policies/model-risk-policy-v1.md §5` | IFRS 9 ECL model suite (staging, PD, LGD, EAD, macroeconomic overlay) | ECL model governance is required for any amortised-cost or FVOCI portfolio. FX spot is FVTPL. The ECL framework is resident because the bank anticipates holding a bond/lending portfolio alongside the trading book. |
| `PROC-MK-CO-01 Gate 7` | JS 2/2020 margin documentation | Resident because the gate runs for all OTC counterparties at onboarding; once an OTC IRD desk activates, Gate 7 will be needed without procedure amendment. |
| `PROC-ALM-CVD-01` | Full daily collateral valuation and margin call management procedure | Resident because it will be needed immediately on first OTC IRD trade. No value in removing it; it simply does not trigger for FX spot. |
| `PROC-RISK-BACKTEST-01` | Full back-testing governance procedure | Resident as IMA pre-condition; dormant for SA-only period. |

---

## 5. Procedure Rewrites Required

The following procedures, **as written**, contain assumptions or scope language that could mislead an operator running an FX-spot-only book. These are follow-on briefs, not fixes in this run. Each is assigned to workstream `WS-MARKET-RISK-PROCEDURES`, priority `next-tick`.

| # | Procedure | Issue | Follow-on brief title (proposed) |
|---|---|---|---|
| 1 | `Procedures/by-policy/market-risk-limit-monitoring.md` (PROC-RISK-MRL-01) | The limit register includes MR-1-GIRR, MR-1-EQ, MR-3-GIRR, MR-3-EQ, MR-3-CSR-corp, MR-3-COM with `[calibration: pending]` values. An operator running FX-spot-only will see dormant limit rows in the monitoring engine. These rows should be marked `status: dormant` with a reactivation trigger in the register metadata to prevent confusion and false zero-utilisation signals. | Add dormant/active status flags to PROC-RISK-MRL-01 limit register |
| 2 | `Procedures/by-policy/market-risk-monitoring.md` (PROC-RISK-MRM-01) | Steps 3–4 compute ES and sensitivities "per risk class: general interest rate, equity, FX, credit spread, commodity". An FX-spot-only operator will see near-zero outputs for all risk classes except FX, which may create confusion about whether the monitoring system is working. The procedure should specify that for a product-restricted desk, risk classes outside the active product set are expected to show zero utilisation. | Annotate PROC-RISK-MRM-01 to indicate expected zero-utilisation risk classes for FX-spot-only operation |
| 3 | `Procedures/markets/dealer-mandate-issuance.md` (PROC-MK-MDI-01) | Step 3 references "VaR contribution, DV01 per tenor bucket (IRS/FX)". The DV01 per tenor bucket calibration is applicable to the OTC IRD desk, not to FX spot. An FX spot dealer mandate issuance using this procedure would need to skip or mark N/A the DV01 calibration. The procedure should distinguish FX spot mandate calibration (VaR contribution + notional limits) from OTC IRD mandate calibration (DV01 per tenor bucket). | Split FX and IRD calibration inputs in PROC-MK-MDI-01 Step 3 |
| 4 | `Procedures/by-policy/counterparty-onboarding-markets.md` (PROC-MK-CO-01) | Gate 2 (ISDA Master Agreement) is written as if ISDA is universally required. For FX spot counterparties where the governing instrument is a bilateral FX trading agreement (not ISDA), the gate pass condition is ambiguous. The procedure should confirm: for FX-spot-only counterparties, Gate 2 is satisfied by a bilateral FX Master Agreement or equivalent; ISDA is required for OTC derivative counterparties. | Clarify Gate 2 pass condition in PROC-MK-CO-01 for FX-spot vs OTC counterparties |
| 5 | `Procedures/by-policy/stress-test-cycle.md` (PROC-RISK-ST-01) | Step 5 lists stress shocks as "parallel rate shift, credit spread widening, equity crash, FX devaluation". For an FX-spot-only book, rate shift, credit spread widening, and equity crash are dormant. The step does not indicate which shocks are product-conditional. An operator may invest effort computing irrelevant stress outputs. The procedure should indicate that shock selection is product-scope-conditional, with an FX-spot-only minimum set (FX devaluation + idiosyncratic correspondent bank stress). | Add product-scope-conditional shock selection guidance to PROC-RISK-ST-01 Step 5 |
| 6 | `Policies/market-risk-policy-v1.md §8.2` — change log | The change-log line at v1.1 still refers to "MR-5 (stress) + MR-5-NPA". This is a render artefact: as noted in `PROC-RISK-MRL-01 §1 change-log v1.1`, Path A has restructured MR-5 = no-prop and MR-6 = stress. The §8.2 reference is now stale. This is a one-line housekeeping correction (no Decision required). | Policy housekeeping: fix stale MR-5/MR-5-NPA reference in market-risk-policy-v1.md §8.2 |

---

## 6. Substrate Gaps Surfaced

The following gaps prevent full autonomous operation of the FX spot market-risk framework. Each is a roadmap item. None is papered over.

| # | Gap | Impact on FX-spot-only operation | Owner | Priority |
|---|---|---|---|---|
| G-1 | **No production FX quote feed** (`Policies/valuation-policy-v1.md §9 Gap 1`). `MarketDataSources.FX_SIM` is `provenance = "simulated"`. SARB daily fixing is the current operative fallback. The SARB fixing must be tagged explicitly as `provenance: "production"` in the `MarketDataStore` and the valuation query pipeline verified. | EOD IPV and MTM run rely on SARB fixing until a real-time feed is live. The provenance gate must explicitly accept SARB fixing as a production source. | Devon (Chief Operating Officer, governance) + Helena sign-off | Pre-go-live gate |
| G-2 | **FRTB SA engine: FX product → risk class mapping not production-validated for spot** (`Policies/market-risk-policy-v1.md §8.1`). The SA engine exists per `PROC-RISK-FRTB-SA-01` and the procedure maps FX spot to the FX risk class (SBM delta). But the engine has not been independently validated (Nadia) against a live FX spot fixture. | Blocks first trade — SA capital computation must be valid before first trade per PA D/2025 timeline. | Rohan (Market risk quantitative engineer, engineering) — build; Nadia (Independent-validation engineer) — validate | Pre-go-live gate |
| G-3 | **No-prop attribution metadata at trade booking: `clientFlowRef` and `hedgeProgrammeRef` not enforced in FX spot event schema** (`PROC-RISK-MRL-01 §5.4`). The no-prop sweep relies on attribution metadata in each position record. If `FxTradeExecuted` events do not carry this field, the sweep will flag every FX spot position as `missing` attribution. | Hard Breach on MR-5 from day one if attribution metadata is not embedded in the FX spot event schema. | Kai (Structured rates trader, markets) — front-office system; Atlas (Core banking platform architect) — event schema | Pre-go-live gate |
| G-4 | **FX spot VaR limit (MR-1-FX) not calibrated** — `[calibration: pending RAS-calibration by Rohan under Helena's direction]` throughout `PROC-RISK-MRL-01`. The intraday and end-of-day position limits in `Policies/trading-mandate-v1.md §5` are also `[TBC — Helena to calibrate at BRC]`. | No hard limit line in the monitoring engine. The bank cannot operate to a first trade without a BRC-approved numerical limit. | Helena — recommendation; CEO (Board interim) — approval; Rohan — calibration inputs | Pre-go-live gate (blocks first trade per Trading Mandate §5.1) |
| G-5 | **FX settlement risk limit (MR-B8a — B-cluster continuous controls) not automated** (`Policies/trading-mandate-v1.md §9 Gap 3`). The B-cluster recon harness computing L-B8a-1 to L-B8a-5 over live `FxSettlementInstructed` events is a Vera Wave-4 backlog item. Until it lands, Helena monitors manually. | Settlement concentration risk cannot be monitored in real time. Helena's manual review is a compensating control but it does not scale once FX spot trading volume increases. | Rohan (risk engineer) under Helena | Pre-commencement (compensating control: Helena manual monitoring) |
| G-6 | **`MarketDataStaleAlert` event type not defined** (`Policies/valuation-policy-v1.md §9 Gap 2`). Until defined, stale-data breaches produce console warnings only. | Stale rate data in the FX spot MTM run will not produce a typed event; the recon pipeline (`recon:staleness-threshold-compliance`) cannot assert the control. | Atlas (Core banking platform architect) — event type definition | Next compliance-substrate slice |
| G-7 | **FX spot SA-CCR exposure during T+2 window: calculation not validated against the live SA-CCR engine**. The SA-CCR v1 engine includes FX product maturity factors per PR #624. The FX spot exposure window (0–2 days) produces a near-zero SA-CCR amount; but the calculation has not been explicitly tested for the spot maturity-factor scenario. | Near-zero capital impact; but any zero-population of the SA-CCR event for FX spot creates a gap in the MR-3-CSR-cva limit monitoring chain. | Rohan (Market risk quantitative engineer, engineering) | Pre-go-live gate (low risk; verification only) |
| G-8 | **`FX Settlement Risk Procedure` not yet authored** (`Policies/trading-mandate-v1.md §9 Gap 2`). The procedure-layer document implementing §6 of the trading mandate is planned but not authored. The Herstatt control set is defined in the policy; the step-by-step procedure for Tomas (Operations & payments engineer) and Saskia (Head of Global Markets, governance) does not yet exist. | Herstatt controls rely on the policy text as operating guidance. Without a procedure, Tomas must operate from the policy directly; this is an audit finding from commencement of trading. | Saskia (Head of Global Markets, governance) + Helena + Tomas | Pre-commencement |
| G-9 | **Counterparty approval for FX spot: ISDA vs bilateral FX Master Agreement gate ambiguity** in `PROC-MK-CO-01 Gate 2`. If the first FX spot counterparty does not have an ISDA Master Agreement in place (common for pure FX spot players), the Gate 2 pass condition blocks onboarding. No alternative legal documentation path is defined in the procedure. | Counterparty onboarding may be blocked for legitimate FX spot-only counterparties until the gate is clarified. | Imani (Legal-as-code engineer, engineering) — documentation review; Saskia — onboarding | Immediate (see §5 item 4 for the procedure rewrite) |
| G-10 | **`ModelFallbackUsed` event type planned but not yet defined** (`Policies/valuation-policy-v1.md §9`, cross-ref `§3.2 Source 3`). If Helena approves a bootstrapped rate curve as fallback during any FX spot session where the SARB fixing is unavailable, no typed event can be emitted. | Fallback use goes unrecorded in the event log; violates Principle 1. FX spot is unlikely to need a rate curve fallback (spot rate, not forward), but the event type gap is a known gap in the valuation infrastructure. | Atlas (Core banking platform architect) | Next compliance-substrate slice |

---

*Helena (Chief Risk Officer, governance)*  
*2026-05-20*  
*Brief: `brief:helena:fx-spot-only-market-risk-scope-review:2026-05-20`*
