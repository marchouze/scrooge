---
policy-id: GOV-FRAMEWORK-01
title: Governance Framework v1
version: "1.0"
status: DRAFT
owner: Owen (Company Secretary, governance)
effective-from: 2026-05-13
citations:
  - "Companies Act 71/2008: s66-76 (board duties)"
  - "Banks Act 94/1990: s60-69 (management and control)"
  - "Regulations Relating to Banks: reg.39 (governance)"
  - "FSR Act 9/2017: s8 (regulatory oversight)"
  - "King IV: Principles 1-17"
author: Owen (Company Secretary, governance)
date: 2026-05-13
summary: Establishes the bank's governance architecture — board structure, delegated authority, three-lines model, senior management accountability, CRO/CFO independence, and regulatory engagement obligations.
decision-required: false
riskTaxonomy:
  - "GOV-001"
  - "GOV-002"
  - "GOV-003"
---

# Governance Framework v1

> **Policy** | GOV-FRAMEWORK-01 v1.0 | Owner: Owen (Company Secretary, governance) | Status: DRAFT | Effective: 2026-05-13

> **Obligations closed:** [`ORG-GV-15`](../Regulations/_obligations-register.md) (board composition); [`ORG-GV-16`](../Regulations/_obligations-register.md) (board duties); [`ORG-GV-19`](../Regulations/_obligations-register.md) (governance report); [`ORG-GV-CFO-INDEPENDENCE`](../Regulations/_obligations-register.md) (CFO independence); [`ORG-GV-CRO-INDEPENDENCE`](../Regulations/_obligations-register.md) (CRO independence); [`ORG-FC-11`](../Regulations/_obligations-register.md) (MLRO governance anchor); [`ORG-CY-02`](../Regulations/_obligations-register.md) (CISO governance); [`ORG-TX-08`](../Regulations/_obligations-register.md) (tax governance anchor); [`ORG-CD-08`](../Regulations/_obligations-register.md) (conduct governance); [`ORG-CD-09`](../Regulations/_obligations-register.md) (conduct reporting).

> **Binding status:** LICENCE-BIND. Governance obligations under Companies Act 71/2008 and Banks Act 94/1990 apply from the date of incorporation and banking-licence grant respectively. The board, committee structure, and delegation of authority must be constituted at, or immediately before, licence-day. This framework is authored now so that the substrate, procedures, and governance structures are production-grade at that date.

---

## Purpose

This Governance Framework establishes the governance architecture of Hoz Bank Limited (the **Bank**) and Hoz Group Limited (the **Group**). It defines:

- The board's composition, duties, and committee structure;
- The three-lines model and senior management accountability;
- The independence requirements of the Chief Risk Officer (CRO) and Chief Financial Officer (CFO);
- The delegation of authority from the Board through the CEO to ExCo and management;
- Regulatory engagement protocols with the SARB Prudential Authority (**PA**), FSCA, and FIC;
- The annual governance review cycle.

The Framework gives effect to **Companies Act 71 of 2008 ss.66–76**, **Banks Act 94 of 1990 ss.60–69**, **Regulations Relating to Banks reg.39**, **Financial Sector Regulation Act 9 of 2017 s.8**, and the **King IV Report on Corporate Governance for South Africa** (King IV, Principles 1–17).

---

## Principles

1. **Accountability flows from the Board.** The Board of Directors bears ultimate accountability for the Bank's governance, strategy, risk appetite, and regulatory compliance.
2. **Independence of oversight functions.** The CRO and CFO are independent of trading and P&L functions; the Chief Audit Executive (CAE) is independent of management.
3. **Three-lines model.** Risk ownership, oversight, and independent assurance are separated across three clearly distinct lines.
4. **Substance over form.** Governance arrangements reflect actual control and accountability, not only formal structure.
5. **Regulatory engagement is proactive.** The Bank engages regulators openly, on a planned basis, and does not reserve engagement only for reactive or mandatory touchpoints.
6. **Autonomous by default.** Every governance procedure step defaults to an agent actor; human-in-the-loop steps carry explicit P2 citations (Principle 6).

---

## 1. Scope

### 1.1 Entity scope

This Framework applies to:

- **Hoz Bank Limited** — the licensed banking entity; primary governance scope.
- **Hoz Group Limited** — the holding company; Board-level governance applies at the Group level; subsidiary governance is aligned.
- **Hoz Securities Limited** — upon FAIS-FSP authorisation per `D-FSP-LICENCE-NECESSITY`; governance aligned to this Framework with FSCA-specific additions.

The legal-entity tree is maintained by Owen (Company Secretary, governance) at [`Regulations/_legal-entity-tree.md`](../Regulations/_legal-entity-tree.md).

### 1.2 Applies-at

LICENCE-BIND. The Board, committee structure, and delegation of authority are constituted at licence-day. Build-phase governance runs under Marc (CEO) as interim single director and decision-maker, with agent agents operating the governance substrate in rehearsal mode.

---

## 2. Board composition and duties

### 2.1 Statutory framework

The Board of Directors governs the Bank pursuant to:

- **Companies Act 71/2008 ss.66–76** — board authority, duties of directors (care, skill, diligence; fiduciary; conflicts; business judgement rule).
- **Banks Act 94/1990 ss.60–69** — management, control, and suitability requirements for directors and senior management.
- **Regulations Relating to Banks reg.39** — specific governance requirements for banks, including board and committee mandates.
- **King IV Principles 1–17** — applied-and-explained governance principles.

Register rows: [`ORG-GV-15`](../Regulations/_obligations-register.md) (board composition); [`ORG-GV-16`](../Regulations/_obligations-register.md) (board duties).

### 2.2 Board composition

At licence-day, the Board must comprise:

| Seat | Minimum requirements | King IV reference |
|---|---|---|
| Board Chair | Independent Non-Executive Director (INED); not the CEO | King IV Principle 7 |
| Non-Executive Directors (NEDs) | Majority of Board members must be NEDs; INED majority recommended | King IV Principle 7; Banks Act s.60 |
| CEO (Executive Director) | Non-voting on reserved matters; single executive director seat | Banks Act s.60 |
| Audit Committee Chair (NED) | Financially literate; independent; also acts as interim MLRO-alternate per `D-THIN-HUMAN-LAYER-MINIMUM` | Banks Act s.64(3); Companies Act s.94 |

**Minimum human count.** Per `project_ai_driven_bank.md` and `D-THIN-HUMAN-LAYER-MINIMUM`: the Bank targets the minimum statutory human board consistent with Banks Act and Companies Act requirements. Realistically 5–10 humans in total across the institution. Fit-and-proper requirements under Banks Act s.60 and the FSCA Fit-and-Proper Requirements apply to all directors.

**Fit and proper.** All directors must satisfy the PA's fit-and-proper requirements under Banks Act s.60 before appointment. The `fit-and-proper-policy-v1.md` governs this process.

### 2.3 Directors' duties

Directors owe the Bank and its shareholders the following duties under Companies Act ss.75–77:

| Duty | Statutory anchor | Key obligations |
|---|---|---|
| Fiduciary duty | Companies Act s.75 | Act in good faith; in the best interests of the Bank; avoid conflicts; disclose material interests |
| Duty of care, skill, and diligence | Companies Act s.76(3) | Standard of a reasonably diligent person with the same responsibilities and general knowledge, skill, and experience |
| Business judgement rule | Companies Act s.76(4) | Good faith; no material personal financial interest; informed; rational belief it is in the best interests of the Bank |
| Regulatory compliance | Banks Act ss.60–69; reg.39 | Ensure the Bank operates within its licence conditions and regulatory obligations |
| Conflict of interest | Companies Act s.75(4)–(7) | Disclose material interest; recuse from decisions; record in the board conflict register |

**Conflict of interest register.** Owen (Company Secretary, governance) maintains the Board conflict-of-interest register. Directors disclose material interests via `DirectorConflictDisclosed` event (planned; RMS Phase 1 Slice 2 event-type). Conflicts are reviewed at every board meeting.

### 2.4 Board reserved matters

The following matters require full Board approval and may not be delegated:

- Approval of the bank's strategy and risk appetite statement;
- Approval of the annual financial statements and SARB prudential returns;
- Appointment and removal of the CEO, CFO, CRO, CAE, and Company Secretary;
- Declaration of dividends or distributions;
- Material acquisitions, disposals, or restructurings above the threshold in the Delegation of Authority (§5);
- Approval of material regulatory submissions (licence application, Pillar 3 disclosures, ICAAP, ILAAP);
- Approval and annual review of this Governance Framework and all Board-level policies;
- Resolution of formal regulatory enforcement actions.

---

## 3. Board committee structure

### 3.1 Committee architecture

The Board operates the following committee structure at licence-day:

| Committee | King IV anchor | Chair | Primary mandate |
|---|---|---|---|
| Board Audit Committee (BAC) | King IV Principle 8 | Independent NED | Financial reporting; external audit oversight; internal audit oversight; combined assurance |
| Board Risk Committee (BRC) | King IV Principle 11 | Independent NED | Risk appetite; risk framework; ICAAP/ILAAP oversight; CRO functional reports |
| Board Remuneration Committee (RemCo) | King IV Principle 14 | Independent NED | Remuneration policy; senior executive pay; alignment with risk appetite |
| Board Social and Ethics Committee (SEC) | Companies Act s.72(4) | NED | Ethics; sustainability; stakeholder inclusivity; King IV Principle 3 |

**Interim build-phase structure.** Until licence-day, committee functions are performed by Marc (CEO) as interim sole decision-maker, supported by the agent workforce. The **Interim Audit Forum** (chaired by Owen, Company Secretary, governance) performs the audit-oversight function until the BAC is constituted; Thandiwe (Chief Audit Executive, governance) has functional independence from management per Principle 6 and reports functionally to the Interim Audit Forum.

### 3.2 Audit Committee (BAC)

The BAC is constituted under **Companies Act s.94** and **Banks Act s.64(3)**. Its mandate includes:

- Oversight of the Bank's financial reporting process (IFRS — see `accounting-policies-ifrs-v1.md`);
- Oversight of external audit (appointment, independence, scope, audit report);
- Oversight of the Internal Audit function (Thandiwe, Chief Audit Executive, governance; Vera, Internal audit / continuous-assurance engineer, engineering);
- Review of the combined assurance model (three-lines coordination);
- Review of the RMCP adequacy from a financial-crime perspective (per risk-management-and-compliance-policy-v1.md);
- Approval of the annual internal audit plan.

The BAC receives the external auditor's report and the CAE's risk-based audit report at each meeting (quarterly minimum; annually for annual financial statements sign-off).

### 3.3 Board Risk Committee (BRC)

The BRC oversees:

- The Bank's risk appetite statement (RAS) and risk taxonomy;
- ICAAP (Internal Capital Adequacy Assessment Process) and ILAAP (Internal Liquidity Adequacy Assessment Process) outputs;
- CRO's functional reports (Helena, Chief Risk Officer, governance);
- Material limit breaches and escalations from the risk framework;
- RMCP adequacy (risk-based view);
- Capital and liquidity adequacy relative to risk appetite.

The CRO (Helena, Chief Risk Officer, governance) has a direct functional reporting line to the BRC, independent of the CEO line (§4.2).

### 3.4 RemCo

The RemCo operates under the Bank's Remuneration Policy (`remuneration-policy-v1.md`). Its mandate includes FSB / FSCA remuneration requirements under the Fit and Proper Standards and Banks Act reg.39 remuneration requirements. At licence-day, executive pay structures are reviewed against the risk appetite to prevent incentive misalignment.

---

## 4. Three-lines model and senior management accountability

### 4.1 Three-lines model

The Bank adopts the **three-lines model** as the primary framework for distributing governance, risk, and assurance responsibilities:

| Line | Who | What |
|---|---|---|
| **First line — Management** | CEO (Marc, interim); ExCo; business / trading functions | Own and manage risk; execute within approved limits and policies; report on risk indicators |
| **Second line — Oversight** | CRO (Helena, Chief Risk Officer, governance); CCO (Zara, Chief Compliance Officer, governance); CFO (Camille, CFO, governance); CISO (Ravi, CISO, governance) | Set frameworks, policies, and limits; monitor first-line risk-taking; provide independent challenge; escalate breaches |
| **Third line — Independent assurance** | CAE (Thandiwe, Chief Audit Executive, governance); Vera (Internal audit / continuous-assurance engineer, engineering) | Risk-based audit plan; independent assurance over first- and second-line effectiveness; reports functionally to the BAC |

