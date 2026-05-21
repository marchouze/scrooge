---
procedureId: PROC-IS-CIC-01
title: Cyber Incident Severity Classification
author: Rashida (Chief Information Security Officer, governance)
date: 2026-05-15
owner: Rashida (Chief Information Security Officer, governance) · Iris (IO, governance)
status: POPULATED
policy-cited: Cyber Resilience Policy (in-force)
system-capability: "@platform/security/incident-classification (PLANNED)"
---

# Procedure — Cyber Incident Severity Classification

**Procedure ID:** PROC-IS-CIC-01
**Owner:** Rashida (Chief Information Security Officer, governance) — substantive owner · Iris (IO, governance) — privacy-impact dimension
**Approval:** Board Risk Committee (or Interim Audit Forum during build phase)
**Cadence:** On-trigger (every detected cyber event that enters the IR pipeline); annual review of tier thresholds
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

> **Build-phase posture.** Incident classification binds at commencement-of-trading. This procedure is also the pre-condition for regulator-notification timelines under Joint Standard 2 of 2024 §§5–8 and POPIA s.22, so it must be production-grade by the pre-licence go-live readiness gate.

## 1. Source policy

Cyber Resilience Policy (in-force). Parent IR command procedure: [`incident-response.md`](incident-response.md). Tier definitions align to the bank's Risk Appetite Statement (RAS B6 — four-tier severity model; CEO-approved 2026-05-06).

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Joint Standard 2 of 2024 (Cybersecurity & Cyber Resilience) §§5–8 | Incident response plan must include severity classification, defined escalation paths, and regulator-notification timelines keyed to severity tier. |
| Joint Standard 2 of 2024 §7 | Tier-3 and Tier-4 events require notification to the Prudential Authority / FSCA within the stipulated window. |
| POPIA s.22 | Tier-2 and above events involving personal information require notification to the Information Regulator (and, where warranted, data subjects). |
| BCBS Operational Resilience (2021) §22 | Incident severity must map to Important Business Services (IBS) impact and operational-continuity implications. |
| RAS B6 | Bank's internal risk-appetite constraint: four-tier model with CEO notification at T3/T4 and Board notification at T4. |

## 3. Purpose

Assign a standardised severity tier (P1 / P2 / P3 / P4) to every cyber event entering the incident-response pipeline. The tier determines:

- Who is notified (Senna, CEO, Board, Prudential Authority, FSCA, Information Regulator).
- How quickly response must begin.
- Whether the event is categorised as a reportable data breach (POPIA s.22).
- Whether BCP / DR activation is triggered.

Without a consistent classification step, the IR command procedure cannot enforce regulator-notification SLAs or resource the response appropriately.

## 4. Trigger

A `CyberEventDetected { eventRef, initialSignals[], detectionSource }` event is emitted by the detection layer (SIEM, alerting harness, manual report). This procedure runs as Step 1 of the IR command procedure (`incident-response.md`) before any containment or escalation steps.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive `CyberEventDetected`. Senna (or on-call analyst under Senna) opens the triage window. | Senna / on-call | `@platform/security/incident-classification` (PLANNED) | Triage begins within 15 minutes of event detection. |
| 2 | Assess business-service impact. Map the event to the five Important Business Services (IBS): FX settlement, market data, client onboarding, treasury funding, regulatory reporting. Determine which IBS are impaired (full / partial / none). | Senna | `@platform/security/incident-classification` (PLANNED) | IBS impact is the primary severity driver. |
| 3 | Assess data exposure. Iris (IO) confirms whether personal information is involved and, if so, the estimated data-subject population. | Iris | `@platform/privacy/popia-register` (PLANNED) | POPIA s.22 notification obligation attaches when personal information of 100+ data subjects is involved (or when severity of harm warrants it regardless of count). |
| 4 | Assess containability and lateral-movement risk. Senna determines whether the threat is contained, spreading, or unknown; whether privileged credentials or cryptographic material are involved. | Senna · Rashida | `@platform/security/incident-classification` (PLANNED) | Lateral-movement or credential-compromise risk escalates severity by at least one tier. |
| 5 | Assign severity tier. Apply the tier matrix below. | Senna | `@platform/security/incident-classification` (PLANNED) | Event: `CyberIncidentClassified { eventRef, tier, ibs_impacted[], pii_involved, pii_population_estimate, classification_rationale, classifiedBy, asOf }`. |
| 6 | Trigger tier-appropriate notifications. Route as per the notification matrix below. | system (paging) | `@platform/security/incident-classification` (PLANNED) | Notifications are typed events (not informal messages); each notification is `CyberIncidentNotified { eventRef, tier, notifiee, notifiedAt }`. |
| 7 | Hand off to IR command. Pass classified event to `incident-response.md` Step 2 (containment). Classification tier is locked for the incident lifecycle; re-classification allowed only on material new information (emits `CyberIncidentReclassified { eventRef, previousTier, newTier, rationale, asOf }`). | Senna | `@platform/security/incident-response` (PLANNED) | Reclassification triggers a fresh notification cycle at the new tier. |

### Tier matrix

