---
procedureId: PROC-RISK-CLM-01
title: Credit risk limit management
author: Helena (Chief Risk Officer, governance)
date: 2026-05-20
owner: Helena (Chief Risk Officer, governance)
status: POPULATED
policy-cited: credit-risk-policy-v1
system-capability: "@platform/risk/credit-limit-engine (PLANNED)"
---

# Procedure — Credit risk limit management

**Procedure ID:** PROC-RISK-CLM-01
**Owner:** Helena (Chief Risk Officer, governance)
**Approval:** Helena (within CRO delegated authority) · Credit Risk Committee (CRC, above CRO threshold) · Board Risk Committee (BRC, above CRC threshold; sub-IG; SWWR) · CEO (interim Board, LEX-cap exceptions) · Prudential Authority (LEX cap exceptions per D3/2022)
**Cadence:** On-trigger (per new application, extension, breach); annual review per counterparty; daily limit-utilisation recon
**Version:** v0.1 — 2026-05-20
**Status:** POPULATED
**Standing authority:** `D-CREDIT-LIMIT-ENGINE-BUILD` (CEO-approved 2026-05-20)

## 1. Source policy

- [`Policies/credit-risk-policy-v1.md`](../../Policies/credit-risk-policy-v1.md) (IN FORCE 2026-05-13, owner: Helena (Chief Risk Officer, governance)) — specifically:
  - **§2 (Large Exposures regime)** — LEX definition, single-counterparty cap (25% of eligible capital), connected-counterparty groups, internal sub-limit principles (IG ≤ 20%; sub-IG ≤ 10%; sovereign/MDB monitoring only).
  - **§3 (Counterparty Credit Risk Standards and Limits)** — investment-grade floor; sub-investment-grade BRC approval; sector concentration ≤ 25%; geographic monitoring threshold.
  - **§7 (Credit Risk Governance and Monitoring)** — CRC charter; authority matrix (lines 229–234 defer the operational matrix to this procedure).
  - **§8 (Exceptions and Escalation)** — 90-day exception cap; PA escalation; remediation plan.
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` §B2 — credit appetite, single-name concentration, minimum external rating threshold (BBB−/Baa3) per the RAS.

The obligation chain (Principle 2):

```
Regulation (Banks Act Reg 29 single-name LEX cap; LEX Directive D3/2022;
            BCBS large-exposures framework; Banks Act s.60 risk management)
  → Policy: credit-risk-policy-v1 (§2 LEX regime; §3 CCR standards; §7 governance)
    → PROC-RISK-CLM-01 (this procedure — operational authority matrix, sub-limit schedule,
                        connected-group aggregation, exception workflow, breach procedure)
      → @platform/risk/credit-limit-engine (PLANNED)
        → @platform/risk/sa-ccr (PLANNED, EAD input)
        → @platform/party-register (✓ live, counterparty + connected-group lookup)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-09` (Banks Act Reg 29 — single-name large exposure capped at regulatory ceiling) | Single counterparty / connected-counterparty group exposure ≤ 25% of qualifying capital; the bank must identify, approve, and monitor large exposures. |
| `ORG-PR-10` (sector concentration limit) | Sector concentration ≤ 25% of total exposure without explicit BRC approval. |
| `ORG-PR-16` (counterparty credit exposure managed) | CCR identified, measured, and managed; netting recognised only under legally-enforceable ISDA / GMRA. |
| `ORG-PR-22` (BCBS large exposures framework — June 2014 / BCBS 283; superseded by BCBS 346 April 2019 `[citation: TBC — precise BCBS 346 final standard reference; Mira (Regulatory intelligence engineer, compliance) follow-on]`) | Risk-based single-name concentration limits using Tier 1 capital as the LEX denominator; aggregation under the control / interdependence tests. |
| `ORG-PR-40` (SA large-exposures regime — LEX Directive D3/2022) | Operational large-exposure rules: connected-counterparty-group aggregation; exempt-exposures schedule; BA 600 monthly return; exception process. |

## 3. Purpose

This procedure operationalises the credit-limit authority matrix and sub-limit schedule that `credit-risk-policy-v1.md` §2 and §7 defer to it. Until this procedure is in force the `@platform/risk/credit-limit-engine` cannot be authoritatively built, because the engine requires the numeric thresholds, the actor-role hierarchy for limit approval, and the exception-workflow event semantics that are documented here.

Specifically the procedure governs:

1. The **rating-based limit matrix** — specific notional caps (and % of eligible capital caps) by external rating band, calibrated against the bank's target R300m licence-day capital base and aligned with the policy §3 sub-limit principles.
2. The **CRO delegation threshold** — the numeric line between Helena solo-approval, CRC approval, and BRC / CEO approval; calibrated to make the policy §7 line 231–232 wording ("below sub-limit: front office; sub-limit exception: CRC") concrete.
3. The **connected-counterparty-group aggregation rules** — how the LEX-relevant control and interdependence tests are operationalised; the maintenance of the connected-group register by Imani (Legal-as-code engineer, engineering).
4. The **exception workflow** — time-limited (≤ 90 days per policy §8) CRC and BRC approval paths; the `CrcLimitExceptionApproved` and `BrcLimitExceptionApproved` events; the BRC renewal path for exceptions extending past 90 days.
5. The **sub-investment-grade approval workflow** — BRC approval is required regardless of size per policy §3 line 146; the `SubInvestmentGradeCounterpartyApproved` event chain.

The procedure is the policy input to `@platform/risk/credit-limit-engine` (PLANNED — discharge of the build authorised by `D-CREDIT-LIMIT-ENGINE-BUILD`). It is also a prerequisite for closing the PLANNED status of the engine cited by PROC-RISK-CO-01 (credit-origination), PROC-MK-CO-01 Gate 4 (counterparty-onboarding-markets), and PROC-MK-PCG-01 Check 1(c) (pre-trade-conduct-gate).

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| `CreditLimitApplicationSubmitted { counterpartyId, requestedLimit, currency, tenor, tradingDesk, externalRating }` | New counterparty limit — Steps 1–6 (calibration + approval + load) |
| `CreditLimitExtensionRequested { counterpartyId, currentLimit, requestedLimit, reason }` | Existing-counterparty extension — Steps 2–6 |
| Annual cadence (agent tick, 1 November per counterparty cohort) | Annual refresh — Steps 2–4 + re-confirmation |
| `CreditLimitBreached { counterpartyId, exposure, limit, utilisationPct, severity }` | Breach handling — Step 7 (severity triage) + Step 8 (escalation) |
| `LexUtilisationComputed { counterpartyId, groupId, utilisationPct }` ≥ 80% | Amber alert — Step 7 Amber path |
| `ConnectedCounterpartyGroupUpdated { groupId, members[] }` | Group-level re-aggregation — Step 5 |
| `CrcLimitExceptionApproved` or `BrcLimitExceptionApproved` reaching expiry (90-day default) | Exception expiry — Step 6 expiry path |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Rating-based proposed-limit calibration.** On `CreditLimitApplicationSubmitted` (or extension), the engine produces the maximum permissible exposure for the counterparty using (a) the rating-band cap from the matrix in §5.1 below; (b) the LEX sub-limit principle from policy §3 (IG ≤ 20%; sub-IG ≤ 10%; sovereign/MDB monitoring only); (c) the prevailing eligible-capital base from Camille (Chief Financial Officer, governance)'s capital-adequacy projection. | `system` + `agent` (Rohan — Market risk quantitative engineer, engineering, for SA-CCR EAD) | `@platform/risk/credit-limit-engine` (PLANNED) + `@platform/risk/sa-ccr` (PLANNED) | Event: `CreditLimitProposed { counterpartyId, proposedLimit, currency, ratingBand, sublimitPctOfCapital, lexCapPct, basis }`. The proposed limit is the binding ceiling for all subsequent approval paths. |
| 2 | **Connected-counterparty-group aggregation.** Imani (Legal-as-code engineer, engineering, steward of the connected-group register per policy §2) queries the party register for the proposed counterparty's group membership. Group identification applies the two D3/2022 tests: **control test** (one party directly or indirectly controls the other per IFRS 10 control definition `[citation: TBC — IFRS 10 paragraph reference; Mira follow-on]`); **interdependence test** (financial difficulties of one would cause financial difficulties in the other; LEI hierarchy + economic dependence + control rights). The aggregated group exposure is the sum of all member-counterparty proposed and existing limits. | `agent` (Imani) | `@platform/party-register` ✓ live + `@platform/risk/credit-limit-engine` (PLANNED) | Event: `ConnectedCounterpartyGroupResolved { counterpartyId, groupId, members[], aggregatedExposure, aggregatedProposedLimit, controlTestApplied, interdependenceTestApplied }`. If the group aggregated exposure crosses an authority threshold (§5.2 below), the higher authority approves. |
| 3 | **Authority routing.** The engine routes the proposed limit (or group-aggregated limit, whichever is higher) to the authority level per the matrix in §5.2. The routing is deterministic: rating band × proposed-limit-or-group-aggregate × policy gate (sub-IG / SWWR / sovereign). | `system` | `@platform/risk/credit-limit-engine` (PLANNED) | Event: `CreditLimitRoutedForApproval { counterpartyId, authority: "CRO" \| "CRC" \| "BRC" \| "CEO+PA", basis }`. Routing decision is recorded; any override requires `LimitAuthorityRoutingOverridden` with reason and approver. |
| 4 | **Approval.** The routed authority approves or declines. **CRO authority:** Helena (Chief Risk Officer, governance) approves solo and emits `CreditLimitApprovedByCRO`. **CRC authority:** Helena chairs CRC; quorum (Helena + Rohan + Imani + a peer attendance) records `CrcLimitApprovedAt { meetingDate, quorum, resolutions[] }`; emits `CreditLimitApprovedByCRC`. **BRC authority:** Owen (Company Secretary, governance) circulates a board paper per PROC-GOV-BP-01; BRC (interim: CEO under `D-THIN-HUMAN-LAYER-MINIMUM`) approves; emits `CreditLimitApprovedByBRC`. **LEX-cap authority:** CEO approval plus PA notification under D3/2022 `[citation: TBC — D3/2022 exception process; Imani + external counsel ratify at the licence-application gate]`; emits `CreditLimitApprovedByCEOPA`. Sub-investment-grade counterparties go to BRC regardless of size (policy §3 line 146) and emit `SubInvestmentGradeCounterpartyApproved { counterpartyId, ratingAtApproval, approvalDate, reviewDate, brcMeetingRef }`. | `human` (Helena / CRC / BRC / CEO) | `@platform/risk/credit-limit-engine` (PLANNED) + `@platform/escalation` ✓ existing | The approval event records: approver, conditions (e.g. ISDA execution required within 30 days; CSA threshold steps down after 12 months; quarterly CRC review for sub-IG), and expiry (typically annual; max 13 months for the annual-review recon). |
| 5 | **Limit loading and notification.** The approved limit is loaded into `@platform/risk/credit-limit-engine`. Saskia (Head of Global Markets) — and any other consuming trading desk — is notified. Pre-deal checks in the trading systems query the engine on every new transaction. | `system` | `@platform/risk/credit-limit-engine` (PLANNED) | Event: `CreditLimitLoaded { counterpartyId, limit, currency, loadedAt, effectiveFrom, expiryAt, conditions[] }`. Trading is permitted up to the limit from `effectiveFrom`. |
| 6 | **Exception workflow.** Any transaction that would breach the loaded limit but remain within the 25% regulatory LEX cap requires CRC approval before execution (`CrcLimitExceptionApproved { counterpartyId, exceptionType, expiryDate, exposureCeiling }`). Any transaction requiring an exposure above the 25% LEX cap requires CEO approval and PA notification (`LexExceptionApproved { approver, exceptionType, expiryDate }` and `PaLexApprovalConfirmed` once the PA acknowledges per D3/2022). All exceptions are **time-limited to a maximum of 90 days** per policy §8; renewals require BRC approval and a fresh `BrcLimitExceptionApproved` event. Exceptions not renewed at expiry are auto-lapsed by the engine; the CRC is notified via `LimitExceptionLapsed { counterpartyId, exceptionId, lapseDate }`. | `human` (CRC / BRC / CEO) + `system` (auto-lapse) | `@platform/risk/credit-limit-engine` (PLANNED) | A SWWR-classified exposure (per policy §6) requires BRC approval regardless of size and emits `WrongWayRiskExceptionApproved { transactionId, counterpartyId, classification, brcMeetingRef }`. |
| 7 | **Daily monitoring + Amber / Red triage.** The credit-limit engine ingests `LexUtilisationComputed` from the SA-CCR engine (Rohan owns) and applies the traffic-light per policy §1.4: **Amber (80–89%)** — CRC chair (Helena) and EXCO notified; exposure review initiated; no new transactions with the counterparty or sector until review. **Red (90–100%)** — CRC + BRC + CEO notified; transactions suspended; remediation plan within 5 business days. **Critical-Red (≥ 100% without PA approval)** — immediate CEO notification; PA notification under D3/2022 `[citation: TBC — D3/2022 notification deadline; Imani + external counsel ratify]`; `LexBreachIdentified` event emitted immediately; transaction unwound or hedged per D3/2022 unless the PA grants a dispensation. | `system` (automated detection) + `agent` (Helena) | `@platform/risk/credit-limit-engine` (PLANNED) + `@platform/escalation` ✓ | Event chain: `CreditLimitUtilisationTrafficLight { counterpartyId, utilisationPct, severity }` → severity-specific notification events. |
| 8 | **Annual review.** On the annual cadence per counterparty (default tick: 1 November per cohort), the procedure re-runs Steps 1–4. Confirms: (a) external rating still ≥ floor (BBB− / Baa3 or BRC-approved sub-IG); (b) limit remains within the rating-band matrix and the current eligible-capital base; (c) any exceptions expired in the period; (d) group aggregation still correct. Emits `CreditLimitAnnualReviewCompleted { counterpartyId, year, revisedLimit, rationale, ratingAtReview }`. If the counterparty's rating has deteriorated below the floor: immediate watch-list; CEO notification; BRC review at next meeting. | `agent` (Helena) + `agent` (Rohan) | `@platform/risk/credit-limit-engine` (PLANNED) | Vera recon `recon:credit-limit-annual-review-staleness` (planned, gated by engine build) — any limit without an annual-review event within 13 months is a P2 finding. |

### 5.1 Rating-based limit matrix

The matrix below operationalises policy §3 sub-limit principles in **specific** numbers, calibrated against the bank's target **R300m licence-day eligible-capital base**. Caps are expressed both as a percentage of eligible capital (the binding regulatory metric) and as an indicative ZAR notional ceiling at the R300m capital level (for the engine's pre-deal-check fast path; the engine recomputes against the live eligible-capital figure on each application).

| Rating band (S&P / Fitch / Moody's equivalent) | Sub-limit (% of eligible capital) | Indicative ZAR ceiling at R300m capital | Notes |
|---|---|---|---|
| AAA / Aaa | 20% (LEX-cap-adjacent ceiling per policy §2) | R60m | Single-name; aggregate group exposure also capped at 20%. The LEX cap remains the binding regulatory ceiling at 25% — the 20% sub-limit creates a 5-percentage-point internal buffer per policy §3. |
| AA range (AA+ to AA−) / Aa1–Aa3 | 20% | R60m | Same buffer logic; rating diversity used to manage portfolio concentration. |
| A range (A+ to A−) / A1–A3 | 17.5% | R52.5m | Stepped down from the AAA / AA tier to reflect the credit-quality differential while remaining within the investment-grade tranche per policy §3. |
| BBB range (BBB+ to BBB−) / Baa1–Baa3 | 15% (max IG sub-limit floor) | R45m | The lowest IG band; calibrated to leave headroom for downgrade migration before the limit would force forced reduction. BBB− at the boundary requires CRC review on any extension request. |
| Sub-investment grade (BB+ and below / Ba1 and below) — **BRC-approved counterparties only** | 10% (policy §3 line 146 cap) | R30m | BRC approval is a prerequisite; no transaction without `SubInvestmentGradeCounterpartyApproved` event. Quarterly CRC review of the exposure (policy §3 line 146 condition). |
| Sovereign / SARB (LEX-exempt per policy §2) | Monitoring only at v0; no internal sub-limit applied | n/a | Reported in the BA 600 exempt category. CRC may set a monitoring threshold (default: 40% of EAD in any non-SA sovereign) per policy §3 geographic-concentration principle. |
| Multilateral development bank (MDB) with 0% RWA (LEX-exempt) | Monitoring only at v0 | n/a | Same treatment as sovereign. |
| Unrated counterparty | No automatic limit | n/a | Requires Helena's credit assessment and CRC approval before onboarding per policy §3 line 145. The CRC sets a counterparty-specific sub-limit at approval; the matrix above does not apply by rating. |

Calibration rationale: the 20% / 17.5% / 15% / 10% ladder leaves a regulatory headroom of 5 percentage points between the IG ceiling (20%) and the Reg 29 / D3/2022 LEX cap (25%); a further 5-percentage-point ladder gap between the IG sub-limit floor (15% at BBB) and the sub-IG ceiling (10%) creates a step-change at the IG / sub-IG boundary, consistent with policy §3 line 146's enhanced-control treatment of sub-IG exposures. The R300m licence-day base is the planning anchor per `project_strategic_foundation.md`; at licence-day the engine recomputes against the actual eligible-capital figure.

### 5.2 CRO / CRC / BRC / CEO authority matrix

The authority matrix below makes policy §7 line 231–232 ("below sub-limit: front office; sub-limit exception: CRC") concrete. Authority is the **higher** of: (a) the proposed-limit's % of eligible capital; (b) the group-aggregated exposure's % of eligible capital; (c) any policy-gate trigger (sub-IG, SWWR, sovereign exception).

| Proposed limit (% of eligible capital) | Indicative ZAR at R300m | Authority | Event |
|---|---|---|---|
| Up to 1% (≤ R3m at R300m) | ≤ R3m | **CRO (Helena solo)** | `CreditLimitApprovedByCRO` |
| 1% – 5% (R3m – R15m) | R3m – R15m | **CRC** (Helena chairs + Rohan + Imani + peer-attendance quorum) | `CreditLimitApprovedByCRC` + `CrcMinutesApproved` |
| 5% – 20% (R15m – R60m) | R15m – R60m | **BRC** (interim: CEO under `D-THIN-HUMAN-LAYER-MINIMUM`) | `CreditLimitApprovedByBRC` |
| 20% – 25% (R60m – R75m) — within LEX cap | R60m – R75m | **BRC + CEO** (joint; sub-limit-exception territory above the 20% IG ceiling) | `CreditLimitApprovedByBRC` + `BrcLimitExceptionApproved` |
| ≥ 25% (above LEX cap) | ≥ R75m | **CEO + PA approval** under D3/2022 `[citation: TBC — D3/2022 exception process]` | `LexExceptionApproved` + `PaLexApprovalConfirmed` |

**Policy-gate overrides** (always escalate regardless of size):

| Trigger | Required authority | Event |
|---|---|---|
| Sub-investment-grade counterparty (any size) | BRC | `SubInvestmentGradeCounterpartyApproved` |
| Specific Wrong-Way Risk (SWWR) classification per policy §6 | BRC | `WrongWayRiskExceptionApproved` |
| Unrated counterparty (any size) | CRC + Helena's credit assessment | `UnratedCounterpartyApproved` |
| Sector concentration push that would breach the 25% sector cap | BRC | `SectorConcentrationExceptionApproved` |
| Cross-border to elevated-risk jurisdiction (RAS B2 watch-list) | CRC | `GeographicConcentrationExceptionApproved` |

Calibration rationale: the R3m / R15m / R60m / R75m ladder positions CRO solo authority at the smallest of small-counterparty exposures, defers anything material to a multi-actor CRC quorum, and respects the policy §2 / §7 framing that anything above the internal sub-limit is a CRC-or-higher decision. The R75m line maps directly to the 25% LEX cap at the R300m capital base; above this point the procedure transitions to the regulatory-exception pathway under D3/2022.

### 5.3 Connected-counterparty-group aggregation

Per policy §2 (LEX regime line 98), Imani maintains the connected-counterparty-group register as `ConnectedCounterpartyGroupUpdated` events in the event log. The operational rules for this procedure are:

1. **Identification triggers.** Group identification runs on: (a) every new `CreditLimitApplicationSubmitted` event for a counterparty (Step 2 above); (b) quarterly cohort review by Imani; (c) any external signal (e.g. counterparty rating action that mentions affiliation; an M&A event in the party register).
2. **Control test.** Direct or indirect control per IFRS 10 — voting rights ≥ 50%, or de facto control via board composition / contractual rights `[citation: TBC — IFRS 10 paragraph reference; Mira follow-on]`. LEI parent / subsidiary hierarchy (per the LEI ROC's level-2 relationship data) is the first-pass evidence; Imani confirms by primary documentary review for any borderline case.
3. **Interdependence test.** Financial difficulties of one would cause financial difficulties of the other per D3/2022 `[citation: TBC — exact D3/2022 interdependence-test provision]`. Indicators include: (a) ≥ 50% of one entity's revenue from the other; (b) cross-default clauses in material contracts; (c) shared key creditor or shared key supplier; (d) common ultimate controlling owner without intermediate ring-fence.
4. **Aggregation effect.** Once a group is identified, the group-aggregated exposure (sum of all member-counterparty limits and exposures) is the binding LEX-cap denominator. The single-member limit-engine entries remain, but pre-deal checks fail if any new transaction would cause the **group** aggregate to exceed the relevant authority threshold or the 25% LEX cap.
5. **Register maintenance.** `ConnectedCounterpartyGroupUpdated` events carry: `groupId`, `members[]` (LEI-keyed party IDs), `testApplied: "control" | "interdependence"`, `evidenceRef` (BLAKE3 hash to the supporting document in the RMS doc store), and `effectiveFrom`. The register is queried by the credit-limit engine on every pre-deal check via `@platform/party-register`.
6. **Dispute path.** A counterparty disputing group classification (rare; would arise on regulatory-reportable group reorganisation) routes via Imani to Helena; the CRC reviews and confirms or unwinds the classification within 10 business days. Until resolution, the conservative (more-aggregated) classification applies for limit-engine purposes.

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Helena (Chief Risk Officer, governance) | Procedure owner; CRO solo-approval authority up to 1% of eligible capital; chairs CRC; submits BRC papers above CRC threshold; signs off limit matrix calibration annually |
| Rohan (Market risk quantitative engineer, engineering) | SA-CCR EAD inputs to the limit calibration; PFE model outputs for derivative exposures; quantitative review at Step 1 |
| Imani (Legal-as-code engineer, engineering) | Connected-counterparty-group register steward (Step 2 + §5.3); ISDA / CSA / GMRA enforceability confirmation as input to limit conditions |
| Saskia (Head of Global Markets) | Application initiator (`CreditLimitApplicationSubmitted`); operates within loaded limits; surfaces extension requests |
| CRC (Credit Risk Committee — Helena chair + Rohan + Imani + peer attendance) | Authority for limits between 1% and 5% of eligible capital; sub-limit exceptions within 25% LEX cap; unrated-counterparty approvals; geographic-concentration exceptions; quarterly sub-IG review |
| BRC (Board Risk Committee — interim: CEO under `D-THIN-HUMAN-LAYER-MINIMUM`) | Authority for limits between 5% and 25% of eligible capital; all sub-IG counterparty approvals; SWWR exception approvals; sector-concentration exceptions; exception renewals beyond 90 days |
| CEO (interim Board; LEX-cap exception authority) | Joint authority with BRC for limits 20%–25%; sole authority above 25% (paired with PA approval under D3/2022); watch-list activation on rating-floor breach |
| Camille (Chief Financial Officer, governance) | Eligible-capital projection input to the limit-engine; co-signs BA 600 large-exposure return |
| Owen (Company Secretary, governance) | Circulates BRC / Board papers per PROC-GOV-BP-01; secretarial framework for CRC minutes |
| Vera (internal audit engineer) | Third-line recon: limit-vs-exposure breach; LEX-cap daily check; annual-review staleness; unescalated breach detection |
| Thandiwe (Chief Audit Executive, governance) | Annual audit of the credit-limit-setting process; sample testing of approvals vs delegation matrix; BRC opinion |
| PA (Prudential Authority) | Approves LEX-cap exceptions under D3/2022; receives `Ba600ReturnSubmitted` monthly; SREP review of CCR limit-setting adequacy |

## 7. Escalation

| Scenario | Severity | Escalation path |
|---|---|---|
| LEX utilisation 80–89% (single counterparty or group) | **Amber** | Engine → CRC chair (Helena) → EXCO; exposure review opens; no new transactions with the name or sector until review |
| LEX utilisation 90–100% without BRC approval | **Red** | CRC + BRC + CEO; transactions suspended; remediation plan within 5 business days |
| LEX utilisation ≥ 100% (cap breach without PA approval) | **Critical-Red** | Immediate CEO notification; PA notification under D3/2022 `[citation: TBC]`; `LexBreachIdentified` event; transaction unwound / hedged unless PA grants dispensation; BRC convened within 5 business days |
| Counterparty rating downgraded below BBB− since last review | High | Helena → CEO → BRC at next meeting; counterparty added to watch-list; no new transactions pending BRC review |
| Connected-group aggregated exposure breach (group-level) where single-member exposures all within their individual limits | High | Engine → Imani (group register review) → Helena → CRC; aggregation rules re-applied; potential limit reduction across multiple members |
| Sector concentration > 25% without BRC approval (`ORG-PR-10`) | Red | Immediate CRC + BRC; new sector transactions suspended; remediation plan within 5 business days |
| Exception expiry without renewal | Medium | Engine auto-lapse; CRC notified; counterparty reverts to pre-exception limit; trades that would breach are blocked |
| SWWR identified post-trade (not flagged at origination) | High | Rohan + Helena → BRC; if material, transaction unwound or hedged; capital add-on per policy §6 |
| ISDA / CSA condition not met within approval-conditional window (e.g. ISDA not executed within 30 days) | Medium | Engine flags; Helena suspends limit; Imani pursues ISDA; CEO informed if material |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/risk/credit-limit-engine` | PLANNED — this procedure is its policy input | Limit storage; pre-deal checks; daily utilisation; breach detection; exception lifecycle; annual-review tick |
| `@platform/risk/sa-ccr` | PLANNED | EAD input to limit calibration and daily utilisation |
| `@platform/risk/pfe-model` | PLANNED | Potential Future Exposure model for derivative netting sets; feeds Step 1 calibration |
| `@platform/party-register` | ✓ live | Counterparty identity master; LEI hierarchy and parent / subsidiary relationships for group aggregation |
| `@domains/legal/isda-registry` | PLANNED | ISDA / CSA / GMRA status; netting-enforceability events as input to limit conditions |
| `@platform/escalation` | ✓ existing | Traffic-light notification routing for Amber / Red / Critical-Red |
| `@platform/risk/credit-analysis` | PLANNED | Financial statement analysis and external-rating integration to feed Step 1 |
| `@platform/finance/eligible-capital-projection` | PLANNED (Camille) | Real-time eligible-capital base for engine recomputation |

