// scripts/substrate-scheduler.ts
//
// A2.1 — Bun-based substrate scheduler (long-lived process).
//
// This is the *long-running* counterpart to `scripts/scheduler-tick.ts`
// (which is a one-shot CLI). Where `scheduler:tick` fires once and exits,
// this process stays alive and evaluates the schedule manifest on every
// interval, emitting `ScheduledTrigger` events to the event store for any
// due fire-times.
//
// Design notes:
//   - Uses Bun's built-in `setInterval` (no extra cron library needed;
//     the cron-parse logic already lives in `platform/scheduler/cron-parse`
//     and is consumed by `LocalScheduler`).
//   - On each tick it delegates to `LocalScheduler.tick()` — the same
//     idempotent engine used by the one-shot CLI. The event store's
//     dedup-by-(agentUrn, triggerId, scheduledFor) ensures events are
//     emitted exactly once per fire-time even if the interval fires more
//     frequently than the cron cadence.
//   - Agent invocation is NOT performed here; a `ScheduledTrigger` event
//     is appended and logged. Actual dispatch runs via the bus consumer
//     (`bus:tick` or the event-trigger-bus consumer wired in
//     `scheduler-tick.ts`). Separation of concerns: the scheduler's job
//     is *emitting* the trigger event, not *executing* the handler.
//   - The embedded schedule manifest below mirrors the agents listed in
//     the A2.1 brief. It is provided as documentation / reference; the
//     authoritative cron source is `runtime/handlers-metadata.ts` as read
//     by `LocalScheduler`. Drift between this comment and the live metadata
//     is caught by `recon:cron-map-drift`.
//
// Embedded schedule manifest (approximate UTC times per brief §1):
//
//   Agent     | Trigger            | UTC cron        | Position
//   ----------|--------------------|-----------------|-------------------------------
//   vera      | overnight-recon    | 13 2 * * *      | Internal Audit Engineer
//   anya      | projection-drift   | 17 3 * * *      | Projection & Analytics Engineer
//   scrooge   | inbox-hygiene      | 27 4 * * *      | Chief of Staff / Orchestrator
//   helena    | risk-appetite-watch| 30 4 * * *      | Chief Risk Officer, governance
//   atlas     | substrate-state    | 0  5 * * MON    | Core banking platform architect
//   sade      | agentops-readiness | 30 5 * * *      | AgentOps, engineering
//   owen      | governance-cycle-prep| 0 6 * * MON   | Company Secretary, governance
//   imani     | legal-readiness    | 30 6 * * MON    | Legal Counsel, engineering
//   camille   | financial-position-snapshot | 0 7 * * 2 | Finance & GL Engineer
//   kai       | m1-cdm-typescript-bindings  | 30 7 * * * | Markets Data Engineer
//
// The above schedule comment is informational; the process uses
// `defaultSchedulerSource()` which derives entries from
// `runtime/handlers-metadata.ts` — the single authoring location for cron
// expressions (per cron-consolidation note in scheduler.ts).
//
// Invocation: `bun run substrate:scheduler` (npm script in package.json).
//
// Environment variables:
//   BANK_SCHEDULER_INTERVAL_MS — poll interval in milliseconds.
//                                Default: 60_000 (1 minute). A shorter
//                                interval does not cause duplicate events
//                                because `LocalScheduler.tick()` is
//                                idempotent. A longer interval risks
//                                missing a fire-time that falls between
//                                ticks (cron expressions at per-minute
//                                granularity are the risk boundary).
//
// Authority: A2.1 substrate spec (Atlas, 2026-05-18).
// Citations: GOV-FRAMEWORK-CEO-RESERVED, JOINT-STANDARD-2-2024, ORG-CY-01.
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../platform/composition";
import {
  LocalScheduler,
  defaultSchedulerSource,
  parseInactivitySlaHours,
} from "../platform/scheduler/scheduler";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * How often (ms) the scheduler evaluates the cron manifest.
 * Default 60 s — matches the minimum cron granularity (1 minute).
 * Override via BANK_SCHEDULER_INTERVAL_MS for testing.
 */
