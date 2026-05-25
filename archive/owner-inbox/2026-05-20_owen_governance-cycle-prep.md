---
agent: Owen
trigger: governance-cycle-prep
asOf: 2026-05-20T06:53:54.336Z
decision-required: false
---

# Owen — governance-cycle prep, 2026-05-20

Autonomous run of Owen's weekly governance-cycle prep per `Team/Owen.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Output is the input to the Interim Risk Forum / Interim Audit Forum agenda (until a Board AC is constituted, S3).

**Headline:** 2 CEO decisions open · 2 governance seats unfilled · 0 CEO decisions actioned in the last 7 days.

## CEO decisions awaiting action

| ID | Owner | Title | What's wanted |
|---|---|---|---|
| esc:atlas:bus-in-process-2026-05-20 | Atlas | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentE... | Event-driven dispatch is in-process only (no cross-process bus). Vera audit pipelines #14 and #15 are gated on AgentEscalation events flowing from a running handler to Vera's subscriber — which requires at minimum in-process fan-out to be wired. Are pipelines #14/#15 now unblocked, or does Vera need an explicit integration test before marking them green? |
| esc:atlas:cron-drift-a2-1-2026-05-20 | Atlas | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours o... | GH Actions cron reliability is an ongoing substrate gap (A2.1). Scheduled runs have been observed to drift by hours or be silently dropped. Workaround (distinct off-the-hour minutes per workflow) is in place but is not a permanent fix. Should Atlas prioritise the A2.1 substrate scheduler (Bun process emitting typed ScheduledTrigger events) ahead of other planned M-phase work, or continue with the workaround through the build phase? |

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

Two CEO decisions open, two governance seats unfilled (`GC`, `CHRO` — both sequenced behind the PAX brief and Nolan's recruit pipeline), zero CEO decisions cleared in the last 7 days. The week has been quiet on the decision register, which is itself the observation: the queue is ageing, not turning over.

Of the two open items, `esc:atlas:bus-in-process-2026-05-20` is the more consequential by procedural chain — Vera audit pipelines #14 and #15 are explicitly gated on it, so a CEO call here either releases two downstream substrate workstreams or holds them pending an integration test. `esc:atlas:cron-drift-a2-1-2026-05-20` is lower-urgency but sequencing-sensitive: it asks Marc to reprioritise A2.1 ahead of planned M-phase work, and the answer reshapes Atlas's build-phase backlog. On the seat side, `GC` vacancy continues to gate any procedure owner-mandate that needs legal sign-off as named owner rather than reviewer — worth flagging that the sequenced hold is now the load-bearing assumption behind several draft procedures.

Next forum agenda item: **CEO 1:1 with Marc**, item "Atlas escalations — bus dispatch and cron-drift sequencing," taken together. Both are CEO calls (not Board), both are Atlas-owned, and pairing them lets Marc decide the substrate-vs-feature sequencing in one pass rather than two. Recommend tabling ahead of the next Interim Risk Forum so Helena isn't asked to absorb substrate-roadmap questions that aren't hers.

## Provenance

Read the dashboard state (runtime cache `prototype/.local/dashboard-state.json` if present; otherwise derived live via `dashboard/derive.ts` from canonical sources + the in-process event store, per D-EVENT-STORE-SCALING Slice 3b) for open decisions + seats; replayed `CeoDecision` events from the host event store for the last 7 days.
