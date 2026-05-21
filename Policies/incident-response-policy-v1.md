---
policy-id: CY-IRP-01
title: Cyber and Operational Incident Response Policy v1
version: "1.0"
status: DRAFT
owner: Rashida (Chief Information Security Officer, governance)
effective-from: 2026-05-13
next-review: "2026-11-13"
citations:
  - "Joint Standard 2/2024: §6 (cyber incident response)"
  - "POPIA Act 4 of 2013: s22 (security compromise notification)"
  - "Banks Act 94 of 1990: s78 (operational risk)"
  - "FSR Act 9 of 2017: s57 (reportable irregularities)"
  - "PA Guidance Note 3/2022: operational risk events — reporting thresholds and timelines"
author: Rashida (Chief Information Security Officer, governance)
date: 2026-05-13
summary: "Establishes the bank's cyber and operational incident response framework — detection, classification, containment, eradication, recovery, and regulatory notification — aligned to Joint Standard 2/2024 and POPIA s22."
decision-required: false
applies-at: LICENCE-BIND
obligations-closed:
  - ORG-CY-04
  - ORG-CY-05
  - ORG-CY-11
  - ORG-PR(IV)-07
riskTaxonomy:
  - CY-001
  - OPS-002
  - GOV-003
---

# Cyber and Operational Incident Response Policy v1

> **Policy** | CY-IRP-01 v1.0 | Owner: Rashida (Chief Information Security Officer, governance) | Status: DRAFT | Effective: 2026-05-13

> **Standing authority.** CEO-approved regulatory readiness programme (`D-REGULATORY-READINESS-GATE-PLAN`). Implements Joint Standard 2/2024 §6 (cyber incident response), POPIA s22 (security compromise notification), Banks Act s78 (operational risk), FSR Act s57 (reportable irregularities), and PA Guidance Note 3/2022 (operational risk event reporting).
> **Obligations closed.** `ORG-CY-04` (cyber incident detection and response framework), `ORG-CY-05` (regulatory notification of cyber incidents), `ORG-CY-11` (annual cyber resilience testing), `ORG-PR(IV)-07` (POPIA breach notification to Information Regulator and data subjects).
> **Status.** LICENCE-BIND. The incident response framework must be operational at PA licence application. The supporting substrate (SIEM integration, agent-runtime anomaly detection, incident case management) is under construction per `D-REGULATORY-READINESS-GATE-PLAN`.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## Purpose

This policy establishes Hoz Bank Limited's (the "Bank's") framework for detecting, classifying, containing, eradicating, and recovering from cyber and operational incidents, and for meeting all associated regulatory notification obligations. It applies to all incidents affecting the Bank's systems, data, operations, and AI-agent infrastructure.

The policy is designed to ensure that: (i) incidents are detected promptly and classified accurately; (ii) the response is proportionate to the severity of the incident; (iii) regulatory notifications are made within prescribed timescales; (iv) affected data subjects are notified where required under POPIA s22; (v) evidence is preserved with a forensic chain of custody; and (vi) every incident produces a post-incident review that closes the control gap that enabled it.

Hoz Bank operates an AI-agent labour force (Principle 6). Incident response in an AI-agent institution must address agent-specific failure modes — compromised agent credentials, model poisoning, agent boundary violations that constitute security events, and prompt-injection attacks. These are first-class incident types under this policy.

---

## Principles

- **Detect early, contain fast.** The cost of containment rises exponentially with dwell time. SIEM and agent-runtime anomaly detection are the primary detection instruments; human-in-the-loop escalation is reserved for classification and response decisions above the agent's decision boundary.
- **Classification before containment.** No containment action is taken without a classification decision (P1–P4, see §2). Misclassification at triage costs more than a brief delay to get classification right.
- **Evidence before eradication.** Forensic evidence is preserved before any eradication or remediation action. An incident that destroys its own evidence is a compounded harm.
- **Regulatory notification is non-negotiable.** PA, POPIA Information Regulator, and FIC notifications are mandatory at specified thresholds; they are never discretionary. Rashida (Chief Information Security Officer, governance) is the notification authority; no team member may delay or suppress a notification.
- **Events are the record of truth.** Every incident event — detection, classification, containment actions, regulatory notifications, and post-incident review findings — is a typed event in the event log (Principle 1). An incident that exists only in a shared document and not in the event log is a Vera (internal audit engineer) finding.
- **AI-agent incidents are first class.** Agent infrastructure failures, model-output anomalies, credential compromise, and prompt-injection events are incident types under this policy, subject to the same detection-to-PIR lifecycle as any other incident.

