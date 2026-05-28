---
policy-id: document-execution-policy
title: Document Execution Policy v1
version: "1"
status: IN FORCE
owner: Imani (Legal-as-code engineer, engineering)
effective-from: "2026-05-17"
next-review: "2027-05-17"
citations:
  - Electronic Communications and Transactions Act 25 of 2002 ss.11-16 Schedule 1
  - Electronic Communications and Transactions Act 25 of 2002 s.13
  - Electronic Communications and Transactions Act 25 of 2002 s.22
  - D-POLICY-DOCUMENT-HOME
author: Imani (Legal-as-code engineer, engineering)
date: 2026-05-17
summary: Document Execution Policy governing electronic and wet-signature execution of all agreements, contracts, and legal documents. Establishes Advanced Electronic Signature (AES) as the default for commercial agreements; specifies ECTA Schedule 1 exclusions requiring wet signature; maintains the execution register. Active now in the build phase. Closes obligations ORG-EL-01 (ECTA 25/2002 — recognise electronic communications and signatures in commercial transactions) and ORG-EL-02 (ECTA Schedule 1 — reserve wet signatures for excluded categories). IN FORCE.
decision-required: false
riskTaxonomy:
  - RT-LR.CT
obligations:
  - ORG-MK-02
---

# Document Execution Policy v1

> **Status:** IN FORCE. This policy is active during the build phase — the bank already executes agreements, contracts, and legal documents electronically (development contracts, vendor agreements, NDAs, service agreements). The Records Management Substrate (D-RMS-PHASE-1) is the production execution-register substrate; until Phase 1 fully lands, Imani maintains the register as a document-substrate artefact.
>
> **Author:** Imani (Legal-as-code engineer, engineering — reports to Devon COO interim). Imani holds the execution register and the AES provider pre-approval list.
>
> **ECTA posture:** the bank is an ECTA in-scope entity. Electronic contracts formed on the bank's systems are enforceable under ECTA s.22 (validity of electronic contracts). Default execution method is electronic with Advanced Electronic Signature. Wet signatures are reserved for the narrow ECTA Schedule 1 exclusion list.

---

## 0. Policy overview

| Attribute | Value |
|---|---|
| Policy name | Document Execution Policy |
| Version | v1 |
| Effective date | 2026-05-17 |
| Approval authority | CEO (Marc) — active immediately in build phase |
| Policy owner | Imani (Legal-as-code engineer, engineering — reports to Devon COO interim) |
| Review cadence | Annual; triggered by ECTA amendment, new subordinate legislation, or material execution dispute |
| Risk appetite anchor | RT-LR.CT (legal/contractual risk) — execution defects are a zero-tolerance item |
| IN FORCE | Yes — active during build phase; not a licence-day-only policy |
| Obligations closed | [`ORG-EL-01`](../Regulations/_obligations-register.md) (ECTA 25/2002 — electronic communications and signatures in commercial transactions), [`ORG-EL-02`](../Regulations/_obligations-register.md) (ECTA Schedule 1 — wet-signature reserved categories) |

---

## 1. Governance and Authority

### 1.1 Purpose

This policy establishes Hoz Bank Limited's document execution framework, giving effect to the bank's obligations under the Electronic Communications and Transactions Act 25 of 2002 (ECTA). It:

1. Establishes **electronic execution with an Advanced Electronic Signature (AES)** as the default for all commercial agreements, vendor contracts, service agreements, NDAs, employment contracts, and other legal documents
2. Specifies the **ECTA Schedule 1 exclusion categories** for which wet signature on a physical document is required
3. Prescribes the **AES pre-approval process** for electronic signature providers
4. Establishes and maintains the **execution register** as a canonical record of all executed agreements
5. Links the execution register to the **Records Management Substrate (RMS)** document store

The bank recognises that defective execution is a material legal and operational risk. Every agreement executed by or on behalf of the bank must satisfy the requirements of this policy and the applicable statutory formality requirements.

### 1.2 Statutory authority

This policy is adopted under and gives effect to:

- **Electronic Communications and Transactions Act 25 of 2002 (ECTA):**
  - s.11 — legal recognition of electronic communications: information is not without legal force solely because it is in electronic form
  - s.12 — formation and validity of agreements: an agreement is not without legal force solely because it was concluded partly or wholly by electronic communications
  - s.13 — formalities required for agreements: where a law requires a signature, an advanced electronic signature (AES) satisfies that requirement unless that law specifically prohibits electronic signatures or the document falls within Schedule 1
  - s.14 — expression of intent: intent to be legally bound may be expressed by way of an electronic communication
  - s.15 — writing requirement: a requirement in law that an agreement be in writing is satisfied by an electronic communication if the information is accessible and capable of being retained
  - s.16 — original requirement: a requirement for an original is satisfied by an electronic communication where the information is reliable and retainable
  - s.22 — validity of electronic contracts: agreements concluded electronically between parties are valid and enforceable
  - **Schedule 1 — Excluded transactions:** certain categories of agreements are excluded from ECTA's electronic-communication and electronic-signature provisions (see §3 of this policy)

- **Companies Act 71 of 2008 (Companies Act):**
  - ss.72, 73 — signing authority; delegation; common seal (in the context of the bank's authorised signatories and board resolutions)
  - Bank's Memorandum of Incorporation (MoI): execution authority thresholds are set in the MoI and the bank's delegation-of-authority framework

- **Stamp Duties Act (repealed 2009):** no longer applicable to commercial agreements; execution by electronic means is not impeded by any residual stamp duty concern for commercial contracts.

- **Financial Sector Regulation Act 9 of 2017 (FSR Act):**
  - Regulatory submissions to the PA, FSCA, and SARB carry their own execution requirements; Imani maintains a register of regulator-specific execution requirements as an annex to the execution register.

- **Banks Act 94 of 1990 / Banking Licencing Application requirements:**
  - The licence application itself and its supporting documents carry PA-specified formality requirements; Imani tracks and fulfils these requirements at the licence-application gate.

### 1.3 Entity scope

This policy applies to:

- **Hoz Bank Limited** — all agreements executed by or on behalf of the bank, in the build phase and from licence-day.
- **Hoz Group Limited** — group-level agreements where Hoz Group is the contracting entity.
- **Hoz Securities Limited** — applicable from the date the subsidiary requires execution of agreements in connection with its business.

### 1.4 Governance and roles

| Role | Holder | Authority |
|---|---|---|
| Policy owner / Execution Register owner | Imani (Legal-as-code engineer, engineering — reports to Devon COO interim) | ECTA compliance; clause library; execution register; AES provider pre-approval |
| Authorised signatories | CEO (Marc) + any person authorised under the bank's delegation-of-authority framework | Binding the bank contractually |
| Counterparty-risk review | Devon (Chief Operating Officer) or delegated authority | Counterparty and contract terms review for material agreements |
| Regulatory submission execution | Owen (Company Secretary, governance) + Imani | Regulator-specific formalities |
| Independent assurance | Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, Chief Audit Executive, governance) | Annual review of execution register completeness; formality-compliance spot-check |
| Board oversight | Board (from licence-day) | Approves delegation-of-authority framework; ratifies this policy |

### 1.5 Policy hierarchy

```
ECTA 25/2002 (ss.11-16, Schedule 1) + Companies Act + Banks Act
    └── Document Execution Policy (this document)
        └── Execution Register (Imani — document substrate / RMS)
            └── AES Provider Pre-Approval List (Imani)
                └── Agreement-type execution matrix (§3.3 of this policy)
```

Every node cites upward per Principle 2 (single-graph discipline).

### 1.6 Approval, review, and amendment

- **Initial approval:** CEO (Marc), 2026-05-17; immediate effect.
- **Annual review:** Imani-led, no later than 12 months after the preceding approval date.
- **Triggered review:** any ECTA amendment, new subordinate regulation, material execution dispute, or PA/FSCA guidance on electronic execution triggers review within 15 agent-cadence days.
- **Amendment discipline:** all changes to this policy are typed `PolicyAmended` events per Principle 1 (events are the only source of truth).

