---
title: CEO End-to-End FX-Trade Walkthrough — every function across the bank, every gate, every event
record-id: record:documents:saskia-kai:fx-trade-end-to-end-walkthrough:2026-05-21
author: Saskia (Chief Markets Officer, governance) — primary author
co-author: Kai (Markets engineering lead, engineering) — substrate-state and test-state column
date: 2026-05-21
brief: brief:saskia:ceo-end-to-end-fx-trade-walkthrough-document:2026-05-21
workstream: WS-MARKET-RISK-PROCEDURES
classification: ceo-only
status: FINAL
register-key: documents
retention:
  citationRef: urn:obligation:bank:org:gv:director-decision-retention:v1
  minimumYears: 7
  archivalTier: hot
citations:
  - Policies/trading-mandate-v1.md
  - Policies/market-risk-policy-v1.md
  - Policies/valuation-policy-v1.md
  - Policies/credit-risk-policy-v1.md
  - Policies/liquidity-risk-management-policy-v1.md
  - Policies/stress-testing-policy-v1.md
  - Policies/model-risk-policy-v1.md
  - Policies/insider-trading-pa-dealing-policy-v1.md
  - Policies/excon-compliance-policy-v1.md
  - Procedures/markets/pre-licence-go-live-gate.md
  - Procedures/markets/pre-trade-conduct-gate.md
  - Procedures/markets/dealer-mandate-issuance.md
  - Procedures/markets/dealer-mandate-breach-handling.md
  - Procedures/markets/fx-forwards-trade-lifecycle.md
  - Procedures/by-policy/npa-gate.md
  - Procedures/by-policy/counterparty-onboarding-markets.md
  - Procedures/by-policy/market-risk-limit-monitoring.md
  - Procedures/by-policy/market-risk-monitoring.md
  - Procedures/by-policy/credit-risk-limit-management.md
  - Procedures/finance/fx-settlement-reconciliation.md
  - Procedures/finance/fx-period-close-runbook.md
  - Procedures/operations/settlement-failure-bcp.md
  - Procedures/operations/sarb-fixing-as-fx-spot-ipv-source.md
  - record:documents:helena:fx-spot-only-market-risk-scope-review:2026-05-20
  - record:documents:helena:controlled-launch-mr1-fx-limit-proposal:2026-05-20
  - record:documents:imani:g9-isda-vs-bilateral-fx-master-for-spot:2026-05-20
  - record:documents:rashida:finsurv-excon-assessment-for-fx-spot-internal-pre-licence-test:2026-05-20
  - prototype/scenarios/fx-spot-internal-pre-licence-test.ts
  - D-MARKETS-SCHEMA-FOUNDATION
  - D-CREDIT-LIMIT-ENGINE-BUILD
  - D-FX-CLS-MEMBERSHIP
  - D-FX-AD-STATUS
  - D-FX-BOOK-BOUNDARY
  - D-EVENT-VIEW-BOUNDARY-WIRE
  - D-RMS-PHASE-3
  - WS-MARKET-RISK-PROCEDURES
  - pr:#631
  - pr:#632
  - pr:#633
  - pr:#634
  - pr:#635
  - pr:#636
  - pr:#637
  - pr:#638
  - pr:#639
  - pr:#640
  - pr:#641
  - pr:#642
  - pr:#643
  - pr:#644
  - pr:#645
  - pr:#646
---

# CEO End-to-End FX-Trade Walkthrough

**Primary author:** Saskia (Chief Markets Officer, governance)
**Co-author (substrate-state and test-state columns):** Kai (Markets engineering lead, engineering)
**Date:** 2026-05-21
**Brief:** `brief:saskia:ceo-end-to-end-fx-trade-walkthrough-document:2026-05-21`
**Workstream:** WS-MARKET-RISK-PROCEDURES
**Classification:** CEO-only

**Supervisory test:** This document is the CEO's authoritative reference for FX-spot readiness ahead of the pre-licence go-live gate. It must be defensible to Marc (CEO) asking: "if a counterparty called us today asking for a USD/ZAR spot quote, what would we do, in what order, against which policies, with which controls, on which code, and what would the audit trail look like the next morning?"

---

## 1. Executive summary

### 1.1 What an FX trade *is* in our context

