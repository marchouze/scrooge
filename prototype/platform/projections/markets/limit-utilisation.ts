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
  // Accumulated exposure per cluster (simple rolling accumulation)
  exposure: Map<RiskCluster, number>;
  // Latest event timestamp
  asOf: string;
}

const CLUSTERS: RiskCluster[] = ["B1", "B2", "B3", "B4", "B5"];

function initialState(): LimitUtilisationState {
  return {
    schedule: new Map(),
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

    case "FxTradeExecuted": {
      // FX trades contribute to both B3 (market risk — FX notional) and
      // B1 (credit risk — counterparty exposure).
      // The CDM payload encodes notional inside legs[0].notional.amountMinor
      // (minor units = major * 100). Divide by 100 to get major-unit exposure.
      //
      // Cancelled trades are pre-filtered by rebuildLimitUtilisation before
      // calling apply(), so no cancellation check is needed here.
      const p = event.payload as Record<string, unknown>;
      const legs = Array.isArray(p.legs) ? p.legs : [];
      const leg0 = legs[0] as Record<string, unknown> | undefined;
      const legNotional = leg0?.notional as Record<string, unknown> | undefined;
      const amountMinor =
        typeof legNotional?.amountMinor === "number" ? legNotional.amountMinor : 0;
      const notional = amountMinor / 100;
      if (notional > 0) {
        _state = addExposure(_state, "B3", notional, asOf);
        // Counterparty credit exposure: 10% of notional (simplified pre-settlement risk)
        _state = addExposure(_state, "B1", notional * 0.1, asOf);
      }
      break;
    }

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

  // Pass 1 — collect cancelled trade IDs.
  const cancelledTradeIds = new Set<string>();
  for (const e of events) {
    if (e.type === "FxTradeCancelled") {
      const p = e.payload as Record<string, unknown>;
      if (typeof p.tradeId === "string") {
        cancelledTradeIds.add(p.tradeId);
      }
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

    // Pass 2 — skip cancelled FX trades before applying.
    if (e.type === "FxTradeExecuted") {
      const p = e.payload as Record<string, unknown>;
      const tradeIdRaw = p.tradeId as Record<string, unknown> | string | undefined;
      const tradeIdValue =
        typeof tradeIdRaw === "string"
          ? tradeIdRaw
          : typeof tradeIdRaw?.value === "string"
            ? tradeIdRaw.value
            : null;
      if (tradeIdValue && cancelledTradeIds.has(tradeIdValue)) continue;
    }

    apply(e);
  }
}

/**
 * Returns the current per-cluster utilisation rows.
 *
 * If no RasLimitSchedulePublished has been emitted, returns five placeholder
 * rows with zero exposure and zero limit (status: green, no limit active).
 */
export function getLimitUtilisations(): LimitUtilisationRow[] {
  return CLUSTERS.map((cluster) => {
    const row = _state.schedule.get(cluster);
    const currentExposure = _state.exposure.get(cluster) ?? 0;

    if (!row) {
      // No schedule published yet — surface accumulated exposure so Helena can
      // see real numbers even before a schedule is emitted.  utilisationPct is
      // 0 (no denominator) and ragStatus is green (no limit to breach), but
      // currentExposure reflects what has actually accumulated from trade events.
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
