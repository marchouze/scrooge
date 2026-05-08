// platform/scheduler/scheduler.ts
//
// A2.1 — Local-first scheduler implementation.
//
// Reads the registered-agent stream (A1.1 substrate) + the runtime's
// canonical handler-metadata, derives a schedule registry, and emits
// `ScheduledTrigger` / `SubstrateAlert` events on each tick.
//
// The cron expressions for scheduled handlers today live in the
// `.github/workflows/agent-runtime-*.yml` files (the GH Actions
// dispatch surface). Until those retire (per Atlas's spec philosophy
// of substrate-replacement-without-loss; A2.2 dispatches via the bus),
// we mirror them in a small map below. The map is the authoritative
// source for the in-process scheduler; the workflow files remain the
// authoritative source for GH Actions cron. Drift between the two is
// itself a substrate-finding once Vera's pipeline picks it up
// (substrate gap noted; not in this slice).
//
// Author: Atlas (A2.1)

import { HANDLERS_METADATA } from "../../runtime/handlers-metadata";
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
  ScheduleEntry,
  Scheduler,
  SyncResult,
  TickResult,
} from "./index";

const DEFAULT_ENTITY = "BANK-ZA-001";
const DEFAULT_JURISDICTION = "ZA";
const DEFAULT_ACTOR: Actor = {
  type: "service",
  id: "agent:atlas:scheduler",
};

const DEFAULT_CITATIONS: readonly string[] = [
  "GOV-FRAMEWORK-CEO-RESERVED",
  "JOINT-STANDARD-1-2024",
  "ORG-CY-01",
];

/**
 * Mirror of the cron expressions in `.github/workflows/agent-runtime-*.yml`.
 * Keyed on the canonical `<lowercased-agent>:<trigger>` composite the
 * runtime's handler-metadata uses.
 *
 * This map is the in-process scheduler's authoritative cron source;
 * the workflow files keep firing handlers in parallel during A2.1 (per
 * spec philosophy). A2.2's bus replaces the GH Actions dispatch.
 *
 * Adding a new scheduled handler: append a row here AND the workflow
 * file. Vera's planned cross-source recon will assert the two stay
 * in sync.
 */
export const SCHEDULER_CRON_MAP: Readonly<Record<string, string>> = {
  "vera:overnight-recon": "13 2 * * *",
  "anya:projection-drift": "17 3 * * *",
  "scrooge:inbox-hygiene": "27 4 * * *",
  "helena:risk-appetite-watch": "30 4 * * *",
  "rohan:risk-run": "43 3 * * *",
  "eitan:liquidity-snapshot": "53 6 * * *",
  "atlas:substrate-state": "19 6 * * 1",
  "devon:operational-resilience-snapshot": "23 5 * * MON",
  "camille:financial-position-snapshot": "41 6 * * MON",
  "zara:mlro-supervision": "30 5 * * MON",
  "owen:governance-cycle-prep": "31 7 * * 2",
  "thandiwe:audit-committee-prep": "47 7 * * 2",
  "mira:obligations-snapshot": "29 7 * * 3",
  "iris:popia-controls-snapshot": "51 7 * * 3",
  "senna:security-substrate-state": "37 7 * * 4",
  "rashida:cyber-resilience-snapshot": "49 7 * * 4",
  "saskia:markets-readiness-snapshot": "33 5 * * MON",
  "bea:accounting-readiness": "47 5 * * *",
  "yael:tax-readiness": "7 6 * * THU",
  "tomas:payments-readiness": "21 4 * * *",
  "imani:legal-readiness": "9 7 * * 5",
  "ravi:alm-readiness": "37 5 * * *",
  "sade:agentops-readiness": "41 7 * * 5",
};

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
        } catch (_e) {
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

    // Pre-fold the event log into a per-agent latest-event timestamp map
    // so we don't re-scan once per entry. Inactivity is keyed off "any
    // event for this agent in the window"; for stricter event-class
    // SLAs the persona spec names a specific event type, which Vera's
    // pipeline will reconcile separately.
    const lastByAgent = new Map<string, number>();
    for (const e of this.eventStore.replay()) {
      const ms = Date.parse(e.as_of);
      if (Number.isNaN(ms)) continue;
      // Heuristic: actor.id `agent:<name>:...` or the actor.id matches
      // `agent:<name>`. We bucket by the first two `:`-segments so that
      // a per-trigger sub-actor (`agent:atlas:scheduler`) attributes to
      // `agent:atlas`.
      const actorId = e.actor.id;
      const idMatch = /^agent:([a-z0-9-]+)/i.exec(actorId);
      if (!idMatch) continue;
      const urn = `agent:${(idMatch[1] ?? "").toLowerCase()}`;
      const prev = lastByAgent.get(urn);
      if (prev === undefined || ms > prev) lastByAgent.set(urn, ms);
    }

    // Build a set of already-emitted alert keys for idempotency. A
    // SubstrateAlert with the same alertId is a latest-wins-per-key
    // event in the registry; we still skip re-emission to keep the
    // tick output clean.
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

      const last = lastByAgent.get(entry.agentUrn);
      const hoursSince =
        last === undefined ? Number.POSITIVE_INFINITY : (now.getTime() - last) / (60 * 60 * 1000);
      if (hoursSince <= cadenceHours) continue;

      const alertId = `alert:inactivity:${lc}-${entry.triggerId}`.toLowerCase();
      const details =
        last === undefined
          ? `${entry.agentUrn} (${entry.triggerId}): no events recorded; SLA ${cadenceHours.toFixed(1)}h`
          : `${entry.agentUrn} (${entry.triggerId}): last event ${hoursSince.toFixed(1)}h ago; SLA ${cadenceHours.toFixed(1)}h`;
      const severity = hoursSince > cadenceHours * 2 ? "high" : "medium";

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
        hoursSinceLastEvent: hoursSince,
        details,
      });
    }
    return { findings, considered: entries.length };
  }
}

/** Logger handle re-exposed for the CLI. */
export const schedulerLogger = logger.child({ component: "scheduler" });
