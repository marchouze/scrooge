// platform/records/brief-router.ts
//
// Reads `followOnRoutes` from a blocked `AgentRunCompleted` event and
// auto-issues a new `AgentBriefIssued` for each executable route.
//
// Motivation: goal-loops emit `AgentRunCompleted{outcome:"blocked",
// followOnRoutes:[...]}` when they triage a brief they cannot execute
// themselves. Previously those routes were dead data — nothing read them to
// issue the next brief. This module is the missing translation layer: it
// converts each executable route into a new `AgentBriefIssued` event so the
// follow-on executor (Atlas or the named agent) picks it up on their next tick.
//
// Target resolution:
//   - `code-pr`  routes → Atlas (Core banking platform architect)
//   - `agent`    routes → parsed from `route.target` slug (e.g. `"agent:atlas"`)
//   - `decision` / `register-update` routes → skipped (not code-execution routes)
//
// Idempotency: before calling `recordBriefIssued`, the module replays
// `AgentBriefIssued` events from the store and checks for a matching briefId.
// On a second call with the same blockedRunId + route, it returns
// `{ briefId, alreadyExists: true }` without emitting a duplicate event.
//
// BriefId: deterministic slug from sha256 of `${blockedRunId}:${route.kind}`,
// first 8 hex chars:
//   `brief:<targetSlug>:route-<8chars>:<YYYY-MM-DD>`
//   e.g. `brief:atlas:route-a1b2c3d4:2026-06-02`
//
// Authority: D-AGENT-AUTONOMY-COHORT-2-PILOT (CEO-approved 2026-05-30)
// Author: Atlas (Core banking platform architect, engineering)

import { createHash } from "node:crypto";
import type { AgentRunCompletedFollowOnRoute, RmsAgentRef } from "../event-store/event-types/agent";
import type { AgentBriefIssuedPayload } from "../event-store/event-types/agent";
import { eventStore as defaultStore } from "../event-store/store";
import { logger } from "../composition";
import { recordBriefIssued } from "./helpers";
import type { RecordHelperDeps } from "./helpers";

// ---------------------------------------------------------------------------
// Agent registry — known agent slugs → RmsAgentRef
// ---------------------------------------------------------------------------

/** Maps agentId slug → RmsAgentRef for agents with published goal-loops. */
const KNOWN_AGENTS: Record<string, RmsAgentRef> = {
  "agent:atlas": {
    name: "Atlas",
    position: "Core banking platform architect",
    agentId: "agent:atlas",
  },
  "agent:bea": {
    name: "Bea",
    position: "Accounting and financial reporting engineer",
    agentId: "agent:bea",
  },
  "agent:rohan": {
    name: "Rohan",
    position: "Risk engineer",
    agentId: "agent:rohan",
  },
  "agent:ravi": {
    name: "Ravi",
    position: "Treasury / ALM engineer",
    agentId: "agent:ravi",
  },
  "agent:helena": {
    name: "Helena",
    position: "Chief Risk Officer",
    agentId: "agent:helena",
  },
  "agent:eitan": {
    name: "Eitan",
    position: "Treasurer",
    agentId: "agent:eitan",
  },
  "agent:scrooge": {
    name: "Scrooge",
    position: "Chief of Staff / Orchestrator",
    agentId: "agent:scrooge",
  },
  "agent:owen": {
    name: "Owen",
    position: "Company Secretary",
    agentId: "agent:owen",
  },
  "agent:vera": {
    name: "Vera",
    position: "Internal audit engineer",
    agentId: "agent:vera",
  },
};

/** Atlas — the default target for `code-pr` routes. */
const ATLAS_REF: RmsAgentRef = KNOWN_AGENTS["agent:atlas"]!;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RouteBlockedBriefInput {
  /** The runId of the blocked AgentRunCompleted. */
  readonly blockedRunId: string;
  /** The specific followOnRoute to process. */
  readonly route: AgentRunCompletedFollowOnRoute;
  /** BriefId of the parent brief that was blocked. */
  readonly parentBriefId: string;
  /** Title of the parent brief (used in the follow-on brief title). */
  readonly parentBriefTitle: string;
  /** The agent that is issuing the follow-on brief (typically the goal-loop agent). */
  readonly issuedBy: RmsAgentRef;
  /** ISO timestamp for the new brief. */
  readonly asOf: string;
}

