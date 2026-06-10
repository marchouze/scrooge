---
policy-id: trading-mandate
title: Trading Mandate v1
version: "1"
status: IN FORCE
owner: Saskia (Head of Global Markets)
effective-from: "2026-05-11"
next-review: "2027-05-11"
citations:
  - Banks Act 94 of 1990
  - Financial Markets Act 19 of 2012
  - "Financial Markets Act 19 of 2012: s.6A (ODP authorisation)"
  - BCBS Market Risk (FRTB — D352, D457)
  - D-POLICY-DOCUMENT-HOME
author: Kai (Structured rates trader, markets) + Helena (Chief Risk Officer, governance) + Devon (COO, governance)
date: 2026-05-11
summary: Standalone Trading Mandate defining the bank's permissible trading activities, desk structure, product scope (JSE bonds/equities, OTC IRD, FX spot/forward), client-driven mandate (no proprietary), position limits, booking model, and FX settlement risk framework. RAS B5 deferred pending refinement. Closes obligations ORG-PR-19, ORG-PR-20, ORG-MK-01, ORG-MK-04, ORG-PR-48, ORG-MK-09. LICENCE-BIND.
decision-required: false
riskTaxonomy:
  - RT-MK
  - RT-CR.CP
  - RT-CR.SL
  - RT-OP.PA
obligations:
  - ORG-JSE-IRC-01
  - ORG-FMA-001
---

# Trading Mandate v1

**Authors:** Kai (Structured rates trader, markets) — lead · Helena (Chief Risk Officer, governance) · Devon (COO, governance)  
**Date:** 2026-05-11  
**Approval:** Board (interim: CEO Marc on behalf of CEO + interim NEDs)  
**Status:** LICENCE-BIND — operative from commencement of trading; substrate authorised from first M-phase booking  
**Supersedes:** None (v1 — inaugural)  
**Next review:** At the pre-licence go-live readiness gate, or on addition of any new desk / product class, whichever is sooner  
**RAS B5 note:** This document is the "refined trading mandate" that RAS §B4 and Market Risk Policy §Principles deferred pending. The per-desk VaR limit calibration (RAS B5 in earlier drafts, referenced as "B5 deferred") is now the next calibration step: Helena will table numerical VaR limits at the BRC after this mandate is approved. The desk-structure and product-scope sections below are the inputs to that calibration.

---

## 1. Trading Mandate — Overarching

### 1.1 Purpose and authority chain

This Trading Mandate sets out the permissible trading activities of **Hoz Bank Limited** (registration number: [TBC at incorporation]; "the bank"). It is the primary policy instrument governing:

- which financial instruments the bank may hold in its trading book or warehouse as hedges of client franchise activity;
- which desks are authorised, how each is structured, and what each desk's risk ownership entails;
- the trading-book / banking-book boundary; and
- the position limit framework within which all trading activity operates.

**Regulatory authority chain (upward citations — Principle 2):**

| Level | Instrument | Binding provision |
|---|---|---|
| Banks Act | Banks Act 94 of 1990 + Regulations Relating to Banks (2012, as amended) | Part B: prudential requirements; Reg 39: operational-risk management; product-approval binding |
| Markets conduct | Financial Markets Act 19 of 2012 (FMA) | Ch. X: market-abuse prohibitions (insider trading, market manipulation, false reporting); s.5: exchange-licence conditions (JSE) |
| Capital: market risk | BCBS *Minimum capital requirements for market risk* (FRTB, revised 2019; document d457) | Standardised Approach (SA) for market-risk RWA; trading-book / banking-book boundary (Ch. 2); in-scope instrument taxonomy (Ch. 3) |
| FX settlement | SARB Prudential Authority **Guidance Note 5 of 2013** — Foreign Exchange Settlement Risk | FX-settlement-risk discipline; Herstatt-risk management; intraday exposure measurement |
| Exchange rules | JSE Equities Rules and Directives (consolidated; FMA s.5) | Trading-member obligations: order-handling, post-trade, surveillance cooperation |
| OTC derivatives | ISDA Master Agreement (2002 Form) + Schedule + Credit Support Annex | Governing law for all OTC IRD contracts; close-out netting; collateral |

**Obligation IDs closed by this mandate:** `ORG-PR-19` (FRTB market-risk measurement), `ORG-PR-20` (trading-book / banking-book boundary; no proprietary risk-taking), `ORG-MK-01` (FMA Ch. X market-abuse applicability), `ORG-MK-04` (trading mandate: client-driven and franchise market-making), `ORG-PR-48` (FX-settlement-risk discipline under PA GN 5/2013), `ORG-MK-09` (JSE Equities Rules trading-member obligations).

### 1.2 Relationship to other policy documents

| Document | Relationship |
|---|---|
| Risk Appetite Statement & Framework (RAF) — `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` | This mandate operationalises §B4 (market-risk defaults) and is the instrument that was deferred at §B4 "B5 deferred — pending refined trading mandate" |
| Market Risk Policy (Core Policies — Risk §3) | This mandate sits one level below the Market Risk Policy; the Policy sets principle; the Mandate sets scope and structure |
| Counterparty Credit Risk Policy (Helena + Saskia) | Per-counterparty trading limits are set jointly; ISDA netting-agreement enforceability determines credit exposure netting under this mandate |
| New Product Approval Policy (CEO-approved 2026-05-10; `D-NEW-PRODUCT-APPROVAL-POLICY`) | All instruments added to the permissible list below (§2) must have passed the NPA gate; this mandate records the inaugural approved set |
| FX Settlement Policy (planned; Saskia + Helena) | §6 of this mandate is the interim FX settlement-risk framework until a standalone FX Settlement Policy is promulgated |

