---
title: "Risk-Based Audit Plan v1 — Build Phase"
author: Thandiwe (Chief Audit Executive, governance)
date: 2026-05-15
decision-required: false
tags: [internal-audit, audit-plan, governance, third-line]
---

# Risk-Based Audit Plan v1 — Build Phase

**Document type:** Risk-Based Audit Plan  
**Owner:** Thandiwe (Chief Audit Executive, governance)  
**Review authority:** Interim Audit Forum (Owen (Company Secretary, governance), chair)  
**Approved:** 2026-05-15 — tabled at Interim Audit Forum for record  
**Next scheduled review:** At Thandiwe's next audit-committee-prep handler tick (quarterly)  
**Charter authority:** Internal Audit Charter v1 (`Owner Inbox/2026-05-11_thandiwe-vera_internal-audit-charter-v1.md`) — Section 5.1  
**Applicable standards:** IIA IPPF (Global Internal Audit Standards 2024); BCBS 223 Principles 3 and 5; King IV Principle 8  

---

## 1. Audit Mandate and Independence

### 1.1 Mandate

Thandiwe is the Chief Audit Executive of Hoz Bank Limited. Her mandate is the third line of defence: independent, risk-based assurance over the Bank's governance, risk management, and control environment. The mandate is established in the Internal Audit Charter v1, which was approved by the Interim Audit Forum on 2026-05-11.

The audit function encompasses:

- The risk-based audit plan (this document) and its annual refresh.
- The continuous-controls assurance programme, engineered by Vera (Internal audit engineer), operating under the CAE's direction.
- Quarterly third-line opinion to the Interim Audit Forum and, from licence-day, to the Board Audit Committee.
- External-auditor relationship management once an external auditor is appointed.
- Independent investigations of escalated whistleblowing and financial-crime matters.
- Quality Assurance and Improvement Programme (QAIP).

The scope of audit extends to all activities, agents, systems, event-store infrastructure, regulatory reporting, and third-party arrangements of the Bank — without restriction by management. Unrestricted read-only access to all event streams, registers, and data pipelines is a structural non-negotiable.

### 1.2 Reporting Line and Independence

Thandiwe reports **functionally** to the Interim Audit Forum, chaired by Owen. Functional oversight covers: Charter approval; audit-plan approval; receipt of quarterly and annual opinions; QAIP oversight; CAE appointment, performance, and removal. Management — including the CEO — does not direct, restrict, pre-clear, or suppress any audit opinion, finding, or scope decision.

Thandiwe reports **administratively** to the CEO for HR and operational-support matters only. The administrative line does not extend to audit scope, methodology, finding ratings, or opinion content. Where these lines conflict, the AC-chair pathway is primary; the CEO is informed after, not before.

### 1.3 Why Third-Line Independence Matters Here

Hoz Bank is an AI-driven institution under Principle 6 (autonomous-by-default). Every material decision, transaction, and control is executed by an autonomous agent operating against a typed event log. This architecture concentrates risk at the substrate layer — a misconfigured agent, a broken event schema, or a silent action that produces no event is a systemic failure, not an isolated incident. Third-line independence matters precisely because no human manual check stands between an agent decision and its consequence.

Audit independence in this context means: Thandiwe and Vera hold read-only access to event streams that no operational agent can suppress or alter. Audit's assurance conclusions derive from cryptographically-signed event data, not from management assertion. The CAE signs findings off evidence, not off description. This is not a procedural preference — it is the only epistemically valid basis for an opinion in an AI-native bank.

---

## 2. Audit Universe

The build-phase audit universe comprises the following domains. Each domain is classified by risk category and current substrate maturity.

| # | Domain | Risk Category | Maturity |
|---|---|---|---|
| AU-01 | Event-store integrity and Principle 1 compliance | Operational / Infrastructure | Live — `@platform/recon/harness.ts` |
| AU-02 | Decision-record completeness and event symmetry | Governance / Operational | Live — `@platform/recon/decision-event-recon.ts` |
| AU-03 | Agent-spec compliance and mandate integrity | Governance / Operational | Partial — Wave-4 #10 planned |
| AU-04 | Vera recon pipeline integrity | Operational / IT | Live — CI gates + nightly runs |
| AU-05 | Regulatory-readiness posture | Regulatory / Compliance | Live — `@platform/recon/fsca-reg-to-policy.ts`; obligations register |
| AU-06 | Data governance and schema evolution discipline | Data / Operational | Partial — Anya's contract-evolution discipline; no automated schema-break gate yet |
| AU-07 | Security controls (Rashida-led; IA independent review) | Security / IT | Partial — CISO programme underway; PA/FSCA Joint Standard 2 of 2024 |
| AU-08 | Financial control environment and capital adequacy readiness | Financial / Regulatory | Early — no real capital pre-licence; control environment under build |
| AU-09 | Persona-spec and procedure-actor discipline | Governance / Operational | Partial — `@platform/recon/mandate-ownership.ts` live; `procedure-actor.ts` planned |
| AU-10 | Citation discipline and canonical-source integrity | Data / Governance | Live — `@platform/citation/gate.ts` in CI |
| AU-11 | Combined-assurance coverage gaps | Governance / Multi-line | Early — tooling not yet built |
| AU-12 | Market-risk model and quantitative framework readiness | Market / Model | Early — Rohan's model substrate under build |

