---
procedureId: PROC-OPS-D3-01
title: Directive 3 of 2018 (Cloud Computing & Offshoring of Data) PA Notification
author: Devon (COO, governance)
date: 2026-05-15
owner: Devon (COO, governance) · Owen (CoSec, governance) · Imani (Legal-as-code engineer) · Senna (CISO, governance) · Rashida (Cyber resilience engineer) · Iris (IO, governance)
status: POPULATED
policy-cited: Outsourcing & Third-Party Risk Policy (planned — Devon)
system-capability: "@platform/governance/d3-notification-packet (PLANNED)"
---

# Procedure — Directive 3 of 2018 (Cloud Computing & Offshoring of Data) PA Notification

**Procedure ID:** PROC-OPS-D3-01
**Owner:** Devon (COO, governance) — substantive owner · Owen (CoSec, governance) — governance-calendar sequencing · Imani (Legal-as-code engineer) — legal review · Senna (CISO, governance) + Rashida (Cyber resilience engineer) — cyber attestations · Iris (IO, governance) — POPIA s.72 transfer assessment
**Approval:** Board (or Interim Audit Forum during build phase) — Directive 3 notifications are governance-level filings to the Prudential Authority
**Cadence:** On-trigger (pre-engagement of every notifiable arrangement); update notification on material change to an existing arrangement
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

> **Build-phase posture.** The PA-notification obligation binds at commencement-of-trading (or earlier if the arrangement is contracted ahead of commencement and the PA expects pre-commencement notification per Directive 3 timing). This procedure governs the notification lifecycle from the date a notifiable arrangement is proposed.

## 1. Source policy

Outsourcing & Third-Party Risk Policy (planned — Devon); Cloud Computing Policy (planned — Devon + Senna). The companion DD procedure is [`outsourcing-due-diligence.md`](outsourcing-due-diligence.md); this procedure handles the regulator-facing notification step for PA-notifiable arrangements.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| SARB Directive 3 of 2018 (Cloud Computing and Offshoring of Data) §§3–5 | Pre-engagement notification to the Prudential Authority for cloud computing or offshoring arrangements involving material data or material business activities. |
| SARB Directive 3 of 2018 §6 | Notification format and minimum content (DD packet, data residency, encryption posture, exit strategy, data subject implications). |
| SARB Directive 3 of 2018 §7 | Update notification on material change. |
| SARB PA Outsourcing Directive (Banks Act regulations) | Parent regime within which Directive 3 sits for PA-supervised banks. |
| POPIA s.72 (cross-border transfer assessment) | Where the arrangement involves cross-border personal information, the s.72 transfer assessment is part of the notification packet (Iris co-signs). |

## 3. Purpose

Notify the Prudential Authority — pre-engagement, in the format and with the minimum content specified by Directive 3 of 2018 — of every cloud-computing or offshoring arrangement the bank enters into that is in scope under the directive. In-scope arrangements include:

- Cloud-computing arrangements where material data or material business activities sit on the cloud provider.
- Cross-border correspondent or settlement arrangements where the counterparty processes the bank's payment / settlement instructions outside South Africa, or where data flows cross-border.
- Cross-border data hosting or processing.

For the FX-settlement context: the named correspondent pair (Standard Bank primary, FirstRand backup) is notifiable to the extent it constitutes a material arrangement for cross-border functions (FX settlement via SWIFT MT202 / ISO 20022 pacs.009 across CLS).

The procedure ensures no engagement goes live without a filed `Directive3NotificationFiled` event, and that material changes to notified arrangements trigger update notifications within the PA-stipulated window.

## 4. Trigger

A `Directive3NotificationRequired { engagementRef, arrangementType, materialityTier }` event is emitted when:

1. The DD procedure (`outsourcing-due-diligence.md`) closes with `materiality = HIGH` and `crossBorder = true`, emitting `OutsourcingDueDiligenceCompleted` that in turn triggers this event.
2. A material change is identified to an existing notified arrangement (additional services, change of jurisdiction, change of data residency, change of sub-processor chain).
3. Owen (CoSec, governance) sequences the notification into the governance calendar.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive `Directive3NotificationRequired`. Devon assembles the notification packet drawing from the closed DD packet (from `outsourcing-due-diligence.md` artefacts). | Devon | `@platform/governance/d3-notification-packet` (PLANNED) | Packet draws from `OutsourcingDueDiligenceCompleted.ddPacketRef`. |
| 2 | Compose Directive 3 minimum-content sections. Devon + Imani draft the notification per §6 minimum-content template: arrangement description, materiality, regulatory standing of provider, data residency, encryption / key custody, BCP / DR, exit strategy, data subject implications. | Devon · Imani | `@platform/governance/d3-template` (PLANNED) | Template versioned and maintained by Owen as procedural-discipline custodian. |
| 3 | Cyber attestation (Joint Standard 2 of 2024 third-party extensions). Senna authors the technical attestation (connectivity controls, key isolation, IR cooperation, supply chain); Rashida provides the CISO governance sign-off. | Senna · Rashida | `@platform/security/d3-cyber-attestation` (PLANNED) | Event: `D3CyberAttestationCompleted { engagementRef, attestorId, asOf }`. |
| 4 | POPIA s.72 cross-border transfer assessment (where applicable). Iris assesses whether the arrangement involves cross-border personal information flows and, if so, documents the s.72 assessment. | Iris | `@platform/privacy/s72-transfer-assessment` (PLANNED) | Required where personal information crosses borders; Iris co-signs the notification. Cite POPIA s.72. |
| 5 | Compliance review. Mira (under Zara) provides final compliance sign-off on notification content: regulatory standing, FIC / sanctions exposure of the arrangement. | Mira — under Zara | `@platform/compliance/d3-review` (PLANNED) | Event: `D3ComplianceReviewCompleted { engagementRef, reviewerId, asOf }`. |
| 6 | Board (or Interim Audit Forum) approval to file. Owen sequences the notification into the governance calendar; Board (or IAF) approves filing. Board-reserved per Governance Framework. | Owen | `@platform/governance/approvals` (PLANNED) | Event: `D3FilingApproved { engagementRef, approvalAuthority, asOf }`. |
| 7 | Sign and lodge with Prudential Authority. Owen (secretariat) lodges; Devon (COO) and Camille (CFO) co-sign per PA signing protocol. | Owen · Devon · Camille | `@platform/governance/regulator-submission` (PLANNED) | Format per Directive 3 §6. Event: `D3NotificationLodged { engagementRef, lodgedAt, packetRef }`. |
| 8 | Track PA correspondence. Owen + Imani track acknowledgements, RFIs, and conditions. RFIs answered within PA-stipulated timeline. | Owen · Imani | `@platform/governance/pa-correspondence` (PLANNED) | Each RFI response is a typed event. PA conditions are registered with owner + deadline. |
| 9 | File closing event. When PA acknowledgement received, Owen emits `Directive3NotificationFiled { engagementRef, lodgedAt, paAckAt, packetRef, asOf }`. Engagement may go live post-acknowledgement. | Owen | `@platform/governance/d3-notification-packet` (PLANNED) | Reconciles to `OutsourcingDueDiligenceCompleted`; engagement go-live is gated on this event. |
| 10 | Material-change update notifications. On any material change to the arrangement (Directive 3 §7), Devon → Owen re-triggers the notification cycle from Step 1 (delta packet only). | Devon → Owen | `@platform/governance/d3-update-notification` (PLANNED) | Event: `Directive3NotificationUpdated { engagementRef, changeDescription, updatedAt }`. |

## 6. Reconciliation

