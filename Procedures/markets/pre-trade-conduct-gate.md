---
procedureId: PROC-MK-PCG-01
title: Pre-trade conduct and suitability gate for FX spot trades
author: Saskia (Head of Global Markets) · Mira (Compliance / RegTech Engineer) · Zara (MLRO, governance)
date: 2026-05-16
owner: Saskia (Head of Global Markets) · Mira (Compliance / RegTech Engineer) · Zara (MLRO, governance)
status: POPULATED
version: "0.2"
last-updated: "2026-05-20"
policy-cited: Best Execution Policy (planned) · Conduct Policy (planned) · Credit Risk Policy v1
system-capability: "@platform/markets/conduct-gate (PLANNED) · @platform/risk/credit-limit-engine"
citations:
  - FAIS Act GCC s4
  - D-FSP-LICENCE-NECESSITY
  - D-MARKETS-SCHEMA-FOUNDATION
  - D-CREDIT-LIMIT-ENGINE-BUILD
---

# Procedure — Pre-trade conduct and suitability gate for FX spot trades

**Procedure ID:** PROC-MK-PCG-01
**Owner:** Saskia (Head of Global Markets) · Mira (Compliance / RegTech Engineer) · Zara (MLRO, governance)
**Approval:** BRC (Conduct Policy — planned; FSP-licence-conditional)
**Cadence:** Per-trade (blocking gate before every FX spot trade execution)
**Version:** v0.2 — 2026-05-20
**Status:** POPULATED

## 1. Source policy

- Conduct Policy (planned; Zara + Mira co-author; BRC approval required; FSP-licence-conditional).
- FAIS Act General Code of Conduct §4 — conduct and suitability obligations for FSPs executing trades on behalf of or with institutional clients.
- TCF Outcome 4 — products must be appropriate; TCF requires suitability assessment at point of execution.
- Decision record: `D-FSP-LICENCE-NECESSITY` — confirms institutional-only posture; institutional-client conduct obligations apply from commencement of FSP licence.

The obligation chain:

```
Regulation (FAIS Act s.16 + GCC §4 — conduct and suitability; FMCA conduct obligations)
  → Conduct Policy (planned)
    → PROC-MK-PCG-01 (this procedure)
      → @platform/markets/conduct-gate (PLANNED)
        → ConductGatePassed / ConductGateBlocked events
```

**Build-phase posture:** No live trading. The conduct gate is built and tested in rehearsal mode during the build phase. At commencement of trading, this gate becomes a hard blocking control on every trade.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| FAIS Act GCC §3(1)(a) | FSP must act in the best interests of clients; conduct gate is the pre-trade enforcement of this obligation. |
| FAIS Act GCC §4 | FSP must confirm counterparty capacity, mandate scope, and appropriateness before executing transactions. |
| FMCA s.6 + CS 3/2018 | ODP trading conduct obligations; conduct screening is required before OTC derivatives execution. |
| FICA s.22 | Ongoing monitoring: sanctions screening must be current at point of execution, not just at onboarding. |
| TCF Outcome 4 | Product suitability must be assessed at transaction level for institutional clients. |

## 3. Purpose

1. Provide a blocking pre-trade gate that prevents FX spot trade execution unless all conduct and suitability checks have passed, ensuring the bank cannot execute a trade in breach of FAIS, FMCA, or FICA obligations.
2. Confirm at execution time that: the counterparty is on the approved-counterparty list; the dealer has a valid mandate covering the product and notional; an ISDA Master Agreement is in place; and the counterparty is not on any sanctions list.
3. Confirm that best-execution assessment is recorded before trade execution (linking to PROC-MK-BE-01).
4. Emit a typed `ConductGatePassed` or `ConductGateBlocked` event for every trade, creating an immutable compliance record at the point of execution.

## 4. Trigger

