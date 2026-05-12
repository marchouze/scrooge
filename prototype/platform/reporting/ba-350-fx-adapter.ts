// platform/reporting/ba-350-fx-adapter.ts
//
// Adapter: FX position calculator output → BA 350 FX section input.
//
// Bridges the fxPositionCalculator (platform/accounting/fx-calculators.ts)
// output to the FxPositionRow[] shape that Ba350GeneratorInput.fxPositions
// expects. Pure function; no side-effects.
//
// Usage:
//   const positions = fxPositionCalculator({ trades, settledTradeIds, zarRates, asOf });
//   const ba350FxPositions = fxPositionsToBa350Input(positions);
//   const ba350 = generateBa350MarketRisk({ ..., fxPositions: ba350FxPositions });
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
//   - Regulations Relating to Banks Reg 28(5) — FX open-position charge
//   - BCBS D352 §718(xiii)
//
// Authors: Camille (CFO, finance) + Bea (Accounting & financial reporting
//   engineer, engineering)

import type { FxPositionResult } from "../accounting/fx-calculators";
import type { FxPositionRow } from "./ba-350-market-risk";

/**
 * Convert fxPositionCalculator output to BA 350 FxPositionRow[] input.
 *
 * Each FxPositionResult maps to one FxPositionRow per the BA 350 schema:
 *   - currency: the non-functional currency (base currency of the pair)
 *   - netPositionFunctionalMinor: net position in ZAR minor units
 *
 * The functional currency (ZAR) leg is excluded by the BA 350 generator
 * itself per Reg 28(5); however we also exclude it here as a belt-and-
 * suspenders measure.
 *
 * @param positions - Output from fxPositionCalculator
 * @param functionalCurrency - ISO 4217 functional currency (default "ZAR")
 */
export function fxPositionsToBa350Input(
  positions: ReadonlyArray<FxPositionResult>,
  functionalCurrency = "ZAR",
): FxPositionRow[] {
  const rows: FxPositionRow[] = [];

  for (const pos of positions) {
    const [baseCcy] = pos.currencyPair.split("/");
    if (!baseCcy) continue;
    // Exclude functional currency
    if (baseCcy === functionalCurrency) continue;

    rows.push({
      currency: baseCcy,
      netPositionFunctionalMinor: pos.netPositionZarMinor,
    });
  }

  return rows;
}

/**
 * Convenience function: generate a BA 350-ready FX section note string
 * from position calculator output. Used by report narrative generators.
 */
export function fxPositionSummaryNote(
  positions: ReadonlyArray<FxPositionResult>,
  asOf: string,
): string {
  if (positions.length === 0) {
    return `No open FX positions as at ${asOf}.`;
  }

  const lines = positions.map((p) => {
    const direction = p.netPositionBaseMinor >= 0 ? "long" : "short";
    return `${p.currencyPair}: ${direction} ${Math.abs(p.netPositionBaseMinor).toLocaleString()} base-ccy minor (${p.openTradeCount} trade(s))`;
  });

  return `FX open positions as at ${asOf}:\n${lines.join("\n")}`;
}
