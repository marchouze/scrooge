---
policy-id: whistleblowing-policy
title: Whistleblowing Policy v1
version: "1"
status: IN FORCE
owner: Owen (Company Secretary, governance) + Zara (Chief Compliance Officer, governance)
effective-from: "2026-05-17"
next-review: "2027-05-17"
citations:
  - Protected Disclosures Act 26 of 2000
  - Prevention and Combating of Corrupt Activities Act 12 of 2004 s.34
  - D-POLICY-DOCUMENT-HOME
author: Owen (Company Secretary, governance)
date: 2026-05-17
summary: Whistleblowing Policy establishing Hoz Bank Limited's protected disclosure channels, statutory protections, duty-to-report obligations under PRECCA s.34, and anti-retaliation framework. Closes obligations ORG-FC-20 (PRECCA 12/2004) and ORG-GV-13 (PDA 26/2000). Binds immediately under Companies Act and PRECCA — not LICENCE-BIND.
decision-required: false
riskTaxonomy:
  - RT-FC.BC
  - RT-ST.GV
---

# Whistleblowing Policy v1

> **Status:** IN FORCE (policy layer). This policy binds from the date of adoption — obligations under PRECCA and the PDA attach to the institution from incorporation, not from commencement of trading.
>
> **Authors:** Owen (Company Secretary, governance) leads as custodian; Zara (Chief Compliance Officer, governance) co-authors the compliance-related disclosure pathways and anti-corruption overlay.
>
> **Scope note:** This policy applies to all agents (autonomous AI agents and, at licence-day, the minimum-required human layer) operating under or for Hoz Bank Limited and Hoz Group Limited. The PDA and PRECCA obligations attach to the institution; in the build phase, the agent substrate carries the operational weight; the human layer inherits the same obligations on appointment.

---

## 0. Policy overview

| Attribute | Value |
|---|---|
| Policy name | Whistleblowing Policy |
| Version | v1 |
| Effective date | 2026-05-17 |
| Approval authority | Board (via Owen as interim AC Chair / IAF Chair) |
| Policy owner | Owen (Company Secretary, governance) + Zara (Chief Compliance Officer, governance) |
| Engineering owner | Mira (Compliance / RegTech engineer, engineering — reports to Zara) |
| Review cadence | Annual; triggered by legislative amendment, material disclosure event, or PA/FSCA supervisory direction |
| Risk appetite anchor | RAS B1 — zero appetite for corruption or suppression of legitimate disclosures |
| LICENCE-BIND | No — obligations bind immediately under PRECCA 12/2004 and Companies Act 71/2008 from incorporation |
| Obligations closed | [`ORG-FC-20`](../Regulations/_obligations-register.md) (PRECCA 12/2004 — prevent/combat bribery/corruption; duty to report), [`ORG-GV-13`](../Regulations/_obligations-register.md) (PDA 26/2000 — whistleblowing channel with statutory protections) |

---

## 1. Governance and Authority

### 1.1 Purpose

This policy establishes Hoz Bank Limited's whistleblowing framework — the channels through which any person may report, in good faith, a reasonable belief that an impropriety, corrupt activity, or other protected disclosure matter has occurred, is occurring, or is likely to occur within or affecting the bank.

The bank is committed to an environment in which disclosures are encouraged, protected, and acted upon. Suppression of legitimate disclosures, retaliation against disclosers, or wilful disregard of corruption knowledge is a direct violation of South African law and of the bank's zero-tolerance posture on financial crime (RAS B1).

### 1.2 Statutory authority

This policy is adopted under and gives effect to:

- **Protected Disclosures Act 26 of 2000 (PDA)**, as amended by the Protected Disclosures Amendment Act 5 of 2017:
  - s.1 — definitions of "protected disclosure", "disclosure", "impropriety", "employee"
  - s.3 — any disclosure made in good faith to an employer in accordance with the PDA is a protected disclosure
  - s.4 — protected disclosures to a legal adviser (professional privilege preserved)
  - s.5 — protected disclosures to a public body (including SARB Prudential Authority, FSCA, NPA, FIC, Public Protector)
  - s.6 — protected disclosures to a member of Cabinet, Premier, or Executive Member of a provincial legislature
  - s.7 — general protected disclosures (wider public disclosure under specified conditions)
  - s.9 — prohibition of occupational detriment in consequence of a protected disclosure
  - s.10 — remedies for occupational detriment
  - s.11 — no impediment to a protected disclosure despite any confidentiality agreement or employment contract

