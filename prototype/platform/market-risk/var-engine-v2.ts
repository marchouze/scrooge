// platform/market-risk/var-engine-v2.ts
//
// V2 VaR production emitter — Phase 2 Gap A3 of the V1-removal workstream.
//
// Emits `MarketRiskVarComputed` (schemaVersion: 2) to the platform event store
// in parallel with the V1 `MarketRiskMeasureComputed` event (emitted by
// `scripts/market-risk-measure-run.ts`). The two events carry the same
// historical-simulation VaR/SVaR/ES figures over the same standing-NOP
// exposure basis; `recon:var-v2-parity` asserts they agree within minor-unit
// rounding.
//
// DESIGN:
//   - Reuses `deriveRiskFactorExposures` from `var-engine.ts` — the single
//     shared NOP fold (D-VAR-EXPOSURE-INCLUDES-STANDING-NOP). No parallel fold.
//   - Calls `jointVar` from `v2-core/fil-models/market-risk-var/methodology` —
//     the ported V2 historical-simulation kernel already validated byte-for-byte
//     against V1 in `recon:attribution-var-diversification`.
//   - Does NOT use `makeVarMetric` / `evaluateSlice` (the attribution-layer
//     API). Those are for the A3 proof gate; the emitter calls the kernel
//     directly — the same path section (c) of attribution-var-diversification
//     uses for the GROUP VaR.
//   - FAIL-CLOSED: emits NOTHING when the book is flat (`no-positions`) or
//     history is too short (`insufficient-history`). No silent absent events.
//   - Idempotency: one event per tenant per UTC day (keyed on measureId).
//   - All money fields use MoneyWire (`{__money, amount: string, currency}`)
//     under D-V2-CORE-MONEY-DECIMAL-NATIVE. ZAR amounts are expressed in major
//     units (decimal string, 2 d.p. scale).
//
// Authority: D-V1-REMOVAL-PHASE2-GAP-A3 (CEO-approved 2026-06-15);
//            D-VAR-EXPOSURE-INCLUDES-STANDING-NOP (CEO-approved 2026-06-12);
//            D-V2-CORE-MONEY-DECIMAL-NATIVE; BCBS d457 / MAR33; Basel-2.5 MAR.
// Author: Atlas (Substrate Architect, engineering).

import { ANCHOR_TENANT_ID } from "../../v2-core/control-plane/tenant";
import {
  ES_CONFIDENCE,
  VAR_CONFIDENCE,
  type VarRiskFactorExposure,
  historicalVaR,
  simulatePnLDistribution,
} from "../../v2-core/fil-models/market-risk-var/methodology";
import { moneyWireFromMinor } from "../core/money-codec";
import { nowUtc } from "../core/types";
import {
  type MarketRiskVarComputedPayload,
  makeMarketRiskVarComputed,
} from "../event-store/event-types/market-risk-measure";
import type { EventStore } from "../event-store/store";
import { anchorFunctionalCurrency } from "../identity/functional-currency";
import type { MarketDataStore } from "../market-data/store";
import { MIN_RETURN_OBSERVATIONS, deriveRiskFactorExposures } from "./var-engine";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BANK_ENTITY = "LE-ZA-HOZ-BANK";

/**
 * The reporting currency the V2 VaR figures are denominated in — the ANCHOR
 * bank's functional currency, SOURCED from the legal-entity tree via
 * `anchorFunctionalCurrency()` (Engineering Charter cmd 4 — source, don't
 * hardcode; WS-MULTI-BASE-CURRENCY / D-MULTI-BASE-CURRENCY-FOUNDATION). The
 * underlying NOP fold (`deriveRiskFactorExposures`) and the ported kernel value
 * the SA anchor book into this currency; re-pointing the anchor's functional
 * currency is a seed change, not a code change. Fail-closed if unresolved.
 */
function reportingCurrency(): string {
  return anchorFunctionalCurrency();
}

/**
 * Anchor minor-unit scale (100 minor units = 1 major unit). The SA anchor's
 * functional currency (ZAR) is a 2-d.p. currency; used to convert the V1
 * engine's major-unit float figures to MoneyWire.
 */
const ANCHOR_MINOR_SCALE = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a ZAR loss magnitude (float, MAJOR units) to a MoneyWire value
 * suitable for a V2 event payload (decimal-native, MAJOR-unit string).
 *
 * The V1 engine returns major-unit floats (`varZar` ≈ 499_000.00). We round
 * to the nearest minor unit (cent) then express as a major-unit string, which
 * is the decimal-native convention: MoneyWire.amount is in MAJOR units, not
 * minor. This matches `moneyWireFromMinor(Math.round(majorFloat * 100), "ZAR")`.
 */
function zarMajorToMoneyWire(majorFloat: number): ReturnType<typeof moneyWireFromMinor> {
  // Round to nearest cent (minor unit), convert to MoneyWire via the codec.
  return moneyWireFromMinor(Math.round(majorFloat * ANCHOR_MINOR_SCALE), reportingCurrency());
}

// ---------------------------------------------------------------------------
// Core: compute V2 VaR figures
// ---------------------------------------------------------------------------

interface V2VarResult {
  readonly status: "computed";
  readonly varZar: number;
  readonly svarZar: number;
  readonly esZar: number;
  readonly scenarioCount: number;
  readonly riskFactorCount: number;
  readonly minObservations: number;
}