---

## 1. Scope

This policy applies to:

1. **All systems and infrastructure** operated by or on behalf of the Bank — including the agent-runtime platform, event store, SIEM, market data feeds, settlement interfaces, and regulatory reporting systems.
2. **All data** processed or stored by the Bank — including personal information (as defined in POPIA), trading records, financial data, and supervisory submissions.
3. **All AI-agent processes** — including agent credentials, model inputs/outputs, agent decision logs, and the Anthropic API dependency.
4. **All third-party service providers** — including cloud infrastructure, market data vendors, settlement agents, and the Anthropic API — to the extent their incidents affect the Bank's systems or data.
5. **All build-phase and licence-day operations.** LICENCE-BIND means the framework must be in place and tested before the PA licence application gate; it is not deferred to commencement of trading.

**Out of scope.** Physical security incidents (managed under Devon's (Chief Operating Officer, governance) operational resilience programme); pure financial fraud not involving a system compromise (managed under the AML/CFT policy and Helena's (Chief Risk Officer, governance) operational risk framework, with a cross-reference to this policy for any system-compromise component).

---

## 2. Incident Classification

### 2.1 Severity Tiers

All incidents are classified on detection into one of four severity tiers. Classification is confirmed at triage and may be upgraded or downgraded as more information emerges.

| Tier | Label | Definition | RTO (Contain) | RTO (Recover) |
|---|---|---|---|---|
| **P1** | Critical | Confirmed breach of confidential data or PII; material system outage affecting core banking operations; ransomware or destructive attack; confirmed AI-agent credential compromise affecting live systems; POPIA-notifiable security compromise | 1 hour | 4 hours |
| **P2** | High | Suspected (unconfirmed) breach; partial system degradation affecting operations; malware detected but not confirmed active; AI-agent boundary violation with potential data exposure; third-party provider confirmed breach affecting Bank data | 4 hours | 24 hours |
| **P3** | Medium | Security anomaly under investigation; system performance degradation without confirmed breach; phishing attempt with no confirmed success; agent error rate spike triggering KRI amber threshold | 24 hours | 72 hours |
| **P4** | Low | Unsuccessful attack (blocked at perimeter); policy violation without data exposure; isolated technical anomaly with no business impact | 72 hours | 1 week |

### 2.2 Classification Criteria

Classification is performed by Rashida (Chief Information Security Officer, governance) or a delegated Tier-1 responder, based on the following criteria:

- **Data exposure:** Has confidential data, PII, or regulated information been accessed, exfiltrated, or exposed without authorisation?
- **System availability:** Has a critical banking system been rendered unavailable or materially impaired?
- **Integrity:** Has data been modified, deleted, or corrupted without authorisation?
- **AI-agent compromise:** Have agent credentials, model inputs, or decision boundaries been compromised?
- **Regulatory trigger:** Does the incident trigger a mandatory PA or POPIA notification (see §5)?

Classification events:

```
IncidentDetected { incidentId, detectedAt, detectionSource, initialSeverity, description }
IncidentClassified { incidentId, classifiedAt, classifiedBy, severity, dataExposure, systemsAffected, regulatoryTrigger }
IncidentReclassified { incidentId, reclassifiedAt, reclassifiedBy, previousSeverity, newSeverity, reason }
```

---

## 3. Governance

### 3.1 Roles and Responsibilities

**Rashida (Chief Information Security Officer, governance)** — Policy owner; incident commander for P1 and P2 incidents; PA notification authority; POPIA breach notification authority; chairs the post-incident review for P1/P2; reports to CEO on P1 incidents within 2 hours of classification.

**Helena (Chief Risk Officer, governance)** — Operational risk classification of incidents as loss events per the Operational Risk Policy; ensures P1/P2 incidents are captured in the loss event database; co-signs the post-incident review for P1/P2 incidents where control gaps are identified.

