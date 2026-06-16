// platform/recon/no-hardcoded-reporting-currency.ts
//
// Continuous-controls gate: no-hardcoded-reporting-currency (ENFORCING).
// Workstream: WS-MULTI-BASE-CURRENCY. Authority: D-MULTI-BASE-CURRENCY-FOUNDATION
// (CEO-approved 2026-06-16); Engineering Charter cmd 2 (fail-closed) + cmd 4
// (source, don't hardcode); Principle 5.
//
// ## What it asserts
//
// No LITERAL reporting/base currency appears in the V2 FX valuation path. Before
// WS-MULTI-BASE-CURRENCY the valuation path baked in a single ZAR reporting
// currency via `FX_REPORTING_CURRENCY = "ZAR"` and 13 `pos.reporting ?? "ZAR"`
// fallbacks. Those silently translated any unresolved position to ZAR — the exact
// debt this gate keeps from returning. "Foreign vs. domestic" is a view-time
// comparison against the HOLDING ENTITY'S FUNCTIONAL currency (resolved via
// `resolveReportingCurrency`), never a literal.
//
// ## Detection (regex scan over the valuation-path files)
//
//   1. `?? "<CCY>"` — a nullish-coalescing fallback to a literal currency, where
//      it is used as a reporting/base default (the `reporting ?? "…"` pattern and
//      any 3-letter-currency `?? "…"` in scope).
//   2. `reporting = "<CCY>"` / `reporting: "<CCY>"` literal default — a hardcoded
//      reporting-currency default (assignment, default-parameter, or object key).
//   3. `FX_REPORTING_CURRENCY` used outside the frozen v1-methodology-hash token
//      (the v1 hash is the ONE permitted historical reference; the runtime
//      constant export is gone).
//
// ## Scope
//
// Production valuation-path source only — ALL FIL-model directories:
//   - `v2-core/fil-models/**`   (fx spot/forward/swap/ndf, fx-valuation, the
//                                Phase 3b `ir/money-market/**` amortised-cost
//                                models, the Phase 3c `ir/bond/**` FVTPL bond,
//                                and every future FIL model)
// Widened from the original fx-only roots (`fx`, `fx-valuation`) so the gate
// mechanically covers EVERY FIL model — the bond and money-market models, and
// anything added later — without re-touching this gate (D-V1-REMOVAL-PHASE-3C,
// closing the 3b substrate gap). Excludes `*.test.ts` / `*.spec.ts` (the SA-anchor
// unit tests legitimately pin the anchor's functional currency ZAR as fixture
// data) and this gate itself.
//
// Harden-only: the valuation-path debt was REMOVED in the same PR, so the
// expected violation count is ZERO. There is no allowlist — any literal reporting
// currency in the valuation path is a NEW violation and fails the gate (exit 1).
//
// Author: Atlas (Core banking platform architect, engineering) ·
//         Vera (Internal audit engineer, third line — recon shape).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// ---------------------------------------------------------------------------
// Path resolution
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

// The valuation-path roots scanned (relative to prototype/). WIDENED to ALL
// FIL-model directories (D-V1-REMOVAL-PHASE-3C) so every FIL model — fx,
// fx-valuation, ir/money-market, ir/bond, and any future model — is mechanically
// covered by the no-hardcoded-reporting-currency gate.
const SCAN_ROOTS: readonly string[] = ["v2-core/fil-models"];

// Files excluded from the scan (relative to prototype/).
const EXCLUDED_FILES: ReadonlySet<string> = new Set([
  // This gate itself (its prose names the patterns).
  "platform/recon/no-hardcoded-reporting-currency.ts",
]);

// ---------------------------------------------------------------------------
// Detection regexes
// ---------------------------------------------------------------------------

// 1. Nullish-coalescing fallback to a literal 3-letter currency (the
//    `reporting ?? "ZAR"` family). Catches any `?? "USD"` etc. in scope.
const NULLISH_CCY_RE = /\?\?\s*"[A-Z]{3}"/g;

// 2. `reporting` assigned / defaulted / keyed to a literal currency.
//    Matches `reporting = "ZAR"`, `reporting: "ZAR"`, `reporting="ZAR"`.
const REPORTING_LITERAL_RE = /\breporting\s*[:=]\s*"[A-Z]{3}"/g;

// 3. Any reference to the removed runtime constant. The v1 methodology hash
//    legitimately embeds the historical token via the file-local
//    `V1_PINNED_REPORTING_CURRENCY` const, NOT this exported symbol.
const FX_REPORTING_CONST_RE = /\bFX_REPORTING_CURRENCY\b/g;

