// platform/scheduler/scheduler.ts
//
// A2.1 — Local-first scheduler implementation.
//
// Reads the registered-agent stream (A1.1 substrate) + the runtime's
// canonical handler-metadata, derives a schedule registry, and emits
// `ScheduledTrigger` / `SubstrateAlert` events on each tick.
//
// CRON CONSOLIDATION (2026-05-10):
//   Cron expressions for scheduled handlers live in
//   `runtime/handlers-metadata.ts` (the `cronExpression` field on each
//   `HandlerMetadata` row). `SCHEDULER_CRON_MAP` is now a DERIVED
//   projection of that metadata via `derivedCronMap()`. Adding a new
//   scheduled handler requires editing exactly two authoring locations
//   in the runtime: `handlers-metadata.ts` (add row with cronExpression)
//   and `handler-callables.ts` (add callable). The GH Actions workflow
//   YAML remains a third surface for the moment — `recon:cron-map-drift`
//   asserts the workflow `schedule.cron` matches the metadata
//   `cronExpression`. A future slice will template-generate the YAMLs
//   from the metadata too.
//
// The export of `SCHEDULER_CRON_MAP` is preserved for back-compat with
// callers (and for any external consumers); it is now a re-render of
// the metadata-derived projection rather than a hand-maintained literal.
//
// Author: Atlas (A2.1)

