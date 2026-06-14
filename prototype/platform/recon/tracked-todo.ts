// platform/recon/tracked-todo.ts
//
// Engineering-Charter gate (commands #1 root-cause and #5 no-silent-deferral).
// A bare TODO/FIXME/HACK marker is a silent deferral — an admission that
// something is incomplete, with no owner and no register entry. This gate
// flags markers in production source (platform/, runtime/, dashboard/),
// excluding tests, that lack a tracked reference on the same line.
//
// A tracked reference is any of: a Decision id (D-...), a finding id (F-NN),
// a registered gap (GAP-...), a URN (urn:...), a chip task id (task_...),
// a PR/issue number (#NNN), or a recon pipeline name (recon:...). Adding one
// of these turns "I'll get to it" into a tracked obligation with an owner.
//
// HARDEN-ONLY RATCHET: does not fail on the existing corpus
// (KNOWN_VIOLATIONS_SNAPSHOT below); fails only when the count GROWS. The
// snapshot moves in ONE direction — down. Do NOT increase
// KNOWN_VIOLATIONS_SNAPSHOT without a CEO-approved Decision citing why.
//
// Authority: D-ENGINEERING-INTEGRITY-CHARTER (CEO-approved 2026-06-14).
// Citations: Engineering-Charter.md (#1, #5); P1-EVENTS-AS-TRUTH.
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
// ninety pre-existing untracked markers, grandfathered by this snapshot.
// Most are licence-day vendor-integration stubs (KYC adapters); the ratchet
// prevents NEW untracked deferrals while leaving the legacy corpus to be
// drained downward over time.
const KNOWN_VIOLATIONS_SNAPSHOT = 90;

const CITATIONS = ["Engineering-Charter.md (#1, #5)", "D-ENGINEERING-INTEGRITY-CHARTER"];
const SUBDIRS = ["platform", "runtime", "dashboard"] as const;
const SELF = "platform/recon/tracked-todo.ts";

const MARKER_RE = /\b(?:TODO|FIXME|HACK)\b/;
const TRACKED_REF_RE = /(?:D-[A-Z]|F-[0-9]|GAP-|urn:|task_|#[0-9]+|recon:)/;

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
      if (MARKER_RE.test(line) && !TRACKED_REF_RE.test(line)) {
        found.push({ file: rel, line: i + 1, snippet: line.trim().slice(0, 80) });
      }
    }
  }
  return found;
}

export function run(opts: RunOpts = {}): ReconResult & { count: number } {
  const result = emptyResult("tracked-todo") as ReconResult & { count: number };
  const prototypeDir = opts.prototypeDir ?? PROTOTYPE_DIR;
  const snapshot = opts.knownViolations ?? KNOWN_VIOLATIONS_SNAPSHOT;

  const findings = scan(prototypeDir);
  result.count = findings.length;
  result.asserted = 1;

  const violations: ReconViolation[] = [];
  const ratchet = evaluateRatchet(
    "tracked-todo:ratchet",
    findings,
    snapshot,
    "Register the deferred work as a typed event (SubstrateAlert / ProductDeferredGap / finding) and cite it on the line — e.g. `// FIXME(D-...)` or `// TODO: ... (task_...)` (Engineering Charter #5).",
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
        ? `tracked-todo passed (${r.count} untracked markers; snapshot ${KNOWN_VIOLATIONS_SNAPSHOT})`
        : "tracked-todo FAILED — new untracked TODO/FIXME/HACK marker(s) added",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
