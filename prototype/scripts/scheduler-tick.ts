// scripts/scheduler-tick.ts
//
// One-shot CLI: derives the schedule registry from registered agents,
// emits `ScheduledTrigger` events for any due fire-times, and emits
// `SubstrateAlert` events for any agent whose inactivity SLA has
// elapsed.
//
// Invocation: `bun run scheduler:tick` (npm script in package.json).
//
// Run order:
//   1. syncRegistry — refresh schedule entries from registered agents
//      + the runtime's handlers-metadata.
//   2. tick — emit ScheduledTrigger events for any due entries.
//   3. inactivityCheck — emit SubstrateAlert for any agent past SLA.
//
// The CLI does NOT invoke the agent handlers. That's a future slice —
// A2.1 emits the event; A2.2's bus reads ScheduledTrigger and
// dispatches. During A2.1 the GH Actions cron files keep firing
// handlers in parallel; A2.1's events are an audit-trail record + a
// stepping stone toward A2.2.
//
// Author: Atlas (A2.1)

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../platform/composition";
import {
  LocalScheduler,
  defaultSchedulerSource,
  parseInactivitySlaHours,
} from "../platform/scheduler/scheduler";

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

  // 3. inactivityCheck — alert on any agent past SLA.
  const inact = scheduler.inactivityCheck(now);
  logger.info(
    { findings: inact.findings.length, considered: inact.considered },
    `scheduler:tick — inactivityCheck: ${inact.findings.length} alerts (${inact.considered} entries considered)`,
  );
  for (const f of inact.findings) {
    logger.warn(f, `scheduler:tick — inactivity ${f.alertId}: ${f.details}`);
  }

  // Summary line.
  logger.info(
    {
      entries: sync.count,
      parseFailures: sync.parseFailures.length,
      firings: tick.firings.length,
      alerts: inact.findings.length,
    },
    `scheduler:tick — done: entries=${sync.count} fired=${tick.firings.length} alerts=${inact.findings.length} parseFailures=${sync.parseFailures.length}`,
  );

  return sync.parseFailures.length === 0 ? 0 : 1;
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