The product in scope of this document is **deliverable FX spot, USD/ZAR, principal-to-principal, institutional counterparty only, settlement T+2 via SWIFT correspondent**. There is one currency pair (USD/ZAR), one settlement rail (Standard Bank as primary correspondent, FirstRand as backup; both indirect-CLS), one set of permitted counterparties at controlled-launch (Standard Bank Corporate Treasury and Investec Bank Treasury per Helena's controlled-launch proposal). FX options, FX forwards, FX swaps, and NDFs are **out of scope at v1** even though FX forwards and swaps sit inside `Policies/trading-mandate-v1.md §2.5`'s positive-enumeration list — Helena (Chief Risk Officer, governance) has scoped the brief to spot only (`record:documents:helena:fx-spot-only-market-risk-scope-review:2026-05-20`).

The bank acts as **dealer**, not as a broker. Every spot trade we book is a principal trade against our balance sheet. The Trading Mandate (`Policies/trading-mandate-v1.md §3.3`) prohibits proprietary risk-taking; every position must carry a client-flow or franchise-hedge attribution, enforced by the no-prop attribution invariant on `FxTradeExecuted` (Atlas (Core banking platform architect, engineering) PR #633 — `clientFlowRef` XOR `hedgeProgrammeRef`).

### 1.2 The five life stages of a trade

1. **Stage A — Pre-trade existence.** Everything that must be true *before* the desk even thinks about quoting: the product is NPA-approved, the desk has a trading mandate, the dealer has a dealer mandate, the counterparty is onboarded with KYC + ISDA + credit limit + netting set, risk limits are calibrated and BRC-approved, the market-data feed is alive, the legal documentation is signed, the FinSurv ExCon regulatory authority is in place.
2. **Stage B — Pre-trade controls (every quote).** The five blocking checks of PROC-MK-PCG-01: counterparty mandate + credit-limit headroom, dealer mandate, sanctions screen, counterparty capacity, best-execution record. Plus the no-prop attribution XOR on the trade record itself.
3. **Stage C — Execution.** The `FxTradeExecuted` event is the moment the trade exists (Principle 1: events are truth). Manual booking via `dashboard/public/trade-book.html` at controlled-launch; an RFQ/quote layer in production.
4. **Stage D — Post-trade immediate (T0).** IFRS posting rules fire (Bea (Accounting and financial reporting engineer, engineering) PR-FX-PRIN family — debit nostro suspense, credit payable, memo postings); settlement instructions go to the correspondent (`FxSettlementInstructed`); SA-CCR runs and emits `CcrReplacementCostComputed` + `CcrEadComputed` for the T+2 exposure window; credit-limit utilisation ticks up.
5. **Stages E–H — EOD, settlement window, settlement itself, and post-settlement.** EOD revaluation (`FxPositionRevalued`) against the SARB fixing; daily P&L; IPV sign-off; MR-1-FX VaR utilisation check; intraday counterparty exposure monitoring through the T+2 window; settlement either happy-path (both legs deliver → `FxSettlementConfirmed`) or one of three failure paths (Herstatt-active, mutual-fail, operational-delay) classified by `SettlementFailureClassified`; and finally GL projection, BA-325 / BA-700 / BA-125 returns, and audit-trail completeness.

### 1.3 Headline substrate state

We catalogue ~30 functions across Stages A–H. Of those (and counting more precisely in the §4 matrix):

- **LIVE** — code on `main`, exercised by the scenario, recon-asserted: ~13 functions.
- **LIVE-INTERNAL-VARIANT** — code on `main` but running the build-phase fixture variant (SARB fixing from JSON seed, simulated correspondent feed, no real ExCon authority): ~6 functions.
- **NOT-CALIBRATED** — code present but parameters not BRC-approved: ~3 functions (the MR-1-FX limit framework is BRC-tabling-pending; the per-counterparty caps similarly).
- **NOT-WIRED** — code present but no end-to-end glue: ~3 functions (PR-FX-005 invoked as pure function but not wired through `bea-gl-posting-engine`; BA-325 LCR period-close subscriber).
- **PLANNED** — design exists, no code: ~3 functions (production RFQ layer, the conduct-gate envelope as planned `@platform/markets/conduct-gate`, the B-cluster recon harness).
- **GAP** — should exist, doesn't: ~2 functions (`ModelFallbackUsed` and `MarketDataStaleAlert` event types; production FX quote feed).

### 1.4 Headline testing state

Kai's scenario at `prototype/scenarios/fx-spot-internal-pre-licence-test.ts` (merged in PR #645) is the substrate proof. It runs five phases:

- **Phase 1 — Bootstrap.** SARB fixings (29 days seeded) + party register + credit limits + ISDA/CSA assessment + credit-limit-no-trade-without-loaded recon green.
- **Phase 2 — Happy-path.** Buy USD 500k vs ZAR with Standard Bank ZA; trade → settlement instructions × 2 → EOD revaluation → SA-CCR compute-and-emit (RC + EAD with α=1.4, T+2 maturity-factor) → confirmation. Five recon gates green; one advisory recon noted.
- **Phase 3 — Herstatt-active failure.** One-leg-delivered with Investec → `MissedExpectedReceipt` + `FxSettlementFailed` + `SettlementFailureClassified{herstatt-active}` → PR-FX-005 (Bea PR #641) produces 4-leg Stage-3 ECL postings at 100% of expected receive-leg ZAR equivalent (IFRS 9 §5.5.13).
- **Phase 4 — Mutual fail (neither-delivered).** Classification = `mutual-fail`; PR-FX-005 produces zero GL postings (FVTPL out of ECL scope; Bea SicrTriggered follow-on event flow is a known gap).
- **Phase 5 — Operational delay.** Classification = `operational-delay`; zero GL postings; no default event recognised; manual escalation per PROC-OPS-SFBCP-01.

The scenario returns **READY-FOR-CONTROLLED-LAUNCH**. The non-trivial gaps that prevent full live operation are enumerated in §6 below.

### 1.5 The single-sentence answer

If a counterparty called us **today** asking for a USD/ZAR spot quote: we would politely decline, because (a) we have no banking licence (Banks Act 94 s.11), (b) we have no Authorised Dealer designation under the Currency and Exchanges Act, (c) Helena's MR-1-FX limit framework has not been tabled at the BRC, (d) the ISDA Master Agreements with the two whitelisted counterparties have not been executed, (e) the production FX quote feed is not live, (f) the FRTB SA engine has not been independently validated by Nadia for the FX-spot product, and (g) we have no real capital. We can, however, run a synthetic FX-spot trade end-to-end through the production substrate and the substrate behaves correctly — that is what Kai's PR #645 scenario asserts and what the rest of this document describes.

---

## 2. The complete life of an FX trade — function by function

### Stage A — Pre-trade existence

#### 2.A.1 — Product registration and NPA approval

**What it does:** A new product (FX-spot USD/ZAR) goes through the 14-dimension New Product Approval gate before it appears in the trading mandate's positive-enumeration list. The NPA gate covers: product economics; risk profile; capital impact; valuation / pricing; legal-documentation requirements; regulatory-legal scope (Rashida + Imani + Zara); operations and settlement; accounting / IFRS classification; tax; conduct / suitability; data / reporting; technology / system readiness; HR / sign-off authority; and post-implementation review. The terminal event is `NewProductApproved` (planned; see substrate-state).

**Why we do it:** Banks Act 94 Reg 39 (product approval bound), Policies/trading-mandate-v1.md §7 (New Product Gate), `Procedures/by-policy/npa-gate.md` (PROC-NPA-GATE-01). Closes obligation `ORG-MK-04`.

**Who does it:** Saskia (Chief Markets Officer, governance) as product-owner; Helena (CRO) for risk-side dimensions; Zara (Chief Compliance Officer, governance) for conduct and AML/CFT dimensions; Rashida (Chief Information Security Officer, governance) for the cybersecurity / JS-2 dimension; Imani (Chief Legal Counsel, governance) for legal documentation; Camille (Chief Financial Officer, governance) for accounting / IFRS; Bea (engineering) for posting-rule readiness; Kai (engineering) for system capability.

**System capability:** `@platform/governance/npa-gate` (PLANNED). Events: `NewProductRegistered`, `NewProductApproved` (planned); decision record at `D-MARKETS-SCHEMA-FOUNDATION` (CEO-approved) for the inaugural FX-spot product entry into the trading mandate.

**Substrate state:** **LIVE-INTERNAL-VARIANT.** The procedural framework is POPULATED (`Procedures/by-policy/npa-gate.md`). The substantive "FX-spot product entry into the trading mandate" was carried by `D-MARKETS-SCHEMA-FOUNDATION` rather than by a distinct typed `NewProductApproved` event — the build-phase substrate did not yet emit the typed event when the foundational product set was approved. A typed envelope is queued for the next compliance-substrate slice.

**Test state:** Not directly tested in scenario PR #645. The scenario assumes the product is in the mandate (the trade-construction helpers in the scenario reference `productTaxonomy: "FX-spot"` directly).

**Citations:** `Procedures/by-policy/npa-gate.md`; `Policies/trading-mandate-v1.md §2.5, §7`; `D-MARKETS-SCHEMA-FOUNDATION`.

---

#### 2.A.2 — Trading mandate

**What it does:** The Trading Mandate v1 (`Policies/trading-mandate-v1.md`) is the policy-level positive enumeration of every instrument the bank may hold. §2.5 lists FX-spot USD/ZAR. The mandate also covers the trading-book / banking-book boundary (§4.3), the client-driven mandate principle (§3 — no proprietary risk), the FX settlement-risk framework (§6 — Herstatt controls, B-cluster RAS lines L-B8a-1 through L-B8a-5), and the position-limit framework (§5, where MR-1-FX numerical values are `[TBC — Helena to calibrate at BRC]` and are now supplied by Helena's controlled-launch proposal PR #634).

**Why we do it:** Banks Act 94 Reg 39 (trading mandate must be formalised); BCBS FRTB d457 §3.2 (trading-book / banking-book boundary); SARB PA Guidance Note 5/2013 (FX settlement-risk discipline); FAIS Act GCC §4 (conduct and suitability). Closes obligations `ORG-PR-19, ORG-PR-20, ORG-MK-01, ORG-MK-04, ORG-PR-48, ORG-MK-09`.

**Who does it:** Saskia owns; Helena co-authors §5 (limit framework) and §6 (FX settlement-risk framework); Devon (Chief Operating Officer, governance) co-authors operational sections. Approved by Board (interim: Marc on behalf of CEO + interim NEDs).

**System capability:** Policy-only artefact; no direct system capability. Downstream system capabilities cite it.

**Substrate state:** **LIVE.** Policy is `IN FORCE` (effective-from 2026-05-11). The MR-1-FX numerical value is `NOT-CALIBRATED` until BRC tabling.

**Test state:** Not tested directly; tested by inference via every downstream procedure citation.

**Citations:** `Policies/trading-mandate-v1.md`; `D-POLICY-DOCUMENT-HOME`; BCBS d457; Banks Act 94 Reg 39.

---

#### 2.A.3 — Dealer mandate issuance

**What it does:** Every dealer who books on DESK-FX must hold an explicit dealer mandate covering FX-spot, with defined single-trade notional limits, portfolio notional limits, settlement-tenor scope, and sign-off authority. PROC-MK-MDI-01 codifies the issuance flow. Helena's scope review §5 item 3 flags that the procedure's Step 3 (VaR contribution + DV01 per tenor bucket) is partly OTC-IRD-specific; FX-spot mandate calibration uses VaR contribution + notional limits only.

**Why we do it:** Banks Act 94 Reg 39 (operational risk management — trading authority); FMCA s.6 + JSE Rules (only mandated dealers may trade). Closes obligation `ORG-MK-10`.

**Who does it:** Saskia issues the dealer mandate; Helena co-signs the limit-calibration section; the dealer (Kai for the controlled-launch period — markets engineering lead acting as dealer of record) acknowledges.

**System capability:** `@platform/markets/mandate-registry` (PLANNED). Events: `DealerMandateIssued`, `DealerMandateAcknowledged`, `DealerMandateAmended`, `DealerMandateRevoked`. Breach handling at PROC-MK-MBH-01.

**Substrate state:** **PLANNED.** Procedure is POPULATED. The mandate-registry projection and the events are planned; no `DealerMandateIssued` event has been emitted to date because no dealer has been issued. At controlled-launch a single dealer mandate is needed.

**Test state:** Not tested in scenario PR #645. The scenario's trade actor is `agent:kai:markets-engineering-lead`; the registry lookup is not exercised because Step 2 of PROC-MK-PCG-01 (Dealer mandate check) is planned-not-live.

**Citations:** `Procedures/markets/dealer-mandate-issuance.md` (PROC-MK-MDI-01); `Procedures/markets/dealer-mandate-breach-handling.md` (PROC-MK-MBH-01); `Policies/trading-mandate-v1.md §4.1`.

---

#### 2.A.4 — Counterparty onboarding

**What it does:** The seven-gate counterparty-onboarding procedure (PROC-MK-CO-01) covers KYC/CDD (Gate 1), master-agreement execution (Gate 2 — ISDA 2002 + SA Schedule per Imani's G-9 close), counterparty FAIS categorisation (Gate 3), credit limit assignment (Gate 4 — Helena via the credit-limit engine), settlement-instructions exchange (Gate 5), legal-entity validation against the Party register (Gate 6), and JS-2/2020 margin documentation (Gate 7 — not required for FX-spot-only). The terminal event is `CounterpartyEnabled`.

**Why we do it:** FICA s.21–22 (KYC + ongoing monitoring); ISDA 2002 + Bowmans 2024-04-15 SA netting opinion (for close-out netting enforceability under §6 of the ISDA Master); FAIS GCC §4 (counterparty capacity); `Policies/credit-risk-policy-v1.md §3` (netting-set enrolment). Imani's G-9 close (PR #637) confirms ISDA + SA Schedule is the default for FX-spot-only counterparties; bilateral FX Master Agreement only by exception with Imani sign-off; none-listed only by joint Helena + Saskia + Imani `Decision(approved)`.

**Who does it:** Onboarding owned by Saskia at the markets level; Niko (Client lifecycle agent — currently paused per `Team/_team-roster.json` `buildPhaseStatus`) would own at licence-day; Yael (Treasurer & Tax, engineering+governance) currently emits the credit limits and ISDA assessments per PR #642; Imani signs off Gate 2 on legal-documentation; Helena signs off Gate 4 on credit limit.

**System capability:** `@platform/markets/counterparty-registry` (PLANNED for the seven-gate flow); `@platform/markets/netting-sets/enforceability.ts` (LIVE — Imani enforceability lookup); Party register at `Regulations/_party-register.md` (LIVE Phase 3). Events: `CounterpartyEnabled` (planned), `LegalDocumentationSigned` (planned), `ISDACSAAssessmentCompleted` (LIVE — Yael PR #642), `PartyRegistered` (LIVE — Saskia PR #639 added Standard Bank ZA + Investec Bank Treasury rows).

**Substrate state:** **LIVE-INTERNAL-VARIANT.** Party register live and populated (PR #639). `ISDACSAAssessmentCompleted` events emitted for both counterparties with `nettingEnforceable: true`, `csaPresent: false`, `isdaStatus: "executed"` (Yael PR #642). The full seven-gate procedure is POPULATED; only the events that downstream substrate consumes (party row + credit limit + ISDA assessment) are emitted in the build phase. ISDA Master Agreements have **not** been executed with the real counterparties — they would be before any live trade.

**Test state:** Asserted in scenario PR #645 Phase 1 — Party register backfill asserts `Standard Bank ZA registered` and `Investec Bank ZA registered`; seed asserts `ISDA/CSA assessment completed for both counterparties` with `nettingEnforceable === true && isdaStatus === "executed"`.

**Citations:** `Procedures/by-policy/counterparty-onboarding-markets.md` (PROC-MK-CO-01); `record:documents:imani:g9-isda-vs-bilateral-fx-master-for-spot:2026-05-20` (PR #637); `Policies/credit-risk-policy-v1.md §3 line 132`; PR #639, #642; FICA s.21–22.

---

#### 2.A.5 — Credit-limit loading

**What it does:** Per-counterparty credit limits (USD 500k daily gross notional cap per Helena's controlled-launch §1.3) are loaded into `@platform/risk/credit-limit-engine` as `CreditLimitLoaded` events before the first trade. The engine maintains a running utilisation per counterparty and exposes `checkHeadroom(counterpartyId, proposedExposure)` for the pre-trade conduct gate.

**Why we do it:** Banks Act 94 Reg 39 (counterparty credit-limit framework); BCBS d106 / d342 (LEX cap — single-counterparty exposure ≤ 25% of Tier 1 capital); `Policies/credit-risk-policy-v1.md §1.4` (per-counterparty cap); `Procedures/by-policy/credit-risk-limit-management.md` (PROC-RISK-CLM-01). `recon:credit-limit-no-trade-without-loaded` is a hard gate — a trade booked against an un-loaded counterparty triggers a Vera violation.

**Who does it:** Helena recommends; Yael emits the events (per PR #642 the controlled-launch seeds wire both counterparties); the credit-limit engine consumes.

**System capability:** `@platform/risk/credit-limit-engine` (LIVE — D-CREDIT-LIMIT-ENGINE-BUILD Phase 4 complete). Events: `CreditLimitLoaded`, `CreditLimitAmended`, `CreditLimitExpired`, `CreditUtilisationTicked`. Recon: `recon:credit-limit-no-trade-without-loaded`; `recon:lex-cap-utilisation`.

**Substrate state:** **LIVE.** Engine is on `main`; both controlled-launch counterparties wired with USD 500k caps in Yael's seed (PR #642).

**Test state:** Asserted in scenario PR #645 Phase 1 — `Credit limits loaded for both counterparties` (count=2); each `CreditLimitLoaded[counterparty]` asserted `limit === USD 500k` and `currency === "USD"`. `recon:credit-limit-no-trade-without-loaded` and `recon:lex-cap-utilisation` asserted green pre-trade and post-trade.

**Citations:** PR #642; D-CREDIT-LIMIT-ENGINE-BUILD; `Policies/credit-risk-policy-v1.md §1.4`; `Procedures/by-policy/credit-risk-limit-management.md`.

---

#### 2.A.6 — Netting-set enrolment

**What it does:** Each counterparty's USD-denominated netting set is registered with `ISDACSAAssessmentCompleted{ csaPresent: false, nettingEnforceable: true, isdaStatus: "executed", jurisdictionOpinionRef: "<Bowmans 2024-04-15>", currency: "USD" }`. The SA-CCR engine reads `nettingEnforceable` to select the netting-aggregated vs trade-by-trade replacement-cost path, and reads `csaPresent` to select the margined vs unmargined RC branch (`prototype/platform/risk/sa-ccr/replacement-cost.ts`).

**Why we do it:** BCBS SA-CCR (d317); `Policies/credit-risk-policy-v1.md §3 lines 129, 132, 136`; Imani's G-9 close (PR #637) — ISDA executed but no CSA → unmargined RC, netting-enforceable.

**Who does it:** Imani determines `nettingEnforceable` from the published ISDA SA netting opinion; Yael emits the assessment event (PR #642); the SA-CCR engine consumes.

**System capability:** `@platform/markets/netting-sets/types.ts` + `enforceability.ts` (LIVE). Events: `ISDACSAAssessmentCompleted` (LIVE), `JurisdictionalOpinionRefreshed` (PLANNED — Imani G-9 §5 gap 1; Atlas to define).

**Substrate state:** **LIVE-INTERNAL-VARIANT.** Both counterparties enrolled; the `jurisdictionOpinionRef` field carries a string identifier (per Imani G-9 §5 gap 3 the underlying Bowmans opinion document is not yet content-addressed in the RMS document store).

**Test state:** Asserted in scenario PR #645 Phase 1 — `ISDA/CSA assessment completed for both counterparties` (count=2); each asserted `nettingEnforceable === true && isdaStatus === "executed"`.

**Citations:** PR #637, #642; `record:documents:imani:g9-isda-vs-bilateral-fx-master-for-spot:2026-05-20`; `Policies/credit-risk-policy-v1.md §3`; BCBS d317.

---

#### 2.A.7 — Risk limits calibration (MR-1-FX framework)

**What it does:** Helena's controlled-launch MR-1-FX limit framework (PR #634, `record:documents:helena:controlled-launch-mr1-fx-limit-proposal:2026-05-20`) sets the binding pre-trade risk limits: MR-1-FX 1-day 99% VaR = **ZAR 350,000**; EOD open USD/ZAR net position = **USD 1,000,000**; intraday peak = **USD 1,500,000**; per-counterparty daily gross notional cap = **USD 500,000**; counterparty whitelist = 2 names; pair set = USD/ZAR only. Calibration is parametric (volatility-scaled at SARB-fixing 0.85% 1-day stdev, z=2.326, ZAR ceiling = USD 1m × 18.50 = ZAR 18.5m, parametric VaR = ZAR 365,824 rounded down to ZAR 350k). Tightening factor vs eventual `live` is 14× – 27×.

**Why we do it:** `Policies/market-risk-policy-v1.md §3 (MR-1-FX)`; `Policies/trading-mandate-v1.md §5.1, §5.2, §5.3`; BCBS d457 (FRTB SA); the controlled-launch NPA gate requires per-limit BRC sign-off before first trade.

**Who does it:** Helena recommends; Rohan (Market risk quantitative engineer, engineering) verifies the volatility input and runs the SA engine; Marc (CEO) on behalf of the BRC (interim, per `D-THIN-HUMAN-LAYER-MINIMUM`) approves.

**System capability:** `@platform/risk/market-risk-engine` (PLANNED for FRTB SA; LIVE for the events `MarketRiskMeasureComputed`, `MarketRiskLimitBreached`). The parametric VaR calibration is currently a spreadsheet calculation per Helena's compensating control §2.2.

**Substrate state:** **NOT-CALIBRATED.** Helena's proposal is FINAL and filed; **BRC tabling has not yet occurred**. Until BRC approval the limit values are not operationally binding — this is the single most-load-bearing CEO decision queued (§7 below).

**Test state:** Not tested in scenario PR #645 (the scenario uses notionals at the per-counterparty cap, USD 500k, which sits inside the proposed limit envelope, but does not exercise the limit-breach paths). Helena's compensating-control attestation block §2.2 prescribes dual-track capital computation (engine vs manual SA-SBM-delta spreadsheet) with daily cross-check at < 5% divergence threshold.

**Citations:** PR #634; `record:documents:helena:controlled-launch-mr1-fx-limit-proposal:2026-05-20`; `Policies/trading-mandate-v1.md §5`; `Policies/market-risk-policy-v1.md §3`; BCBS d457.

---

#### 2.A.8 — Market data sourcing (SARB fixing as IPV source)

**What it does:** The bank's operative production-grade FX-spot rate source during the build phase is the **SARB daily fixing**, ingested via Atlas's `sarb-fixing-ingester` (PR #643). The ingester emits `OfficialMarkAdopted{ source: "SARB", policyVersionRef: "VALUATION-POLICY-V1:v1.0", … }` per business day and writes price ticks into the dedicated `MarketDataStore` (separate from the event store; reference data is not a domain event per the M8 substrate refactor). Helena performs daily IPV sign-off (compensating control G-1 per Helena's §2.1). The full source hierarchy at `Policies/valuation-policy-v1.md §3.1` (Bloomberg BFIX > SARB > model fallback) activates at licence-day.

**Why we do it:** `Policies/valuation-policy-v1.md §3.1` (FX spot rate source hierarchy); `Policies/valuation-policy-v1.md §4` (production-only provenance gate — non-waivable); §5 (staleness thresholds: 15min intraday, 1 business day EOD); IAS 21 (closing rate for revaluation); IFRS 9 (FVTPL measurement). Atlas's `OfficialMarkAdopted` event type (PR #629/#632) is the typed mark-adoption envelope per `D-EVENT-VIEW-BOUNDARY-WIRE`.

**Who does it:** Atlas owns the ingester; Devon (COO) signs off market-data provenance; Helena signs off IPV daily; Rohan consumes for MTM and VaR.

**System capability:** `prototype/platform/market-data/sarb-fixing-ingester.ts` (LIVE); `prototype/platform/market-data/store.ts` (LIVE); `prototype/platform/recon/market-data-provenance-gate.ts` (LIVE). Events: `OfficialMarkAdopted` (LIVE).

**Substrate state:** **LIVE-INTERNAL-VARIANT.** Ingester runs from fixture (`seeds/sarb-fixing-rates.json`) at the moment; the real-time SARB website pull is a Devon + Atlas substrate item. The SARB fixing must be tagged `provenance: "production"` in the `MarketDataStore` per Helena's compensating-control attestation §2.1 (G-1) — that tagging is in place per the ingester's envelope output.

**Test state:** Asserted in scenario PR #645 Phase 1 — `SARB fixings emitted (Atlas PR #643)` with `totalEvents >= 25` (29 days of fixings seeded). `recon:market-data-provenance-gate` asserted green in Phase 2 (Atlas PR #643 SARB fixture envelope).

**Citations:** PR #629, #632, #643; `Policies/valuation-policy-v1.md §3.1, §4, §5`; `Procedures/operations/sarb-fixing-as-fx-spot-ipv-source.md`; `D-EVENT-VIEW-BOUNDARY-WIRE`.

---

#### 2.A.9 — Legal documentation

**What it does:** ISDA 2002 Master Agreement + South African Schedule is signed with each whitelisted counterparty (per Imani G-9). The Bowmans 2024-04-15 SA netting opinion is held on file as the basis for `nettingEnforceable: true`. No CSA at controlled-launch (FX-spot has no continuing post-settlement MTM; G-9 §1.1 confirms). Annual ISDA opinion refresh discipline planned via `JurisdictionalOpinionRefreshed` event (Imani G-9 §5 gap 1).

**Why we do it:** ISDA 2002 §6 (close-out netting); Bowmans 2024-04-15 SA netting opinion; Insolvency Act 24 of 1936 set-off carve-outs; FMA s.35 (designated settlement system safe harbour); `Policies/credit-risk-policy-v1.md §3`; Imani G-9 PR #637.

**Who does it:** Imani drafts/negotiates the Schedule; Saskia signs as authorised signatory; counterparty's legal team signs counterpart.

**System capability:** `@platform/markets/legal-documentation` (PLANNED). Events: `LegalDocumentationSigned{ agreementType: "isda" | "csa" | "gmra" | "gmra-sa-annex" | "fx-bilateral" }` (PLANNED; the `fx-bilateral` enum addition is the Atlas G-9 §5 gap 2).

**Substrate state:** **PLANNED.** ISDA Masters with the two whitelisted counterparties have not yet been executed (this is a hard gate before any live trade). The build-phase substrate operates on the *assumption* of execution (the `ISDACSAAssessmentCompleted{ isdaStatus: "executed" }` event in PR #642 is a stub for the synthetic test).

**Test state:** Not tested as a real event-emission in PR #645 (the scenario asserts the downstream `ISDACSAAssessmentCompleted` only).

**Citations:** PR #637; `record:documents:imani:g9-isda-vs-bilateral-fx-master-for-spot:2026-05-20`; ISDA 2002; Bowmans 2024-04-15 SA netting opinion; Insolvency Act 24 of 1936.

---

#### 2.A.10 — Regulatory authority (FinSurv ExCon)

**What it does:** Rashida's FinSurv ExCon assessment (`record:documents:rashida:finsurv-excon-assessment-for-fx-spot-internal-pre-licence-test:2026-05-20`; PR #644) is the regulatory-scope ruling for the **internal pre-licence test**: synthetic FX-spot activity is **outside** Exchange Control Regulation 2(1) and 3(1) because (a) no real ZAR or USD moves, (b) no SWIFT MT300 leaves the bank's perimeter, (c) no counterparty enters into a binding undertaking on the strength of a synthetic trade. The ruling is conditional on five test-substrate properties (Rashida §1.4); breach of any property flips the activity into ExCon scope. At commencement-of-trading the bank must hold Authorised Dealer (AD) designation from SARB FinSurv (Currency and Exchanges Act 9 of 1933 s.9), which is a **separate regulatory act** from the Banks Act licence and is in practice sequenced concurrently with the Banks Act application.

**Why we do it:** Currency and Exchanges Act 9 of 1933 s.9; Exchange Control Regulations 1961 Reg 2(1) (AD dealing authority), Reg 3(1) (export of currency etc.), Reg 19 (information furnishing); Currency and Exchanges Manual for Authorised Dealers (SARB FinSurv); `Policies/excon-compliance-policy-v1.md`. Status taxonomy: **COMMENCEMENT-BIND** for AD obligations.

**Who does it (correctly attributed for this walkthrough):** Compliance ownership of FinSurv / ExCon sits with **Zara (Chief Compliance Officer, governance)**, per `Team/_team-roster.json` and `Policies/excon-compliance-policy-v1.md §1`. Rashida (Chief Information Security Officer, governance) authored the 2026-05-20 ExCon assessment under her CCO seat as recorded in the prior artefact; the persona-vs-policy attribution discrepancy is noted in Rashida §2.6 of that assessment and was corrected in PR #646 (Owen). For this walkthrough, future ExCon work is correctly routed to Zara; Rashida co-attests the cyber-resilience / JS-2 dimensions where they intersect with FinSurv reporting infrastructure. Owen (Company Secretary, governance) co-tracks regulatory-chain sequencing.

**System capability:** No code substrate yet. AD-designation programme governance lives in `Policies/excon-compliance-policy-v1.md`. BoP-code mapping engine is a planned Bea + Mira (Compliance / RegTech engineer) build.

**Substrate state:** **LIVE-INTERNAL-VARIANT for the build-phase ruling** (Rashida assessment filed; scenario explicitly within scope of the "outside ExCon" ruling). **PLANNED** for the AD-designation application and the FinSurv per-trade reporting pipeline (these activate post-licence).

**Test state:** The scenario at PR #645 operates inside the assessment's scope by construction — synthetic activity, no real ZAR/USD movement, no SWIFT MT300 leaves the bank, no counterparty entered into anything. The five test-substrate-property attestations of Rashida §1.4 are not asserted by a recon pipeline yet (substrate gap — Rashida §5 of the assessment).

**Citations:** PR #644; `record:documents:rashida:finsurv-excon-assessment-for-fx-spot-internal-pre-licence-test:2026-05-20`; `Policies/excon-compliance-policy-v1.md`; Currency and Exchanges Act 9 of 1933 s.9; Exchange Control Regulations 1961.

---

### Stage B — Pre-trade controls (every quote/booking attempt)

#### 2.B.1 — Pre-trade conduct gate

**What it does:** PROC-MK-PCG-01 is the five-check blocking gate at the moment a dealer initiates a trade: (1) counterparty mandate + credit-limit headroom + ISDA in place; (2) dealer mandate; (3) real-time sanctions screening (≤24h freshness); (4) counterparty capacity confirmation; (5) best-execution record pre-check. The terminal events are `ConductGatePassed` (planned envelope) or — currently emitted in the runtime ahead of the conduct-gate envelope — `GatewayCheckCompleted{ outcome: "reject", blockReason: … }`.

**Why we do it:** FAIS Act GCC §3(1)(a) (best interests), §4 (capacity/mandate/appropriateness); FMA s.6 + CS 3/2018 (ODP conduct); FICA s.22 (ongoing monitoring at execution); TCF Outcome 4 (suitability).

**Who does it:** `agent` per-trade; reviews on block by Mira (Compliance / RegTech engineer); sanctions hits by Zara (CCO, MLRO); ISDA/mandate issues by Saskia + Imani.

**System capability:** `@platform/markets/conduct-gate` (PLANNED for the typed envelope); `@platform/risk/credit-limit-engine` (LIVE — Check 1 sub-call); `@platform/compliance/sanctions-screen` (PLANNED — Check 3); `@platform/markets/best-execution` (PLANNED — Check 5).

**Substrate state:** **NOT-WIRED.** Check 1's credit-limit sub-call (`checkHeadroom`) is LIVE; the conduct-gate envelope wrapping the five checks is PLANNED. The runtime currently emits the canonical `GatewayCheckCompleted` per Check 1 (per PROC-MK-PCG-01 Step 1's "canonical, today" note).

**Test state:** Tested only on Check 1 — `recon:credit-limit-no-trade-without-loaded` asserted green in scenario PR #645 Phase 1 and Phase 2. Checks 2–5 are not exercised by the scenario.

**Citations:** `Procedures/markets/pre-trade-conduct-gate.md` (PROC-MK-PCG-01); FAIS Act GCC §3(1)(a), §4; FMA s.6; FICA s.22; D-CREDIT-LIMIT-ENGINE-BUILD.

---

#### 2.B.2 — Credit-limit headroom check

**What it does:** Inline call to `checkHeadroom(counterpartyId, proposedExposure)` from `@platform/risk/credit-limit-engine`. Returns `ok: false` with typed `blockReason ∈ { "CounterpartyNotApproved", "CreditLimitExhausted", "LimitExpired", "AnnualReviewStale" }`. Hard block on `false`; the recon `recon:credit-limit-no-trade-without-loaded` post-facto asserts no trade was booked against an un-loaded counterparty.

**Why we do it:** Banks Act 94 Reg 39; BCBS LEX cap (d342); `Policies/credit-risk-policy-v1.md §1.4`; PROC-RISK-CLM-01.

**Who does it:** Engine is the actor; Helena owns calibration.

**System capability:** `prototype/platform/risk/credit-limit-engine` (LIVE — D-CREDIT-LIMIT-ENGINE-BUILD Phase 4). Recon: `recon:credit-limit-no-trade-without-loaded`; `recon:lex-cap-utilisation`.

**Substrate state:** **LIVE.**

**Test state:** Asserted in scenario PR #645 Phase 1 (pre-trade green) and Phase 2 (post-trade green).

**Citations:** D-CREDIT-LIMIT-ENGINE-BUILD; `Procedures/by-policy/credit-risk-limit-management.md`; `Policies/credit-risk-policy-v1.md §1.4`.

---

#### 2.B.3 — Dealer-mandate authorisation

**What it does:** Step 2 of PROC-MK-PCG-01. The dealer must hold an active acknowledged mandate; FX-spot must be in scope; proposed notional must be within single-trade and portfolio limits; settlement date must be within tenor mandate. On failure: `ConductGateBlocked{ reason: "DealerMandateInsufficient" | "NotionalLimitBreached" | "TenorLimitBreached" }` (planned envelope).

**Why we do it:** `Policies/trading-mandate-v1.md §4.1`; PROC-MK-MDI-01 + PROC-MK-MBH-01; Banks Act 94 Reg 39.

**Who does it:** Engine; Saskia adjudicates breach.

**System capability:** `@platform/markets/mandate-registry` (PLANNED).

**Substrate state:** **PLANNED.**

**Test state:** Not tested in scenario PR #645.

**Citations:** `Procedures/markets/dealer-mandate-issuance.md`; `Procedures/markets/dealer-mandate-breach-handling.md`.

---

#### 2.B.4 — No-prop attribution invariant

**What it does:** Atlas's PR #633 added a schema-level XOR invariant to `FxTradeExecuted`: every trade event must carry exactly one of `clientFlowRef` or `hedgeProgrammeRef`. The MR-5 daily no-prop sweep (PROC-RISK-MRL-01 §5.4) reads these fields to attribute every FX-spot position to a client flow or a named franchise hedge programme; a position with neither is a Hard Breach.

**Why we do it:** `Policies/market-risk-policy-v1.md §1 (No-prop principle MR-5)`, §3 (MR-5 daily sweep); `Policies/trading-mandate-v1.md §3.3` (prohibition on proprietary risk-taking).

**Who does it:** Schema enforces at event-emission; MR-5 sweep run daily by Rohan + Helena.

**System capability:** FxTradeExecuted schema with XOR invariant (LIVE — Atlas PR #633). MR-5 daily sweep: `recon:no-prop-attribution` (PLANNED — explicitly out of scope per scenario PR #645 substrate-gaps; placeholder for a future Vera Wave-4 pipeline).

**Substrate state:** **LIVE for schema invariant; PLANNED for the MR-5 sweep.**

**Test state:** Asserted in scenario PR #645 Phase 2 — `FxTradeExecuted carries clientFlowRef (Atlas PR #633 — no-prop XOR satisfied)` with `clientFlowRef === "test:internal-pre-licence:trade-001"` and `hedgeProgrammeRef === undefined`. The MR-5 sweep is not exercised.

**Citations:** PR #633; `Policies/market-risk-policy-v1.md §1, §3 MR-5`; `Procedures/by-policy/market-risk-limit-monitoring.md §5.4`.

---

### Stage C — Trade execution

#### 2.C.1 — Quote / RFQ

**What it does:** At controlled-launch, trade origination is manual via `dashboard/public/trade-book.html` — a dealer at the markets desk enters a trade against a counterparty after voice/email RFQ negotiation. In steady-state a production RFQ layer (planned) accepts inbound RFQs, prices off the live FX feed (planned production source), routes through the pre-trade conduct gate, and emits the trade event.

**Why we do it:** `Policies/trading-mandate-v1.md §3` (client-driven mandate); FAIS GCC §4 (capacity/mandate); best-execution obligations.

**Who does it:** Dealer (Kai in the controlled-launch period; future markets dealers as the franchise scales); Saskia oversees.

**System capability:** Manual booking UI: `dashboard/public/trade-book.html` (LIVE). RFQ engine: `@platform/markets/rfq` (PLANNED).

**Substrate state:** **LIVE-INTERNAL-VARIANT** for manual booking; **PLANNED** for the RFQ engine.

**Test state:** Tested via the manual booking UI in seed run only at the moment; the scenario uses programmatic construction of `FxTradeExecuted` (via `buildFxSpotTrade` in scenario PR #645 lines 271–323).

**Citations:** `Policies/trading-mandate-v1.md §3`; `dashboard/public/trade-book.html`; FAIS GCC §4.

---

#### 2.C.2 — `FxTradeExecuted` event emission

**What it does:** The single moment the trade exists in the bank (Principle 1). The event carries: `tradeId`, `productTaxonomy: "FX-spot"`, `currencyPair: { base: "USD", quote: "ZAR" }`, `side: "buy" | "sell"`, near-leg structure (pay/receive currencies, notionals, rate, settlement date), trade date, counterparty (Party register URN), venue, trader, bookId, bookType, settlementForm, settlementPath, `finsurvCategory`, and the XOR-invariant `clientFlowRef` or `hedgeProgrammeRef`.

**Why we do it:** Principle 1 (events are truth — the trade is the event, not the booking screen output). `Policies/trading-mandate-v1.md §4.3` (trading-book assignment). FRTB d457 §3 (trade-record requirements). FinSurv per-trade reporting requires per-trade categorisation captured at execution.

**Who does it:** Dealer initiates; runtime emits the event after the conduct gate clears.

**System capability:** `prototype/platform/markets/cdm/fx.ts` — `makeFxTradeExecuted` (LIVE). Schema enforces required fields and the no-prop XOR.

**Substrate state:** **LIVE.**

**Test state:** Asserted in scenario PR #645 Phase 2 — `FxTradeExecuted ${event_id}` appended; payload assertions on `clientFlowRef`, `hedgeProgrammeRef`, `currencyPair`, `side`, `legs`, `counterparty`, `bookId`, `bookType`.

**Citations:** PR #633; Principle 1; BCBS d457 §3.

---

#### 2.C.3 — Trade-record cross-checks

**What it does:** Three structural cross-checks at the moment the trade event is appended: counterparty must resolve in the Party register; instrument must be in the trading-mandate product perimeter; notional must be within the dealer's single-trade limit and within the per-counterparty daily cap (USD 500k at controlled-launch).

**Why we do it:** Party register integrity (Phase 3 of RMS); positive-enumeration mandate; PROC-MK-PCG-01 Check 1 + Check 2 (above).

**Who does it:** Schema + recon. Party register lookup is structural (Party register URN `urn:party:legal-entity:standard-bank-za` etc.).

**System capability:** Party register (LIVE Phase 3); `recon:counterparty-exposure-coverage` (LIVE).

**Substrate state:** **LIVE.**

**Test state:** Asserted in scenario PR #645 Phase 2 — `recon:counterparty-exposure-coverage passes`.

**Citations:** Party register at `Regulations/_party-register.md`; PR #639 (party-register rows for Standard Bank ZA + Investec ZA).

---

### Stage D — Post-trade immediate (T0)

#### 2.D.1 — IFRS posting rules fire

**What it does:** Bea's PR-FX-PRIN family of IFRS posting rules (the four happy-path memo postings) fires on `FxTradeExecuted`. For a BUY USD vs ZAR trade: a memo debit to nostro suspense, a memo credit to ZAR payable, sets up the T+2 settlement posting. The full GL ledger projection from posting rules is `NOT-WIRED` end-to-end — `bea-gl-posting-engine` consumes posting-rule outputs but the integration with `FxTradeExecuted` is a separate substrate slice.

**Why we do it:** IFRS 9 (FVTPL classification for trading-book FX-spot); IAS 21 (functional currency = ZAR; foreign-currency monetary items revalued at closing rate); SARB BA-100 reporting requires consistent ledger projection.

**Who does it:** Bea (engineering) owns posting rules and the GL projection; Camille (CFO, governance) signs off accounting classification.

**System capability:** `prototype/platform/accounting/posting-rules/fx-spot.ts` — `fxSettlementFailedJournals` and the PR-FX-PRIN family (LIVE as pure functions). `prototype/platform/accounting/bea-gl-posting-engine` (NOT-WIRED for FX-spot end-to-end).

**Substrate state:** **NOT-WIRED.** Posting rules exist and are unit-tested; the engine-to-event subscriber wiring is the next substrate slice.

**Test state:** Unit-tested only in `prototype/platform/accounting/posting-rules/fx-spot.test.ts`. The scenario at PR #645 evaluates `fxSettlementFailedJournals` as a pure function (Phase 3 lines 924–999) but does **not** exercise the subscriber-to-engine path. Listed as gap in scenario PR #645's `substrateGaps` summary.

**Citations:** Bea PR #641 (PR-FX-005); IFRS 9; IAS 21; project memory `project_continuation_2026_05_20_fx_posting_rules`.

---

#### 2.D.2 — Settlement instruction emission

**What it does:** Per leg of the trade, an `FxSettlementInstructed` event is emitted with `settlementId`, `settlementPath: "correspondent"`, `correspondent: { partyId: "urn:party:legal-entity:correspondent-bank-za" }`, `messageStandard: "SWIFT-MT202"`, `netCash: { currency, amountMinor }` (positive = bank receives; negative = bank pays), and `settlementDate`. The correspondent feed subscriber (Tomas PR #640) consumes these instructions and produces correspondent acknowledgements.

**Why we do it:** Banks Act 94 Reg 39 (settlement instructions framework); SARB PA GN 5/2013 (FX settlement risk discipline); `Policies/trading-mandate-v1.md §6` (Herstatt controls).

**Who does it:** Tomas (Correspondent banking & payments engineer, engineering) owns the settlement subscriber; runtime emits the instruction at trade-event-time.

**System capability:** `prototype/platform/markets/cdm/fx.ts` — `makeFxSettlementInstructed` (LIVE). `prototype/platform/markets/settlement/fx-settlement-subscriber.ts` (LIVE — Tomas PR #640; simulated-feed variant for build phase).

**Substrate state:** **LIVE-INTERNAL-VARIANT.** Simulated correspondent feed (`makeStaticCorrespondentFeed`) replaces the real correspondent's SWIFT MT300/MT900 in the build phase.

**Test state:** Asserted in scenario PR #645 Phase 2 — two `FxSettlementInstructed` events appended (USD leg + ZAR leg).

**Citations:** PR #640; `Policies/trading-mandate-v1.md §6`; SARB PA GN 5/2013; BCBS d226.

---

#### 2.D.3 — SA-CCR / capital recompute

**What it does:** The SA-CCR engine reads the netting set (from `ISDACSAAssessmentCompleted` per A.6), computes replacement cost (`RC = max(V, 0)` for unmargined; `RC = max(V − C, MTA + TH, 0)` for margined), computes potential future exposure (using the FX product maturity factor for the T+2 window; BCBS d317 §164 MF), applies α = 1.4, and emits `CcrReplacementCostComputed` + `CcrEadComputed`. For FX-spot the exposure is small (2-day window) but non-zero.

**Why we do it:** BCBS SA-CCR (d317); `Policies/market-risk-policy-v1.md §5 (CVA-SA)`; `Policies/credit-risk-policy-v1.md §3`. The MR-3-CSR-cva limit line monitors this output.

**Who does it:** Rohan owns the engine; runtime calls `computeAndEmitFor` on every trade.

**System capability:** `prototype/platform/risk/sa-ccr/replacement-cost.ts` (LIVE); `prototype/platform/risk/sa-ccr/index.ts` — `computeAndEmitFor` (LIVE).

**Substrate state:** **LIVE.** Production-validated for FX-spot only as of PR #635 (T+2 maturity-factor regression test — Rohan); Nadia (Independent-validation engineer) production-validation for FX-spot is a Pre-go-live gate item (G-2 in Helena's scope review §6).

**Test state:** Asserted in scenario PR #645 Phase 2 — `SA-CCR computeAndEmitFor resolved a netting set and emitted RC + EAD (Rohan PR #635 / Yael PR #642)`; `CcrReplacementCostComputed emitted` (count >= 1); `CcrEadComputed emitted` (count >= 1).

**Citations:** PR #635; PR #642; BCBS d317; `Policies/credit-risk-policy-v1.md §3`; `Policies/market-risk-policy-v1.md §5`.

---

#### 2.D.4 — Credit-limit utilisation tick

**What it does:** After trade execution, the credit-limit engine increments the counterparty's running utilisation by the proposed exposure. The next trade against the same counterparty hits this updated utilisation in its `checkHeadroom` call. LEX-cap monitoring runs continuously.

**Why we do it:** BCBS d342 (LEX cap); `Policies/credit-risk-policy-v1.md §1.4`; PROC-RISK-CLM-01.

**Who does it:** Engine; Helena monitors aggregate.

**System capability:** `prototype/platform/risk/credit-limit-engine` (LIVE); `recon:lex-cap-utilisation` (LIVE).

**Substrate state:** **LIVE.**

**Test state:** Asserted in scenario PR #645 Phase 2 — `recon:lex-cap-utilisation passes (utilisation below Amber)`.

**Citations:** D-CREDIT-LIMIT-ENGINE-BUILD; `Policies/credit-risk-policy-v1.md §1.4`; PROC-RISK-CLM-01.

---

### Stage E — End-of-day (T0 close)

#### 2.E.1 — EOD FX revaluation

**What it does:** `runEodFxRevaluation(eventStore, valuationDate)` runs at EOD; for every open FX-spot position, an `FxPositionRevalued` event is emitted citing the SARB fixing for the valuation date. The Slice B.1 advisory recon `recon:position-revalued-cites-mark` window-matches the revaluation event to the most-recent `OfficialMarkAdopted` event (D-EVENT-VIEW-BOUNDARY-WIRE Slice B.1).

**Why we do it:** IAS 21 closing-rate revaluation; IFRS 9 FVTPL daily measurement; `Policies/valuation-policy-v1.md §6` (EOD MTM run mandatory every business day); `Policies/market-risk-policy-v1.md §6.2` (daily reporting).

**Who does it:** Rohan / Helena via the EOD job; Bea consumes for P&L.

**System capability:** `prototype/platform/markets/eod/fx-revaluation.ts` — `runEodFxRevaluation` (LIVE). `recon:position-revalued-cites-mark` (LIVE-ADVISORY at Slice B.1; schema-typed gating is Slice D, pending decision).

**Substrate state:** **LIVE.**

**Test state:** Asserted in scenario PR #645 Phase 2 — `EOD revaluation emitted ≥1 FxPositionRevalued event`; `recon:position-revalued-cites-mark advisory ok` (advisory at Slice B.1; the `officialMarkRef` schema-typed gating is the next slice).

**Citations:** PR #632; `D-EVENT-VIEW-BOUNDARY-WIRE`; IAS 21; `Policies/valuation-policy-v1.md §6`.

---

#### 2.E.2 — Daily P&L

**What it does:** `runDailyPnLReport` aggregates the daily P&L impact of every trade booked, every position revaluation, and every closed settlement. The report is part of the daily MR pack closeout per Helena's compensating-control attestation §2.1.

**Why we do it:** IFRS 9 FVTPL daily P&L recognition; `Policies/market-risk-policy-v1.md §6.2`; `Procedures/finance/fx-period-close-runbook.md` (PROC-FIN-FXPC-01).

**Who does it:** Bea owns the GL projection; Helena signs off MR pack; Camille signs off accounting.

**System capability:** `@platform/accounting/daily-pnl` (NOT-WIRED for FX-spot end-to-end). The report depends on a GL trial balance assembled by `bea-gl-posting-engine`, which is a downstream slice not yet integrated.

**Substrate state:** **NOT-WIRED.**

**Test state:** Not invoked in scenario PR #645 — explicitly listed as a gap in the scenario's `substrateGaps` summary ("the report depends on a GL trial balance assembled by bea-gl-posting-engine, which is a downstream slice").

**Citations:** PROC-FIN-FXPC-01; IFRS 9; `Policies/market-risk-policy-v1.md §6.2`.

---

#### 2.E.3 — Independent price verification (IPV)

**What it does:** Helena (or delegated risk-officer alternate per `Procedures/by-policy/market-risk-monitoring.md`) verifies the bank's book rate against the SARB daily fixing each EOD. Material deviation is a risk event. This is the G-1 compensating control per Helena's attestation §2.1 — until a production real-time FX feed lands, the SARB daily fixing is the operative production source and Helena's daily sign-off is the control.

**Why we do it:** `Policies/valuation-policy-v1.md §7` (Level 2 IPV daily); BCBS Sound Practices for Backtesting; Helena G-1 compensating control attestation.

**Who does it:** Helena daily; Rohan provides the engine output.

**System capability:** Manual sign-off; daily MR pack template. No automated typed event yet for the IPV outcome (planned).

**Substrate state:** **LIVE-INTERNAL-VARIANT** (manual sign-off as G-1 compensating control until production FX feed lands).

**Test state:** Not directly tested in scenario PR #645; the underlying mechanism — `OfficialMarkAdopted` from SARB fixing + `FxPositionRevalued` citing that mark — is asserted in Phase 1 (29 fixings emitted) and Phase 2 (advisory recon `position-revalued-cites-mark`).

**Citations:** Helena's controlled-launch §2.1 (G-1); `Policies/valuation-policy-v1.md §7`; `Procedures/by-policy/market-risk-monitoring.md`.

---

#### 2.E.4 — Market risk limit check

**What it does:** Daily VaR / ES / sensitivity computation per `Procedures/by-policy/market-risk-monitoring.md` (PROC-RISK-MRM-01 Steps 1–12). Compare against MR-1-FX (ZAR 350k VaR), MR-2 (ES), MR-3-FX (delta sensitivity), MR-6 (stress loss ceiling). Amber Alert at 80%; Hard Breach at 100% per `Policies/market-risk-policy-v1.md §1.4` breach taxonomy. Helena performs the dual-track manual SA-SBM-delta cross-check per G-2 compensating control (engine-vs-manual divergence > 5% triggers investigation; > 15% triggers MRC escalation).

**Why we do it:** `Policies/market-risk-policy-v1.md §3, §6.2`; BCBS d457; the MR-1-FX cap is the binding limit.

**Who does it:** Rohan runs the engine; Helena reviews and signs the daily MR pack.

**System capability:** `@platform/risk/market-risk-engine` (LIVE for events `MarketRiskMeasureComputed`, `MarketRiskLimitBreached`; FRTB SA engine not production-validated for FX-spot per G-2). Recon: `recon:market-risk-limit-monitoring` (PLANNED).

**Substrate state:** **NOT-CALIBRATED.** Engine present but MR-1-FX value not BRC-approved; Helena's dual-track manual computation is the compensating control.

**Test state:** Not exercised by scenario PR #645 (the scenario does not invoke the market-risk engine — by design, MR-1-FX calibration is a CEO-decision queued item).

**Citations:** PR #634; `Policies/market-risk-policy-v1.md §1, §3`; `Procedures/by-policy/market-risk-limit-monitoring.md`; BCBS d457.

---

#### 2.E.5 — BA-325 LCR period close

**What it does:** Monthly BA-325 (FRTB SA capital) submission to SARB PA. The period-close subscriber consumes a `PeriodClosed` envelope (D-EVENT-VIEW-BOUNDARY-WIRE Slice C / PR #632) and emits the regulatory cell values. BA-325 carries the FX-spot SBM-delta capital component.

**Why we do it:** Banks Act 94 + Regulations Relating to Banks (Form BA 325); `Policies/market-risk-policy-v1.md §6.2`; BCBS d457.

**Who does it:** Bea owns the regulatory-cell projection; Camille signs off BA-325 submission; Helena signs off the underlying risk-engine output.

**System capability:** `@platform/reporting/ba-325` (LIVE for SARB structured submission infrastructure; period-close-aware FX-spot integration NOT-WIRED).

**Substrate state:** **NOT-WIRED.** PeriodClosed event landed (PR #632) but the BA-325 subscriber requires a `PeriodClosed` envelope on a controlled-launch clock, which is outside the rehearsal scope.

**Test state:** Not invoked in scenario PR #645 — explicitly listed as a substrate gap in the scenario's summary ("the BA-325 subscriber requires a PeriodClosed envelope (Slice A.1) which is outside this rehearsal's clock-tick scope").

**Citations:** PR #632; `D-EVENT-VIEW-BOUNDARY-WIRE`; BA 325 form; Banks Act Regulations Relating to Banks.

---

### Stage F — Between T0 and T+2 (settlement window)

#### 2.F.1 — Counterparty exposure monitoring (intraday)

**What it does:** During the T+2 settlement window, the SA-CCR exposure to the counterparty is live; intraday counterparty-exposure-coverage recon asserts that every counterparty with an open settlement instruction has a corresponding netting-set enrolment and credit-limit row.

**Why we do it:** `Policies/credit-risk-policy-v1.md §1.4`; PROC-RISK-CLM-01.

**Who does it:** Recon at every projection refresh; Helena monitors.

**System capability:** `prototype/platform/recon/counterparty-exposure-coverage.ts` (LIVE).

**Substrate state:** **LIVE.**

**Test state:** Asserted in scenario PR #645 Phase 2 — `recon:counterparty-exposure-coverage passes`.

**Citations:** `Policies/credit-risk-policy-v1.md §1.4`; PROC-RISK-CLM-01.

---

#### 2.F.2 — Settlement-rail concentration check (B-cluster)

**What it does:** The B-cluster RAS lines L-B8a-1 through L-B8a-5 govern settlement-rail concentration at Standard Bank (primary correspondent) and FirstRand (backup). At controlled-launch concentration is 100% Standard Bank by design. Helena monitors manually per her G-5 compensating control §2.3; the planned automation is the Vera Wave-4 B-cluster recon harness over live `FxSettlementInstructed` events.

**Why we do it:** `Policies/trading-mandate-v1.md §6.3` (Herstatt risk mitigation; B-cluster lines L-B8a-1 to L-B8a-5); SARB PA GN 5/2013.

**Who does it:** Tomas produces the daily settlement-exposure summary; Helena signs off at SOB each business day; Vera Wave-4 backlog item.

**System capability:** `@platform/recon/b-cluster-settlement-exposure` (PLANNED — Vera Wave-4 backlog).

**Substrate state:** **PLANNED** (manual compensating control LIVE per G-5).

**Test state:** Not tested in scenario PR #645 (the simulated correspondent feed bypasses the B-cluster aggregation step; manual sign-off is the operative control).

**Citations:** PR #634 §2.3; `Policies/trading-mandate-v1.md §6.3`; SARB PA GN 5/2013.

---

#### 2.F.3 — Stress-test inclusion

**What it does:** Open FX-spot positions are included in the daily stress-test run. Per `Policies/stress-testing-policy-v1.md` and Helena's scope review §3.2, the operative stress scenarios for an FX-spot-only book are (i) ZAR devaluation FX rate shock, (ii) idiosyncratic correspondent-bank stress (Standard Bank default — the dominant Herstatt-exposure stress), (iii) USD liquidity stress (LCR/NSFR feed). Rate-shift, credit-spread-widening, and equity-crash scenarios produce negligible FX-spot output and are dormant.

**Why we do it:** `Policies/stress-testing-policy-v1.md §3.1, §3.2`; PROC-RISK-ST-01; ICAAP integration `§3.3`; ILAAP integration `§3.4`.

**Who does it:** Helena owns the stress framework; Rohan runs the engine.

**System capability:** `@platform/risk/stress-testing` (LIVE for base/adverse/severely-adverse/reverse bundle per Helena's stress scenarios).

**Substrate state:** **LIVE.**

**Test state:** Not exercised by scenario PR #645 directly; the stress framework is asserted by Helena's stress test cycle and the daily MR pack.

**Citations:** `Policies/stress-testing-policy-v1.md`; `Procedures/by-policy/stress-test-cycle.md` (PROC-RISK-ST-01).

---

### Stage G — Settlement (T+2)

#### 2.G.1 — Correspondent feed consumption

**What it does:** Tomas's `runFxSettlementSubscriber` (PR #640) consumes correspondent messages (in production: SWIFT MT900/MT940 + correspondent MT202 ack; in build-phase: `makeStaticCorrespondentFeed`'s `CorrespondentMessage` typed envelopes). Each message carries `tradeRef`, `settlementInstructionRef`, `valueDate`, `cutoffAt`, `toleranceMinutes`, `observedAt`, `legStatus: { payLegDelivered, receiveLegDelivered }`, `currencyPair`, `legKind`, and optionally `inFlight`. The subscriber produces one of four outcomes: `confirmed` (both legs delivered), `one-leg-delivered` (Herstatt-active), `neither-delivered` (mutual fail), or `operational-delay` (in-flight past cutoff).

**Why we do it:** BCBS d226 (FX settlement risk); Banks Act 94 Reg 39; `Policies/trading-mandate-v1.md §6.2 (settlement reconciliation)`.

**Who does it:** Tomas owns; Helena consumes for settlement-risk monitoring.

**System capability:** `prototype/platform/markets/settlement/fx-settlement-subscriber.ts` (LIVE — PR #640).

**Substrate state:** **LIVE-INTERNAL-VARIANT** — simulated feed in the build phase; the real correspondent's SWIFT integration is a Tomas substrate slice for licence-day.

**Test state:** Asserted in scenario PR #645 across Phases 2, 3, 4, 5 — happy-path, Herstatt-active, mutual-fail, operational-delay all exercised through this subscriber.

**Citations:** PR #636 (PROC-OPS-SFBCP-01 scaffold), PR #638 (settlement-events schema completeness), PR #640 (subscriber); BCBS d226; project memory `project_indirect_participant_posture`.

---

#### 2.G.2 — Happy path — both legs delivered

**What it does:** Subscriber receives a correspondent message with `legStatus: { payLegDelivered: true, receiveLegDelivered: true }`; emits `FxSettlementConfirmed`. Bea's happy-path posting rules (PR-FX-002 / PR-FX-004 from the prior FX posting-rules sprint) fire to close out the memo postings into final GL movements.

**Why we do it:** Trade closure; release of credit-limit utilisation; settlement-risk window closes.

**Who does it:** Subscriber; Bea's GL projection; Tomas signs off operational reconciliation.

**System capability:** `fx-settlement-subscriber` (LIVE); `posting-rules/fx-spot` PR-FX-002/004 (LIVE as pure functions).

**Substrate state:** **LIVE.**

**Test state:** Asserted in scenario PR #645 Phase 2 — `FxSettlementSubscriber confirmed happy-path (PR #640)` with outcome kind = `confirmed`; `FxSettlementConfirmed emitted` (count === 1).

**Citations:** PR #640; project memory `project_continuation_2026_05_20_fx_posting_rules`.

---

#### 2.G.3 — Failure path — Herstatt-active (one-leg-delivered)

**What it does:** The bank's pay leg delivered; the counterparty's receive leg did not. Subscriber emits three events: `MissedExpectedReceipt`, `FxSettlementFailed{ failureKind: "one-leg-delivered" }`, `SettlementFailureClassified{ classification: "herstatt-active" }`. Bea's PR-FX-005 (PR #641) fires the four-leg Stage-3 ECL posting: Dr Settlement-Failed Receivable [USD] / Cr FX Trading Receivable [USD] (derecognise FVTPL); Dr Credit Loss Expense — FX Settlement / Cr ECL Allowance — Settlement-Failed (100% Stage-3 per IFRS 9 §5.5.13).

**Why we do it:** IFRS 9 §5.5.13 (100% ECL on default recognition); `Policies/credit-risk-policy-v1.md §IFRS-9 ECL`; BCBS d226 Herstatt risk recognition; `Procedures/operations/settlement-failure-bcp.md` (PROC-OPS-SFBCP-01).

**Who does it:** Subscriber emits failure events; PR-FX-005 produces journals; Bea owns posting rules; Tomas + Helena + Saskia escalate per PROC-OPS-SFBCP-01.

**System capability:** `fx-settlement-subscriber` (LIVE); `posting-rules/fx-spot.ts` — `fxSettlementFailedJournals` (LIVE pure function); `bea-gl-posting-engine` wiring (NOT-WIRED).

**Substrate state:** **LIVE for event emission and classification; LIVE for posting-rule pure-function; NOT-WIRED for end-to-end GL projection.**

**Test state:** Asserted in scenario PR #645 Phase 3 — `Outcome kind = one-leg-delivered`; `MissedExpectedReceipt emitted` (count === 1); `FxSettlementFailed emitted` (count === 1); `SettlementFailureClassified emitted` (count === 1) with `classification === "herstatt-active"`; PR-FX-005 produces 4 journal legs; Stage-3 ECL = 100% of expected receive-leg ZAR equivalent (IFRS 9 §5.5.13).

**Citations:** PR #636, #638, #640, #641; IFRS 9 §5.5.13; BCBS d226; PROC-OPS-SFBCP-01.

---

#### 2.G.4 — Failure path — mutual-fail (neither-delivered)

**What it does:** Neither leg delivered (failureReason: "Neither leg delivered at cutoff; mutual fail"; `inFlight: false`). Subscriber emits `FxSettlementFailed{ failureKind: "neither-delivered" }` and `SettlementFailureClassified{ classification: "mutual-fail" }`. PR-FX-005 — neither-delivered branch — produces **zero GL postings** (FVTPL out of ECL scope; the trade was already FVTPL, no derecognition triggers ECL). Bea's SicrTriggered follow-on for FVTPL Stage-2 SICR signal is a known gap and would be the next event in this chain.

**Why we do it:** IFRS 9 (FVTPL out of ECL scope for both legs un-delivered); `Policies/credit-risk-policy-v1.md`; PROC-OPS-SFBCP-01.

**Who does it:** Subscriber; PR-FX-005 evaluates to zero journals.

**System capability:** `fx-settlement-subscriber` (LIVE); `posting-rules/fx-spot.ts` — `fxSettlementFailedJournals` (LIVE).

**Substrate state:** **LIVE.** SicrTriggered Bea follow-on is GAP.

**Test state:** Asserted in scenario PR #645 Phase 4 — `Outcome kind = neither-delivered`; `FxSettlementFailed{neither-delivered} emitted`; `PR-FX-005 — neither-delivered branch produces zero GL postings (FVTPL out of ECL scope)` (journals.length === 0); `Classification = mutual-fail`.

**Citations:** PR #641; IFRS 9; PROC-OPS-SFBCP-01.

---

#### 2.G.5 — Failure path — operational-delay

**What it does:** Settlement late but not failed (`inFlight: true`, `legStatus: { payLegDelivered: false, receiveLegDelivered: false }`). Subscriber emits `FxSettlementFailed{ failureKind: "operational-delay" }` and `SettlementFailureClassified{ classification: "operational-delay" }`. **No default recognition.** Manual escalation per PROC-OPS-SFBCP-01 (Tomas + Saskia + Helena triage). PR-FX-005 operational-delay branch produces zero GL postings.

**Why we do it:** IFRS 9 (operational delay is not a default event); PROC-OPS-SFBCP-01; BCBS d226.

**Who does it:** Tomas owns the operational triage; Saskia + Helena consulted; Marc escalated on material delay.

**System capability:** `fx-settlement-subscriber` (LIVE); `posting-rules/fx-spot.ts` (LIVE).

**Substrate state:** **LIVE.**

**Test state:** Asserted in scenario PR #645 Phase 5 — `Outcome kind = operational-delay`; `FxSettlementFailed{operational-delay} emitted`; `PR-FX-005 — operational-delay branch produces zero GL postings (no default event)`; `Classification = operational-delay`.

**Citations:** PR #636, #641; PROC-OPS-SFBCP-01; IFRS 9.

---

### Stage H — Post-settlement (T+2 onwards)

#### 2.H.1 — GL ledger projection

**What it does:** All posting-rule outputs from Stages D, E, G project into the GL ledger. End-to-end projection from `FxTradeExecuted` → memo postings → `FxSettlementConfirmed` → final postings → GL trial balance → daily P&L → BA-100 / BA-325 returns is the integrated chain. **GAP**: this chain is not asserted end-to-end yet — Kai surfaced this in PR #645's `substrateGaps` summary. `bea-gl-posting-engine` subscriber wiring to FX-spot posting-rule events is the next substrate slice.

**Why we do it:** Principle 1 (events to projection); IFRS 9 / IAS 21 GL consistency.

**Who does it:** Bea owns the engine; Camille signs off the trial balance.

**System capability:** `prototype/platform/accounting/bea-gl-posting-engine` (NOT-WIRED for FX-spot end-to-end).

**Substrate state:** **NOT-WIRED.**

**Test state:** Not asserted end-to-end in scenario PR #645. Listed as gap.

**Citations:** Scenario PR #645 substrate-gaps summary; project memory `project_continuation_2026_05_20_fx_posting_rules`.

---

#### 2.H.2 — Returns generation

**What it does:** Monthly and ad-hoc regulatory returns. For FX-spot specifically: **BA-125** (gross effective open foreign currency position; monthly to SARB PA per Banks Act Regulations Relating to Banks); **BA-325** (FRTB SA capital; monthly to SARB PA); **BA-700** (market risk; monthly per market-risk policy §6.2); **BA-200** (capital adequacy; monthly). FinSurv per-trade flow reporting (separate from BA-125 position reporting; per-trade to SARB FinSurv with BoP category codes per `Policies/excon-compliance-policy-v1.md`).

**Why we do it:** Banks Act 94 + Regulations Relating to Banks; Currency and Exchanges Act 9 of 1933 s.9 + AD Manual.

**Who does it:** Bea owns regulatory-cell projection; Camille signs off; Helena signs off market-risk side; Zara signs off FinSurv side (NB: Zara, not Rashida — see identity discipline note in 2.A.10).

**System capability:** `@platform/reporting/ba-325` (LIVE); `@platform/reporting/ba-125` (PLANNED — Camille / Rohan substrate); `@platform/reporting/ba-700` (PLANNED); `@platform/reporting/finsurv` (PLANNED — Bea + Mira substrate; BoP-code library curation).

**Substrate state:** Mixed. **NOT-WIRED for FX-spot end-to-end across BA-125, BA-325, BA-700**; FinSurv pipeline is **PLANNED**.

**Test state:** Not exercised by scenario PR #645 (period-close clock is outside scenario scope).

**Citations:** Rashida ExCon assessment §2.2, §2.3, §2.5; BCBS d457; Banks Act Regulations Relating to Banks.

---

#### 2.H.3 — Audit-trail completeness

**What it does:** Every event in the chain carries (i) typed citations upward to policy and regulation (Principle 2); (ii) a provenance envelope with `sourceLineage` (the run / batch / agent that emitted it); (iii) a content-addressed record-hash for any RecordFiled deliverable (RMS Phase 3). Vera (Internal audit engineer, governance) runs independent verification recon pipelines over the full chain.

**Why we do it:** Principle 1 (events are truth); Principle 2 (single graph, atomic citation); D-RMS-PHASE-1/2/3 (records substrate); third-line independence.

**Who does it:** Vera independent recon; Thandiwe (CAE, governance) functional reporting line.

**System capability:** Citation gate (`bun run citation-gate`); provenance envelopes throughout the platform; RMS document store (`@platform/records`).

**Substrate state:** **LIVE.**

**Test state:** Asserted in scenario PR #645 across all five recons; citation gate is a CI gate on every PR.

**Citations:** Principle 1, Principle 2; D-RMS-PHASE-1; D-RMS-PHASE-3.

---

#### 2.H.4 — Decision events

**What it does:** Any escalation that crosses an authority threshold becomes a typed `Decision(approved|recommended|escalated)` event in the canonical chain. For FX-spot: a Hard Breach on MR-1-FX would escalate to BRC; a Herstatt-active settlement failure crosses into the Market Risk Committee and the CEO under PROC-OPS-SFBCP-01; lifting controlled-launch to `live` is a BRC decision.

**Why we do it:** D-DECISIONS-FRAMEWORK-REDESIGN; Principle 6 (autonomous-by-default, residual to humans); CEO + governance-seat authority routing per CLAUDE.md "Decision authority routing" table.

**Who does it:** Per category. Authority routing: market-risk calibration → CRO (Helena) with BRC tabling; settlement-failure → COO (Devon) with CEO escalation if reportable; ExCon scope → CCO (Zara); strategic crossing RAS thresholds → CEO.

**System capability:** `@platform/decisions` (LIVE); `recordDecision` from `runtime/decisions/record.ts` (LIVE).

**Substrate state:** **LIVE.**

**Test state:** Not exercised by the success path of scenario PR #645 (no decisions queued).

**Citations:** D-DECISIONS-FRAMEWORK-REDESIGN; CLAUDE.md "Decision authority routing" table; Principle 6.

---

## 3. Cross-cutting controls

### 3.1 Model risk

**Tier 1 — FRTB SA engine (regulatory capital).** Validated end-to-end by Nadia (Independent-validation engineer, peer-in-second-line under Helena). For FX-spot, the FX product → FX risk class mapping (SBM delta) requires production validation per Helena §6 G-2 of scope review; Helena's dual-track manual SA-SBM-delta computation is the compensating control until Nadia signs off. **Substrate state: NOT-CALIBRATED for FX-spot** (engine exists per PROC-RISK-FRTB-SA-01; production validation pending Nadia).

**Tier 2 — FX-spot IPV / valuation model.** SARB daily fixing as primary reference rate; biennial revalidation per PROC-RSK-MV-01. **Substrate state: LIVE-INTERNAL-VARIANT** (SARB fixture; production real-time pull is Devon substrate item).

**MRAS** — Model Risk Appetite Score per `Policies/model-risk-policy-v1.md §6` must incorporate the FRTB SA engine; planned at the model-inventory build slice.

**Change posture.** If we move off SARB fixing to Bloomberg BFIX or any other source, the IPV model upgrades from Tier 2 to a new validation cycle; the change is itself a model event (planned `ModelChangeRequested`).

---

### 3.2 Stress testing

Helena's stress bundle:

- **Base** — current macro path; FX-spot P&L impact small (USD 500k notional; small VaR).
- **Adverse** — moderate ZAR depreciation; tested daily.
- **Severely-adverse** — large ZAR depreciation + correspondent-bank stress (Standard Bank credit downgrade or default); the dominant Herstatt-exposure stress for an FX-spot-only book.
- **Reverse** — model what FX rate shock or Herstatt event would trigger non-viability (annual; `Policies/stress-testing-policy-v1.md §3.1`).

ICAAP capital floor (CET1 ≥ 7.0% per `§3.3`); ILAAP LCR/NSFR feed per `§3.4`.

**Substrate state: LIVE** for the stress framework. Calibration is Helena + Rohan; the bundle is run quarterly per PROC-RISK-ST-01.

---

### 3.3 Conduct surveillance

PROC-MK-SUR-01 (planned) covers market-abuse surveillance: front-running of client FX orders is an FMA s.80 manipulation offence; insider-trading prohibition under FMA s.78. The surveillance system (planned `@platform/markets/surveillance`) must cover FX-spot trading patterns from first trade (unusual volume/price anomaly, front-running, layering, spoofing). MLRO is Zara (CCO) per `Team/_team-roster.json`.

**FX-spot specific surveillance:** front-running of large client FX orders; alignment of trade rates against SARB fixing and Bloomberg BFIX (post-feed-live).

**Product-agnostic surveillance:** personal-account dealing (PROC-CO-PAD-01); blackout periods around SARB rate decisions for covered persons holding MNPI.

**Substrate state: PLANNED.** The conduct-surveillance system is a planned build under Zara + Mira.

---

### 3.4 Climate risk

Per Helena's RAS schedule (PR #543, project memory `project_continuation_2026_05_18_ras_schedule`) climate is RAS Tier 1. **For FX-spot specifically the climate-bound exposure is zero**: FX-spot is a 2-day deliverable instrument with no underlying physical-economy exposure, no carbon-intensity dimension, no transition-risk pathway. Documenting this for the audit trail: an FX-spot trade does not engage climate-risk scenarios in the climate-risk substrate (deadline 2026-07-15 per Helena schedule). If the bank ever extends the desk to climate-linked FX (e.g. carbon-linked deliverables), this assessment must be revisited.

**Substrate state: LIVE** (the climate-risk substrate is on its 2026-07-15 timeline; FX-spot is appropriately scoped out).

---

### 3.5 Data lineage

Every numerical fact has provenance back to a source event:

- An `FxPositionRevalued` event cites the `OfficialMarkAdopted` event for the rate used.
- An `FxSettlementConfirmed` event back-links via `tradeRef` to the originating `FxTradeExecuted`.
- A `CcrEadComputed` event carries `nettingSetId` resolving to the `ISDACSAAssessmentCompleted`.
- Provenance envelopes (`sourceLineage`, `sourceEventId`) carry the upstream identity.

The provenance gate (`recon:market-data-provenance-gate`) enforces `provenance: "production"` for the FRTB SA engine inputs at controlled-launch and beyond.

**Substrate state: LIVE.** Slice D of D-EVENT-VIEW-BOUNDARY-WIRE (typed `officialMarkRef` on `FxPositionRevalued`) is pending decision but the advisory recon (Slice B.1) is green.

---

### 3.6 Vera recon coverage

| Recon pipeline | Fires on FX-spot | Status |
|---|---|---|
| `recon:credit-limit-no-trade-without-loaded` | Every trade | LIVE — hard gate |
| `recon:counterparty-exposure-coverage` | Every trade | LIVE |
| `recon:lex-cap-utilisation` | Every trade | LIVE |
| `recon:market-data-provenance-gate` | Every EOD valuation | LIVE |
| `recon:position-revalued-cites-mark` | Every EOD valuation | LIVE-ADVISORY (Slice B.1) |
| `recon:no-prop-attribution` | Every trade | PLANNED |
| `recon:b-cluster-settlement-exposure` | Every settlement instruction | PLANNED (Vera Wave-4) |
| `recon:staleness-threshold-compliance` | Every staleness event | PLANNED (depends on G-6 — `MarketDataStaleAlert` event type) |
| `recon:jurisdictional-opinion-staleness` | Annual | PLANNED (depends on G-1 from Imani §5 — `JurisdictionalOpinionRefreshed`) |
| Citation gate (`bun run citation-gate`) | Every PR | LIVE — CI hard gate |
| `recon:rms-briefs-parity` (Phase 2) | Every brief | LIVE |
| `recon:rms-documents-parity` (Phase 3) | Every document | LIVE — this document files an event under it |

---

## 4. State-of-substrate matrix

| # | Function | Owner | Substrate state | Test state | Blocking for | Citation |
|---|---|---|---|---|---|---|
| 1 | A.1 — Product registration / NPA | Saskia (CMO) + cross-seat | LIVE-INTERNAL-VARIANT (typed NewProductApproved planned) | Not directly tested | Pre-licence-go-live | `D-MARKETS-SCHEMA-FOUNDATION`; PROC-NPA-GATE-01 |
| 2 | A.2 — Trading mandate v1 | Saskia (CMO) | LIVE (MR-1-FX `NOT-CALIBRATED` until BRC) | Tested by inference | Pre-licence-go-live | `Policies/trading-mandate-v1.md` |
| 3 | A.3 — Dealer mandate issuance | Saskia (CMO) | PLANNED | Not tested | NPA-controlled-launch | PROC-MK-MDI-01 |
| 4 | A.4 — Counterparty onboarding | Saskia + Yael + Imani | LIVE-INTERNAL-VARIANT | PR #645 Phase 1 (party + ISDA assessment) | NPA-controlled-launch | PR #637, #639, #642; PROC-MK-CO-01 |
| 5 | A.5 — Credit-limit loading | Helena (CRO) + Yael | LIVE | PR #645 Phase 1 (USD 500k cap asserted ×2) | Pre-licence-go-live (LIVE) | PR #642; D-CREDIT-LIMIT-ENGINE-BUILD |
| 6 | A.6 — Netting-set enrolment | Imani + Yael | LIVE-INTERNAL-VARIANT | PR #645 Phase 1 (enforceable=true ×2) | Pre-licence-go-live | PR #637, #642 |
| 7 | A.7 — MR-1-FX limit calibration | Helena (CRO) | NOT-CALIBRATED (BRC tabling pending) | Not tested | NPA-controlled-launch | PR #634 |
| 8 | A.8 — Market data sourcing (SARB) | Atlas + Devon + Helena | LIVE-INTERNAL-VARIANT (fixture) | PR #645 Phase 1 (29 fixings); Phase 2 provenance-gate green | Pre-licence-go-live | PR #629, #632, #643 |
| 9 | A.9 — Legal documentation (ISDA) | Imani | PLANNED (Masters not signed) | Not tested | NPA-controlled-launch | PR #637 |
| 10 | A.10 — Regulatory authority (ExCon/AD) | Zara (compliance) | LIVE-INTERNAL-VARIANT (build-phase ruling); PLANNED (AD designation post-licence) | Scenario constructed inside the ruling's scope | NPA-live (AD designation) | PR #644 |
| 11 | B.1 — Pre-trade conduct gate (5 checks) | Saskia + Mira + Zara | NOT-WIRED (envelope planned; Check 1 LIVE) | Check 1 PR #645 Phase 2 | NPA-controlled-launch | PROC-MK-PCG-01 |
| 12 | B.2 — Credit-limit headroom check | Helena + engine | LIVE | PR #645 Phases 1+2 | LIVE | D-CREDIT-LIMIT-ENGINE-BUILD |
| 13 | B.3 — Dealer-mandate authorisation | Saskia + engine | PLANNED | Not tested | NPA-controlled-launch | PROC-MK-MBH-01 |
| 14 | B.4 — No-prop XOR invariant | Atlas (schema) + Rohan (sweep) | LIVE (schema); PLANNED (sweep) | PR #645 Phase 2 (XOR satisfied) | NPA-controlled-launch | PR #633 |
| 15 | C.1 — Quote / RFQ | Saskia + dealer | LIVE-INTERNAL-VARIANT (manual UI); PLANNED (RFQ engine) | Seed-run only | NPA-controlled-launch (manual ok) | `dashboard/public/trade-book.html` |
| 16 | C.2 — FxTradeExecuted | Atlas (schema) | LIVE | PR #645 Phase 2 | LIVE | PR #633 |
| 17 | C.3 — Trade-record cross-checks | Atlas + recon | LIVE | PR #645 Phase 2 | LIVE | PR #639 |
| 18 | D.1 — IFRS posting rules (PR-FX-PRIN) | Bea | NOT-WIRED (pure functions LIVE) | Unit-tested only | NPA-controlled-launch | Bea PR family |
| 19 | D.2 — Settlement instruction emission | Tomas (schema) | LIVE | PR #645 Phase 2 | LIVE | PR #640 |
| 20 | D.3 — SA-CCR / capital recompute | Rohan + Imani | LIVE (Nadia validation pending for FX-spot) | PR #645 Phase 2 (RC+EAD emitted) | Pre-licence-go-live | PR #635, #642 |
| 21 | D.4 — Credit-limit utilisation tick | Helena + engine | LIVE | PR #645 Phase 2 (LEX recon green) | LIVE | PROC-RISK-CLM-01 |
| 22 | E.1 — EOD FX revaluation | Rohan | LIVE | PR #645 Phase 2 (≥1 FxPositionRevalued; advisory recon ok) | LIVE | PR #632 |
| 23 | E.2 — Daily P&L | Bea + Camille | NOT-WIRED | Not invoked (gap) | Pre-licence-go-live | PROC-FIN-FXPC-01 |
| 24 | E.3 — Independent price verification | Helena | LIVE-INTERNAL-VARIANT (G-1 manual control) | Indirect via SARB fixing seed | Pre-licence-go-live | Helena §2.1 |
| 25 | E.4 — Market risk limit check | Helena + Rohan | NOT-CALIBRATED (engine LIVE; MR-1-FX BRC-pending) | Not exercised | NPA-controlled-launch | PR #634 |
| 26 | E.5 — BA-325 LCR period close | Bea + Camille | NOT-WIRED (PeriodClosed event LIVE) | Not invoked (gap) | NPA-live | PR #632 |
| 27 | F.1 — Counterparty exposure monitoring | Helena + engine | LIVE | PR #645 Phase 2 (recon green) | LIVE | PROC-RISK-CLM-01 |
| 28 | F.2 — Settlement-rail concentration (B-cluster) | Helena (manual G-5); Vera (planned) | PLANNED (manual control LIVE) | Not tested | Pre-commencement (manual ok) | Helena §2.3 |
| 29 | F.3 — Stress test inclusion | Helena + Rohan | LIVE | Not exercised in scenario | NPA-controlled-launch | PROC-RISK-ST-01 |
| 30 | G.1 — Correspondent feed consumption | Tomas | LIVE-INTERNAL-VARIANT (simulated feed) | PR #645 Phases 2–5 | NPA-controlled-launch (simulated); NPA-live (real SWIFT) | PR #640 |
| 31 | G.2 — Happy path settlement | Tomas + Bea | LIVE | PR #645 Phase 2 (FxSettlementConfirmed × 1) | LIVE | PR #640 |
| 32 | G.3 — Herstatt-active failure | Tomas + Bea | LIVE (events); LIVE pure-function (PR-FX-005); NOT-WIRED (GL projection) | PR #645 Phase 3 (4-leg ECL posting) | NPA-controlled-launch | PR #638, #641 |
| 33 | G.4 — Mutual-fail | Tomas + Bea | LIVE (Bea SicrTriggered gap) | PR #645 Phase 4 (zero postings) | LIVE | PR #641 |
| 34 | G.5 — Operational-delay | Tomas + Bea + Saskia (escalation) | LIVE | PR #645 Phase 5 (zero postings, no default) | LIVE | PR #636, #641 |
| 35 | H.1 — GL ledger projection (end-to-end) | Bea | NOT-WIRED | Not asserted end-to-end (gap) | Pre-licence-go-live | Scenario PR #645 gap |
| 36 | H.2 — Returns generation (BA-125/325/700; FinSurv) | Bea + Camille + Zara | NOT-WIRED for FX-spot | Not exercised | NPA-live | Rashida §2.2, §2.3, §2.5 |
| 37 | H.3 — Audit-trail completeness | Vera + Thandiwe | LIVE | Citation gate; recon gates | LIVE | D-RMS-PHASE-3; Principles |
| 38 | H.4 — Decision events | All seats per category | LIVE | Not exercised (success path) | LIVE | CLAUDE.md routing table |

---

## 5. Internal pre-licence test vs licensed-live operation

For each major function, three columns: what runs **today** in the internal pre-licence test; what changes at **controlled-launch** (first real trade under tight envelope); what changes at full **live** (steady-state).

| Function | Today (internal pre-licence test) | At controlled-launch | At full live |
|---|---|---|---|
| Product registration | Trading mandate v1 already lists FX-spot | NPA gate clears 14 dimensions for controlled-launch scope; `NewProductApproved` typed event emitted | Same controlled-launch product on full mandate (no NPA repeat) |
| Trading mandate | LIVE policy; MR-1-FX `[TBC]` placeholder | BRC-approved MR-1-FX numbers binding | Steady-state limits ~14×–27× higher per Helena §1.7 |
| Dealer mandate | None issued (Kai acts under markets-engineering seat for the scenario) | Kai (or designated dealer) issued formal mandate per PROC-MK-MDI-01 | Multiple dealers; expanded scope |
| Counterparty onboarding | Party register row + simulated `ISDACSAAssessmentCompleted` | Real ISDA Masters executed; full PROC-MK-CO-01 7-gate flow | Steady-state onboarding pipeline; Niko activates |
| Credit-limit loading | USD 500k per counterparty (Yael PR #642 seed) | Same USD 500k per Helena §1.3 | Full credit-limit framework; LEX-cap binding |
| Netting-set enrolment | Stub `ISDACSAAssessmentCompleted` per PR #642 | Real Bowmans 2024 opinion citationed; document content-hashed in RMS | Annual ISDA opinion refresh recon LIVE |
| MR-1-FX calibration | Helena's proposal filed; **not BRC-tabled** | BRC-approved ZAR 350k VaR / USD 1m EOD / USD 1.5m intraday | Steady-state limits per BRC-approved schedule |
| Market data sourcing | SARB fixing from JSON seed; `provenance: "production"` envelope | Same fixture variant + manual Helena IPV daily | Real-time Bloomberg BFIX feed; SARB fixing as secondary; G-1 compensating control removed |
| Legal documentation | None signed | ISDA 2002 + SA Schedule signed with both whitelisted counterparties | Steady-state legal pipeline; expanded counterparty set |
| Regulatory authority | Rashida ExCon ruling — outside scope; no real AD authority | Same ruling pre-licence; AD application pending | AD designation granted by SARB FinSurv; FinSurv per-trade reporting live; BA-125 wired |
| Pre-trade conduct gate | Check 1 LIVE (credit-limit); 2–5 planned | All five checks LIVE; envelope `ConductGatePassed` emitted | Same as controlled-launch |
| FxTradeExecuted | Synthetic; programmatic construction | Real trade; manual booking UI initially | Real trade; RFQ engine |
| IFRS posting rules | Pure functions evaluated; GL projection not wired | GL projection wired end-to-end; daily P&L LIVE | Same as controlled-launch + BA-100 trial balance |
| Settlement instruction | Simulated `FxSettlementInstructed` | Real SWIFT MT202; correspondent feed real | Same as controlled-launch |
| SA-CCR | LIVE (Nadia validation pending) | Nadia validation complete; G-2 compensating control removed | Steady-state SA-CCR; cross-product netting v1 (Imani G-9 §5 gap 6) |
| EOD revaluation | LIVE (advisory recon Slice B.1) | Schema-typed `officialMarkRef` (Slice D) gating | Same as controlled-launch |
| Independent price verification | Manual via Helena daily | Same; G-1 compensating control still active | Auto IPV with real-time feed; G-1 control removed |
| Market risk limit check | Engine LIVE but MR-1-FX not calibrated | Engine binding; Helena dual-track manual cross-check (G-2 compensating) | Engine binding; Nadia validated; manual cross-check removed |
| BA-325 / BA-125 / BA-700 / FinSurv | Not wired for FX-spot | Wired with PeriodClosed envelope; dry-run filings | Live filing cadence (monthly BA-325; per-trade FinSurv) |
| Settlement (T+2) — happy path | Simulated correspondent ack | Real correspondent feed (Standard Bank SWIFT) | Same as controlled-launch |
| Settlement failure paths | All three exercised in scenario | Real-world failure handling; PROC-OPS-SFBCP-01 invoked | Vera Wave-4 B-cluster recon LIVE; G-5 compensating control removed |
| GL ledger projection end-to-end | Not asserted | Wired (bea-gl-posting-engine integration) | Same as controlled-launch |

---

## 6. Open gaps and roadmap to first synthetic trade

This list consolidates from Helena's scope review §6, Imani's G-9 §5, Rashida's assessment §5, and Kai's scenario `substrateGaps` summary. Ranked from highest blocking class to lowest.

### 6.1 Pre-licence go-live hard gates

| # | Gap | Owner | Status |
|---|---|---|---|
| 1 | **MR-1-FX limit framework not BRC-tabled** (Helena §6 G-4) | Helena → BRC (Marc interim) | merged-but-not-tabled |
| 2 | **FRTB SA engine not Nadia-validated for FX-spot** (Helena §6 G-2) | Nadia | not started |
| 3 | **Production FX quote feed not live** (Helena §6 G-1) | Devon + Atlas | not started |
| 4 | **GL ledger projection end-to-end not asserted** (scenario PR #645 gap) | Bea | not started |
| 5 | **Daily P&L runDailyPnLReport not invoked end-to-end** (scenario PR #645 gap) | Bea | not started |
| 6 | **BA-325 period-close subscriber not wired for FX-spot** (scenario PR #645 gap) | Bea + Camille | not started |
| 7 | **AD designation application not submitted** (Rashida §2.1) | Zara (CCO) + Owen | not started |
| 8 | **FinSurv per-trade reporting pipeline not built** (Rashida §2.2) | Bea + Mira + Zara | not started |
| 9 | **BA-125 wiring not complete for FX-spot** (Rashida §2.3) | Camille + Rohan | not started |

### 6.2 NPA-controlled-launch hard gates

| # | Gap | Owner | Status |
|---|---|---|---|
| 10 | **Dealer mandate not issued** (PROC-MK-MDI-01) | Saskia + Kai | not started |
| 11 | **ISDA Masters not executed with Standard Bank and Investec** (Imani §1.5) | Imani + Saskia | not started |
| 12 | **Conduct-gate envelope (`ConductGatePassed` events) not LIVE** (Checks 2–5) | Mira + Zara | not started |
| 13 | **B-cluster RAS recon harness PLANNED** (Helena §6 G-5; Vera Wave-4) | Vera | not started (manual compensating control LIVE) |
| 14 | **SA-CCR T+2 maturity-factor verification on first real trade** (Helena §6 G-7) | Rohan | requires first trade (G-7 closure tautology per Helena §4 item 5) |
| 15 | **MR-5 no-prop attribution sweep recon PLANNED** (scenario PR #645 substrate-gap; Vera Wave-4) | Vera + Rohan | not started |
| 16 | **PR-FX-005 GL-engine wire-up** (scenario PR #645 substrate-gap) | Bea | not started |
| 17 | **Bea SicrTriggered follow-on for FVTPL Stage-2 SICR on mutual-fail** (scenario PR #645 substrate-gap) | Bea | not started |

### 6.3 Schema and event-type gaps (next compliance-substrate slice)

| # | Gap | Owner | Status |
|---|---|---|---|
| 18 | **`MarketDataStaleAlert` event type not defined** (Helena §6 G-6) | Atlas | not started |
| 19 | **`JurisdictionalOpinionRefreshed` event type not defined** (Imani §5 gap 1) | Atlas + Imani | not started |
| 20 | **`ModelFallbackUsed` event type not defined** (Helena §6 G-10) | Atlas | not started |
| 21 | **`LegalDocumentationSigned.agreementType` lacks `"fx-bilateral"`** (Imani §5 gap 2) | Atlas + Imani | not started (low priority — none-listed posture unlikely at controlled-launch) |
| 22 | **`FxPositionRevalued.officialMarkRef` schema-typed link** (scenario PR #645 substrate-gap; D-EVENT-VIEW-BOUNDARY-WIRE Slice D) | Atlas | pending decision card |
| 23 | **`ProvenanceTag.sourceEventId` link on settlement events** (scenario PR #645 substrate-gap) | Atlas | not started |
| 24 | **Bowmans 2024-04-15 ISDA SA netting opinion not in RMS document store** (Imani §5 gap 3) | Imani + Atlas | not started |
| 25 | **Standard Bank and Investec Party register `relationship-status` discriminator** ("wired into substrate for test" vs "active trading counterparty"; Rashida §5 substrate gap) | Saskia + Imani | not started |
| 26 | **Test-substrate property attestation recon (Rashida §1.4 conditions)** | Vera | not started |

### 6.4 Documentation / procedure rewrites (Helena §5)

| # | Rewrite | Owner |
|---|---|---|
| 27 | Dormant/active status flags on PROC-RISK-MRL-01 limit register | Helena + Rohan |
| 28 | Expected zero-utilisation annotation on PROC-RISK-MRM-01 for FX-spot-only | Helena + Rohan |
| 29 | FX vs IRD calibration split in PROC-MK-MDI-01 Step 3 | Saskia |
| 30 | Gate 2 pass condition clarification (ISDA vs FX-bilateral) in PROC-MK-CO-01 | Saskia + Imani |
| 31 | Product-scope-conditional shock selection in PROC-RISK-ST-01 Step 5 | Helena + Rohan |
| 32 | Stale MR-5/MR-5-NPA reference in `Policies/market-risk-policy-v1.md §8.2` | Helena |
| 33 | FX Settlement Risk Procedure authoring (Helena §6 G-8) | Saskia + Helena + Tomas |
| 34 | Counterparty-onboarding procedure addendum from Imani G-9 §3 | Imani + Saskia |
| 35 | Trading Mandate §3 amendment (new §3.4 — legal-documentation defaults per product class) from Imani G-9 §4 | Saskia + Helena + Imani |

---

## 7. CEO decisions queued

The following decisions require Marc (CEO)'s explicit authority before the next substrate slice can land. Each is queued in the sense that the deliverable that drives the decision is on `main`; the Decision event needs to be emitted.

| # | Decision | Recommendation | Source | Authority routing |
|---|---|---|---|---|
| 1 | **Approve Helena's controlled-launch MR-1-FX limit framework** (ZAR 350k VaR; USD 1m EOD; USD 1.5m intraday; USD 500k per-counterparty; 2-name whitelist; USD/ZAR only) for BRC tabling. | Approve as tabled. | PR #634; `record:documents:helena:controlled-launch-mr1-fx-limit-proposal:2026-05-20` | CRO recommendation → BRC (CEO interim) approval → `Decision(approved)` event. |
| 2 | **Approve Helena's compensating-control attestation block** (G-1 SARB-fixing daily IPV; G-2 dual-track manual SA-SBM-delta; G-3 Tomas-produced manual B-cluster summary with Helena morning sign-off) as standing controls for the controlled-launch period. | Approve as tabled. | PR #634 §2.1–§2.3 | CRO recommendation → BRC (CEO interim) approval. |
| 3 | **Note the 8 trigger criteria** for lifting from controlled-launch to `live` limits (20-day clean; G-1, G-2, G-3, G-5, G-7 closed; 90-day PIR clean; no FX-settlement op-loss). | Note. | PR #634 §1.8 | BRC noting. |
| 4 | **Authorise dispatch of follow-on slices for the Pre-licence go-live hard gates** (§6.1 above): production FX feed (G-1 closure), Nadia FRTB SA validation (G-2), GL projection end-to-end (gap 4), BA-325 wire-up (gap 6), AD designation programme (gap 7). | Authorise as next-tick sprint. | This document §6.1 | CEO authorisation under no-pause rule (each downstream piece is operational under approved decisions D-MARKETS-SCHEMA-FOUNDATION + D-CREDIT-LIMIT-ENGINE-BUILD). |
| 5 | **Authorise ISDA Master Agreement negotiation kick-off** with Standard Bank ZA and Investec Bank Treasury per Imani G-9. | Authorise. | PR #637 | CEO authorisation; Imani + Saskia execute. |
| 6 | **Decide whether to widen the controlled-launch counterparty whitelist beyond 2 names**, or to widen pair set beyond USD/ZAR. | Recommend: no (per Helena §1 — controlled-launch discipline is to constrain optionality). | PR #634 §1.0, §1.2 | CRO recommendation → BRC decision. |
| 7 | **Decide capital-deployment posture** for the controlled-launch period. The limits framework in PR #634 assumes a hypothetical R300m capital; the bank has **no capital today**. The first real FX-spot trade requires capital to actually be on balance sheet at the booking entity Hoz Bank Limited. | Recommend: defer to licence-day capital raise; rehearse on hypothetical capital under internal pre-licence test (current posture); revisit when SARB Banks Act licence is granted. | This document §1.5; Helena §1.7 | CEO strategic decision. |

---

## Closing

This document is the prose render of the operational reality that Kai's scenario at PR #645 returned **READY-FOR-CONTROLLED-LAUNCH** asserts in the substrate. Read top-to-bottom for a complete walk; read §4 alone for the at-a-glance state; read §6 alone for the roadmap; read §7 alone for the decisions queued for Marc's authority. The next iteration of this document will be issued either when the BRC has tabled and approved Helena's MR-1-FX framework (folding §7 item 1 into the approved-decisions trail) or when the next substrate slice lands (most likely Bea's GL projection end-to-end and Nadia's FRTB SA validation for FX-spot — gaps 4 and 2 of §6.1).

*Saskia (Chief Markets Officer, governance) — primary author*
*Kai (Markets engineering lead, engineering) — co-author for substrate-state and test-state column*
*2026-05-21*
*Brief: `brief:saskia:ceo-end-to-end-fx-trade-walkthrough-document:2026-05-21`*
*Workstream: WS-MARKET-RISK-PROCEDURES*
