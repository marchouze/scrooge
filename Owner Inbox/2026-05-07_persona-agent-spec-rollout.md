---
title: Persona-file upgrade pass — agent-spec rollout
author: Scrooge
date: 2026-05-07
summary: Agent-spec template authored; vanguard four personas (Vera, Atlas, Mira, Helena) upgraded; remaining 22 sequenced into four tranches. Reports-to corrections made for Atlas and Mira.
decision-required: false
---

# Persona-file upgrade pass — agent-spec rollout

**Author:** Scrooge (Chief of Staff)
**For:** Marc (CEO)
**Date:** 2026-05-07
**Authority:** Principle 7 (Autonomous by default; humans oversee the residual), added to CLAUDE.md on 2026-05-07. This is Step 1 of the four-step rollout (Steps in order: Vera CCM extension ✓ → persona-spec rollout → Atlas runtime substrate spec → procedure audit).
**Status:** **Template authored; vanguard four personas upgraded; remaining 22 sequenced into four tranches.**

> **Derivation note (Principle 6 — downward).** The persona library is curated by Scrooge; the agent-spec template enforces the structural fields Vera's Wave-4 #10 pipeline asserts.

---

## 1. What landed today

### 1.1 Agent-spec template

`Team/_agent-spec-template.md` — canonical template for every persona file. Sections 1–5 (Identity, Persona, Mandate, Areas of expertise, Working style) retained from the legacy format; Sections 6–17 are the operating spec — required for Wave-4 #10 to run green:

- **§6 Cadence** — mode, schedule, inactivity SLA.
- **§7 Triggers** — events / schedules / inbound-from-other-agents that wake this agent, with response SLAs.
- **§8 Inputs** — authoritative / derived / external.
- **§9 Decisions in scope** — the agent's authority surface, with criteria and typed outputs.
- **§10 Decisions that escalate** — typed `AgentEscalation` events with target overseer and deadline.
- **§11 Outputs** — events emitted, registers maintained, deliverables produced.
- **§12 System capabilities called** — paths to `@platform/<x>` capabilities (Wave-5 capability-creep audit consumes this list).
- **§13 Procedures owned** — links to `/Procedures/by-policy/<name>.md` files.
- **§14 Data contracts** — produced and consumed schemas.
- **§15 Independence / conflicts** — explicit statement of where outputs feed into another agent's oversight.
- **§16 Substrate gaps (current state)** — the runtime elements this agent currently lacks; populated until Atlas's Step 2 substrate lands.
- **§17 Change log** — version history.

### 1.2 Vanguard four — upgraded today

| Persona | Why in vanguard | Notes on changes beyond the spec sections |
|---|---|---|
| **Vera** | Already designed the agent-discipline assurance extension this morning; her work is intrinsically agent-shaped. | No reports-to change; agent-spec sections added; conflicts register populated with two new entries (substrate-design contribution; template-design contribution). |
| **Atlas** | Owns the runtime substrate the rest of the fleet runs on. Step 2 spec needs an agent-shaped Atlas to author it. | **Reports-to corrected: Scrooge → Devon (COO)** per top-of-house structure (memory record `project_top_of_house_structure.md`). Mandate explicitly extended to include the agent-runtime substrate. |
| **Mira** | Continuous compliance work (sanctions, transaction monitoring, register curation) is the strongest natural-fit case for autonomous-agent operation. | **Reports-to corrected: Scrooge → Zara (CCO)** per top-of-house structure. STR / CTR drafter / signer split clarified — Mira drafts; Zara as MLRO signs. |
| **Helena** | Governance-seat exemplar — ensures the template handles a non-engineering, "governs not builds" role cleanly. | No reports-to change (already CEO with BRC line). Independent-validation function flagged as substrate gap (PAX research / Nolan hire). |

### 1.3 Reports-to corrections made en passant

The legacy persona files had Atlas and Mira reporting to Scrooge. Per the top-of-house structure (memory), engineering seats report through their governance home — Atlas → Devon (COO); Mira → Zara (CCO). Today's upgrades fix those two. Other engineering personas to be re-checked as their tranche lands; the governance memory note is the source of truth.

