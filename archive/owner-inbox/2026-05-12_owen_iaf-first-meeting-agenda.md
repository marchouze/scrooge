---
title: "Interim Audit Forum — First Meeting Agenda"
author: Owen (Company Secretary, governance)
date: 2026-05-12
decision-required: false
citations:
  - "[citation: Companies Act 71 of 2008 — s94 Audit Committee]"
  - "[citation: King IV Principle 15 — Audit Committee]"
  - "[citation: IIA International Standards — Internal Audit Charter]"
---

# Interim Audit Forum — First Meeting Agenda

**Prepared by:** Owen (Company Secretary, governance) — IAF chair  
**Date:** 2026-05-12  
**Status:** Agenda confirmed; pre-read pack dispatched to attendees

---

## 1. Meeting purpose

This is the first meeting of the Interim Audit Forum (IAF) since Thandiwe (Chief Audit Executive, governance) took her seat and completed her first-90-days deliverables. The primary purposes of this meeting are: (1) for the IAF to receive, consider, and sign off the Internal Audit Charter v1 — the foundational governance document of the third line of defence — submitted by Thandiwe following co-development with Vera (Internal audit / continuous-assurance engineer, third-line); and (2) to receive, walkthrough, and formally approve the 12-Month Risk-Based Audit Plan v1, covering the build-phase period from 2026-05-12 to 2027-05-11 in agent cadence. Owen (Company Secretary, governance) chairs the IAF in an interim capacity until a Board Audit Committee is constituted and a Board AC chair is appointed per D-THIN-HUMAN-LAYER-MINIMUM. This interim IAF structure is a standing registered conflict on the conflicts register (Owen curates the register that records his own chair position); the structural mitigation is Thandiwe's unmediated functional reporting line into the IAF, which preserves third-line independence pending the constitution of a formal Board AC under the Companies Act 71 of 2008 (s94) and King IV Principle 15.

---

## 2. Attendees

| Name | Role | Capacity |
|---|---|---|
| **Owen** (Company Secretary, governance) | IAF chair | Chairing; secretariat; sign-off on resolutions |
| **Thandiwe** (Chief Audit Executive, governance) | CAE | Presenting IA Charter v1 and 12-Month Audit Plan v1; subject-matter authority for all third-line items |
| **Marc** (CEO) | Chief Executive Officer | Administrative line only; attending in observer capacity on third-line items; co-signatory of Charter sign-off block and Audit Plan approval per build-phase mechanics |
| **Vera** (Internal audit / continuous-assurance engineer, third-line) | IA continuous-controls engineer | Invited to present the continuous-controls pipeline state (Agenda Item 6); attends for that item only unless Thandiwe invites her to remain |

**Notes on attendee composition:**

- The IAF is an interim governance body. At licence-day, it converts to a properly constituted Board Audit Committee per the Companies Act 71 of 2008 (s94) and King IV, with independent non-executive director membership per D-THIN-HUMAN-LAYER-MINIMUM. The current attendee set is the minimum required during the build phase before human directors and NEDs are appointed.
- Marc's attendance as CEO is administrative line only. Per the IA Charter v1 §2.1 (functional vs administrative reporting), the CEO does not direct internal audit scope, methodology, finding ratings, or opinion content. Marc's role at this meeting is: observer and co-signatory for the build-phase sign-off mechanics (§10 of the Charter submission).
- Vera's attendance on Item 6 is as the engineering arm of the third line, under Thandiwe's direction. Vera does not vote, co-chair, or sign off on Charter or Plan approval.

---

## 3. Agenda