**Devon (Chief Operating Officer, governance)** — System availability and recovery operations; BCP activation authority for P1 system outages; coordinates third-party provider response.

**Zara (Chief Compliance Officer, governance)** — Regulatory notification liaison for FIC (Financial Intelligence Centre) where AML/CFT implications exist; escalation to PA on compliance-related irregularities under FSR Act s57.

**Imani (Legal-as-code engineer, engineering — reports to Senna)** — Legal analysis of notification obligations; privilege considerations in incident documentation; external counsel engagement at P1.

**Owen (Company Secretary, governance)** — Files typed governance events for Board notifications; manages BRC and CEO incident briefings.

**Marc (CEO)** — Authorising principal for P1 escalation to the PA; approves POPIA s22 notifications to data subjects; receives P1 incident reports within 2 hours.

### 3.2 Incident Response Team

For P1 and P2 incidents, Senna constitutes an Incident Response Team (IRT) comprising relevant team members based on incident type. The IRT is coordinated on a dedicated incident channel; all IRT decisions are captured as typed events. The IRT is dissolved on post-incident review completion.

### 3.3 Governance Events

All incident governance decisions are typed events:

```
IrtConstituted { incidentId, severity, irtMembers[], incidentCommander }
ContainmentActionTaken { incidentId, actionId, actionType, takenBy, takenAt, description }
EradicationCompleted { incidentId, eradicatedAt, confirmedBy }
RecoveryCompleted { incidentId, recoveredAt, confirmedBy, systemsRestored[] }
IncidentClosed { incidentId, closedAt, finalSeverity, rootCause, controlGaps[] }
PostIncidentReviewCompleted { incidentId, reviewDate, findings[], actionItems[], approvedBy }
```

---

## 4. Response Lifecycle

### 4.1 Detect

Detection sources include:

1. **SIEM alerts** — the Bank's Security Information and Event Management system monitors all system and network logs for anomalous patterns. Alerts are classified automatically against known signatures and behavioural baselines; alerts above the SIEM alert threshold are escalated to Senna within 15 minutes.
2. **Agent-runtime anomaly flags** — the agent-runtime platform monitors for: agent error rate spikes above the KRI red threshold; agent boundary violation events; unusual API call patterns to the Anthropic API; agent credential anomalies. Agent-runtime anomaly flags are classified as incidents if they meet the P3–P1 criteria in §2.
3. **External reports** — third-party providers, law enforcement, FSCA/PA notifications, cybersecurity researchers, or affected clients reporting anomalous activity.
4. **PA/FSCA notifications** — the PA or FSCA may notify the Bank of a detected incident or vulnerability affecting the sector; these are classified as incidents immediately.
5. **Internal identification** — any team member (agent or human) who identifies a potential security event raises it to Senna immediately.

All detected events result in an `IncidentDetected` event within 15 minutes of detection. Senna acknowledges and begins triage within the timeframe set by the SIEM alert tier.

### 4.2 Triage

Triage is the process of confirming the `IncidentDetected` signal and producing a classification decision (§2). Triage must be completed within:

- P1: 30 minutes of detection
- P2: 2 hours of detection
- P3/P4: 4 hours of detection

Triage produces an `IncidentClassified` event. If the initial classification proves incorrect as more information emerges, `IncidentReclassified` is emitted.

### 4.3 Contain

Containment stops the incident from spreading or causing further harm. Containment actions are taken before eradication. Forensic evidence (§6.1) is preserved before any containment action that would alter or destroy evidence.

**P1 containment actions** (examples — actual actions depend on incident type):
- Network isolation of affected systems
- Revocation of compromised agent credentials
- Suspension of affected AI-agent processes pending forensic review
- Activation of fallback processing procedures (Devon)
- Third-party provider isolation (if provider-side breach)

All containment actions are filed as `ContainmentActionTaken` events with the action type, actor, and rationale.

### 4.4 Eradicate

Eradication removes the root cause of the incident — malware removal, patching, credential rotation, model re-validation (for AI agent compromise), configuration remediation. Eradication must be confirmed before recovery begins.

`EradicationCompleted { incidentId, eradicatedAt, confirmedBy }` is the canonical eradication record.

### 4.5 Recover

Recovery restores normal operations within the RTO for the incident's severity tier (§2.1). Recovery includes:

- System restoration and integrity verification
- Re-enabling of isolated agent processes after security clearance
- Confirmation that monitoring is active on restored systems
- Communication to affected parties (internal and, where required, external)

`RecoveryCompleted { incidentId, recoveredAt, confirmedBy, systemsRestored[] }` is the canonical recovery record.

### 4.6 Post-Incident Review

A post-incident review (PIR) is mandatory for all P1 and P2 incidents. The PIR must be completed and the `PostIncidentReviewCompleted` event filed within **14 calendar days** of incident closure for P1/P2 incidents.

The PIR covers:
1. **Timeline reconstruction** — from first indicator to closure, with timestamps.
2. **Root-cause analysis** — technical and process root causes; contributing factors.
3. **Control gap identification** — which control failed or was absent that allowed the incident to occur or escalate?
4. **Regulatory notification review** — were all required notifications made on time and with the correct content?
5. **Action items** — specific remediation actions, owners, and deadlines. Each action item is a typed `IncidentRemediationAction { incidentId, actionId, description, owner, dueDate }` event.
6. **Lessons learned** — changes to this policy, procedures, SIEM rules, or agent-runtime controls recommended by Senna and Helena.

PIR findings feed directly into: the RCSA (control gap findings); the loss event database (if the incident resulted in a quantifiable loss); and the cyber resilience testing programme (§4.7).

### 4.7 Cyber War-Gaming and Tabletop Exercises

**Minimum frequency: annually.** Rashida (Chief Information Security Officer, governance) runs at minimum one tabletop exercise per calendar year covering at least one P1-scenario (e.g., ransomware, data exfiltration, AI-agent credential compromise). Additional exercises are triggered by: major infrastructure changes; significant PIR findings; PA or FSCA thematic review on cyber resilience; material new threat intelligence.

Exercise outcomes are filed as `CyberResilienceExerciseCompleted { exerciseId, date, scenario, participants[], gaps[], actionItems[] }` events. Gaps identified in exercises are treated as RCSA findings and subject to the same remediation governance.

---

## 5. Regulatory Notification

### 5.1 PA Notification — Cyber Incidents (Joint Standard 2/2024 §6)

**Trigger:** Any P1 or P2 incident that constitutes a "cyber incident" under Joint Standard 2/2024 §6 must be reported to the PA.

**Timeline:**
- **Initial notification:** Within **24 hours** of classification as P1 (or P2 where a cyber incident is confirmed). Senna notifies the PA via the prescribed notification channel.
- **Detailed report:** Within **72 hours** of initial notification, a detailed incident report is submitted covering: incident description, affected systems, data exposure assessment, containment actions, regulatory impact assessment.
- **Final report:** Within **30 days** of incident closure, a full post-incident report is submitted covering PIR findings, root cause, and remediation actions.

**Escalation chain:** Senna → Marc (CEO) → PA. Marc must approve all PA notifications for P1 incidents. For P2 cyber incidents, Senna may notify without CEO approval but must inform Marc simultaneously.

Notification events:
```
RegulatoryNotificationMade { incidentId, authority: "PA", notificationType, notifiedAt, notifiedBy, channel, summary }
```

### 5.2 POPIA Notification — Information Regulator (POPIA s22)

**Trigger:** A "security compromise" under POPIA s22 is any unauthorised access to or acquisition of personal information that is likely to prejudice the data subject (the "serious harm" threshold). Senna assesses whether the serious-harm threshold is met; Imani (Legal-as-code engineer, engineering) provides legal analysis for borderline cases.

**Timeline:**
- **Information Regulator notification:** As soon as reasonably possible after discovery; in practice, the Bank targets **72 hours** of discovery of a POPIA-notifiable security compromise.
- **Data subject notification:** After notifying the Information Regulator, affected data subjects must be notified in the prescribed form. Timing and method are subject to the Information Regulator's direction where investigation is ongoing.

**Serious harm assessment factors** (POPIA s22(4)):
- The nature of the personal information compromised.
- The apparent purpose of the unauthorised access.
- The number of data subjects affected.
- The probability that the information will be misused.
- Whether notification would be in the public interest.
- Whether the responsible party has taken steps to render the information unusable.

