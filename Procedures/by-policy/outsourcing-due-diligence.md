# Procedure — Outsourcing due diligence (pre-engagement)

**Procedure ID:** PROC-OPS-OUTS-01
**Owner:** Devon (Chief Operating Officer, governance) — **substantive owner** · Senna (Security engineer) · Iris (Information Officer, governance) · Imani (Legal-as-code engineer) · Mira (Compliance / RegTech engineer — FIC / sanctions exposure on the third party)
**Approval:** BRC (Board Risk Committee) at v1; Interim Audit Forum during build phase
**Cadence:** On-trigger (pre-engagement of every material third party); annual review of every active engagement
**Version:** v0.1 — 2026-05-09 — STUB
**Status:** STUB · system capability `PLANNED` · v1 substantive depth required ahead of M4 commencement-of-trading

> **Build-phase posture (per memory `project_rules_bind_at_commencement.md`).** Banking-specific outsourcing obligations bind at M4 commencement-of-trading. This v0 STUB scaffolds the procedure under the approved decision chain (`D-FX-CLS-MEMBERSHIP` resolved 2026-05-07; `D-M4-FX-SUB-DECISIONS` resolved 2026-05-09; `D-FX-CORRESPONDENT-PAIR-NAMING` proposed 2026-05-09); v1 lands ahead of commencement.

## 1. Source policy

Outsourcing & Third-Party Risk Policy (planned — Devon; in `Procedures/_index.md` "Operations & technology" section; Risk Management Framework parent). Pending policy authorship under the current build-phase governance cycle.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `[citation: TBC]` — SARB PA outsourcing directive (Banks Act regulations on outsourcing material business activities) | Pre-engagement due diligence on third parties performing material business activities; ongoing oversight; exit strategy. |
| `[citation: TBC]` — SARB Directive 3 of 2018 (Cloud Computing and Offshoring of Data) | Material correspondent for cross-border functions notifiable to PA; due-diligence package required. See companion procedure `directive-3-pa-notification.md`. |
| `[citation: TBC]` — Joint Standard 1 of 2024 (Cybersecurity & Cyber Resilience), third-party-risk extensions | Cyber + operational due diligence on material third parties; supply-chain security; IR cooperation. |
| `[citation: TBC]` — POPIA s.21 (operator agreements) | Data-processing terms with any third party that processes personal information on behalf of the bank. |
| `ORG-FIC-…` `[citation: TBC]` (FIC Act on third-party AML/CFT exposure) | Reputational + regulatory exposure to third party's own AML/CFT discipline. |

## 3. Purpose

Confirm — before the bank engages a material third party (correspondent bank, cloud provider, market-data vendor, regulated-industry supplier, processor under POPIA s.21) — that the third party meets the bank's threshold on:

- Regulatory standing (no active enforcement action that materially impairs the service).
- Financial viability (no near-term insolvency risk that would interrupt the service).
- Operational resilience (BCP, DR, IBS impact-tolerance compatibility).
- Cyber posture (Joint Standard 1 of 2024 third-party expectations).
- AML / CFT and sanctions discipline (the bank inherits reputational exposure).
- Data protection (POPIA operator-agreement terms; cross-border transfer assessment if applicable).
- Contractual exit conditions (the bank can change provider without strand of operations).

## 4. Trigger

A `OutsourcingEngagementProposed { thirdPartyRef, serviceCategory, materiality }` event is emitted by the engaging owner (e.g. Tomas (Operations & payments engineer) for FX correspondent; Atlas (Core banking platform architect) for cloud provider) when a candidate third party is identified.

Materiality classification follows the `Owner Inbox/...` Outsourcing Policy materiality matrix (planned). For the FX correspondent (Standard Bank primary, FirstRand backup, per `D-FX-CORRESPONDENT-PAIR-NAMING`), materiality is **HIGH** (cross-border function; CLS-settlement-path; Directive 3 of 2018 notifiable).

## 5. Steps (planned — v0 outline; v1 deepens substance ahead of M4 commencement)

