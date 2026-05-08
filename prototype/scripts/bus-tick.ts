// scripts/bus-tick.ts
//
// One-shot CLI: walks events appended since the last cursor, dispatches
// any subscribed event-driven handlers, and persists the new cursor.
// Idempotent — a second invocation with no new events emits zero
// dispatches.
//
// Invocation: `bun run bus:tick` (npm script in package.json).
//
// Run order:
//   1. Read cursor from `.local/bus-cursor.json` (default 0).
//   2. syncSubscriptions — refresh from runtime/handlers-metadata.ts.
//   3. tick — walk events ≥ cursor and dispatch any subscribed handlers.
//   4. Persist new cursor.
//
// During A2.2 the bus runs side-by-side with the in-process fan-out in
// `runtime/run.ts` lines 132–199; the legacy fan-out stays untouched
// per Atlas spec philosophy of substrate-replacement without loss.
//
// Author: Atlas (A2.2)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { eventStore, logger } from "../platform/composition";
import { LocalEventTriggerBus, defaultBusSource } from "../platform/event-trigger-bus";
import { runAgent } from "../runtime/run";

const CURSOR_PATH = process.env.BANK_BUS_CURSOR ?? ".local/bus-cursor.json";

interface CursorFile {
  readonly cursor: number;
  readonly updatedAt: string;
}

function readCursor(path: string): number {
  if (!existsSync(path)) return 0;
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<CursorFile>;
    if (typeof parsed.cursor === "number" && Number.isFinite(parsed.cursor)) {
      return parsed.cursor;
    }
    return 0;
  } catch (err) {
    logger.warn(
      { path, err: (err as Error).message },
      "bus:tick — cursor file unreadable, starting at 0",
    );
    return 0;
  }
}

function writeCursor(path: string, cursor: number): void {
  mkdirSync(dirname(path), { recursive: true });
  const file: CursorFile = { cursor, updatedAt: new Date().toISOString() };
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

async function main(): Promise<number> {
  const now = new Date();
  const cursorPath = resolve(CURSOR_PATH);
  const cursor = readCursor(cursorPath);

  const bus = new LocalEventTriggerBus({
    eventStore,
    source: defaultBusSource(),
    runner: async ({ agent, trigger }) => {
      const out = await runAgent({ agent, trigger, dryRun: false });
      return { ok: out.ok };
    },
  });

  const subs = bus.syncSubscriptions();
  logger.info(
    { subscriptions: subs.count },
    `bus:tick — syncSubscriptions: ${subs.count} subscriptions`,
  );

  const result = await bus.tick(cursor, now);

  const okCount = result.dispatches.filter((d) => d.outcome === "ok").length;
  const failCount = result.dispatches.filter((d) => d.outcome === "failed").length;
  logger.info(
    {
      cursor,
      nextCursor: result.nextCursor,
      considered: result.considered,
      dispatches: result.dispatches.length,
      ok: okCount,
      failed: failCount,
    },
    `bus:tick — tick: cursor ${cursor}→${result.nextCursor}, considered=${result.considered} dispatches=${result.dispatches.length} (ok=${okCount} failed=${failCount})`,
  );
  for (const d of result.dispatches) {
    logger.info(d, `bus:tick — dispatched ${d.handlerKey} for ${d.eventType} (${d.outcome})`);
  }

  writeCursor(cursorPath, result.nextCursor);
  return failCount === 0 ? 0 : 1;
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
