// platform/recon/code-quality/swallowed-errors.ts
//
// Code-quality recon: detects empty `catch` blocks — i.e. errors that
// are caught and silently dropped.
//
// Patterns flagged:
//   - `catch {}`               (no binding, empty body)
//   - `catch (err) {}`         (binding, empty body)
//   - `catch (err) { /* … */ }` (binding, body is only a comment)
//
// Rationale: a swallowed error breaks the bank's audit trail (Principle 1)
// and security posture (Principle 4). Every catch should either re-throw,
// log, emit a typed event, or leave a clear comment of why the error is
// safe to ignore. The pattern recognised here is "binding (or no binding)
// + body that contains nothing but whitespace and comments", which
// surfaces the genuinely-swallowed cases without flagging the legitimate
// "best-effort, log-and-continue" pattern.
//
// Walks `prototype/**/*.ts` excluding `node_modules`, `.local`, `dist`,
// `fixtures`, and `*.test.ts` (tests legitimately swallow errors when
// asserting throw-or-not-throw).
//
// Author: Vera (third-line) · Atlas (recon plumbing for codebase-quality-review handler)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "../types";

const SKIP_DIRS = new Set(["node_modules", ".local", "dist", "fixtures", ".git"]);

export interface RunOpts {
  /** Override the root scan dir (default: prototype/). */
  rootDir?: string;
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
 * Strip block comments and line comments inside a `{ … }` body, then
 * check whether what remains is whitespace-only. This is the test for
 * "swallowed error" — a body that is truly empty after comment removal.
 */
function bodyIsEffectivelyEmpty(body: string): boolean {
  const noBlock = body.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLine = noBlock.replace(/\/\/[^\n]*/g, "");
  return noLine.trim().length === 0;
}

interface Match {
  readonly path: string;
  readonly line: number;
  readonly snippet: string;
}

/**
 * Find swallowed-error matches in a source. We do this with a stateful
 * scan rather than a giant regex: regex-based matching of balanced
 * braces is famously fragile, and the catch body might contain nested
 * `{}` (object literals, blocks). The scan locates `catch` then walks
 * the brace depth to find the matching closer.
 */
export function findSwallowedErrors(source: string, path: string): Match[] {
  const matches: Match[] = [];
  // Regex finds the opening of every `catch` block, optionally with a
  // binding parenthesis. The `{` index is the start of the body.
  const catchRe = /\bcatch\s*(?:\([^)]*\)\s*)?\{/g;
  let m: RegExpExecArray | null;
  while ((m = catchRe.exec(source)) !== null) {
    const openIdx = m.index + m[0].length - 1; // index of the `{`
    // Walk forward to find matching close. We do not enter strings or
    // comments — naive but enough for catch bodies, which are short.
    let depth = 1;
    let i = openIdx + 1;
    let inLine = false;
    let inBlock = false;
    let inString: '"' | "'" | "`" | null = null;
    while (i < source.length && depth > 0) {
      const c = source[i];
      const next = source[i + 1];
      if (inLine) {
        if (c === "\n") inLine = false;
      } else if (inBlock) {
        if (c === "*" && next === "/") {
          inBlock = false;
          i++;
        }
      } else if (inString) {
        if (c === "\\") {
          i++;
        } else if (c === inString) {
          inString = null;
        }
      } else {
        if (c === "/" && next === "/") {
          inLine = true;
          i++;
        } else if (c === "/" && next === "*") {
          inBlock = true;
          i++;
        } else if (c === '"' || c === "'" || c === "`") {
          inString = c;
        } else if (c === "{") {
          depth++;
        } else if (c === "}") {
          depth--;
          if (depth === 0) break;
        }
      }
      i++;
    }
    if (depth !== 0) continue; // unbalanced — give up on this match
    const body = source.slice(openIdx + 1, i);
    if (!bodyIsEffectivelyEmpty(body)) continue;
    // Compute the line number of the `catch` keyword for the report.
    const upToHere = source.slice(0, m.index);
    const line = upToHere.split("\n").length;
    // Snippet: the catch and a tiny tail of body, for context.
    const snippetEnd = Math.min(i + 1, source.length);
    const snippet = source.slice(m.index, snippetEnd).replace(/\s+/g, " ").trim();
    matches.push({ path, line, snippet: snippet.slice(0, 80) });
  }
  return matches;
}

function relativise(absPath: string, rootDir: string): string {
  if (absPath.startsWith(`${rootDir}/`)) return absPath.slice(rootDir.length + 1);
  return absPath;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("code-quality:swallowed-errors");
  const violations: ReconViolation[] = [];

  const rootDir = opts.rootDir ?? resolve(import.meta.dir, "..", "..", "..");
  const files: string[] = [];
  walk(rootDir, files);

  for (const f of files) {
    let source: string;
    try {
      source = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    result.asserted++;
    const ms = findSwallowedErrors(source, f);
    for (const match of ms) {
      violations.push({
        subject: `${relativise(match.path, rootDir)}:${match.line}`,
        message: `Swallowed error: \`${match.snippet}\`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.`,
        severity: "warn",
      });
    }
  }

  result.violations = violations;
  // Warn-severity only: swallowed errors are signals, not control failures.
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}
