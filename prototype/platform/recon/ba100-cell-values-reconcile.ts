// platform/recon/ba100-cell-values-reconcile.ts
//
// recon:ba100-cell-values-reconcile — the fail-closed reconciliation gate for the
// BA 100 per-cell LEAF FOLD (D-BA-RETURN-CELL-VALUE-ENGINE Phase 1; brief
// brief:bea:ba-100-per-cell-value-leaf-fold-phase-1-pilot-ev:2026-06-27).
//
// THE INVARIANT (the sibling-fold reconciliation oracle). A BA 100 return and the
// chart-of-accounts trial balance are two SIBLING folds of the same event log
// (Principle 1). The leaf fold (platform/reporting/cell-value/ba100-leaf-fold.ts)
// reads the BA 100 line values DIRECTLY from the events (capital FIL instances) —
// NOT routed through the CoA. The trial-balance fold (computeTrialBalanceV2 →
// generateBa100BalanceSheet) is the independent CoA-side oracle. Because both are
// folds of the SAME capital FIL events, the leaf fold's per-section sums MUST
// reconcile to the oracle's section totals:
//
//   Σ(folded asset-line leaf values)      == oracle.assets.totalMinor
//   Σ(folded liability-line leaf values)  == oracle.liabilities.totalMinor
//   Σ(folded equity-line leaf values)     == oracle.equity.totalMinor
//
// asserted under the COMBINED provenance lens (so the simulated R300m CET1
// injection is in BOTH folds). A drift means the events-direct fold and the CoA
// fold disagree — a real reconciliation break (Charter cmd 2 fail-closed).
//
// FAIL-CLOSED, harden-only. The gate also asserts the fold is NON-VACUOUS on a
// populated store (it MUST place at least one capital line — the R300m CET1
// injection — onto a BA 100 row; a silently-empty fold over a capital-bearing
// store is a regression, not a pass).
//
// SCOPE — only the FOLDED rows are summed against the oracle. The leaf fold
// places exactly the lines it can soundly source from events (capital → cash
// asset R0040 + own-funds equity/liability rows); every other line stays blank
// with a tracked event-schema gap (ba100-leaf-fold-instrument-coverage). The
// reconciliation therefore checks that the folded values, mapped back to their
// section, equal the oracle SECTION TOTAL — which on the clean store is itself
// composed only of those same capital legs. The CoA fold is the RECONCILIATION
// ORACLE ONLY, never the source.
//
// READ-PATH STORE AWARE (feedback_recon_must_model_read_path_store). The gate
// resolves the SAME event store the dashboard reader reads (the resolved shared/
// worktree store via resolveEventDbPath), opened READ-ONLY so it never mutates a
// byte — never the excludeHomeDefault singleton blind spot.
//
// BOUNDARY: V1-side recon infrastructure — MAY import v2-core + platform
// projections (the permitted v1→v2 direction).
//
// Authority: D-BA-RETURN-CELL-VALUE-ENGINE; D-CAPITAL-ASSET-CLASS-V1;
//   D-ENGINEERING-INTEGRITY-CHARTER (fail-closed); SARB BA 100; Banks Act §75;
//   Reg 32; Principle 1; Principle 2.
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille (CFO); domain owner of SARB BA 100).

import { existsSync } from "node:fs";

import { COA_ACCOUNTS } from "../../v2-core/accounting/chart-of-accounts";
import { addD, decimalToString, eqD, toDecimal } from "../../v2-core/fil-core/decimal";
import { ba100Contract } from "../../v2-core/regulatory-returns/ba100-contract";
import { computeDerivedCells } from "../../v2-core/regulatory-returns/cell-value/engine";
import { moneyFromMinorUnits } from "../core/decimal-money";
import type { Currency } from "../core/types";
import { resolveEventDbPath } from "../event-store/resolve-event-db";
import { EventStore } from "../event-store/store";
import { type ProvenanceFilter, setDefaultProvenanceModeOverride } from "../projections/filter";
import { computeTrialBalanceV2Uncached } from "../projections/gl-projection-v2";
import {
  type Ba100LineClassification,
  generateBa100BalanceSheet,
  isOffBalanceSheetAccountId,
} from "../reporting/ba-100-balance-sheet";
import { foldBa100LeafValues } from "../reporting/cell-value/ba100-leaf-fold";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ba100-cell-values-reconcile";
const ENTITY = "LE-ZA-HOZ-BANK";
const FUNCTIONAL_CURRENCY = "ZAR";
const AS_OF = "2099-12-31";
const PERIOD_START = "2026-01-01";
const PERIOD_END = "2099-12-31";
const PERIOD_ID = "period:hoz-bank:build-phase";
// The reconciliation is asserted under the COMBINED lens so the simulated R300m
// CET1 injection is present in BOTH folds (the events-direct leaf fold + the
// CoA-side oracle). This mirrors the brief: reconcile under the combined lens.
const COMBINED_FILTER: ProvenanceFilter = { mode: "combined" };

