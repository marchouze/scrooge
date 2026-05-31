// platform/product-control/position-source.ts
//
// All-asset-class position source — the SecurityMaster-keyed abstraction that
// makes Product Control's daily P&L asset-class-agnostic.
//
// Slice-1 of WS-PRODUCT-CONTROL shipped a daily P&L engine that replays only
// FxTradeExecuted. The bank actually trades JSE bonds, JSE-listed equities and
// OTC IRD as well. This module introduces a single position-source interface
// that yields *priced* positions across every asset class:
//
//   FX-spot       → reuses computeDailyPnL (the Slice-1 FX engine) UNCHANGED;
//                   each FX position is surfaced as an AssetClassPosition whose
//                   mark is the already-computed unrealised P&L. The FX path is
//                   therefore a pure passthrough — no regression possible.
//   bond / equity → folded from the unified-position projection
//                   (markets.unified-position), priced from OfficialMarkAdopted
//                   markType "price" at the position's instrumentKey.
//   IRD (IRS)     → folded from the unified-position projection, priced from
//                   OfficialMarkAdopted markType "curve-point" on the funding
//                   curve. No curve substrate exists yet (valuation-policy Gap
//                   5) so the mark is ABSENT, never a silent 0.
//
// Per-asset mark sourcing follows valuation-policy-v1 §3 hierarchy:
//   §3.3 JSE bond clean prices  → OfficialMarkAdopted{markType:"price"}
//   §3.1 FX spot                → (handled inside computeDailyPnL via reval)
//   §3.2 ZAR swap curve         → OfficialMarkAdopted{markType:"curve-point"}
//   JSE-listed equity (Level 1) → OfficialMarkAdopted{markType:"price"}
//
// NO-SILENT-ZERO (the whole point): any asset class lacking a production mark
// surfaces as `absent` (FinancialInput<number>), never folded as a 0. A bond
// position with no JSE EOD price, an equity with no close, an IRS with no curve
// — each is carried with `mark: absent(...)` and excluded from the markable
// total, exactly as daily-pnl.ts excludes unmarkable-live FX positions.
//
// IMPORTANT — Slice-1 contract preservation: this module does NOT touch
// computeDailyPnL's signature or its DailyPnLResult shape. pnl-attribution.ts
// continues to consume computeDailyPnL exactly as before. The position source
// is a NEW, additive read layer that *consumes* computeDailyPnL for FX rather
// than replacing it.
//
// Authority:
//   - Camille (CFO, governance) recommendation R3 (all-asset-class P&L + IPV)
//   - valuation-policy-v1 §3 (market data source hierarchy)
//   - pricing-policy-v1 §5 (IPV)
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (no-silent-zero)
//   - D-FINANCIAL-INSTRUMENT-ENTITY (unified instrument entity / SecurityMaster)
//   - brief:bea:all-asset-class-p-l-ipv-coverage-mvp:2026-05-31
//
// Author: Bea (Accounting & financial reporting engineer, engineering),
//   with Rohan (Risk engineer, engineering) risk inputs (mark hierarchy).

import type { OfficialMarkAdoptedPayload } from "../event-store/event-types/valuation";
import type { EventStore } from "../event-store/store";
import {
  type UnifiedPositionRow,
  type UnifiedPositionState,
  unifiedPositionInitial,
  unifiedPositionProjection,
} from "../projections/markets/unified-position";
import { type FinancialInput, absent, isPresent, present } from "../types/financial-input";
import { computeDailyPnL } from "./daily-pnl";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The asset classes the bank's position set spans (Strategic foundation). */
export type AssetClass = "fx-spot" | "bond" | "equity" | "ird";

/**
 * The mark parameter type used to revalue an asset class — aligned with
 * OfficialMarkAdopted.markType. Drives which mark feed the position-source
 * looks up, and (downstream) which IPV per-parameter tolerance applies.
 *   price        → bonds / equities (clean price / closing print)
 *   fx-rate      → FX spot
 *   curve-point  → IRD (interest-rate curve)
 *   vol-point    → options (not yet traded; reserved)
 */
