---
policy-parent: Contracting Policy v0.1 (STUB) · Document Execution Policy v0.1 (STUB) · Owner Inbox/2026-05-06_core-policies-governance.md
last-reviewed: 2026-05-16
procedureId: PROC-LEG-CE-01
title: Contract execution — wet signature, digital signature, ECTA discipline
author: Imani (legal-as-code engineer)
date: 2026-05-16
owner: Imani (legal-as-code engineer)
status: POPULATED
policy-cited: Contracting Policy v0.1 (STUB) · Document Execution Policy v0.1 (STUB) · Owner Inbox/2026-05-06_core-policies-governance.md
system-capability: "@domains/legal/contract-execution (PLANNED)"
---

# Procedure — Contract execution — wet signature, digital signature, ECTA discipline

**Procedure ID:** PROC-LEG-CE-01
**Owner:** Imani (legal-as-code engineer)
**Approval:** CEO or delegated authority (per `delegation-of-authority.md` PROC-GV-DOA-01) · Owen (Company Secretary, governance — ECTA compliance oversight)
**Cadence:** On-trigger (per contract requiring execution)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Contracting Policy v0.1 (STUB) — to be populated; Imani is the author.
- Document Execution Policy v0.1 (STUB) — to be populated; Owen is the co-author.
- `Owner Inbox/2026-05-06_core-policies-governance.md` — governance and contracting framework.

The obligation chain:

```
Regulation (ECTA s.11–14 / ECTA Schedule 2 / Companies Act s.66 / Stamp Duties Act / FAIS s.5)
  → Contracting Policy · Document Execution Policy
    → PROC-LEG-CE-01 (this procedure — contract execution)
      → @domains/legal/contract-execution (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-DIG-01` (ECTA 25 of 2002 s.11–14 — electronic signatures) | Data messages are equivalent to written documents (s.11); electronic signatures are recognised (s.13); advanced electronic signatures (AES) are required for certain contracts (s.13(3)); Schedule 2 lists excluded contracts. |
| `ORG-DIG-02` (ECTA Schedule 2 — excluded contracts) | Agreements for the sale of immovable property, long-term leases, wills, and bills of exchange are excluded from electronic-signature validity; wet signature required. |
| `ORG-CORP-03` (Companies Act s.66 — board authorisation) | Contracts above the delegated authority threshold require board authorisation; the execution process must respect the delegation matrix. |
| `ORG-MKT-02` (ISDA Master Agreement and associated Schedules) | ISDA execution in SA is governed by ECTA s.11–14 subject to Schedule 2; netting enforceability depends on proper execution; AES or wet signature typically required. |
| `ORG-PRIV-02` (POPIA s.19 — information security) | Contract documents containing personal information must be stored securely; the DocuSign audit trail is part of the POPIA security safeguards. |

## 3. Purpose

