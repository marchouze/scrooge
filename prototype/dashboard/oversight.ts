// dashboard/oversight.ts
//
// A3.2 — CEO Oversight UI projections.
//
// Read-only derivations over the escalation event lifecycle (A3.1) and the
// runtime-handler metadata (A1). The dashboard server wires these into:
//
//   GET /api/escalations          — list of EscalationView, sorted by deadline
//   GET /api/fleet                — list of FleetAgentStatus, one per handler
//   GET /api/decisions/:id        — DecisionDrillDown for a single id
//
// All three are queries over the event store + the canonical sources the
// dashboard already reads (CLAUDE.md, /Team/, /Owner Inbox/, the curated
// dashboard state). Per Principle 1, no projection state is persisted —
// each request re-folds the relevant slice.
//
// Author: Atlas + Anya (A3.2)
//
// Substrate-replacement seam: the channel.list() folds today by walking
// the event store; the post-M8 cloud lift indexes the same projections
// into Cosmos DB. Consumers stay on EscalationView / FleetAgentStatus /
// DecisionDrillDown — the shapes are stable.

import { LocalEscalationChannel } from "../platform/escalation/channel";
import type { EventStore } from "../platform/event-store/store";
import type { Event } from "../platform/event-store/types";
import { nextFireAfter, parseCron } from "../platform/scheduler/cron-parse";
import { HANDLERS_METADATA } from "../runtime/handlers-metadata";
import type {
  AgentMiniDashboard,
  DashboardState,
  DecisionCommentSummary,
  DecisionDrillDown,
  EscalationLifecycleEvent,
  EscalationView,
  FleetAgentStatus,
  OpenDecision,
  ResolvedDecision,
} from "./types";

// ---------------------------------------------------------------------------
// Escalations — list-and-sort projection
// ---------------------------------------------------------------------------

/**
 * Build the full EscalationView list (every status), folding the channel
 * lifecycle. Sorted by deadline ascending; missing deadlines fall to the end.
 *
 * The view is read-only — decision-emit affordances stay out of v1 (the
 * caller-side identity + auth substrate is post-licence work).
 */
export function listEscalations(
  store: EventStore,
  resolvedDecisionIds: ReadonlySet<string>,
): EscalationView[] {
  const channel = new LocalEscalationChannel(store);

  // The channel's list() filters by status; we want every status. Walk all
  // four lifecycle terminals and merge — duplicates are deduped by escalationId.
  const seen = new Map<string, EscalationView>();
  for (const status of ["open", "acknowledged", "delegated", "decided"] as const) {
    for (const v of channel.list({ status })) {
      seen.set(v.escalationId, toView(v, resolvedDecisionIds, store));
    }
  }
  // Overdue decoration may sit on any non-terminal status; the channel's
  // overdue filter returns the same EscalationView, just filtered. We've
  // already captured the union, so this is a no-op for set-membership;
  // we re-walk it to ensure the `overdue` flag is consistent.
  for (const v of channel.list({ status: "overdue" })) {
    if (!seen.has(v.escalationId)) {
      seen.set(v.escalationId, toView(v, resolvedDecisionIds, store));
    }
  }

  const out = [...seen.values()];
  out.sort(byDeadlineAsc);
  return out;
}

function toView(
  v: ReturnType<LocalEscalationChannel["list"]>[number],
  resolvedDecisionIds: ReadonlySet<string>,
  store: EventStore,
): EscalationView {
  // Pull the originating envelope's as_of for raisedAt. The channel doesn't
  // surface this directly, but a single replay scoped to the type is cheap
  // (build-phase volume is single-digit escalations / day).
  let raisedAt = "";
  for (const e of store.replay({ type: "AgentEscalation" })) {
    if ((e.payload as Record<string, unknown>).escalationId === v.escalationId) {
      raisedAt = e.as_of;
      break;
    }
  }

  return {
    escalationId: v.escalationId,
    raisedBy: v.raisedBy,
    question: v.question,
    options: v.options,
    blockedBy: "",
    severity: v.severity,
    routedTo: v.routedTo,
    ...(v.deadline ? { deadline: v.deadline } : {}),
    ...(v.sealed ? { sealedReason: v.sealed.reason } : {}),
    status: v.status,
    overdue: v.overdue,
    currentResponsible: v.currentResponsible,
    acknowledgementCount: v.acknowledgementCount,
    delegationCount: v.delegationCount,
    openedEventId: v.openedEventId,
    raisedAt,
    hasResolvingDecision: resolvedDecisionIds.has(v.escalationId),
  };
}

