// platform/projections/alm-positions.ts
//
// ALM (Asset-Liability Management) position projection.
//
// Folds events into the four input sets that drive LCR / NSFR computation:
//   - HQLAPosition[]   — Level 1 / Level 2A / Level 2B classification per BCBS D295.
//   - FundingPosition[] — outflow / inflow buckets per BCBS D295 (30-day stress).
//   - ASFItem[]        — Available Stable Funding per BCBS D295/D396.
//   - RSFItem[]        — Required Stable Funding per BCBS D295/D396.
//
// Source events (when they exist):
//   HQLA:
//     - `CollateralInventorySnapshotted` (Tomas + Atlas; deferred substrate).
//     - `TradeBooked` / `TradeSettled` (security positions; partial — see
//       `platform/collateral/inventory.ts` for the live HQLA classifier).
//     - `CapitalEvent` / cash balances (build-phase cash treated as L1 ZAR).
//   Funding:
//     - `DepositTaken` (retail / wholesale classification; not yet emitted).
//     - `SettlementInstructionIssued` (contractual outflows; not yet a typed event).
//     - `FundingLineDrawn` (deferred substrate).
//   ASF / RSF:
//     - Balance-sheet projection (ASF: capital + deposit classes;
//       RSF: HQLA + loans + securities + derivatives) — not yet a typed event.
//
// Build-phase posture (CLAUDE.md "build phase vs licence-day"):
//   None of the funding/ASF/RSF events exist in the store yet (no customers,
//   no deposits, no loans, no derivatives). HQLA is partially queryable by
//   folding `TradeBooked` / `TradeSettled` events through the HQLA classifier
//   (`classifyHQLA`). This module returns empty arrays with an explicit
//   `gaps: string[]` field naming each missing event class — the gaps are
//   the substrate roadmap; explicit is the requirement (brief:
//   `brief:ravi:alm-position-substrate-and-helena-liquidity-line:2026-05-21`).
//
// Once those event classes land (Ravi + Atlas + Tomas), the projection
// switches to live-event mode without changing its signature. Anya's
// handler and Helena's daily run consume the same shape.
//
// Authority: D-RAS (CEO-approved 2026-05-06) · D-MARKETS-CAPITAL-TIME-SHAPE
//   (CEO-approved 2026-05-12) · RRTB Regulation 26 (LCR) · RRTB Regulation
//   26A (NSFR) · BCBS D295 · BCBS D396 · BA 325 · BA 326.
//
// Author: Ravi (Treasury and ALM engineer, engineering)

import { type SecurityDescriptor, classifyHQLA } from "../collateral/hqla-classifier";
import type { EventStore } from "../event-store/store";
import type { FundingPosition, HQLAPosition } from "../liquidity/lcr";
import type { ASFItem, RSFItem } from "../liquidity/nsfr";

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * Snapshot of the ALM position set at a given as-of date.
 *
 * Carries the four input arrays for `computeLCR` and `computeNSFR`, plus
 * an explicit `gaps` array naming each missing event class. In build phase
 * `gaps` is the dominant signal: every array is empty (or partial for HQLA)
 * and `gaps` names the substrate roadmap.
 */
export interface ALMPositionSnapshot {
  /** ISO 8601 — as-of date the snapshot was computed at. */
  readonly asOf: string;
  /** Projection horizon in days (0 = T+0, 30 = T+30, etc.). */
  readonly horizonDays: number;
  /** HQLA positions for LCR numerator (post-classification, pre-haircut). */
  readonly hqlaPositions: readonly HQLAPosition[];
  /** Funding positions (outflows + inflows) for LCR denominator. */
  readonly fundingPositions: readonly FundingPosition[];
  /** Available Stable Funding items for NSFR numerator. */
  readonly asfItems: readonly ASFItem[];
  /** Required Stable Funding items for NSFR denominator. */
  readonly rsfItems: readonly RSFItem[];
  /**
   * Substrate gaps blocking full population. Each entry names an event class
   * that has not yet been wired or has no events in the store. When
   * `gaps.length === 0`, all four arrays are derived from live events.
   */
  readonly gaps: readonly string[];
  /**
   * True when the snapshot is the build-phase fallback (no positions
   * derived from live events; only HQLA may be partially populated from
   * the collateral inventory projection). False when at least one of the
   * four arrays is derived from live (non-empty) event sourcing.
   */
  readonly buildPhase: boolean;
  /** Human-readable note summarising the source + gap inventory. */
  readonly note: string;
}

// ---------------------------------------------------------------------------
// Source-event class names — single-graph discipline (Principle 2)
// ---------------------------------------------------------------------------

/**
 * Event classes this projection consumes when they exist. The strings are
 * the canonical event-type names (see `platform/event-store/event-types/`).
 * They double as gap labels — when an event class is absent from the store,
 * the gap label is emitted verbatim.
 */
