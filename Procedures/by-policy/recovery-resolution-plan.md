---
id: PROC-RRP-01
policy-parent: — Recovery and Resolution Planning Policy v1 (IN FORCE, effective 2026-05-11)
last-reviewed: 2026-05-22
status: POPULATED
---
# Procedure — Recovery and Resolution Planning

**Procedure ID:** PROC-RRP-01  
**Owner:** Devon (Chief Operating Officer, governance) · Helena (Chief Risk Officer, governance)  
**Approval:** Board (annual) · CEO (interim cycle)  
**Cadence:** Annual update (tied to ICAAP cycle); continuous recovery indicator monitoring  
**Version:** v1.0 — 2026-05-22  
**Status:** POPULATED

---

## 1. Source policy

`Policies/recovery-resolution-planning-policy-v1.md` — Recovery and Resolution Planning Policy v1 (IN FORCE, effective 2026-05-11).

The policy establishes the bank's recovery planning framework, early-warning indicator regime, recovery option inventory, and governance pathway. It implements the requirement for the bank to maintain a credible and executable recovery plan capable of activation before the point of non-viability. The policy is the third leg of the ICAAP–ILAAP–Recovery triplet; early-warning indicators in this procedure derive from the same RAS line-set that appears in the ICAAP and ILAAP capital/liquidity monitoring regimes.

Supporting policies:
- `Policies/risk-management-and-compliance-policy-v1.md` — risk appetite framework and RAS thresholds that calibrate recovery indicators.
- `Policies/capital-management-policy-v1.md` — capital-raise and capital-ratio governance feeding the recovery options inventory.
- `Policies/operational-resilience-policy-v1.md` — operational continuity obligations that apply in parallel with recovery activation.

---

## 2. Source regulation(s)

| Citation | Obligation ID | Requirement |
|---|---|---|
| Banks Act 94 of 1990 s.68 | ORG-PR-30 | SARB Registrar's intervention powers; bank must have a recovery plan enabling SARB notification within timeframe prescribed by Registrar when capital/liquidity indicators are breached. |
| Banks Act 94 of 1990 s.69 | ORG-PR-30 | Registrar may direct a registered bank to take specified recovery steps; the bank's recovery options inventory must be pre-assessed and executable on regulatory request. |
| Banks Act 94 of 1990 s.70–71 | ORG-PR-35 | SARB resolution powers including curatorship; the bank's resolution preparedness arrangements must be documented and current. |
| Regulation 31 (Regulations Relating to Banks) | ORG-PR-30 | Explicit recovery planning requirement for banks; minimum content of the recovery plan; annual SARB submission for qualifying banks. |
| FSB Key Attributes of Effective Resolution Regimes (2014) — applicable provisions | ORG-PR-35 | Resolvability expectations; pre-positioned information requirements; bail-in and restructuring tool preparedness. |
| SARB Guidance Note 7 on Recovery Planning | ORG-BNK-RECOVERY-CONS | Guidance on recovery plan structure, indicator calibration, option credibility assessment, and SARB engagement pathway. |
| PA D1/2015 — Recovery and Resolution Plans | ORG-PR-30, ORG-PR-35 | PA Directive on recovery and resolution planning for South African banks; trigger thresholds; governance requirements; submission expectations. |

**Bind status.** These obligations are LICENCE-BIND — they activate at commencement of trading. This procedure is authored now for the licence dossier and is production-grade from licence-day.

---

## 3. Purpose

This procedure translates the Recovery and Resolution Planning Policy into a concrete, repeatable operational cycle. Its aims are:

1. **Maintain a credible pre-positioned recovery plan** that management can activate immediately when a recovery indicator is breached, without needing to design options under stress.
2. **Satisfy SARB/PA pre-licence requirements** for recovery planning documentation — the plan must be reviewed and submitted as part of the licence dossier and updated annually thereafter.
3. **Provide a pre-agreed options framework** so that the Recovery Management Committee (RMC) works from a shortlist of assessed, costed, and sequenced options rather than starting from scratch at the point of stress.
4. **Establish the governance escalation path** from early-warning indicator breach through RMC activation, Board notification, and — if required — SARB engagement under Banks Act s.68.
5. **Feed the ICAAP and stress-test cycles** with recovery calibration data: which options are available, at what time-to-execute, and at what capital/liquidity impact.

