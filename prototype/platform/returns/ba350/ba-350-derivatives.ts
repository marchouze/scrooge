// platform/returns/ba350/ba-350-derivatives.ts
//
// BA 350 (Derivatives Instruments) cell-assembly over the derivative-book
// inventory fold (D-BA-RETURN-SIMULATOR-FIRST Phase 2b).
//
// BA 350 is an INVENTORY return: it maps the foldable derivative book
// (`platform/reporting/ba-350-derivatives-fold.ts`) onto the return grid. The
// grid axes (BA 350 schema CVA_v06112025-style market-risk element codes) are:
//   - underlying ASSET CLASS column groups (12 notional columns C0010–C0120 =
//     6 asset classes × {trading, banking}); the contract's columnLabel
//     extraction collapses every label to "Interest-rate contracts" — an xlsx
//     extraction artefact — so the asset class is carried by COLUMN POSITION:
//       C0010/C0020 interest-rate T/B, C0030/C0040 FX T/B, C0050/C0060 equity
//       T/B, C0070/C0080 commodity T/B, C0090/C0100 credit T/B, C0110/C0120
//       other T/B. The fair-value section repeats the same 12-column layout.
//   - VENUE (ETD R0010 section / OTC R0130 section) + INSTRUMENT TYPE rows.
//   - MATURITY BAND ladder rows (<1y / 1-5y / >5y).
//
// This assembly produces the BACKBONE of the return: the per-asset-class ×
// per-book notional and net-fair-value totals (the cells the BA 350 column grid
// fundamentally reports), plus the ETD/OTC venue split and the credit-derivative
// Section-2 lines. Each line is a `FinancialInput` so an asset class with no
// inventory is an explicit, reasoned ABSENT (zero by absence of positions), never
// a fabricated figure (the no-silent-zero discipline).
//
// HONEST GAP (tracked, never silently zeroed — Engineering Charter cmd 5): the
// fine-grained per-instrument-type × per-maturity-band detail-row mapping
// (R0250–R0790, ~1000 leaf cells) is a presentation expansion of the SAME folded
// inventory — the fold already carries instrumentType + maturityBand, so the data
// EXISTS; what is deferred is the exhaustive leaf-cell row-number mapping, tracked
// as `ba350-maturity-ladder-cell-mapping`. The aggregate backbone (asset-class ×
// book × venue × net-fair-value) is fully driven and oracle-validated here.
//
// PROVENANCE: the inventory is computed under a ProvenanceFilter upstream; the
// production read folds the simulated book to empty → every BA 350 line is an
// explicit zero/absent. Both legs proven by `recon:ba350-derivatives-sim-drive`.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE; Regulations Relating to Banks
//   Reg 28 / Reg 30; Principle 1; Principle 2.
//
// Author: Atlas (Core banking platform architect, engineering).

import type { DerivativeAssetClass } from "../../event-store/event-types/derivative-book-positions";
import {
  type Ba350Book,
  type Ba350Inventory,
  aggregateBa350,
} from "../../reporting/ba-350-derivatives-fold";
import { type FinancialInput, absent, present } from "../../types/financial-input";

// ---------------------------------------------------------------------------
// Gap markers — the tracked, non-silent missing cell-mapping.
// ---------------------------------------------------------------------------

/** Fine-grained maturity-ladder leaf-cell row-number mapping (data exists; mapping deferred). */
export const BA350_GAP_MATURITY_LADDER_MAPPING = "ba350-maturity-ladder-cell-mapping";

// ---------------------------------------------------------------------------
// Output contract — mirrors the BA 325 Line/Output shape.
// ---------------------------------------------------------------------------

export interface Ba350Line {
  /** Cell key — asset-class × book × measure (e.g. "interest-rate.trading.notional"). */
  readonly cellKey: string;
  readonly label: string;
  /** ZAR minor units. `present` when the asset class has inventory, else `absent`. */
  readonly value: FinancialInput<number>;
  readonly valueType: "money";
  /** The source fold this line reconciles to (Principle 2 lineage). */
  readonly sourceFold: string;
}

