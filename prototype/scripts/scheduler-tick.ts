// scripts/scheduler-tick.ts
//
// One-shot CLI: derives the schedule registry from registered agents,
// emits `ScheduledTrigger` events for any due fire-times, dispatches
// any matching scheduled handlers via the bus consumer (S8 §3.3), and
// emits `SubstrateAlert` events for any agent whose inactivity SLA has
// elapsed.
//
// Invocation: `bun run scheduler:tick` (npm script in package.json).
//
// Run order:
//   1. syncRegistry — refresh schedule entries from registered agents
//      + the runtime's handlers-metadata.
//   2. tick — emit ScheduledTrigger events for any due entries.
//   3. consume — read any pending ScheduledTrigger events and dispatch
//      the matching scheduled handler via runAgent. This closes the
//      end-to-end chain: scheduler → bus → runner-worker → handler.
//      Disabled by `BANK_SCHEDULER_AUTODISPATCH=false` for CI runs that
//      only want to emit the trigger event without invoking handlers.
//   4. inactivityCheck — emit SubstrateAlert for any agent past SLA.
//
// Author: Atlas (A2.1; S8 §3.3 dispatch wiring 2026-05-10)

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../platform/composition";
import { ScheduledTriggerConsumer } from "../platform/event-trigger-bus";
import {
  LocalScheduler,
  defaultSchedulerSource,
  parseInactivitySlaHours,
} from "../platform/scheduler/scheduler";
import { runAgent } from "../runtime/run";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");
const TEAM_DIR = resolve(REPO_ROOT, "Team");

/**
 * Read the `Inactivity SLA:` line from each `/Team/<Name>.md` and
 * resolve it to a number of hours. Returns a function suitable for
 * `SchedulerSource.slaForAgent`.
 *
 * Failure mode: any persona file we can't read or parse falls through
 * to `undefined`; the scheduler then uses the override-table or the
 * `cadenceHours * 1.5` fallback.
 */
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
    // Find the `Inactivity SLA:` line; allow the section heading to
    // wrap before / after.
    const m = /^[\-*]\s+\*\*Inactivity SLA:\*\*\s+(.+)$/im.exec(content);
    if (!m?.[1]) continue;
    const hours = parseInactivitySlaHours(m[1]);
    if (hours !== undefined) cache.set(persona, hours);
  }
  return (agentLowercase: string) => cache.get(agentLowercase);
}

