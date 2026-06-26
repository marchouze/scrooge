// platform/returns/ba340/ba-340-equity-risk-banking-book.ts
//
// BA 340 (Equity Risk in the Banking Book) cell-assembly over the simple-risk-
// weight fold (D-BA-RETURN-SIMULATOR-FIRST Phase 2c).
//
// BA 340 grid axes (from the BA 340 contract):
//   - HOLDING-CLASS rows under the simple-risk-weight method:
//       R0040 Equities - listed   (publicly-traded, 300%)
//       R0050 Equities - unlisted (other equity positions, 400%)
//     and the deduction-regime line R0020 (speculative-unlisted) carried for
//     exposure only (NOT Table-1-charged — routes to Reg-38(5) deduction/250%).
//   - COLUMNS:
//       C0010 Exposure value
//       C0020 Risk weighted exposure
//       C0030 Capital requirement
//   - The internal-models-approach section (R0060–R0080) is the ALTERNATIVE
//     column. No IMA engine exists in the build phase — surfaced as an explicit,
//     tracked gap (no silent zero), never fabricated.
//
// Each line is a `FinancialInput`: present (with lineage) when the class has
// holdings, else an explicit reasoned absent — never a fabricated figure.
//
// PROVENANCE: the inventory is computed under a ProvenanceFilter upstream; the
// production read folds the simulated book to empty → every BA 340 line is an
// explicit zero/absent. Both legs proven by `recon:ba340-equity-risk-sim-drive`.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE; Regulations Relating to Banks
//   Reg 31 (simple risk-weight method), Reg 38 (8% min ratio); Basel CRE;
//   Principle 1; Principle 2.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import type {
  Ba340ClassMeasures,
  Ba340EquityRiskInventory,
} from "../../reporting/ba-340-equity-risk-banking-book";
import { ba340MeasuresForClass } from "../../reporting/ba-340-equity-risk-banking-book";
import { type FinancialInput, absent, present } from "../../types/financial-input";

// ---------------------------------------------------------------------------
// Gap marker — the tracked, non-silent missing IMA engine.
// ---------------------------------------------------------------------------

/**
 * The internal-models / market-based approach for banking-book equity
 * (Reg 31(6)(b)(ii); BA 340 R0060–R0080). No engine exists in the build phase;
 * the simple-risk-weight method is the implemented column. Tracked, never silent.
 */
export const BA340_GAP_IMA_ENGINE = "ba340-internal-models-approach-engine";

// ---------------------------------------------------------------------------
// Output line model — mirrors the BA 350 Line/Output shape.
// ---------------------------------------------------------------------------

export interface Ba340Line {
  /** Cell key — BA 340 row × column (e.g. "R0040.C0010"). */
  readonly cellRow: string;
  readonly label: string;
  /** ZAR minor units. `present` when the class has holdings, else `absent`. */
  readonly value: FinancialInput<number>;
  readonly valueType: "money";
  /** The source fold this line reconciles to (Principle 2 lineage). */
  readonly sourceFold: string;
}

export interface Ba340EquityRiskOutput {
  readonly meta: {
    readonly form: "BA 340";
    readonly formVersion: "v0.1-simulator-first";
    readonly entity: string;
    readonly asOf: string;
    readonly periodId: string;
    readonly functionalCurrency: string;
  };
  /** Simple-risk-weight method: per holding class × {exposure, RWE, capital}. */
  readonly simpleRiskWeightSection: readonly Ba340Line[];
  /** Internal-models-approach section (tracked-absent — no engine). */
  readonly internalModelsApproachSection: readonly Ba340Line[];
  /** Grand totals (the BA 340 hash-total backbone). */
  readonly grandTotals: readonly Ba340Line[];
  readonly citations: readonly string[];
  /** Honest gap markers (gap-register ids). */
  readonly gaps: readonly string[];
}

export interface Ba340AssemblyInput {
  readonly entity: string;
  readonly asOf: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  readonly inventory: Ba340EquityRiskInventory;
}

const SOURCE_FOLD = "ba340-equity-risk-banking-book-fold";

const IMA_ABSENT_REASON =
  "no internal-models / market-based approach (Reg 31(6)(b)(ii)) engine exists — the build-phase substrate implements the simple risk-weight method (Table 1: 300% listed / 400% unlisted) only; the IMA column requires a PD/LGD market-based model the substrate does not yet implement";
const IMA_ABSENT_FROM = `gap-register: ${BA340_GAP_IMA_ENGINE} (internal-models-approach equity engine)`;

// ---------------------------------------------------------------------------
// Assembly.
// ---------------------------------------------------------------------------

/**
 * Assemble the BA 340 equity-risk return from the simple-risk-weight fold. Pure.
 * Every simple-risk-weight line is a `FinancialInput`: present with a lineage
 * when the holding class has holdings, else an explicit reasoned absent (no
 * holdings → zero by absence, never a fabricated figure).
 */