export type MarkParameterType = "price" | "fx-rate" | "curve-point" | "vol-point";

/**
 * A single position, asset-class-agnostic, with its mark resolved as a
 * no-silent-zero FinancialInput. `markZarMinor` present ⟹ the position was
 * markable (production mark found at the SecurityMaster-derived key); absent ⟹
 * no usable mark exists and the position must NOT contribute a silent 0.
 */
export interface AssetClassPosition {
  /** SecurityMaster-keyed canonical instrument id (e.g. "fi:bond:ZAG...", FX pair). */
  readonly instrumentKey: string;
  readonly assetClass: AssetClass;
  /** The IFRS-13 mark parameter type used to revalue this position. */
  readonly markParameterType: MarkParameterType;
  /** Owning book. */
  readonly bookId: string;
  /** Net quantity (asset-class units; informational for the P&L layer). */
  readonly quantity: number;
  /** Trade currency (ISO 4217). */
  readonly currency: string;
  /**
   * Unrealised mark-to-market P&L in ZAR minor, as a FinancialInput. `present`
   * only when a production mark resolved at the position's SecurityMaster key;
   * `absent` (with reason + expectedFrom) when no mark feed covers it.
   */
  readonly markZarMinor: FinancialInput<number>;
  /**
   * IFRS-13 fair-value level of the mark, when present. Undefined when the
   * mark is absent (no level can be asserted without a mark).
   */
  readonly fairValueLevel: "1" | "2" | "3" | undefined;
}

/** The cross-asset position set, partitioned by markability. */
export interface PositionSet {
  readonly positions: readonly AssetClassPosition[];
  /** Σ markable positions' markZarMinor (ZAR minor) — the complete-only total. */
  readonly markableTotalZarMinor: number;
  /** instrumentKeys of positions with no usable mark (no-silent-zero ledger). */
  readonly unmarkableKeys: readonly string[];
  /**
   * The cross-asset unrealised total as a no-silent-zero FinancialInput:
   * `present` when every position was markable; `absent` (degraded) when ≥1
   * position lacked a mark. The markable partial sum stays on
   * `markableTotalZarMinor` for display alongside the incompleteness signal.
   */
  readonly totalUnrealised: FinancialInput<number>;
}

// ---------------------------------------------------------------------------
// Mark sourcing (valuation-policy §3 hierarchy)
// ---------------------------------------------------------------------------

/**
 * Latest OfficialMarkAdopted per (markType, instrumentKey), folded in replay
 * order (last-write-wins). Carries the fair-value level so a priced position
 * can declare its IFRS-13 level without re-deriving it.
 */
interface ResolvedMark {
  readonly mark: number;
  readonly fairValueLevel: "1" | "2" | "3";
}

function foldOfficialMarks(store: EventStore): Map<string, ResolvedMark> {
  // Key: `${markType}::${instrumentKey}` — kept distinct so a "price" mark and
  // a "curve-point" mark on the same key never collide.
  const byKey = new Map<string, ResolvedMark>();
  for (const e of store.replay({ type: "OfficialMarkAdopted" })) {
    const p = e.payload as unknown as OfficialMarkAdoptedPayload;
    const value = Number(p.mark);
    if (!Number.isFinite(value)) continue;
    byKey.set(`${p.markType}::${p.instrumentKey}`, {
      mark: value,
      fairValueLevel: p.fairValueLevel,
    });
  }
  return byKey;
}

/** The OfficialMarkAdopted markType used to revalue a given asset class. */
function markTypeForAssetClass(assetClass: AssetClass): MarkParameterType {
  switch (assetClass) {
    case "fx-spot":
      return "fx-rate";
    case "bond":
    case "equity":
      return "price";
    case "ird":
      return "curve-point";
  }
}

