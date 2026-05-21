// scripts/migrate/backfill-orphaned-dispatch-lifecycle-events.ts
//
// One-shot backfill: consolidate `AgentRunStarted` + `AgentRunCompleted`
// events that were emitted in per-worktree event stores during the
// pre-D-CROSS-WORKTREE-EVENT-STORE-SYNC era into the shared home-default
// store (`$HOME/.local/share/bank/event.db`).
//
// Before D-CROSS-WORKTREE-EVENT-STORE-SYNC, each agent worktree ran
// `dispatch:start-run` + `dispatch:close-run` against its own
// `prototype/.local/event.db`. The `AgentBriefIssued` event lived in
// Scrooge's worktree's store; the lifecycle events lived in the agent's.
// `recon:dispatch-sync-integrity` (which reads the shared store via the
// new resolver) would see briefs without completions and report
// reviewer→decider violations against orphaned briefs.
//
// This script scans `/Users/marc/code/Bank/.claude/worktrees/*/prototype/.local/event.db`
// and `/Users/marc/code/Bank/.claude/worktrees/*/.local/event.db` for
// `AgentRunStarted` and `AgentRunCompleted` events, then appends any not
// already present in the shared store. Idempotent on `event_id`.
//
// Authority: D-CROSS-WORKTREE-EVENT-STORE-SYNC (CEO session-delegation,
// 2026-05-21). Brief: brief:atlas:cross-worktree-event-store-sync-retire-force-clo:2026-05-21.
//
// NOTE: This is a build-phase one-shot. It is NOT wired into
// `migrate:decisions-backfill` because (a) the source worktrees are
// developer-local and unavailable on CI runners, (b) once the cross-
// worktree resolver lands all future events flow to the shared store
// directly so no further backfill is needed.
//
// To run on Marc's machine:
//   bun run scripts/migrate/backfill-orphaned-dispatch-lifecycle-events.ts
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { eventStore } from "../../platform/composition";
import { EventStore } from "../../platform/event-store/store";
import type { Event } from "../../platform/event-store/types";

const WORKTREE_ROOT =
  process.env.BANK_WORKTREE_ROOT ?? join(homedir(), "code/Bank/.claude/worktrees");

const TARGET_TYPES = new Set(["AgentRunStarted", "AgentRunCompleted"]);

function findCandidateDbs(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const name of readdirSync(root)) {
    const worktree = join(root, name);
    if (!statSync(worktree).isDirectory()) continue;
    for (const candidate of [
      join(worktree, "prototype", ".local", "event.db"),
      join(worktree, ".local", "event.db"),
    ]) {
      if (existsSync(candidate)) out.push(candidate);
    }
  }
  return out;
}

function existingEventIds(): Set<string> {
  const out = new Set<string>();
  for (const e of eventStore.replay()) out.add(e.event_id);
  return out;
}

function main(): void {
  const targetPath = resolve(process.env.BANK_EVENT_DB ?? "");
  console.error(
    JSON.stringify({
      level: "info",
      component: "backfill-orphaned-dispatch-lifecycle-events",
      msg: "scanning worktrees",
      worktreeRoot: WORKTREE_ROOT,
      target: targetPath,
    }),
  );

  const dbs = findCandidateDbs(WORKTREE_ROOT);
  const known = existingEventIds();

  let scanned = 0;
  let candidates = 0;
  let appended = 0;
  let skippedExisting = 0;

  const errors: { db: string; err: string }[] = [];

  for (const db of dbs) {
    // Skip the target itself — we don't want to read from and append to
    // the same file.
    if (resolve(db) === targetPath) continue;

    try {
      const src = new EventStore(db);
      for (const e of src.replay() as Iterable<Event>) {
        scanned++;
        if (!TARGET_TYPES.has(e.type)) continue;
        candidates++;
        if (known.has(e.event_id)) {
          skippedExisting++;
          continue;
        }
        try {
          eventStore.append(e);
          known.add(e.event_id);
          appended++;
        } catch (innerErr) {
          errors.push({ db, err: (innerErr as Error).message });
        }
      }
      src.close();
    } catch (e) {
      errors.push({ db, err: (e as Error).message });
    }
  }

  console.log(
    JSON.stringify(
      {
        level: errors.length === 0 ? "info" : "warn",
        component: "backfill-orphaned-dispatch-lifecycle-events",
        msg: `scanned ${scanned} events across ${dbs.length} worktree stores; appended ${appended} new AgentRun* events to shared store`,
        scanned,
        candidates,
        appended,
        skippedExisting,
        worktreeDbsScanned: dbs.length,
        errors,
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  main();
}
