---
procedureId: PROC-OPS-OUTS-01
title: Outsourcing Due Diligence (Pre-Engagement)
author: Devon (COO, governance)
date: 2026-05-15
owner: Devon (COO, governance) · Rashida (Chief Information Security Officer, governance) · Iris (IO, governance) · Imani (Legal-as-code engineer) · Mira (Regulatory intelligence engineer)
status: POPULATED
policy-cited: Outsourcing & Third-Party Risk Policy (planned — Devon)
system-capability: "@platform/third-party-risk/intake (PLANNED)"
---

# Procedure — Outsourcing Due Diligence (Pre-Engagement)

**Procedure ID:** PROC-OPS-OUTS-01
**Owner:** Devon (COO, governance) — substantive owner · Rashida (Chief Information Security Officer, governance) · Iris (IO, governance) · Imani (Legal-as-code engineer) · Mira (Regulatory intelligence engineer — FIC / sanctions exposure on the third party)
**Approval:** BRC (Board Risk Committee) at v1; Interim Audit Forum during build phase
**Cadence:** On-trigger (pre-engagement of every material third party); annual review of every active engagement
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

> **Build-phase posture.** Banking-specific outsourcing obligations bind at commencement-of-trading. This procedure scaffolds the due-diligence cycle ahead of that gate; v1 is the binding form for all engagements proposed ahead of M4 commencement.

## 1. Source policy

Outsourcing & Third-Party Risk Policy (planned — Devon; in `Procedures/_index.md` "Operations & technology" section; Risk Management Framework parent). Pending policy authorship under the current build-phase governance cycle.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| SARB PA Outsourcing Directive (Banks Act regulations on outsourcing material business activities) | Pre-engagement due diligence on third parties performing material business activities; ongoing oversight; exit strategy. |
| SARB Directive 3 of 2018 (Cloud Computing and Offshoring of Data) | Material correspondent for cross-border functions notifiable to PA; due-diligence package required. See companion procedure `directive-3-pa-notification.md`. |
| Joint Standard 2 of 2024 (Cybersecurity & Cyber Resilience), third-party-risk extensions | Cyber + operational due diligence on material third parties; supply-chain security; IR cooperation. |
| POPIA s.21 (operator agreements) | Data-processing terms with any third party that processes personal information on behalf of the bank. |
| FIC Act (third-party AML/CFT exposure) | Reputational + regulatory exposure to third party's own AML/CFT discipline. |

## 3. Purpose

Confirm — before the bank engages a material third party (correspondent bank, cloud provider, market-data vendor, regulated-industry supplier, processor under POPIA s.21) — that the third party meets the bank's threshold on:

- Regulatory standing (no active enforcement action that materially impairs the service).
- Financial viability (no near-term insolvency risk that would interrupt the service).
- Operational resilience (BCP, DR, IBS impact-tolerance compatibility).
- Cyber posture (Joint Standard 2 of 2024 third-party expectations).
- AML / CFT and sanctions discipline (the bank inherits reputational exposure).
- Data protection (POPIA operator-agreement terms; cross-border transfer assessment if applicable).
- Contractual exit conditions (the bank can change provider without stranding operations).

## 4. Trigger

A `OutsourcingEngagementProposed { thirdPartyRef, serviceCategory, materiality }` event is emitted by the engaging owner (e.g. Tomas for FX correspondent; Atlas for cloud provider) when a candidate third party is identified.