/** Human-readable §3 hierarchy source label, for absent-input lineage. */
function hierarchySourceLabel(assetClass: AssetClass): string {
  switch (assetClass) {
    case "fx-spot":
      return "valuation-policy §3.1 (FX spot — production fx-quote / SARB fixing fallback)";
    case "bond":
      return "valuation-policy §3.3 (JSE end-of-day bond clean price)";
    case "equity":
      return "valuation-policy §3 (JSE-listed equity closing price — Level 1)";
    case "ird":
      return "valuation-policy §3.2 (ZAR swap / JIBAR curve point)";
  }
}

/**
 * Mark a unified-position row to market in ZAR minor, returning a no-silent-zero
 * FinancialInput. The row already carries an unrealisedPnl derived from its
 * lastObservedPrice; this function REPLACES that trade-derived proxy with a mark
 * sourced from OfficialMarkAdopted (the production, IPV-able mark) per the §3
 * hierarchy. When no production mark exists for the position's instrument, the
 * result is `absent` — never the trade-price proxy and never a 0.
 *
 * MVP unrealised = (mark − averageCost) × quantity, in the position currency's
 * minor units. Multi-currency FX translation to ZAR is a downstream concern
 * folded by the GL posting rules; for the MVP non-ZAR books surface their mark
 * in the position currency and are flagged via `currency` so the absence of a
 * ZAR translation is explicit rather than silent.
 */
function markUnifiedRow(
  row: UnifiedPositionRow,
  marks: Map<string, ResolvedMark>,
  assetClass: AssetClass,
): { markZarMinor: FinancialInput<number>; fairValueLevel: "1" | "2" | "3" | undefined } {
  const markType = markTypeForAssetClass(assetClass);
  const resolved = marks.get(`${markType}::${row.key.instrumentId}`);
  if (!resolved) {
    return {
      markZarMinor: absent(
        `no production ${markType} mark for ${row.key.instrumentId} — ${assetClass} position cannot be marked (no silent 0)`,
        `OfficialMarkAdopted{markType:"${markType}"} sourced per ${hierarchySourceLabel(assetClass)}`,
      ),
      fairValueLevel: undefined,
    };
  }
  // Unrealised = (mark − averageCost) × quantity. The row's quantity is signed
  // (long positive / short negative); the sign carries through so a short
  // position gains when the mark falls.
  const unrealised = Math.round((resolved.mark - row.averageCost) * row.quantity);
  return {
    markZarMinor: present(
      unrealised,
      `OfficialMarkAdopted{markType:"${markType}"} @ ${row.key.instrumentId} (IFRS-13 L${resolved.fairValueLevel}); ${hierarchySourceLabel(assetClass)}`,
    ),
    fairValueLevel: resolved.fairValueLevel,
  };
}

// ---------------------------------------------------------------------------
// Position-source engine
// ---------------------------------------------------------------------------

/** Replay the unified-position projection to its current state. */
function foldUnifiedPositions(store: EventStore): UnifiedPositionState {
  let state = unifiedPositionInitial;
  for (const e of store.replay({})) {
    if (unifiedPositionProjection.accepts(e)) {
      state = unifiedPositionProjection.reduce(state, e);
    }
  }
  return state;
}

function unifiedAssetClass(row: UnifiedPositionRow): AssetClass {
  switch (row.assetClass) {
    case "equity":
      return "equity";
    case "bond":
      return "bond";
    case "irs":
      return "ird";
  }
}

/**
 * Build the cross-asset position set as of `reportDate`, with every position's
 * mark resolved as a no-silent-zero FinancialInput per the §3 hierarchy.
 *
 * Pure read — no appends.
 *
 * FX-spot positions are sourced by REUSING computeDailyPnL (the Slice-1 engine)
 * UNCHANGED: each live FX trade row becomes an AssetClassPosition carrying the
 * row's already-computed unrealised P&L (present when the FX row was markable;
 * absent when daily-pnl flagged it markStatus "unavailable"). This guarantees
 * the FX numbers are byte-for-byte identical to what Slice 1 produces.
 *
 * Bond / equity / IRD positions are folded from the unified-position projection
 * and priced from OfficialMarkAdopted.
 *
 * `asOfBound` (optional) is forwarded to computeDailyPnL for point-in-time FX
 * snapshots, mirroring its signature.
 */
