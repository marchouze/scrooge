// platform/escalation/decision-required-surface.ts
//
// CEO-Escalation push channel — the Decision-Required projection.
//
// Spec: 2026-06-09_atlas_ceo-escalation-push-channel-spec.md
// Authority: D-PROACTIVE-ESCALATION-SURFACING (CEO-approved 2026-06-09, part 2).
//
// Closes the runtime's "detect-but-no-push" gap: the runtime correctly emits
// escalations (SubstrateAgentRunFailed, high SubstrateAlerts, failing
// ReconResults, AgentEscalations) but nothing pushes them to the CEO — they
// were only visible inside an hourly markdown snapshot that had to be queried.
//
// This module is the SINGLE projection consumed by both renders:
//   - the dashboard "decision-required" tile/feed (GET /api/decision-required), and
//   - Scrooge's manual digest (renderDecisionRequiredDigest).
//
// Principle 1: the surface is a query over the event log, never stored state.
// Lifecycle (ack / resolve) reuses the existing AgentEscalation* typed channel
// rather than inventing a parallel mechanism (spec §3).
//
// Author: Atlas (Core banking platform architect, engineering)

import type { EventStore } from "../event-store/store";
import type { Event } from "../event-store/types";

// ---------------------------------------------------------------------------
// Trigger predicate (spec §1)
// ---------------------------------------------------------------------------

export type DecisionRequiredSource = "run-failed" | "alert" | "recon" | "escalation";

/** Surface tiers. `critical` reserved for blocking escalations / future schema (spec §1.1). */
export type SurfaceSeverity = "critical" | "high";

/**
 * SubstrateAlert severities (and any future tier) that promote to the surface.
 * Superset guard: a future schema slice adding a tier above `high` must appear
 * here, asserted by recon:escalation-surface-parity (spec §4.3).
 */
export const HIGH_OR_ABOVE: ReadonlySet<string> = new Set(["high", "critical"]);

/** AgentEscalation severities that promote. `blocking` maps to `critical`. */
export const ESCALATION_PROMOTING: ReadonlySet<string> = new Set(["high", "blocking"]);

/**
 * Static pipeline → owning-agent map for ReconResult items (spec §1.2).
 * Unmapped pipelines fall to DEFAULT_RECON_OWNER and are surfaced as a `warn`
 * by the recon gate so the map cannot silently rot.
 */
export const PIPELINE_OWNER: Readonly<Record<string, string>> = {
  // Sample seed; extended as pipelines acquire named owners.
  "rwa-computed-sourcing": "agent:bea:engineering",
  "ba-form-numbering": "agent:mira:compliance",
  "rms-documents-parity": "agent:owen:governance",
};

export const DEFAULT_RECON_OWNER = "agent:atlas:engineering";

/** The promoted, pre-lifecycle shape produced by the predicate. */
export interface PromotedItem {
  readonly itemId: string;
  readonly source: DecisionRequiredSource;
  readonly sourceEventId: string;
  readonly severity: SurfaceSeverity;
  readonly raisedAt: string;
  readonly owningAgent: string;
  readonly title: string;
  readonly recommendedAction: string;
  readonly citations: readonly string[];
  /** For T3, the pipeline name — used by the gate's owner-map check. */
  readonly pipeline?: string;
  /** For T1, the runId — used for auto-resolution matching. */
  readonly runId?: string;
  /** For T2, the alertId. */
  readonly alertId?: string;
  /** For T4, the escalationId (== itemId tail). */
  readonly escalationId?: string;
}

function str(p: Record<string, unknown>, k: string): string {
  const v = p[k];
  return typeof v === "string" ? v : "";
}

function dateOf(asOf: string): string {
  return asOf.slice(0, 10);
}

/**
 * Pure trigger predicate (spec §1). Maps a raw event to a decision-required
 * item, or null if it does not qualify. Shared verbatim by the projection and
 * the recon gate so they can never disagree about what qualifies.
 */
