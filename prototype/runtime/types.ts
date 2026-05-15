// runtime/types.ts
//
// Agent runtime contract. The runtime executes a persona's operating spec
// without a human in the loop. Per CLAUDE.md Principle 6 (Autonomous by
// default), every persona is a standing agent that runs on its own cadence
// and discharges its mandate; this is the substrate that turns the spec
// into actual runs.
//
// All three trigger kinds are now first-class:
//   - "scheduled":    fired by cron via .github/workflows/agent-runtime-*.yml
//   - "event-driven": fired in-process when an event of a subscribed type
//                     is appended during another agent's run. Today this
//                     is fan-out within a single process (the runtime
//                     dispatches downstream handlers after a parent run);
//                     the cross-process / cross-workflow shape is event-bus
//                     work for the Azure cloud lift (M8).
//   - "on-request":   fired via `bun run agent:<slug>` from the CLI or a
//                     workflow_dispatch with no cron entry. Distinct from
//                     scheduled because there's no recurring cadence; it
//                     runs when something asks it to.
//
// Author: Atlas (runtime plumbing) · Anya (event integration)

export type TriggerKind = "scheduled" | "event-driven" | "on-request";

import type { Event } from "../platform/event-store/types";

export interface AgentRunContext {
  /** Persona name as it appears in /Team/<Name>.md */
  readonly agent: string;
  /**
   * Stable run identifier minted by the substrate runner. Convention:
   * `run:<lowercased-agent>:<iso-utc-no-punct>:<short-rand>`. Pair-couples
   * the `SubstrateAgentRunStarted` envelope to its closing
   * `SubstrateAgentRunCompleted` / `…Failed`. Handlers may tag domain
   * events / decisions with this id for traceback (Vera Wave-4 #15).
   *
   * Populated by the substrate runner (`runtime/run.ts`'s `runAgent`); the
   * legacy fan-out and direct test/scenario callsites that bypass the
   * runner construct contexts without a `runId` — the field is optional
   * so those sites do not need a per-callsite update. Once every direct
   * callsite routes through the runner (A4 fleet rollout), this field
   * becomes required and the optional marker drops.
   */
  readonly runId?: string;
  /** Trigger that fired this run — distinct from the agent's full set of triggers. */
  readonly trigger: {
    readonly kind: TriggerKind;
    /** Identifier of the trigger fired (e.g. "overnight-recon", "weekly-pipeline-state"). */
    readonly id: string;
    /**
     * For event-driven runs only: the events that fired this dispatch.
     * Populated by the runtime's event-driven fan-out. Empty / undefined
     * for scheduled and on-request runs.
     */
    readonly triggeringEvents?: readonly Event[];
  };
  /** ISO-8601 UTC. Stamped at run start; used as `as_of` for all events emitted in this run. */
  readonly asOf: string;
  /** Repo root — resolves register paths, persona paths, Owner Inbox path. */
  readonly repoRoot: string;
  /** Where to write the deliverable — defaults to `<repoRoot>/Owner Inbox/`. */
  readonly ownerInboxDir: string;
  /** Whether this is a real run (writes events + Owner Inbox doc) or a dry-run (writes nothing). */
  readonly dryRun: boolean;
}

export interface AgentRunOutput {
  /** Number of events emitted to the event store during this run. */
  readonly eventsEmitted: number;
  /** Path of the Owner Inbox deliverable produced (relative to repoRoot), if any. */
  readonly deliverable?: string;
  /** Brief one-line summary for the run log. */
  readonly summary: string;
  /** Whether the run completed without raising an unrecoverable error. */
  readonly ok: boolean;
}

/**
 * A run handler implements one trigger of one agent. Convention: file at
 * `runtime/agents/<lowercase-agent>-<trigger-id>.ts` exports a default
 * handler matching this signature.
 */
export type AgentRunHandler = (ctx: AgentRunContext) => Promise<AgentRunOutput>;

// ---------------------------------------------------------------------------
// Handler metadata — moved here from handlers-metadata.ts to break the
// handlers-metadata ↔ agents/metadata/_entry circular import chain.
// (Vera Wave-4 F-034)
// ---------------------------------------------------------------------------

export interface HandlerMetadata {
  /** Persona name as it appears in /Team/<Name>.md */
  readonly agent: string;
  /** Trigger id — second half of the `agent:trigger` key. */
  readonly trigger: string;
  /** Trigger classification. */
  readonly kind: TriggerKind;
  /**
   * Expected cadence in hours for `scheduled` handlers. Undefined for
   * `event-driven` (fires when subscribed event lands) and `on-request`
   * (fires when something asks). Used by the fleet-health page to set
   * staleness thresholds.
   */
  readonly cadenceHours?: number;
  /**
   * For `event-driven` handlers: the event types this handler
   * subscribes to. The runtime fans out to the handler when a parent
   * run appends an event whose type intersects this set.
   */
  readonly subscribesTo?: readonly string[];
  /**
   * For `scheduled` handlers: the 5-field cron expression the
   * in-process scheduler and the GH Actions workflow both fire on.
   * MUST be present for `kind: "scheduled"` rows; `recon:cron-map-drift`
   * asserts this. Undefined for `event-driven` and `on-request`.
   *
   * The mirrored authoritative source for GH Actions is the
   * corresponding `.github/workflows/agent-runtime-<agent>-<trigger>.yml`
   * file's `schedule.cron`. Both must match — the recon asserts.
   */
  readonly cronExpression?: string;
  /** Composite key — `<lowercased-agent>:<trigger>`. Computed for convenience. */
  readonly key: string;
}
