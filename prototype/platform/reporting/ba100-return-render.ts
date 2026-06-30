// platform/reporting/ba100-return-render.ts
//
// BA 100 RETURN-OF-RECORD RENDER (Phase 4, D-BA-RETURN-CELL-VALUE-ENGINE).
//
// Produces a deterministic JSON document that is the canonical body of the
// BA 100 return-of-record `RecordFiled` event. The document combines:
//
//   (1) PER-CELL LEAF-FOLD VALUES — sourced directly from the event log via
//       `foldBa100LeafValues(ctx)` (the events-direct fold, NOT routed through
//       the CoA). These are the primary granular return values for every cell the
//       fold can resolve with sound event-backed data (Phase 1: capital lines +
//       FX cash legs). Unresolved cells are omitted (never fabricated).
//
//   (2) COA RECONCILIATION BLOCK — the independent CoA-side section totals from
//       `generateBa100BalanceSheet` (the GL oracle). Paired with the leaf-fold
//       section sums so the document is self-reconciling (the recon gate result
//       is baked in, not just asserted separately).
//
// DETERMINISTIC: the render body must be byte-identical for the same event-store
// snapshot. No `new Date()` / `Date.now()` in the body — use the `asOf` param
// derived from the period end.
//
// PROVENANCE: the caller pins the provenance lens BEFORE invoking (via
// `setDefaultProvenanceModeOverride`). The fold reads under whatever lens is
// active — the same behaviour as the dashboard fold (`v2-finance-returns-view.ts`).
//
// PURE FUNCTION: no side effects; callers are responsible for filing via
// `recordFiled`.
//
// Authority: D-BA-RETURN-CELL-VALUE-ENGINE (Phase 4); D-BA-RETURN-CAPABILITY-FIRST;
//   D-ENGINEERING-INTEGRITY-CHARTER (deterministic; fail-closed; source-don't-
//   hardcode); Principle 1 (events are truth); Principle 2 (single-graph).
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille (CFO); domain owner of SARB BA 100).

import { COA_ACCOUNTS } from "../../v2-core/accounting/chart-of-accounts";
import { absD, addD, cmpD, decimalToString, eqD, toDecimal } from "../../v2-core/fil-core/decimal";
import { ba100Contract } from "../../v2-core/regulatory-returns/ba100-contract";
import { computeDerivedCells } from "../../v2-core/regulatory-returns/cell-value/engine";
import { moneyFromMinorUnits } from "../core/decimal-money";
import type { Currency } from "../core/types";
import type { EventStore } from "../event-store/store";
import { buildPartyProjection } from "../identity/party-projection";
import type { MarketDataStore } from "../market-data/store";
import type { Ba100BalanceSheet } from "./ba-100-balance-sheet";
import { foldBa100LeafValues } from "./cell-value/ba100-leaf-fold";
import { buildBa100ReferenceData } from "./cell-value/ba100-reference-data";
import type { LeafFoldContext } from "./cell-value/leaf-fold-registry";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single per-cell entry in the leaf-fold section of the render. */
export interface Ba100ReturnLeafCell {
  /** Coordinate: `"<row> <column>"` e.g. `"R0040 C0040"`. */
  readonly coord: string;
  /** Decimal-native major-unit string (ZAR). */
  readonly amount: string;
  /** Whether this value was placed directly by the leaf fold or computed. */
  readonly source: "leaf-fold" | "derived";
}

/** Reconciliation block: leaf-fold section sums vs CoA oracle totals. */
export interface Ba100ReturnReconBlock {
  /** Section. */
  readonly section: "assets" | "liabilities" | "equity";
  /**
   * Leaf-fold Σ for this section (decimal major-unit string, ZAR).
   * Sum of all leaf-fold cells in the section.
   */
  readonly leafFoldSum: string;
  /**
   * CoA oracle section total (minor units, then converted to decimal string).
   * Matches `ba100BalanceSheet.assets.totalMinor` etc.
   */
  readonly oracleTotal: string;
  /**
   * Whether the leaf-fold subset is reconciled INTO the oracle (subset-soundness).
   * TRUE = leafFoldSum ≤ oracleTotal (the fold placed no more than the GL holds).
   * EQUITY section uses the special capital-exactness check (leaf = oracle own-funds
   * component, not the netted P&L equity total).
   */
  readonly reconciled: boolean;
}

