// platform/projections/ba320-fx-v2.ts
//
// Phase 3e — V2 BA-320 FX Market Risk projection from FIL instance lifecycle events.
//
// Reads `FilInstrumentCreated` + `FilInstrumentTerminated` (both v2-parallel)
// to derive net open FX positions per currency pair. Produces a `BA320FxSectionV2`
// comparable to the V1 BA-310 FX section from `generateBa310MarketRisk`.
//
// ## V2 data source
//
// `FilInstrumentCreated` carries `economicTerms`:
//   - `assetClass: "fx"` — identifies FX instruments
//   - `notional: Money` — notional in the base currency (major units, decimal-native)
//   - `direction: "long" | "short"` — trade direction
//   - `currency: string` — notional currency (ISO-4217)
//   - `hedgingSetTag: string` — FX pair (e.g. "USD/ZAR", "EUR/ZAR")
//
// `FilInstrumentTerminated` closes an instance (removes it from the open set).
//
// ## Net open position calculation
//
// For each non-functional-currency, the net open position is:
//   netPositionMinor = Σ(long notionals in functional-ccy minor units)
//                    - Σ(short notionals in functional-ccy minor units)
//
// The FX open-position capital charge (Reg 28(5); BCBS D352 §718(xiii)):
//   fxCapitalCharge = 8% × max(Σ|netLongs|, Σ|netShorts|) in functional currency
//
// ## Rate dependency (GAP-3E-005)
//
// FIL FX notionals are in the BASE currency (e.g. EUR for EUR/ZAR). Converting
// to functional-currency (ZAR) minor units requires a ZAR rate. At Phase 3e,
// no V2 rate-feed event exists. The projection uses a PLACEHOLDER for cross-
// currency conversion:
//   - If the notional currency IS the functional currency (ZAR): no conversion needed.
//   - If the notional currency is NOT the functional currency: the position is
//     recorded in its own currency WITHOUT ZAR conversion, and marked as a gap.
//     The parity gate documents this as an advisory gap.
//
// ## Comparison with V1
//
// V1 BA-320 FX derives positions from `FxTradeExecuted` + `TradeMatured` events
// via `fxPositionCalculator`. The V2 path uses `FilInstrumentCreated` +
// `FilInstrumentTerminated`. The common fields (net position per currency,
// open-position charge) are compared by the parity gate.
//
// Authority: D-V1-REMOVAL-PHASE-3E (CEO-approved 2026-06-15).
// Citations: Reg 28(5); BCBS D352 §718(xiii); P1-EVENTS-AS-TRUTH; D-FIL-ATTRIBUTION-A1-BUILD.
// Author: Atlas (Substrate Architect, engineering).

import { mulD, roundDecimal, toDecimal, toMinorUnits } from "../core/decimal-engine";
import { amountToMinorUnits } from "../core/decimal-money";
import type { Currency } from "../core/types";
import type { EventStore } from "../event-store/store";
import { anchorFunctionalCurrency } from "../identity/functional-currency";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "./filter";

// ---------------------------------------------------------------------------
// Output shapes
// ---------------------------------------------------------------------------

/** Net open FX position for one currency pair. */
export interface BA320FxPositionV2 {
  /**
   * Base currency of the pair (e.g. "USD" for USD/ZAR).
   * The functional currency (ZAR) is excluded per Reg 28(5).
   */
  readonly baseCurrency: string;
  /**
   * Net open position in base-currency minor units.
   * Positive = net long; negative = net short.
   * When converted to functional-currency, this feeds the open-position charge.
   */
  readonly netPositionBaseCurrencyMinor: number;
  /**
   * Net open position in functional-currency minor units.
   * `null` when the rate conversion is not available (GAP-3E-005).
   */
  readonly netPositionFunctionalMinor: number | null;
  /** Number of open FIL instances contributing to this position. */
  readonly openInstanceCount: number;
  /** Whether ZAR conversion was available (false = GAP-3E-005). */
  readonly hasRateConversion: boolean;
}

/** V2 BA-320 FX section — the comparable output to V1's Ba310FxSection. */
export interface BA320FxSectionV2 {
  readonly positions: readonly BA320FxPositionV2[];
  /**
   * FX open-position capital charge = 8% × max(Σ|long|, Σ|short|) in ZAR minor units.
   * `null` when rate conversion is unavailable for all positions (GAP-3E-005).
   */
  readonly openPositionChargeMinor: number | null;
  /** Total long positions in ZAR minor units (null if any rate missing). */
  readonly totalLongZarMinor: number | null;
  /** Total short positions in ZAR minor units (null if any rate missing). */
  readonly totalShortZarMinor: number | null;
  /**
   * "no-data"     — no open FX FIL instruments found.
   * "partial"     — instruments found but rate conversion missing for some/all.
   * "complete"    — all positions converted to ZAR and charge computed.
   */
  readonly coverageStatus: "no-data" | "partial" | "complete";
}