// ---------------------------------------------------------------------------
// File walker
// ---------------------------------------------------------------------------

const ALWAYS_EXCLUDE: ReadonlySet<string> = new Set(["node_modules", ".local", ".git"]);

function walk(dir: string, protoDir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (ALWAYS_EXCLUDE.has(name) || name.startsWith(".")) continue;
    const full = join(dir, name);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full, protoDir, out);
    } else if (st.isFile() && name.endsWith(".ts")) {
      const rel = full.startsWith(`${protoDir}/`) ? full.slice(protoDir.length + 1) : full;
      out.push(rel);
    }
  }
}

function listValuationPathFiles(protoDir: string): string[] {
  const out: string[] = [];
  for (const root of SCAN_ROOTS) {
    walk(resolve(protoDir, root), protoDir, out);
  }
  return out.sort();
}

// ---------------------------------------------------------------------------
// Finding type + scan
// ---------------------------------------------------------------------------

export interface HardcodedReportingFinding {
  readonly file: string;
  readonly line: number;
  readonly pattern: string;
  readonly context: string;
}

function isCommentLine(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

function isTestFile(rel: string): boolean {
  return (
    rel.endsWith(".test.ts") ||
    rel.endsWith(".test.tsx") ||
    rel.endsWith(".spec.ts") ||
    rel.endsWith(".spec.tsx")
  );
}

export function scanFile(rel: string, protoDir: string): HardcodedReportingFinding[] {
  if (EXCLUDED_FILES.has(rel) || isTestFile(rel)) return [];

  let content: string;
  try {
    content = readFileSync(resolve(protoDir, rel), "utf8");
  } catch {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const findings: HardcodedReportingFinding[] = [];

  lines.forEach((rawLine, idx) => {
    if (isCommentLine(rawLine)) return;
    const lineNum = idx + 1;
    const push = (pattern: string): void => {
      findings.push({ file: rel, line: lineNum, pattern, context: rawLine.trim().slice(0, 140) });
    };
    if (NULLISH_CCY_RE.test(rawLine)) push("nullish-coalesce-to-literal-currency");
    if (REPORTING_LITERAL_RE.test(rawLine)) push("reporting-literal-default");
    if (FX_REPORTING_CONST_RE.test(rawLine)) push("FX_REPORTING_CURRENCY-reference");
    // Reset the global regexes' lastIndex (per-line .test on /g regexes).
    NULLISH_CCY_RE.lastIndex = 0;
    REPORTING_LITERAL_RE.lastIndex = 0;
    FX_REPORTING_CONST_RE.lastIndex = 0;
  });

  return findings;
}

export function scanAll(protoDir: string): HardcodedReportingFinding[] {
  const out: HardcodedReportingFinding[] = [];
  for (const rel of listValuationPathFiles(protoDir)) {
    out.push(...scanFile(rel, protoDir));
  }
  return out;
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

export interface RunOpts {
  readonly prototypeDir?: string;
}

export function run(opts: RunOpts = {}): ReconResult & { totalViolations: number } {
  const protoDir = opts.prototypeDir ?? PROTOTYPE_DIR;
  const base = emptyResult("no-hardcoded-reporting-currency") as ReconResult & {
    totalViolations: number;
  };

  const findings = scanAll(protoDir);
  const violations: ReconViolation[] = findings.map((f) => ({
    subject: `${f.file}:${f.line}`,
    severity: "fail",
    message: [
      `Hardcoded reporting currency in the FX valuation path: ${f.file}:${f.line}`,
      `Pattern: ${f.pattern}`,
      `Context: ${f.context}`,
      "The reporting currency must be RESOLVED from the holding entity's functional",
      "currency (resolveReportingCurrency / requireReporting) — no literal default.",
      "Authority: D-MULTI-BASE-CURRENCY-FOUNDATION; WS-MULTI-BASE-CURRENCY.",
    ].join("\n"),
  }));

  base.asserted = findings.length;
  base.totalViolations = findings.length;
  base.violations = violations;
  base.ok = violations.length === 0;
  return base;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      totalViolations: r.totalViolations,
      ok: r.ok,
      msg: r.ok
        ? "no-hardcoded-reporting-currency: pass — 0 literal reporting currencies in the FX valuation path"
        : `no-hardcoded-reporting-currency FAILED — ${r.totalViolations} hardcoded reporting currenc(ies) in the FX valuation path`,
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
