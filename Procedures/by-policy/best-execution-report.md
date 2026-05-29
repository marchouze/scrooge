---
policy-parent: Best Execution Policy (planned)
last-reviewed: 2026-05-16
procedureId: PROC-MK-BE-01
title: Best execution monitoring and periodic reporting
author: Saskia (Head of Global Markets, governance) · Zara (Chief Compliance Officer, governance)
date: 2026-05-16
owner: Saskia (Head of Global Markets, governance) · Zara (Chief Compliance Officer, governance)
status: POPULATED
policy-cited: Best Execution Policy (planned)
system-capability: "@platform/markets/best-execution (PLANNED)"
---

# Procedure — Best execution monitoring and periodic reporting

**Procedure ID:** PROC-MK-BE-01
**Owner:** Saskia (Head of Global Markets, governance) · Zara (Chief Compliance Officer, governance)
**Approval:** BRC (Best Execution Policy — planned)
**Cadence:** Per-trade (pre-trade assessment + post-trade quality check); quarterly reporting; annual policy review
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Best Execution Policy (planned; Zara + Saskia co-author; BRC approval required; FSP-licence-conditional).
- FAIS Policy v0.1 (STUB, FSP-conditional) — General Code of Conduct §3(1)(a) requires FSPs to act in the best interests of clients; best-execution discipline is the operational implementation of this duty.
- Decision record: `D-FSP-LICENCE-NECESSITY` (CEO-approved) — confirms institutional-only posture; best-execution duty applies to institutional clients in the OTC IRD and JSE markets context.

The obligation chain:

```
Regulation (FAIS Act s.16 + GCC §3 — client best interest; JSE Rules — execution quality)
  → Best Execution Policy (planned)
    → PROC-MK-BE-01 (this procedure)
      → @platform/markets/best-execution (PLANNED)
        → Execution quality records + quarterly FSCA report (if required)
```

