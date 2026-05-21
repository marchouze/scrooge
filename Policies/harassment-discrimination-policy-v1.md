---
policy-id: harassment-discrimination-policy
title: Harassment and Discrimination Policy v1
version: "1"
status: IN FORCE
owner: Sade (AgentOps, governance)
effective-from: "2026-05-17"
next-review: "2027-05-17"
citations:
  - Employment Equity Act 55 of 1998
  - Code of Good Practice on Prevention and Elimination of Harassment GN R.206 of 2022
  - Basic Conditions of Employment Act 75 of 1997
  - Constitution of the Republic of South Africa 1996 s.9
  - D-POLICY-DOCUMENT-HOME
author: Sade (AgentOps, governance)
date: 2026-05-17
summary: Harassment and Discrimination Policy eliminating unfair discrimination on all prohibited grounds, defining sexual and other harassment, establishing reporting channels, investigation procedures, and the AfentOps monitoring substrate. Closes obligations ORG-HR-04 (EEA 55/1998 — eliminate unfair discrimination; affirmative action plan) and ORG-HR-06 (EE Act + Code of Good Practice on Prevention and Elimination of Harassment — sexual and other harassment prevention). BUILD-PHASE ready; applies to human contractors and advisors now; activates fully at licence-day.
decision-required: false
riskTaxonomy:
  - RT-OP.PE
  - RT-LR.RC
---

# Harassment and Discrimination Policy v1

> **Status:** IN FORCE (policy layer). This policy applies immediately to any human contractors or advisors engaged by the bank during the build phase. It activates fully at licence-day when the thin human layer (~5–10 people) is appointed.
>
> **Author:** Sade (AgentOps, governance) — policy owner and monitoring authority.
>
> **Build-phase context:** The Employment Equity Act obligations bind the bank as a corporate entity from the moment it employs humans. The Code of Good Practice on Prevention and Elimination of Harassment (GN R.206/2022) applies to all employment relationships. During the build phase, this policy governs interactions with any human contractors or advisors. At licence-day, it governs all human employees. The AgentOps substrate tracks policy compliance from day one.

---

## 0. Policy overview

| Attribute | Value |
|---|---|
| Policy name | Harassment and Discrimination Policy |
| Version | v1 |
| Effective date | 2026-05-17 |
| Approval authority | Board (or CEO interim during build phase) |
| Policy owner | Sade (AgentOps, governance) |
| Review cadence | Annual; triggered by legislative amendment or DOLE/EE Commission guidance update |
| Risk appetite anchor | RT-OP.PE — zero appetite for unfair discrimination or harassment |
| BUILD-PHASE status | Policy ready; applies to human contractors and advisors now; full activation at licence-day |
| Obligations closed | [`ORG-HR-04`](../Regulations/_obligations-register.md) (EEA 55/1998 — eliminate unfair discrimination; affirmative action plan), [`ORG-HR-06`](../Regulations/_obligations-register.md) (EE Act + Code of Good Practice on Prevention and Elimination of Harassment — sexual and other harassment prevention) |

---

## 1. Governance and Authority

### 1.1 Purpose

This policy establishes Hoz Bank Limited's framework for preventing, addressing, and remedying unfair discrimination and harassment in the workplace. It gives effect to the bank's obligations under the Employment Equity Act 55 of 1998 (EEA), the Code of Good Practice on Prevention and Elimination of Harassment (GN R.206 of 2022), and the constitutional right to equality (s.9 of the Constitution).

The bank is committed to:
1. Eliminating unfair discrimination on all prohibited grounds
2. Preventing and addressing all forms of harassment, including sexual harassment
3. Creating a working environment that is safe, respectful, and dignified for all
4. Providing effective, confidential channels for reporting and investigating complaints
5. Protecting complainants from retaliation

### 1.2 Statutory authority

This policy is adopted under and gives effect to:

- **Employment Equity Act 55 of 1998 (EEA):**
  - s.5 — obligation on every employer to eliminate unfair discrimination and to promote equal opportunity
  - s.6 — prohibition of unfair discrimination on any ground, listed or analogous
  - s.11 — burden of proof: where unfair discrimination is alleged, the respondent must prove that the discrimination did not take place, or that it was fair
  - s.60 — liability of employer for harassment by employees: employer must prove that it took all reasonably practicable steps to prevent harassment

- **Code of Good Practice on Prevention and Elimination of Harassment (Government Notice R.206 of 2022, published 18 March 2022):**
  - Defines sexual harassment, racial harassment, and other forms of harassment
  - Prescribes employer obligations: policy, training, reporting channels, investigation, remediation
  - Extends to the full range of harassment including technology-facilitated and third-party harassment