| Tier | Label | IBS impact | Data exposure | Credential / crypto exposure | Response SLA |
|---|---|---|---|---|---|
| **P1 (T4)** | Critical | Full disruption ≥ 1 IBS, or imminent systemic risk | Confirmed material PII breach | Confirmed HSM, signing-key, or privileged-credential compromise | Immediate (0 min) |
| **P2 (T3)** | High | Partial disruption ≥ 1 IBS, or confirmed intrusion with lateral movement | Probable / suspected PII breach | Possible credential exposure, not yet confirmed | ≤ 15 minutes |
| **P3 (T2)** | Medium | Degraded performance ≥ 1 IBS; no confirmed intrusion | Low probability PII exposure | No credential risk | ≤ 1 hour |
| **P4 (T1)** | Low | No IBS impact; single-component anomaly | No data exposure | No credential risk | ≤ 4 hours |

### Notification matrix

| Tier | Senna | CEO | Board / IAF | Prudential Authority | FSCA | Information Regulator |
|---|---|---|---|---|---|---|
| P1 (T4) | Immediate | Immediate | Immediate (within 1 hour) | Within PA-stipulated window (Joint Standard 2) | Within FSCA-stipulated window | Within 72 hours if PII involved (POPIA s.22) |
| P2 (T3) | Immediate | Immediate | Within 4 hours | Within PA-stipulated window | Within FSCA-stipulated window | Within 72 hours if PII probable |
| P3 (T2) | Immediate | Within 2 hours | Summary at next BRC | Not required (monitor for escalation) | Not required | Iris assesses POPIA s.22 |
| P4 (T1) | Immediate | Summary report (daily digest) | Summary at next BRC | Not required | Not required | Not required |

## 6. Reconciliation

- **Events produced:** `CyberEventDetected` (upstream), `CyberIncidentClassified`, `CyberIncidentNotified` (per notifiee), `CyberIncidentReclassified` (on change).
- **Reconciliation check:** (1) every `CyberEventDetected` event has a matching `CyberIncidentClassified` event within the P4 SLA (4 hours); (2) every P1/P2 event has `CyberIncidentNotified` events for all required notifiees within their respective SLAs; (3) every PII-involved incident has an Iris-signed `CyberIncidentNotified` for the Information Regulator within 72 hours.
- **Failure mode:** unclassified events or missed PA/FSCA notifications are Joint Standard 2 breaches; Vera raises a finding to Senna + Devon + CEO.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `CyberIncidentClassified` / `CyberIncidentReclassified` | Event log (P1) | Indefinite | Internal — security |
| `CyberIncidentNotified` (per notifiee) | Event log (P1) | Indefinite | Internal — security |
| Regulator correspondence (PA, FSCA, IR) | Owner Inbox + `@platform/governance/pa-correspondence` (PLANNED) | Indefinite | Confidential — regulatory |
| POPIA s.22 notification record | `@platform/privacy/popia-register` (PLANNED) | Indefinite | Confidential — privacy |

## 8. Manual steps

- Tier assignment (Step 5): Senna exercises judgment combining the three assessment dimensions; the rationale is captured in `CyberIncidentClassified.classification_rationale`.
- PII scope assessment (Step 3): Iris applies judgment on data-subject population estimate and severity of harm; captured in the classification event.
- Reclassification (Step 7): any tier downgrade requires Senna + Rashida dual sign-off to prevent suppression of reporting obligations.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Classification not completed within P4 SLA | Vera recon: `CyberEventDetected` without `CyberIncidentClassified` within 4 hours | Senna + Devon; incident escalated to P3 by default |
| PA / FSCA notification missed for P1/P2 | Vera recon: missing `CyberIncidentNotified` for required notifiee within SLA | Senna + CEO; emergency notification filed; regulatory-breach event raised |
| POPIA s.22 notification missed | Vera recon: PII-involved P1/P2 without IR notification within 72 hours | Iris + CEO; emergency notification to IR; potential administrative penalty under POPIA |
| Reclassification downgrade suppressing notifications | Dual-sign-off gate | Rashida blocks downgrade until reviewed; finding to Vera |

## 10. Related procedures

- [`incident-response.md`](incident-response.md) — parent IR command procedure; this procedure is Step 1 of that procedure.
- [`popia-breach-notification.md`](popia-breach-notification.md) — PII-involving incidents trigger POPIA s.22 notification via this companion procedure.
- [`crisis-management-activation.md`](crisis-management-activation.md) — P1 / T4 events trigger BCP/DR crisis management activation; this procedure's output feeds that trigger.
- [`dr-test-execution.md`](dr-test-execution.md) — DR exercises include simulated P1 classification scenarios.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-15 | Senna + Iris (via Scrooge) | Initial POPULATED procedure. Four-tier severity model aligned to RAS B6 and Joint Standard 2 of 2024; IBS-impact and PII-exposure dimensions; notification matrix with PA/FSCA/IR SLAs. |

## 12. Audit / assurance

- Vera continuous-controls pipeline `@platform/recon/cyber-incident-classification-coverage` (PLANNED) tests: every `CyberEventDetected` within SLA classified; every required notification within SLA issued.
- Annual review of tier thresholds against Joint Standard 2 of 2024 guidance updates and the bank's IBS set; changes require Senna + Rashida approval and Vera finding-close.
- Senna reports classification statistics (volume by tier, SLA adherence) to the Risk Forum at each sitting.
- Board Risk Committee receives a summary of all P1/P2 incidents (and PA/FSCA/IR notifications) at each quarterly BRC meeting.
