---
title: "CEO-Escalation Push Channel — Decision-Required Surface Spec"
author: "Atlas (Core banking platform architect, engineering)"
date: "2026-06-09"
category: "substrate-spec"
decision-required: false
authority: "D-PROACTIVE-ESCALATION-SURFACING (CEO-approved 2026-06-09), part 2"
---

# CEO-Escalation Push Channel — Decision-Required Surface Spec

**Authority:** `D-PROACTIVE-ESCALATION-SURFACING` (CEO-approved 2026-06-09), part 2.
**Author:** Atlas (Core banking platform architect, engineering).
**Status:** Spec + projection/recon contract. Build phased (see §8).

---

## 0. Problem & framing

On 2026-06-09 the autonomous runtime correctly *detected and escalated*: it emitted one
`SubstrateAgentRunFailed` (tomas:daily-reconciliation) and three high-severity integrity
`SubstrateAlert`s. Those escalations were real, typed, and durable in the event log — but they
were only visible inside Atlas's hourly `SubstrateStateSnapshot` markdown render, which the CEO
must *query*. They surfaced only because Marc asked "what ran autonomously today."

Principle 6 makes escalations **first-class typed channels**. A typed escalation that no one is
pushed toward is a half-built channel: detection without surfacing. This spec closes the
detect-but-no-push gap with **one projection** — the Decision-Required projection — consumed by
both the automated dashboard surface (Noa's intranet) and Scrooge's manual digest, so the manual
stand-in and the eventual automated surface never diverge.

**Design rule (non-negotiable):** the surface is a **projection derived from the event store**,
never a hand-maintained list. Every qualifying open event appears; every resolved one drops off;
a recon gate (`recon:escalation-surface-parity`) asserts both directions continuously.

---

## 1. Trigger predicate — what becomes CEO-decision-required

A single stable predicate `isDecisionRequired(event): DecisionRequiredItem | null` promotes a raw
event into a decision-required item. The predicate is **pure** (event in → item-or-null out) so it
is testable in isolation and shared verbatim by the projection and the recon gate.

| # | Source event type | Promote when | Severity mapping | Owning agent source |
|---|---|---|---|---|
| T1 | `SubstrateAgentRunFailed` | always | `high` (a failed autonomous run is always decision-required) | `payload.agent` |
| T2 | `SubstrateAlert` | `payload.severity` ∈ {`high`} | passthrough | `payload.agentUrn` (fallback: parse from `alertId`) |
| T3 | `ReconResult` | `payload.ok === false` OR `failViolations > 0` | `high` (a failing control gate) | pipeline owner (see §1.2) |
| T4 | `AgentEscalation` | `payload.severity` ∈ {`high`, `blocking`} AND not yet `decided` | passthrough (`blocking`→`critical`) | `payload.raisedBy` |

### 1.1 The `critical` question

The brief names `SubstrateAlert severity ∈ {high, critical}`. The **current** `SubstrateAlertPayload`
schema (`platform/event-store/event-types/platform.ts`) enumerates severity as
`{low, medium, high}` — there is no `critical`. The predicate therefore treats `high` as the top
substrate-alert tier today and reserves `critical` as a forward-compatible value: when a future
schema slice adds `critical`, the predicate already lists it in the allow-set (`HIGH_OR_ABOVE =
{"high", "critical"}`) so no predicate change is needed. The recon gate (§4) asserts the predicate's
allow-set is a superset of the schema's top tiers, so a schema change that adds `critical` without
wiring it surfaces as a gate finding rather than a silent miss. `AgentEscalation` severity `blocking`
is the genuine "stop everything" tier and maps to `critical` on the surface.

### 1.2 Recon owner resolution (T3)

`ReconResult` payloads do not carry an owning agent. The projection resolves owner from a static
`PIPELINE_OWNER` map (pipeline-name → agent urn), defaulting to `agent:atlas:engineering` (the
substrate owner) when a pipeline is unmapped. An unmapped failing pipeline is itself a finding the
recon gate raises (so the map cannot silently rot).

### 1.3 Item identity (stable key)

Each promoted item carries a stable `itemId` so ack/resolve lifecycle (§3) attaches to the right
thing and the projection is idempotent across replays:

- T1 → `decision-required:run-failed:<runId>`
- T2 → `decision-required:alert:<alertId>`
- T3 → `decision-required:recon:<pipeline>:<asOfPipeline-date>`
- T4 → `decision-required:escalation:<escalationId>`

---

## 2. Surface — the Decision-Required projection & its two renders

### 2.1 The projection (single source)

`buildDecisionRequiredSurface(store, now): DecisionRequiredSurface` walks the event store once,
applies `isDecisionRequired` to every event, folds the lifecycle (§3) per `itemId`, drops resolved
items, and returns the open set sorted by `(severity desc, age desc)`.

```ts
interface DecisionRequiredItem {
  itemId: string;                 // stable key (§1.3)
  source: "run-failed" | "alert" | "recon" | "escalation";
  sourceEventId: string;          // the promoting event's event_id (audit handle)
  severity: "critical" | "high";  // surface tier (§1.1)
  raisedAt: string;               // ISO; the source event's as_of
  ageSeconds: number;             // now - raisedAt (computed, not stored)
  owningAgent: string;            // agent urn (§1.1/§1.2)
  title: string;                  // one-line human summary
  recommendedAction: string;      // what the CEO is being asked to decide/do
  citations: readonly string[];   // carried from the source event
  status: "open" | "acknowledged";// resolved items are excluded entirely
  ackBy?: string;                 // most recent acknowledger, if any
}

interface DecisionRequiredSurface {
  asOf: string;
  openCount: number;
  bySeverity: { critical: number; high: number };
  items: readonly DecisionRequiredItem[];
}
```

`recommendedAction` is derived per source (run-failed → "Review failure & decide
re-run / disable schedule"; recon → "Review failing control gate & dispatch remediation"; alert →
alert-class-specific; escalation → echo the `AgentEscalation.question` + options). The mapping table
lives beside the predicate.

### 2.2 Render A — dashboard "decision-required" tile/feed (Noa's contract)

**This spec defines the API/projection contract only; it does NOT build the UI.** Noa's intranet UI
consumes:

```
GET /api/decision-required        → DecisionRequiredSurface (open items, sorted)
GET /api/decision-required/:itemId → single item + its full lifecycle event trail
```

Each item row renders: source event (linked by `sourceEventId`), severity, age, owning agent,
recommended action, and an **OK/ack affordance**. The ack affordance POSTs an acknowledgement
(§3) — it does not mutate any list; it appends an event and the next projection read reflects it.
The tile badge count = `openCount`; a non-zero count is the proactive signal ("you have N
decisions waiting") that the hourly-snapshot model lacked.

### 2.3 Render B — Scrooge's digest (manual stand-in, same projection)

`renderDecisionRequiredDigest(surface): string` produces the compact markdown block Scrooge places
at the **top of every report**. Same projection, different render — so the manual stand-in and the
automated surface are byte-derived from one source and cannot drift:

```
## Decision-required (3 open — 1 critical, 2 high)
- 🔴 [critical] tomas:daily-reconciliation run failed (2h ago) — Review failure & decide re-run/disable. (run:tomas:…)
- 🟠 [high] SubstrateAlert integrity: cross-worktree store mismatch (2h ago) — …
- 🟠 [high] recon:rwa-computed-sourcing failing (1h ago) — Dispatch remediation.
```

An empty surface renders `## Decision-required (0 open) ✅` — explicit "nothing waiting", never a
silent omission.

---

## 3. Lifecycle — ack / dispatch / resolve (reuse, don't reinvent)

The existing `AgentEscalation` typed channel (`platform/escalation/channel.ts`) already models
`open → acknowledged → delegated → decided` by folding the log, and `AuditFindingClosed` models
explicit closure. The Decision-Required surface **reuses both** rather than inventing a parallel
lifecycle:

| Source | Open detected by | Acknowledge | Resolve / drop-off |
|---|---|---|---|
| T4 `AgentEscalation` | `AgentEscalation` present | `AgentEscalationAcknowledged` | `AgentEscalationDecided` (terminal) → drops off |
| T1 `SubstrateAgentRunFailed` | the failed event | `AgentEscalationAcknowledged` keyed to `itemId` (see §3.1) | matching successful `SubstrateAgentRunCompleted{ok:true}` for the same agent+trigger, OR an `AgentEscalationDecided` keyed to `itemId` |
| T2 `SubstrateAlert` | the alert event | as above | a later `SubstrateAlert` with same `alertId` and a resolution marker, OR `AgentEscalationDecided` keyed to `itemId` |
| T3 `ReconResult{fail}` | the failing run | as above | a later `ReconResult` for the same `pipeline` with `ok:true` (the gate now passes) → drops off |

### 3.1 Synthetic acknowledgement/closure keying

For sources T1–T3 (which are *not* themselves `AgentEscalation`s), the CEO's OK/ack and any explicit
resolution are recorded as `AgentEscalationAcknowledged` / `AgentEscalationDecided` events whose
`escalationId` is set to the item's `itemId`. This **reuses the existing typed channel verbatim** —
no new event type for ack/resolve — and means the surface lifecycle and the genuine escalation
lifecycle share one fold. The projection treats `escalationId === itemId` acknowledgements/decisions
as the ack/closure for the synthetic item.

**Auto-resolution precedence:** T1/T2/T3 also auto-resolve when the underlying condition clears
(successful re-run, passing recon, cleared alert) even without an explicit CEO decision — a failing
gate that fixes itself should drop off without ceremony. An explicit `AgentEscalationDecided`
resolves regardless. The fold takes "resolved if EITHER auto-clear OR explicit-decided".

### 3.2 No parallel mechanism

No new lifecycle event types are introduced. The surface is a *view*; its lifecycle verbs are the
existing `AgentEscalation*` family. This keeps Principle-1 discipline (one log, one fold) and means
Vera's existing escalation recon and the new surface recon assert over the same events.

---

## 4. Anti-staleness — `recon:escalation-surface-parity`

The surface is a projection; the recon gate asserts it stays faithful in **both directions**:

1. **Coverage (nothing missed):** for every event in the store that satisfies `isDecisionRequired`
   and is *not* resolved per §3, an item MUST be present in `buildDecisionRequiredSurface`. A
   qualifying-but-absent event is a `fail` violation (the detect-but-no-push regression).
2. **Freshness (nothing stale):** every item in the surface MUST correspond to a still-open
   qualifying event. A surface item whose underlying condition is resolved (auto-cleared or
   `Decided`) is a `fail` violation (stale lingering).
3. **Predicate/schema superset:** the predicate's `HIGH_OR_ABOVE` allow-set MUST be a superset of
   the `SubstrateAlertPayload` severity schema's top tier(s). If a schema slice adds a severity above
   `high` that the predicate does not list, that is a `fail` (forward-compat guard from §1.1).
4. **Owner-map completeness (T3):** every failing `ReconResult` pipeline observed in the store MUST
   be mapped in `PIPELINE_OWNER` or fall to the explicit default; an unmapped pipeline is a `warn`
   (so the map cannot silently rot, but does not block CI on a brand-new pipeline).

The gate emits a `ReconResult` event (pipeline `escalation-surface-parity`) like every other
pipeline, and is wired into `ci:recon:domain`. Because it itself emits a `ReconResult`, a failure of
this gate is *itself* a T3 decision-required item — the surface watches its own integrity.

---

## 5. Interim cutover — Scrooge as manual stand-in

Until the projection + recon land and the dashboard tile ships, Scrooge is the manual stand-in per
the CLAUDE.md **"Decision-required-first"** rule (added under `D-PROACTIVE-ESCALATION-SURFACING`):
at the top of every report Scrooge queries the qualifying open events and renders the digest by
hand.

**Cutover steps (mechanical, low-risk):**

1. **Phase A (this spec + thin projection):** ship `isDecisionRequired` + `buildDecisionRequiredSurface`
   + `renderDecisionRequiredDigest` + `recon:escalation-surface-parity`. Scrooge's manual digest is
   now *replaced by calling `renderDecisionRequiredDigest`* — same projection, no longer hand-curated.
   The discipline rule's wording changes from "query and summarise the qualifying events" to "run
   `renderDecisionRequiredDigest` and paste its output".
2. **Phase B (API):** expose `GET /api/decision-required[/:itemId]` (dashboard server route over the
   projection). No UI yet; Scrooge and any tool can read JSON.
3. **Phase C (UI — Noa):** Noa's intranet renders the tile/feed against the Phase-B contract. Once
   live, the discipline rule points at the tile as the canonical surface; Scrooge's digest becomes a
   redundant convenience render of the same projection.

At each phase the projection is the single source; the rule's pointer moves from "Scrooge's hand" →
"Scrooge runs the renderer" → "the tile", but the underlying truth never leaves the event log.

---

## 6. Why one projection (the anti-divergence argument)

The failure mode this spec exists to prevent is *two surfaces that disagree*: a dashboard tile that
says "all clear" while Scrooge's report flags an open failure, or vice-versa. By making
`buildDecisionRequiredSurface` the **sole** producer — digest is a render of it, API is a serialise
of it, recon asserts over it — there is structurally only one answer to "what decisions are waiting."
This is the Principle-1 discipline ("balances are queries, not stored state") applied to the
oversight surface.

---

## 7. Files / contract summary (for Noa + the build agent)

| Artefact | Path (proposed) | Phase |
|---|---|---|
| Predicate + item types | `platform/escalation/decision-required-predicate.ts` | A |
| Projection + digest render | `platform/escalation/decision-required-surface.ts` | A |
| Recon gate | `platform/recon/escalation-surface-parity.ts` (+ `recon:escalation-surface-parity` script, wired into `ci:recon:domain`) | A |
| Dashboard API route | `dashboard/server.ts` → `GET /api/decision-required[/:itemId]` | B |
| Intranet tile/feed | Noa (UI; consumes the Phase-B contract) | C |

---

## 8. Roadmap / build phases

- **Phase A — projection + recon (build):** predicate, projection, digest render, `recon:escalation-surface-parity`. Owner: Atlas. This is the load-bearing slice; everything else renders it.
- **Phase B — API route (build):** `GET /api/decision-required[/:itemId]`. Owner: Atlas (dashboard server).
- **Phase C — intranet tile/feed (build):** UI against the Phase-B contract. Owner: Noa (coordinate UX: badge count, ack affordance, severity colours).
- **Cutover:** CLAUDE.md "Decision-required-first" rule re-pointed at each phase per §5.

This PR delivers the spec + (if cheap, see PR notes) a thin Phase-A projection skeleton + recon
contract. The UI (Phase C) is explicitly out of scope here.

---

## Citations

- `D-PROACTIVE-ESCALATION-SURFACING` — CEO decision authorising this work (part 2).
- Principle 1 (events-are-truth) — the surface is a query, never stored state.
- Principle 6 (autonomous-by-default; escalations are first-class typed channels).
- `platform/escalation/channel.ts` — the reused `AgentEscalation` lifecycle.
- `D-RMS-PHASE-3` — events-first filing of this spec as a `RecordFiled` document.