Marc (CEO) approves all data-subject notifications under POPIA s22.

### 5.3 FSR Act s57 — Reportable Irregularities

**Trigger:** The FSR Act s57 requires the Bank to report "reportable irregularities" to the PA — defined as any act or omission by any person responsible for the management of the Bank that has resulted or is likely to result in financial loss to the Bank or its clients, or that constitutes a violation of a law or regulation.

Zara (Chief Compliance Officer, governance) assesses whether an incident constitutes a reportable irregularity under FSR Act s57. Incidents involving confirmed regulatory breaches (e.g., a cyber incident causing a POPIA breach, a system failure causing a regulatory reporting failure) are assessed against the s57 threshold. Where the threshold is met, Senna and Zara jointly notify the PA.

### 5.4 PA Guidance Note 3/2022 — Operational Risk Events

PA Guidance Note 3/2022 sets thresholds and timelines for reporting operational risk events to the PA. Incidents that result in quantifiable operational losses above the PA's materiality threshold are reported as operational risk events per the Operational Risk Policy (cross-reference `Policies/operational-risk-policy-v1.md`, §1.4) and per this policy's regulatory notification framework.

Senna and Helena (CRO) jointly determine whether an incident triggers operational risk event reporting under Guidance Note 3/2022. [Citation: TBC — precise thresholds and timelines in Guidance Note 3/2022; Imani (Legal-as-code engineer, engineering) + external counsel confirm at licence-application gate.]

---

## 6. Evidence Preservation

### 6.1 Forensic Chain of Custody

Evidence is preserved before any containment action that would alter or destroy it. The principle is: **preserve first, contain second** (except where immediate containment is required to prevent ongoing exfiltration — in which case Senna authorises expedited containment with contemporaneous evidence documentation).

Forensic chain of custody requirements:
1. **System image capture** — affected systems are imaged before any changes are made, where technically feasible.
2. **Log preservation** — all relevant logs (SIEM, agent-runtime, network flow, application, operating-system) are captured and stored in the BLAKE3 document store per `D-RMS-PHASE-1` immediately on incident detection.
3. **Access controls** — only authorised IRT members have access to forensic evidence; evidence access is logged.
4. **Chain of custody log** — every transfer or access of forensic evidence is recorded as a typed `ForensicEvidenceAccessed { incidentId, evidenceId, accessedBy, accessedAt, purpose }` event.
5. **External forensics** — for P1 incidents, Imani (Legal-as-code engineer, engineering) engages external forensic counsel; external forensic firm access is subject to the same chain-of-custody logging.

### 6.2 Log Retention During Incident

During an active incident, log retention is extended to **7 years** (from the normal 3-year retention cycle) for all logs relevant to the incident scope. Senna issues a log-preservation notice at incident classification; Devon ensures retention settings are adjusted.

The log-preservation notice is a typed `LogPreservationNoticeIssued { incidentId, scope, retentionPeriod, issuedBy, issuedAt }` event.

### 6.3 Legal Privilege Considerations

Senna and Imani (Legal-as-code engineer, engineering) assess, at the time of IRT constitution, whether legal privilege applies to any incident documentation. Where privilege is claimed, privileged documents are segregated and not included in the general incident case file accessible to all IRT members. Privilege assessments are reviewed at the PIR stage.

---

## 7. Controls and Monitoring

### 7.1 Ongoing Controls

- **SIEM monitoring.** The SIEM operates continuously, processing all system, network, and application logs. SIEM alert rules are reviewed and updated at minimum annually and after each PIR that identifies a detection gap.
- **Agent-runtime anomaly detection.** The agent-runtime platform continuously monitors for anomaly flags (§4.1). Agent anomaly detection rules are reviewed at minimum annually and after each PIR involving an AI-agent incident.
- **Vulnerability management.** Senna maintains a vulnerability management programme: critical patches are applied within 48 hours of release; high-severity patches within 7 days; medium/low within 30 days. Patch currency KRI (§5 of Operational Risk Policy) is monitored monthly.
- **Access review.** Agent credentials and human access rights are reviewed quarterly; privileged access is reviewed monthly. Orphan credentials are revoked within 24 hours of identification.
- **Threat intelligence.** Senna subscribes to sector-relevant threat intelligence feeds (PA/FSCA cyber advisories, FS-ISAC, CISA); threat intelligence is integrated into SIEM rules and tabletop exercise scenarios.

