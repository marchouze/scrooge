# Procedure — Directive 3 of 2018 (Cloud Computing & Offshoring of Data) PA notification

**Procedure ID:** PROC-OPS-D3-01
**Owner:** Devon (Chief Operating Officer, governance) — **substantive owner** · Owen (Company Secretary, governance) — governance-calendar sequencing · Imani (Legal-as-code engineer) — legal review · Senna (Security engineer) + Rashida (Chief Information Security Officer, governance) — cyber attestations
**Approval:** Board (or Interim Audit Forum during build phase) — Directive 3 notifications are governance-level filings to the Prudential Authority
**Cadence:** On-trigger (pre-engagement of every notifiable arrangement); update notification on material change to an existing arrangement
**Version:** v0.1 — 2026-05-09 — STUB
**Status:** STUB · system capability `PLANNED` · v1 substantive depth required ahead of M4 commencement-of-trading

> **Build-phase posture (per memory `project_rules_bind_at_commencement.md`).** The PA-notification obligation binds at M4 commencement-of-trading (or earlier if the arrangement is contracted ahead of commencement and the PA expects pre-commencement notification per Directive 3 timing). This v0 STUB scaffolds the procedure under the approved decision chain (`D-FX-CLS-MEMBERSHIP` resolved 2026-05-07; `D-M4-FX-SUB-DECISIONS` resolved 2026-05-09; `D-FX-CORRESPONDENT-PAIR-NAMING` proposed 2026-05-09); v1 lands ahead of commencement.

## 1. Source policy

Outsourcing & Third-Party Risk Policy (planned — Devon); Cloud Computing Policy (planned — Devon + Senna). Pending policy authorship under the current build-phase governance cycle. The companion DD procedure is `outsourcing-due-diligence.md` (this PR — STUB v0).

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `[citation: TBC]` — SARB Directive 3 of 2018 (Cloud Computing and Offshoring of Data) §§3–5 | Pre-engagement notification to the Prudential Authority for cloud computing or offshoring arrangements involving material data or material business activities. |
| `[citation: TBC]` — SARB Directive 3 of 2018 §6 | Notification format and minimum content (DD packet, residency, encryption posture, exit strategy, data subject implications). |
| `[citation: TBC]` — SARB Directive 3 of 2018 §7 | Update notification on material change. |
| `[citation: TBC]` — SARB PA outsourcing directive (Banks Act regulations) | Parent regime within which Directive 3 sits for PA-supervised banks. |
| `[citation: TBC]` — POPIA s.72 (cross-border transfer assessment) | Where the arrangement involves cross-border personal information, the s.72 transfer assessment is part of the notification packet (Iris co-signs). |

## 3. Purpose

Notify the Prudential Authority — pre-engagement, in the format and with the minimum content specified by Directive 3 of 2018 — of every cloud-computing or offshoring arrangement the bank enters into that is in scope under the directive. For PA-supervised banks, the typical in-scope arrangements include:

- Cloud-computing arrangements where material data or material business activities sit on the cloud provider.
- Cross-border correspondent or settlement arrangements where the counterparty processes the bank's payment / settlement instructions outside South Africa, or where data flows cross-border.
- Cross-border data hosting or processing.

For the FX-settlement context: the named correspondent pair (Standard Bank primary, FirstRand backup, per `D-FX-CORRESPONDENT-PAIR-NAMING`) is **notifiable** to the extent it constitutes a material arrangement for cross-border functions (FX settlement via SWIFT MT202 / ISO 20022 pacs.009 across CLS).

## 4. Trigger

A `Directive3NotificationRequired { engagementRef, arrangementType, materialityTier }` event is emitted when:

1. The DD procedure (`outsourcing-due-diligence.md`) closes with `materiality = HIGH` and `crossBorder = true`.
2. A material change is identified to an existing notified arrangement (additional services, change of jurisdiction, change of data residency, change of sub-processor chain).
3. Owen (Company Secretary, governance) sequences the notification into the governance calendar.

## 5. Steps (planned — v0 outline; v1 deepens substance ahead of M4 commencement)

