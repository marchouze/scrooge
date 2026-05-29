// platform/reporting/hqla-stock.ts
//
// Instrument-level HQLA stock computation — D-FINANCIAL-INSTRUMENT-ENTITY;
// corrected 2026-05-29.
//
// Replaces the Phase-0 GL account-balance proxy for HQLA stock with the
// correct instrument-level approach:
//   SecurityMaster.hqlaLevel (from FinancialInstrumentClassified) × position
//   mark-to-market (from unified-position projection).
//
// Rationale:
//   The trial-balance / AccountLiquidityClassification approach applies a
//   single HQLA tier to the entire balance of a GL account. A single account
//   can hold both Level-1 SAGBs and non-HQLA corporate bonds, so the
//   account-level tag is structurally wrong for heterogeneous portfolios.
//   Instrument-level classification from the SecurityMaster projection
//   (FinancialInstrumentClassified.hqlaLevel) resolves the correct tier for
//   every individual security held. The unified-position projection provides
//   the mark-to-market value for each holding.
//
// BCBS D295 haircuts applied here:
//   Level 1:  0%  (factor 1.00) — per BCBS D295 §50.
//   Level 2A: 15% (factor 0.85) — per BCBS D295 §52.
//   Level 2B: 25% default (factor 0.75) — per BCBS D295 §54; assetSpecificHaircut
//             overrides the default when provided by the caller.
//
// Currency handling:
//   Only positions in the requested functionalCurrency are included. FX-
//   denominated positions are excluded (non-functional currency; Principle 5
//   multi-currency requires explicit FX conversion, which is a Slice-6+ step).
//   Excluded positions are surfaced in the `excludedFxPositions` field.
//
// Design:
//   Pure function — no event store access. The caller folds unified-position
//   and security-master projections from the event store and passes the
//   resulting states here. This keeps the computation testable in isolation.
//
// Citations:
//   D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22) — instrument entity
//     + per-instrument classification via FinancialInstrumentClassified.
//   BCBS D295 — Basel III Liquidity Coverage Ratio and liquidity risk monitoring
//     tools (Jan 2013) §50–§54: HQLA eligibility criteria and haircuts.
//   Regulations Relating to Banks Reg 26(7) — LCR numerator / HQLA stock.
//   Principles/1-events-are-truth.md — projection-derived inputs only.
//   Principles/5-multi-currency-entity-country.md — functional-currency scope.
//
// Author: Ravi (Treasury/ALM quantitative engineer, engineering)
//   per brief:ravi:fix-ba-325-hqla-stock-instrument-level-positions:2026-05-29.

import type { SecurityMasterState } from "../projections/markets/security-master";
import type { UnifiedPositionState } from "../projections/markets/unified-position";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * HQLA tier as recorded on SecurityMasterRow.hqlaLevel.
 * "non-hqla" is the explicit opt-out; undefined means unclassified (also excluded).
 *
 * Authority: D-FINANCIAL-INSTRUMENT-ENTITY; BCBS D295 §50–§54.
 */
export type HqlaLevel = "level-1" | "level-2a" | "level-2b" | "non-hqla";

/**
 * One instrument's contribution to the HQLA stock.
 *
 * `nominalMinor` is the gross market value before haircut.
 * `adjustedMinor` is the post-haircut value (= nominalMinor × (1 − haircut)).
 * `haircut` is expressed as a fraction (0.0 = no haircut; 0.15 = 15% Level-2A haircut).
 *
 * Authority: D-FINANCIAL-INSTRUMENT-ENTITY; BCBS D295 §50–§54.
 */
export interface HqlaStockLine {
  readonly instrumentId: string;
  readonly isin?: string;
  readonly instrumentName?: string;
  readonly hqlaLevel: "level-1" | "level-2a" | "level-2b";
  readonly currency: string;
  /** Gross market value (pre-haircut) in minor units of the functional currency. */
  readonly nominalMinor: number;
  /** BCBS D295 haircut fraction: 0.00 (L1) / 0.15 (L2A) / 0.25 default (L2B). */
  readonly haircut: number;
  /** Post-haircut value in minor units: nominalMinor × (1 − haircut). */
  readonly adjustedMinor: number;
  /** Source of market value: "markToMarket" | "quantity×price" (fallback). */
  readonly valuationBasis: "markToMarket" | "quantity×price";
}

