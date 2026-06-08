// platform/recon/completeness/inert-module-detection.ts
//
// Vera completeness-audit gate: inert-module-detection (T1 — built-but-inert).
//
// Part of the recon:completeness:* family commissioned under
// D-COMPLETENESS-AUDIT-WORKSTREAM (CEO session-delegation 2026-06-08). Spec:
// docs/2026-06-08_vera_completeness-audit-workstream-spec.md §9. Source finding:
// the FX functionality review (docs/2026-06-08_fx-functionality-domain-review.md)
// G5.1 — the BA-310 period-close subscriber is built + tested but has zero
// runtime importer, so there is no SARB BA-310 submission path and nothing
// noticed, because an unimported module emits no failure.
//
// What it asserts
// ---------------
// For every module in the WATCHED SET (the runtime entry-point contract of the
// returns-submission layer — `platform/returns/**/period-close-subscriber.ts`),
// at least one file under `runtime/` or `dashboard/` imports it. A watched
// module with no such importer is INERT (built + tested, never invoked by any
// production execution path) and FAILs — unless it is on the explicit
// KNOWN_INERT_PENDING_WIRING allowlist, each entry of which is a tracked
// finding carrying an owner + the closing workstream item.
//
// Why a runtime/dashboard importer (not "any non-test importer")
// --------------------------------------------------------------
// "Runtime" means the production execution paths: code under `runtime/` (agent
// handlers, scheduled ticks) or `dashboard/` (the server + API). Unit tests
// (`*.test.ts`) and `scenarios/**` are exercise harnesses — they prove the
// module *works*, not that it is *wired*. A module imported only by tests /
// scenarios is the exact built-but-inert signature this gate detects.
//
// Why static filesystem analysis (not the event store)
// -----------------------------------------------------
// An inert module by definition emits nothing — it is invisible in the event
// stream. The inert signature is a code-structure property (importer edges), so
// the gate must read the filesystem. Mirrors the pure-FS shape of
// `platform/recon/orphan-capability.ts`.
//
// No silent caps (spec §5): every allowlist entry is explicit and the gate
// reports the count of known-inert modules so suppression is never silent. A
// growing allowlist is itself a Vera finding.
//
// Mode: blocking (non-zero exit on any FAIL).
//
// Author: Vera (Internal audit / continuous-assurance engineer; functional
//   reporting line → Thandiwe, Chief Audit Executive).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "../types";

const PIPELINE = "completeness:inert-module-detection";

// ---------------------------------------------------------------------------
// Watched set — the runtime entry-point contract of the returns layer.
// A returns form is "submitted" by its period-close-subscriber firing off the
// AccountingPeriodClosed stream; that subscriber MUST be imported by a runtime
// path to actually run. Tightly scoped to avoid false positives from helper
// modules (xml.ts / generator.ts / types.ts) that are legitimately imported by
// their sibling subscriber rather than by runtime directly.
// ---------------------------------------------------------------------------

/** A module is in the watched set iff its repo-relative path matches this. */
const WATCHED_SUFFIX_RE = /platform\/returns\/[a-z0-9-]+\/period-close-subscriber\.ts$/;

/** Directories whose files count as a "runtime" importer (production paths). */
const RUNTIME_IMPORTER_DIRS = ["runtime", "dashboard"] as const;

// ---------------------------------------------------------------------------
// Allowlist of known-inert modules pending wiring. Each is a TRACKED finding:
// the returns-submission layer is wholesale inert on `main` (verified — none of
// the period-close-subscribers is imported by bea-period-close.ts or any other
// runtime path). They are listed here — not silently dropped — so the gate is
// green on `main` while the COUNT of known-inert modules stays visible. Closing
// work: WS-COMPLETENESS-AUDIT backlog B2 (wire BA-310 into AccountingPeriodClosed),
// with the rest following the same period-close-wiring pattern.
//
// De-allowlisting any entry makes the gate FAIL on that module — demonstrating
// it actively asserts the T1 property and is not a trivial pass.
// ---------------------------------------------------------------------------

interface AllowlistEntry {
  /** Repo-relative module path (POSIX). */
  readonly module: string;
  /** Owning seat(s) for the wiring work. */
  readonly owner: string;
  /** The tracked closing item. */
  readonly closing: string;
}

export const KNOWN_INERT_PENDING_WIRING: readonly AllowlistEntry[] = [
  {
    module: "platform/returns/ba310/period-close-subscriber.ts",
    owner:
      "Mira (Compliance / RegTech engineer) + Eitan (reporting) + Bea (Accounting & financial reporting engineer)",
    closing:
      "WS-COMPLETENESS-AUDIT B2 — wire BA-310 into AccountingPeriodClosed (FX review G5.1, the highest-value finding)",
  },
  {
    module: "platform/returns/ba100/period-close-subscriber.ts",
    owner: "Mira + Eitan + Bea",
    closing:
      "WS-COMPLETENESS-AUDIT — returns-submission wiring (BA-100 capital adequacy / leverage)",
  },
  {
    module: "platform/returns/ba110/period-close-subscriber.ts",
    owner: "Mira + Eitan + Bea",
    closing: "WS-COMPLETENESS-AUDIT — returns-submission wiring (BA-110 LCR / daily return)",
  },
  {
    module: "platform/returns/ba300/period-close-subscriber.ts",
    owner: "Mira + Eitan + Bea",
    closing: "WS-COMPLETENESS-AUDIT — returns-submission wiring (BA-300 operational risk)",
  },
  {
    module: "platform/returns/conduct/period-close-subscriber.ts",
    owner: "Mira + Eitan",
    closing: "WS-COMPLETENESS-AUDIT — returns-submission wiring (conduct return)",
  },
  {
    module: "platform/returns/cms/period-close-subscriber.ts",
    owner: "Mira + Eitan",
    closing: "WS-COMPLETENESS-AUDIT — returns-submission wiring (CMS return)",
  },
  {
    module: "platform/returns/climate/period-close-subscriber.ts",
    owner: "Mira + Eitan",
    closing: "WS-COMPLETENESS-AUDIT — returns-submission wiring (climate return)",
  },
];

