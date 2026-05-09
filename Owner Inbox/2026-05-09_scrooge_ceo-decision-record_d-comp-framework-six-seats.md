---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-09T16:05:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-COMP-FRAMEWORK-SIX-SEATS, 2026-05-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. Canonical authority is the `CeoDecision` event emitted alongside this file via `prototype/scripts/record-decisions-2026-05-09.ts`; this markdown is the human-readable mirror.

## Outcome

- **Decision ID:** `D-COMP-FRAMEWORK-SIX-SEATS`
- **Title:** Compensation framework — thin-human-layer six seats
- **Action:** approve as drafted
- **Source proposal:** [Owner Inbox/2026-05-09_camille_compensation-framework_thin-human-layer-six-seats.md](Owner%20Inbox/2026-05-09_camille_compensation-framework_thin-human-layer-six-seats.md)
- **Outcome:** Camille (Chief Financial Officer, governance)'s framework approved as drafted. Floor / Mid / Ceiling bands stand across all six seats (Independent Chair, Human CRO, Compliance Lead, Company Secretary, NED #2, NED #3). Mid-tier annual run-rate R17.45m (5.8% of R300m capital target); year-1 one-time ~R5.5m (R1.2m CRO sign-on + R4.3m search fees). Floor is the walk-away band; Ceiling is the CEO + Camille flex envelope at offer stage; Mid is the working centre-of-mass. Nolan (Recruiter, engineering team) applies bands across active search; offer-stage Ceiling escalations route to Camille first, then to Marc (CEO).
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "approve both" — chat-intake 2026-05-09.
- **Authority chain:** Governance / financial-management policy (Principle 6 *policy* layer). Implements parent CEO decision `D-HIRE-SIX-SEATS-PACK` (six approved hires) and the indicative compensation bands from each PAX role-brief. Capital-impact framing tied to the R300m strategic-foundation capital target.

## Follow-on routes recorded

- `agent:Nolan (Recruiter)` — apply Floor / Mid / Ceiling bands at offer-letter generation across all six active searches; flag any offer that approaches Ceiling for Camille pre-emission review.
- `agent:Camille (CFO, governance)` — at first-shortlist landing on each seat, pressure-test the Mid band against the actual candidate market; raise a `RecruitmentEscalationEvent` if Ceiling needs to flex (substrate gap: typed channel doesn't exist yet).
- `agent:Camille` — surface the **PEER-COMP register** substrate gap on the substrate-gap inventory: SA peer-bank disclosed-comp data (Standard Bank, Absa, Nedbank, FirstRand, Investec, Capitec, tier-2 banks) currently sourced ad-hoc per seat; needs canonical authoring location with Anya-driven ingestion from JSE-listed-bank annual disclosures. Single-graph discipline (Principle 6) violation until landed.
- `agent:Anya (Data / analytics engineer)` — once PEER-COMP register lands, projection over JSE-listed-bank disclosure events feeds the band-confirmation queries automatically.

## Substrate gaps surfaced

1. **Peer-bank-comp register** — no canonical authoring location for SA disclosed-comp data; PAX, Camille, Nolan all sourcing ad-hoc per seat. Single-graph violation. Owner: Camille (curator); Anya (ingestion).
2. **Search-firm-fee event type** — retainer / scope / fee currently in Nolan's plain-prose recruitment-execution deliverables; should be a typed `SearchEngagementCommitted` event under the M-Phase agent-runtime substrate so total search-spend rolls up.
3. **Comp-bound enforcement at offer-emission** — no substrate today asserts that an offer-letter respects the Floor / Ceiling bands; depends on Nolan agent-runtime offer-emission handler (S8 dependency).
4. **Recruiter-to-CFO escalation channel** — typed `RecruitmentEscalationEvent` for Ceiling-flex requests doesn't exist; today it's chat-intake. Resolves at S8 agent-runtime substrate landing.

## Provenance

Emitted via `agent:scrooge:ceo-decision-record` runtime handler (substrate-gap fallback: emitted via one-shot script `prototype/scripts/record-decisions-2026-05-09.ts` per Principle 7 "steady-state vs current substrate"). The `CeoDecision` event is the canonical record; this markdown mirrors. Future RMS Phase-1 `RecordFiled` event will register both event + markdown in the Document register.

—Scrooge (Chief of Staff / Orchestrator)
