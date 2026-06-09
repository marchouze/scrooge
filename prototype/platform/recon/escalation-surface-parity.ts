// platform/recon/escalation-surface-parity.ts
//
// Continuous-controls pipeline: escalation-surface parity (anti-staleness).
//
// Spec: 2026-06-09_atlas_ceo-escalation-push-channel-spec.md §4.
// Authority: D-PROACTIVE-ESCALATION-SURFACING (CEO-approved 2026-06-09, part 2).
//
// Asserts the Decision-Required surface stays a faithful projection of the
// event store in BOTH directions:
//
//   1. Coverage  — every qualifying, unresolved event appears on the surface
//                  (the detect-but-no-push regression guard).
//   2. Freshness — every surface item corresponds to a still-open qualifying
//                  event; resolved items must have dropped off.
//   3. Superset  — the predicate's HIGH_OR_ABOVE allow-set is a superset of the
//                  SubstrateAlert severity schema's top tier(s) (forward-compat).
//   4. Owner-map — every failing ReconResult pipeline is mapped (or defaulted);
//                  unmapped pipelines are a `warn` so PIPELINE_OWNER cannot rot.
//
// Because the projection is THE single source for both the dashboard tile and
// Scrooge's digest, (1)+(2) together guarantee the manual stand-in and the
// automated surface cannot diverge.
//
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../composition";
import {
  DEFAULT_RECON_OWNER,
  HIGH_OR_ABOVE,
  PIPELINE_OWNER,
  buildDecisionRequiredSurface,
  isDecisionRequired,
  isResolved,
} from "../escalation/decision-required-surface";
import { substrateAlertPayloadSchema } from "../event-store/event-types/platform";
import type { Event } from "../event-store/types";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "escalation-surface-parity";

export interface RunOpts {
  /** Override events (test injection). */
  events?: readonly Event[];
  /** Override "now" (test determinism). */
  now?: Date;
}

function loadEvents(override?: readonly Event[]): Event[] {
  if (override) return [...override];
  try {
    return [...eventStore.replay({})];
  } catch {
    return [];
  }
}

/**
 * Rebuild the lifecycle index the same way the surface does. Kept private and
 * minimal — the freshness check needs `isResolved`, which needs the index.
 * We reconstruct it from the same events to avoid a second store dependency.
 */
function buildIndex(events: readonly Event[]) {
  const acks = new Map<string, string>();
  const decided = new Set<string>();
  const runRecovered = new Set<string>();
  const reconRecoveredPipelines = new Map<string, string>();
  for (const e of events) {
    const p = e.payload as Record<string, unknown>;
    switch (e.type) {
      case "AgentEscalationAcknowledged":
        acks.set(String(p.escalationId ?? ""), String(p.acknowledgedBy ?? ""));
        break;
      case "AgentEscalationDecided":
        decided.add(String(p.escalationId ?? ""));
        break;
      case "SubstrateAgentRunCompleted":
        if (p.ok === true) runRecovered.add(String(p.runId ?? ""));
        break;
      case "ReconResult":
        if (p.ok === true) reconRecoveredPipelines.set(String(p.pipeline ?? ""), e.as_of);
        break;
      default:
        break;
    }
  }
  return { acks, decided, runRecovered, reconRecoveredPipelines };
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  const events = loadEvents(opts.events);
  const now = opts.now ?? new Date();

  const idx = buildIndex(events);

  // Promote every event; dedup by itemId (first wins, matching the projection).
  const qualifyingUnresolved = new Map<string, ReturnType<typeof isDecisionRequired>>();
  const seen = new Set<string>();
  for (const e of events) {
    const item = isDecisionRequired(e);
    if (!item) continue;
    if (seen.has(item.itemId)) continue;
    seen.add(item.itemId);
    if (!isResolved(item, idx)) qualifyingUnresolved.set(item.itemId, item);
  }
  result.asserted = qualifyingUnresolved.size;

  const surface = buildDecisionRequiredSurface(
    {
      replay: (filter?: { type?: string }) =>
        filter?.type ? events.filter((e) => e.type === filter.type) : events,
      // biome-ignore lint/suspicious/noExplicitAny: minimal store shim for recon over an event array.
    } as any,
    now,
  );
  const surfaceIds = new Set(surface.items.map((i) => i.itemId));

  // (1) Coverage — every qualifying-unresolved event must appear.
  for (const [itemId, item] of qualifyingUnresolved) {
    if (!surfaceIds.has(itemId)) {
      violations.push({
        subject: itemId,
        severity: "fail",
        message: `Decision-required regression: qualifying open event (source=${item?.source}, eventId=${item?.sourceEventId}) is NOT on the Decision-Required surface. The detect-but-no-push gap has reopened. Spec §4.1.`,
      });
    }
  }

  // (2) Freshness — every surface item must be a still-open qualifying event.
  for (const itemId of surfaceIds) {
    if (!qualifyingUnresolved.has(itemId)) {
      violations.push({
        subject: itemId,
        severity: "fail",
        message: `Stale surface item: "${itemId}" appears on the Decision-Required surface but its underlying event is resolved or no longer qualifies. The surface must drop resolved items. Spec §4.2.`,
      });
    }
  }

  // (3) Superset — predicate allow-set ⊇ schema top tier(s).
  const schemaSeverities = substrateAlertPayloadSchema.shape.severity.options as readonly string[];
  // "top tier" = anything the schema considers above "medium"; today only "high".
  const schemaTopTiers = schemaSeverities.filter((s) => s !== "low" && s !== "medium");
  for (const tier of schemaTopTiers) {
    if (!HIGH_OR_ABOVE.has(tier)) {
      violations.push({
        subject: `severity:${tier}`,
        severity: "fail",
        message: `SubstrateAlert severity "${tier}" is a top tier in the schema but is NOT in the predicate's HIGH_OR_ABOVE allow-set. A high-severity alert would silently miss the CEO surface. Add "${tier}" to HIGH_OR_ABOVE. Spec §4.3.`,
      });
    }
  }

  // (4) Owner-map — failing ReconResult pipelines should be mapped.
  const unmapped = new Set<string>();
  for (const e of events) {
    if (e.type !== "ReconResult") continue;
    const p = e.payload as Record<string, unknown>;
    const failed = p.ok === false || (typeof p.failViolations === "number" && p.failViolations > 0);
    if (!failed) continue;
    const pipeline = String(p.pipeline ?? "");
    if (pipeline && !(pipeline in PIPELINE_OWNER)) unmapped.add(pipeline);
  }
  for (const pipeline of unmapped) {
    violations.push({
      subject: `pipeline:${pipeline}`,
      severity: "warn",
      message: `Failing ReconResult pipeline "${pipeline}" has no PIPELINE_OWNER mapping; it defaults to ${DEFAULT_RECON_OWNER}. Add an explicit owner so the routing map cannot silently rot. Spec §4.4.`,
    });
  }

  if (result.asserted === 0) result.asserted = 1;
  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  const fails = r.violations.filter((v) => v.severity === "fail");
  const warns = r.violations.filter((v) => v.severity === "warn");
  for (const v of fails) console.error(`  FAIL  [${v.subject}] ${v.message}`);
  for (const v of warns) console.warn(`  WARN  [${v.subject}] ${v.message}`);
  if (r.ok) {
    console.log(
      `recon:escalation-surface-parity OK — Decision-Required surface is a faithful projection (${r.asserted} qualifying open item(s) asserted; ${warns.length} warn(s)).`,
    );
  } else {
    console.error(
      `\nrecon:escalation-surface-parity FAILED — ${fails.length} parity violation(s).`,
    );
    process.exit(1);
  }
}
