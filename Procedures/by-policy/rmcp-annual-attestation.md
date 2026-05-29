---
policy-parent: Risk Management and Compliance Programme (RMCP) — FIC Act s.42 / Guidance Note 7
last-reviewed: 2026-05-15
procedureId: PROC-COMP-RMCP-01
title: RMCP annual attestation cycle
author: Zara (Chief Compliance Officer, governance) · Mira (regulatory intelligence engineer)
date: 2026-05-15
owner: Zara (Chief Compliance Officer, governance) · Mira (regulatory intelligence engineer)
status: POPULATED
policy-cited: Risk Management and Compliance Programme (RMCP) — FIC Act s.42 / Guidance Note 7
system-capability: "@platform/compliance/rmcp-attestation (PLANNED)"
---

# Procedure — RMCP annual attestation cycle

**Procedure ID:** PROC-COMP-RMCP-01
**Owner:** Zara (Chief Compliance Officer, governance — MLRO + FIC CO) · Mira (regulatory intelligence engineer)
**Approval:** BRC + Board (RMCP is Board-reserved per FIC Act s.42)
**Cadence:** Annual (calendar year); triggered additionally on material RMCP change
**Version:** v0.1 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

- Risk Management and Compliance Programme (RMCP) — the bank's primary financial-crime compliance programme, required under the Financial Intelligence Centre Act 38 of 2001 (FIC Act) s.42.
- `Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §2 — AML / CFT Policy (which the RMCP operationalises).
- FIC Guidance Note 7 (2014, as updated) — RMCP content and structure requirements for accountable institutions.
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` B2 (FIC / financial-crime appetite) — zero tolerance for RMCP compliance gaps.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FC-01` (FIC Act s.42) | Accountable institution must have and maintain an RMCP; must be approved by senior management; must be reviewed and updated regularly; must be made available to FIC on request. |
| `ORG-FC-02` (FIC Act s.43) | Accountable institution must designate a compliance officer (FIC CO) and notify FIC; FIC CO must be a senior officer with authority to enforce the RMCP. |
| `ORG-FC-15` (FICA Regulations s.26D) | RMCP must include: customer due diligence; ongoing monitoring; recordkeeping; employee training; internal control review; reporting. |
| `ORG-PR-10` (Banks Act s.64 — compliance function) | Compliance risk must be managed; the compliance function's scope includes FICA obligations. |

## 3. Purpose

The RMCP annual attestation cycle ensures the bank's Risk Management and Compliance Programme remains fit-for-purpose, up-to-date with regulatory changes, and formally attested by the CCO (as FIC Compliance Officer) and senior management annually. The cycle:

1. Reviews the RMCP against the current regulatory landscape (Mira's regulatory-intelligence feed).
2. Assesses whether each RMCP element has been operationally effective during the year (transaction-monitoring rates, CDD completion rates, STR/CTR/TPR filing timeliness, training completion).
3. Identifies gaps requiring remediation and creates tracked action plans.
4. Produces a formal attestation letter signed by the CCO (as FIC CO) confirming the RMCP remains adequate and in force.
5. Tables the attestation and supporting evidence to the Board for formal approval.

## 4. Trigger

**Annual trigger:**
- 1 November: `RMCPAttestationCycleOpened { period: "YYYY", initiated_by: zara }` — Zara initiates the cycle.
- 31 January (following year): target completion — `RMCPAttestationSigned { period, signed_by: zara, board_approved_date }`.

**Ad-hoc trigger — regulatory change:**
- `RegulatoryChangeIngested { domain: "FIC" | "AML-CFT", materiality: High }` from Mira's intelligence feed — triggers an out-of-cycle RMCP review and potentially a supplementary attestation within 60 days of the change coming into force.

**Ad-hoc trigger — material RMCP deficiency:**
- Vera finding or FIC/FSCA supervisory letter identifying a material RMCP deficiency — triggers an expedited RMCP update and re-attestation within 30 days.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Emit `RMCPAttestationCycleOpened { period, initiated_by: zara }`; assemble the RMCP review pack (current RMCP text, prior-year attestation, Mira's regulatory-change digest for the year, operational metrics) | `agent` (Zara) | `@platform/event-store` ✓ + `@platform/compliance/rmcp-attestation` (`PLANNED`) | Operational metrics sourced from: TM alert rates (`transaction-monitoring.md`), CDD completion (`kyc-onboarding.md`, `kyc-recurring.md`), STR/CTR/TPR timeliness (`str-filing.md`, `ctr-filing.md`, `tpr-filing.md`), training records (Sade). |
| 2 | Mira runs regulatory-change impact assessment: identify all FIC Act / FICA Regulations / FIC Guidance Note changes since the last RMCP review; assess materiality of each change; flag required RMCP text updates | `agent` (Mira) | `@platform/compliance/reg-intel-feed` (`PLANNED`; today: Mira's manual monitoring) | Changes tagged with `ORG-FC-*` obligations-register IDs. Materiality threshold: any change that alters a required RMCP element is material. |
| 3 | Emit `RegulatoryChangeImpactAssessed { period, changes_identified, rmcp_updates_required }` | `system` | `@platform/event-store` ✓ | Mira's regulatory-change digest is the input; the event records the disposition. |
| 4 | For each required RMCP text update: draft the amendment; Zara reviews and approves each amendment; emit `RMCPAmended { amendment_id, section, change_description, effective_date, regulatory_driver }` | `agent` (Mira — draft) + `human` (Zara — approval) | `@platform/compliance/rmcp-attestation` (`PLANNED`) | Amendments are tracked individually; each carries the `ORG-FC-*` citation driving the change. |
| 5 | Review operational effectiveness metrics against RMCP commitments: TM alert coverage, CDD refresh rates, STR/CTR/TPR timeliness, training completion, sanctions screening uptime | `agent` (Zara, with Mira analytics) | `@platform/reporting/compliance-dashboard` (`PLANNED`) | Any metric below commitment threshold triggers a finding (Step 6). |
| 6 | For each effectiveness gap: create a remediation action plan with named owner, due date, and KPI target; emit `RMCPRemediationPlanCreated { gap_id, metric, current_value, target_value, owner, due_date }` | `agent` (Zara) + named owner | `@platform/compliance/rmcp-attestation` (`PLANNED`) | Action plans are binding commitments tracked to close. Overdue plans are escalated to BRC. |
| 7 | Compile RMCP attestation pack: updated RMCP text, effectiveness summary, remediation action plans, regulatory-change digest, training-completion certificate | `agent` (Zara) | `@platform/compliance/rmcp-attestation` (`PLANNED`) | The attestation pack is the primary evidence artefact for FIC inspection purposes. |
| 8 | Zara signs the attestation letter as FIC Compliance Officer: confirms the RMCP is adequate, up-to-date, and in force; emits `RMCPAttestationSigned { period, signed_by: zara, attestation_pack_hash, effectiveness_rating }` | `human` (Zara, as FIC CO) | `@platform/event-store` ✓ + `@platform/compliance/rmcp-attestation` (`PLANNED`) | The signed attestation is the load-bearing governance act. Zara's signature is required by FIC Act s.42; it cannot be delegated below CCO/FIC CO level. |
| 9 | Table the attestation pack to the Board for formal annual approval; Board resolution recorded; emit `RMCPBoardApproved { period, board_resolution_date, board_resolution_ref }` | `human` (Board — via Owen (Company Secretary, governance)) | Governance record (Board minutes) | FIC Act s.42 requires senior management / Board approval. Until Board is constituted: Interim Risk Forum + CEO approval. |
| 10 | File the signed attestation and Board resolution in the document store; notify FIC if required under applicable guidance | `agent` (Zara / Mira) | `@platform/document-store` ✓ + `@platform/compliance/fic-portal` (`PLANNED`) | FIC Guidance Note 7 does not currently require annual RMCP filing; however, FIC may request the RMCP on inspection. The document store retains the attested version indefinitely. |

## 6. Reconciliation

- **Events produced:**
  - `RMCPAttestationCycleOpened { period, initiated_by }`
  - `RegulatoryChangeImpactAssessed { period, changes_identified, rmcp_updates_required }`
  - `RMCPAmended { amendment_id, section, change_description, effective_date, regulatory_driver }` — one per amendment
  - `RMCPRemediationPlanCreated { gap_id, metric, owner, due_date }` — one per effectiveness gap
  - `RMCPAttestationSigned { period, signed_by, attestation_pack_hash, effectiveness_rating }`
  - `RMCPBoardApproved { period, board_resolution_date }`
- **Reconciliation check:** every calendar year must have an `RMCPBoardApproved` event with `period = "YYYY"`. Vera checks annually. Missing event is a critical finding — FIC Act s.42 non-compliance.
- **Amendment traceability:** every `RMCPAmended` event must carry a `regulatory_driver` linking to an `ORG-FC-*` obligations-register ID or an internal-control finding. Orphaned amendments are Principle 2 violations.
- **Failure mode:** if the attestation cycle is not completed by 31 January (60-day overrun), Vera emits `RMCPAttestationOverdue { period, days_overdue }` → BRC escalation → CEO notification.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| All `RMCP*` events | Event log | Permanent (P1) | Restricted |
| Signed attestation letter (Zara) | Document store (BLAKE3-addressed) | Permanent (FIC inspection artefact) | Confidential |
| RMCP text (version-stamped per cycle) | Document store | Permanent | Confidential |
| Regulatory-change impact assessment (Mira) | Document store | 5 years post-cycle | Restricted |
| Operational effectiveness metrics report | Document store | 5 years post-cycle | Restricted |
| Remediation action plan register (derived) | RMCP attestation projection | Live; events permanent | Restricted |
| Board resolution (RMCP approval) | Governance record + document store | Permanent | Confidential |

## 8. Manual steps

- **Step 2 — Regulatory-change monitoring (Mira):** Until the automated reg-intel feed is built, Mira monitors FIC Act amendments, FICA Regulation changes, and FIC Guidance Note updates manually and produces the impact assessment. This is a named substrate gap.
- **Step 4 — RMCP amendment approval (Zara):** Each amendment requires Zara's personal review and approval as FIC CO. Delegation is not permitted for this step.
- **Step 8 — Zara attestation signature:** FIC Act s.42 requires the FIC CO (Zara) to sign the attestation. This step is irreducibly human until licence-day, when the named human FIC CO signs in their personal capacity.
- **Step 9 — Board approval:** Until the Board is constituted, the Interim Risk Forum + CEO discharge this approval. At Board constitution, this step transfers to the full Board.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Attestation cycle not opened by 1 November | Vera calendar check | Zara + CEO; Vera finding |
| RMCP not updated for a material regulatory change within 60 days | `RegulatoryChangeIngested` → Vera staleness check | Zara + CEO; potential FIC non-compliance; BRC notification |
| Effectiveness metric below commitment with no remediation plan | Vera metrics-vs-commitments check | Zara creates action plan; escalates to BRC if systemic |
| Remediation action plan overdue > 30 days | `RMCPRemediationPlanCreated` age check | BRC-reported KRI; Zara escalates to action plan owner's governance lead |
| Attestation not signed by 31 January | `RMCPAttestationOverdue` event | BRC + CEO; expedited cycle; FIC notification if required |
| Board approval not obtained | Vera check on `RMCPBoardApproved` | CEO + Owen (Company Secretary, governance); emergency Board resolution |
| FIC requests RMCP and document unavailable | Vera document-store health check | Critical — Zara + CEO; file emergency copy; remediate document-management gap |

## 10. Related procedures

- [`transaction-monitoring.md`](transaction-monitoring.md) (PROC-FC-TM-01) — TM alert rates are a primary RMCP effectiveness metric.
- [`kyc-onboarding.md`](kyc-onboarding.md) — CDD completion rates feed the RMCP effectiveness review.
- [`kyc-recurring.md`](kyc-recurring.md) (PROC-FC-KYC-R-01) — periodic CDD refresh rates feed the RMCP effectiveness review.
- [`str-filing.md`](str-filing.md) (PROC-FC-STR-01) — STR timeliness is a primary RMCP effectiveness metric.
- [`ctr-filing.md`](ctr-filing.md) (PROC-FC-CTR-01) — CTR timeliness is a primary RMCP effectiveness metric.
- [`tpr-filing.md`](tpr-filing.md) (PROC-FC-TPR-01) — TPR timeliness is a primary RMCP effectiveness metric.
- [`fic-submission-cycle.md`](fic-submission-cycle.md) — annual FIC reporting cycle; RMCP attestation is a named input.
- [`sanctions-screening.md`](sanctions-screening.md) (PROC-FC-02) — sanctions screening effectiveness is reviewed within the RMCP cycle.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-15 | Zara + Mira | Initial draft — PLANNED → POPULATED; full 12-section procedure per template; FIC Act s.42 / Guidance Note 7 anchoring. |

## 12. Audit / assurance

- **Vera annual:** verify that `RMCPBoardApproved` event exists for the prior calendar year; verify attestation pack is in the document store; verify all remediation action plans from the prior cycle are closed or carried forward with updated due dates. Deviations reported to AC.
- **Vera continuous:** monitor `RMCPRemediationPlanCreated` events for overdue closure; surface to BRC as a tracked KRI.
- **Thandiwe (CAE, governance):** third-line opinion on RMCP effectiveness is a standing internal-audit deliverable; sourced from Vera's evidence plus Thandiwe's independent sampling of CDD, TM, and filing records.
- **FIC inspection readiness:** at any FIC on-site inspection, the RMCP attestation pack and supporting evidence must be produced within 24 hours. Zara owns this obligation; the document store provides the retrieval path.
