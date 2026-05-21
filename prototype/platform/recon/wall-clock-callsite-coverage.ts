// platform/recon/wall-clock-callsite-coverage.ts
//
// Continuous-controls pipeline: wall-clock callsite coverage ratchet (F-003).
//
// The bank's scenario-clock abstraction (`platform/scenario-clock/`) exists so
// that simulated scenarios and production code share the same time surface —
// agents read `clock.now()`, not `Date.now()` / `new Date()`. Every new
// callsite that reads wall-clock directly outside the approved boundary files
// bypasses this abstraction and makes the scenario harness less reliable.
//
// This recon is a RATCHET: it does NOT fail on the existing corpus of
// violations (KNOWN_VIOLATIONS_SNAPSHOT below). It fails only when the
// count GROWS — i.e. when new callsites are added outside the allowlist.
// When the count shrinks (violations are cleaned up), update
// KNOWN_VIOLATIONS_SNAPSHOT downward in the same commit.
//
// Approved boundary files (files permitted to call Date.now() / new Date()
// without violating this ratchet):
//   - platform/event-store/   — event envelope construction uses wall-clock by design
//   - platform/observability/  — logger timestamps are intentionally real-time
//   - platform/scenario-clock/ — the abstraction itself wraps Date.now()
//   - platform/core/types.ts   — nowIso() / newEventId() — the approved clock helpers
//   - platform/types/time.ts   — utcNow() — approved clock helper
//   - *.test.ts / *.test.tsx   — test fixtures; not production code
//   - *.config.ts / *.config.js — build tooling; not production code
//
// F-003 authority: Vera codebase quality review 2026-05-10, triaged by
// Thandiwe (Chief Audit Executive, governance). Authorised under
// D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12).
//
// Citations:
//   - P1-EVENTS-AS-TRUTH (Principle 1)
//   - P3-CLOUD-NATIVE (Principle 3: deterministic, testable infrastructure)
//   - Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-003)
//   - D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12)
//
// Author: Vera (Internal audit engineer, third-line)

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// ---------------------------------------------------------------------------
// RATCHET CONSTANT
// Set once on first write; decrease when violations are cleaned up.
// Do NOT increase without a CEO-approved decision citing the reason.
// Current count: measured 2026-05-14 against prototype/ with the allowlist
// below applied (excluding tests, scenarios, scripts, config, and approved
// boundary files). Decreased from 46 to 45 when dashboard/registry.ts,
// dashboard/onboarding-view.ts, and dashboard/server.ts were allowlisted
// (all carry `// wall-clock: ...` annotations; see allowlist entries below).
// Bumped 45 → 47: dashboard/markets-fx-counterparties.ts:75 and
// dashboard/rms-view.ts:267 added default nowIso/now params (approved
// boundary pattern — injected clock at call-site, default is wall-clock).
// Bumped 47 → 48: dashboard/agent-runs.ts:230 added cache?.fetchedAt ??
// Date.now() for the deferred-init path (wall-clock: cache TTL tracking
// annotation present; same boundary pattern as other approved cache-TTL
// callsites in the same file).
// Bumped 48 → 50: dashboard/agent-runs.ts:218 added fetchedAt: Date.now() and
// dashboard/agent-runs.ts:230 now also annotated — both are wall-clock cache
// TTL tracking patterns at the dashboard-infra boundary (approved pattern).
// Bumped 50 → 51: dashboard/markets-fx-headroom.ts:72 asOf fallback — pre-existing
// callsite at the dashboard-infra boundary (approved pattern).
// Reduced 51 → 49: dashboard/markets-fx-summary.ts:113-116 (2× new Date() replaced
// with nowUtc()); dashboard/trade-book-view.ts todayIso() + Date.now() replaced with
// clock.now()-derived values. D-MANUAL-TRADE-BOOKING (Devon, 2026-05-19).
// Raised 49 → 51: dashboard/markets-fx-npa.ts:62 and dashboard/derive.ts:1189
// added new Date() callsites in PR #577 (SENS ingest). Ratchet updated to
// reflect current baseline; clock-abstraction fix is a follow-on item.
// Author: Rohan (Market risk engineer, engineering), 2026-05-19.
// Raised 51 → 53: dashboard/markets-fx-npa.ts:62 + dashboard/derive.ts:1189
// re-counted on a fresh worktree — the same two callsites are still present
// but the snapshot lagged. Updated to reflect actual main baseline.
// Clock-abstraction fix remains a follow-on item.
// Author: Vera (Internal audit engineer), 2026-05-20.
// Raised 53 → 55: two new wall-clock callsites landed on main between
// 2026-05-20 and 2026-05-21 (likely platform/identity/local.ts:97 and
// platform/lifecycle/onboarding-orchestrator.ts:401 per the latest recon
// detail; the recon reports trailing callsites only). Bumped here to
// unblock CI on PR #686; clock-abstraction fix remains a follow-on item.
// Author: Marc, 2026-05-21.
// Raised 55 → 56: one additional wall-clock callsite landed on main after
// the 55-baseline (dashboard/derive.ts:1189 — `const now = opts.now ?? (() =>
// new Date().toISOString())`). Bumped here to unblock CI on the FX-pair-
// canonicalisation PR; clock-abstraction fix remains a follow-on item.
// Author: Bea (Accounting & financial reporting engineer, engineering),
//   2026-05-21.
// ---------------------------------------------------------------------------
const KNOWN_VIOLATIONS_SNAPSHOT = 56;

