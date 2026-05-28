---
policy-id: health-safety-policy
title: Health and Safety Policy v1
version: "1"
status: CORPORATE-BIND
owner: Devon (Chief Operating Officer, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - Occupational Health and Safety Act 85 of 1993 (OHS Act)
  - OHS Act s.8 (general duty of care — employer to employees)
  - OHS Act s.9 (general duty of care — employer to non-employees)
  - OHS Act s.16 (designation of person to perform duties — CEO accountable person)
  - OHS Act s.17 (health and safety representatives)
  - OHS Act s.24 (incident reporting to Department of Employment and Labour)
  - Compensation for Occupational Injuries and Diseases Act 130 of 1993 (COIDA)
  - Basic Conditions of Employment Act 75 of 1997 (working hours and rest)
  - Labour Relations Act 66 of 1995
author: Devon (Chief Operating Officer, governance)
date: 2026-05-22
summary: Health and Safety Policy establishing the OHS Act framework for Hoz Bank's build-phase thin human layer operating primarily remotely; CEO as accountable person under OHS Act s.16; Devon as de facto H&S representative; incident reporting procedure; risk assessment requirement for physical workspaces; remote working ergonomic guidance; first-aid and emergency evacuation provisions at permanent office; annual OHS review. Typed events OhsIncidentReported, OhsRiskAssessmentCompleted. CORPORATE-BIND.
decision-required: false
riskTaxonomy:
  - RT-OR
obligations:
  - ORG-HR-09
---

# Health and Safety Policy v1

> **Authors.** Devon (Chief Operating Officer, governance) — sole author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Implements the Occupational Health and Safety Act 85 of 1993 (OHS Act) employer obligations. CORPORATE-BIND applies now: the OHS Act binds from the moment the Bank has employees or workers, including during the build phase where the thin human layer includes the CEO (Marc) and any contractors or service providers performing work on the Bank's behalf.
> **Obligations closed.** OHS Act s.8 (general duty to provide safe working environment); s.9 (duty to non-employees); s.16 (appointment of accountable person); s.17 (H&S representative); s.24 (incident reporting). COIDA (compensation for occupational injuries — registration with the Compensation Fund is required at the first employee appointment).
> **Status.** CORPORATE-BIND. The OHS Act's obligations bind from the moment the employer has workers. Build-phase scope: the Bank's thin human layer (Marc as CEO, and any contractors engaged for build-phase work) requires the OHS Act framework to be in place. Physical office obligations (H&S committee, first-aid officer, evacuation drill) activate when a leased permanent office is established.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Health and Safety — Overarching

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual OHS review; incident reporting is continuous · **Citation:** OHS Act 85 of 1993 s.8, s.9, s.16, s.17, s.24 + COIDA 130 of 1993 + BCOA 75 of 1997 + LRA 66 of 1995

### Purpose

This policy sets out Hoz Bank Limited's (the "Bank's") commitment to providing a safe and healthy working environment for all workers — employees, contractors, and any other persons who may be affected by the Bank's activities — in accordance with the Occupational Health and Safety Act 85 of 1993 (OHS Act).

The Bank's current operating model is distinctive: during the build phase, the human layer is intentionally thin (per `project_ai_driven_bank.md`). The majority of work is performed by autonomous AI agents. Human workers (primarily the CEO, Marc, and any engaged contractors) operate primarily in remote and co-working space environments; there is no dedicated permanent office. This means that many traditional OHS obligations (H&S committee under OHS Act s.19; designated first-aid officer for a fixed workplace; fire evacuation drills) apply in a modified form or are deferred until a permanent office is established.

The OHS Act still binds. The duty of care (s.8) requires the Bank to take all reasonably practicable steps to ensure the safety of workers in whatever environment they work. For remote workers, this translates primarily to: ergonomic guidance, mental health support, safe working-hours culture, and a clear incident reporting channel. For any contractor working on the Bank's behalf at a physical location (data centre, co-working space, client premises), the s.9 duty to non-employees also applies.

### Principles

- **CEO is the OHS Act accountable person.** Under OHS Act s.16, the CEO (Marc) is the accountable person responsible for compliance with the OHS Act. This obligation may not be delegated away; Devon administers the framework on the CEO's behalf but the statutory accountability rests with the CEO. Marc's s.16 designation is recorded and filed by Owen (Company Secretary, governance).
- **Devon is the de facto H&S representative during the build phase.** OHS Act s.17 requires the designation of an H&S representative for workplaces above a defined employee threshold. During the build phase, Devon acts as the de facto H&S representative. When the Bank establishes its first permanent office and reaches the applicable employee threshold, a formal H&S representative is designated (and, if required by the OHS Act, a H&S committee is established).
- **Every incident is reported and recorded.** Any work-related injury, illness, near-miss, or dangerous occurrence is reported by the affected worker to Devon immediately. Devon assesses whether the incident meets the OHS Act s.24 reporting threshold (serious injury, occupational disease, dangerous occurrence) and, if so, notifies the Department of Employment and Labour within the prescribed timeframe. Every incident is recorded as a typed event.
- **Safe working environment is actively maintained.** The Bank does not treat health and safety as a passive obligation. Devon actively monitors: working-hours patterns (per BCEA — no worker should regularly exceed the prescribed maximum working hours without a compensating arrangement); ergonomic risks for remote workers; psychological well-being (particularly relevant for a high-intensity build phase); and any physical workspace risks when workers are in co-working spaces or contractor environments.
- **Events-first H&S recording.** All OHS incidents, risk assessments, H&S representative designations, and OHS reviews are typed events in the event log (Principle 1). Paper-only H&S records are not acceptable.

### Roles

Marc (CEO) is the accountable person under OHS Act s.16. Marc approves this policy and the annual OHS review.

Devon (Chief Operating Officer, governance) is the policy owner and de facto H&S representative. Devon administers the OHS framework, receives incident reports, assesses DoEL notification obligations, and conducts the annual OHS review.

Owen (Company Secretary, governance) files the CEO's s.16 designation and maintains the statutory records register for OHS compliance.

Sade (AgentOps & Token Efficiency Engineer, engineering) monitors agent-side workload patterns; human-side workload monitoring for the thin human layer is Devon's responsibility.

---

## 2. Scope — Build Phase

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** COO · **Cadence:** Scope reviewed when physical office established · **Citation:** OHS Act 85 of 1993 + COIDA 130 of 1993

### 2.1 Current Build-Phase Scope

The OHS Act's employer obligations currently apply to:

1. **Marc (CEO, natural person):** primarily working remotely from home or co-working spaces. Devon is responsible for the ergonomic and safe-working-hours guidance applicable to remote work.
2. **Any contractor engaged by the Bank:** any natural person contractor performing work on the Bank's behalf, at any location, is covered by the OHS Act's protections. Before engaging any contractor, Devon confirms: (a) the contractor's work environment has been assessed; (b) any H&S risks associated with the contractor's work for the Bank have been identified; (c) appropriate safeguards are in place.
3. **COIDA registration:** upon the first formal employment appointment (not build-phase contractor engagement), Devon registers the Bank with the Compensation Fund under COIDA. COIDA registration is not required for purely AI-agent operations; it activates upon appointment of the first human employee.

### 2.2 Future Permanent Office Scope (Deferred)

When the Bank establishes its first permanent leased office, the following OHS obligations activate:

- Written H&S risk assessment for the office premises (including fire escape, first-aid facilities, electrical safety).
- Designation of a formal H&S representative under OHS Act s.17.
- H&S committee if the employee count reaches the applicable threshold.
- Designated first-aid officer(s) and stocked first-aid kit(s).
- Written emergency evacuation plan; evacuation drill within 30 days of first occupation.
- Fire safety compliance (Fire Brigade Services Act 99 of 1987 at the municipality level).

Devon triggers the permanent-office OHS activation procedure upon signing the first office lease. A `OhsRiskAssessmentCompleted` event for the new office premises is required within 30 days of occupation.

---

## 3. Incident Reporting

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** COO · **Cadence:** Continuous; DoEL notification within 7 days of serious incident (OHS Act s.24) · **Citation:** OHS Act s.24 + COIDA 130 of 1993 + `Procedures/by-policy/ohs-incident.md`

### 3.1 Incident Definition and Reporting

Any of the following must be reported to Devon immediately:

- Work-related injury (any injury sustained while performing work for the Bank, at any location).
- Occupational disease (any illness reasonably attributed to working conditions or exposures associated with work for the Bank).
- Near-miss (any event that did not result in injury or illness but had the potential to do so).
- Dangerous occurrence (any incident specified in the OHS Act's list of dangerous occurrences — relevant if the Bank operates any plant, machinery, or hazardous substance; currently very limited scope).

Reporting channel: immediate notification to Devon via secure message or call. Devon logs the incident in the incident register and emits a `OhsIncidentReported { incidentId, type, description, location, reportedBy, occurredAt }` event.

### 3.2 DoEL Notification (OHS Act s.24)

OHS Act s.24 requires the employer to report to the Department of Employment and Labour within 7 days any incident where a worker: (a) dies; (b) becomes unconscious; (c) loses a limb or part of a limb; (d) is injured or becomes ill to the extent that they will be absent from work for more than 14 days; or (e) is involved in a dangerous occurrence that had the potential for serious injury or death.

Devon assesses each reported incident against these criteria. If notification is required: Devon prepares the incident report (OHS Act prescribed form); Owen files the notification to the DoEL within 7 days of the incident; the filing is recorded as a typed event update to `OhsIncidentReported`.

---

## 4. Risk Assessment

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** COO · **Cadence:** Before any new physical workspace is occupied; annually for existing workspaces · **Citation:** OHS Act s.8 + SANS 10366 (Health and Safety in the Office — informative reference)

A written risk assessment is required before any physical workspace (including co-working spaces used regularly) is occupied for Bank-related work. The risk assessment identifies: physical hazards (ergonomic, electrical, fire); environmental hazards (ventilation, temperature, lighting); emergency facilities (fire exits, first aid).

Devon conducts the risk assessment personally or engages a qualified OHS consultant for larger spaces. The risk assessment is filed as a `OhsRiskAssessmentCompleted { assessmentId, location, assessedBy, assessedAt, findings[], mitigations[] }` event.

For co-working spaces used by the CEO: Devon performs a simplified ergonomic and safety check of the space at least annually. A `OhsRiskAssessmentCompleted` event is emitted for each assessed space.

---

## 5. Remote Working Health and Safety

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** COO · **Cadence:** Guidance distributed to all workers; reviewed annually · **Citation:** OHS Act s.8 + BCEA 75 of 1997 (working hours) + COIDA 130 of 1993

The Bank acknowledges that remote work introduces specific H&S considerations:

**Ergonomics.** Devon provides remote working ergonomic guidance to all workers: appropriate desk, chair, and screen setup; regular breaks from screen work; lighting and ventilation requirements. Workers who report ergonomic discomfort are supported by Devon in addressing the issue; where necessary, equipment assistance is provided.

**Working hours.** The BCEA prescribes maximum ordinary hours of work and rest provisions. Devon monitors that the thin human layer does not operate in a pattern that violates BCEA working-hours provisions. The Bank's culture during the build phase is high-intensity but not deliberately unsustainable; Devon is the responsible authority for identifying and addressing concerning working-hours patterns in the human layer.

**Mental health.** Remote, high-intensity build-phase work carries mental health risk. Devon maintains an open communication channel with Marc (CEO) for any health concerns. If mental health support is required, Devon facilitates access to appropriate professional support.

**Home office injuries.** An injury sustained while working at home during working hours is a workplace injury under COIDA (subject to the facts of the specific incident). Workers must report all injuries, including home office injuries, to Devon immediately.

---

## 6. Annual OHS Review

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** CEO · **Cadence:** Annual; triggered on material change to workforce or workspace · **Citation:** OHS Act s.8 + OHS Act Regulations (General Safety Regulations)

Devon conducts an annual OHS review covering: incident register review (all incidents in the period, root causes, corrective actions); risk assessment currency (all assessments up to date?); statutory compliance status (s.16 designation current; DoEL notifications filed where required; COIDA registration current); scope changes (any new workspace, new workers?); next-period H&S priorities.

The annual OHS review is presented to Marc (CEO) for approval and recorded as a `OhsRiskAssessmentCompleted` event (annual review scope). Owen files the review in the statutory records register.

---

## 7. Typed Events

This policy generates and consumes the following typed events (Principle 1):

| Event type | Trigger | Owner |
|---|---|---|
| `OhsIncidentReported` | Work-related injury, illness, near-miss, or dangerous occurrence reported | Devon |
| `OhsRiskAssessmentCompleted` | Risk assessment completed for a workspace; or annual OHS review completed | Devon |

---

## 8. Substrate Dependencies and Gaps

- **Incident register projection (Devon + Anya).** Projection over `OhsIncidentReported` events providing Devon's incident register. Low-volume; manual management acceptable in build phase; simple projection when automated.
- **COIDA registration (Devon + Owen).** COIDA registration required upon first formal employment appointment. Currently not required (build phase, no employees); Devon activates on first hire.
- **Procedure pending full authoring:** `Procedures/by-policy/ohs-incident.md` — referenced in §3; full content to be authored by Devon.

---

## 9. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Devon (Chief Operating Officer, governance) | Initial policy authored. Six operative sections: (1) Overarching — CEO as OHS Act s.16 accountable person, Devon as de facto H&S representative, events-first recording; (2) Scope — build-phase remote scope + deferred permanent office obligations; (3) Incident Reporting — definition, DoEL notification under s.24; (4) Risk Assessment — workspace assessment before occupation; (5) Remote Working — ergonomics, working hours, mental health, home office injuries; (6) Annual OHS Review. |