/** The rendered BA 100 return-of-record document body. */
export interface Ba100ReturnRender {
  /** Fixed schema identifier for version tracking. */
  readonly $schema: "https://hoz.bank/schemas/ba100-return-of-record/v0.1.json";
  readonly meta: {
    readonly form: "BA100";
    readonly formVersion: "v0.1-build-phase";
    readonly entity: string;
    readonly periodId: string;
    readonly asOf: string;
    readonly functionalCurrency: string;
    readonly renderPhase: "phase4";
    /** Citations backing this filing. */
    readonly citations: readonly string[];
  };
  /** All resolved leaf cells + derived summation cells (non-zero only). */
  readonly cells: readonly Ba100ReturnLeafCell[];
  /** Reconciliation blocks per section. */
  readonly reconBlocks: readonly Ba100ReturnReconBlock[];
  /** Substrate gaps: cells the fold could NOT resolve from events. */
  readonly unresolvedCells: readonly string[];
  /** Summary verdict. */
  readonly verdict: {
    readonly totalCellsResolved: number;
    readonly totalCellsUnresolved: number;
    readonly reconPass: boolean;
    readonly note: string;
  };
}

// ---------------------------------------------------------------------------
// Section classification (mirrors ba100-cell-values-reconcile.ts)
// ---------------------------------------------------------------------------

type Section = "assets" | "liabilities" | "equity";

function sectionForRow(row: string): Section | undefined {
  const m = row.match(/^R(\d{4})$/);
  if (m === null) return undefined;
  const n = Number(m[1]);
  if (n >= 10 && n <= 530) return "assets";
  if (n >= 550 && n <= 780) return "liabilities";
  if (n >= 800 && n <= 860) return "equity";
  return undefined;
}

// ---------------------------------------------------------------------------
// renderBa100Return — the main render function
// ---------------------------------------------------------------------------

export interface RenderBa100ReturnInput {
  readonly eventStore: EventStore;
  readonly marketData: MarketDataStore;
  readonly entity: string;
  readonly periodId: string;
  readonly asOf: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly functionalCurrency: string;
  /** Pre-built CoA oracle sheet (from generateBa100BalanceSheet). */
  readonly oracleSheet: Ba100BalanceSheet;
  /**
   * Per-account signed functional-ZAR net from `functionalNetFromRows`. Required
   * for the equity capital-exactness reconciliation check (the recon gate uses
   * GL own-funds capital — accounts carrying a `capitalTier` — NOT the netted
   * oracle equity section total which includes P&L absorption). If omitted, the
   * equity recon block compares against the oracle's netted section total (may
   * produce a false reconciliation break when P&L loss has been absorbed).
   */
  readonly functionalNetByAccount?: ReadonlyMap<string, number>;
}

/**
 * Produce the deterministic BA 100 return-of-record document.
 * Pure function — no side effects.
 *
 * The caller must have already set the provenance mode override BEFORE calling
 * this function, and must restore it after (the function does NOT touch the
 * override — it reads whatever the active mode is).
 */
