---
title: Per-persona goal-loop substrate — specification
authors:
  - Atlas (Core banking platform architect; substrate) — primary
  - Senna (Security engineer) — Principle 4 gate
  - Rashida (Chief Information Security Officer, governance) — Principle 4 gate
  - Vera (Internal audit / continuous-assurance engineer) — audit-event shapes
  - Anya (Data substrate engineer) — world-state read-API
date: 2026-05-11
summary: Specifies the substrate primitives (typed world-state read API, goal-derivation hook on AgentRunner, three planning-trace event shapes, run-handler implementation contract) that a per-persona goal-loop needs to make Principle 7 production-true. Does NOT implement those primitives and does NOT implement any persona's goal loop — build dispatches per-persona under separate authorisations follow.
decision-required: false
authority: D-AGENT-AUTONOMY-OPERATIONAL (Slice 3 spec; CEO-approved 2026-05-11)
status: spec — not yet built; build dispatched per-persona under separate authorisations
---

# Per-persona goal-loop substrate — specification

**Primary author:** Atlas (Core banking platform architect; substrate)
**Co-authors / gate-reviewers:** Senna (Security engineer) + Rashida (Chief Information Security Officer, governance) — Principle 4 designed-in gate; Vera (Internal audit / continuous-assurance engineer) — planning-trace event-shape review for Wave-5 capability-creep recon compatibility; Anya (Data substrate engineer) — world-state read-API ↔ semantic layer seam.
**Date:** 2026-05-11
**For:** Marc (CEO), Scrooge (Chief of Staff / Orchestrator), per-persona owners receiving downstream build briefs.
**Authority:** `D-AGENT-AUTONOMY-OPERATIONAL` (CEO-approved 2026-05-11), Slice 3 — spec-only under this decision; per-persona build dispatched separately. Standing principles: Principles 1, 2, 4, 6, 7.
**Predecessor brief:** [`Owner Inbox/2026-05-11_atlas_agent-autonomy-operational-status-and-delta-brief.md`](2026-05-11_atlas_agent-autonomy-operational-status-and-delta-brief.md) §3 Gap 4 + §4 Slice 3.

> **Derivation note (Principle 6 — downward).** This spec sits at the *standard* layer. It implements the Information Security Policy + Secure SDLC Policy requirements that Principle 4 binds (designed-in security gate before any build code lands), and the operational realisation of the Operational Resilience Policy (Joint Standard 2 of 2024) that Principle 7 binds (the substrate that makes "autonomous by default; humans oversee the residual" production-true rather than session-simulated). Citations name the obligations register IDs (`ORG-CY-03`, `ORG-CY-12`, `ORG-CY-14`, `ORG-OP-RES-*`) where the discharge lands.

---

## 1. Purpose + scope of the spec

This spec defines the **substrate primitives** a per-persona goal-loop needs:

1. A typed read-only API (`AgentWorldStateReader`) into world state — events, registers, recon findings, escalations addressed-to-this-agent, the agent's own recent runs.
2. A goal-derivation hook on the existing `AgentRunner` (`runWithGoal`) — given (agent identity, parsed spec §9 / §11 / §13, world-state snapshot, recent-runs summary), produce one of: `GoalDecision` (act), `GoalEscalation` (escalate to human-overseer per Principle 7), or `null` (no action justified — the safe default).
3. Three planning-trace event shapes (`AgentGoalEvaluated`, `AgentGoalSelected`, `AgentGoalDeferred`) emitted at every loop iteration, joining the existing `AgentDecision` / `AgentEscalation` event families — they don't replace them.
4. A **run-handler implementation contract** that says what an agent's per-persona goal-loop run-handler MUST consume, MUST emit, MAY use, and MUST NOT do.

