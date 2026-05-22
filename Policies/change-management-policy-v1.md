---
policy-id: change-management-policy
title: Change Management Policy v1
version: "1"
status: CORPORATE-BIND
owner: Devon (Chief Operating Officer, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - Banks Act 94 of 1990 s.60 (risk management systems)
  - Regulations Relating to Banks 2012 (as amended) reg.39 (internal controls)
  - PA/FSCA Joint Standard 2 of 2024 s.6 (technology change governance)
  - COBIT 2019 (IT governance framework — informative reference)
author: Devon (Chief Operating Officer, governance) + Atlas (Core banking platform architect, engineering)
date: 2026-05-22
summary: Change Management Policy establishing the Standard/Normal/Emergency change taxonomy, Change Advisory Board (CAB) composition and quorum, change freeze windows, emergency change ratification, mandatory rollback plans, agent-runtime deployment gate, and typed events ChangeApproved, ChangeDeployed, ChangeRolledBack. CORPORATE-BIND — binds from now in the build phase.
decision-required: false
riskTaxonomy:
  - RT-OR
  - RT-TOR
---

# Change Management Policy v1

> **Authors.** Devon (Chief Operating Officer, governance) — lead; Atlas (Core banking platform architect, engineering) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Implements Banks Act 94 of 1990 s.60 risk management system obligations and Regulations Relating to Banks reg.39 internal control requirements. Aligns with PA/FSCA Joint Standard 2 of 2024 s.6 (technology change governance for banks). The Secure SDLC Policy (`Policies/secure-sdlc-policy-v1.md`) is the software-specific sub-policy sitting beneath this policy at the procedure layer.
> **Obligations closed.** Banks Act s.60 (risk management systems — change governance as a key control); Regulations Relating to Banks reg.39 (internal controls — change management as a detective/preventive control pair); PA/FSCA JS-2 s.6 (technology change governance).
> **Status.** CORPORATE-BIND. Change management applies immediately in the build phase: every change to the production event store, the agent-runtime harness, the payment platform, or the regulatory reporting substrate must comply with this policy from the moment this policy is effective. Build-phase changes are the highest-risk changes in the Bank's lifecycle; the CAB provides the governance layer that ensures changes do not corrupt the event log or destabilise the infrastructure on which commencement-of-trading depends.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Change Management — Overarching

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual policy review; CAB meets weekly during active build phase; emergency CAB on-demand · **Citation:** Banks Act 94 of 1990 s.60 + Regulations Relating to Banks reg.39 + PA/FSCA Joint Standard 2 of 2024 s.6

### Purpose

This policy governs how Hoz Bank Limited (the "Bank") manages changes to its technology infrastructure, platform, application layer, configuration, and operational procedures. Its purpose is to ensure that: (i) every change to the Bank's production environment is approved, tested, and documented before deployment; (ii) changes do not introduce unacceptable operational risk, system instability, or regulatory non-compliance; (iii) a rollback plan exists for every Normal and Emergency change; and (iv) the audit trail for every production change is complete, typed, and immutable.

Change management is the governance bridge between the software engineering lifecycle (governed by the Secure SDLC Policy) and the production operations environment. The Secure SDLC Policy governs the development and testing process; this policy governs the deployment and change approval process.

The Bank's change management framework follows the industry-standard three-category taxonomy: Standard (pre-approved routine), Normal (CAB-approved), and Emergency (post-hoc ratification). COBIT 2019 is an informative reference; the Bank's framework is calibrated to its scale and risk profile, not a full COBIT implementation.

### Principles

- **Every production change is a typed event.** Every change deployed to the production environment — whether Standard, Normal, or Emergency — results in a `ChangeDeployed { changeId, changeType, description, deployedBy, deployedAt, ciGateRef }` event in the event log (Principle 1). No production change proceeds without this event. A production deployment without a `ChangeDeployed` event is a policy violation reportable to Vera.
- **CI gate is a hard prerequisite.** Every code change must pass `bun run ci` from `prototype/` (full-project TypeScript typecheck + tests) before being approved by the CAB. The CAB does not approve a change that has not passed CI. CI gate failure overrides CAB approval.
- **Rollback plan is mandatory for Normal and Emergency changes.** Every Normal and Emergency change must have a documented rollback plan before the change is approved. The rollback plan must specify: (a) the trigger condition for rollback; (b) the specific steps to reverse the change; (c) the rollback time estimate; (d) who authorises the rollback. A change without a rollback plan is not approved.
- **Events-first change accounting.** The change record is the set of typed events (`ChangeApproved`, `ChangeDeployed`, optionally `ChangeRolledBack`), not a separate CMDB entry. The change management projection (owned by Atlas) renders the change history from these events.

### Roles

Devon (Chief Operating Officer, governance) is the policy owner and chairs the Change Advisory Board (CAB). Devon has final approval authority over all Normal changes.

Atlas (Core banking platform architect, engineering) is the Standing Technical Authority on the CAB. Atlas reviews the technical risk assessment for every Normal and Emergency change and approves the rollback plan. Atlas owns the change management projection and the CI gate infrastructure.

Senna (Cybersecurity & infrastructure engineer, engineering) is a standing CAB member for all changes with a security or infrastructure dimension. Senna reviews changes for security implications under the Information Security and IT Governance Policy.

Kai (Trading systems engineer, engineering) is a standing CAB member for changes to the trading system, confirmation platform, or market data infrastructure.

Tomas (Operations & payments engineer, engineering) is a standing CAB member for changes to the payment platform, settlement infrastructure, or nostro management tooling.

Helena (Chief Risk Officer, governance) attends CAB for risk-significant changes (defined in §2 below).

The CEO is notified of all Emergency changes and approves Emergency changes above the materiality threshold defined in §4.

---

## 2. Change Category Taxonomy

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** COO for taxonomy changes · **Cadence:** Applied to every change request · **Citation:** PA/FSCA Joint Standard 2 of 2024 s.6

### 2.1 Standard Changes (Pre-Approved)

Standard changes are routine, low-risk changes for which the risk profile is well understood and a CAB-approved implementation procedure exists. Standard changes may be deployed without a CAB meeting; they require only pre-change review by the implementing engineer against the pre-approved Standard Change catalogue.

Examples of Standard changes:
- Dependency version upgrades within pre-approved version ranges (patch releases of validated dependencies).
- Addition of a new agent persona file to the `/Team/` directory.
- Configuration updates within pre-approved configuration ranges (e.g., adjusting log verbosity).
- Scheduled database index maintenance.

Atlas maintains the Standard Change catalogue. A change may only be executed as Standard if it appears in the approved catalogue. Any change that is not in the catalogue must be processed as Normal.

Standard changes are logged by the implementing engineer as `ChangeDeployed { changeType: "standard" }` events; no `ChangeApproved` event is required (the catalogue approval covers the class).

### 2.2 Normal Changes (CAB-Approved)

Normal changes are any production changes that are not Standard and not Emergency. Normal changes require CAB approval before deployment. The Normal change process is:

1. **Change Request submission.** The requesting engineer or agent submits a Change Request (CR) to Devon (via the break-tracking / change-request channel) with: description; affected systems; risk assessment; test evidence (CI gate reference); rollback plan; proposed deployment window.
2. **CAB review.** Devon convenes a CAB meeting (or async approval for low-risk Normal changes). CAB reviews the CR against the approval criteria in §2.4.
3. **CAB approval.** Devon formally approves; `ChangeApproved { changeId, changeType: "normal", approvedBy: "devon", approvedAt, cabMinutesRef }` event is emitted.
4. **Deployment.** The change is deployed in the approved window; `ChangeDeployed { changeId, changeType: "normal", deployedAt }` event is emitted.
5. **Post-implementation review.** For material Normal changes, Atlas conducts a post-implementation review within 5 business days of deployment.

Risk-significant Normal changes (changes to: the event store schema; the payment instruction engine; the agent-runtime harness; the CI pipeline; or any change involving personal data per POPIA) require Helena's attendance at the CAB and her explicit no-objection before approval.

### 2.3 Emergency Changes (Post-Hoc Ratification)

Emergency changes are changes that must be deployed immediately to: (a) restore a failed production service; (b) close a critical security vulnerability (per Senna's assessment); or (c) correct a regulatory reporting error with a time-critical filing deadline.

Emergency changes are deployed without prior CAB approval. The Emergency change process is:

1. **Emergency identification.** The engineer or agent identifies the emergency and escalates to Devon immediately. Devon authorises the emergency change verbally (or by written message for audit trail); a `ChangeApproved { changeType: "emergency", approvedBy: "devon" }` event is emitted before deployment where possible; if the emergency is so urgent that pre-deployment event emission is impractical, the event is emitted immediately post-deployment.
2. **Deployment.** The change is deployed; `ChangeDeployed { changeId, changeType: "emergency" }` event emitted.
3. **CAB ratification.** Within 24 hours of an Emergency change deployment, Devon convenes a CAB ratification meeting. CAB reviews: was the change genuinely emergency; was the correct change deployed; is the system stable; is a permanent fix required (separate Normal change). The ratification is recorded in the CAB minutes.
4. **Post-implementation review.** Mandatory for every Emergency change, completed within 3 business days.

Emergency changes that involve personal data under POPIA, or that affect regulatory reporting systems, require notification to Zara (Chief Compliance Officer, governance) within 24 hours.

### 2.4 CAB Approval Criteria

The CAB applies the following criteria when reviewing a Normal change:

1. Has the change passed `bun run ci` from `prototype/`? (Hard prerequisite — no exceptions.)
2. Has the change been reviewed by a second engineer (peer review in the SDLC, per Secure SDLC Policy)?
3. Is the rollback plan documented and technically sound (Atlas's assessment)?
4. Is the proposed deployment window appropriate (not during a freeze window per §3)?
5. Are the affected systems correctly identified and all downstream dependencies considered?
6. For changes to the agent-runtime harness or payment platform: has the agent-runtime deploy procedure been followed (`Procedures/by-policy/agent-runtime-deploy.md`)?

---

## 3. Change Freeze Windows

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** COO to declare freeze; CEO to lift a freeze for emergency · **Cadence:** Freeze windows are pre-scheduled; may also be declared ad-hoc · **Citation:** Regulations Relating to Banks reg.39 (internal controls — stability during critical periods)

Normal and Standard changes (except security emergency patches and critical bug fixes) are prohibited during the following freeze windows:

1. **Pre-licence-go-live readiness gate.** A change freeze is declared by Devon at the T-14 day mark before the pre-licence go-live readiness gate assessment. Only Critical security vulnerability fixes (Senna's assessment) and Emergency changes are permitted during this window.
2. **Month-end close window.** A change freeze covers the period from business day T-2 before month-end close to business day T+2 after month-end close confirmation by Camille (Chief Financial Officer, governance). Only Emergency changes affecting the GL close process are permitted.
3. **Regulatory submission periods.** A change freeze covers the period from T-3 before a regulatory submission deadline (BA-returns, FIC reports, FSCA notifications) to T+1 after the submission is confirmed by Mira (Regulatory reporting engineer, engineering). Only Emergency changes related to the submission itself are permitted.
4. **Ad-hoc freeze.** Devon may declare an ad-hoc freeze at any time for operational stability reasons (e.g., following an incident where the root cause is not yet understood). An ad-hoc freeze is time-bounded (maximum 10 business days without CEO extension) and is recorded as a `ChangeFreezeActivated { reason, startDate, endDate }` typed event.

Emergency changes during a freeze require CEO approval (not COO) above ZAR 0 risk-significance; i.e., any Emergency change during a freeze must be approved by the CEO, not Devon alone.

---

## 4. Agent-Runtime Deployment Gate

**Owner:** Devon (Chief Operating Officer, governance) — governance; Atlas (Core banking platform architect, engineering) — technical gate · **Approval:** COO for agent-runtime changes; CEO for new agent capabilities or scope expansions · **Cadence:** Applied to every agent-runtime change · **Citation:** Banks Act 94 of 1990 s.60 + PA/FSCA Joint Standard 2 of 2024 s.6 (AI systems change governance) + `Policies/agent-operations-policy-v1.md`

Changes to the agent-runtime harness — including: new agent deployments; agent capability scope changes; agent-runtime infrastructure changes; token budget configuration changes — follow the Agent Operations Policy's authorisation tiers in addition to this policy's Normal/Emergency change process. The two policies work together: this policy provides the change management governance; the Agent Operations Policy provides the agent-specific authorisation tiers.

The agent-runtime deploy procedure (`Procedures/by-policy/agent-runtime-deploy.md`) is the procedural operationalisation of both policies for agent-runtime deployments.

---

## 5. Typed Events

This policy generates and consumes the following typed events (Principle 1):

| Event type | Trigger | Owner |
|---|---|---|
| `ChangeApproved` | CAB approval (Normal) or COO verbal authorisation (Emergency) | Devon / Atlas |
| `ChangeDeployed` | Production deployment completed | Implementing engineer / agent |
| `ChangeRolledBack` | Rollback of a deployed change triggered | Implementing engineer / agent |
| `ChangeFreezeActivated` | Freeze window declared | Devon |
| `ChangeFreezeLifted` | Freeze window lifted | Devon / CEO |

---

## 6. Substrate Dependencies and Gaps

- **Change management projection (Atlas).** Projection over `ChangeApproved` / `ChangeDeployed` / `ChangeRolledBack` events providing the change history register. Discharge exit signal: change history visible in intranet dashboard under Operations view.
- **CI gate integration.** Every change must reference a passing `bun run ci` run. Currently manual (engineer attests CI pass in CR); automated CI gate reference (build artefact hash in the `ChangeApproved` event) is a roadmap item for Atlas.
- **Standard Change catalogue (Atlas).** Machine-readable catalogue of pre-approved Standard changes. Discharge exit signal: catalogue queryable via API; automated Standard change logging.
- **Procedure pending full authoring:** `Procedures/by-policy/agent-runtime-deploy.md` — referenced herein; full content to be authored by Atlas and Sade under Devon's direction.

---

## 7. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Devon (Chief Operating Officer, governance) + Atlas (Core banking platform architect, engineering) | Initial policy authored. Five operative sections: (1) Overarching — events-first change accounting, CI gate prerequisite, mandatory rollback plans; (2) Change Category Taxonomy — Standard/Normal/Emergency with CAB approval criteria; (3) Change Freeze Windows — pre-licence, month-end, regulatory submission, ad-hoc; (4) Agent-Runtime Deployment Gate; (5) Typed events. |
