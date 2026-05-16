---
procedureId: PROC-MK-ODP-09
title: Exchange Control (Excon) compliance for OTC derivatives
author: Mira (regulatory intelligence engineer) · Eitan (treasury & ALM engineer) · Tomas (operations engineer)
date: 2026-05-16
owner: Eitan (treasury & ALM engineer) · Mira (regulatory intelligence engineer) · Ravi (market risk quant engineer)
status: POPULATED
policy-cited: Excon Compliance Policy (planned, markets bundle) · Funding Strategy Policy
system-capability: "@compliance/excon-screening · @regulatory/finsurv-client (PLANNED)"
---

# Procedure — Exchange Control (Excon) compliance for OTC derivatives

**Procedure ID:** PROC-MK-ODP-09
**Owner:** Eitan (treasury & ALM engineer) · Mira (regulatory intelligence engineer) · Ravi (market risk quant engineer)
**Approval:** ALCO + BRC
**Cadence:** Per-trade (scope assessment); periodic aggregate reporting per SARB FinSurv cadence; annual Excon framework review
**Version:** v0.2 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Excon Compliance Policy (planned, markets bundle; Eitan + Mira co-own the draft; ALCO + BRC approval required before first non-resident OTC IRD trade).
- Funding Strategy Policy — the Excon framework constrains which non-resident counterparty relationships the bank may pursue and on what terms.
- South African Reserve Bank Authorised Dealer Manual (Currency & Exchanges Manual) — the primary operational guidance for Excon compliance; chapter references cited per ORG codes below.
- SARB FinSurv Circulars — supplementary guidance issued by SARB's Financial Surveillance Department; relevant circulars identified by Mira at licence-application gate.

External Excon counsel (SARB-experienced S5 firm) is engaged pre-licence to ratify the scope-determination rules codified in this procedure. That engagement is a manual step (§8 step 1) and the counsel's opinion is a prerequisite artefact before the first non-resident OTC IRD trade.

The obligation chain:

```
Regulation (Currency & Exchanges Act 9 of 1933 + Exchange Control Regulations + SARB Authorised Dealer Manual)
  → Excon Compliance Policy (planned)
    → PROC-MK-ODP-09 (this procedure)
      → @compliance/excon-screening · @regulatory/finsurv-client (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-EXCON-ODP-001` (Currency & Exchanges Act 9 of 1933 + Exchange Control Regulations) | All cross-border capital flows and OTC derivative transactions between SA residents and non-residents require compliance with Excon; Authorised Dealers (banks registered with SARB as ADs) must apply Excon rules to every qualifying transaction. |
| `ORG-MK-08` (SARB Authorised Dealer Manual — Currency & Exchanges Manual Chapter F.4, derivatives) | Specific Excon requirements for derivative transactions involving non-resident counterparties, including permissible purposes, position limits, and reporting obligations to FinSurv. |
| `ORG-MK-07` (SARB Authorised Dealer Manual Chapter B.2 — capital flows) | Approval requirements and reporting obligations for non-resident capital flows; OTC IRD net flows (premium payments, settlement flows) may constitute reportable capital movements. |
| `ORG-PR-12` (Banks Act s.90 — SARB supervisory reporting) | SARB's Financial Surveillance Department (FinSurv) operates under delegated authority from the SARB Governor; AD banks report qualifying transactions via the FinSurv reporting system. |
| SARB FinSurv Circular AD (GNRO) — Derivatives (specific circular reference to be confirmed by Mira + external counsel at licence-application gate) | Operational guidance for the Excon reporting of OTC derivative transactions; format and timing of FinSurv submissions. |

## 3. Purpose

1. Screen every proposed OTC IRD trade for Excon implications before execution — identifying whether the counterparty is a non-resident, whether any leg of the trade creates a cross-border capital flow, and whether FinSurv approval or reporting is required.
2. Obtain any required FinSurv pre-approval before trade execution (where applicable) and file FinSurv post-trade reports within the regulatory window.
3. Maintain an immutable typed record of every Excon scope assessment and FinSurv report so that the bank can demonstrate compliance to SARB and respond to supervisory enquiries.
4. Track aggregate Excon exposure and reporting obligations in the aggregate FinSurv reporting cycle.
5. Engage and maintain the external Excon counsel relationship for legal opinions on novel scope questions and for ratification of the scope-determination rules before the bank's first non-resident trade.

## 4. Trigger