**Build-phase posture:** Institutional-only FSP. Retail best-execution obligations (MiFID II-style mandatory best-execution reporting) do not apply. The FAIS GCC §3 best-interest duty applies from commencement of trading. Quarterly reporting to FSCA is contingent on FSCA supervisory direction; the procedure is designed to produce the report whether or not it is currently mandated.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CD-03` (FAIS Act s.16 + General Code of Conduct §3(1)(a)) | FSP must act in the best interests of clients and take all reasonable steps to ensure clients receive best available terms on orders executed on their behalf. |
| `ORG-CD-03` (GCC §7 — execution) | FSP must execute client orders promptly and fairly; price is the primary factor, but speed of execution, likelihood of execution, and costs are also material for OTC instruments. |
| `ORG-MK-01` (FMCA s.6 + CS 3/2018) | ODP's trading conduct is subject to FSCA ODP licence conduct standards; execution quality for OTC IRD is an ODP conduct obligation. |
| `ORG-MK-JSE-01` (JSE Rules — member obligations, execution quality) | JSE member banks are subject to JSE execution quality standards for exchange-listed instruments (bonds, equities). |
| `ORG-CD-03` (TCF Outcome 2 — fair treatment) | Clients must be able to demonstrate they received best available price and terms; TCF requires the FSP to monitor and report on execution quality. |

## 3. Purpose

1. Confirm — before each client order is executed — that the proposed execution venue, price, and terms represent the best reasonably available outcome for the client across price, speed, likelihood of execution, and costs.
2. Monitor post-trade execution quality by comparing achieved price against the relevant benchmark (mid-market, BESA composite, JSCC clearing price, or independent dealer quote) for each executed order.
3. Generate a quarterly best-execution quality report that documents execution quality across OTC IRD and JSE instruments, identifies any systematic shortfalls, and records remediation actions.
4. Conduct an annual review of the Best Execution Policy to confirm that the bank's execution approach remains aligned with market structure, FSCA guidance, and TCF principles.
5. Maintain an immutable typed evidence trail that enables the bank to demonstrate best-execution compliance to FSCA on demand.

## 4. Trigger

- **Pre-trade:** `ClientOrderReceived { orderId, clientId, product, notional, side, tenorYears, benchmarkPrice }` — emitted when a client order arrives at the bank's OTC desk or JSE trading interface.
- **Post-trade:** `TradeExecuted { tradeId, orderId, executedPrice, executedNotional, executionVenue, executedAt }` — triggers the execution-quality comparison step.
- **Quarterly:** `QuarterEndReached { quarter, year }` — triggers the best-execution quality report run.
- **Annual:** `AnnualPolicyReviewDue { policy: 'BestExecution', year }` — triggers the policy review cycle.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | On `ClientOrderReceived`: run pre-trade venue and price assessment; for OTC IRD: obtain at least two independent dealer quotes or a mid-market composite reference; for JSE instruments: obtain current JSE order-book best bid/offer | `agent` (Kai — trading system engineer) | `@platform/markets/best-execution` (PLANNED) | Quote sources: BESA composite feed, JSCC reference prices, Bloomberg mid-market (OTC IRD). Quote age must be within 5 minutes of order receipt. |
| 2 | Score the execution options across four dimensions: (1) price — primary factor; (2) speed of execution; (3) likelihood of execution; (4) total cost (commission, clearing, settlement); select the option with the highest composite score | `agent` (Kai) | `@platform/markets/best-execution` (PLANNED) | Scoring weights are set in the Best Execution Policy and must not be changed without BRC approval. Weights for institutional OTC IRD: price 70 %, speed 15 %, likelihood 10 %, cost 5 %. |
| 3 | Emit `BestExecutionAssessmentRecorded { orderId, assessedOptions, scoringWeights, selectedOption, assessedAt }` | `agent` | `@platform/event-store` | This event is the pre-trade best-execution record. It is immutable after emission. |
| 4 | Execute the order at the selected venue and price | `agent` (Kai — execution) | `@platform/markets/order-management` (PLANNED) | Execution is separate from the best-execution check; this procedure governs the assessment, not the execution mechanics. |
| 5 | On `TradeExecuted`: compare executed price against the pre-trade best-available reference price; compute execution quality (slippage in bps; positive = better than reference, negative = worse) | `agent` (Ravi — market risk quant engineer) | `@platform/markets/best-execution` (PLANNED) | Reference price: the assessment-time composite quote from step 1. Slippage > 5 bps (OTC IRD) or > 2 bps (JSE bonds) triggers a quality review. |
| 6 | Emit `ExecutionQualityRecorded { tradeId, orderId, executedPrice, referencePrice, slippageBps, qualityFlag: 'Acceptable' | 'ReviewRequired', recordedAt }` | `agent` | `@platform/event-store` | `ReviewRequired` flags are queued for Zara's (CCO, governance) weekly review. |
| 7 | For each `qualityFlag: 'ReviewRequired'` event: Zara (CCO, governance) reviews the slippage rationale (market dislocation? thin market? delay?); records a disposition: `Justified`, `Remediation required`, or `Systematic issue detected` | `human` (Zara — CCO, governance) | None — conduct judgment | Systematic issues trigger an immediate report to Saskia and Helena. Three `Systematic issue detected` dispositions in a quarter trigger a BRC briefing. |
| 8 | **Quarterly best-execution report.** On `QuarterEndReached`: aggregate all `ExecutionQualityRecorded` events for the quarter; compute per-product, per-desk, per-venue execution quality statistics (mean slippage, % Acceptable, % ReviewRequired, disposition breakdown) | `agent` (Ravi + Zara) | `@platform/markets/best-execution` (PLANNED) | Report covers: OTC IRD vanilla IRS, OTC IRD basis swaps, JSE government bonds, JSE equities (if applicable). |
| 9 | Zara (CCO, governance) reviews and signs off the quarterly report; if FSCA supervisory direction requires submission, Zara files the report via the FSCA FAIS portal; in all cases the report is filed in the compliance evidence store | `human` (Zara — CCO, governance) | `@regulatory/fsca-fais-portal` (PLANNED) | Until FSCA mandates quarterly submission, the report is an internal compliance artefact only. |
| 10 | Emit `BestExecutionQuarterlyReportFinalised { quarter, year, reportRef, submittedToFsca: boolean, finalisedBy: Zara, finalisedAt }` | `agent` | `@platform/event-store` | |
| 11 | **Annual policy review.** On `AnnualPolicyReviewDue`: Saskia (Head of Global Markets, governance) + Zara (CCO, governance) review the Best Execution Policy against: (a) current market structure for OTC IRD and JSE instruments; (b) FSCA regulatory guidance updates; (c) TCF Outcome 2 performance from the four quarterly reports; (d) industry best practice | `human` (Saskia + Zara) | None — policy judgment | Review may result in scoring weight amendments, venue list updates, or policy version uplift. All changes require BRC approval before taking effect. |
| 12 | Emit `BestExecutionPolicyReviewed { year, policyVersion, changesSummary, brcApprovalRequired: boolean, reviewedAt }` | `agent` | `@platform/event-store` | If BRC approval is required, the policy amendment follows the standard policy-governance workflow. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Kai (trading system engineer) | Pre-trade venue/price assessment (steps 1–3); order execution (step 4) |
| Ravi (market risk quant engineer) | Post-trade execution quality computation (steps 5–6); quarterly report aggregation (step 8) |
| Zara (Chief Compliance Officer, governance) | Weekly quality-flag review (step 7); quarterly report sign-off and filing (step 9); annual policy review (step 11) |
| Saskia (Head of Global Markets, governance) | Annual policy review (step 11); systematic-issue response; BRC briefing on execution shortfalls |
| Helena (Chief Risk Officer, governance) | Systematic-issue escalation; BRC briefing co-presenter |
| BRC | Best Execution Policy approval; scoring weight changes; annual review outcome |
| Vera (internal audit engineer, governance) | Quarterly assertion that every `ClientOrderReceived` has a downstream `BestExecutionAssessmentRecorded`; annual best-execution audit |

## 7. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| Individual trade slippage > 5 bps (OTC IRD) / > 2 bps (JSE) | Zara weekly review queue | Within 7 days |
| `Systematic issue detected` disposition | Saskia + Helena immediate notification | Same day |
| Three systematic issues in a quarter | BRC briefed; policy review brought forward | Next BRC meeting |
| FSCA supervisory enquiry on execution quality | Zara (lead) + Imani (legal-as-code engineer, legal) + Helena | Within FSCA response window |
| Annual policy review not completed | Vera finding escalated to Helena + BRC | Overdue date |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/markets/best-execution` | PLANNED | Pre-trade assessment, scoring, post-trade comparison, quarterly report generation |
| `@platform/markets/order-management` | PLANNED | Order receipt and execution routing |
| `@platform/event-store` | Live | Stores all typed best-execution events |
| `@platform/markets/price-feeds` | PLANNED | BESA composite, JSCC, Bloomberg mid-market feeds |
| `@regulatory/fsca-fais-portal` | PLANNED | FSCA FAIS portal submission integration |