export interface Ba350DerivativesOutput {
  readonly meta: {
    readonly form: "BA 350";
    readonly formVersion: "v0.1-simulator-first";
    readonly entity: string;
    readonly asOf: string;
    readonly periodId: string;
    readonly functionalCurrency: string;
  };
  /** Notional grid: per asset-class × book. */
  readonly notionalGrid: readonly Ba350Line[];
  /** Fair-value grid: per asset-class × book (net, positive, negative). */
  readonly fairValueGrid: readonly Ba350Line[];
  /** Venue split (ETD vs OTC notional totals). */
  readonly venueSummary: readonly Ba350Line[];
  /** Credit-derivative Section-2 lines (CDS / TRS notional + fair value). */
  readonly creditDerivativeSection: readonly Ba350Line[];
  /** Grand-total notional + net fair value (the return hash-total backbone). */
  readonly grandTotals: readonly Ba350Line[];
  readonly citations: readonly string[];
  /** Honest gap markers (gap-register ids). */
  readonly gaps: readonly string[];
}

export interface Ba350AssemblyInput {
  readonly entity: string;
  readonly asOf: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  readonly inventory: Ba350Inventory;
}

// ---------------------------------------------------------------------------
// Asset-class display labels (BA 350 column groups).
// ---------------------------------------------------------------------------

const ASSET_CLASSES: readonly DerivativeAssetClass[] = [
  "interest-rate",
  "foreign-exchange",
  "equity",
  "commodity",
  "credit",
  "other",
];

const ASSET_LABEL: Readonly<Record<DerivativeAssetClass, string>> = {
  "interest-rate": "Interest-rate contracts",
  "foreign-exchange": "Foreign-exchange contracts",
  equity: "Equity contracts",
  commodity: "Commodity contracts",
  credit: "Credit-derivative contracts",
  other: "Other contracts",
};

const BOOKS: readonly Ba350Book[] = ["trading", "banking"];
const SOURCE_FOLD = "ba-350-derivatives-fold";

// ---------------------------------------------------------------------------
// Assembly.
// ---------------------------------------------------------------------------

/**
 * Assemble the BA 350 inventory return from the derivative-book fold. Pure.
 * Every line is a `FinancialInput`: present with a lineage when the asset
 * class × book has inventory, else an explicit reasoned absent (no positions →
 * zero by absence, never a fabricated figure).
 */