### 7.2 KRI Monitoring

Incident-response KRIs (monitored monthly by Senna):

| KRI | Amber | Red |
|---|---|---|
| Mean time to detect (MTTD) — P1 incidents | > 30 min | > 2 hours |
| Mean time to contain (MTTC) — P1 incidents | > 2 hours | > 4 hours |
| P1/P2 regulatory notifications on time | < 100% | < 90% |
| PIR completion within 14 days — P1/P2 | < 100% | < 90% |
| Open incident remediation actions past due | > 3 | > 10 |
| Tabletop exercise completed per calendar year | < 1 | 0 |

KRI amber/red breaches are reported to Senna immediately and to Helena for operational risk reporting. Red KRI breaches trigger immediate escalation to Marc (CEO).

---

## 8. Reporting

### 8.1 Internal Reporting Cadence

- **Real-time:** Senna notifies Marc (CEO) within 2 hours of P1 classification; within 24 hours of P2 classification. Owen (Company Secretary, governance) files a `BoardNotified { incidentId, severity, notifiedAt }` event for P1 incidents.
- **Monthly:** Senna produces an incident summary for the Operational Risk Committee (ORC) — number of incidents by severity, open remediation actions, KRI status, tabletop exercise status.
- **Quarterly:** Senna presents to the Board Risk Committee (BRC) — incident trend, regulatory notification compliance, PIR findings and action-item closure.
- **Annual:** Senna produces an annual cyber resilience report — MTTD/MTTC trends, top 5 incident root causes, tabletop exercise outcomes, control improvements. Included in the ICAAP as the cyber/operational resilience chapter.

### 8.2 Regulatory Reporting Cadence

Regulatory notifications per §5 are filed as `RegulatoryNotificationMade` events; Senna maintains a regulatory notification register (event-derived projection) that tracks: notification made, notification acknowledged, supplementary report due dates. Zara (CCO) reviews the register quarterly for completeness.

---

## 9. Exceptions and Escalation

### 9.1 Exception Process

Any deviation from this policy (e.g., deferring a regulatory notification beyond the prescribed timeline) requires:
1. Written justification from Rashida (Chief Information Security Officer, governance).
2. Marc (CEO) written approval.
3. Filing as a typed `PolicyException { policyId: "CY-IRP-01", exceptionId, justification, approvedBy, approvedAt, reviewDate }` event.
4. Legal review by Imani (Legal-as-code engineer, engineering) where the exception involves a regulatory notification timeline.

No exception may be granted that would result in a breach of a mandatory regulatory notification obligation under Joint Standard 2/2024 §6, POPIA s22, or FSR Act s57. If a notification deadline cannot be met, the PA/Information Regulator is notified of the delay and its cause — the delay itself is not a secret.

### 9.2 Escalation Matrix

| Trigger | Escalate to | Timeline |
|---|---|---|
| P1 incident classified | Marc (CEO) + Senna (incident commander) | Within 2 hours |
| PA notification required | Marc (CEO) approves; Senna submits | Within 24 hours of P1 classification |
| POPIA s22 notification required | Marc (CEO) approves; Senna submits | Within 72 hours of discovery |
| FSR Act s57 reportable irregularity | Senna + Zara (CCO) jointly notify PA | As soon as reasonably possible |
| PIR overdue (> 14 days) | Helena (CRO) escalates to CEO | Day 15 |
| Open remediation action > 90 days | Helena (CRO) escalates to BRC | Quarterly BRC meeting |

---

## 10. Obligations Closure Table

| Obligation | Description | Status | Closed by section |
|---|---|---|---|
| `ORG-CY-04` | Cyber incident detection and response framework | DRAFT (LICENCE-BIND) | §4 (Response Lifecycle), §7.1 (Controls — SIEM + agent-runtime detection) |
| `ORG-CY-05` | Regulatory notification of cyber incidents to PA | DRAFT (LICENCE-BIND) | §5.1 (PA notification — Joint Standard 2/2024 §6) |
| `ORG-CY-11` | Annual cyber resilience testing programme | DRAFT (LICENCE-BIND) | §4.7 (Cyber war-gaming and tabletop exercises) |
| `ORG-PR(IV)-07` | POPIA breach notification to Information Regulator and data subjects | DRAFT (LICENCE-BIND) | §5.2 (POPIA s22 — serious harm assessment, notification timeline) |

