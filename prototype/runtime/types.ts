// runtime/types.ts
//
// Agent runtime contract. The runtime executes a persona's operating spec
// without a human in the loop. Per CLAUDE.md Principle 7 (Autonomous by
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