**This spec does NOT:**
- Implement any of the above primitives. No code lands under this spec; it ships one markdown file in `Owner Inbox/`.
- Implement any persona's goal loop. The per-persona goal loops (Vera, Mira, Owen, Bea, Atlas first; rest of the fleet later) are dispatched per-persona under separate authorisations after Senna+Rashida sign off on this spec and the gating threats (T-01 + Vera Wave-5 stub) have closed.
- Replace or supersede the existing `AgentRunner`, the spec-parser, the permission-gate, or any other A0–A4 substrate component. The goal loop is an **additive** seam on top of the existing AgentRunner lifecycle wrapper (S8 Tier 1, PR #189).

**Why spec-only.** Goal loops are the substrate's largest design risk — wrong primitives here mean capability creep, undetected misaligned action, or autonomous operation outside any procedure (a Principle 6 violation). The spec is the gate; the per-persona builds are individually-sizeable work that Marc can authorise one at a time.

---

## 2. Principles applied

Each binding is one line; the linked principle file is canonical.

- **Principle 1 (events as truth)** — every goal-derivation iteration emits a typed event for replay/audit, regardless of outcome. The chosen-goal path emits more (selected + plannedEvents); the no-action path emits exactly one (`AgentGoalDeferred`); both write to the canonical event store. → [`Principles/1-events-are-truth.md`](../Principles/1-events-are-truth.md)
- **Principle 2 (citation discipline)** — every `AgentGoalSelected` carries a non-empty `mandateCitations` array (a §9 / §11 / §13 row in the persona's `/Team/<Name>.md`) AND a non-empty `procedureCitations` array (a step in a procedure under `/Procedures/`). No goal is emittable without both. → [`Principles/2-citation-discipline.md`](../Principles/2-citation-discipline.md)
- **Principle 4 (security designed in)** — the goal-loop runs inside the existing worker-isolation primitive (`runner-worker.ts`, S8 Tier 1, PR #189); no goal-loop ever runs without an issued `AgentIdentity` + published `PermissionPolicy`; emitted-event types ⊆ `eventAppendAllowList` enforced at the existing `permission-gate`; capability creep is recon-detected (Vera Wave-5 `recon:goal-loop-capability`). → [`Principles/4-security-designed-in.md`](../Principles/4-security-designed-in.md)
- **Principle 6 (single-graph discipline)** — every selected goal traces to a §9 / §11 / §13 row (downward from spec) and through the cited procedure step to a policy and a regulation (upward chain). Goals without citation are spec-violation findings, not allowable. → [`Principles/6-single-graph-discipline.md`](../Principles/6-single-graph-discipline.md)
- **Principle 7 (autonomous by default; humans oversee the residual)** — the loop IS the operational realisation of P7; `GoalEscalation` is the named seam where the human overseer enters. Today Scrooge-in-session synthesises both the goal and the escalation; this spec moves goal synthesis into the agent process and preserves Scrooge / Marc as the escalation overseer (not the originator). → [`Principles/7-autonomous-by-default.md`](../Principles/7-autonomous-by-default.md)

---

## 3. Interface seams (the heart of the spec)

This section is the gate-reviewable substance. Each seam states (a) the TypeScript interface signature, (b) the file path it would live at, (c) the contract — preconditions, postconditions, what it MUST and MUST NOT do, (d) the audit-event shape it emits (where applicable).

All TypeScript signatures below are **concrete contracts**, not pseudo-code, so Senna+Rashida can review them as if they were code-review input. They are also intentionally narrow — the substrate exposes the minimum surface needed for the four required behaviours, no more.

### 3.1 `AgentWorldStateReader` — typed read API into world state

**File path.** `prototype/platform/agent-runtime/world-state.ts` (new).

**Interface signature.**

```ts
import type { AgentUrn } from "./registry";
import type { Event, EventId } from "../event-store/types";
import type {
  AgentEscalationPayload,
  SubstrateAgentRunCompletedPayload,
} from "../event-store/event-types";

/**
 * The seven RMS registers (per `D-RMS-PHASE-1`, CEO-approved 2026-05-09)
 * plus the new Party register (per `D-PARTY-REGISTER`, 2026-05-11). The
 * goal-loop reads via this typed accessor; it does not file-read the
 * register markdown directly.
 */
export type RegisterName =
  | "decisions"
  | "correspondence"
  | "agent-runs"
  | "documents"
  | "feedback"
  | "briefs"
  | "workstreams"
  | "party";

export interface RegisterRow {
  readonly id: string;
  readonly emittedAt: string;
  readonly emittedBy: AgentUrn | "human:marc" | "human:overseer";
  readonly payload: Record<string, unknown>;
}

export interface Register {
  readonly name: RegisterName;
  readonly asOf: string;
  /** Snapshot hash — used as `worldStateSnapshotHash` field in audit events. */
  readonly snapshotHash: string;
  readonly rows: readonly RegisterRow[];
}

export interface AuditFinding {
  readonly findingId: string;
  readonly emittedAt: string;
  readonly raisedBy: AgentUrn; // typically "agent:vera"
  readonly addressedTo: AgentUrn;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly summary: string;
  readonly citations: readonly string[];
}

export interface AgentEscalationView {
  readonly escalationId: string;
  readonly raisedBy: AgentUrn;
  readonly addressedTo: AgentUrn | "human:marc";
  readonly raisedAt: string;
  readonly deadline: string;
  readonly question: string;
  readonly options: readonly string[];
  readonly status: "open" | "acknowledged" | "decided" | "delegated" | "overdue";
}

export interface AgentRunSummary {
  readonly runId: string;
  readonly trigger: { readonly kind: "scheduled" | "event-driven" | "on-request"; readonly id: string };
  readonly startedAt: string;
  readonly completedAt: string;
  readonly outcome: "ok" | "failed";
  readonly eventsEmitted: number;
  readonly deliverable?: string;
}

/**
 * The world-state snapshot a single goal-loop iteration sees. Materialised
 * by `AgentWorldStateReader.snapshot(agentUrn)` so the iteration's view of
 * the world is stable for the duration of the iteration; a hash of this
 * snapshot is recorded on every emitted planning-trace event so Vera can
 * verify goal-derivation reproducibility.
 */
export interface WorldStateSnapshot {
  readonly agentUrn: AgentUrn;
  readonly takenAt: string;
  /** SHA-256 hex of the canonicalised snapshot — used in event payloads. */
  readonly snapshotHash: string;
  readonly recentEvents: readonly Event[];
  readonly registers: Readonly<Record<RegisterName, Register>>;
  readonly openEscalationsAddressedToMe: readonly AgentEscalationView[];
  readonly auditFindingsForMe: readonly AuditFinding[];
  readonly myRecentRuns: readonly AgentRunSummary[];
}

export interface AgentWorldStateReader {
  /**
   * Materialise a stable snapshot for one goal-loop iteration. Pre: agent
   * is registered in the registry. Post: `snapshot.snapshotHash` is the
   * canonical hash of the snapshot's contents.
   */
  snapshot(agentUrn: AgentUrn): WorldStateSnapshot;

  /** Recent events relevant to this agent (subscribed types ∪ events about this agent). */
  readEventsSince(agentUrn: AgentUrn, sinceEventId: EventId | undefined): readonly Event[];

  /** Typed accessor for one of the seven RMS registers + Party. */
  readRegister(registerName: RegisterName): Register;

  /** Open escalations whose `addressedTo` matches this agent. */
  readOpenEscalationsAddressedToMe(agentUrn: AgentUrn): readonly AgentEscalationView[];

  /** Vera findings whose `addressedTo` matches this agent and whose status is still "open". */
  readReconFindingsForMe(agentUrn: AgentUrn): readonly AuditFinding[];

  /** This agent's most recent N runs, newest first. */
  readMyRecentRuns(agentUrn: AgentUrn, n: number): readonly AgentRunSummary[];
}
```

**Contract.**

- **Preconditions.** The agent must be in the registry (`AgentRegistered` event observed). The reader is constructed with a reference to the canonical `EventStore`; it does NOT take a writer.
- **Postconditions.** Every method returns deeply-immutable data. Repeated calls within a single snapshot produce identical results (the snapshot is materialised once via `snapshot()` and re-read from there). The `snapshotHash` is a SHA-256 of the JSON-canonicalised snapshot and is the same value that downstream audit events embed.
- **MUST.** Read-only. Project from the canonical event store via existing projections (RMS registers per Anya's slice 3 work; oversight channel for escalations; recon harness for findings; lifecycle pairs for own runs). Honour the existing permission-policy `eventSubscribeAllowList` — an agent that has not subscribed to a typed event must not see it through `readEventsSince` (defence-in-depth even though reads aren't currently gate-enforced).
- **MUST NOT.** Append events. Mutate registers. Cache across snapshots without the snapshot mechanism (no hidden in-process state beyond the per-snapshot lifetime). Bypass the existing `permission-gate` by reading directly from the underlying store when a projection exists.
- **Substrate gap (declared up-front).** The `permission-gate` does not currently enforce read-side access (gate is append-side only, T-01 status notwithstanding). The world-state reader honours the subscribe allow-list at the *application layer*; a substrate-level read-side gate is a future hardening that lands as a separate decision once Anya's RMS register projections are stable.

**Audit-event shape.** None at the reader itself — reads do not emit events. The reader's *outputs* are embedded by hash into the planning-trace events emitted by the goal loop.

### 3.2 `AgentRunner.runWithGoal` — goal-derivation hook

**File path.** Hook lives on the existing `AgentRunner` interface; concrete extension in `prototype/runtime/run.ts` next to the existing `runAgent()` entry point. New module for the goal-loop primitives at `prototype/platform/agent-runtime/goal-loop.ts`.

**Interface signature.**

```ts
import type { AgentUrn } from "../platform/agent-runtime/registry";
import type { AgentSpec } from "../platform/agent-runtime/spec-parser";
import type { WorldStateSnapshot, AgentRunSummary } from "../platform/agent-runtime/world-state";
import type { Event } from "../platform/event-store/types";

/** A typed citation to an authorising row in the agent's spec. */
export interface MandateCitation {
  /** Which spec section the row lives in. */
  readonly section: "9-decisions-in-scope" | "11-outputs" | "13-procedures-owned";
  /** The row's first-column value (decision name, output name, procedure path). */
  readonly rowKey: string;
  /** SHA-256 of the spec at parse time — pinned to the version the goal was derived against. */
  readonly specHash: string;
}

/** A typed citation to a procedure step. */
export interface ProcedureCitation {
  /** Procedure file path (e.g. `Procedures/by-policy/permission-gate-operations.md`). */
  readonly procedurePath: string;
  /** Step identifier within the procedure (e.g. `step-3`, or a section anchor). */
  readonly stepId: string;
  /** SHA-256 of the procedure file at parse time. */
  readonly procedureHash: string;
}

/** Bound free-text — short label matching one of the persona's §9 row labels (closed set). */
export type GoalLabel = string;

export interface PlannedEventStub {
  /** Event type the agent intends to emit if its goal is approved/executed. */
  readonly type: string;
  /** Optional preview payload; the actual payload is built at emit time. */
  readonly payloadPreview?: Record<string, unknown>;
}

export interface GoalDecision {
  readonly kind: "decision";
  readonly chosen: GoalLabel;
  readonly rationale: string;
  readonly mandateCitations: readonly MandateCitation[];
  readonly procedureCitations: readonly ProcedureCitation[];
  readonly plannedEvents: readonly PlannedEventStub[];
}

export interface GoalEscalation {
  readonly kind: "escalation";
  /** The unresolved question. */
  readonly question: string;
  /** Options the agent considered but could not choose between. */
  readonly options: readonly string[];
  /** Why the agent's mandate could not resolve this alone — cites §10 escalation row. */
  readonly escalationRationale: string;
  readonly mandateCitations: readonly MandateCitation[];
  /** Named overseer URN — typically `human:marc` or another agent per §10. */
  readonly addressedTo: AgentUrn | "human:marc";
  /** ISO-8601 — derived from the §10 row's "Deadline" column. */
  readonly deadline: string;
}

export type GoalLoopOutcome = GoalDecision | GoalEscalation | null;

export interface RunWithGoalArgs {
  readonly agent: { readonly urn: AgentUrn; readonly publicKeyVersion: number };
  readonly spec: AgentSpec;
  readonly worldState: WorldStateSnapshot;
  readonly recentRuns: readonly AgentRunSummary[];
}

/** The goal-derivation hook itself. Implementation-specific (LLM, rule engine, hybrid). */
export type GoalDeriver = (args: RunWithGoalArgs) => Promise<GoalLoopOutcome>;

/**
 * Substrate-side wrapper that enforces the contract uniformly across all
 * goal-loop run-handlers — emits the planning-trace events, validates the
 * outcome shape, runs the permission-gate check on `plannedEvents`, and
 * dispatches the resulting decision/escalation through the canonical
 * paths (existing `AgentDecision` / `AgentEscalation` event families).
 *
 * `derive` is the persona-supplied goal-derivation function; the wrapper
 * is single-source-of-truth for what happens around it.
 */
export interface AgentGoalLoopRunner {
  runWithGoal(
    args: RunWithGoalArgs,
    derive: GoalDeriver,
  ): Promise<{ readonly outcome: GoalLoopOutcome; readonly eventsEmitted: number }>;
}
```

**Contract.**

- **Preconditions.** `args.agent.urn` matches an `AgentRegistered` event whose `policyHash` matches the latest `PermissionPolicyPublished` for that agent (no spec-vs-policy drift — T-06 mitigation). `args.spec.specHash` equals the registered specHash. `args.worldState` was produced by the same iteration.
- **Postconditions.** Exactly one of the three audit-event paths fires per call:
  - `outcome === null` → one `AgentGoalEvaluated` + one `AgentGoalDeferred`.
  - `outcome.kind === "decision"` → one `AgentGoalEvaluated` + one `AgentGoalSelected` + (later, on actual emission) the `plannedEvents`.
  - `outcome.kind === "escalation"` → one `AgentGoalEvaluated` + one `AgentEscalation` (existing event family).
  Plus zero or more `SubstrateAlert` events if the contract is violated.
- **MUST.** Validate `outcome` shape strictly before emitting. Run permission-gate check against every `plannedEvents[i].type` — any type ∉ `eventAppendAllowList` ⇒ refuse the goal, emit `AgentGoalDeferred` with reason `"planned event type outside allow-list"`, emit `SubstrateAlert` of class `integrity`. Embed `worldState.snapshotHash` in every emitted planning-trace event. Return immediately if `derive` throws — wrap as `AgentGoalDeferred` with reason `"goal-deriver threw"`.
- **MUST NOT.** Bypass the worker-isolation primitive (the goal loop runs inside `createRunnerWorker`). Cross worktree boundaries (`WorktreeBoundaryError` already detects this). Hold `worldState` across iterations (the snapshot is per-iteration). Auto-emit anything beyond the planning-trace events — the *actual* `plannedEvents` emission is a separate authorised step driven by the persona's run-handler, not by the wrapper.
- **`null` is the safe default.** A goal-deriver that cannot find a justified action MUST return `null`, not invent one. The Vera Wave-5 recon checks the ratio of `AgentGoalDeferred` to `AgentGoalSelected` — too few defers per agent over a window suggests an over-eager deriver; too many suggests under-implementation.

### 3.3 Planning-trace event shapes

**File path.** New schemas in `prototype/platform/event-store/event-types.ts`, joining the existing `AgentDecision` / `AgentEscalation` family. Constructor functions follow the existing pattern (`makeAgentGoalEvaluated`, `makeAgentGoalSelected`, `makeAgentGoalDeferred`).

**Schemas.**

```ts
import { z } from "zod";

// Always emitted at every goal-loop iteration, regardless of outcome.
export const agentGoalEvaluatedPayloadSchema = z.object({
  agentUrn: z.string(),
  iterationId: z.string(), // ULID — unique per goal-loop invocation
  worldStateSnapshotHash: z.string(),
  recentRunCount: z.number().int().nonnegative(),
  /** Candidates the deriver considered before selecting / deferring. */
  candidateGoals: z.array(z.object({
    label: z.string(),
    mandateRowKey: z.string(),
    weight: z.number().optional(),
  })),
  chosen: z.string().optional(),
  /** Free-text — whatever the deriver wants to say about why. */
  reason: z.string().max(2000),
});
export type AgentGoalEvaluatedPayload = z.infer<typeof agentGoalEvaluatedPayloadSchema>;

// Emitted only when a goal is chosen (path: outcome.kind === "decision").
export const agentGoalSelectedPayloadSchema = z.object({
  agentUrn: z.string(),
  iterationId: z.string(), // matches the AgentGoalEvaluated for the same iteration
  goal: z.string(), // matches AgentGoalEvaluated.chosen
  mandateCitations: z.array(z.object({
    section: z.enum(["9-decisions-in-scope", "11-outputs", "13-procedures-owned"]),
    rowKey: z.string(),
    specHash: z.string(),
  })).min(1), // P2 — at least one mandate citation REQUIRED
  procedureCitations: z.array(z.object({
    procedurePath: z.string(),
    stepId: z.string(),
    procedureHash: z.string(),
  })).min(1), // P2 — at least one procedure citation REQUIRED
  plannedEvents: z.array(z.object({
    type: z.string(),
    payloadPreview: z.record(z.unknown()).optional(),
  })),
});
export type AgentGoalSelectedPayload = z.infer<typeof agentGoalSelectedPayloadSchema>;

// Emitted when no goal is justified or world-state is insufficient.
export const agentGoalDeferredPayloadSchema = z.object({
  agentUrn: z.string(),
  iterationId: z.string(), // matches the AgentGoalEvaluated for the same iteration
  reason: z.string().max(2000),
  /** Optional ISO-8601 instant after which the agent should retry. */
  retryAfter: z.string().optional(),
  /** Optional: the derived candidates the agent considered but rejected. */
  consideredAndRejected: z.array(z.object({
    label: z.string(),
    rejectionReason: z.string(),
  })).optional(),
});
export type AgentGoalDeferredPayload = z.infer<typeof agentGoalDeferredPayloadSchema>;
```

**Contract.**

- **Idempotency.** `iterationId` is unique per goal-loop iteration (ULID minted by the wrapper). The store rejects duplicate `(type, iterationId)` rows for the goal-loop event types — this is the same pattern `AgentEscalation` uses on `escalationId`.
- **Pairing invariant.** Every `AgentGoalEvaluated.iterationId` MUST be paired (in the same run-id, within the same iteration) with exactly one of: `AgentGoalSelected` (same iterationId), `AgentGoalDeferred` (same iterationId), or `AgentEscalation` (raised in the same iteration; pairing recorded via the wrapper). Vera Wave-5 `recon:goal-loop-capability` asserts pairing.
- **Citation invariant.** `AgentGoalSelected.mandateCitations` and `.procedureCitations` are both `.min(1)` at the schema layer. The store-level validation rejects empty arrays — this is Principle 2 in zod-form.
- **They DO NOT replace.** `AgentDecision` and `AgentEscalation` remain the canonical event types for the agent's *actual* decision / escalation outputs. The goal-loop events are the *deliberation trace* — they show the agent considered the world, weighed candidates, and either acted, deferred, or escalated. Without them, the audit trail says "agent emitted X" but not "agent considered alternatives Y, Z and rejected them" — which is the substance Vera Wave-5 capability-creep recon needs to detect drift.

### 3.4 Run-handler implementation contract

This is the contract a per-persona goal-loop run-handler agrees to when it is dispatched. It is **substrate-enforced** through the wrapper in §3.2; this section names it explicitly so per-persona owners know what they are agreeing to.

**MUST consume.**
- The agent's `AgentSpec` parsed from `/Team/<Name>.md` — specifically §9 (Decisions in scope), §11 (Outputs), §13 (Procedures owned). The wrapper passes this in via `args.spec`.
- A `WorldStateSnapshot` materialised by `AgentWorldStateReader.snapshot()`. The handler MUST NOT call the reader directly — it consumes the pre-materialised snapshot only, so the snapshotHash is stable for the iteration.
- Its own recent runs (newest first, capped at the value the wrapper passed — typically 10 — so the deriver can consider "did I already do this in the last cycle?").

**MUST emit.**
- Exactly one `AgentGoalEvaluated` per invocation (the wrapper does this; the handler does not call the constructor directly).
- Exactly one of: `AgentGoalSelected` (if `outcome.kind === "decision"`), `AgentGoalDeferred` (if `outcome === null`), or `AgentEscalation` (if `outcome.kind === "escalation"`). Again, the wrapper handles emission — the handler returns the `outcome` and the wrapper turns it into events.

**MAY use.**
- An LLM call (Anthropic API per the `claude-api` skill — see §7 open items on cost).
- A pure rule engine (decision-tables, registries, calendar logic).
- A hybrid (rule-engine pre-filter → LLM tie-break, or vice versa).
- The substrate is implementation-agnostic — the contract is what the deriver returns, not how it derives.

**MUST NOT.**
- Bypass the permission-policy gate (`eventEmitAllowList`). The wrapper's pre-check (§3.2) catches this; the handler must not try to emit out-of-allow-list events even after a deferral.
- Emit events outside the agent's `eventAppendAllowList` — checked at the wrapper layer (gate-enforced once T-01 closes; advisory-text today, but the wrapper enforces in code regardless).
- Act on a `worldState` whose `snapshotHash` does not match the wrapper-supplied value (defence against time-of-check-to-time-of-use). The handler does not have a way to refresh the snapshot mid-iteration; if the world changed materially, that's the *next* iteration's problem.
- Side-effect outside the event store (no file writes, no HTTP calls without going through a registered system capability — `eventEmitAllowList`'s sister field `capabilityAllowList` constrains this).

---

## 4. Per-persona phasing recommendation

The first cohort is the **most-typed mandates with least design risk** — agents whose §9 / §11 / §13 sections already point at typed event streams or registers, so the deriver has structured signal to read rather than free-text to interpret.

| Order | Persona | Why first cohort | Goal-loop emits |
|---|---|---|---|
| 1 | **Atlas (Core banking platform architect; substrate)** | **Dogfood candidate** — substrate engineer first proves the seam. §9 typed against substrate-state snapshots + Vera findings + open substrate-gaps inventory. Lowest-risk because the deriver's domain is the substrate itself; if the loop misbehaves, Atlas is the one detecting and fixing. | `AgentDecision` (substrate-change proposals), `AgentEscalation` (when a decision needs Marc per §10) |
| 2 | **Vera (Internal audit / continuous-assurance engineer)** | Mandate is mostly typed against existing recon findings + the recon harness itself (`prototype/platform/recon/`). Goal-loop reads `auditFindingsForMe` ∅ (Vera doesn't address findings to itself), `recentEvents` of all subscribed types, and emits `AuditFinding` events. Third-line independence preserved — Vera's loop doesn't act on the world, it observes and reports. | `AuditFinding`, `AgentEscalation` (to Thandiwe CAE per §10) |
| 3 | **Mira (Compliance / RegTech engineer)** | Mandate typed against the obligations register (`Regulations/_obligations-register.md`) and the regulator-citation URN registry. Goal-loop reads new regulatory events + obligations-register diffs and emits compliance findings. Closed-set domain — compliance findings are a small enumerated set. | `ComplianceFinding`, `AgentDecision` (obligations-register row updates), `AgentEscalation` (to MLRO / CCO seat) |
| 4 | **Owen (Company Secretary, governance)** | Mandate typed against governance procedures + the new RMS registers (per `D-RMS-PHASE-1`). Goal-loop reads the briefs / decisions / correspondence registers and emits secretariat actions (board-pack-prep, minute-drafts, register row updates). Heavy register-driven mandate = clean read API surface. | `AgentDecision` (procedure publication, register updates), `AgentEscalation` (to Marc on board-level matters) |
| 5 | **Bea (Dashboard / observability + accounting readiness engineer)** | Goal-loop reads the dashboard projection cache + the IFRS classification rules (typed in `prototype/runtime/agents/bea-*.ts` already). Emits `IFRSClassificationApplied`, dashboard-tile-refresh events, accounting-readiness findings. Dashboard mandate gives clear daily/weekly cadence signal. | `IFRSClassificationApplied`, `AgentDecision` (accounting-readiness gate calls), `AgentEscalation` (to CFO seat) |

**Optional 6th — under review for cohort 1.** **Anya (Data substrate engineer)** — mandate is heavily typed against the data-provenance event family (slices 1–6) and the semantic layer. Adding her to cohort 1 would close the world-state ↔ semantic-layer seam from both ends; deferring to cohort 2 keeps cohort 1 to five and lets Anya's slice-6 work close first. Recommend deferring; revisit when slice-6 lands.

**Personas explicitly NOT in cohort 1 and why.**

- **Niko (Customer onboarding / lifecycle)** — `buildPhaseStatus: paused` per `Team/_team-roster.json`; activates at licence-day. No real customers ⇒ no world-state to derive against.
- **Sade (HR / AgentOps)** — `buildPhaseStatus: reshape pending`; reshape to AgentOps. Goal loop deferred until the reshape spec lands.
- **Yael (Tax)** — PAYE / EMP201 / IRP5 slice paused per `buildPhaseStatus`; CIT / VAT / STT / FATCA / CRS slice activates when revenue starts. Goal loop deferred until at least one tax slice is active.
- **Imani (Legal-as-code engineer)** — employment-contracts slice paused. Live ISDA / GMRA slice IS typed, but the goal-loop addition has design risk because clause-library is high-stakes free-text. Recommend cohort 2.
- **Engineering substrate personas without typed mandates yet** (e.g. Linnea on UI shell) — defer until §9 / §11 / §13 are upgraded to typed-row form.
- **Governance seats with thin operating specs** — Helena (CRO), Thandiwe (CAE), Rashida (CISO), Devon (COO) — most of their mandate is overseeing other agents' outputs (escalation-decide, periodic-review). Their goal loop primarily emits `AgentEscalationDecided` events; lower-priority because Marc is the current acting-overseer for each seat anyway. Recommend cohort 3 once cohort-1 escalation traffic is real.

**Cohort cadence.** First cohort dispatched as five separate per-persona briefs once this spec gates clear. Each brief is a single PR; suggested order is the table order (Atlas first to dogfood). Build runs in **shadow mode** for the first two substrate ticks per agent — the goal-loop runs and emits planning-trace events, but `plannedEvents` are NOT emitted. Vera reads the shadow output; Marc reviews; then `plannedEvents` go live per agent on a per-agent CEO-decision-record.

---

## 5. Threat-model gate (Senna + Rashida)

This section binds against [`Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md`](2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md). The goal-loop seam is a *new attack surface* on top of the substrate already threat-modelled — three of the existing threats compound here, and one is goal-loop-specific.

| Threat ID | Origin | How it binds on the goal-loop seam | Mitigation in this spec |
|---|---|---|---|
| **T-01 — Permission gate default-off (Critical)** | Senna+Rashida 2026-05-10 | The wrapper's pre-check on `plannedEvents` against `eventAppendAllowList` is the substrate's only enforcement of P2-citation discipline at append time. With the gate off, the pre-check is advisory; an out-of-allow-list `plannedEvents.type` would still emit. | **Hard gate.** The goal-loop spec **REQUIRES** `BANK_PERMISSION_GATE_ENABLED=true` (or the post-flip equivalent — the absent default = on, per Senna T-01 mitigation §1) in every environment a goal-loop run-handler ships into. The per-persona build dispatches will check this at boot and refuse to start with the gate off. |
| **T-03 — Capability creep on event-emit / event-subscribe / register-write (High)** | Senna+Rashida 2026-05-10 | The goal-loop emits more event types than today's reactive handlers (the three goal-loop events + the planned events). Drift between declared `eventAppendAllowList` and actually-emitted types is the failure mode. | **Vera Wave-5 recon.** A new pipeline (§6) compares `AgentGoalSelected.plannedEvents[].type` ∪ actually-emitted-types against the agent's `PermissionPolicyPublished.eventEmitAllowList`. Drift is an `AuditFinding`. |
| **T-05 — Escalation-bypass: agent emits `AgentDecision` for an in-scope-but-spec-escalating decision (High)** | Senna+Rashida 2026-05-10 | A misconfigured deriver could return `GoalDecision` for a `decisionClass` the spec §10 says should escalate, routing around the human overseer entirely. | **Wrapper pre-check.** If `outcome.kind === "decision"` AND `outcome.chosen` matches a row in `spec.decisionClassesEscalate` (per the T-03 mitigation extending the spec-parser to capture decision classes), the wrapper rejects the outcome, emits `AgentGoalDeferred` with reason `"chosen goal class escalates per spec §10"`, and emits `SubstrateAlert` of class `integrity`. The deriver's intent is preserved as `consideredAndRejected`. |
| **T-NEW — Goal hallucination: deriver invents a goal not present in the spec (High; goal-loop-specific)** | This spec | A deriver (especially LLM-backed) could synthesise a `chosen` label that does not match any §9 / §11 / §13 row. | **Closed-set assertion.** `AgentGoalSelected.goal` MUST match one of the persona's parsed §9 / §11 / §13 row labels (closed set known at registration time). The wrapper validates this against the parsed `AgentSpec`. Mismatch ⇒ same path as T-05: refuse, emit `AgentGoalDeferred`, emit `SubstrateAlert`. |
| **T-12 — Denial-of-service via runaway agent (Low today / Medium at commencement)** | Senna+Rashida 2026-05-10 | A misbehaving deriver could run goal loops at a much higher cadence than the agent's declared cadence. | **Cadence-binding.** The goal-loop wrapper checks the agent's recent `AgentGoalEvaluated` events against the spec's `## 6. Cadence` and refuses to invoke the deriver if the prior iteration is more recent than the cadence allows (with a configurable jitter tolerance). Substrate-level rate-limit per T-12's recommended mitigation is the longer-term backstop. |

**The spec's "do not build until" gate is.**

1. **T-01 closed.** `BANK_PERMISSION_GATE_ENABLED` defaults to `true` (Senna+Rashida T-01 mitigation §1) and the runtime fails to start without it. Status: open per `Owner Inbox/2026-05-10_atlas_t-01-permission-gate-secure-default.md` — closure is a separate decision (`D-T-01-PERMISSION-GATE-SECURE-DEFAULT`) that must land before goal-loop builds dispatch.
2. **Vera Wave-5 `recon:goal-loop-capability` pipeline registered.** Even as a stub, the harness must accept it so per-persona builds can rely on it being present. Vera's separate Wave-5 dispatch authors the pipeline in lockstep with this spec's first-cohort build.
3. **Per-persona spec-rider authored.** Each cohort-1 persona's build brief carries a one-page "spec-rider" — a per-persona instantiation of §3 + §4 + §5 of this spec, signed off by the persona-owner agent and re-reviewed by Senna+Rashida.

Senna+Rashida's gate-review of this spec produces an addendum (or a paired comment) confirming the four threats above are addressed-as-described. Without that addendum, no per-persona build dispatches.

---

## 6. Vera Wave-5 capability-creep recon hooks

Vera will recon against the goal-loop event stream once it is live. Pipeline name: `recon:goal-loop-capability`. The pipeline is *out of scope* for this spec to build (Vera's Wave-5 dispatch authors it), but the hooks the pipeline relies on are guaranteed by §3 of this spec.

**Recon assertions.**

1. **Pairing.** Every `AgentGoalEvaluated.iterationId` is paired with exactly one of `AgentGoalSelected`, `AgentGoalDeferred`, or `AgentEscalation` (within the same `runId`). Unpaired iterations are findings. Sub-assertion: the timestamps are monotone — Evaluated ≤ paired event, with bounded delta (≤ 60s).
2. **Allow-list discipline.** For every `AgentGoalSelected`, the union of `plannedEvents[].type` and actually-emitted event types in the same run ⊆ `PermissionPolicyPublished.eventEmitAllowList` for the agent at that moment. Drift is a finding (capability creep).
3. **Citation discipline.** Every `AgentGoalSelected` has `mandateCitations.length ≥ 1` AND `procedureCitations.length ≥ 1` (P2). The schema enforces this; the recon double-checks at the projection layer (defence in depth).
4. **Goal-shape discipline.** `AgentGoalSelected.goal` matches one of the persona's parsed §9 / §11 / §13 row labels (closed-set at the registered `specHash`). Mismatch is a finding (goal hallucination — T-NEW).
5. **Escalation-vs-decision discipline.** For every `AgentGoalSelected` whose `goal` matches a §10 escalation-class row, an `AgentEscalation` event MUST exist for the same iterationId AND no `AgentDecision` may exist. The reverse (escalation-class goal emitted as `AgentDecision`) is a finding (T-05).
6. **Cadence discipline.** Per-agent `AgentGoalEvaluated` rate ≤ declared cadence × jitter-tolerance over a rolling 1h window. Higher rate is a finding (T-12 early-warning).
7. **Defer-ratio sanity.** Per-agent ratio of `AgentGoalDeferred : AgentGoalSelected` over a rolling window of N runs. Ratio of zero (never defers) is a finding (over-eager deriver). Ratio of 1.0 (always defers) is a finding (under-implemented deriver).

**Hooks the recon depends on (guaranteed by §3 of this spec).**

- All planning-trace events are appended to the canonical event store (Principle 1 — no out-of-band ledger).
- `iterationId` is unique per goal-loop iteration (ULID).
- `worldStateSnapshotHash` is embedded in every planning-trace event (so reproducibility of goal-derivation is auditable: re-materialise the snapshot from the same hash, re-run the deriver, compare outcome).
- The agent's `PermissionPolicyPublished.policyHash` at the moment of `AgentGoalSelected` is recoverable by joining on the agent's specHash at the same moment.

---

## 7. Open items / explicit deferrals

The following are scope-clarifications or downstream decisions; they do not block this spec but the per-persona builds will need them resolved.

1. **LLM provider for goal-derivation.** Default candidate: Anthropic API per the `claude-api` skill. Cost framing: Marc's memory note (`feedback_no_idle_parallelize_aggressively`, also implicitly `project_ai_driven_bank` → "Anthropic API token spend — the largest current cost") flags Anthropic API as the largest current cost. Per-persona build briefs MUST estimate token spend at launch cadence + after first cohort settles; substrate provides a per-agent cost-cap (an `eventAppendAllowList`-shaped capability called `llm:goal-derive`, gated to a configurable monthly $ ceiling). Rule-engine derivers (T-NEW mitigation makes pure rule-engine attractive for high-stakes personas) avoid the cost entirely. **Defer:** the per-agent ceiling values to per-persona briefs.
2. **Goal cadence per persona.** Two patterns: (a) sub-cron of the scheduler tick (e.g. every 15m, every hour) — for substrate-state personas like Atlas / Bea who track slow-moving world; (b) event-driven only — fire on subscribed events for personas whose mandate is reactive (Vera on findings, Mira on regulatory events). **Recommendation:** event-driven for cohort 1 except Atlas (which is event-driven plus an hourly tick to catch substrate-drift between events). Per-persona briefs lock the choice.
3. **Conflict resolution when two agents propose goals that touch the same artefact.** Not addressed in this spec — the substrate has no notion of "this artefact has a primary owner; concurrent edits conflict". **Defer until cohort 1 runs in shadow mode**: observe whether conflicts arise empirically (most likely between Atlas-substrate-changes and Vera-finding-emission), then design from evidence. Honest framing: this is a Phase-2 problem for the goal-loop substrate; Phase 1 is "agents pursue their mandates"; Phase 2 is "agents coordinate".
4. **Read-side permission-gate enforcement.** The `AgentWorldStateReader` honours subscribe-allow-lists at the application layer (§3.1 substrate-gap declaration). A substrate-level read-side gate (parallel to the existing append-side gate) is a future hardening, sized at ~1 PR, deferred until cohort 1 shadow runs prove the read-API surface is stable.
5. **Sealed-payload reads (POPIA s.71, fraud / popia-incident escalations).** The reader's `readOpenEscalationsAddressedToMe` MUST mask `sealed.payload` content for any escalation whose `sealed.reason ∈ {fraud, whistleblowing, popia-incident}` — only the metadata (raisedAt, deadline, addressedTo) is readable; the question/options content is sealed-routed per the existing escalation channel logic. **Defer:** the masking rule wiring to per-persona briefs (Iris reviews).
6. **Idempotency across iteration retries.** If a goal loop iteration crashes mid-flight (between `AgentGoalEvaluated` and the paired emission), the next iteration MUST detect the orphan and either complete the pairing (emit `AgentGoalDeferred` with reason `"prior iteration crashed"`) or skip and re-evaluate. **Recommendation:** the wrapper, on startup, scans for unpaired `AgentGoalEvaluated` events for its agent and emits a `AgentGoalDeferred` per orphan before doing anything new. Codify in §3.2 wrapper contract once first cohort builds.

---

## 8. Substrate gaps surfaced (Principle 7 inventory transparency)

| Gap | Owner | Trigger to close |
|---|---|---|
| `AgentWorldStateReader` not yet built | Atlas (substrate) | Cohort-1 first build (Atlas-dogfood) |
| `AgentGoalLoopRunner` wrapper not yet built | Atlas (substrate) | Cohort-1 first build |
| Three planning-trace event types not yet schema-registered | Atlas (substrate) | Cohort-1 first build |
| Spec-parser does not yet expose §9 row labels as a closed-set list (only the count) — required by goal-shape discipline (§6 #4) | Atlas (substrate) | Pre-cohort-1 — small parser extension; bundles with the T-03 / T-05 parser change Senna+Rashida already routed |
| Spec-parser does not yet expose §10 escalation-class row labels — required by §5 T-05 mitigation | Atlas (substrate) | Pre-cohort-1 — same parser change as above |
| Spec-parser does not yet expose §13 procedure-step IDs (only procedure paths) — required by procedure-citation `stepId` field | Atlas (substrate) + Owen (procedure-step-ID convention author) | Pre-cohort-1 — Owen authors the step-ID convention in `Procedures/_step-id-convention.md`; parser extends |
| `recon:goal-loop-capability` pipeline not yet registered | Vera (Wave-5 dispatch) | Vera's separate Wave-5 dispatch — co-sequenced with cohort-1 first build |
| `BANK_PERMISSION_GATE_ENABLED` defaults off (T-01 Critical) | Atlas (substrate) · Senna · Rashida | `D-T-01-PERMISSION-GATE-SECURE-DEFAULT` (already routed) — gating prerequisite for cohort-1 dispatch |
| RMS register projections (cohort-1 Bea, Owen depend on `decisions`, `correspondence`, `briefs`, `workstreams` registers being readable) | Owen + Atlas (per `D-RMS-PHASE-1`) | RMS Phase 1 substantially complete per session 2026-05-10; verify register projections expose typed read API by cohort-1 dispatch |
| LLM cost-cap capability (`llm:goal-derive` with per-agent monthly ceiling) | Atlas (substrate) | Pre-cohort-1 if any cohort-1 persona uses LLM-backed derivation; deferrable if first cohort is rule-engine-only |
| Per-agent cadence-binding rate-limit (T-12 mitigation §5) | Atlas (substrate) | Cohort-1 first build (in the wrapper) |
| Read-side permission-gate (§7 open item #4) | Atlas (substrate) | Future hardening — post-cohort-1 |
| Conflict resolution between concurrent goal-emitters (§7 open item #3) | Atlas (substrate) | Phase-2 design — post-cohort-1 evidence |

---

## 9. Citation chain

**Standing principles** (`CLAUDE.md` Principles 1, 2, 4, 6, 7 — full text in `/Principles/`):
- [`Principles/1-events-are-truth.md`](../Principles/1-events-are-truth.md)
- [`Principles/2-citation-discipline.md`](../Principles/2-citation-discipline.md)
- [`Principles/4-security-designed-in.md`](../Principles/4-security-designed-in.md)
- [`Principles/6-single-graph-discipline.md`](../Principles/6-single-graph-discipline.md)
- [`Principles/7-autonomous-by-default.md`](../Principles/7-autonomous-by-default.md)

**Authorising decision (this spec is the deliverable of Slice 3):**
- `D-AGENT-AUTONOMY-OPERATIONAL` — CEO-approved 2026-05-11. Source brief: [`Owner Inbox/2026-05-11_atlas_agent-autonomy-operational-status-and-delta-brief.md`](2026-05-11_atlas_agent-autonomy-operational-status-and-delta-brief.md) §3 Gap 4 + §4 Slice 3.

**Predecessor substrate spec (now superseded by D-AGENT-AUTONOMY-OPERATIONAL but cited as the source of A0–A4 primitives the goal-loop layers on):**
- [`Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md`](2026-05-07_atlas_agent-runtime-substrate-spec.md) — A0–A5 + M8 spec. Lifecycle wrapper, identity issuer, permission policy publisher, event-trigger bus, oversight UI all live and consumed by §3 of this spec.

**Threat model gating this spec (§5):**
- [`Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md`](2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md) — 12 threats; T-01 Critical, T-03 + T-05 + T-12 bind on the goal-loop seam.
- [`Owner Inbox/2026-05-10_atlas_t-01-permission-gate-secure-default.md`](2026-05-10_atlas_t-01-permission-gate-secure-default.md) — T-01 closure routing.

**Adjacent substrate spec (consumer of the goal-loop's `AgentEscalation` outputs):**
- [`Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`](2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md) — RMS Phase 1; the seven RMS registers cohort-1 personas read via `AgentWorldStateReader.readRegister()`.

**Substrate-state references (current state of A0–A4 the goal-loop sits on):**
- [`Owner Inbox/2026-05-10_atlas_s8-substrate-state-v2.md`](2026-05-10_atlas_s8-substrate-state-v2.md) — substrate state at session 2026-05-10.
- [`Owner Inbox/2026-05-10_atlas_s8-a4-fleet-rollout.md`](2026-05-10_atlas_s8-a4-fleet-rollout.md) — 27 personas registered.
- [`Owner Inbox/2026-05-10_atlas_agent-runner-worker-isolation-spike.md`](2026-05-10_atlas_agent-runner-worker-isolation-spike.md) — worker-isolation primitive (§3.2 goal loop runs inside this).

**Persona-spec template (the §9 / §11 / §13 sections the goal loop reads):**
- [`Team/_agent-spec-template.md`](../Team/_agent-spec-template.md)

**Cohort-1 persona files (the §9 / §11 / §13 the first cohort's derivers will consume):**
- [`Team/Atlas.md`](../Team/Atlas.md)
- [`Team/Vera.md`](../Team/Vera.md)
- [`Team/Mira.md`](../Team/Mira.md)
- [`Team/Owen.md`](../Team/Owen.md)
- [`Team/Bea.md`](../Team/Bea.md)

**Source policies (downward-derivation per Principle 6):**
- Information Security Policy (`ORG-CY-*` rows in `Regulations/_obligations-register.md`) — the gate-discipline binding in §5.
- Secure SDLC Policy (`ORG-CY-12`, `ORG-CY-14`) — the design-time threat-model gate in §5.
- Operational Risk Policy (Joint Standard 2 of 2024) — operational realisation of "autonomous by default".
- Operational Resilience (BCBS principles) — read-side cadence-binding (§5 T-12).

**Source regulations:**
- Banks Act 94 of 1990 — the substrate hosts the operational realisation of the AI-bank's labour force.
- Joint Standard 1 of 2024 (cyber resilience) — the substrate operates under this once licence-day binds.
- Joint Standard 2 of 2024 (operational risk) — the goal-loop is operational-resilience-relevant capability.
- POPIA s.71 (automated decisioning) — the standing notice the oversight UI carries; the `AgentEscalation` family carries it through.

**Memory anchors (CLAUDE.md user memory):**
- `project_ai_driven_bank` — bank is real SARB-licensed institution; build-phase has defined endpoint at pre-licence go-live readiness gate.
- `feedback_canonical_source_registry` — every fact-type has one canonical authoring location (the spec's per-persona §9 / §11 / §13 are canonical for that persona's mandate).
- `feedback_pre_dispatch_merge_check` — pre-dispatch live-check (this spec dispatched after verifying the predecessor brief is live).
- `project_session_2026_05_10` — S8 Tier 1 (PRs #185–#187 + #188): worker-isolation primitive shipped — §3.2 wrapper runs inside it.

—Atlas (Core banking platform architect; substrate)
Senna (Security engineer) — Principle 4 gate
Rashida (Chief Information Security Officer, governance) — Principle 4 gate
Vera (Internal audit / continuous-assurance engineer) — audit-event shapes
Anya (Data substrate engineer) — world-state read-API
