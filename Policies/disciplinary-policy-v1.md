---
policy-id: disciplinary-policy
title: Disciplinary Policy v1
version: "1"
status: IN FORCE
owner: Sade (AgentOps, governance)
effective-from: "2026-05-17"
next-review: "2027-05-17"
citations:
  - Labour Relations Act 66 of 1995 Schedule 8 Code of Good Practice — Dismissal
  - Labour Relations Act 66 of 1995 ss.185-197
  - Basic Conditions of Employment Act 75 of 1997
  - D-POLICY-DOCUMENT-HOME
author: Sade (AgentOps, governance) + Imani (Legal-as-code engineer, engineering)
date: 2026-05-17
summary: Disciplinary Policy governing fair labour practices, due-process disciplinary and grievance handling, substantive and procedural fairness in dismissals, and the AgentOps monitoring substrate that tracks open cases. Closes obligations ORG-HR-01 (LRA 66/1995 — fair labour practices; due-process disciplinary and grievance handling) and ORG-HR-02 (LRA + Codes of Good Practice — substantive and procedural fairness in dismissals). BUILD-PHASE ready; activates at licence-day on first human-employee appointment.
decision-required: false
riskTaxonomy:
  - RT-OP.PE
  - RT-LR.RC
---

# Disciplinary Policy v1

> **Status:** IN FORCE (policy layer). This policy is production-grade for licence-day when the thin human layer (~5–10 people) joins. During the build phase, the bank has no human employees; this policy applies to any human contractors or advisors engaged in the interim, and is ready for immediate activation on first human-employee appointment.
>
> **Authors:** Sade (AgentOps, governance) leads; Imani (Legal-as-code engineer, engineering — reports to Devon COO interim) co-authors the legal-as-code provisions.
>
> **Build-phase context:** The Labour Relations Act obligations (LRA 66/1995) bind the bank as a corporate employer from the moment it employs humans. No real human employees exist during the build phase (see CLAUDE.md "Operating model"). This policy is prepared in advance so that the governance substrate is production-grade at licence-day. The AgentOps substrate (Sade) handles compliance monitoring from day one.

---

## 0. Policy overview

| Attribute | Value |
|---|---|
| Policy name | Disciplinary Policy |
| Version | v1 |
| Effective date | 2026-05-17 |
| Approval authority | Board (or CEO interim during build phase) |
| Policy owner | Sade (AgentOps, governance) |
| Engineering owner | Imani (Legal-as-code engineer, engineering — reports to Devon COO interim) |
| Review cadence | Annual; triggered by legislative amendment, CCMA precedent shift, or material disciplinary incident |
| Risk appetite anchor | RT-OP.PE (people and employment risk) — zero appetite for unfair labour practices |
| BUILD-PHASE status | Policy ready; human-employer obligations activate on first human-employee appointment at licence-day |
| Obligations closed | [`ORG-HR-01`](../Regulations/_obligations-register.md) (LRA 66/1995 — fair labour practices; due-process disciplinary and grievance handling), [`ORG-HR-02`](../Regulations/_obligations-register.md) (LRA + Codes of Good Practice — substantive and procedural fairness in dismissals) |

---

## 1. Governance and Authority

### 1.1 Purpose

This policy establishes Hoz Bank Limited's disciplinary governance framework, giving effect to the bank's obligations under the Labour Relations Act 66 of 1995 (LRA) and the Code of Good Practice: Dismissal (Schedule 8 to the LRA). It prescribes:

- The misconduct classification framework (gross, serious, minor)
- The disciplinary procedure steps (investigation, notice, hearing, decision, appeal, CCMA referral)
- The standards for substantive and procedural fairness in every disciplinary action
- Sade's (AgentOps, governance) monitoring and reporting obligations

The bank is committed to fair, consistent, and dignified disciplinary processes. No dismissal may occur except for a valid reason, applied through a fair procedure, as required by LRA s.188.

### 1.2 Statutory authority

This policy is adopted under and gives effect to:

- **Labour Relations Act 66 of 1995 (LRA):**
  - s.185 — every employee has the right not to be unfairly dismissed
  - s.186 — definitions of dismissal (including constructive dismissal)
  - s.187 — automatically unfair dismissals (prohibited grounds including trade union activity, pregnancy, discrimination)
  - s.188 — fair dismissal: requires a valid reason and a fair procedure
  - s.189 — operational-requirements dismissals (retrenchment) — separate procedure applies
  - s.191 — CCMA referral by employee disputing dismissal
  - Schedule 8 — Code of Good Practice: Dismissal (procedural and substantive fairness standards)

- **Basic Conditions of Employment Act 75 of 1997 (BCEA):**
  - Minimum notice periods on termination (s.37)
  - Record-keeping obligations relevant to employment terms (s.31)

- **Constitution of the Republic of South Africa, 1996:**
  - s.23 — right to fair labour practices (foundational anchor for LRA)
  - s.33 — right to just administrative action (informs procedural fairness standards)

### 1.3 Entity scope

This policy applies to:

- All human employees of **Hoz Bank Limited** — from licence-day, this includes the thin statutory-minimum human layer (~5–10 people: directors, CEO, MLRO/FIC CO, Information Officer, auditor, FAIS key individuals).
- Human contractors and advisors engaged by the bank during the build phase are subject to the fairness principles of this policy where their engagement terms permit disciplinary action; independent contractors without an employment relationship fall under their contract terms (Imani, Legal-as-code engineer, manages clause libraries for this distinction).
- Autonomous AI agents are not employees and are not subject to this policy; AgentOps substrate incidents (underperformance, spec violations) are addressed through the agent-operations framework (Sade).

### 1.4 Governance and roles

| Role | Holder | Authority |
|---|---|---|
| Policy owner | Sade (AgentOps, governance) | Owns disciplinary policy; monitors open cases; reports to Devon (COO interim) |
| Legal-as-code owner | Imani (Legal-as-code engineer, engineering — reports to Devon COO interim) | ISDA/GMRA clause library; employment-contracts clause library; LRA compliance hooks |
| Hearing chairperson | Appointed by Devon (COO interim) or delegated manager; must be independent of the accused employee's direct management chain | LRA Schedule 8 §4 |
| Appeals authority | Next governance level above the hearing chairperson; Board AC at senior-management level | LRA Schedule 8 §8 |
| CCMA representation | Imani or external counsel at licence-day | LRA s.191 |
| Independent assurance | Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, Chief Audit Executive, governance) | Third-line; annual review of disciplinary outcomes register |

### 1.5 Policy hierarchy

```
Constitution s.23 (fair labour practices)
    └── LRA 66/1995 + Schedule 8 Code of Good Practice: Dismissal
        └── BCEA 75/1997 (employment conditions; notice)
            └── Disciplinary Policy (this document)
                └── Disciplinary Procedure (Procedures/by-policy/disciplinary-*.md)
                    └── AgentOps substrate — Sade's monitoring and case-tracking
```

Every node cites upward per Principle 2 (single-graph discipline).

### 1.6 Approval, review, and amendment

- **Initial approval:** CEO (Marc), 2026-05-17; Board ratification at first constituted Board meeting.
- **Annual review:** Sade-led, no later than 12 months after the preceding approval date.
- **Triggered review:** any LRA or BCEA amendment, material CCMA precedent, or a serious disciplinary incident triggers review within 30 agent-cadence days.
- **Amendment discipline:** all changes to this policy are typed `PolicyAmended` events per Principle 1 (events are the only source of truth). The markdown file is a render of the event; the event is canonical.

---

## 2. Misconduct Classification and Disciplinary Standards

### 2.1 Governing principles

Disciplinary action at Hoz Bank Limited is:

1. **Proportionate** — the sanction must be proportionate to the severity of the misconduct, the employee's employment record, and mitigating and aggravating factors.
2. **Consistent** — like cases must be treated alike; inconsistent treatment of comparably situated employees is unfair.
3. **Progressive** — where the misconduct permits, progressive discipline (verbal warning → written warning → final written warning → dismissal) is applied. Gross misconduct may result in summary dismissal at the first occurrence.
4. **Substantively fair** — dismissal requires a valid reason related to the employee's conduct, capacity, or operational requirements (LRA s.188).
5. **Procedurally fair** — every disciplinary action is preceded by notice, an opportunity to respond, and an impartial decision-maker (LRA Schedule 8 §4).

### 2.2 Misconduct categories

#### Gross misconduct (summary dismissal warranted on first occurrence)

Gross misconduct fundamentally breaches the employment relationship and destroys the trust and confidence necessary for continued employment. Dismissal without notice is warranted where the employer genuinely believes, on the balance of probability, that the employee committed the act:

- **Fraud or dishonesty:** theft; embezzlement; falsification of records; fraudulent misrepresentation to the bank, regulators, or clients
- **Corruption / bribery:** any conduct in breach of the Prevention and Combating of Corrupt Activities Act 12 of 2004 (PRECCA) or the bank's Anti-Bribery & Corruption Policy
- **Violence or serious intimidation:** physical assault; credible violent threat against colleagues, clients, or the bank's officers
- **Material data breach:** deliberate or grossly negligent disclosure of confidential client data, personally identifiable information (POPIA category), or classified bank information that results in or materially risks regulatory sanction
- **Regulatory falsification:** false reporting to SARB, PA, FSCA, FIC, or any other financial regulator; tipping-off in contravention of FIC Act s.29(3)
- **Gross insubordination:** deliberate refusal to carry out a lawful instruction from a manager or the board, in circumstances where the refusal is unjustified and contemptuous
- **Serious conflict of interest:** undisclosed dealing in bank securities or client securities while holding material non-public information (insider trading)
- **Substance impairment:** reporting for duty under the influence of alcohol or controlled substances where this creates a serious risk to the bank or to others
- **Sexual misconduct constituting criminal conduct:** as defined in the Criminal Law (Sexual Offences and Related Matters) Amendment Act 32 of 2007

#### Serious misconduct (formal written warning; dismissal on second occurrence or aggravated single incident)

- Persistent poor attendance without valid reason or authorisation
- Deliberate or repeated violation of documented bank policies (other than gross-misconduct categories above)
- Disclosure of confidential information without authorisation (not rising to the gross-misconduct threshold)
- Conduct unbecoming of a bank official that materially embarrasses the institution
- Repeated failure to comply with reasonable lawful instructions despite a prior written warning

#### Minor misconduct (verbal or written warning; progressive discipline)

- Isolated lateness without notification
- Failure to follow administrative procedures (leave application forms, expense submissions)
- Minor insubordination (a single isolated instance not constituting gross insubordination)
- Careless work quality where no material consequence has resulted

### 2.3 Substantive fairness standards (LRA s.188 + Schedule 8)

A dismissal is substantively fair if:

1. The reason for dismissal is a valid reason related to the employee's conduct, capacity, or the bank's operational requirements.
2. In the case of misconduct: dismissal is appropriate given the nature and severity of the act, the employee's circumstances (length of service, prior record, personal circumstances), and any mitigating factors presented.
3. The employer must prove the reason for dismissal on a balance of probabilities.
4. The standard of proof for summary dismissal for gross misconduct is: the employer genuinely believed, on reasonable grounds, that the employee was guilty of the conduct, and that dismissal was an appropriate sanction in the circumstances.

### 2.4 Procedural fairness standards (LRA Schedule 8 §4)

A dismissal is procedurally fair if the employer:

1. Gives the employee a **notice** of the charge(s) in written form, with adequate time to prepare a response (minimum 48 hours — §3.2 of this policy)
2. Conducts a **hearing** at which the employee has a reasonable opportunity to state a case
3. Allows the employee to bring a **representative** (a fellow employee or a trade union representative — not an attorney unless the employer also brings an attorney or unless the parties agree otherwise)
4. Makes a **decision** and communicates it in writing with the reasons
5. Gives the employee the right to **appeal** to a higher authority