Materiality classification follows the Outsourcing & Third-Party Risk Policy materiality matrix (planned). For the FX correspondent pair (Standard Bank primary, FirstRand backup, per `D-FX-CORRESPONDENT-PAIR-NAMING`), materiality is **HIGH** (cross-border function; CLS-settlement-path; Directive 3 of 2018 notifiable).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive `OutsourcingEngagementProposed`; assign DD lead. Devon (or delegate) confirms materiality and opens the due-diligence cycle. | system (paging) → Devon | `@platform/third-party-risk/intake` (PLANNED) | DD lead coordinates the multi-discipline review. Event: `OutsourcingDueDiligenceOpened { thirdPartyRef, materialityTier, ddLeadId, asOf }`. |
| 2 | Regulatory standing check. Review PA enforcement register; FSCA findings; equivalent foreign-regulator findings if applicable. | Mira · Imani | `@platform/compliance/regulatory-screening` (PLANNED) | Block-and-refer on any active enforcement action that would materially impair the service. |
| 3 | Financial viability check. Review credit ratings; latest financial statements; concentration of bank's position with the third party. | Camille · Eitan | `@platform/treasury/counterparty-credit` (PLANNED) | For correspondent banks: SA-CCR / credit-limit framework applies; cite Helena for risk-concentration check. |
| 4 | Operational resilience check. Assess BCP / DR documentation against the bank's IBS impact-tolerance ladder; confirm scenario alignment. | Devon | `@platform/operations/resilience-assessment` (PLANNED) | Cross-reference the bank's five IBS; confirm the third party's RTO / RPO are inside the bank's tolerances. |
| 5 | Cyber + InfoSec due diligence. Assess connectivity controls, credential isolation, key custody, IR cooperation, supply-chain posture per Joint Standard 2 of 2024 third-party extensions. | Senna · Rashida | `@platform/security/third-party-cyber-dd` (PLANNED) | Senna authors technical attestation; Rashida (CISO) signs governance-layer sign-off. |
| 6 | AML / CFT and sanctions exposure check. Assess third party's own AML programme; screen against sanctions lists; PEP screening. | Mira — under Zara | `@platform/compliance/sanctions-screening` (PLANNED) | Mira runs the screening; Zara (CCO) approves. Any hit is a block pending Zara decision. |
| 7 | Data-protection due diligence (POPIA s.21 operator). Assess operator-agreement terms; perform cross-border transfer s.72 assessment if applicable. | Iris | `@platform/privacy/operator-agreement-template` (PLANNED) | Required for any third party that processes personal information on behalf of the bank. |
| 8 | Contract negotiation. Negotiate operational-SLAs, indemnities, exit-trigger clauses, and data-processing terms per Imani's clause library. | Imani | `@platform/legal/clause-library` | ISDA-Master-class for FX correspondents; operational-SLAs; indemnities for settlement failures; exit triggers. |
| 9 | Materiality-based approval routing. Package the DD findings for approval: HIGH materiality routes to BRC (or Interim Audit Forum during build phase); LOW / MEDIUM routes to Devon alone. | Devon → BRC (HIGH) / Devon (LOW/MEDIUM) | `@platform/governance/approvals` (PLANNED) | Approval is itself a typed event with `approvalAuthority` payload. |
| 10 | Lodge due-diligence packet. Devon emits `OutsourcingDueDiligenceCompleted { thirdPartyRef, materialityTier, ddPacketRef, approvalRef, asOf }`. For PA-notifiable engagements (HIGH materiality + crossBorder = true), this event triggers `directive-3-pa-notification.md`. | Devon | `@platform/third-party-risk/intake` (PLANNED) | Packet feeds companion procedure. |
| 11 | Engagement go-live. All discipline leads confirm the contracted relationship is live only after all checkpoint events are captured and — for PA-notifiable engagements — the `Directive3NotificationFiled` event has been emitted. | All discipline leads | `@platform/operations/onboard-third-party` (PLANNED) | Live cut-over is itself a typed event. |

## 6. Reconciliation

- **Events produced:** `OutsourcingEngagementProposed`, `OutsourcingDueDiligenceOpened`, `OutsourcingDueDiligenceCompleted { thirdPartyRef, materialityTier, ddPacketRef, approvalRef }`, `OutsourcingDueDiligenceReviewed` (annual cadence).
- **Reconciliation check:** (1) every active material third-party engagement has a matching `OutsourcingDueDiligenceCompleted` event (no engagement without DD); (2) every PA-notifiable engagement has a paired `Directive3NotificationFiled` event before go-live; (3) annual-review cadence is honoured — a follow-on `OutsourcingDueDiligenceReviewed` event lands within 12 months.
- **Failure mode:** engagement going live without `OutsourcingDueDiligenceCompleted` is a Vera finding reported to Devon + BRC; engagement with HIGH materiality going live without `Directive3NotificationFiled` is a regulatory breach reported immediately to Devon + CEO.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `OutsourcingEngagementProposed` / `OutsourcingDueDiligenceCompleted` / `OutsourcingDueDiligenceReviewed` | Event log (P1) | Indefinite | Internal |
| DD packet (regulatory standing, financial viability, resilience, cyber-DD, AML/sanctions, POPIA s.21 assessment, contract drafts) | Owner Inbox `YYYY-MM-DD_devon_outsourcing-dd-packet_<thirdPartyRef>.md` + artefact store | ≥ 5 years (or for duration of relationship + 5 years) | Confidential — regulatory + legal |
| Approval record | Event log with `approvalAuthority` payload | Indefinite | Internal |
| POPIA operator agreement | `@platform/legal/document-ledger` (PLANNED) | For duration of relationship + 5 years | Confidential — legal |