- **Prevention and Combating of Corrupt Activities Act 12 of 2004 (PRECCA)**:
  - s.34 — any person who holds a position of authority and who knows, or ought reasonably to have known, of any corrupt activity must report such knowledge to a police official as soon as possible; failure to report is an offence punishable by a fine or imprisonment not exceeding 10 years
  - ss.3–16 — offences of corruption (general, specific parties, agents, members of public institutions)
  - s.17 — corrupt activities relating to contracts
  - s.18 — corrupt activities relating to sporting events
  - s.21 — attempt, conspiracy, and inducement relating to corrupt activities

- **Companies Act 71 of 2008**: the bank's governance framework, in particular the directors' duty of care and the Audit Committee's oversight mandate (s.94), underpins the internal escalation pathway for disclosures relating to financial reporting and audit.

- **Financial Sector Regulation Act 9 of 2017 (FSR Act)** s.157 — the SARB / PA have whistleblowing-adjacent reporting obligations; the FSCA has equivalent powers.

- **Banks Act 94 of 1990 Regulation 39** — internal controls and governance requirements anchor the internal-audit arm of the escalation pathway.

### 1.3 Entity scope

This policy applies to:

- **Hoz Bank Limited** — primary scope; banking entity.
- **Hoz Group Limited** — group holding entity; group-wide application.
- **Hoz Securities Limited** — on and from FAIS-FSP authorisation.
- All **autonomous agents** operating under these entities — each agent's operating spec incorporates this policy by reference.
- All **human officers** appointed at licence-day and thereafter (statutory-minimum human layer per `D-THIN-HUMAN-LAYER-MINIMUM`).

### 1.4 Governance roles

| Role | Holder | Responsibility |
|---|---|---|
| Custodian / Receiving Officer (general disclosures) | Owen (Company Secretary, governance) | Receives, logs, and investigates internal disclosures; reports to Interim Audit Forum (IAF) / Board AC when constituted |
| Receiving Officer (compliance-related disclosures) | Zara (Chief Compliance Officer, governance) | Receives compliance, AML/CFT, and sanctions-related disclosures; escalates to MLRO pathway where applicable |
| Board AC / IAF oversight | Owen (Company Secretary, governance) as IAF Chair; Board AC (once NEDs appointed) | Oversight of the whistleblowing programme; annual report |
| Independent assurance | Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, Chief Audit Executive, governance) | Annual effectiveness review of the whistleblowing programme; testing of disclosure receipt, investigation, and non-retaliation controls |
| Engineering support | Mira (Compliance / RegTech engineer, engineering — reports to Zara) | Substrate tooling for disclosure receipt, logging, and case management |

### 1.5 Policy hierarchy

```
PRECCA 12/2004 s.34 + Protected Disclosures Act 26/2000
    └── Whistleblowing Policy (this document — substantive governance)
        └── Disclosure receipt procedure (Procedures/by-policy/whistleblowing-*.md)
            └── Investigation substrate (Mira + Owen)
```

Every node cites upward per Principle 2 (single-graph discipline).

### 1.6 Approval, review, and amendment

- **Initial approval:** Owen (Company Secretary, governance) as IAF Chair / interim Board AC oversight, 2026-05-17.
- **Annual review:** Owen-led, no later than 12 months after the preceding approval date; Zara co-reviews.
- **Triggered review:** PDA or PRECCA amendment; material disclosure event; PA/FSCA supervisory direction; significant organisational change.
- **Amendment discipline:** all changes to this policy are typed `PolicyAmended` events per Principle 1.

---

## 2. Protected Disclosures — Channels and Scope

### 2.1 What may be disclosed

A **protected disclosure** under this policy covers any good-faith disclosure of information that reasonably tends to show one or more of the following improprieties:

1. **Corrupt activities** — any bribery, corruption, or abuse of position or resources within the scope of PRECCA ss.3–21.
2. **Criminal offence** — a criminal offence has been, is being, or is likely to be committed.
3. **Financial mismanagement** — a failure to comply with a legal obligation; mismanagement of funds; gross waste of public or institutional resources.
4. **Failure of justice** — a miscarriage of justice has occurred, is occurring, or is likely to occur.
5. **Health, safety, or environmental risk** — an action or omission endangers the health or safety of an individual or damages the environment.
6. **Regulatory breach** — a breach of any applicable banking, financial services, AML/CFT, securities, or other regulatory obligation.
7. **Cover-up** — deliberate concealment of any of the above.

**What this policy does not cover:**

- Personal grievances (unfair dismissal, workplace disputes, salary issues) that do not relate to impropriety — these are routed to the appropriate HR process (Sade, AgentOps and HR, governance, at licence-day).
- Anonymous market intelligence or competitive intelligence — route to the appropriate business function.

### 2.2 Disclosure channels

The following channels are available to any person with knowledge of an impropriety:

| Channel | Contact | When to use |
|---|---|---|
| **Anonymous written disclosure** | Submitted via the bank's encrypted disclosure portal (substrate placeholder; Mira builds W4 Slice) or sealed envelope to Owen (Company Secretary) | Preferred for anonymous disclosures; identity not required |
| **Direct disclosure to Owen (Company Secretary, governance)** | Owen's secure in-session or out-of-band channel | General impropriety; governance breaches; financial mismanagement |
| **Direct disclosure to Zara (CCO, governance)** | Zara's secure channel | Compliance, AML/CFT, sanctions, or regulatory-breach disclosures |
| **Direct disclosure to Board Chair** | Once a Board Chair (independent NED) is appointed — direct channel to that individual | Disclosures implicating senior management including the Company Secretary or CCO |
| **Disclosure to a public body** | SARB PA, FSCA, NPA, FIC, Public Protector, SAPS (PRECCA s.34) | Where internal channels have been exhausted or are themselves implicated; or where PRECCA s.34 duty requires direct reporting to SAPS |

**PRECCA s.34 direct report to SAPS.** Where a person holds a position of authority and has actual knowledge of corrupt activity, PRECCA s.34 requires that person to report directly to a police official as soon as possible. The bank's internal whistleblowing channel is the first point of receipt for PRECCA-covered knowledge, but it does not substitute for or delay the statutory duty to report to SAPS where that duty applies. Owen (Company Secretary) co-ordinates with Imani (Legal-as-code engineer, engineering — reports to Zara) on the mechanics of any SAPS referral.

### 2.3 Anonymous disclosures

The bank accepts and investigates anonymous disclosures to the fullest extent possible given the information provided. An anonymous discloser will not be required to identify themselves as a condition of the disclosure being received.

Where the investigation of an anonymous disclosure would necessarily reveal the identity of the discloser, Owen (Company Secretary) determines whether:
- The investigation can be conducted in a manner that protects the identity; or
- The discloser should be invited (not required) to provide consent for identification in order to progress the investigation.

No anonymous disclosure is dismissed solely on grounds of anonymity.

### 2.4 Disclosures implicating Owen or Zara

Where a disclosure implicates the Company Secretary (Owen) or the CCO (Zara), the discloser should route directly to:
1. The Board Chair (once appointed); or
2. The Interim Audit Forum (IAF) — chaired by Owen; in case of Owen being implicated, Thandiwe (Chief Audit Executive, governance) chairs the IAF for that specific disclosure; or
3. An independent NED (at licence-day and thereafter).

---

## 3. Protections — PDA and Anti-Retaliation

### 3.1 Statutory protections (PDA)

Every disclosure made in good faith through any of the channels in §2.2 constitutes a **protected disclosure** under the PDA. The following protections apply automatically by force of law:

