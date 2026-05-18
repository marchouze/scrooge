---
policy-id: PRICING-POLICY-V1
title: Pricing Policy
version: "1"
status: IN FORCE
owner: Saskia (Head of Global Markets, governance)
effective-from: "2026-05-14"
citations:
  - "FSCA Conduct Standard 3 of 2018 §8: daily valuation methodology for OTC derivative transactions"
  - "FAIS Act 37 of 2002 + GCC (BN 80/2003) s.7(1)(c)(vi): fee and commission disclosure"
  - "FAIS Act 37 of 2002 + GCC s.3(1)(a)(vii): all fees and amounts in specific monetary terms"
  - "FSCA Conduct Standard 3 of 2018 §7: counterparty categorisation — pricing differentiation basis"
  - "Banks Act 94 of 1990: s90 (accounting records — mark-to-market and fair value)"
  - "IFRS 13 Fair Value Measurement: §§9–31 (fair value hierarchy; Level 1, 2, 3)"
author: Mira (Compliance / RegTech engineer)
co-author: Saskia (Head of Global Markets, governance)
date: 2026-05-14
summary: >
  Pricing Policy covering transaction pricing methodology for OTC derivatives,
  bonds, and repo, including spread construction, fee disclosure, IFRS 13 fair
  value hierarchy, independent price verification, and governance. Closes obligations
  ORG-CD-06 (pricing transparency; TCF outcome 4), ORG-FAIS-RK-FEE-DISCLOSURE
  (fee disclosure under GCC s.7), ORG-MK-07 (pricing policy — funding strategy
  component), ORG-CS3-006 (daily valuation methodology under CS 3/2018 §8).
decision-required: false
riskTaxonomy:
  - RT-CD.CC
  - RT-MR.GN
---

# Pricing Policy

> **Authors.** Saskia (Head of Global Markets, governance) — lead; Mira (Compliance / RegTech engineer) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Authored under the events-first authoring rule and the no-pause dispatch rule — CLAUDE.md "Operating procedures".
> **Obligations closed.** `ORG-CD-06` (pricing transparency and TCF outcome 4 — customers receiving fair prices), `ORG-FAIS-RK-FEE-DISCLOSURE` (GCC s.7 fee and commission disclosure), `ORG-MK-07` (pricing policy component — funding strategy), `ORG-CS3-006` (daily valuation methodology under CS 3/2018 §8).
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Purpose and Scope

This policy establishes the bank's framework for pricing financial transactions, disclosing fees, and producing independent mark-to-market valuations. It covers transaction pricing methodology, the fee disclosure regime, fair value hierarchy, and governance of the pricing function.

**In scope:**
- OTC interest rate derivatives (swaps, options, swaptions)
- OTC FX derivatives (forwards, options, cross-currency swaps)
- South African Government Bonds and other fixed-income securities (JSE-traded)
- Repurchase agreements and reverse-repurchase agreements
- Secondary-market bond trades
- Fee, spread, and commission structures for any financial service rendered

**Out of scope:**
- Exchange-traded derivatives (priced by the exchange)
- Retail product pricing (bank is institutional-only; retail activates at licence-day)
- Credit pricing (covered by the Credit Risk Policy under Camille / Helena)

---

## 2. Regulatory Framework

| Instrument | Requirement |
|---|---|
| FSCA CS 3/2018 §8 | Daily MTM valuation for OTC derivatives; consistent; documented methodology |
| GCC (BN 80/2003) s.7(1)(c)(vi) | Written disclosure of all fees, commissions, and consideration before engagement |
| GCC s.3(1)(a)(vii) | Fees stated in specific monetary terms (or basis of calculation) |
| IFRS 13 | Fair value measurement hierarchy (Levels 1–3); principal market; most advantageous market |
| TCF Outcome 4 | Customers receive products and services that perform as the firm has led them to expect; pricing transparent and not structured to exploit |

---

## 3. Transaction Pricing Methodology

### 3.1 OTC Interest Rate Derivatives

- **Mid rate:** derived from JSE Bond Exchange / Bloomberg / Reuters benchmark curves (JIBAR swap curve; SAGB yield curve)
- **Bid-offer spread:** applied around mid; spread schedule approved by Saskia (Head of Global Markets) and reviewed quarterly
- **Credit / CVA adjustment:** CVA applied to reflect counterparty credit risk; reviewed by Rohan (Market risk engineer)
- **Funding / FVA adjustment:** Funding Valuation Adjustment applied where the bank funds the hedge position; methodology approved by Eitan (Treasurer, governance)

### 3.2 OTC FX Derivatives