| # | Action | Default actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive `Directive3NotificationRequired`; assemble notification packet | Devon (Chief Operating Officer, governance) — DD lead | `@platform/governance/d3-notification-packet` (`PLANNED`) | Packet draws from the closed DD packet (`outsourcing-due-diligence.md` artefacts) |
| 2 | Compose Directive 3 minimum-content sections | Devon + Imani (Legal-as-code engineer) | `@platform/governance/d3-template` (`PLANNED`) | Sections: arrangement description, materiality, regulatory standing of provider, data residency, encryption / key custody, BCP / DR, exit strategy, data subject implications |
| 3 | Cyber attestation (Joint Standard 1 of 2024 third-party extensions) | Senna (Security engineer) + Rashida (Chief Information Security Officer, governance) | `@platform/security/d3-cyber-attestation` (`PLANNED`) | Connectivity controls; key isolation; IR cooperation; supply chain |
| 4 | POPIA s.72 cross-border transfer assessment (where applicable) | Iris (Information Officer, governance) | `@platform/privacy/s72-transfer-assessment` (`PLANNED`) | Required where personal information crosses borders; co-signed by Iris |
| 5 | Compliance review (regulatory standing, FIC / sanctions exposure) | Mira (Compliance / RegTech engineer) — under Zara (Chief Compliance Officer, governance) | `@platform/compliance/d3-review` (`PLANNED`) | Final compliance sign-off on notification content |
| 6 | Board (or Interim Audit Forum) approval to file | Owen (Company Secretary, governance) | `@platform/governance/approvals` (`PLANNED`) | Board-reserved per Governance Framework; IAF substitute during build phase |
| 7 | Sign and lodge with Prudential Authority | Owen — secretariat; co-signed by Devon (CoO) and Camille (Chief Financial Officer, governance) | `@platform/governance/regulator-submission` (`PLANNED`) | Format per Directive 3 §6 [`citation: TBC`]; signing protocol per PA expectations |
| 8 | Track PA correspondence (acknowledgements, RFIs, conditions) | Owen + Imani | `@platform/governance/pa-correspondence` (`PLANNED`) | RFIs answered within PA-stipulated timeline |
| 9 | File closing event when PA acknowledgement received | Owen | (artefact: `Directive3NotificationFiled { engagementRef, lodgedAt, paAckAt }` event) | Reconciles to DD-closure event; engagement may go live post-acknowledgement |
| 10 | Material-change update notifications | Devon → Owen | `@platform/governance/d3-update-notification` (`PLANNED`) | On any material change to the arrangement (Directive 3 §7) |

## 6. Reconciliation

- Vera (Internal audit / continuous-assurance engineer) tests:
  - Every PA-notifiable arrangement (DD-closed with `materiality = HIGH` and `crossBorder = true`) has a paired `Directive3NotificationFiled` event before the engagement goes live.
  - The notification packet's section completeness matches the Directive 3 §6 minimum-content template (no missing sections).
  - Material-change updates are filed within the PA-stipulated window.
- Continuous-controls assurance pipeline: `@platform/recon/d3-notification-coverage` (`PLANNED`).

## 7. Evidence / artefacts produced

- `Directive3NotificationRequired` event (intake).
- `Directive3NotificationFiled { engagementRef, lodgedAt, paAckAt, packetRef }` event (closure).
- `Directive3NotificationUpdated` event (material-change cadence).
- Notification packet artefact: arrangement description, materiality assessment, regulatory standing, residency, encryption / key custody, BCP / DR, exit strategy, data subject implications, cyber attestation, s.72 transfer assessment (where applicable), compliance review.
- PA correspondence trail (acknowledgement, RFIs, conditions).

## 8. Build-phase v0 application — FX correspondents (Standard Bank primary, FirstRand backup)

Per `D-FX-CORRESPONDENT-PAIR-NAMING` (proposed 2026-05-09; `Owner Inbox/2026-05-09_devon-tomas_named-correspondent-pair-proposal.md`), the FX correspondent pair is in scope for Directive 3 notification because:

- The arrangement is **material** (cross-border FX settlement via SWIFT MT202 / pacs.009; CLS-settlement-path; HIGH-materiality DD outcome).
- The arrangement involves **cross-border functions** (CLS settlement is processed in CLS Bank International, New York; SWIFT routing crosses borders; counterparty banks' own data-flows are cross-border).

Two notifications are filed (one per correspondent):

- **Standard Bank** (primary): notification ahead of M4 commencement-of-trading.
- **FirstRand** (backup): notification ahead of M4 commencement-of-trading (the backup must be PA-acknowledged at the same level as the primary so that switch-test traffic is itself a notified-arrangement use).

The notifications are timed to follow the closure of `outsourcing-due-diligence.md` for each correspondent; Owen sequences both into the governance calendar.

## 9. Open items (v1 deepens before M4 commencement)

- The exact Directive 3 §6 minimum-content template (Devon + Imani populate from PA-published guidance; `[citation: TBC]` for the exact §6 URN).
- Notification format (electronic vs hardcopy; PA ePortal submission) — Owen confirms with PA secretariat.
- PA-stipulated acknowledgement window — Owen confirms.
- Material-change criteria (what counts as material change requiring update notification under §7) — Devon authors with Imani.
- Integration with the procedures-index continuous-controls pipeline (Vera Wave-4 catalogue).
- All `[citation: TBC]` URNs populated by Mira via the obligations register curation cadence.

—Devon (Chief Operating Officer, governance) — substantive owner; Owen, Imani, Senna, Rashida, Iris, Mira, Camille named under `Owner`.