## 8. Manual steps

- Regulatory standing check (Step 2): Mira and Imani exercise judgment on materiality of any regulator findings; Zara approves the AML / sanctions conclusion.
- Financial viability (Step 3): Camille and Eitan apply judgment on credit-concentration risk; Helena reviews risk envelope.
- Cyber attestation (Step 5): Senna authors the technical attestation from qualitative review and documentation; Rashida (CISO, governance) provides the governance sign-off that binds the bank.
- Contract negotiation (Step 8): Imani leads; human judgment on indemnity terms and exit clauses is tracked as a typed decision event.
- Build-phase: DD packets are filed as Owner Inbox deliverables until the `@platform/third-party-risk/intake` substrate lands.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Regulatory standing block (active enforcement action) | Step 2 | Devon + Zara + CEO; engagement suspended pending resolution |
| Financial viability concern (near-insolvency signal) | Step 3 | Devon + Camille + Helena; alternative-provider identification initiated |
| Cyber DD fail (Joint Standard 2 / supply-chain risk) | Step 5 | Senna + Rashida + Devon; engagement suspended; alternative or mitigant required |
| AML / sanctions hit on third party | Step 6 | Mira → Zara (CCO) → CEO; engagement blocked until cleared |
| Go-live without completed DD | Vera recon pipeline | Devon + BRC; emergency DD commissioned; engagement suspended |
| Go-live without PA notification (HIGH + crossBorder) | Vera recon pipeline | Devon + CEO + Owen; emergency notification filed; regulatory-breach event raised |

## 10. Related procedures

- [`directive-3-pa-notification.md`](directive-3-pa-notification.md) — companion procedure for PA-notifiable arrangements; triggered by Step 10 of this procedure.
- [`incident-response.md`](incident-response.md) — third-party cyber incident invokes IR; this procedure's cyber-DD includes IR-cooperation assessment.
- [`dr-test-execution.md`](dr-test-execution.md) — DR tests may cover third-party failover; operational resilience check (Step 4) aligns scope.
- [`kyc-onboarding.md`](kyc-onboarding.md) — correspondent banks are also counterparties; KYC onboarding covers the party-identity layer; this DD covers the engagement layer.
- [`outsourcing-due-diligence.md`](outsourcing-due-diligence.md) (self) — annual re-review trigger produces `OutsourcingDueDiligenceReviewed`.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-09 | Devon (via Scrooge) | Initial STUB draft. Scaffolded under approved decision chain; v1 substance required ahead of M4 commencement-of-trading. |
| v1.0 | 2026-05-15 | Devon (via Scrooge) | Promoted to POPULATED. Added standard 12-section frontmatter, full step table, reconciliation, evidence artefacts, failure modes. All `[citation: TBC]` stubs replaced with the binding regulation names; ORG-* IDs to be populated by Mira in the obligations-register curation cadence. |

## 12. Audit / assurance

- Vera continuous-controls pipeline `@platform/recon/third-party-risk-coverage` (PLANNED) tests: every active material third-party engagement has `OutsourcingDueDiligenceCompleted`; every PA-notifiable engagement has `Directive3NotificationFiled`; annual reviews are on cadence.
- Findings reportable to Devon + Owen; critical findings (engagement without DD) reportable to BRC at next sitting.
- Rashida (CISO) consumes the cyber-DD evidence for her second-line opinion to the Risk Forum.
- Annual review of this procedure by Devon against the Outsourcing & Third-Party Risk Policy when that policy is authored; interim: align to SARB PA outsourcing directive.