The procedure is distinct from the Operational Resilience procedures (`severe-but-plausible-test.md`, `dr-test-execution.md`, `crisis-management-activation.md`): those procedures address operational service continuity; this procedure addresses financial viability and the capital/liquidity recovery framework.

---

## 4. Trigger

The procedure has two concurrent modes: **continuous monitoring** (always on) and **annual plan update** (scheduled).

**Continuous monitoring** is running at all times:
- Helena (Chief Risk Officer, governance) monitors recovery indicators against the thresholds defined in the RAS schedule (see `Procedures/by-policy/pr-capital-adequacy-governance.md`).
- Any indicator crossing an Amber, Red, or Critical threshold triggers immediate escalation per Step 3 of the recovery response sub-procedure.

**Annual plan update** is triggered by:
- Annual ICAAP cycle completion — the recovery plan update is the final step of the triplet (ICAAP → ILAAP → Recovery Plan).
- Any capital or liquidity indicator breach at Red severity or above (triggers an out-of-cycle plan review to ensure options remain credible under the new stress environment).
- Material strategic change — new product class approved (post-NPA gate), acquisition, business-line exit, material change in risk profile.
- SARB request — the Registrar may request a plan update or submission at any time.

---

## 5. Steps

### 5A. Continuous: recovery indicator monitoring

This sub-procedure runs permanently. No event triggers its initiation — it is a standing obligation of Helena's mandate.

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| A1 | Monitor recovery indicators on a daily basis against the Amber/Red/Critical thresholds in the current RAS schedule: (a) CET1 ratio vs. recovery-plan trigger calibrations; (b) LCR (30-day liquidity coverage ratio); (c) NSFR (net stable funding ratio); (d) net stable funding position (absolute ZAR amount); (e) market-access proxy (cost of unsecured wholesale funding available to the bank) | `Helena` | `@platform/risk/ras-monitor` (`PLANNED`) | During build phase: Helena reads daily metrics from the capital-ratio monitoring dashboard (`capital-ratio-monitoring.md`) and liquidity position dashboards. Automated threshold-monitoring automation is PLANNED. |
| A2 | If any indicator crosses the Amber threshold: emit `RecoveryIndicatorBreached { indicator, currentValue, threshold, severity: "Amber" }`; notify CEO Marc immediately; continue monitoring | `Helena` | `@platform/event-store` ✓ | Amber breach initiates RMC monitoring mode (Step B1 below) but does not require immediate SARB notification. Helena maintains a brief record of the breach event and the prevailing conditions. |
| A3 | If any indicator crosses the Red threshold: emit `RecoveryIndicatorBreached { indicator, currentValue, threshold, severity: "Red" }`; notify CEO Marc immediately; activate the full recovery response (Step B below) | `Helena` | `@platform/event-store` ✓ | Red breach is the primary activation trigger. Board notification is required within 24 hours (per the escalation matrix in §5C). |
| A4 | If any indicator crosses the Critical threshold, or if multiple indicators breach simultaneously: emit `RecoveryIndicatorBreached { indicator, currentValue, threshold, severity: "Critical" }` for each; escalate immediately to Scrooge for CEO and Board notification; activate the full recovery response without delay | `Helena` | `@platform/event-store` ✓ | Critical breach implies potential proximity to non-viability. SARB notification under Banks Act s.68 is assessed for immediate trigger (Step C4). |

### 5B. Recovery response on breach

