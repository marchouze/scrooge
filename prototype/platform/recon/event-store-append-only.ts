// platform/recon/event-store-append-only.ts
//
// Continuous-controls pipeline: assert the SQLite event store is
// append-only. Direct SQL `DELETE` against the `events` table violates
// Principle 1 (events are the only source of truth) — the event log is
// the canonical durable artefact and must accumulate monotonically.
//
// Seed case: during the 2026-05-21 MTM bug-fix arc a SQL-DELETE against
// the live event store was observed in-session and queued as a Vera
// finding (project_continuation_2026_05_21_mtm_gl_bugfix). Without a
// typed gate the next operator can repeat the violation under time
// pressure; the append-only contract is enforced only by convention.
// This pipeline promotes the contract to a typed assertion.
//
// Approach. SQLite's audit surface is narrow — there is no native row
// tombstone and `sqlite_sequence` survives a DELETE — so we lean on a
// three-signal triangulation against a persisted baseline:
//
//   (A) row-count regression
//       The number of rows in `events` is monotonic non-decreasing.
//       A decrease relative to the last-known baseline is a direct
//       DELETE signature.
//
//   (B) max-sequence regression
//       `MAX(sequence)` is monotonic non-decreasing. AUTOINCREMENT
//       advances on every successful append; only physical removal of
//       the highest-sequence row (or a vacuum / rebuild) can lower it.
//
//   (C) interior-gap regression
//       Define `interiorGap = (MAX(sequence) - MIN(sequence) + 1) -
//       COUNT(*)`. Legitimate merge-from-cloud (postgres-sync) can
//       *increase* this number — pulled rows carry their birth-store
//       sequence allocations — so growth is not a violation. A
//       *decrease* in `interiorGap` accompanied by no count growth is
//       structurally impossible without mutation; flagged.
//
// The baseline is persisted at
//
//   $BANK_RECON_BASELINE_DIR/event-store-append-only.json  (default
//   `<repo>/.local/recon/event-store-append-only.json`).
//
// On first run the baseline is initialised from current observations
// and the pipeline returns `ok=true` with `asserted=1` (the seed).
// Subsequent runs compare current observations against the baseline;
// any of (A) / (B) / (C) trips a `fail` violation. Provided the run
// passes, the baseline ratchets forward (count + max-sequence increase;
// interior-gap stays at the largest legitimate value observed).
//
// The pipeline operates on whichever store `BANK_EVENT_DB` resolves to
// per D-CROSS-WORKTREE-EVENT-STORE-SYNC — the default is the shared
// home-store at `$HOME/.local/share/bank/event.db`, and tests / fresh
// CI runners override via env. No hardcoded path.
//
// Citations:
//   - Principle 1 — events are the only source of truth.
//   - D-CROSS-WORKTREE-EVENT-STORE-SYNC (CEO session-delegation
//     2026-05-21).
//   - Brief: brief:vera:event-store-append-only-typed-recon-rule-sql-del:2026-05-21.
//
// Author: Vera (Internal audit engineer, third line)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Database } from "bun:sqlite";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "event-store-append-only";

// ---------------------------------------------------------------------------
// Observation + baseline shapes
// ---------------------------------------------------------------------------

/**
 * Snapshot of the event-store invariants at one point in time.
 *
 * `interiorGap` is `(maxSequence - minSequence + 1) - rowCount`. It can
 * be > 0 legitimately (cloud-merge brings rows whose birth-store
 * sequence allocation produced gaps); we only flag a *decrease*, since
 * a decrease at constant or shrinking rowCount is structurally
 * impossible without mutation.
 */
export interface EventStoreObservation {
  readonly rowCount: number;
  readonly maxSequence: number;
  readonly minSequence: number;
  readonly interiorGap: number;
  readonly observedAt: string;
}

/**
 * Persisted baseline. The pipeline ratchets each field forward on
 * successful runs (row count and max-sequence monotonic upward;
 * interior gap retains the maximum legitimate value seen).
 */
