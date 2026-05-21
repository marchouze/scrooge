---
policy-id: COI-POL-01
title: Conflicts of Interest Policy v1
version: "1.0"
status: DRAFT
owner: Zara (Chief Compliance Officer, governance)
effective-from: 2026-05-13
next-review: "2026-11-13"
citations:
  - "FAIS Act 37/2002: General Code of Conduct r.3A (conflict of interest management)"
  - "FSR Act 9/2017: s57 (conduct standards)"
  - "EMIR/MiFID II: Equivalence standard for OTC conflict of interest management"
  - "King IV: Principle 8 (ethical culture)"
  - "Companies Act 71/2008: s75 (directors' duty to disclose personal financial interest)"
author: Zara (Chief Compliance Officer, governance)
date: 2026-05-13
summary: Establishes the bank's conflicts of interest management framework — identification, disclosure, management and mitigation of conflicts across trading, advisory, and governance activities — in compliance with FAIS General Code r.3A.
decision-required: false
riskTaxonomy:
  - "COND-001"
  - "GOV-001"
  - "GOV-002"
---

> **Policy** | COI-POL-01 v1.0 | Owner: Zara (Chief Compliance Officer, governance) | Status: DRAFT | Effective: 2026-05-13

> **Obligations closed.** `ORG-CD-05` (conflict of interest management framework), `ORG-CS3-007` (FAIS General Code r.3A — COI policy and register), `ORG-WB-04` (COI disclosure channel for protected reporters).
> **Applies-at.** LICENCE-BIND. All obligations under this policy activate upon FSCA FSP authorisation. Build-phase work is preparation for compliance, not compliance itself.
> **Standing authority.** Authored under the events-first authoring rule and the no-pause dispatch rule — CLAUDE.md "Operating procedures".
> **Identity discipline.** Every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## Purpose

This policy establishes the Conflicts of Interest (COI) management framework for Hoz Bank Limited (the "Bank"). It governs how actual, potential, and perceived conflicts of interest are identified, disclosed, managed, and mitigated across the Bank's trading, advisory, and governance activities.

The policy implements the requirements of the FAIS General Code of Conduct r.3A, which mandates that authorised financial services providers maintain written conflicts of interest management policies and disclose material conflicts to clients before providing financial services. It also implements the conduct standards issued under the Financial Sector Regulation Act 9/2017 s57 and reflects the industry-standard conflict management frameworks applied in OTC derivatives markets under MiFID II equivalence principles. At the governance layer it gives effect to King IV Principle 8 (ethical culture) and Companies Act s75 (director disclosure of personal financial interest).

This policy sits at the *policy* layer of the Reg → Policy → Procedure → System Capability chain (Principle 2). The regulatory obligations (FAIS GCC r.3A; FSR Act s57) sit above; procedures under this policy operationalise day-to-day conflict identification, declaration, and management; system capabilities (the COI register, the pre-clearance workflow, the disclosure engine) execute those procedures.

---

## Principles

1. **Conflicts are managed, not suppressed.** The existence of a conflict does not automatically prohibit activity; effective management and disclosure is the standard.
2. **Disclosure is mandatory.** Where a conflict material to client advice or services cannot be fully mitigated, it must be disclosed in writing to the client before the service is provided.
3. **Independence of compliance and control functions.** Compliance, credit, and risk functions operate behind information barriers from revenue-generating trading desks.
4. **Zero tolerance for undisclosed conflicts in advice.** Any conflict material to client advice that is not disclosed is a conduct breach.
5. **Governance integrity.** Board-level conflicts are resolved by recusal, not management; the company secretary is notified in every instance.

---

## 1. Scope

This policy applies to:

- All agents (autonomous AI agents) acting for or on behalf of the Bank.
- All human principals (directors, officers, key individuals, and any statutory employees appointed at licence-day).
- All third parties acting in a representative capacity for the Bank (where the agency relationship creates the potential for imputed conflicts).
- All business lines — proprietary trading, market-making, advisory services, treasury, and any support function that interfaces with client or counterparty relationships.

The policy applies at licence-day (LICENCE-BIND). In the build phase, the substrate (COI register, pre-clearance workflow, disclosure templates) is under construction; the principles are operative as a matter of design intent from the date of this policy.

---

## 2. Governance

| Role | Responsibility |
|---|---|
| Zara (Chief Compliance Officer, governance) | Policy owner; COI register custodian; quarterly review; material COI escalation point; FAIS disclosure sign-off |
| Owen (Company Secretary, governance) | Board-level COI notifications; Companies Act s75 compliance; board resolution integrity |
| Helena (Chief Risk Officer, governance) | Risk taxonomy classification of material conflicts; linkage to risk appetite |
| Vera (Internal audit engineer, governance) | Annual independent audit of COI framework; recon pipeline assertion |
| Trading desk heads (agents) | Desk-level COI identification; personal account dealing pre-clearance requests |
| All agents and human principals | Annual COI declaration; prompt notification of new conflicts (within 5 business days) |

