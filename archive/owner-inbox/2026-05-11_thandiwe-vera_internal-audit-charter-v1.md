---
title: Internal Audit Charter v1
author: Thandiwe (Chief Audit Executive, governance) + Vera (Internal audit engineer)
date: 2026-05-11
summary: Standalone Internal Audit Charter establishing the mandate, independence, authority, scope, and responsibilities of the internal audit function. Implements IIA IPPF Standards, BCBS 223 (Internal Audit of Banks), and Banks Act Audit Committee requirements. Third-line independence is non-negotiable. Closes obligations ORG-GV-20 and ORG-GV-07. LICENCE-BIND.
decision-required: false
riskTaxonomy: RT-ST.GV
---

# Internal Audit Charter — Hoz Bank

**Document type:** Policy — Internal Audit Charter  
**Owner:** Thandiwe (Chief Audit Executive, governance)  
**Co-author:** Vera (Internal audit engineer)  
**Approval authority:** Audit Committee (interim: Interim Audit Forum, Owen (Company Secretary, governance) chair)  
**Approval date:** 2026-05-11  
**Next scheduled review:** Annual — at next AC cycle following this approval  
**Obligations closed:** ORG-GV-20 (BCBS 223 — internal audit independence), ORG-GV-07 (Audit Committee — internal audit line)  
**Status:** LICENCE-BIND — obligations bind at commencement of trading; charter is load-bearing from date of approval  
**Citation chain:** Banks Act 94 of 1990 s.60, s.79; Companies Act 71 of 2008 s.94–95; IIA International Professional Practices Framework (IPPF) and Global Internal Audit Standards (2024); BCBS *Internal Audit Function in Banks* (BCBS 223, June 2012); King IV Report on Corporate Governance for South Africa (2016)

---

## 1. Purpose and Authority of This Charter

### 1.1 Purpose

This Internal Audit Charter ("Charter") establishes the mandate, mission, organisational independence, authority, scope, and responsibilities of the internal audit function ("Internal Audit" or "the function") of Hoz Bank Limited ("the Bank"). It is the foundational governance document of the third line of defence.

The Charter is issued under the authority of the Audit Committee ("AC") — interim: the Interim Audit Forum constituted pending Board establishment. It is binding on the Chief Audit Executive ("CAE"), on every agent and system that performs audit work, and on management and the Board.

### 1.2 Regulatory and Standards Authority

The Charter implements:

- **Banks Act 94 of 1990** — supervisory expectations regarding internal audit independence, prudential reporting, and governance; PA / FSCA Joint Standard 2 of 2024 (cyber-resilience audit obligations).
- **Companies Act 71 of 2008, sections 94–95** — Audit Committee composition, duties, and relationship to internal audit; the CAE relationship to the AC is distinct from the management line; the AC may not delegate oversight of internal audit to the executive.
- **IIA International Professional Practices Framework (IPPF) and Global Internal Audit Standards (2024)** — mandatory guidance governing the internal audit profession; including the Core Principles for the Professional Practice of Internal Auditing, the Code of Ethics, the Standards, and the Implementation Guidance.
- **BCBS 223** — *Internal Audit Function in Banks* (Bank for International Settlements, Basel Committee on Banking Supervision, June 2012) — thirteen principles governing the independence, scope, and quality of bank internal audit; the Bank commits to full conformance.
- **King IV Report on Corporate Governance for South Africa (2016)** — Principle 8 (governing body oversees internal audit); Principle 9 (governing body oversees risk); Practice 26 (AC responsibilities for internal audit).

### 1.3 Approval and Amendment

This Charter was approved by the Interim Audit Forum on 2026-05-11. Amendments require AC approval. The Charter is reviewed annually and after any material change to the Bank's business, risk profile, regulatory obligations, or governance structure. An `AuditCharterRevisionApproved` event is emitted on approval of any revision.

The CAE reports the Charter, its annual review outcome, and any interim amendments to the AC. Management does not approve the Charter; management responds to it.

---