export interface EventStoreBaseline {
  readonly rowCount: number;
  readonly maxSequence: number;
  readonly minSequence: number;
  readonly interiorGap: number;
  readonly baselineAt: string;
  readonly updatedAt: string;
}

export interface EventStoreAppendOnlyOpts {
  /** Override the live event-store DB path. */
  readonly eventDbPath?: string;
  /** Override the baseline JSON path. */
  readonly baselinePath?: string;
  /** Inject an observation directly (used by tests for the in-memory path). */
  readonly observation?: EventStoreObservation;
  /** Inject a baseline directly (used by tests for the in-memory path). */
  readonly baseline?: EventStoreBaseline | null;
  /** Inhibit baseline write-back (tests). Default: true (write baseline). */
  readonly persistBaseline?: boolean;
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

function resolveEventDbPath(): string {
  if (process.env.BANK_EVENT_DB) return process.env.BANK_EVENT_DB;
  if (process.env.BANK_HOME_EVENT_DB) return process.env.BANK_HOME_EVENT_DB;
  const home = process.env.HOME;
  if (home) return resolve(home, ".local", "share", "bank", "event.db");
  return resolve(".local", "event.db");
}

function resolveBaselinePath(): string {
  const dir = process.env.BANK_RECON_BASELINE_DIR ?? resolve(process.cwd(), ".local", "recon");
  return resolve(dir, `${PIPELINE}.json`);
}

// ---------------------------------------------------------------------------
// Live observation
// ---------------------------------------------------------------------------

/**
 * Inspect the live SQLite event store and produce an
 * `EventStoreObservation`. Returns null when the DB file is missing
 * (fresh CI runner before first append); callers treat that case as
 * "no events yet, nothing to assert".
 */
export function observeEventStore(dbPath: string): EventStoreObservation | null {
  if (!existsSync(dbPath)) return null;
  const db = new Database(dbPath, { readonly: true });
  try {
    // Defensive: schema may not exist on a freshly-created file.
    const tableRow = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='events'")
      .get();
    if (!tableRow) return null;
    const row = db
      .prepare(
        "SELECT COUNT(*) AS rowCount, COALESCE(MIN(sequence), 0) AS minSeq, COALESCE(MAX(sequence), 0) AS maxSeq FROM events",
      )
      .get() as { rowCount: number; minSeq: number; maxSeq: number };
    const rowCount = Number(row.rowCount ?? 0);
    const minSequence = Number(row.minSeq ?? 0);
    const maxSequence = Number(row.maxSeq ?? 0);
    const interiorGap = rowCount === 0 ? 0 : Math.max(0, maxSequence - minSequence + 1 - rowCount);
    return {
      rowCount,
      maxSequence,
      minSequence,
      interiorGap,
      observedAt: new Date().toISOString(),
    };
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Baseline I/O
// ---------------------------------------------------------------------------

export function loadBaselineFromDisk(path: string): EventStoreBaseline | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<EventStoreBaseline>;
    if (
      typeof parsed.rowCount !== "number" ||
      typeof parsed.maxSequence !== "number" ||
      typeof parsed.minSequence !== "number" ||
      typeof parsed.interiorGap !== "number" ||
      typeof parsed.baselineAt !== "string" ||
      typeof parsed.updatedAt !== "string"
    ) {
      return null;
    }
    return {
      rowCount: parsed.rowCount,
      maxSequence: parsed.maxSequence,
      minSequence: parsed.minSequence,
      interiorGap: parsed.interiorGap,
      baselineAt: parsed.baselineAt,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function writeBaselineToDisk(path: string, baseline: EventStoreBaseline): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
}

// ---------------------------------------------------------------------------
// Comparison + ratchet
// ---------------------------------------------------------------------------

/**
 * Pure comparison: produce the set of violations for `observation`
 * against `baseline`. Returns `[]` if no baseline (first run is
 * informational, no violation).
 */
export function compareToBaseline(
  observation: EventStoreObservation,
  baseline: EventStoreBaseline | null,
): ReconViolation[] {
  if (!baseline) return [];
  const v: ReconViolation[] = [];
  if (observation.rowCount < baseline.rowCount) {
    v.push({
      subject: "events:rowCount",
      message: `Row count regressed from ${baseline.rowCount} to ${observation.rowCount} (delta ${observation.rowCount - baseline.rowCount}). Direct SQL DELETE against the events table is the canonical cause; the event log must be append-only per Principle 1. Baseline recorded ${baseline.updatedAt}; current observation ${observation.observedAt}.`,
      severity: "fail",
    });
  }
  if (observation.maxSequence < baseline.maxSequence) {
    v.push({
      subject: "events:maxSequence",
      message: `MAX(sequence) regressed from ${baseline.maxSequence} to ${observation.maxSequence}. AUTOINCREMENT only advances; physical removal of the highest-sequence row, a VACUUM, or a store rebuild is the only explanation. Baseline recorded ${baseline.updatedAt}; current observation ${observation.observedAt}.`,
      severity: "fail",
    });
  }
  // Interior-gap *decrease* with no count growth is impossible without
  // mutation. We allow growth (cloud-merge legitimately introduces
  // birth-store sequence holes) but flag shrinkage at constant or
  // shrinking rowCount.
  if (observation.interiorGap < baseline.interiorGap && observation.rowCount <= baseline.rowCount) {
    v.push({
      subject: "events:interiorGap",
      message: `Interior sequence gap shrank from ${baseline.interiorGap} to ${observation.interiorGap} while row count did not grow (was ${baseline.rowCount}, now ${observation.rowCount}). Cloud-merge can only widen the gap; a narrowing gap at flat rowCount indicates physical row replacement or sequence rewrite — both forbidden. Baseline recorded ${baseline.updatedAt}; current observation ${observation.observedAt}.`,
      severity: "fail",
    });
  }
  return v;
}

/**
 * Ratchet a baseline forward given a clean observation. Returns the
 * new baseline. `rowCount`, `maxSequence`, and `interiorGap` move to
 * the larger of (baseline, observation); `minSequence` to the smaller
 * (oldest event preserved); timestamps refresh.
 */
export function ratchetBaseline(
  observation: EventStoreObservation,
  baseline: EventStoreBaseline | null,
): EventStoreBaseline {
  if (!baseline) {
    return {
      rowCount: observation.rowCount,
      maxSequence: observation.maxSequence,
      minSequence: observation.minSequence,
      interiorGap: observation.interiorGap,
      baselineAt: observation.observedAt,
      updatedAt: observation.observedAt,
    };
  }
  return {
    rowCount: Math.max(baseline.rowCount, observation.rowCount),
    maxSequence: Math.max(baseline.maxSequence, observation.maxSequence),
    minSequence:
      observation.minSequence > 0
        ? Math.min(
            baseline.minSequence > 0 ? baseline.minSequence : observation.minSequence,
            observation.minSequence,
          )
        : baseline.minSequence,
    interiorGap: Math.max(baseline.interiorGap, observation.interiorGap),
    baselineAt: baseline.baselineAt,
    updatedAt: observation.observedAt,
  };
}

// ---------------------------------------------------------------------------
// Public run() — pipeline entry point
// ---------------------------------------------------------------------------

export interface EventStoreAppendOnlyResult extends ReconResult {
  readonly observation: EventStoreObservation | null;
  readonly baselineBefore: EventStoreBaseline | null;
  readonly baselineAfter: EventStoreBaseline | null;
  readonly eventDbPath: string;
  readonly baselinePath: string;
}

export function runEventStoreAppendOnlyRecon(
  opts: EventStoreAppendOnlyOpts = {},
): EventStoreAppendOnlyResult {
  const eventDbPath = opts.eventDbPath ?? resolveEventDbPath();
  const baselinePath = opts.baselinePath ?? resolveBaselinePath();
  const base = emptyResult(PIPELINE);

  // Resolve observation (injected or live).
  let observation: EventStoreObservation | null;
  if (opts.observation !== undefined) {
    observation = opts.observation;
  } else {
    observation = observeEventStore(eventDbPath);
  }

  // Resolve baseline (injected or from disk; null = first-run).
  let baselineBefore: EventStoreBaseline | null;
  if (opts.baseline !== undefined) {
    baselineBefore = opts.baseline;
  } else {
    baselineBefore = loadBaselineFromDisk(baselinePath);
  }

  // Nothing to do if the DB doesn't exist yet.
  if (!observation) {
    return {
      ...base,
      asserted: 0,
      violations: [],
      ok: true,
      observation: null,
      baselineBefore,
      baselineAfter: baselineBefore,
      eventDbPath,
      baselinePath,
    };
  }

  const violations = compareToBaseline(observation, baselineBefore);
  const ok = violations.every((v) => v.severity !== "fail");

  // Ratchet only on clean runs. A failed run leaves the baseline
  // untouched so the next run still sees the regression — operators
  // must investigate before the baseline moves forward.
  const baselineAfter = ok ? ratchetBaseline(observation, baselineBefore) : baselineBefore;
  const persist = opts.persistBaseline ?? true;
  if (ok && persist && opts.baseline === undefined && opts.observation === undefined) {
    writeBaselineToDisk(baselinePath, baselineAfter as EventStoreBaseline);
  }

  return {
    ...base,
    asserted: 3, // rowCount, maxSequence, interiorGap — the three invariants
    violations,
    ok,
    observation,
    baselineBefore,
    baselineAfter,
    eventDbPath,
    baselinePath,
  };
}

// Convenience export: the same name pattern the brief specifies.
export const run = runEventStoreAppendOnlyRecon;

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = runEventStoreAppendOnlyRecon();
  const failCount = r.violations.filter((v) => v.severity === "fail").length;
  if (failCount === 0) {
    console.log(
      JSON.stringify({
        level: "info",
        time: r.asOf,
        service: "bank-prototype",
        pipeline: r.pipeline,
        ok: r.ok,
        eventDbPath: r.eventDbPath,
        baselinePath: r.baselinePath,
        rowCount: r.observation?.rowCount ?? 0,
        maxSequence: r.observation?.maxSequence ?? 0,
        interiorGap: r.observation?.interiorGap ?? 0,
        firstRun: r.baselineBefore === null,
        msg: r.observation
          ? r.baselineBefore === null
            ? "event-store-append-only: baseline initialised; future runs will assert against this snapshot"
            : "event-store-append-only: invariants hold (row count + max-sequence + interior-gap all consistent with append-only)"
          : "event-store-append-only: no event store found at the resolved path; skipping",
      }),
    );
  } else {
    console.log(
      JSON.stringify({
        level: "error",
        time: r.asOf,
        service: "bank-prototype",
        pipeline: r.pipeline,
        ok: r.ok,
        eventDbPath: r.eventDbPath,
        baselinePath: r.baselinePath,
        failures: failCount,
        rowCount: r.observation?.rowCount,
        baselineRowCount: r.baselineBefore?.rowCount,
        maxSequence: r.observation?.maxSequence,
        baselineMaxSequence: r.baselineBefore?.maxSequence,
        msg: "event-store-append-only FAILED — append-only invariant breached; the events table has been mutated (DELETE / VACUUM / rebuild). Investigate immediately per Principle 1.",
      }),
    );
    for (const v of r.violations) {
      console.error(`  [${v.severity.toUpperCase()}] ${v.subject}: ${v.message}`);
    }
  }
  if (!r.ok) process.exit(1);
}