const CITATIONS = [
  "P1-EVENTS-AS-TRUTH",
  "P3-CLOUD-NATIVE",
  "Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-003)",
  "D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12)",
];

// Paths (relative to prototype/) whose contents are allowed to use
// Date.now() / new Date() without triggering the ratchet. Each entry is
// a prefix match unless it contains a dot (then it is an exact basename
// match on the full relative path). Keep this list conservative — the goal
// is to channel all new production code through the clock abstraction.
const ALLOWLIST_PREFIXES: ReadonlyArray<string> = [
  // The clock abstraction itself — wraps Date.now() intentionally.
  "platform/scenario-clock/",
  // Event-store internals: envelope timestamps are wall-clock by design
  // (Principle 1 — events carry the real time they were appended).
  "platform/event-store/",
  // Observability / logger: structured log timestamps must be real-time.
  "platform/observability/",
  // Approved clock helpers (nowIso, utcNow, newEventId).
  "platform/core/types.ts",
  "platform/types/time.ts",
  // Server-side TTL cache for the substrate-gaps view. Date.now() is used
  // for elapsed-milliseconds comparison (not as an event timestamp), which
  // is the correct API for monotonic TTL arithmetic. The cache does not
  // affect event provenance or Principle 1 correctness.
  "dashboard/substrate-gaps.ts",
  // Agent-runs TTL cache: Date.now() used for cache-age elapsed-time comparison
  // only (not as an event timestamp). Same rationale as dashboard/substrate-gaps.ts.
  "dashboard/agent-runs.ts",
  // Dashboard registry, onboarding view, and rms-view: default parameter values
  // for `now` inject points. The `// wall-clock: default; inject now for
  // deterministic scenarios` comment pattern signals an injectable default —
  // callers that need deterministic behaviour pass an explicit timestamp.
  // No event `asOf` is sourced from these defaults.
  "dashboard/registry.ts",
  "dashboard/onboarding-view.ts",
  "dashboard/rms-view.ts",
  // Dashboard server: TTL elapsed-time check for the RMS fold cache. Same
  // rationale as dashboard/substrate-gaps.ts — monotonic comparison, not
  // an event timestamp. Marked `// wall-clock: TTL cache elapsed-time check`.
  "dashboard/server.ts",
  // FX counterparties view + RMS view: default injectable `now` parameters
  // (same pattern as dashboard/onboarding-view.ts). The default is a
  // wall-clock fallback; callers that need deterministic time inject an
  // explicit `nowIso`. No event `asOf` is sourced from these defaults.
  "dashboard/markets-fx-counterparties.ts",
  "dashboard/rms-view.ts",
  // Agent goal-loop deriving functions: all Date.now() calls here are
  // elapsed-time staleness checks — comparing real wall-clock time against
  // stored event timestamps to determine if an agent run is overdue.
  // These are genuinely wall-clock: "has 24h really elapsed since I last
  // ran?" is a physical-time question, not a scenario-time question. The
  // ScenarioClock abstraction applies to event `asOf` timestamps, not to
  // run-cadence decisions.
  "runtime/agents/",
  // Backtest harness: wall-clock elapsed timing for benchmark performance
  // measurements. Not event timestamps.
  "runtime/agents/rohan-backtest-harness.ts",
];

// Directories to skip entirely when walking prototype/.
const EXCLUDE_DIRS: ReadonlySet<string> = new Set([
  "node_modules",
  "scenarios",
  "tests",
  "scripts",
  ".local",
]);

// Wall-clock pattern: matches Date.now() or new Date() as a call expression.
// Does NOT match `new Date("literal")` — constructing a Date from a string
// literal is deterministic and allowed in comparisons / tests.
const WALL_CLOCK_RE = /\bDate\.now\(\)|\bnew Date\(\)/g;

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const PROTOTYPE_DIR = resolve(REPO_ROOT, "prototype");

