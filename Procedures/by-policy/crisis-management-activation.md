---
policy-parent: Operational Resilience Policy (in-force); BCP / DR Policy (planned — Devon)
last-reviewed: 2026-05-15
procedureId: PROC-OR-CMA-01
title: Crisis Management Activation (BCP / DR)
author: Devon (COO, governance)
date: 2026-05-15
owner: Devon (COO, governance) · Helena (CRO, governance)
status: POPULATED
policy-cited: Operational Resilience Policy (in-force); BCP / DR Policy (planned — Devon)
system-capability: "@platform/operations/crisis-management (PLANNED)"
---

# Procedure — Crisis Management Activation (BCP / DR)

**Procedure ID:** PROC-OR-CMA-01
**Owner:** Devon (COO, governance) — Crisis Management Director (CMD) · Helena (CRO, governance) — risk oversight and scenario validation
**Approval:** Board Risk Committee (or Interim Audit Forum during build phase) at policy level; CMD (Devon) activates autonomously at P1/P2 trigger
**Cadence:** On-trigger (P1 / P2 severity event); rehearsed annually as part of the DR test (`dr-test-execution.md`)
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

> **Build-phase posture.** Crisis-management-activation capability must be rehearsed before the pre-licence go-live readiness gate (Saskia's substrate). An untested crisis plan is not accepted by the PA / FSCA during supervisory review.

## 1. Source policy

Operational Resilience Policy (in-force); BCP / DR Policy (planned — Devon; scaffolded under the current build-phase governance cycle). The companion DR test procedure (`dr-test-execution.md`) rehearses this activation pathway annually. The severe-but-plausible scenario test (`severe-but-plausible-test.md`) calibrates the IBS tolerances this procedure defends.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| BCBS Operational Resilience (2021) §§18–26 | BCP / DR must include crisis-management procedures with named command authority, tested within the prior 12 months, and capable of maintaining IBS within impact tolerance. |
| PA Guidance Note 1/2022 (Operational Resilience) | Banks must maintain a crisis-management framework; PA expects evidence of tested activation within the prior 12 months as part of supervisory review. |
| Joint Standard 2 of 2024 (Cybersecurity & Cyber Resilience) §8 | Cyber-triggered BCP/DR activation must follow a defined, tested process with PA/FSCA notification at T3/T4. |
| Banks Act 94 of 1990 s.81 | PA may intervene where a bank fails to maintain adequate systems for continued and reliable operation. |
| POPIA s.19 | Security safeguards must be in place to protect personal information during crisis and recovery scenarios. |

## 3. Purpose

Activate the bank's Business Continuity Plan (BCP) and / or Disaster Recovery (DR) protocols in response to a declared crisis, ensuring:

1. **Command authority** is established (CMD = Devon) and the Crisis Management Team (CMT) is assembled within SLA.
2. **Important Business Services (IBS)** are evaluated for impact and recovery actions are initiated within tolerance.
3. **Regulators** (PA, FSCA, and where relevant the Information Regulator) are notified within Joint Standard 2 / BCBS timelines.
4. **Communication** to internal stakeholders, correspondents, counterparties, and (at licence-day) clients is coordinated by the CMT.
5. **Recovery** progresses to a declared all-clear via formal `CrisisStandDown` event.

## 4. Trigger

Crisis activation is triggered by either:

1. **Automatic escalation:** A P1 (`CyberIncidentClassified { tier: "P1" }`) or P2 (`CyberIncidentClassified { tier: "P2" }`) event, or a `OperationalOutageDetected { ibsImpact: "HIGH" | "CRITICAL" }` event, propagates to this procedure via the system paging layer.
2. **Devon's manual declaration:** Devon emits `CrisisActivationDeclaration { activationReason, ibsAtRisk[], estimatedDuration, declarationTime }` directly when the CMD determines a crisis is underway independently of the above events.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Activation and CMT assembly. Devon (CMD) acknowledges the trigger; assembles the Crisis Management Team: Devon, Helena, Senna, Camille (CFO), Owen (CoSec), Zara (CCO), and the engineer responsible for the affected system (Atlas / Rashida). | Devon | `@platform/operations/crisis-management` (PLANNED) | Event: `CrisisActivated { activationRef, triggerEventRef, ibsAtRisk[], cmdId, cmtMemberIds[], activatedAt }`. CMT assembly SLA: 15 minutes from trigger for P1; 30 minutes for P2. |
| 2 | IBS impact assessment. Devon + Helena map the incident to the five IBS: FX settlement, market data, client onboarding, treasury funding, regulatory reporting. Determine which are impaired (full / partial / none) and where each stands vs its impact-tolerance window. | Devon · Helena | `@platform/operations/crisis-management` (PLANNED) | The impact-tolerance clock starts at `CrisisActivated.activatedAt`. Event: `IBSImpactAssessed { activationRef, ibs_status[], tolerance_remaining[], asOf }`. |
| 3 | BCP path selection. Devon selects the appropriate BCP response path per the scenario type and IBS impact: (a) cyber-triggered → BCP-CY path, engaging Senna as Cyber Lead within the CMT; (b) operational (system outage) → BCP-OPS path; (c) external event (market disruption, counterparty failure, infrastructure loss) → BCP-EXT path. | Devon | `@platform/operations/crisis-management` (PLANNED) | Path selection recorded in `CrisisBCPPathSelected { activationRef, bcpPath, pathRationale }`. |
| 4 | Regulator notification (where required). Owen (CoSec) prepares and lodges notifications per the matrix below. Devon approves the notification content; Camille co-signs financial notifications. | Owen · Devon · Camille (where financial) | `@platform/governance/regulator-submission` (PLANNED) | Event: `RegulatoryNotificationDispatched { activationRef, regulator, notificationRef, dispatchedAt }`. Iris co-authors where POPIA s.22 is engaged. |
| 5 | Recovery actions — IBS restoration. Atlas / Rashida / Eitan (where treasury-funding IBS affected) execute the BCP-specific recovery playbook; Devon tracks progress against tolerance window. | Atlas / Rashida / Eitan | `@platform/operations/dr-runbook` (PLANNED) | Event stream: `IBSRecoveryActionTaken { activationRef, ibs, action, actor, timestamp }`. Crisis is in active management until all impaired IBS return to green. |
| 6 | Correspondent / counterparty communication. Tomas coordinates with the primary correspondent (Standard Bank) and backup (FirstRand) where FX settlement IBS is impaired; Saskia coordinates with active counterparties. | Tomas · Saskia | Out-of-system today (SWIFT / phone; SFTP notification to correspondents) | Typed event for each communication: `CounterpartyCommunicationSent { activationRef, counterpartyRef, channel, sentAt }`. |
| 7 | Periodic CMT status updates. Devon chairs CMT calls at intervals determined by severity: every 30 minutes for P1; every 1 hour for P2. Each call produces `CMTStatusUpdate { activationRef, ibsStatus[], actionsInProgress[], nextUpdateAt }`. | Devon (chair) | `@platform/operations/crisis-management` (PLANNED) | Updates shared with the CEO at each CMT interval. |
| 8 | Board / IAF notification. Owen notifies the Board / Interim Audit Forum within 4 hours of a P1 activation or as soon as it is clear IBS tolerance will be breached. | Owen | `@platform/governance/pa-correspondence` (PLANNED) | Event: `BoardNotified { activationRef, notifiedAt }`. Helena prepares the Board risk narrative. |
| 9 | IBS restoration confirmation and stand-down. When all impaired IBS are restored within tolerance, Devon declares stand-down; emits `CrisisStandDown { activationRef, allIBSRestored, totalDuration, briefSummary, stoodDownAt }`. | Devon | `@platform/operations/crisis-management` (PLANNED) | Stand-down is a governance event; it does not close regulator correspondence (that continues under Owen). |
| 10 | Post-crisis review. Within 5 business days of stand-down, Devon convenes a post-crisis review; Vera logs findings; any identified control gap is registered as a roadmap item. | Devon · Helena · Vera | `@platform/operations/crisis-management` (PLANNED) | Event: `PostCrisisReviewCompleted { activationRef, findingsCount, ownerAssignments[], completedAt }`. Review output is an Owner Inbox deliverable. |

### Regulator notification matrix

| Trigger | Regulator | SLA | Owner |
|---|---|---|---|
| P1 / P2 cyber event | Prudential Authority | Within Joint Standard 2 §7 stipulated window | Owen + Devon |
| P1 / P2 cyber event | FSCA | Within FSCA-stipulated window | Owen |
| IBS tolerance breach (material operational failure) | Prudential Authority | Within 24 hours | Devon + Owen |
| PII involved (POPIA s.22) | Information Regulator | Within 72 hours | Iris + Owen |

## 6. Reconciliation

- **Events produced:** `CrisisActivated`, `IBSImpactAssessed`, `CrisisBCPPathSelected`, `RegulatoryNotificationDispatched`, `IBSRecoveryActionTaken`, `CounterpartyCommunicationSent`, `CMTStatusUpdate`, `BoardNotified`, `CrisisStandDown`, `PostCrisisReviewCompleted`.
- **Reconciliation check:** (1) every P1/P2 `CyberIncidentClassified` or `OperationalOutageDetected { HIGH/CRITICAL }` has a `CrisisActivated` event within 15 minutes; (2) all required regulator notifications are dispatched within their SLAs; (3) `CrisisStandDown` is followed by `PostCrisisReviewCompleted` within 5 business days.
- **Failure mode:** failure to activate crisis management on a P1 trigger, or missed regulator-notification SLA, is a Joint Standard 2 / PA supervisory finding; Vera raises to Devon + CEO immediately.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Full crisis event stream (`CrisisActivated` → `CrisisStandDown`) | Event log (P1) | Indefinite | Confidential — regulatory |
| Regulator correspondence | Owner Inbox + `@platform/governance/pa-correspondence` (PLANNED) | Indefinite | Confidential — regulatory |
| Post-crisis review report | Owner Inbox `YYYY-MM-DD_devon-helena_post-crisis-review_<activationRef>.md` | 5 years | Confidential — internal |
| CMT status-update records | Event log | 5 years | Internal |

## 8. Manual steps

- CMD declaration (Step 1): Devon exercises judgment on manual crisis declaration; no automated override.
- BCP path selection (Step 3): Devon's judgment on scenario type; Helena provides the risk-dimension input.
- Regulator notification content (Step 4): Owen + Devon draft; Camille reviews financial narrative; Iris co-authors where POPIA engaged.
- Stand-down declaration (Step 9): Devon's sole judgment; Helena confirms IBS tolerance assessment.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| CMT assembly SLA breach (> 15 min for P1) | Vera recon: `CrisisActivated.activatedAt` vs first CMT contact | Devon + CEO; assembly failure is a finding in post-crisis review |
| IBS tolerance breached without regulator notification | Vera recon: tolerance-window exhausted without `RegulatoryNotificationDispatched` | Owen + Devon + CEO; emergency notification filed; regulatory-breach event raised |
| No post-crisis review within 5 business days | Vera recon: `CrisisStandDown` without `PostCrisisReviewCompleted` within 5 days | Devon → Owen → CEO; review convened as priority |
| Crisis declared but no `CrisisActivated` event emitted | Vera recon: manual out-of-system crisis response without event record | Devon + Owen; back-record event; procedural-breach finding |

## 10. Related procedures

- [`dr-test-execution.md`](dr-test-execution.md) — annual DR test rehearses this activation pathway; test debrief feeds the post-crisis review format.
- [`severe-but-plausible-test.md`](severe-but-plausible-test.md) — SBP scenarios calibrate the IBS impact tolerances this procedure defends.
- [`incident-response.md`](incident-response.md) — P1/P2 cyber incidents trigger both the IR command procedure and this procedure in parallel; Devon and Senna coordinate command.
- [`cyber-incident-classification.md`](cyber-incident-classification.md) — P1/P2 classification is the upstream trigger for this procedure.
- [`outsourcing-due-diligence.md`](outsourcing-due-diligence.md) — correspondent-bank and cloud-provider BCP/DR compatibility is validated in the DD cycle; those assurances are called upon during recovery (Step 5).

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-15 | Devon + Helena (via Scrooge) | Initial POPULATED procedure. BCP/DR activation trigger logic; CMT assembly; IBS impact assessment; three BCP paths; regulator-notification matrix; stand-down and post-crisis review. |

## 12. Audit / assurance

- Vera continuous-controls pipeline `@platform/recon/crisis-management-coverage` (PLANNED) tests: P1/P2 events have `CrisisActivated` within SLA; regulator notifications within SLA; stand-down followed by post-crisis review.
- Annual DR test (`dr-test-execution.md`) rehearses this procedure; test debrief findings feed the roadmap.
- Devon presents a crisis-management readiness dashboard (test recency, IBS tolerance calibration, CMT roster currency) to the Risk Forum at each quarterly sitting.
- Board Risk Committee receives a summary of all crisis activations in the period and the post-crisis review findings at each quarterly BRC meeting.