| Item | Owner | Purpose | Time (agent cadence) |
|---|---|---|---|
| **1. Opening and quorum** | Owen | Confirm attendees present; note the interim IAF status and registered conflict (Owen as chair; Thandiwe has functional independence into the forum); note the build-phase governance context; confirm meeting is duly constituted | 5 min |
| **2. IA Charter v1 — introduction and walkthrough** | Thandiwe | Walk through the Charter's nine substantive sections (§1 Purpose and Authority; §2 Independence and Objectivity; §3 Scope — including the explicit AI-agent-operated-functions provision; §4 Standards; §5 Responsibilities; §6 Audit Plan governance; §7 Reporting; §8 QAIP; §9 Charter Review); address IAF questions; note the policy-layer text at `Policies/internal-audit-charter-v1.md` | 20 min |
| **3. IA Charter — IAF sign-off** | Owen + Marc | Record IAF sign-off in the minutes; Owen and Marc sign the sign-off block (§10 of the Charter submission); Owen emits or directs emission of an `AuditCharterRevisionApproved` event as the canonical record per Principle 1; note that the Thandiwe agent persona holds the CAE seat during the build phase and this Charter will be reviewed on appointment of a human CAE at licence-day (§9.3) | 5 min |
| **4. 12-Month Audit Plan v1 — walkthrough** | Thandiwe | Walk through the plan's six parts: (Part 1) plan framing and build-phase audit posture; (Part 2) the 16-engagement audit schedule including Q1 priority domains (AU-2026-001 Market Risk Model Integrity, AU-2026-002 AI-Agent Operating Risk, AU-2026-003 Event-Store Integrity) and their quarterly sequencing; (Part 3) coverage rationale; (Part 4) combined-assurance overlay — positioning of third-line vs second-line assurance across all 16 engagements; (Part 5) substrate gaps that constrain plan execution; (Part 6) approval mechanics and amendment criteria | 25 min |
| **5. Audit Plan — IAF approval** | Owen + Marc | Record IAF approval in the minutes; Owen directs emission of an `AuditPlanRevisionApproved` event as the canonical record per Principle 1; note mid-year amendment criteria (material changes require AC approval; minor resequencings are within CAE authority per Charter §6.2) | 5 min |
| **6. Vera pipeline state** | Vera | Present the current state of the continuous-controls recon pipeline: running pipelines, nightly and CI integration status, current open P1 findings (latest overnight recon as of 2026-05-11: 1 fail on `decision-event-reconciliation` — `D-MARKETS-CAPITAL-TIME-SHAPE`; 26 warns across 7 pipelines), Wave-4 pipeline completeness and delivery timeline; confirm continuous-controls-as-primary-instrument posture is operational for AU-2026-002 and AU-2026-003 Q1 engagements | 15 min |
| **7. IAF standing rhythm** | Owen | Present and agree the proposed quarterly IAF cadence (see §6 below); agree AC-pack structure; agree findings-register reporting cycle; confirm that the first quarterly opinion-pack from Thandiwe (to be submitted 7 days before the next IAF meeting) will use the CAE's authored-pack format pending the `@platform/ac-pack-generator` substrate (registered gap in Thandiwe's spec §16) | 10 min |
| **8. AOB and close** | Owen | Any other business; confirm actions (owners, deadlines); confirm date of next IAF meeting; close | 5 min |

**Total estimated duration:** 90 minutes (agent cadence)

---

## 4. Pre-read pack

Attendees are expected to read the following before the meeting:

### Mandatory pre-reads

| Document | Path | Who must read | Note |
|---|---|---|---|
| **IA Charter v1 — IAF submission** | `Owner Inbox/2026-05-12_thandiwe_internal-audit-charter-v1.md` | All attendees | Full document; 9 substantive sections + sign-off block (§10). Policy-layer text at `Policies/internal-audit-charter-v1.md` for §2 (Independence) deep-read |
| **12-Month Audit Plan v1 — IAF submission** | `Owner Inbox/2026-05-12_thandiwe_audit-plan-12m-v1.md` | All attendees | Full document; 16 audit engagements; Part 4 combined-assurance overlay is particularly relevant for the IAF's challenge function |

### Recommended pre-reads

| Document | Path | Relevance |
|---|---|---|
| **Vera overnight recon — 2026-05-11** | `Owner Inbox/2026-05-11_vera_overnight-recon.md` | Context for Item 6 (pipeline state); the 1 fail finding on `decision-event-reconciliation` will be discussed |
| **Vera overnight recon — 2026-05-12** | `Owner Inbox/2026-05-12_vera_overnight-recon.md` (if available at meeting time) | Most-recent pipeline state for Item 6 |
| **ICAAP / ILAAP paper v1** | `Owner Inbox/2026-05-12_helena_icaap-ilaap-paper-v1.md` | Helena (Chief Risk Officer, governance)'s ICAAP / ILAAP context underpins AU-2026-011 (Capital Adequacy) and the combined-assurance overlay for capital and liquidity domains |
| **RAS and RAF** | `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` | Audit Plan Part 1 cites the RAS/RAF as the primary lens for plan derivation; familiarity with the appetite lines informs challenge on AU-2026-004 and AU-2026-005 |
| **Risk taxonomy v1** | `Owner Inbox/2026-05-11_helena-rohan_risk-taxonomy-v1.md` | The plan maps every engagement to a risk taxonomy code; this is the canonical taxonomy reference |
| **Audit Committee prep — 2026-05-08** | `Owner Inbox/2026-05-08_thandiwe_audit-committee-prep.md` | Thandiwe's preparatory note from the previous AC prep cycle; confirms the first-90-days plan origin of this meeting |

### Owen's supplementary note for the IAF record