**Principle 6 — autonomous by default.** All three lines operate with agent actors as the default. The engineering layer (Atlas, Devon, Ravi-eng, Camille-eng, Mira, Vera, Bea, and others per `Team/_team-roster.json`) builds and operates the substrate; governance seats (Helena, Zara, Camille-governance, Thandiwe, Owen, Iris, Ravi-governance) hold named regulatory accountability and oversee engineering outputs.

### 4.2 CRO independence

The CRO (**Helena, Chief Risk Officer, governance**) is independent of business and P&L functions:

- **Functional reporting line:** directly to the BRC; the BRC chairs the CRO's performance review.
- **Administrative reporting line:** to the CEO for day-to-day management purposes only.
- **No P&L accountability:** the CRO holds no trading book, revenue target, or bonus component tied to business-line performance. Any remuneration linkage to risk outcomes is limited to risk-management quality metrics (e.g. accuracy of limit-breach detection, timeliness of escalation), not P&L.
- **Veto right on risk limits:** the CRO may veto any limit proposed by the first line that exceeds the approved RAS, subject to Board escalation.
- **Access to the BRC:** the CRO may address the BRC directly, without the CEO present, on any matter affecting the Bank's risk profile.

Register row: [`ORG-GV-CRO-INDEPENDENCE`](../Regulations/_obligations-register.md). Banks Act s.60; reg.39.

### 4.3 CFO independence

The CFO (**Camille, CFO, governance**) is independent of trading and risk functions:

- **No trading-desk responsibility:** the CFO does not hold, manage, or approve trading positions or trading limits.
- **No risk-function accountability:** the CFO's mandate covers financial reporting, treasury management (under delegation), and financial control; it does not extend to the risk-measurement or risk-monitoring functions owned by the CRO.
- **Functional reporting line on financial reporting:** to the BAC on matters of financial reporting integrity; to the CEO for day-to-day management.
- **Treasury boundary:** treasury activities (funding, liquidity management) are performed under the CFO's mandate but within limits set and monitored by the CRO / ALCO (Asset and Liability Committee), which has a defined governance structure under the BRC.

Register row: [`ORG-GV-CFO-INDEPENDENCE`](../Regulations/_obligations-register.md). Banks Act s.60; Companies Act s.66.

### 4.4 Senior management accountability

The following senior management positions carry named regulatory accountability at licence-day:

| Position | Holder | Key accountability |
|---|---|---|
| CEO | Marc (interim; licensed at licence-day) | Overall management control; PA primary contact; strategic accountability |
| CFO | Camille (CFO, governance) | Financial reporting; capital adequacy attestation; SARB prudential returns |
| CRO | Helena (Chief Risk Officer, governance) | Risk framework; RAS; ICAAP / ILAAP; limit structure |
| CCO / MLRO | Zara (Chief Compliance Officer, governance) | AML/CFT/CPF RMCP; FIC s.42A senior person; regulatory compliance programme |
| Information Officer | Iris (Information Officer, governance) | POPIA s.55 Information Officer; data protection |
| CISO | Ravi (CISO, governance) | Joint Standard 2/2024 cybersecurity programme; PA/FSCA IT governance |
| Company Secretary | Owen (Company Secretary, governance) | Board secretariat; statutory filings; governance register; governance framework ownership |
| CAE | Thandiwe (Chief Audit Executive, governance) | Internal audit independence; audit plan; BAC functional reports |

Accountability mapping is maintained in [`Team/_team-roster.json`](../Team/_team-roster.json) and must be kept current by Owen (Company Secretary, governance) at every role change.

---

## 5. Delegation of authority

### 5.1 Delegation hierarchy

Authority flows from the Board downward through a tiered delegation structure:

```
Board (reserved matters — §2.4)
    └── CEO (day-to-day management authority; ExCo mandates)
            ├── CFO (financial authority within RAS limits)
            ├── CRO (risk-limit authority within Board-approved RAS)
            ├── CCO (compliance authority; RMCP decisions)
            └── ExCo members (functional authority within approved mandates)
                    └── Management (operational authority within approved policies)
```