---

## 2. Electronic Execution — Default

### 2.1 Default method: Advanced Electronic Signature (AES)

Subject to the exclusions in §3, all agreements executed by or on behalf of Hoz Bank Limited use an **Advanced Electronic Signature (AES)**.

An AES satisfies the signature requirement in any law per ECTA s.13(1). It is the appropriate signature method for commercial agreements where:
- The parties intend to be legally bound
- The agreement is not excluded by Schedule 1 of ECTA
- No specific statute mandates a higher-order signature (e.g. a notarial act or attestation before a commissioner of oaths)

### 2.2 Definition of Advanced Electronic Signature

Per ECTA s.1, an **advanced electronic signature** is an electronic signature that:

- Is uniquely linked to the signatory
- Is capable of identifying the signatory
- Is created using data under the sole control of the signatory
- Is linked to the data signed in such a manner that any subsequent change to the signed data is detectable

In practical terms, AES is provided by an accredited certification authority (CA) or an approved AES provider (see §2.4). A basic or simple electronic signature (e.g. a typed name in an email, or a scanned wet signature) does not satisfy the AES requirement for agreements requiring a signature under statute.

### 2.3 Agreements subject to AES (default scope)

The following agreement types are executed by AES as default:

- **Vendor and service agreements:** all contracts with technology providers, service suppliers, cloud providers, and professional-services firms
- **Non-disclosure agreements (NDAs) and confidentiality agreements**
- **Employment contracts:** at licence-day, all human employment contracts are executed by AES
- **Contractor and consultant agreements:** during the build phase, agreements with contractors and advisors
- **Licensing agreements:** software licences, data licences, IP licensing
- **Master Trading Agreements:** ISDA Master Agreement and Schedules; GMRA; repo agreements (note: schedule-level amendments and transaction-level confirmations may use electronic confirmation as prescribed by the agreement terms; Imani maintains the clause library)
- **Regulatory submission supporting documents:** where the PA/FSCA/SARB accept electronic execution (Imani confirms the acceptance threshold per regulator per submission type)
- **Letters of credit, guarantees, and standby facilities:** where the counterparty and the bank agree to AES execution (verify ECTA Schedule 1 exclusions — bills of exchange exclusion applies; see §3)
- **Internal governance documents:** board resolutions, board minutes, committee minutes where the governing rules permit electronic execution

### 2.4 Approved AES providers

Imani maintains an **AES Provider Pre-Approval List** as an annex to the execution register. Only pre-approved providers may be used for AES execution.

**Interim provider (build phase):** DocuSign (or equivalent with a qualified certificate that satisfies the ECTA s.1 definition of AES — i.e. with a digital certificate issued by an accredited or equivalent CA). Imani confirms that the provider used satisfies the AES definition before each use.

**Licence-day selection:** Imani will, no later than the licence-application gate, conduct a formal provider review and select an ECTA-compliant AES provider that has been pre-approved by the bank's Board. Selection criteria:
- Legal recognition under ECTA and by the applicable SA courts
- Accreditation status (whether with the ZADNA accreditation process or equivalent)
- Security architecture (certificate management; key custody; audit trail)
- Integration with the bank's RMS document store (BLAKE3 content-addressed storage)
- Counterparty acceptance by the bank's institutional counterparties (ISDA, GMRA parties)

**No unapproved providers:** use of an AES provider not on the pre-approval list is a policy breach. Any agreement executed with an unapproved provider is subject to legal review by Imani before the bank treats it as binding.

### 2.5 Execution process (AES)

The standard AES execution process for a commercial agreement:

1. **Drafting and legal review.** Imani (or delegated counsel) reviews the agreement for compliance with this policy's formality requirements and confirms the agreement type (AES / wet-signature per §3.3).
2. **Signatory authorisation.** The authorised signatory under the bank's delegation-of-authority framework is confirmed. Agreements above the CEO's individual delegation threshold require a board resolution.
3. **Execution via approved AES platform.** The agreement is submitted to the pre-approved AES provider. Each party's signatory signs electronically using their AES credential.
4. **Certificate and audit trail preservation.** The executed agreement (with embedded AES certificate and audit trail) is stored in the document substrate (BLAKE3 content-addressed artefact). A `DocumentExecuted` event is emitted with the document hash, parties, execution date, execution method (AES), and agreement type.
5. **Execution register entry.** The `DocumentExecuted` event is the canonical execution register entry. The execution register is the event-projected view of all `DocumentExecuted` events.
6. **Counterparty copy.** A signed copy is provided to the counterparty in the agreed format (typically PDF with embedded certificates).

---

## 3. Exclusions — ECTA Schedule 1 (Wet Signature Required)

### 3.1 ECTA Schedule 1 — the excluded categories

ECTA Schedule 1 lists the categories of agreements that are **excluded from ECTA's electronic-communication and electronic-signature provisions**. These agreements cannot be validly concluded or executed electronically — they require a physical (wet) signature on a physical document.

**The complete ECTA Schedule 1 exclusion list (as at the effective date of this policy):**

1. **Agreements for the alienation of immovable property** as defined in the Alienation of Land Act 68 of 1981 — any agreement of sale or disposal of land or a real right in land
2. **Long-term leases of immovable property** in excess of 20 years (the Rental Housing Act and the Formalities in respect of Leases of Land Act 18 of 1969 prescribe writing and attestation requirements that are not satisfiable electronically)
3. **Execution, retention, and presentation of a will or codicil** as defined in the Wills Act 7 of 1953
4. **Bills of exchange** as defined in the Bills of Exchange Act 34 of 1964 — including cheques (a cheque is a bill of exchange drawn on a bank payable on demand); letters of credit where the instrument itself is a bill of exchange
5. **Any agreement** that is **required to be attested, acknowledged, or certified** by a notary public, commissioner of oaths, or other officer appointed by law for that purpose — the attestation formality cannot be performed electronically (ECTA does not authorise electronic notarisation)

### 3.2 Consequences of misclassification

If the bank attempts to execute an agreement falling within Schedule 1 by AES or other electronic means, the agreement is **not binding** on the counterparty (and may not be binding on the bank). This is an execution defect that cannot be cured by ratification — the agreement must be re-executed in the correct form.

Imani is responsible for identifying all Schedule 1 agreements before execution and routing them to the wet-signature pathway. Any uncertainty about whether an agreement falls within Schedule 1 is resolved by Imani; if Imani is uncertain, external counsel is engaged before execution.

### 3.3 Agreement-type execution matrix

| Agreement type | Execution method | Schedule 1 exclusion | Notes |
|---|---|---|---|
| Vendor / service agreement | AES | No | Default |
| NDA / confidentiality agreement | AES | No | Default |
| Employment contract | AES | No | Licence-day; human employees |
| Contractor / consultant agreement | AES | No | Build-phase and onwards |
| ISDA Master Agreement + Schedule | AES | No | Imani verifies counterparty acceptance |
| GMRA (repo) | AES | No | Imani verifies counterparty acceptance |
| Mortgage bond | Wet — notarial | Yes | Real right in land; notarial execution required |
| Sale of immovable property | Wet | Yes | Alienation of Land Act 68 of 1981 |
| Long-term lease (> 20 years) | Wet — attested | Yes | Formalities in respect of Leases of Land Act 18/1969 |
| Will / codicil | Wet — attested witnesses | Yes | Wills Act 7 of 1953 |
| Bill of exchange / cheque | Wet | Yes | Bills of Exchange Act 34 of 1964 |
| Letter of credit (documentary credit — not a bill) | AES | No | Verify if the LC instrument is structured as a bill of exchange |
| Letter of credit (structured as a bill of exchange) | Wet | Yes | Bills of Exchange Act |
| Bank guarantee / performance bond | AES | No | Confirm guarantor's own execution-form requirements |
| Regulatory licence application | Per PA/FSCA requirement | N/A | Imani confirms per submission; some require wet signature |
| Board resolution | AES (electronic board system) | No | Subject to MoI and Companies Act |
| Board minutes | AES or physically signed | No | Subject to Companies Act s.73 and MoI |
| Notarially attested agreement | Wet — notarial | Yes | Any agreement requiring notarisation |