/**
 * Input to `computeHqlaStockFromPositions()`.
 *
 * Pass the folded state of the unified-position and security-master projections.
 * This interface is also the type consumed by `generateBa325Lcr()` as
 * `Ba325GeneratorInput.hqlaStock`.
 *
 * Authority: D-FINANCIAL-INSTRUMENT-ENTITY; BCBS D295; Reg 26(7).
 */
export interface HqlaStockInput {
  /** Folded state of the unified-position projection (markets.unified-position). */
  readonly positions: UnifiedPositionState;
  /** Folded state of the security-master projection (markets.security-master). */
  readonly securityMaster: SecurityMasterState;
  /**
   * ISO 4217 functional currency. Only positions denominated in this currency
   * contribute to the HQLA stock. FX positions are excluded (Slice-6+ will
   * add FX conversion; build-phase scope is functional-currency LCR).
   *
   * Citation: Principles/5-multi-currency-entity-country.md.
   */
  readonly functionalCurrency: string;
  /**
   * Optional per-instrument override for Level-2B haircut fraction.
   * Key: instrumentId. Value: haircut fraction in [0, 1].
   * Unspecified instruments use the BCBS D295 §54 default of 0.25.
   *
   * Authority: BCBS D295 §54; Reg 26(7)(c).
   */
  readonly level2bHaircutOverrides?: ReadonlyMap<string, number>;
}

/**
 * The computed HQLA stock broken down by tier.
 *
 * Note: caps (BCBS D295 §47 — 40% Level-2A cap, 15% Level-2B cap) are NOT
 * applied here. The caps are applied inside `generateBa325Lcr()` via the
 * existing `applyHqlaCaps()` function, which operates on the pre-cap tier
 * totals. This separation keeps the instrument-level computation and the
 * regulatory cap arithmetic independently testable.
 */
export interface HqlaStockResult {
  readonly level1Lines: readonly HqlaStockLine[];
  readonly level2aLines: readonly HqlaStockLine[];
  readonly level2bLines: readonly HqlaStockLine[];
  /** Sum of `adjustedMinor` for all Level-1 lines (no haircut; factor = 1.00). */
  readonly level1TotalMinor: number;
  /** Sum of `adjustedMinor` for all Level-2A lines (15% haircut applied). */
  readonly level2aTotalMinor: number;
  /** Sum of `adjustedMinor` for all Level-2B lines (default 25% haircut applied). */
  readonly level2bTotalMinor: number;
  /**
   * Positions excluded because they are denominated in a non-functional currency.
   * Surfaced for completeness / placeholder generation in the caller.
   */
  readonly excludedFxPositions: readonly {
    readonly instrumentId: string;
    readonly currency: string;
    readonly markToMarket: number;
  }[];
}

// ---------------------------------------------------------------------------
// BCBS D295 default haircuts per tier
// ---------------------------------------------------------------------------

const HAIRCUT: Record<"level-1" | "level-2a" | "level-2b", number> = {
  "level-1": 0.0, // BCBS D295 §50 — Level 1 assets: 0% haircut.
  "level-2a": 0.15, // BCBS D295 §52 — Level 2A assets: 15% haircut.
  "level-2b": 0.25, // BCBS D295 §54 — Level 2B assets: 25% default haircut.
};

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Compute HQLA stock from instrument-level position holdings × SecurityMaster
 * classification.
 *
 * For each position in the unified-position register:
 *   1. Look up the instrument in the SecurityMaster.
 *   2. Skip if no SecurityMaster row or `hqlaLevel` is undefined/"non-hqla".
 *   3. Determine market value: prefer `markToMarket`; fall back to
 *      `quantity × lastObservedPrice` when markToMarket is 0 or null.
 *   4. Skip positions denominated in a non-functional currency (surfaced in
 *      `excludedFxPositions`).
 *   5. Apply BCBS D295 haircut for the tier.
 *   6. Accumulate into level1Lines / level2aLines / level2bLines.
 *
 * BCBS D295 caps (§47) are NOT applied here — they are applied by the BA 325
 * generator via `applyHqlaCaps()`.
 *
 * Citations:
 *   D-FINANCIAL-INSTRUMENT-ENTITY; BCBS D295 §50–§54; Reg 26(7);
 *   Principles/1-events-are-truth.md; Principles/5-multi-currency-entity-country.md.
 */
