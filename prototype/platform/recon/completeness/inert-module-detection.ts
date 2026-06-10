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
// SELF-CLEANING (D-RETURNS-SUBMISSION-WIRING-WORKSTREAM, 2026-06-08): the gate
// ALSO FAILs in the opposite direction — if an ALLOWLISTED module HAS gained a
// runtime/dashboard importer, its allowlist entry is STALE (the module is wired,
// so it is no longer inert and must not be counted as "known-inert"). This makes
// the allowlist honest by construction: every future wiring is forced to
// de-allowlist in the same change, or this gate goes red. It would have caught
// the stale BA-310 entry left behind by #1105 (BA-310 was wired into
// runtime/agents/bea-ba310-period-close.ts but its allowlist entry was not
// removed).
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

// NOTE — ba310 is NOT on this list: it was WIRED in #1105
// (`runtime/agents/bea-ba310-period-close.ts`) and de-allowlisted by
// WS-RETURNS-SUBMISSION-WIRING (D-RETURNS-SUBMISSION-WIRING-WORKSTREAM). Re-adding
// it would now trip the self-cleaning STALE check below (`run()` step 3), because
// a module with a runtime importer must not appear here.
//
// The six entries below survived the WS-RETURNS-SUBMISSION-WIRING readiness
// review with a CORRECTED, accurate blocker reason. Each was assessed and found
// NOT genuinely production-ready: wiring it would generate from placeholder
// inputs / under an unresolved formId — a wired-but-hollow return, which the
// workstream judged worse than an honest allowlist entry
// (D-RETURNS-SUBMISSION-WIRING-WORKSTREAM rationale).
export const KNOWN_INERT_PENDING_WIRING: readonly AllowlistEntry[] = [
  {
    module: "platform/returns/ba700/period-close-subscriber.ts",
    owner: "Mira (Compliance / RegTech engineer) + Bea (Accounting & financial reporting engineer)",
    closing:
      "WS-RETURNS-SUBMISSION-WIRING (D-RETURNS-SUBMISSION-WIRING-WORKSTREAM) — NOT wired: total RWA carries a placeholder op-risk component. The RwaComputed event stream NOW lands (D-RWA-ENGINE-W2-SLICE-3): credit RWA is event-sourced (CRE20 risk-weights over readDebtExposures — BondTradeExecuted + InterbankLoanPlaced, Reg 23), and market RWA is event-sourced (12.5 × BA 320 market-risk capital, incl. the Reg 28(3)(a) IR-general disallowances). BA 700 reads the RwaComputed event of record and threads rwaComputationEventId for chain-of-custody. What remains NOT production-ready is OPERATIONAL RWA: the BIA (OPE25) needs three years of audited gross income, which is gross-income-blocked until licence-day (no RevenueRecognitionEmitted feed pre-licence), so operationalRwaMinor is held at zero — an explicit flagged placeholder. Total RWA is therefore understated, which inflates (flatters) the CET1/T1/Total capital ratios. Submitting BA 700 now would record a SARB capital-adequacy return whose required-capital denominator omits operational risk — a wired-but-hollow return. Blocked until the gross-income feed lands and operational RWA is real (or until op-RWA is demonstrably immaterial with the numbers shown).",
  },
  {
    module: "platform/returns/ba400/period-close-subscriber.ts",
    owner: "Mira + Bea",
    closing:
      "WS-RETURNS-SUBMISSION-WIRING — NOT wired: stub-fed generator. BA-300 (operational risk, BIA) gross-income rows are caller-supplied and explicitly post-commencement-of-trading (subscriber: 'Live numbers populate after commencement-of-trading + 3 fiscal years of audited gross income'; default placeholder zeros). Blocked until the gross-income event feed (e.g. RevenueRecognitionEmitted) lands.",
  },
  {
    module: "platform/returns/conduct/period-close-subscriber.ts",
    owner: "Mira",
    closing:
      "WS-RETURNS-SUBMISSION-WIRING — NOT wired: rehearsal-status disclosure + no SARB envelope. `generateConductDisclosure` returns hardcoded `status: 'rehearsal'` (TODO: promote once Helena/Devon RAS tolerances configured), the conduct events have no production emitter, and there is no SARB XML adapter — this is an FSCA conduct disclosure, not a SARB BA-form prudential return submittable via the SARB simulator. Blocked until promoted to a real submission status with a defined channel.",
  },
  {
    module: "platform/returns/cms/period-close-subscriber.ts",
    owner: "Mira",
    closing:
      "WS-RETURNS-SUBMISSION-WIRING — NOT wired: rehearsal scaffolding. `generateCmsDisclosure` produces `status: 'rehearsal'` with placeholder-zero TCF metrics over AlertOpened/ConflictDeclared proxies (generator header: 'placeholder zeros; status: rehearsal'), and there is no SARB XML submission envelope. Earliest-stage of the three FSCA/TCF disclosures. Blocked until real feeds + a defined channel land.",
  },
  {
    module: "platform/returns/climate/period-close-subscriber.ts",
    owner: "Mira",
    closing:
      "WS-RETURNS-SUBMISSION-WIRING — NOT wired: rehearsal-status disclosure + no SARB envelope. `generateClimateRiskDisclosure` assigns placeholder transition/physical scores (0) and a placeholder Pillar-2 add-on (0), returning `status: 'rehearsal'` (TODO: climate-data-provider). This is a TCFD/SARB-GN5 Pillar-2 disclosure, not a SARB BA-form prudential return. Blocked until the climate-data feed + a defined channel land.",
  },
];

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
  // "returns/ba320/period-close-subscriber".
  const noExt = moduleRelPath.replace(/\.ts$/, "");
  const m = noExt.match(/platform\/(returns\/.+)$/);
  const suffix = m?.[1] ?? noExt; // "returns/ba320/period-close-subscriber"

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
      // Covers `from "../../returns/ba320/period-close-subscriber"` and the
      // `.ts`-suffixed / `/index` variants.
      const re = new RegExp(`["'\`][^"'\`]*${suffix.replace(/[/]/g, "\\/")}(?:\\.ts)?["'\`]`);
      if (re.test(src)) return true;
    }
  }
  return false;
}

