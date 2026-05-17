---
title: "FX Spot — operational-readiness gate attestation"
author: Devon (Chief Operating Officer, governance)
date: 2026-05-12
decision-required: false
product: prd:bank:fx:fx-spot-zar-usd
gate: operational-readiness
result: cleared-with-conditions
riskTaxonomy:
  - RT-OP.PA
  - RT-OP.ST
  - RT-CR.SL
  - RT-MK
---

# FX Spot — Operational-Readiness Gate Attestation

**Author:** Devon (Chief Operating Officer, governance)  
**Date:** 2026-05-12  
**Product:** `prd:bank:fx:fx-spot-zar-usd`  
**Gate:** Operational-Readiness (NPA Policy §5, dimension 4)  
**Result:** `cleared-with-conditions`

**Citation chain:** `D-NEW-PRODUCT-APPROVAL-POLICY` · `D-PRODUCT-CONSTRUCTION-SUBSTRATE` · `D-FX-CLS-MEMBERSHIP` · `D-FX-AD-STATUS` · `TRADING-MANDATE-V1` · Banks Act Reg 39 (operational risk) · BCBS Sound Practices for Operational Risk §27

---

## 1. Trading System / Order Management

**Substrate state:** The M4 trading stack provides the core event primitives for FX Spot trade capture. The `FxTradeExecuted` event constructor is live in `prototype/platform/markets/cdm/fx.ts`, enforcing Principle 2 citation requirements (at least one citation is asserted at construction time; `'[citation: TBC]'` is the minimum-viable value). The constructor covers Spot, Forward, Swap, and NDF in a single schema with `instrumentType` discriminator. The FinSurv category field (`finsurvCategory`) and Authorised Dealer status (`isFullAuthorisedDealer`) are typed into the payload schema, establishing the data surface that downstream pipelines will consume.

**Ready now:** Event-level trade capture with full payload schema; typed FinSurv-category field; Principle 2 citation enforcement at construction.

**Deferred to commencement-of-trading:** Front-office order-capture UI and RFQ workflow integrated into the trading stack; STP routing from order capture directly to event store without manual intervention. These are in scope for the FX Sales & Trading Frontend programme (`D-FX-SALES-TRADING-FRONTEND`, Slice 1 and 2) and must be live before first real trade.

---

## 2. Settlement Infrastructure

**Substrate state:** The `FxSettlementInstructed` event constructor is live in `prototype/platform/markets/cdm/fx.ts`. The constructor enforces that a `correspondentParty` is present when `settlementPath = 'correspondent'`, directly encoding the `D-FX-CLS-MEMBERSHIP` decision (indirect CLS via Standard Bank as primary correspondent, FirstRand/RMB as backup). The correspondent-routing module at `prototype/platform/markets/correspondent-routing.ts` provides the routing logic for the build-phase substrate. The Herstatt risk framework and PvP netting controls are documented in `TRADING-MANDATE-V1` §6.

**Ready now:** Settlement instruction event constructor with correspondent-path validation; correspondent-routing substrate; Herstatt risk framework policy-layer controls (PvP netting election, intraday-exposure cap, B-cluster RAS §B8a lines, settlement-failure incident protocol, quarterly switch-test cadence — all specified in TRADING-MANDATE-V1 §6.3).

**Deferred to commencement-of-trading:** Live SWIFT MT202 / pacs.009 connectivity to Standard Bank (primary) and FirstRand/RMB (backup); execution and signature of correspondent bank agreements; live PvP netting election with Standard Bank; first live switch-test run. These are hard dependencies — no real FX Spot settlement is possible without them.

---

## 3. FinSurv Reporting Pipeline

**Substrate state:** The `FxTradeExecuted` payload carries the `finsurvCategory` field (typed string, mapped to the SARB Currency and Exchanges Manual category codes) and the `isFullAuthorisedDealer` boolean. The `FX_EVENT_TYPES` constant registers `FxTradeExecuted` and `FxSettlementInstructed` as the canonical event types from which the FinSurv submission pipeline will draw. The event log is the single source of truth per Principle 1; the reporting pipeline consumes it by projection. The Authorised Dealer status decision (`D-FX-AD-STATUS`) governs the scope of reporting obligations.

**Ready now:** FinSurv-category data surface in the trade event schema; event store as authoritative source; AD-status flag to gate full-reporting-scope obligation.