Failure of procedure does not automatically make a dismissal substantively unfair, but procedural unfairness is itself a ground for CCMA referral and may result in reinstatement or compensation orders.

---

## 3. Disciplinary Procedure

### 3.1 Investigation

**Trigger:** any allegation of misconduct, or Sade's detection of an anomalous conduct event (e.g. an audit trail flag, a Vera recon finding, a colleague complaint), opens an investigation.

**Investigation officer:** Devon (COO interim) appoints an investigation officer who is:
- Senior to the accused employee
- Independent of the accused's direct line management
- Free of a material conflict of interest in the matter

**Investigation steps:**

1. **Preserve evidence.** All relevant system logs, communications, transaction records, and documents are preserved at the point of the allegation. Sade emits a `DisciplinaryInvestigationOpened` event.
2. **Interview witnesses.** The investigation officer interviews relevant witnesses. Witness statements are recorded in writing; witnesses sign their statements.
3. **Interview the accused employee.** The accused is given an opportunity to respond to the preliminary findings before the investigation is concluded. This is not the formal hearing — it is a fact-gathering step. The accused may be accompanied by a support person.
4. **Investigation report.** The investigation officer prepares a written report: findings of fact; recommendation on whether to proceed to a disciplinary hearing. The report is stored in the document substrate.
5. **Decision to charge.** Devon (COO interim) or the designated authority reviews the investigation report and decides whether to proceed to a formal disciplinary hearing. If no further action is warranted, Sade emits `DisciplinaryInvestigationClosed` with disposition "no charge".

**Precautionary suspension:** Where the nature of the alleged misconduct is such that the employee's presence in the workplace during investigation would be prejudicial to the investigation or create an unacceptable risk, the employee may be placed on precautionary suspension with full pay. Suspension is not disciplinary action and must not be communicated as such.

### 3.2 Notice of charge

**Written notice (minimum 48 hours before the hearing):**

The notice of charge must contain:
- A clear description of each charge, with sufficient particularity that the employee can prepare a response
- The date, time, and venue of the disciplinary hearing
- The employee's right to bring a representative
- A statement that the employee may request reasonable additional time to prepare, provided the request is made promptly

Sade emits a `DisciplinaryNoticeIssued` event on dispatch of the notice. The notice is stored in the document substrate.

### 3.3 Disciplinary hearing

**Chairperson:** the hearing is chaired by an independent chairperson appointed by Devon (COO interim). The chairperson must not be subordinate to the accused employee and must not have a conflict of interest in the matter.

**Hearing steps:**

1. **Opening.** The chairperson confirms the charge(s), confirms the employee received adequate notice, and explains the procedure.
2. **Employer's case.** The investigation officer presents the employer's case: evidence, documents, witness testimony. The accused employee (or representative) may cross-examine employer witnesses.
3. **Employee's case.** The employee (or representative) presents the employee's response: evidence, documents, mitigation, witnesses. The employer's case presenter may cross-examine.
4. **Closing.** Both sides may make closing submissions.
5. **Adjournment and decision.** The chairperson adjourns to consider the evidence. The chairperson must reach a verdict on the balance of probabilities and, if guilty, determine the appropriate sanction (applying the proportionality principle per §2.1).
6. **Outcome communicated.** The chairperson communicates the outcome in writing, with reasons, within a reasonable period (typically same day or next business day).

Sade emits a `DisciplinaryHearingConducted` event when the hearing closes, capturing: charge(s), verdict, sanction.

### 3.4 Decision and sanction

**Verdicts:** guilty / not guilty (on each charge separately where multiple charges).

**Sanctions (progressive, calibrated to misconduct category per §2.2):**

| Misconduct category | Typical sanction range |
|---|---|
| Gross misconduct | Summary dismissal without notice (or pay in lieu); or, in exceptional circumstances with strong mitigation, a final written warning |
| Serious misconduct (first occurrence) | Final written warning; demotion; suspension without pay (where LRA-compliant) |
| Serious misconduct (repeat occurrence) | Dismissal (substantive reason established by the prior warning) |
| Minor misconduct (first occurrence) | Verbal or written warning |
| Minor misconduct (repeat occurrence) | Written warning; final written warning |

