// platform/recon/no-float-money-arithmetic.ts
//
// Continuous-controls gate: no-float-money-arithmetic
// (D-DECIMAL-NATIVE-MONEY-ARITHMETIC, step 4).
//
// ## What it asserts
//
// No new multiplication (`*`), division (`/`), or `Math.round(...)` operations
// appear on money-flavoured values (identifiers containing `Minor`, `minor`,
// `Money`, `money`, `Amount`, or `amount`) outside the decimal-engine module.
//
// These operations on IEEE-754 floats introduce silent rounding errors in
// financial calculations — the exact hazard the decimal-native money stack
// eliminates. Every occurrence in scope should migrate to the decimal engine
// (`platform/core/decimal-engine.ts`, `platform/core/decimal-money.ts`).
//
// ## Detection strategy (regex scan)
//
// The gate uses two regexes:
//   1. `Math.round(...)` where the argument contains a money-flavoured name.
//   2. A money-flavoured identifier followed immediately by `*` or `/`.
//
// Non-code lines (comments) are excluded from pattern 2 to avoid matching
// JSDoc examples.
//
// Findings are keyed `file:line` (relative to prototype/). A JSON allowlist
// (`scripts/recon/no-float-money-arithmetic-allowlist.json`) records the
// existing debt. Any finding whose key is NOT in the allowlist causes an
// exit-1 (blocking new violations). Allowlisted findings are advisory.
//
// ## Excluded paths
//
// - `platform/core/decimal-engine.ts` — the canonical implementation
// - `platform/core/decimal-money.ts` — the canonical implementation
// - `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx` — test files
//
// ## --enforce-touched flag (dormant)
//
// When `--enforce-touched` is passed, any allowlisted violation whose file
// has been modified since the last merge to main (detected via
// `git diff --name-only origin/main...HEAD`) also causes exit-1. This is
// left dormant — it will be activated per-file as each engine migrates.
//
// ## Allowlist generation
//
// Run with `--generate-allowlist` to write (or overwrite)
// `scripts/recon/no-float-money-arithmetic-allowlist.json` from the current
// violation set. This is used once on initial roll-out; subsequent runs
// compare against the committed allowlist.
//
// Authority: D-DECIMAL-NATIVE-MONEY-ARITHMETIC (CEO-approved 2026-06-14).
// Workstream: WS-DECIMAL-NATIVE-MONEY-ARITHMETIC.
// Citations:
//   - Principle 1 — events are the only source of truth
//   - Principle 5 — multi-currency, multi-entity, multi-country from day one
//   - D-DECIMAL-NATIVE-MONEY-ARITHMETIC
//
// Author: Atlas (Core banking platform architect, engineering).

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

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
const ALLOWLIST_PATH = resolve(
  PROTOTYPE_DIR,
  "scripts/recon/no-float-money-arithmetic-allowlist.json",
);

// ---------------------------------------------------------------------------
// Excluded file paths (relative to prototype/)
// ---------------------------------------------------------------------------

const EXCLUDED_FILES: ReadonlySet<string> = new Set([
  "platform/core/decimal-engine.ts",
  "platform/core/decimal-money.ts",
  // This gate itself
  "platform/recon/no-float-money-arithmetic.ts",
]);

// ---------------------------------------------------------------------------
// Detection regexes
// ---------------------------------------------------------------------------

// Pattern 1: Math.round(...) with a money-flavoured arg anywhere in the parens.
// Matches up to one level of nesting (no balanced-paren walk needed — the
// money-name is the signal, not full paren balance).
const MATH_ROUND_MONEY_RE =
  /\bMath\.round\s*\([^)]*(?:Minor|minor|Money|money|amount|Amount)[^)]*\)/g;

// Pattern 2: a money-flavoured identifier (ending or containing the name word)
// immediately followed by * or / (with optional whitespace).
// Excludes lines that are pure comments (//… or *…).
const MONEY_MULTDIV_RE = /\b\w*(?:Minor|minor|Money|money|Amount|amount)\w*\s*[*/]/g;

// ---------------------------------------------------------------------------
// File walker
// ---------------------------------------------------------------------------

const ALWAYS_EXCLUDE: ReadonlySet<string> = new Set(["node_modules", ".local", ".git"]);

function walk(dir: string, protoDir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (ALWAYS_EXCLUDE.has(name) || name.startsWith(".")) continue;
    const full = join(dir, name);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(full);
    } catch {
      // Broken symlink / race — skip silently (documented intent).
      continue;
    }
    if (st.isDirectory()) {
      walk(full, protoDir, out);
    } else if (st.isFile() && (name.endsWith(".ts") || name.endsWith(".tsx"))) {
      const rel = full.startsWith(`${protoDir}/`) ? full.slice(protoDir.length + 1) : full;
      out.push(rel);
    }
  }
}

