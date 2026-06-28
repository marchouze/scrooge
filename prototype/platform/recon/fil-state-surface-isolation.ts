// platform/recon/fil-state-surface-isolation.ts
//
// recon:fil-state-surface-isolation — FIL consumer-surface isolation gate.
//
// WHY THIS EXISTS
// ---------------
// The defect behind #1510 (GL still showing cancelled FX) was that the
// ACCOUNTING engine derived its GL state by REPLAYING raw `FilInstrument*`
// lifecycle events and dispatching a per-event `switch (p.kind)` — so it had to
// be hand-taught to handle `cancelled`. That is the anti-pattern the FIL model
// exists to remove: a consumer must bind to the FIL STATE surface (the register
// `stage`/`economicTerms`), not re-fold the lifecycle stream.
//
// After the Step C cutover (#1512/#1513 FX, #1514 capital) the GL trial balance
// (`platform/projections/gl-projection-v2.ts`) sources its FX and capital legs
// from the STATE-DRIVEN derivations (`deriveFxInstanceLegs`,
// `deriveCapitalInstanceLegs`), which read the FIL register. The old event folds
// (`foldFxContributionLegs`, `foldCapitalContributionLegs`) are NO LONGER
// consumed by any production path — they survive ONLY as the independent
// equivalence ORACLE in `recon:gl-v2-fold-equivalence-fx`.
//
// THIS GATE locks that in. It is the Step-D enforcement of
// D-FIL-CONSUMER-SURFACE-ARCHITECTURE: the accounting / GL production surface
// may NOT replay `FilInstrument*` (or the FX / capital lifecycle event-type
// constants) FOR STATE except through the allowlisted state-derivation modules.
// Post-cutover there are ZERO production violations, so this lands straight to
// ENFORCING / fail-closed (no advisory soak needed).
//
// SCOPE — the accounting / GL state surface
// -----------------------------------------
// The surface this gate governs is the production code that produces GL legs /
// the trial balance: every non-test `.ts` under `platform/accounting/` plus the
// GL projection `platform/projections/gl-projection-v2.ts`. RISK consumers
// (VaR / P&L / SA-CCR / ALM) replay the lifecycle stream for FLOW / exposure,
// not for GL state, and are out of this gate's scope — the FIL-state surface
// this gate enforces is the accounting one (the one the plan identified as the
// inconsistent consumer; risk already binds to the register surface correctly).
//
// THE INVARIANT (two parts)
// -------------------------
//   (A) ALLOWLIST. Within the accounting / GL surface, only the explicit
//       state-derivation modules may replay a `FilInstrument*` / FX-FIL /
//       capital lifecycle type or iterate the FX / capital event-type constants:
//         - platform/accounting/posting-rules-v2/fx-instance-fold.ts
//         - platform/accounting/posting-rules-v2/capital-instance-fold.ts
//       Any OTHER accounting / GL production file that replays `FilInstrument*`
//       for state (a re-introduced raw-event fold in the projection, a dashboard
//       posting path, a new posting module) is a violation.
//
//   (B) ORACLE-ONLY. The retired event folds (`fx-fold.ts`, `capital-fold.ts`)
//       are PERMITTED to replay `FilInstrument*` — but ONLY because they are
//       reachable solely from recon oracles and tests. The gate asserts they are
//       NOT imported by any PRODUCTION (non-test, non-recon) consumer. The moment
//       a production path imports `foldFxContributionLegs` /
//       `foldCapitalContributionLegs`, the oracle-only guarantee is broken and
//       the gate fails — that is what keeps the event folds retired.
//
// DETECTION. Static source scan (the runtime complement is
// `recon:gl-v2-fold-equivalence-fx`, which proves the state path reproduces the
// golden + event fold byte-for-byte). Comment lines are skipped so documentary
// prose (including this file) does not trip the scanner. `prototypeDir` is
// injectable so the negative test can drive the scanner against a synthetic tree.
//
// Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE (CEO-approved 2026-06-22);
//   cites D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-DERIVED-EVENT-IRREDUCIBILITY-TEST;
//   D-ENGINEERING-INTEGRITY-CHARTER (fail-closed; no green by concealment;
//   ratchets harden only). Principle 1; Principle 2.
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fil-state-surface-isolation";

/**
 * Ratchet switch (Charter cmd 3). `true` = enforcing (any violation exits
 * non-zero). Post-cutover the accounting / GL surface has ZERO production
 * `FilInstrument*` state replays, so this lands directly enforcing. Hardens only
 * — never relax to `false`.
 */
const ENFORCING = true;