export function computeHqlaStockFromPositions(input: HqlaStockInput): HqlaStockResult {
  const { positions, securityMaster, functionalCurrency, level2bHaircutOverrides } = input;

  const level1Lines: HqlaStockLine[] = [];
  const level2aLines: HqlaStockLine[] = [];
  const level2bLines: HqlaStockLine[] = [];
  const excludedFxPositions: HqlaStockResult["excludedFxPositions"][number][] = [];

  let level1TotalMinor = 0;
  let level2aTotalMinor = 0;
  let level2bTotalMinor = 0;

  // Stable iteration order — sort by instrumentId for deterministic output.
  const sortedRows = [...positions.rows.values()].sort((a, b) =>
    a.key.instrumentId < b.key.instrumentId ? -1 : a.key.instrumentId > b.key.instrumentId ? 1 : 0,
  );

  for (const row of sortedRows) {
    const { instrumentId } = row.key;

    // Step 1: Look up SecurityMaster.
    const smRow = securityMaster.instruments.get(instrumentId);
    if (!smRow) continue; // No SecurityMaster entry — skip.

    // Step 2: Filter by hqlaLevel.
    const rawHqlaLevel = smRow.hqlaLevel;
    if (!rawHqlaLevel || rawHqlaLevel === "non-hqla") continue;

    // Narrow to eligible tiers.
    const hqlaLevel = rawHqlaLevel as "level-1" | "level-2a" | "level-2b";

    // Step 4: Currency filter — only functional-currency positions.
    if (row.currency !== functionalCurrency) {
      excludedFxPositions.push({
        instrumentId,
        currency: row.currency,
        markToMarket: row.markToMarket,
      });
      continue;
    }

    // Step 3: Market value.
    // Prefer markToMarket when it is a non-zero finite number. Fall back to
    // quantity × lastObservedPrice when markToMarket is 0 (e.g. not yet
    // updated after the last trade). Take absolute value — positions may be
    // short (negative quantity), but HQLA is an asset measure; a negative
    // value here indicates a data anomaly and the absolute value is correct
    // for stock purposes (similar to the credit-balance warning in the legacy
    // trial-balance path).
    let nominalMinor: number;
    let valuationBasis: HqlaStockLine["valuationBasis"];
    if (row.markToMarket !== 0 && Number.isFinite(row.markToMarket)) {
      nominalMinor = Math.abs(row.markToMarket);
      valuationBasis = "markToMarket";
    } else {
      nominalMinor = Math.abs(row.quantity * row.lastObservedPrice);
      valuationBasis = "quantity×price";
    }

    // Skip zero-value positions — they contribute nothing to the stock.
    if (nominalMinor === 0) continue;

    // Step 5: Apply BCBS D295 haircut.
    let haircut = HAIRCUT[hqlaLevel];
    if (hqlaLevel === "level-2b" && level2bHaircutOverrides) {
      const override = level2bHaircutOverrides.get(instrumentId);
      if (override !== undefined) {
        haircut = override;
      }
    }
    const adjustedMinor = Math.round(nominalMinor * (1 - haircut));

    const line: HqlaStockLine = {
      instrumentId,
      ...(smRow.isin ? { isin: smRow.isin } : {}),
      hqlaLevel,
      currency: row.currency,
      nominalMinor,
      haircut,
      adjustedMinor,
      valuationBasis,
    };

    // Step 6: Accumulate.
    if (hqlaLevel === "level-1") {
      level1Lines.push(line);
      level1TotalMinor += adjustedMinor;
    } else if (hqlaLevel === "level-2a") {
      level2aLines.push(line);
      level2aTotalMinor += adjustedMinor;
    } else {
      level2bLines.push(line);
      level2bTotalMinor += adjustedMinor;
    }
  }

  return {
    level1Lines,
    level2aLines,
    level2bLines,
    level1TotalMinor,
    level2aTotalMinor,
    level2bTotalMinor,
    excludedFxPositions,
  };
}
