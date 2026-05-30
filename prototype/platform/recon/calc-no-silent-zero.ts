// platform/recon/calc-no-silent-zero.ts
//
// Vera recon: calc-no-silent-zero — objective 4 of the Trusted-Figures Program.
// Asserts that the regulatory calc engines do not collapse a missing weight-table
// lookup to a silent default with `RATES[...] ?? n` / `WEIGHTS[...] ?? n` /
// `RATES[...] || n`. A weight table keyed by an unknown category must fail loudly
// (requireWeight throws), never silently weight a position at 0% or 100% and
// produce a wrong regulatory figure.
//
// Assertions (all blocking):
//   1. Each calc engine imports `requireWeight` from types/financial-input.
//   2. No calc engine contains a `<TABLE>[<key>] ?? <n>` or `|| <n>` collapse on
//      a rate/weight table (RUNOFF_RATES, HAIRCUT_RATES, ASF_WEIGHTS, RSF_WEIGHTS).
//   3. Product-control daily P&L (FIGURE_FILES) routes a missing mark through
//      the data-failure path, not a silent figure collapse:
//        a. imports the no-silent-zero primitive (present/absent/FinancialInput
//           from types/financial-input);
//        b. surfaces the headline unrealised figure as a FinancialInput (the
//           degraded-aggregate contract);
//        c. contains no `<expr>?.<field> ?? 0` collapse that folds a missing
//           per-position mark straight into an aggregate sum (the original
//           `reval?.unrealisedPnlZarMinor ?? 0` silent-zero defect).
//
// Mode: blocking (non-zero exit on any violation). Wired into
//       `bun run ci:recon:domain` via `bun run recon:calc-no-silent-zero`.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
//            WS-TRUSTED-FIGURES.
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "calc-no-silent-zero";

/** Calc engines that must use loud weight lookups, not silent defaults. */
const CALC_FILES = [
  "prototype/platform/liquidity/lcr.ts",
  "prototype/platform/liquidity/nsfr.ts",
  "prototype/platform/markets/products/rwa-delta.ts",
  "prototype/platform/market-risk/var-engine.ts",
  "prototype/platform/market-risk/cva-engine.ts",
];

/**
 * `<SCREAMING_SNAKE_TABLE>[ ... ] ?? <number>` or `|| <number>` — the silent
 * collapse on a weight/rate table. Matches any screaming-snake identifier
 * (≥3 chars) so it catches RUNOFF_RATES, *_WEIGHTS and the per-instrument
 * RWA_WEIGHT_BY_INSTRUMENT_CLASS table alike.
 */
const SILENT_COLLAPSE = /\b[A-Z][A-Z0-9_]{2,}\b\s*\[[^\]]*\]\s*(?:\?\?|\|\|)\s*-?[\d.]/;

const IMPORT_REQUIRE_WEIGHT =
  /import\s*\{[^}]*\brequireWeight\b[^}]*\}\s*from\s*["'][^"']*financial-input["']/s;

// -------------------------------------------------------------------------
// Figure-engine path (assertion 3) — product-control / P&L aggregates.
//
// These engines aggregate per-position figures into a user-facing/regulatory
// total. They do NOT key a weight table; their silent-zero shape is the
// optional-chained mark collapse `reval?.unrealisedPnlZarMinor ?? 0` that folds
// a missing per-position mark into a clean-looking aggregate. The guard below
// asserts they route absence through the FinancialInput data-failure path
// instead.
// -------------------------------------------------------------------------
const FIGURE_FILES = ["prototype/platform/product-control/daily-pnl.ts"];

/** `import { ... present|absent|FinancialInput ... } from ".../financial-input"`. */
const IMPORT_FINANCIAL_INPUT =
  /import\s*(?:type\s*)?\{[^}]*\b(?:present|absent|FinancialInput)\b[^}]*\}\s*from\s*["'][^"']*financial-input["']/s;

/** The aggregate must be surfaced as a FinancialInput<number>. */
const SURFACES_FINANCIAL_INPUT = /FinancialInput<\s*number\s*>/;

/**
 * `<ident>?.<…pnl/unrealised/realised…field> ?? <number>` — the optional-chained
 * P&L-mark collapse. An undefined upstream mark folds straight into a real-looking
 * P&L number (the original `reval?.unrealisedPnlZarMinor ?? 0` defect). Scoped to
 * field names carrying a P&L figure so legitimate display defaults (e.g.
 * `nearLeg?.rate.amount ?? 0` for a book rate) are not flagged. A figure engine
 * must branch on presence and route absence into a data failure, never `?? 0`.
 */