export const ALM_POSITION_SOURCE_EVENTS = {
  // HQLA — Tomas + Atlas substrate
  hqlaCollateral: "CollateralInventorySnapshotted",
  hqlaCash: "CashBalanceSnapshotted",
  // Funding — Ravi + Atlas substrate
  fundingDepositTaken: "DepositTaken",
  fundingSettlementOut: "SettlementInstructionIssued",
  fundingLineDraw: "FundingLineDrawn",
  // ASF / RSF — Bea + Ravi substrate (balance-sheet projection)
  asfBalanceSheet: "BalanceSheetProjected",
  rsfBalanceSheet: "BalanceSheetProjected",
} as const;

// ---------------------------------------------------------------------------
// HQLA projection — fold TradeBooked / TradeSettled through HQLA classifier
// ---------------------------------------------------------------------------

interface RawPosition {
  isin: string;
  marketValueZar: number;
  currency: string;
  descriptor: SecurityDescriptor;
}

function extractDescriptor(payload: Record<string, unknown>, isin: string): SecurityDescriptor {
  const assetClass = ((): SecurityDescriptor["assetClass"] => {
    const ac = typeof payload.assetClass === "string" ? payload.assetClass : "";
    if (ac === "sovereign-bond") return "sovereign-bond";
    if (ac === "corporate-bond") return "corporate-bond";
    if (ac === "equity") return "equity";
    if (ac === "covered-bond") return "covered-bond";
    if (ac === "cash") return "cash";
    // Heuristic from ISIN prefix: ZAG = SA government bond, ZAE = JSE equity
    if (isin.startsWith("ZAG")) return "sovereign-bond";
    if (isin.startsWith("ZAE")) return "equity";
    return "other";
  })();

  return {
    isin,
    issuer: typeof payload.issuer === "string" ? payload.issuer : "unknown",
    assetClass,
    creditRating: typeof payload.creditRating === "string" ? payload.creditRating : undefined,
    riskWeight: typeof payload.riskWeight === "number" ? payload.riskWeight : undefined,
    currency: typeof payload.currency === "string" ? payload.currency : "ZAR",
    residualMaturityDays:
      typeof payload.residualMaturityDays === "number" ? payload.residualMaturityDays : undefined,
  };
}

function extractRawPosition(type: string, payload: Record<string, unknown>): RawPosition | null {
  if (type !== "TradeBooked" && type !== "TradeSettled") return null;
  const isin = typeof payload.isin === "string" ? payload.isin : null;
  if (!isin) return null;

  const faceValue =
    typeof payload.faceValue === "number"
      ? payload.faceValue
      : typeof payload.notional === "number"
        ? payload.notional
        : 0;
  const marketValueZar =
    typeof payload.marketValueZar === "number"
      ? payload.marketValueZar
      : typeof payload.marketValue === "number"
        ? payload.marketValue
        : faceValue;
  const currency = typeof payload.currency === "string" ? payload.currency : "ZAR";

  return {
    isin,
    marketValueZar,
    currency,
    descriptor: extractDescriptor(payload, isin),
  };
}

/**
 * Read HQLA positions by folding `TradeBooked` and `TradeSettled` events
 * through the HQLA classifier (`classifyHQLA`).
 *
 * Returns the per-tier pre-haircut positions as `HQLAPosition[]` (pre-cap;
 * `computeLCR` applies the L2 / L2b caps + haircuts downstream). Returns
 * an empty array when no trades exist (build-phase default).
 *
 * This is a self-contained fold against the passed `EventStore`. It does
 * not call `getCollateralInventory()` because that function reaches for
 * the composition singleton, which breaks isolated-store testing.
 * Once `CollateralInventorySnapshotted` events flow (Tomas + Atlas
 * substrate), this helper swaps to consuming those events directly.
 */