import { HANDLERS_METADATA, derivedCronMap } from "../../runtime/handlers-metadata";
import { makeScheduledTrigger, makeSubstrateAlert } from "../event-store/event-types";
import type { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { logger } from "../observability/logger";

import { isPublicHoliday, shiftPastHolidays } from "./calendar";
import { type ParsedCron, nextFireAfter, parseCron } from "./cron-parse";
import type {
  FiredTrigger,
  InactivityCheckResult,
  InactivityFinding,
  InactivityFindingClass,
  ScheduleEntry,
  Scheduler,
  SyncResult,
  TickResult,
} from "./types";

const DEFAULT_ENTITY = "BANK-ZA-001";
const DEFAULT_JURISDICTION = "ZA";
const DEFAULT_ACTOR: Actor = {
  type: "service",
  id: "agent:atlas:scheduler",
};

const DEFAULT_CITATIONS: readonly string[] = [
  "GOV-FRAMEWORK-CEO-RESERVED",
  "JOINT-STANDARD-2-2024",
  "ORG-CY-01",
];

/**
 * Cron expressions for the in-process scheduler, derived from
 * `HANDLERS_METADATA`'s `cronExpression` field. Post-consolidation
 * (2026-05-10), this is no longer a hand-maintained literal — adding a
 * new scheduled handler requires only adding the metadata row in
 * `runtime/handlers-metadata.ts`.
 *
 * The export is preserved for back-compat with external callers /
 * other modules that may import the symbol. Internal callers should
 * prefer `derivedCronMap()` from the metadata module directly.
 *
 * The `.github/workflows/agent-runtime-*.yml` files remain a parallel
 * surface; `recon:cron-map-drift` asserts they agree with the metadata.
 */
export const SCHEDULER_CRON_MAP: Readonly<Record<string, string>> = derivedCronMap();

/**
 * Inactivity-SLA defaults per (agent, trigger). Parsed from the persona
 * spec § 6 "Inactivity SLA:" line; falls back to the cron-cadence for
 * the entry if the line doesn't parse.
 *
 * The substrate's eventual canonical source for SLA is the persona spec
 * itself (Atlas spec §3.2). Today we read the spec text but accept this
 * fallback table as the resolved SLA — Vera's recon (Wave-4 #13) will
 * assert the spec's text and the table agree.
 */
const INACTIVITY_SLA_HOURS_OVERRIDE: Readonly<Record<string, number>> = {
  // Atlas's PR-review SLA is event-driven; weekly substrate-state is the
  // scheduled cadence. 24h * 7 + buffer.
  "atlas:substrate-state": 24 * 8,
  // Mira screening pipeline: 1h. Citation gate is on-request — no SLA.
  "mira:obligations-snapshot": 24 * 8,
  // Camille close-event > 5 days past close.
  "camille:financial-position-snapshot": 24 * 7 + 24 * 5,
};

/**
 * Provider for the schedule registry. Pulled out as a seam so tests
 * can inject a synthetic source.
 */
export interface SchedulerSource {
  /** Map of (agent, trigger) → cron expression. */
  readonly cronMap: Readonly<Record<string, string>>;
  /**
   * Returns metadata rows for *scheduled* handlers (kind === "scheduled").
   * Default impl reads from `runtime/handlers-metadata.ts`; tests inject
   * a stub.
   */
  readonly scheduledHandlers: () => ReadonlyArray<{
    readonly agent: string;
    readonly trigger: string;
    readonly key: string;
    readonly cadenceHours?: number;
  }>;
  /**
   * Map keyed on persona name (lowercased) to the parsed inactivity-SLA
   * hours from §6 of the persona spec.
   */
  readonly slaForAgent: (agentLowercase: string) => number | undefined;
}

export interface LocalSchedulerConfig {
  readonly eventStore: EventStore;
  readonly source?: SchedulerSource;
  readonly entity?: string;
  readonly jurisdiction?: string;
  readonly actor?: Actor;
  readonly citations?: readonly string[];
}

/** Tolerant parse of the persona spec § 6 "Inactivity SLA:" line.
 *  Returns the SLA in hours, or undefined when no parseable token. */
export function parseInactivitySlaHours(text: string): number | undefined {
  if (!text) return undefined;
  // Common shapes:
  //   "every 24h" / "every 7 days" / "quiet > 24h" / "every 60 seconds"
  //   "every 30 minutes" / "Daily ... by 08:00 UTC" / "5 SA business days"
  // Strategy: find a numeric quantity adjacent to a unit token.
  const re =
    /(\d+(?:\.\d+)?)\s*(seconds?|sec|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|wk|w)\b/gi;
  let bestHours: number | undefined;
  let m: RegExpExecArray | null = null;
  while (true) {
    m = re.exec(text);
    if (!m) break;
    const n = Number.parseFloat(m[1] ?? "0");
    const unit = (m[2] ?? "").toLowerCase();
    let hours: number;
    if (unit.startsWith("s") && unit !== "seconds" && unit !== "sec" && unit !== "s") {
      // safety — only consume real second-tokens
      continue;
    }
    if (unit === "second" || unit === "seconds" || unit === "sec" || unit === "s") {
      hours = n / 3600;
    } else if (
      unit === "m" ||
      unit === "min" ||
      unit === "mins" ||
      unit === "minute" ||
      unit === "minutes"
    ) {
      hours = n / 60;
    } else if (
      unit === "h" ||
      unit === "hr" ||
      unit === "hrs" ||
      unit === "hour" ||
      unit === "hours"
    ) {
      hours = n;
    } else if (unit === "d" || unit === "day" || unit === "days") {
      hours = n * 24;
    } else if (unit === "w" || unit === "wk" || unit === "week" || unit === "weeks") {
      hours = n * 24 * 7;
    } else {
      continue;
    }
    // Take the *largest* parsed window — persona text often has a "must
    // produce X every 24h" with a shorter "respond within 60 seconds"
    // qualifier; the inactivity SLA is the larger of the two.
    if (bestHours === undefined || hours > bestHours) bestHours = hours;
  }
  return bestHours;
}

/**
 * Default `SchedulerSource` — wires the cron map above + the canonical
 * handler-metadata + a stub SLA reader (the CLI replaces the SLA
 * reader with one that parses persona files).
 */
export function defaultSchedulerSource(): SchedulerSource {
  return {
    cronMap: SCHEDULER_CRON_MAP,
    scheduledHandlers: () =>
      HANDLERS_METADATA.filter((h) => h.kind === "scheduled").map((h) => ({
        agent: h.agent,
        trigger: h.trigger,
        key: h.key,
        ...(h.cadenceHours !== undefined ? { cadenceHours: h.cadenceHours } : {}),
      })),
    slaForAgent: () => undefined,
  };
}

/** In-memory source for tests. */
export function inMemorySchedulerSource(args: {
  cronMap: Record<string, string>;
  handlers: ReadonlyArray<{
    agent: string;
    trigger: string;
    cadenceHours?: number;
  }>;
  slaForAgent?: (agentLowercase: string) => number | undefined;
}): SchedulerSource {
  return {
    cronMap: args.cronMap,
    scheduledHandlers: () =>
      args.handlers.map((h) => ({
        agent: h.agent,
        trigger: h.trigger,
        key: `${h.agent.toLowerCase()}:${h.trigger}`,
        ...(h.cadenceHours !== undefined ? { cadenceHours: h.cadenceHours } : {}),
      })),
    slaForAgent: args.slaForAgent ?? (() => undefined),
  };
}

/**
 * Local-first scheduler. Authoritative state is the event store; this
 * class is a thin command + query layer.
 */
export class LocalScheduler implements Scheduler {
  private readonly eventStore: EventStore;
  private readonly source: SchedulerSource;
  private readonly entity: string;
  private readonly jurisdiction: string;
  private readonly actor: Actor;
  private readonly citations: readonly string[];
  private cachedEntries: readonly ScheduleEntry[] | undefined;

  constructor(config: LocalSchedulerConfig) {
    this.eventStore = config.eventStore;
    this.source = config.source ?? defaultSchedulerSource();
    this.entity = config.entity ?? DEFAULT_ENTITY;
    this.jurisdiction = config.jurisdiction ?? DEFAULT_JURISDICTION;
    this.actor = config.actor ?? DEFAULT_ACTOR;
    this.citations = config.citations ?? DEFAULT_CITATIONS;
  }

  syncRegistry(_now: Date): SyncResult {
    const handlers = this.source.scheduledHandlers();
    const entries: ScheduleEntry[] = [];
    const parseFailures: { agentUrn: string; triggerId: string; reason: string }[] = [];
    for (const h of handlers) {
      const cron = this.source.cronMap[h.key];
      if (!cron) {
        // Scheduled handler with no cron — surface as a parse failure.
        parseFailures.push({
          agentUrn: `agent:${h.agent.toLowerCase()}`,
          triggerId: h.trigger,
          reason: `no cron expression registered for ${h.key} in scheduler.cronMap`,
        });
        continue;
      }
      let parsed: ParsedCron;
      try {
        parsed = parseCron(cron);
      } catch (e) {
        parseFailures.push({
          agentUrn: `agent:${h.agent.toLowerCase()}`,
          triggerId: h.trigger,
          reason: `cron parse failed: ${(e as Error).message}`,
        });
        continue;
      }
      entries.push({
        agentUrn: `agent:${h.agent.toLowerCase()}`,
        triggerId: h.trigger,
        cronExpression: cron,
        parsed,
        jurisdiction: this.jurisdiction,
        runOnHoliday: false,
      });
    }
    this.cachedEntries = entries;
    return { entries, count: entries.length, parseFailures };
  }

  /** Internal — derive entries lazily from `syncRegistry` if not cached. */
  private entries(now: Date): readonly ScheduleEntry[] {
    if (!this.cachedEntries) this.syncRegistry(now);
    return this.cachedEntries ?? [];
  }

  tick(now: Date): TickResult {
    const entries = this.entries(now);
    const firings: FiredTrigger[] = [];

    // Build a set of already-fired (agent, trigger, scheduledFor)
    // tuples from the event log so the tick is idempotent across
    // re-invocation. P1: the event log is the truth.
    const firedKeys = new Set<string>();
    for (const e of this.eventStore.replay({ type: "ScheduledTrigger" })) {
      const p = e.payload as Record<string, unknown>;
      const k = `${String(p.agentUrn ?? "")}|${String(p.triggerId ?? "")}|${String(p.scheduledFor ?? "")}`;
      firedKeys.add(k);
    }

    for (const entry of entries) {
      // The "look-back window" is the range from a stable epoch (we
      // pick last-week-from-now) up to `now`. We fire any matching
      // due-times in the window that haven't already fired.
      //
      // Bounding the window prevents us from re-emitting fire-times
      // for cron expressions whose past trail extends arbitrarily far
      // (the cron parser would happily produce a year of past fires).
      const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      let cursor = windowStart;
      // Iteratively step cursor forward by `nextFireAfter` until we
      // pass `now`. Bounded by a hard cap to defend against
      // pathological inputs.
      for (let guard = 0; guard < 1000; guard++) {
        let fireAt: Date;
        try {
          fireAt = nextFireAfter(entry.parsed, cursor);
        } catch (err) {
          logger.warn(
            { agentUrn: entry.agentUrn, err: (err as Error).message },
            "scheduler: nextFireAfter threw — skipping trigger",
          );
          break;
        }
        if (fireAt > now) break;
        cursor = fireAt;

        // Apply holiday-skip rule (P5). When the candidate falls on a
        // public holiday and the schedule's runOnHoliday is unset,
        // shift to next non-holiday day at the same time-of-day.
        let scheduledForDate = fireAt;
        let holidayShiftedFrom: string | undefined;
        if (!entry.runOnHoliday && isPublicHoliday(fireAt, entry.jurisdiction)) {
          const shifted = shiftPastHolidays(fireAt, entry.jurisdiction);
          if (shifted.getTime() !== fireAt.getTime()) {
            holidayShiftedFrom = fireAt.toISOString();
            scheduledForDate = shifted;
            // If the shifted time is still in the future relative to
            // `now`, don't fire yet.
            if (scheduledForDate > now) continue;
          }
        }
        const scheduledFor = scheduledForDate.toISOString();
        const dedupKey = `${entry.agentUrn}|${entry.triggerId}|${scheduledFor}`;
        if (firedKeys.has(dedupKey)) continue;
        firedKeys.add(dedupKey);

        const firedAt = now.toISOString();
        const delayMs = Math.max(0, now.getTime() - scheduledForDate.getTime());
        this.eventStore.append(
          makeScheduledTrigger({
            asOf: firedAt,
            entity: this.entity,
            actor: this.actor,
            citations: [...this.citations],
            payload: {
              agentUrn: entry.agentUrn,
              triggerId: entry.triggerId,
              cronExpression: entry.cronExpression,
              scheduledFor,
              firedAt,
              delayMs,
              jurisdiction: entry.jurisdiction,
              ...(holidayShiftedFrom ? { holidayShiftedFrom } : {}),
            },
          }),
        );
        firings.push({
          agentUrn: entry.agentUrn,
          triggerId: entry.triggerId,
          cronExpression: entry.cronExpression,
          scheduledFor,
          firedAt,
          delayMs,
          jurisdiction: entry.jurisdiction,
          ...(holidayShiftedFrom ? { holidayShiftedFrom } : {}),
        });
      }
    }
    return { firings, considered: entries.length };
  }

  inactivityCheck(now: Date): InactivityCheckResult {
    const entries = this.entries(now);
    const findings: InactivityFinding[] = [];

    // -------------------------------------------------------------------
    // Lifecycle-pair fold (S8 §3.4 / D-AGENT-RUNTIME-AUTHORIZE).
    //
    // Walk SubstrateAgentRunStarted + SubstrateAgentRunCompleted +
    // SubstrateAgentRunFailed and build, per agent URN, the latest
    // closed-run timestamp + the set of orphaned (Started without
    // Completed/Failed) runs.
    //
    // This intentionally REPLACES the pre-#189 heuristic ("any event by
    // agent"), which false-greened when the scheduler's own
    // SubstrateAlert / the bus's BusDispatched / the runner-worker's
    // boundary-escape SubstrateAlert attributed back to the agent's URN.
    //
    // Authority: D-AGENT-RUNTIME-AUTHORIZE (CEO-approved 2026-05-08).
    // Closure: spec §9 A2 exit criterion ("inactivity-SLA recon
    //          enforcement live").
    // -------------------------------------------------------------------

    interface OrphanRun {
      readonly runId: string;
      readonly startedAtMs: number;
    }
    interface LifecycleFold {
      /** Most recent SubstrateAgentRun{Completed,Failed} ms; -Infinity if none. */
      lastClosedAtMs: number;
      /** Open Started runs not yet closed by Completed/Failed. */
      readonly orphans: Map<string, OrphanRun>;
    }
    const foldByAgent = new Map<string, LifecycleFold>();
    const getFold = (urn: string): LifecycleFold => {
      let f = foldByAgent.get(urn);
      if (!f) {
        f = { lastClosedAtMs: Number.NEGATIVE_INFINITY, orphans: new Map() };
        foldByAgent.set(urn, f);
      }
      return f;
    };

    // Pass 1 — collect all Started events as orphans-pending-close.
    for (const e of this.eventStore.replay({ type: "SubstrateAgentRunStarted" })) {
      const p = e.payload as Record<string, unknown>;
      const agentName = typeof p.agent === "string" ? p.agent : "";
      const runId = typeof p.runId === "string" ? p.runId : "";
      const startedAt = typeof p.startedAt === "string" ? p.startedAt : e.as_of;
      const startedAtMs = Date.parse(startedAt);
      if (!agentName || !runId || Number.isNaN(startedAtMs)) continue;
      const urn = `agent:${agentName.toLowerCase()}`;
      getFold(urn).orphans.set(runId, { runId, startedAtMs });
    }
    // Pass 2 — close orphans on Completed / Failed; advance lastClosedAtMs.
    for (const closingType of ["SubstrateAgentRunCompleted", "SubstrateAgentRunFailed"] as const) {
      for (const e of this.eventStore.replay({ type: closingType })) {
        const p = e.payload as Record<string, unknown>;
        const agentName = typeof p.agent === "string" ? p.agent : "";
        const runId = typeof p.runId === "string" ? p.runId : "";
        const closedAtKey =
          closingType === "SubstrateAgentRunCompleted" ? "completedAt" : "failedAt";
        const closedAt = typeof p[closedAtKey] === "string" ? (p[closedAtKey] as string) : e.as_of;
        const closedAtMs = Date.parse(closedAt);
        if (!agentName || !runId || Number.isNaN(closedAtMs)) continue;
        const urn = `agent:${agentName.toLowerCase()}`;
        const fold = getFold(urn);
        fold.orphans.delete(runId);
        if (closedAtMs > fold.lastClosedAtMs) fold.lastClosedAtMs = closedAtMs;
      }
    }

    // Build a set of already-emitted alert keys for idempotency. Alert
    // ids are now class-discriminated so the three finding classes
    // (`no-runs`, `stale-runs`, `orphaned-run`) get distinct ids — a
    // stale-runs alert and a later orphaned-run alert for the same
    // (agent, trigger) must coexist.
    const emittedAlertIds = new Set<string>();
    for (const e of this.eventStore.replay({ type: "SubstrateAlert" })) {
      const p = e.payload as Record<string, unknown>;
      if (typeof p.alertId === "string") emittedAlertIds.add(p.alertId);
    }

    for (const entry of entries) {
      const lc = entry.agentUrn.replace(/^agent:/, "");
      const cadenceHours: number = (() => {
        // Try persona spec § 6 first.
        const fromSpec = this.source.slaForAgent(lc);
        if (fromSpec !== undefined) return fromSpec;
        // Override table.
        const key = `${lc}:${entry.triggerId}`;
        const override = INACTIVITY_SLA_HOURS_OVERRIDE[key];
        if (override !== undefined) return override;
        // Fall back: derive from handlers-metadata cadenceHours * 1.5.
        const handlers = this.source.scheduledHandlers();
        const meta = handlers.find((h) => h.key === key);
        if (meta && meta.cadenceHours !== undefined) return meta.cadenceHours * 1.5;
        // Last-resort default — 7d.
        return 24 * 7;
      })();
      const cadenceMs = cadenceHours * 60 * 60 * 1000;

      const fold = foldByAgent.get(entry.agentUrn);
      const lastClosedAtMs = fold?.lastClosedAtMs ?? Number.NEGATIVE_INFINITY;
      const orphans = fold ? [...fold.orphans.values()] : [];

      // -------- stale-runs / no-runs (closed-run lateness) --------
      let staleClass: InactivityFindingClass | undefined;
      let staleHoursSince: number;
      if (lastClosedAtMs === Number.NEGATIVE_INFINITY) {
        // Never closed a run AND never started one would be no-runs;
        // never closed a run BUT has an orphan still counts as no-runs
        // (no successful close has ever landed). The orphan branch
        // below catches the in-flight evidence separately.
        staleHoursSince = Number.POSITIVE_INFINITY;
        staleClass = "no-runs";
      } else {
        staleHoursSince = (now.getTime() - lastClosedAtMs) / (60 * 60 * 1000);
        if (staleHoursSince > cadenceHours) staleClass = "stale-runs";
      }

      if (staleClass !== undefined) {
        const alertId = `alert:inactivity:${lc}-${entry.triggerId}-${staleClass}`.toLowerCase();
        const details =
          staleClass === "no-runs"
            ? `${entry.agentUrn} (${entry.triggerId}): no SubstrateAgentRunStarted/Completed/Failed events recorded; SLA ${cadenceHours.toFixed(1)}h`
            : `${entry.agentUrn} (${entry.triggerId}): last closed run ${staleHoursSince.toFixed(1)}h ago; SLA ${cadenceHours.toFixed(1)}h`;
        const severity = staleHoursSince > cadenceHours * 2 ? "high" : "medium";
        if (!emittedAlertIds.has(alertId)) {
          this.eventStore.append(
            makeSubstrateAlert({
              asOf: now.toISOString(),
              entity: this.entity,
              actor: this.actor,
              citations: [...this.citations],
              payload: {
                alertId,
                alertClass: "inactivity",
                agentUrn: entry.agentUrn,
                details,
                severity,
              },
            }),
          );
          emittedAlertIds.add(alertId);
        }
        findings.push({
          agentUrn: entry.agentUrn,
          triggerId: entry.triggerId,
          alertId,
          slaHours: cadenceHours,
          hoursSinceLastEvent: staleHoursSince,
          details,
          findingClass: staleClass,
        });
      }

      // -------- orphaned-run (Started with no Completed/Failed within SLA) --------
      // Spec §3.2 final bullet: "if an agent fails to emit an
      // AgentRunCompleted within its declared inactivity SLA, the
      // scheduler emits a SubstrateAlert". One alert per stale orphan
      // — older orphans by `startedAtMs` first for stable ordering.
      const staleOrphans = orphans
        .filter((o) => now.getTime() - o.startedAtMs > cadenceMs)
        .sort((a, b) => a.startedAtMs - b.startedAtMs);
      for (const orphan of staleOrphans) {
        const orphanHoursSince = (now.getTime() - orphan.startedAtMs) / (60 * 60 * 1000);
        // Run-id-scoped alertId so a per-orphan alert is idempotent
        // even when the same agent has multiple stuck runs. We keep the
        // (agent, trigger) prefix so Vera Wave-4 #13's per-trigger
        // bucket fold still works.
        const runIdSuffix = orphan.runId
          .replace(/[^a-z0-9]/gi, "")
          .toLowerCase()
          .slice(0, 24);
        const alertId =
          `alert:inactivity:${lc}-${entry.triggerId}-orphan-${runIdSuffix}`.toLowerCase();
        const details = `${entry.agentUrn} (${entry.triggerId}): run ${orphan.runId} started ${orphanHoursSince.toFixed(1)}h ago and never closed; SLA ${cadenceHours.toFixed(1)}h`;
        const severity = orphanHoursSince > cadenceHours * 2 ? "high" : "medium";
        if (!emittedAlertIds.has(alertId)) {
          this.eventStore.append(
            makeSubstrateAlert({
              asOf: now.toISOString(),
              entity: this.entity,
              actor: this.actor,
              citations: [...this.citations],
              payload: {
                alertId,
                alertClass: "inactivity",
                agentUrn: entry.agentUrn,
                details,
                severity,
              },
            }),
          );
          emittedAlertIds.add(alertId);
        }
        findings.push({
          agentUrn: entry.agentUrn,
          triggerId: entry.triggerId,
          alertId,
          slaHours: cadenceHours,
          hoursSinceLastEvent: orphanHoursSince,
          details,
          findingClass: "orphaned-run",
          orphanedRunId: orphan.runId,
        });
      }
    }
    return { findings, considered: entries.length };
  }
}

/** Logger handle re-exposed for the CLI. */
export const schedulerLogger = logger.child({ component: "scheduler" });