/** Full V2 BA-320 projection output. */
export interface BA320ReturnV2 {
  readonly meta: {
    readonly form: "BA 320";
    readonly version: "v2-phase-3e";
    readonly entity: string;
    readonly asOf: string;
    readonly functionalCurrency: string;
    readonly coverageStatus: "no-data" | "partial" | "complete";
    readonly openFxInstanceCount: number;
  };
  readonly fx: BA320FxSectionV2;
  /** Advisory gap markers for Phase 3e coverage gaps. */
  readonly gaps: readonly string[];
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface ComputeBA320V2Args {
  readonly eventStore: EventStore;
  /** ISO 8601 — as-of date for the fold. Open instruments are those created
   *  before asOf and not yet terminated as of asOf. */
  readonly asOf: string;
  /** Legal entity short-id. Defaults to "LE-ZA-HOZ-BANK". */
  readonly entity?: string;
  /**
   * ISO 4217 functional currency. When omitted, resolves from the anchor bank's
   * functional currency in the legal-entity tree (fail-closed) — not a literal
   * default. WS-MULTI-BASE-CURRENCY.
   */
  readonly functionalCurrency?: string;
  /**
   * Optional ZAR rate map for non-functional-currency positions.
   * Key: ISO-4217 currency code (e.g. "USD"); value: units of functional
   * currency per 1 unit of base currency in MAJOR units (e.g. 18.5 for
   * 1 USD = 18.5 ZAR). When absent for a currency, position is returned
   * without ZAR conversion (GAP-3E-005).
   */
  readonly zarRates?: Readonly<Record<string, number>>;
}

// ---------------------------------------------------------------------------
// computeBA320V2 — the projection
// ---------------------------------------------------------------------------

/**
 * Compute the V2 BA-320 FX Market Risk section from FIL instance lifecycle events.
 *
 * Folds:
 *   1. `FilInstrumentCreated` → opens an FX instrument instance.
 *   2. `FilInstrumentTerminated` → closes an FX instrument instance.
 *   3. Derives net open position per base currency from open instances.
 *   4. Computes the Reg 28(5) FX open-position capital charge where ZAR rates
 *      are available; documents GAP-3E-005 where not.
 *
 * Authority: D-V1-REMOVAL-PHASE-3E (CEO-approved 2026-06-15).
 * Citations: Reg 28(5); BCBS D352 §718(xiii); P1-EVENTS-AS-TRUTH.
 */
export function computeBA320V2(args: ComputeBA320V2Args): BA320ReturnV2 {
  const entity = args.entity ?? "LE-ZA-HOZ-BANK";
  // Functional currency resolves from the anchor bank's entry in the legal-
  // entity tree (fail-closed if unassigned) — NOT a literal "ZAR" default
  // (Engineering Charter cmd 4 — source, don't hardcode; cmd 2 — fail-closed).
  // An explicit override is still honoured. WS-MULTI-BASE-CURRENCY.
  const functionalCurrency = args.functionalCurrency ?? anchorFunctionalCurrency();
  const provenanceFilter = defaultProvenanceFilter();
  const gaps: string[] = [];

  // -------------------------------------------------------------------------
  // Step 1: Fold FilInstrumentCreated to collect open FX instances.
  //
  // The FIL event payload shape from v2-core/fil-instances/events.ts:
  //   kind: "FilInstrumentCreated"
  //   instance: FilInstanceUrn
  //   type: FilTypeUrn
  //   tenant: string
  //   asOf: Instant
  //   originatingEvent: { eventType, eventId }
  //   initialStage: FilLifecycleStage
  //   economicTerms: {
  //     assetClass: FilSaCcrAssetClass  ("fx" | "ir" | ...)
  //     notional: Money  { currency, amount: string (major units) }
  //     direction: "long" | "short"
  //     counterpartyId: string
  //     nettingSetId: string
  //     currency: string  (notional currency)
  //     settlementDate: string
  //     hedgingSetTag?: string  (e.g. "USD/ZAR")
  //   }
  //
  // We filter to assetClass === "fx" and track open instances by instanceUrn.
  // -------------------------------------------------------------------------

  // Track open FX instances: instanceUrn → economicTerms snapshot.
  const openInstances = new Map<
    string,
    {
      direction: "long" | "short";
      currency: string;
      notionalMajor: string;
      hedgingSetTag: string | undefined;
    }
  >();

  // Collect all FilInstrumentCreated (FX) events first.
  for (const ev of args.eventStore.replay({
    entity,
    type: "FilInstrumentCreated",
    asOf: args.asOf,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;

    const p = ev.payload as {
      kind?: string;
      instance?: string;
      economicTerms?: {
        assetClass?: string;
        notional?: { currency?: string; amount?: string };
        direction?: string;
        currency?: string;
        hedgingSetTag?: string;
      };
    };

    // Guard: only FX asset class.
    if (p.economicTerms?.assetClass !== "fx") continue;

    const instanceUrn = p.instance;
    const notional = p.economicTerms?.notional;
    const direction = p.economicTerms?.direction as "long" | "short" | undefined;
    const currency = p.economicTerms?.currency ?? notional?.currency;

    if (!instanceUrn || !notional || !direction || !currency) continue;
    if (!notional.amount || !notional.currency) continue;

    openInstances.set(instanceUrn, {
      direction,
      currency,
      notionalMajor: notional.amount,
      hedgingSetTag: p.economicTerms?.hedgingSetTag,
    });
  }

  // Step 2: Remove terminated instances.
  for (const ev of args.eventStore.replay({
    entity,
    type: "FilInstrumentTerminated",
    asOf: args.asOf,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;

    const p = ev.payload as { instance?: string };
    if (p.instance) {
      openInstances.delete(p.instance);
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: Compute net open position per base currency.
  //
  // Net position = Σ(longs) - Σ(shorts), in base-currency minor units.
  // The functional currency (ZAR) is excluded from the BA-320 FX charge per
  // Reg 28(5) — positions in ZAR vs ZAR are already denominated.
  // -------------------------------------------------------------------------

  const longsByCurrency = new Map<string, number>();
  const shortsByCounterCurrency = new Map<string, number>();
  const instanceCountByBaseCurrency = new Map<string, number>();

  for (const [, terms] of openInstances.entries()) {
    const { currency, direction, notionalMajor } = terms;

    // Exclude functional-currency (ZAR vs ZAR) — no FX position.
    if (currency === functionalCurrency) continue;

    // Convert notional to minor units using the standard amountToMinorUnits path.
    // FIL Money { currency, amount: string (major units) } is compatible with
    // platform/core/decimal-money.ts amountToMinorUnits input shape.
    let notionalMinor: number;
    try {
      notionalMinor = Number(
        amountToMinorUnits({ currency: currency as Currency, amount: notionalMajor }),
      );
    } catch {
      // Fail-closed: if conversion throws (unrecognized currency scale),
      // surface the error as a gap and skip.
      gaps.push(
        `GAP-3E-005b: Failed to convert notional to minor units for currency ${currency}. Check ISO-4217 currency scale registration. Instrument excluded from BA-320 V2 position.`,
      );
      continue;
    }

    if (direction === "long") {
      longsByCurrency.set(currency, (longsByCurrency.get(currency) ?? 0) + notionalMinor);
    } else {
      shortsByCounterCurrency.set(
        currency,
        (shortsByCounterCurrency.get(currency) ?? 0) + notionalMinor,
      );
    }
    instanceCountByBaseCurrency.set(currency, (instanceCountByBaseCurrency.get(currency) ?? 0) + 1);
  }

  // -------------------------------------------------------------------------
  // Step 4: Build BA320FxPositionV2 rows with optional ZAR conversion.
  // -------------------------------------------------------------------------

  const allCurrencies = new Set([...longsByCurrency.keys(), ...shortsByCounterCurrency.keys()]);

  const positions: BA320FxPositionV2[] = [];
  let missingRateCount = 0;

  for (const baseCurrency of [...allCurrencies].sort()) {
    const longMinor = longsByCurrency.get(baseCurrency) ?? 0;
    const shortMinor = shortsByCounterCurrency.get(baseCurrency) ?? 0;
    const netPositionBaseCurrencyMinor = longMinor - shortMinor;

    // Attempt ZAR conversion.
    let netPositionFunctionalMinor: number | null = null;
    let hasRateConversion = false;

    if (baseCurrency === functionalCurrency) {
      // Already in functional currency (e.g. ZAR/ZAR — excluded above, but guard).
      netPositionFunctionalMinor = netPositionBaseCurrencyMinor;
      hasRateConversion = true;
    } else if (args.zarRates && baseCurrency in args.zarRates) {
      // Caller supplied a rate (major units per 1 base unit → apply to minor units).
      const zarRate = args.zarRates[baseCurrency];
      if (zarRate !== undefined && zarRate > 0) {
        // The net position is in base-currency minor units. Convert:
        //   netZarMinor = netBaseMinor × zarRate
        // (zarRate is already expressed as: 1 base = zarRate functional, in major units;
        // since both sides are in minor units with the same integer denominator,
        // the ratio is the same as in major units.)
        // Use the decimal engine (D-DECIMAL-NATIVE-MONEY-ARITHMETIC).
        const netD = toDecimal(String(netPositionBaseCurrencyMinor));
        const rateD = toDecimal(String(zarRate));
        const convertedD = roundDecimal(mulD(netD, rateD), 0, "HALF_UP");
        netPositionFunctionalMinor = Number(toMinorUnits(convertedD, 0));
        hasRateConversion = true;
      }
    } else {
      missingRateCount += 1;
    }

    positions.push({
      baseCurrency,
      netPositionBaseCurrencyMinor,
      netPositionFunctionalMinor,
      openInstanceCount: instanceCountByBaseCurrency.get(baseCurrency) ?? 0,
      hasRateConversion,
    });
  }

  // -------------------------------------------------------------------------
  // Step 5: Compute the FX open-position capital charge where possible.
  //
  // Reg 28(5) / BCBS D352 §718(xiii):
  //   charge = 8% × max(Σ|netLong in ZAR|, Σ|netShort in ZAR|)
  //
  // Can only compute if ALL currency pairs have ZAR conversion.
  // -------------------------------------------------------------------------

  let openPositionChargeMinor: number | null = null;
  let totalLongZarMinor: number | null = null;
  let totalShortZarMinor: number | null = null;

  if (positions.length > 0 && missingRateCount === 0) {
    let sumLong = 0;
    let sumShort = 0;
    for (const pos of positions) {
      const netZar = pos.netPositionFunctionalMinor ?? 0;
      if (netZar >= 0) sumLong += netZar;
      else sumShort += Math.abs(netZar);
    }
    totalLongZarMinor = sumLong;
    totalShortZarMinor = sumShort;
    // 8% charge per Reg 28(5) / BCBS §718(xiii).
    openPositionChargeMinor = Math.round(0.08 * Math.max(sumLong, sumShort));
  }

  // -------------------------------------------------------------------------
  // Step 6: Gap documentation.
  // -------------------------------------------------------------------------

  if (missingRateCount > 0) {
    gaps.push(
      `GAP-3E-005: ${missingRateCount} currency pair(s) lack ZAR conversion rates. The Reg 28(5) open-position charge cannot be computed without ZAR rates. At Phase 3e, no V2 rate-feed event type exists. Pass \`zarRates\` to computeBA320V2() to enable the charge computation. Resolution: V2 rate-feed event workstream (separate from D-V1-REMOVAL-PHASE-3E). Authority: D-V1-REMOVAL-PHASE-3E.`,
    );
  }

  gaps.push(
    "GAP-3E-002: BA-320 V2 FX charge is NOT yet fed back into BA-700 V2 market RWA " +
      "(12.5 × fxCapitalCharge). This gap closes once the BA-320 V2 flip is approved " +
      "and the BA-700 V2 projection wires the market-RWA slot. Authority: D-V1-REMOVAL-PHASE-3E.",
  );

  // -------------------------------------------------------------------------
  // Step 7: Coverage status.
  // -------------------------------------------------------------------------

  let coverageStatus: "no-data" | "partial" | "complete";
  if (positions.length === 0) {
    coverageStatus = "no-data";
    gaps.push(
      `GAP-3E-FX: No open FX FIL instrument instances found as of ${args.asOf} for entity ${entity}. Expected on a clean CI store (no FIL FX events seeded). On the home store, verify FilInstrumentCreated events exist for FX instruments (assetClass === 'fx').`,
    );
  } else if (missingRateCount > 0) {
    coverageStatus = "partial";
  } else {
    coverageStatus = "complete";
  }

  const fxSection: BA320FxSectionV2 = {
    positions,
    openPositionChargeMinor,
    totalLongZarMinor,
    totalShortZarMinor,
    coverageStatus,
  };

  return {
    meta: {
      form: "BA 320",
      version: "v2-phase-3e",
      entity,
      asOf: args.asOf,
      functionalCurrency,
      coverageStatus,
      openFxInstanceCount: openInstances.size,
    },
    fx: fxSection,
    gaps,
  };
}
