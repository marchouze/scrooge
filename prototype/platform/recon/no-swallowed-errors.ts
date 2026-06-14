// platform/recon/no-swallowed-errors.ts
//
// Engineering-Charter gate (command #6 — errors are handled, never swallowed).
// An empty `catch {}` / `catch (e) {}` discards a failure silently: the
// program continues as if nothing went wrong, and the incident becomes
// invisible. This gate flags empty catch blocks in production source
// (platform/, runtime/, dashboard/), excluding tests.
//
// A catch that genuinely has nothing to handle must SAY SO — a one-line
// comment explaining why the omission is correct turns the block non-empty
// and documents the intent (see the deliberate skips in charter-scan.ts).
//
// HARDEN-ONLY RATCHET: does not fail on the existing corpus
// (KNOWN_VIOLATIONS_SNAPSHOT below); fails only when the count GROWS. The
// snapshot moves in ONE direction — down. Do NOT increase
// KNOWN_VIOLATIONS_SNAPSHOT without a CEO-approved Decision citing why.
//
// Authority: D-ENGINEERING-INTEGRITY-CHARTER (CEO-approved 2026-06-14).
// Citations: Engineering-Charter.md (#6); P1-EVENTS-AS-TRUTH.
// Author: Scrooge (Chief of Staff) as recording instrument.

import {
  type CharterFinding,
  PROTOTYPE_DIR,
  evaluateRatchet,
  listSourceFiles,
  readContent,
} from "./charter-scan";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// Measured 2026-06-14 against platform/ runtime/ dashboard/ (excluding tests):
// three pre-existing empty catch blocks, grandfathered by this snapshot.
const KNOWN_VIOLATIONS_SNAPSHOT = 3;

const CITATIONS = ["Engineering-Charter.md (#6)", "D-ENGINEERING-INTEGRITY-CHARTER"];
const SUBDIRS = ["platform", "runtime", "dashboard"] as const;
const SELF = "platform/recon/no-swallowed-errors.ts";

// Empty catch: `catch {}`, `catch (e) {}`, with any whitespace/newlines
// between the braces. A block containing even a comment is NOT matched
// (a comment is documented intent, not a swallow).
const EMPTY_CATCH_RE = /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g;

export interface RunOpts {
  readonly prototypeDir?: string;
  readonly knownViolations?: number;
}

function scan(prototypeDir: string): CharterFinding[] {
  const files = listSourceFiles(prototypeDir, SUBDIRS);
  const found: CharterFinding[] = [];
  for (const rel of files) {
    if (rel === SELF) continue;
    if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
    const content = readContent(prototypeDir, rel);
    if (!content.includes("catch")) continue;
    EMPTY_CATCH_RE.lastIndex = 0;
    let m = EMPTY_CATCH_RE.exec(content);
    while (m !== null) {
      const line = content.slice(0, m.index).split("\n").length;
      found.push({ file: rel, line, snippet: m[0].replace(/\s+/g, " ").slice(0, 80) });
      m = EMPTY_CATCH_RE.exec(content);
    }
  }
  return found;
}

export function run(opts: RunOpts = {}): ReconResult & { count: number } {
  const result = emptyResult("no-swallowed-errors") as ReconResult & { count: number };
  const prototypeDir = opts.prototypeDir ?? PROTOTYPE_DIR;
  const snapshot = opts.knownViolations ?? KNOWN_VIOLATIONS_SNAPSHOT;

  const findings = scan(prototypeDir);
  result.count = findings.length;
  result.asserted = 1;

  const violations: ReconViolation[] = [];
  const ratchet = evaluateRatchet(
    "no-swallowed-errors:ratchet",
    findings,
    snapshot,
    "Handle, log, escalate, or re-throw the error — or add a comment stating why the omission is correct (Engineering Charter #6).",
    CITATIONS,
  );
  if (ratchet) violations.push(ratchet);

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
      count: r.count,
      snapshot: KNOWN_VIOLATIONS_SNAPSHOT,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? `no-swallowed-errors passed (${r.count} empty catch blocks; snapshot ${KNOWN_VIOLATIONS_SNAPSHOT})`
        : "no-swallowed-errors FAILED — new empty catch block(s) added",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