### 5.2 Delegation of authority matrix

The Delegation of Authority (DoA) matrix sets binding approval thresholds. The matrix is maintained by Owen (Company Secretary, governance) and is reviewed and approved by the Board annually and on any material change.

| Decision type | Board | CEO | CFO/CRO | ExCo | Management |
|---|---|---|---|---|---|
| Strategy approval | ✓ | Proposes | Input | Input | — |
| Risk appetite statement | ✓ | Proposes | CRO proposes | Input | — |
| Capital / dividend decisions | ✓ | Recommends | CFO recommends | — | — |
| Policy approval (Board-level) | ✓ | — | — | — | — |
| Policy approval (management-level) | Delegates | ✓ | Input | — | — |
| Trading limits ≥ DoA threshold | BRC ✓ | Recommends | CRO recommends | — | — |
| Counterparty limits ≥ DoA threshold | BRC ✓ | — | CRO approves within RAS | — | — |
| Material contracts ≥ DoA threshold | ✓ | — | — | — | — |
| Expenditure ≥ DoA threshold | ✓ | Sub-threshold | Sub-threshold | Sub-threshold | Sub-threshold |
| Regulatory submissions | ✓ (material) | Routine | — | — | — |

Specific monetary thresholds are set in the DoA matrix document (maintained by Owen; reference: `Governance/_delegation-of-authority-matrix.md`). This Framework sets the structural hierarchy; the matrix sets the numeric gates.

### 5.3 Sub-delegation rules

- Delegated authority may be sub-delegated only to the extent expressly permitted in the DoA matrix.
- Sub-delegation does not relieve the delegating officer of accountability for the decision.
- Emergency authority: in the absence of the primary approver, authority may be exercised by the next tier up; the exercise must be recorded in the event store within one business day (`AuthorityExercisedEmergency` event, planned).

---

## 6. Regulatory engagement

### 6.1 Regulatory landscape

The Bank engages with the following regulators:

| Regulator | Engagement type | Primary Bank contact | Frequency |
|---|---|---|---|
| SARB Prudential Authority (PA) | Prudential supervision; banking licence; ICAAP/ILAAP; on-site visits | CEO + CFO + CRO (Helena, Chief Risk Officer, governance) | Ongoing; formal annual SREP |
| FSCA | Market conduct; FAIS; Conduct Standard 3/2018 | CCO (Zara, Chief Compliance Officer, governance) | Ongoing; annual compliance report |
| FIC | AML/CFT/CPF; RMCP; STR/CTR/PAR; grey-list remediation | MLRO (Zara, Chief Compliance Officer, governance) | Ongoing; annual RMCP review |

Register row: [`ORG-CD-08`](../Regulations/_obligations-register.md) (conduct governance); [`ORG-CD-09`](../Regulations/_obligations-register.md) (conduct reporting); FSR Act 9/2017 s.8.

### 6.2 Regulatory engagement protocol

All regulatory engagement follows this protocol:

1. **Pre-engagement preparation.** Owen (Company Secretary, governance) coordinates preparation materials for all formal regulatory meetings. Materials are reviewed by the relevant governance seat holder (CEO, CFO, CRO, CCO, or Owen) before submission to the regulator. No substantive regulatory engagement takes place without documented preparation (`RegulatoryEngagementPrepared` event, planned).

2. **Communication logging.** All written regulatory correspondence (inbound and outbound) is logged in the regulatory correspondence register (`GovernanceRegRecord` event, planned; RMS Phase 1 register: Correspondence). Owen (Company Secretary, governance) owns the correspondence register.

3. **Escalation.** Any regulator communication that raises a finding, requires a response within 10 business days, or implies enforcement action is escalated to the Board Chair within one business day.

4. **Response discipline.** Regulatory requests for information are responded to within the timeframe specified by the regulator, or within 10 business days if no timeframe is specified. Extensions are requested proactively, in writing, before the deadline.

### 6.3 Regulatory change management

The Bank maintains a **regulatory horizon-scanning process** to detect and respond to regulatory change:

| Activity | Owner | Cadence | Output |
|---|---|---|---|
| Horizon scan — new and proposed regulations | Mira (Compliance / RegTech engineer, engineering); Zara (CCO, governance) | Weekly | Regulatory change log entry; `RegChangeDetected` event (planned) |
| Impact assessment — new regulation vs obligations register | Mira; Helena (CRO) for risk-relevant changes | Within 30 days of detection | Impact assessment brief to ExCo / BRC as appropriate |
| Policy update — affected policies revised | Relevant policy owner (per policy register) | Within 90 days of regulation effective date (or such earlier date as the regulation requires) | Updated policy version; PR to main; CEO / Board approval as applicable |
| Obligations register update | Mira; Owen | On detection + after final regulation | New row(s) in [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md) |
| FSCA reg-to-policy recon | Vera (Internal audit / continuous-assurance engineer, engineering) | Continuous | Recon output: uncovered obligations flagged as Vera findings |

The FSCA reg-to-policy recon harness (`recon:fsca-reg-to-policy`) is live per PR #335.

---

## 7. Annual governance review cycle

### 7.1 Review cadence

The Board conducts an **annual governance review** covering:

| Review item | Owner | Output |
|---|---|---|
| Board effectiveness evaluation | Board Chair; Owen (Company Secretary, governance) | Effectiveness report to Board; King IV applied-and-explained update |
| Committee terms of reference | Owen | Updated ToRs; Board approval |
| Delegation of Authority matrix | Owen | Updated DoA; Board approval |
| Governance Framework (this document) | Owen | Updated policy version; Board approval |
| Board composition and succession | RemCo; Board Chair | Succession plan; fit-and-proper currency |
| Director conflict-of-interest register | Owen | Annual declaration; updated register |
| Regulatory engagement log review | Owen; CCO | Annual summary to Board |
| King IV applied-and-explained statement | Owen | Annual governance report (`ORG-GV-19`) |

Register row: [`ORG-GV-19`](../Regulations/_obligations-register.md) (annual governance report).

### 7.2 Governance report

The annual governance report (King IV applied-and-explained) is prepared by Owen (Company Secretary, governance) and approved by the Board. It covers:

- Board composition and independence status;
- Committee terms of reference compliance;
- King IV Principles 1–17 applied-and-explained;
- Material governance findings and remediation status;
- Regulatory engagement summary.

The annual report is published in the Bank's integrated report at licence-day; in the build phase it is filed in `Owner Inbox/` per the current deliverables convention.

---

## 8. Controls and monitoring

### 8.1 Governance controls

| Control | Owner | Mechanism | Cadence |
|---|---|---|---|
| Board meeting quorum and minutes | Owen | `BoardMeetingMinutesApproved` event (planned) | Per meeting |
| Director fit-and-proper currency | Owen; Sade (AgentOps, engineering) | `FitAndProperCurrent` event (planned); PA register check | Annual; on PA update |
| Conflict-of-interest declarations | Owen | Director declaration + `DirectorConflictDisclosed` event (planned) | Annual + on change |
| DoA compliance — above-threshold approvals | Vera (Internal audit / continuous-assurance engineer, engineering) | `recon:doa-compliance` (planned) | Continuous |
| CRO independence — no P&L linkage | Vera | `recon:cro-independence` (planned) | Annual; on remuneration review |
| CFO independence — no trading link | Vera | `recon:cfo-independence` (planned) | Annual |
| Regulatory correspondence currency | Owen | Correspondence register age alerts (planned) | Daily |

### 8.2 Vera assurance coverage

Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, Chief Audit Executive, governance) provides continuous-assurance recon coverage over governance controls. Governance recon harnesses (planned):

| Recon | What it asserts |
|---|---|
| `recon:doa-compliance` | Every decision above a DoA threshold has a paired approval event from the correct authority tier |
| `recon:board-meeting-quorum` | Every `BoardMeetingConvened` has a corresponding `BoardMeetingMinutesApproved` with quorum confirmed |
| `recon:cro-independence` | CRO's remuneration record carries no P&L-linked component |
| `recon:cfo-independence` | No trading-position event carries the CFO as approver |
| `recon:governance-report-currency` | A `KingIVReportPublished` event exists within 13 months |
| `recon:fit-and-proper-currency` | Every director has a current-cycle `FitAndProperCurrent` event within 13 months |

---

## 9. Exceptions and escalation

