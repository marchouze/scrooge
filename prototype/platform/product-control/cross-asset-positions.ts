// platform/product-control/cross-asset-positions.ts
//
// Cross-asset Product Control breakdown — the read layer behind the redone
// product-control.html. It answers two questions across EVERY asset class the
// bank trades: "what is my P&L by instrument?" and "what is my P&L by book?".
//
// It is a PURE COMPOSITION of three existing engines — no new mark or P&L logic,
// no duplication (Principle 2, single graph):
//
//   FX (Spot & Forward, + Swap / NDF)
//     → computeDailyPnL (the Slice-1 FX engine, unchanged). It already folds
//       every FX taxonomy; we group its per-trade rows by (book, pair) and carry
//       each row's productTaxonomy through so the UI can label Spot vs Forward.
//   Desk FX cash (fi:csh:<CCY>:<book>)
//     → computeDeskCashPositions. Each settled foreign-currency balance is a
//       first-class instrument, marked to ZAR (IAS 21 §28).
//   Bonds / Equities / IRD
//     → buildPositionSet (its non-FX positions only — FX is sourced above, so
//       the engine's fx-spot rows are discarded to avoid any double-count).
//
// NO-SILENT-ZERO (D-TRUSTED-FIGURES-PROGRAM-V1): an instrument with any
// unmarkable contributing position surfaces its unrealised as `absent`, never a
// silent 0, and its key joins `unmarkableKeys`. A book inherits absence from any
// unmarkable instrument it contains. Realised P&L is always a resolved number.
//
// Authority:
//   - Marc (CEO) 2026-06-08: Product Control covers all instruments (by
//     instrument) and all books (by book); the FX bucket spans Spot AND Forward.
//   - Camille (CFO, governance) R3 (all-asset-class P&L)
//   - valuation-policy-v1 §3 (mark hierarchy, via the composed engines)
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (no-silent-zero)
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import type { EventStore } from "../event-store/store";
import { type FinancialInput, absent, isPresent, present } from "../types/financial-input";
import { computeDailyPnL } from "./daily-pnl";
import { computeDeskCashPositions } from "./desk-cash-positions";
import { buildPositionSet } from "./position-source";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The asset-class buckets the Product Control page partitions by. "fx" spans
 * FX Spot, Forward, Swap and NDF (all folded by computeDailyPnL). */
export type CrossAssetClass = "fx" | "cash" | "bond" | "equity" | "ird";

/** One instrument's position & P&L, asset-class-agnostic, at (book, instrument)
 * grain. unrealised is a no-silent-zero FinancialInput; realised is always a
 * resolved number (it has crystallised — no mark needed). */
export interface InstrumentBreakdownRow {
  readonly instrumentKey: string;
  readonly assetClass: CrossAssetClass;
  /** FX taxonomy (Spot / Forward / Swap / NDF) — set on FX rows only. */
  readonly fxTaxonomy?: "FX-spot" | "FX-forward" | "FX-swap" | "NDF";
  readonly bookId: string;
  readonly currency: string;
  /** Net signed position size (asset-class units; informational). */
  readonly quantity: number;
  readonly unrealised: FinancialInput<number>;
  readonly realisedZarMinor: number;
  /** Number of underlying live positions / lots behind the row. */
  readonly positionCount: number;
  readonly markStatus: "live" | "stale" | "overnight" | "unavailable" | "marked" | "no-mark";
}

/** One trading book's aggregate across every instrument it holds. */
export interface BookBreakdownRow {
  readonly bookId: string;
  readonly assetClasses: CrossAssetClass[];
  readonly instrumentCount: number;
  readonly positionCount: number;
  readonly unrealised: FinancialInput<number>;
  readonly realisedZarMinor: number;
}