**Proportionality factors:** the chairperson must weigh:
- Nature and severity of the misconduct
- The employee's length of service and prior disciplinary record
- Mitigating factors (personal circumstances, genuine remorse, provocation)
- Aggravating factors (breach of trust, impact on the institution or third parties, premeditation)
- Consistency with how comparable cases have been handled

**Written outcome record:** the outcome is recorded in a written determination, stored in the document substrate and referenced from the `DisciplinaryHearingConducted` event.

### 3.5 Appeal

**Right of appeal:** any employee found guilty of misconduct has the right to appeal the verdict or the sanction (or both) to a higher authority.

**Appeal authority:**
- First appeal: the next level of management above the hearing chairperson (Devon COO interim, or Board AC at senior-management level)
- Final internal appeal: the Board or Board AC (where the first appeal was Devon)

**Appeal procedure:**
1. The employee must lodge the appeal in writing, stating the grounds, within **5 business days** of receiving the written outcome.
2. The appeal authority reviews the hearing record (notes, evidence, determination) and the employee's appeal grounds.
3. The appeal authority may: confirm the outcome; vary the sanction; or set aside the outcome and remit for a new hearing.
4. The appeal authority issues a written decision with reasons.

Sade emits a `DisciplinaryAppealDecided` event capturing the appeal outcome.

### 3.6 CCMA referral

**Employee's right:** an employee who disputes the fairness of a dismissal may refer the dispute to the Commission for Conciliation, Mediation, and Arbitration (CCMA) per LRA s.191, within 30 days of the date of dismissal.

**Bank's obligations:**
1. Cooperate fully and in good faith with CCMA conciliation and arbitration processes.
2. Provide the CCMA with all required documentation (notice of charge, hearing record, appeal determination, personnel file).
3. Imani (Legal-as-code engineer) or external counsel (at licence-day) represents the bank.