// ---------------------------------------------------------------------------
// (A) The accounting / GL state surface + the allowlist of state-derivation
// modules permitted to replay the FIL lifecycle for state.
// ---------------------------------------------------------------------------

/**
 * Directories whose every non-test `.ts` file is part of the accounting / GL
 * state surface this gate governs (relative to `prototype/`).
 */
const SURFACE_DIRS: readonly string[] = ["platform/accounting"];

/**
 * Individual files (outside SURFACE_DIRS) that are part of the GL state surface.
 * The GL projection is the trial-balance path; it MUST source FX / capital legs
 * via the state derivations, never by replaying `FilInstrument*` itself.
 */
const SURFACE_FILES: readonly string[] = ["platform/projections/gl-projection-v2.ts"];

/**
 * State-derivation modules — the ONLY accounting / GL surface files permitted to
 * replay `FilInstrument*` for state. They read the FIL STATE register
 * (`foldFilInstances`) for structure and source per-event FLOW amounts from the
 * grouped lifecycle payloads. This is the sanctioned consumer surface.
 */
const STATE_DERIVATION_ALLOWLIST: ReadonlySet<string> = new Set([
  "platform/accounting/posting-rules-v2/fx-instance-fold.ts",
  "platform/accounting/posting-rules-v2/capital-instance-fold.ts",
  // Born-V2 loan-origination EAD derivation (L5-FTR loan-origination slice;
  // D-BA-RETURN-CELL-VALUE-ENGINE item #2). Reads the FIL STATE register
  // (`foldFilInstances`) for the live-loan set + stage and the CREATED payload for
  // the FLOW amount + loanTerms — the sanctioned consumer surface the ECL
  // `readDebtExposures` calls instead of replaying FIL itself.
  "platform/accounting/posting-rules-v2/loan-instance-fold.ts",
]);

/**
 * Retired event-fold modules — permitted to replay `FilInstrument*` ONLY as
 * recon oracles (part (B) asserts no production importer). They are NOT part of
 * the production allowlist: their being reachable only from recon/tests is what
 * the oracle-only check guarantees.
 */
const ORACLE_FOLD_FILES: ReadonlySet<string> = new Set([
  "platform/accounting/posting-rules-v2/fx-fold.ts",
  "platform/accounting/posting-rules-v2/capital-fold.ts",
]);

// The FIL lifecycle event types that, when replayed FOR STATE, this gate guards.
// A replay of any of these (or an iteration of a constant naming the family) on
// the accounting / GL surface outside the allowlist is a violation.
const FIL_LIFECYCLE_EVENT_TYPES: readonly string[] = [
  "FilInstrumentCreated",
  "FilInstrumentAmended",
  "FilInstrumentTerminated",
  "FilFxSettlementConfirmed",
  "FilNdfFixingObserved",
];

// Iterated event-type constants that stand in for the family in a fold loop
// (`for (const t of FX_FIL_EVENT_TYPES) ... replay({ type: t })`). Replaying via
// such a constant is equally a state replay of the family.
const FIL_EVENT_TYPE_CONSTANTS: readonly string[] = [
  "FX_FIL_EVENT_TYPES",
  "CAPITAL_FIL_EVENT_TYPES",
  "REGISTER_EVENT_KIND_LIST",
];

// The retired event-fold exported functions — a production import of either is a
// part-(B) oracle-only violation.
const ORACLE_FOLD_EXPORTS: readonly string[] = [
  "foldFxContributionLegs",
  "foldCapitalContributionLegs",
];

const EXCLUDE_DIRS: ReadonlySet<string> = new Set(["node_modules", ".local"]);

// ---------------------------------------------------------------------------
// Filesystem helpers (mirrors event-store-no-delete-callsite).
// ---------------------------------------------------------------------------

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const PROTOTYPE_DIR = resolve(REPO_ROOT, "prototype");

function listTsFiles(dir: string, base: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name) || name.startsWith(".")) continue;
    const full = join(dir, name);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      listTsFiles(full, base, out);
    } else if (st.isFile() && (name.endsWith(".ts") || name.endsWith(".tsx"))) {
      out.push(full.startsWith(`${base}/`) ? full.slice(base.length + 1) : full);
    }
  }
}

function readIf(prototypeDir: string, rel: string): string | undefined {
  try {
    return readFileSync(resolve(prototypeDir, rel), "utf8");
  } catch {
    return undefined;
  }
}

/** Non-comment source lines, paired with their 1-based line number. */
function codeLines(src: string): Array<{ line: number; text: string }> {
  const out: Array<{ line: number; text: string }> = [];
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i] ?? "";
    const trimmed = text.trimStart();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
    out.push({ line: i + 1, text });
  }
  return out;
}