type Section = "assets" | "liabilities" | "equity";

// ---------------------------------------------------------------------------
// Section classifier — for a BA 100 grid row, which on-balance-sheet section does
// it belong to? Derived from the row coordinate band of the SARB BA 100 form (the
// same banding the contract `rowLabel`s carry). Assets R0010–R0530, total R0540;
// liabilities R0550–R0780, total R0790; equity R0800–R0860, total R0870. The
// analysis blocks (R0890+) are memoranda, not a balance-sheet section — excluded.
// ---------------------------------------------------------------------------

function sectionForRow(row: string): Section | undefined {
  const m = row.match(/^R(\d{4})$/);
  if (m === null) return undefined;
  const n = Number(m[1]);
  if (n >= 10 && n <= 530) return "assets";
  if (n >= 550 && n <= 780) return "liabilities";
  if (n >= 800 && n <= 860) return "equity";
  return undefined; // totals (R0540/R0790/R0870) + memoranda are not leaf inputs.
}

// ---------------------------------------------------------------------------
// Oracle classification map — the SAME CoA-category-prefix derivation the
// dashboard's buildBa100PageFigures uses (source, don't hand-key). Income/expense,
// memorandum and off-balance-sheet accounts are excluded (not BS sections).
// ---------------------------------------------------------------------------

function ba100SectionForCategory(category: string): Section | null {
  if (category.startsWith("asset")) return "assets";
  if (category.startsWith("liability")) return "liabilities";
  if (category.startsWith("equity")) return "equity";
  return null;
}

function deriveBa100Classifications(): readonly Ba100LineClassification[] {
  const out: Ba100LineClassification[] = [];
  for (const a of COA_ACCOUNTS) {
    if (isOffBalanceSheetAccountId(a.id)) continue;
    const section = ba100SectionForCategory(a.category);
    if (section === null) continue;
    out.push({ leafAccountId: a.id, section, lineLabel: `${section}.${a.name}` });
  }
  return out;
}

export interface RunOpts {
  /** Override the event store path — used by tests (point at a tmp store). */
  eventDbPath?: string;
  /**
   * When TRUE (the on-anchor CLI path), a store with NO folded BA 100 lines FAILS
   * the gate (fail-closed vacuity guard). When FALSE (tests probing a specific
   * fixture, possibly empty), an empty fold is a flat-bench info note. Defaults
   * to FALSE.
   */
  requireNonVacuous?: boolean;
}