export interface CrossAssetBreakdown {
  readonly instruments: InstrumentBreakdownRow[];
  readonly books: BookBreakdownRow[];
  /** Σ markable instruments' unrealised (ZAR minor) — complete-only total. */
  readonly markableUnrealisedZarMinor: number;
  /** Σ realised across all instruments (ZAR minor). */
  readonly totalRealisedZarMinor: number;
  /** No-silent-zero cross-asset unrealised total. */
  readonly totalUnrealised: FinancialInput<number>;
  /** instrumentKeys with no usable production mark (no-silent-zero ledger). */
  readonly unmarkableKeys: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Aggregate FX per-trade mark statuses into one representative status for the
 * instrument row. Worst (least trustworthy) status wins. */
function worstMarkStatus(
  statuses: readonly ("live" | "stale" | "overnight" | "unavailable")[],
): "live" | "stale" | "overnight" | "unavailable" {
  if (statuses.includes("unavailable")) return "unavailable";
  if (statuses.includes("stale")) return "stale";
  if (statuses.includes("overnight")) return "overnight";
  return "live";
}

interface FxAcc {
  bookId: string;
  pair: string;
  taxonomy: "FX-spot" | "FX-forward" | "FX-swap" | "NDF";
  netBaseMinor: number;
  markable: number; // Σ markable live unrealised (ZAR minor)
  realised: number;
  liveCount: number;
  anyUnmarkable: boolean;
  statuses: ("live" | "stale" | "overnight" | "unavailable")[];
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Build the cross-asset Product Control breakdown as of `reportDate`.
 *
 * Pure read — no appends. `asOfBound` (optional) is forwarded to every composed
 * engine for point-in-time snapshots.
 */
export function buildCrossAssetBreakdown(
  store: EventStore,
  reportDate: string,
  asOfBound?: string,
): CrossAssetBreakdown {
  const rows: InstrumentBreakdownRow[] = [];

  // -------------------------------------------------------------------------
  // 1. FX — Spot & Forward (+ swap/NDF). Group the daily-pnl trades by
  //    (book, pair). Live trades carry the unrealised mark; settled trades
  //    carry crystallised realised; cancelled trades carry neither. A pair with
  //    ANY unmarkable live trade reports unrealised `absent` (no silent 0).
  // -------------------------------------------------------------------------
  const fx = computeDailyPnL(store, reportDate, asOfBound);
  const fxAcc = new Map<string, FxAcc>();
  for (const t of fx.trades) {
    if (t.status === "cancelled") continue;
    const key = `${t.bookId}::${t.pair}`;
    const acc = fxAcc.get(key) ?? {
      bookId: t.bookId,
      pair: t.pair,
      taxonomy: t.productTaxonomy,
      netBaseMinor: 0,
      markable: 0,
      realised: 0,
      liveCount: 0,
      anyUnmarkable: false,
      statuses: [],
    };
    acc.realised += t.realisedPnlZarMinor;
    if (t.status === "live") {
      acc.liveCount += 1;
      acc.netBaseMinor += t.side === "sell" ? -t.notionalBaseMinor : t.notionalBaseMinor;
      acc.statuses.push(t.markStatus);
      if (t.markStatus === "unavailable") acc.anyUnmarkable = true;
      else acc.markable += t.unrealisedPnlZarMinor;
    }
    fxAcc.set(key, acc);
  }
  for (const acc of fxAcc.values()) {
    // Only live positions contribute an unrealised mark. A book/pair with no
    // live leg (fully settled) carries realised only — unrealised present(0).
    const unrealised: FinancialInput<number> =
      acc.liveCount === 0
        ? present(0, `${acc.pair}: no live position — realised-only`)
        : acc.anyUnmarkable
          ? absent(
              `${acc.pair} (${acc.bookId}) has live position(s) with no usable mark — unrealised excluded (no silent 0)`,
              "FxPositionRevalued (production FX mark) per valuation-policy §3.1",
            )
          : present(
              acc.markable,
              `product-control/daily-pnl FxPositionRevalued for ${acc.pair} live legs (Slice-1 FX engine)`,
            );
    rows.push({
      instrumentKey: acc.pair,
      assetClass: "fx",
      fxTaxonomy: acc.taxonomy,
      bookId: acc.bookId,
      currency: "ZAR",
      quantity: acc.netBaseMinor,
      unrealised,
      realisedZarMinor: acc.realised,
      positionCount: acc.liveCount,
      markStatus: acc.liveCount === 0 ? "marked" : worstMarkStatus(acc.statuses),
    });
  }

  // -------------------------------------------------------------------------
  // 2. Desk FX cash (fi:csh:<CCY>:<book>). One instrument per held balance.
  // -------------------------------------------------------------------------
  const cash = computeDeskCashPositions(store, asOfBound);
  for (const p of cash.positions) {
    if (p.fcyQuantityMinor === 0) continue; // flat — no live instrument
    const markable = isPresent(p.unrealisedPnlZarMinor);
    rows.push({
      instrumentKey: p.instrumentId,
      assetClass: "cash",
      bookId: p.bookId,
      currency: p.currency,
      quantity: p.fcyQuantityMinor,
      unrealised: p.unrealisedPnlZarMinor,
      realisedZarMinor: p.realisedZarMinorCumulative,
      positionCount: 1,
      markStatus: markable ? "marked" : "no-mark",
    });
  }

  // -------------------------------------------------------------------------
  // 3. Bonds / Equities / IRD — reuse buildPositionSet's NON-FX positions.
  //    FX is sourced above; discarding the engine's fx-spot rows here avoids a
  //    double-count.
  // -------------------------------------------------------------------------
  const posSet = buildPositionSet(store, reportDate, asOfBound);
  for (const p of posSet.positions) {
    if (p.assetClass === "fx-spot") continue;
    const assetClass: CrossAssetClass = p.assetClass; // bond | equity | ird
    const markable = isPresent(p.markZarMinor);
    rows.push({
      instrumentKey: p.instrumentKey,
      assetClass,
      bookId: p.bookId,
      currency: p.currency,
      quantity: p.quantity,
      unrealised: p.markZarMinor,
      realisedZarMinor: 0,
      positionCount: 1,
      markStatus: markable ? "marked" : "no-mark",
    });
  }

  // -------------------------------------------------------------------------
  // 4. Totals (no-silent-zero) + book aggregation.
  // -------------------------------------------------------------------------
  rows.sort(
    (a, b) =>
      a.assetClass.localeCompare(b.assetClass) ||
      a.bookId.localeCompare(b.bookId) ||
      a.instrumentKey.localeCompare(b.instrumentKey),
  );

  let markableUnrealisedZarMinor = 0;
  let totalRealisedZarMinor = 0;
  const unmarkableKeys: string[] = [];
  for (const r of rows) {
    totalRealisedZarMinor += r.realisedZarMinor;
    if (isPresent(r.unrealised)) markableUnrealisedZarMinor += r.unrealised.value;
    else unmarkableKeys.push(r.instrumentKey);
  }

  const complete = unmarkableKeys.length === 0;
  const totalUnrealised: FinancialInput<number> = complete
    ? present(
        markableUnrealisedZarMinor,
        "product-control/cross-asset: Σ markable positions across FX (spot & forward) + cash + bond + equity + IRD",
      )
    : absent(
        `${unmarkableKeys.length} instrument(s) had no usable production mark — cross-asset unrealised total excludes ${unmarkableKeys.join(", ")}`,
        "production mark for every live position across all asset classes",
      );

  const books = aggregateBooks(rows);

  return {
    instruments: rows,
    books,
    markableUnrealisedZarMinor,
    totalRealisedZarMinor,
    totalUnrealised,
    unmarkableKeys,
  };
}

/** Roll instrument rows up to one row per book. A book inherits absence from
 * any unmarkable instrument it holds (no-silent-zero). */
function aggregateBooks(rows: readonly InstrumentBreakdownRow[]): BookBreakdownRow[] {
  interface BookAcc {
    classes: Set<CrossAssetClass>;
    instrumentCount: number;
    positionCount: number;
    markable: number;
    realised: number;
    unmarkable: string[];
  }
  const byBook = new Map<string, BookAcc>();
  for (const r of rows) {
    const acc = byBook.get(r.bookId) ?? {
      classes: new Set<CrossAssetClass>(),
      instrumentCount: 0,
      positionCount: 0,
      markable: 0,
      realised: 0,
      unmarkable: [],
    };
    acc.classes.add(r.assetClass);
    acc.instrumentCount += 1;
    acc.positionCount += r.positionCount;
    acc.realised += r.realisedZarMinor;
    if (isPresent(r.unrealised)) acc.markable += r.unrealised.value;
    else acc.unmarkable.push(r.instrumentKey);
    byBook.set(r.bookId, acc);
  }
  return [...byBook.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bookId, acc]) => ({
      bookId,
      assetClasses: [...acc.classes].sort(),
      instrumentCount: acc.instrumentCount,
      positionCount: acc.positionCount,
      realisedZarMinor: acc.realised,
      unrealised:
        acc.unmarkable.length === 0
          ? present(acc.markable, `book ${bookId}: Σ markable instruments`)
          : absent(
              `book ${bookId} holds ${acc.unmarkable.length} unmarkable instrument(s) — unrealised excludes ${acc.unmarkable.join(", ")}`,
              "production mark for every instrument in the book",
            ),
    }));
}