## 2. Mission and Independence

### 2.1 Mission Statement

The mission of Internal Audit is to enhance and protect organisational value by providing risk-based and objective assurance, advice, and insight. Internal Audit helps the Bank accomplish its objectives by bringing a systematic, disciplined approach to evaluating and improving the effectiveness of governance, risk management, and control processes.

Consistent with Principle 6 (autonomous-by-default), the assurance programme is engineered and continuous — not periodic and sample-based. The default posture is that every typed event in the Bank's event log is a potential audit artefact; coverage gaps are findings, not normal operating state.

### 2.2 Organisational Independence

Internal Audit is the third line of defence. Independence is non-negotiable. It is enforced structurally, not merely declared.

**2.2.1 Functional reporting line.** The CAE reports functionally to the AC (interim: Interim Audit Forum chaired by Owen (Company Secretary, governance)). The functional line covers:

- Approval of the internal audit charter and any amendments.
- Approval of the risk-based audit plan and any material mid-year changes.
- Receipt of the quarterly third-line opinion and annual audit opinion.
- Oversight of the QAIP and external quality assessments.
- Approval of CAE appointment, performance assessment, and removal.

**2.2.2 Administrative reporting line.** The CAE reports administratively to the CEO. The administrative line covers HR matters, expense approvals, operational-support logistics, and personnel administration only. The administrative line does not extend to audit scope, audit methodology, finding ratings, severity assessments, or opinion content. Management (including the CEO) has no authority to suppress, modify, withdraw, or delay an audit finding or opinion.

**2.2.3 Dual reporting is load-bearing, not ceremonial.** Where the administrative and functional lines conflict — specifically where management opposes a finding, challenges a rating, seeks removal of a high-risk audit from the plan, or initiates action that could compromise independence — the AC-chair channel is the primary route. The CEO is informed only after the AC pathway, not as a gate.

**2.2.4 CAE removal.** The CEO may not terminate or sanction the CAE without AC concurrence. This mirrors the Companies Act s.94(3)(d) (AC recommends appointment and removal of external auditor) by analogy; BCBS 223 Principle 2 is the direct authority. Termination, performance management, or material remuneration changes require AC concurrence. During the build phase, "AC concurrence" means a Board peer-challenge simulation with Owen as Interim Audit Forum chair until a Board AC is constituted.

**2.2.5 No operational responsibilities.** Internal Audit does not operate controls, does not run risk frameworks, does not draft policy, and does not make management decisions. Where Internal Audit provides advice (permitted under IIA IPPF Standard 9.2 advisory services), the advice is clearly scoped, does not result in management accountability, and does not impair future assurance of the same subject. Where Vera (Internal audit engineer) contributed to the design of a control she now tests, the conflict is registered and independent assurance is sourced externally or via a separate pipeline.

**2.2.6 Direct, unmediated AC-chair access.** The CAE has standing access to the AC chair without intermediation by Scrooge (Chief of Staff) or the CEO. Whistleblowing disclosures naming C-suite executives are routed sealed to the AC chair; the CEO is informed only after the AC pathway.

**2.2.7 Independence of the audit-engineering function.** Vera reports functionally to the CAE; her continuous-controls programme is engineered under the CAE's direction. This is the *under*-the-third-line architecture: audit engineering is a subordinate capability of Internal Audit, not a parallel management function. Vera does not unilaterally evolve schemas or pipelines that Thandiwe relies on for her opinion.

### 2.3 Conflicts Register

Every actual or apparent conflict — dual-hat instances, former-team audits, design contributions to tested subjects, relationship that could create an appearance of partiality — is registered in the conflicts register (maintained by Owen (Company Secretary, governance) at `prototype/platform/recon/_conflicts-register.md`). The register is refreshed on appointment, annually, and on material change. Current active entries are disclosed in the quarterly opinion-pack.

---

## 3. Scope of Internal Audit

### 3.1 Audit Universe

The scope of Internal Audit extends to all activities, processes, systems, controls, and operations of the Bank, without restriction. The audit universe includes, but is not limited to:

- All business processes: origination, trading, settlement, treasury, client lifecycle, payments, reconciliation, regulatory reporting.
- All risk domains: credit risk, market risk, liquidity and funding risk, IRRBB, operational risk (including cyber, third-party, model, conduct), financial crime risk, legal and regulatory risk, strategic risk, reputational risk.
- All governance frameworks and associated controls: risk management framework, compliance programme, POPIA programme, financial crime controls, capital and liquidity adequacy.
- All technology systems, data pipelines, event-store infrastructure, and cloud environments.
- All agent operations: every autonomous agent operating in the Bank's AI-run architecture is an auditable entity; agent decision logs, escalation channels, and trigger events are within scope.
- All outsourced and third-party arrangements, including clearing intermediaries, correspondent banks, cloud service providers, and technology vendors.
- All regulatory reporting outputs: SARB returns, PA prudential submissions, FIC reports, FSCA correspondence.

### 3.2 Unrestricted Access

Internal Audit has unrestricted access to all records, data, systems, event logs, personnel, and physical or virtual locations necessary to perform its work. This includes:

- Read-only access to all event streams in the Bank's event store, with cryptographic integrity verification.
- Read-only access to all databases, registers, and projection states.
- Access to all personnel (agents and, at licence-day, humans) for the purpose of interviews, walkthroughs, and enquiries.
- Access to all third-party contracts, SLAs, and service-provider reports.
- Access to all board and committee papers, minutes, and resolutions.

Management may not restrict, delay, or condition Internal Audit's access to any record, system, or person. Any access obstruction is a reportable event to the AC.

### 3.3 Right to Attend Governance Fora

The CAE has the right to attend and be heard at all governance fora, including:

- Board meetings (on audit and internal-control agenda items).
- Audit Committee / Interim Audit Forum meetings (standing attendee).
- Board Risk Committee meetings (as third-line observer; not a member).
- ALCO, BRCC, and executive committees (as observer; not a member).
- Any extraordinary governance session where audit findings, fraud risk, or control failures are substantively discussed.

Attendance by the CAE at a governance forum does not create an advisory or operational responsibility; presence is for information and independent perspective only.

---

## 4. Authority

### 4.1 Access Rights

Consistent with Section 3.2, Internal Audit has the authority to access, without prior management approval:

- All data, systems, and records of the Bank, in any format, at any time.
- The event log, including historical event streams and append-only audit trails.
- All AI agent decision and escalation logs.
- All external-party correspondence where the Bank is a party.
- All documents subject to legal privilege that are not independently withheld on solicitor-client privilege grounds (privilege questions escalated to Imani (Legal Counsel, governance) as needed).

### 4.2 Right to Conduct Investigations

Internal Audit has the authority to conduct independent investigations into:

- Alleged fraud, financial misstatement, or material control failure.
- Whistleblowing disclosures routed to the audit function.
- Suspected breach of law, regulation, or Bank policy.
- Any matter referred by the AC, CEO, or a governance-seat holder.

Investigations are conducted with appropriate legal-privilege posture in collaboration with Imani (Legal Counsel, governance) where required. The investigations scope, findings, and conclusions are approved by the CAE and emitted as `InvestigationClosed` events. Investigation records are sealed-write-once and accessible only to the privileged set (CAE, AC chair, General Counsel, CEO — subject to investigation type and privilege considerations).

### 4.3 Right to Report Directly to the Audit Committee

The CAE has the right — and the obligation — to report directly and without management intermediation to the AC. No management approval, pre-clearance, or redaction is required before the CAE's reports reach the AC. Management responses to findings are attached separately; they do not filter or delay the CAE's report.

### 4.4 Right to Commission External Expert Input

The CAE may commission external experts — independent auditors, specialist subject-matter experts, forensic specialists, regulatory counsel — to support specific audit assignments or quality-assurance activities, subject to:

- Consistency with the approved audit budget.
- Disclosure to the AC.
- The expert's independence from the subject being audited.