/**
 * Pure violation-builder — decoupled from the filesystem so both directions
 * (untracked-inert FAIL and allowlisted-but-wired STALE FAIL) are unit-testable
 * against an injected `wired` predicate. `run()` supplies the real
 * filesystem-backed predicate; tests supply a deterministic one.
 *
 * @param watched     repo-relative paths of the watched period-close subscribers.
 * @param allowlist   the KNOWN_INERT_PENDING_WIRING set (or a test fixture).
 * @param isWired     true iff a runtime/dashboard importer exists for the module.
 */
export function computeViolations(
  watched: readonly string[],
  allowlist: readonly AllowlistEntry[],
  isWired: (moduleRelPath: string) => boolean,
): { violations: ReconViolation[]; inertCount: number } {
  const allowlisted = new Set(allowlist.map((e) => e.module));
  const violations: ReconViolation[] = [];
  let inertCount = 0;

  // 2. Assert each watched module has a runtime/dashboard importer (or is allowlisted).
  for (const mod of watched) {
    if (isWired(mod)) continue;
    inertCount++;
    if (allowlisted.has(mod)) continue; // tracked — not a silent drop
    violations.push({
      subject: mod,
      message: `Module "${mod}" is built + tested but has NO importer under runtime/ or dashboard/ (inert — no production execution path invokes it; an unimported module emits no failure, so no existing recon gate notices). This is the T1 built-but-inert taxon (D-COMPLETENESS-AUDIT-WORKSTREAM, FX review G5.1). Remediation: wire the subscriber into the AccountingPeriodClosed stream in runtime/ (e.g. runtime/agents/bea-period-close.ts), OR add it to KNOWN_INERT_PENDING_WIRING with an explicit owner + closing workstream item.`,
      severity: "fail",
    });
  }

  // 3. SELF-CLEANING — FAIL on any allowlisted-but-now-WIRED module (stale
  //    entry). The allowlist exists to track modules that are inert; the moment
  //    a module gains a runtime/dashboard importer it is no longer inert, so its
  //    allowlist entry is stale and MUST be removed. Iterating the allowlist
  //    directly (not the watched set) means a stale entry is caught even if the
  //    module path drifted out of the watched suffix. This is what forces every
  //    future wiring (like BA-310 in #1105) to de-allowlist in the same change,
  //    keeping the allowlist honest by construction.
  //    Authority: D-RETURNS-SUBMISSION-WIRING-WORKSTREAM (CEO session-delegation
  //    2026-06-08); enhancement of Vera's completeness-audit gate.
  for (const entry of allowlist) {
    if (!isWired(entry.module)) continue;
    violations.push({
      subject: entry.module,
      message: `Module "${entry.module}" is on KNOWN_INERT_PENDING_WIRING (allowlisted as inert) BUT now HAS an importer under runtime/ or dashboard/ — it is wired, so the allowlist entry is STALE and must be removed. An allowlist that retains wired modules is dishonest: it counts them as "known-inert" when they are actually live (exactly the stale BA-310 entry left behind by #1105). Remediation: delete this entry from KNOWN_INERT_PENDING_WIRING. Authority: D-RETURNS-SUBMISSION-WIRING-WORKSTREAM.`,
      severity: "fail",
    });
  }

  // No silent caps (spec §5): surface the count of known-inert (allowlisted)
  // modules as an info-level note so the suppression is visible, never hidden.
  if (inertCount > 0) {
    violations.push({
      subject: "known-inert-pending-wiring",
      message: `${inertCount} watched module(s) are inert (built + tested, no runtime/dashboard importer); ${allowlist.length} are tracked on KNOWN_INERT_PENDING_WIRING with an owner + closing workstream item. These are the returns-submission layer's unwired period-close subscribers (D-COMPLETENESS-AUDIT-WORKSTREAM; remaining six per D-RETURNS-SUBMISSION-WIRING-WORKSTREAM, each kept allowlisted with an accurate not-production-ready blocker). The count is logged so the suppression is never silent.`,
      severity: "info",
    });
  }

  return { violations, inertCount };
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

  // 2 + 3 + count — delegate to the pure builder with the filesystem predicate.
  const { violations } = computeViolations(watched, KNOWN_INERT_PENDING_WIRING, (mod) =>
    hasRuntimeImporter(prototypeDir, mod),
  );

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
