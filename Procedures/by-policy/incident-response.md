---
id: PROC-CY-01
policy-parent: §3 — Incident Response Policy
last-reviewed: 2026-05-06
status: POPULATED
---
# Procedure — Incident response (IR command)

**Procedure ID:** PROC-CY-01
**Owner:** Senna (security engineer) · Rashida (CISO — governance) · Iris (privacy interface) · Zara (compliance interface)
**Approval:** BRC
**Cadence:** On-trigger (continuous readiness)
**Version:** v1.0 — 2026-05-06
**Status:** Approved (post Round 2; system capability `PLANNED`)

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-infosec-ops.md` §3 — Incident Response Policy.
`Owner Inbox/2026-05-06_core-policies-infosec-ops.md` §2 — Cyber Resilience Policy.
RAS B6 — four-tier severity model (CEO approved 2026-05-06).

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CY-01` (Joint Standard 2 of 2024) | Maintain cybersecurity and cyber-resilience framework with named accountability. |
| `ORG-CY-04` (Joint Standard 2 of 2024) | Incident reporting to PA / FSCA per stipulated timelines. |
| `ORG-CY-05` (Joint Standard + BCBS Operational Resilience) | Tested cyber-incident response with rehearsed runbooks. |
| `ORG-CY-11` (RAS B6) | Cyber severity tiers T1–T4 with Regulator-notification thresholds at T3 / T4. |
| `ORG-PR(IV)-07` (POPIA s.22) | Notify Information Regulator and data subjects of compromise (when PII involved). |
| `ORG-PR-18` (BCBS Operational Resilience) | Identify Important Business Services; severe-but-plausible scenario testing. |

## 3. Purpose

Coordinate the bank's response to security and operational incidents — detection, classification, containment, eradication, recovery, regulator notification, and post-incident review — under a named command structure that preserves evidence and meets Joint-Standard timelines.

## 4. Trigger

- **Detection signals:** SIEM alert; EDR alert; anomaly-detection event; service-availability degradation; insider report; third-party operator notification under POPIA s.21.
- **Escalation from another procedure:** sanctions-screening unavailability; payments-channel failure; threat-intel-driven proactive search.

Each trigger emits an `IncidentDetected` event with severity hint.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive `IncidentDetected`; assign Incident Commander (Senna or delegate) | `system` (paging) → `human` (IC) | `@platform/ir/paging` (`PLANNED`) | IC runs the response. Event: `IncidentCommanderAssigned`. |
| 2 | Initial classification per RAS B6 four-tier (T1–T4) | `human` (IC) with `system` (severity helper) | `@platform/ir/severity-classifier` (`PLANNED`) | Uplift always permitted; downgrade requires CRO concurrence. Event: `IncidentClassified { tier }`. |
| 3 | Containment — isolate affected systems, revoke compromised credentials, snapshot for forensics | `system` + `human` (IC) | `@platform/ir/containment` + `@platform/identity` (`PLANNED`) | Containment actions are typed events with reversibility flag. |
| 4 | Notify stakeholders per tier (T1 internal log; T2 Iris pre-screen; T3 CRO + CEO + Iris; T4 Board + Regulator pre-notification) | `system` paging | `@platform/notification` (`PLANNED`) | Notification timestamps captured. |
| 5 | Forensic evidence handling | `system` + `human` (IC) | `@platform/ir/evidence-vault` (`PLANNED`) | Chain of custody is itself a typed event. POPIA tipping-off prevention applied where FIC-adjacent. |
| 6 | If PII involved → invoke `popia-breach-notification.md` workflow in parallel | `human` (Iris takes the regulator-facing) | (cross-procedure) | Iris and IC coordinate; concurrent execution. |
| 7 | If financial-crime indicators → invoke `str-filing.md`; preserve tipping-off discipline | `human` (Zara as MLRO) | (cross-procedure) | Restricted to MLRO investigation set. |
| 8 | Eradication — remove the threat (patch, revoke, rotate keys, etc.) | `system` + `human` (IC) | `@platform/ir/eradication` (`PLANNED`) | Each remediation is a typed event with verification. |
| 9 | Recovery — restore services per IBS impact tolerances | `system` + `human` | `@platform/ir/recovery` + `@platform/bcdr` (`PLANNED`) | RTO / RPO tracked against IBS targets. |
| 10 | Regulator submissions (T3 / T4) per Joint Standard 2 of 2024 timelines | `human` (Senna for cyber; Iris for POPIA; Zara for FIC) | `@domains/regulator-engagement` (`PLANNED`) | Submission timestamps captured. |
| 11 | Post-incident review (PIR) within 14 days | `human` (IC chairs; affected domain leads attend) | `@platform/ir/pir` (`PLANNED`) | Lessons-learned events feed change management and policy updates. |
| 12 | Close incident; update threat-intel; tune detection | `human` (IC) | `@platform/ir/closure` (`PLANNED`) | Event: `IncidentClosed { closure_reasons, lessons }`. |

