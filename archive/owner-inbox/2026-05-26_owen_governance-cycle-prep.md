---
agent: Owen
trigger: governance-cycle-prep
asOf: 2026-05-26T11:04:45.331Z
decision-required: false
---

# Owen — governance-cycle prep, 2026-05-26

Autonomous run of Owen's weekly governance-cycle prep per `Team/Owen.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Output is the input to the Interim Risk Forum / Interim Audit Forum agenda (until a Board AC is constituted, S3).

**Headline:** 12 CEO decisions open · 2 governance seats unfilled · 0 CEO decisions actioned in the last 7 days.

## CEO decisions awaiting action

| ID | Owner | Title | What's wanted |
|---|---|---|---|
| esc:atlas:bus-in-process-2026-05-18 | Atlas | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentE... | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentEscalation events flowing from a running handler to Vera's subscriber — which requires at minimum in-process fan-out to be wired. Are pipelines #14/#15 now unblocked, or does Vera need an explicit integration test before marking them green? |
| esc:atlas:cron-drift-a2-1-2026-05-18 | Atlas | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours o... | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours or be silently dropped. Workaround (distinct off-the-hour minutes per workflow) is in place but is not a permanent fix. Should Atlas prioritise the A2.1 substrate scheduler (Bun process emitting typed ScheduledTrigger events) ahead of other planned M-phase work, or continue with the workaround through the build phase? |
| esc:atlas:bus-in-process-2026-05-19 | Atlas | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentE... | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentEscalation events flowing from a running handler to Vera's subscriber — which requires at minimum in-process fan-out to be wired. Are pipelines #14/#15 now unblocked, or does Vera need an explicit integration test before marking them green? |
| esc:atlas:cron-drift-a2-1-2026-05-19 | Atlas | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours o... | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours or be silently dropped. Workaround (distinct off-the-hour minutes per workflow) is in place but is not a permanent fix. Should Atlas prioritise the A2.1 substrate scheduler (Bun process emitting typed ScheduledTrigger events) ahead of other planned M-phase work, or continue with the workaround through the build phase? |
| esc:atlas:bus-in-process-2026-05-20 | Atlas | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentE... | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentEscalation events flowing from a running handler to Vera's subscriber — which requires at minimum in-process fan-out to be wired. Are pipelines #14/#15 now unblocked, or does Vera need an explicit integration test before marking them green? |
| esc:atlas:cron-drift-a2-1-2026-05-20 | Atlas | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours o... | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours or be silently dropped. Workaround (distinct off-the-hour minutes per workflow) is in place but is not a permanent fix. Should Atlas prioritise the A2.1 substrate scheduler (Bun process emitting typed ScheduledTrigger events) ahead of other planned M-phase work, or continue with the workaround through the build phase? |
| esc:atlas:bus-in-process-2026-05-07 | Atlas | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentE... | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentEscalation events flowing from a running handler to Vera's subscriber — which requires at minimum in-process fan-out to be wired. Are pipelines #14/#15 now unblocked, or does Vera need an explicit integration test before marking them green? |
| esc:atlas:cron-drift-a2-1-2026-05-07 | Atlas | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours o... | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours or be silently dropped. Workaround (distinct off-the-hour minutes per workflow) is in place but is not a permanent fix. Should Atlas prioritise the A2.1 substrate scheduler (Bun process emitting typed ScheduledTrigger events) ahead of other planned M-phase work, or continue with the workaround through the build phase? |
| esc:atlas:bus-in-process-2026-05-25 | Atlas | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentE... | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentEscalation events flowing from a running handler to Vera's subscriber — which requires at minimum in-process fan-out to be wired. Are pipelines #14/#15 now unblocked, or does Vera need an explicit integration test before marking them green? |
| esc:atlas:cron-drift-a2-1-2026-05-25 | Atlas | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours o... | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours or be silently dropped. Workaround (distinct off-the-hour minutes per workflow) is in place but is not a permanent fix. Should Atlas prioritise the A2.1 substrate scheduler (Bun process emitting typed ScheduledTrigger events) ahead of other planned M-phase work, or continue with the workaround through the build phase? |
| esc:atlas:bus-in-process-2026-05-26 | Atlas | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentE... | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentEscalation events flowing from a running handler to Vera's subscriber — which requires at minimum in-process fan-out to be wired. Are pipelines #14/#15 now unblocked, or does Vera need an explicit integration test before marking them green? |
| esc:atlas:cron-drift-a2-1-2026-05-26 | Atlas | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours o... | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours or be silently dropped. Workaround (distinct off-the-hour minutes per workflow) is in place but is not a permanent fix. Should Atlas prioritise the A2.1 substrate scheduler (Bun process emitting typed ScheduledTrigger events) ahead of other planned M-phase work, or continue with the workaround through the build phase? |

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

_Narrative generation failed (credit exhausted: Anthropic credit balance exhausted: 400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."},"request_id":"req_011CbR534aQVxMjqSNW2cgz7"})._

## Provenance

Read the dashboard state (runtime cache `prototype/.local/dashboard-state.json` if present; otherwise derived live via `dashboard/derive.ts` from canonical sources + the in-process event store, per D-EVENT-STORE-SCALING Slice 3b) for open decisions + seats; replayed `CeoDecision` events from the host event store for the last 7 days.