const ALLOWLISTED = new Set(KNOWN_INERT_PENDING_WIRING.map((e) => e.module));

// ---------------------------------------------------------------------------

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

/** Recursively collect all .ts paths under a directory (skips node_modules / .local). */
function walkTs(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir, { encoding: "utf-8" });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".local" || entry === ".git") continue;
    const full = join(dir, entry);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) out.push(...walkTs(full));
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

/**
 * Does any runtime/dashboard file import the module at `moduleRelPath`?
 * Matches on the canonical path-suffix (`returns/<form>/period-close-subscriber`,
 * with or without the `.ts` extension) so it is robust to the relative-path
 * depth of the importer (`../../returns/...` vs `../../../platform/returns/...`).
 */
function hasRuntimeImporter(prototypeDir: string, moduleRelPath: string): boolean {
  // Canonical suffix the import specifier must end with, e.g.
  // "returns/ba310/period-close-subscriber".
  const noExt = moduleRelPath.replace(/\.ts$/, "");
  const m = noExt.match(/platform\/(returns\/.+)$/);
  const suffix = m?.[1] ?? noExt; // "returns/ba310/period-close-subscriber"

  for (const dirName of RUNTIME_IMPORTER_DIRS) {
    const dir = join(prototypeDir, dirName);
    for (const file of walkTs(dir)) {
      if (file.endsWith(".test.ts")) continue; // a test inside runtime/ is still a test
      let src: string;
      try {
        src = readFileSync(file, "utf-8");
      } catch {
        continue;
      }
      // Match an import/from specifier ending in the canonical suffix.
      // Covers `from "../../returns/ba310/period-close-subscriber"` and the
      // `.ts`-suffixed / `/index` variants.
      const re = new RegExp(`["'\`][^"'\`]*${suffix.replace(/[/]/g, "\\/")}(?:\\.ts)?["'\`]`);
      if (re.test(src)) return true;
    }
  }
  return false;
}

export function run(): ReconResult {
  const repoRoot = findRepoRoot(import.meta.dir);
  const prototypeDir = join(repoRoot, "prototype");
  const result: ReconResult = emptyResult(PIPELINE);

  // 1. Enumerate the watched set.
  const watched: string[] = [];
  for (const abs of walkTs(join(prototypeDir, "platform", "returns"))) {
    const rel = relative(prototypeDir, abs).split("\\").join("/");
    if (rel.endsWith(".test.ts")) continue;
    if (WATCHED_SUFFIX_RE.test(rel)) watched.push(rel);
  }
  watched.sort();
  result.asserted = watched.length;

  // 2. Assert each has a runtime/dashboard importer (or is allowlisted).
  const violations: ReconViolation[] = [];
  let inertCount = 0;
  for (const mod of watched) {
    const wired = hasRuntimeImporter(prototypeDir, mod);
    if (wired) continue;
    inertCount++;
    if (ALLOWLISTED.has(mod)) continue; // tracked — not a silent drop
    violations.push({
      subject: mod,
      message: `Module "${mod}" is built + tested but has NO importer under runtime/ or dashboard/ (inert — no production execution path invokes it; an unimported module emits no failure, so no existing recon gate notices). This is the T1 built-but-inert taxon (D-COMPLETENESS-AUDIT-WORKSTREAM, FX review G5.1). Remediation: wire the subscriber into the AccountingPeriodClosed stream in runtime/ (e.g. runtime/agents/bea-period-close.ts), OR add it to KNOWN_INERT_PENDING_WIRING with an explicit owner + closing workstream item.`,
      severity: "fail",
    });
  }

  // No silent caps (spec §5): surface the count of known-inert (allowlisted)
  // modules as an info-level note in the ReconResult so the suppression is
  // visible to the harness / dashboard, never hidden. A growing count is a
  // Vera finding in its own right.
  if (inertCount > 0) {
    violations.push({
      subject: "known-inert-pending-wiring",
      message: `${inertCount} watched module(s) are inert (built + tested, no runtime/dashboard importer); ${KNOWN_INERT_PENDING_WIRING.length} are tracked on KNOWN_INERT_PENDING_WIRING with an owner + closing workstream item. These are the returns-submission layer's unwired period-close subscribers (D-COMPLETENESS-AUDIT-WORKSTREAM backlog B2). The count is logged so the suppression is never silent.`,
      severity: "info",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  const fails = r.violations.filter((v) => v.severity === "fail");
  for (const v of fails) {
    console.error(`  FAIL  [${v.subject}] ${v.message}`);
  }
  const knownInert = KNOWN_INERT_PENDING_WIRING.length;
  if (fails.length === 0) {
    console.log(
      `recon:${PIPELINE} OK — ${r.asserted} watched module(s) checked; ` +
        `${knownInert} known-inert pending-wiring (tracked, allowlisted), 0 untracked inert.`,
    );
    process.exit(0);
  }
  console.error(
    `\nrecon:${PIPELINE} FAILED — ${fails.length} untracked inert module(s) of ${r.asserted} checked`,
  );
  process.exit(1);
}
