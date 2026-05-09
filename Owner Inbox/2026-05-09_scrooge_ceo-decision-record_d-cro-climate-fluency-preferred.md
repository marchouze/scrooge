---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-09T09:00:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-CRO-CLIMATE-FLUENCY, 2026-05-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file (event-substrate gap noted; written-direct under Principle 7 "steady-state vs current substrate"); this markdown is the human-readable mirror.

- **Decision ID:** `D-CRO-CLIMATE-FLUENCY`
- **Title:** Human CRO seat — climate-risk fluency posture in recruitment criteria
- **Action:** confirm (per Helena (Chief Risk Officer, governance) §2.3 + PAX (Role researcher) CRO §8 #1 default recommendation)
- **Outcome:** **Climate-risk fluency at PA Guidance Note 1 of 2024 depth is `Preferred` (NOT `Must-have`)** in the human CRO recruitment search.
  - Helena's PR #43 §2.3 drafted climate as `strongly preferred` with a CEO open question.
  - PAX's PR #63 CRO brief §8 #1 confirmed Helena's posture and asked the same open question.
  - The CEO has now confirmed `Preferred`. No drift between Helena's draft, PAX's recommendation, and the CEO answer; the open question closes.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "it is preferred" — chat-intake 2026-05-09.
- **Source proposals:**
  - `Owner Inbox/2026-05-09_helena_cro-seat-fit-and-proper-criteria.md` (PR #43) §2.3
  - `Owner Inbox/2026-05-09_pax_role-research_human-cro.md` (PR #63) §8 #1
- **Authority chain:** Extends `D-THIN-HUMAN-LAYER-MINIMUM` (resolved 2026-05-08; PR #24) — the approved 6-human composition includes a separate human CRO seat appointed before licence-application lodgment. This decision refines the *recruitment search criteria* for that seat. It sits at the *standard* layer of Principle 6's downward chain (governance-approved policy → recruitment-criteria standard).

## Rationale codified for the audit trail

The CEO accepts Helena and PAX's converged reasoning:

1. **Engineering-not-governance.** Climate-risk substrate work (taxonomy treatment, scenario analysis, transition-vs-physical decomposition, disclosure tagging) is engineered by Rohan (Risk engineer) + Anya (Data / analytics engineer). The CRO *governs* the substrate, not authors it. So climate-fluency depth is recoverable through the engineering line if the CRO arrives without it.

2. **Pool-size economics.** PAX's labour-market evidence (CRO brief §3.5) shows the SA candidate pool satisfying must-haves + strongly-preferreds is ~5–10. Hardening climate to must-have shrinks the pool to ~2–3. The licence-application gate has a finite cadence; a small pool with offer-stage delays is more expensive than onboarding climate-fluency post-appointment.

3. **PA Guidance Note 1 of 2024 is guidance, not Directive.** SA PA practice reads to it for supervisory dialogue but it is not yet binding. The CRO can develop PA-GN-1/2024 dialogue depth in the first 6–12 months under Helena (Chief Risk Officer, governance)'s engineering-line transition. If the PA upgrades the Note to Directive status before licence-day, this decision can be revisited (see "What this does not preclude" below).

4. **No CRO-onboarding-credibility risk.** PA pre-application engagement reads strongly on prior-named-CRO experience, JS 1 of 2024 fit-and-proper readiness, and risk-taxonomy fluency across the bank's product perimeter. Climate-fluency depth is one input among many on PA's read; not the dispositive one.

## What this does not preclude

- **Future hardening if PA upgrades the Guidance Note.** If PA Guidance Note 1 of 2024 becomes a Directive (or a binding Joint Standard analogue lands), `D-CRO-CLIMATE-FLUENCY-V2` opens with the harder must-have framing.
- **Future hardening on candidate evidence.** If the CRO long-list at PAX-research-completion shows >5 candidates with climate-fluency-at-depth, the search criteria can harden case-by-case at long-list-finalisation without re-opening this decision.
- **Climate-fluency in the substrate layer.** Anya and Rohan's substrate-engineering on climate risk is unchanged by this decision. The substrate must support PA Guidance Note 1 of 2024 expectations regardless of the CRO's depth at appointment-day.

## Follow-on routes recorded

- `agent:PAX (Role researcher)` — close §8 #1 in `Owner Inbox/2026-05-09_pax_role-research_human-cro.md` (PR #63) by adding a "Decision: Preferred (D-CRO-CLIMATE-FLUENCY confirmed 2026-05-09)" annotation. The body remains as authored — the rationale stands; the open question is now resolved.
- `agent:Helena (Chief Risk Officer, governance)` — close §6 #3 in `Owner Inbox/2026-05-09_helena_cro-seat-fit-and-proper-criteria.md` (PR #43) by adding the same annotation. The §2.3 `strongly preferred` posture stands.
- `agent:Nolan (Recruiter)` — update `Team Inbox/2026-05-09_nolan_recruitment_human-cro.md` (PR #46) search-criteria section: climate-fluency stays in the `Strongly preferred` column; the PR may not need a code update since "preferred" is what was already drafted; Nolan reads this decision and confirms the existing copy without amending.
- `agent:Mira (Compliance / RegTech engineer)` — note for the obligations register: PA Guidance Note 1 of 2024 is in the register (or should be) under Domain CY-08 / PR-04 onwards; CEO's `Preferred` framing is a *recruitment-criteria* decision, not an obligation downgrade. No register status change needed.

This decision does NOT trigger any code-side substrate work. The remaining items in the broader CRO-seat criteria conversation (PA pre-application timing, signatory authority, foreign-hire critical-skills permit, CoSec-vs-CRO sequencing, audit-firm RFP coherence, compensation→Camille) remain open and unresolved by this decision.

## Substrate gaps surfaced

1. **CeoDecision event substrate** — recurring gap; Atlas (Core banking platform architect) v1.
2. **Climate-risk substrate** — Rohan (Risk engineer) + Anya (Data / analytics engineer) substrate work to support PA Guidance Note 1 of 2024 expectations; not blocked by this decision but called out for cadence-tracking.
3. **CRO-recruitment-criteria-as-code** — PAX named this in CRO brief §9; the criteria are markdown today, should become a typed `FitAndProperCriterion` event series for substrate-side composition. Owner: PAX + Nolan (Recruiter) + Sade (AgentOps engineer); target: post-thin-human-layer-substrate.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler (substrate-gap fallback: written directly by Scrooge in-session per Principle 7). The `CeoDecision` event is the canonical record once the v1 substrate lands; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.

—Scrooge (Chief of Staff / Orchestrator)
