---
status: POPULATED
---
# Procedure — Severe-but-Plausible Scenario Test

**Procedure ID:** PROC-OR-SBP-01
**Owner:** Devon (Chief Operating Officer, governance) · Helena (Chief Risk Officer, governance)
**Approval:** Board
**Cadence:** Annual (minimum); triggered on any material change to an Important Business Service
**Version:** v0.1 — 2026-05-13
**Status:** POPULATED

## 1. Source policy

`Policies/operational-resilience-policy-v1.md` — Operational Resilience Policy.

The policy requires: (a) identification and board-approval of Important Business Services (IBS); (b) setting of board-approved impact tolerances for each IBS; (c) annual scenario testing to determine whether each IBS can remain within tolerance under a severe-but-plausible disruption; (d) a self-assessment submitted to the PA annually.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-18` | Identify Important Business Services; set impact tolerances for each; test whether the bank can remain within those tolerances during a severe-but-plausible disruption scenario. Board-approved annually. |
| `ORG-PR-45` | Comply with PA Directive D4/2023 (Operational Resilience Framework for Banks and Designated Institutions), including structured scenario testing, self-assessment, and PA submission on request. |

## 3. Purpose

Test whether each board-approved Important Business Service (IBS) can remain within its board-approved impact tolerance during a severe-but-plausible disruption scenario. The test produces:

1. Evidence for the PA operational resilience self-assessment (ORG-PR-45 / D4/2023).
2. The board's annual resilience sign-off (ORG-PR-18).
3. A remediation-action register for any IBS–scenario combination where a tolerance breach is identified.
4. Updated input to the Recovery Plan trigger calibration (aligned with `stress-test-cycle.md` Step 13).

The procedure is distinct from DR testing (`dr-test-execution.md` PROC-OR-DR-01): DR testing verifies that recovery technical capabilities work; this procedure tests whether the business outcome (IBS remaining within tolerance) is achievable even when the technical recovery capabilities are exercised.

## 4. Trigger

- **Annual (minimum):** one full cycle per calendar year, timed to align with the Board's annual governance calendar. Devon co-ordinates the schedule; Helena calibrates scenario severity.
- **Material-change trigger:** any board-approved change to the IBS inventory (addition, removal, or redefinition of an IBS) or to an impact tolerance triggers an out-of-cycle test for the affected IBS within 90 days of board approval.
- **Post-incident trigger:** any actual disruption that caused or approached a tolerance breach triggers a targeted re-test of the affected IBS within 60 days of incident closure (per `incident-response.md`).
- **Regulatory request:** PA may request a specific scenario test at any time; Helena co-ordinates within the PA-specified timeframe.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Open the SBP test cycle; emit `SBPTestCycleOpened { vintage, trigger: annual \| material_change \| post_incident \| regulatory_request, ibs_inventory_version }` | `system` (scheduled) + `Devon` | `@platform/event-store` ✓ | Devon confirms the IBS inventory version (board-approved) before the cycle opens. Vintage = calendar year for annual cycles; date-stamp for out-of-cycle runs. |
| 2 | Confirm board-approved IBS inventory and impact tolerances in force for this cycle; record version reference in cycle-opening event | `Devon` + `Helena` | `@platform/resilience/ibs-register` (`PLANNED`) | IBS inventory (board-approved): (1) OTC derivative execution and confirmation; (2) payment settlement; (3) margin management; (4) regulatory reporting; (5) client data management. Tolerances are board-approved and stored in the IBS register. |
| 3 | Select scenarios for the cycle (minimum 4 per annual cycle; minimum 1 per triggered out-of-cycle run); document calibration rationale for each | `Helena` + `Devon` | `@platform/resilience/scenario-library` (`PLANNED`) | Minimum scenario set (annual): (a) Cyber attack on core infrastructure — ransomware encryption of primary compute layer; agent runtime unavailable; (b) Cloud provider outage — primary Azure region fully unavailable ≥ 72 hours; (c) Critical third-party failure — sponsor bank (payments channel) or Strate (CSD) unavailable; (d) Key-person / key-agent loss — simultaneous loss of 3 critical agents and 2 human overseers. Additional scenarios as directed by Helena or the Board. |
| 4 | For each scenario: identify the disruption boundary (which systems, services, or people are assumed unavailable); confirm the scenario is genuinely severe and plausible (calibration rationale documented) | `Helena` | `@platform/resilience/scenario-library` (`PLANNED`) | Calibration rationale document filed in RMS Document register before execution begins. Helena attests plausibility; Senna (Security engineer, engineering) reviews cyber scenarios; Devon reviews operational scenarios. |
| 5 | Convene tabletop exercise for each scenario: IBS owners, technical leads, Helena (CRO), Devon (COO); Senna (Security engineer, engineering) for cyber scenarios; Zara (CCO/MLRO, governance) for regulatory-reporting IBS | `Devon` (chair) + `Helena` + IBS owners | `@platform/resilience/tabletop-facilitation` (`PLANNED`) | Tabletop exercises are the default test mode; live system failover is only used if the Board explicitly approves a live test and Senna confirms the test window is safe. Exercise outputs recorded as structured session notes in RMS. |
| 6 | For each scenario × IBS combination: assess (a) would the disruption exceed the board-approved impact tolerance? (b) time-to-tolerance-breach under the scenario; (c) existing controls or fallback procedures that could sustain the IBS within tolerance | `Devon` + `Helena` + IBS owners | `@platform/resilience/tolerance-assessment` (`PLANNED`) | Assessment must be documented per IBS per scenario — all 20 combinations for a 4-scenario annual cycle (4 scenarios × 5 IBS). |
| 7 | For each combination where tolerance would be breached: emit `SBPToleranceBreachIdentified { ibs_id, scenario_id, gap_description, severity: critical \| high \| medium }` and create a remediation action | `system` | `@platform/event-store` ✓ | Emit `SBPScenarioExecuted { scenario_id, ibs_id, outcome: within_tolerance \| breach }` for every combination regardless of outcome. |
| 8 | For each tolerance breach: create remediation action with owner, target completion date, and verification method; emit `SBPRemediationActionCreated { action_id, ibs_id, scenario_id, owner, due_date }` | `Devon` + relevant IBS owner | `@platform/resilience/remediation-tracker` (`PLANNED`) | Remediation actions are tracked in the RMS Workstreams register. Critical breaches require board notification within 5 business days. |
| 9 | Draft Operational Resilience Self-Assessment report: summarise IBS inventory, impact tolerances, scenarios tested, outcomes per IBS × scenario, tolerance breaches, remediation actions in progress | `Devon` + `Helena` | `@platform/resilience/self-assessment-report` (`PLANNED`) | Self-assessment is the PA-submission-ready document. Devon drafts; Helena reviews; Zara reviews regulatory-reporting IBS section. Filed in RMS Document register. |
| 10 | BRC review: Devon and Helena present scenarios, outcomes, and breach remediation plan to BRC; BRC challenges scenario severity and tolerance assessments; material challenges trigger re-assessment | `Devon` + `Helena` + BRC | `@platform/event-store` ✓ | BRC sign-off recorded as typed event. Emit `SBPTestResultsReviewed { vintage, brc_sign_off: true \| false, board_submission_authorised }`. |
| 11 | Board approval: Devon and Helena present the self-assessment and remediation plan to the Board; Board approves the self-assessment and authorises PA submission if requested; Board resolution recorded | `Devon` + `Helena` + Board | `@platform/event-store` ✓ | Emit `SBPTestCycleCompleted { vintage, board_approved_date, breaches_identified, remediation_actions_open }`. Board-approved date is the cycle-completion date. |
| 12 | PA submission (on request): package the self-assessment and submit to the PA within the PA-specified timeframe; Owen (Company Secretary, governance) co-ordinates receipt acknowledgement | `Devon` + `Helena` + `Owen` | `@platform/pa-submission/resilience` (`PLANNED`) | Emit `OperationalResilienceSelfAssessmentPublished { vintage, submission_date, pa_reference }`. Retain submission package in RMS. |
| 13 | Track remediation actions to completion: Devon monitors open remediation actions; IBS owners report progress quarterly; re-test triggered when a remediation action targeting a tolerance breach is marked complete | `Devon` + IBS owners | `@platform/resilience/remediation-tracker` (`PLANNED`) | If a remediation action is not completed by its due date, Devon escalates to the CEO and BRC. Overdue critical actions are PA-notification candidates. |

## 6. Reconciliation

- **Events produced:**
  - `SBPTestCycleOpened { vintage, trigger, ibs_inventory_version }` — cycle inception.
  - `SBPScenarioExecuted { scenario_id, ibs_id, outcome: within_tolerance | breach }` — per scenario × IBS combination; expected count = (number of scenarios) × 5 IBS per annual cycle; minimum 20 for a 4-scenario cycle.
  - `SBPToleranceBreachIdentified { ibs_id, scenario_id, gap_description, severity }` — for each breach outcome only.
  - `SBPRemediationActionCreated { action_id, ibs_id, scenario_id, owner, due_date }` — one per breach identified.
  - `SBPTestResultsReviewed { vintage, brc_sign_off, board_submission_authorised }` — BRC sign-off.
  - `SBPTestCycleCompleted { vintage, board_approved_date, breaches_identified, remediation_actions_open }` — Board approval.
  - `OperationalResilienceSelfAssessmentPublished { vintage, submission_date, pa_reference }` — PA submission (on request).
- **Invariants:**
  - `SBPTestCycleCompleted` cannot be emitted unless `SBPScenarioExecuted` events exist for every IBS × scenario combination in scope (no skipped combinations).
  - `SBPTestCycleCompleted` must be preceded by `SBPTestResultsReviewed { brc_sign_off: true }` and a Board-resolution event.
  - Every `SBPToleranceBreachIdentified` event must be matched by a `SBPRemediationActionCreated` event before cycle closure.
  - Annual cycles must produce `SBPTestCycleCompleted` events for every vintage; a missing vintage is a Vera finding.
- **Failure mode:** Tabletop facilitation capability unavailable at cycle start → Devon schedules manually; exercise notes captured in RMS as unstructured documents until the platform capability is built. Helena is notified if the annual cycle risks missing the Board's governance calendar.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `SBPTestCycleOpened` + `SBPScenarioExecuted` + `SBPTestCycleCompleted` events | Event log | 10 years (PA inspection / resilience history) | Restricted |
| `SBPToleranceBreachIdentified` events | Event log | 10 years | Restricted |
| `SBPRemediationActionCreated` events and progress updates | Event log + RMS Workstreams register | 10 years | Restricted |
| Scenario calibration rationale documents | RMS Document register | 10 years | Restricted |
| Tabletop exercise session notes | RMS Document register | 10 years | Restricted |
| Operational Resilience Self-Assessment report | RMS Document register + `@platform/pa-submission/resilience` | 10 years | Critical |
| Board resolution approving self-assessment | RMS Document register | Permanent | Restricted |
| BRC challenge-session minutes | RMS Document register | 10 years | Restricted |
| PA submission correspondence and receipt acknowledgement | RMS Correspondence register | Permanent | Critical |

## 8. Manual steps

- **Step 3–4** — Scenario selection and calibration: Helena must exercise professional judgement in selecting and calibrating scenarios. The platform records calibration inputs and rationale as typed events; it does not substitute for Helena's methodology judgement on what constitutes "severe and plausible" for the bank's specific risk profile.
- **Step 5** — Tabletop exercise facilitation: Devon chairs the exercise; outcomes reflect the judgement of IBS owners and domain leads. The platform records session inputs; it cannot replicate the expert challenge that gives the exercise its evidential weight.
- **Step 6** — Tolerance assessment: the assessment of whether a disruption would breach a tolerance involves operational judgement — particularly around manual fallback procedures and human-in-the-loop residual capacity. Devon and Helena must agree the assessment before it is recorded.
- **Step 10** — BRC challenge: an independent governance step. The committee's challenge and any requested re-assessments are matters of oversight discretion.
- **Step 11** — Board approval: the Board's approval of the self-assessment and tolerance adequacy is a human governance decision. Recorded as a board-resolution event.
- **Step 12** — PA submission: Helena interprets any PA questions and determines the appropriate response. Regulatory dialogue requires human judgement.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Annual cycle not opened by scheduled date | No `SBPTestCycleOpened` event by Board-calendar date | Devon → CEO immediately; Board informed; PA deadline risk assessed |
| IBS inventory not board-approved for the current cycle | Cycle-opening check fails on IBS register version | Devon → Board for approval; cycle held open until approved |
| Scenario calibration challenged and rejected by BRC | No `SBPTestResultsReviewed { brc_sign_off: true }` after BRC session | Helena re-calibrates; Devon reschedules BRC session; timeline risk assessed |
| Tolerance breach identified: critical severity | `SBPToleranceBreachIdentified { severity: critical }` | Devon → CEO → Board within 5 business days; PA pre-notification assessed by Owen + Helena |
| Tolerance breach: remediation action overdue | Remediation tracker: due date passed without completion event | Devon → IBS owner → CEO; BRC notified at next meeting; PA notification assessed if breach is critical |
| Live test causes production disruption | Unplanned system impact during live-test window | Senna + Atlas invoke `incident-response.md`; Devon halts test; Board informed within 24 hours |
| PA requests self-assessment outside scheduled cycle | PA letter received | Devon + Helena + Owen respond within PA-specified timeframe; out-of-cycle `SBPTestCycleOpened` if new test required |
| Material IBS change not triggering out-of-cycle test | Vera recon: IBS register version change without corresponding cycle-opened event within 90 days | Devon + Helena → CEO; out-of-cycle test initiated immediately |

## 10. Related procedures

- `dr-test-execution.md` (PROC-OR-DR-01) — DR testing validates that the technical recovery capabilities assumed in the SBP scenarios actually work. DR test RTO/RPO results feed the SBP tolerance assessment for each IBS.
- `stress-test-cycle.md` (PROC-RISK-ST-01) — operational risk stress inputs (Step 7) include key-person / key-agent loss and third-party failure scenarios; reverse stress results feed the SBP scenario calibration.
- `incident-response.md` — actual incidents that approach or breach a tolerance trigger a post-incident SBP re-test (Step 13).
- `rcsa-cycle.md` (PROC-RISK-RCSA-01) — RCSA outputs (operational risk register, control effectiveness ratings) inform the scenario calibration and the tolerance assessment for each IBS.
- `outsourcing-due-diligence.md` — critical third-party failure scenarios (Step 3(c)) are calibrated using outsourcing due-diligence records (sponsor bank, Strate).

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Devon + Helena (via Scrooge dispatch) | Initial populated stub. Five IBS; four scenario types; 13-step cycle including tabletop facilitation, BRC review, Board approval, PA submission. Covers ORG-PR-18 + ORG-PR-45 / D4/2023. |
| v0.2 | 2026-05-15 | Devon (Chief Operating Officer, governance) + Helena (Chief Risk Officer, governance) | Promoted to POPULATED — all 12 sections verified complete. |

## 12. Audit / assurance

- Vera periodic check: every vintage year has a `SBPTestCycleCompleted` event; every IBS × scenario combination has a corresponding `SBPScenarioExecuted` event; every breach has a `SBPRemediationActionCreated` event.
- Helena's annual stress-test cycle (PROC-RISK-ST-01) cross-references SBP outcomes where operational risk scenarios overlap.
- Board-level review of the self-assessment constitutes the primary assurance channel for ORG-PR-18 compliance.
- PA SREP dialogue (if initiated) is the external assurance channel for ORG-PR-45 compliance.
