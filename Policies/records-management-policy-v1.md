---
policy-id: records-management-policy
title: Records Management Policy v1
version: "1"
status: IN FORCE
owner: Owen (Company Secretary, governance)
effective-from: "2026-05-13"
next-review: "2027-05-13"
citations:
  - Companies Act 71 of 2008
  - Protection of Personal Information Act 4 of 2013
  - Financial Advisory and Intermediary Services Act 37 of 2002
  - Electronic Communications and Transactions Act 25 of 2002
  - Financial Intelligence Centre Act 38 of 2001
  - D-RMS-PHASE-1
author: Owen (Company Secretary, governance) + Devon (Chief Operating Officer, governance)
date: 2026-05-13
summary: Standalone Records Management Policy covering four-class record taxonomy, retention floors (7-year governance/financial, 5-year client/conduct, 1-year operational), ECTA-compliant electronic records, POPIA purpose-limitation reconciliation, legal-hold framework, and disposal governance. Closes obligations ORG-RM-01 through ORG-RM-06. CORPORATE-BIND.
decision-required: false
riskTaxonomy:
  - RT-OR
  - RT-LC
---

# Records Management Policy v1

> **Authors.** Owen (Company Secretary, governance) — lead; Devon (Chief Operating Officer, governance) — co-author.
> **Standing authority.** `D-RMS-PHASE-1` (CEO-approved 2026-05-09); Records Management Substrate Phase 1 spec at `Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`. Implements the records-management policy layer of the RMS programme under the no-pause rule — CLAUDE.md "Operating procedures".
> **Obligations closed.** `ORG-RM-01` (retain runtime/substrate-management class events for a minimum 1-year horizon), `ORG-RM-02` (retain accounting records, statutory registers, and annual financial statements for a minimum of 7 years in accessible, human-readable form — Companies Act s.24–26), `ORG-RM-03` (maintain accounting records that fairly represent the company's state of affairs; accessible on demand by authorised officers, auditors, and regulators — Companies Act s.28), `ORG-RM-04` (not retain personal information beyond the period required to fulfil its purpose; maintain a retention schedule; destroy/de-identify at expiry — POPIA s.14), `ORG-RM-05` (retain FAIS advice records, transaction records, and client information for a minimum of 5 years — FAIS General Code s.18), `ORG-RM-06` (electronic records must satisfy ECTA integrity and attribution requirements — ECTA ss.11–16).
> **Status.** CORPORATE-BIND. The Companies Act and POPIA bind from incorporation; the event store is operational and constitutes the primary record system. Banking-specific obligations (FIC Act, Banks Act, FAIS conduct records) bind at commencement of trading where they are not already in effect through corporate law; the retention floors are authored for the full operational state.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Records Management Policy — Overarching

**Owner:** Owen (Company Secretary, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual; triggered on regulatory change or material change to record systems · **Citation:** Companies Act 71 of 2008 (ss.24–26, s.28 — accounting records; s.73 — board minutes; s.92 — annual financial statements); Protection of Personal Information Act 4 of 2013 (`POPIA`) — s.14 (retention limitation); Financial Advisory and Intermediary Services Act 37 of 2002 (`FAIS`) — General Code of Conduct for FSPs s.18 (record-keeping); Electronic Communications and Transactions Act 25 of 2002 (`ECTA`) — ss.11–16 (legal recognition and requirements of data messages, electronic records, and electronic signatures); Financial Intelligence Centre Act 38 of 2001 (`FICA`) — s.22 and s.23 (record-keeping obligations of accountable institutions); `D-RMS-PHASE-1` (Records Management Substrate, CEO-approved 2026-05-09)

### Purpose

This policy governs how Hoz Bank Limited (the "Bank") creates, classifies, retains, protects, and disposes of records across all regulatory, operational, and governance dimensions. Its purpose is to ensure the Bank complies with its statutory record-keeping obligations under the Companies Act, POPIA, FAIS, ECTA, and FICA; provides reliable, accessible, and auditable records to internal and external stakeholders including regulators, auditors, and courts; and destroys records securely at the expiry of their retention period, consistent with the POPIA purpose-limitation principle.

This policy sits at the *policy* layer of the Reg → Policy → Procedure → System Capability chain (Principle 2). It cites the regulatory obligations above it; procedures under this policy (including `Procedures/by-policy/records-retention-schedule.md`, `Procedures/by-policy/legal-hold-procedure.md`, and `Procedures/by-policy/records-disposal-procedure.md`) operationalise it; the event store, content-addressed document store (per `D-RMS-PHASE-1`), and the seven RMS projection registers are the system capabilities that execute those procedures. The policy does not reproduce regulatory text; it anchors management choices above the regulatory floor.

The policy applies across the full record lifecycle: creation and registration; classification into one of four record classes; retention in the appropriate store for the applicable floor period; protection against unauthorised access, alteration, or premature destruction; and disposal at expiry via secure destruction or de-identification. A record is anything that documents a decision, event, transaction, obligation, communication, or fact — whether authored by an agent, generated by the platform, or received from a third party.

The Bank's primary record system is the event store (append-only, content-addressed, governed under Principle 1 and `D-RMS-PHASE-1`). Every decision, transaction, and significant platform event is a typed event in the store before any markdown or human-readable render. The event store satisfies the ECTA integrity and attribution requirements by design: events are immutable once appended; every event carries a BLAKE3 content-address; the origin and creation time of each event are determinable from the event payload and the log sequence. Human-readable renders (markdown files, BA returns, dashboard views) are derived projections of the event log, not canonical artefacts in their own right (Principle 1).

### Principles

- **Events-first records.** Every authoritative record of a decision, transaction, or significant platform event originates as a typed event in the event store. Markdown files and human-readable renders are projections; the event is canonical. Authoring a markdown record without a corresponding event is a Principle 1 violation.
- **Four-class record taxonomy.** Records are classified into one of four classes at creation: Governance records; Financial records; Client and conduct records; Operational and platform records. Each class carries a distinct retention floor. The taxonomy is the primary index for the retention schedule; a record that fits more than one class carries the longer floor.
- **Regulatory floor is a minimum, not a target.** The retention floor for each class is the regulatory minimum. The Bank retains records for the regulatory floor as the default; longer retention requires a documented business or legal justification. Retention beyond the floor for personal information that has no further legal or regulatory basis is a POPIA violation.
- **POPIA purpose-limitation governs beyond the floor.** When the retention floor is met and no further regulatory necessity applies, personal information must be destroyed or de-identified. The POPIA purpose-limitation principle (s.14) applies to all personal information in the Bank's records; the regulatory retention obligation is a lawful basis for continued retention only for the duration of that obligation. The Bank does not use retained personal information for any purpose other than satisfying the retention obligation.
- **Electronic records are primary.** The Bank operates on an electronic-records-first basis. Physical records are the exception; where physical records exist, they must be scanned and ingested into the document store within 5 business days. The physical copy is then the secondary; the electronic record is canonical.
- **ECTA compliance is structural, not procedural.** The event store and content-addressed document store satisfy ECTA ss.11–16 by architecture: records are accessible for reference (`s.13`), reproducible in intelligible form (`s.12`), and the origin and creation time are determinable (`s.11`). The Bank does not rely on procedural attestations to satisfy ECTA; it relies on architectural properties of the record system.
- **Legal holds override retention-period expiry.** When litigation, regulatory investigation, or PA inquiry is reasonably anticipated, a legal hold suspends all disposal of relevant records regardless of retention-period expiry. No record subject to a legal hold may be destroyed or de-identified until the hold is expressly lifted. The legal hold is a typed event in the event store.
- **Disposal is a typed event.** Destruction or de-identification of a record at the end of its retention period is a typed `RecordDisposed` event in the event store, recording the record class, identifier, retention period elapsed, disposal method, and authorising officer. Disposal without a corresponding event is an audit finding.
- **Governance-class disposal requires Director approval.** Destruction of any governance-class record (board minutes, resolutions, statutory registers, director filings) requires approval at Director level (CEO interim under `D-THIN-HUMAN-LAYER-MINIMUM`). Governance-class records are never destroyed while any board resolution in that period remains operative or any litigation is reasonably anticipated.

### Roles

Owen (Company Secretary, governance) is the Records Management Officer. Owen owns the policy, the retention schedule, and the governance-class record-keeping function. Owen is responsible for ensuring the Companies Act, FAIS, and ECTA record-keeping obligations are met; managing the statutory registers; and overseeing the governance-class retention and disposal process. Devon (Chief Operating Officer, governance) is responsible for the operational record systems: the event store, the content-addressed document store, the seven RMS projection registers, and the agent runtime log retention. Devon and Owen co-own the policy; Devon is the operational lead; Owen is the compliance and governance lead.

Zara (Chief Compliance Officer, governance) owns the POPIA intersection: purpose-limitation compliance, the consent and retention schedule for personal information, and the data-subject rights framework. Zara's curatorship of the POPIA-compliance layer runs parallel to Owen's statutory-floor curatorship; the two meet at the retention schedule, which must satisfy both frameworks simultaneously.

Imani (Legal-as-code engineer, engineering) holds the legal-hold trigger and lift authority as General Counsel (acting). A legal hold initiated by Imani suspends disposal for all records in scope of the hold until Imani issues the lift event. Imani's legal-hold decisions are typed events.

Vera (internal audit engineer, engineering — reports functionally to Thandiwe (Chief Audit Executive, governance)) conducts the annual records-management audit, assessing whether: (a) the four-class taxonomy is applied consistently; (b) retention floors are met; (c) disposal events are complete and authorised; (d) the POPIA purpose-limitation principle is observed; (e) the ECTA structural compliance of the record system is confirmed; and (f) legal holds are properly scoped and lifted when resolved. Any Vera finding under this policy is reportable to Owen and Devon, and to Thandiwe through the audit forum.

Atlas (Platform engineer, engineering) builds and operates the event store, content-addressed document store, and the RMS infrastructure. Atlas's substrate work is governed by `D-RMS-PHASE-1`; the policy layer Owen owns sits above Atlas's engineering outputs.

### Breach

Breach taxonomy under this policy is three-severity:

- **Alert (Amber).** Records classification inconsistency identified (record filed under the wrong class, affecting retention-floor application); disposal event missing for an expired record (identified in audit); ECTA compliance gap identified in a secondary record system not yet migrated to the primary store. Owen notified immediately; remediation within 30 days.
- **Hard Breach (Red).** Record destroyed before the end of its retention floor (other than de-identification of personal information at POPIA necessity expiry); legal-hold record disposed of while hold was active; governance-class record destroyed without Director approval. Owen notified immediately; incident reported to Devon; Vera notified for immediate audit action; regulatory notification assessed by Imani.
- **Critical (Critical-Red).** Destruction of statutory-register records before the 7-year floor; production by the Bank of records to a regulator or court that are found to be incomplete, inaccessible, or tampered with; failure to produce records within the timeframe required by a regulatory demand or court order. Immediate CEO notification; Imani assesses regulatory and litigation exposure; Devon leads incident response; Owen notifies the relevant authority under the applicable obligation.

---

## 2. Record Taxonomy and Retention Floors

**Owner:** Owen (Company Secretary, governance) — Classes 1 and 2; Devon (Chief Operating Officer, governance) — Classes 3 and 4 (operational systems); Zara (Chief Compliance Officer, governance) — POPIA intersection across all classes · **Approval:** Board (CEO interim) for taxonomy changes; Owen for retention-schedule updates within approved taxonomy · **Cadence:** Retention schedule reviewed annually; taxonomy reviewed on regulatory change · **Citation:** Companies Act 71 of 2008 — ss.24–26 (accounting records 7 years), s.73 (board minutes), s.92 (annual financial statements 7 years); POPIA — s.14 (retention limitation); FAIS General Code — s.18 (5 years); FICA — s.22–23 (5 years for accountable-institution records); ECTA — ss.11–16; `D-RMS-PHASE-1` (ORG-RM-01 — 1-year floor for operational/platform events)

### Purpose

This section defines the four-class record taxonomy and the retention floor applicable to each class. The taxonomy is the primary instrument for operationalising the Bank's retention obligations: it maps each regulatory obligation to the record class it governs and sets the floor. The retention schedule (maintained in `Procedures/by-policy/records-retention-schedule.md` and updated by Owen on each regulatory change) provides the record-class-to-floor mapping in the operative form; this section provides the policy-level definition of each class and the governing principles.

### Principles

- **Class 1 — Governance records.** Governance records are records of the Bank's constitutional, statutory, and corporate-governance functions: board and committee minutes and resolutions; statutory registers (shareholders register, directors register, beneficial-ownership register, securities register); director and officer appointment documents; annual returns and CIPC filings; corporate authorisations and delegated-authority matrices; shareholder agreements and corporate constitutional documents. **Retention floor: 7 years from the date of the record, or for the life of the Bank (whichever is longer) for statutory registers.** The 7-year floor is the Companies Act s.24–26 minimum for accounting records; statutory registers are perpetual obligations. Owen is the custodian of all governance-class records.

- **Class 2 — Financial records.** Financial records are records of the Bank's financial transactions, reporting, and prudential submissions: accounting records (general ledger, sub-ledgers, transaction journals, chart of accounts); annual financial statements (AFS); external and internal audit files; BA returns submitted to the PA (SARB); management accounts; tax records and SARS submissions; IFRS 9 ECL staging models and their outputs; and any other record that supports the fair representation of the Bank's state of affairs. **Retention floor: 7 years from the end of the financial year to which the record relates** (Companies Act s.24–26; SARS retention requirements align). Financial records are also subject to the ECTA s.12 reproducibility requirement — the Bank must be able to produce any financial record in intelligible form at any point within the retention floor. Bea (Accounting and financial reporting engineer, engineering) maintains the primary financial record systems; Owen holds the governance overlay.

- **Class 3 — Client and conduct records.** Client and conduct records are records relating to the Bank's dealings with clients and counterparties in its capacity as a financial services provider: FAIS advice records (s.18 General Code of Conduct); suitability assessments and mandates; fee and commission disclosures; client agreements and terms; KYC/CDD files (including FICA customer identification and verification records, beneficial-ownership records, PEP screening, and sanctions screening); transaction records (order records, execution records, settlement records); FAIS complaints records and resolution outcomes; client correspondence relating to regulated activities. **Retention floor: 5 years from the date of the last transaction, advice, or instruction to which the record relates** (FAIS General Code s.18; FICA s.22–23; the longer of the two governs where both apply). Client personal information is subject to the POPIA purpose-limitation principle at the end of the retention floor. Niko (Client lifecycle engineer, engineering — activates at licence-day) will operate the primary client-record systems at licence-day; Zara owns the POPIA-compliance overlay; Imani owns the legal-framework overlay.

- **Class 4 — Operational and platform records.** Operational and platform records are records generated by the Bank's platform infrastructure and agent runtime: event store entries (all typed events regardless of class); agent runtime logs; system-access logs; infrastructure provisioning and change records; substrate-management events (per `ORG-RM-01`); model validation records; recon pipeline outputs; CI/CD pipeline logs; security event logs; and third-party vendor service records. **Retention floor: 1 year from the date of the event or log entry** (`ORG-RM-01`), unless the record is also classified under a higher class (in which case the higher floor governs — see §2.2 cross-class principle below). Security event logs are subject to a minimum 1-year retention; PA-required audit trail records may carry longer floors per the applicable PA directive. Devon is the custodian of Class 4 records; Atlas operates the infrastructure.

- **Cross-class principle: the longer floor governs.** Where a record is classifiable under more than one class, it carries the longer retention floor. Examples: a FAIS suitability assessment that contains personal information is Class 3 (5 years) and POPIA-governed (purpose-limitation at 5 years); a board resolution that approves a financial transaction is Class 1 (7 years) not Class 2, though the underlying transaction record is Class 2. An event in the event store that also constitutes a FICA customer-identification record is Class 3 (5 years) not Class 4 (1 year).

- **Governing floor is the longer of regulatory minimum, POPIA necessity, and any litigation hold.** For any given record, the effective retention floor is: (a) the regulatory minimum for the class; (b) the POPIA necessity period (the period for which personal information is necessary for the purpose for which it was collected, or for which the regulatory obligation exists); (c) any applicable litigation hold, which is indefinite until lifted. The governing floor is the longest of these three; the record must be retained until all three are satisfied.

- **Retention schedule is the operative map.** The retention schedule (`Procedures/by-policy/records-retention-schedule.md`) maps each record type within each class to its retention floor, the applicable regulatory authority, the POPIA necessity assessment, and the disposal method. The schedule is the operative instrument; this section is the policy definition. Owen owns the schedule; Zara co-owns the POPIA rows.

### Roles

Owen owns the Class 1 and Class 2 retention schedule rows and the governance-class disposal process. Devon owns the Class 4 retention infrastructure. Zara owns the POPIA intersection across all classes. Imani holds the legal-hold authority. Bea maintains the financial record systems (Class 2). Atlas builds the infrastructure. Vera audits compliance with the taxonomy and retention floors annually.

### Breach

Systematic misclassification of records (a record class carrying a longer floor than the class applied) is an Alert. Any destruction of a record before its governing floor is a Hard Breach or Critical depending on the record class. Failure to maintain the retention schedule in current form (i.e., the schedule does not reflect the regulatory obligations in force) is an Alert; Owen remediation within 30 days.

---

## 3. Electronic Records and ECTA Compliance

**Owner:** Devon (Chief Operating Officer, governance) — system; Owen (Company Secretary, governance) — compliance overlay · **Approval:** CEO (interim) for any change to the primary record system architecture · **Cadence:** ECTA compliance reviewed annually; triggered on material platform change · **Citation:** ECTA 25 of 2002 — s.11 (legal recognition of data messages), s.12 (writing requirement satisfied by data messages), s.13 (signature requirement), s.14 (original requirement), s.15 (admissibility and evidential weight), s.16 (retention of data messages — form, accessibility, attribution); Companies Act 71 of 2008 — s.28 (accounting records accessible on demand); `D-RMS-PHASE-1` (event store architecture)

### Purpose

This section governs the Bank's electronic record-keeping architecture and its compliance with the ECTA requirements for data messages and electronic records. The Bank operates on an electronic-records-first basis; the event store and content-addressed document store are the primary record systems. This section confirms that the Bank's record architecture satisfies ECTA ss.11–16 by design, sets the requirements for any secondary electronic record system, and establishes the treatment of physical records that must be ingested into the primary system.

### Principles

- **The event store is the primary record system.** All typed events emitted by the Bank's platform — including every decision, transaction, instruction, correspondence record, and agent-run output — land in the event store as immutable, append-only entries. Each event carries: an event type (typed schema); a BLAKE3 content-address; a creation timestamp; a sequence number in the append-only log; and an originating actor identifier. These properties make every event a ECTA s.11-compliant data message: it is accessible for reference (`s.13`), capable of being reproduced in intelligible form (`s.12`), and its origin and creation time are determinable from the event payload (`s.11`). The event store satisfies ECTA s.16 (retention of data messages) by architecture.

- **Content-addressed document store for structured documents.** The BLAKE3 content-addressed document store (per `D-RMS-PHASE-1`) holds structured documents — policy files, research outputs, correspondence, AFS, BA returns — keyed by their content hash. A document's content-address is immutable: any alteration produces a different hash, making tampering detectable. Documents are referenced from events by their content-address; the event is canonical; the document is a content-addressed artefact attached to the event. This satisfies ECTA s.14 (the "original" of an electronic record is the record whose integrity can be verified).

- **Accessibility and reproducibility are architectural requirements.** The Bank's record systems must ensure that any record can be produced in intelligible form to an authorised officer, auditor, or regulator within the timeframe required by the applicable obligation or demand. Devon is responsible for ensuring the event store and document store maintain this accessibility throughout the retention floor. Degradation of accessibility (e.g., loss of the ability to read an event schema version) is a Critical incident.

- **Registered office accessibility.** The Companies Act requires accounting records and statutory registers to be kept at the registered office or at a disclosed alternate location (s.28). The Bank's cloud infrastructure (Azure, per `project_cloud_target_azure.md`) constitutes the Bank's electronic registered office record location; ECTA s.16 enables cloud retention to satisfy the physical-accessibility requirement, provided the records are accessible for reference and reproducible at any time. Owen ensures that the disclosure of the alternate location (cloud infrastructure address) is filed with CIPC per the Companies Act requirements.

- **Signature and authentication.** Where a record requires authentication or a signature under the Companies Act, FAIS, or FICA, the Bank's digital-signature infrastructure (per `Policies/information-security-it-governance-policy-v1.md` cryptographic controls section) satisfies the ECTA s.13 signature requirement: a qualified electronic signature accepted under ECTA s.13 has the same legal force as a handwritten signature. Agent-originated events are authenticated by the agent's cryptographic identity; human-originated events are authenticated by the human actor's identity credential.

- **Physical records are secondary.** Physical records generated in the course of business (e.g., signed originals, physical regulatory correspondence) must be scanned and ingested into the document store within 5 business days of receipt or creation. The electronic version is canonical; the physical copy is retained for the minimum period required by law (e.g., where a regulatory authority requires a physical original) and then destroyed. Devon oversees the digitisation process; Owen approves the disposal of physical originals.

- **Legacy record migration.** Records predating the commissioning of the event store and content-addressed document store must be migrated to the primary system progressively. Owen and Devon maintain a migration log; unmigrated records are kept in their original format and location with a reference entry in the migration log. Vera audits migration progress annually.

- **Evidential weight.** ECTA s.15 governs the admissibility and evidential weight of electronic records in South African courts. The Bank's event store architecture — immutable append-only log, BLAKE3 content-addressing, typed schemas, determinable origin and creation time — is designed to maximise evidential weight. Imani (Legal-as-code engineer, engineering — acting General Counsel) assesses evidential sufficiency for any records produced in response to a court order or regulatory demand.

### Roles

Devon owns the electronic record system architecture and the ECTA compliance of the primary record system. Owen holds the ECTA compliance overlay and the registered-office accessibility obligation. Atlas builds and operates the event store and document store infrastructure. Imani assesses evidential weight and legal-hold scope. Vera audits the electronic-records architecture against this section annually.

### Breach

Loss of accessibility of records within their retention floor (e.g., schema version unreadable, content-address resolution failure) is a Critical incident: Devon leads incident response; Owen assesses regulatory exposure; Imani assesses legal exposure. Discovery of a secondary record system that does not meet ECTA ss.11–16 requirements is a Hard Breach: Devon must remediate within 60 days; Vera tracks remediation.

---

## 4. Legal Hold Framework

**Owner:** Imani (Legal-as-code engineer, engineering — acting General Counsel) · **Approval:** CEO (interim) for legal holds of wider than routine scope · **Cadence:** Legal holds initiated and lifted on an event-triggered basis (litigation, regulatory investigation, or PA inquiry reasonably anticipated) · **Citation:** Common law litigation-hold doctrine (South Africa: preservation duty arising on reasonable anticipation of litigation); Companies Act 71 of 2008 — s.28 (records accessible to authorised officers); ECTA 25 of 2002 — s.15 (evidential weight); FICA — s.45A (FIC compliance-requirement preservation obligations) `[citation: TBC — precise FIC Act provision on document preservation; Imani + external counsel to ratify at the licence-application gate]`

### Purpose

This section governs the Bank's legal-hold framework: the process by which records that would otherwise be eligible for disposal are preserved because litigation, regulatory investigation, or PA inquiry is reasonably anticipated. A legal hold overrides the retention schedule; no record within the scope of a hold may be destroyed or de-identified until the hold is expressly lifted by Imani. The legal-hold event is typed; the lift event is typed. The hold is auditable from the event log.

### Principles

- **Anticipation standard.** A legal hold is triggered when there is a reasonable anticipation — not a certainty — that litigation, regulatory investigation, or PA inquiry may arise. The anticipation standard is deliberately conservative: it is better to hold records too long than to destroy evidence. Imani assesses whether the anticipation standard is met; where Imani is uncertain, the default is to hold.

- **Legal hold is a typed event.** Imani initiates a legal hold by emitting a `LegalHoldInitiated { holdId, scope, anticipationBasis, initiatedBy, initiatedAt }` event in the event store. The scope describes the record classes, record types, time range, and actors whose records are frozen. The anticipation basis is a brief statement of the anticipated proceeding. The hold is effective from the timestamp of the event; all disposal processes for in-scope records are suspended from that moment.

- **Scope must be proportionate.** The legal-hold scope must be no wider than necessary to preserve the relevant records. An overly broad hold that freezes records clearly unrelated to the anticipated proceeding is inefficient and may interfere with the Bank's operational disposal cycle. Imani is responsible for scoping holds proportionately; where scope is uncertain, Imani conservatively includes borderline records.

- **Communication of hold to record custodians.** Owen and Devon are notified of every legal hold immediately upon the `LegalHoldInitiated` event. Devon suspends the automated disposal processes for the in-scope records; Owen suspends any governance-class disposal approvals in scope. The record custodians for each class in scope are notified by Owen.

- **Litigation hold does not extend retention floor for out-of-scope records.** Records not within the scope of a legal hold continue on their normal retention schedule. A legal hold is not a general suspension of the disposal programme; it is a targeted freeze.

- **Legal hold lift.** When the anticipated litigation is resolved, the regulatory investigation is closed, or the PA inquiry is concluded, Imani emits a `LegalHoldLifted { holdId, liftedBy, liftedAt, resolution }` event. On receipt of the lift event, Devon and Owen resume normal disposal processing for the previously frozen records. Any records that have passed their retention floor during the hold period are eligible for immediate disposal following the lift.

- **CEO notification for material holds.** A legal hold that covers a wide class of records (e.g., all records for a particular period, or all records relating to a particular counterparty or regulatory matter) is reported to the CEO (interim) immediately. Owen provides a summary of the hold scope and anticipated duration.

- **Annual hold register review.** Owen maintains a legal-hold register (a projection of all `LegalHoldInitiated` and `LegalHoldLifted` events). At each annual records-management audit, Vera reviews the hold register for holds that remain open beyond 2 years; Imani is required to provide a status update on each long-running hold.

### Roles

Imani owns the legal-hold trigger and lift authority, the proportionality assessment, and the communication to Owen and Devon. Owen maintains the legal-hold register and suspends governance-class disposal. Devon suspends automated disposal for in-scope records. The CEO (interim) is notified for material holds. Vera audits the hold register annually.

### Breach

Destruction of a record subject to a legal hold is a Critical breach: immediate CEO notification; Imani assesses litigation and regulatory exposure; Vera logs a Critical finding; Devon conducts incident forensics. If the destruction occurred due to an automated disposal process that was not suspended after the hold was initiated, Devon leads the root-cause investigation and remediation.

---

## 5. Records Disposal Framework

**Owner:** Owen (Company Secretary, governance) — governance-class disposal; Devon (Chief Operating Officer, governance) — automated disposal for Classes 3 and 4 · **Approval:** Director level for governance-class disposal; Owen for other classes; Devon for automated Class 4 disposal · **Cadence:** Disposal is event-triggered on retention-period expiry; automated for Class 4; scheduled quarterly reviews for Classes 2 and 3 · **Citation:** POPIA — s.14 (retention limitation, destruction/de-identification obligation at expiry); Companies Act 71 of 2008 — ss.24–26 (floor, not ceiling; destruction after floor requires Director approval for governance class); ECTA 25 of 2002 — s.16 (destruction of electronic records consistent with retention obligation)

### Purpose

This section governs how the Bank disposes of records at the end of their retention period. Disposal is either secure destruction (for records that do not contain personal information, or for personal information that cannot be de-identified) or de-identification (for personal information where de-identification enables continued use for analytics or audit purposes without POPIA exposure). The Bank's preference for personal information is de-identification over destruction where de-identification can be achieved to the POPIA standard; for records with no personal information content, secure destruction is the default.

### Principles

- **Disposal is a typed event.** Every disposal action — whether automated or manual — is recorded as a `RecordDisposed { recordClass, recordId, retentionFloorElapsed, disposalMethod, authorisedBy, disposedAt }` event in the event store. The event is the audit trail for compliance with POPIA s.14 (demonstration that personal information was not retained beyond necessity) and with the Companies Act (demonstration that records were retained for the required floor before disposal). No disposal proceeds without a corresponding event.

- **Personal information: de-identify or destroy.** At the end of the POPIA necessity period (coinciding with or after the regulatory retention floor), personal information must be de-identified or destroyed. De-identification must meet the POPIA standard (Information Regulator guidance and POPIA s.1 definition): the de-identified information must not reasonably identify the data subject. Where de-identification cannot achieve the POPIA standard, the record is destroyed. Zara approves the de-identification method for any novel record type.

- **Secure destruction for non-personal records.** Records that do not contain personal information are destroyed at the end of their retention floor by secure erasure of the electronic record (cryptographic erasure of the encryption key for encrypted records, or secure overwrite for unencrypted records) and physical shredding for any physical copies. Devon is responsible for the secure-erasure procedure; the procedure is documented in `Procedures/by-policy/records-disposal-procedure.md`.

- **Governance-class disposal requires Director approval.** No governance-class record (Class 1) may be destroyed without Director approval (CEO interim under `D-THIN-HUMAN-LAYER-MINIMUM`). Owen prepares the disposal proposal, confirming that the retention floor has been met, that no legal hold is in scope, and that no ongoing board resolution or regulatory matter requires the record. The Director approval is a typed event (`GovernanceRecordDisposalApproved { recordClass: 1, recordId, approvedBy, approvedAt }`).

- **Automated disposal for Class 4 records.** Operational and platform records (Class 4) eligible for disposal (retention floor elapsed, no legal hold, no cross-class uplift) are eligible for automated disposal. Devon operates the automated disposal pipeline; the pipeline emits `RecordDisposed` events for each record disposed. Owen and Vera receive a quarterly automated-disposal report covering all Class 4 events in the period.

- **No disposal while litigation hold is active.** The disposal pipeline checks for active legal holds before executing any disposal. A record within the scope of an active `LegalHoldInitiated` event is ineligible for disposal until the corresponding `LegalHoldLifted` event is emitted. The pipeline treats a hold as active until the lift event is confirmed; no manual override is permitted below Director level.

- **Annual disposal review.** Owen and Devon conduct a quarterly disposal review: all records that have passed their retention floor in the preceding quarter are reviewed for disposal eligibility (confirming no legal hold, no ongoing regulatory matter, and no cross-class uplift). Eligible records are scheduled for disposal; ineligible records are carried on an exceptions list with an extended review date.

### Roles

Owen owns the governance-class disposal process and approval. Devon owns the automated disposal infrastructure and the Class 3 and Class 4 disposal scheduling. Zara approves de-identification methods for personal information. Imani confirms that no legal hold is in scope before disposal. Vera audits the disposal programme quarterly for completeness of `RecordDisposed` events and for compliance with the POPIA necessity principle.

### Breach

Disposal of a record before its retention floor is a Hard Breach. Disposal of personal information without a `RecordDisposed` event (i.e., undocumented destruction) is a Hard Breach: Owen and Zara notified immediately; Imani assesses POPIA exposure; Information Regulator notification assessed. Disposal of a record subject to a legal hold is a Critical breach (per §4).

---

## 6. POPIA Intersection and Purpose Limitation

**Owner:** Zara (Chief Compliance Officer, governance) — POPIA compliance; Owen (Company Secretary, governance) — policy coordination · **Approval:** Board (CEO interim) for any policy change to the POPIA-retention intersection · **Cadence:** POPIA-retention reconciliation reviewed annually by Zara and Owen; triggered on regulatory change or new product launch · **Citation:** POPIA — s.14 (retention limitation), s.10 (purpose specification), s.4 (processing conditions), s.13 (justification for processing without consent); Regulations under POPIA (GNR.1383); Information Regulator guidance on retention and de-identification `[citation: TBC — precise Information Regulator guidance document; Zara + Imani to confirm]`

### Purpose

This section governs the intersection between the Bank's regulatory retention obligations and the POPIA purpose-limitation principle. The core tension is this: regulatory obligations (Companies Act, FAIS, FICA) require the Bank to retain certain records for defined minimum periods; POPIA requires the Bank not to retain personal information beyond the period necessary for the purpose for which it was collected. Where the regulatory retention obligation exceeds the original collection purpose, the regulatory obligation is a lawful basis for continued retention — but only for the duration of that obligation. Once the regulatory obligation is satisfied, the personal information must be disposed of.

### Principles

- **Regulatory retention is a lawful basis under POPIA.** The Bank processes personal information during the regulatory retention period on the lawful basis of a legal obligation (POPIA s.13(1)(c) — processing necessary to comply with a legal obligation). This basis is valid only for the duration of the legal obligation; when the retention period expires, the lawful basis lapses and the data must be disposed of.

- **Purpose-limitation during the retention period.** Records retained under a regulatory obligation must not be used for any purpose other than satisfying that obligation. A client file retained for 5 years under FAIS s.18 must not be used for marketing, profiling, or any other secondary purpose during the retention period. Zara owns the purpose-limitation controls; Devon's systems must implement access restrictions that enforce purpose-limitation on retained records beyond their active-use period.

- **Consent does not substitute for regulatory necessity.** The Bank does not rely on consent as the lawful basis for processing personal information during the regulatory retention period. Consent is the weakest POPIA lawful basis and is revocable; regulatory necessity is the appropriate basis. The Bank does not seek consent to retain records it is legally required to retain.

- **De-identification as the preferred disposal method.** Where personal information can be de-identified to the POPIA standard without destroying the record's utility for audit or analytics purposes, de-identification is preferred over destruction. De-identified records are no longer personal information under POPIA and are no longer subject to POPIA processing conditions; they may be retained beyond the regulatory floor for analytics purposes. Zara approves de-identification methods; Devon implements them.

- **Data-subject rights during the retention period.** POPIA gives data subjects rights to access, correct, and object to processing of their personal information. During the regulatory retention period, the Bank satisfies access and correction rights; it may lawfully decline to delete personal information that it is legally required to retain, citing the regulatory necessity basis. Zara owns the data-subject rights response process; Owen provides the legal basis documentation.

- **Retention schedule is the operative POPIA record.** The retention schedule (`Procedures/by-policy/records-retention-schedule.md`) includes, for each record type, the POPIA necessity assessment: the purpose for which personal information was collected, the regulatory retention floor, the POPIA necessity period, and the disposal method at expiry. The schedule is the Bank's POPIA-compliance record for retention; Zara co-owns the POPIA rows.

### Roles

Zara owns the POPIA purpose-limitation compliance, the data-subject rights framework, and the de-identification approval process. Owen coordinates with Zara on the retention-schedule POPIA rows. Imani holds the legal-basis documentation framework. Devon implements the purpose-limitation access controls on retained records. Vera audits POPIA-intersection compliance annually, including whether retained records are being used for secondary purposes and whether de-identification has been applied correctly.

### Breach

Use of records retained under a regulatory obligation for any secondary purpose (marketing, profiling, model training) is a Hard Breach and a POPIA violation: Zara notified immediately; Information Regulator notification assessed by Zara and Imani. Failure to de-identify or destroy personal information at the end of the POPIA necessity period is a Hard Breach: Zara leads remediation; Devon executes disposal; Owen documents the compliance record.

---

## 7. Obligations Closure Table

The following obligations-register rows are closed by this policy. Status per the obligations-register convention.

| Obligation | Description | Status | Closed by section |
|---|---|---|---|
| `ORG-RM-01` | Retain runtime/substrate-management class events for a minimum 1-year horizon under the Bank's Records Management Policy | **IN FORCE** — closed | §2 (Class 4 — Operational and platform records), §3 (Event store as primary record system) |
| `ORG-RM-02` | Retain accounting records, statutory registers, and annual financial statements for a minimum of 7 years in accessible, human-readable form (Companies Act s.24–26) | **IN FORCE** — closed | §2 (Class 1 — Governance records; Class 2 — Financial records, 7-year floor) |
| `ORG-RM-03` | Maintain accounting records that fairly represent the company's state of affairs; accessible on demand by authorised officers, auditors, and regulators (Companies Act s.28) | **IN FORCE** — closed | §3 (Electronic records and ECTA compliance — accessibility and reproducibility principle; registered office accessibility) |
| `ORG-RM-04` | Not retain personal information beyond the period required to fulfil its purpose; maintain a retention schedule; destroy/de-identify at expiry (POPIA s.14) | **IN FORCE** — closed | §2 (Governing floor — POPIA necessity), §5 (Records Disposal — de-identify or destroy principle), §6 (POPIA Intersection — full section) |
| `ORG-RM-05` | Retain FAIS advice records, transaction records, and client information for a minimum of 5 years (FAIS General Code s.18) | **IN FORCE** — closed | §2 (Class 3 — Client and conduct records, 5-year floor) |
| `ORG-RM-06` | Electronic records must satisfy ECTA integrity and attribution requirements (ECTA ss.11–16) | **IN FORCE** — closed | §3 (Electronic Records and ECTA Compliance — full section) |

---

## 8. Substrate Dependencies and Gaps

Per the events-first authoring rule (Principle 1), gaps are not hidden; they are the work for downstream substrate phases.

### 8.1 Substrate currently under construction

- **RMS Phase 1 (Atlas, Devon — `D-RMS-PHASE-1`).** Seven typed events + BLAKE3 content-addressed document store + seven projection-derived registers (Decisions, Correspondence, Records-of-agent-runs, Document, Feedback, Briefs/dispatches, Workstreams). Discharge exit signal: all seven projection registers queryable; `RecordStored { contentAddress }` event emitted on document ingestion; recon `recon:rms-projection-integrity` green. Phase 1 substantively complete per `project_session_2026_05_10.md`.
- **Automated disposal pipeline (Devon, Atlas).** Automated disposal for Class 4 records on retention-floor expiry, with legal-hold check before disposal. Discharge exit signal: `RecordDisposed` events emitted automatically for expired Class 4 records; hold-check gate confirmed green in CI.
- **Legal-hold substrate (Imani, Atlas).** Typed `LegalHoldInitiated` and `LegalHoldLifted` events; hold-register projection; disposal-pipeline integration to block disposal for in-scope records. Discharge exit signal: `LegalHoldInitiated` and `LegalHoldLifted` events in the event schema; disposal pipeline blocks on active holds; Vera recon `recon:legal-hold-disposal-gate` green.

### 8.2 Procedures planned but not yet authored

- `Procedures/by-policy/records-retention-schedule.md` — operative retention-schedule map by record class and type, per §2.
- `Procedures/by-policy/legal-hold-procedure.md` — step-by-step legal-hold initiation, scoping, communication, and lift procedure, per §4.
- `Procedures/by-policy/records-disposal-procedure.md` — disposal execution procedure (secure erasure, de-identification, physical destruction, authorisation flow), per §5.

### 8.3 Citation gaps (TBC)

Per Principle 2, no sub-clause indices are invented. The following are `[citation: TBC]` until Imani + external counsel ratify at the licence-application gate:

1. Precise FICA provision (s.45A or successor) on document preservation obligations.
2. Information Regulator guidance document on retention and de-identification (precise title and GN reference).
3. Precise Companies Act sub-provision requiring disclosure of alternate record-keeping location to CIPC.
4. SARB / PA directives on minimum retention periods for BA-return supporting documentation.

---

## 9. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-13 | Owen (Company Secretary, governance) + Devon (Chief Operating Officer, governance) | Initial policy authored. Eight sections: (1) Overarching Policy — Board approval, Companies Act + POPIA + FAIS + ECTA + FICA citations, nine principles (events-first records, four-class taxonomy, regulatory floor as minimum, POPIA purpose-limitation, electronic-records-first, ECTA structural compliance, legal holds, typed disposal events, governance-class Director approval), roles, three-severity breach taxonomy; (2) Record Taxonomy and Retention Floors — Class 1 Governance (7-year perpetual for statutory registers), Class 2 Financial (7-year), Class 3 Client/conduct (5-year), Class 4 Operational/platform (1-year), cross-class longer-floor principle, governing-floor three-way max, retention-schedule operative instrument; (3) Electronic Records and ECTA Compliance — event store as primary system, content-addressed document store, accessibility and reproducibility as architectural requirements, registered-office accessibility, digital signatures, physical records secondary, legacy migration, evidential weight; (4) Legal Hold Framework — anticipation standard, typed LegalHoldInitiated/LegalHoldLifted events, proportionate scope, custodian communication, lift process, CEO notification for material holds, annual hold register review; (5) Records Disposal Framework — typed RecordDisposed events, POPIA de-identify or destroy, secure destruction, governance-class Director approval, automated Class 4 disposal, legal-hold gate, quarterly disposal review; (6) POPIA Intersection and Purpose Limitation — regulatory retention as lawful basis, purpose-limitation during retention, consent not a substitute, de-identification preferred, data-subject rights during retention, retention schedule as operative POPIA record; (7) Obligations Closure Table — ORG-RM-01 through ORG-RM-06 all closed; (8) Substrate Dependencies and Gaps — RMS Phase 1, automated disposal pipeline, legal-hold substrate (gaps explicitly named per Principle 2); citation gaps named. Identity discipline per CLAUDE.md observed throughout. |
