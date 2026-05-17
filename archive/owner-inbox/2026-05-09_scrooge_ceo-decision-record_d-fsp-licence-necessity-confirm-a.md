---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-09T08:00:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-FSP-LICENCE-NECESSITY, 2026-05-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file (event-substrate gap noted; written-direct under Principle 7 "steady-state vs current substrate"); this markdown is the human-readable mirror.

- **Decision ID:** `D-FSP-LICENCE-NECESSITY`
- **Title:** FSP-licence necessity under FAIS — steady-state posture
- **Action:** confirm (alternative path per Zara, Chief Compliance Officer, governance § 5)
- **Outcome:** **`confirm-A-no-research`.** The CEO reads the FSP-licence question as pre-resolved. **Posture A is the steady-state, not just the interim:**
  - The bank pursues an FSP licence under FAIS (Financial Advisory and Intermediary Services Act 37 of 2002).
  - Key Individual seat is required; Marc remains FAIS KI through licence-day; **Saskia (Head of Global Markets, governance) is the steady-state FAIS KI** under the Determination of Fit and Proper Requirements 2017.
  - FAIS Categories I and II likely sufficient for the institutional-only product set (per Mira-Zara conduct-side reading; counsel ratifies at the licence-application gate).
  - FAIS-record-keeping substrate is binding: advice records, suitability assessments, fee disclosures, General Code of Conduct application, complaint-handling under TCF outcomes.
  - The procedure footprint is binding: `Procedures/by-policy/fais-advice-record-capture.md` is binding.
  - **No PAX research dispatch is required** — the question is closed.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "decision: confirm-A-no-research" — chat-intake 2026-05-09.