export function assembleBa340EquityRisk(input: Ba340AssemblyInput): Ba340EquityRiskOutput {
  const { entity, asOf, periodId, functionalCurrency, inventory } = input;

  // Holding-class rows (Table 1 / simple risk-weight method).
  const classRows: ReadonlyArray<{
    row: string;
    label: string;
    holdingClass: Parameters<typeof ba340MeasuresForClass>[1];
  }> = [
    { row: "R0040", label: "Equities - listed (publicly traded, 300%)", holdingClass: "listed" },
    { row: "R0050", label: "Equities - unlisted (other, 400%)", holdingClass: "unlisted" },
    {
      row: "R0020",
      label: "Speculative unlisted equities (deduction / 250% regime — not Table-1-charged)",
      holdingClass: "speculative-unlisted",
    },
  ];

  const simpleRiskWeightSection: Ba340Line[] = [];
  for (const { row, label, holdingClass } of classRows) {
    const m = ba340MeasuresForClass(inventory, holdingClass);
    const hasHoldings = m !== null && m.holdingCount > 0;

    // C0010 Exposure value.
    simpleRiskWeightSection.push(
      classLine(
        `${row}.C0010`,
        `${label} — exposure value`,
        hasHoldings ? m.exposureValueMinor : null,
        m,
        "exposure value",
      ),
    );
    // C0020 Risk-weighted exposure.
    simpleRiskWeightSection.push(
      classLine(
        `${row}.C0020`,
        `${label} — risk-weighted exposure`,
        hasHoldings ? m.riskWeightedExposureMinor : null,
        m,
        "risk-weighted exposure",
      ),
    );
    // C0030 Capital requirement.
    simpleRiskWeightSection.push(
      classLine(
        `${row}.C0030`,
        `${label} — capital requirement (RWE × 8%)`,
        hasHoldings ? m.capitalRequirementMinor : null,
        m,
        "capital requirement",
      ),
    );
  }

  // Internal-models-approach section (R0060–R0080) — tracked-absent (no engine).
  const internalModelsApproachSection: Ba340Line[] = [
    {
      cellRow: "R0060.C0010",
      label: "Internal models approach — exposure value",
      value: absent(IMA_ABSENT_REASON, IMA_ABSENT_FROM),
      valueType: "money",
      sourceFold: `gap:${BA340_GAP_IMA_ENGINE}`,
    },
    {
      cellRow: "R0060.C0040",
      label: "Internal models approach — risk-weighted exposure",
      value: absent(IMA_ABSENT_REASON, IMA_ABSENT_FROM),
      valueType: "money",
      sourceFold: `gap:${BA340_GAP_IMA_ENGINE}`,
    },
    {
      cellRow: "R0060.C0050",
      label: "Internal models approach — capital requirement",
      value: absent(IMA_ABSENT_REASON, IMA_ABSENT_FROM),
      valueType: "money",
      sourceFold: `gap:${BA340_GAP_IMA_ENGINE}`,
    },
  ];

  // Grand totals (the BA 340 hash-total backbone) — Table-1 simple-risk-weight
  // method only (the implemented column).
  const anyHoldings = inventory.totalHoldings > 0;
  const grandTotals: Ba340Line[] = [
    {
      cellRow: "R0360.C0010",
      label: "Total — exposure value (simple risk-weight method)",
      value: anyHoldings
        ? present(
            inventory.totalExposureValueMinor,
            `Σ exposure value over ${inventory.totalHoldings} banking-book equity holding(s)`,
          )
        : absent(
            "no banking-book equity holdings in the book",
            "BankingBookEquityHoldingOpened (BA 340 fold)",
          ),
      valueType: "money",
      sourceFold: SOURCE_FOLD,
    },
    {
      cellRow: "R0360.C0020",
      label: "Total — risk-weighted exposure (simple risk-weight method)",
      value: anyHoldings
        ? present(
            inventory.totalRiskWeightedExposureMinor,
            "Σ (exposure × Table-1 risk weight) over the Table-1-charged classes",
          )
        : absent(
            "no banking-book equity holdings in the book",
            "BankingBookEquityHoldingOpened (BA 340 fold)",
          ),
      valueType: "money",
      sourceFold: SOURCE_FOLD,
    },
    {
      cellRow: "R0360.C0030",
      label: "Total — capital requirement (simple risk-weight method)",
      value: anyHoldings
        ? present(
            inventory.totalCapitalRequirementMinor,
            "Σ (RWE × 8%) over the Table-1-charged classes",
          )
        : absent(
            "no banking-book equity holdings in the book",
            "BankingBookEquityHoldingOpened (BA 340 fold)",
          ),
      valueType: "money",
      sourceFold: SOURCE_FOLD,
    },
  ];

  return {
    meta: {
      form: "BA 340",
      formVersion: "v0.1-simulator-first",
      entity,
      asOf,
      periodId,
      functionalCurrency,
    },
    simpleRiskWeightSection,
    internalModelsApproachSection,
    grandTotals,
    citations: [
      "D-BA-RETURN-SIMULATOR-FIRST",
      "urn:reg:za:regs-relating-to-banks:reg31",
      "urn:reg:za:regs-relating-to-banks:reg38",
      "BASEL-CRE-EQUITY",
    ],
    gaps: [BA340_GAP_IMA_ENGINE],
  };
}

// ---------------------------------------------------------------------------
// Line helper.
// ---------------------------------------------------------------------------

/**
 * Build one simple-risk-weight line: present with lineage when the class has
 * holdings, else an explicit reasoned absent. `valueMinor` is the figure for the
 * column (or null when the class is empty).
 */
function classLine(
  cellRow: string,
  label: string,
  valueMinor: number | null,
  measures: Ba340ClassMeasures | null,
  measureName: string,
): Ba340Line {
  if (valueMinor === null || measures === null) {
    return {
      cellRow,
      label,
      value: absent(
        "no holdings in this banking-book equity holding class",
        "BankingBookEquityHoldingOpened (BA 340 fold)",
      ),
      valueType: "money",
      sourceFold: SOURCE_FOLD,
    };
  }
  const rw =
    measures.riskWeightBps !== null
      ? `risk weight ${measures.riskWeightBps / 100}%`
      : "deduction/250% regime (not Table-1-charged)";
  return {
    cellRow,
    label,
    value: present(valueMinor, `${measureName} over ${measures.holdingCount} holding(s); ${rw}`),
    valueType: "money",
    sourceFold: SOURCE_FOLD,
  };
}