export function renderBa100Return(input: RenderBa100ReturnInput): Ba100ReturnRender {
  // (1) Build the leaf fold with the full referenceData (party + desk).
  const partyProjection = buildPartyProjection(input.eventStore);
  const referenceData = buildBa100ReferenceData(partyProjection);

  const ctx: LeafFoldContext = {
    eventStore: input.eventStore,
    marketData: input.marketData,
    entity: input.entity,
    asOf: input.asOf,
    functionalCurrency: input.functionalCurrency,
    referenceData,
  };

  const leafValues = foldBa100LeafValues(ctx);

  // (2) Run the engine to compute derived cells (summation / formulae).
  const contract = ba100Contract();
  const derived = computeDerivedCells({
    contract,
    leafValues,
    functionalCurrency: input.functionalCurrency,
  });

  // (3) Build the combined cell list. Leaf-fold values take precedence for
  //     cells the fold placed (they are the direct-event values); derived
  //     covers everything else the engine computes from them.
  const leafCoords = new Set(leafValues.keys());
  const combined = new Map<string, { amount: string; source: "leaf-fold" | "derived" }>();

  // Engine values first (totals + subtotals).
  const coordByXsd = new Map<string, string>();
  for (const c of contract.cells) {
    if (c.cellRef.row !== undefined && c.cellRef.column !== undefined) {
      coordByXsd.set(c.cellRef.xsdElement, `${c.cellRef.row} ${c.cellRef.column}`);
    }
  }
  for (const [xsd, v] of derived) {
    const coord = coordByXsd.get(xsd);
    if (coord === undefined) continue;
    const source: "leaf-fold" | "derived" = leafCoords.has(coord) ? "leaf-fold" : "derived";
    combined.set(coord, { amount: v.amount, source });
  }
  // Leaf values that the engine may not have emitted separately.
  for (const [coord, v] of leafValues) {
    if (!combined.has(coord)) {
      combined.set(coord, { amount: v, source: "leaf-fold" });
    } else {
      // Leaf-fold wins over a derived entry on the same coord.
      combined.set(coord, { amount: v, source: "leaf-fold" });
    }
  }

  // Filter to non-zero cells only (deterministic zero omission).
  const cells: Ba100ReturnLeafCell[] = [];
  for (const [coord, { amount, source }] of combined) {
    if (amount !== "0" && amount !== "0.0" && amount !== "0.00") {
      cells.push({ coord, amount, source });
    }
  }
  // Sort by coord for byte-stable output.
  cells.sort((a, b) => a.coord.localeCompare(b.coord));

  // (4) Compute the leaf-fold section sums for the recon block.
  // Use decimal arithmetic throughout — float division of minor units is forbidden
  // (Engineering Charter cmd 6; D-DECIMAL-NATIVE-MONEY-ARITHMETIC).
  const FUNCTIONAL_CCY = input.functionalCurrency as Currency;
  const leafBySectionD: Record<Section, ReturnType<typeof toDecimal>> = {
    assets: toDecimal("0"),
    liabilities: toDecimal("0"),
    equity: toDecimal("0"),
  };
  for (const [coord, v] of leafValues) {
    const [row] = coord.split(" ");
    if (row === undefined) continue;
    const section = sectionForRow(row);
    if (section === undefined) continue;
    leafBySectionD[section] = addD(leafBySectionD[section], absD(toDecimal(v)));
  }

  // Oracle section totals: minor-unit integers → decimal-native major units via
  // moneyFromMinorUnits (the only safe minor→major conversion, per D-DECIMAL-NATIVE-MONEY-
  // ARITHMETIC; never divide by MINOR_DIVISOR with JS float arithmetic).
  const oracleBySectionD: Record<Section, ReturnType<typeof toDecimal>> = {
    assets: toDecimal(
      moneyFromMinorUnits(BigInt(input.oracleSheet.assets.totalMinor), FUNCTIONAL_CCY).amount,
    ),
    liabilities: toDecimal(
      moneyFromMinorUnits(BigInt(input.oracleSheet.liabilities.totalMinor), FUNCTIONAL_CCY).amount,
    ),
    equity: toDecimal(
      moneyFromMinorUnits(BigInt(input.oracleSheet.equity.totalMinor), FUNCTIONAL_CCY).amount,
    ),
  };

  // Equity capital-exactness: use GL own-funds capital (sum of accounts with
  // a capitalTier — CET1 equity + AT1/T2 liabilities), credit-positive. This
  // mirrors the recon gate's (3a) check. The oracle's NETTED equity section total
  // absorbs P&L losses; the leaf fold places GROSS own-funds capital — comparing
  // against the netted total produces a false reconciliation break.
  let glOwnFundsCapitalD: ReturnType<typeof toDecimal> | undefined;
  if (input.functionalNetByAccount !== undefined) {
    let capMinor = 0;
    for (const [accountId, signed] of input.functionalNetByAccount) {
      if (signed === 0) continue;
      const coa = COA_ACCOUNTS.find((a) => a.id === accountId);
      if (coa === undefined || coa.capitalTier === undefined) continue;
      capMinor += -signed; // credit-positive (capital is credit-natural, in minor units)
    }
    // The minor-unit accumulator is always an integer sum of integer inputs
    // (functionalNetByAccount values are signed minor-unit integers). No
    // rounding: cast directly to BigInt (mirrors glOwnFundsCapitalFromFunctionalNet
    // in ba100-cell-values-reconcile.ts which does `BigInt(glCapitalMinor)` without
    // rounding). BigInt() truncates — but the value is already integral.
    glOwnFundsCapitalD = toDecimal(moneyFromMinorUnits(BigInt(capMinor), FUNCTIONAL_CCY).amount);
  }

  const reconBlocks: Ba100ReturnReconBlock[] = (["assets", "liabilities", "equity"] as const).map(
    (section) => {
      const leafSumD = leafBySectionD[section];
      let oracleTotalD: ReturnType<typeof toDecimal>;
      let reconciled: boolean;

      if (section === "equity" && glOwnFundsCapitalD !== undefined) {
        // Capital-exactness: leaf equity must equal GL own-funds capital (exact, not
        // subset), because both folds cover the SAME capital posting legs.
        oracleTotalD = glOwnFundsCapitalD;
        reconciled = eqD(leafSumD, oracleTotalD);
      } else {
        // Subset-soundness for assets + liabilities: leaf ≤ oracle (never exceeds GL).
        oracleTotalD = oracleBySectionD[section];
        reconciled = cmpD(absD(leafSumD), absD(oracleTotalD)) <= 0;
      }

      return {
        section,
        leafFoldSum: decimalToString(leafSumD),
        oracleTotal: decimalToString(oracleTotalD),
        reconciled,
      };
    },
  );

  const reconPass = reconBlocks.every((b) => b.reconciled);

  // (5) Unresolved cells: contract leaf cells with no fold value.
  const contractLeafCoords = new Set<string>();
  for (const c of contract.cells) {
    if (
      c.cellRef.row !== undefined &&
      c.cellRef.column !== undefined &&
      !c.cellRef.row.startsWith("R0540") && // totals
      !c.cellRef.row.startsWith("R0790") &&
      !c.cellRef.row.startsWith("R0870")
    ) {
      contractLeafCoords.add(`${c.cellRef.row} ${c.cellRef.column}`);
    }
  }
  const unresolvedCells: string[] = [];
  for (const coord of contractLeafCoords) {
    if (!leafCoords.has(coord)) {
      unresolvedCells.push(coord);
    }
  }
  unresolvedCells.sort();

  return {
    $schema: "https://hoz.bank/schemas/ba100-return-of-record/v0.1.json",
    meta: {
      form: "BA100",
      formVersion: "v0.1-build-phase",
      entity: input.entity,
      periodId: input.periodId,
      asOf: input.asOf,
      functionalCurrency: input.functionalCurrency,
      renderPhase: "phase4",
      citations: [
        "D-BA-RETURN-CAPABILITY-FIRST",
        "D-BA-RETURN-CELL-VALUE-ENGINE",
        "D-ENGINEERING-INTEGRITY-CHARTER",
        "Principles/1-events-are-truth.md",
      ],
    },
    cells,
    reconBlocks,
    unresolvedCells,
    verdict: {
      totalCellsResolved: cells.length,
      totalCellsUnresolved: unresolvedCells.length,
      reconPass,
      note: reconPass
        ? "Leaf-fold subset is sound: all section sums ≤ GL oracle totals. BA100 return reconciles."
        : "RECON FAIL: at least one section sum exceeds the GL oracle total — review before filing.",
    },
  };
}

/**
 * Deterministic JSON serialisation: sorts object keys recursively so the same
 * input always produces byte-identical bytes (same BLAKE3 hash across re-runs).
 */
export function canonicaliseReturnRender(render: Ba100ReturnRender): string {
  return JSON.stringify(sortKeys(render as unknown), null, 2);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      out[k] = sortKeys(obj[k]);
    }
    return out;
  }
  return value;
}