## 9. Quality controls

The credit-limit engine cannot be authoritatively built without this procedure; the recon items below are the policy input the engine must enforce once built. Each is filed as a Vera recon to be activated on engine discharge.

- **`recon:credit-limit-loaded-precondition`** — no `TradeExecuted` event against a counterparty without a current `CreditLimitLoaded` event covering the trade-execution timestamp.
- **`recon:credit-limit-annual-review-staleness`** — every counterparty with an active limit has a `CreditLimitAnnualReviewCompleted` event within the last 13 months (1-month grace beyond the annual cadence per policy §3 and §7).
- **`recon:credit-limit-authority-matrix-compliance`** — every `CreditLimitApproved*` event's `approver` matches the §5.2 authority for the limit's % of eligible capital at the approval date.
- **`recon:credit-limit-sub-ig-approval-symmetry`** — every counterparty with `externalRating < BBB-` at any time has a `SubInvestmentGradeCounterpartyApproved` event with `approver = BRC`.
- **`recon:credit-limit-connected-group-aggregation`** — every counterparty in a `ConnectedCounterpartyGroupResolved` event has its limit-utilisation included in the group aggregate; group aggregate respects all §5.2 thresholds.
- **`recon:credit-limit-exception-expiry`** — every `CrcLimitExceptionApproved` / `BrcLimitExceptionApproved` event has either a `LimitExceptionRenewed` or `LimitExceptionLapsed` event within 90 days of the approval timestamp.
- **`recon:lex-cap-daily`** — daily check that no `LexUtilisationComputed.utilisationPct` for any counterparty or group exceeds 100% without a `PaLexApprovalConfirmed` event; any breach without an accompanying `LexBreachIdentified` within the same business day is a Vera Critical finding.
- **`recon:credit-limit-traffic-light-symmetry`** — every `LexUtilisationComputed` ≥ 80% has a matching `CreditLimitUtilisationTrafficLight` event with the correct severity classification, and the appropriate downstream notification event.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Full event chain per counterparty credit limit (application → calibration → group resolution → routing → approval → load → exceptions → reviews → breach handling) | Event log (P1) | 7 years post limit closure (policy §8 standard) | Restricted |
| Limit-matrix calibration workings (annual) | RMS document store | 7 years post matrix supersession | Confidential |
| Connected-counterparty-group register evidence (control / interdependence test source documents) | RMS document store; referenced by `evidenceRef` (BLAKE3 hash) on each `ConnectedCounterpartyGroupUpdated` event | 7 years post group dissolution; permanent for active groups | Restricted |
| Approval evidence (CRC minutes, BRC papers, CEO sign-off) | Event log + RMS document store | 7 years (CRC minutes); permanent (Board papers per CoSec) | Restricted |
| BA 600 large-exposure submissions | Event log (`Ba600ReturnSubmitted`) + regulatory submissions register | 7 years per FIC / Banks Act retention; longer for return amendments | Restricted |
| PA correspondence on LEX exceptions | RMS document store; cross-referenced from `PaLexApprovalConfirmed` events | Permanent | Restricted-regulator |
| Sub-IG counterparty approval records | Event log + RMS doc store (BRC paper hash) | Permanent (counterparty + 7 years post closure) | Restricted |

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-20 | Helena (Chief Risk Officer, governance) | Initial draft — STUB → POPULATED. Operationalises `credit-risk-policy-v1.md` §2 + §7 deferred authority matrix and sub-limit schedule. Authored under `D-CREDIT-LIMIT-ENGINE-BUILD` (CEO-approved 2026-05-20). Twelve sections: (1) source policy chain with linked credit-risk-policy-v1; (2) source regulation table — ORG-PR-09, -10, -16, -22, -40; (3) purpose framing the procedure as the policy input to `@platform/risk/credit-limit-engine`; (4) trigger table — application, extension, annual review, breach, utilisation threshold, group update, exception expiry; (5) eight-step flow with embedded sub-sections §5.1 rating-based limit matrix (AAA / AA / A / BBB / sub-IG / sovereign / MDB / unrated), §5.2 CRO / CRC / BRC / CEO authority matrix (1% / 5% / 20% / 25% of eligible capital ladder calibrated against R300m licence-day capital base), §5.3 connected-counterparty-group aggregation rules (control test + interdependence test + LEI hierarchy + register maintenance); (6) roles — Helena, Rohan, Imani, Saskia, CRC, BRC, CEO, Camille, Owen, Vera, Thandiwe, PA; (7) escalation matrix across nine breach scenarios; (8) system capabilities — credit-limit engine (PLANNED — this procedure's discharge target), SA-CCR, PFE, party register (live), ISDA registry; (9) eight Vera recon items as policy input for engine build (precondition, annual-review staleness, authority compliance, sub-IG symmetry, connected-group aggregation, exception expiry, LEX cap daily, traffic-light symmetry); (10) evidence / audit trail with retention per policy §8; (11) change log; (12) audit / assurance. Identity discipline observed per CLAUDE.md "Dispatch discipline" — every persona name + position on first mention. Citation gaps explicitly named per Principle 2 (IFRS 10 control definition, D3/2022 interdependence test and notification deadline, BCBS 346 final standard) — flagged as Mira follow-on, no new `[citation: TBC]` introduced beyond the policy's existing gaps. |

## 12. Audit / assurance

- **Vera (ongoing):** the eight recon items in §9 above run continuously once the credit-limit engine is discharged; each is a Vera P2-or-higher finding.
- **Thandiwe (Chief Audit Executive, governance) (annual):** annual audit of the credit-limit-setting process; sample testing of `CreditLimitApproved*` events against the §5.2 authority matrix; verification that the connected-counterparty-group register is up to date; opinion to the BRC.
- **PA (SREP):** credit-risk Pillar 2 supervisory review includes a review of the counterparty limit-setting adequacy, the BA 600 large-exposure return integrity, and the LEX-cap exception process under D3/2022.
- **Nadia (Independent-validation engineer, peer-in-second-line under Helena):** validates any quantitative model used by the credit-limit engine before first production use (e.g. the eligible-capital projection if it relies on a model component; the PFE model where it feeds Step 1 calibration). Validation events: `ModelValidationCompleted { modelId, modelVersion, findings[] }`.