---

## 11. Substrate Dependencies and Gaps

### 11.1 Substrate Under Construction

- **SIEM platform (Senna, under Devon).** Integration of all system/network logs into a centralised SIEM; automated alert rule library. Discharge exit signal: `SiemAlertRuleLibraryValidated { version, ruleCount, validatedBy }` event from synthetic alert replay.
- **Agent-runtime anomaly detection (Atlas (Infrastructure / platform engineer, engineering) + Senna).** Real-time monitoring of agent error rate, boundary violations, and credential anomalies. Discharge exit signal: `AgentAnomalyDetected` events flowing from synthetic anomaly injection test.
- **Incident case management (Devon + Senna).** Structured incident case file; IRT communication channel; forensic evidence store integration with BLAKE3 document store. Discharge exit signal: first `IncidentClosed` event on a synthetic incident scenario.

### 11.2 Procedures Planned but Not Yet Authored

- `Procedures/by-policy/incident-triage-procedure.md` — step-by-step triage protocol, classification matrix, IRT constitution steps.
- `Procedures/by-policy/forensic-evidence-preservation.md` — log preservation checklist, chain-of-custody form, external forensics engagement protocol.
- `Procedures/by-policy/regulatory-notification-procedure.md` — PA notification template (Joint Standard 2/2024 §6), POPIA s22 notification template, FSR Act s57 procedure, notification register maintenance.
- `Procedures/by-policy/tabletop-exercise-procedure.md` — scenario library, exercise facilitation guide, outcome recording template.

### 11.3 Citation Gaps (TBC)

Per Principle 2, no sub-clause indices are invented. The following are `[citation: TBC]` until Imani (Legal-as-code engineer, engineering) + external counsel ratify at the licence-application gate:

1. Joint Standard 2/2024 §6 — precise paragraph indices for cyber incident response obligations and notification timelines.
2. PA Guidance Note 3/2022 — precise materiality thresholds and reporting timelines for operational risk events.
3. FSR Act s57 — precise definition of "reportable irregularity" and notification timeline.
4. POPIA s22(4) — confirmation that the serious-harm factors listed are exhaustive or illustrative (Imani to confirm).
5. Information Regulator prescribed notification form — channel and format for s22 notifications.

---

## 12. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1.0 | 2026-05-13 | Rashida (Chief Information Security Officer, governance) | Initial policy authored. Eleven sections: (1) Scope — all systems, data, AI-agent processes, third-party providers; (2) Incident Classification — P1/P2/P3/P4 tiers with RTO by tier and classification event schema; (3) Governance — roles (Senna, Helena, Devon, Zara, Imani, Owen, Marc), IRT constitution, typed governance events; (4) Response Lifecycle — Detect (SIEM, agent-runtime, external, PA/FSCA, internal) → Triage → Contain → Eradicate → Recover → PIR (mandatory 14-day timeline for P1/P2), annual tabletop exercise requirement; (5) Regulatory Notification — PA 24h/72h/30-day cadence (Joint Standard 2/2024 §6), POPIA s22 72h Information Regulator + data-subject notification with serious-harm assessment factors, FSR Act s57 reportable irregularities, PA Guidance Note 3/2022 operational risk events; (6) Evidence Preservation — forensic chain of custody, log retention during incident (7 years), legal privilege considerations; (7) Controls and Monitoring — SIEM, agent-runtime anomaly detection, vulnerability management, access review, threat intelligence; KRI table (MTTD, MTTC, notification compliance, PIR completion, open actions, tabletop frequency); (8) Reporting — real-time to CEO (P1: 2h, P2: 24h), monthly ORC, quarterly BRC, annual cyber resilience report; (9) Exceptions and Escalation — exception process (CEO approval + typed event), no exception for mandatory notifications, escalation matrix; Obligations closure table: ORG-CY-04/05/11, ORG-PR(IV)-07. Substrate and citation gaps per Principle 2. Identity discipline per CLAUDE.md. |