### 1.3 Scope of entity

This mandate applies to **Hoz Bank Limited** as the booking entity. Trading on the books of **Hoz Securities Limited** is subject to a separate mandate (to be produced when that entity's M-phase approaches commencement-of-trading). During the build phase, all trading-franchise risk-taking sits on the bank's balance sheet at Hoz Bank Limited.

---

## 2. Permissible Activities and Product Scope

### 2.1 Principle of positive enumeration

The bank operates under a **positive-enumeration principle**: only instruments explicitly listed in §§2.2–2.5 below are permissible. Any instrument not listed is impermissible until it passes the New Product Approval gate (§7) and this mandate is amended to include it.

`[citation: TBC — Reg 39 sub-clause on product approval; Imani (Legal-as-code engineer) + external counsel ratify at the licence-application gate per ORG-PR-25]`

### 2.2 JSE Equity Desk — permissible instruments

| Instrument | Description | Settlement | Citation |
|---|---|---|---|
| JSE-listed equities — cash | Ordinary shares + preference shares listed on the JSE Main Board and AltX | T+3 (Strate equity settlement) | JSE Equities Rules (`ORG-MK-09`); FMA s.5 |
| JSE-listed equity ETFs | Exchange-traded funds tracking JSE equity indices | T+3 (Strate equity settlement) | JSE Equities Rules (`ORG-MK-09`) |
| Rights and entitlements | Rights issues, scrip distributions arising from existing equity positions | As per corporate action terms | JSE Equities Rules (`ORG-MK-09`); `ORG-MK-15` (trade-record retention) |

**Not permitted on JSE Equity Desk (v1):**
- Listed equity derivatives (single-stock futures, index futures, equity options) — excluded until NPA gate passed
- Unlisted equities / private placements
- Securities lending beyond intraday settlement-fail remediation

### 2.3 JSE Bond / Fixed Income Desk — permissible instruments

| Instrument | Description | Day-count | Settlement | Citation |
|---|---|---|---|---|
| South African Government Bonds (SAGB) | Fixed-rate nominal bonds issued by the National Treasury; listed on the JSE Interest Rate Market | ACT/365 SA | T+3 (Strate bond settlement) | JSE Debt Listings Requirements (`ORG-MK-16`); FMA s.5 |
| SA Corporate bonds (investment grade) | JSE-listed fixed and floating rate corporate bonds, investment-grade only (≥ BBB- domestic rating or equivalent) | ACT/365 SA (fixed); ACT/365 SA with JIBAR reset (floating) | T+3 (Strate bond settlement) | JSE Debt Listings Requirements (`ORG-MK-16`) |
| SA Parastatal / SOC bonds | Bonds issued by SOCs with explicit or implicit government backing; JSE-listed | ACT/365 SA | T+3 | JSE Debt Listings Requirements (`ORG-MK-16`) |
| Treasury bills (T-bills) | Short-dated SARB-issued / National Treasury T-bills; used for HQLA / liquidity management | Discount / ACT/365 | T+1 (NPS RTGS-settling instruments via correspondent) | Banks Act; `ORG-PR-04` (HQLA quality) |
| Repo / reverse repo (SAGBs, T-bills) | Bilateral repos / reverse repos against SAGB and T-bill collateral; GMRA 2011 SA Schedule governed | Per repo term | Same-day or T+1 | ICMA GMRA 2011 SA Schedule (`ORG-MK-13`); `ORG-PR-23` (SA-CCR exposure) |

**Not permitted on JSE Bond Desk (v1):**
- Sub-investment-grade corporate bonds
- Inflation-linked bonds (ILBs) — excluded until NPA gate passed for inflation-linked risk framework
- Listed bond derivatives (bond futures, bond options) — excluded until NPA gate passed
- Foreign-currency denominated bonds
- Structured notes / CLNs

### 2.4 OTC Interest Rate Derivatives (IRD) Desk — permissible instruments

All OTC IRD positions are governed by an executed **ISDA Master Agreement (2002 Form)** with each counterparty, accompanied by a Schedule and a Credit Support Annex (CSA) before any trade is booked. No OTC IRD transaction may be booked with a counterparty absent a fully executed ISDA suite.

`[citation: Imani (Legal-as-code engineer) — ISDA clause-library; ORG-MK-12 (ISDA CSA NY-law + English-law)]`

| Instrument | Description | Rate reference | Citation |
|---|---|---|---|
| Plain vanilla interest rate swap (IRS) — ZAR fixed/floating | Fixed-rate receiver / payer vs JIBAR (3-month or 6-month); ACT/365 SA day-count | JIBAR (with ZARONIA fallback under PA transition roadmap — `ORG-MK-07`) | ISDA (`ORG-MK-12`); BCBS FRTB d457 §2 trading-book assignment |
| Plain vanilla IRS — ZARONIA OIS | Overnight indexed swap referencing ZARONIA; used for discounting and JIBAR-basis hedging | ZARONIA (SA Overnight Index Average per SARB-administered regime) | ISDA; `ORG-MK-07` (ZARONIA / JIBAR fallback) |
| Basis swaps (JIBAR 3m v JIBAR 6m) | Floating-for-floating ZAR basis swaps; used to manage basis risk in client franchise hedges | JIBAR 3m vs JIBAR 6m | ISDA |
| Forward Rate Agreements (FRAs) | Short-dated fixed-rate commitments on a notional at a future date; OTC settled on fixing date; FRABBA / ISDA terms | JIBAR | ISDA; JSE Bond market convention |

**Not permitted on OTC IRD Desk (v1):**
- Cross-currency swaps (CCS) — excluded until NPA gate passed; requires FX overlay risk framework
- Swaptions (options on swaps)
- Caps, floors, collars
- Inflation swaps
- Credit default swaps (CDS)
- Total return swaps (TRS)
- Exotic or structured IRD products

**Netting and exposure:** OTC IRD exposure is measured under BCBS SA-CCR (`ORG-PR-23`) with ISDA close-out netting enforced where Imani's legal opinion confirms enforceability under applicable governing law. Un-netted exposure reverts to gross replacement-cost measurement.

### 2.5 FX Desk — permissible instruments

The bank operates as an **Authorised Dealer** (SARB Exchange Control Manual; Currency and Exchanges Act 9 of 1933) for the permitted FX activity below. Settlement is conducted via the bank's named primary correspondent (Standard Bank, as per `D-FX-CORRESPONDENT-PAIR-NAMING`) with backup via FirstRand (RMB), both operating under the B-cluster appetite lines at RAS §B8a.

| Instrument | Pair | Settlement | Citation |
|---|---|---|---|
| FX spot | USD/ZAR | T+2 (SWIFT correspondent) | PA GN 5/2013 (`ORG-PR-48`); Currency and Exchanges Act; `D-FX-CORRESPONDENT-PAIR-NAMING` |
| FX forward (outright forward) | USD/ZAR | Settlement date as per forward contract (≤ 1 year at v1) | PA GN 5/2013 (`ORG-PR-48`); SARB ExCon Manual |
| FX forward (client hedge delivery) | USD/ZAR | Per client instruction, matched to underlying obligation | PA GN 5/2013 (`ORG-PR-48`); SARB ExCon Manual |
| FX swap (buy/sell or sell/buy) | USD/ZAR | Near leg T+2; far leg per swap term | PA GN 5/2013 (`ORG-PR-48`) |

**Not permitted on FX Desk (v1):**
- FX options (vanilla or exotic)
- Non-deliverable forwards (NDFs)
- FX derivatives on pairs other than USD/ZAR
- Additional currency pairs (ZAR/EUR, ZAR/GBP, ZAR/CNH etc.) — each requires NPA gate and Authorised Dealer coverage confirmation
- FX prime brokerage / give-up arrangements

**Authorised Dealer note:** The bank's Authorised Dealer authorisation is a condition of banking licence; FX limits are set under the ExCon Manual. Any FX activity outside the ExCon Manual limits is a regulatory breach reportable to the SARB Financial Surveillance Department. Zara (Chief Compliance Officer, governance) holds the ExCon compliance mandate.

---

## 3. Client-Driven Mandate

### 3.1 Institutional-only counterparties

The bank transacts exclusively with **institutional counterparties** as defined under the Financial Advisory and Intermediary Services Act 37 of 2002 (FAIS) — specifically, the FAIS Act's definition of "financial services provider" / juristic persons of the class that the FSP Act and the FSCA's categorisation of "professional investor" or "institutional investor" covers. In practice, for v1 counterparty eligibility:

| Eligible counterparty type | FAIS categorisation | Requirement |
|---|---|---|
| Banks and banking groups (registered under Banks Act) | Professional investor | Executed ISDA / GMRA as applicable; FICA onboarding complete |
| Insurance companies (registered under Insurance Act 18/2017) | Professional investor | As above |
| Retirement funds (registered under Pension Funds Act 24/1956) | Institutional investor | As above; confirmatory mandate letter from fund |
| Asset managers (FAIS-licensed Category II FSP) | Professional investor | As above; board / investment-committee mandate confirmed |
| Listed corporates (JSE Main Board, with verified treasury function) | Juristic-person professional investor (size criteria: total assets ≥ R50m or financial instrument portfolio ≥ R10m per FAIS FSP criteria) | As above; hedging mandate confirmed |
| Development Finance Institutions (e.g., DBSA, IDC) | Institutional investor | As above |

**Not eligible (v1):** natural persons, unlisted SMEs, family offices below the FAIS size thresholds, retail-classified entities. Zara (CCO, governance) + Mira (Compliance / RegTech engineer, engineering) enforce classification at onboarding.

### 3.2 Franchise market-making

The bank's trading franchise is **client-driven market-making**. This means:

1. **Client initiated:** Every trading-book position arises either from a client request for a quote (RFQ), a client order, or a hedge of an existing client position. The desk does not initiate positions to express a directional view on markets.

2. **Market-making commitment:** The bank offers two-way prices (bid and offer) to eligible counterparties in the instruments listed in §2. The spread reflects execution cost, risk, and funding — not a speculative premium.

3. **Warehoused hedge positions:** Residual risk from client trades that cannot be immediately offset (because the offsetting trade is uneconomic at the moment of origination, or because the risk is aggregated across multiple clients for hedging efficiency) may be **warehoused** as hedge positions. Warehoused positions are not proprietary — they are intermediate states on the path to a hedged book. The warehousing period and notional tolerance are governed by the intraday / end-of-day limit framework in §5.

4. **Franchise hedges:** Basis risks, convexity risks, and residual sensitivities inherent in the franchise (e.g., swap-spread basis between client IRS positions and SAGB hedges) may be held as **franchise hedge positions**. These are documented, BRC-reported, and subject to the same limit framework as warehoused positions. They are not proprietary.

### 3.3 Prohibition on proprietary risk-taking

The bank explicitly **prohibits proprietary risk-taking**. This prohibition means:

- **No directional position-building** based on a trader's or desk head's market view absent a client-trade or hedge rationale.
- **No event-driven positioning** — taking a position in anticipation of a market event (central bank meeting, budget, corporate announcement) without an underlying client mandate.
- **No excess carry accumulation** beyond what is needed to hold warehouse / franchise hedges.
- **No inventory accumulation** beyond the end-of-day limit tolerances in §5 that is not traceable to client mandates or approved hedge rationales.

The distinction between a permissible **warehoused hedge** and an impermissible **proprietary position** is:
- A warehoused hedge has a traceable client-trade origin and a documented hedge-offset path with a time-bounded warehousing tolerance.
- A proprietary position lacks one or both of those attributes.

Helena (CRO, governance) adjudicates disputes on this boundary. Any position Helena classifies as proprietary that is not promptly unwound within the escalation timeline (§5.4) is a `Hard`-severity breach reportable to BRC.

**Authority:** RAS §A2 (Market risk appetite: "No proprietary risk-taking outside warehoused franchise hedge positions"); Market Risk Policy §Principles. Obligation `ORG-PR-20` (RAS / Trading Mandate: no proprietary risk-taking outside franchise hedges) is closed by this section.

---

## 4. Desk Structure and Booking Model

### 4.1 Desk structure

| Desk | Head (governance) | Engineering lead | Permissible instruments |
|---|---|---|---|
| JSE Equity Desk | Saskia (Head of Global Markets, governance) | Kai (Structured rates trader, markets) | §2.2 |
| JSE Bond / Fixed Income Desk | Saskia (Head of Global Markets, governance) | Kai (Structured rates trader, markets) | §2.3 |
| OTC IRD Desk | Saskia (Head of Global Markets, governance) | Kai (Structured rates trader, markets) | §2.4 |
| FX Desk | Saskia (Head of Global Markets, governance) | Kai (Structured rates trader, markets) | §2.5 |

**Desk head accountability.** Saskia (Head of Global Markets, governance) is the named accountable executive for all trading desks. She owns:
- compliance with this mandate;
- escalation to Helena (CRO, governance) on limit breaches;
- escalation to Devon (COO, governance) on operational / settlement issues;
- escalation to Zara (CCO, governance) on conduct / FMA / ExCon issues.

**Engineering substrate.** Kai (Structured rates trader, markets) owns the trading-systems substrate: position-keeping, limit-checking, trade lifecycle, booking to the general ledger. Tomas (Operations & payments engineer) owns the settlement substrate (Strate, SWIFT correspondent). Atlas (Core banking platform architect) owns the event-store and real-time position-event infrastructure.

**V1 manning note.** The desk structure above reflects the intended steady-state. In the build phase, Saskia and Kai operate across all desks. At commencement-of-trading, dedicated desk-specific heads will be appointed subject to FAIS / fit-and-proper requirements. This is a `[register: route to Devon — headcount planning]` item against the pre-licence readiness gate.

### 4.2 Booking entity

**All trades are booked to Hoz Bank Limited.** No trading is booked to Hoz Securities Limited during the build phase or pre-commencement period without a separate mandate amendment and Board approval. Each booking carries:

- the booking-entity identifier (`HOZ-BANK-LTD`);
- the desk identifier (`DESK-EQUITY`, `DESK-BOND`, `DESK-IRD`, `DESK-FX`);
- the FRTB book assignment (`TRADING-BOOK` or `BANKING-BOOK`) as determined at §4.3;
- the counterparty Party register ID (from `Regulations/_party-register.md`);
- a citation to the authorising product-fixture in `prototype/platform/markets/products/fixtures.ts`.

All bookings are typed events per Principle 1. The canonical booking event types are defined by Atlas (Core banking platform architect) in the markets CDM event catalogue.

### 4.3 FRTB trading-book / banking-book boundary

The bank applies the FRTB boundary as specified in **BCBS d457 Chapter 2** (`ORG-PR-19`). The governing principles:

**Presumptive trading book assignment (FRTB d457 §3.2):** The following instrument types are presumptively assigned to the trading book unless the bank explicitly elects banking-book treatment with supervisory approval:
- All instruments in §2.2 (JSE-listed equities)
- All OTC IRD instruments in §2.4
- All FX instruments in §2.5
- JSE Bond Desk positions held for market-making or warehousing (§2.3)

**Banking book assignment (Hoz Bank Limited — specific elections):**
- SAGBs, T-bills, and repo / reverse repo positions held as **HQLA** (High Quality Liquid Assets) for LCR / NSFR purposes under Eitan's (Treasurer, markets) liquidity management mandate. These positions are booked with a `BANKING-BOOK-HQLA` designation and are not subject to desk position limits; they are subject to the IRRBB framework and the Liquidity Risk Management Policy.
- Term investment positions explicitly approved by Helena (CRO, governance) as banking-book designations — each requires a documented election and BRC notification.

**Boundary control:** No reclassification from trading book to banking book (or vice versa) is permitted without Helena's written approval (a signed `BookReclassification` event) and BRC notification. Unauthorised reclassification is a `Hard`-severity breach. Obligation `ORG-PR-20` (trading-book / banking-book boundary) is closed by this section.

**FRTB applicability:** The bank uses the **Standardised Approach (SA)** for market-risk RWA under FRTB. The Internal Models Approach (IMA) is not adopted at v1. PA GN 3/2010 (IMA market-risk hypothetical backtesting) does not apply — the bank uses SA. Obligation `ORG-MK-01` (FRTB applicability) is partially closed by this section; full closure requires the regulatory capital reporting procedures (Helena + Camille [CFO, governance]).

---

## 5. Position Limits and Risk Appetite

### 5.1 RAS B5 placeholder — VaR limits per desk

**Status: calibration pending — this is the "refined mandate" input that was deferred.**

RAS §B4 ("VaR limits per desk, calibrated against franchise size; reviewed monthly until stable, then quarterly") and the Market Risk Policy §Principles ("VaR limits per desk; calibrated against franchise size") deferred per-desk numerical VaR limits pending this mandate. Now that the desk structure and product scope are defined (§§2–4), Helena (CRO, governance) will table the following limit calibration at the next BRC:

| Desk | VaR metric | Calibration input | Review cadence |
|---|---|---|---|
| JSE Equity Desk | 1-day 99% VaR (FRTB-SA sensitivity-based equivalent) | Initial franchise flow estimates (Kai/Saskia); calibrated against initial capital allocation | Monthly for first 6 months; quarterly thereafter |
| JSE Bond Desk | 1-day 99% VaR (FRTB-SA DRC + RRAO as applicable) | SAGB flow estimates; HQLA-designated positions excluded | Monthly for first 6 months; quarterly thereafter |
| OTC IRD Desk | 1-day 99% delta-equivalent PV01; tenor-bucket sensitivities | Initial IRS / FRA client flow estimates; basis swap residual | Monthly for first 6 months; quarterly thereafter |
| FX Desk | 1-day 99% VaR; end-of-day delta (USD/ZAR) | Authorised Dealer flow estimates; B-cluster constraint (RAS §B8a) | Monthly for first 6 months; quarterly thereafter |

Until the numerical BRC-approved VaR limits land in an amendment to this mandate, the **intraday and end-of-day position limits** in §§5.2–5.3 are the operative controls.

### 5.2 Intraday limit framework

The intraday limit framework governs positions **during the trading day** — from market open to the cut-off for end-of-day position marking.

| Limit type | Scope | Operative threshold | Breach severity | Escalation |
|---|---|---|---|---|
| **Intraday gross notional** | Per desk | [TBC — Saskia + Helena to calibrate at BRC; placeholder: JSE Equity ≤ R500m; JSE Bond ≤ R1bn; OTC IRD ≤ R5bn notional; FX ≤ R500m equiv.] | `Soft` at 80%; `Hard` at 100% | Soft: desk head informs Saskia. Hard: Saskia informs Helena immediately |
| **Single-counterparty intraday exposure** | All desks | Per-counterparty credit limit set by Helena under the Credit Risk Policy | `Hard` | Immediate halt on incremental exposure; Helena notified |
| **Unhedged warehouse residual** | OTC IRD Desk | DV01 residual per tenor bucket `[TBC — Helena to calibrate]` | `Soft` at 70%; `Hard` at 100% | Soft: desk monitors. Hard: Saskia + Helena; hedge offset required within 2 trading hours |
| **FX intraday net open position** | FX Desk | ExCon Manual limits (Authorised Dealer); RAS §B8a (settlement concentration) | `Hard` | Immediate; Zara notified for ExCon; Helena for market risk |

**Intraday limit breach events.** All limit breaches are emitted as typed `LimitBreach` events with severity, desk, counterparty, and threshold-vs-actual. Atlas (Core banking platform architect) owns the limit-checking infrastructure; Kai (Structured rates trader, markets) owns the real-time position feed.

### 5.3 End-of-day position limits

End-of-day position limits apply to positions carried **overnight** — after the intraday market-making cut-off.

| Desk | Instrument class | End-of-day limit | Rationale |
|---|---|---|---|
| JSE Equity Desk | Net long / short equity position | [TBC — Helena to calibrate at BRC; v1 placeholder: ≤ R200m net long; zero net short absent a hedging mandate] | Client-driven franchise; overnight inventory should be small absent active hedging programme |
| JSE Bond Desk | SAGBs held for market-making (non-HQLA) | [TBC — Helena calibrate; v1 placeholder: ≤ R500m MtM] | HQLA-designated SAGB excluded; trading-book SAGBs overnight |
| JSE Bond Desk | Corporate bonds | [TBC — Helena calibrate; v1 placeholder: ≤ R250m MtM investment-grade only] | Concentration risk; illiquidity of secondary market |
| OTC IRD Desk | Aggregate DV01 (parallel shift) | [TBC — Helena calibrate; v1 placeholder: ≤ ZAR 500k per bp] | Franchise warehouse; ties to client flow run-rate |
| FX Desk | Net open position USD/ZAR | [TBC — Helena calibrate; within ExCon Manual Authorised Dealer limits] | ExCon compliance; overnight FX risk |

`[TBC — numerical values above are v1 placeholders for structure only. Helena will replace with BRC-approved numerical limits in the first Trading Mandate amendment, expected at the next BRC cycle following this mandate's approval.]`

### 5.4 Escalation on breach

The breach escalation taxonomy follows the bank's standard limit-breach framework (Market Risk Policy §Breach; RAS §B9 breach event taxonomy):

| Severity | Definition | Mandatory response | Timeline |
|---|---|---|---|
| `Soft` | Position between 80%–100% of limit | Desk head monitors; no mandatory unwind; informational escalation to Saskia | Within 30 minutes of detection |
| `Hard` | Position at or above 100% of limit | Immediate notification to Helena (CRO); Saskia commences unwind path; no new incremental risk in the breaching dimension | Within 15 minutes of detection; unwind plan filed within 2 hours |
| `Critical` | Position materially above limit; or Hard breach not resolved within 4 trading hours; or proprietary-risk classification by Helena | Immediate BRC notification; CEO notified; consider market operations suspension in the breaching product | Immediate |

All breach events are `LimitBreach` typed events. Helena (CRO, governance) has veto authority to suspend any desk's trading authority pending investigation of a `Critical` breach. Devon (COO, governance) co-approves any suspension affecting operational settlement flows.

---

## 6. FX Settlement Risk Framework

### 6.1 Regulatory basis

This section implements the bank's obligations under **SARB Prudential Authority Guidance Note 5 of 2013 — Foreign Exchange Settlement Risk** (`ORG-PR-48`). GN 5/2013 is confirmed in-force under the PA's G1/2024 catalogue-reset. The framework also reads alongside the **BCBS Supervisory guidance for managing risks associated with the settlement of foreign exchange transactions (February 2013)** `[citation: TBC — precise § references; Imani + external counsel ratify at the licence-application gate]`.

### 6.2 Settlement mechanism — indirect CLS via correspondent

The bank **does not hold direct CLS membership** during the build phase. This is a deliberate operating-model choice per `project_indirect_participant_posture.md` and the `D-FX-CLS-MEMBERSHIP` decision record. The bank accesses the CLS settlement mechanism **indirectly via its named primary correspondent (Standard Bank)**, which is a direct CLS settlement member.

**Implication for Herstatt risk:** Because the bank's USD leg and ZAR leg do not settle simultaneously inside CLS (they settle inside Standard Bank's CLS account and then Standard Bank's internal USD nostro / ZAR account respectively), the bank is exposed to **Herstatt risk** (principal risk on the full notional of each FX trade) from the point the bank instructs the ZAR leg (credit risk on Standard Bank for the USD leg) until both legs are confirmed settled.

### 6.3 Herstatt risk mitigation measures

The following controls mitigate Herstatt risk in the absence of direct CLS membership:

| Control | Description | Owner |
|---|---|---|
| **Same-day confirmation discipline** | All FX trades must be confirmed with counterparty on trade date; no unconfirmed overnight FX positions. Kai (Structured rates trader, markets) owns intraday confirmation SLA | Kai / Tomas (Operations & payments engineer) |
| **Payment-vs-payment netting** | Where Standard Bank offers bilateral PvP netting for USD/ZAR in its correspondent-clearing service, Tomas (Operations) shall elect PvP netting for all same-value-date USD/ZAR settlement flows to reduce principal settlement exposure to the net | Tomas; Standard Bank correspondent agreement |
| **Intraday-exposure cap** | Maximum intraday FX settlement exposure to Standard Bank is capped at the per-counterparty credit limit set by Helena under the Credit Risk Policy (cross-reference to §B8 and §B8a — these are related but distinct limits: §B8 = credit; §B8a = settlement rail concentration) | Helena / Kai |
| **B-cluster RAS §B8a lines** | L-B8a-1 (single-counterparty ≤ 97% steady-state); L-B8a-2 (top-2 ≤ 100% by design); L-B8a-3 (switch-test window override); L-B8a-4 (backup-readiness ≤ 100 days); L-B8a-5 (reserve correspondents active-but-dormant). These five lines detect drift away from the named-pair posture | Helena / Rohan (Risk engineer) / Tomas |
| **Settlement-failure incident protocol** | If Standard Bank reports a settlement failure or delays on a USD/ZAR trade, Tomas immediately escalates to Helena and Devon. Incident is typed as a `FxSettlementFailed` event. Helena and Devon determine whether to suspend FX trading activity pending resolution | Tomas / Devon / Helena |
| **Switch-test cadence** | Tomas (Operations) runs a quarterly live switch-test to FirstRand (RMB) — routing 5–10% of a settlement day's FX flows through the backup correspondent. Switch-test results are filed as `SwitchTestReport` events. Backup-readiness ≤ 100 days (L-B8a-4) | Tomas |

### 6.4 FX-settlement risk reporting

- **Daily:** Tomas produces a daily FX settlement exposure report showing gross principal exposure per correspondent, net exposure after PvP netting, and B-cluster concentration ratios. This report feeds Helena's daily risk-watch.
- **Monthly:** Helena includes FX settlement risk in the BRC pack, referencing B-cluster lines and any breaches.
- **Incident-triggered:** Any `FxSettlementFailed` event triggers an immediate report to Helena and Devon; if material (above a threshold Helena sets), to BRC.

`[citation: TBC — specific PA GN 5/2013 §§ on intraday exposure measurement and reporting obligations; Imani + external counsel ratify at licence-application gate per ORG-PR-48]`

### 6.5 Path to direct CLS membership

Helena and Devon will table an assessment of direct CLS membership — including cost, operational build, and Herstatt-risk reduction — at the pre-licence go-live readiness gate. If direct membership is approved (requiring a separate `D-CLS-DIRECT-MEMBERSHIP` CEO decision), the Herstatt risk mitigation framework at §6.3 will be amended to reflect the reduced risk profile.

**Obligation closed:** `ORG-PR-48` (PA GN 5/2013 — FX settlement risk discipline) is closed by this section, which establishes the policy framework, control set, and reporting cadence. The procedure-layer document (`Procedures/by-policy/fx-settlement-risk.md`) is a follow-on deliverable owned by Saskia + Helena + Tomas.

---

## 7. New Product Gate

### 7.1 Mandatory NPA clearance

No instrument outside the positive-enumeration list in §2 may be booked by any desk **until it has passed the New Product Approval (NPA) process** under the New Product Approval Policy (`D-NEW-PRODUCT-APPROVAL-POLICY`, CEO-approved 2026-05-10).

The NPA gate applies to:
- New instrument types not currently listed in §2;
- New currency pairs on the FX Desk;
- New counterparty types not covered by §3.1;
- New market infrastructure connections (e.g., direct CLS membership, JSE derivative-market membership);
- Material changes to existing instruments (e.g., adding exotic features to listed products).

### 7.2 NPA process reference

The NPA gate is a 14-dimension gate (per the NPA Policy §6) covering:

1. Regulatory and legal review (Imani + Zara)
2. Credit risk assessment (Helena)
3. Market risk assessment (Helena + Kai / Saskia)
4. Operational risk and settlement assessment (Devon + Tomas)
5. Capital impact (Camille [CFO, governance] — RWA delta)
6. Liquidity impact (Eitan)
7. Compliance (Zara + Mira)
8. IFRS classification gate (Camille)
9. Tax analysis (Yael [Tax engineer])
10. Model risk (Helena + Rohan — Tier-classification)
11. Technology and systems (Atlas + Kai)
12. Legal documentation (Imani — ISDA / GMRA / other master agreement)
13. Counterparty eligibility (Zara + Mira)
14. Board / BRC notification (Owen [Company Secretary, governance])

### 7.3 Trading Mandate amendment requirement

Completion of the NPA gate is necessary but not sufficient. For the new instrument to be permissible, this Trading Mandate must also be **formally amended** by:

1. Kai (Structured rates trader, markets) proposing the amendment;
2. Helena (CRO, governance) and Devon (COO, governance) co-signing;
3. Saskia (Head of Global Markets, governance) approving;
4. Board approval (interim: CEO) ratifying.

The amendment is a typed `PolicyAmendment` event citing the NPA gate completion event and the amended product fixture in `prototype/platform/markets/products/fixtures.ts`.

### 7.4 ODP authorisation gate — FMA s.6A

**Citation:** Financial Markets Act 19 of 2012 s.6A + FSCA ODP licensing framework (Board Notice 90 of 2018 framework); register obligation `ORG-FMA-001`.

The OTC IRD Desk (§2.4) and the FX Desk's OTC forward activity (§2.5) constitute OTC derivative *provider* activity under FMA s.6A once conducted as principal with clients. The following gate applies:

1. **No live ODP business before authorisation.** No OTC derivative transaction may be executed as principal with any client or external counterparty until the FSCA has granted the Bank authorisation as an OTC Derivative Provider under FMA s.6A. This is a hard gate alongside the banking licence itself: the §2 positive-enumeration list is *conditionally* enumerated for OTC instruments, with the condition being the ODP authorisation in force.
2. **Build-phase posture.** All build-phase OTC activity is internal rehearsal (simulated counterparties, no external clients) and therefore outside s.6A's scope. The pre-licence go-live readiness gate (Saskia (Head of Global Markets, governance), co-owned with Rashida (Chief Information Security Officer, governance) and Devon (Chief Operating Officer, governance)) includes confirmation that the ODP authorisation application has been lodged and granted before any external OTC dealing commences.
3. **Authorisation conditions maintenance.** Once granted, the authorisation conditions are maintained as register obligations (the `ORG-ODP-AUTH-*` series); any material change to the Bank's ODP business is notified to the FSCA per the authorisation conditions. Zara (Chief Compliance Officer, governance) owns the notification trigger; Owen (Company Secretary, governance) files the correspondence.
4. **Mandate linkage.** Any NPA approval (§7.1) for a new OTC derivative instrument re-checks the ODP authorisation scope: if the new instrument falls outside the granted authorisation categories, the FSCA variation precedes first trade.

---

## 8. Obligations Closed by This Mandate

| Obligation ID | Instrument / authority | Section(s) closing it |
|---|---|---|
| `ORG-PR-19` | BCBS FRTB d457 — measure trading-book market risk per FRTB | §1.1 (authority chain); §4.3 (FRTB boundary); §5.1 (VaR limits framework) |
| `ORG-PR-20` | RAS / Trading Mandate — no proprietary risk-taking outside warehoused franchise hedge positions; trading-book / banking-book boundary | §3.3 (proprietary prohibition); §4.3 (FRTB boundary) |
| `ORG-MK-01` | FMA Ch. X — market-abuse prohibitions; FRTB applicability | §1.1 (FMA citation); §4.3 (FRTB applicability note) |
| `ORG-MK-04` | RAS B5 (deferred) — client-driven and franchise market-making | §3.2 (franchise market-making); §3.3 (proprietary prohibition) |
| `ORG-PR-48` | SARB PA GN 5/2013 — FX settlement risk discipline | §6 (entire FX settlement risk section) |
| `ORG-MK-09` | JSE Equities Rules — trading-member obligations | §2.2 (JSE Equity Desk instrument list); §1.1 (authority chain) |
| `ORG-FMA-001` | FMA 19/2012 s.6A — FSCA ODP authorisation before any live OTC-derivative principal-side activity | §7.4 (ODP authorisation gate) |

---

## 9. Substrate Gaps and Open Items

The following gaps are surfaced for the roadmap — they do not prevent this mandate from taking effect, but they represent work required before commencement-of-trading:

| # | Gap | Owner | Priority |
|---|---|---|---|
| 1 | **Numerical VaR limit calibration (RAS B5 successor).** The [TBC] placeholders in §§5.2–5.3 must be replaced with BRC-approved numerical limits. Helena to table at next BRC following this mandate's approval | Helena (CRO, governance) + Saskia (Head of Global Markets, governance) | Pre-commencement |
| 2 | **FX Settlement Procedure (`Procedures/by-policy/fx-settlement-risk.md`).** The procedure-layer document implementing §6 is planned but not yet authored. Owner: Saskia + Helena + Tomas | Saskia / Helena / Tomas | Pre-commencement |
| 3 | **B-cluster continuous-controls recon harness.** The runtime computation of L-B8a-1 … L-B8a-5 concentration ratios over live `FxSettlementInstructed` events is a Vera Wave-4 backlog item. Until it lands, Helena monitors manually | Rohan (Risk engineer) under Helena | Pre-commencement |
| 4 | **Trading Mandate amendment procedure.** The `PolicyAmendment` event type referenced in §7.3 is not yet in the typed-event catalogue. Atlas to add | Atlas (Core banking platform architect) | Pre-commencement |
| 5 | **Desk head appointments.** At commencement-of-trading, dedicated per-desk heads with FAIS fit-and-proper credentials are required. Currently Saskia covers all desks | Devon (COO, governance) — headcount planning | Licence-day |
| 6 | **CLS direct-membership assessment.** Helena and Devon to table at pre-licence gate as per §6.5 | Helena / Devon | Pre-licence gate |
| 7 | **`ORG-PR-48` citation TBC.** Precise §§ inside PA GN 5/2013 are marked `[citation: TBC]` throughout §6. Imani (Legal-as-code engineer) + external counsel to ratify at licence-application gate | Imani / Zara | Licence-application gate |

---

## 10. Governance and Review

| Item | Detail |
|---|---|
| **Initial approval** | Board (interim: CEO Marc on behalf of CEO + interim NEDs) |
| **Ongoing review cadence** | Annual; or on addition of new desk / product class; or on material change to the bank's franchise or capital structure |
| **Parties to any amendment** | Kai (lead author); Helena (Chief Risk Officer); Devon (Chief Operating Officer); Saskia (Head of Global Markets); Board / CEO ratification |
| **Register** | This mandate is a policy-layer document. Amendments are typed `PolicyAmendment` events per Principle 1 (Events are the only source of truth) |
| **Obligation register update** | On approval, Mira (Compliance / RegTech engineer) updates `ORG-PR-20` and `ORG-MK-04` status from `PARTIAL` to `IN FORCE` in `Regulations/_obligations-register.md`; updates `ORG-PR-19`, `ORG-MK-01`, `ORG-PR-48`, `ORG-MK-09` closure notes |
| **BRC standing item** | This mandate is a standing BRC agenda item for compliance monitoring; position-limit utilisation is reported monthly |

---

*End of Trading Mandate v1.*  
*Authors: Kai (Structured rates trader, markets) · Helena (Chief Risk Officer, governance) · Devon (COO, governance)*  
*Date: 2026-05-11*
