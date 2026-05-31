// platform/product-control/desk-cash-positions.ts
//
// Prices each desk's settled FX cash instrument (from computeCurrencyPositions)
// to market against ZAR, as a no-silent-zero FinancialInput. This is the read
// layer the Product Control dashboard + daily-pnl consume: the cash instrument
// is marked with the SAME OfficialMarkAdopted{markType:"fx-rate"} mark that
// prices live FX trades, so a settled USD balance and an open USD/ZAR trade
// share one valuation source (Principle 2, single graph).
//
// unrealised(ZAR minor) = fcyQuantityMinor × (markRate − avgCostZarRate)
//   markRate, avgCostZarRate both in ZAR per 1 FCY ⟹ FCY-minor × (ZAR/FCY) = ZAR-minor.
//
// NO-SILENT-ZERO: a currency with no CCY/ZAR production mark surfaces as
// `absent` (never folded as 0), exactly as position-source.ts treats an
// unmarkable bond/equity/IRD position.
//
// Authority:
//   - IAS 21 §23/§28; IFRS 9 §5.7.1
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (no-silent-zero)
//   - CEO instruction 2026-05-31 (FX cash as a financial instrument)
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import type { OfficialMarkAdoptedPayload } from "../event-store/event-types/valuation";
import type { EventStore } from "../event-store/store";
import {
  type CurrencyPositionRow,
  REPORTING_CURRENCY,
  computeCurrencyPositions,
} from "../projections/markets/currency-position";
import { type FinancialInput, absent, isPresent, present } from "../types/financial-input";

/** A desk cash instrument priced to ZAR (or flagged unmarkable). */
export interface DeskCashPositionPriced {
  readonly instrumentId: string;
  readonly entity: string;
  readonly bookId: string;
  readonly currency: string;
  readonly fcyQuantityMinor: number;
  readonly avgCostZarRate: number;
  /** Latest CCY/ZAR mark (ZAR per 1 FCY) when present. */
  readonly markRate: number | null;
  /** Current ZAR value of the holding (fcyQuantityMinor × markRate), ZAR minor. */
  readonly zarValueMinor: number | null;
  /** Unrealised P&L vs weighted-avg cost as a no-silent-zero FinancialInput. */
  readonly unrealisedPnlZarMinor: FinancialInput<number>;
  /** Cumulative realised P&L crystallised on close-outs (ZAR minor). */
  readonly realisedZarMinorCumulative: number;
}

export interface DeskCashPositionSet {
  readonly positions: readonly DeskCashPositionPriced[];
  /** Σ markable positions' unrealised (ZAR minor) — complete-only total. */
  readonly markableUnrealisedZarMinor: number;
  /** instrumentIds with no usable CCY/ZAR mark (no-silent-zero ledger). */
  readonly unmarkableKeys: readonly string[];
  /** The cross-position unrealised total as a no-silent-zero FinancialInput. */
  readonly totalUnrealised: FinancialInput<number>;
  /** Σ realised close-out P&L across all cash instruments (ZAR minor). */
  readonly totalRealisedZarMinor: number;
}

/**
 * Fold latest OfficialMarkAdopted fx-rate marks into a `${ccy}` → ZAR-per-FCY
 * map. Accepts the CCY/ZAR pair directly; also derives from a ZAR/CCY mark by
 * inversion so either stored direction works (mirrors lookupQuoteWithInverse).
 */
function foldZarRates(store: EventStore): Map<string, number> {
  const byCcy = new Map<string, number>();
  for (const e of store.replay({ type: "OfficialMarkAdopted" })) {
    const p = e.payload as unknown as OfficialMarkAdoptedPayload;
    if (p.markType !== "fx-rate") continue;
    const value = Number(p.mark);
    if (!Number.isFinite(value) || value <= 0) continue;
    const key = p.instrumentKey; // e.g. "USD/ZAR" or "ZAR/USD"
    const [base, quote] = key.split("/");
    if (quote === REPORTING_CURRENCY && base) {
      byCcy.set(base, value); // CCY/ZAR → ZAR per CCY directly
    } else if (base === REPORTING_CURRENCY && quote) {
      byCcy.set(quote, 1 / value); // ZAR/CCY → invert
    }
  }
  return byCcy;
}