- **Mid rate:** SARB indicative rate; Reuters spot fixing; JSE Currency Derivatives settlement prices as applicable
- **Spread:** standard FX spread schedule; wider for illiquid currency pairs or tenors
- **Basis / cross-currency basis:** applied for cross-currency swaps using cross-currency basis swap quotes

### 3.3 Fixed Income (Bonds)

- **Benchmark prices:** JSE Bond Exchange reference prices at close; Bloomberg composite for international bonds
- **Spread to benchmark:** negotiated with counterparty; spread schedule for secondary-market trading approved by Saskia
- **Price transparency:** bid price, offer price, and mid are disclosed to counterparties on request per CS 3/2018 §8

### 3.3A Multi-instrument measurement summary

The table below is the authoritative cross-instrument reference for classification, measurement basis, MTM frequency, P&L routing, and IFRS authority. Posting-rule assignments and GL account references are detailed in [`Procedures/finance/trade-lifecycle-system-capability-register.md`](../Procedures/finance/trade-lifecycle-system-capability-register.md).

| Instrument | Classification | Measurement basis | MTM frequency | P&L routing | IFRS ref |
|---|---|---|---|---|---|
| FX spot (trading book) | FVTPL | Closing mid-market rate | Daily | P&L | IFRS 9 §5.7.1; IAS 21 §23 |
| FX forwards / swaps (trading book) | FVTPL | Observable forward curve | Daily | P&L | IFRS 9 §5.7.1 |
| FX NDF (trading book) | FVTPL | Observable NDF curve | Daily | P&L | IFRS 9 §5.7.1 |
| JSE bonds (trading book) | FVTPL | JSE closing clean price | Daily | P&L | IFRS 9 §5.7.1 |
| JSE bonds (banking book) | Amortised cost | EIR; no fair value change | EIR accrual daily | P&L (interest income) | IFRS 9 §5.4.1 |
| JSE equities — FVTPL election | FVTPL | JSE closing price | Daily | P&L | IFRS 9 §5.7.1 |
| JSE equities — FVOCI election | FVOCI (irrevocable) | JSE closing price | Daily | OCI (no P&L recycling) | IFRS 9 §5.7.5 |
| OTC IRD swaps (trading book) | FVTPL | NPV via JIBAR/SOFR curve | Daily | P&L | IFRS 9 §5.7.1 |

Notes:
- **Build-phase rate source for FX:** FX sim (`FxPositionRevalued.revalRate`). At commencement of trading: WM-Fix / Bloomberg BFIX (Level 1).
- **Forward curve substrate:** Rohan (Market risk engineer)'s M5 risk substrate. Until live, spot rates are used as proxy for forward MTM (disclosed as a substrate gap in PROC-MK-FXFL-01 §8).
- **FVOCI equity irrevocable election:** made at initial recognition; approved by Camille (CFO, governance). Once elected, the OCI balance on sale transfers to retained earnings, not P&L (IFRS 9 §5.7.5 — no recycling).
- **Amortised-cost bonds EIR:** effective interest rate accrual daily; fair value changes not recognised in P&L. ECL provision applies per [`Policies/ifrs9-ecl-provisioning-policy-v1.md`](ifrs9-ecl-provisioning-policy-v1.md).

### 3.4 Repo / Reverse-Repo

- **Repo rate:** agreed bilaterally; benchmarked to SARB repo rate and overnight JIBAR
- **Haircut:** per Collateral Management Policy §3.2
- **Maturity / term:** as agreed; no proprietary term repo book without Eitan (Treasurer) approval for tenors > 30 days

---

## 4. Fee and Commission Disclosure

### 4.1 Obligation

Per GCC s.7(1)(c)(vi) and s.3(1)(a)(vii), before entering into any financial service engagement, the bank must disclose in writing:
- All fees, charges, and commissions in specific monetary terms or basis of calculation
- Any spread between the market price and the price offered (where the spread constitutes consideration)
- Any payment from a third party (product supplier) to the bank

### 4.2 Institutional Counterparties — Spread Disclosure

The bank is a market-maker / dealer, not a retail adviser. For institutional counterparties:
- The bid-offer spread is the primary form of consideration
- The spread is disclosed as part of the indicative quote before execution
- For bespoke structured transactions, the all-in fee (including advisory, structuring, and distribution) is disclosed in the term sheet before execution

### 4.3 Fee Schedule

The bank maintains a published fee schedule approved by Saskia (Head of Global Markets) and Zara (Chief Compliance Officer, governance). The fee schedule is:
- Available to counterparties on request
- Reviewed and updated annually or on material market change
- Filed in the document store (per `D-RMS-PHASE-1`)

### 4.4 Record-Keeping

