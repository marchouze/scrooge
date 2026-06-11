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
// Allowlist of known-inert modules pending wiring. Each is a TRACKED finding
// in the NAMED tracked-deferred-gap shape (WS-RETURNS-SUBMISSION-WIRING
// Wave B, mirroring the ProductDeferredGap pattern of
// D-FX-OTC-NPA-SCOPE-EXPANSION): gapId + owner + targetTrigger + citations.
// They are listed here — not silently dropped — so the gate is green on
// `main` while the COUNT and the gap names stay visible. Wired so far:
// ba320 (#1105), ba300 LCR (Wave A #1180), ba700 capital adequacy (Wave B).
//
// De-allowlisting any entry makes the gate FAIL on that module — demonstrating
// it actively asserts the T1 property and is not a trivial pass. A hollow
// deferral (empty gapId / targetTrigger / citations) also FAILs (step 4).
// ---------------------------------------------------------------------------

export interface AllowlistEntry {
  /** Repo-relative module path (POSIX). */
  readonly module: string;
  /** Owning seat(s) for the wiring work. */
  readonly owner: string;
  /** The tracked closing item. */
  readonly closing: string;
  /**
   * Named tracked-deferred-gap identifier (WS-RETURNS-SUBMISSION-WIRING Wave B,
   * following the ProductDeferredGap pattern of D-FX-OTC-NPA-SCOPE-EXPANSION):
   * every allowlisted deferral is a NAMED gap, not prose-only. Non-empty.
   */
  readonly gapId: string;
  /**
   * The concrete trigger at which the deferral re-opens and the wiring becomes
   * due (e.g. "commencement-of-trading gross-income feed lands"). Non-empty —
   * a deferral with no target trigger is a hollow deferral.
   */
  readonly targetTrigger: string;
  /** Principle 2 citations for the deferral (at least one). */
  readonly citations: readonly string[];
}

/**
 * A named deferred COMPONENT on a return that IS wired (runtime importer
 * exists, submissions flow) but carries one explicitly-disclosed deferred
 * sub-component. Mirrors the "approved with tracked deferred gaps" NPA
 * pattern (D-FX-OTC-NPA-SCOPE-EXPANSION): the return is live for its built
 * substrate while the named sub-item stays a tracked, non-blocking deferral.
 */
export interface WiredComponentDeferral {
  /** Named gap identifier. */
  readonly gapId: string;
  /** SARB form the wired return submits as (Excel-canonical numbering). */
  readonly formId: string;
  /** The wired module carrying the deferral. */
  readonly module: string;
  /** What is deferred. */
  readonly title: string;
  /** Owning seat(s). */
  readonly owner: string;
  /** The concrete trigger at which the deferral re-opens. */
  readonly targetTrigger: string;
  /** Principle 2 citations (at least one). */
  readonly citations: readonly string[];
}