export function assembleBa350Derivatives(input: Ba350AssemblyInput): Ba350DerivativesOutput {
  const { entity, asOf, periodId, functionalCurrency, inventory } = input;

  const notionalGrid: Ba350Line[] = [];
  const fairValueGrid: Ba350Line[] = [];

  for (const assetClass of ASSET_CLASSES) {
    for (const book of BOOKS) {
      const m = aggregateBa350(inventory, (r) => r.assetClass === assetClass && r.book === book);
      const label = `${ASSET_LABEL[assetClass]} — ${book}`;
      const hasInventory = m.positionCount > 0;

      // Notional line.
      notionalGrid.push({
        cellKey: `${assetClass}.${book}.notional`,
        label: `${label} — gross notional`,
        value: hasInventory
          ? present(
              m.notionalMinor,
              `Σ |notional| over ${m.positionCount} ${assetClass} ${book}-book derivative position(s)`,
            )
          : absent(
              `no ${assetClass} ${book}-book derivative positions in the book`,
              "DerivativeTradingPositionOpened (BA 350 fold)",
            ),
        valueType: "money",
        sourceFold: SOURCE_FOLD,
      });

      // Fair-value lines (net / positive / negative).
      fairValueGrid.push({
        cellKey: `${assetClass}.${book}.net-fair-value`,
        label: `${label} — net fair value`,
        value: hasInventory
          ? present(
              m.netFairValueMinor,
              `net fair value (positive ${m.positiveFairValueMinor} + negative ${m.negativeFairValueMinor}) over ${m.positionCount} position(s)`,
            )
          : absent(
              `no ${assetClass} ${book}-book derivative positions`,
              "DerivativeTradingPositionOpened (BA 350 fold)",
            ),
        valueType: "money",
        sourceFold: SOURCE_FOLD,
      });
      if (hasInventory) {
        fairValueGrid.push({
          cellKey: `${assetClass}.${book}.positive-fair-value`,
          label: `${label} — gross positive fair value (asset)`,
          value: present(m.positiveFairValueMinor, "Σ fairValue where > 0"),
          valueType: "money",
          sourceFold: SOURCE_FOLD,
        });
        fairValueGrid.push({
          cellKey: `${assetClass}.${book}.negative-fair-value`,
          label: `${label} — gross negative fair value (liability)`,
          value: present(m.negativeFairValueMinor, "Σ fairValue where < 0"),
          valueType: "money",
          sourceFold: SOURCE_FOLD,
        });
      }
    }
  }

  // Venue split (ETD vs OTC notional).
  const etd = aggregateBa350(inventory, (r) => r.venue === "exchange-traded");
  const otc = aggregateBa350(inventory, (r) => r.venue === "over-the-counter");
  const venueSummary: Ba350Line[] = [
    {
      cellKey: "venue.exchange-traded.notional",
      label: "Exchange-traded contracts — gross notional",
      value:
        etd.positionCount > 0
          ? present(etd.notionalMinor, `Σ |notional| over ${etd.positionCount} ETD position(s)`)
          : absent("no exchange-traded positions", "BA 350 fold (venue = exchange-traded)"),
      valueType: "money",
      sourceFold: SOURCE_FOLD,
    },
    {
      cellKey: "venue.over-the-counter.notional",
      label: "OTC contracts — gross notional",
      value:
        otc.positionCount > 0
          ? present(otc.notionalMinor, `Σ |notional| over ${otc.positionCount} OTC position(s)`)
          : absent("no OTC positions", "BA 350 fold (venue = over-the-counter)"),
      valueType: "money",
      sourceFold: SOURCE_FOLD,
    },
  ];

  // Credit-derivative Section 2 (CDS / TRS).
  const cds = aggregateBa350(
    inventory,
    (r) => r.assetClass === "credit" && r.instrumentType === "credit-default-swap",
  );
  const trs = aggregateBa350(
    inventory,
    (r) => r.assetClass === "credit" && r.instrumentType === "total-return-swap",
  );
  const creditDerivativeSection: Ba350Line[] = [
    {
      cellKey: "section2.credit-default-swaps.notional",
      label: "Credit-default swaps — gross notional",
      value:
        cds.positionCount > 0
          ? present(cds.notionalMinor, `Σ |notional| over ${cds.positionCount} CDS position(s)`)
          : absent(
              "no credit-default-swap positions",
              "BA 350 fold (instrumentType = credit-default-swap)",
            ),
      valueType: "money",
      sourceFold: SOURCE_FOLD,
    },
    {
      cellKey: "section2.total-return-swaps.notional",
      label: "Total-return swaps — gross notional",
      value:
        trs.positionCount > 0
          ? present(trs.notionalMinor, `Σ |notional| over ${trs.positionCount} TRS position(s)`)
          : absent(
              "no total-return-swap positions",
              "BA 350 fold (instrumentType = total-return-swap)",
            ),
      valueType: "money",
      sourceFold: SOURCE_FOLD,
    },
  ];

  // Grand totals (the BA 350 hash-total backbone).
  const grand = aggregateBa350(inventory, () => true);
  const grandTotals: Ba350Line[] = [
    {
      cellKey: "grand.notional",
      label: "All derivatives — gross notional (hash-total)",
      value:
        grand.positionCount > 0
          ? present(grand.notionalMinor, `Σ |notional| over ${grand.positionCount} position(s)`)
          : absent("no derivative positions in the book", "BA 350 fold (all positions)"),
      valueType: "money",
      sourceFold: SOURCE_FOLD,
    },
    {
      cellKey: "grand.net-fair-value",
      label: "All derivatives — net fair value (hash-total)",
      value:
        grand.positionCount > 0
          ? present(grand.netFairValueMinor, "Σ net fair value over all positions")
          : absent("no derivative positions in the book", "BA 350 fold (all positions)"),
      valueType: "money",
      sourceFold: SOURCE_FOLD,
    },
  ];

  return {
    meta: {
      form: "BA 350",
      formVersion: "v0.1-simulator-first",
      entity,
      asOf,
      periodId,
      functionalCurrency,
    },
    notionalGrid,
    fairValueGrid,
    venueSummary,
    creditDerivativeSection,
    grandTotals,
    citations: [
      "D-BA-RETURN-SIMULATOR-FIRST",
      "urn:reg:za:regs-relating-to-banks:reg28",
      "urn:reg:za:regs-relating-to-banks:reg30",
    ],
    gaps: [BA350_GAP_MATURITY_LADDER_MAPPING],
  };
}