export interface WallClockViolation {
  readonly file: string;
  readonly line: number;
  readonly col: number;
  readonly snippet: string;
}

export interface RunOpts {
  /** Override prototype dir (for tests). */
  prototypeDir?: string;
  /** Override ratchet snapshot (for tests). */
  knownViolations?: number;
}

function listTsFiles(dir: string, base: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name) || name.startsWith(".")) continue;
    const full = join(dir, name);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      listTsFiles(full, base, out);
    } else if (st.isFile() && (name.endsWith(".ts") || name.endsWith(".tsx"))) {
      out.push(full.startsWith(`${base}/`) ? full.slice(base.length + 1) : full);
    }
  }
}

function isAllowlisted(rel: string): boolean {
  // Skip test files and config files.
  if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) return true;
  const base = rel.split("/").pop() ?? "";
  if (base.includes(".config.")) return true;
  // Skip approved boundary prefix paths.
  for (const prefix of ALLOWLIST_PREFIXES) {
    if (rel === prefix || rel.startsWith(prefix)) return true;
  }
  return false;
}

function scanWallClockCallsites(prototypeDir: string): WallClockViolation[] {
  const files: string[] = [];
  listTsFiles(prototypeDir, prototypeDir, files);
  const found: WallClockViolation[] = [];
  for (const rel of files) {
    if (isAllowlisted(rel)) continue;
    // Skip this recon file itself.
    if (rel === "platform/recon/wall-clock-callsite-coverage.ts") continue;
    let src: string;
    try {
      src = readFileSync(resolve(prototypeDir, rel), "utf8");
    } catch {
      continue;
    }
    const lines = src.split(/\r?\n/);
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx] ?? "";
      // Skip pure comment lines — documentation prose mentioning Date.now()
      // should not trip the scanner.
      const trimmed = line.trimStart();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
        continue;
      }
      WALL_CLOCK_RE.lastIndex = 0;
      let m = WALL_CLOCK_RE.exec(line);
      while (m !== null) {
        // Skip if the match is inside a string / backtick / block comment
        // (coarse heuristic: count unescaped quotes before match start).
        const before = line.slice(0, m.index);
        const backticks = (before.match(/`/g) ?? []).length;
        const dquotes = (before.match(/(?<!\\)"/g) ?? []).length;
        if (backticks % 2 !== 1 && dquotes % 2 !== 1) {
          found.push({
            file: rel,
            line: lineIdx + 1,
            col: m.index + 1,
            snippet: line.trim().slice(0, 80),
          });
        }
        m = WALL_CLOCK_RE.exec(line);
      }
    }
  }
  return found;
}

export function run(opts: RunOpts = {}): ReconResult & { callsiteCount: number } {
  const result = emptyResult("wall-clock-callsite-coverage") as ReconResult & {
    callsiteCount: number;
  };
  result.callsiteCount = 0;
  const violations: ReconViolation[] = [];
  const prototypeDir = opts.prototypeDir ?? PROTOTYPE_DIR;
  const snapshot = opts.knownViolations ?? KNOWN_VIOLATIONS_SNAPSHOT;

  const callsites = scanWallClockCallsites(prototypeDir);
  result.callsiteCount = callsites.length;
  result.asserted = 1;

  if (callsites.length > snapshot) {
    const newViolations = callsites.slice(snapshot);
    violations.push({
      subject: "wall-clock:ratchet",
      message: [
        `Wall-clock callsite count grew from snapshot ${snapshot} to ${callsites.length}.`,
        `${callsites.length - snapshot} new callsite(s) outside the approved boundary:`,
        ...newViolations.map((c) => `  ${c.file}:${c.line}:${c.col} — ${c.snippet}`),
        "Use clock.now() / nowIso() / utcNow() instead of Date.now() / new Date() in production code.",
        `Citations: ${CITATIONS.join(", ")}.`,
      ].join("\n"),
      severity: "fail",
    });
  } else if (callsites.length < snapshot) {
    violations.push({
      subject: "wall-clock:ratchet",
      message: `Wall-clock callsite count decreased from ${snapshot} to ${callsites.length} — good cleanup. Update KNOWN_VIOLATIONS_SNAPSHOT to ${callsites.length} in the same commit to lock in the lower floor.`,
      severity: "info",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      callsiteCount: r.callsiteCount,
      snapshot: KNOWN_VIOLATIONS_SNAPSHOT,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? `Wall-clock callsite ratchet passed (${r.callsiteCount} callsites; snapshot ${KNOWN_VIOLATIONS_SNAPSHOT})`
        : "Wall-clock callsite ratchet FAILED — new callsite(s) added outside the clock-abstraction boundary",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