// NOTE — ba310 is NOT on this list: it was WIRED in #1105
// (`runtime/agents/bea-ba310-period-close.ts`) and de-allowlisted by
// WS-RETURNS-SUBMISSION-WIRING (D-RETURNS-SUBMISSION-WIRING-WORKSTREAM). Re-adding
// it would now trip the self-cleaning STALE check below (`run()` step 3), because
// a module with a runtime importer must not appear here.
// NOTE — ba300 (LCR) was WIRED in Wave A (#1180,
// `runtime/agents/bea-ba300-lcr-period-close.ts`) and de-allowlisted likewise.
// NOTE — ba700 (Capital Adequacy) was WIRED in Wave B
// (`runtime/agents/bea-ba700-period-close.ts`) and de-allowlisted; its
// operational-RWA component remains a NAMED tracked deferral — see
// `WIRED_RETURN_COMPONENT_DEFERRALS` below.
//
// The four entries below are GENUINELY BLOCKED returns (WS-RETURNS-SUBMISSION-
// WIRING Wave B readiness re-review, 2026-06-10): wiring any of them today
// would generate from placeholder inputs / rehearsal status / with no defined
// submission channel — a wired-but-hollow return, which the workstream judged
// worse than an honest, NAMED deferral. Each entry is a tracked deferred gap
// in the ProductDeferredGap shape (gapId + owner + targetTrigger + citations;
// D-FX-OTC-NPA-SCOPE-EXPANSION pattern); the gate FAILs on any hollow
// deferral (empty gapId / targetTrigger / citations).
// NOTE — ba400 (Operational Risk, BIA) was WIRED in W2.2
// (`runtime/agents/bea-ba400-period-close.ts`, D-TREASURER-WAVE2-SUBSTRATE,
// 2026-06-11) and de-allowlisted here. The gross-income source remains a named
// tracked component deferral — see `WIRED_RETURN_COMPONENT_DEFERRALS` below.
// The BA 400 BIA capital is CORRECTLY zero pre-commencement (no gross income
// has accrued since incorporation), so the submitted return is accurate, not
// hollow — identical reasoning to GAP-RETURNS-BA700-OPERATIONAL-RWA on BA 700.
export const KNOWN_INERT_PENDING_WIRING: readonly AllowlistEntry[] = [
  {
    module: "platform/returns/conduct/period-close-subscriber.ts",
    owner: "Mira (Compliance / RegTech engineer)",
    gapId: "GAP-RETURNS-CONDUCT-CHANNEL-AND-FEEDS",
    targetTrigger:
      "Conduct events gain a production emitter + Helena (Chief Risk Officer, governance)/Devon RAS conduct tolerances configured + an FSCA submission channel is defined (this is an FSCA conduct disclosure, not a SARB BA form — the SARB simulator is the wrong channel).",
    citations: [
      "D-RETURNS-SUBMISSION-WIRING-WORKSTREAM",
      "[citation: TBC — FSCA conduct-of-business returns taxonomy; Mira WS-INSTRUMENT-ANALYSES]",
    ],
    closing:
      "WS-RETURNS-SUBMISSION-WIRING — NOT wired: rehearsal-status disclosure + no SARB envelope. `generateConductDisclosure` returns hardcoded `status: 'rehearsal'` (TODO: promote once Helena/Devon RAS tolerances configured), the conduct events have no production emitter, and there is no SARB XML adapter — this is an FSCA conduct disclosure, not a SARB BA-form prudential return submittable via the SARB simulator. Blocked until promoted to a real submission status with a defined channel.",
  },
  {
    module: "platform/returns/cms/period-close-subscriber.ts",
    owner: "Mira (Compliance / RegTech engineer)",
    gapId: "GAP-RETURNS-CMS-FEEDS-AND-CHANNEL",
    targetTrigger:
      "Real TCF metric feeds replace the AlertOpened/ConflictDeclared placeholder-zero proxies + an FSCA submission channel is defined.",
    citations: [
      "D-RETURNS-SUBMISSION-WIRING-WORKSTREAM",
      "[citation: TBC — FSCA TCF/CMS disclosure taxonomy; Mira WS-INSTRUMENT-ANALYSES]",
    ],
    closing:
      "WS-RETURNS-SUBMISSION-WIRING — NOT wired: rehearsal scaffolding. `generateCmsDisclosure` produces `status: 'rehearsal'` with placeholder-zero TCF metrics over AlertOpened/ConflictDeclared proxies (generator header: 'placeholder zeros; status: rehearsal'), and there is no SARB XML submission envelope. Earliest-stage of the three FSCA/TCF disclosures. Blocked until real feeds + a defined channel land.",
  },
  {
    module: "platform/returns/climate/period-close-subscriber.ts",
    owner: "Mira (Compliance / RegTech engineer)",
    gapId: "GAP-RETURNS-CLIMATE-DATA-PROVIDER",
    targetTrigger:
      "Climate-data provider feed lands (real transition/physical scores + Pillar-2 add-on inputs) + a disclosure channel is defined (TCFD/SARB-GN5 Pillar-2 disclosure, not a SARB BA form).",
    citations: [
      "D-RETURNS-SUBMISSION-WIRING-WORKSTREAM",
      "[citation: TBC — SARB Guidance Note 5 climate-risk disclosure; TCFD recommendations]",
    ],
    closing:
      "WS-RETURNS-SUBMISSION-WIRING — NOT wired: rehearsal-status disclosure + no SARB envelope. `generateClimateRiskDisclosure` assigns placeholder transition/physical scores (0) and a placeholder Pillar-2 add-on (0), returning `status: 'rehearsal'` (TODO: climate-data-provider). This is a TCFD/SARB-GN5 Pillar-2 disclosure, not a SARB BA-form prudential return. Blocked until the climate-data feed + a defined channel land.",
  },
];

// ---------------------------------------------------------------------------
// Named tracked deferrals on WIRED returns. These modules ARE wired (the gate
// asserts they have runtime importers — they must NOT appear on the allowlist
// above) but each carries an explicitly-disclosed deferred component. Listed
// here so de-allowlisting a wired return never silently drops the residual
// gap. Surfaced as an info-level note on every run (no silent caps, spec §5).
// ---------------------------------------------------------------------------