- **Labour Relations Act 66 of 1995 (LRA):**
  - s.187(1)(f) — dismissal for reason of harassment is automatically unfair
  - Disciplinary and grievance procedure cross-reference (see `Policies/disciplinary-policy-v1.md`)

- **Basic Conditions of Employment Act 75 of 1997 (BCEA):**
  - Cross-reference for employment conditions context

- **Constitution of the Republic of South Africa, 1996:**
  - s.9 — right to equality; prohibition of unfair discrimination
  - s.10 — right to dignity
  - s.12 — right to freedom and security of the person

- **Protection of Personal Information Act 4 of 2013 (POPIA):**
  - Investigation records containing personal information are processed under POPIA; Iris (Information Officer, governance) holds oversight responsibility for data-processing compliance in the investigation substrate.

### 1.3 Entity scope

This policy applies to:

- All **human employees** of Hoz Bank Limited from the date of their employment.
- All **human contractors and advisors** engaged by the bank whose engagement terms subject them to the bank's workplace policies. During the build phase, this is the operative scope.
- All **third parties** (clients, suppliers, service providers) present in the bank's premises or engaged through the bank's digital channels: the bank will take reasonable steps to protect its employees from harassment by third parties per GN R.206/2022.
- **Autonomous AI agents** are not employees and are not subject to this policy as persons; however, AI-system outputs that generate or perpetuate discriminatory content are a system-quality matter addressed through Sade's (AgentOps) operational oversight.

### 1.4 Governance and roles

| Role | Holder | Authority |
|---|---|---|
| Policy owner / primary reporting channel | Sade (AgentOps, governance) | Owns this policy; receives complaints; monitors compliance; reports to Devon (Chief Operating Officer) |
| Legal oversight | Imani (Legal-as-code engineer, engineering — reports to Devon COO interim) | EEA-compliance clause library; employment contracts; legal advice on complex cases |
| Whistleblowing channel (cross-management complaints) | Owen (Company Secretary, governance) + Zara (Chief Compliance Officer, governance) | Where the complaint involves a member of senior management or Devon |
| Independent assurance | Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, Chief Audit Executive, governance) | Third-line; annual review of complaints-handling effectiveness |
| EE Plan ownership | Sade (AgentOps, governance) at licence-day | EEA s.20 Employment Equity Plan; report to Department of Employment and Labour |
| Board oversight | Board AC / HR Committee at licence-day | Receives annual EE report; approves EE Plan; approves this policy |

### 1.5 Policy hierarchy

```
Constitution s.9 (equality) + s.10 (dignity)
    └── Employment Equity Act 55 of 1998
        └── Code of Good Practice on Harassment GN R.206/2022
            └── Labour Relations Act 66 of 1995 (procedure cross-reference)
                └── Harassment and Discrimination Policy (this document)
                    └── Complaint Investigation Procedure (Procedures/by-policy/harassment-*.md)
                        └── AgentOps substrate — Sade's monitoring and tracking
```

### 1.6 Approval, review, and amendment

- **Initial approval:** CEO (Marc), 2026-05-17; Board ratification at first constituted Board meeting.
- **Annual review:** Sade-led, no later than 12 months after the preceding approval date.
- **Triggered review:** any EEA amendment, new Code of Good Practice, EE Commission guidance, or material complaint pattern triggers review within 30 agent-cadence days.
- **Amendment discipline:** all changes to this policy are typed `PolicyAmended` events per Principle 1.

---

## 2. Prohibited Conduct

### 2.1 Unfair discrimination

The bank prohibits unfair discrimination against any employee, job applicant, or person engaged with the bank on any of the following grounds:

- Race
- Gender
- Sex
- Pregnancy
- Marital status
- Family responsibility
- Ethnic or social origin
- Colour
- Sexual orientation
- Age
- Disability
- Religion
- HIV and AIDS status
- Conscience
- Belief
- Political opinion
- Culture
- Language
- Birth

The above list is drawn from EEA s.6(1). The prohibition also extends to analogous grounds not explicitly listed (EEA s.6(1) — "on any other arbitrary ground").

**Differentiation vs discrimination:** not all differentiation is unfair discrimination. Differentiation is unfair when:
- it is based on a prohibited ground (listed or analogous), AND
- it has an adverse effect on the person discriminated against, AND
- it cannot be justified as inherent requirements of the job, or as affirmative action measures under EEA Chapter III.

