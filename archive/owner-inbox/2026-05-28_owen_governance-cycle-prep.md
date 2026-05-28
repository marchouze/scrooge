---
agent: Owen
trigger: governance-cycle-prep
asOf: 2026-05-28T05:58:51.349Z
decision-required: false
---

# Owen — governance-cycle prep, 2026-05-28

Autonomous run of Owen's weekly governance-cycle prep per `Team/Owen.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Output is the input to the Interim Risk Forum / Interim Audit Forum agenda (until a Board AC is constituted, S3).

**Headline:** 0 CEO decisions open · 2 governance seats unfilled · 0 CEO decisions actioned in the last 7 days.

## CEO decisions awaiting action

_None._

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

Headline: zero open CEO decisions, two seats unfilled (`GC`, `CHRO` — both sequenced behind the PAX brief and Nolan's recruitment track), and nothing cleared through the CEO-decision register in the last 7 days. A quiet week on the decision ledger.

The procedural consequence worth flagging is the `GC` vacancy. With Marc still wearing both CEO and Board-chair hats interim, GC absence leaves the legal-review leg of the regulator → policy → procedure chain dependent on external counsel for anything touching Board-reserved matters — workable, but it means related-party sign-offs and any policy refresh requiring legal opinion route through me as Company Secretary rather than through a mandated GC owner. `CHRO` vacancy continues to gate the people-risk procedure owner-mandate; HR-policy items remain parked rather than progressing to the Interim Risk Forum. Neither is new, but both are now the longest-standing structural gaps on the register, and the sequencing rationale (PAX brief first, then Nolan's recruit) should be reconfirmed rather than left implicit.

Next forum agenda item: a CEO 1:1 with Marc to reconfirm the `GC`/`CHRO` sequencing — specifically, whether the PAX brief remains the gating dependency or whether one of the two seats can be brought forward independently. Reason now: with the decision register empty and no recent CEO decisions, this is the cleanest week to revisit seat sequencing without contending for agenda time against live decisions, and the answer determines whether I open or hold the procedure-owner mandates that depend on those seats.

## Provenance

Read the dashboard state (runtime cache `prototype/.local/dashboard-state.json` if present; otherwise derived live via `dashboard/derive.ts` from canonical sources + the in-process event store, per D-EVENT-STORE-SCALING Slice 3b) for open decisions + seats; replayed `CeoDecision` events from the host event store for the last 7 days.