### 9.1 Policy exceptions

Any departure from this Framework requires prior approval from the Board (for Board-level matters) or the CEO (for management-level matters), with:

- Written justification for the exception;
- Duration of the exception (time-limited only; no permanent exceptions to Board-level requirements);
- Compensating controls during the exception period;
- `GovernanceExceptionApproved` event (planned) recording the exception.

Owen (Company Secretary, governance) maintains the governance exception register.

### 9.2 Escalation pathway

| Trigger | Escalation path | Timeline |
|---|---|---|
| DoA breach — transaction approved without required authority | Vera flags → CEO → Board Chair | Same business day |
| CRO or CFO independence breach | Vera flags → Board Chair directly | Same business day |
| Regulatory finding requiring Board response | Owen → Board Chair | Within one business day |
| Director conflict not disclosed | Owen → Board Chair → Audit Committee Chair | Within one business day |
| King IV governance failure | Owen → Board Chair; Vera advisory finding | Next board meeting (or extraordinary if urgent) |

---

## 10. Authority and citations

**Statutory instruments:**

- Companies Act 71 of 2008 ss.66–76 (board authority, fiduciary duties, care/skill/diligence, conflicts, business judgement rule), s.72(4) (Social and Ethics Committee), s.94 (Audit Committee).
- Banks Act 94 of 1990 ss.60–69 (management and control; director suitability; board requirements); s.64(3) (Audit Committee).
- Regulations Relating to Banks, reg.39 (governance requirements for banks).
- Financial Sector Regulation Act 9 of 2017 s.8 (regulatory oversight; FSCA and PA mandates).
- King IV Report on Corporate Governance for South Africa (Institute of Directors SA, 2016) — Principles 1–17.

**Internal canonical sources:**

- [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md) — ORG-GV rows cited inline throughout this document.
- [`Team/_team-roster.json`](../Team/_team-roster.json) — canonical source for agent names, positions, and reporting lines.
- [`Policies/fit-and-proper-policy-v1.md`](fit-and-proper-policy-v1.md) — fit-and-proper requirements for directors and senior management.
- [`Policies/remuneration-policy-v1.md`](remuneration-policy-v1.md) — RemCo mandate; remuneration alignment with risk appetite.
- [`Policies/risk-management-and-compliance-policy-v1.md`](risk-management-and-compliance-policy-v1.md) — RMCP; CRO / CCO mandates.
- [`Policies/internal-audit-charter-v1.md`](internal-audit-charter-v1.md) — CAE independence; internal audit mandate.
- [`Policies/accounting-policies-ifrs-v1.md`](accounting-policies-ifrs-v1.md) — CFO mandate; financial reporting governance.
- **D-THIN-HUMAN-LAYER-MINIMUM** (CEO-approved 2026-05-08) — minimum statutory human layer; MLRO-alternate = AC-Chair NED.
- **D-FSP-LICENCE-NECESSITY** (CEO-approved 2026-05-09) — Hoz Securities Limited FSP licence.
- **D-RMS-PHASE-1** (CEO-approved 2026-05-09) — Records Management Substrate; event-type registration.
- **CLAUDE.md** — "Operating procedures" (events-first authoring; dispatch discipline); "Architectural principles" 1, 2, 6.
- `project_ai_driven_bank.md` (memory) — build-phase posture; pre-licence go-live readiness gate.
- `project_strategic_foundation.md` (memory) — institutional global-markets dealer; single-branch SA.
- `feedback_agent_name_with_position.md` (memory) — name + position on first mention.

---

## 11. Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v1.0 | 2026-05-13 | Owen (Company Secretary, governance) | Initial Governance Framework. Establishes board structure, three-lines model, CRO/CFO independence, delegation of authority, regulatory engagement protocol, regulatory change management, and annual review cycle. Closes obligations ORG-GV-15, ORG-GV-16, ORG-GV-19, ORG-GV-CFO-INDEPENDENCE, ORG-GV-CRO-INDEPENDENCE, ORG-FC-11, ORG-CY-02, ORG-TX-08, ORG-CD-08, ORG-CD-09. LICENCE-BIND. DRAFT pending licence-day Board constitution. |

---

*Owen (Company Secretary, governance)*