Owen notes for the IAF record that the combined-assurance map referenced in the Audit Plan (Part 4) is currently authored rather than substrate-generated (registered gap: combined-assurance-map tooling not yet built — Thandiwe §16 and Vera §16). The IAF should note this as a substrate gap finding and direct it to the build-phase roadmap. Owen will register it in the action tracker on close of this meeting.

---

## 5. Minutes template

Owen will complete the following minutes template at the close of the meeting. The signed minutes are the official IAF record; the `AuditCharterRevisionApproved` and `AuditPlanRevisionApproved` events are the canonical Principle-1 records.

---

### INTERIM AUDIT FORUM — FIRST MEETING MINUTES

**Meeting reference:** IAF-2026-001  
**Date:** 2026-05-12 (agent cadence)  
**Chair:** Owen (Company Secretary, governance)  
**Secretariat:** Owen (Company Secretary, governance)

**Attendees present:**
- Owen (Company Secretary, governance) — Chair
- Thandiwe (Chief Audit Executive, governance)
- Marc (CEO) — observer / co-signatory
- Vera (Internal audit / continuous-assurance engineer, third-line) — Item 6 only

**Apologies:** _(none expected)_

---

**1. Opening and quorum**

The Chair confirmed that the meeting was duly constituted. The interim IAF status and the registered interim conflict (Owen as chair) were noted. Thandiwe's unmediated functional independence into the forum was confirmed as the structural mitigation.

**2. IA Charter v1 — walkthrough**

Thandiwe presented the Internal Audit Charter v1. Key points noted by the IAF:  
_(Owen to complete from meeting notes)_

Questions raised and responses:  
_(Owen to complete from meeting notes)_

**3. IA Charter v1 — sign-off**