function listSourceFiles(protoDir: string): string[] {
  const out: string[] = [];
  walk(protoDir, protoDir, out);
  return out.sort();
}

// ---------------------------------------------------------------------------
// Public finding type
// ---------------------------------------------------------------------------

export interface FloatMoneyFinding {
  /** Relative path from prototype/. */
  readonly file: string;
  readonly line: number;
  readonly col: number;
  /** "Math.round(money)" | "money-multiply/divide" */
  readonly pattern: string;
  readonly context: string;
}

// ---------------------------------------------------------------------------
// Core scan
// ---------------------------------------------------------------------------

function isCommentLine(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

export function scanFile(rel: string, protoDir: string): FloatMoneyFinding[] {
  if (EXCLUDED_FILES.has(rel)) return [];
  if (
    rel.endsWith(".test.ts") ||
    rel.endsWith(".test.tsx") ||
    rel.endsWith(".spec.ts") ||
    rel.endsWith(".spec.tsx")
  )
    return [];

  let content: string;
  try {
    content = readFileSync(resolve(protoDir, rel), "utf8");
  } catch {
    return [];
  }

  const rawLines = content.split(/\r?\n/);
  const findings: FloatMoneyFinding[] = [];
  // Keyed file:line to deduplicate (Math.round may also match pattern 2).
  const seenKey = new Set<string>();

  function addFinding(idx: number, pattern: string, _matchedText: string): void {
    const lineNum = content.slice(0, idx).split("\n").length;
    const lineStart = content.lastIndexOf("\n", idx - 1) + 1;
    const col = idx - lineStart + 1;
    const key = `${rel}:${lineNum}`;
    if (seenKey.has(key)) return;
    seenKey.add(key);
    findings.push({
      file: rel,
      line: lineNum,
      col,
      pattern,
      context: (rawLines[lineNum - 1] ?? "").trim().slice(0, 120),
    });
  }

  // --- Pattern 1: Math.round(…money…) ---
  MATH_ROUND_MONEY_RE.lastIndex = 0;
  let m = MATH_ROUND_MONEY_RE.exec(content);
  while (m !== null) {
    addFinding(m.index, "Math.round(money)", m[0]);
    m = MATH_ROUND_MONEY_RE.exec(content);
  }

  // --- Pattern 2: moneyVar * or / ---
  MONEY_MULTDIV_RE.lastIndex = 0;
  let m2 = MONEY_MULTDIV_RE.exec(content);
  while (m2 !== null) {
    const lineNum = content.slice(0, m2.index).split("\n").length;
    const rawLine = rawLines[lineNum - 1] ?? "";
    if (!isCommentLine(rawLine)) {
      addFinding(m2.index, "money-multiply/divide", m2[0]);
    }
    m2 = MONEY_MULTDIV_RE.exec(content);
  }

  return findings;
}

export function scanAll(protoDir: string): FloatMoneyFinding[] {
  const files = listSourceFiles(protoDir);
  const out: FloatMoneyFinding[] = [];
  for (const rel of files) {
    out.push(...scanFile(rel, protoDir));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Allowlist types
// ---------------------------------------------------------------------------

export interface AllowlistEntry {
  readonly file: string;
  readonly line: number;
  readonly pattern: string;
}

export interface Allowlist {
  readonly violations: ReadonlyArray<AllowlistEntry>;
}

function loadAllowlist(path: string): Allowlist {
  if (!existsSync(path)) return { violations: [] };
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as Allowlist;
  } catch {
    return { violations: [] };
  }
}

function allowlistKey(entry: { file: string; line: number }): string {
  return `${entry.file}:${entry.line}`;
}

// ---------------------------------------------------------------------------
// Detect files touched since origin/main
// ---------------------------------------------------------------------------

function touchedFilesRelativeToMain(protoDir: string): Set<string> {
  const result = spawnSync("git", ["diff", "--name-only", "origin/main...HEAD"], {
    cwd: protoDir,
    encoding: "utf8",
  });
  if (result.status !== 0) return new Set();
  return new Set(
    result.stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      // Git outputs from repo root; convert to prototype/-relative paths.
      .map((p) => (p.startsWith("prototype/") ? p.slice("prototype/".length) : p)),
  );
}

// ---------------------------------------------------------------------------
// Public run function
// ---------------------------------------------------------------------------

export interface RunOpts {
  readonly prototypeDir?: string;
  readonly allowlistPath?: string;
  /** When true, allowlisted files modified since main also fail. */
  readonly enforceTouched?: boolean;
}

export function run(opts: RunOpts = {}): ReconResult & {
  totalViolations: number;
  allowlistedCount: number;
  newViolations: number;
  touchedViolations: number;
  topFiles: ReadonlyArray<[string, number]>;
} {
  const protoDir = opts.prototypeDir ?? PROTOTYPE_DIR;
  const alPath = opts.allowlistPath ?? ALLOWLIST_PATH;
  const enforceTouched = opts.enforceTouched ?? false;

  const base = emptyResult("no-float-money-arithmetic") as ReconResult & {
    totalViolations: number;
    allowlistedCount: number;
    newViolations: number;
    touchedViolations: number;
    topFiles: ReadonlyArray<[string, number]>;
  };

  const findings = scanAll(protoDir);
  const allowlist = loadAllowlist(alPath);
  const allowlistKeys = new Set(allowlist.violations.map(allowlistKey));

  const byFile = new Map<string, number>();
  for (const f of findings) {
    byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1);
  }
  const topFiles = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const touchedFiles = enforceTouched ? touchedFilesRelativeToMain(protoDir) : new Set<string>();

  const reconViolations: ReconViolation[] = [];
  let newCount = 0;
  let touchedCount = 0;
  let allowlistedCount = 0;

  for (const f of findings) {
    const key = allowlistKey(f);
    if (allowlistKeys.has(key)) {
      allowlistedCount++;
      if (enforceTouched && touchedFiles.has(f.file)) {
        touchedCount++;
        reconViolations.push({
          subject: key,
          severity: "fail",
          message: [
            `Float money arithmetic in migrated file: ${f.file}:${f.line}`,
            `Pattern: ${f.pattern}`,
            `Context: ${f.context}`,
            "This file has been modified since main — migrate this expression to the decimal engine.",
            "Authority: D-DECIMAL-NATIVE-MONEY-ARITHMETIC; WS-DECIMAL-NATIVE-MONEY-ARITHMETIC.",
          ].join("\n"),
        });
      }
    } else {
      newCount++;
      reconViolations.push({
        subject: key,
        severity: "fail",
        message: [
          `New float money arithmetic: ${f.file}:${f.line}`,
          `Pattern: ${f.pattern}`,
          `Context: ${f.context}`,
          "Use the decimal engine (platform/core/decimal-engine.ts) for money arithmetic.",
          "Authority: D-DECIMAL-NATIVE-MONEY-ARITHMETIC; WS-DECIMAL-NATIVE-MONEY-ARITHMETIC.",
        ].join("\n"),
      });
    }
  }

  base.asserted = findings.length;
  base.totalViolations = findings.length;
  base.allowlistedCount = allowlistedCount;
  base.newViolations = newCount;
  base.touchedViolations = touchedCount;
  base.topFiles = topFiles;
  base.violations = reconViolations;
  base.ok = reconViolations.every((v) => v.severity !== "fail");

  return base;
}

// ---------------------------------------------------------------------------
// Allowlist generation
// ---------------------------------------------------------------------------

export function generateAllowlist(
  protoDir: string,
  outPath: string,
): { count: number; files: number } {
  const findings = scanAll(protoDir);
  const violations: AllowlistEntry[] = findings.map((f) => ({
    file: f.file,
    line: f.line,
    pattern: f.pattern,
  }));
  const allowlist: Allowlist = { violations };
  writeFileSync(outPath, `${JSON.stringify(allowlist, null, 2)}\n`, "utf8");
  const files = new Set(findings.map((f) => f.file)).size;
  return { count: findings.length, files };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const args = process.argv.slice(2);
  const enforceTouched = args.includes("--enforce-touched");
  const generateMode = args.includes("--generate-allowlist");

  if (generateMode) {
    const { count, files } = generateAllowlist(PROTOTYPE_DIR, ALLOWLIST_PATH);
    console.log(
      JSON.stringify({
        level: "info",
        time: new Date().toISOString(),
        service: "bank-prototype",
        pipeline: "no-float-money-arithmetic",
        msg: `Generated allowlist: ${count} violations across ${files} files`,
        allowlistPath: ALLOWLIST_PATH,
        count,
        files,
      }),
    );
    process.exit(0);
  }

  const r = run({ enforceTouched });

  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      totalViolations: r.totalViolations,
      allowlistedCount: r.allowlistedCount,
      newViolations: r.newViolations,
      touchedViolations: r.touchedViolations,
      topFiles: r.topFiles,
      ok: r.ok,
      msg: r.ok
        ? `no-float-money-arithmetic: advisory pass — ${r.totalViolations} total (${r.allowlistedCount} allowlisted, ${r.newViolations} new)`
        : `no-float-money-arithmetic FAILED — ${r.newViolations} new float-money arithmetic expression(s) found`,
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
