// platform/recon/ratchet-hardening-only.ts
//
// Engineering-Charter gate (command #3 — "no green by concealment", the
// ratchet sub-clause). Ratchets are the bank's defence against silently
// loosening a quality bar: a snapshot count may only move in the hardening
// direction (down), and never up without a recorded Decision. This META-gate
// asserts that every ratchet-bearing recon file carries the governance
// contract that enforces that discipline:
//   (1) a HARDEN-ONLY contract clause in prose, and
//   (2) at least one Decision (D-...) citation establishing authority.
//
// A ratchet without its contract clause or its authority citation is a
// loosening waiting to happen — anyone could bump the snapshot with no
// recorded justification. This gate surfaces that gap.
//
// ADVISORY (soak phase): emits `warn`, never `fail`, so it cannot block CI
// while it beds in. Promotion to enforcing is tracked under
// D-ENGINEERING-INTEGRITY-CHARTER. A future iteration may additionally diff
// allowlist-array lengths against a stored baseline; that extension is
// likewise tracked under the same Decision.
//
// Authority: D-ENGINEERING-INTEGRITY-CHARTER (CEO-approved 2026-06-14).
// Citations: Engineering-Charter.md (#3); D-PROVENANCE-FILTER-ENFORCEMENT.
// Author: Scrooge (Chief of Staff) as recording instrument.

import { PROTOTYPE_DIR, listSourceFiles, readContent } from "./charter-scan";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const RATCHET_MARKER = "KNOWN_VIOLATIONS_SNAPSHOT";
const SELF = "platform/recon/ratchet-hardening-only.ts";
const SUBDIRS = ["platform/recon"] as const;

// (1) the harden-only governance clause; (2) a Decision-id citation.
const CONTRACT_RE = /harden-only|do not increase|without a (?:ceo-approved )?decision/i;
const DECISION_CITATION_RE = /\bD-[A-Z][A-Z0-9-]+\b/;

export interface RunOpts {
  readonly prototypeDir?: string;
}

interface RatchetFileCheck {
  readonly file: string;
  readonly hasContract: boolean;
  readonly hasCitation: boolean;
}

function scan(prototypeDir: string): RatchetFileCheck[] {
  const files = listSourceFiles(prototypeDir, SUBDIRS);
  const checks: RatchetFileCheck[] = [];
  for (const rel of files) {
    if (rel === SELF) continue;
    if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
    const content = readContent(prototypeDir, rel);
    if (!content.includes(RATCHET_MARKER)) continue;
    checks.push({
      file: rel,
      hasContract: CONTRACT_RE.test(content),
      hasCitation: DECISION_CITATION_RE.test(content),
    });
  }
  return checks;
}

export function run(opts: RunOpts = {}): ReconResult & { ratchetFiles: number } {
  const result = emptyResult("ratchet-hardening-only") as ReconResult & { ratchetFiles: number };
  const prototypeDir = opts.prototypeDir ?? PROTOTYPE_DIR;

  const checks = scan(prototypeDir);
  result.ratchetFiles = checks.length;
  result.asserted = checks.length;

  const violations: ReconViolation[] = [];
  for (const c of checks) {
    const missing: string[] = [];
    if (!c.hasContract) missing.push("harden-only contract clause");
    if (!c.hasCitation) missing.push("Decision (D-...) citation");
    if (missing.length > 0) {
      violations.push({
        subject: `ratchet-hardening-only:${c.file}`,
        message: `Ratchet file ${c.file} is missing: ${missing.join(", ")}. Every ratchet must carry the harden-only contract and an authority citation (Engineering Charter #3).`,
        severity: "warn", // ADVISORY — never blocks CI during soak.
      });
    }
  }

  result.violations = violations;
  // Advisory: ok unless a "fail" appears (none are emitted in soak phase).
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: "info",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      ratchetFiles: r.ratchetFiles,
      violations: r.violations.length,
      ok: r.ok,
      msg:
        r.violations.length === 0
          ? `ratchet-hardening-only passed (${r.ratchetFiles} ratchet file(s); all carry contract + citation)`
          : `ratchet-hardening-only (advisory): ${r.violations.length} ratchet file(s) missing contract/citation`,
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