Activated when a Red or Critical `RecoveryIndicatorBreached` event is emitted, or when Helena judges the trajectory of an Amber breach is deteriorating.

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| B1 | Convene the Recovery Management Committee (RMC). Membership: Marc (CEO), Camille (Chief Financial Officer, governance), Helena (Chief Risk Officer, governance), Devon (Chief Operating Officer, governance). Imani (Chief Legal Counsel / legal-as-code engineer) attends as observer when escalation to SARB is under assessment. Emit `RecoveryManagementCommitteeConvened { trigger, attendees, breach_events[] }` | `Devon` (convener) | `@platform/event-store` ✓ | Devon is responsible for convening the RMC. In the build phase, convening is manual (calendar invite + shared document); RMC convening automation is PLANNED. |
| B2 | Assess the breach severity against the recovery indicator scale. The RMC reviews: (a) which indicator(s) have breached and by how much; (b) trajectory — is the breach widening or self-correcting? (c) which stress scenario (from the stress-test cycle) most closely resembles the current environment; (d) time to next reporting deadline | `Helena` (lead) + RMC | `@platform/risk/stress-scenario-library` (`PLANNED`) | Helena brings the current stress-scenario analysis (from `stress-test-cycle.md` PROC-RISK-ST-01 and `severe-but-plausible-test.md` PROC-OR-SBP-01) to the RMC. |
| B3 | Assess recovery option credibility under the current environment. For each option in the pre-assessed inventory (see §5C Recovery options below), the RMC reviews: expected time-to-execute under current conditions; expected capital / liquidity impact; execution pre-requisites (Board authorisation, SARB no-objection, market access, counterparty cooperation); whether execution would trigger further adverse effects (e.g. rating action, reputational impact, counterparty default) | `Camille` (capital options) + `Helena` (risk impact) + `Eitan (Treasurer)` (liquidity/funding options) | `@platform/recovery/options-assessor` (`PLANNED`) | This step draws on the pre-assessed options inventory maintained in the annual plan (Step C3). The pre-assessment accelerates RMC deliberation under stress. |
| B4 | Select and record the option(s) to execute. Emit `RecoveryOptionSelected { option, expectedImpact, authorisedBy, rationale }` for each selected option. Record rationale for options not selected | `RMC` (collective decision) | `@platform/event-store` ✓ | `RecoveryOptionSelected` is not an implementation instruction — it is the decision record. Each selected option then flows to its own implementation pathway (e.g. capital raise → Camille; business-line exit → Devon; liability management → Eitan). |
| B5 | Implement selected options. Each option follows its designated implementation sub-pathway. Helena and Devon monitor implementation progress; Helena re-checks recovery indicators daily (or more frequently on Critical breach) to confirm trajectory is improving | `Option owner` (per option) | Varies by option | Capital raise (rights issue, AT1 issuance) — Camille leads; Board authority required; SARB no-objection for AT1. Asset disposal (trading book reduction) — Saskia (Head of Global Markets) executes; Devon monitors. Asset disposal (subsidiary sale) — Imani leads legal structure; CEO authorises. Business-line exit — Devon leads operational wind-down; Saskia executes market exit. Liability management (buyback, exchange) — Eitan leads; Camille oversees capital accounting. |
| B6 | Escalate per the severity matrix (§5C). Update the RMC after each option-implementation step. Helena re-emits `RecoveryIndicatorBreached` events if indicators deteriorate further; emits a stabilisation event when indicators return above recovery thresholds | `Helena` + `Devon` | `@platform/event-store` ✓ | See §5C for the detailed escalation matrix. |

### 5C. Escalation matrix

| Severity | Recovery indicator position | Immediate action | Board notification | SARB notification |
|---|---|---|---|---|
| **Amber** | Indicator below Amber threshold but above Red threshold | CEO notified by Helena; RMC placed on monitoring mode; options inventory reviewed for currency | Board informed at next scheduled board meeting (or within 5 business days if trajectory is deteriorating) | Not required unless trajectory does not improve within timeframe set by CEO |
| **Red** | Indicator below Red threshold but above Critical threshold | RMC convened within 4 hours; full options assessment (Step B2–B3) completed; selected options authorised | Board notified within 24 hours of Red breach; Owen (Company Secretary, governance) coordinates; Board resolution required for options needing Board authority | Devon and Imani assess SARB notification obligation under Banks Act s.68; Helena provides written opinion on proximity to non-viability; CEO makes final notification decision within 48 hours of Red breach |
| **Critical** | Indicator below Critical threshold, or multiple simultaneous breaches | Immediate RMC convening; options implementation begins in parallel with governance escalation; Devon invokes crisis-management protocol (`crisis-management-activation.md`) | Board notified immediately (same business day); emergency Board meeting authorised by Chair | SARB notified under Banks Act s.68 within timeframe to be confirmed by SARB Guidance Note 7 and as specified by the Registrar; Owen countersigns notification; CEO signs cover communication; Devon coordinates submission |