**Approval authority.** This policy is approved by the CEO (interim board authority per thin-human-layer decisions). Material amendments require CEO re-approval.

**Review cadence.** Annual review by Zara; triggered additionally on: regulatory change affecting GCC r.3A; new product approval that introduces a new conflict category; material incident.

---

## 3. Standards and Limits

### 3.1 Definition of Conflicts of Interest

A conflict of interest arises where:

- **Actual conflict** — the Bank, an agent, or a human principal has a financial interest, relationship, or obligation that directly conflicts with the interest of a client or counterparty in a specific transaction or advisory engagement.
- **Potential conflict** — circumstances exist that could, in a reasonably foreseeable scenario, give rise to an actual conflict.
- **Perceived conflict** — a reasonable, informed third party would conclude that a conflict exists, even if the Bank does not consider it material.

All three categories are treated as conflicts for the purpose of this policy. The distinction affects the disclosure and management approach, not the threshold for identification.

### 3.2 Standing COI Register — Categories

The COI register records all standing conflict categories and named instances. The minimum standing entries are:

| # | Category | Parties | Management approach |
|---|---|---|---|
| 1 | Proprietary trading vs client flow | Prop desk vs institutional clients | Chinese wall; execution-only segregation |
| 2 | Market-maker vs advisor | Market-making desk vs advisory function | Structural separation; written disclosure where both roles active |
| 3 | Board-level related-party dealings | Directors vs Bank in transactions | Companies Act s75 declaration + recusal |
| 4 | Staff personal account dealing | Any agent or human principal vs the Bank's own book or client orders | PA dealing policy; pre-clearance; restricted list |
| 5 | Gifts, hospitality received | Any agent or human principal vs counterparty relationships | Gifts register; threshold limits |
| 6 | External directorships or roles | Human principals vs Bank governance independence | Annual declaration; CEO approval required |

The COI register is maintained by Zara. Additional entries are added within 5 business days of identification by the notifying party.

### 3.3 Annual COI Declaration

All agents (autonomous AI agents exercising decision-making authority in client-facing or trading contexts) and all human principals complete an annual COI declaration by 31 January each year. The declaration records:

- Personal financial interests potentially conflicting with Bank activities.
- External roles, directorships, or advisory relationships.
- Close-family-member interests that would be imputed to the declarant.
- Gifts and hospitality received in the preceding calendar year above the threshold in section 3.5.

New conflicts arising during the year must be notified to Zara within 5 business days of the conflict arising. Failure to notify is a conduct breach.

### 3.4 Information Barriers (Chinese Walls)

The following information barriers are maintained:

- **Proprietary trading ↔ Client advisory.** The proprietary trading function and any function providing advice to institutional clients are separated by access controls, separate communication channels, and documented escalation paths that route through compliance, not across the barrier.
- **Market-making ↔ Credit/risk.** Market-making desks do not have real-time access to credit limit headroom or counterparty risk assessments in advance of normal credit approval flows.
- **Compliance function.** Compliance and internal audit have view-only access to both sides of each barrier for supervisory purposes; they do not execute trading or advisory decisions.

Breaches of information barriers are escalated immediately to Zara and recorded as incidents in the operational risk register.

### 3.5 Gifts, Hospitality, and Entertainment

| Category | Limit | Register required |
|---|---|---|
| Individual gift or hospitality item | R500 per item | Yes — all items above R200 |
| Aggregate per relationship per calendar year | R2,000 | Yes |
| Public officials (government, regulators, SOE representatives) | Nil — no gifts or hospitality | Automatic incident report if offered |

Gifts above R500 individual value must be declined or, where declining would cause diplomatic harm, surrendered to the Bank and donated or auctioned for a nominated cause. The gifts and hospitality register is maintained by Zara as a sub-register of the COI register.

### 3.6 Personal Account Dealing

All agents and human principals are subject to the Personal Account Dealing sub-policy (Procedures/personal-account-dealing-procedure.md, forthcoming). Key controls:

- **Restricted securities list.** Maintained by Zara; securities on client facilitation flows or under active advisory mandates are listed; PA dealing in restricted securities is prohibited.
- **Pre-clearance.** Any PA deal in a non-restricted security must be pre-cleared with Zara (or the nominated deputy) before execution.
- **Blackout periods.** PA dealing is prohibited in the 5 business days before and after a material client transaction in the same instrument.
- **Reporting.** All PA transactions reported to Zara within 1 business day of execution.