The audit universe is dynamic. New domains are added via `AuditUniverseRevised` events on material change to the Bank's risk profile, business model, or regulatory perimeter.

---

## 3. Risk-Based Prioritisation

### 3.1 Prioritisation Framework

Domains are ranked by three factors applied in sequence:

1. **Regulatory / licence risk** — does a failure in this domain block or jeopardise the SARB licence application or constitute a material prudential breach?
2. **Substrate maturity** — how close is the current build to being auditable? Domains with live substrate can be tested now; domains with planned substrate generate assurance-gap findings until the substrate lands.
3. **Vera's recon finding rate** — where Vera's pipelines are running, the observed violation rate is the leading risk indicator. High violation rates escalate domain priority.

### 3.2 Priority Tier 1 — Immediate Focus (Build Phase)

**AU-01: Event-store integrity.** Principle 1 makes the event log the sole source of truth. Any compromise to append-only semantics, hash-chain integrity, or event completeness is a systemic failure. SARB / PA would regard an event log that can be altered as an unreliable prudential record. Priority is Maximum. Vera's `harness.ts` is live; the gap is systematic coverage of hash-chain integrity across all event types, not merely ad-hoc runs.

**AU-02: Decision-record completeness and event symmetry.** Every CEO decision must exist as both a markdown record and a `CeoDecision` event; asymmetry means the governance record is incomplete. The decision-event gap audit (memory: `feedback_decision_event_gap_audit.md`) identified four historical gaps resolved in May 2026; the pipeline must now run continuously, not only on demand. A regulator reviewing governance practices at licence-application time will inspect decision records; incomplete records are a material finding.

**AU-05: Regulatory-readiness posture.** The Bank's licence application to SARB depends on demonstrating that the regulatory obligation chain — Regulation → Policy → Procedure → System Capability — is complete and traceable. Vera's `fsca-reg-to-policy.ts` pipeline and the obligations register are the primary instruments. Gaps in this chain are direct licence-application risks. Vera's finding rate here has historically been the highest of any pipeline.

### 3.3 Priority Tier 2 — Active Build Phase Monitoring

AU-03, AU-04, AU-09, AU-10: These domains have partial or live substrate. They are monitored continuously via Vera's pipelines; findings are issued at the standard lifecycle SLAs. No discrete planned audit engagement is required beyond pipeline operation; escalation occurs if the finding rate exceeds the materiality threshold in the audit charter.

### 3.4 Priority Tier 3 — Scheduled for Later Build Phase

AU-06, AU-07, AU-08, AU-11, AU-12: These domains depend on substrate not yet built (AU-11, AU-12), on a first-line programme that is still under active construction (AU-07, AU-08), or on automated tooling under development (AU-06). Thandiwe will commission discrete audit engagements in these domains as the substrate matures. Priority escalation events: first draft of the Model Risk Policy (AU-12 trigger); first draft of the Information Security Policy and Joint Standard 2 programme plan (AU-07 trigger); the pre-licence go-live readiness gate (AU-08 trigger).

---

## 4. Audit Programme — Build Phase

Four planned audit activities cover the three Tier-1 priority domains and the pipeline-integrity control over Vera's continuous programme.

### 4.1 Vera Recon Pipeline Review

**Scope:** All active Vera recon pipelines — citation gate, event-store harness, mandate-ownership, decision-event recon, prose-duplication, fsca-reg-to-policy, and parallel-dispatch-divergence. Pipeline scope includes: assertion contract accuracy, false-positive rate, false-negative risk, pipeline-failure handling, nightly run attestation.

**Trigger / cadence:** Weekly. Every Monday, Thandiwe reviews the prior week's `ReconResult` and `ReconViolation` event stream. Any pipeline that did not emit a `ReconResult` in the prior 24 hours is itself a finding (per the Internal Audit Charter Section 7.2).

**Output:** Weekly `CAEAttestation` event — attesting that pipelines ran, findings were reviewed, and no unresolved HIGH-severity violations are outstanding. Where violations exist, a summary is included in the attestation. Attestation is the heartbeat record; absence of an attestation for more than 7 days is a substrate alert.

### 4.2 Event-Store Integrity Audit

