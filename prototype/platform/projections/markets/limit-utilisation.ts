// platform/projections/markets/limit-utilisation.ts
//
// Slice 5 — LimitUtilisationProjection (Rohan / Helena).
//
// Folds:
//   - RasLimitSchedulePublished — sets the denominator (limit values) per cluster.
//   - TradeExecuted             — adds notional to the relevant cluster bucket.
//   - EquityTradeBooked         — adds consideration amount to B3 (market risk).
//   - FxTradeExecuted           — adds notional to B3 (FX) or B1 (credit).
//   - OrderRejected             — records the utilisation snapshot at rejection
//                                 (no exposure change; the order was blocked).
//   - PositionUpdated           — if emitted, updates cluster exposure directly.
//
// RAG status per cluster:
//   green  — utilisationPct < 0.70
//   amber  — 0.70 ≤ utilisationPct < 0.90
//   red    — utilisationPct ≥ 0.90
//
// Defaults: if no RasLimitSchedulePublished has been emitted, utilisation
// rows carry zero exposure and an infinite denominator (no RAG breach).
// If no trade events exist, currentExposure = 0 per the seed state.
//
// Principle 1 — this projection is a derived cache; the event log is truth.
// Principle 2 — every quantity cites the RAS framework (ORG-PR-19/48) and the
//               JSE Integrated Risk Controls obligation (ORG-JSE-IRC-01).
//
// Authors: Rohan (Risk engineer) + Helena (Chief Risk Officer, governance)
// Authority: D-MARKETS-SCHEMA-FOUNDATION Slice 5

import type {
  OrderRejectedPayload,
  RasLimitRow,
  RasLimitSchedulePublishedPayload,
  RiskCluster,
} from "../../event-store/event-types/trading";
import type { Event } from "../../event-store/types";
import { type MarketDataStore, lookupQuoteWithInverse } from "../../market-data/store";

// ---------------------------------------------------------------------------
// Row type (public API)
// ---------------------------------------------------------------------------

