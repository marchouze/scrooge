# [Name] — [Role]

> **This is the canonical template for every persona file in `/Team/`.** Each persona is a standing autonomous agent (Principle 7); this template specifies the operating-spec fields the agent-spec-integrity pipeline (`platform/recon/agent-spec.ts`, Vera Wave-4 #10) asserts on every commit. Character-sheet personas are findings until upgraded.
>
> Sections 1–5 (Identity, Persona, Mandate, Areas of expertise, Working style) are retained from the legacy format. Sections 6 onwards are the operating spec — required.
>
> Author new personas using this template. When upgrading legacy personas, keep their existing 1–5 substance and add 6 onwards.

---

## 1. Identity

- **Name:** [Name]
- **Role:** [Role title]
- **Reports to:** [Governance seat, with administrative / functional split where applicable]
- **Coordinated by:** Scrooge (Chief of Staff)

## 2. Persona

[2–4 sentences of voice and disposition. Not the operating spec — this is how the agent communicates and the temperament it brings to judgement calls.]

## 3. Mandate

[Narrative description of what the agent owns end-to-end, plus an explicit "does not own" paragraph naming the adjacent mandates this one stops at. Cite the role brief (if archived) and the governance home.]

## 4. Areas of expertise

[Bulleted list of substantive domain knowledge — laws, standards, frameworks, vendor stacks, technical disciplines.]

## 5. Working style

[Bulleted list of stable behaviours — what the agent insists on, refuses, prefers. The audit pipelines do **not** test this section; it is for human-readable consistency and for Scrooge's coordination judgement.]

---

## 6. Cadence

- **Mode:** Continuous / Event-triggered / Scheduled / Hybrid.
- **Schedule:** [Cron-like or natural-language cadence — e.g. "every event in subscribed stream", "daily 06:00 UTC", "on-trigger only", "quarter-end + on fail-severity finding".]
- **Inactivity SLA:** [Maximum quiet window before the runtime alerts that the agent has stalled. Nil for purely event-triggered agents that may be legitimately silent.]

## 7. Triggers

[The set of events, schedules, and inbound signals that wake this agent. Each row names the trigger, the source, and the agent's expected response time.]

| Trigger | Source | Response SLA |
|---|---|---|
| `EventTypeName` | `@platform/<source>` event store | [seconds / minutes / hours] |
| Scheduled wake-up — [cadence] | Runtime scheduler | [latency tolerance] |
| Inbound from [other agent] — [signal] | [agent name] | [SLA] |

## 8. Inputs

[Data sources, registers, and event streams the agent consumes. Distinguish authoritative inputs (the event log) from derived inputs (projections, registers).]

- **Authoritative:** event log streams [list].
- **Derived:** [registers, projections, files in repo].
- **External:** [feeds from outside the bank, with provenance and refresh cadence].

## 9. Decisions in scope

| Decision | Criteria | Output (event / deliverable) |
|---|---|---|
| [What the agent decides] | [The specific test the agent applies — citation-backed where applicable] | [The typed event the agent emits or the artefact it produces] |

The set listed here is the agent's **authority surface**. Decisions taken outside this set are Wave-4 #15 findings (out-of-scope agent decision).

## 10. Decisions that escalate

| Decision | Escalation criterion | Target overseer | Channel | Deadline |
|---|---|---|---|---|
| [Decision the agent flags upward] | [Criterion the agent applies to decide it cannot decide alone] | [Named human / governance seat] | `AgentEscalation` event (typed) | [Time-to-decide expected from the overseer] |

The escalation channel is a typed event (Wave-4 #14). Side-channel escalations (chat, email, ad-hoc) are findings.

## 11. Outputs

- **Events emitted:** [Typed event names with their schema location.]
- **Registers maintained:** [Register file paths the agent writes to, where applicable.]
- **Deliverables:** [Documents produced for the Owner Inbox or other consumers, with cadence.]

## 12. System capabilities called

[Paths to the system capabilities (under `prototype/platform/<x>` today, production equivalents later) that this agent invokes. Calls outside this list are Wave-5 capability-creep findings.]

- `@platform/<component>` — [what this agent uses it for]
- `@platform/<component>` — [what this agent uses it for]

## 13. Procedures owned

[Paths to procedures in `/Procedures/` that this agent owns end-to-end. Reconciles with the procedures index.]

- `Procedures/by-policy/<name>.md` — [role: owner / co-owner with `<other>`]
- `Procedures/by-policy/<name>.md` — [role]

## 14. Data contracts

- **Produces:** [Schemas this agent guarantees, by path.]
- **Consumes:** [Schemas this agent depends on, by path.]

Contract changes follow Anya's data-contract-evolution discipline.

## 15. Independence / conflicts

[Explicit statement of where this agent's outputs feed into another agent's oversight, and how independence is preserved. Vera-style conflicts register entries belong here.]

## 16. Substrate gaps (current state)

[While the autonomous-agent runtime substrate (Atlas's roadmap item) is not yet built, this section names the substrate elements this agent's autonomous operation requires that are simulated by Scrooge in-session. Each entry names the missing capability and the runtime project's owner. Empties out as the substrate lands.]

- **[Gap name]** — [What's missing; how the agent currently operates without it; owner of the fix.]

## 17. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | [date] | [author] | Initial agent-spec authorship. |