### 5D. Recovery options inventory (pre-assessed)

The following options are maintained in the pre-assessed inventory. Helena reviews option credibility annually (and on each plan update). Each option must have a current time-to-execute estimate and expected capital/liquidity impact.

| Option | Category | Lead | Time-to-execute (estimate) | Capital / liquidity impact | Board authority required | SARB no-objection required |
|---|---|---|---|---|---|---|
| Rights issue (ordinary shares) | Capital raise | Camille + Eitan | 4–8 weeks (JSE process + underwriting) | CET1 accretive; liquidity positive | Yes (Board + shareholder approval) | Registrar notification |
| AT1 instrument issuance | Capital raise | Camille + Eitan | 6–10 weeks (SARB no-objection; STRATE) | AT1 / Tier 1 accretive; liquidity neutral | Yes | Yes (s.54 no-objection) |
| Trading book position reduction | Asset disposal | Saskia + Devon | 1–5 business days (depending on market depth) | RWA reduction → CET1 relief; liquidity positive (free up margin/collateral) | CEO authority (within Board-delegated limits) | No (unless scale triggers Directive 3 outsourcing flag) |
| Non-core subsidiary/asset sale | Asset disposal | Imani + Camille | 8–16 weeks (legal structure, CIPC, SARB) | Liquidity accretive; CET1 depends on carrying value | Yes | SARB consent if regulatory perimeter affected |
| Business-line exit (FX spot) | Business restructuring | Devon + Saskia | 2–6 weeks (client notification, position wind-down) | RWA reduction; potential P&L impact on unwind | CEO authority (Board informed) | SARB engagement recommended |
| Liability management — debt buyback | Liability management | Eitan | 2–4 weeks (market operation) | NSFR/LCR impact; CET1 depends on book value | CEO authority | No |
| Liability management — liability exchange | Liability management | Eitan + Imani | 4–8 weeks (consent solicitation, legal) | Tier 2 or AT1 upgrade possible | Board authority | Yes if exchange involves capital instruments |
| Intraday / short-term funding facility draw | Liquidity | Eitan + Tomas | Same-day (correspondent bank facility) | Liquidity positive; NSFR / LCR improvement | Pre-approved facility; Devon confirms drawdown | No |

### 5E. Annual recovery plan update