Define the signature method for each category of contract the bank enters, ensure ECTA compliance, manage the DocuSign / qualified electronic certificate process for advanced electronic signatures, emit a contract execution event into the RMS for every executed contract, and retain the DocuSign audit trail for a minimum of 5 years.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| `ContractReadyForExecution { contractId, contractType, parties[], signatoryRoles[] }` (Imani) | Execution method selection — Steps 1–6 |
| `ContractAmendmentReady { contractId, amendmentId, type }` | Amendment execution — Steps 1–6 |
| ISDA / GMRA counterparty onboarding (cross-reference: `counterparty-onboarding-markets.md`) | ISDA / GMRA execution — Steps 1, 3, 5–6 |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Contract classification.** Imani classifies the contract against the signature-method matrix: (a) **Real property / bill of exchange / will** → wet signature (ECTA Schedule 2 exclusion); (b) **ISDA Master Agreement / GMRA / regulated financial contracts** → AES or wet signature (Imani assesses ECTA Schedule 2 applicability and netting enforceability in counterparty jurisdiction); (c) **Regulated-sector contracts (FAIS mandate, custody, outsourcing)** → AES required; (d) **Routine commercial contracts** → basic electronic signature (DocuSign click-to-sign) acceptable; (e) **Intra-group / intercompany** → basic electronic signature. Emit `ContractClassified { contractId, signatureMethod, ecteSchedule2Applies: boolean, justification }`. | `agent` (Imani) | `@domains/legal/contract-execution` (`PLANNED`) | The ECTA Schedule 2 list is cross-referenced in the clause library. Imani documents the justification for each classification. If in doubt, Imani escalates to Owen; when in doubt between AES and wet, default to AES. |
| 2 | **Authority check.** Owen confirms that the signatory identified in `ContractReadyForExecution` has the required authority per `delegation-of-authority.md` (PROC-GV-DOA-01): (a) contracts above Level 4 (Board) authority → board resolution required before execution; (b) contracts between Level 3 and 4 → CEO approval; (c) Level 2 → CRO/CFO/COO; (d) Level 1 → departmental head. Emit `ExecutionAuthorityConfirmed { contractId, signatory, authorityLevel, boardResolutionRequired: boolean }`. | `agent` (Owen) | `@domains/legal/contract-execution` (`PLANNED`) + `@platform/decisions/delegation` (existing) | ISDA Master Agreements are Level 3 authority (CRO + CEO co-signatory). Service agreements above R500k are Level 3. |
| 3 | **ISDA / GMRA execution path (where applicable).** For ISDA and GMRA: (a) Imani confirms the Schedule and Credit Support Annex (CSA) are finalised (cross-reference: `credit-origination.md` PROC-RISK-CO-01 Step 3); (b) confirms netting enforceability opinion (jurisdiction-specific); (c) selects AES or wet signature based on counterparty jurisdiction and ISDA legal opinion; (d) ensures English law / SA law governing-law clause is included per `counterparty-governing-law-clause-adoption.md`. | `agent` (Imani) | `@domains/legal/isda-registry` (`PLANNED`) | ECTA Schedule 2 does not expressly exclude ISDA agreements. However, netting enforceability in some jurisdictions (outside SA) requires wet signature or notarisation; Imani's legal opinion governs. |
| 4 | **Signature preparation.** Imani prepares the document for signature via the selected method: (a) **Wet signature**: print execution copy; route to signatories in order; retain original; scan for digital archive; (b) **AES (DocuSign with qualified certificate)**: upload to DocuSign; assign signing fields; configure qualified certificate requirement; (c) **Basic electronic signature (DocuSign click-to-sign)**: upload to DocuSign; assign signing fields; standard DocuSign authentication. Emit `ContractSignaturePreparationCompleted { contractId, method, docusignEnvelopeId? }`. | `agent` (Imani) | DocuSign ✓ (SaaS, SA region) + `@domains/legal/contract-execution` (`PLANNED`) | DocuSign is configured to use SA South Africa North (Azure) data residency for document storage (compliant with POPIA s.72 and `cloud-residency-attestation.md` PROC-IS-CRA-01). |
| 5 | **Execution and confirmation.** Each signatory executes via the selected method. On all signatories completing: DocuSign (or wet-signature routing) emits a completion confirmation. Imani verifies completion. Emit `ContractExecuted { contractId, executedAt, signatories[], method, docusignAuditTrailHash?, wetSignatureScan? }`. | `agent` (Imani) + signatories | DocuSign ✓ + `@domains/legal/contract-execution` (`PLANNED`) | The `ContractExecuted` event is the canonical record of execution (Principle 1). Wet signature originals are stored in Owen's physical document safe (until the bank's RMS document store supports certified physical-document indexing). |
| 6 | **RMS archiving.** Imani emits the `ContractExecuted` event into the RMS document store: (a) the executed contract (PDF/A, content-addressed, BLAKE3 hash); (b) the DocuSign audit trail (for electronic signatures, 5-year minimum); (c) any associated schedules, annexures, and board resolutions. Owen confirms archiving. Emit `ContractArchived { contractId, documentHash, auditTrailHash, archivedAt, retentionPeriod }`. | `agent` (Imani) + `agent` (Owen) | `@platform/rms/document-store` (`PLANNED`) | Retention periods: ISDA/GMRA — contract period + 10 years; service agreements — contract period + 5 years; employment contracts — contract period + 7 years (activates at licence-day); ECTA minimum — 5 years for the audit trail. |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Imani (legal-as-code engineer) | Contract classification; execution preparation; DocuSign workflow management; RMS archiving; ISDA/GMRA specific path |
| Owen (Company Secretary, governance) | Authority check; ECTA compliance oversight; archiving confirmation; wet signature physical custody |
| CEO / designated authority (per delegation matrix) | Signatory for contracts within their authority level |

## 7. Escalation

| Scenario | Escalation path |
|---|---|
| Counterparty insists on jurisdiction where ECTA AES is not recognised | Imani + Owen; escalate to CEO if netting enforceability is materially at risk; wet signature fallback |
| Signatory unavailable within required execution window | Imani → Owen → CEO; identify alternate signatory within delegation; document in `ContractExecuted` if alternate used |
| DocuSign qualified certificate provider unavailable | Imani; assess wet signature fallback; Devon + Senna if the outage is a cloud incident |
| Contract executed without proper authority | Owen + CEO immediately; legal validity assessment; remediation (ratification or re-execution) |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@domains/legal/contract-execution` | PLANNED | Classification engine, authority check, DocuSign workflow integration |
| `@domains/legal/isda-registry` | PLANNED | ISDA/GMRA specific registry and netting opinion store |
| DocuSign | ✓ (SaaS, SA region) | AES and basic electronic signature; audit trail generation |
| `@platform/rms/document-store` | PLANNED | Contract archive (content-addressed) |

## 9. Quality controls

- Vera recon: every `ContractReadyForExecution` has a `ContractExecuted` within 30 days (or an exception event).
- Vera recon: every `ContractExecuted` has a `ContractArchived` within 2 business days.
- Vera recon: every ISDA/GMRA in the ISDA registry has a corresponding `ContractExecuted` event.
- Imani: quarterly review of execution methods vs ECTA updates; DocuSign audit trail retention verification.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `ContractClassified`, `ExecutionAuthorityConfirmed`, `ContractSignaturePreparationCompleted`, `ContractExecuted`, `ContractArchived` events | Event log (P1) | Contract period + 10 years | Legal-confidential |
| Executed contracts (PDF/A, content-addressed) | RMS document store | Per contract type (see Step 6) | Legal-confidential |
| DocuSign audit trails | RMS document store | 5 years minimum (ECTA) | Legal-confidential |
| Wet signature originals | Owen's physical safe | Contract period + 10 years | Legal-confidential |
| Board resolutions (for board-authority contracts) | RMS document store | Permanent | Restricted |

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Imani | Initial draft — PLANNED → POPULATED; full 11-section procedure; ECTA Schedule 2 exclusion matrix; AES/wet/basic signature selection; DocuSign SA-region; ISDA/GMRA path; 5-year audit trail retention. |

## 12. Audit / assurance

- **Vera (ongoing):** execution event completeness; archiving timeliness; ISDA registry reconciliation.
- **Thandiwe (CAE, governance):** annual legal and contracts audit; ECTA compliance sampling; opinion to BRC.
- **External counsel (when engaged):** provides the netting enforceability opinions that determine signature method for ISDA/GMRA.