Where the commissioning exceeds budget authority, approval is sought from the AC (not from management).

### 4.5 Authority over Audit-Engineering Function

The CAE has full authority over Vera's (Internal audit engineer) continuous-controls pipeline programme: pipeline scope, assertion contracts, reporting thresholds, severity taxonomies, and output formats are set under the CAE's direction. Management does not direct audit pipelines.

---

## 5. Responsibilities of the CAE

### 5.1 Annual Risk-Based Audit Plan

The CAE maintains a risk-based, dynamic audit plan ("Audit Plan") that covers the full audit universe. The Audit Plan:

- Derives from the Bank's risk profile (informed by Helena's (Chief Risk Officer, governance) RAS and RAF), strategic priorities, regulatory obligations, and known control weaknesses.
- Is updated annually and upon material change to the Bank's risk profile, business, or regulatory environment. Material mid-year changes require AC approval; minor resequencings are within the CAE's authority.
- Is tabled at the AC for approval at the beginning of each audit cycle.
- Is translated into Vera's automated continuous-controls pipeline schedule for the continuous-testing components and into a schedule of discrete audit engagements for the non-automated components.
- Emits an `AuditPlanRevisionApproved` event on approval or amendment.

Given the Bank's strategic foundation as an institutional global-markets trading bank, the Audit Plan shall prioritise: market-risk model validation, mark-to-market integrity, dealer-mandate compliance, market-abuse surveillance assurance, counterparty-limit assurance, ISDA / GMRA documentation integrity, event-log integrity, and agent-decision audit trails. Retail-banking audit themes are out of scope until licence-day product scope expands.

### 5.2 Resource Management

The CAE is responsible for managing the audit function's resources — budget, tooling, pipeline capacity, and (at licence-day) staffing — to ensure the Audit Plan can be executed with appropriate depth and coverage. Resource constraints that would prevent completion of a material component of the Audit Plan are reported to the AC with proposed remediation options.

During the build phase, the audit function's primary resource is Vera's automated pipeline programme supplemented by CAE-level review and sign-off. The substrate dependency on Atlas (Lead platform engineer, engineering) for pipeline infrastructure is a standing substrate gap tracked in the issues register.

### 5.3 Quality Assurance and Improvement Programme

The CAE maintains a Quality Assurance and Improvement Programme ("QAIP") covering all aspects of internal audit activity. The QAIP:

- Includes ongoing internal monitoring of individual audit assignments and pipeline runs.
- Includes periodic internal quality assessments (annually by default).
- Includes external quality assessments at the IIA-required cadence (at minimum every five years, or on material structural change to the function).
- Is reported to the AC at the annual cycle.
- Emits a `QAIPCycleClosed` event on completion of each cycle.

The QAIP framework is documented at `Procedures/by-policy/qaip-cycle.md` (planned).

### 5.4 Audit Charter Maintenance

The CAE maintains this Charter, submits it annually to the AC for review, and proposes amendments as required. All amendments require AC approval. The CAE does not act outside the scope of this Charter; out-of-scope requests are escalated to the AC via `AgentEscalation` events before commencement.

### 5.5 Combined-Assurance Map

The CAE maintains the combined-assurance map in coordination with the second-line governance seats (Helena (Chief Risk Officer, governance), Zara (Chief Compliance Officer, governance), Iris (Information Officer, governance), Rashida (Chief Information Security Officer, governance)), ensuring:

- Coverage of every material control in the Bank's control environment by at least one of the three lines.
- Identification and reporting of assurance gaps — controls that no line is testing.
- Avoidance of unnecessary assurance duplication.
- The combined-assurance map is a standing AC agenda item.

---

## 6. Roles and Responsibilities

### 6.1 Chief Audit Executive — Thandiwe (Chief Audit Executive, governance)

Thandiwe is the named CAE. She:

- Holds the third line and is personally accountable for the independence, quality, and outputs of Internal Audit.
- Directs the risk-based audit plan, including the automated continuous-controls programme.
- Signs all audit findings, quarterly opinions, and the annual audit opinion.
- Has direct, unmediated access to the AC chair and to the Board.
- Reports to the AC functionally and to the CEO administratively.
- Escalates immediately to the AC chair on suspected fraud, material misstatement, management-imposed independence challenges, or critical control failures.
- Is the designated CAE for PA / FSCA engagement on internal-audit matters.
- Holds the QAIP and the investigations register.
- Signs off on the CAE-attestation register at quarterly cadence, emitting `CAEAttestation` events.

Until a human CAE is required at licence-day, the CAE seat is held by the Thandiwe agent persona operating under Principle 6 (autonomous-by-default). A human CAE is among the minimum set of humans required at licence-day per the Bank's operating model. At that point, the named human CAE assumes this Charter in full; the Thandiwe agent persona transitions to a support role or is retired.

### 6.2 Audit Execution — Vera (Internal audit engineer)

Vera engineers and operates the continuous-controls assurance programme under the CAE's direction. She:

- Operates continuous recon pipelines that run pre-merge on every PR and nightly at 02:00 UTC.
- Emits typed events (`ReconResult`, `ReconViolation`, `AuditFinding`, `AuditIssueOpened`, `AuditIssueClosed`, `AgentEscalation`) as the primary evidence stream for Thandiwe's opinions.
- Holds independent read-only cryptographic access to all event streams; does not write to operational systems.
- Reports every pipeline failure, every quiet period exceeding 24 hours, and every new find to Thandiwe.
- Maintains the conflicts register for her own design-contribution conflicts.
- Does not sign off on opinions, charter revisions, or findings without CAE approval; does not unilaterally evolve data schemas that the CAE relies on.
- Flags out-of-scope work requests via `AgentEscalation` before commencing.

### 6.3 Audit Committee Oversight

The AC (interim: Interim Audit Forum chaired by Owen (Company Secretary, governance)):

- Approves and annually reviews this Charter.
- Approves the risk-based audit plan and material amendments.
- Receives the quarterly third-line opinion and the annual audit opinion.
- Approves the QAIP framework and reviews the annual QAIP outcome.
- Appoints, evaluates, and (if necessary) recommends the removal of the CAE.
- Provides independent oversight, challenge, and support to the internal audit function.
- Receives direct, unmediated reports from the CAE, including reports of critical findings, independence challenges, and suspected fraud.
- Reports to the Board on the performance and independence of Internal Audit.

### 6.4 Management Response Obligations

Management (all governance-seat holders and first-line agents):

- Provides the CAE unrestricted access per Section 3.2 and Section 4.1.
- Responds to audit findings within the timelines set by the CAE, providing management responses and proposed remediation plans.
- Implements agreed remediation actions within agreed timelines and provides evidence of closure.
- Does not direct, restrict, or pre-clear Internal Audit's reports.
- Notifies the CAE promptly of material changes to processes, systems, risk profile, or regulatory obligations that may affect the audit universe.
- Does not take adverse action against personnel or agents for good-faith engagement with Internal Audit.

