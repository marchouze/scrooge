---
title: "Internal Audit Charter v1"
author: Thandiwe (Chief Audit Executive, governance)
date: 2026-05-12
decision-required: false
status: "Submitted to Interim Audit Forum for sign-off"
riskTaxonomy: RT-ST.GV
citations:
  - "[citation: IIA International Standards for the Professional Practice of Internal Auditing (IPPF)]"
  - "[citation: BCBS 223 — Internal Audit Function in Banks]"
  - "[citation: Banks Act 94 of 1990 — s64 duties of directors and management]"
  - "[citation: King IV Principle 15 — Audit Committee]"
  - "[citation: Companies Act 71 of 2008 — s94 Audit Committee]"
---

# Internal Audit Charter v1 — Submission to Interim Audit Forum

**Document type:** Governance submission — Internal Audit Charter  
**Author:** Thandiwe (Chief Audit Executive, governance)  
**Submitted to:** Interim Audit Forum — Owen (Company Secretary, governance), chair  
**Submission date:** 2026-05-12  
**Status:** Submitted for Interim Audit Forum sign-off  
**Policy-layer document:** `Policies/internal-audit-charter-v1.md` (approved 2026-05-11; co-authored Thandiwe + Vera (Internal audit engineer))  
**Obligations closed:** ORG-GV-20 (BCBS 223 — internal audit independence); ORG-GV-07 (Audit Committee — internal audit line)  
**Citation chain:** Banks Act 94 of 1990 ss.64, 79; Companies Act 71 of 2008 ss.94–95; IIA IPPF / Global Internal Audit Standards (2024); BCBS 223 (June 2012); King IV Principle 15 / Practice 26

---

## Cover note from the CAE

This document is the formal governance submission of the Internal Audit Charter v1 to the Interim Audit Forum (interim Audit Committee) for sign-off. The full policy-layer text is at `Policies/internal-audit-charter-v1.md`. This submission summarises the Charter's material provisions, states the standards basis, and provides the sign-off block for the Interim Audit Forum record.

---

## 1. Purpose and Authority

### 1.1 Why this Charter exists

The Internal Audit Charter ("Charter") establishes the mandate, authority, independence, scope, and responsibilities of the internal audit function of Hoz Bank Limited ("the Bank"). It is the foundational governance document of the third line of defence.

The Charter is required by:

- **BCBS 223** (Internal Audit Function in Banks) — Principle 1: the internal audit function's mandate must be defined in a formal document approved at board level, covering independence, scope, and authority.
- **IIA IPPF / Global Internal Audit Standards (2024)** — Standard 10 (Purpose, Authority, and Responsibility): the CAE must confirm the charter's adequacy annually to the governing body.
- **Banks Act 94 of 1990** — supervisory expectations regarding independent internal audit at a licensed bank; PA / FSCA engagement expectations.
- **Companies Act 71 of 2008, s.94** — Audit Committee oversight of internal audit at public entities (applied by analogy to the Bank's governance architecture pending constitution of a formal Board).
- **King IV Principle 15 / Practice 26** — governing body oversight of the adequacy of the internal audit function.

### 1.2 Authority

The CAE has authority, under this Charter, to:

- Access all records, data, systems, event logs, personnel, and physical or virtual locations necessary to perform audit work — without management pre-approval, condition, or restriction.
- Conduct independent investigations into alleged fraud, material control failure, or regulatory breach.
- Report directly and without management intermediation to the Audit Committee (interim: Interim Audit Forum).
- Commission external experts to support specific engagements, subject to disclosure to the AC.
- Direct the continuous-controls pipeline programme that Vera (Internal audit engineer) engineers.

Management — including the CEO — may not restrict, condition, delay, or pre-clear Internal Audit's access to any record, system, or person. Any obstruction is a reportable event to the AC chair.

---

## 2. Independence and Objectivity

### 2.1 Third-line independence — structural, not declaratory

Independence is non-negotiable. It is enforced structurally through three mechanisms:

**Functional reporting.** The CAE reports functionally to the Audit Committee (interim: Interim Audit Forum, chaired by Owen (Company Secretary, governance)). The functional line covers: charter approval, audit plan approval, receipt of quarterly and annual opinions, QAIP oversight, and CAE appointment / performance / removal. Management does not sit within the functional line on any audit-substantive matter.

**Administrative reporting.** The CAE reports administratively to the CEO (Marc). The administrative line covers HR logistics, expense approvals, and operational support only. It does not extend to audit scope, methodology, finding ratings, severity assessments, or opinion content.

**Priority of the AC pathway.** Where the administrative and functional lines conflict — specifically where management opposes a finding, seeks removal of a high-risk audit from the plan, or initiates action that could compromise independence — the AC-chair channel is the primary route. The CEO is informed only *after* the AC pathway, not as a gate.

### 2.2 What the CAE will not do to protect independence

- Will not co-author management policy (Helena (Chief Risk Officer, governance) owns the RAS; Zara (Chief Compliance Officer, governance) owns the RMCP; Iris (Information Officer, governance) owns the POPIA programme; Rashida (Chief Information Security Officer, governance) owns the Joint-Standard programme). Thandiwe tests them.
- Will not take management responsibility for any first-line process.
- Will not accept a brief that would compromise independence; will say so on the record and escalate to the AC chair.
- Will not participate in combined-assurance-map coordination as a co-author of controls; the combined-assurance map is a record of what the three lines cover, not a joint authorship of those controls.

### 2.3 Conflict-of-interest protocol

Every actual or apparent conflict is registered in the conflicts register (Owen (Company Secretary, governance), `prototype/platform/recon/_conflicts-register.md`). The register is refreshed on appointment, annually, and on material change. Active entries are disclosed in the quarterly opinion-pack.

Where Vera (Internal audit engineer) contributed to the design of a control she now tests, the conflict is registered and independent assurance is sourced externally or via a separate pipeline.

### 2.4 Direct access to the AC chair

The CAE has standing access to the AC chair — Owen (Company Secretary, governance) as interim chair — without intermediation by Scrooge (Chief of Staff, orchestrator) or the CEO. Whistleblowing disclosures naming C-suite executives are routed sealed to the AC chair; the CEO is informed only after the AC pathway.

### 2.5 CAE removal

The CEO may not terminate or sanction the CAE without AC concurrence. This is enforced by BCBS 223 Principle 2 and King IV Practice 26. During the build phase, "AC concurrence" means a Board peer-challenge simulation with Owen (Company Secretary, governance) as Interim Audit Forum chair.

---

## 3. Scope

### 3.1 Full organisational scope

The scope of Internal Audit extends to all activities of Hoz Bank Limited and all entities in the Hoz Group (Hoz Group Limited, Hoz Securities Limited) within the scope of the Bank's consolidated supervision obligations. There are no carve-outs by function, department, or risk type.

### 3.2 AI-agent-operated functions — explicitly within scope

**No carve-out for AI-agent-operated functions.** This Bank operates as an AI-driven institution under Principle 6 (autonomous-by-default): the labour force is autonomous AI agents; humans oversee the residual set of decisions an agent cannot make on its own. This is a novel operating model. The Charter explicitly extends audit scope to:

- Every autonomous agent operating in the Bank's architecture — agents are auditable entities.
- Every `AgentDecision` event in the event log — decisions made by agents are within scope on the same terms as decisions made by human employees at a conventional bank.
- Every `AgentEscalation` event — escalation-channel discipline is an audit assertion.
- Every prompt template, system prompt, and agent configuration file — these are auditable artefacts (code and configuration) on the same terms as any other operational artefact.
- Prompt-injection risk and model-input integrity risk — these are operational and conduct risks within scope.

The novel risk of AI operating the bank is a first-class audit concern, not a gap to be deferred.

### 3.3 Scope by domain

The audit universe includes, without restriction:

- **Business processes:** origination, trading, settlement, treasury, client lifecycle, payments, reconciliation, regulatory reporting.
- **Risk domains:** credit risk, market risk, liquidity and funding risk, IRRBB, operational risk (including cyber, third-party, model, conduct), financial crime risk, legal and regulatory risk, strategic risk, reputational risk — all per the Bank's risk taxonomy.
- **Governance frameworks:** RAS, RAF, risk management framework, compliance programme, POPIA programme, financial crime controls, capital and liquidity adequacy.
- **Technology and data:** all technology systems, data pipelines, event-store infrastructure, and cloud environments.
- **All outsourced and third-party arrangements:** clearing intermediaries, correspondent banks (Standard Bank, FirstRand-RMB as primary; Absa, Nedbank as reserve), cloud service providers, technology vendors.
- **All regulatory reporting outputs:** SARB returns, PA prudential submissions, FIC reports, FSCA correspondence.

---

## 4. Standards

The internal audit function conforms to:

| Standard | Application |
|---|---|
| **IIA International Professional Practices Framework (IPPF) / Global Internal Audit Standards (2024)** | Mandatory guidance governing the profession: Core Principles, Code of Ethics, Standards, Implementation Guidance. The function conforms in all material respects; any departure is disclosed to the AC. |
| **BCBS 223 — Internal Audit Function in Banks (June 2012)** | Thirteen principles governing the independence, scope, and quality of bank internal audit. The Bank commits to full conformance. Principles are mapped to Charter sections in the policy-layer document (`Policies/internal-audit-charter-v1.md`). |
| **King IV Report on Corporate Governance for South Africa (2016)** | Principle 8 (governing body oversees internal audit); Principle 9 (governing body oversees risk); Principle 15 / Practice 26 (AC responsibilities for internal audit). |
| **Banks Act 94 of 1990 / Regulations Relating to Banks** | Supervisory expectations regarding internal audit independence, prudential reporting, and governance at a licensed bank; PA / FSCA Joint Standard 2 of 2024 (cyber-resilience audit obligations). The CAE is the named internal-audit contact for PA / FSCA engagement. |
| **Companies Act 71 of 2008, ss.94–95** | Audit Committee composition, duties, and relationship to internal audit. Applied by analogy pending constitution of a formal Board AC. |

---

## 5. Responsibilities

### 5.1 CAE responsibilities — Thandiwe (Chief Audit Executive, governance)

- Maintain the internal audit charter; submit annually to the AC for review.
- Maintain and execute the risk-based audit plan; submit to the AC for approval; report material deviations.
- Sign all audit findings, quarterly opinions, and the annual audit opinion — no opinion is issued without CAE sign-off.
- Direct Vera's (Internal audit engineer) continuous-controls pipeline programme: pipeline scope, assertion contracts, reporting thresholds, severity taxonomies, and output formats are set under the CAE's direction.
- Maintain the combined-assurance map in coordination with Helena (Chief Risk Officer, governance), Zara (Chief Compliance Officer, governance), Iris (Information Officer, governance), and Rashida (Chief Information Security Officer, governance).
- Escalate immediately to the AC chair on suspected fraud, material misstatement, independence challenges, or critical control failures.
- Maintain the QAIP and the investigations register.
- Emit `CAEAttestation` events at quarterly cadence; emit `ThirdLineOpinionSigned` events on quarterly opinion sign-off.
- Hold the register of external-auditor engagements jointly with Camille (Chief Financial Officer, governance) when an external auditor is appointed.

### 5.2 Vera's role — continuous-controls engineering arm

Vera (Internal audit engineer) engineers and operates the continuous-controls assurance programme under the CAE's direction. She:

- Operates continuous recon pipelines: pre-merge on every PR + nightly at 02:00 UTC.
- Emits typed events (`ReconResult`, `ReconViolation`, `AuditFinding`, `AuditIssueOpened`, `AuditIssueClosed`, `AgentEscalation`) as the primary evidence stream for the CAE's opinions.
- Holds independent read-only cryptographic access to all event streams; writes only to the audit evidence store.
- Reports every pipeline failure and every new finding to Thandiwe.
- Does not sign off on opinions, charter revisions, or findings without CAE approval.
- Does not unilaterally evolve data schemas that the CAE relies on for her opinion.

### 5.3 What management owes Internal Audit

- **Unrestricted access** — all records, data, systems, event logs, personnel, and physical or virtual locations, on demand, without pre-clearance.
- **Timely response** — management responses to findings within the SLAs set by the CAE (Critical: 24h; High: 5 working days; Medium: 10 working days).
- **Evidence provision** — closure of a finding requires evidence, not assertion. Typed events or documented artefacts; oral assurances are not accepted.
- **No direction of audit work** — management does not direct Internal Audit's scope, methodology, finding ratings, or conclusions.
- **Prompt notification of material changes** — processes, systems, risk profile, or regulatory changes that may affect the audit universe.

---

## 6. Audit Plan

### 6.1 Risk-based derivation

The risk-based audit plan is derived from:

1. The Bank's risk profile — informed by Helena's (Chief Risk Officer, governance) RAS and RAF, the risk taxonomy, and known control weaknesses.
2. Regulatory obligations — PA / FSCA supervisory expectations for a new-entrant licensed bank, BCBS standards, IIA requirements.
3. Strategic priorities — the Bank's institutional global-markets trading mandate (JSE bonds/equities + OTC IRD) is the primary lens; retail-banking themes are out of scope.
4. Build-phase maturity — in the build phase, audit work is assurance over build quality and readiness, not over live transactions. The plan prioritises substrate integrity, pre-licence gate readiness, and AI-agent operating discipline.
5. Continuous-controls coverage gaps — Vera's pipeline programme determines what is already continuously tested; the discrete audit plan covers what the pipelines cannot fully address.

### 6.2 Approval and governance

The audit plan is submitted to the Interim Audit Forum for approval at the beginning of each audit cycle. Material mid-year changes require AC approval; minor resequencings are within the CAE's authority. An `AuditPlanRevisionApproved` event is emitted on approval or amendment.

### 6.3 Rolling horizon

The plan operates on an annual plan + rolling 90-day forward horizon. The 90-day horizon is updated at each quarterly AC meeting to reflect changes in risk profile, emerging issues, and pipeline findings.

### 6.4 Materiality for unplanned audits

An unplanned audit engagement is initiated when:

- A `ReconViolation` event at HIGH or CRITICAL severity indicates a control weakness requiring a discrete engagement beyond the pipeline's continuous-testing capability.
- An `AppetiteBreach` event at Tier-1 severity triggers an independent assurance posture decision within 24h.
- An `AgentEscalation` event at third-line-relevant severity is received.
- A whistleblowing disclosure (`WhistleblowingDisclosure` event) requires investigation.
- The AC or CEO requests an extraordinary engagement (subject to independence constraints).

---

## 7. Reporting

### 7.1 Quarterly opinion to the Audit Committee

The CAE submits a quarterly report to the AC, not later than 7 days before the AC meeting. The report:

- States the CAE's third-line opinion on the adequacy of the internal control environment: `adequate`, `adequate with exceptions`, or `inadequate` — each mapped to a defined evidentiary threshold.
- Summarises Vera's pipeline results: total runs, pass / warn / fail counts, open findings, findings closed.
- Lists all open findings with age, severity, responsible party, and target closure date.
- Lists all findings closed in the period with closure evidence reference.
- Updates the combined-assurance map coverage status.
- Reports any independence challenges, conflicts-register entries, or out-of-scope requests.
- Reports substrate gaps that affect pipeline coverage.

The report is generated from the audit-finding event log, not assembled from documents. The `ThirdLineOpinionSigned` event is emitted on sign-off.

### 7.2 Findings register

All findings (open and closed) are maintained in the issues-and-actions tracker (substrate gap — planned; event-log-based in the interim). The findings register is a standing AC agenda item.

### 7.3 Escalation path for critical findings

| Category | Trigger | Channel | Deadline |
|---|---|---|---|
| Suspected fraud or material misstatement | Reasonable-grounds threshold | `AgentEscalation` (sealed) to AC chair; CEO after | Within 4h |
| Critical control failure with prudential / conduct impact | Tier-1 RAS breach + control inadequacy | `AgentEscalation` to AC chair + CEO + Helena / Zara | Within 24h |
| Event-log integrity breach | Append-only or hash-chain violation | `AgentEscalation` to AC chair + Atlas (Core banking platform architect, engineering) | Immediately |
| Independence challenge | Actual or apparent conflict identified | `AgentEscalation` to AC chair | Pre-decision |
| Whistleblowing disclosure naming C-suite | Disclosure naming executive at C-suite or above | `AgentEscalation` (sealed) to AC chair | Within 24h; CEO informed after |
| Management access obstruction | Any restriction on audit access | `AgentEscalation` to AC chair | Same business day |

### 7.4 Combined-assurance map update cadence

The combined-assurance map is updated quarterly (in conjunction with the AC report) and after any material change to the Bank's control environment. It is co-maintained with Helena (Chief Risk Officer, governance), Zara (Chief Compliance Officer, governance), Iris (Information Officer, governance), and Rashida (Chief Information Security Officer, governance).

---

## 8. Quality Assurance and Improvement Programme (QAIP)

### 8.1 How internal quality is maintained

The QAIP covers all aspects of Internal Audit activity:

- **Ongoing monitoring** — the CAE reviews Vera's pipeline assertion contracts, finding severity ratings, and evidence standards on an ongoing basis. Every pipeline run is a quality data point.
- **Periodic internal assessment** — an annual internal quality assessment reviews the function's conformance with IIA IPPF Standards and BCBS 223. The assessment covers: independence mechanics, audit plan derivation, finding quality, reporting timeliness, and pipeline coverage completeness. Findings from the internal assessment feed the following year's improvement programme.
- **Finding quality gate** — every finding must carry: obligation URN, evidence reference (event ID or artefact hash), severity rating with defined basis, recommended owner. Findings lacking these elements are returned before issue.
- **Independence self-certification** — the CAE submits an annual independence certification to the AC, confirming the conflicts register is current and no unregistered conflicts exist.

### 8.2 External quality assessment

An external quality assessment (EQA) by an IIA-authorised assessor is required at minimum every five years per IIA Standard 11.3. Timing:

- **First EQA:** scheduled for the second year of operation post-licence-day — once the function has at least one full operating cycle of evidence. Exact timing subject to AC approval and IIA-qualified assessor availability.
- **Trigger for out-of-cycle EQA:** material change to the function (CAE change, material scope change, regulatory direction).

The EQA outcome is reported to the AC and to the PA / FSCA as required by supervisory expectation.

### 8.3 Substrate gaps in the QAIP

The QAIP tooling is not yet built. During the build phase:
- QAIP cycle is manually facilitated by the CAE.
- QAIP outcomes are documented in `Procedures/by-policy/qaip-cycle.md` (planned).
- A `QAIPCycleClosed` event is emitted on completion of each cycle; this is the canonical record.

---

## 9. Charter Review

### 9.1 Annual review

This Charter is reviewed annually, at the AC meeting immediately following the end of the Bank's financial year. The review:

- Confirms the Charter remains adequate given the Bank's risk profile, business model, and regulatory environment.
- Incorporates any amendments arising from changes to IIA IPPF / Global Standards, BCBS 223, Banks Act / Companies Act provisions, PA / FSCA directives, or King IV.
- Records the AC's attestation.

An `AuditCharterRevisionApproved` event is emitted on completion of the annual review — even if no changes are made (attestation record).

### 9.2 Triggers for out-of-cycle review

An out-of-cycle review is required on any of the following:

- Material change to the Bank's business model, risk profile, or regulatory perimeter.
- Material structural change to the internal audit function — including CAE change.
- New regulatory requirement or PA / FSCA directive affecting internal audit.
- An EQA finding relating to Charter adequacy.
- An AC or Board resolution directing a review.

### 9.3 Trigger: human CAE at licence-day

The Thandiwe agent persona holds the CAE seat during the build phase under Principle 6. At licence-day, a human CAE is required (minimum human set per the Bank's operating model). On appointment of a human CAE, this Charter is reviewed and re-approved; the human CAE assumes the Charter in full; the Thandiwe persona transitions or retires. This is a scheduled trigger for an out-of-cycle review, not an amendment — the Charter terms remain valid; the named holder changes.

---

## 10. Sign-off Block

This Charter is submitted to the Interim Audit Forum for approval. Approval is recorded in the Interim Audit Forum minute and emitted as an `AuditCharterRevisionApproved` event.

| Role | Name | Signature | Date |
|---|---|---|---|
| **Chief Audit Executive** | Thandiwe (Chief Audit Executive, governance) | _(to be signed at forum)_ | 2026-05-12 |
| **Interim Audit Forum chair** | Owen (Company Secretary, governance) | _(to be signed at forum)_ | — |
| **Chief Executive Officer** | Marc (CEO) | _(to be signed at forum)_ | — |

**Note on build-phase sign-off mechanics:** Until the agent-runtime substrate supports typed signature events with non-repudiation, sign-off is recorded as a `CeoDecision` event (for the CEO line) and a governance-minute entry (for Owen as IAF chair). A dedicated `AuditCharterRevisionApproved` event schema is the target substrate for future cycles (Atlas — planned).

---

*Submitted by Thandiwe (Chief Audit Executive, governance), 2026-05-12. Policy-layer text: `Policies/internal-audit-charter-v1.md`. Questions to Thandiwe or Owen (Company Secretary, governance) as IAF secretariat.*