All fee disclosures are captured as a `FeeDisclosureEvent` in the event store and retained for a minimum of 5 years (GCC s.3(2) / FAIS Act s.18(b)).

---

## 5. Independent Price Verification (IPV)

### 5.1 Purpose

The IPV process ensures that valuations used for P&L reporting, margin calls, and financial statements reflect fair market value and are not influenced by the trading desk.

### 5.2 IPV Frequency and Responsibility

- **Daily IPV:** Rohan (Market risk engineer) performs daily IPV for all OTC derivatives and bond positions
- **Source independence:** IPV uses a secondary pricing source independent of the front-office feed
- **Tolerance:** price differences > 0.25% of notional (or > ZAR 50,000 per position) are flagged as IPV exceptions
- **Exception resolution:** Rohan and the trading desk (Kai — FX / Rates trader, engineering) jointly resolve exceptions by close of business; unresolved exceptions escalated to Saskia (Head of Global Markets) and Helena (Chief Risk Officer, governance)

### 5.3 IFRS 13 Fair Value Hierarchy

| Level | Description | Instruments |
|---|---|---|
| Level 1 | Quoted prices in active markets for identical assets | JSE-listed equities; liquid on-the-run SAGBs; exchange-traded contracts |
| Level 2 | Observable inputs other than Level 1; model with observable inputs | OTC derivatives with standard terms; off-the-run SAGBs; repo |
| Level 3 | Significant unobservable inputs | Bespoke structured products; illiquid bonds; options on illiquid underlyings |

The bank aims to minimise Level 3 exposure. Any Level 3 designation requires approval by Camille (CFO, governance) and is subject to enhanced IPV.

---

## 6. TCF Outcome 4 — Pricing Fairness

The bank is committed to TCF Outcome 4: that customers receive products and services that perform as the firm has led them to expect. Pricing governance measures:

- Bid-offer spreads are benchmarked to market rates quarterly by Rohan and reviewed by Saskia
- No discriminatory pricing based on counterparty characteristics unrelated to risk or service cost
- Fee schedules are disclosed in advance; no hidden fees
- Valuation disputes are handled per the Collateral Management Policy §6 and the TCF / Complaints framework

---

## 7. Governance

| Role | Accountability |
|---|---|
| Saskia (Head of Global Markets, governance) | Policy owner; pricing strategy; spread schedule approval |
| Rohan (Market risk engineer) | IPV; fair value hierarchy; model validation |
| Eitan (Treasurer, governance) | FVA methodology; repo pricing |
| Zara (Chief Compliance Officer, governance) | Fee disclosure compliance; TCF Outcome 4 oversight |
| Camille (CFO, governance) | IFRS 13 Level 3 designation approval; financial statements |
| Mira (Compliance / RegTech engineer) | GCC fee-disclosure monitoring; regulatory intelligence |

### 7.1 Review Cadence

- **Quarterly:** Rohan benchmarks spreads; Saskia reviews and approves schedule
- **Annual:** full policy review by Saskia and Zara
- **Trigger:** material market disruption; regulatory guidance on fair pricing; significant new product launch

---

## 8. Relationship with Other Policies

| Policy | Interaction |
|---|---|
| Market Risk Policy | MTM methodology; VaR inputs; position limits |
| Collateral Management Policy | Margin call valuations; collateral pricing |
| FAIS Compliance Policy | Fee disclosure obligations under GCC; advice records |
| Hedge Accounting Policy | Fair value inputs for hedge effectiveness testing |
| Conduct of Business / TCF Policy | TCF Outcome 4 — pricing fairness |
| Trading Mandate | Permitted products; notional limits |

---

## 9. Substrate Gaps

| Gap | Owner | Target |
|---|---|---|
| FeeDisclosureEvent type in event store | Atlas (Data infrastructure engineer) | Next compliance-substrate slice |
| IPV tolerance engine and exception pipeline | Rohan (Market risk engineer) | Pre-commencement gate |
| Spread-benchmarking recon job | Rohan (Market risk engineer) | Markets Slice 6 |

---

## 10. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| 1 | 2026-05-14 | Mira (Compliance / RegTech engineer) | Initial version — closes ORG-CD-06, ORG-FAIS-RK-FEE-DISCLOSURE, ORG-MK-07 (pricing), ORG-CS3-006 |
| 2 | 2026-05-18 | Owen (Company Secretary, governance) | Added §3.3A multi-instrument measurement table — classification, measurement basis, MTM frequency, P&L routing, IFRS ref for all instrument types (FX spot/fwd/swap/NDF, JSE bonds trading/banking, JSE equities FVTPL/FVOCI, OTC IRD); cross-referenced trade-lifecycle-system-capability-register. Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN. |
