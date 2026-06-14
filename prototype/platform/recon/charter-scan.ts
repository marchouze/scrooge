// platform/recon/charter-scan.ts
//
// Shared file-walk utilities for the Engineering-Charter source-scanning
// recon gates (no-ts-suppression, no-skipped-tests, no-swallowed-errors,
// tracked-todo). These four gates all walk the production source tree and
// scan line-by-line; the walk + repo-root resolution is factored here so the
// gates do not each re-implement it (Engineering Charter command #4 / reuse).
//
// Authority: D-ENGINEERING-INTEGRITY-CHARTER (CEO-approved 2026-06-14).
// Citations: Engineering-Charter.md; P1-EVENTS-AS-TRUTH.
// Author: Scrooge (Chief of Staff) as recording instrument.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/** Walk up from `start` until a directory containing CLAUDE.md is found. */
export function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found)");
}

export const REPO_ROOT = findRepoRoot(import.meta.dir);
export const PROTOTYPE_DIR = resolve(REPO_ROOT, "prototype");

/** Directories never walked. */
const ALWAYS_EXCLUDE: ReadonlySet<string> = new Set(["node_modules", ".local", ".git"]);

export interface ListOpts {
  /** Extra directory basenames to skip (in addition to the always-excluded set). */
  readonly excludeDirs?: ReadonlySet<string>;
  /** File extensions to include (default: .ts and .tsx). */
  readonly exts?: ReadonlyArray<string>;
}

function walk(
  dir: string,
  base: string,
  exts: ReadonlyArray<string>,
  exclude: ReadonlySet<string>,
  out: string[],
): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (ALWAYS_EXCLUDE.has(name) || exclude.has(name) || name.startsWith(".")) continue;
    const full = join(dir, name);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(full);
    } catch {
      // Broken symlink / race during walk — skip this entry, keep walking.
      // (Not a swallowed error: the file is genuinely unreadable and there
      // is nothing to handle; the omission is the correct behaviour.)
      continue;
    }
    if (st.isDirectory()) {
      walk(full, base, exts, exclude, out);
    } else if (st.isFile() && exts.some((e) => name.endsWith(e))) {
      out.push(full.startsWith(`${base}/`) ? full.slice(base.length + 1) : full);
    }
  }
}

/**
 * List source files under each of `subdirs` (relative to `rootDir`), returning
 * paths relative to `rootDir`. Results are sorted for deterministic ratchet
 * ordering across platforms.
 */
export function listSourceFiles(
  rootDir: string,
  subdirs: ReadonlyArray<string>,
  opts: ListOpts = {},
): string[] {
  const exts = opts.exts ?? [".ts", ".tsx"];
  const exclude = opts.excludeDirs ?? new Set<string>();
  const out: string[] = [];
  for (const sub of subdirs) {
    walk(resolve(rootDir, sub), rootDir, exts, exclude, out);
  }
  return out.sort();
}

/** Read a file's lines; returns [] if unreadable. */
export function readLines(rootDir: string, rel: string): string[] {
  try {
    return readFileSync(resolve(rootDir, rel), "utf8").split(/\r?\n/);
  } catch {
    return [];
  }
}

/** Read a file's whole content; returns "" if unreadable. */
export function readContent(rootDir: string, rel: string): string {
  try {
    return readFileSync(resolve(rootDir, rel), "utf8");
  } catch {
    return "";
  }
}

export interface CharterFinding {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
}

/**
 * Shared ratchet evaluator. Returns a single ReconViolation describing the
 * outcome relative to `snapshot`, or null when the count exactly matches.
 * - count > snapshot → severity "fail" (new violations introduced)
 * - count < snapshot → severity "info" (cleanup; lower the snapshot)
 * - count == snapshot → null (clean)
 */
export interface RatchetMessage {
  readonly subject: string;
  readonly message: string;
  readonly severity: "fail" | "info";
}

export function evaluateRatchet(
  subject: string,
  findings: ReadonlyArray<CharterFinding>,
  snapshot: number,
  remedy: string,
  citations: ReadonlyArray<string>,
): RatchetMessage | null {
  const count = findings.length;
  if (count > snapshot) {
    const fresh = findings.slice(snapshot);
    return {
      subject,
      severity: "fail",
      message: [
        `${subject}: count grew from snapshot ${snapshot} to ${count}.`,
        `${count - snapshot} new occurrence(s):`,
        ...fresh.map((f) => `  ${f.file}:${f.line} — ${f.snippet}`),
        remedy,
        `Citations: ${citations.join(", ")}.`,
      ].join("\n"),
    };
  }
  if (count < snapshot) {
    return {
      subject,
      severity: "info",
      message: `${subject}: count decreased from ${snapshot} to ${count} — good cleanup. Lower the snapshot to ${count} in the same commit to lock in the floor.`,
    };
  }
  return null;
}