- **No occupational detriment** (PDA s.9): no discloser may suffer dismissal, suspension, demotion, harassment, intimidation, threat, discrimination, or any other form of disadvantage as a consequence of making a protected disclosure.
- **No contract restriction** (PDA s.11): no confidentiality agreement, non-disclosure agreement, or employment contract may operate to prevent a protected disclosure or to penalise a discloser for making one.
- **Professional privilege preserved** (PDA s.4): disclosures to a legal adviser are protected and do not waive privilege.
- **Remedy for detriment** (PDA s.10): a discloser who suffers occupational detriment in contravention of s.9 may approach the relevant forum (CCMA, Labour Court, or other appropriate tribunal) for relief.

### 3.2 Bank anti-retaliation rule

**Retaliation against a discloser is absolutely prohibited.** This prohibition covers:

- All autonomous agents (operational retaliation through system access, weighting, or task assignment)
- All human officers at licence-day and thereafter
- Any third party acting on the bank's behalf

Any form of retaliation — including informal chilling measures that fall short of the statutory detriment threshold — is a breach of this policy and of PRECCA's underlying anti-corruption mandate.

**Investigation of retaliation:** Owen (Company Secretary) investigates all allegations of retaliation against a discloser. Where retaliation is confirmed:
- The retaliating party (agent or human) is subject to immediate disciplinary action.
- The incident is reported to the IAF / Board AC as a material compliance failure.
- Vera (Internal audit / continuous-assurance engineer) is notified immediately and the incident is logged as an internal-audit finding.

### 3.3 Identity protection

The bank will not disclose the identity of a discloser to any third party (including regulatory authorities) without the discloser's explicit consent, unless:
- Required by a court order or regulatory direction; or
- Disclosure is necessary to prevent serious harm and the benefit clearly outweighs the risk to the discloser.

Where identity disclosure is compelled, Owen (Company Secretary) notifies the discloser in advance where practicable.

### 3.4 Good faith requirement

PDA protections apply to disclosures made in good faith. A disclosure is made in good faith if the discloser had a genuine and honest belief in the truth of the information, even if that belief subsequently proves to be incorrect. Malicious, vexatious, or knowingly false disclosures are not protected and may be subject to appropriate action.

The bank does not penalise a discloser for an honest mistake. A discloser who was mistaken but acted in good faith retains full PDA protection.

---

## 4. Controls and Monitoring

### 4.1 Disclosure receipt and logging

Every disclosure received — via any channel — is logged in the bank's disclosure register (document-substrate artefact; BLAKE3 content-addressed). Each log entry records:

- Date and time of receipt
- Channel used
- Nature of the impropriety alleged (category per §2.1)
- Whether the discloser identified themselves or disclosed anonymously
- Assigned investigating officer (Owen or Zara, depending on subject matter)

The disclosure register is maintained by Owen (Company Secretary) and reviewed by Vera (Internal audit / continuous-assurance engineer) annually.

### 4.2 Investigation

On receipt of a disclosure, Owen (Company Secretary) or Zara (CCO) (depending on subject matter) conducts a preliminary assessment within 5 business days to determine:

- Whether the disclosure falls within the scope of §2.1 (impropriety)
- Whether the disclosure warrants a full investigation or referral to another body
- Whether immediate interim measures are required to prevent harm or evidence destruction

A full investigation is conducted for every disclosure that meets the §2.1 scope. The investigation:
- Is conducted proportionate to the seriousness of the alleged impropriety
- Documents the steps taken, evidence reviewed, and conclusions reached
- Produces a typed `WhistleblowingInvestigationDecided` event in the event store

### 4.3 Outcomes

| Outcome | Action |
|---|---|
| **Impropriety substantiated** | Report to IAF / Board AC; refer to relevant enforcement body (SAPS under PRECCA s.34 if corrupt activities; FIC if financial crime; PA/FSCA if regulatory breach); disciplinary action where appropriate |
| **Impropriety not substantiated** | Close investigation with documented reasoning; no adverse record against discloser; discloser notified of outcome (where identity known) |
| **Referral required** | Refer to appropriate internal or external body; document referral event |
| **Retaliation confirmed** | Immediate escalation per §3.2 |

### 4.4 Reporting to the IAF / Board AC

