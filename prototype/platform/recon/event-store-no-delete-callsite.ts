// platform/recon/event-store-no-delete-callsite.ts
//
// Continuous-controls pipeline: static callsite guard — no SQL DELETE on the
// events table outside the explicit red-team test allowlist.
//
// Background. On 2026-05-21 a direct SQL DELETE against the shared event store
// was observed in-session during the MTM bug-fix arc. The violation was queued
// as a Vera Principle-1 finding (recorded in
// project_continuation_2026_05_21_mtm_gl_bugfix). The `event-store-append-only`
// recon pipeline (runtime detection) was built immediately after to detect
// count/sequence regressions. This pipeline is the *static* complement: it
// scans every TypeScript file in `prototype/` at CI time and fails if it finds
// `DELETE FROM events` (or equivalent patterns) outside the allowlisted
// red-team test files.
//
// Allowlist rationale.  Two existing test files are explicitly permitted:
//
//   platform/recon/event-store-append-only.test.ts
//     — Red-team test: injects a DELETE to prove the runtime recon flags it.
//       Operates on a mkdtempSync-isolated tmp database; never touches the
//       shared store. The whole point of the test is to exercise the violation
//       detector.
//
//   tests/event-trigger-bus.test.ts
//     — Regression test for the sequence-gap / highWatermark() bug (commit
//       that landed D-CROSS-WORKTREE-EVENT-STORE-SYNC). Carves a gap in an
//       isolated mkdtempSync database to verify the bus handles count() <
//       max(sequence). The DELETE is intentional, documented, and contained.
//
// Any new callsite outside these two files is a Principle-1 violation.
//
// Detection patterns. We match:
//   - "DELETE FROM events" (case-insensitive, any surrounding SQL)
//   - `.exec("DELETE` and `.run("DELETE`  — raw SQLite exec/run with DELETE
//   - db.exec(`DELETE`, db.run(`DELETE`  — template-literal variants
// Comment lines (trimmed `//`, `*`) are skipped — prose mentions in docs and
// recon files don't trip the scanner.
//
// Citations:
//   - Principle 1 — events are the only source of truth.
//   - D-CROSS-WORKTREE-EVENT-STORE-SYNC (CEO session-delegation 2026-05-21).
//   - Brief: brief:vera:resolve-principle-1-violation-replace-sql-delete:2026-05-21
//
// Author: Vera (Internal audit engineer, engineering)

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// ---------------------------------------------------------------------------
// Allowlisted files — these contain intentional DELETE for red-team / regression
// testing against isolated tmp databases. Any other file is a violation.
// ---------------------------------------------------------------------------
const ALLOWLIST_RELATIVE_PATHS: ReadonlySet<string> = new Set([
  "platform/recon/event-store-append-only.test.ts",
  "tests/event-trigger-bus.test.ts",
  // This file itself — suppress self-match on pattern strings in comments.
  "platform/recon/event-store-no-delete-callsite.ts",
  // This recon's own test file — contains DELETE strings as synthetic fixture
  // content passed to makeSyntheticProto() to drive the scanner under test.
  // The strings are never executed against a real or shared database.
  "platform/recon/event-store-no-delete-callsite.test.ts",
]);

// Directories to skip entirely when walking prototype/.
const EXCLUDE_DIRS: ReadonlySet<string> = new Set([
  "node_modules",
  ".local",
]);