export interface RouteBlockedBriefResult {
  /** The briefId that was (or would have been) issued. */
  readonly briefId: string;
  /** True if an AgentBriefIssued with this briefId already existed in the store. */
  readonly alreadyExists: boolean;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Resolve the target RmsAgentRef for a given route.
 * Returns `undefined` for non-executable routes (decision, register-update)
 * or unresolvable agent slugs.
 */
function resolveTarget(route: AgentRunCompletedFollowOnRoute): RmsAgentRef | undefined {
  if (route.kind === "decision" || route.kind === "register-update") {
    // Not code-execution routes — skip silently.
    return undefined;
  }

  if (route.kind === "code-pr") {
    // All code-PR routes go to Atlas.
    return ATLAS_REF;
  }

  // route.kind === "agent": parse target slug.
  const slug = route.target.startsWith("agent:")
    ? route.target
    : `agent:${route.target.toLowerCase()}`;

  const ref = KNOWN_AGENTS[slug];
  if (!ref) {
    logger.warn(
      { routeTarget: route.target, slug },
      "brief-router: unresolvable agent slug in followOnRoute — skipping without throw",
    );
    return undefined;
  }
  return ref;
}

/**
 * Derive a deterministic briefId from the blocked run + route kind.
 * Format: `brief:<targetSlug>:route-<8hex>:<YYYY-MM-DD>`
 */
function deriveBriefId(
  target: RmsAgentRef,
  blockedRunId: string,
  routeKind: string,
  asOf: string,
): string {
  const input = `${blockedRunId}:${routeKind}`;
  const hex8 = createHash("sha256").update(input).digest("hex").slice(0, 8);
  const dateSlug = asOf.slice(0, 10); // YYYY-MM-DD
  const agentSlug = (target.agentId ?? `agent:${target.name.toLowerCase()}`).replace(
    /^agent:/,
    "",
  );
  return `brief:${agentSlug}:route-${hex8}:${dateSlug}`;
}

/**
 * Check whether an `AgentBriefIssued` event with the given briefId already
 * exists in the store.
 */
function briefAlreadyIssued(briefId: string): boolean {
  for (const e of defaultStore.replay({ type: "AgentBriefIssued" })) {
    const p = e.payload as AgentBriefIssuedPayload;
    if (String(p.briefId ?? "") === briefId) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a single `followOnRoute` from a blocked `AgentRunCompleted` into
 * a new `AgentBriefIssued` event addressed to the correct executor.
 *
 * Idempotent: if an `AgentBriefIssued` with the derived briefId already
 * exists, returns `{ briefId, alreadyExists: true }` without emitting again.
 *
 * Skips silently (no throw) for:
 *   - `decision` / `register-update` route kinds (not code-execution routes)
 *   - `agent` routes with an unresolvable target slug
 *
 * In both skip cases, `alreadyExists: false` is returned with the derived
 * briefId so the caller can count them consistently.
 *
 * Authority: D-AGENT-AUTONOMY-COHORT-2-PILOT.
 */
export function routeBlockedBrief(
  input: RouteBlockedBriefInput,
  deps?: RecordHelperDeps,
): RouteBlockedBriefResult {
  const { blockedRunId, route, parentBriefId, parentBriefTitle, issuedBy, asOf } = input;

  const target = resolveTarget(route);
  if (!target) {
    // Non-executable or unresolvable — return a stable pseudo-briefId without emitting.
    const pseudoId = deriveBriefId(ATLAS_REF, blockedRunId, route.kind, asOf);
    return { briefId: pseudoId, alreadyExists: false };
  }

  const briefId = deriveBriefId(target, blockedRunId, route.kind, asOf);

  // Idempotency check against the live event store.
  if (briefAlreadyIssued(briefId)) {
    return { briefId, alreadyExists: true };
  }

  const body = [
    `Routed from blocked run \`${blockedRunId}\` (parent brief: ${parentBriefId} — "${parentBriefTitle}").`,
    "",
    route.directive,
  ].join("\n");

  // Map followOnRoute.kind to a valid AgentBriefIssued expectedOutputs.kind.
  // followOnRoute kinds: "agent" | "decision" | "register-update" | "code-pr"
  // expectedOutputs kinds: "decision-card" | "deliverable-document" | "register-row" | "code-pr"
  const outputKind: "decision-card" | "deliverable-document" | "register-row" | "code-pr" =
    route.kind === "code-pr" ? "code-pr" : "deliverable-document";

  recordBriefIssued(
    {
      briefId,
      issuedTo: target,
      issuedBy,
      title: `Route: ${parentBriefTitle.slice(0, 80)}`,
      directiveBody: body,
      priority: "now",
      expectedOutputs: [
        {
          kind: outputKind,
          description: route.directive.slice(0, 120),
        },
      ],
      citations: ["D-AGENT-AUTONOMY-COHORT-2-PILOT"],
      actor: { type: "service", id: issuedBy.agentId ?? `agent:${issuedBy.name.toLowerCase()}` },
    },
    asOf,
    deps,
  );

  return { briefId, alreadyExists: false };
}