This matrix is the live reference; Imani updates it when new agreement types are introduced. Additions to the matrix are recorded as `ExecutionMatrixUpdated` events.

---

## 4. Execution Register

### 4.1 Purpose and canonical form

The **execution register** is the bank's comprehensive record of all agreements executed by or on behalf of the bank. It is the canonical artefact for confirming that an agreement has been properly executed, and for locating the executed document and its certificate.

**Canonical form:** the execution register is the event-projected view of all `DocumentExecuted` events in the bank's event store. The event is the canonical record; the register is a query over the event store. The document-substrate entry (BLAKE3 content-addressed artefact) is the canonical location of the executed document.

**Integration with RMS:** the execution register is one of the document-substrate registers provided by the Records Management Substrate (D-RMS-PHASE-1). The `DocumentExecuted` event payload includes the BLAKE3 hash of the executed document, the parties, the agreement type, and the execution method. During the Phase 0 (pre-Phase-1) period, Imani maintains a transitional register as a document-substrate artefact until the event-projected register is production-ready.

### 4.2 Execution register fields

| Field | Description | Source |
|---|---|---|
| Document ID | Unique identifier generated on execution | `DocumentExecuted` event ID |
| BLAKE3 hash | Content-addressed hash of the executed document (including embedded certificates) | Document substrate |
| Agreement type | Category per the execution matrix in §3.3 | `DocumentExecuted` payload |
| Parties | Full legal names of all contracting parties | `DocumentExecuted` payload |
| Execution date | Date all parties have executed | `DocumentExecuted` payload |
| Execution method | AES (provider name); or wet (location of original) | `DocumentExecuted` payload |
| Authorised signatory (bank) | Name and position of the bank's signatory | `DocumentExecuted` payload |
| Counterparty signatory | Name and position | `DocumentExecuted` payload |
| Storage location | RMS document store reference (BLAKE3 hash) or physical location for wet-signature originals | `DocumentExecuted` payload |
| Retention class | Per the applicable retention floor (ECTA s.15 read with the Records Management Policy) | Applied by Imani at execution |
| Notes | Material conditions, effective date, governing law | `DocumentExecuted` payload |

### 4.3 Retention of executed documents

All executed documents are retained for the applicable retention period:

- **Commercial agreements (general):** minimum 6 years from the date of termination or expiry (consistent with the Prescription Act 68 of 1969 three-year general prescription period plus a two-year margin, and the Companies Act 71/2008 s.26 records requirement).
- **Employment agreements:** minimum 3 years after termination of employment (BCEA s.31); the bank applies the longer 6-year floor for HR-related agreements.
- **Regulatory submissions:** per the applicable regulatory retention requirement (Imani maintains a per-submission retention schedule).
- **Financial agreements (ISDA, GMRA, repo):** minimum 7 years from the date of the last transaction under the agreement (consistent with the Regulations Relating to Banks record-keeping requirements where applicable).
- **Schedule 1 physical originals:** physical wet-signature originals are stored in secure physical storage (managed by Owen, Company Secretary, governance); the document substrate holds a certified scan with BLAKE3 hash.

Retention is applied by Imani at the point of execution; the retention class is recorded in the execution register entry.

### 4.4 Counterparty execution records

Imani obtains and stores a copy of the counterparty's executed counterpart (or the counterparty's AES-signed copy) for all material agreements. For agreements executed via AES where both parties sign on the same AES platform, the platform generates a single unified executed document — this is the canonical version.

---

## 5. Controls and Monitoring

### 5.1 Pre-execution review

Before any agreement is executed on behalf of the bank:

1. Imani (or delegated reviewer) confirms the agreement type and execution method per §3.3
2. Confirms the signatory has authority per the delegation-of-authority framework
3. Confirms the AES provider is on the pre-approval list (for AES execution)
4. Records the pre-execution review in the document substrate (as a note on the agreement file)

### 5.2 Execution register completeness recon

Imani runs `recon:execution-register-completeness` at every agent-cadence tick:
- Every agreement known to be in execution (flagged as "execution in progress") has a `DocumentExecuted` event within 5 business days of the execution initiation date
- No `DocumentExecuted` event references a document hash that is absent from the document substrate
- Every wet-signature agreement has a confirmed physical-storage location recorded

### 5.3 AES provider certificate monitoring

Imani runs `recon:aes-provider-certificate-validity` monthly:
- All AES credentials used for execution in the preceding month are checked for certificate validity (not expired, not revoked)
- Any revocation or expiry discovered retrospectively triggers an `ExecutionCertificateAnomalyDetected` event and a legal review

### 5.4 Annual third-party legal review

Imani commissions an annual review of a sample (minimum 10%) of the execution register to confirm:
- Agreement-type classification accuracy (correct execution method applied)
- Execution register completeness (no off-register agreements)
- AES certificate quality (valid, not revoked, appropriate assurance level)
- Schedule 1 compliance (no Schedule 1 agreements executed electronically)

The annual review findings are reported to Devon (Chief Operating Officer) and to Vera.

---

## 6. Escalation

| Event | Escalation path | Timeline |
|---|---|---|
| Discovery of a defectively executed agreement (wrong execution method) | Imani + Devon notified immediately; Imani assesses legal cure; re-execution or ratification initiated | Same day |
| Disputed agreement execution | Imani + Devon + external counsel (if material) | Same day |
| AES provider certificate revocation or expiry discovered | Imani immediately; certificate anomaly event; legal review | Within 1 business day |
| Counterparty refuses to accept AES execution | Imani assesses whether wet-signature counterpart is required; escalates to Devon if material delay | Within 2 business days |
| Regulator questions execution validity of a submission | Imani + Owen notified; response prepared | Within 2 business days |
| New agreement type not covered by the execution matrix | Imani adds to matrix after legal review; `ExecutionMatrixUpdated` event | Within 5 business days |
| Schedule 1 agreement executed electronically (critical error) | Imani + Devon + board notified; counterparty notified; re-execution initiated | Same day; Vera notified |

---

## 7. Related Documents

- [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md) — rows ORG-EL-01, ORG-EL-02
- [`Policies/records-management-policy-v1.md`](records-management-policy-v1.md) — RMS document store; retention
- [`Policies/governance-framework-v1.md`](governance-framework-v1.md) — delegation-of-authority framework; board resolutions
- [`Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`](../Owner%20Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md) — RMS Phase 1 spec; document store integration
- `D-POLICY-DOCUMENT-HOME` — canonical policy home decision
- `D-RMS-PHASE-1` — Records Management Substrate Phase 1 approval
- Electronic Communications and Transactions Act 25 of 2002 — in `Regulations/ECTA/`
- Bills of Exchange Act 34 of 1964 — Schedule 1 exclusion
- Alienation of Land Act 68 of 1981 — Schedule 1 exclusion
- Wills Act 7 of 1953 — Schedule 1 exclusion
- Companies Act 71 of 2008 — signatory authority; board resolutions
- CLAUDE.md "Operating procedures" (events-first authoring; Principle 1 — events are the only source of truth)

---

## 8. Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v1 | 2026-05-17 | Imani (Legal-as-code engineer, engineering — reports to Devon COO interim) | Initial version. Document execution policy: ECTA statutory framework (§1); AES as default for all commercial agreements (§2); ECTA Schedule 1 exclusion list + wet-signature-required categories + agreement-type execution matrix (§3); execution register architecture, fields, and retention (§4); pre-execution review + completeness recon + AES certificate monitoring + annual legal review (§5); escalation (§6). Closes ORG-EL-01 + ORG-EL-02. IN FORCE from build phase. |

---

*Imani (Legal-as-code engineer, engineering — reports to Devon COO interim)*