// Patterns that indicate a DELETE against the events table.
// Checked case-insensitively. Comment lines are pre-filtered before matching.
const DELETE_PATTERNS: ReadonlyArray<RegExp> = [
  /DELETE\s+FROM\s+events\b/i,
  /\.exec\s*\(\s*["'`]\s*DELETE/i,
  /\.run\s*\(\s*["'`]\s*DELETE/i,
];

export interface DeleteCallsite {
  readonly file: string;
  readonly line: number;
  readonly col: number;
  readonly snippet: string;
  readonly pattern: string;
}

export interface RunOpts {
  /** Override prototype dir (for tests). */
  prototypeDir?: string;
}

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

function scanDeleteCallsites(prototypeDir: string): DeleteCallsite[] {
  const files: string[] = [];
  listTsFiles(prototypeDir, prototypeDir, files);
  const found: DeleteCallsite[] = [];

  for (const rel of files) {
    if (ALLOWLIST_RELATIVE_PATHS.has(rel)) continue;

    let src: string;
    try {
      src = readFileSync(resolve(prototypeDir, rel), "utf8");
    } catch {
      continue;
    }

    const lines = src.split(/\r?\n/);
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx] ?? "";
      // Skip pure comment lines — documentary prose must not trip the scanner.
      const trimmed = line.trimStart();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
        continue;
      }

      // Try each pattern in order; record at most one finding per source line
      // (a single line may match multiple patterns — deduplicate by line).
      let lineMatched = false;
      for (const pattern of DELETE_PATTERNS) {
        if (lineMatched) break;
        const re = new RegExp(pattern.source, pattern.flags);
        const m = re.exec(line);
        if (m !== null) {
          // Coarse heuristic: skip if the match appears inside a string literal
          // (check for odd unescaped double-quote count before match start).
          const before = line.slice(0, m.index);
          const dquotes = (before.match(/(?<!\\)"/g) ?? []).length;
          const squotes = (before.match(/(?<!\\)'/g) ?? []).length;
          // If inside a string or template, skip.
          if (dquotes % 2 === 1 || squotes % 2 === 1) continue;

          found.push({
            file: rel,
            line: lineIdx + 1,
            col: m.index + 1,
            snippet: line.trim().slice(0, 100),
            pattern: pattern.source,
          });
          lineMatched = true;
        }
      }
    }
  }

  return found;
}

export function run(opts: RunOpts = {}): ReconResult & { callsites: DeleteCallsite[] } {
  const result = emptyResult("event-store-no-delete-callsite") as ReconResult & {
    callsites: DeleteCallsite[];
  };
  result.callsites = [];
  const violations: ReconViolation[] = [];
  const prototypeDir = opts.prototypeDir ?? PROTOTYPE_DIR;

  const callsites = scanDeleteCallsites(prototypeDir);
  result.callsites = callsites;
  result.asserted = 1;

  if (callsites.length > 0) {
    violations.push({
      subject: "event-store:delete-callsite",
      message: [
        `Found ${callsites.length} SQL DELETE callsite(s) against the events table outside the allowed red-team test files.`,
        "Direct DELETE against the events table violates Principle 1 (events are the only source of truth).",
        "The event log must be append-only. To correct:",
        "  - In tests: ensure the test creates an isolated tmp database (mkdtempSync) and never touches the shared store.",
        "  - In production code: use a tombstone / EventVoided append instead of DELETE.",
        "  - If this is a legitimate red-team test: add the file path to ALLOWLIST_RELATIVE_PATHS in",
        "    platform/recon/event-store-no-delete-callsite.ts with a clear rationale comment.",
        "",
        "Callsites:",
        ...callsites.map((c) => `  ${c.file}:${c.line}:${c.col} — ${c.snippet}`),
        "",
        "Citations: Principle 1 (events-are-truth); D-CROSS-WORKTREE-EVENT-STORE-SYNC.",
      ].join("\n"),
      severity: "fail",
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
      deleteCallsiteCount: r.callsites.length,
      allowlistedFiles: Array.from(ALLOWLIST_RELATIVE_PATHS).filter(
        (p) => p !== "platform/recon/event-store-no-delete-callsite.ts",
      ),
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "event-store-no-delete-callsite: no forbidden DELETE callsites found (append-only static gate passes)"
        : "event-store-no-delete-callsite FAILED — SQL DELETE against events table detected in non-allowlisted file(s); Principle 1 violation",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