function readHQLAFromEventStore(eventStore: EventStore, asOf: string): HQLAPosition[] {
  // Aggregate positions by ISIN — latest trade event wins.
  const positionMap = new Map<string, RawPosition>();

  for (const event of eventStore.replay({ type: "TradeBooked" })) {
    if (event.as_of > asOf) continue;
    const raw = extractRawPosition(event.type, event.payload as Record<string, unknown>);
    if (!raw) continue;
    positionMap.set(raw.isin, raw);
  }
  for (const event of eventStore.replay({ type: "TradeSettled" })) {
    if (event.as_of > asOf) continue;
    const raw = extractRawPosition(event.type, event.payload as Record<string, unknown>);
    if (!raw) continue;
    positionMap.set(raw.isin, raw);
  }

  const out: HQLAPosition[] = [];
  for (const raw of positionMap.values()) {
    const classification = classifyHQLA(raw.descriptor);
    if (classification.level === "non-HQLA") continue;
    out.push({
      amountZar: raw.marketValueZar,
      tier: classification.level,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the ALM position snapshot for a given as-of date and projection
 * horizon.
 *
 * This is the canonical entry point for liquidity-position queries: Anya's
 * daily handler, Helena's daily appetite-watch, and any ad-hoc
 * `computeLCR` / `computeNSFR` caller goes through this projection rather
 * than synthesising input arrays in-handler.
 *
 * Build-phase posture:
 *   - HQLA: folded from `TradeBooked` / `TradeSettled` events through
 *     `classifyHQLA` (empty when no trades exist).
 *   - Funding / ASF / RSF: not yet wired (no source event classes exist).
 *     The `gaps` array names each missing class.
 *
 * @param eventStore  - the event store to fold against (caller passes the
 *                      composition singleton in production; tests pass an
 *                      isolated in-memory store).
 * @param asOf        - ISO 8601 run timestamp.
 * @param horizonDays - projection horizon (0 = T+0, 30 = T+30, etc.).
 */
export function getALMPositionSnapshot(
  eventStore: EventStore,
  asOf: string,
  horizonDays: number,
): ALMPositionSnapshot {
  const gaps: string[] = [];

  // -------------------------------------------------------------------------
  // HQLA — fold TradeBooked / TradeSettled events through HQLA classifier.
  // Partial wiring: full HQLA substrate (CollateralInventorySnapshotted) lands
  // with Tomas + Atlas; until then, security positions from the trade stream
  // are the only source. Build-phase empty by construction.
  // -------------------------------------------------------------------------
  const hqlaPositions = readHQLAFromEventStore(eventStore, asOf);

  // Detect whether any of the canonical HQLA-source events exist; if not,
  // record the gap. (`getCollateralInventory()` reads TradeBooked /
  // TradeSettled today; the full HQLA substrate is `CollateralInventory-
  // Snapshotted`. Mark the gap if no snapshotted events are present.)
  if (!hasAnyEventOfType(eventStore, ALM_POSITION_SOURCE_EVENTS.hqlaCollateral)) {
    gaps.push(
      `${ALM_POSITION_SOURCE_EVENTS.hqlaCollateral}: not yet emitted (Tomas + Atlas substrate). HQLA derived from TradeBooked/TradeSettled events via collateral inventory projection; ${hqlaPositions.length} position(s) found.`,
    );
  }

  // -------------------------------------------------------------------------
  // Funding — none of the source events exist yet
  // -------------------------------------------------------------------------
  const fundingPositions: FundingPosition[] = [];
  if (!hasAnyEventOfType(eventStore, ALM_POSITION_SOURCE_EVENTS.fundingDepositTaken)) {
    gaps.push(
      `${ALM_POSITION_SOURCE_EVENTS.fundingDepositTaken}: not yet emitted (Ravi + Atlas substrate). Retail / wholesale deposit classification per BA 325 §19 not yet queryable.`,
    );
  }
  if (!hasAnyEventOfType(eventStore, ALM_POSITION_SOURCE_EVENTS.fundingSettlementOut)) {
    gaps.push(
      `${ALM_POSITION_SOURCE_EVENTS.fundingSettlementOut}: not yet emitted (Ravi + Atlas substrate). Contractual settlement outflows over the ${horizonDays}-day horizon not yet queryable.`,
    );
  }
  if (!hasAnyEventOfType(eventStore, ALM_POSITION_SOURCE_EVENTS.fundingLineDraw)) {
    gaps.push(
      `${ALM_POSITION_SOURCE_EVENTS.fundingLineDraw}: not yet emitted (Ravi + Atlas substrate). Drawn funding-line balances not yet queryable.`,
    );
  }

  // -------------------------------------------------------------------------
  // ASF / RSF — derived from balance-sheet projection (not yet wired)
  // -------------------------------------------------------------------------
  const asfItems: ASFItem[] = [];
  const rsfItems: RSFItem[] = [];
  if (!hasAnyEventOfType(eventStore, ALM_POSITION_SOURCE_EVENTS.asfBalanceSheet)) {
    gaps.push(
      `${ALM_POSITION_SOURCE_EVENTS.asfBalanceSheet}: not yet emitted (Bea + Ravi substrate). ASF/RSF derivation per BA 326 / BCBS D295 requires a balance-sheet projection; not yet queryable.`,
    );
  }

  // -------------------------------------------------------------------------
  // Note + buildPhase flag
  // -------------------------------------------------------------------------
  const totalPositionCount =
    hqlaPositions.length + fundingPositions.length + asfItems.length + rsfItems.length;
  const buildPhase = totalPositionCount === 0;

  const note = buildPhase
    ? `Build-phase ALM snapshot at ${asOf} (T+${horizonDays}d): no positions derived from live events. ${gaps.length} substrate gap(s) named. Anya's downstream LCR/NSFR computation returns 'no-positions'; Helena's appetite line reports green-with-substrate-gap.`
    : `Live ALM snapshot at ${asOf} (T+${horizonDays}d): ${hqlaPositions.length} HQLA position(s), ${fundingPositions.length} funding position(s), ${asfItems.length} ASF item(s), ${rsfItems.length} RSF item(s). ${gaps.length} residual substrate gap(s).`;

  return {
    asOf,
    horizonDays,
    hqlaPositions,
    fundingPositions,
    asfItems,
    rsfItems,
    gaps,
    buildPhase,
    note,
  };
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/**
 * Cheap "has at least one event of type `t`" check via the event store's
 * filtered replay. Returns on the first match; does not iterate the full
 * event set. Used for gap detection (we only need a yes/no per event class).
 */
function hasAnyEventOfType(eventStore: EventStore, t: string): boolean {
  for (const _e of eventStore.replay({ type: t })) {
    return true;
  }
  return false;
}
