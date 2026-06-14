// platform/recon/no-ts-suppression.ts
//
// Engineering-Charter gate (command #6 — "the type system is a tool, not an
// obstacle"). The strict compiler is a correctness instrument; dodging it
// with `@ts-ignore` / `@ts-expect-error` directives hides real type errors.
// This gate bans those directives in production source (platform/, runtime/,
// dashboard/), excluding test files.
//
// HARDEN-ONLY RATCHET: this gate does not fail on the existing corpus
// (KNOWN_VIOLATIONS_SNAPSHOT below). It fails only when the count GROWS. The
// snapshot moves in ONE direction — down. Do NOT increase
// KNOWN_VIOLATIONS_SNAPSHOT without a CEO-approved Decision citing why.
//
// Detection is precise: only a comment whose FIRST token is the directive
// (`// @ts-ignore`, `/* @ts-expect-error */`) is a real suppression — prose
// that merely mentions the directive name mid-sentence is not matched.
//
// Authority: D-ENGINEERING-INTEGRITY-CHARTER (CEO-approved 2026-06-14).
// Citations: Engineering-Charter.md (#6); P1-EVENTS-AS-TRUTH.
// Author: Scrooge (Chief of Staff) as recording instrument.

import {
  type CharterFinding,
  PROTOTYPE_DIR,
  evaluateRatchet,
  listSourceFiles,
  readLines,
} from "./charter-scan";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// Measured 2026-06-14 against platform/ runtime/ dashboard/ (excluding tests):
// zero real suppression directives. The gate therefore enforces immediately.
const KNOWN_VIOLATIONS_SNAPSHOT = 0;

const CITATIONS = ["Engineering-Charter.md (#6)", "D-ENGINEERING-INTEGRITY-CHARTER"];
const SUBDIRS = ["platform", "runtime", "dashboard"] as const;
const SELF = "platform/recon/no-ts-suppression.ts";

// A real suppression directive is a comment whose first token is the
// ts-ignore / ts-expect-error pragma. Matches the line-comment and
// block-comment forms; does NOT match prose that merely names them.
const SUPPRESSION_RE = /^\s*(?:\/\/|\/\*)\s*@ts-(?:ignore|expect-error)\b/;

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
    const lines = readLines(prototypeDir, rel);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (SUPPRESSION_RE.test(line)) {
        found.push({ file: rel, line: i + 1, snippet: line.trim().slice(0, 80) });
      }
    }
  }
  return found;
}

export function run(opts: RunOpts = {}): ReconResult & { count: number } {
  const result = emptyResult("no-ts-suppression") as ReconResult & { count: number };
  const prototypeDir = opts.prototypeDir ?? PROTOTYPE_DIR;
  const snapshot = opts.knownViolations ?? KNOWN_VIOLATIONS_SNAPSHOT;

  const findings = scan(prototypeDir);
  result.count = findings.length;
  result.asserted = 1;

  const violations: ReconViolation[] = [];
  const ratchet = evaluateRatchet(
    "no-ts-suppression:ratchet",
    findings,
    snapshot,
    "Model the type honestly instead of suppressing the compiler (Engineering Charter #6).",
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
        ? `no-ts-suppression passed (${r.count} directives; snapshot ${KNOWN_VIOLATIONS_SNAPSHOT})`
        : "no-ts-suppression FAILED — new @ts-ignore/@ts-expect-error directive(s) added",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