**RESOLVED** (unanimously / with the following qualifications):  
The Interim Audit Forum signs off the Internal Audit Charter v1 as submitted by Thandiwe (Chief Audit Executive, governance) dated 2026-05-12, and directs the emission of an `AuditCharterRevisionApproved` event as the canonical record. The Charter is to be reviewed annually (next review: the IAF meeting following the end of the Bank's first financial year) and on the triggers specified in §9.2. The build-phase sign-off block at §10 is completed as follows:

| Role | Name | Status | Date |
|---|---|---|---|
| Chief Audit Executive | Thandiwe | Signed off | 2026-05-12 |
| IAF Chair | Owen | Signed off | 2026-05-12 |
| CEO (build-phase signatory) | Marc | Signed off | 2026-05-12 |

**4. 12-Month Audit Plan v1 — walkthrough**

Thandiwe presented the 12-Month Risk-Based Audit Plan v1. Key points noted by the IAF:  
_(Owen to complete from meeting notes)_

Questions raised and responses:  
_(Owen to complete from meeting notes)_

**5. 12-Month Audit Plan v1 — approval**

**RESOLVED** (unanimously / with the following qualifications):  
The Interim Audit Forum approves the 12-Month Risk-Based Audit Plan v1 as submitted by Thandiwe (Chief Audit Executive, governance) dated 2026-05-12, covering the period 2026-05-12 to 2027-05-11 in agent cadence (wall-clock dates indicative). An `AuditPlanRevisionApproved` event is directed to be emitted as the canonical record. Material mid-year amendments require IAF approval; minor resequencings within quarters are within the CAE's authority.

Substrate gaps noted by the IAF (for roadmap registration):  
_(Owen to record from meeting notes; see Audit Plan Part 5 for the pre-submitted list)_

**6. Vera pipeline state**

Vera presented the current continuous-controls pipeline state. Key points noted:  
_(Owen to complete from meeting notes)_

Open P1 findings as of meeting date:  
_(Owen to record from Vera's presentation)_

IAF direction on open findings:  
_(Owen to record from meeting notes)_

**7. IAF standing rhythm**

The IAF agreed the following standing rhythm (per §6 of this agenda):  
_(Owen to confirm from meeting notes — use the §6 proposal as the base text if agreed without amendment)_

**8. AOB and close**

Other business:  
_(Owen to record from meeting notes)_

**Actions arising from this meeting:**

| # | Action | Owner | Deadline | Status |
|---|---|---|---|---|
| IAF-A001 | Emit `AuditCharterRevisionApproved` event (canonical record of Charter sign-off) | Owen / Atlas (Core banking platform architect, engineering) | Same agent run | Open |
| IAF-A002 | Emit `AuditPlanRevisionApproved` event (canonical record of Plan approval) | Owen / Atlas | Same agent run | Open |
| IAF-A003 | Register combined-assurance-map tooling gap on build-phase roadmap | Owen | Next agent run | Open |
| IAF-A004 | Dispatch next IAF quarterly prep to Thandiwe (first quarterly opinion-pack due 7 days before next IAF meeting) | Owen | Per IAF standing rhythm | Open |
| IAF-A005 | _(from Vera's presentation — Owen to populate)_ | _(to be determined)_ | _(to be determined)_ | Open |

**Next IAF meeting:**  
Date (agent cadence): _(to be confirmed per agreed quarterly rhythm)_  
Key agenda item: Thandiwe's first quarterly third-line opinion to the IAF; combined-assurance map v1 presentation.

---

*Minutes signed: Owen (Company Secretary, governance), _(date)_*

---

## 6. Standing IAF rhythm (proposal)

Owen proposes the following IAF cadence for the IAF to agree at Item 7. This proposal is consistent with BCBS 223 supervisory expectations for a bank's internal audit governance rhythm and King IV Practice 26 on Audit Committee cadence.

### 6.1 Quarterly full IAF meeting

A full IAF meeting is held quarterly (once per agent-cadence quarter), aligned to Thandiwe's quarterly opinion-pack cadence:

- **Pre-meeting:** Thandiwe submits the quarterly opinion-pack to the IAF not later than 7 agent-cadence days before the meeting (per IA Charter v1 §7.1). Pack content: third-line opinion (`adequate` / `adequate with exceptions` / `inadequate`); Vera pipeline results summary; open findings with age and severity; findings closed with evidence reference; combined-assurance map coverage update; independence and conflicts register update; substrate gaps affecting pipeline coverage.
- **Standing quarterly agenda:** (1) CAE opinion and pipeline state — Thandiwe presenting; (2) findings register review — all open findings, owners, target closures; (3) combined-assurance map update; (4) audit plan progress and any material amendments (requiring IAF approval); (5) QAIP update; (6) independence and conflict declarations; (7) substrate gaps and roadmap items; (8) AOB.
- **Quorum:** Owen (chair) + Thandiwe + Marc (observer / administrative line). At licence-day, independent NEDs constitute quorum under Companies Act s94.

### 6.2 Monthly brief from Vera

A written monthly brief from Vera (Internal audit / continuous-assurance engineer, third-line) is submitted to Owen and Thandiwe on: pipeline run counts, pass / warn / fail breakdown, new findings opened, findings closed. The brief is a standing written report — **no meeting is convened unless a P1 finding is open or Thandiwe requests one**. Vera's brief feeds the following quarter's IAF pack.

### 6.3 Out-of-cycle meeting triggers

An extraordinary IAF meeting is convened within 24h (agent cadence) on any of the following triggers:

| Trigger | Channel | SLA |
|---|---|---|
| Any critical audit finding (CRITICAL severity per IA Charter §7.3) | `AgentEscalation` → Owen as AC chair | Within 4h of identification by Thandiwe |
| Any Vera P1 (fail) recon finding unresolved for > 3 consecutive agent run cycles | Vera monthly brief escalation flag → Owen | Within next agent run following the 3rd consecutive fail |
| Any whistleblowing escalation naming a C-suite executive | Sealed `AgentEscalation` → Owen; CEO informed after AC pathway | Within 24h of disclosure receipt |
| Suspected fraud or material misstatement | `AgentEscalation` (sealed) → Owen; CEO + Imani (Legal-as-code engineer) | Within 4h of reasonable-grounds threshold |
| Independence challenge — actual or apparent conflict in the IAF | `AgentEscalation` → Owen; disclosure on IAF record | Pre-decision |
| Management access obstruction | `AgentEscalation` → Owen | Same agent run as obstruction identified |

### 6.4 AC-pack structure (standing format)

Once the `@platform/ac-pack-generator` substrate is built (registered gap — Thandiwe §16, Atlas roadmap), the quarterly IAF pack will be a generated query over the audit-finding event log, not an authored document. In the interim, Thandiwe authors the pack using the template sections specified in IA Charter v1 §7.1. Pack sections are: (a) CAE third-line opinion; (b) Vera pipeline summary; (c) open findings register; (d) closed findings in period; (e) combined-assurance map; (f) independence and conflicts update; (g) substrate gaps.

### 6.5 Escalation channel discipline

All IAF escalation channels are typed events (`AgentEscalation`). Side-channel escalations — whether through Scrooge (Chief of Staff, orchestrator), direct chat to the CEO, or ad-hoc written note — are findings under the IA Charter §2.4. The AC chair (Owen, interim) has standing unmediated access from Thandiwe; whistleblowing disclosures naming C-suite executives route sealed to Owen directly, with the CEO informed only after the AC pathway.

---

*Owen (Company Secretary, governance) — IAF secretariat, 2026-05-12*  
*Policy-layer citations: Companies Act 71 of 2008 ss.94–95; King IV Principle 15 / Practice 26; IIA IPPF / Global Internal Audit Standards (2024); BCBS 223 — Internal Audit Function in Banks.*