**Deferred to commencement-of-trading:** Automated FinSurv submission pipeline — owned by Mira (Compliance / RegTech engineer) — that reads `FxTradeExecuted` events and produces `TradeReportSubmitted { regulator: "SARB-FinSurv" }` events with real SARB API / submission-channel integration. This pipeline must be tested end-to-end and signed off by Zara (Chief Compliance Officer, governance) before first live FX trade, as FinSurv non-reporting is an ExCon breach.

---

## 4. Market Data Feed

**Substrate state:** The `FxTradeExecuted` payload includes `spotRate` and `valueDate` fields, accepting the spot rate at execution time. No live market-data feed is wired in the current build-phase substrate — the `spotRate` field is populated manually or from a test placeholder in build-phase scenario runs. PAX (strategic research agent) has deferred the Reuters / Bloomberg / SARB feed vendor decision pending the broader vendor-management programme.

**Ready now:** Spot-rate data surface in the trade event schema; build-phase test scenarios use placeholder values without breaking type safety.

**Deferred to commencement-of-trading:** Live spot rate feed from a selected market-data vendor (Reuters Elektron, Bloomberg B-PIPE, or SARB reference rate as fallback); MTM rate feed integration for end-of-day position marking; FinSurv category verification feed (spot rate on trade date required for correct ExCon category assignment). PAX vendor decision is on the pre-licence readiness roadmap.

---

## 5. Limit and Mandate Controls