- **Pre-trade (primary):** `OtcTradeProposed { tradeId, product, notional, currency, counterpartyId, tenorYears }` — emitted by the pre-trade workflow (Kai's pre-trade gateway) when a new trade is being structured.
- **Counterparty onboarding:** `CounterpartyOnboardingInitiated { counterpartyId, entityType, jurisdiction, residencyStatus }` — where `residencyStatus: 'nonResident'` or jurisdiction is not South Africa; triggers a counterparty-level Excon eligibility assessment before any trades.
- **Aggregate reporting cycle:** `ExconReportingWindowOpen { reportingPeriod, reportType }` — emitted by the FinSurv reporting scheduler (monthly / quarterly per FinSurv cadence).
- **Annual framework review:** `ExconFrameworkAnnualReviewDue { reviewYear }` — triggers Mira's annual review of the Excon framework and scope-determination rules against any SARB FinSurv circular updates.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | On `OtcTradeProposed` or `CounterpartyOnboardingInitiated`: run Excon scope screen — is the counterparty a non-resident (SARB Excon definition)? Does any leg of the trade involve a cross-border capital flow? Is the underlying asset or currency pair within the Excon Manual Chapter F.4 scope? | `agent` (Mira) | `@compliance/excon-screening` (PLANNED) | The scope screen uses the Excon scope-determination ruleset ratified by external Excon counsel (manual step §8 step 1). Non-resident counterparty + OTC IRD = prima facie in scope; resident-only trades are out of scope. |
| 2 | Emit `ExconScopeAssessed { tradeId / counterpartyId, inScope, scopeBasis, residencyStatus, capitalFlowType, assessedBy, assessedAt }` — `inScope: true` or `false` with documented basis | `system` | `@platform/event-store` | `scopeBasis` references the specific Excon Manual chapter or counsel opinion that supports the assessment. This event is the authoritative record for the Excon scope determination. |
| 3 | **If `inScope: false`:** no further Excon action required; emit `ExconScopeCleared { tradeId / counterpartyId, assessedAt }`; pre-trade gateway proceeds with the trade; Excon assessment is complete | `system` | `@platform/event-store` | Out-of-scope assessment must still be documented (step 2); the absence of a scope event is itself a finding. |
| 4 | **If `inScope: true` — pre-approval check.** Eitan (treasury & ALM engineer) + Mira assess whether FinSurv pre-approval is required for the specific transaction type; consult the Excon Manual Chapter F.4 approval-requirement matrix and the external counsel opinion | `agent` (Eitan + Mira) | (manual assessment referencing the approved ruleset) | Pre-approval requirements vary by transaction type, notional size, tenor, and counterparty jurisdiction. For OTC IRD between SA bank and non-resident financial institution: Mira's working assumption (pending counsel confirmation) is that pre-approval is not required for vanilla IRS / OIS within standard market practice parameters; exotic / cross-currency structures may require pre-approval. |
| 5 | **If pre-approval required:** Eitan submits the FinSurv pre-approval application via the SARB FinSurv online portal (or manual form); tracks the application; trade execution is blocked until approval is received | `agent` (Eitan) | `@regulatory/finsurv-client` (PLANNED) | Manual submission until `@regulatory/finsurv-client` is built. Application includes: trade economics summary, counterparty details (LEI, residency status, jurisdiction), purpose of the derivative, expected cash flows. |
| 6 | On receipt of FinSurv pre-approval (or determination that pre-approval is not required): emit `ExconApprovalObtained { tradeId, finSurvRef, approvalType, approvedAt }` (or `ExconPreApprovalNotRequired { tradeId, basis, assessedAt }`); release the pre-trade gate | `system` | `@platform/event-store` + `@trading/pre-trade-gate` (PLANNED) | The pre-trade gate is held in `blocked_excon` state until one of these two events is in committed state. |
| 7 | **Post-trade FinSurv report.** After `OtcTradeExecuted` for an in-scope trade: Tomas (operations engineer) compiles the FinSurv post-trade report in the required format (per SARB FinSurv Circular AD GNRO or equivalent); submit via the FinSurv reporting system within the required window | `agent` (Tomas + Mira) | `@regulatory/finsurv-client` (PLANNED) | Tomas handles operational submission; Mira reviews for regulatory accuracy. The report includes: trade economics, counterparty LEI, currency flows, settlement dates. |
| 8 | Emit `ExconReportFiled { tradeId, finSurvRef, reportType, filedAt, reportingPeriod }` | `system` | `@platform/event-store` | `finSurvRef` is the SARB reference number assigned on acceptance; if not immediately available, update the event on receipt. |
| 9 | **Aggregate periodic reporting.** On `ExconReportingWindowOpen { reportingPeriod }`: Mira + Tomas compile the aggregate FinSurv periodic report — summary of all in-scope OTC IRD trades for the period: trade count, aggregate notional by currency pair, net capital flows, report against FinSurv position limits | `agent` (Mira + Tomas) | `@regulatory/finsurv-client` (PLANNED) + `@platform/reporting/finsurv-aggregate` (PLANNED) | Aggregate report is reviewed by Eitan and approved by Helena (Chief Risk Officer, governance) or Zara (CCO, governance — conduct dimension) before submission. |
| 10 | Emit `ExconAggregateReportFiled { reportingPeriod, finSurvRef, tradeCount, aggregateNotional, netCapitalFlows, filedAt }` | `system` | `@platform/event-store` | |
| 11 | **Annual Excon framework review.** On `ExconFrameworkAnnualReviewDue`: Mira reviews the Excon scope-determination rules against any new SARB FinSurv circulars, Authorised Dealer Manual updates, or court decisions affecting Excon interpretation; updates the ruleset; re-engages external Excon counsel if material changes | `agent` (Mira) + external counsel (if needed) | (manual; codified outcome emitted as `ExconFrameworkReviewed { reviewYear, changesFound, updatesApplied }`) | Annual review is a BRC-reportable item; Eitan presents the findings to ALCO. |

## 6. Reconciliation

- **Events produced:**
  - `ExconScopeAssessed { tradeId / counterpartyId, inScope, scopeBasis, assessedAt }`
  - `ExconScopeCleared { tradeId / counterpartyId }` — on out-of-scope determination
  - `ExconApprovalObtained { tradeId, finSurvRef, approvalType }` — on FinSurv pre-approval
  - `ExconPreApprovalNotRequired { tradeId, basis }` — on no-pre-approval determination
  - `ExconReportFiled { tradeId, finSurvRef, reportType, filedAt }`
  - `ExconAggregateReportFiled { reportingPeriod, finSurvRef, aggregateNotional }`
  - `ExconFrameworkReviewed { reviewYear, changesFound }`
- **Reconciliation checks (Vera asserts):**
  - Every `OtcTradeProposed` for a non-resident counterparty has a downstream `ExconScopeAssessed` event before `OtcTradeExecuted`.
  - Every `ExconScopeAssessed { inScope: true }` has a downstream `ExconApprovalObtained` or `ExconPreApprovalNotRequired` before `OtcTradeExecuted`.
  - Every `OtcTradeExecuted` for an in-scope counterparty has a downstream `ExconReportFiled` within the regulatory filing window.
  - Every `ExconReportingWindowOpen` has a downstream `ExconAggregateReportFiled` within the window.
  - Annual `ExconFrameworkAnnualReviewDue` has a downstream `ExconFrameworkReviewed` within 30 calendar days.
- **Failure mode:** `@compliance/excon-screening` unavailable → Mira runs the scope assessment manually using the Excon Manual and counsel ruleset; all manual steps are documented and the results entered into the event store manually with `ManualExconScreenFlag { tradeId, reason }`.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| All `Excon*` events | Event log (`@platform/event-store`) | Permanent (Principle 1) + SARB retention minimum 5 years | Restricted — regulatory and counterparty commercial data |
| FinSurv pre-approval applications and approvals | Document store (BLAKE3-addressed) | 5 years (SARB minimum) + permanent in event log | Restricted — regulatory |
| FinSurv post-trade report submissions | Document store | 5 years | Restricted |
| FinSurv aggregate periodic reports | Document store | 5 years | Restricted |
| External Excon counsel opinions | Document store | Permanent (legal opinion) | Legal privilege; Eitan + Imani manage access |
| Annual framework review records | Document store + Excon register projection | 7 years | Internal — restricted to compliance + treasury |

## 8. Manual steps

1. **External Excon counsel engagement (pre-first trade):** Before the first non-resident OTC IRD trade, Eitan and Mira must engage an SARB-experienced external counsel (S5 firm) to ratify the Excon scope-determination rules and to provide a legal opinion on the treatment of vanilla OTC IRD vs exotic / cross-currency structures. This opinion is the legal basis for step 4's pre-approval assessment and must be in the document store before the pre-trade gate is opened for non-resident trades. Owner: Eitan + Mira; timing: licence-application gate.
2. **FinSurv pre-approval submission (step 5):** Until `@regulatory/finsurv-client` is built, FinSurv pre-approval applications are submitted manually via the SARB FinSurv portal by Eitan; application form populated by Tomas + Mira.
3. **Post-trade FinSurv report (step 7):** Until the automated FinSurv reporting module is built, reports are compiled manually by Tomas in the FinSurv-prescribed format; reviewed by Mira; submitted by Eitan via the FinSurv portal.
4. **Aggregate periodic report compilation (step 9):** Manual aggregation from `ExconReportFiled` events across the reporting period; Mira runs the aggregation query; Tomas formats the submission.
5. **Annual framework review — counsel re-engagement (step 11):** Where SARB FinSurv issues material new circulars or the Authorised Dealer Manual is updated, Mira's annual review may require re-engagement of external counsel; this is a manual, judgment-based step.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| OTC trade executed with non-resident counterparty without Excon scope assessment | Vera invariant: `OtcTradeExecuted` for non-resident counterparty without `ExconScopeAssessed` | Mira + Eitan immediately; Helena (CRO) + Zara (CCO); potential SARB Excon contravention; remediation report within 5 BD |
| In-scope trade executed without FinSurv pre-approval (where required) | Vera invariant: `OtcTradeExecuted` with `ExconScopeAssessed { inScope: true }` but no `ExconApprovalObtained` | Eitan + Mira; Helena + Zara; potential Excon contravention; engage external counsel; self-report to SARB FinSurv within 5 BD |
| FinSurv post-trade report missed | `OtcTradeExecuted` in-scope without `ExconReportFiled` within filing window | Tomas + Mira; late filing with explanation; Zara + Helena informed |
| Aggregate periodic report not filed within window | `ExconReportingWindowOpen` without `ExconAggregateReportFiled` | Mira + Eitan; escalate to Zara; file with late explanation; SARB FinSurv may impose penalty |
| SARB FinSurv queries or investigation | SARB FinSurv correspondence received | Eitan + Mira + Helena; external Excon counsel engaged immediately; Zara coordinates the response; Owen (Company Secretary, governance) notified |
| External counsel opinion unavailable before first non-resident trade | Procurement / onboarding delay | Eitan escalates to CEO; first non-resident trade blocked until opinion received |

## 10. Related procedures

- [`counterparty-onboarding-markets.md`](counterparty-onboarding-markets.md) (PROC-MK-ODP-02) — counterparty residency status and jurisdiction (needed for step 1) is established during onboarding.
- [`client-categorisation.md`](client-categorisation.md) (PROC-MK-ODP-08) — Excon scope-assessment and categorisation are parallel pre-trade gateway checks; both must clear before trading.
- [`otc-confirmation.md`](otc-confirmation.md) (PROC-MK-ODP-06) — post-execution confirmation records include Excon scope and approval references for in-scope trades.
- [`ba-return-generation.md`](ba-return-generation.md) — BA 910 and related returns may include Excon-relevant derivative exposures; Mira cross-checks.
- [`fic-submission-cycle.md`](fic-submission-cycle.md) — FIC submissions may intersect with cross-border flows subject to Excon; Mira reconciles overlapping obligations.
- [`excon-otc-derivatives.md`](excon-otc-derivatives.md) — this procedure (self-reference for the annual review trigger).

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-07 | Eitan (treasury & ALM engineer) · Mira (regulatory intelligence engineer) · Ravi (market risk quant engineer) | Initial STUB |
| v0.2 | 2026-05-16 | Mira (regulatory intelligence engineer) · Eitan (treasury & ALM engineer) · Tomas (operations engineer) | STUB → POPULATED: full 12-section procedure; pre-trade Excon scope screen; pre-approval pathway; post-trade and aggregate FinSurv reporting; external counsel engagement as named manual step; annual framework review; full event schema. |

## 12. Audit / assurance

- **Vera daily:** pre-trade gate check — no `OtcTradeExecuted` for non-resident counterparty without `ExconScopeAssessed`; every in-scope trade has either `ExconApprovalObtained` or `ExconPreApprovalNotRequired` before execution.
- **Vera monthly:** post-trade report filing completeness — every in-scope `OtcTradeExecuted` has a downstream `ExconReportFiled` within the filing window; flag late filings to Mira and Eitan.
- **Vera periodic:** aggregate report reconciliation — `ExconAggregateReportFiled.tradeCount` matches the count of `ExconReportFiled` events for the period.
- **Thandiwe (CAE, governance):** annual audit of the Excon compliance framework; sample testing of scope assessments against the counsel opinion; FinSurv report completeness; Currency & Exchanges Act alignment; opinion reported to Audit Committee.
- **SARB FinSurv supervisory:** Excon compliance is subject to SARB Financial Surveillance examination; any Excon contravention is reportable to SARB; the bank as an Authorised Dealer bears direct regulatory accountability; Eitan + Helena manage supervisory engagement.