async function main(): Promise<number> {
  const now = new Date();
  const source = (() => {
    const base = defaultSchedulerSource();
    return {
      cronMap: base.cronMap,
      scheduledHandlers: base.scheduledHandlers,
      slaForAgent: buildSlaResolver(),
    };
  })();
  const scheduler = new LocalScheduler({ eventStore, source });

  // 1. syncRegistry
  const sync = scheduler.syncRegistry(now);
  logger.info(
    {
      entries: sync.count,
      parseFailures: sync.parseFailures.length,
    },
    `scheduler:tick — syncRegistry: ${sync.count} entries, ${sync.parseFailures.length} failures`,
  );
  for (const f of sync.parseFailures) {
    logger.error(f, `scheduler:tick — parse failure: ${f.agentUrn} (${f.triggerId}): ${f.reason}`);
  }

  // 2. tick — fire any due triggers.
  const tick = scheduler.tick(now);
  logger.info(
    { firings: tick.firings.length, considered: tick.considered },
    `scheduler:tick — tick: fired ${tick.firings.length} triggers (${tick.considered} entries considered)`,
  );
  for (const f of tick.firings) {
    logger.info(
      f,
      `scheduler:tick — fired ${f.agentUrn} (${f.triggerId}) scheduled=${f.scheduledFor} delayMs=${f.delayMs}`,
    );
  }

  // 3. consume — dispatch any pending ScheduledTrigger events through the
  //    bus consumer to the matching scheduled handler. The consumer is
  //    idempotent on (eventId, handlerKey) via BusDispatched, so re-runs
  //    of `bun run scheduler:tick` against an unchanged store are no-ops.
  //    Disabled via BANK_SCHEDULER_AUTODISPATCH=false for the legacy
  //    path that only wants the audit-trail event.
  const autoDispatch = process.env.BANK_SCHEDULER_AUTODISPATCH !== "false";
  let dispatchOk = 0;
  let dispatchFailed = 0;
  let dispatchUnmatched = 0;
  if (autoDispatch) {
    const consumer = new ScheduledTriggerConsumer({
      eventStore,
      runner: async ({ agent, trigger }) => {
        const out = await runAgent({ agent, trigger, dryRun: false });
        return { ok: out.ok };
      },
    });
    const result = await consumer.consume(now);
    for (const d of result.dispatches) {
      if (d.outcome === "ok") dispatchOk += 1;
      else if (d.outcome === "failed") dispatchFailed += 1;
      else dispatchUnmatched += 1;
    }
    logger.info(
      {
        considered: result.considered,
        ok: dispatchOk,
        failed: dispatchFailed,
        unmatched: dispatchUnmatched,
      },
      `scheduler:tick — consume: ${dispatchOk}/${result.considered} dispatched (${dispatchFailed} failed, ${dispatchUnmatched} unmatched)`,
    );
  } else {
    logger.info(
      { autoDispatch: false },
      "scheduler:tick — consume: disabled via BANK_SCHEDULER_AUTODISPATCH=false",
    );
  }

  // 4. inactivityCheck — alert on any agent past SLA.
  const inact = scheduler.inactivityCheck(now);
  logger.info(
    { findings: inact.findings.length, considered: inact.considered },
    `scheduler:tick — inactivityCheck: ${inact.findings.length} alerts (${inact.considered} entries considered)`,
  );
  for (const f of inact.findings) {
    logger.warn(f, `scheduler:tick — inactivity ${f.alertId}: ${f.details}`);
  }

  // 5. Daily performance evaluations (Sade — AgentOps).
  //    Run once per calendar day (idempotent — skips if already evaluated).
  //    TODO: move to a Sade-owned scheduled handler (cron entry in Team/Sade.md)
  //    once the goal-loop scheduled-handler substrate is fully wired.
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  const alreadyRanToday = [...eventStore.replay({ type: "AgentPerformanceEvaluated" })].some(
    (e) => (e.payload as Record<string, unknown>).evaluationPeriod === yesterday,
  );
  if (!alreadyRanToday) {
    const { runPerformanceEvaluations } = await import("../platform/agents/performance-runner");
    const perfActor = { type: "service" as const, id: "agent:sade:performance-evaluator" };
    const perfResult = await runPerformanceEvaluations(yesterday, perfActor);
    logger.info(
      { evaluated: perfResult.evaluated, skipped: perfResult.skipped, period: yesterday },
      `scheduler:tick — performance evaluations: ${perfResult.evaluated} evaluated, ${perfResult.skipped} skipped`,
    );
  } else {
    logger.debug(
      { period: yesterday },
      "scheduler:tick — performance evaluations: already ran for yesterday",
    );
  }

  // 6. Auto-commit any new archive/owner-inbox/ outputs produced by this tick.
  //    Conditional: skip silently when nothing changed. Rebase-before-push per
  //    dispatch discipline. 5-attempt push-retry on non-fast-forward rejection.
  try {
    const archiveStatus = execSync(
      `git -C "${REPO_ROOT}" status --porcelain archive/owner-inbox/`,
      { encoding: "utf8" },
    ).trim();
    if (archiveStatus.length > 0) {
      const dateStr = now.toISOString().slice(0, 10);
      const commitMsg = `chore(archive): launchd scheduler outputs — ${dateStr}`;
      execSync(`git -C "${REPO_ROOT}" add archive/owner-inbox/`, { stdio: "pipe" });
      execSync(`git -C "${REPO_ROOT}" commit -m "${commitMsg}"`, { stdio: "pipe" });
      logger.info({ commitMsg }, `scheduler:tick — archive committed: ${commitMsg}`);

      execSync(`git -C "${REPO_ROOT}" fetch origin main`, { stdio: "pipe" });
      execSync(`git -C "${REPO_ROOT}" rebase origin/main`, { stdio: "pipe" });

      let pushed = false;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          execSync(`git -C "${REPO_ROOT}" push`, { stdio: "pipe" });
          pushed = true;
          logger.info({ attempt }, `scheduler:tick — archive push succeeded (attempt ${attempt})`);
          break;
        } catch {
          if (attempt < 5) {
            logger.warn(
              { attempt },
              `scheduler:tick — archive push rejected (attempt ${attempt}), rebasing`,
            );
            execSync(`git -C "${REPO_ROOT}" pull --rebase`, { stdio: "pipe" });
          }
        }
      }
      if (!pushed) {
        logger.error({}, "scheduler:tick — archive push failed after 5 attempts");
      }
    } else {
      logger.debug({}, "scheduler:tick — archive: nothing new to commit");
    }
  } catch (err) {
    logger.error({ err }, "scheduler:tick — archive auto-commit failed");
  }

  // Summary line.
  logger.info(
    {
      entries: sync.count,
      parseFailures: sync.parseFailures.length,
      firings: tick.firings.length,
      dispatched: dispatchOk,
      dispatchFailed,
      dispatchUnmatched,
      alerts: inact.findings.length,
    },
    `scheduler:tick — done: entries=${sync.count} fired=${tick.firings.length} dispatched=${dispatchOk} alerts=${inact.findings.length} parseFailures=${sync.parseFailures.length}`,
  );

  return sync.parseFailures.length === 0 ? 0 : 1;
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