// Pull blockedBy + raisedAt from the originating envelope in a single sweep —
// avoids the repeated replay scan in toView() when listing many escalations.
export function enrichBlockedBy(
  views: readonly EscalationView[],
  store: EventStore,
): EscalationView[] {
  const blockedBy = new Map<string, string>();
  const raisedAt = new Map<string, string>();
  for (const e of store.replay({ type: "AgentEscalation" })) {
    const p = e.payload as Record<string, unknown>;
    const id = String(p.escalationId ?? "");
    if (!id) continue;
    if (!blockedBy.has(id)) blockedBy.set(id, String(p.blockedBy ?? ""));
    if (!raisedAt.has(id)) raisedAt.set(id, e.as_of);
  }
  return views.map((v) => ({
    ...v,
    blockedBy: blockedBy.get(v.escalationId) ?? v.blockedBy,
    raisedAt: raisedAt.get(v.escalationId) ?? v.raisedAt,
  }));
}

function byDeadlineAsc(a: EscalationView, b: EscalationView): number {
  // Decided escalations sort to the bottom — the inbox surfaces what still
  // requires action above what's already resolved.
  if (a.status === "decided" && b.status !== "decided") return 1;
  if (b.status === "decided" && a.status !== "decided") return -1;
  // Then by deadline asc; missing deadlines sort to the bottom of their group.
  if (a.deadline && b.deadline) return a.deadline < b.deadline ? -1 : 1;
  if (a.deadline) return -1;
  if (b.deadline) return 1;
  return a.escalationId.localeCompare(b.escalationId);
}

// ---------------------------------------------------------------------------
// Fleet status — one row per registered (agent, trigger) handler
// ---------------------------------------------------------------------------

/**
 * Build per-handler fleet status. Pulls from HANDLERS_METADATA + the
 * lifecycle-event fold (SubstrateAgentRunCompleted / SubstrateAgentRunFailed
 * from the event store) + the live escalation list.
 *
 * `lastRunAt` is the timestamp of the most recent closed run event for the
 * agent (Completed or Failed). `lastActivityAt` is aliased to `lastRunAt` for
 * backwards compat with dashboard consumers that read the old field name.
 *
 * `nextRunAt` is computed from `cronExpression + lastRunAt` using
 * `nextFireAfter` (the canonical cron evaluator) — more accurate than the
 * former `lastActivityAt + cadenceHours` heuristic.
 *
 * The event store is optional for backwards compat; when omitted, `lastRunAt`
 * is undefined and `nextRunAt` is not populated.
 */
