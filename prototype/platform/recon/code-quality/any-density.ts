// platform/recon/code-quality/any-density.ts
//
// Code-quality recon: counts `: any` and `as any` occurrences per
// TypeScript file under `prototype/`. Files above the threshold are
// flagged as findings.
//
// Rationale: `any` defeats the type system and is one of the highest-
// leverage signals of erosion in a TypeScript codebase. Per-file
// thresholds catch concentrated usage (a file that's been "just-make-it-
// compile"-ed) without flagging incidental escapes (3rd-party untyped
// shape, JSON parse boundary).
//
// Walks `prototype/**/*.ts`. Skips `node_modules/`, `.local/`, `dist/`,
// fixtures, and `*.test.ts` (test fixtures legitimately use `any` to
// exercise edge-cases).
//
// Output: one finding per file above threshold, plus an aggregate count
// at the end.
//
// Author: Vera (third-line) · Atlas (recon plumbing for codebase-quality-review handler)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "../types";

const SKIP_DIRS = new Set(["node_modules", ".local", "dist", "fixtures", ".git"]);

/** Per-file occurrence threshold above which a finding is emitted. */
export const DEFAULT_THRESHOLD = 3;

export interface RunOpts {
  /** Override the root scan dir (default: prototype/). */
  rootDir?: string;
  /** Override the per-file threshold. */
  threshold?: number;
}

interface FileScan {
  readonly path: string;
  readonly count: number;
}

function isTypescriptSource(name: string): boolean {
  if (!name.endsWith(".ts") && !name.endsWith(".tsx")) return false;
  if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) return false;
  if (name.endsWith(".d.ts")) return false;
  return true;
}

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const path = resolve(dir, name);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(path);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(path, out);
    } else if (st.isFile() && isTypescriptSource(name)) {
      out.push(path);
    }
  }
}

/**
 * Count `: any` and `as any` occurrences in source text.
 *
 * The two regexes are intentionally narrow — `\bany\b` matches the bare
 * `any` keyword, not `Anything` or `manyOptions`. We scan a stripped
 * version of the source (line-comments and block-comments removed) so
 * commentary mentioning `any` is not flagged. String-literal mentions
 * may still be counted but are rare enough to be a tolerable noise
 * floor.
 */
export function countAnyOccurrences(source: string): number {
  // Strip line comments first, then block comments. Keep newlines so
  // line numbers in error messages remain truthful (none today, but
  // useful in the next slice).
  const noLineComments = source.replace(/\/\/[^\n]*/g, "");
  const noComments = noLineComments.replace(/\/\*[\s\S]*?\*\//g, "");
  const colonAny = noComments.match(/:\s*any\b/g)?.length ?? 0;
  const asAny = noComments.match(/\bas\s+any\b/g)?.length ?? 0;
  return colonAny + asAny;
}

function scanFile(path: string): FileScan {
  let source: string;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    return { path, count: 0 };
  }
  return { path, count: countAnyOccurrences(source) };
}

function relativise(absPath: string, rootDir: string): string {
  if (absPath.startsWith(`${rootDir}/`)) return absPath.slice(rootDir.length + 1);
  return absPath;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("code-quality:any-density");
  const violations: ReconViolation[] = [];
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;

  // Default scans the prototype/ root — we resolve from this module's
  // directory rather than CWD so the recon is hermetic when called from
  // tests / scenarios that have a different cwd.
  const rootDir = opts.rootDir ?? resolve(import.meta.dir, "..", "..", "..");

  const files: string[] = [];
  walk(rootDir, files);

  let totalCount = 0;
  for (const f of files) {
    const s = scanFile(f);
    result.asserted++;
    totalCount += s.count;
    if (s.count > threshold) {
      violations.push({
        subject: relativise(s.path, rootDir),
        message: `${s.count} \`any\` occurrences (threshold ${threshold}). Strong typing is a substrate-quality signal — replace with proper types or document the boundary.`,
        severity: "warn",
      });
    }
  }

  // Add an aggregate info-severity finding so the deliverable always
  // carries the codebase-wide tally even when no file is above threshold.
  violations.push({
    subject: "any-density:total",
    message: `${totalCount} \`any\` occurrences across ${files.length} files scanned (threshold ${threshold}/file).`,
    severity: "info",
  });

  result.violations = violations;
  // Code-quality findings are warn / info-severity, not fail — they
  // are signals to triage, not control failures. ok stays true.
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}