export const WIRED_RETURN_COMPONENT_DEFERRALS: readonly WiredComponentDeferral[] = [
  {
    gapId: "GAP-RETURNS-BA400-GROSS-INCOME",
    formId: "BA400",
    module: "platform/returns/ba400/period-close-subscriber.ts",
    title:
      "Gross-income rows sourced from live RevenueRecognitionEmitted events — deferred to commencement-of-trading. Pre-commencement, the subscriber is called with empty gross-income rows; the BIA formula yields zero capital (α × avg(positive annual gross income, 3y) = 0). Zero IS the correct SARB-reportable value for a bank that has not yet commenced trading — NOT an understatement. Identical reasoning to GAP-RETURNS-BA700-OPERATIONAL-RWA on the BA 700 capital-adequacy return.",
    owner: "Bea (Accounting & financial reporting engineer, engineering)",
    targetTrigger:
      "Commencement-of-trading + first audited fiscal year of gross income — at that point real RevenueRecognitionEmitted events start accruing and the gross-income rows must be derived from the income-statement event stream rather than supplied as empty (GAP-RETURNS-BA400-GROSS-INCOME re-opens).",
    citations: [
      "D-TREASURER-WAVE2-SUBSTRATE",
      "D-RETURNS-SUBMISSION-WIRING-WORKSTREAM",
      "D-BA-RETURN-NUMBERING-EXCEL-CANONICAL",
      "Regulations Relating to Banks Reg 33 (operational risk)",
      "BCBS D196 §645–§654 (BIA)",
    ],
  },
  {
    gapId: "GAP-RETURNS-BA700-OPERATIONAL-RWA",
    formId: "BA700",
    module: "platform/returns/ba700/period-close-subscriber.ts",
    title:
      "Operational RWA (BIA, OPE25) held at zero — gross-income-blocked pre-licence. The RwaComputed event of record carries operationalRwaMinor: 0 with operationalRwaIsPlaceholder: true, and the submitted XML discloses the component + source label. NOT an understatement today: with zero gross income since incorporation, alpha × avg(positive annual gross income, 3y) = 0 is the correct BIA value for a pre-commencement bank.",
    owner: "Bea (Accounting & financial reporting engineer) + Mira (Compliance / RegTech engineer)",
    targetTrigger:
      "Commencement-of-trading gross-income event feed lands (RevenueRecognitionEmitted) — first non-zero audited gross-income year makes the zero a real understatement; the BIA computation must be live by then.",
    citations: [
      "D-RWA-ENGINE-W2-SLICE-3",
      "D-RETURNS-SUBMISSION-WIRING-WORKSTREAM",
      "[citation: TBC — BCBS OPE25 (Basic Indicator Approach); Regulations Relating to Banks Reg 33]",
    ],
  },
  {
    gapId: "GAP-BA300-NSFR-HQLA-LEVEL1-RSF",
    formId: "BA300",
    module: "platform/returns/ba300/period-close-subscriber.ts",
    title:
      "NSFR RSF component: HQLA Level-1 RSF (5% factor) held at zero — requires the unified-position × SecurityMaster fold (Slice-6+). The NSFRRatioProjection event carries rsfHqla: 0 in the components breakdown. The zero is a conservative overstatement of the NSFR ratio (excluding a small RSF item makes the ratio appear slightly better than it would be with it). Also deferred: zarFinCorpShortTermFundingZAR = 0 (no dedicated event type pre-Slice-6+). Both are surfaced as substrate gaps in ba-300-nsfr.ts.",
    owner:
      "Ravi (ALM / treasury engineer, engineering) + Mira (Compliance / RegTech engineer, engineering)",
    targetTrigger:
      "Unified-position × SecurityMaster fold lands (Slice-6+) — at that point the HQLA Level-1 stock is queryable at period-end for the RSF 5% component; zarFinCorpShortTerm requires a dedicated funding-line event subtype.",
    citations: [
      "D-TREASURER-WAVE2-SUBSTRATE",
      "D-BA-RETURN-NUMBERING-EXCEL-CANONICAL",
      "BCBS 295 §128 Table 2 (HQLA Level-1 RSF 5%)",
      "Regulations Relating to Banks Reg 26A",
    ],
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
 * @param componentDeferrals  named deferrals on WIRED returns (or a test fixture).
 */
export function computeViolations(
  watched: readonly string[],
  allowlist: readonly AllowlistEntry[],
  isWired: (moduleRelPath: string) => boolean,
  componentDeferrals: readonly WiredComponentDeferral[] = [],
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

  // 4. NAMED-DEFERRAL WELL-FORMEDNESS (WS-RETURNS-SUBMISSION-WIRING Wave B,
  //    ProductDeferredGap pattern): every allowlist entry must be a NAMED
  //    tracked deferral — non-empty gapId, targetTrigger, and at least one
  //    citation. A hollow deferral (prose with no name / trigger / citation)
  //    is exactly the silent-suppression shape this gate exists to prevent.
  for (const entry of allowlist) {
    const hollow: string[] = [];
    if (entry.gapId.trim() === "") hollow.push("gapId");
    if (entry.targetTrigger.trim() === "") hollow.push("targetTrigger");
    if (entry.citations.length === 0 || entry.citations.some((c) => c.trim() === "")) {
      hollow.push("citations");
    }
    if (hollow.length > 0) {
      violations.push({
        subject: entry.module,
        message: `Allowlist entry for "${entry.module}" is a HOLLOW deferral — missing/empty: ${hollow.join(", ")}. Every KNOWN_INERT_PENDING_WIRING entry must be a NAMED tracked deferred gap (gapId + targetTrigger + citations; ProductDeferredGap pattern per D-FX-OTC-NPA-SCOPE-EXPANSION, applied to returns by WS-RETURNS-SUBMISSION-WIRING Wave B).`,
        severity: "fail",
      });
    }
  }

  // 5. WIRED-COMPONENT DEFERRALS: each must reference a module that IS wired
  //    (a component deferral on an unwired module belongs on the allowlist
  //    instead), must be well-formed, and must not duplicate an allowlist
  //    module (a module is either inert-deferred or wired-with-component-
  //    deferral, never both).
  for (const gap of componentDeferrals) {
    const hollow: string[] = [];
    if (gap.gapId.trim() === "") hollow.push("gapId");
    if (gap.targetTrigger.trim() === "") hollow.push("targetTrigger");
    if (gap.citations.length === 0 || gap.citations.some((c) => c.trim() === "")) {
      hollow.push("citations");
    }
    if (hollow.length > 0) {
      violations.push({
        subject: gap.gapId === "" ? gap.module : gap.gapId,
        message: `WIRED_RETURN_COMPONENT_DEFERRALS entry for "${gap.module}" is a HOLLOW deferral — missing/empty: ${hollow.join(", ")}.`,
        severity: "fail",
      });
    }
    if (allowlisted.has(gap.module)) {
      violations.push({
        subject: gap.gapId,
        message: `"${gap.module}" appears BOTH on KNOWN_INERT_PENDING_WIRING and in WIRED_RETURN_COMPONENT_DEFERRALS — a module is either inert-deferred (unwired) or wired-with-component-deferral, never both. Remove one.`,
        severity: "fail",
      });
    } else if (!isWired(gap.module)) {
      violations.push({
        subject: gap.gapId,
        message: `WIRED_RETURN_COMPONENT_DEFERRALS entry "${gap.gapId}" references "${gap.module}" which has NO runtime/dashboard importer — a component deferral only makes sense on a WIRED return. If the module is inert, track it on KNOWN_INERT_PENDING_WIRING instead.`,
        severity: "fail",
      });
    } else {
      // Visible, never silent: each live component deferral is surfaced.
      violations.push({
        subject: gap.gapId,
        message: `Named tracked component deferral on WIRED return ${gap.formId} ("${gap.module}"): ${gap.title} Owner: ${gap.owner}. Re-opens at: ${gap.targetTrigger}`,
        severity: "info",
      });
    }
  }

  // No silent caps (spec §5): surface the count of known-inert (allowlisted)
  // modules as an info-level note so the suppression is visible, never hidden.
  if (inertCount > 0) {
    const gapIds = allowlist.map((e) => e.gapId).join(", ");
    violations.push({
      subject: "known-inert-pending-wiring",
      message: `${inertCount} watched module(s) are inert (built + tested, no runtime/dashboard importer); ${allowlist.length} are tracked on KNOWN_INERT_PENDING_WIRING as NAMED deferred gaps [${gapIds}], each with an owner + target trigger + citations (D-COMPLETENESS-AUDIT-WORKSTREAM; D-RETURNS-SUBMISSION-WIRING-WORKSTREAM Wave B — remaining deferrals are genuinely blocked, with an accurate not-production-ready blocker). The count is logged so the suppression is never silent.`,
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

  // 2 + 3 + 4 + 5 + count — delegate to the pure builder with the filesystem
  // predicate.
  const { violations } = computeViolations(
    watched,
    KNOWN_INERT_PENDING_WIRING,
    (mod) => hasRuntimeImporter(prototypeDir, mod),
    WIRED_RETURN_COMPONENT_DEFERRALS,
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
        `${knownInert} known-inert pending-wiring (named tracked deferrals: ` +
        `${KNOWN_INERT_PENDING_WIRING.map((e) => e.gapId).join(", ")}), 0 untracked inert; ` +
        `${WIRED_RETURN_COMPONENT_DEFERRALS.length} named component deferral(s) on wired returns ` +
        `(${WIRED_RETURN_COMPONENT_DEFERRALS.map((g) => g.gapId).join(", ")}).`,
    );
    process.exit(0);
  }
  console.error(
    `\nrecon:${PIPELINE} FAILED — ${fails.length} untracked inert module(s) of ${r.asserted} checked`,
  );
  process.exit(1);
}
