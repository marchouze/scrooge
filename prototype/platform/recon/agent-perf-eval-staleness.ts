// platform/recon/agent-perf-eval-staleness.ts
//
// Advisory recon: warns when no AgentPerformanceEvaluated events exist in
// the main event store within a configurable window (default 7 days).
//
// Root cause: Sade's perf-eval runs are dispatched in isolated worktrees.
// Events emitted there land in the worktree's .local/event.db, not in the
// main worktree store. The dashboard reads the main store and therefore
// shows no performance data until someone re-runs Sade from main.
//
// This is a known substrate gap (M8 — worktree event-store isolation).
// Until M8 lands, this recon surfaces the gap as a named, visible warning
// rather than leaving it silent.
//
// Mode: advisory-only. Never flips ok=false in CI. The check passes even
// when stale so it doesn't block commits; the finding is informational.
//
// Citations: P1-EVENTS-AS-TRUTH (Principle 1), M8-SUBSTRATE-GAP.
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "agent-perf-eval-staleness";
const DEFAULT_WINDOW_DAYS = 7;

// ---------------------------------------------------------------------------
// Repo-root resolver
// ---------------------------------------------------------------------------

function resolveRepoRoot(): string {
  return resolve(import.meta.dir, "../../../../");
}

function resolveDbPath(repoRoot: string): string {
  return join(repoRoot, "prototype", ".local", "event.db");
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RunOpts {
  /** Override the event store path (tests / CI). */
  readonly dbPath?: string;
  /** Window in days to look back for events (default: 7). */
  readonly windowDays?: number;
  /** Inject events directly (skip reading the DB). For tests. */
  readonly events?: ReadonlyArray<{ as_of: string }>;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - windowMs).toISOString();

  let latestEventAt: string | null = null;

  if (opts.events) {
    // Test-injected events.
    for (const e of opts.events) {
      if (!latestEventAt || e.as_of > latestEventAt) latestEventAt = e.as_of;
    }
  } else {
    const dbPath = opts.dbPath ?? resolveDbPath(resolveRepoRoot());
    if (!existsSync(dbPath)) {
      violations.push({
        subject: "agent-perf-eval-staleness",
        message: `No event store found at \`${dbPath}\`. Cannot check for AgentPerformanceEvaluated events. This is expected on a fresh worktree — start the dashboard server once to initialise the store.`,
        severity: "info",
      });
      result.asserted = 0;
      result.violations = violations;
      result.ok = true;
      return result;
    }

    // Dynamic require to avoid opening the DB at module load time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("../event-store/store") as {
      EventStore: new (
        path: string,
      ) => {
        replay: (filter?: { type?: string }) => Iterable<{ as_of?: string }>;
        close: () => void;
      };
    };
    const store = new mod.EventStore(dbPath);
    try {
      for (const e of store.replay({ type: "AgentPerformanceEvaluated" })) {
        const t = e.as_of ?? "";
        if (!latestEventAt || t > latestEventAt) latestEventAt = t;
      }
    } catch {
      // Unreadable store — treat as empty.
    } finally {
      try {
        store.close();
      } catch {
        // best-effort
      }
    }
  }

  result.asserted = 1;

  if (!latestEventAt) {
    violations.push({
      subject: "AgentPerformanceEvaluated:last-seen",
      message:
        "No AgentPerformanceEvaluated events found in the main event store. " +
        "Substrate gap M8: Sade perf-eval events are emitted into the dispatched " +
        "worktree's event store, not the main store. Re-run Sade from the main " +
        "worktree after each dispatch to populate the main store. " +
        "Citations: P1-EVENTS-AS-TRUTH, M8-SUBSTRATE-GAP.",
      severity: "warn",
    });
  } else if (latestEventAt < cutoff) {
    violations.push({
      subject: "AgentPerformanceEvaluated:last-seen",
      message: `Last AgentPerformanceEvaluated event is at ${latestEventAt}, which is older than the ${windowDays}-day window (cutoff: ${cutoff}). Substrate gap M8: re-run Sade from the main worktree to refresh agent performance data. Citations: P1-EVENTS-AS-TRUTH, M8-SUBSTRATE-GAP.`,
      severity: "warn",
    });
  }

  result.violations = violations;
  // Advisory-only: never flip ok=false. Stale perf data is a gap, not a
  // CI-blocking failure. Enforcing mode is not supported for this check.
  result.ok = true;
  return result;
}

if (import.meta.main) {
  const r = run();
  const warns = r.violations.filter((v) => v.severity === "warn").length;
  const infos = r.violations.filter((v) => v.severity === "info").length;
  console.log(
    JSON.stringify({
      level: warns > 0 ? "warn" : "info",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      warns,
      infos,
      ok: r.ok,
      mode: "advisory",
      msg:
        warns > 0
          ? `agent-perf-eval-staleness: ${warns} warning(s) — M8 substrate gap, re-run Sade from main worktree`
          : "agent-perf-eval-staleness: AgentPerformanceEvaluated events are current",
      detail: r.violations,
    }),
  );
  process.exit(0); // always exit 0 — advisory only
}