Where a respondent is alleged to have discriminated on a prohibited ground, the burden of proof shifts to the respondent under EEA s.11.

### 2.2 Harassment — definition and categories

Harassment is a form of unfair discrimination and a breach of the right to dignity. It constitutes unwanted conduct that impairs a person's dignity or creates a hostile work environment.

**Sexual harassment** (per GN R.206/2022 §4):

Sexual harassment is unwanted conduct of a sexual nature that has the purpose or effect of violating the dignity of a person or of creating an intimidating, hostile, degrading, humiliating, or offensive work environment. It includes:

- **Quid pro quo harassment:** submission to or rejection of sexual conduct is used as the basis for employment decisions (hiring, promotion, performance assessment, access to opportunities, or continued employment)
- **Hostile work environment harassment:** a pattern or series of unwanted sexual conduct that creates a hostile, intimidating, degrading, or offensive environment, even without a direct employment consequence. A single severe incident may also constitute sexual harassment.

Forms of sexual harassment include (not exhaustive):
- Unwanted sexual advances, requests for sexual favours, sexual comments, jokes, or insinuations
- Unwanted physical contact of a sexual nature
- Display or distribution of sexually explicit material in the workplace or through work-related channels
- Technology-facilitated conduct (messages, emails, social media) of a sexual nature directed at a colleague

**Racial harassment (per GN R.206/2022 §5):**

Conduct based on race, colour, or ethnic origin that creates an intimidating, hostile, or offensive work environment. Includes racial slurs, derogatory racially-inflected comments, and racially-motivated exclusionary behaviour.

**Other forms of harassment (per GN R.206/2022 §6):**

Any unwanted conduct based on any of the prohibited grounds listed in §2.1 that has the purpose or effect of:
- Impairing the person's dignity
- Creating an intimidating, hostile, degrading, humiliating, or offensive environment
- Disadvantaging the person in their employment

**Third-party harassment:**

The bank acknowledges that harassment may be perpetrated by clients, suppliers, or other third parties. The bank will take all reasonably practicable steps to protect its employees from third-party harassment, including:
- Warning the third party that the conduct is unwelcome and must stop
- Removing the employee from the situation or removing the third party's access to the employee
- Terminating the business relationship where the conduct is serious and persistent

**Technology-facilitated harassment:**

Harassment conducted through digital communication platforms (email, messaging systems, video conferencing, social media) is subject to this policy in the same manner as in-person conduct. The bank's communication systems may be monitored for harassment under POPIA-compliant protocols.

### 2.3 Conduct that does not constitute harassment

Not every uncomfortable interaction is harassment. Legitimate management actions — including performance management, setting standards, assigning work, issuing instructions, and conducting disciplinary processes — do not constitute harassment even if the employee finds them unpleasant, provided they are carried out lawfully and without malice.

---

## 3. Reporting Channels and Investigation Procedure

### 3.1 Reporting channels

All complaints of harassment or unfair discrimination may be reported through the following channels:

| Channel | Appropriate for | Contact |
|---|---|---|
| Direct report to Sade (AgentOps, governance) | All complaints | Sade is the primary receiving authority |
| Whistleblowing channel (Owen, Company Secretary / Zara, CCO) | Complaints involving Devon (COO) or other senior management figures | Owen + Zara as dual-channel; Owen holds the formal disclosure channel |
| Anonymous report | Where the complainant fears retaliation | Whistleblowing hotline (details in `Policies/anti-bribery-corruption-whistleblowing-policy-v1.md`) |
| External CCMA referral | If the internal process fails or is unavailable | CCMA (LRA s.135 + EEA s.10) |

**No gatekeeping:** any complainant may choose the channel they are most comfortable with. Sade will not discourage or redirect a complainant from their chosen channel.

### 3.2 Confidentiality

All complaints are handled with strict confidentiality. Disclosure is limited to:
- Those who have a direct role in the investigation
- Persons whose involvement is necessary to remedy the situation

Breach of confidentiality by any person involved in an investigation is itself a disciplinary matter (and may additionally constitute an automatically unfair labour practice under the LRA where it amounts to victimisation).

**POPIA:** investigation records containing personal information are processed as special personal information (POPIA category — special categories including race and gender) and are subject to Iris's (Information Officer, governance) oversight. Investigation records are stored in the document substrate under the applicable POPIA-compliant retention and access controls.

### 3.3 Protection against retaliation