- **Per-trade gate:** `TradeIntentReceived { intentId, dealerId, counterpartyId, product: 'FxSpot', notional, currency, settlementDate, side, requestedAt }` — emitted by the trading system when a dealer submits a trade for execution.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Check 1 — Counterparty mandate:** Query the approved-counterparty registry (built by PROC-MK-CIL-01) to confirm: (a) counterparty is on the approved list; (b) counterparty is approved for FX spot; (c) credit-limit-exhausted check calls `checkHeadroom(counterpartyId, proposedExposure)` from `@platform/risk/credit-limit-engine` (live; D-CREDIT-LIMIT-ENGINE-BUILD Phase 4), which returns `ok: false` with `blockReason ∈ { 'CounterpartyNotApproved', 'CreditLimitExhausted', 'LimitExpired', 'AnnualReviewStale' }`; (d) ISDA Master Agreement is in place and current | `agent` | `@platform/markets/counterparty-registry` (PLANNED) · `@platform/risk/credit-limit-engine` (live) | If any sub-check fails: emit `GatewayCheckCompleted { orderId, checkKind: 'credit-limit', outcome: 'reject', blockReason: 'CounterpartyNotApproved' | 'CreditLimitExhausted' | 'LimitExpired' | 'AnnualReviewStale', rejectionReason, citationToRule: 'RAS-B3' }` (canonical, today). The legacy procedure naming `ConductGateBlocked { intentId, reason, blockedAt }` reflects the planned conduct-gate envelope; the runtime emits the canonical `GatewayCheckCompleted` events ahead of that envelope, with the typed `blockReason` enum carrying the engine's outcome. Stop. |
| 2 | **Check 2 — Dealer mandate:** Query the dealer mandate registry (built by PROC-MK-MDI-01) to confirm: (a) dealer has an active acknowledged mandate; (b) FX spot is within the dealer's product scope; (c) proposed notional is within the dealer's single-trade and portfolio notional limits; (d) settlement date is within the dealer's tenor mandate | `agent` | `@platform/markets/mandate-registry` (PLANNED) | If any sub-check fails: emit `ConductGateBlocked { intentId, reason: 'DealerMandateInsufficient' | 'NotionalLimitBreached' | 'TenorLimitBreached', blockedAt }`. Stop. |
| 3 | **Check 3 — Real-time sanctions screening:** Run the counterparty's LEI and beneficial owner names through the real-time sanctions screening engine (OFAC, UN, SA PFA lists); confirm no current sanctions hit | `agent` (Zara — MLRO, governance, system-assisted) | `@platform/compliance/sanctions-screen` (PLANNED) | Sanctions screening must use a fresh pull (not a cached result older than 24 hours). A sanctions hit is a hard block; Zara is notified immediately; Mira assesses regulatory notification obligations. If screening engine unavailable: trade is blocked until screening is restored. |
| 4 | **Check 4 — Counterparty capacity confirmation:** Confirm the counterparty has acknowledged FX spot as an approved product in their mandate with the bank; no capacity disputes on record; no pending exclusion requests | `agent` | `@platform/markets/counterparty-registry` (PLANNED) | Capacity disputes in the dispute registry block new trades with the affected counterparty. |
| 5 | **Check 5 — Best-execution record pre-check:** Confirm that a `BestExecutionAssessmentRecorded` event exists for this `intentId` (linking to PROC-MK-BE-01); if missing, trigger the best-execution assessment workflow before proceeding | `agent` | `@platform/markets/best-execution` (PLANNED) | Best-execution assessment must be completed before the conduct gate can pass. This check enforces the sequencing between PROC-MK-BE-01 and PROC-MK-PCG-01. |
| 6 | **All checks passed:** Emit `ConductGatePassed { intentId, dealerId, counterpartyId, product, notional, checksCompleted: ['CounterpartyMandate', 'DealerMandate', 'SanctionsScreen', 'CounterpartyCapacity', 'BestExecutionRecord'], passedAt }` | `agent` | `@platform/event-store` | Trade execution proceeds only after `ConductGatePassed` is emitted. The execution system must verify the gate event before submitting. |
| 7 | **Blocked trade review:** For any `ConductGateBlocked` event: Mira reviews the block reason within 1 hour; for mandate/ISDA issues: Saskia and Imani are notified to resolve; for sanctions hits: Zara leads the triage; resolution documented in `ConductGateBlockResolutionRecorded` event | `human` (Mira + Saskia/Imani/Zara as applicable) | `@platform/markets/conduct-gate` (PLANNED) | Blocked trades are not re-submitted without a `ConductGateBlockResolutionRecorded` event documenting the resolution. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Ravi / Kai (trading system engineer) | Trade intent submission; execution only after `ConductGatePassed` |
| Mira (Compliance / RegTech Engineer) | Conduct gate system ownership; blocked-trade review; regulatory escalation |
| Zara (MLRO, governance) | Sanctions screening oversight; sanctions-hit triage |
| Saskia (Head of Global Markets) | Mandate-related block resolution |
| Imani (Legal / Contracts Engineer) | ISDA-related block resolution |
| Vera (internal audit engineer, governance) | Daily assertion that every `TradeIntentReceived` has a downstream `ConductGatePassed` or `ConductGateBlocked` |