Triggered by the annual ICAAP cycle completion, or by any of the other triggers listed in §4.

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| E1 | Helena updates RAS calibration and recovery indicator thresholds based on current capital projections (ICAAP) and liquidity projections (ILAAP); updates the stress scenarios that inform the recovery plan's assumptions | `Helena` | `@platform/risk/ras-calibration` (`PLANNED`) | Helena cross-references the ICAAP stress scenarios (from `stress-test-cycle.md` PROC-RISK-ST-01) to ensure recovery indicator thresholds remain above the stress-test adverse-scenario outcomes. |
| E2 | Camille (Chief Financial Officer, governance) updates the capital-impact analysis for each recovery option: current market conditions; cost-of-capital assumptions; dilution analysis for equity options; accounting treatment under IFRS 9 / IFRS 32 | `Camille` | `@platform/finance/capital-impact-model` (`PLANNED`) | Camille confirms which options remain credible given the current capital structure (legal entity tree, D-LEGAL-ENTITY-TREE-V0) and external market conditions. |
| E3 | Devon updates operational continuity sections: operational dependencies of each recovery option; vendor and counterparty contingency analysis; key-person/key-agent dependencies; correspondent bank facility confirmation | `Devon` | `@platform/operations/vendor-contingency-register` (`PLANNED`) | Devon consults Imani (Chief Legal Counsel / legal-as-code engineer) on contractual constraints affecting each option (ISDA termination rights, acceleration clauses, change-of-control triggers). |
| E4 | Owen (Company Secretary, governance) packages the updated plan for Board review and SARB submission. The plan is structured per SARB Guidance Note 7 minimum content requirements | `Owen` | `@platform/rms/document-store` ✓ | Owen assigns a BLAKE3 hash to the plan document; stores in the RMS document register; records `RecoveryPlanUpdated { version, approvedBy, submittedToSarb }` event on completion. |
| E5 | Board review and approval: Devon and Helena present the updated plan to the Board; Board approves the updated plan and authorises SARB submission; Board resolution recorded | `Devon` + `Helena` + Board | `@platform/event-store` ✓ | This is a mandatory human step. The Board must approve the plan; agent attestation is insufficient for the governance requirement under Banks Act and PA D1/2015. |
| E6 | SARB submission: Devon compiles the submission package (updated plan + covering letter); Owen countersigns as Company Secretary; CEO Marc signs the cover letter; Devon submits via prescribed channel; Owen records SARB receipt acknowledgement | `Devon` (compile) + `Owen` (countersign) + `Marc` (sign) | `@platform/pa-submission/recovery-plan` (`PLANNED`) | SARB submission channel and format to be confirmed at licence application. During build phase: Devon tracks submission obligation; submission package retained in RMS. Emit `SarbRecoveryPlanAcknowledged { referenceNo }` on receipt of SARB acknowledgement. |

---

## 6. Reconciliation

**Events produced by this procedure:**

| Event | Schema | When emitted | Invariant |
|---|---|---|---|
| `RecoveryIndicatorBreached` | `{ indicator: string, currentValue: number, threshold: number, severity: "Amber" \| "Red" \| "Critical" }` | Each time Helena determines an indicator has crossed a threshold | Every `RecoveryIndicatorBreached` at Red or Critical severity must be followed by a `RecoveryManagementCommitteeConvened` event within 4 hours (Red) or immediately (Critical). |
| `RecoveryManagementCommitteeConvened` | `{ trigger: string, attendees: string[], breach_events: string[] }` | When RMC is convened | Must reference one or more `RecoveryIndicatorBreached` events (breach pathway) or the annual-update trigger. |
| `RecoveryOptionSelected` | `{ option: string, expectedImpact: string, authorisedBy: string, rationale: string }` | When RMC selects an option for execution | Must follow `RecoveryManagementCommitteeConvened`. One event per option selected. |
| `RecoveryPlanUpdated` | `{ version: string, approvedBy: string, submittedToSarb: boolean }` | On completion of annual update and Board approval | Annual cadence: one `RecoveryPlanUpdated` event per plan-year. Missing vintage is a Vera finding. |
| `SarbRecoveryPlanAcknowledged` | `{ referenceNo: string }` | On receipt of SARB acknowledgement of plan submission | Must follow `RecoveryPlanUpdated { submittedToSarb: true }`. |

**Reconciliation invariants:**
- Every vintage year must have exactly one `RecoveryPlanUpdated` event (Vera annual check).
- Every `RecoveryIndicatorBreached { severity: "Red" | "Critical" }` must have a corresponding `RecoveryManagementCommitteeConvened` event within the escalation matrix SLAs.
- No `RecoveryPlanUpdated { submittedToSarb: true }` event may be emitted without a preceding Board resolution approving submission.
- `SarbRecoveryPlanAcknowledged` events without a matching `RecoveryPlanUpdated` event are anomalies requiring investigation.

---

## 7. Exception handling

**Recovery options exhausted.** If the RMC assesses that no recovery option (individually or in combination) can restore the recovery indicators within a credible timeframe, Devon and Helena must escalate immediately to CEO Marc and the Board. The failure mode represents proximity to non-viability. Devon (Chief Operating Officer, governance) coordinates with Imani (Chief Legal Counsel / legal-as-code engineer) to assess the resolution-framework implications under Banks Act ss.69–71. Helena prepares a written opinion on capital adequacy and the timeline to SARB intervention powers becoming exercisable. SARB early engagement (pre-notification dialogue) is recommended in this scenario.