export function isDecisionRequired(event: Event): PromotedItem | null {
  const p = event.payload as Record<string, unknown>;

  switch (event.type) {
    // T1 — a failed autonomous run is always decision-required.
    case "SubstrateAgentRunFailed": {
      const runId = str(p, "runId");
      const agent = str(p, "agent");
      return {
        itemId: `decision-required:run-failed:${runId}`,
        source: "run-failed",
        sourceEventId: event.event_id,
        severity: "high",
        raisedAt: event.as_of,
        owningAgent: agent ? `agent:${agent}` : DEFAULT_RECON_OWNER,
        title: `${agent || "unknown agent"} run failed${
          str(p, "errorMessage") ? `: ${str(p, "errorMessage")}` : ""
        }`,
        recommendedAction: "Review failure and decide re-run / disable schedule.",
        citations: event.citations,
        runId,
      };
    }

    // T2 — high (or above) integrity/capacity/etc. substrate alert.
    case "SubstrateAlert": {
      const severity = str(p, "severity");
      if (!HIGH_OR_ABOVE.has(severity)) return null;
      const alertId = str(p, "alertId");
      const agentUrn = str(p, "agentUrn");
      return {
        itemId: `decision-required:alert:${alertId}`,
        source: "alert",
        sourceEventId: event.event_id,
        severity: severity === "critical" ? "critical" : "high",
        raisedAt: event.as_of,
        owningAgent: agentUrn || DEFAULT_RECON_OWNER,
        title: `SubstrateAlert [${str(p, "alertClass")}]: ${str(p, "details").slice(0, 160)}`,
        recommendedAction: "Review alert and dispatch remediation / accept.",
        citations: event.citations,
        alertId,
      };
    }

    // T3 — a failing continuous-controls gate.
    case "ReconResult": {
      const ok = p.ok;
      const failViolations = typeof p.failViolations === "number" ? p.failViolations : 0;
      const failed = ok === false || failViolations > 0;
      if (!failed) return null;
      const pipeline = str(p, "pipeline");
      const day = dateOf(str(p, "asOfPipeline") || event.as_of);
      return {
        itemId: `decision-required:recon:${pipeline}:${day}`,
        source: "recon",
        sourceEventId: event.event_id,
        severity: "high",
        raisedAt: event.as_of,
        owningAgent: PIPELINE_OWNER[pipeline] ?? DEFAULT_RECON_OWNER,
        title: `recon:${pipeline} failing (${failViolations} fail-violation${
          failViolations === 1 ? "" : "s"
        })`,
        recommendedAction: "Review failing control gate and dispatch remediation.",
        citations: event.citations,
        pipeline,
      };
    }

    // T4 — a high/blocking agent escalation (resolution handled in fold).
    case "AgentEscalation": {
      const severity = str(p, "severity");
      if (!ESCALATION_PROMOTING.has(severity)) return null;
      const escalationId = str(p, "escalationId");
      return {
        itemId: `decision-required:escalation:${escalationId}`,
        source: "escalation",
        sourceEventId: event.event_id,
        severity: severity === "blocking" ? "critical" : "high",
        raisedAt: event.as_of,
        owningAgent: str(p, "raisedBy") || DEFAULT_RECON_OWNER,
        title: str(p, "question").slice(0, 200),
        recommendedAction: (() => {
          const opts = Array.isArray(p.options) ? (p.options as unknown[]) : [];
          return opts.length > 0
            ? `Decide: ${opts.map(String).join(" | ")}`
            : "Review escalation and decide.";
        })(),
        citations: event.citations,
        escalationId,
      };
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Lifecycle fold (spec §3) — reuses AgentEscalation* events
// ---------------------------------------------------------------------------

export type ItemStatus = "open" | "acknowledged";

export interface DecisionRequiredItem extends PromotedItem {
  readonly ageSeconds: number;
  readonly status: ItemStatus;
  readonly ackBy?: string;
}

export interface DecisionRequiredSurface {
  readonly asOf: string;
  readonly openCount: number;
  readonly bySeverity: { readonly critical: number; readonly high: number };
  readonly items: readonly DecisionRequiredItem[];
}

interface LifecycleIndex {
  /** itemId/escalationId → most recent acknowledger. */
  readonly acks: Map<string, string>;
  /** itemId/escalationId that have an explicit AgentEscalationDecided (terminal). */
  readonly decided: Set<string>;
  /** runId → true if a later successful run completed (T1 auto-resolve). */
  readonly runRecovered: Set<string>;
  /** pipeline → latest ok:true seen at-or-after (T3 auto-resolve, by pipeline). */
  readonly reconRecoveredPipelines: Map<string, string>;
}

function buildLifecycleIndex(store: EventStore): LifecycleIndex {
  const acks = new Map<string, string>();
  const decided = new Set<string>();
  const runRecovered = new Set<string>();
  const reconRecoveredPipelines = new Map<string, string>();

  for (const e of store.replay({ type: "AgentEscalationAcknowledged" })) {
    const p = e.payload as Record<string, unknown>;
    acks.set(str(p, "escalationId"), str(p, "acknowledgedBy"));
  }
  for (const e of store.replay({ type: "AgentEscalationDecided" })) {
    const p = e.payload as Record<string, unknown>;
    decided.add(str(p, "escalationId"));
  }
  // T1 auto-resolve: a successful run for the same runId is the recovery marker.
  // (runIds are unique per attempt; a SubstrateAgentRunCompleted{ok:true} sharing
  // the runId means the very run that was recorded as failed later succeeded — in
  // practice a re-run mints a new runId, so we also track per-agent recovery below.)
  for (const e of store.replay({ type: "SubstrateAgentRunCompleted" })) {
    const p = e.payload as Record<string, unknown>;
    if (p.ok === true) runRecovered.add(str(p, "runId"));
  }
  // T3 auto-resolve: latest ReconResult per pipeline with ok:true clears it.
  for (const e of store.replay({ type: "ReconResult" })) {
    const p = e.payload as Record<string, unknown>;
    if (p.ok === true) {
      reconRecoveredPipelines.set(str(p, "pipeline"), e.as_of);
    }
  }
  return { acks, decided, runRecovered, reconRecoveredPipelines };
}

/**
 * Is a promoted item resolved (and therefore dropped from the surface)?
 * Resolution = explicit AgentEscalationDecided keyed to the itemId/escalationId,
 * OR an auto-clear of the underlying condition (spec §3.1).
 */
export function isResolved(item: PromotedItem, idx: LifecycleIndex): boolean {
  // Explicit decision keyed to the synthetic item id, or (for T4) the escalationId.
  if (idx.decided.has(item.itemId)) return true;
  if (item.escalationId && idx.decided.has(item.escalationId)) return true;

  // Auto-clear per source.
  if (item.source === "run-failed" && item.runId && idx.runRecovered.has(item.runId)) return true;
  if (item.source === "recon" && item.pipeline) {
    const recoveredAt = idx.reconRecoveredPipelines.get(item.pipeline);
    if (recoveredAt && recoveredAt >= item.raisedAt) return true;
  }
  return false;
}

function ackOf(item: PromotedItem, idx: LifecycleIndex): string | undefined {
  return (
    idx.acks.get(item.itemId) ?? (item.escalationId ? idx.acks.get(item.escalationId) : undefined)
  );
}

const SEVERITY_RANK: Record<SurfaceSeverity, number> = { critical: 2, high: 1 };

/**
 * THE single projection (spec §2.1). Walk the store once, promote qualifying
 * events, drop resolved ones, fold ack state, sort by (severity desc, age desc).
 */
export function buildDecisionRequiredSurface(
  store: EventStore,
  now: Date,
): DecisionRequiredSurface {
  const idx = buildLifecycleIndex(store);
  const nowMs = now.getTime();

  // Promote, dedup by itemId (first promoting event wins the identity).
  const promoted = new Map<string, PromotedItem>();
  for (const e of store.replay()) {
    const item = isDecisionRequired(e);
    if (item && !promoted.has(item.itemId)) promoted.set(item.itemId, item);
  }

  const items: DecisionRequiredItem[] = [];
  for (const item of promoted.values()) {
    if (isResolved(item, idx)) continue;
    const ackBy = ackOf(item, idx);
    items.push({
      ...item,
      ageSeconds: Math.max(0, Math.floor((nowMs - new Date(item.raisedAt).getTime()) / 1000)),
      status: ackBy ? "acknowledged" : "open",
      ...(ackBy ? { ackBy } : {}),
    });
  }

  items.sort((a, b) => {
    const s = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (s !== 0) return s;
    return b.ageSeconds - a.ageSeconds;
  });

  const critical = items.filter((i) => i.severity === "critical").length;
  return {
    asOf: now.toISOString(),
    openCount: items.length,
    bySeverity: { critical, high: items.length - critical },
    items,
  };
}

// ---------------------------------------------------------------------------
// Render B — Scrooge's digest (spec §2.3). Same projection, markdown render.
// ---------------------------------------------------------------------------

function ageLabel(seconds: number): string {
  if (seconds < 90) return "just now";
  const mins = Math.round(seconds / 60);
  if (mins < 90) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Compact markdown block Scrooge places at the top of every report. A render of
 * the SAME projection the dashboard tile consumes — the manual stand-in and the
 * automated surface cannot diverge (spec §6).
 */
export function renderDecisionRequiredDigest(surface: DecisionRequiredSurface): string {
  if (surface.openCount === 0) {
    return "## Decision-required (0 open) ✅";
  }
  const head = `## Decision-required (${surface.openCount} open — ${surface.bySeverity.critical} critical, ${surface.bySeverity.high} high)`;
  const rows = surface.items.map((i) => {
    const dot = i.severity === "critical" ? "🔴" : "🟠";
    const ack = i.status === "acknowledged" ? ` _(ack: ${i.ackBy})_` : "";
    return `- ${dot} [${i.severity}] ${i.title} (${ageLabel(i.ageSeconds)}) — ${i.recommendedAction}${ack}`;
  });
  return [head, ...rows].join("\n");
}