**CCMA outcomes:** reinstatement; re-employment; or compensation (capped at 24 months' remuneration for procedural/substantive unfairness under LRA s.194).

**Automatically unfair dismissals (LRA s.187):** where a CCMA or Labour Court finds that a dismissal was automatically unfair (e.g. discriminatory ground; trade union activity), the compensation cap does not apply. Sade escalates any allegation of potentially automatically unfair conduct to Imani and Devon immediately on receipt.

Sade emits a `CcmaReferralReceived` event and tracks the matter to conclusion.

---

## 4. Grievance Handling

### 4.1 Grievance procedure

Any employee who has a grievance (a complaint about treatment, working conditions, or conduct by a colleague or manager) may raise it through the grievance procedure. Grievance handling is separate from and independent of the disciplinary procedure.

**Grievance steps:**

1. **Informal resolution.** The employee first attempts to resolve the grievance informally with the relevant manager. Sade may facilitate.
2. **Formal grievance.** If informal resolution fails, the employee submits a written grievance to Devon (COO interim) or directly to Sade where the grievance concerns Devon.
3. **Investigation and response.** The grievance is investigated and a written response provided within 10 business days.
4. **Escalation.** If unresolved, the grievance escalates to the Board or a designated Board committee.
5. **CCMA.** If the bank fails to resolve the grievance, the employee may refer an unfair labour practice dispute to the CCMA.

Sade emits a `GrievanceOpened` event and tracks the matter to conclusion.

### 4.2 Protection against victimisation

Any employee who raises a grievance in good faith is protected from victimisation, retaliation, or any adverse employment action as a consequence of raising the grievance. Victimisation itself constitutes an automatically unfair labour practice under LRA s.5.

---

## 5. Controls and Monitoring

### 5.1 Sade's monitoring role

Sade (AgentOps, governance) maintains an **open disciplinary cases register** as an event-projected artefact. The register tracks:

| Field | Description |
|---|---|
| Case ID | Unique case identifier (from `DisciplinaryInvestigationOpened` event) |
| Employee (at licence-day) | Name and position |
| Date opened | Date of `DisciplinaryInvestigationOpened` event |
| Status | Investigation / Notice issued / Hearing scheduled / Awaiting decision / Appeal / CCMA / Closed |
| SLA due | Applicable SLA date (hearing within 48h of notice; appeal within 5 business days; etc.) |
| Outcome | Verdict; sanction; appeal result; CCMA result |

The register is derived from the event store; it is not a manually maintained spreadsheet.

### 5.2 SLA compliance monitoring

Sade runs the `recon:disciplinary-sla-compliance` harness at every agent-cadence tick. The harness asserts:
- Every `DisciplinaryNoticeIssued` has a `DisciplinaryHearingConducted` event within 10 business days of the notice date
- Every `DisciplinaryHearingConducted` has a written outcome stored in the document substrate within 2 business days
- Every `DisciplinaryAppealLodged` has a `DisciplinaryAppealDecided` event within 15 business days

Breaches alert to Sade and are reported to Devon (COO interim).

### 5.3 Outcomes register

Sade maintains an **outcomes register** covering:
- Total disciplinary cases opened (by period)
- Misconduct category breakdown
- Verdict breakdown (guilty / not guilty)
- Sanction breakdown
- Appeal outcomes
- CCMA referrals and outcomes
- Average time-to-conclusion by stage

The outcomes register is reported to Devon (COO interim) quarterly and to Vera (Internal audit / continuous-assurance engineer) annually for the third-line review.

### 5.4 Consistency check

Before each sanction determination, Sade runs a `recon:disciplinary-consistency-check` query against the outcomes register: are there prior cases with materially similar facts? If so, the prior sanction is disclosed to the chairperson as a comparator. Inconsistent treatment without documented justification is a recon finding.

---

## 6. Escalation

| Event | Escalation path | Timeline |
|---|---|---|
| Allegation of gross misconduct | Devon (COO interim) notified immediately; Sade opens investigation | Same day |
| Allegation of automatically unfair dismissal basis | Imani (Legal-as-code engineer) + Devon + Board notified | Same day |
| CCMA referral received | Imani notified; `CcmaReferralReceived` event emitted; Sade tracks | Within 2 business days |
| Systemic disciplinary pattern (e.g. three or more cases in a quarter) | Devon report; Vera advisory engagement | At quarterly reporting cycle |
| SLA breach (hearing delayed beyond 10 business days) | Devon notified; Sade flags in outcomes register | On detection |
| Potential reputational / regulatory impact (e.g. PRECCA violation) | Zara (CCO) + Imani + Devon + Board notified | Same day |

---

## 7. Related Documents

- [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md) — rows ORG-HR-01, ORG-HR-02
- [`Policies/harassment-discrimination-policy-v1.md`](harassment-discrimination-policy-v1.md) — companion HR policy (EEA + harassment obligations)
- [`Policies/anti-bribery-corruption-whistleblowing-policy-v1.md`](anti-bribery-corruption-whistleblowing-policy-v1.md) — PRECCA and whistleblowing channel
- [`Policies/governance-framework-v1.md`](governance-framework-v1.md) — board-level governance structure
- `D-POLICY-DOCUMENT-HOME` — canonical policy home decision
- LRA 66/1995 — full text in `Regulations/LRA/`
- BCEA 75/1997 — cross-reference
- CLAUDE.md "Operating procedures" (events-first authoring; Principle 6 — autonomous by default)

---

## 8. Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v1 | 2026-05-17 | Sade (AgentOps, governance) + Imani (Legal-as-code engineer, engineering — reports to Devon COO interim) | Initial version. Disciplinary policy covering misconduct classification (§2), disciplinary procedure: investigation, notice, hearing, decision, appeal, CCMA referral (§3), grievance handling (§4), AgentOps monitoring and outcomes register (§5), escalation (§6). Closes ORG-HR-01 + ORG-HR-02. BUILD-PHASE ready; activates at first human-employee appointment. |

---

*Sade (AgentOps, governance) + Imani (Legal-as-code engineer, engineering — reports to Devon COO interim)*