function priceRow(row: CurrencyPositionRow, zarRates: Map<string, number>): DeskCashPositionPriced {
  const markRate = zarRates.get(row.currency) ?? null;
  if (markRate === null || row.fcyQuantityMinor === 0) {
    // Flat positions need no mark; non-flat with no mark are unmarkable.
    if (row.fcyQuantityMinor === 0) {
      return {
        instrumentId: row.instrumentId,
        entity: row.entity,
        bookId: row.bookId,
        currency: row.currency,
        fcyQuantityMinor: 0,
        avgCostZarRate: row.avgCostZarRate,
        markRate,
        zarValueMinor: 0,
        unrealisedPnlZarMinor: present(0, "flat cash position — no unrealised P&L"),
        realisedZarMinorCumulative: row.realisedZarMinorCumulative,
      };
    }
    return {
      instrumentId: row.instrumentId,
      entity: row.entity,
      bookId: row.bookId,
      currency: row.currency,
      fcyQuantityMinor: row.fcyQuantityMinor,
      avgCostZarRate: row.avgCostZarRate,
      markRate: null,
      zarValueMinor: null,
      unrealisedPnlZarMinor: absent(
        `no production ${row.currency}/ZAR fx-rate mark — desk cash instrument ${row.instrumentId} cannot be marked (no silent 0)`,
        `OfficialMarkAdopted{markType:"fx-rate", instrumentKey:"${row.currency}/ZAR"}`,
      ),
      realisedZarMinorCumulative: row.realisedZarMinorCumulative,
    };
  }
  const zarValueMinor = Math.round(row.fcyQuantityMinor * markRate);
  const unrealised = Math.round(row.fcyQuantityMinor * (markRate - row.avgCostZarRate));
  return {
    instrumentId: row.instrumentId,
    entity: row.entity,
    bookId: row.bookId,
    currency: row.currency,
    fcyQuantityMinor: row.fcyQuantityMinor,
    avgCostZarRate: row.avgCostZarRate,
    markRate,
    zarValueMinor,
    unrealisedPnlZarMinor: present(
      unrealised,
      `OfficialMarkAdopted ${row.currency}/ZAR @ ${markRate} vs avg cost ${row.avgCostZarRate} (IAS 21 §28)`,
    ),
    realisedZarMinorCumulative: row.realisedZarMinorCumulative,
  };
}

/** Build the priced desk-cash position set. Pure read — no appends. */
export function computeDeskCashPositions(store: EventStore): DeskCashPositionSet {
  const { rows } = computeCurrencyPositions(store);
  const zarRates = foldZarRates(store);
  const positions = rows.map((r) => priceRow(r, zarRates));

  let markableUnrealisedZarMinor = 0;
  let totalRealisedZarMinor = 0;
  const unmarkableKeys: string[] = [];
  for (const p of positions) {
    totalRealisedZarMinor += p.realisedZarMinorCumulative;
    if (isPresent(p.unrealisedPnlZarMinor)) {
      markableUnrealisedZarMinor += p.unrealisedPnlZarMinor.value;
    } else {
      unmarkableKeys.push(p.instrumentId);
    }
  }

  const complete = unmarkableKeys.length === 0;
  const totalUnrealised: FinancialInput<number> = complete
    ? present(
        markableUnrealisedZarMinor,
        "product-control/desk-cash-positions: Σ markable FX cash instruments (IAS 21 §28)",
      )
    : absent(
        `${unmarkableKeys.length} desk cash instrument(s) had no usable CCY/ZAR mark — total excludes ${unmarkableKeys.join(", ")}`,
        "OfficialMarkAdopted (production fx-rate) for every desk cash currency",
      );

  return {
    positions,
    markableUnrealisedZarMinor,
    unmarkableKeys,
    totalUnrealised,
    totalRealisedZarMinor,
  };
}
