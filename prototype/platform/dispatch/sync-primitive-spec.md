# Dispatch sync primitive — spec

**Status:** approved (CEO 2026-05-20 via Scrooge session delegation)
**Decision:** `D-DISPATCH-SYNC-PRIMITIVE` (event `2a99225e-6702-4dae-87ea-8deb3c87228b`)
**Brief:** `brief:atlas:design-build-dispatch-sync-primitive-d-dispatch-:2026-05-20`
**Author:** Atlas (Core banking platform architect, engineering)
**Reports to:** Devon (Chief Operating Officer, governance)
**Citations:** `urn:decision:bank:D-DISPATCH-SYNC-PRIMITIVE`, `D-RMS-PHASE-1`, `D-RMS-PHASE-2`, `urn:policy:bank:market-risk:v1` §6.3.

## 1. Problem

On 2026-05-20, WS-MARKET-RISK-PROCEDURES v1.0 (PR #610) was approved and merged
with phase: `approved` despite the §6.3 Independent Validation reviewer
(Bea, Independent Validation) finding two of the four procedures defective.

Forensic trace:

- Bea v1.0 `AgentRunCompleted`: `a9fedeba-4775-4744-ace5-3a6d5263a112`
- Helena v1.0 `AgentRunCompleted`: `196ea822-d220-48ac-825c-06ffacd2a9dd`
- Bea v1.1: `677bf600-e2b3-4f8a-aaec-167d9ff5bb26`
- Helena v1.1: `d9ff5f52-5f7c-4872-b29c-9ec44f45e05a`

Root cause: Scrooge dispatched Bea (reviewer-class) and Helena (decider-class)
in **parallel** background runs, both bracketing the same scope. Helena's 60-s
poll fallback fired before Bea's `READY-WITH-OBSERVATIONS` comment landed.
Helena's decider close-out shipped before Bea's reviewer close-out had
appended to the event log. v1.1 reopened the procedures and corrected the
content, but the substrate gap that permitted the race remains.

There is **no synchronisation primitive between reviewer-class and
decider-class runs bracketing the same scope**. This spec closes that gap.

## 2. Design choice

**Design A (event-driven `blocksOn`) + Design B (orchestrator sequence
check).** Rejected Design C (poll-with-recheck) standalone as it merely
moves the race goal-posts.

A is the minimum-surface-area extension of RMS Phase 2/3:

- `AgentBriefIssued.payload` gains an optional `blocksOn` array of
  `{ briefId, runRoleClass }` references. Each entry names a prior brief
  whose `AgentRunCompleted{outcome:"delivered"}` event must exist in the
  event store **before** the current run may close with `outcome:"delivered"`.
- `AgentBriefIssued.payload` gains a required-when-`blocksOn`-non-empty
  `runRoleClass: "reviewer" | "decider" | "executor" | "observer"` field so
  the recon pipeline can assert the reviewer→decider topology after the
  fact. When `blocksOn` is empty / omitted, `runRoleClass` is optional
  (defaults to `"executor"`).
- `dispatch:close-run` becomes synchronisation-aware: when the closing run's
  brief carries `blocksOn`, the helper calls the runtime primitive
  `assertBlockingRunsClosed({ briefId, asOf })` which scans the event store
  for matching closing `AgentRunCompleted` events and **refuses** to emit
  the `AgentRunCompleted{outcome:"delivered"}` event unless all required
  reviewer runs have already closed `delivered`. The CLI exits non-zero with
  a structured `blocked-by` envelope so Scrooge can surface the wait
  explicitly.

B is implicit in A: Scrooge's dispatch sequence becomes
"reviewer briefs first → reviewer runs close → decider brief carrying
`blocksOn=[reviewer-brief-id…]` → decider run". The orchestrator does not
need a second control surface — the event store **is** the control surface.

## 3. Event-shape changes

`AgentBriefIssued.payload` schema gains two optional fields. Both are
backward-compatible: existing briefs are read with `blocksOn = []` and
`runRoleClass = "executor"`.

```ts
{
  // …existing fields…
  runRoleClass: z.enum(["reviewer","decider","executor","observer"]).optional(),
  blocksOn: z.array(z.object({
    briefId: z.string().min(1),
    runRoleClass: z.enum(["reviewer","decider","executor","observer"]),
  })).optional(),
}
```

No change to `AgentRunStarted` or `AgentRunCompleted` schemas — the
synchronisation requirement is read from the brief.

## 4. Runtime API

Surface: `prototype/platform/dispatch/index.ts`.

```ts
export interface BlockingRunStatus {
  briefId: string;
  requiredRoleClass: "reviewer" | "decider" | "executor" | "observer";
  closedAt?: string;
  outcome?: "delivered" | "blocked" | "withdrawn";
  satisfied: boolean;
}

export interface AssertResult {
  briefId: string;
  asOf: string;
  blocksOn: BlockingRunStatus[];
  ok: boolean;
  /** First unsatisfied entry (when ok=false) — convenience for callers. */
  blockedBy?: BlockingRunStatus;
}

/**
 * Pure assertion. Given a brief and a set of replayed events, returns
 * whether every entry in `brief.payload.blocksOn` has a matching
 * `AgentRunCompleted{outcome:"delivered"}` whose `briefId` matches.
 *
 * The function is total — it never throws on missing closing events; the
 * caller (CLI) decides whether `ok=false` is a refusal or a warning.
 */
export function assertBlockingRunsClosed(args: {
  brief: AgentBriefIssuedPayload;
  events: Iterable<Event>;
  asOf: string;
}): AssertResult;

/**
 * Convenience: composes assertBlockingRunsClosed with the live event
 * store and the brief lookup. Used by `dispatch:close-run` CLI.
 */
export function checkDeciderMayClose(args: {
  briefId: string;
  asOf: string;
}): AssertResult;
```

## 5. CLI changes

`dispatch:open-brief` gains two optional flags:

- `--run-role-class <reviewer|decider|executor|observer>` (default `executor`)
- `--blocks-on <briefId>:<role-class>` (repeatable)

`dispatch:close-run` gains a fail-fast path when the closing outcome would
be `delivered`: it calls `checkDeciderMayClose` and exits non-zero with a
`blocked-by` envelope if any blocking run is unsatisfied.

A new override `--force-close-bypass-sync` (no shorthand) exists for the
incident-cleanup case where a reviewer brief was issued and abandoned;
its use emits a `substrateGapsSurfaced` entry on the resulting
`AgentRunCompleted` event and surfaces in recon. The override is **not**
documented as a normal-path option.

## 6. Recon pipeline — `recon:dispatch-sync-integrity`

Path: `prototype/platform/recon/dispatch-sync-integrity.ts`.

Scope: scans the union of `AgentBriefIssued` + `AgentRunStarted` +
`AgentRunCompleted` events. For each `AgentRunCompleted{outcome:"delivered"}`,
loads the matching `AgentBriefIssued` (by `briefId` ⇒ payload), walks
`blocksOn` (legacy: when absent, infers reviewer dependence by matching
workstream + an inferred reviewer-role brief earlier than the decider close
time — see §6.1), and asserts:

For every reviewer entry, there must exist an `AgentRunCompleted` with:
- `payload.briefId === reviewerBriefId`, AND
- `payload.outcome === "delivered"`, AND
- `as_of <= deciderCloseAsOf`.

Failure mode: `severity: "fail"` per violation. Subject:
`agent-run:<deciderRunId>`. Message includes both run IDs, the reviewer brief
ID, the decider close timestamp, and the reviewer's actual close timestamp
(or "no closing event").

### 6.1. Legacy-incident detection (no `blocksOn` in payload)

For runs predating this primitive (i.e. all runs before PR-this), the
pipeline runs a **scope-correlation** heuristic that infers reviewer-class
dependence:

- Group all `AgentBriefIssued` events by their `workstreamId`.
- Within a workstream, if there are ≥ 2 briefs whose titles match the
  reviewer/decider conventions (`/independent.{0,20}validation|reviewer|review/i`
  vs `/(approval|decider|merge|sign[-\s]?off)/i`) **and** the decider's run
  closes `delivered` with a `completedAt` earlier than the reviewer's
  `completedAt`, emit a violation.
- The 2026-05-20 v1.0 incident is the seeded canonical case used by the
  pipeline's test suite.

## 7. Seed test — assert v1.0 incident detected

`prototype/platform/recon/dispatch-sync-integrity.test.ts` constructs four
synthetic events matching the v1.0 + v1.1 incident shape (the four
`AgentRunCompleted` event IDs and the two issuing `AgentBriefIssued` events)
and asserts the pipeline returns **exactly one** historic violation
(the v1.0 case; v1.1 closes correctly).

This is the "did the fix actually work on real data" check called out in
the brief acceptance criteria.

## 8. Failure-mode catalogue

| # | Mode | Detection | Severity |
|---|---|---|---|
| 1 | Decider closes `delivered` before reviewer closes | `blocksOn` runtime gate + recon | `fail` |
| 2 | Reviewer closes `blocked` / `withdrawn` but decider still closes `delivered` | recon (reviewer outcome ≠ `delivered`) | `fail` |
| 3 | Reviewer brief issued but **no** closing event ever emitted | recon (`closedAt === undefined`) | `fail` |
| 4 | Decider uses `--force-close-bypass-sync` | `substrateGapsSurfaced` flag | `warn` |
| 5 | Same brief drives multiple runs (re-dispatch) | recon picks **earliest** `delivered` closing run per brief | — |

## 9. Substrate gaps surfaced (NOT fixed here)

Captured during this run and routed to separate workstreams:

- `decisionId` regex extension for `§` — affects `recon:decision-id-hygiene`.
- `recordedVia` enum extensibility — `scrooge:session-delegation` is the
  current sole value; future audit attributions need a registry.
- `backfill-triage-log.md` timestamp churn — cache-in-commit-graph
  anti-pattern; the file should move out of git.

## 10. Acceptance criteria

1. ✅ Spec filed; `RecordFiled` event during close-run.
2. ✅ Runtime primitive in `prototype/platform/dispatch/` + unit-tested.
3. ✅ `recon:dispatch-sync-integrity` live and in `bun run ci`.
4. ✅ Historic Helena v1.0 incident asserted by recon as exactly 1 violation.
5. ✅ CLAUDE.md "Dispatch discipline" updated with the new bullet.
6. ✅ PR open to `main`, CI green.

## 11. Change log

- 2026-05-20: initial spec, Atlas (Core banking platform architect, engineering).