## 6. Reconciliation

- **Events produced:**
  - `IncidentDetected`, `IncidentCommanderAssigned`, `IncidentClassified`.
  - `ContainmentAction`, `EvidencePreserved`, `EradicationAction`, `RecoveryAction`.
  - `RegulatorNotificationSubmitted` (when T3 / T4).
  - `PIRConducted`, `IncidentClosed`.
- **Reconciliation check:**
  - Every `IncidentDetected` is followed by either `IncidentClosed` within tier-appropriate SLA or escalation-overdue alerts.
  - Every `IncidentClassified { tier: T3 | T4 }` produces `RegulatorNotificationSubmitted` within Joint-Standard timeline; missed deadlines escalate to CEO + Board.
  - Every `IncidentClosed` is preceded by exactly one `PIRConducted` (within 14 days of close).
  - Severity-downgrade events carry CRO concurrence (typed signature).
- **Failure mode:** IR pipeline unavailable → fall back to documented offline runbook with manual paging (Senna's secondary contact list); restoration is itself a tracked event.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| All incident events | Event log | Permanent (P1) | Critical |
| Forensic vault contents (logs, memory dumps, disk images) | IR vault with chain-of-custody | Per legal hold; minimum 7 years | Critical |
| Regulator submissions | Document store + event hash | Permanent | Critical |
| PIR report | Document store + event log | Permanent | High |
| IR runbook executions | Event log + scenario archive | 7 years | High |

## 8. Manual steps

- **Step 2** (classification): IC's judgement, supported by severity-classifier hints.
- **Step 5** (evidence handling): forensic best practice requires human discretion at key points.
- **Step 10** (regulator submissions): out-of-system today; future-state portal integration. Each submission is a typed event with the submitter identity.
- **Step 11** (PIR chair): IC chairs; lessons captured as policy / procedure changes.

Each manual step is a tracked exception under P2, justified by the operational nature of incident response.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| IC unavailable | Paging failure | Secondary IC; Senna's escalation tree |
| Severity mis-classified (under) | Vera's PIR review | AC reports; classifier retraining (Tier 1 model) |
| Regulator deadline missed | Statutory timer event | CEO + CRO immediate; Regulator engagement |
| PIR overdue (> 14d post-close) | Projection alert | Devon + Helena; AC notified at 21d |
| Containment leaks (incomplete isolation) | Detection re-fires | Re-classification (likely uplift); immediate Board notification at T4 |
| Tipping-off violation (FIC-adjacent) | Access-audit projection | Zara → Helena → Vera; criminal-offence implications |

## 10. Related procedures

- `popia-breach-notification.md` — invoked in parallel when PII is involved.
- `str-filing.md` — invoked when financial-crime indicators exist.
- `change-management.md` — eradication and recovery may require emergency changes.
- `cyber-incident-classification.md` (`PLANNED`) — detailed classification rules.
- `severe-but-plausible-test.md` (`PLANNED`) — IR-readiness exercises.
- `recovery-plan.md` (`PLANNED`) — Critical-severity recovery-plan execution.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-06 | Senna + Devon (Chief Operating Officer) + Iris + Zara | Initial draft, pre-board reviewed under IR Policy and Cyber Resilience Policy. |
| v1.1 | 2026-05-07 | Scrooge (custodial edit) | Owner field updated to reflect Rashida's CISO hire (2026-05-06). The interim "CISO function: Devon" reference replaced with Rashida (Chief Information Security Officer, governance); Senna remains the engineering owner. No substantive changes to procedure steps, reconciliation, or escalation. |

## 12. Audit / assurance

- Annual rehearsal of the IR command (table-top + technical exercise); rehearsal events captured.
- Vera reviews PIR reports; pattern-detection across PIRs feeds operational-risk register.
- Continuous-controls projection: time-to-classify, time-to-contain, time-to-notify reported to BRC quarterly.
- Joint-Standard 1 of 2024 self-assessment covers IR readiness on the annual cycle.