Owen (Company Secretary) reports to the Interim Audit Forum (IAF) — and to the Board Audit Committee once constituted — on a quarterly basis:

- Number of disclosures received; breakdown by category
- Number of investigations open and closed
- Outcomes of closed investigations
- Any PRECCA s.34 referrals to SAPS
- Any retaliation incidents
- Any regulatory referrals (PA, FSCA, FIC)
- Programme effectiveness assessment

The annual summary forms part of the IAF / Board AC annual report to the Board.

### 4.5 Independent assurance

Vera (Internal audit / continuous-assurance engineer) conducts an **annual effectiveness review** of the whistleblowing programme, examining:

- Disclosure channel accessibility and awareness
- Adequacy of response timeliness
- Non-retaliation control effectiveness
- Investigation quality and documentation
- Accuracy and completeness of the disclosure register

Vera's findings are reported to Thandiwe (Chief Audit Executive, governance) and the IAF / Board AC.

---

## 5. Escalation

### 5.1 Internal escalation pathway

```
Discloser → Owen (CoSec) or Zara (CCO)
    → Preliminary assessment (5 business days)
        → Full investigation (proportionate)
            → IAF / Board AC report (quarterly)
                → Board (material matters)
```

Where a disclosure relates to potential criminal conduct (PRECCA s.34), Owen (Company Secretary) co-ordinates the SAPS referral in parallel with the internal investigation — internal investigation does not suspend the statutory duty to report.

### 5.2 External escalation

Where internal channels are unavailable, have been exhausted, or are implicated in the impropriety:

- **SARB Prudential Authority** — regulatory breaches; safety and soundness concerns
- **FSCA** — financial services conduct and market-conduct breaches
- **Financial Intelligence Centre (FIC)** — AML/CFT and financial crime matters
- **National Prosecuting Authority (NPA)** — criminal offences
- **South African Police Service (SAPS)** — PRECCA s.34 corrupt activities (mandatory where the duty applies)
- **Public Protector** — matters involving public institutions or government
- **Specialised Commercial Crimes Unit (SCCU)** — complex commercial crimes

### 5.3 Emergency escalation

Where a disclosure indicates an immediate and serious risk to the bank, its clients, or the financial system, Owen (Company Secretary) may escalate directly to the CEO (Marc) and the Board Chair (once appointed) without waiting for the conclusion of a preliminary assessment.

---

## 6. Related Documents

- Protected Disclosures Act 26 of 2000 (as amended by Act 5 of 2017) — full text in `Regulations/`
- Prevention and Combating of Corrupt Activities Act 12 of 2004 — full text in `Regulations/`
- Anti-Bribery and Corruption Policy (IN FORCE per [`ORG-FC-20`](../Regulations/_obligations-register.md))
- AML/CFT Policy [`Policies/aml-cft-policy-v1.md`](aml-cft-policy-v1.md) — financial crime escalation pathway
- Governance Framework — Audit Committee [`Policies/governance-framework-ac-v1.md`](governance-framework-ac-v1.md) — IAF / Board AC oversight
- [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md) — rows ORG-FC-20, ORG-GV-13
- Procedures/by-policy/whistleblowing-*.md — agent-executable disclosure receipt and investigation steps
- `Team/_team-roster.json` — canonical role assignments
- `D-POLICY-DOCUMENT-HOME` — policy filing home decision
- `D-RMS-PHASE-1` — event-type registration; document substrate; retention
- `CLAUDE.md` §"Operating procedures" — events-first authoring; dispatch discipline; Principles 1, 2, 4, 6

---

## Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v1 | 2026-05-17 | Owen (Company Secretary, governance) | Initial version. Establishes the bank's whistleblowing framework under PDA 26/2000 and PRECCA 12/2004 s.34. Covers disclosure scope (§2), channels including anonymous hotline and direct routes to Owen/Zara/Board Chair (§2.2), PDA statutory protections and anti-retaliation rule (§3), investigation and IAF reporting controls (§4), and escalation pathway (§5). Closes ORG-FC-20 and ORG-GV-13. Not LICENCE-BIND. |

---

*Owen (Company Secretary, governance) + Zara (Chief Compliance Officer, governance)*
