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
import { isCancelledInstance, resolveTradeLifecycle } from "../../lifecycle/trade-lifecycle-state";
import { type MarketDataStore, lookupQuoteWithInverse } from "../../market-data/store";
import { eventInOperatingBook } from "../filter";

// ---------------------------------------------------------------------------
// Row type (public API)
// ---------------------------------------------------------------------------

/** Per-currency net-open-position breakdown beneath the aggregate B3 line (R6). */
export interface PerCurrencyExposure {
  currency: string;
  /** Absolute net open position in ZAR-equivalent (or raw CCY units if no rates). */
  exposure: number;
  /** Sub-limit for this currency, if the schedule published one. */
  subLimit?: number;
  /** Utilisation vs sub-limit (0.0–1.0); absent when no sub-limit published. */
  utilisationPct?: number;
  ragStatus?: "green" | "amber" | "red";
}

export interface LimitUtilisationRow {
  cluster: RiskCluster;
  limitName: string;
  utilisationPct: number; // 0.0–1.0
  limitValue: number;
  currentExposure: number;
  currency: string;
  ragStatus: "green" | "amber" | "red";
  asOf: string;
  /** "absolute" | "pct-capital" — how limitValue was resolved (R4). Default absolute. */
  limitBasis?: "absolute" | "pct-capital";
  /** Per-currency NOP breakdown (B3 / FX cluster only) (R6). */
  perCurrency?: PerCurrencyExposure[];
}

/**
 * Externally-computed inputs the projection cannot derive from the trade stream
 * alone. Kept as plain numbers so the projection stays decoupled from the event
 * store and the capital / ALM projections (callers that hold the store inject
 * these; sim and tests omit them and fall back gracefully).
 */