Any person who makes a complaint in good faith, gives evidence, or participates in an investigation is protected from any adverse employment action or hostile treatment as a result of that participation. Retaliation against a complainant, witness, or participant is:
- A separate disciplinary offence (potentially gross misconduct per `Policies/disciplinary-policy-v1.md`)
- Potentially an automatically unfair labour practice under LRA s.187(1)(f) read with EEA s.60

Sade monitors for retaliation patterns in the 6 months following each complaint by comparing the complainant's employment record (performance reviews, disciplinary actions, assignments) to the baseline prior to the complaint.

### 3.4 Investigation procedure

**Step 1 — Receipt and triage (Sade)**

Within 2 business days of receiving a complaint, Sade:
1. Confirms receipt in writing to the complainant
2. Assesses the complaint for prima facie validity (does the conduct, if proved, constitute harassment or unfair discrimination?)
3. Emits a `HarassmentComplaintReceived` event
4. Determines whether the respondent should be separated from the complainant pending investigation (precautionary suspension, transfer, or other measure — applied without prejudice and without implying guilt)

**Step 2 — Investigation appointment**

Sade appoints an independent investigator who:
- Is not in the respondent's direct management chain
- Has no material conflict of interest
- Has relevant competence (the bank will use external investigators for complex cases at licence-day)

The complainant and respondent are both informed of the investigation appointment and the investigator's identity. Either party may object to the investigator on grounds of conflict of interest; Sade determines the objection.

**Step 3 — Investigation**

The investigator:
1. Interviews the complainant, taking a full statement
2. Gives the respondent the details of the complaint and an opportunity to respond
3. Interviews witnesses identified by either party
4. Reviews documentary and digital evidence (subject to POPIA protocols)
5. Prepares a written investigation report with findings of fact and a recommendation

All evidence is stored in the document substrate. The investigation is concluded within 30 business days where possible; extensions require Sade's written approval and notification to both parties.

**Step 4 — Outcome and remedy**

Sade reviews the investigation report and decides:
- **Substantiated:** the conduct occurred and constitutes harassment or unfair discrimination → proceed to disciplinary action per `Policies/disciplinary-policy-v1.md`; AND implement remedial measures (see §3.5)
- **Not substantiated:** the conduct did not occur, or does not constitute harassment or unfair discrimination → close the complaint with reasons; no adverse finding against the complainant unless the complaint was demonstrably made in bad faith
- **Insufficient evidence:** the complaint cannot be resolved on the available evidence → close without a finding; document the outcome

Both parties receive written reasons for the outcome. Sade emits a `HarassmentComplaintDecided` event.

**Step 5 — Appeal**

Either party may appeal the outcome to Devon (Chief Operating Officer), following the grievance-appeal procedure in `Policies/disciplinary-policy-v1.md` §4. Devon's decision is final internally; the complainant retains the right to refer to the CCMA or EE Commission.

### 3.5 Remedial measures

Where a complaint is substantiated, remedial measures may include (depending on severity):

| Severity | Remedial measures |
|---|---|
| Minor (single occurrence, low severity) | Formal written warning; awareness training; apology; monitoring period |
| Serious (pattern or moderate severity) | Final written warning; mandatory training; transfer (respondent, not complainant, is moved); suspension without pay |
| Gross (severe harassment; physical contact; quid pro quo) | Dismissal; referral to SAPS if criminal conduct is alleged |

The complainant's safety and comfort in the workplace is the primary consideration in determining remedial measures. The bank will not transfer a complainant without the complainant's consent except where no other option exists to ensure their safety.

---

## 4. Affirmative Action

### 4.1 EEA Chapter III obligations

The bank is a designated employer under EEA s.1 and is required to:
- Conduct a workforce analysis (EEA s.19)
- Prepare and implement an Employment Equity Plan (EEA s.20)
- Report annually to the Department of Employment and Labour (EEA s.21)

### 4.2 Build-phase status

During the build phase, the bank has no human employees and therefore no workforce. At licence-day:
- The bank will prepare its first EEA workforce analysis within 3 months of the first human-employee appointment
- Sade (AgentOps, governance) will prepare the first Employment Equity Plan within 6 months of the first human-employee appointment
- The plan will target equitable representation of designated groups (Black people, women, and people with disabilities) at all levels of the thin human layer, consistent with the reality of a 5–10 person statutory-minimum workforce
- Annual EEA reports will be filed to the Department of Employment and Labour as required

### 4.3 Non-discrimination in the build phase

Even in the absence of human employees, the bank's selection of human contractors, advisors, and at-licence-day employees is conducted without unfair discrimination on any of the prohibited grounds listed in §2.1.