function resolveDbPath(opts: RunOpts): string {
  if (opts.eventDbPath !== undefined) return opts.eventDbPath;
  return resolveEventDbPath({ excludeHomeDefault: false }).path;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const dbPath = resolveDbPath(opts);
  if (!existsSync(dbPath)) {
    result.violations = [
      {
        subject: "event-store",
        message: `event store ${dbPath} does not exist — nothing to reconcile (flat-bench info).`,
        severity: opts.requireNonVacuous ? "fail" : "info",
      },
    ];
    result.ok = !opts.requireNonVacuous;
    result.asOf = `${PIPELINE}: store absent`;
    return result;
  }

  const store = new EventStore(dbPath, { readonly: true });

  // Pin the COMBINED provenance lens for the whole reconciliation: both folds read
  // it transparently via defaultProvenanceFilter(). No await runs between set/reset.
  setDefaultProvenanceModeOverride(COMBINED_FILTER.mode);
  let foldedBySection: Record<Section, ReturnType<typeof toDecimal>>;
  let oracleMinor: Record<Section, number>;
  let foldedRowCount = 0;
  try {
    // (1) The events-direct LEAF FOLD → engine-resolved per-cell values.
    const contract = ba100Contract();
    const leafValues = foldBa100LeafValues({
      eventStore: store,
      // marketData unused by the BA 100 capital fold; a throwaway store keeps the
      // signature satisfied without a market-data read.
      marketData: undefined as never,
      entity: ENTITY,
      asOf: AS_OF,
      functionalCurrency: FUNCTIONAL_CURRENCY,
    });

    // Sum the FOLDED LEAF rows per section. We sum the LEAF values (the direct,
    // un-derived rows) — the engine's subtotals are a cross-foot of these and are
    // not double-counted. Each leaf key is "<row> <column>".
    foldedBySection = {
      assets: toDecimal("0"),
      liabilities: toDecimal("0"),
      equity: toDecimal("0"),
    };
    for (const [key, amount] of leafValues) {
      const row = key.split(" ")[0] ?? "";
      const section = sectionForRow(row);
      if (section === undefined) continue; // a memorandum / total leaf — not a section input.
      foldedBySection[section] = addD(foldedBySection[section], toDecimal(amount));
      foldedRowCount += 1;
    }

    // (2) The CoA-side ORACLE — the independent sibling fold. Use the UNCACHED
    // trial-balance path: this gate opens the store READ-ONLY (so it never mutates
    // a byte), and the cached entry point would try to WRITE a snapshot.
    const tb = computeTrialBalanceV2Uncached({
      eventStore: store,
      entity: ENTITY,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    const sheet = generateBa100BalanceSheet({
      entity: ENTITY,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: FUNCTIONAL_CURRENCY,
      trialBalance: tb.rows,
      classifications: deriveBa100Classifications(),
      // The read-path fold does not close P&L to retained earnings, so the strict
      // assets ≡ liabilities + equity invariant can legitimately not hold here; we
      // tolerate it and reconcile the per-section totals (Charter cmd 2 — surface
      // honestly, never fabricate).
      tolerateImbalanceMinor: Number.MAX_SAFE_INTEGER,
    });
    oracleMinor = {
      assets: sheet.assets.totalMinor,
      liabilities: sheet.liabilities.totalMinor,
      equity: sheet.equity.totalMinor,
    };

    // Sanity: the engine evaluates the WHOLE form without throwing (a malformed
    // contract derivation would crash here — asserted by evaluating every cell).
    computeDerivedCells({ contract, leafValues, functionalCurrency: FUNCTIONAL_CURRENCY });
  } finally {
    setDefaultProvenanceModeOverride(undefined);
    store.close();
  }

  // (3) Reconcile each section: Σ(folded leaf values) == oracle section total.
  // Compare in MAJOR units (decimal-native): the leaf fold sums major-unit Money;
  // the oracle's `totalMinor` is lifted to the canonical major-unit Money via
  // moneyFromMinorUnits (currency-correct scale, never a hardcoded /100).
  for (const section of ["assets", "liabilities", "equity"] as const) {
    result.asserted += 1;
    const foldedMajor = foldedBySection[section];
    const oracleMajor = toDecimal(
      moneyFromMinorUnits(BigInt(oracleMinor[section]), FUNCTIONAL_CURRENCY as Currency).amount,
    );
    if (!eqD(foldedMajor, oracleMajor)) {
      violations.push({
        subject: `reconcile:${section}`,
        message: `BA 100 ${section}: events-direct leaf fold Σ=${decimalToString(
          foldedMajor,
        )} ${FUNCTIONAL_CURRENCY} != CoA-oracle section total ${decimalToString(
          oracleMajor,
        )} ${FUNCTIONAL_CURRENCY} (oracle minor ${oracleMinor[section]}). The two sibling folds disagree — a reconciliation break (fail-closed; D-BA-RETURN-CELL-VALUE-ENGINE).`,
        severity: "fail",
      });
    }
  }

  // (4) Non-vacuity guard — on the on-anchor CLI path the fold MUST place at least
  // one capital line (the R300m CET1 injection) onto a BA 100 row.
  if (foldedRowCount === 0) {
    violations.push({
      subject: "vacuity",
      message: opts.requireNonVacuous
        ? `VACUOUS: the BA 100 leaf fold placed NO line onto any BA 100 row over ${dbPath} (combined lens) — it asserted nothing about the events-direct fold. Fail-closed: materialise at least one capital FIL instance (capital:emit-injection-v2-sim).`
        : "no BA 100 lines folded (flat-bench info, not a failure) — combined lens over an empty store.",
      severity: opts.requireNonVacuous ? "fail" : "info",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf = `${PIPELINE}: ${foldedRowCount} folded BA 100 line(s); section reconciliation vs CoA oracle (combined lens).`;
  return result;
}

if (import.meta.main) {
  const r = run({ requireNonVacuous: true });
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const failCount = r.violations.filter((v) => v.severity === "fail").length;
  process.stdout.write(
    `recon:${PIPELINE} ${r.ok ? "OK" : "FAIL"} — ${r.asOf}; ${r.violations.length} violation(s) (${failCount} fail)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