export function buildFleetStatus(
  state: DashboardState,
  escalations: readonly EscalationView[],
  eventStore?: EventStore,
): FleetAgentStatus[] {
  // ---------------------------------------------------------------------------
  // Lifecycle-event fold — per-agent last closed run timestamp.
  //
  // Fold SubstrateAgentRunCompleted + SubstrateAgentRunFailed events to find
  // the most recent closed run for each agent URN. Mirrors the LifecycleFold
  // pattern in platform/scheduler/scheduler.ts (§ inactivityCheck).
  // ---------------------------------------------------------------------------
  const lastClosedAtByUrn = new Map<string, number>(); // agentUrn → epoch ms

  if (eventStore) {
    for (const closingType of [
      "SubstrateAgentRunCompleted",
      "SubstrateAgentRunFailed",
    ] as const) {
      for (const e of eventStore.replay({ type: closingType })) {
        const p = e.payload as Record<string, unknown>;
        const agentName = typeof p.agent === "string" ? p.agent : "";
        if (!agentName) continue;
        const closedAtKey =
          closingType === "SubstrateAgentRunCompleted" ? "completedAt" : "failedAt";
        const closedAt =
          typeof p[closedAtKey] === "string" ? (p[closedAtKey] as string) : e.as_of;
        const closedAtMs = Date.parse(closedAt);
        if (Number.isNaN(closedAtMs)) continue;
        const urn = `agent:${agentName.toLowerCase()}`;
        const prior = lastClosedAtByUrn.get(urn);
        if (prior === undefined || closedAtMs > prior) {
          lastClosedAtByUrn.set(urn, closedAtMs);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Pending escalations per agent.
  // ---------------------------------------------------------------------------
  const pendingByAgent = new Map<string, number>();
  for (const e of escalations) {
    if (e.status === "decided") continue;
    const m = e.raisedBy.match(/^agent:([a-z][a-z0-9-]*)/i);
    if (!m || !m[1]) continue;
    const name = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    pendingByAgent.set(name, (pendingByAgent.get(name) ?? 0) + 1);
  }

  // ---------------------------------------------------------------------------
  // Recent decisions per agent.
  // ---------------------------------------------------------------------------
  const recentDecisionsByAgent = new Map<string, number>();
  for (const a of state.agents) {
    recentDecisionsByAgent.set(a.name, a.recentlyResolvedDecisions.length);
  }

  // ---------------------------------------------------------------------------
  // Build fleet rows.
  // ---------------------------------------------------------------------------
  const now = Date.now();
  const out: FleetAgentStatus[] = [];
  for (const h of HANDLERS_METADATA) {
    const urn = `agent:${h.agent.toLowerCase()}`;
    const lastClosedMs = lastClosedAtByUrn.get(urn);
    const lastRunAt =
      lastClosedMs !== undefined ? new Date(lastClosedMs).toISOString() : undefined;

    // Compute nextRunAt from cronExpression + lastRunAt (accurate), falling
    // back to lastRunAt + cadenceHours (heuristic) when no cron is available.
    let nextRunAt: string | undefined;
    if (h.kind === "scheduled" && lastRunAt) {
      if (h.cronExpression) {
        try {
          const parsed = parseCron(h.cronExpression);
          const after = lastClosedMs !== undefined ? new Date(lastClosedMs) : new Date(now);
          const next = nextFireAfter(parsed, after);
          nextRunAt = next.toISOString();
        } catch {
          // Broken cron — fall back to cadence heuristic.
          if (h.cadenceHours && lastClosedMs !== undefined) {
            nextRunAt = new Date(lastClosedMs + h.cadenceHours * 3600 * 1000).toISOString();
          }
        }
      } else if (h.cadenceHours && lastClosedMs !== undefined) {
        nextRunAt = new Date(lastClosedMs + h.cadenceHours * 3600 * 1000).toISOString();
      }
    }

    out.push({
      agent: h.agent,
      trigger: h.trigger,
      handlerKey: h.key,
      kind: h.kind,
      ...(h.cadenceHours !== undefined ? { cadenceHours: h.cadenceHours } : {}),
      agentUrn: urn,
      // lastRunAt — canonical from lifecycle fold.
      ...(lastRunAt ? { lastRunAt, lastActivityAt: lastRunAt } : {}),
      ...(nextRunAt ? { nextRunAt } : {}),
      inFlightRuns: 0, // synchronous in-process model — no in-flight slots
      pendingEscalationCount: pendingByAgent.get(h.agent) ?? 0,
      recentDecisionsCount: recentDecisionsByAgent.get(h.agent) ?? 0,
      ...(h.subscribesTo !== undefined ? { subscribesTo: h.subscribesTo } : {}),
    });
  }

  // Sort: by agent name, then trigger, for stable rendering.
  out.sort((a, b) => {
    if (a.agent !== b.agent) return a.agent.localeCompare(b.agent);
    return a.trigger.localeCompare(b.trigger);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Decision drill-down — single-id view
// ---------------------------------------------------------------------------

export function buildDecisionDrillDown(
  store: EventStore,
  state: DashboardState,
  decisionId: string,
): DecisionDrillDown | undefined {
  // Lifecycle events for the id (escalation lifecycle = decisionId when the
  // decision originated from an escalation; otherwise the lifecycle is empty
  // and we surface the resolved/open row alone).
  const lifecycle: EscalationLifecycleEvent[] = [];
  let openedEvent: Event | undefined;
  for (const t of [
    "AgentEscalation",
    "AgentEscalationAcknowledged",
    "AgentEscalationDecided",
    "AgentEscalationDelegated",
    "AgentEscalationOverdue",
  ] as const) {
    for (const e of store.replay({ type: t })) {
      const p = e.payload as Record<string, unknown>;
      if (p.escalationId !== decisionId) continue;
      if (t === "AgentEscalation") openedEvent = e;
      lifecycle.push(toLifecycleEvent(e));
    }
  }
  lifecycle.sort((a, b) => (a.asOf < b.asOf ? -1 : 1));

  // The escalation view (if originating from an escalation).
  let escalation: EscalationView | undefined;
  if (openedEvent) {
    const channel = new LocalEscalationChannel(store);
    // Resolve via channel.list — walk every status until we find the id.
    const all: EscalationView[] = [];
    for (const status of ["open", "acknowledged", "delegated", "decided"] as const) {
      for (const v of channel.list({ status })) {
        if (v.escalationId === decisionId) {
          all.push(toView(v, new Set(state.decisionsResolved.map((r) => r.id)), store));
        }
      }
    }
    if (all.length > 0) {
      const enriched = enrichBlockedBy(all, store);
      escalation = enriched[0];
    }
  }

  const resolution: ResolvedDecision | undefined = state.decisionsResolved.find(
    (r) => r.id === decisionId,
  );
  const open: OpenDecision | undefined = state.decisionsOpen.find((d) => d.id === decisionId);

  // If we have neither a lifecycle, nor a resolution, nor an open row, the
  // id is unknown — return undefined and let the server render 404.
  if (!escalation && !resolution && !open && lifecycle.length === 0) {
    return undefined;
  }

  const comments: readonly DecisionCommentSummary[] = state.decisionComments[decisionId] ?? [];
  const citations: readonly string[] = openedEvent ? openedEvent.citations : [];
  const popiaS71 = escalation?.sealedReason === "popia-incident";

  return {
    decisionId,
    ...(escalation ? { escalation } : {}),
    lifecycle,
    ...(resolution ? { resolution } : {}),
    ...(open ? { open } : {}),
    comments,
    popiaS71,
    citations,
  };
}

function toLifecycleEvent(e: Event): EscalationLifecycleEvent {
  const p = e.payload as Record<string, unknown>;
  const id = String(p.escalationId ?? "");
  const actor = e.actor.id;
  let summary = "";
  switch (e.type) {
    case "AgentEscalation":
      summary = `Raised by ${String(p.raisedBy ?? actor)} — ${String(p.question ?? "")}`;
      break;
    case "AgentEscalationAcknowledged":
      summary = `Acknowledged by ${String(p.acknowledgedBy ?? actor)}`;
      break;
    case "AgentEscalationDecided":
      summary = `Decided by ${String(p.decidedBy ?? actor)} — chose: ${String(p.chosenOption ?? "")}`;
      break;
    case "AgentEscalationDelegated":
      summary = `Delegated by ${String(p.delegatedBy ?? actor)} → ${String(p.delegatedTo ?? "")} (${String(p.reason ?? "")})`;
      break;
    case "AgentEscalationOverdue":
      summary = `Substrate flagged overdue — escalated to ${String(p.escalatedTo ?? "")}`;
      break;
    default:
      summary = e.type;
      break;
  }
  return {
    type: e.type as EscalationLifecycleEvent["type"],
    escalationId: id,
    asOf: e.as_of,
    actor,
    summary,
  };
}

// ---------------------------------------------------------------------------
// POPIA s.71 standing-template text (Iris spec §11)
//
// Hardcoded for v1 — when an Iris register pipeline lands, this will pull
// from her `Team/Iris.md` § 11 standing template. The substrate-gap is
// recorded in the response so the dashboard surfaces it inline.
// ---------------------------------------------------------------------------

export const POPIA_S71_NOTICE = {
  heading: "POPIA section 71 — automated decision; subject rights",
  body:
    "This decision was taken with the involvement of automated processing as contemplated by " +
    "POPIA section 71. The data subject is entitled to: (a) be notified that the decision is being " +
    "made; (b) obtain the underlying logic; (c) request human review and to make representations " +
    "before the decision is given effect. The Information Officer (Iris) routes objections and " +
    "review requests through the standing DSAR queue; statutory windows under POPIA Reg 4 apply.",
  citations: ["POPIA-S-71", "POPIA-REG-4", "ORG-PR-IO-S71"],
} as const;