**Substrate state:** The trading mandate control layer is live. The onboarding orchestrator at `prototype/platform/lifecycle/onboarding-orchestrator.ts` enforces the `mandate-assigned` phase as a gate in the counterparty lifecycle — a counterparty may not have FX Spot transacted against them until the `mandate-assigned` phase is cleared and the relevant product mandates (referencing `TRADING-MANDATE-V1`) are on file. The `mandate-assigned` phase is part of the typed `OnboardingPhase` union and is correctly ordered before `activated` in the phase-transition logic. Per-counterparty notional caps (governed by `TRADING-MANDATE-V1` §5 and Helena's (Chief Risk Officer, governance) credit-risk limit framework) are the numerical limits to be filed per counterparty at onboarding.

**Ready now:** Mandate-assignment gate in onboarding orchestrator is live and enforced; `mandate-assigned` phase event is typed; no FX Spot transaction can proceed without mandate gate clearance.

**Deferred to commencement-of-trading:** Numerical per-counterparty credit and notional limit values (Helena to set at BRC; `[TBC]` placeholders in TRADING-MANDATE-V1 §5.2–5.3); automated real-time limit-checking against live `FxTradeExecuted` events (Atlas's (Core banking platform architect) limit-checking infrastructure, referenced in TRADING-MANDATE-V1 §5.2).

---

## 6. Business Continuity

**Substrate state:** The Herstatt risk framework in `TRADING-MANDATE-V1` §6.3 defines the settlement-failure incident protocol: `FxSettlementFailed` event is the typed signal; Tomas (Operations & payments engineer) immediately escalates to Helena (CRO, governance) and Devon on receipt; Devon and Helena jointly determine whether to suspend FX trading. The T+2 settlement cycle is encoded in the `FxSettlementInstructed` schema. The backup correspondent (FirstRand/RMB) is named and the quarterly switch-test cadence is specified. However, no written BCP runbook exists for the FX settlement-failure scenario (Herstatt scenario) in the current substrate.

**Ready now:** Incident-event taxonomy (`FxSettlementFailed`) defined; escalation path to Devon and Helena specified; backup correspondent named; quarterly switch-test cadence authorised.

**Deferred to commencement-of-trading:** Written BCP runbook for FX settlement failure — covering the Herstatt scenario, steps to suspend trading, correspondent switch execution, counterparty notification, SARB PA notification (if material), and recovery declaration. Owned by Devon (COO, governance) with Tomas and Helena as co-authors. Also deferred: tested RTO/RPO targets for FX settlement — noted as a substrate gap in Devon's 2026-05-11 operational-resilience snapshot. No real FX Spot trading is permissible without a tested runbook.

---

## 7. Regulatory Reporting

**Substrate state:** DTCC/SAFE Trade Repository reporting is required under the OTC Derivative Provider licence (`D-FX-AD-STATUS`). The Authorised Dealer status decision establishes the bank's reporting-scope obligations. The `FxTradeExecuted` event schema carries the minimum payload fields (trade ID, counterparty, product, notional, currency pair, value date, execution timestamp) that a DTCC/SAFE submission would require. No submission pipeline exists in the current build-phase substrate.

**Ready now:** Trade event data surface; AD-status decision establishing reporting-scope; typed event log as authoritative source for all regulatory-reporting pipelines.

**Deferred to commencement-of-trading:** DTCC/SAFE Trade Repository reporting pipeline — owned by Mira (Compliance / RegTech engineer), governed by Zara (CCO, governance) — that reads `FxTradeExecuted` events and produces typed `TradeReportSubmitted { regulator: "DTCC-SAFE" }` events. Requires integration with the DTCC GTR or SAFE trade repository API, tested end-to-end in a UAT environment, and signed off by Zara before first live OTC FX trade. SAFE reporting is an OTC Derivative Provider licence condition; non-reporting at commencement of trading is a Conduct Standard 3/2018 breach.

---

## Overall Assessment

The FX Spot operational-readiness gate clears **with conditions**. The substrate primitives are sound: the `FxTradeExecuted` and `FxSettlementInstructed` event constructors are live and correctly typed; the correspondent-routing architecture is consistent with `D-FX-CLS-MEMBERSHIP`; the mandate-assigned onboarding gate enforces a hard pre-trade control; and the FinSurv and DTCC/SAFE data surfaces are present in the event schema. No operational-readiness dimension is `withheld` — none of the current gaps represent a design flaw or a fundamental architectural inconsistency that would block the product from ever operating safely.

The six conditions below are each genuine pre-commencement blockers. They are infrastructure items, not policy items, and they depend on vendor contracts, regulatory approvals, and tested integrations that are correctly outside the build-phase scope per the bank's operating model. Devon will track these against the pre-licence go-live readiness gate.

---

## Attestation Event Payload

```typescript
// ProductDimensionAttested — operational-readiness gate
const OPERATIONAL_READINESS_ATTESTATION = {
  dimension: "operational-readiness-gate",
  result: "cleared-with-conditions",
  attestedBy: "Devon (Chief Operating Officer, governance)",
  attestedAt: "2026-05-12T00:00:00.000Z",
  rationale:
    "FX Spot substrate primitives (event constructors, correspondent-routing, mandate-assigned gate, FinSurv/SAFE data surfaces) are live and architecturally sound; six live-infrastructure items (SWIFT connectivity, correspondent agreements, market data feed, FinSurv pipeline, BCP runbook, DTCC/SAFE pipeline) are correctly deferred to commencement-of-trading.",
  citationChain: [
    "D-NEW-PRODUCT-APPROVAL-POLICY",
    "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
    "D-FX-CLS-MEMBERSHIP",
    "D-FX-AD-STATUS",
    "TRADING-MANDATE-V1",
  ],
  conditions: [
    "Live SWIFT MT202/pacs.009 connectivity to correspondent bank (Standard Bank primary; FirstRand/RMB backup) — deferred to commencement-of-trading",
    "Correspondent bank agreement execution (Standard Bank + FirstRand/RMB; including PvP netting election) — deferred to commencement-of-trading",
    "Market data feed (Reuters Elektron / Bloomberg B-PIPE / SARB spot rate) for trade execution, MTM, and FinSurv category verification — deferred to commencement-of-trading (PAX vendor decision pending)",
    "FinSurv automated submission pipeline (Mira — Compliance / RegTech engineer) producing TradeReportSubmitted { regulator: 'SARB-FinSurv' } events — deferred to commencement-of-trading",
    "BCP runbook for FX settlement failure (Herstatt scenario) — tested, with RTO/RPO targets — deferred to commencement-of-trading (Devon + Tomas + Helena co-authors)",
    "DTCC/SAFE Trade Repository reporting pipeline (Mira) producing TradeReportSubmitted { regulator: 'DTCC-SAFE' } events — deferred to commencement-of-trading (OTC Derivative Provider licence condition)",
  ],
};
```

---

*Attested by Devon (Chief Operating Officer, governance), 2026-05-12.*  
*Gate: operational-readiness (NPA Policy §5 dimension 4, `D-NEW-PRODUCT-APPROVAL-POLICY`).*  
*Product: `prd:bank:fx:fx-spot-zar-usd`.*
