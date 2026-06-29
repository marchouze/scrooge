// platform/projections/ba320-fx-v2.ts
//
// Phase 3e — V2 BA-320 FX Market Risk projection from FIL instance lifecycle events.
//
// Reads `FilInstrumentCreated` + `FilInstrumentTerminated` (both v2-parallel)
// to derive net open FX positions per currency pair. Produces a `BA320FxSectionV2`
// comparable to the V1 BA-310 FX section from `generateBa320MarketRisk`.
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
// ## Rate dependency (GAP-3E-005 — CLOSED by WS-V2-AUTHORITATIVE S8)
//
// FIL FX notionals are in the BASE currency (e.g. EUR for EUR/ZAR). Converting
// to functional-currency (ZAR) minor units requires a spot rate. The rate source
// is the SAME one the sibling V2 daily-P&L projection (daily-pnl-v2.ts) already
// consumes: `MarketDataStore` production `fx-quote` ticks, resolved via the shared
// `lookupQuoteWithInverse(store, spotObservableId(ccy, functionalCurrency), …)`
// primitive (Principle 2 — single rate-lookup derivation site; Charter cmd 4 —
// source, don't duplicate). The S1 (#1387) backfill seeds those production ticks
// for every open FIL FX pair.
//   - If the notional currency IS the functional currency: no conversion needed.
//   - If the notional currency is NOT the functional currency and a production
//     tick is present: convert to functional-currency minor units via the spot mid.
//   - If NO production tick is present for the pair: FAIL-CLOSED (Charter cmd 2) —
//     the position is recorded in base-currency minor units only, `rateAvailable`
//     is false, the open-position charge stays `null`, and `coverageStatus` stays
//     "partial". The rate is NEVER fabricated and the charge is NEVER zero-filled.
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

import { spotObservableId } from "../../v2-core/fil-models/fx-valuation/methodology";
import { requireReporting } from "../../v2-core/fil-models/fx-valuation/reporting-currency-resolver";
import { divD, mulD, roundDecimal, toDecimal, toMinorUnits } from "../core/decimal-engine";
import { amountToMinorUnits } from "../core/decimal-money";
import type { Currency } from "../core/types";
import type { EventStore } from "../event-store/store";
import { anchorFunctionalCurrency } from "../identity/functional-currency";
import { type MarketDataStore, lookupQuoteWithInverse } from "../market-data/store";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "./filter";

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
  /**
   * Whether a functional-currency spot rate was available from the rate source
   * for this position (false = fail-closed, no production tick — GAP-3E-005).
   * `hasRateConversion` is retained as the historical alias; both carry the
   * same value.
   */
  readonly rateAvailable: boolean;
  /** @deprecated Alias of {@link rateAvailable}. */
  readonly hasRateConversion: boolean;
}

