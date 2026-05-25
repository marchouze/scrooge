---
agent: Owen
trigger: governance-cycle-prep
asOf: 2026-05-19T07:31:53.032Z
decision-required: false
---

# Owen — governance-cycle prep, 2026-05-19

Autonomous run of Owen's weekly governance-cycle prep per `Team/Owen.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Output is the input to the Interim Risk Forum / Interim Audit Forum agenda (until a Board AC is constituted, S3).

**Headline:** 4 CEO decisions open · 2 governance seats unfilled · 0 CEO decisions actioned in the last 7 days.

## CEO decisions awaiting action

| ID | Owner | Title | What's wanted |
|---|---|---|---|
| esc:atlas:bus-in-process-2026-05-18 | Atlas | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentE... | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentEscalation events flowing from a running handler to Vera's subscriber — which requires at minimum in-process fan-out to be wired. Are pipelines #14/#15 now unblocked, or does Vera need an explicit integration test before marking them green? |
| esc:atlas:cron-drift-a2-1-2026-05-18 | Atlas | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours o... | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours or be silently dropped. Workaround (distinct off-the-hour minutes per workflow) is in place but is not a permanent fix. Should Atlas prioritise the A2.1 substrate scheduler (Bun process emitting typed ScheduledTrigger events) ahead of other planned M-phase work, or continue with the workaround through the build phase? |
| esc:atlas:bus-in-process-2026-05-19 | Atlas | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentE... | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentEscalation events flowing from a running handler to Vera's subscriber — which requires at minimum in-process fan-out to be wired. Are pipelines #14/#15 now unblocked, or does Vera need an explicit integration test before marking them green? |
| esc:atlas:cron-drift-a2-1-2026-05-19 | Atlas | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours o... | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours or be silently dropped. Workaround (distinct off-the-hour minutes per workflow) is in place but is not a permanent fix. Should Atlas prioritise the A2.1 substrate scheduler (Bun process emitting typed ScheduledTrigger events) ahead of other planned M-phase work, or continue with the workaround through the build phase? |

## Open governance seats

| Seat | Status |
|---|---|
| GC | Sequenced; PAX brief / Nolan recruit pending |
| CHRO | Sequenced; PAX brief / Nolan recruit pending |

## Recent CEO decisions (last 7 days)

_No CeoDecision events in the last 7 days. (Note: event store is host-local; runner sees only events emitted on this host.)_

## Forum-prep notes

- Items above feed the next Interim Risk Forum (Helena chair) and Interim Audit Forum (Owen chair) agendas.
- Open governance seats are tracked under S3 (thin human layer at licence-day, composition and timing).
- Combined-assurance contributions from Vera and Thandiwe consume this digest as a third-line input.

## Owen's narrative

Four open CEO decisions on the board, two unfilled governance seats (`GC`, `CHRO`, both sequenced behind the PAX brief / Nolan recruit), and zero CEO decisions cleared in the last seven days. Of the four open items, two are duplicates: `esc:atlas:bus-in-process-2026-05-18` and `-2026-05-19` are the same question re-raised a day later, as are the two `cron-drift-a2-1` entries. That pattern — Atlas re-emitting an unanswered escalation on the next cycle — is itself the procedural signal: the CEO queue is not draining, and the substrate is correctly surfacing that fact rather than swallowing it.

Ranking by downstream consequence: (1) `esc:atlas:bus-in-process` gates Vera audit pipelines #14 and #15 — concretely, until Marc rules on whether in-process fan-out is sufficient or an explicit integration test is required, two audit-substrate pipelines remain amber, which means the Interim Audit Forum is sitting on an incomplete assurance picture. (2) `esc:atlas:cron-drift-a2-1` is a build-phase prioritisation call — workaround vs. proper A2.1 scheduler — and the answer determines whether Atlas spends the next M-phase slice on substrate hardening or on planned work; that bands a non-trivial amount of engineering substrate. (3) The `GC` vacancy is the gating seat for any procedure that requires legal owner-mandate (related-party sign-off, regulatory correspondence); `CHRO` gates people-procedures but is less load-bearing this cycle.

Next forum agenda item: **CEO 1:1 with Marc**, single agenda block — "clear or defer the four open Atlas escalations" — because all four are CEO calls (not Board), two are duplicates that will keep re-emitting until ruled on, and one of them (`bus-in-process`) is the prerequisite for an item I will otherwise need to carry forward unresolved into the next Interim Audit Forum. If Marc rules on `bus-in-process` before that Forum, I can land pipelines #14/#15 cleanly; if not, I will table them as known-gated and minute the dependency.

## Provenance

Read the dashboard state (runtime cache `prototype/.local/dashboard-state.json` if present; otherwise derived live via `dashboard/derive.ts` from canonical sources + the in-process event store, per D-EVENT-STORE-SCALING Slice 3b) for open decisions + seats; replayed `CeoDecision` events from the host event store for the last 7 days.
