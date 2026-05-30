// platform/recon/market-data-provenance-gate.ts
//
// Continuous-controls pipeline: market-data provenance filter gate.
//
// Every production call to MarketDataStore.query() or .getLatest() that
// retrieves data for valuation, marking-to-market, or rate reference MUST
// include a `provenance` filter — either "production" or "simulated" — so
// that simulation ticks cannot silently contaminate live valuations.
//
// This scanner statically asserts that every .query( and .getLatest( call
// in production source includes a provenance argument. It exempts:
//   1. Test files (*.test.ts, */__tests__/*)
//   2. Simulation / env-sim paths (*/env-sim/*, */simulation/*)
//   3. Dedup-pattern calls — write-path lookups that use `source`-based
//      dedup (e.g. `const existing = mdStore.query({ source: "jse-sens" })`)
//      are NOT valuation reads and do not need a provenance filter. Detected
//      when the containing line or the two lines above contain "existing",
//      "dedup", or "existingIds".
//
// SECOND ASSERTION (D-MARKET-DATA-PROVENANCE-ISOLATION-HARDENING, 2026-05-30):
// the call-site grep is a convention nudge, not the load-bearing guarantee. The
// real guarantee is that the MarketDataStore READ surface is production-only by
// default at the type/signature level, so a forgotten filter can never silently
// adopt a simulated tick. This pipeline now ALSO structurally asserts that
// `store.ts` keeps:
//   - `getLatest(... provenance: ... = "production")` — a default-production
//     provenance parameter, and
//   - `query()` defaulting to `"production"` when `opts.provenance` is omitted.
// If a future edit drops either default, this gate fails even if no call-site
// changed.
//
// Authority:
//   D-MARKETS-SCHEMA-FOUNDATION; D-MARKET-DATA-PROVENANCE-ISOLATION-HARDENING;
//   Policies/valuation-policy-v1.md §4.3
//
// Author: Vera (Internal audit / continuous-assurance engineer, engineering)

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// ---------------------------------------------------------------------------
// Scan targets
// ---------------------------------------------------------------------------

/** Directories under prototype/ to scan. */
const SCAN_ROOTS = ["platform", "scripts/agents"];

/** Path fragments that exempt a file from scanning. */
const EXCLUDE_PATH_FRAGMENTS: ReadonlyArray<string> = ["/env-sim/", "/simulation/", "/__tests__/"];

/** Directories to skip entirely during recursive walk. */
const EXCLUDE_DIRS: ReadonlySet<string> = new Set(["node_modules", ".local", "scenarios", "tests"]);

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/** Method-call patterns that must be accompanied by a `provenance` filter. */
const CALL_PATTERNS = [".query(", ".getLatest("];

/**
 * Context strings that indicate a dedup pattern — the call is a write-path
 * source-based dedup lookup, not a valuation read.
 */
const DEDUP_CONTEXT_STRINGS = ["existing", "dedup", "existingIds", "existing.map"];

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ProvenanceViolation {
  readonly file: string;
  readonly line: number;
  readonly code: string;
}

export interface RunOpts {
  /** Override the prototype directory (for tests). */
  prototypeDir?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found)");
}

function collectTsFiles(dir: string, out: string[]): void {
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
      collectTsFiles(full, out);
    } else if (st.isFile() && name.endsWith(".ts")) {
      out.push(full);
    }
  }
}

function isExcluded(absPath: string): boolean {
  // Exclude test files.
  if (absPath.endsWith(".test.ts")) return true;
  // Exclude path fragments (env-sim, simulation, __tests__).
  for (const frag of EXCLUDE_PATH_FRAGMENTS) {
    if (absPath.includes(frag)) return true;
  }
  return false;
}

function isDedupContext(lines: string[], lineIdx: number): boolean {
  // Check the call line and the two lines immediately above it.
  const start = Math.max(0, lineIdx - 2);
  for (let i = start; i <= lineIdx; i++) {
    const text = lines[i] ?? "";
    for (const ctx of DEDUP_CONTEXT_STRINGS) {
      if (text.includes(ctx)) return true;
    }
  }
  return false;
}