**SARB early engagement.** Separately from the formal notification obligation under Banks Act s.68, Devon may recommend to the CEO that the bank initiate informal SARB dialogue at any Red severity breach where the trajectory is not clearly improving. Early engagement reduces the risk of a surprise formal intervention and allows the bank to present its recovery options to the SARB proactively. Imani advises on the legal framework for such engagement.

**Plan credibility gap.** If the annual review determines that one or more pre-assessed options are no longer credible (e.g. market has closed for AT1 issuance; key counterparty relationship has deteriorated), Devon and Helena document the gap, update the options inventory, and assess whether alternative options can substitute. If the options inventory does not provide sufficient coverage across a range of stress scenarios, Helena escalates to the CEO and Board immediately. The gap is recorded as a Vera finding until remediated.

---

## 8. Reporting and management information

| Report | Owner | Audience | Cadence | Content |
|---|---|---|---|---|
| Recovery indicator dashboard | Helena | CEO, RMC | Continuous / daily review | Current value and trend for each of the five recovery indicators vs. Amber/Red/Critical thresholds; any `RecoveryIndicatorBreached` events since last review |
| Quarterly Board risk report — RRP section | Helena | Board | Quarterly | Status of recovery indicators for the quarter; any breaches and responses; plan update progress; SARB correspondence |
| Annual Recovery Plan | Devon + Helena + Camille + Owen | Board + SARB | Annual | Full plan per SARB Guidance Note 7 minimum content; options inventory update; ICAAP/ILAAP alignment |
| SARB submission log | Owen | CEO + Regulator register | Annual (on submission) | Date of submission, plan version, SARB reference number, acknowledgement date |
| SARB correspondence register | Owen | CEO | On-event | All formal correspondence with SARB relating to recovery planning and resolution matters |

---

## 9. Change control

- **Joint approval:** Devon (Chief Operating Officer, governance) and Helena (Chief Risk Officer, governance) must both approve any change to this procedure.
- **Board AC review:** the Board Audit Committee reviews this procedure annually, in alignment with the annual recovery plan Board approval (Step E5).
- **SARB notification of material changes:** any material change to the recovery plan — including changes to the options inventory, indicator thresholds, or escalation matrix — must be notified to the SARB within 30 days of the change being approved by the Board (per PA D1/2015). Owen coordinates SARB notification; Devon prepares the change summary.
- **Minor administrative updates** (correction of cross-references, typo fixes, non-substantive wording changes) may be approved by Devon alone; Helena is notified.

---

## 10. Evidence and artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Recovery plan document (BLAKE3-hashed) | RMS Document register | Permanent (regulatory artefact) | Critical |
| `RecoveryIndicatorBreached` events | Event log | 10 years | Restricted |
| `RecoveryManagementCommitteeConvened` events | Event log | 10 years | Restricted |
| `RecoveryOptionSelected` events | Event log | 10 years | Restricted |
| `RecoveryPlanUpdated` events | Event log | Permanent | Restricted |
| `SarbRecoveryPlanAcknowledged` events | Event log | Permanent | Critical |
| SARB submission package (plan + cover letter) | RMS Document register | Permanent | Critical |
| SARB submission receipt and acknowledgement | RMS Correspondence register | Permanent | Critical |
| Board approval resolution | RMS Document register | Permanent | Restricted |
| RMC meeting records (agenda, notes, decisions) | RMS Document register | 10 years | Restricted |
| Recovery indicator monitoring logs | Event log + `@platform/risk/ras-monitor` | 10 years | Restricted |
| Options inventory update workings | RMS Document register | 10 years | Restricted |

---

## 11. Manual steps

The following steps require human action and cannot be fully automated:

- **Board approval of the recovery plan (Step E5):** the Board's approval of the annual recovery plan is a mandatory governance requirement under Banks Act and PA D1/2015. Requires a quorum Board meeting and recorded Board resolution. Agent attestation is insufficient.
- **CEO signature on SARB notification cover letter (Steps C — Critical, E6):** the cover letter accompanying any SARB notification or submission must be signed by the CEO (Marc). This reflects the Registrar's expectation that the bank's most senior executive is personally accountable for the submission content.
- **Recovery Management Committee convening confirmation (Step B1):** while Devon convenes the RMC, each member (Marc, Camille, Helena, Devon) must confirm attendance in real time. In the build phase this is a manual calendar coordination; RMC convening automation is PLANNED.
- **Options credibility assessment (Step B3 / E1):** the RMC's judgement on whether a recovery option is credible under prevailing market conditions requires human expertise that cannot be fully codified — particularly for market-sensitive actions (rights issue pricing, debt exchange terms, business-line exit timing). Helena and Camille must exercise professional judgement; the platform records rationale but does not substitute for it.
- **SARB informal early-engagement dialogue (§7 exception handling):** any informal dialogue with the SARB Registrar or SARB staff must be conducted by humans (CEO, Devon, Helena, Imani as applicable). The content and tone of such dialogue are matters of regulatory relationship management.

---

## 12. Failure modes

| Failure mode | Detection | Impact | Escalation |
|---|---|---|---|
| Recovery indicator breach not detected in time | No `RecoveryIndicatorBreached` event despite metric crossing threshold; discovered via manual review or external event | RMC activated too late; SARB notification delayed | Helena → CEO immediately; Devon activates RMC without delay; retrospective breach event emitted with timestamp of actual breach; Vera finding opened |
| Recovery options pre-assessment not current | Annual review missed; options inventory not updated; market conditions have changed materially since last assessment | RMC deliberates from stale data during stress | Vera annual check: no `RecoveryPlanUpdated` event for current vintage → Devon → CEO; emergency plan review initiated; Board notified |
| SARB submission overdue | No `SarbRecoveryPlanAcknowledged` event within 30 days of plan approval; Owen tracks against SARB deadline | Regulatory compliance failure; potential Registrar finding | Devon → CEO → Owen; submission expedited; SARB contacted to explain delay; incident recorded in SARB correspondence register |
| Board fails to achieve quorum for plan approval | Board meeting cannot be convened by the required date | Annual approval cycle delayed; SARB submission delayed | Owen → Chair → CEO; extraordinary Board meeting convened; Devon assesses whether submission can be made pending formal approval (SARB to confirm) |
| Multiple simultaneous indicator breaches | `RecoveryIndicatorBreached { severity: "Critical" }` events for more than one indicator | Plan may not have been stress-tested for this combined scenario | Immediate SARB notification assessed; Imani assesses resolution-framework proximity; CEO and Board convened on same business day |
| RMC member unavailable during stress event | Key member (e.g. CFO) unreachable at time of breach | Options assessment may be incomplete | Devon convenes available RMC members; designated deputy (per delegation-of-authority matrix) fills in; full RMC reconvenes as soon as possible; decision records note the absence and interim authority |

---

## 13. Escalation

| Severity | Escalation path | SLA |
|---|---|---|
| Amber breach | Helena → CEO Marc via Scrooge | Immediate notification (within 30 minutes of detection) |
| Red breach | Helena → CEO Marc; Devon convenes RMC; Owen notifies Board Chair | RMC convened within 4 hours; Board notified within 24 hours |
| Critical breach | Helena → CEO Marc via Scrooge; Devon invokes RMC and crisis-management activation; Owen notifies full Board | Immediate (same business day); SARB notification assessed within 24 hours |
| Recovery options exhausted | Devon + Helena → CEO Marc → Board (emergency meeting) → SARB | Immediate; no delay permitted |

**Note on Critical severity:** any Critical-severity breach escalates immediately to Marc (CEO) via Scrooge and to the Board (via Owen, Company Secretary, governance). Devon coordinates all operational responses; Helena maintains the risk narrative and SARB documentation. Imani (Chief Legal Counsel / legal-as-code engineer) is called in as soon as resolution-framework proximity is assessed.

---

## 14. Cross-references

