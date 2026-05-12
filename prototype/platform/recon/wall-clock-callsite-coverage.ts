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
// Current count: measured 2026-05-12 against prototype/ with the allowlist
// below applied (excluding tests, scenarios, scripts, config, and approved
// boundary files).
// ---------------------------------------------------------------------------
const KNOWN_VIOLATIONS_SNAPSHOT = 197;

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
      out.push(full.startsWith(base + "/") ? full.slice(base.length + 1) : full);
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
    let charOffset = 0;
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx] ?? "";
      // Skip pure comment lines — documentation prose mentioning Date.now()
      // should not trip the scanner.
      const trimmed = line.trimStart();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
        charOffset += line.length + 1;
        continue;
      }
      WALL_CLOCK_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = WALL_CLOCK_RE.exec(line)) !== null) {
        // Skip if the match is inside a string / backtick / block comment
        // (coarse heuristic: count unescaped quotes before match start).
        const before = line.slice(0, m.index);
        const backticks = (before.match(/`/g) ?? []).length;
        const dquotes = (before.match(/(?<!\\)"/g) ?? []).length;
        if (backticks % 2 === 1 || dquotes % 2 === 1) continue;
        found.push({
          file: rel,
          line: lineIdx + 1,
          col: m.index + 1,
          snippet: line.trim().slice(0, 80),
        });
      }
      charOffset += line.length + 1;
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
        `Use clock.now() / nowIso() / utcNow() instead of Date.now() / new Date() in production code.`,
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
        : `Wall-clock callsite ratchet FAILED — new callsite(s) added outside the clock-abstraction boundary`,
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