## 9. Quality controls

- **Pre-trade coverage:** Every `ClientOrderReceived` must have a downstream `BestExecutionAssessmentRecorded` before `TradeExecuted`. Vera asserts this invariant daily; any gap is a Vera finding.
- **Post-trade coverage:** Every `TradeExecuted` must have a downstream `ExecutionQualityRecorded`. Missing quality records are a Vera daily finding.
- **Quarterly report timeliness:** `BestExecutionQuarterlyReportFinalised` must be emitted within 20 business days of `QuarterEndReached`. Lateness is a Vera finding escalated to Zara.
- **Annual policy review:** `BestExecutionPolicyReviewed` must be emitted within 30 business days of `AnnualPolicyReviewDue`. Lateness escalated to Saskia + BRC.
- **Scoring weight integrity:** `BestExecutionAssessmentRecorded.scoringWeights` must match the current approved policy weights at time of emission. Drift is a Vera finding.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `BestExecutionAssessmentRecorded` | Event log | 5 years (FMCA) | Pre-trade compliance record; immutable |
| `ExecutionQualityRecorded` | Event log | 5 years | Post-trade quality record |
| Zara's weekly quality-flag dispositions | Event log (`ExecutionQualityDispositionRecorded`) | 5 years | Governance sign-off trail |
| Quarterly best-execution report | Compliance evidence store (BLAKE3-addressed) | 7 years (FAIS records) | Internal artefact; submitted to FSCA if required |
| `BestExecutionQuarterlyReportFinalised` | Event log | 5 years | Report finalisation record |
| FSCA submission receipt (where applicable) | Regulatory correspondence store | 7 years | FAIS Act s.17 records obligation |
| `BestExecutionPolicyReviewed` | Event log | Permanent | Policy governance record |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Saskia (Head of Global Markets, governance) · Zara (Chief Compliance Officer, governance) | Initial POPULATED — pre-trade venue/price assessment, execution quality monitoring, quarterly report, annual policy review; 12-step workflow with typed events; institutional-only posture; FAIS GCC + TCF Outcome 2 sourcing. |