function isTestFile(rel: string): boolean {
  return rel.endsWith(".test.ts") || rel.endsWith(".test.tsx") || rel.includes("/__tests__/");
}

function isReconFile(rel: string): boolean {
  return rel.startsWith("platform/recon/");
}

// ---------------------------------------------------------------------------
// (A) Detect a FIL lifecycle STATE replay on a surface line.
//
// A "state replay" is a `.replay({ ... })` call whose `type` is a FIL lifecycle
// event literal, OR a `for (const t of <FIL constant>)` loop that feeds a
// `replay({ type: t })`. We detect the explicit-literal replay directly, and the
// constant-driven loop by the presence of an iterated FIL event-type constant in
// a `for (... of ...)` whose body (same file) calls `replay({ type: t })`.
// ---------------------------------------------------------------------------

export interface SurfaceReplay {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
  readonly kind: "literal-replay" | "constant-loop";
  readonly match: string;
}

function detectStateReplays(rel: string, src: string): SurfaceReplay[] {
  const found: SurfaceReplay[] = [];
  const lines = codeLines(src);

  // Explicit-literal replays: a code line that both calls `.replay(` and names a
  // FIL lifecycle event-type literal.
  const replaysOnLine = (text: string): boolean => /\.replay\s*\(/.test(text);
  for (const { line, text } of lines) {
    if (!replaysOnLine(text)) continue;
    for (const t of FIL_LIFECYCLE_EVENT_TYPES) {
      if (text.includes(`"${t}"`) || text.includes(`'${t}'`)) {
        found.push({
          file: rel,
          line,
          snippet: text.trim().slice(0, 120),
          kind: "literal-replay",
          match: t,
        });
        break;
      }
    }
  }

  // Constant-driven loops: an iterated FIL event-type constant anywhere in the
  // file PLUS a `replay({ type: t })` somewhere in the same file. This is the
  // `for (const t of FX_FIL_EVENT_TYPES) { ... replay({ type: t }) }` shape. We
  // attribute it to the line that declares the iteration over the constant.
  const fileNamesAReplayByVar = lines.some((l) =>
    /\.replay\s*\(\s*\{[^}]*type:\s*\w+/.test(l.text),
  );
  if (fileNamesAReplayByVar) {
    for (const { line, text } of lines) {
      for (const c of FIL_EVENT_TYPE_CONSTANTS) {
        // Only an ITERATION over the constant counts (`of <constant>`), not its
        // declaration. The declaration lines `const FX_FIL_EVENT_TYPES = [...]`
        // are skipped (no `of` before the name).
        if (new RegExp(`\\bof\\s+${c}\\b`).test(text)) {
          found.push({
            file: rel,
            line,
            snippet: text.trim().slice(0, 120),
            kind: "constant-loop",
            match: c,
          });
        }
      }
    }
  }

  return found;
}

// ---------------------------------------------------------------------------
// (B) Detect a PRODUCTION import of a retired event-fold export.
// ---------------------------------------------------------------------------

export interface OracleImport {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
  readonly importedSymbol: string;
}

function detectProductionOracleImports(rel: string, src: string): OracleImport[] {
  const found: OracleImport[] = [];
  const lines = codeLines(src);
  for (const { line, text } of lines) {
    if (!/\bimport\b/.test(text)) continue;
    for (const sym of ORACLE_FOLD_EXPORTS) {
      if (new RegExp(`\\b${sym}\\b`).test(text)) {
        found.push({
          file: rel,
          line,
          snippet: text.trim().slice(0, 120),
          importedSymbol: sym,
        });
      }
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------

export interface RunOpts {
  /** Override prototype dir (for tests). */
  prototypeDir?: string;
}

export interface IsolationRunResult extends ReconResult {
  readonly surfaceReplays: SurfaceReplay[];
  readonly productionOracleImports: OracleImport[];
}

export function run(opts: RunOpts = {}): IsolationRunResult {
  const prototypeDir = opts.prototypeDir ?? PROTOTYPE_DIR;
  const base = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  let asserted = 0;

  // ----- Part (A): accounting / GL surface state-replay allowlist. -----
  const surfaceFiles: string[] = [];
  for (const dir of SURFACE_DIRS) {
    listTsFiles(resolve(prototypeDir, dir), prototypeDir, surfaceFiles);
  }
  for (const f of SURFACE_FILES) {
    if (existsSync(resolve(prototypeDir, f))) surfaceFiles.push(f);
  }

  const surfaceReplays: SurfaceReplay[] = [];
  for (const rel of surfaceFiles) {
    // Tests are not production consumers — they exercise both folds legitimately.
    if (isTestFile(rel)) continue;
    // The two sanctioned state-derivation modules are the consumer surface.
    if (STATE_DERIVATION_ALLOWLIST.has(rel)) continue;
    // The retired event folds are handled by part (B) (oracle-only), not by the
    // surface allowlist — they MAY replay; the constraint is no production
    // importer. Skip them here so they are not double-counted as surface
    // violations.
    if (ORACLE_FOLD_FILES.has(rel)) continue;

    const src = readIf(prototypeDir, rel);
    if (src === undefined) continue;
    surfaceReplays.push(...detectStateReplays(rel, src));
  }
  asserted += 1;
  for (const r of surfaceReplays) {
    violations.push({
      subject: `${PIPELINE}:surface-state-replay:${r.file}:${r.line}`,
      message: [
        `Accounting / GL surface file ${r.file}:${r.line} replays the FIL lifecycle for STATE (${r.kind}, ${r.match}).`,
        "The accounting / GL trial-balance surface must source FX / capital legs from the state-derivation",
        "modules (deriveFxInstanceLegs / deriveCapitalInstanceLegs), which read the FIL STATE register —",
        "never by replaying FilInstrument* itself. Re-introducing a raw-event fold here is the anti-pattern",
        "D-FIL-CONSUMER-SURFACE-ARCHITECTURE retired (the cancelled-FX defect of #1510).",
        `Snippet: ${r.snippet}`,
        "If this is a NEW sanctioned state-derivation module, add it to STATE_DERIVATION_ALLOWLIST in",
        "platform/recon/fil-state-surface-isolation.ts with a rationale. Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE.",
      ].join("\n"),
      severity: ENFORCING ? "fail" : "warn",
    });
  }

  // ----- Part (B): retired event folds must be oracle-only. -----
  // Scan the WHOLE tree for production (non-test, non-recon) imports of the
  // retired event-fold exports. The state-derivation modules import TYPES /
  // helpers from the fold files (decideFxTreatment, leg types) — those are NOT
  // the fold FUNCTIONS, so they are not flagged; only an import that pulls in
  // `foldFxContributionLegs` / `foldCapitalContributionLegs` counts.
  const allFiles: string[] = [];
  listTsFiles(prototypeDir, prototypeDir, allFiles);
  const productionOracleImports: OracleImport[] = [];
  for (const rel of allFiles) {
    if (isTestFile(rel)) continue; // tests legitimately import the oracle for cross-checks.
    if (isReconFile(rel)) continue; // recon oracles legitimately import the event fold.
    const src = readIf(prototypeDir, rel);
    if (src === undefined) continue;
    productionOracleImports.push(...detectProductionOracleImports(rel, src));
  }
  asserted += 1;
  for (const imp of productionOracleImports) {
    violations.push({
      subject: `${PIPELINE}:oracle-fold-production-import:${imp.file}:${imp.line}`,
      message: [
        `Production file ${imp.file}:${imp.line} imports the retired event-fold export ${imp.importedSymbol}.`,
        "The event folds (foldFxContributionLegs / foldCapitalContributionLegs) are RETIRED from production",
        "(Step D, D-FIL-CONSUMER-SURFACE-ARCHITECTURE): they survive ONLY as the equivalence ORACLE in",
        "recon:gl-v2-fold-equivalence-fx and as test cross-checks. A production import re-couples the GL state",
        "path to a raw-event fold — the exact regression this gate exists to prevent.",
        `Snippet: ${imp.snippet}`,
        "Route production GL state through deriveFxInstanceLegs / deriveCapitalInstanceLegs instead.",
        "Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE.",
      ].join("\n"),
      severity: ENFORCING ? "fail" : "warn",
    });
  }

  const result = base as IsolationRunResult & {
    surfaceReplays: SurfaceReplay[];
    productionOracleImports: OracleImport[];
  };
  result.asserted = asserted;
  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.surfaceReplays = surfaceReplays;
  result.productionOracleImports = productionOracleImports;
  result.asOf = `${PIPELINE}: surface files=${surfaceFiles.length}, surface state-replays=${surfaceReplays.length}, production oracle imports=${productionOracleImports.length}. ${
    result.ok ? "ISOLATED (FIL state surface intact)" : "VIOLATION"
  }.`;
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}:\n${v.message}\n\n`);
  }
  process.stdout.write(`\nrecon:${PIPELINE} ${r.ok ? "OK" : "FAIL"}\n${r.asOf}\n`);
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      surfaceStateReplays: r.surfaceReplays.length,
      productionOracleImports: r.productionOracleImports.length,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.asOf,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
