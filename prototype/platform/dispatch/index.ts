// platform/dispatch/index.ts
//
// Dispatch sync primitive — runtime gate that prevents a decider-class
// `AgentRunCompleted{outcome:"delivered"}` from being emitted before every
// reviewer-class brief it `blocksOn` has its own
// `AgentRunCompleted{outcome:"delivered"}` in the event log.
//
// Background. On 2026-05-20 WS-MARKET-RISK-PROCEDURES v1.0 (PR #610) shipped
// `phase:"approved"` despite the §6.3 Independent Validation reviewer
// finding two of four procedures defective. Bea's reviewer
// `AgentRunCompleted` (`a9fedeba-…`) landed after Helena's decider
// `AgentRunCompleted` (`196ea822-…`) because the two runs were dispatched
// in parallel and Helena's 60-s poll fallback fired first. v1.1 fixed the
// content; this module fixes the substrate.
//
// Authority: D-DISPATCH-SYNC-PRIMITIVE (CEO-approved 2026-05-20 via
// Scrooge session delegation).
// Spec: platform/dispatch/sync-primitive-spec.md
//
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../composition";
import type {
  AgentBriefIssuedPayload,
  AgentRunCompletedPayload,
  BlocksOnEntry,
} from "../event-store/event-types/agent";
import type { Event } from "../event-store/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type { BlocksOnEntry };

export interface BlockingRunStatus {
  briefId: string;
  requiredRoleClass: BlocksOnEntry["runRoleClass"];
  closedAt?: string;
  outcome?: AgentRunCompletedPayload["outcome"];
  satisfied: boolean;
  /** Human-readable reason when `satisfied` is false. */
  reason?: string;
}

export interface AssertResult {
  briefId: string;
  asOf: string;
  blocksOn: BlockingRunStatus[];
  ok: boolean;
  /** First unsatisfied entry — convenience for callers. */
  blockedBy?: BlockingRunStatus;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function indexCompletionsByBrief(
  events: Iterable<Event>,
): Map<string, AgentRunCompletedPayload> {
  // Earliest delivered closing wins per brief (re-dispatch case — see spec §8).
  const out = new Map<string, AgentRunCompletedPayload>();
  for (const e of events) {
    if (e.type !== "AgentRunCompleted") continue;
    const p = e.payload as AgentRunCompletedPayload;
    if (!p.briefId) continue;
    const existing = out.get(p.briefId);
    if (existing === undefined) {
      out.set(p.briefId, p);
      continue;
    }
    // Prefer the earliest `delivered` closing event over later closings
    // and over any non-`delivered` closing.
    const isDelivered = p.outcome === "delivered";
    const existingDelivered = existing.outcome === "delivered";
    if (isDelivered && !existingDelivered) {
      out.set(p.briefId, p);
    } else if (isDelivered && existingDelivered && p.completedAt < existing.completedAt) {
      out.set(p.briefId, p);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pure assertion — never throws; total over event input.
// ---------------------------------------------------------------------------

/**
 * Given a brief and a set of replayed events, returns whether every entry in
 * `brief.blocksOn` has a matching `AgentRunCompleted{outcome:"delivered"}`
 * whose `briefId` matches and whose `completedAt <= asOf`.
 */
export function assertBlockingRunsClosed(args: {
  brief: AgentBriefIssuedPayload;
  events: Iterable<Event>;
  asOf: string;
}): AssertResult {
  const blocksOn = args.brief.blocksOn ?? [];
  if (blocksOn.length === 0) {
    return {
      briefId: args.brief.briefId,
      asOf: args.asOf,
      blocksOn: [],
      ok: true,
    };
  }

  const completions = indexCompletionsByBrief(args.events);
  const statuses: BlockingRunStatus[] = [];

  for (const dep of blocksOn) {
    const completion = completions.get(dep.briefId);
    if (completion === undefined) {
      statuses.push({
        briefId: dep.briefId,
        requiredRoleClass: dep.runRoleClass,
        satisfied: false,
        reason: "no AgentRunCompleted event found for blocking brief",
      });
      continue;
    }
    if (completion.outcome !== "delivered") {
      statuses.push({
        briefId: dep.briefId,
        requiredRoleClass: dep.runRoleClass,
        closedAt: completion.completedAt,
        outcome: completion.outcome,
        satisfied: false,
        reason: `blocking brief closed with outcome=${completion.outcome}, expected delivered`,
      });
      continue;
    }
    if (completion.completedAt > args.asOf) {
      // Should not happen for live close-runs (asOf is "now") but the recon
      // pipeline replays historical events and asks "was this brief closed
      // before the decider close?" — keep the comparison explicit.
      statuses.push({
        briefId: dep.briefId,
        requiredRoleClass: dep.runRoleClass,
        closedAt: completion.completedAt,
        outcome: completion.outcome,
        satisfied: false,
        reason: `blocking brief closed at ${completion.completedAt}, after assert asOf ${args.asOf}`,
      });
      continue;
    }
    statuses.push({
      briefId: dep.briefId,
      requiredRoleClass: dep.runRoleClass,
      closedAt: completion.completedAt,
      outcome: completion.outcome,
      satisfied: true,
    });
  }

  const ok = statuses.every((s) => s.satisfied);
  return {
    briefId: args.brief.briefId,
    asOf: args.asOf,
    blocksOn: statuses,
    ok,
    ...(ok ? {} : { blockedBy: statuses.find((s) => !s.satisfied) }),
  };
}

// ---------------------------------------------------------------------------
// Live-store convenience used by the close-run CLI.
// ---------------------------------------------------------------------------

/**
 * Resolve the brief from the event store and assert its blocking dependencies.
 * Returns an `ok:false` AssertResult with a sentinel `blockedBy` when the
 * brief cannot be found — callers can decide how to handle.
 */
export function checkDeciderMayClose(args: {
  briefId: string;
  asOf: string;
}): AssertResult {
  let brief: AgentBriefIssuedPayload | undefined;
  for (const e of eventStore.replay({ type: "AgentBriefIssued" })) {
    const p = e.payload as AgentBriefIssuedPayload;
    if (p.briefId === args.briefId) {
      brief = p;
      break;
    }
  }
  if (brief === undefined) {
    return {
      briefId: args.briefId,
      asOf: args.asOf,
      blocksOn: [],
      ok: false,
      blockedBy: {
        briefId: args.briefId,
        requiredRoleClass: "reviewer",
        satisfied: false,
        reason: "AgentBriefIssued event not found for briefId — cannot verify sync requirements",
      },
    };
  }

  const events: Event[] = [];
  for (const e of eventStore.replay({ type: "AgentRunCompleted" })) {
    events.push(e);
  }

  return assertBlockingRunsClosed({ brief, events, asOf: args.asOf });
}
