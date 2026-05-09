# Procedure — FAIS Key Individual fit-and-proper file

**Procedure ID:** PROC-FAIS-KI-FAP-01
**Owner:** Sade (AgentOps engineer — engineering-substrate seat) · Zara (Chief Compliance Officer, governance — FAIS conduct line) · Saskia (Head of Global Markets, governance — named Key Individual at licence-day)
**Approval:** BRC (under FAIS Policy v0.1 — STUB, FSP-conditional) and the Fit-and-Proper Policy (planned)
**Cadence:** On-trigger when a candidate is named to the FAIS Key Individual seat (or to any officer seat the same five-dimension test applies to); ongoing-monitoring runs continuously thereafter; renewal cadence per FSCA Determination of Fit and Proper Requirements 2017 [citation: TBC — exact renewal interval to be ratified by Imani (Legal-as-code engineer) + external counsel at licence-application gate]
**Version:** v0.1 — 2026-05-09
**Status:** **STUB** — procedure scaffolded today under D-FSP-LICENCE-NECESSITY (`confirm-A-no-research`); system capability `PLANNED`; substrate gaps named in §10. Activates live at licence-application gate; runs as Scrooge-coordinated table-top exercises against the Saskia-as-KI assignment in build-phase.

## 1. Source policy

- FAIS Policy v0.1 (STUB, FSP-conditional) — `Owner Inbox/2026-05-07_niko_conduct-policies-bundle-v0.md` § FAIS Policy v0.1 §5 (Rep / KI authorisation discipline).
- Fit-and-Proper Policy (planned; queued under `Procedures/_index.md` row "Fit-and-Proper Policy → fit-and-proper-attestation.md").
- Conduct-side reading and ratification: `Owner Inbox/2026-05-09_mira-zara_concentration-risk-conduct-confirmation.md` (Q4 confirmation) — Zara (Chief Compliance Officer, governance) + Mira (Compliance / RegTech engineer) ratify the conduct-side framing of the KI seat.
- Decision record: `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-fsp-licence-necessity-confirm-a.md` (PR #62) — D-FSP-LICENCE-NECESSITY resolved `confirm-A-no-research`, which makes this procedure load-bearing for the Saskia transition.
- Saskia handover (procedure-pair partner, authored in parallel): `Owner Inbox/2026-05-09_saskia_fais-ki-handover-note.md` (PR #45) — names Saskia (Head of Global Markets, governance) as the FAIS-KI-elect and lays out Gate (a) (counsel — closed by D-FSP-LICENCE-NECESSITY) and Gate (b) (this procedure).

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| `ORG-CD-03` (FAIS Act) | Designate Key Individual(s) and Representatives where FSP-licensed. | This procedure is the Key Individual designation file. Step 8 (file publish) is the moment of designation. |
| `ORG-GV-11` (Banks Act + BCBS) | Designate fit-and-proper officers across the executive layer. | The five-dimension framework here is the substrate every officer seat re-uses; FAIS-KI is the first instance. |
| `ORG-HR-11` (Banks Act + PA fit-and-proper standards) | Designated officers meet fit-and-proper standards continuously. | Step 9 (ongoing-monitoring covenant) and the renewal cadence enforce continuity. |
| `ORG-CS1-002` (CS 1/2018 §4) | Fit-and-proper: senior management, controlling body, key individuals. | Procedure carries the same five-dimension test SARB CS 1/2018 references; reconciles against the BCBS principles. |
| FSCA Determination of Fit and Proper Requirements 2017 [citation: TBC — section refs for each of the five dimensions; Imani (Legal-as-code engineer) + external counsel ratify at licence-application gate] | Five dimensions of fit-and-proper for FSPs: honesty + integrity, competence, operational ability, financial soundness, oversight. | Five-dimension framework in §5; each dimension produces a typed evidence event. |
| FAIS Act s.8 (FSP licence requirements; KI is a licensing prerequisite) | KI must be designated and fit-and-proper at the moment of FSP-licence application. | This procedure must be **complete** before the FSP application is lodged. |

## 3. Purpose

Assemble, verify, file, and continuously monitor the structured fit-and-proper file for the bank's FAIS Key Individual under the FSCA Determination of Fit and Proper Requirements 2017. The procedure produces a typed, citable evidence trail across the five Determination dimensions — honesty + integrity, competence, operational ability, financial soundness, oversight — and emits a composite `FaisKiFitAndProperFileApproved` event that is the substrate's record-of-truth for the KI's fitness at the moment of FSP-licence application.

The procedure is the **engineering substrate** for the human-officer fit-and-proper assessment process more broadly. The five-dimension framework re-uses across every officer seat (CEO, CRO, CFO, COO, Treasurer, Head of Markets, CCO, CISO, CAE, GC, CHRO, CoSec, IO) — the FAIS-KI seat is the first instance the bank exercises against. The Saskia-as-FAIS-KI transition under D-FSP-LICENCE-NECESSITY is the inaugural run.

Per CLAUDE.md operating-model, Sade is reshaped to **AgentOps** during the build phase; the human-HR slice activates at licence-day. This procedure sits at the seam: the **substrate** is built now (this procedure file, the typed events, the planned TypeScript module), but live execution against a real human candidate fires only when the named officer is appointed — Saskia-as-FAIS-KI at FSP-licence-application; the broader six-human composition at licence-day.

## 4. Trigger

- **Primary:** A candidate is named to the FAIS Key Individual seat (or to any future officer seat for which the same five-dimension Determination test applies). Trigger event: `OfficerSeatAssignmentProposed` with `seatType: 'FAIS_KEY_INDIVIDUAL'`. [Substrate gap: event type planned, not yet in `prototype/platform/event-store/event-types.ts` — Atlas (Core banking platform architect) v1 follow-on.]
- **Build-phase entry point:** Triggered today by the Saskia-as-FAIS-KI assignment under D-FSP-LICENCE-NECESSITY (`Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-fsp-licence-necessity-confirm-a.md`). Saskia's parallel handover-note (PR #45) carries the candidate-side data; this procedure carries the assessor-side process.
- **Ongoing-monitoring trigger:** Continuous — any input event (court judgment, regulatory action, civil judgment, change in financial soundness, change in oversight reporting line) re-opens the affected dimension(s). [Substrate gap: input-event types planned — Atlas v1 follow-on.]
- **Renewal trigger:** Per the FSCA Determination of Fit and Proper Requirements 2017 renewal interval [citation: TBC — Imani + counsel ratify at licence-application gate].

## 5. Steps — five-dimension framework

The five Determination of Fit and Proper Requirements 2017 dimensions, each with structured evidence slots and a typed evidence event. Section refs to the FSCA Determination are `[citation: TBC]` pending Imani (Legal-as-code engineer) + external counsel ratification.

### 5.1 Honesty + integrity

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1.1 | Run criminal-record check (SAPS clearance certificate) | `service` (background-check provider, sourced via Sade AgentOps) | `PLANNED` — `prototype/platform/officers/fais-ki-fit-and-proper.ts` | Output bound into evidence object |
| 1.2 | Capture civil-judgments declarations (sworn affidavit + court-records search) | `human` (candidate) + `service` (court-records provider) | `PLANNED` | Sworn declaration is itself an evidence artefact |
| 1.3 | Run regulator-prior-action search (FSCA / SARB PA / FIC enforcement registers) | `service` | `PLANNED` | Hit triggers escalation to Zara before the dimension can be marked complete |
| 1.4 | Run bankruptcy / insolvency search (CIPC + court records) | `service` | `PLANNED` | Hit cross-binds to dimension 4 (financial soundness) |
| 1.5 | Compile and emit `BackgroundCheckCompleted` event | `system` | `PLANNED` | Event schema planned — Atlas v1 substrate follow-on |

**Citation:** FSCA Determination of Fit and Proper Requirements 2017 § [citation: TBC] — Honesty and integrity.

### 5.2 Competence

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 2.1 | Capture qualifications (academic + professional) | `human` (candidate) + `service` (qualification-verification) | `PLANNED` | Verified copies stored as artefacts |
| 2.2 | Capture experience (work history, role responsibilities, regulated-activity track record) | `human` (candidate) + `service` (employment-verification) | `PLANNED` | Must demonstrate sufficient experience for the specific FSP-licence categories sought |
| 2.3 | Capture FAIS regulatory-examination certificates (FAIS RE5 + RE1 where applicable) | `service` (FSCA RE-results query) | `PLANNED` | Pass status mandatory for KI |
| 2.4 | Capture continuous-professional-development log (rolling 12-month CPD points per FSCA categorisation) | `service` (CPD-provider feed) | `PLANNED` | Ongoing-monitoring input — feeds renewal cycle |
| 2.5 | Compile and emit `CompetenceAttestationFiled` event | `system` | `PLANNED` | Event schema planned — Atlas v1 substrate follow-on |

**Citation:** FSCA Determination of Fit and Proper Requirements 2017 § [citation: TBC] — Competence (qualifications, experience, regulatory exams, CPD).

### 5.3 Operational ability

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 3.1 | Map seat-specific responsibilities — for FAIS KI: oversight of representatives, compliance with General Code of Conduct, maintenance of FAIS records | `human` (Zara — CCO governance) + `system` | `PLANNED` | The map is itself an evidence artefact; binds to the `fais-advice-record-capture.md` procedure substrate |
| 3.2 | Demonstrate ability to discharge each mapped responsibility — capacity assessment, time-allocation, conflict-load (e.g., Saskia's parallel Head-of-Markets governance load) | `human` (Zara + Owen — CoSec) | `PLANNED` | Capacity / time-allocation gate: KI cannot be over-loaded such that oversight becomes nominal |
| 3.3 | Confirm operational independence — KI must be able to halt the FSP's regulated activities if compliance fails | `human` (Owen — governance escalation) | `PLANNED` | Reconciles upward to the Governance Framework's "Reserved for Board" matters |
| 3.4 | Compile and emit `OperationalAbilityAssessed` event | `system` | `PLANNED` | Event schema planned — Atlas v1 substrate follow-on |

**Citation:** FSCA Determination of Fit and Proper Requirements 2017 § [citation: TBC] — Operational ability (fit-for-purpose discharge of seat-specific responsibilities).

### 5.4 Financial soundness

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 4.1 | Capture personal solvency declaration (assets / liabilities / contingent obligations) | `human` (candidate) | `PLANNED` | Sworn statement |
| 4.2 | Confirm no insolvency event in past 10 years (CIPC + court records) | `service` | `PLANNED` | Cross-binds to 1.4 — same data feed |
| 4.3 | Confirm no court-ordered debt arrangement (debt review / administration / sequestration) | `service` (NCR + court records) | `PLANNED` | Hit triggers escalation to Zara |
| 4.4 | Compile and emit `FinancialSoundnessAttested` event | `system` | `PLANNED` | Event schema planned — Atlas v1 substrate follow-on |

**Citation:** FSCA Determination of Fit and Proper Requirements 2017 § [citation: TBC] — Financial soundness (personal solvency, insolvency history, debt arrangements).

### 5.5 Oversight

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 5.1 | Confirm KI's reporting line is to a level that can hold the KI accountable — for Saskia-as-KI: governance line into the Board (or Interim Audit Forum until Board sits) via Owen (CoSec governance) | `human` (Owen) | `PLANNED` | Reporting line resolves upward to the executive structure in the Governance Framework |
| 5.2 | Capture conflict-of-interest disclosure — KI's external roles, related-party exposures, dual-mandate conflicts (Saskia: KI vs Head-of-Markets revenue accountability is a structural conflict; mitigation must be filed) | `human` (candidate) + `human` (Zara) | `PLANNED` | Cross-binds to `Procedures/by-policy/conflicts-declaration.md` |
| 5.3 | Record ongoing-monitoring covenant — candidate covenants to disclose any change in any of the five dimensions within [citation: TBC — covenant-disclosure interval per Determination] | `human` (candidate) | `PLANNED` | Covenant is a signed artefact; subsequent disclosures fire the ongoing-monitoring trigger from §4 |
| 5.4 | Compile and emit `OversightStructureRecorded` event | `system` | `PLANNED` | Event schema planned — Atlas v1 substrate follow-on |

**Citation:** FSCA Determination of Fit and Proper Requirements 2017 § [citation: TBC] — Oversight (reporting line, conflict-of-interest, ongoing-monitoring covenant).

### 5.6 Composite — file approval

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 6.1 | Verify all five dimension events exist for the candidate, and that none has been retracted by an ongoing-monitoring re-open | `system` | `PLANNED` | Reconciliation query — every dimension event must be in `committed` state |
| 6.2 | Zara (Chief Compliance Officer, governance) reviews and approves the composite file | `human` (Zara) | `PLANNED` | Conduct-line approval; Zara's discretion is captured as a typed event |
| 6.3 | Owen (Company Secretary, governance) ratifies for governance line — confirms reporting line and conflict mitigation are sound | `human` (Owen) | `PLANNED` | Governance-line ratification |
| 6.4 | Emit `FaisKiFitAndProperFileApproved` composite event | `system` | `PLANNED` | Composite event — Atlas v1 substrate follow-on |
| 6.5 | File is published into the FAIS-KI register; lodged into the FSP-licence application bundle when application fires | `system` | `PLANNED` | The file is the authoritative substrate record for the KI's fitness as-of the application moment |

## 6. Reconciliation

- **Events produced (planned, all `PLANNED` until Atlas v1 substrate lands):**
  - `BackgroundCheckCompleted` (dimension 1)
  - `CompetenceAttestationFiled` (dimension 2)
  - `OperationalAbilityAssessed` (dimension 3)
  - `FinancialSoundnessAttested` (dimension 4)
  - `OversightStructureRecorded` (dimension 5)
  - `FaisKiFitAndProperFileApproved` (composite, fires when 6.4 completes)

- **Reconciliation check:** Every `OfficerSeatAssignmentProposed` with `seatType: 'FAIS_KEY_INDIVIDUAL'` must, before the candidate is named in the FSP-licence application, have a corresponding `FaisKiFitAndProperFileApproved` event in committed state. Drift in any of the five dimension events (a subsequent `…Reopened` event fired by ongoing-monitoring) invalidates the composite event and re-fires the procedure for that dimension. Verified by the planned recon harness (substrate gap below; routed to Vera (Internal-audit / continuous-assurance engineer) Wave-4 finding-pipeline).

- **Failure mode:** If the composite event is invalidated and not re-approved before an FSP-regulated activity is conducted, the bank is conducting unauthorised regulated activity under FAIS s.8. Failure fires immediate escalation to Zara (Chief Compliance Officer, governance) and triggers a halt-procedure on the FAIS-licensed activity (cross-binds to `fais-advice-record-capture.md` step that gates on rep / KI authorisation).

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Five dimension events + composite event | Event store (`prototype/platform/event-store/`; PLANNED) | Permanent (event log is immutable per Principle 1) | PII (candidate personal data) — POPIA s.19–22 safeguards apply |
| Sworn declarations (civil judgments, personal solvency, conflict-of-interest, ongoing-monitoring covenant) | Document store, referenced by event | Per Determination renewal interval [citation: TBC] | PII; legal privilege where counsel-prepared |
| Background-check / qualification-verification reports | Document store, referenced by event | Per Determination renewal interval [citation: TBC] | PII — restricted access |
| FAIS RE5 / RE1 certificates | Document store | Permanent | PII — restricted access |
| FAIS-KI register entry | `prototype/platform/officers/` (PLANNED) | Permanent | Internal — restricted to governance + AgentOps |

## 8. Manual steps

- **Sworn declarations** (1.2, 4.1, 5.3) are signed by the candidate; ECTA Schedule 1 does not exclude these from electronic signature, so they're handled through the bank's e-signing pipeline (Imani's substrate). Treated as digitised events at point of signing.
- **External-counsel ratification of the [citation: TBC] section refs** is a manual step (counsel reads the FSCA Determination and confirms the section anchors), justified under Principle 2 (legal interpretation requires human judgment); routed to Imani at licence-application gate.
- **Zara's review (6.2)** and **Owen's ratification (6.3)** are human-judgment steps captured as typed events. Per Principle 7, the human-actor exception is registered: governance-line approval of fit-and-proper assessments is a regulatory-judgement step that cannot be agent-default until the regulator accepts agent-issued fit-and-proper attestations (not foreseeable in the build-phase horizon).

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Background-check hit (criminal record, regulator action, insolvency) | Service-feed event | Zara (CCO) within 24h; candidate not advanced; D-card if hit affects an already-appointed officer |
| Competence shortfall (RE5/RE1 not held; insufficient experience) | §5.2 step 5 fails | Zara + Owen; candidate either pursues RE within candidate-status window or is withdrawn |
| Operational-ability concern — capacity/time-allocation conflict (e.g., dual-mandate KI seat conflict) | §5.3 capacity gate | Owen + Zara; mitigation filed or candidate withdrawn |
| Financial-soundness drift after appointment (debt review, sequestration) | Ongoing-monitoring service feed | Zara + Owen within 24h; immediate halt of FSP-regulated activity until re-approved or KI replaced |
| Oversight-line drift (reporting-line change not refiled) | Recon harness query against governance framework | Owen within 5 business days |
| Renewal lapse — file not re-approved within Determination renewal interval [citation: TBC] | Recon harness scheduled query | Zara; halt of FSP-regulated activity per failure-mode in §6 |

## 10. Substrate gaps (named, not built in this PR)

Per CLAUDE.md "Steady-state vs current substrate" and Principle 7 substrate-gap-naming discipline. This procedure deliberately scaffolds without the underlying engineering substrate — the substrate is queued behind named owners.

1. **Five typed dimension events + the composite event** need adding to `prototype/platform/event-store/event-types.ts`: `BackgroundCheckCompleted`, `CompetenceAttestationFiled`, `OperationalAbilityAssessed`, `FinancialSoundnessAttested`, `OversightStructureRecorded`, `FaisKiFitAndProperFileApproved`. **Owner: Atlas (Core banking platform architect)** — v1 substrate follow-on.
2. **Substrate-side TypeScript module** at `prototype/platform/officers/fais-ki-fit-and-proper.ts` — five-dimension orchestrator that subscribes to input feeds, emits the dimension events, and computes the composite-approval reconciliation. **Owner: Atlas + Sade joint follow-on.**
3. **Vera Wave-4 finding-pipeline for fit-and-proper drift** — recon-harness query that detects (a) `OfficerSeatAssignmentProposed` events without a downstream `FaisKiFitAndProperFileApproved` before FSP-licence-application, (b) any dimension event re-opened without a re-approval cycle completing, (c) renewal-interval lapses. **Owner: Vera (Internal-audit / continuous-assurance engineer).**
4. **Exact FSCA Determination of Fit and Proper Requirements 2017 section refs** (each `[citation: TBC]` in §2 and §5) need ratifying — counsel reads the Determination and confirms section anchors per dimension; covenant-disclosure interval and renewal interval to be set. **Owner: Imani (Legal-as-code engineer) + external counsel** at licence-application gate.
5. **Input-event taxonomy** for ongoing-monitoring (court judgment, regulatory action, NCR debt arrangement, CPD-points feed, qualification-revocation) needs spec'ing as part of the agent-runtime trigger bus. **Owner: Atlas + Sade.**

## 11. Related procedures

- `fais-advice-record-capture.md` (PROC-CRM-FA-01) — gates on rep / KI authorisation; this procedure produces the KI authorisation that procedure relies on.
- `Procedures/_index.md` row "Fit-and-Proper Policy → fit-and-proper-attestation.md" (PLANNED) — broader fit-and-proper framework re-using the five-dimension substrate built here. **Sade follow-on** when the broader officer composition fires at licence-day.
- `Procedures/by-policy/conflicts-declaration.md` — KI conflict-of-interest disclosure (§5.2 step 2) consumes that procedure's substrate.
- `Procedures/by-policy/odp-authorisation-application.md` (PROC-MK-ODP-01) — ODP-track authorisation; the same five-dimension framework applies to ODP-named individuals.
- Procedure-pair partner (in parallel branch, do not co-author): `Owner Inbox/2026-05-09_saskia_fais-ki-handover-note.md` (PR #45) — Saskia's candidate-side handover; this procedure is the assessor-side process. Cross-linked at PR-merge time.

## 12. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-09 | Sade (AgentOps engineer — engineering-substrate seat) | Initial scaffold — STUB. Procedure created under D-FSP-LICENCE-NECESSITY (`confirm-A-no-research`) to make Gate (b) of the Saskia-as-FAIS-KI handover operationally executable. Five-dimension framework named; six typed events identified as substrate gaps for Atlas v1; FSCA Determination section refs marked `[citation: TBC]` for Imani + counsel ratification at licence-application gate. |

## 13. Audit / assurance

This procedure is consumed by Vera (Internal-audit / continuous-assurance engineer) under the Wave-4 #10 agent-spec-integrity recon pipeline (planned) and by the planned fit-and-proper-drift recon-harness (substrate gap §10.3). Findings classes:

- Orphaned KI assignment (proposal without approved file before FSP-application).
- Dimension-event drift (re-opened dimension not re-closed within escalation window).
- Renewal-interval lapse.
- Section-ref [citation: TBC] persisting past licence-application gate (Principle 2 violation).

Each finding class is a reportable item under the Internal Audit Charter (post-CAE substrate; Vera carries it functionally today through Thandiwe (Chief Audit Executive, governance) until the Audit Committee is constituted).