## 2. What this unlocks

- **Vera's Wave-4 #10 pipeline (`agent-spec.ts`)** can now be implemented with non-trivial coverage: 4 of 26 persona files turn green; 22 turn red. Red is the audit signal that drives the rollout, not a defect.
- **Atlas can now author Step 2 (the runtime substrate spec)** as an agent-shaped author rather than as a character-sheet author. The substrate spec will reference Atlas's own `§9 Decisions in scope` and `§12 System capabilities called` — coherent.
- **Step 3 (procedure audit)** can begin against the procedures library knowing that procedure-owner fields will, over time, resolve to agent-shaped personas. For now, the audit flags both human-default-without-citation steps **and** owner-resolves-to-character-sheet entries.

## 3. Remaining 22 personas — proposed tranche sequence

Sequenced by (a) operational urgency — continuous-event personas first because their agent-shape unlocks the most procedure-actor checks; (b) governance-line completeness — governance seats early so engineering-persona reports-to fields resolve correctly; (c) reporting-line dependencies — supervisor first, supervisee second.

### Tranche 2 — governance backbone + critical engineering line (5 personas)

| Persona | Why next |
|---|---|
| **Owen** (CoSec) | Procedures-library custodian; secretariat for IAF; co-owns many procedures. Step 3 audit needs Owen agent-shaped. |
| **Zara** (CCO) | Mira's reports-to; MLRO signing authority; conduct + AML supervision. Mira's escalation chain only resolves once Zara is agent-shaped. |
| **Camille** (CFO) | Bea's and Yael's reports-to; ICAAP / ILAAP co-signatory; financial-statements ownership. Helena's escalation chain partly resolves through Camille. |
| **Devon** (COO) | Atlas's, Tomas's, Anya's, Niko's reports-to (interim Imani + Sade too); operational-resilience and change-management governance. Many escalation chains route through Devon. |
| **Rohan** (Risk engineer) | Builds Helena's measurement substrate; appetite-monitoring projection lands here. Helena's daily continuous cadence depends on Rohan being agent-shaped. |

### Tranche 3 — security, privacy, audit, operations (5 personas)

| Persona | Why next |
|---|---|
| **Senna** (Security engineer) | Co-owner of `secure-sdlc.md`, `incident-response.md`, `sanctions-screening.md`. Threat-model gate is a procedure step in many flows. |
| **Rashida** (CISO) | Senna's reports-to; Joint Standard 1 of 2024 programme owner; cyber-resilience policy. |
| **Iris** (Information Officer) | POPIA breach-notification ownership; DSAR procedure ownership; cross-border transfer assessments; lawful-basis register. |
| **Thandiwe** (CAE) | Vera's functional reports-to; quarterly opinion-pack signatory; combined-assurance map co-owner with Owen. |
| **Tomas** (Operations & payments engineer) | SAMOS / BankservAfrica / SWIFT operational continuous role; reconciliation pipelines; cut-off engineering. |

### Tranche 4 — finance, markets, treasury, data (6 personas)

| Persona | Why next |
|---|---|
| **Bea** (Accounting & financial-reporting engineer) | IFRS / BA returns / month-end-close — high-frequency continuous and scheduled work. |
| **Yael** (Tax engineer) | SARS / FATCA / CRS — annual + event-driven (every transaction VAT-classified). |
| **Anya** (Data / analytics engineer) | Semantic layer custodian; data-contract evolution gatekeeper; projection runtime co-owner with Atlas. |
| **Eitan** (Treasurer) | ALCO chair; Ravi's reports-to; SAMOS funding daily; LCR / NSFR. |
| **Saskia** (Head of Global Markets) | Kai's reports-to; trading conduct and surveillance; market-risk warehouse within CRO appetite. |
| **Ravi** (Treasury / ALM engineer) | Builds Eitan's measurement substrate; FTP attachment-on-product-event continuous cadence. |

### Tranche 5 — specialist / lower-frequency (4 personas)