### 3.7 Board-Level Conflicts

Directors of Hoz Bank Limited are subject to Companies Act 71/2008 s75. Where a director has a personal financial interest in a matter to be decided by the board:

1. The director discloses the nature and extent of the interest to Owen (Company Secretary, governance) before the matter is considered.
2. Owen records the disclosure in the board minute.
3. The director leaves the meeting while the matter is debated and resolved.
4. The resolution is passed by the remaining disinterested directors.

The director's absence, the disclosure, and the resolution are all recorded in the board minute. Owen is the custodian of board-level COI records.

---

## 4. Controls and Monitoring

### 4.1 FAIS Disclosure to Clients

Where a conflict of interest is material to financial advice or intermediary services provided to an institutional client, the conflict must be disclosed to the client in writing before the advice or service is provided. The disclosure must:

- Identify the nature of the conflict.
- State the Bank's management approach for that conflict.
- Be acknowledged in writing (or recorded electronic communication) by the client.

A template disclosure (Zara-maintained) is used for each category of standing conflict. Ad hoc disclosures are drafted by Zara or the desk compliance officer and approved by Zara before issue.

Advice provided without required COI disclosure is void as a compliant service and constitutes a FAIS breach. Such incidents are reported to the FSCA as conduct breaches.

### 4.2 Monitoring and Surveillance

- **Quarterly COI register review.** Zara reviews the COI register each quarter. New conflicts, changes to standing entries, and gift register additions are verified. A summary is included in the quarterly compliance report to the CEO and (at licence-day) to the board risk or audit committee.
- **Trade surveillance.** The market risk and surveillance system (Atlas, Market risk engineer, trading) monitors PA dealing against restricted lists and blackout windows.
- **Gifts and hospitality review.** Zara reviews the gifts and hospitality register monthly for threshold breaches.

### 4.3 Annual Independent Audit

Vera (Internal audit engineer, governance) conducts an annual audit of the COI framework covering:

- Completeness of annual declarations.
- Adequacy of Chinese wall controls.
- PA dealing compliance.
- Gifts register integrity.
- FAIS disclosure compliance on a sampled set of advice interactions.
- Board-level COI record completeness.

Vera's findings are reported to Zara (for management response), Helena (Chief Risk Officer, governance) (for risk taxonomy update), and Owen (Company Secretary, governance) (for board reporting).

---

## 5. Reporting

| Report | Frequency | Preparer | Recipient |
|---|---|---|---|
| COI register summary | Quarterly | Zara | CEO; board (at licence-day) |
| Gifts and hospitality register | Monthly | Zara | Helena (CRO) |
| PA dealing activity report | Monthly | Zara (from Atlas surveillance) | Helena (CRO) |
| Annual COI audit finding | Annual | Vera | Zara; Helena; Owen |
| FAIS compliance report (FSCA) | Annual | Zara | FSCA (via regulatory reporting gateway) |
| Material COI incident notification | Ad hoc | Zara | CEO; Owen; Helena |

---

## 6. Exceptions and Escalation

### 6.1 Escalation Triggers

The following events trigger immediate escalation to Zara:

- A conflict is identified that has not been declared within the required 5-business-day window.
- An information barrier is breached.
- A gift or hospitality item exceeds the individual threshold.
- A PA deal is executed without pre-clearance.
- A client is provided advice without required COI disclosure.

Zara determines the appropriate response (remediation, incident report, FSCA notification, board notification) within 2 business days of the escalation.

### 6.2 Board-Level Escalation

Material COI incidents — those involving a director, key individual, or senior officer; those resulting in client detriment; or those involving a potential regulatory breach — are escalated by Zara to Owen (Company Secretary, governance) for board (or interim CEO/board) notification.

### 6.3 Exceptions to Policy

No exception to the mandatory FAIS disclosure requirement is permitted. No exception to the board recusal requirement under Companies Act s75 is permitted.

Exceptions to the gifts threshold (e.g. a corporate event above the annual aggregate) require Zara approval in advance and are recorded in the register with a written rationale.

### 6.4 Interaction with the Whistleblowing Channel

Conflicts of interest that a reporter believes have been suppressed, mismanaged, or concealed may be reported through the Bank's anonymous whistleblowing channel established under the Anti-Bribery, Corruption, and Whistleblowing Policy (ABC-WB-01). Protected Disclosures Act 26/2000 protections apply. Zara is custodian of the whistleblowing channel; where a COI report implicates Zara directly, the report is routed to Owen (Company Secretary, governance) or Helena (Chief Risk Officer, governance) as the independent escalation point.