**Scope:** AU-01. Full integrity review of the `prototype/` event store: append-only semantics, hash-chain integrity across all event types, event completeness (every significant bank action representable by a typed event), schema-version consistency, and retention-policy implementation. The audit also covers the provenance-slice infrastructure (Slices 1–3, landed May 2026) and the BLAKE3 content-addressed document store introduced under D-RMS-PHASE-1.

**Trigger / cadence:** At the current-build-phase cadence — once following initial event-store substrate maturity (post-Phase-1 RMS landing); then quarterly thereafter aligned with the opinion-pack cycle. Current phase: initial run to be completed at Thandiwe's next scheduled quarterly tick following this plan's approval.

**Output:** `AuditFinding` events for each identified integrity gap; a consolidated findings summary in `Owner Inbox/` as a component of the quarterly opinion-pack input. Critical findings (hash-chain violations, deletions) trigger immediate `AgentEscalation` to the Interim Audit Forum and Atlas (Lead platform engineer, engineering).

### 4.3 Decision-Record Completeness Review

**Scope:** AU-02. Vera's `decision-event-recon.ts` pipeline provides continuous coverage; this discrete review supplements it. Scope: all `CeoDecision` events in the event store are matched against `Owner Inbox/` markdown records; asymmetries are findings. The review also covers the decision-scan limit fix (PR #7b90483) to confirm that the dashboard and decision-projection are not truncating the decision universe. The backfill pattern (`feedback_phase0_record_to_event_backfill.md`) is reviewed for completeness.

**Trigger / cadence:** Quarterly, aligned with the opinion-pack cycle. First run at Thandiwe's next quarterly tick.

**Output:** A completeness assertion table (decision ID, event present, markdown present, symmetry status) appended to the quarterly opinion-pack. `AuditFinding` events for any asymmetry not already captured by Vera's continuous pipeline.

### 4.4 Agent-Spec Compliance Spot-Check

**Scope:** AU-03. The 17-section operating-spec template at `Team/_agent-spec-template.md` is the canonical form for all persona files. Wave-4 #10 (`@platform/recon/agent-spec.ts`) will eventually enforce this via CI; until the pipeline lands, a manual spot-check is the assurance instrument. The spot-check samples a minimum of 5 persona files per run, rotating across the 27-agent roster to achieve full coverage over four quarterly runs.

**Trigger / cadence:** Quarterly, at the same tick as the decision-record review. Spot-check sampling is structured to achieve 100% roster coverage over one full year.

**Output:** Spot-check memo in `Owner Inbox/` listing files reviewed, conformance status, and any findings. `AuditFinding` events for any persona file lacking sections 6–17. Once Wave-4 #10 is live, this manual activity is retired and replaced by the pipeline output; the retirement is recorded as an `AuditPlanRevisionApproved` event.

---

## 5. Substrate Dependency

### 5.1 What Can Be Executed Autonomously Now

Vera's continuous recon pipelines provide the primary assurance instrument and operate without additional substrate:

- `@platform/citation/gate.ts` — citation-gate in CI (live).
- `@platform/recon/harness.ts` — event-store recon (live).
- `@platform/recon/mandate-ownership.ts` — mandate-ownership integrity (live).
- `@platform/recon/decision-event-recon.ts` — decision-event symmetry (live).
- `@platform/recon/prose-duplication.ts` — canonical-source enforcement (live since 2026-05-07).
- `@platform/recon/fsca-reg-to-policy.ts` — regulatory-readiness posture (live).
- `@platform/recon/parallel-dispatch-divergence.ts` — dispatch-pattern integrity (live).

The weekly `CAEAttestation` and the quarterly opinion-pack inputs can be generated from the event store once the opinion-pack generator substrate lands (see §5.2). Until then, Thandiwe authors these outputs directly from event-stream queries.

### 5.2 Substrate Not Yet Built — Dependency Register

The following substrate gaps constrain the audit programme. Each gap is a roadmap item, not a licence-blocking failure; the programme operates in degraded-but-functional mode pending each landing.

| Gap | Impact on audit programme | Owner | Target |
|---|---|---|---|
| `@platform/audit-universe` — risk-based plan derivation engine | Audit plan is authored manually; cannot be auto-derived from RAS / risk taxonomy. | Vera + Atlas (Lead platform engineer, engineering) | Pre-licence |
| `@platform/ac-pack-generator` — quarterly opinion-pack renderer | Opinion-pack is authored, not generated. Principle 1 says the markdown render should derive from events; today the render is primary. | Vera | ~6 weeks (co-timed with M2) |
| Issues-and-actions tracker | Findings lifecycle (open → in-remediation → closed) cannot be tracked as a typed projection; lives in the event store as individual events without a consolidated view. | Vera + Atlas | Pre-licence |
| Wave-4 #10 `@platform/recon/agent-spec.ts` | Agent-spec compliance spot-check (§4.4) cannot be automated; manual sampling is the bridging instrument. | Vera | Pre-licence |
| Wave-4 #11–15 pipelines (procedure-actor, mandate-agent, substrate-gap, escalation-channel, agent-scope) | Five planned pipelines covering AU-03, AU-09 in full scope are not yet live. Domains are in Tier-2 monitoring only. | Vera (CI gate) + Atlas (event-trigger bus) | Post-event-trigger bus landing |
| F-034 (`recon:circular-deps` CI gate) | 5 existing taxonomy barrel cycles block the gate from being wired into CI. | Vera (gate) + Atlas (cycle resolution) | Next Atlas taxonomy-barrel pass |
| Combined-assurance-map tooling | Cross-line coverage gap identification is manual; AU-11 cannot be systematically audited. | Vera + governance seats | Pre-licence |