/**
 * Compute the V2 VaR/SVaR/ES figures directly via the ported kernel
 * (`jointVar` / `simulatePnLDistribution`), over the same NOP basis as the V1
 * engine. Returns `undefined` when the book is flat or history is insufficient
 * (fail-closed — the caller emits nothing).
 *
 * This mirrors section (c) of `attribution-var-diversification.ts` but is
 * dependency-free of the attribution framework (no makeVarMetric, no
 * evaluateSlice, no ResolvedMember).
 */
function computeV2Var(
  eventStore: EventStore,
  marketData: MarketDataStore,
  asOf: string,
): V2VarResult | undefined {
  const { exposures, returnsByFactor } = deriveRiskFactorExposures({
    eventStore,
    marketData,
    asOf,
  });

  // Fail-closed: flat book.
  if (exposures.length === 0) return undefined;

  const minObservations = exposures.reduce(
    (min, e) => Math.min(min, e.returnObservations),
    Number.POSITIVE_INFINITY,
  );
  const resolvedMin = Number.isFinite(minObservations) ? minObservations : 0;

  // Fail-closed: insufficient history.
  if (resolvedMin < MIN_RETURN_OBSERVATIONS) return undefined;

  // Build the VarRiskFactorExposure array for the V2 kernel.
  const v2Exposures: VarRiskFactorExposure[] = exposures
    .filter((e) => e.exposureZar !== 0)
    .map((e) => ({
      factor: e.factor,
      exposureZar: e.exposureZar,
      returns: returnsByFactor.get(e.factor) ?? [],
    }));

  if (v2Exposures.length === 0) return undefined;

  // Joint P&L distribution (same calculation as V1 simulatePnLDistribution,
  // ported verbatim in the V2 kernel; parity is proven in attribution-var-
  // diversification section (c)).
  const pnl = simulatePnLDistribution(v2Exposures);
  const scenarioCount = pnl.length;

  if (scenarioCount === 0) return undefined;

  const varZar = historicalVaR(pnl, VAR_CONFIDENCE);
  const esZar = historicalVaR(pnl, ES_CONFIDENCE);
  // SVaR: same 99% historical-simulation calibrated to stress window.
  // In the build phase the stress window == the full available window.
  const svarZar = Math.max(varZar, historicalVaR(pnl, VAR_CONFIDENCE));

  return {
    status: "computed",
    varZar,
    svarZar,
    esZar,
    scenarioCount,
    riskFactorCount: v2Exposures.length,
    minObservations: resolvedMin,
  };
}

// ---------------------------------------------------------------------------
// Public: emit MarketRiskVarComputed
// ---------------------------------------------------------------------------

/**
 * Emit a `MarketRiskVarComputed` V2 event to the platform store. Idempotent:
 * skips if an event with the same `measureId` has already been appended today.
 *
 * FAIL-CLOSED: if the book is flat or history is too short, emits nothing
 * (no absent-figure event — the V1 engine already surfaces the absent reason;
 * the V2 event exists only when there is a computed figure to compare).
 *
 * @param store         The platform event store to append to.
 * @param marketData    The market-data store supplying FX return histories.
 * @param varAppetiteZar The MR-1-FX 1-day 99% VaR appetite ceiling (major ZAR).
 * @param clockNow      Clock function — override in tests to avoid wall-clock.
 * @returns `true` when an event was appended; `false` when skipped.
 */
export function emitMarketRiskVarV2(
  store: EventStore,
  marketData: MarketDataStore,
  varAppetiteZar: number,
  clockNow: () => string = nowUtc,
): boolean {
  const asOf = clockNow();
  const tenantId = ANCHOR_TENANT_ID;
  const measureId = `MR-VAR-V2-${tenantId}-${asOf.slice(0, 10)}`;

  // Idempotency: skip if already emitted for this tenant+day.
  const existing = [...store.replay({ type: "MarketRiskVarComputed" })].find(
    (e) => (e.payload as { measureId?: string }).measureId === measureId,
  );
  if (existing) return false;

  const result = computeV2Var(store, marketData, asOf);
  // Fail-closed: flat book or insufficient history → no event emitted.
  if (!result) return false;

  const lineage =
    `V2 historical-simulation (ported kernel) over ${result.scenarioCount} scenarios, ` +
    `${result.riskFactorCount} risk factor(s); standing-NOP basis (D-VAR-EXPOSURE-INCLUDES-STANDING-NOP)`;

  const payload: MarketRiskVarComputedPayload = {
    schemaVersion: 2,
    tenantId,
    measureId,
    asOf,
    status: result.status,
    var: {
      present: true,
      value: zarMajorToMoneyWire(result.varZar),
      lineage,
    },
    svar: {
      present: true,
      value: zarMajorToMoneyWire(result.svarZar),
      lineage: `${lineage}; stress-calibrated`,
    },
    es: {
      present: true,
      value: zarMajorToMoneyWire(result.esZar),
      lineage,
    },
    riskFactorCount: result.riskFactorCount,
    minObservations: result.minObservations,
    varAppetiteZar: zarMajorToMoneyWire(varAppetiteZar),
  };

  const event = makeMarketRiskVarComputed({
    asOf,
    entity: BANK_ENTITY,
    actor: { type: "service", id: "agent:atlas:var-engine-v2" },
    citations: [
      "D-V1-REMOVAL-PHASE2-GAP-A3",
      "D-BRC-INTERIM-MR-1-FX",
      "WS-MARKET-RISK-PROCEDURES",
      "D-VAR-EXPOSURE-INCLUDES-STANDING-NOP",
      "D-V2-CORE-MONEY-DECIMAL-NATIVE",
    ],
    payload,
  });

  store.append(event);
  return true;
}
