// platform/recon/no-skipped-tests.ts
//
// Engineering-Charter gate (command #3 — "no green by concealment"). A test
// suite goes green dishonestly when cases are skipped or narrowed. This gate
// bans `.skip` / `.only` / `.todo` and the x-/f- prefixed forms in committed
// test files, so the green bar means every case actually ran.
//
// HARDEN-ONLY RATCHET: does not fail on the existing corpus
// (KNOWN_VIOLATIONS_SNAPSHOT below); fails only when the count GROWS. The
// snapshot moves in ONE direction — down. Do NOT increase
// KNOWN_VIOLATIONS_SNAPSHOT without a CEO-approved Decision citing why.
//
// Authority: D-ENGINEERING-INTEGRITY-CHARTER (CEO-approved 2026-06-14).
// Citations: Engineering-Charter.md (#3); P1-EVENTS-AS-TRUTH.
// Author: Scrooge (Chief of Staff) as recording instrument.

import {
  type CharterFinding,
  PROTOTYPE_DIR,
  evaluateRatchet,
  listSourceFiles,
  readLines,
} from "./charter-scan";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// Measured 2026-06-14 across all *.test.ts/tsx: zero skipped/narrowed cases.
// The gate therefore enforces immediately.
const KNOWN_VIOLATIONS_SNAPSHOT = 0;

const CITATIONS = ["Engineering-Charter.md (#3)", "D-ENGINEERING-INTEGRITY-CHARTER"];
// Test files live both alongside source and under tests/, so scan the whole
// prototype tree and filter to *.test.* below.
const SUBDIRS = ["platform", "runtime", "dashboard", "tests", "scenarios"] as const;
const SELF = "platform/recon/no-skipped-tests.ts";

// `describe.skip(`, `it.only(`, `test.todo(` etc., and the x-/f- prefix forms.
const SKIP_RE =
  /\b(?:describe|it|test)\.(?:skip|only|todo)\b|\b(?:xit|xdescribe|fit|fdescribe)\s*\(/;

export interface RunOpts {
  readonly prototypeDir?: string;
  readonly knownViolations?: number;
}

function scan(prototypeDir: string): CharterFinding[] {
  const files = listSourceFiles(prototypeDir, SUBDIRS);
  const found: CharterFinding[] = [];
  for (const rel of files) {
    if (rel === SELF) continue;
    if (!(rel.endsWith(".test.ts") || rel.endsWith(".test.tsx"))) continue;
    const lines = readLines(prototypeDir, rel);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const trimmed = line.trimStart();
      // Skip comment lines — prose mentioning `.skip` is not a skipped test.
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
      if (SKIP_RE.test(line)) {
        found.push({ file: rel, line: i + 1, snippet: line.trim().slice(0, 80) });
      }
    }
  }
  return found;
}

export function run(opts: RunOpts = {}): ReconResult & { count: number } {
  const result = emptyResult("no-skipped-tests") as ReconResult & { count: number };
  const prototypeDir = opts.prototypeDir ?? PROTOTYPE_DIR;
  const snapshot = opts.knownViolations ?? KNOWN_VIOLATIONS_SNAPSHOT;

  const findings = scan(prototypeDir);
  result.count = findings.length;
  result.asserted = 1;

  const violations: ReconViolation[] = [];
  const ratchet = evaluateRatchet(
    "no-skipped-tests:ratchet",
    findings,
    snapshot,
    "Fix or delete the test — do not skip/narrow it to go green (Engineering Charter #3). If a skip is genuinely warranted, record a Decision and cite it on the line.",
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
        ? `no-skipped-tests passed (${r.count} skipped/narrowed; snapshot ${KNOWN_VIOLATIONS_SNAPSHOT})`
        : "no-skipped-tests FAILED — new skipped/narrowed test case(s) added",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