Every gap listed above is also registered in `Team/Thandiwe.md` Section 16 and `Team/Vera.md` Section 16. Drift between these registers and the live gap list is itself a finding.

---

## 6. Reporting

### 6.1 Finding Severity and Routing

All audit findings follow the Internal Audit Charter v1 Section 8.4 lifecycle. Routing by severity:

| Severity | Trigger | Channel | SLA |
|---|---|---|---|
| Critical | Append-only violation; hash-chain break; fraud signal | `AgentEscalation` event — immediate — to Interim Audit Forum chair + CEO + relevant governance seat | Within 4h of identification |
| High (P1/P2) | Tier-1 RAS breach; material control failure; management access obstruction | `AgentEscalation` event to Interim Audit Forum chair; CAE triage within 24h | Within 24h |
| Medium (P3) | Procedure gap; persona-spec non-conformance; citation gap | `AuditFinding` event; finding tabled in next quarterly opinion-pack | Within 10 working days of identification |
| Low / Informational (P4) | Minor recon warnings; cosmetic spec gaps | Owner Inbox deliverable in quarterly digest | At CAE discretion; quarterly at minimum |

"P1/P2" and "P3/P4" are the audit-plan shorthand labels for the severity taxonomy in use. They correspond to Critical/High and Medium/Low respectively, and align with the `AuditFinding` severity field in the event schema.

### 6.2 Quarterly Digest to the Interim Audit Forum

Each quarter, Thandiwe submits a third-line opinion-pack to the Interim Audit Forum comprising:

- Pipeline summary: total `ReconResult` events, pass / warn / fail counts, open findings count by severity.
- Third-line opinion: `adequate`, `adequate with exceptions`, or `inadequate` — with evidentiary basis.
- Open findings register: all open findings with age, responsible party, and target closure date.
- Closed findings summary: findings closed in the quarter with closure evidence reference.
- Combined-assurance map status (manual, until tooling lands).
- Substrate-gap register update.
- Independence declaration and conflicts-register summary.

The pack is tabled via a `Owner Inbox/` deliverable at each quarter-end. A `ThirdLineOpinionSigned` event is emitted on sign-off. Until the `@platform/ac-pack-generator` substrate lands, the pack is authored by Thandiwe directly from event-stream queries and Vera's pipeline outputs. The authored markdown is the bridging form; it is superseded by a generated render once the substrate is live.

### 6.3 Immediate Escalation for Critical Findings

Critical findings bypass the quarterly cycle. The `AgentEscalation` event is the canonical channel. Side-channel escalations are supplementary only. The Interim Audit Forum chair (Owen) has the authority to convene an extraordinary session on receipt of any Critical escalation. This mirrors Internal Audit Charter v1 Section 8.3.

---

## 7. Next Review

This audit plan is reviewed:

1. **At Thandiwe's next audit-committee-prep handler tick** — the next quarterly scheduled run, at which point the plan is assessed against: new `AuditFinding` event patterns, updated RAS or risk-taxonomy inputs from Helena (Chief Risk Officer, governance), any new substrate gaps or substrate landings since this plan was tabled, and any regulatory developments affecting the Bank's obligation chain.

2. **On material trigger** — any of: a Critical finding emitted by Vera; a material change to the Bank's business model or risk profile; a new PA / FSCA directive; a Wave-4 pipeline landing that changes the coverage posture of a Tier-2 or Tier-3 domain; the pre-licence go-live readiness gate lighting green (which triggers a full plan revision to reflect the licence-day operating model).

On each review, a revised plan is tabled at the Interim Audit Forum and an `AuditPlanRevisionApproved` event is emitted. Minor resequencings within an approved framework are within the CAE's authority; material scope or coverage changes require Forum approval.

---

*Risk-Based Audit Plan v1. Tabled at Interim Audit Forum 2026-05-15 by Thandiwe (Chief Audit Executive, governance). Third-line independence is non-negotiable. Questions to Thandiwe or Owen (Company Secretary, governance) as Interim Audit Forum secretariat.*