export interface LimitUtilisationDeps {
  /** Net qualifying capital in ZAR major units — denominator for "pct-capital" rows (R4). */
  qualifyingCapitalZar?: number;
  /** B4 IR sensitivity in ZAR (e.g. Σ|repricing gap|) — replaces IR-notional exposure (R7). */
  b4IrSensitivityZar?: number;
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
  // Cancellation via the canonical registry-driven resolver (D-OPERATING-BOOK-
  // PROVENANCE-ARCHITECTURE). confirmedTradeIds (SettlementConfirmed) is a
  // separate B1-credit concept — position stays in B3 — so it is NOT a lifecycle
  // closure and is collected directly.
  const lifecycleIdx = resolveTradeLifecycle(events);
  const confirmedTradeIds = new Set<string>();
  for (const e of events) {
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
      if (tradeIdValue && isCancelledInstance(lifecycleIdx.get(tradeIdValue))) continue;

      // Operating-book inclusion (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE):
      // only production + operational-simulated (operator-booked) trades
      // contribute to live limit utilisation; seed scaffolding
      // (build-phase-fixture) + sandbox runs are held out.
      if (!eventInOperatingBook(e)) continue;

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
 * BA 330 (SARB market-risk return — FX net open position) — home-currency
 * residuals are not an FX risk.
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
    if (ccy === "ZAR") continue; // home currency — excluded from NOP (BA 330)
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
 * Per-currency net-open-position breakdown for the B3 (FX) cluster (R6 / F6).
 * Each foreign currency's absolute net position, ZAR-converted when a market
 * data store is supplied (raw CCY units otherwise, matching computeB3Exposure).
 * ZAR (home currency) is excluded per BA 330. Sorted by descending exposure.
 */
export function computeB3PerCurrency(
  netPositions: ReadonlyMap<string, number>,
  marketDataStore?: MarketDataStore,
): PerCurrencyExposure[] {
  const out: PerCurrencyExposure[] = [];
  for (const [ccy, position] of netPositions) {
    const absPos = Math.abs(position);
    if (absPos === 0) continue;
    if (ccy === "ZAR") continue; // home currency — excluded from NOP (BA 330)
    let exposure = absPos;
    if (marketDataStore) {
      const quote = lookupQuoteWithInverse(marketDataStore, `${ccy}/ZAR`);
      if (!quote) continue; // no rate → omit rather than report a raw-unit figure
      exposure = absPos * quote.rate;
    }
    out.push({ currency: ccy, exposure });
  }
  return out.sort((a, b) => b.exposure - a.exposure);
}

/**
 * Returns the current per-cluster utilisation rows.
 *
 * Pass `marketDataStore` to enable ZAR-equivalent B3 computation from the net
 * FX position map. Without it, B3 reports raw CCY-unit absolute positions
 * (correct topology, wrong scale for multi-currency books).
 *
 * Pass `deps` to resolve externally-computed inputs (RAS B3 review):
 *   - `qualifyingCapitalZar` resolves "pct-capital" limit rows (R4).
 *   - `b4IrSensitivityZar` supplies the B4 exposure as an IR sensitivity (Σ|gap|)
 *     instead of notional (R7).
 *
 * If no RasLimitSchedulePublished has been emitted, returns five placeholder
 * rows with zero exposure and zero limit (status: green, no limit active).
 */
export function getLimitUtilisations(
  marketDataStore?: MarketDataStore,
  deps?: LimitUtilisationDeps,
): LimitUtilisationRow[] {
  const b3Exposure = computeB3Exposure(
    _state.fxNetPosition,
    _state.exposure.get("B3") ?? 0,
    marketDataStore,
  );
  const b3PerCurrency = computeB3PerCurrency(_state.fxNetPosition, marketDataStore);

  // Resolve current exposure per cluster. B3 = FX NOP; B4 = injected IR
  // sensitivity when supplied (R7), else the folded accumulator; others fold.
  const exposureFor = (cluster: RiskCluster): number => {
    if (cluster === "B3") return b3Exposure;
    if (cluster === "B4" && typeof deps?.b4IrSensitivityZar === "number") {
      return deps.b4IrSensitivityZar;
    }
    return _state.exposure.get(cluster) ?? 0;
  };

  return CLUSTERS.map((cluster) => {
    const row = _state.schedule.get(cluster);
    const currentExposure = exposureFor(cluster);

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

    // Resolve the effective limit value (R4). "pct-capital" rows scale with net
    // qualifying capital; fall back to the stored limitValue when capital is
    // unavailable so the row never silently reports an infinite headroom.
    const limitBasis = row.limitBasis ?? "absolute";
    let limitValue = row.limitValue;
    if (
      limitBasis === "pct-capital" &&
      typeof row.capitalPct === "number" &&
      typeof deps?.qualifyingCapitalZar === "number" &&
      deps.qualifyingCapitalZar > 0
    ) {
      limitValue = (deps.qualifyingCapitalZar * row.capitalPct) / 100;
    }

    const utilisationPct = limitValue > 0 ? currentExposure / limitValue : 0;

    // Per-currency breakdown + sub-limit RAG for the FX cluster (R6).
    let perCurrency: PerCurrencyExposure[] | undefined;
    if (cluster === "B3" && b3PerCurrency.length > 0) {
      const subLimits = new Map(
        (row.currencySubLimits ?? []).map((s) => [s.currency, s.subLimitValue]),
      );
      perCurrency = b3PerCurrency.map((pc) => {
        const subLimit = subLimits.get(pc.currency);
        if (subLimit === undefined || subLimit <= 0) return pc;
        const util = pc.exposure / subLimit;
        return {
          ...pc,
          subLimit,
          utilisationPct: Math.min(util, 9.99),
          ragStatus: ragStatus(util, row.breachThresholdAmber, row.breachThresholdRed),
        };
      });
    }

    return {
      cluster,
      limitName: row.limitName,
      utilisationPct: Math.min(utilisationPct, 9.99), // cap at 999% for display
      limitValue,
      currentExposure,
      currency: row.currency,
      ragStatus: ragStatus(utilisationPct, row.breachThresholdAmber, row.breachThresholdRed),
      asOf: _state.asOf,
      limitBasis,
      ...(perCurrency ? { perCurrency } : {}),
    };
  });
}