const INTERVAL_MS = (() => {
  const raw = process.env.BANK_SCHEDULER_INTERVAL_MS;
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
    logger.warn({ raw }, "substrate-scheduler — BANK_SCHEDULER_INTERVAL_MS invalid; using 60000");
  }
  return 60_000;
})();

// ---------------------------------------------------------------------------
// SLA resolver (mirrors scheduler-tick.ts)
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(import.meta.dir, "..", "..");
const TEAM_DIR = resolve(REPO_ROOT, "Team");

function buildSlaResolver(): (agentLowercase: string) => number | undefined {
  const cache = new Map<string, number | undefined>();
  if (!existsSync(TEAM_DIR)) return () => undefined;
  const files = readdirSync(TEAM_DIR).filter(
    (n) => n.endsWith(".md") && !n.startsWith("_") && !n.startsWith("."),
  );
  for (const file of files) {
    const path = resolve(TEAM_DIR, file);
    let content: string;
    try {
      content = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const persona = file.replace(/\.md$/i, "").toLowerCase();
    const m = /^[\-*]\s+\*\*Inactivity SLA:\*\*\s+(.+)$/im.exec(content);
    if (!m?.[1]) continue;
    const hours = parseInactivitySlaHours(m[1]);
    if (hours !== undefined) cache.set(persona, hours);
  }
  return (agentLowercase: string) => cache.get(agentLowercase);
}

// ---------------------------------------------------------------------------
// Tick logic
// ---------------------------------------------------------------------------

let tickCount = 0;

function tick(scheduler: LocalScheduler): void {
  tickCount++;
  const now = new Date();
  logger.debug({ tick: tickCount, now: now.toISOString() }, "substrate-scheduler — tick start");

  try {
    // Fire any due triggers (idempotent — dedup'd by event store).
    const result = scheduler.tick(now);

    if (result.firings.length > 0) {
      for (const f of result.firings) {
        logger.info(
          {
            agentUrn: f.agentUrn,
            triggerId: f.triggerId,
            scheduledFor: f.scheduledFor,
            delayMs: f.delayMs,
          },
          `substrate-scheduler — fired ${f.agentUrn} (${f.triggerId}); would invoke agent:${f.agentUrn.replace(/^agent:/, "")} (actual dispatch via bus consumer)`,
        );
      }
    } else {
      logger.debug(
        { considered: result.considered },
        `substrate-scheduler — tick ${tickCount}: no triggers due (${result.considered} entries considered)`,
      );
    }
  } catch (err) {
    logger.error(
      { tick: tickCount, err: (err as Error).message },
      "substrate-scheduler — tick threw; continuing",
    );
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot(): void {
  logger.info(
    {
      intervalMs: INTERVAL_MS,
      teamDir: TEAM_DIR,
      pid: process.pid,
    },
    "substrate-scheduler — booting (A2.1 long-lived process)",
  );

  const base = defaultSchedulerSource();
  const source = {
    cronMap: base.cronMap,
    scheduledHandlers: base.scheduledHandlers,
    slaForAgent: buildSlaResolver(),
  };

  const scheduler = new LocalScheduler({ eventStore, source });

  // Initial sync to surface any parse failures at boot time.
  const sync = scheduler.syncRegistry(new Date());
  logger.info(
    { entries: sync.count, parseFailures: sync.parseFailures.length },
    `substrate-scheduler — syncRegistry: ${sync.count} entries, ${sync.parseFailures.length} failures`,
  );
  for (const f of sync.parseFailures) {
    logger.error(f, `substrate-scheduler — parse failure at boot: ${f.agentUrn} (${f.triggerId}): ${f.reason}`);
  }

  // Immediate first tick so the process fires any due triggers without
  // waiting for the first interval.
  tick(scheduler);

  // Long-lived interval — Bun keeps the process alive as long as this
  // interval is registered.
  setInterval(() => tick(scheduler), INTERVAL_MS);

  logger.info(
    { intervalMs: INTERVAL_MS },
    `substrate-scheduler — running; poll every ${INTERVAL_MS}ms`,
  );
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

process.on("SIGTERM", () => {
  logger.info("substrate-scheduler — SIGTERM received; shutting down");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("substrate-scheduler — SIGINT received; shutting down");
  process.exit(0);
});

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  boot();
}