- **Events produced:** `Directive3NotificationRequired`, `D3CyberAttestationCompleted`, `D3ComplianceReviewCompleted`, `D3FilingApproved`, `D3NotificationLodged`, `Directive3NotificationFiled` (closing event), `Directive3NotificationUpdated` (material-change cadence).
- **Reconciliation check:** (1) every PA-notifiable arrangement (DD-closed with `materiality = HIGH` and `crossBorder = true`) has a `Directive3NotificationFiled` event before the engagement goes live; (2) the notification packet's section completeness matches the Directive 3 §6 minimum-content template (no missing sections); (3) material-change updates are filed within the PA-stipulated window.
- **Failure mode:** engagement going live without `Directive3NotificationFiled` is a regulatory breach. Devon + CEO notified immediately; emergency notification filed; Vera raised finding.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `Directive3NotificationFiled` / `Directive3NotificationUpdated` | Event log (P1) | Indefinite | Internal — regulatory |
| Notification packet (all §6 sections) | Owner Inbox `YYYY-MM-DD_devon-owen_d3-notification-packet_<engagementRef>.md` + artefact store | Indefinite (regulatory record) | Confidential — regulatory |
| Cyber attestation | Event log + artefact store | Indefinite | High |
| POPIA s.72 transfer assessment (where applicable) | `@platform/privacy/popia-register` (PLANNED) + artefact store | Indefinite | Confidential — privacy |
| PA correspondence trail (acknowledgement, RFIs, conditions) | Owner Inbox + `@platform/governance/pa-correspondence` (PLANNED) | Indefinite | Confidential — regulatory |

## 8. Manual steps

- Directive 3 notification composition (Step 2): Devon + Imani exercise judgment on arrangement description and materiality narrative; Imani authors the legal-section content.
- Cyber attestation (Step 3): Senna authors the technical narrative; Rashida (CISO) governance sign-off is human discretion recorded as a typed event.
- POPIA s.72 assessment (Step 4): Iris's cross-border-transfer judgment is human discretion captured per Principle 2.
- Board / IAF approval (Step 6): governance decision recorded as a typed event.
- Filing (Step 7): out-of-system today; submission to PA via PA-published channel (ePortal or physical, as directed); event is the typed proof of filing.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Engagement goes live without `Directive3NotificationFiled` | Vera recon pipeline: `OutsourcingDueDiligenceCompleted` with `crossBorder = true` without matching `Directive3NotificationFiled` at go-live | Devon + CEO immediately; emergency notification filed; regulatory-breach event raised |
| PA RFI deadline missed | `@platform/governance/pa-correspondence` timer | Owen → Devon → CEO; response priority elevated |
| Material change to notified arrangement not triggering update notification | Vera recon: contract-amendment event or sub-processor-change event without `Directive3NotificationUpdated` | Owen + Devon; emergency update notification |
| Cyber attestation not completed before filing | Step 3 gate check | Devon blocks filing until Senna + Rashida complete |
| POPIA s.72 not completed where required | Step 4 gate check | Owen blocks filing until Iris completes |

## 10. Related procedures

- [`outsourcing-due-diligence.md`](outsourcing-due-diligence.md) — companion procedure; this procedure fires from Step 10 of that procedure on PA-notifiable engagements.
- [`incident-response.md`](incident-response.md) — incidents affecting a notified arrangement may trigger update-notification obligation under Directive 3 §7.
- [`popia-breach-notification.md`](popia-breach-notification.md) — where a notified arrangement involves a personal-information breach, POPIA s.22 notification runs in parallel.
- [`change-management.md`](change-management.md) — material changes to the arrangement route through change management before triggering the update-notification cycle.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-09 | Devon (via Scrooge) | Initial STUB draft. Scaffolded under approved decision chain; v1 substance required ahead of M4 commencement-of-trading. |
| v1.0 | 2026-05-15 | Devon + Owen (via Scrooge) | Promoted to POPULATED. Added standard 12-section frontmatter, full step table with typed events, reconciliation, evidence artefacts, failure modes. All `[citation: TBC]` stubs replaced with binding regulation names; ORG-* IDs to be populated by Mira in the obligations-register curation cadence. |

## 12. Audit / assurance

- Vera continuous-controls pipeline `@platform/recon/d3-notification-coverage` (PLANNED) tests: every PA-notifiable arrangement has `Directive3NotificationFiled`; notification packet section completeness; material-change updates on cadence.
- Findings reportable to Owen + Devon; critical findings (engagement without notification) reportable to CEO and escalated to BRC.
- Owen (CoSec) produces an annual summary of all Directive 3 filings for the governance calendar (Board / IAF).
- Annual review of this procedure against the SARB Directive 3 of 2018 text and any PA guidance updates; changes trigger a procedural update through Owen.