## 7. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| Sanctions hit | Zara immediate; Mira regulatory notification assessment; Devon (COO) informed | Immediate |
| ISDA not in place | Imani expedites; trade blocked until resolved | Per Imani timeline |
| Conduct gate system unavailable | Devon (COO) + Mira emergency response; all trading suspended | Immediate |
| Dealer mandate insufficient | Saskia + Helena; mandate amendment or trade decline | Within 1 hour |
| Credit limit exhausted | Helena review; potential limit uplift or trade decline | Within 1 hour |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/markets/conduct-gate` | PLANNED | Blocking gate orchestration; all five checks |
| `@platform/markets/counterparty-registry` | PLANNED | Approved-counterparty query (approval list, FX-spot eligibility, ISDA in place) |
| `@platform/risk/credit-limit-engine` | LIVE | `checkHeadroom` — credit-limit-exhausted check (Check 1(c)); D-CREDIT-LIMIT-ENGINE-BUILD Phase 4 |
| `@platform/markets/mandate-registry` | PLANNED | Dealer mandate query |
| `@platform/compliance/sanctions-screen` | PLANNED | Real-time sanctions screening |
| `@platform/markets/best-execution` | PLANNED | Best-execution assessment check |
| `@platform/event-store` | Live | `GatewayCheckCompleted` (live, with typed `blockReason`); `ConductGatePassed` / `ConductGateBlocked` (planned envelope) |

## 9. Quality controls

- Every `TradeIntentReceived` must have a downstream `ConductGatePassed` or `ConductGateBlocked`. Vera asserts this for every trade. A trade with no gate outcome event is a critical Vera finding.
- `ConductGatePassed` must precede `TradeExecuted` for the same `intentId`. Vera asserts this sequencing invariant.
- Blocked trades must have a `ConductGateBlockResolutionRecorded` within 2 business days, or the trade must be cancelled.
- Sanctions screening must use a result < 24 hours old. Vera audits screening freshness timestamps weekly.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `TradeIntentReceived` | Event log | 5 years | Trade intent record |
| `ConductGatePassed` | Event log | 5 years (FMCA) | Pre-trade compliance record |
| `ConductGateBlocked` | Event log | 7 years | Block record; potential regulatory evidence |
| `ConductGateBlockResolutionRecorded` | Event log | 7 years | Block resolution trail |
| Sanctions screening result | Event log (embedded) | 7 years | FICA ongoing monitoring record |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Devon (Chief Operating Officer, governance) | Initial POPULATED — 5-check blocking gate (counterparty mandate, dealer mandate, sanctions, capacity, best-execution record); ConductGatePassed/Blocked events; blocked-trade review; FAIS GCC §4 + FMCA + FICA sourcing; institutional-only posture. |
| v0.2 | 2026-05-20 | Saskia (Head of Global Markets) | Check 1(c) wired into the live `@platform/risk/credit-limit-engine` (`checkHeadroom`) per D-CREDIT-LIMIT-ENGINE-BUILD Phase 4. Typed `blockReason` enum on `GatewayCheckCompleted` carries one of `CounterpartyNotApproved`, `CreditLimitExhausted`, `LimitExpired`, `AnnualReviewStale`. Stale-review check enforces Credit Risk Policy §1.3 + Banks Act Reg 23 annual-review obligation. Procedure system-capability column flipped from PLANNED to LIVE for the engine. |