function hasProvenanceFilter(lines: string[], lineIdx: number): boolean {
  // Check the call line and up to four following lines (multi-line argument
  // objects span several lines). Stop at a closing parenthesis.
  const limit = Math.min(lines.length - 1, lineIdx + 4);
  for (let i = lineIdx; i <= limit; i++) {
    const text = lines[i] ?? "";
    if (text.includes("provenance")) return true;
    // If we see the closing paren (end of call) without finding provenance, stop.
    if (i > lineIdx && text.includes(")")) break;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

function scanFiles(prototypeDir: string): ProvenanceViolation[] {
  const violations: ProvenanceViolation[] = [];

  const allFiles: string[] = [];
  for (const root of SCAN_ROOTS) {
    collectTsFiles(resolve(prototypeDir, root), allFiles);
  }

  for (const absPath of allFiles) {
    if (isExcluded(absPath)) continue;
    // Skip this recon file itself.
    if (absPath.endsWith("market-data-provenance-gate.ts")) continue;

    let src: string;
    try {
      src = readFileSync(absPath, "utf8");
    } catch {
      continue;
    }

    const lines = src.split(/\r?\n/);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx] ?? "";

      // Skip pure comment lines.
      const trimmed = line.trimStart();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

      for (const pattern of CALL_PATTERNS) {
        if (!line.includes(pattern)) continue;

        // Exempt dedup-pattern calls.
        if (isDedupContext(lines, lineIdx)) continue;

        // Check for provenance filter.
        if (!hasProvenanceFilter(lines, lineIdx)) {
          violations.push({
            file: absPath.startsWith(`${prototypeDir}/`)
              ? absPath.slice(prototypeDir.length + 1)
              : absPath,
            line: lineIdx + 1,
            code: line.trim().slice(0, 120),
          });
        }
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Structural signature assertion
// ---------------------------------------------------------------------------

/**
 * Assert that `platform/market-data/store.ts` keeps the production-only default
 * on both read methods. Returns a list of violations (empty when intact).
 *
 * We assert against the source text (not a runtime probe) so the gate has no
 * dependency on a live store and can run in the static recon suite.
 */
function assertStoreSignatures(prototypeDir: string): ReconViolation[] {
  const storePath = resolve(prototypeDir, "platform/market-data/store.ts");
  const rel = "platform/market-data/store.ts";
  // When store.ts is absent (e.g. the recon's own temp-dir unit tests that scan
  // synthetic fixtures), there is nothing to assert — skip rather than fail.
  if (!existsSync(storePath)) return [];
  let src: string;
  try {
    src = readFileSync(storePath, "utf8");
  } catch {
    return [
      {
        subject: rel,
        message: `Cannot read ${rel} to verify production-only default signatures.`,
        severity: "fail" as const,
      },
    ];
  }

  // Normalise whitespace so multi-line signatures collapse to a single line.
  const flat = src.replace(/\s+/g, " ");
  const violations: ReconViolation[] = [];

  // 1. getLatest must carry a provenance parameter defaulting to "production".
  //    Matches: provenance: <type> = "production"  (within the getLatest sig).
  const getLatestDefault = /getLatest\s*\([^)]*provenance\s*:\s*[^=)]*=\s*["']production["']/.test(
    flat,
  );
  if (!getLatestDefault) {
    violations.push({
      subject: `${rel}:getLatest`,
      message: [
        "MarketDataStore.getLatest() must declare a `provenance` parameter defaulting to",
        '"production" so a read that omits it can never silently adopt a simulated tick.',
        'Expected signature shape: getLatest(source, instrument, asOf?, provenance = "production").',
        "Authority: D-MARKET-DATA-PROVENANCE-ISOLATION-HARDENING.",
      ].join("\n"),
      severity: "fail" as const,
    });
  }

  // 2. query() must default to production when opts.provenance is omitted.
  //    Matches: opts.provenance ?? "production"
  const queryDefault = /opts\.provenance\s*\?\?\s*["']production["']/.test(flat);
  if (!queryDefault) {
    violations.push({
      subject: `${rel}:query`,
      message: [
        'MarketDataStore.query() must default to provenance "production" when omitted',
        '(expected: `opts.provenance ?? "production"`), so a forgotten filter cannot mix',
        'simulated ticks into a valuation read. Use the explicit "all" selector to opt out.',
        "Authority: D-MARKET-DATA-PROVENANCE-ISOLATION-HARDENING.",
      ].join("\n"),
      severity: "fail" as const,
    });
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult & { callsChecked: number } {
  const result = emptyResult("market-data-provenance-gate") as ReconResult & {
    callsChecked: number;
  };
  result.callsChecked = 0;

  const REPO_ROOT = findRepoRoot(import.meta.dir);
  const prototypeDir = opts.prototypeDir ?? resolve(REPO_ROOT, "prototype");

  const violations = scanFiles(prototypeDir);

  // Count total call-sites scanned (compliant + violations) — for the pass
  // message. We re-scan to count compliant ones.
  let totalCallsites = 0;
  {
    const allFiles: string[] = [];
    for (const root of SCAN_ROOTS) {
      collectTsFiles(resolve(prototypeDir, root), allFiles);
    }
    for (const absPath of allFiles) {
      if (isExcluded(absPath)) continue;
      if (absPath.endsWith("market-data-provenance-gate.ts")) continue;
      let src: string;
      try {
        src = readFileSync(absPath, "utf8");
      } catch {
        continue;
      }
      const lines = src.split(/\r?\n/);
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx] ?? "";
        const trimmed = line.trimStart();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
        for (const pattern of CALL_PATTERNS) {
          if (line.includes(pattern)) totalCallsites++;
        }
      }
    }
  }
  result.callsChecked = totalCallsites;
  result.asserted = totalCallsites;

  const reconViolations: ReconViolation[] = violations.map((v) => ({
    subject: `${v.file}:${v.line}`,
    message: [
      `MarketDataStore call missing \`provenance\` filter at ${v.file}:${v.line}`,
      `  ${v.code}`,
      "Every production query/getLatest call must include provenance: 'production' | 'simulated'",
      "to prevent simulation ticks from contaminating live valuations.",
      "Authority: D-MARKETS-SCHEMA-FOUNDATION; Policies/valuation-policy-v1.md §4.3",
    ].join("\n"),
    severity: "fail" as const,
  }));

  // Fold in the structural signature assertion: production-only-by-default must
  // survive future edits to the store regardless of any call-site change.
  reconViolations.push(...assertStoreSignatures(prototypeDir));

  result.violations = reconViolations;
  result.ok = reconViolations.length === 0;
  return result;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  if (r.ok) {
    console.log(
      `[PASS] market-data-provenance-gate: ${r.callsChecked} calls checked, 0 violations`,
    );
    process.exit(0);
  } else {
    console.error(`[FAIL] market-data-provenance-gate: ${r.violations.length} violation(s)`);
    for (const v of r.violations) {
      console.error(`\n${v.message}`);
    }
    process.exit(1);
  }
}