export function buildPositionSet(
  store: EventStore,
  reportDate: string,
  asOfBound?: string,
): PositionSet {
  const positions: AssetClassPosition[] = [];

  // -------------------------------------------------------------------------
  // 1. FX-spot — reuse the Slice-1 engine UNCHANGED. Each live FX trade row is
  //    surfaced as a position; its mark is the row's unrealised P&L, present
  //    when markable and absent when daily-pnl flagged it unmarkable. Settled /
  //    cancelled rows carry no live unrealised mark and are skipped here (their
  //    P&L has crystallised into realised, which the daily-pnl total still owns).
  // -------------------------------------------------------------------------
  const fx = computeDailyPnL(store, reportDate, asOfBound);
  for (const row of fx.trades) {
    if (row.status !== "live") continue;
    const markable = row.markStatus !== "unavailable";
    positions.push({
      instrumentKey: row.pair,
      assetClass: "fx-spot",
      markParameterType: "fx-rate",
      bookId: row.bookId,
      quantity: 0, // FX notional lives on the FX engine; not re-surfaced here.
      currency: "ZAR", // P&L already in ZAR minor (functional currency).
      markZarMinor: markable
        ? present(
            row.unrealisedPnlZarMinor,
            `product-control/daily-pnl FxPositionRevalued for ${row.tradeId} (Slice-1 FX engine, unchanged)`,
          )
        : absent(
            `FX position ${row.tradeId} (${row.pair}) had no usable mark (markStatus=${row.markStatus}) — excluded (no silent 0)`,
            "FxPositionRevalued (production FX mark) per valuation-policy §3.1",
          ),
      // FX marks in the build phase are SARB-fixing fallback (Level 2) per
      // valuation-policy §3.1 / Gap 1; the daily-pnl engine does not surface a
      // per-row IFRS-13 level, so leave undefined rather than assert one.
      fairValueLevel: undefined,
    });
  }

  // -------------------------------------------------------------------------
  // 2. Bond / equity / IRD — fold the unified-position projection and price
  //    each row from OfficialMarkAdopted per the §3 hierarchy.
  // -------------------------------------------------------------------------
  const marks = foldOfficialMarks(store);
  const unified = foldUnifiedPositions(store);
  for (const row of unified.rows.values()) {
    // A flat (closed) position carries no live unrealised mark.
    if (row.quantity === 0) continue;
    const assetClass = unifiedAssetClass(row);
    const { markZarMinor, fairValueLevel } = markUnifiedRow(row, marks, assetClass);
    positions.push({
      instrumentKey: row.key.instrumentId,
      assetClass,
      markParameterType: markTypeForAssetClass(assetClass),
      bookId: row.key.bookId,
      quantity: row.quantity,
      currency: row.currency,
      markZarMinor,
      fairValueLevel,
    });
  }

  // -------------------------------------------------------------------------
  // 3. Partition by markability — markable positions fold into the total; the
  //    rest are tracked so the aggregate declares itself incomplete.
  // -------------------------------------------------------------------------
  let markableTotalZarMinor = 0;
  const unmarkableKeys: string[] = [];
  for (const p of positions) {
    if (isPresent(p.markZarMinor)) {
      markableTotalZarMinor += p.markZarMinor.value;
    } else {
      unmarkableKeys.push(p.instrumentKey);
    }
  }

  const complete = unmarkableKeys.length === 0;
  const totalUnrealised: FinancialInput<number> = complete
    ? present(
        markableTotalZarMinor,
        "product-control/position-source: Σ markable cross-asset positions (FX + bond + equity + IRD)",
      )
    : absent(
        `${unmarkableKeys.length} position(s) had no usable production mark — cross-asset unrealised total is incomplete (excludes ${unmarkableKeys.join(", ")})`,
        "OfficialMarkAdopted (production mark) for every live position across all asset classes",
      );

  return {
    positions,
    markableTotalZarMinor,
    unmarkableKeys,
    totalUnrealised,
  };
}