/** V2 BA-320 FX section — the comparable output to V1's Ba320FxSection. */
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
   * Market-data store holding production `fx-quote` ticks — the SAME rate source
   * the sibling V2 daily-P&L projection consumes (WS-V2-AUTHORITATIVE S8). When
   * provided, the functional-currency rate for each non-functional currency is
   * resolved from it via `lookupQuoteWithInverse(store, spotObservableId(ccy,
   * functionalCurrency), { provenance: "production" })`. A currency with no usable
   * production tick is FAIL-CLOSED (no fabricated rate; charge stays null).
   *
   * `zarRates` (below) takes precedence when both are supplied — it lets the
   * parity gate feed BOTH the V1 and V2 paths from one identical rate snapshot so
   * the comparison is apples-to-apples.
   */
  readonly marketDataStore?: MarketDataStore;
  /**
   * Optional explicit rate map for non-functional-currency positions. Key:
   * ISO-4217 currency code (e.g. "USD"); value: units of functional currency per
   * 1 unit of base currency in MAJOR units (e.g. 18.5 for 1 USD = 18.5 ZAR). When
   * provided it OVERRIDES the `marketDataStore` lookup for that currency; when a
   * currency is absent from BOTH, the position is FAIL-CLOSED (GAP-3E-005).
   */
  readonly zarRates?: Readonly<Record<string, number>>;
  /**
   * Optional provenance lens for the FIL-instance fold. Defaults to
   * `defaultProvenanceFilter()` (production-only) — the canonical BA-320
   * regulatory-return read stays production-only. Callers that need the
   * combined (production + simulated, fixtures excluded) book — e.g. the
   * build-phase RWA projection (`computeRwaFromPositions`) — pass
   * `{ mode: "combined" }` so simulated FX positions contribute to the FX
   * net-open-position charge alongside production positions. Build-phase
   * fixtures remain excluded by the same explicit guard the rest of the fold
   * applies, so this NEVER widens the lens to paint a fixture number.
   * Authority: D-RWA-LIVE-POSITIONS-PROJECTION-V1; D-V1-REMOVAL-PHASE-3E.
   */
  readonly provenanceFilter?: ProvenanceFilter;
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
  // Fail-closed assertion (Charter cmd 2): the functional currency must resolve to
  // a non-empty ISO-4217 code — never a silent literal. requireReporting throws
  // rather than fall back to "ZAR" (WS-MULTI-BASE-CURRENCY; #1382).
  const functionalCurrency = requireReporting(
    args.functionalCurrency ?? anchorFunctionalCurrency(),
    `ba320-fx-v2 (entity=${entity})`,
  );
  const provenanceFilter = args.provenanceFilter ?? defaultProvenanceFilter();
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
      settlementDate: string | undefined;
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
        settlementDate?: string;
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
      settlementDate: p.economicTerms?.settlementDate,
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

  // Step 2b: Remove POST-SETTLEMENT instances (D-FX-LIVE-VIEW-PROVENANCE-LEAK-FIX,
  // defect #3). A spot whose settlement date is on/before `asOf` is no longer an
  // OPEN net-open-position regardless of whether a `FilInstrumentTerminated` was
  // emitted — settlement extinguishes the open FX contract (the FCY exposure that
  // survives settlement is a CASH position, folded by the cash projection, not an
  // open FX net-open-position line under Reg 28(5)). This is the fail-closed
  // backstop for the simulated trades whose termination event was never emitted:
  // they stayed `stage:active` and inflated the open-position charge for months
  // after settling. A missing / unparseable settlement date is treated as NOT
  // open (fail-closed) — an instance we cannot prove is still pre-settlement is
  // excluded rather than silently counted. Charter cmd 1 (root-cause) + cmd 2
  // (fail-closed).
  const asOfMs = Date.parse(args.asOf);
  if (Number.isFinite(asOfMs)) {
    for (const [urn, terms] of [...openInstances.entries()]) {
      const settlementMs =
        terms.settlementDate !== undefined ? Date.parse(terms.settlementDate) : Number.NaN;
      if (!Number.isFinite(settlementMs) || settlementMs <= asOfMs) {
        openInstances.delete(urn);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: Compute net open position per FOREIGN (base) currency.
  //
  // DATA SHAPE (verified against the FIL economic-terms kernel + the S1 #1387
  // backfill, both fixture and real-book paths): a FIL FX instance carries its
  // notional in the REPORTING / functional currency (e.g. ZAR) — `notional.currency
  // === functionalCurrency` — with the FOREIGN leg identified by `hedgingSetTag`
  // (e.g. "USD/ZAR" → base USD). So the position's foreign currency is the BASE
  // of the hedging-set tag, NOT `economicTerms.currency` (which is the reporting
  // leg). The notional being functional-denominated means the functional-currency
  // net open position is NATIVE — no rate is needed to compute the Reg 28(5)
  // charge. The rate source (Step 4) converts the native functional figure DOWN to
  // the foreign-leg amount for the `netPositionBaseCurrencyMinor` display field and
  // for apples-to-apples comparison against V1 (which derives the functional figure
  // UP from a true foreign-base notional × rate). WS-V2-AUTHORITATIVE S8.
  //
  // Net position = Σ(longs) − Σ(shorts), in functional-currency minor units.
  // -------------------------------------------------------------------------

  const longFunctionalByCurrency = new Map<string, number>();
  const shortFunctionalByCurrency = new Map<string, number>();
  const longForeignByCurrency = new Map<string, number>();
  const shortForeignByCurrency = new Map<string, number>();
  const instanceCountByBaseCurrency = new Map<string, number>();

  for (const [, terms] of openInstances.entries()) {
    const { currency, direction, notionalMajor, hedgingSetTag } = terms;

    // Foreign (base) currency = the BASE leg of the hedging-set tag when present,
    // else fall back to economicTerms.currency (legacy/non-tagged shape).
    const tagBase = hedgingSetTag ? (hedgingSetTag.split("/")[0] ?? "").trim() : "";
    const baseCurrency = tagBase !== "" ? tagBase : currency;

    // The notional currency must be the functional currency for the native-functional
    // interpretation to hold. If it is NOT, fall back to the legacy base-denominated
    // interpretation (notional already in the foreign currency) — handled by keying
    // off `currency` and leaving the rate conversion to Step 4.
    const notionalIsFunctional = currency === functionalCurrency;

    // A position whose foreign leg IS the functional currency carries no FX risk.
    if (baseCurrency === functionalCurrency) continue;

    // Notional → functional minor (native) when notionalIsFunctional; otherwise
    // it is the foreign-leg amount and Step 4 converts it up via the rate.
    let notionalMinor: number;
    try {
      notionalMinor = Number(
        amountToMinorUnits({ currency: currency as Currency, amount: notionalMajor }),
      );
    } catch {
      // Fail-closed: unrecognised currency scale — surface and skip.
      gaps.push(
        `GAP-3E-005b: Failed to convert notional to minor units for currency ${currency} (instance base ${baseCurrency}). Check ISO-4217 currency scale registration. Instrument excluded from BA-320 V2 position.`,
      );
      continue;
    }

    // Track separately whether the notional is functional-native or foreign-leg,
    // so Step 4 knows whether to convert. We tag the map key with a discriminator
    // by storing functional-native amounts and foreign-leg amounts in distinct maps.
    if (notionalIsFunctional) {
      const map = direction === "long" ? longFunctionalByCurrency : shortFunctionalByCurrency;
      map.set(baseCurrency, (map.get(baseCurrency) ?? 0) + notionalMinor);
    } else {
      // Legacy foreign-leg shape: record under foreign maps; Step 4 converts up.
      const map = direction === "long" ? longForeignByCurrency : shortForeignByCurrency;
      map.set(baseCurrency, (map.get(baseCurrency) ?? 0) + notionalMinor);
    }
    instanceCountByBaseCurrency.set(
      baseCurrency,
      (instanceCountByBaseCurrency.get(baseCurrency) ?? 0) + 1,
    );
  }

  // -------------------------------------------------------------------------
  // Step 4: Build BA320FxPositionV2 rows with optional ZAR conversion.
  // -------------------------------------------------------------------------

  const allCurrencies = new Set([
    ...longFunctionalByCurrency.keys(),
    ...shortFunctionalByCurrency.keys(),
    ...longForeignByCurrency.keys(),
    ...shortForeignByCurrency.keys(),
  ]);

  // Rate resolver — explicit zarRates override wins; otherwise resolve the
  // functional-currency spot mid from the MarketDataStore production fx-quote
  // ticks via the SAME shared primitive daily-pnl-v2 uses (Principle 2 — single
  // rate-lookup site; Charter cmd 4 — source, don't duplicate). Returns the
  // major-units rate (functional units per 1 base unit) or `null` when no usable
  // production tick exists (fail-closed; never fabricated).
  const resolveRate = (baseCurrency: string): number | null => {
    const explicit = args.zarRates?.[baseCurrency];
    if (explicit !== undefined && explicit > 0) return explicit;
    if (!args.marketDataStore) return null;
    const observableId = spotObservableId(baseCurrency, functionalCurrency);
    const quote = lookupQuoteWithInverse(args.marketDataStore, observableId, {
      provenance: "production",
    });
    if (quote !== null && quote.rate > 0) return quote.rate;
    return null;
  };

  const convertMinor = (minor: number, rate: number, op: "mul" | "div"): number => {
    const minorD = toDecimal(String(minor));
    const rateD = toDecimal(String(rate));
    const resultD = op === "mul" ? mulD(minorD, rateD) : divD(minorD, rateD);
    return Number(toMinorUnits(roundDecimal(resultD, 0, "HALF_UP"), 0));
  };

  const positions: BA320FxPositionV2[] = [];
  let missingRateCount = 0;

  for (const baseCurrency of [...allCurrencies].sort()) {
    const netFunctionalNative =
      (longFunctionalByCurrency.get(baseCurrency) ?? 0) -
      (shortFunctionalByCurrency.get(baseCurrency) ?? 0);
    const netForeignNative =
      (longForeignByCurrency.get(baseCurrency) ?? 0) -
      (shortForeignByCurrency.get(baseCurrency) ?? 0);
    const hasFunctionalNative =
      longFunctionalByCurrency.has(baseCurrency) || shortFunctionalByCurrency.has(baseCurrency);
    const hasForeignNative =
      longForeignByCurrency.has(baseCurrency) || shortForeignByCurrency.has(baseCurrency);

    const rate = resolveRate(baseCurrency);

    let netPositionFunctionalMinor: number | null = null;
    let netPositionBaseCurrencyMinor = 0;
    let rateAvailable = false;

    if (hasFunctionalNative) {
      // Notional is functional-denominated (the canonical FIL FX shape): the
      // functional net position is NATIVE — no rate needed for the charge. The
      // rate (when present) converts DOWN to the foreign-leg display amount.
      netPositionFunctionalMinor = netFunctionalNative;
      if (rate !== null) {
        netPositionBaseCurrencyMinor = convertMinor(netFunctionalNative, rate, "div");
        rateAvailable = true;
      } else {
        // Foreign-leg display amount unavailable (no rate). The CHARGE still
        // computes from the native functional figure (fail-closed only affects
        // the display leg, not the regulatory charge).
        netPositionBaseCurrencyMinor = 0;
      }
    } else if (hasForeignNative) {
      // Legacy foreign-leg shape: notional in the foreign currency. The functional
      // figure (needed for the charge) requires the rate — FAIL-CLOSED when absent.
      netPositionBaseCurrencyMinor = netForeignNative;
      if (rate !== null) {
        // 1 base = rate functional; minor↔minor ratio == major↔major ratio.
        netPositionFunctionalMinor = convertMinor(netForeignNative, rate, "mul");
        rateAvailable = true;
      } else {
        missingRateCount += 1;
      }
    }

    positions.push({
      baseCurrency,
      netPositionBaseCurrencyMinor,
      netPositionFunctionalMinor,
      openInstanceCount: instanceCountByBaseCurrency.get(baseCurrency) ?? 0,
      rateAvailable,
      hasRateConversion: rateAvailable,
    });
  }

  // -------------------------------------------------------------------------
  // Step 5: Compute the FX open-position capital charge where possible.
  //
  // Reg 28(5) / BCBS D352 §718(xiii):
  //   charge = 8% × max(Σ|netLong functional|, Σ|netShort functional|)
  //
  // Computable when every position carries a functional-currency figure
  // (missingRateCount === 0). Functional-native positions (the canonical FIL FX
  // shape) always carry one; a legacy foreign-leg position without a rate is the
  // only thing that makes the charge null (fail-closed). All figures are in
  // functional-currency (e.g. ZAR) minor units.
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
    // 8% charge per Reg 28(5) / BCBS §718(xiii) — decimal-engine arithmetic
    // (D-DECIMAL-NATIVE-MONEY-ARITHMETIC; no float on a money figure).
    const greaterMinor = Math.max(sumLong, sumShort);
    const chargeD = roundDecimal(
      mulD(toDecimal(String(greaterMinor)), toDecimal("0.08")),
      0,
      "HALF_UP",
    );
    openPositionChargeMinor = Number(toMinorUnits(chargeD, 0));
  }

  // -------------------------------------------------------------------------
  // Step 6: Gap documentation.
  // -------------------------------------------------------------------------

  if (missingRateCount > 0) {
    gaps.push(
      `GAP-3E-005: ${missingRateCount} currency pair(s) have NO usable production fx-quote tick in the MarketDataStore rate source, so the Reg 28(5) open-position charge stays \`null\` for the affected currencies (FAIL-CLOSED — no fabricated rate). The rate source is the same one daily-pnl-v2 consumes; ensure the S1 (#1387) fx-quote backfill covers these pairs (instrument = spotObservableId(ccy, functionalCurrency), dataType "fx-quote", provenance "production"). Authority: D-V1-REMOVAL-PHASE-3E; WS-V2-AUTHORITATIVE S8.`,
    );
  }

  // GAP-3E-002 CLOSED: the BA-320 FX charge IS fed back into BA-700 V2 market RWA
  // — as the FX leg of the FULL standardised charge (buildBa320MarketRiskCharge →
  // ba700-v2.ts market-RWA leg = 12.5 × total charge across all risk classes).
  // Closed by D-FX-RETURN-CELL-CONTRACTS-AND-BA700-MR-WIRING (FX leg, 2026-06-21)
  // + D-BA-RETURN-SIMULATOR-FIRST (all-three-legs completion, 2026-06-26). No gap.

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