---

## 5. Controls and Monitoring

### 5.1 Sade's monitoring role

Sade maintains a **harassment and discrimination complaints register** as an event-projected artefact:

| Field | Description |
|---|---|
| Complaint ID | From `HarassmentComplaintReceived` event |
| Date received | Date of event |
| Nature of complaint | Sexual harassment / racial harassment / discrimination / other |
| Status | Received / Investigation / Outcome / Appeal / Closed |
| SLA due | Investigation report due; outcome due |
| Outcome | Substantiated / Not substantiated / Insufficient evidence |
| Sanction | Where substantiated |

The register is derived from the event store.

### 5.2 SLA compliance monitoring

Sade runs `recon:harassment-sla-compliance` at every agent-cadence tick:
- Every `HarassmentComplaintReceived` event has a `HarassmentComplaintDecided` event within 30 business days (or extended with documented reason)
- Every substantiated complaint has a corresponding disciplinary event initiated within 5 business days of the outcome

### 5.3 Training and awareness

The bank provides harassment and discrimination awareness as part of its onboarding programme for all human employees and contractors. Training records are stored in the document substrate.

At licence-day, Sade ensures that all human employees receive:
- Training on this policy and the reporting channels
- An explanation of the bank's zero-tolerance stance on harassment and unfair discrimination
- A copy of (or digital access to) this policy

Training completion is tracked by Sade via `HarassmentTrainingCompleted` events.

### 5.4 Annual review of complaints handling

Vera (Internal audit / continuous-assurance engineer) conducts an annual review of:
- Total complaints received; disposition breakdown
- Time-to-conclusion metrics
- Consistency of outcomes across similar complaints
- Evidence of retaliation patterns
- Adequacy of remedial measures implemented

Vera's findings are reported to Thandiwe (Chief Audit Executive, governance) and to the Board AC.

---

## 6. Escalation

| Event | Escalation path | Timeline |
|---|---|---|
| Allegation of sexual harassment | Sade notified immediately; investigator appointed within 2 business days; parties separated if required | Within 2 business days |
| Allegation involving Devon (COO) or senior management | Escalated to Owen (Company Secretary) + Zara (CCO); Board AC notified | Same day |
| Potential criminal conduct (assault; criminal sexual offence) | Sade notifies Devon and Imani; SAPS referral is the complainant's right; bank cooperates with SAPS investigation | Same day |
| Retaliation detected | Sade opens a separate disciplinary investigation; `DisciplinaryInvestigationOpened` emitted | On detection |
| Pattern of complaints against a single respondent | Devon + Vera advisory notified; aggregate review | At monthly Sade cycle |
| External CCMA or EE Commission referral | Imani notified; matter tracked in `CcmaReferralReceived` or `EeCommissionReferralReceived` event | Within 2 business days |
| EEA annual report deadline approaching | Sade drafts report; Devon reviews; filed to Department of Employment and Labour | Per statutory deadline |

---

## 7. Related Documents

- [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md) — rows ORG-HR-04, ORG-HR-06
- [`Policies/disciplinary-policy-v1.md`](disciplinary-policy-v1.md) — companion HR policy (LRA disciplinary procedure)
- [`Policies/anti-bribery-corruption-whistleblowing-policy-v1.md`](anti-bribery-corruption-whistleblowing-policy-v1.md) — whistleblowing channel
- [`Policies/popia-privacy-policy-v1.md`](popia-privacy-policy-v1.md) — personal information processing in investigations
- [`Policies/governance-framework-v1.md`](governance-framework-v1.md) — board governance structure
- `D-POLICY-DOCUMENT-HOME` — canonical policy home decision
- Employment Equity Act 55 of 1998 — in `Regulations/EEA/`
- Code of Good Practice on Prevention and Elimination of Harassment GN R.206/2022
- CLAUDE.md "Operating procedures" (events-first authoring; Principle 6 — autonomous by default)

---

## 8. Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v1 | 2026-05-17 | Sade (AgentOps, governance) | Initial version. Harassment and discrimination policy covering prohibited conduct (§2): unfair discrimination on 19 grounds, sexual harassment (quid pro quo + hostile environment), racial harassment, other harassment, third-party and technology-facilitated harassment; reporting channels (§3); EEA affirmative-action obligations (§4); AgentOps monitoring (§5); escalation (§6). Closes ORG-HR-04 + ORG-HR-06. BUILD-PHASE ready; applies to contractors now; activates fully at licence-day. |

---

*Sade (AgentOps, governance)*
