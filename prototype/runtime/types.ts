// runtime/types.ts
//
// Agent runtime contract. The runtime executes a persona's operating spec
// without a human in the loop. Per CLAUDE.md Principle 7 (Autonomous by
// default), every persona is a standing agent that runs on its own cadence
// and discharges its mandate; this is the substrate that turns the spec
// into actual runs.
//
// MVP scope: scheduled triggers only (cron-style). Event triggers and
// on-request triggers land in V2 (gated on AgentEscalation /
// WorkstreamRegistered event types existing — see Vera's spec, pipelines
// #14, #15).
//
// Author: Atlas (runtime plumbing) · Anya (event integration)

export type TriggerKind = "scheduled" | "event-driven" | "on-request";

export interface AgentRunContext {
  /** Persona name as it appears in /Team/<Name>.md */
  readonly agent: string;
  /** Trigger that fired this run — distinct from the agent's full set of triggers. */
  readonly trigger: {
    readonly kind: TriggerKind;
    /** Identifier of the trigger fired (e.g. "overnight-recon", "weekly-pipeline-state"). */
    readonly id: string;
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