| Persona | Why next |
|---|---|
| **Imani** (Legal-as-code engineer) | Contract execution; legal-entity tree; clause libraries; ECTA discipline. Co-owns several procedures with Mira. |
| **Sade** (HR systems engineer) | Payroll / BCEA / EE-B-BBEE / fit-and-proper. Mostly scheduled-cadence; smaller continuous surface. |
| **Niko** (Sales / CRM engineer) | Lead-to-client lifecycle; FAIS-compliant advice records. Co-owns customer-acceptance procedure with Mira / Zara. |
| **Kai** (Trading systems engineer) | OMS / EMS / FIX — continuous on every order, but the trading substrate is M2-phase, so urgency is lower than Bea / Tomas. |

### Tranche 6 — meta personas (2 personas)

| Persona | Why last |
|---|---|
| **PAX** | Role researcher; runs only when a hire is needed. Trigger surface is small; agent-shape is straightforward but low-frequency. |
| **Nolan** | Recruiter; runs only on PAX-output hand-off. Same posture. |

## 4. Sequencing and dependencies

- **Tranche 2 should land before Step 2 (Atlas's runtime substrate spec)** so the substrate spec's escalation chains and supervisor relationships resolve to real agent specs. Atlas's Step 2 is in flight today; Tranche 2 should follow this rollout note immediately, before the next Step-3 sweep.
- **Tranche 3 should land before the first Step-3 procedure audit pass** because half the populated procedures (10 of 11) have at least one Tranche-3 owner / co-owner.
- **Tranches 4–6 can run in parallel as bandwidth permits**; each persona upgrade is independent.
- Each tranche, when it lands, produces (a) updated `/Team/<name>.md` files; (b) a brief delta note appended to this file recording reports-to corrections, mandate-extension decisions, and any new substrate gaps identified.

## 5. Audit consequences

Vera's Wave-4 #10 (agent-spec integrity) will produce findings against the 22 unsupgraded personas. Per the agent-discipline assurance extension (`Owner Inbox/2026-05-07_vera_agent-discipline-assurance-extension.md` §3), the redness **is** the audit signal driving the rollout — not a defect. Closing the findings is the rollout's exit criterion.

## 6. Substrate-gap consolidation

The four upgraded personas each name substrate gaps in their `§16`. Consolidated:

- **Agent-runtime scheduler** (Atlas)
- **Event-trigger bus for agents** (Atlas)
- **Agent identity & permissioning** (Atlas + Senna + Rashida policy)
- **Escalation channel — `AgentEscalation` event type** (Atlas)
- **Oversight UI for the CEO** (Atlas)
- **Case-management substrate** for STR / CTR drafting (Mira + Atlas)
- **ICAAP / ILAAP engine** (Helena + Bea + Atlas)
- **BRC-paper generator** (Helena + Owen + Atlas)
- **Risk-appetite monitoring projection** (Rohan + Atlas)
- **Supervisory-correspondence register substrate** (Helena + Owen)
- **Independent model-validation function** (PAX research / Nolan hire — staffing, not substrate)
- **Opinion-pack generator** (Vera, post-CAE)
- **SSE / push notifications for pipeline reds** (Atlas)
- **Continuous-KYC orchestration** (Mira + Atlas)
- **Transaction-monitoring typology pipelines** (Mira)
- **PEP + adverse-media feeds** (Mira + Senna third-party-risk gating)

The consolidation feeds Atlas's Step 2 spec directly — Atlas knows what the fleet needs from the substrate before authoring it.

## 7. What this does *not* do (yet)

- No upgrade of Scrooge's own spec — Scrooge lives in `CLAUDE.md`, not `/Team/`. Scrooge's Principle-7-coherent shape is implicit in the new "How Scrooge operates" section. A standalone Scrooge-as-agent file may follow if useful for testing.
- No `AgentRegistration` event for the four upgraded personas — that is gated on Atlas's substrate. The agent specs are *spec-only* until the runtime registers them.
- No automation of the upgrade pass — each tranche is authored. As the substrate matures, agent-spec authoring may itself become a partly-automated pipeline (template-fill from procedure-ownership data); not today.

—Scrooge