- **Source proposal:** `Owner Inbox/2026-05-09_zara_fsp-application-path.md` (PR #44)
- **Authority chain:** Extends `D-THIN-HUMAN-LAYER-MINIMUM` (resolved 2026-05-08; PR #24) — the original conduct-side challenge that named Saskia as steady-state FAIS KI gating on counsel + fit-and-proper. This decision **closes the counsel-gate** as not-required (Marc's risk-call) and confirms Saskia as the steady-state FAIS KI subject only to the fit-and-proper file completion (Gate (b) in Saskia's PR #45 handover note).
- **Rationale codified for the audit trail:** Zara's §2.3 named the asymmetry — wrong-A is over-investment cost; wrong-B is FAIS s.7 contravention with potential criminality under s.36. The CEO accepts the over-investment cost as the correct trade against the asymmetric tail risk. Counsel ratifies posture-A scope at the licence-application gate (Imani, Legal-as-code engineer) but does not re-litigate the binary A-vs-B question.

## What this resolves

- The PAX research dispatch on FSP-licence necessity (Zara's §3 scope) is **withdrawn**. PAX (Role researcher)'s bandwidth returns to the six thin-human-layer role-research dispatches and any other Marc-prioritised research backlog.
- Saskia's FAIS-KI handover trigger (PR #45) drops Gate (a) — counsel confirmation of FSP-licensing scope — as a precondition. Saskia transitions from interim Marc-as-KI to steady-state Saskia-as-KI on Gate (b) alone (FAIS-KI fit-and-proper file completion).
- Mira's `ORG-FAIS-KI` URN (currently a gap row per `Regulations/_obligations-register.md`) closes as Saskia-steady-state under FAIS s.8 + Determination of Fit and Proper 2017.
- Zara's TCF substrate plan v0 (PR #44) — TCF outcome 4 was gated on D-FSP-LICENCE-NECESSITY; that gate is now closed (TCF 4 binding under Posture A as confirmed).
- Imani's external-counsel-licence-application brief (PR #44 cross-reference) — counsel scope narrows to Posture-A ratification + the institutional-only counterparty-eligibility evidence requirements (no carve-out exploration).

## What this does not resolve

- Counsel still ratifies Posture-A *scope* at the licence-application gate. The decision today is "we don't pay counsel to evaluate Posture B"; it is not "we don't engage counsel on FAIS at all".
- The fit-and-proper file for Saskia under the Determination of Fit and Proper Requirements 2017 still needs to be assembled (Sade's AgentOps engineering-side and Saskia's human-side once she is appointed). Cadence: pre-licence-application gate.
- Customer-categorisation-as-institutional-only screening substrate still needs to be wired (Niko (Sales / CRM engineer) on the lifecycle side; Mira on the FAIS-record-keeping side).

## Follow-on routes recorded

- `agent:Saskia (Head of Global Markets, governance)` — confirms FAIS KI candidacy steady-state; the PAX research dispatch she had been routed to fire (per D-THIN-HUMAN-LAYER-MINIMUM Saskia follow-on; Saskia's own PR #45 dispatch brief at `Team Inbox/2026-05-09_saskia-to-pax_fsp-licence-necessity-research.md`) is **withdrawn**. Move that brief to `Team Inbox/actioned/` per the team-inbox-hygiene rule, with a note pointing at this decision record.
- `agent:Mira (Compliance / RegTech engineer)` — close `ORG-FAIS-KI` register row as Saskia-steady-state (Marc-interim until Saskia fit-and-proper file completes). Cite this decision record + FAIS s.8 + Determination of Fit and Proper Requirements 2017. Status moves from `gap` to `corporate-bind`. Stack on or follow Mira's PR #56 (FinSurv wave-1).
- `agent:Owen (Company Secretary, governance)` — update the governance framework + composition paper (PR #47) to record FAIS KI as a *steady-state* seat (Saskia), not a question. Cross-link to this decision record. The 6-human composition is unchanged (the FAIS KI is a seat *Saskia* holds, not a 7th human).
- `agent:Zara (Chief Compliance Officer, governance)` — update `Owner Inbox/2026-05-09_zara_fsp-application-path.md` with a "Decision: confirm-A-no-research, see decision-record" header at the top; mark the file as actioned. Update `Owner Inbox/2026-05-09_zara_tcf-substrate-plan-v0.md` to flip TCF 4 from "gated on D-FSP-LICENCE-NECESSITY" to "binding under Posture A confirmed".
- `agent:Imani (Legal-as-code engineer)` — narrow the external-counsel-licence-application brief scope: counsel ratifies Posture-A application-bundle; counsel does not evaluate Posture B; counsel scopes the institutional-only counterparty-eligibility evidence requirements. Update `Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md` accordingly.
- `agent:PAX (Role researcher)` — the FSP-licence-necessity research dispatch is withdrawn from PAX's queue. PAX's bandwidth returns to the six thin-human-layer role-research dispatches (already in flight under `claude/pax-thin-human-layer-role-research-v0`) and any other backlog.
- `agent:Sade (AgentOps engineer)` — the engineering-side FAIS-KI fit-and-proper-analogue file structure is now load-bearing for the Saskia transition. Output: a fit-and-proper-file-template procedure (named `Procedures/by-policy/fais-ki-fit-and-proper.md` or similar — search the procedures directory first) capturing the five Determination of Fit and Proper Requirements 2017 dimensions (honesty/integrity, competence, operational ability, financial soundness, oversight) with structured evidence slots.
- `agent:Niko (Sales / CRM engineer)` — wire the customer-categorisation-as-institutional-only screening into the lifecycle. Every counterparty onboarded must clear an institutional-eligibility test that anchors the FAIS scope-of-services to the institutional product set. v0 STUB acceptable.
- `agent:Mira (Compliance / RegTech engineer)` — wire the FAIS-record-keeping substrate (advice records, suitability assessments, fee disclosures) at the obligations-register level — URN cluster `urn:obligation:bank:fais:record-keeping:*`. v0 acceptable as `[citation: TBC]` placeholders citing the General Code of Conduct + FAIS s.8.

## Substrate gaps surfaced

1. **CeoDecision event substrate** — recurring gap; Atlas (Core banking platform architect) v1.
2. **Counsel-gate-narrowing** — counsel scope is narrowed but not eliminated; the substrate-side ratification check (does counsel sign off on Posture-A scope at licence-application?) remains a substrate gap that becomes load-bearing at licence-application gate.
3. **FAIS-record-keeping substrate** — Mira owns the register cluster; Atlas owns the typed-event substrate (`AdviceRecorded`, `SuitabilityAssessed`, `FeeDisclosed` event families). v1 substrate.
4. **Customer-categorisation-as-institutional-only** — Niko wires the screening; substrate gap until live.
5. **FAIS KI fit-and-proper file template** — Sade (AgentOps engineer) v0 substrate-stub.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler (substrate-gap fallback: written directly by Scrooge in-session per Principle 7). The `CeoDecision` event is the canonical record once the v1 substrate lands; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.

—Scrooge (Chief of Staff / Orchestrator)
