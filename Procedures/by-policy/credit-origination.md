---
policy-parent: Credit Risk Policy (planned)
last-reviewed: 2026-05-16
procedureId: PROC-RISK-CO-01
title: Credit origination — counterparty credit limit approval
author: Helena (Chief Risk Officer, governance)
date: 2026-05-16
owner: Helena (Chief Risk Officer, governance)
status: POPULATED
policy-cited: Credit Risk Policy (planned)
system-capability: "@platform/risk/credit-limit-engine"
---

# Procedure — Credit origination — counterparty credit limit approval

**Procedure ID:** PROC-RISK-CO-01
**Owner:** Helena (Chief Risk Officer, governance)
**Approval:** Helena (within delegated authority) · Board Credit Committee (for limits above threshold)
**Cadence:** On-trigger (per new counterparty or limit extension request); annual (counterparty credit review)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Credit Risk Policy (planned; Helena to author; load-bearing at pre-licence go-live readiness gate).
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` §B2 — Credit appetite: aggregate counterparty credit exposure floor; single-name concentration limits; minimum external rating threshold.

The obligation chain:

```
Regulation (Banks Act Reg 29 — large exposures / BCBS large-exposure framework)
  → Credit Risk Policy
    → PROC-RISK-CO-01 (this procedure — counterparty credit limit approval)
      → @platform/risk/credit-limit-engine (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-04` (Banks Act Reg 29 — large exposures) | Single counterparty exposure limit ≤ 25% of qualifying capital; the bank must have a process to identify, approve, and monitor large exposures. |
| `ORG-PR-22` (BCBS large exposures framework — June 2014 / implemented via PA Directive) | Risk-based single-name concentration limits; the credit origination process must assess and respect the BCBS large-exposure cap. |
| `ORG-PR-10` (Banks Act s.60 — risk management) | Board is responsible for credit risk management; the Credit Risk Policy (and this procedure) is the instrument of that responsibility. |
| `ORG-PR-24` (PA Pillar 2 / ICAAP) | Credit risk Pillar 2 capital add-on is assessed partly on the adequacy of the credit limit-setting and monitoring process. |

## 3. Purpose

Govern the end-to-end process for establishing and extending credit exposure to counterparties with whom the bank transacts OTC derivatives (IRS, CRS, FRAs, options) or bond purchases. Before any transaction that creates or increases counterparty credit exposure, a credit limit must be approved and loaded in the credit-limit engine.

The procedure covers: (a) credit application from the markets desk (Saskia — derivatives trading desk, engineering); (b) counterparty credit assessment (financial analysis, external ratings, ISDA/CSA review); (c) limit approval by Helena within delegated authority; (d) board credit committee referral for limits above the CRO-delegation threshold; (e) limit loading and monitoring; (f) breach escalation.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| `CreditLimitApplicationSubmitted { counterpartyId, requestedLimit, currency, tenor, tradingDesk }` (Saskia) | New counterparty credit assessment — Steps 1–7 |
| `CreditLimitExtensionRequested { counterpartyId, currentLimit, requestedLimit, reason }` | Limit extension review — Steps 2–7 |
| Annual cadence (agent tick, 1 November): annual counterparty credit review | Annual refresh — Steps 2–5 |
| `CreditLimitBreached { counterpartyId, exposure, limit, severity }` | Breach escalation — Step 8 |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Credit application.** Saskia (Head of Global Markets) submits a `CreditLimitApplicationSubmitted` event specifying: counterparty ID (from party register), requested limit amount and currency, proposed tenor (revolving / term), product types (IRS, CRS, bonds, etc.), and commercial rationale. | `agent` (Saskia) | `@platform/party-register` ✓ + `@platform/risk/credit-limit-engine` (`PLANNED`) | Counterparty must already be onboarded via `counterparty-onboarding-markets.md` (PROC-MK-CO-01) before a credit application can be submitted. |
| 2 | **Counterparty financial analysis.** Helena (or delegated Rohan — market risk quant, engineering, for quantitative analysis) reviews: (a) latest audited financial statements; (b) external credit rating (Moody's / S&P / Fitch — minimum BBB- / Baa3 or equivalent per RAS); (c) capital adequacy ratios (for financial-institution counterparties); (d) liquidity ratios; (e) sector and geography concentration. | `agent` (Helena) + `agent` (Rohan) | `@platform/risk/credit-analysis` (`PLANNED`) | Event: `CreditAnalysisCompleted { counterpartyId, rating, capitalAdequacy, liquidityRatio, concentration, analystRef }`. Sub-investment-grade counterparties (below BBB-) require CEO approval for any limit, however small. |
| 3 | **ISDA / CSA assessment.** Imani (legal-as-code engineer) confirms: (a) ISDA Master Agreement status (executed / in negotiation / not in place); (b) Credit Support Annex (CSA) terms — threshold, minimum transfer amount, eligible collateral; (c) close-out netting enforceability in the counterparty's jurisdiction. | `agent` (Imani) | `@domains/legal/isda-registry` (`PLANNED`) | Event: `ISDACSAAssessmentCompleted { counterpartyId, isdaStatus, csaThreshold, mta, nettingEnforceable, jurisdictionOpinion }`. Limits above CRO-delegation threshold cannot be approved without a fully executed ISDA. |
| 4 | **Limit calculation.** Helena computes the proposed credit limit using: (a) counterparty rating-based limit matrix (per Credit Risk Policy); (b) RAS single-name concentration cap; (c) Banks Act Reg 29 large-exposure cap (25% of qualifying capital); (d) Potential Future Exposure (PFE) model output from Rohan for derivative exposures; (e) netting benefit from CSA (Step 3). | `agent` (Helena) + `agent` (Rohan — PFE model) | `@platform/risk/credit-limit-engine` (`PLANNED`) + `@platform/risk/pfe-model` (`PLANNED`) | Event: `CreditLimitProposed { counterpartyId, proposedLimit, currency, basis, largeExposurePct, rasHeadroomPct }`. PFE model is a substrate gap until the derivatives valuation engine is live. |
| 5 | **Limit approval.** Helena approves limits within her delegated authority (per `delegation-of-authority.md` PROC-GV-DOA-01 — Level 3). Limits above the CRO-delegation threshold are submitted to the Board Credit Committee (interim: CEO + BRC) via Owen's board paper process (`PROC-GOV-BP-01`). | `human` (Helena — approve) or Board Credit Committee | `@platform/risk/credit-limit-engine` (`PLANNED`) | Event: `CreditLimitApproved { counterpartyId, limit, currency, tenor, approvedBy, approvedAt, conditions[] }`. Conditions (e.g. ISDA execution required within 30 days; CSA threshold reduces after 12 months) are embedded in the approval event. |
| 6 | **Limit loading.** Helena (or system) loads the approved limit into the credit-limit engine. The markets desk (Saskia) receives a `CreditLimitLoaded` notification; trading can commence up to the approved limit from this point. | `system` | `@platform/risk/credit-limit-engine` (`PLANNED`) | Event: `CreditLimitLoaded { counterpartyId, limit, loadedAt, effectiveFrom }`. Pre-deal checks in the trading system query the limit engine before executing any trade. |
| 7 | **Annual review.** On the annual cadence: re-run Steps 2–5 for each active counterparty. Confirm the limit remains within regulatory caps (Reg 29) and RAS concentration limits given current exposure and capital levels. Update the limit up or down. Emit `CreditLimitAnnualReviewCompleted { counterpartyId, year, revisedLimit, rationale }`. | `agent` (Helena) + `agent` (Rohan) | `@platform/risk/credit-limit-engine` (`PLANNED`) | If the counterparty's rating has deteriorated below BBB- since last review: immediate watch-list and CEO notification. |
| 8 | **Breach escalation.** On `CreditLimitBreached`: (a) trading system immediately blocks further execution with the counterparty; (b) Helena informed in real time; (c) severity triage (see escalation matrix); (d) remediation (reduce exposure by novation / unwinding, increase limit if justified, or accept breach with CEO approval for the shortfall period). | `system` (automated block) + `agent` (Helena) | `@platform/risk/credit-limit-engine` (`PLANNED`) + `@platform/escalation` (existing) | Event: `CreditLimitBreachDisposed { counterpartyId, breachId, dispositionType, approvedBy, remediationDeadline }`. Any breach that persists > 1 business day requires BRC notification. |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Helena (Chief Risk Officer, governance) | Owns credit assessment; approves within delegated authority; chairs credit-limit review |
| Saskia (Head of Global Markets) | Initiates credit applications; operates within approved limits |
| Rohan (market risk quant, engineering) | Provides PFE model outputs and quantitative credit analysis |
| Imani (legal-as-code engineer) | ISDA/CSA assessment; netting enforceability opinion |
| CEO / Board Credit Committee | Approves limits above CRO-delegation threshold; sub-investment-grade counterparty limits |
| Owen (Company Secretary, governance) | Circulates above-threshold credit papers per PROC-GOV-BP-01 |

## 7. Escalation

| Scenario | Escalation path |
|---|---|
| Counterparty rating below BBB- (sub-investment grade) | Helena → CEO → BRC; limit subject to CEO approval regardless of amount |
| Limit breach (exposure > approved limit) | Immediate trading block; Helena; if > 1 day → BRC notification |
| Limit breaches Reg 29 large-exposure cap (25% qualifying capital) | Helena + CEO immediately; PA notification within 1 business day (Banks Act s.64 obligation) |
| ISDA not executed within condition period | Helena suspends limit; Imani pursues ISDA; CEO informed |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/risk/credit-limit-engine` | PLANNED | Limit storage, pre-deal checks, breach detection |
| `@platform/risk/credit-analysis` | PLANNED | Financial statement analysis, rating integration |
| `@platform/risk/pfe-model` | PLANNED | Potential Future Exposure model for derivative counterparties |
| `@domains/legal/isda-registry` | PLANNED | ISDA/CSA status tracking |
| `@platform/party-register` | ✓ live | Counterparty identity master |

## 9. Quality controls

- Vera recon: no open trading position with a counterparty without a current `CreditLimitLoaded` event.
- Vera recon: every active credit limit has an `CreditLimitAnnualReviewCompleted` event within the last 13 months.
- Vera recon: any counterparty rated below BBB- has a `CreditLimitApproved` event with `approvedBy` = CEO.
- Vera recon: all limits within Reg 29 large-exposure cap — daily automated check.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Full event chain per counterparty credit limit | Event log (P1) | 7 years post limit closure | Restricted |
| Financial analysis workings | RMS document store | 7 years | Confidential |
| ISDA/CSA documentation | Legal registry (Imani) | Contract period + 10 years | Legal-confidential |
| PFE model outputs | Event log + model audit trail | 7 years | Restricted |
| Credit limit approval records | Event log | Permanent | Restricted |

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Helena | Initial draft — PLANNED → POPULATED; full 11-section procedure; PFE model integration; ISDA/CSA gate; Reg 29 cap; annual review; breach escalation. |

## 12. Audit / assurance

- **Vera (ongoing):** limit-vs-exposure breach recon; Reg 29 cap daily check; annual-review completeness.
- **Thandiwe (CAE, governance):** annual audit of the credit limit-setting process; sample testing of limit approvals vs delegation matrix; opinion to BRC.
- **PA (SREP):** credit risk Pillar 2 assessment includes a review of counterparty limit-setting adequacy and large-exposure compliance.