| # | Action | Default actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive `OutsourcingEngagementProposed`; assign DD lead | `system` (paging) → Devon (or delegate) | `@platform/third-party-risk/intake` (`PLANNED`) | DD lead coordinates the multi-discipline review |
| 2 | Regulatory standing check | Mira (Compliance / RegTech engineer) + Imani (Legal-as-code engineer) | `@platform/compliance/regulatory-screening` (`PLANNED`) | PA enforcement register; FSCA findings; equivalent foreign-regulator findings if applicable |
| 3 | Financial viability check | Camille (Chief Financial Officer, governance) + Eitan (Treasurer, governance) | `@platform/treasury/counterparty-credit` (`PLANNED`) | Credit ratings; latest financial statements; concentration of bank's position with the third party |
| 4 | Operational resilience check (BCP / DR / IBS impact tolerances) | Devon (Chief Operating Officer, governance) | `@platform/operations/resilience-assessment` (`PLANNED`) | Cross-references the bank's IBS impact-tolerance ladder; tests scenario alignment |
| 5 | Cyber + InfoSec due diligence (Joint Standard 1 of 2024) | Senna (Security engineer) + Rashida (Chief Information Security Officer, governance) | `@platform/security/third-party-cyber-dd` (`PLANNED`) | Connectivity, credential isolation, key custody, IR cooperation, supply-chain posture |
| 6 | AML / CFT and sanctions exposure check | Mira (Compliance / RegTech engineer) — under Zara (Chief Compliance Officer, governance) | `@platform/compliance/sanctions-screening` (`PLANNED`) | Third party's own AML programme; sanctions lists; PEP screening |
| 7 | Data protection due diligence (POPIA s.21 operator) | Iris (Information Officer, governance) | `@platform/privacy/operator-agreement-template` (`PLANNED`) | Operator-agreement terms; cross-border transfer s.72 assessment if applicable |
| 8 | Contract negotiation (terms, indemnities, SLAs, exit conditions) | Imani (Legal-as-code engineer) | `@platform/legal/clause-library` (`POPULATED v0` — Imani v0 already on main) | ISDA-Master-class for FX correspondent; operational-SLAs; indemnities for settlement failures; exit triggers |
| 9 | Materiality-based approval routing | Devon (CoO, governance) → BRC (HIGH); → Devon-only (LOW) | `@platform/governance/approvals` (`PLANNED`) | HIGH materiality routes through Board Risk Committee (or Interim Audit Forum during build phase) |
| 10 | Lodgment of due-diligence packet (artefact set) | Devon | (artefact: `OutsourcingDueDiligenceCompleted` event) | Packet feeds the `directive-3-pa-notification.md` procedure for PA-notifiable engagements |
| 11 | Engagement go-live | All discipline leads | `@platform/operations/onboard-third-party` (`PLANNED`) | Live cut-over only after all checkpoint events captured |

## 6. Reconciliation

- Vera (Internal audit / continuous-assurance engineer) tests:
  - Every active material third-party engagement has a matching `OutsourcingDueDiligenceCompleted` event in the event store (no engagement without DD).
  - Every PA-notifiable engagement has a paired `Directive3NotificationFiled` event (companion procedure).
  - Annual review cadence is honoured (a follow-on `OutsourcingDueDiligenceReviewed` event lands within 12 months).
- Continuous-controls assurance pipeline: `@platform/recon/third-party-risk-coverage` (`PLANNED`).

## 7. Evidence / artefacts produced

- `OutsourcingEngagementProposed` event (intake).
- `OutsourcingDueDiligenceCompleted { thirdPartyRef, materialityTier, ddPacketRef, approvalRef }` event (closure).
- `OutsourcingDueDiligenceReviewed` event (annual cadence).
- DD packet artefact: regulatory-standing report, financial-viability report, resilience report, cyber-DD report, AML/sanctions report, POPIA s.21 assessment, contract drafts.

## 8. Build-phase v0 application — FX correspondents (Standard Bank primary, FirstRand backup)

Per `D-FX-CORRESPONDENT-PAIR-NAMING` (proposed 2026-05-09; `Owner Inbox/2026-05-09_devon-tomas_named-correspondent-pair-proposal.md`), the FX correspondent pair triggers this procedure twice (once per correspondent):

- **Standard Bank** (primary): HIGH materiality; full Steps 2–10 ahead of M4 commencement.
- **FirstRand** (backup): HIGH materiality; full Steps 2–10 ahead of M4 commencement (the *backup* relationship must be live-quality at all times for the switch-test cadence to meet `operational-resilience.md` planned).

DD packets for both will be lodged with Owen (Company Secretary, governance) for the governance calendar; both will trigger paired `directive-3-pa-notification.md` filings under SARB Directive 3 of 2018.

## 9. Open items (v1 deepens before M4 commencement)

- Materiality matrix (HIGH / MEDIUM / LOW) — Devon to author with Risk + InfoSec input.
- Per-step substantive checkpoints (what specifically Mira / Imani / Senna / Iris look for; minimum-acceptable thresholds; escalation triggers).
- Annual-review depth (full re-DD vs delta-only triggered by material change).
- Integration with the procedures-index continuous-controls pipeline (Vera Wave-4 catalogue).
- All `[citation: TBC]` URNs populated by Mira via the obligations register curation cadence.

—Devon (Chief Operating Officer, governance) — substantive owner; multi-discipline contributors named under `Owner`.
