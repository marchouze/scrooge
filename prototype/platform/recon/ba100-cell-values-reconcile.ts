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
import { absD, addD, cmpD, decimalToString, eqD, toDecimal } from "../../v2-core/fil-core/decimal";
import { ba100Contract } from "../../v2-core/regulatory-returns/ba100-contract";
import { computeDerivedCells } from "../../v2-core/regulatory-returns/cell-value/engine";
import { moneyFromMinorUnits } from "../core/decimal-money";
import type { Currency } from "../core/types";
import { resolveEventDbPath } from "../event-store/resolve-event-db";
import { EventStore } from "../event-store/store";
import { resolveMarketDataDbPath } from "../market-data/resolve-market-data-db";
import { MarketDataStore } from "../market-data/store";
import { type ProvenanceFilter, setDefaultProvenanceModeOverride } from "../projections/filter";
import { computeTrialBalanceV2Uncached } from "../projections/gl-projection-v2";
import {
  type Ba100LineClassification,
  generateBa100BalanceSheet,
  isOffBalanceSheetAccountId,
} from "../reporting/ba-100-balance-sheet";
import { functionalNetFromRows } from "../reporting/ba100-functional-net";
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

// ---------------------------------------------------------------------------
// Independent GL section totals from the per-account signed functional-ZAR net.
// This re-derives the section placement DIRECTLY from the CoA category + sign — NOT
// via generateBa100BalanceSheet — so it is a genuine independent oracle the gate
// can hold the generator's section totals against (account-complete, sign-aware).
//   - asset/expense are debit-natural; liability/equity/income are credit-natural.
//   - pure equity + income/expense (current-year result) ALWAYS present in equity;
//     equity is accumulated CREDIT-POSITIVE (= negation of the debit-positive net).
//   - an asset with a CREDIT net (short-funding nostro) presents as a LIABILITY;
//     a liability with a DEBIT net presents as an ASSET.
// ---------------------------------------------------------------------------

function glSectionTotalsFromFunctionalNet(
  netByAccount: ReadonlyMap<string, number>,
): Record<Section, number> {
  const totals: Record<Section, number> = { assets: 0, liabilities: 0, equity: 0 };
  for (const [accountId, signed] of netByAccount) {
    if (signed === 0) continue;
    if (isOffBalanceSheetAccountId(accountId)) continue;
    const cat = COA_ACCOUNTS.find((a) => a.id === accountId)?.category;
    if (cat === undefined) continue; // unmapped — a generator gap, not a section input.
    const mag = Math.abs(signed);
    if (cat === "equity" || cat.startsWith("income") || cat.startsWith("expense")) {
      // Current-year result + capital, credit-positive: −signed (debit-positive net).
      totals.equity += -signed;
      continue;
    }
    if (cat.startsWith("asset")) {
      // Debit-natural: positive net = asset; negative net = short-funding liability.
      if (signed >= 0) totals.assets += mag;
      else totals.liabilities += mag;
      continue;
    }
    if (cat.startsWith("liability")) {
      // Credit-natural: negative net = liability; positive net = asset (receivable).
      if (signed <= 0) totals.liabilities += mag;
      else totals.assets += mag;
    }
  }
  return totals;
}

/**
 * Credit-positive sum of the GL's OWN-FUNDS CAPITAL accounts (those carrying a
 * `capitalTier` — CET1 equity + AT1/T2 capital liabilities) from the per-account
 * signed functional-ZAR net. This is the portion the events-direct leaf fold ALSO
 * covers (the capital posting legs), so the two must reconcile to the cent on it.
 * Sign: capital is credit-natural; credit-positive = negation of the debit-positive
 * net.
 */