- `Procedures/by-policy/pr-capital-adequacy-governance.md` — Helena's RAS schedule; source of Amber/Red/Critical recovery indicator threshold calibration.
- `Procedures/by-policy/pr-icaap-governance.md` — ICAAP cycle that triggers the annual plan update (Step E1); shared stress scenarios.
- `Procedures/by-policy/pr-liquidity-stress-test.md` — ILAAP / liquidity stress test cycle; LCR and NSFR indicator values feed into the recovery indicator dashboard.
- `Procedures/by-policy/pr-operational-resilience-framework.md` — operational resilience framework; IBS continuity runs in parallel with recovery activation; Devon coordinates both procedures if both are triggered simultaneously.
- `Procedures/by-policy/stress-test-cycle.md` (PROC-RISK-ST-01) — annual stress-test results calibrate recovery plan assumptions; reverse stress results inform recovery option credibility.
- `Procedures/by-policy/severe-but-plausible-test.md` (PROC-OR-SBP-01) — SBP scenario outcomes feed recovery plan operational-continuity assumptions.
- `Procedures/by-policy/capital-instrument-issuance.md` (PROC-CAP-CII-01) — rights-issue and AT1 issuance option execution pathway.
- `Procedures/by-policy/capital-ratio-monitoring.md` — real-time CET1 and leverage ratio monitoring; first-level detection for capital-side recovery indicators.
- `Procedures/by-policy/crisis-management-activation.md` (PROC-OR-CMA-01) — activated in parallel at Critical severity; Devon coordinates both procedures.
- `Policies/recovery-resolution-planning-policy-v1.md` — parent policy; canonical reference for option credibility criteria and governance escalation standards.

---

## 15. Substrate gaps

| Gap | Component | Status | Priority |
|---|---|---|---|
| Recovery indicator threshold monitoring automation | `@platform/risk/ras-monitor` | PLANNED | High — manual daily review is error-prone; automation needed before commencement-of-trading |
| RMC convening automation (calendar + quorum confirmation) | `@platform/recovery/rmc-convener` | PLANNED | Medium — build-phase manual; activate before licence-day |
| Recovery options assessor (pre-assessment workbench, scenario × option matrix) | `@platform/recovery/options-assessor` | PLANNED | Medium |
| SARB submission portal integration | `@platform/pa-submission/recovery-plan` | PLANNED | Low — submission channel to be confirmed at licence application |
| RAS calibration tooling (annual threshold recalibration) | `@platform/risk/ras-calibration` | PLANNED | Medium |
| Vendor/counterparty contingency register | `@platform/operations/vendor-contingency-register` | PLANNED | Medium |

---

## 16. Audit and assurance

- **Vera (internal audit engineer) — continuous recon:** Vera checks annually that a `RecoveryPlanUpdated` event exists for the current vintage. Vera checks that every `RecoveryIndicatorBreached { severity: "Red" | "Critical" }` event is followed by a `RecoveryManagementCommitteeConvened` event within the prescribed SLA. Any gap is raised as a Vera finding.
- **Thandiwe (Chief Audit Executive, governance) — annual review:** Thandiwe reviews the recovery plan annually for adequacy and regulatory compliance. The review scope includes: (a) whether the options inventory has been updated and credibility-assessed; (b) whether the escalation matrix has been tested (via tabletop or actual event); (c) whether the SARB submission was made on time; (d) whether the Board approval was properly documented. Findings are reported to the Board Audit Committee.
- **Helena — quarterly self-assessment:** Helena includes a recovery-plan status section in the quarterly Board risk report, covering indicator levels, plan currency, and any open Vera findings.
- **External assurance:** as the bank approaches licence-day, the external auditor (to be appointed, per build-phase model) will review the recovery plan as part of the pre-licence readiness assessment. The SARB SREP process will assess plan credibility as an ongoing supervisory matter post-licence.

---

## 17. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-22 | Devon (Chief Operating Officer, governance) · Helena (Chief Risk Officer, governance) | Initial POPULATED procedure. Full 17-section structure. Continuous monitoring sub-procedure (5A), recovery response sub-procedure (5B), escalation matrix (5C), pre-assessed options inventory (5D), annual plan update sub-procedure (5E). Five typed events. 12 failure modes. 6 substrate gaps. References `recovery-resolution-planning-policy-v1.md` as primary source. |