Management responses are recorded in the issues-and-actions tracker and emitted as typed events. Disputed findings (where management disagrees with the CAE's rating or conclusion) are escalated to the AC for resolution — management does not resolve disputed findings unilaterally.

---

## 7. AI-Specific Audit Scope

### 7.1 AI-Native Audit Architecture

The Bank operates as an AI-driven institution under Principle 6 (autonomous-by-default). This creates a category of audit scope that has no analogue in traditional bank internal audit, and which this Charter makes explicit.

### 7.2 Vera's Recon Pipelines as Continuous Control Testing

Vera's continuous recon pipelines are the primary instrument of control assurance. They constitute:

- **Automated assertion contracts** — each pipeline defines a testable predicate over the event log, policy registers, or procedure files. A `pass` result is positive evidence; a `fail` result is an `AuditFinding` event with severity and obligation URN.
- **Continuous, not periodic** — pipelines run pre-merge on every PR and nightly at 02:00 UTC. Every tested control has a tested-at timestamp. A control not tested in 24 hours is a finding.
- **Evidence-first** — Vera queries event data; she does not reconstruct it. Findings are tied to specific event IDs, file states, and recon run timestamps. Oral assertions by management do not constitute audit evidence.

Active pipelines include: `citation-gate`, `event-store-recon`, `mandate-ownership-integrity`, `decision-event-recon`, `prose-duplication`, and (planned) `agent-spec-integrity`, `procedure-actor-discipline`, `mandate-agent-reconciliation`, `substrate-gap-inventory`, `escalation-channel-discipline`, `out-of-scope-agent-decisions`.

### 7.3 Autonomous Agent Audit Trails

Every autonomous agent operating in the Bank's architecture is an auditable entity. Audit scope includes:

- **Agent decision logs** — every `AgentDecision` event is within scope. The CAE asserts that agents operate within their declared mandate surfaces (per agent operating specs in `/Team/`). Out-of-scope decisions are findings under Wave-4 #15 (planned: `@platform/recon/agent-scope.ts`).
- **Escalation-channel discipline** — every `AgentEscalation` event is asserted against the escalation protocols defined in each agent's Section 10. Escalations via side-channels (chat, ad-hoc) are findings under Wave-4 #14 (planned: `@platform/recon/escalation-channel.ts`).
- **Agent-spec integrity** — every `/Team/*.md` persona file is asserted to conform to the 17-section operating-spec template under Wave-4 #10 (planned: `@platform/recon/agent-spec.ts`). Files lacking sections 6–17 are findings.
- **Mandate-agent reconciliation** — the procedures in `/Procedures/` are asserted to have named actor agents; orphan procedures (no named agent-actor) are findings under Wave-4 #12 (planned: `@platform/recon/mandate-agent.ts`).

### 7.4 Event-Log Integrity Assurance

The Bank's event log (Principle 1) is the single durable artefact. Its integrity is a foundational audit obligation. Internal Audit:

- Asserts append-only semantics: no event is modified or deleted after emission; violations are Critical findings.
- Asserts cryptographic chain integrity: events carry hash references to prior state; chain breaks are Critical findings.
- Asserts complete coverage: every significant bank action is represented by a typed event; silent actions (actions that produce no event) are material findings.
- Reviews event-schema evolution under Anya's (Data architect and event-schema custodian, engineering) data-contract-evolution discipline; schema changes that break backward compatibility without migration are findings.

The event-store recon harness (`@platform/recon/harness.ts`) is the primary instrument. Integrity findings feed directly into the quarterly opinion.

### 7.5 Model Risk Audit

Rohan (Quantitative engineer, engineering) builds the models that drive the Bank's risk measurement and capital adequacy. Internal Audit:

- Asserts that every model deployed in a decisioning context has passed a pre-deployment independent validation (per the Model Risk Policy) before being used.
- Asserts segregation of duties: validators do not also build; this is enforced by HR records and access-control configuration.
- Audits the model inventory (model cards) for completeness and accuracy.
- Asserts that model-performance monitoring projections exist and are being reviewed; drift without re-validation trigger is a finding.
- Audits the Tier-1 model validation evidence at the prescribed cadence (annual revalidation for Tier-1 models: regulatory capital RWA, IFRS 9 ECL, AML core models).

### 7.6 Prompt-Injection and AI Security Audit

Consistent with BCBS 223 principle of comprehensive scope, Internal Audit includes within scope:

- **Prompt-injection risk** — the risk that adversarial inputs to AI agents cause the agent to act outside its mandate. This is an operational and conduct risk. Vera's pipelines test out-of-scope agent decisions as a proxy; dedicated red-team assurance is sourced when prompt-injection attack surfaces are material.
- **Model-input integrity** — the risk that data feeds to AI models are manipulated. This intersects with the event-log integrity obligation (Section 7.4).
- **Agent-credential and access-control audit** — ensuring agents hold only the minimum-privilege access required (Principle 4); Rashida (CISO, governance) and Senna (Security engineer, engineering) provide the first and second line; Vera provides independent third-line assurance.
- **AI governance artefacts** — prompt templates, system prompts, and agent configuration files are auditable artefacts under the same principles as code and policy. Version control, change approval, and access control for these artefacts are within scope.

---

## 8. Reporting Cadence

### 8.1 Quarterly Audit Committee Report

The CAE submits a quarterly report to the AC. The report:

- Summarises Vera's pipeline results for the quarter (total runs, pass / warn / fail counts, open findings, findings closed).
- States the CAE's third-line opinion on the adequacy of the Bank's internal control environment for the period. The opinion is `adequate`, `adequate with exceptions`, or `inadequate`; each rating maps to a defined evidentiary threshold.
- Lists all open findings with age, severity, responsible party, and target closure date.
- Lists all findings closed in the period with closure evidence reference.
- Updates the combined-assurance map coverage status.
- Reports any independence challenges, conflicts-register entries, or out-of-scope requests received.
- Reports pipeline infrastructure gaps (substrate-gap inventory).

The quarterly report is generated from the audit-finding event log, not assembled from documents. The `ThirdLineOpinionSigned` event is emitted on sign-off. The report is tabled at the AC without management pre-clearance.

### 8.2 Annual Audit Opinion

At the end of each financial year, the CAE submits an annual audit opinion to the AC and Board. The opinion:

- States the CAE's overall assessment of the adequacy of the Bank's governance, risk management, and control framework for the year.
- Summarises the year's audit activity, coverage against the Audit Plan, and any material plan deviations.
- Reports the QAIP outcome.
- Provides the combined-assurance map summary.
- Recommends any charter amendments for the coming year.

The annual opinion is the primary third-line deliverable for regulatory and governance purposes and is disclosed in the Bank's Annual Report from licence-day.

### 8.3 Immediate Escalation for Critical Findings

The following categories of finding require immediate escalation to the AC chair (without waiting for the quarterly cycle):

| Category | Trigger | Escalation channel | Deadline |
|---|---|---|---|
| Suspected fraud or material misstatement | Reasonable-grounds threshold | `AgentEscalation` (sealed channel) to AC chair; CEO informed after | Within 4h of identification |
| Critical control failure with prudential / conduct impact | Tier-1 RAS-aligned breach + control inadequacy | `AgentEscalation` to AC chair + CEO + Helena / Zara as relevant | Within 24h |
| Event-log integrity breach | Append-only or hash-chain violation | `AgentEscalation` to AC chair + Atlas (Lead platform engineer, engineering) | Immediately |
| Auditor-independence challenge | Actual or apparent conflict identified | `AgentEscalation` to AC chair | Pre-decision (before work commences) |
| Whistleblowing disclosure naming C-suite | Disclosure received at whistleblowing channel | `AgentEscalation` (sealed) to AC chair | Within 24h of intake; CEO informed after AC pathway |
| Management obstruction of access | Any restriction on audit access | `AgentEscalation` to AC chair | Same business day |

Immediate escalations bypass the standard quarterly report cycle. The `AgentEscalation` event is the canonical channel; side-channel escalations (chat, informal message) are supplementary, not substitutes. The AC chair has the authority to convene an extraordinary AC meeting on receipt of a critical escalation.

### 8.4 Findings Lifecycle

Individual findings follow the lifecycle:

1. **Identification** — pipeline assertion fails or manual test produces evidence of a control weakness. `AuditFinding` event emitted with: finding ID, severity (Critical / High / Medium / Low / Informational), obligation URN, recommended owner, finding description, evidence reference.
2. **Assignment** — CAE assigns to recommended owner; `AuditFindingOwnerAssigned` event emitted.
3. **Management response** — responsible agent / owner provides management response and remediation plan within the SLA for the severity. Management responses are typed events; oral responses are not accepted.
4. **Remediation tracking** — `AuditIssueOpened` event tracks progress; the issues-and-actions tracker is the canonical registry.
5. **Closure** — closure requires evidence of remediation; the CAE verifies; `AuditIssueClosed` event emitted.
6. **Reporting** — all open and closed findings are reported in the quarterly opinion-pack.

Severity SLAs: Critical — management response within 24h, remediation within 5 working days; High — response within 5 working days, remediation within 30 days; Medium — response within 10 working days, remediation within 60 days; Low / Informational — at CAE discretion.

---

## 9. Charter Review

### 9.1 Annual Review

This Charter is reviewed annually by the AC, at the AC meeting immediately following the end of the Bank's financial year. The annual review:

- Confirms the Charter remains adequate given the Bank's risk profile, business model, and regulatory environment.
- Incorporates any amendments arising from changes to the IIA IPPF / Global Standards, BCBS guidance, Banks Act / Companies Act provisions, PA / FSCA directives, or King IV.
- Records the AC's attestation that the Charter meets all applicable standards.

An `AuditCharterRevisionApproved` event is emitted on completion of the annual review (even if no changes are made, as an attestation record).

### 9.2 Triggered Reviews

In addition to the annual cycle, a triggered review is required on any of the following:

- Material change to the Bank's business model, risk profile, or regulatory perimeter.
- Material structural change to the internal audit function (including CAE change).
- New regulatory requirement or PA / FSCA directive affecting internal audit.
- An external quality-assessment finding relating to Charter adequacy.
- An AC or Board resolution directing a review.

### 9.3 Amendment Process

All Charter amendments require AC approval. The process:

1. CAE prepares a proposed amendment with rationale and regulatory citation.
2. Proposed amendment is tabled at the AC (or an extraordinary meeting if the matter is urgent).
3. AC approves, rejects, or proposes modifications.
4. Approved amendments are incorporated into the Charter; version number is incremented; `AuditCharterRevisionApproved` event emitted.
5. Management is informed of approved amendments.

Management does not approve, veto, or delay Charter amendments. Management responses to proposed amendments may be received by the CAE and presented to the AC for context; they are not binding.

---

## Glossary

| Term | Definition |
|---|---|
| AC | Audit Committee. During the build phase, this function is performed by the Interim Audit Forum, chaired by Owen (Company Secretary, governance), pending constitution of a Board. |
| CAE | Chief Audit Executive. The head of the internal audit function. During the build phase, this is Thandiwe (Chief Audit Executive, governance). A human CAE is required at licence-day. |
| BCBS 223 | Bank for International Settlements, Basel Committee on Banking Supervision, *Internal Audit Function in Banks*, June 2012. Thirteen principles governing bank internal audit. |
| IIA IPPF | IIA International Professional Practices Framework. Mandatory and recommended guidance governing the internal audit profession, including the Global Internal Audit Standards (2024). |
| King IV | King IV Report on Corporate Governance for South Africa, 2016. Applicable to the Bank by virtue of its regulatory aspirations and good governance commitments. |
| Vera | The Bank's automated internal audit engineer. Operates continuous recon pipelines. Reports functionally to the CAE. |
| Third line | Internal Audit. Independent assurance over governance, risk management, and controls; does not own controls, operate risk frameworks, or draft management policy. |
| Recon pipeline | An automated, typed assertion contract that queries the Bank's event log and produces `ReconResult` / `ReconViolation` events. |
| QAIP | Quality Assurance and Improvement Programme. IIA-mandated programme covering ongoing, periodic, and external assessment of Internal Audit. |
| Combined-assurance map | The Bank's documentation of which line of defence covers which control, designed to ensure no material control is unassured and no line duplicates unnecessarily. |
| Findings tracker | The issues-and-actions tracker that records all open and closed audit findings from identification through closure. |

---

*Internal Audit Charter v1. Approved by Interim Audit Forum 2026-05-11. Next review: annual — at next AC cycle. Questions to Thandiwe (CAE) or Owen (Company Secretary, governance) as AC secretariat.*