export interface LimitUtilisationRow {
  cluster: RiskCluster;
  limitName: string;
  utilisationPct: number; // 0.0–1.0
  limitValue: number;
  currentExposure: number;
  currency: string;
  ragStatus: "green" | "amber" | "red";
  asOf: string;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface LimitUtilisationState {
  // Latest schedule rows, keyed by cluster
  schedule: Map<RiskCluster, RasLimitRow>;
  // Signed net FX position per ISO 4217 currency code (major units)
  // Buy EUR/USD: +EUR, −USD. Netting is automatic. Never drops on settlement.
  fxNetPosition: Map<string, number>;
  // Accumulated exposure per cluster — B1 pre-settlement credit, B2/B4/B5, non-FX B3
  exposure: Map<RiskCluster, number>;
  // Latest event timestamp
  asOf: string;
}

const CLUSTERS: RiskCluster[] = ["B1", "B2", "B3", "B4", "B5"];

function initialState(): LimitUtilisationState {
  return {
    schedule: new Map(),
    fxNetPosition: new Map(),
    exposure: new Map(CLUSTERS.map((c) => [c, 0])),
    asOf: new Date().toISOString(),
  };
}

function ragStatus(
  utilisationPct: number,
  amberThreshold: number,
  redThreshold: number,
): "green" | "amber" | "red" {
  if (utilisationPct >= redThreshold) return "red";
  if (utilisationPct >= amberThreshold) return "amber";
  return "green";
}

// ---------------------------------------------------------------------------
// Reducer helpers
// ---------------------------------------------------------------------------

function addExposure(
  state: LimitUtilisationState,
  cluster: RiskCluster,
  amount: number,
  asOf: string,
): LimitUtilisationState {
  const prev = state.exposure.get(cluster) ?? 0;
  const next = new Map(state.exposure);
  next.set(cluster, prev + Math.abs(amount));
  return { ...state, exposure: next, asOf };
}

// ---------------------------------------------------------------------------
// Projection state singleton (in-memory; deterministic over event stream)
// ---------------------------------------------------------------------------

let _state: LimitUtilisationState = initialState();

function reset(): void {
  _state = initialState();
}

function apply(event: Event): void {
  const asOf = event.as_of;

  switch (event.type) {
    case "RasLimitSchedulePublished": {
      const payload = event.payload as unknown as RasLimitSchedulePublishedPayload;
      const newSchedule = new Map<RiskCluster, RasLimitRow>();
      for (const row of payload.limits) {
        newSchedule.set(row.cluster, row);
      }
      // Preserve existing exposures; only replace the schedule
      _state = { ..._state, schedule: newSchedule, asOf };
      break;
    }

    case "TradeExecuted": {
      // Generic TradeExecuted — treat as market-risk (B3) notional contribution.
      // The payload shape varies by product; extract `notional` or `price * quantity`
      // as a best-effort proxy.
      const p = event.payload as Record<string, unknown>;
      const notional =
        typeof p.notional === "number" ? p.notional : typeof p.amount === "number" ? p.amount : 0;
      if (notional > 0) {
        _state = addExposure(_state, "B3", notional, asOf);
      }
      break;
    }

    case "EquityTradeBooked": {
      // B3 — market risk (FX notional for listed equity trades denominated in ZAR)
      const p = event.payload as Record<string, unknown>;
      const consideration = p.consideration as Record<string, unknown> | undefined;
      const amount =
        consideration && typeof consideration.amount === "number" ? consideration.amount : 0;
      if (amount > 0) {
        _state = addExposure(_state, "B3", amount, asOf);
      }
      break;
    }

    case "FxTradeExecuted":
      // Handled inline in rebuildLimitUtilisation() where cancelled/confirmed
      // sets are available for per-cluster filtering (B3 vs B1 have different
      // filtering rules). This case is intentionally a no-op in apply().
      break;

    case "OrderRejected": {
      // OrderRejected carries `utilisationAtRejection` as a snapshot.
      // We don't increment exposure (order was blocked), but we do update
      // the asOf timestamp.
      const p = event.payload as unknown as OrderRejectedPayload;
      _state = { ..._state, asOf: p.timestamp || asOf };
      break;
    }

    case "PositionUpdated": {
      // If a PositionUpdated event is emitted, it carries a cluster-specific
      // exposure snapshot. Overwrite the exposure for that cluster directly.
      const p = event.payload as Record<string, unknown>;
      const cluster = p.riskCluster as RiskCluster | undefined;
      const exposure = typeof p.exposure === "number" ? p.exposure : 0;
      if (cluster && CLUSTERS.includes(cluster) && exposure >= 0) {
        const next = new Map(_state.exposure);
        next.set(cluster, exposure);
        _state = { ..._state, exposure: next, asOf };
      }
      break;
    }

    default:
      // Unrecognised event type — no-op (projection is selective)
      break;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Rebuild the projection by replaying all relevant events from the store.
 * Call this before reading `getLimitUtilisations()` if you need a fresh view.
 *
 * Two-pass approach for cancellations (Principle 1 — the event log is truth):
 *   Pass 1: collect all FxTradeCancelled tradeIds into a Set.
 *   Pass 2: apply all relevant events, skipping FxTradeExecuted whose tradeId
 *           is in the cancelled set.
 * This ensures cancellations work correctly regardless of event ordering in
 * the store (cancellations always arrive after executions chronologically,
 * but the fold must be order-independent for replay correctness).
 */
export function rebuildLimitUtilisation(events: readonly Event[]): void {
  reset();

  // Pass 1 — collect trade IDs by lifecycle state.
  //   cancelledTradeIds: FxTradeCancelled → skip from B3 AND B1 entirely.
  //   confirmedTradeIds: SettlementConfirmed → skip from B1 only (position
  //     remains in B3; the bank still holds the foreign currency).
  const cancelledTradeIds = new Set<string>();
  const confirmedTradeIds = new Set<string>();
  for (const e of events) {
    if (e.type === "FxTradeCancelled") {
      const p = e.payload as Record<string, unknown>;
      if (typeof p.tradeId === "string") cancelledTradeIds.add(p.tradeId);
    }
    if (e.type === "SettlementConfirmed") {
      const p = e.payload as Record<string, unknown>;
      if (typeof p.tradeId === "string") confirmedTradeIds.add(p.tradeId);
    }
  }

  const relevant = new Set([
    "RasLimitSchedulePublished",
    "TradeExecuted",
    "EquityTradeBooked",
    "FxTradeExecuted",
    "OrderRejected",
    "PositionUpdated",
  ]);
  for (const e of events) {
    if (!relevant.has(e.type)) continue;

    if (e.type === "FxTradeExecuted") {
      const p = e.payload as Record<string, unknown>;
      const tradeIdRaw = p.tradeId as Record<string, unknown> | string | undefined;
      const tradeIdValue =
        typeof tradeIdRaw === "string"
          ? tradeIdRaw
          : typeof tradeIdRaw?.value === "string"
            ? tradeIdRaw.value
            : null;

      // Cancelled trades: no position, no credit exposure.
      if (tradeIdValue && cancelledTradeIds.has(tradeIdValue)) continue;

      const asOf = e.as_of;

      // B3 — signed net position per currency (near leg).
      // Buy EUR/USD: +EUR, −USD. Netting is automatic.
      // Settlement does NOT remove this: the bank holds the foreign currency
      // in its nostro after T+2, so market risk persists.
      const legs = Array.isArray(p.legs) ? (p.legs as Record<string, unknown>[]) : [];
      const nearLeg = legs.find((l) => l.legKind === "near") ?? legs[0];
      if (nearLeg) {
        const receiveCcy =
          typeof nearLeg.receiveCurrency === "string" ? nearLeg.receiveCurrency : null;
        const payCcy = typeof nearLeg.payCurrency === "string" ? nearLeg.payCurrency : null;
        const rcvNotional = nearLeg.counterNotional as Record<string, unknown> | undefined;
        const payNotional = nearLeg.notional as Record<string, unknown> | undefined;
        const rcvMinor = typeof rcvNotional?.amountMinor === "number" ? rcvNotional.amountMinor : 0;
        const payMinor = typeof payNotional?.amountMinor === "number" ? payNotional.amountMinor : 0;

        if (receiveCcy) {
          const next = new Map(_state.fxNetPosition);
          next.set(receiveCcy, (next.get(receiveCcy) ?? 0) + rcvMinor / 100);
          _state = { ..._state, fxNetPosition: next, asOf };
        }
        if (payCcy) {
          const next = new Map(_state.fxNetPosition);
          next.set(payCcy, (next.get(payCcy) ?? 0) - Math.abs(payMinor) / 100);
          _state = { ..._state, fxNetPosition: next, asOf };
        }
      }

      // B1 — pre-settlement counterparty credit (10% of notional).
      // Drops to zero once SettlementConfirmed: the bank no longer has a
      // receivable from the counterparty.
      if (!tradeIdValue || !confirmedTradeIds.has(tradeIdValue)) {
        const leg0 = legs[0] as Record<string, unknown> | undefined;
        const leg0Notional = leg0?.notional as Record<string, unknown> | undefined;
        const amountMinor =
          typeof leg0Notional?.amountMinor === "number" ? leg0Notional.amountMinor : 0;
        if (amountMinor > 0) {
          _state = addExposure(_state, "B1", (amountMinor / 100) * 0.1, asOf);
        }
      }

      continue;
    }

    apply(e);
  }
}

/**
 * Returns a snapshot of the current signed net FX position per ISO 4217 currency code.
 * Positive = net long, negative = net short. ZAR may be present as the home currency.
 * Read-only — callers must not mutate the returned map.
 */
export function getFxNetPositions(): ReadonlyMap<string, number> {
  return _state.fxNetPosition;
}

/**
 * Canonical B3 (Market Risk — Net Open Position) formula.
 *
 *   B3 = Σ |netPosition(CCY)| × rate(CCY/ZAR)   for all FOREIGN CCY
 *      + nonFxB3   (notional from TradeExecuted / EquityTradeBooked)
 *
 * ZAR is the bank's reporting/home currency and is excluded from NOP per
 * BA 600 — home-currency residuals are not an FX risk.
 *
 * Pass `marketDataStore` for ZAR-equivalent conversion. Without it, foreign
 * CCY units are summed raw (correct topology, wrong scale for multi-currency
 * books — only use in tests or fallback contexts).
 *
 * This is the single authoritative implementation of the B3 metric. All
 * consumers (limit-utilisation projection, sim engine, reporting) must call
 * this function rather than re-implementing the formula.
 */
export function computeB3Exposure(
  netPositions: ReadonlyMap<string, number>,
  nonFxB3: number,
  marketDataStore?: MarketDataStore,
): number {
  let fxB3 = 0;
  for (const [ccy, position] of netPositions) {
    const absPos = Math.abs(position);
    if (absPos === 0) continue;
    if (ccy === "ZAR") continue; // home currency — excluded from NOP (BA 600)
    if (marketDataStore) {
      const quote = lookupQuoteWithInverse(marketDataStore, `${ccy}/ZAR`);
      if (quote) fxB3 += absPos * quote.rate;
      // No rate available → 0 contribution (rather than silently inflating)
    } else {
      fxB3 += absPos;
    }
  }
  return fxB3 + nonFxB3;
}

/**
 * Returns the current per-cluster utilisation rows.
 *
 * Pass `marketDataStore` to enable ZAR-equivalent B3 computation from the net
 * FX position map. Without it, B3 reports raw CCY-unit absolute positions
 * (correct topology, wrong scale for multi-currency books).
 *
 * If no RasLimitSchedulePublished has been emitted, returns five placeholder
 * rows with zero exposure and zero limit (status: green, no limit active).
 */
export function getLimitUtilisations(marketDataStore?: MarketDataStore): LimitUtilisationRow[] {
  const b3Exposure = computeB3Exposure(
    _state.fxNetPosition,
    _state.exposure.get("B3") ?? 0,
    marketDataStore,
  );

  return CLUSTERS.map((cluster) => {
    const row = _state.schedule.get(cluster);
    const currentExposure = cluster === "B3" ? b3Exposure : (_state.exposure.get(cluster) ?? 0);

    if (!row) {
      return {
        cluster,
        limitName: `Cluster ${cluster} — no schedule published`,
        utilisationPct: 0,
        limitValue: 0,
        currentExposure,
        currency: "ZAR",
        ragStatus: "green" as const,
        asOf: _state.asOf,
      };
    }

    const utilisationPct = row.limitValue > 0 ? currentExposure / row.limitValue : 0;

    return {
      cluster,
      limitName: row.limitName,
      utilisationPct: Math.min(utilisationPct, 9.99), // cap at 999% for display
      limitValue: row.limitValue,
      currentExposure,
      currency: row.currency,
      ragStatus: ragStatus(utilisationPct, row.breachThresholdAmber, row.breachThresholdRed),
      asOf: _state.asOf,
    };
  });
}