const PNL_FIELD = "[A-Za-z_$][\\w$]*(?:[Pp]nl|[Uu]nrealised|[Rr]ealised)[\\w$]*";
const OPTIONAL_CHAIN_COLLAPSE = new RegExp(
  `\\b[A-Za-z_$][\\w$]*\\?\\.${PNL_FIELD}\\s*\\?\\?\\s*-?[\\d.]`,
);

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

export interface RunOpts {
  repoRoot?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = opts.repoRoot ?? findRepoRoot(import.meta.dir);
  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  result.asserted = CALC_FILES.length + FIGURE_FILES.length;

  for (const rel of CALC_FILES) {
    const path = resolve(repoRoot, rel);
    if (!existsSync(path)) {
      violations.push({
        subject: rel,
        message: `calc file not found at ${path}`,
        severity: "fail",
      });
      continue;
    }
    const src = readFileSync(path, "utf8");

    if (!IMPORT_REQUIRE_WEIGHT.test(src)) {
      violations.push({
        subject: rel,
        message: `calc file "${rel}" must import requireWeight from types/financial-input for loud weight lookups`,
        severity: "fail",
      });
    }

    const lines = src.split("\n");
    lines.forEach((line, i) => {
      if (SILENT_COLLAPSE.test(line)) {
        violations.push({
          subject: `${rel}:${i + 1}`,
          message: `silent weight-table collapse \`${line.trim()}\` — use requireWeight(table, key, label) so an unknown category fails loudly, never a 0/100% default`,
          severity: "fail",
        });
      }
    });
  }

  // -------------------------------------------------------------------------
  // Assertion 3 — product-control / P&L figure engines route missing marks
  // through the FinancialInput data-failure path, never a silent `?? 0`.
  // -------------------------------------------------------------------------
  for (const rel of FIGURE_FILES) {
    const path = resolve(repoRoot, rel);
    if (!existsSync(path)) {
      violations.push({
        subject: rel,
        message: `figure engine not found at ${path}`,
        severity: "fail",
      });
      continue;
    }
    const src = readFileSync(path, "utf8");

    if (!IMPORT_FINANCIAL_INPUT.test(src)) {
      violations.push({
        subject: rel,
        message: `figure engine "${rel}" must import the no-silent-zero primitive (present/absent/FinancialInput) from types/financial-input so a missing mark degrades the figure instead of collapsing to 0`,
        severity: "fail",
      });
    }

    if (!SURFACES_FINANCIAL_INPUT.test(src)) {
      violations.push({
        subject: rel,
        message: `figure engine "${rel}" must surface its headline figure as a FinancialInput<number> so a consumer cannot read an incomplete aggregate as a complete number`,
        severity: "fail",
      });
    }

    const lines = src.split("\n");
    lines.forEach((line, i) => {
      // Comment lines may legitimately reference the defect by name (e.g.
      // documenting `reval?.unrealisedPnlZarMinor ?? 0` as the thing forbidden).
      const code = line.replace(/\/\/.*$/, "");
      if (OPTIONAL_CHAIN_COLLAPSE.test(code)) {
        violations.push({
          subject: `${rel}:${i + 1}`,
          message: `silent P&L-mark collapse \`${line.trim()}\` — a live position with no mark must route through the data-failure path (FinancialInput absent + unmarkable-live count), never fold a missing mark into the aggregate as 0`,
          severity: "fail",
        });
      }
    });
  }

  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.ok = failCount === 0;
  result.violations = violations;
  return result;
}

if (import.meta.main) {
  const result = run();
  const fails = result.violations.filter((v) => v.severity === "fail");

  for (const v of fails) {
    console.error(`  FAIL  [${v.subject}] ${v.message}`);
  }

  if (fails.length === 0) {
    console.log(
      `recon:${PIPELINE} OK — ${result.asserted} engine(s) checked (${CALC_FILES.length} weight-table calc + ${FIGURE_FILES.length} P&L figure), no silent-zero collapse`,
    );
  } else {
    console.error(
      `\nrecon:${PIPELINE} — ${result.asserted} calc engine(s) checked, ${fails.length} violation(s)`,
    );
    console.error(`recon:${PIPELINE} FAILED — ${fails.length} violation(s)`);
    process.exit(1);
  }
}