function glOwnFundsCapitalFromFunctionalNet(netByAccount: ReadonlyMap<string, number>): number {
  let total = 0;
  for (const [accountId, signed] of netByAccount) {
    if (signed === 0) continue;
    const coa = COA_ACCOUNTS.find((a) => a.id === accountId);
    if (coa === undefined || coa.capitalTier === undefined) continue;
    total += -signed;
  }
  return total;
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
  // Market-data store for the functional-ZAR conversion of any non-nostro FCY row.
  // The live build-phase book translates every FCY nostro at its settle-rate cost
  // basis (no market-data read needed for those); the store is opened so a non-
  // nostro FCY row would translate at the latest production spot rather than fail.
  const marketDataStore = new MarketDataStore(resolveMarketDataDbPath().path);

  // Pin the COMBINED provenance lens for the whole reconciliation: both folds read
  // it transparently via defaultProvenanceFilter(). No await runs between set/reset.
  setDefaultProvenanceModeOverride(COMBINED_FILTER.mode);
  let foldedBySection: Record<Section, ReturnType<typeof toDecimal>>;
  let oracleMinor: Record<Section, number>;
  let oracleSheet: ReturnType<typeof generateBa100BalanceSheet>;
  let functionalNet: ReturnType<typeof functionalNetFromRows>;
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
    // Per-account SIGNED functional-ZAR net (EUR/GBP/USD nostros at settle-rate cost
    // basis — the SAME source the GL view uses). This is the headline-bearing oracle
    // input; the sign-aware generator places each account by category + sign.
    functionalNet = functionalNetFromRows(tb.rows, {
      eventStore: store,
      marketData: marketDataStore,
      entity: ENTITY,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      functionalCurrency: FUNCTIONAL_CURRENCY,
      filter: COMBINED_FILTER,
    });
    const sheet = generateBa100BalanceSheet({
      entity: ENTITY,
      asOf: AS_OF,
      periodId: PERIOD_ID,
      functionalCurrency: FUNCTIONAL_CURRENCY,
      trialBalance: tb.rows,
      classifications: deriveBa100Classifications(),
      functionalNetByAccount: functionalNet.netByAccount,
      // The functional-net path closes P&L to retained earnings within equity, so the
      // strict assets ≡ liabilities + equity invariant DOES hold when the books
      // balance; we still tolerate (surface honestly, never throw inside recon).
      tolerateImbalanceMinor: Number.MAX_SAFE_INTEGER,
    });
    oracleSheet = sheet;
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
    marketDataStore.close();
  }

  // (3) SUBSET-SOUNDNESS — the events-direct leaf fold places a SOUND SUBSET of the
  // GL: it sources exactly the lines it can derive granularly from events (capital
  // own-funds + settled FX cash). Every OTHER GL balance-sheet account is the
  // account-complete GL-oracle's job (blocks 3b–3d). So the leaf fold must never
  // place MORE in a section than the GL holds (it cannot invent value the GL does
  // not have), and its CAPITAL coverage must reconcile EXACTLY to the GL's own-funds
  // capital. (Prior to the account-complete oracle this was a strict equality; the
  // oracle now covers the full FCY book, so the sparse leaf fold reconciles as a
  // subset — D-BA-RETURN-FAIL-SAFE-RESIDUAL-EXPOSURE; doctrine: GL trial balance is
  // the completeness oracle the leaf fold reconciles INTO, not a mirror of.)
  // Scoped to ASSETS + LIABILITIES (where the leaf fold's settled-FX-cash placement
  // could land value). EQUITY is excluded here because the GL equity SECTION total
  // is NET of the current-year P&L result (capital − loss), whereas the leaf fold
  // places GROSS own-funds capital — the correct equity reconciliation is the
  // capital-exactness check (3a), against GL GROSS own-funds, not the netted total.
  for (const section of ["assets", "liabilities"] as const) {
    result.asserted += 1;
    const foldedMajor = foldedBySection[section];
    const oracleMajor = toDecimal(
      moneyFromMinorUnits(BigInt(oracleMinor[section]), FUNCTIONAL_CURRENCY as Currency).amount,
    );
    // Leaf-fold section sum must not EXCEED the GL section total (a leaf value with
    // no GL backing is fabricated value — fail-closed). Magnitudes compared.
    const foldedAbs = absD(foldedMajor);
    const oracleAbs = absD(oracleMajor);
    if (cmpD(foldedAbs, oracleAbs) === 1) {
      violations.push({
        subject: `subset-soundness:${section}`,
        message: `BA 100 ${section}: events-direct leaf fold Σ=${decimalToString(
          foldedMajor,
        )} ${FUNCTIONAL_CURRENCY} EXCEEDS the GL-oracle section total ${decimalToString(
          oracleMajor,
        )} ${FUNCTIONAL_CURRENCY} — the leaf fold placed value the GL does not hold (fabricated value, fail-closed; D-BA-RETURN-CELL-VALUE-ENGINE).`,
        severity: "fail",
      });
    }
  }

  // (3a) CAPITAL-EXACTNESS — the leaf fold's own-funds capital (R0810 share capital
  // + R0820/R0830 reserves + R0700 AT1/T2) must reconcile EXACTLY to the GL's
  // capital own-funds (the equity/own-funds accounts carrying a `capitalTier`),
  // credit-positive. This is the portion BOTH folds cover, so they must agree to
  // the cent (the original sibling-fold invariant, scoped to the shared coverage).
  result.asserted += 1;
  const leafEquityMajor = foldedBySection.equity;
  const glCapitalMinor = glOwnFundsCapitalFromFunctionalNet(functionalNet.netByAccount);
  const glCapitalMajor = toDecimal(
    moneyFromMinorUnits(BigInt(glCapitalMinor), FUNCTIONAL_CURRENCY as Currency).amount,
  );
  if (!eqD(leafEquityMajor, glCapitalMajor)) {
    violations.push({
      subject: "capital-exactness",
      message: `BA 100 equity: events-direct leaf fold own-funds Σ=${decimalToString(
        leafEquityMajor,
      )} ${FUNCTIONAL_CURRENCY} != GL own-funds capital ${decimalToString(
        glCapitalMajor,
      )} ${FUNCTIONAL_CURRENCY}. The two folds disagree on the SHARED capital coverage — a reconciliation break (fail-closed; D-BA-RETURN-CELL-VALUE-ENGINE).`,
      severity: "fail",
    });
  }

  // (3b) EXHAUSTIVE COMPLETENESS — every GL balance-sheet account with a non-zero
  // functional-ZAR net MUST be reflected in a BA 100 cell (a section line item), OR
  // surfaced as a classification gap. A resolvable balance that lands in NEITHER is
  // a SILENTLY-DROPPED total — exactly the R790m-class bug (FCY nostros dropped,
  // negative cash sign-flipped). Fail-closed: no account left behind.
  const reflectedAccounts = new Set<string>();
  for (const sec of [oracleSheet.assets, oracleSheet.liabilities, oracleSheet.equity] as const) {
    for (const li of sec.lineItems) {
      for (const acc of li.contributingAccounts) reflectedAccounts.add(acc);
    }
  }
  for (const gap of oracleSheet.classificationGaps) reflectedAccounts.add(gap.leafAccountId);
  for (const [accountId, signed] of functionalNet.netByAccount) {
    if (signed === 0) continue;
    result.asserted += 1;
    if (!reflectedAccounts.has(accountId)) {
      violations.push({
        subject: `completeness:${accountId}`,
        message: `BA 100 completeness: GL balance-sheet account ${accountId} holds a non-zero functional-ZAR net (${(
          signed / 100
        ).toFixed(
          2,
        )} ${FUNCTIONAL_CURRENCY}) but is reflected in NO BA 100 cell and is NOT a surfaced gap. A resolvable balance has been silently dropped (the R790m-class bug). Fail-closed (D-BA-RETURN-FAIL-SAFE-RESIDUAL-EXPOSURE).`,
        severity: "fail",
      });
    }
  }

  // (3c) ACCOUNT-COMPLETE SECTION RECONCILIATION — the oracle section totals MUST
  // equal the GL trial-balance section totals derived INDEPENDENTLY from the per-
  // account functional-ZAR net by sign-aware placement (not via the generator). A
  // mismatch means the generator placed an account into the wrong section or
  // dropped/sign-flipped a balance.
  const glSection = glSectionTotalsFromFunctionalNet(functionalNet.netByAccount);
  for (const section of ["assets", "liabilities", "equity"] as const) {
    result.asserted += 1;
    if (oracleMinor[section] !== glSection[section]) {
      violations.push({
        subject: `gl-section-reconcile:${section}`,
        message: `BA 100 ${section}: generator section total ${(oracleMinor[section] / 100).toFixed(
          2,
        )} ${FUNCTIONAL_CURRENCY} != GL trial-balance section total ${(
          glSection[section] / 100
        ).toFixed(
          2,
        )} ${FUNCTIONAL_CURRENCY} (account-complete, sign-aware). The BA 100 section does not reconcile to the GL account-for-account (fail-closed).`,
        severity: "fail",
      });
    }
  }

  // (3d) BALANCE-SHEET INVARIANT — A = L + E on BA 100. Once every account is
  // reflected with the correct sign, the books MUST balance in the functional
  // currency (the GL trial balance balances per-entry in ZAR — #1618/#1619). A
  // residual means an account is mis-signed or unconvertible (surfaced separately).
  result.asserted += 1;
  if (functionalNet.unconvertible.length === 0 && !oracleSheet.balanceCheck.balanced) {
    violations.push({
      subject: "balance-sheet-invariant",
      message: `BA 100 does not balance: assets ${(oracleMinor.assets / 100).toFixed(
        2,
      )} != liabilities ${(oracleMinor.liabilities / 100).toFixed(2)} + equity ${(
        oracleMinor.equity / 100
      ).toFixed(2)} ${FUNCTIONAL_CURRENCY} (difference ${(
        oracleSheet.balanceCheck.differenceMinor / 100
      ).toFixed(
        2,
      )}). With no unconvertible legs the functional-currency books MUST balance (#1618/#1619 — TB balances per-entry in ZAR). Fail-closed.`,
      severity: "fail",
    });
  }

  // (3e) UNCONVERTIBLE — any balance-sheet account whose functional-ZAR net could
  // not be struck is surfaced LOUDLY (never silently dropped — Charter cmd 2/5). On
  // the live build-phase book every FCY nostro converts at cost basis, so this set
  // is empty; a non-empty set is a real coverage gap to chase, reported as a fail
  // on the on-anchor CLI path and an info on test fixtures.
  for (const u of functionalNet.unconvertible) {
    result.asserted += 1;
    violations.push({
      subject: `unconvertible:${u.accountId}`,
      message: `BA 100: GL account ${u.accountId} holds ${(u.nativeMinor / 100).toFixed(2)} ${
        u.currency
      } with no resolvable functional-${FUNCTIONAL_CURRENCY} rate — surfaced, not dropped. Source a settle-rate cost basis or a production spot for ${u.currency}/${FUNCTIONAL_CURRENCY}.`,
      severity: opts.requireNonVacuous ? "fail" : "info",
    });
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
