// platform/projections/ba700-v2.ts
//
// Phase 3e — V2 BA-700 Capital Adequacy projection.
//
// Reads V2-parallel events to produce a BA700ReturnV2 output comparable to V1's
// BA700Return (from platform/returns/ba700/generator.ts). Used by the
// recon:ba700-v2-parity advisory gate.
//
// ## V2 data sources at Phase 3e
//
//   Capital numerator: the OWN-FUNDS COMPOSITION folded from the `capital`
//     asset-class FIL instance lifecycle events (D-CAPITAL-ASSET-CLASS-V1) via
//     `ba700-capital-composition.ts` — a PURE FOLD over the Capital posting rules,
//     NOT a stored `GlPostingEmitted`. This RESOLVES the former GAP-3E-001 (the
//     capital numerator folded to zero because no capital GL rules existed); the
//     numerator is now derived fold-native from the capital instruments-of-record
//     (CET1 / AT1 / Tier 2). → `capital: "capital-fil-composition"`.
//
//   RWA denominator: `CcrEadComputed` (v2-parallel) — SA-CCR EAD in MoneyWire.
//     Summed across all netting sets → credit RWA proxy.
//     Market RWA = 12.5 × the BA-320 V2 FX open-position capital charge
//       (`computeBA320V2().fx.openPositionChargeMinor`), per Reg 38 / BCBS Basel III
//       §50–§90 (RWA = 12.5 × capital requirement). REUSES the BA-320 projection —
//       it does NOT recompute the FX position or re-derive the charge (Principle 2 —
//       single derivation site; Charter cmd 4 — source, don't duplicate). GAP-3E-002
//       CLOSED by D-FX-RETURN-CELL-CONTRACTS-AND-BA700-MR-WIRING (2026-06-21).
//       Where the BA-320 charge is `null` (no production FX rate → BA-320 already
//       fails closed), market RWA is reported as UNAVAILABLE/EXCLUDED via the
//       `marketRwaAvailable` flag — never zero-coerced as-if-complete (Charter cmd 2).
//     Operational RWA has no V2 source at Phase 3e (GAP-3E-003).
//     → `rwa` sources: "ccr-ead-v2-credit-only" (credit), "ba320-fx-v2" (market).
//
// ## No-data handling
//
// When both V2 capital (numerator) AND V2 credit RWA (denominator) are zero, the
// projection returns `{ noData: true }` so the parity gate can document this as
// an advisory gap rather than a crash or false breach. This is the expected state
// on a clean CI store at Phase 3e.
//
// ## Provenance
//
// Applies `defaultProvenanceFilter` (excludes simulated events from production
// projections). Authority: D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12).
//
// Authority: D-V1-REMOVAL-PHASE-3E (CEO-approved 2026-06-15).
// Citations: BCBS Basel III §50–§90; Reg 38; Banks Act 94 §70; P1-EVENTS-AS-TRUTH.
// Author: Atlas (Substrate Architect, engineering).

import { mulD, roundDecimal, toDecimal, toMinorUnits } from "../core/decimal-engine";
import { minorFromMoneyWire } from "../core/money-codec";
import { normalizeCcrEadPayload } from "../event-store/event-types/counterparty-credit-risk";
import type { EventStore } from "../event-store/store";
import { anchorFunctionalCurrency } from "../identity/functional-currency";
import type { MarketDataStore } from "../market-data/store";
import type { BA700Return } from "../returns/ba700/generator";
import { computeBA320V2 } from "./ba320-fx-v2";
import { computeCapitalComposition } from "./ba700-capital-composition";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "./filter";

/**
 * Basel III / Reg 38 capital-charge → RWA scalar: RWA = 12.5 × capital requirement
 * (the reciprocal of the 8% minimum capital ratio). Applied to the BA-320 FX
 * open-position capital charge to derive the market-risk RWA component.
 * BCBS Basel III §50–§90; Reg 38.
 */
const RWA_PER_CAPITAL_CHARGE = "12.5";

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

/**
 * V2 BA-700 capital adequacy return.
 *
 * Compatible with V1 `BA700Return` for parity comparison on common fields.
 * Extends it with V2-specific metadata about data sources and coverage.
 */
export interface BA700ReturnV2 {
  readonly meta: {
    readonly form: "BA 700";
    readonly version: "v2-phase-3e";
    readonly entity: string;
    readonly asOf: string;
    readonly functionalCurrency: string;
    /**
     * "partial"     — some V2 events found; projection is structurally partial.
     * "no-data"     — no V2 capital or RWA events found; parity gate documents
     *                 as advisory gap.
     */
    readonly coverageStatus: "partial" | "no-data";
    /** Source labels for each component. */
    readonly sources: {
      readonly capital: "capital-fil-composition" | "none";
      readonly rwa: "ccr-ead-v2-credit-only" | "none";
      /**
       * Market-RWA source. `"ba320-fx-v2"` when the BA-320 V2 FX open-position
       * charge resolved (a production FX rate was available); `"none"` when it is
       * `null` (fail-closed — no fabricated rate, market RWA excluded).
       */
      readonly marketRwa: "ba320-fx-v2" | "none";
    };
    /**
     * Whether the market-risk RWA component (12.5 × BA-320 FX charge) is included
     * in `totalRwa`. `false` = the BA-320 charge was `null` (no production FX rate
     * → BA-320 fails closed), so market RWA is EXCLUDED — NOT zero-coerced as-if
     * complete (Charter cmd 2 — fail-closed). When `false`, `capitalAdequacy.marketRwa`
     * is 0 only as the additive identity for the excluded term; the flag, not the
     * zero, is the signal.
     */
    readonly marketRwaAvailable: boolean;
  };
  /**
   * V2 capital adequacy section. Fields are comparable to V1's
   * `BA700Return.capitalAdequacy`. All amounts are in minor units.
   *
   * Values will be zero when V2 capital GL posting rules are not yet built
   * (Phase 3e gap GAP-3E-001). The `coverageStatus` field signals this.
   */
  readonly capitalAdequacy: {
    readonly tier1Capital: number;
    readonly tier2Capital: number;
    /**
     * Credit RWA from summed CcrEadComputed V2 events (minor units). Separately
     * inspectable from `marketRwa` for the credit-vs-market RWA decomposition.
     */
    readonly creditRwa: number;
    /**
     * Market-risk RWA (minor units) = 12.5 × the BA-320 V2 FX open-position
     * capital charge (`computeBA320V2().fx.openPositionChargeMinor`), per Reg 38 /
     * BCBS Basel III §50–§90. Separately inspectable from `creditRwa`.
     *
     * `0` ONLY when (a) there is no open FX position (charge legitimately 0) or
     * (b) `meta.marketRwaAvailable === false` — i.e. the BA-320 charge was `null`
     * (no production FX rate, fail-closed) and market RWA is EXCLUDED from
     * `totalRwa`. Read `meta.marketRwaAvailable` to disambiguate "zero charge"
     * from "excluded / unavailable". Operational RWA (GAP-3E-003) is still zero.
     */
    readonly marketRwa: number;
    readonly operationalRwa: number;
    readonly totalRwa: number;
    /**
     * Capital adequacy ratio = (tier1 + tier2) / totalRwa.
     * `null` when totalRwa is zero (no division by zero).
     */
    readonly carRatio: number | null;
  };
  /** Advisory gap markers for Phase 3e coverage gaps. */
  readonly gaps: readonly string[];
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface ComputeBA700V2Args {
  /** Event store to replay V2 events from. */
  readonly eventStore: EventStore;
  /** ISO 8601 — as-of date for the fold. */
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
   * the BA-320 V2 FX projection (and daily-pnl-v2) consumes. Threaded straight
   * through to `computeBA320V2` so the market-RWA term is derived from the BA-320
   * charge (NOT recomputed here). When absent (or when no production tick exists
   * for an open pair), the BA-320 charge is `null` and market RWA is reported
   * EXCLUDED via `marketRwaAvailable === false` (fail-closed, Charter cmd 2).
   */
  readonly marketDataStore?: MarketDataStore;
  /**
   * Optional explicit rate map (base currency → functional-units-per-base, MAJOR
   * units) threaded through to `computeBA320V2`. Lets a caller (e.g. the parity
   * gate) feed BA-320 and BA-700 from one identical rate snapshot. Overrides the
   * `marketDataStore` lookup per currency; absent from BOTH ⇒ BA-320 fails closed.
   */
  readonly zarRates?: Readonly<Record<string, number>>;
}

// ---------------------------------------------------------------------------
// computeBA700V2 — the projection
// ---------------------------------------------------------------------------

/**
 * Compute the V2 BA-700 capital adequacy return from V2-parallel events.
 *
 * Folds:
 *   1. `GlPostingEmitted` → capital-classified account balances (Phase 3A events).
 *      At Phase 3e: zero — no capital GL posting rules emit V2 events yet.
 *   2. `CcrEadComputed` → credit RWA (v2-parallel, MoneyWire amounts).
 *      Sums EAD across all netting sets as the credit-RWA proxy.
 *   3. Market RWA = 12.5 × `computeBA320V2().fx.openPositionChargeMinor`
 *      (Reg 38 / BCBS §50–§90). REUSES the BA-320 V2 projection — no FX position
 *      or charge is recomputed here. Fail-closed when the charge is `null`.
 *
 * Returns a `BA700ReturnV2`. When both numerator and denominator are zero,
 * `meta.coverageStatus = "no-data"` so the parity gate can emit an advisory
 * gap rather than a false breach signal.
 *
 * Authority: D-V1-REMOVAL-PHASE-3E (CEO-approved 2026-06-15).
 * Citations: BCBS Basel III §50–§90; Reg 38; P1-EVENTS-AS-TRUTH.
 */
export function computeBA700V2(args: ComputeBA700V2Args): BA700ReturnV2 {
  const entity = args.entity ?? "LE-ZA-HOZ-BANK";
  // Functional currency resolves from the anchor bank's entry in the legal-
  // entity tree (fail-closed if unassigned) — NOT a literal "ZAR" default
  // (Engineering Charter cmd 4 — source, don't hardcode; cmd 2 — fail-closed).
  // An explicit override is still honoured. WS-MULTI-BASE-CURRENCY.
  const functionalCurrency = args.functionalCurrency ?? anchorFunctionalCurrency();
  const provenanceFilter = defaultProvenanceFilter();
  const gaps: string[] = [];

  // -------------------------------------------------------------------------
  // Step 1: Fold the OWN-FUNDS COMPOSITION from the capital FIL events.
  //
  // CAPITAL FIL ASSET CLASS (D-CAPITAL-ASSET-CLASS-V1): the capital numerator is
  // now sourced from the `capital` asset-class FIL instance lifecycle events
  // (FilInstrumentCreated / FilInstrumentAmended / FilInstrumentTerminated) via
  // the PURE FOLD in `ba700-capital-composition.ts` (the lifted Capital posting
  // rules), NOT from a stored `GlPostingEmitted` for capital accounts. This is
  // what RESOLVES the former GAP-3E-001: the capital numerator folded to zero
  // because no capital GL posting rules existed; now the composition is derived
  // fold-native from the capital own-funds instruments-of-record.
  //
  // The composition is reported in the entity's functional currency; cross-
  // currency own funds are a licence-day refinement (tracked below).
  //
  // Authority: D-CAPITAL-ASSET-CLASS-V1; D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD;
  //   Reg 38(8); Banks Act §70; BCBS RBC20.2; D5/2025 §2.1.3 (form BA 100).
  // -------------------------------------------------------------------------

  const composition = computeCapitalComposition({
    eventStore: args.eventStore,
    entity,
    asOf: args.asOf,
    functionalCurrency,
  });

  const cet1Minor = composition.cet1Minor;
  const at1Minor = composition.at1Minor;
  const t2Minor = composition.tier2Minor;
  const tier1Capital = composition.tier1Minor; // CET1 + AT1
  const tier2Capital = composition.tier2Minor;
  const hasCapital = composition.totalOwnFundsMinor !== 0;

  if (!hasCapital) {
    gaps.push(
      "GAP-CAP-001: V2 own-funds composition is zero — no `capital` asset-class FIL instruments " +
        "found for the entity as of the as-of date. This is expected on a clean / pre-capital-raise " +
        "store (no real capital pre-licence-day). The capital numerator is now fold-native from the " +
        "Capital FIL asset class (D-CAPITAL-ASSET-CLASS-V1), resolving the former GAP-3E-001 " +
        "(zero-because-no-rule). Authority: D-CAPITAL-ASSET-CLASS-V1.",
    );
  }
  void cet1Minor;
  void at1Minor;
  void t2Minor;

  // -------------------------------------------------------------------------
  // Step 2: Fold CcrEadComputed V2 events for credit RWA.
  //
  // CcrEadComputed is v2-parallel (registry/counterparty-credit-risk.ts). V2
  // events carry MoneyWire amounts for rc/pfe/ead. The normalizeCcrEadPayload
  // helper handles mixed-version (V1 integer minor units → upcast to V2 MoneyWire).
  //
  // EAD sum across netting sets = credit RWA proxy (SA-CCR, BCBS d317 §10).
  // The actual credit-RWA capital charge uses CRE20 standardised risk weights
  // per counterparty class — the SA-CCR EAD is the starting exposure figure
  // before risk-weighting. As a phase-3e advisory proxy we use raw EAD sum
  // (conservative, overstates credit RWA relative to weighted path).
  //
  // Market RWA is wired from the BA-320 V2 FX charge in Step 3 below
  // (GAP-3E-002 CLOSED). Operational RWA (GAP-3E-003) is still zero — no V2
  // event type for it exists at Phase 3e.
  //
  // Authority: D-CREDIT-LIMIT-ENGINE-BUILD; BCBS d317 §10.
  // -------------------------------------------------------------------------

  let creditRwaMinor = 0;
  let ccrEadCount = 0;

  for (const ev of args.eventStore.replay({
    entity,
    type: "CcrEadComputed",
    asOf: args.asOf,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;

    // Use normalizeCcrEadPayload to handle both V1 (integer) and V2 (MoneyWire) events.
    const payload = normalizeCcrEadPayload(ev.payload);
    if (payload.currency !== functionalCurrency) continue; // functional-currency only

    // ead is MoneyWire after normalization.
    const eadMinor = minorFromMoneyWire(payload.ead);
    creditRwaMinor += eadMinor;
    ccrEadCount += 1;
  }

  const hasRwa = creditRwaMinor > 0;

  if (!hasRwa) {
    gaps.push(
      `GAP-3E-001b: V2 credit RWA is zero — no CcrEadComputed events found for entity ${entity} as of ${args.asOf}. This is expected on a clean CI store. On the home store, if CcrEadComputed events exist, check entity and currency filters.`,
    );
  }

  // -------------------------------------------------------------------------
  // Step 3: Market-risk RWA = 12.5 × BA-320 V2 FX open-position capital charge.
  //
  // GAP-3E-002 CLOSED (D-FX-RETURN-CELL-CONTRACTS-AND-BA700-MR-WIRING, 2026-06-21).
  //
  // We REUSE computeBA320V2 — its `fx.openPositionChargeMinor` is the Reg 28(5)
  // FX open-position CAPITAL charge in functional-currency minor units. We do NOT
  // recompute the FX position or re-derive the charge here (Principle 2 — single
  // derivation site; Charter cmd 4). RWA = 12.5 × capital requirement (Reg 38 /
  // BCBS Basel III §50–§90), computed on the decimal engine (no float on a money
  // figure; same HALF_UP rule the BA-320 charge itself uses).
  //
  // FAIL-CLOSED (Charter cmd 2): when the BA-320 charge is `null` — no production
  // FX rate for an open pair, BA-320 already fails closed — market RWA is reported
  // UNAVAILABLE/EXCLUDED (`marketRwaAvailable === false`, source "none", the term
  // contributes 0 to totalRwa). It is NEVER zero-coerced as-if-complete and the
  // rate is NEVER fabricated. A `null` charge with NO open FX position (the clean
  // build-phase store) and a `null` charge from a missing rate are distinguished
  // by the BA-320 coverageStatus in the gap text.
  // -------------------------------------------------------------------------

  const ba320 = computeBA320V2({
    eventStore: args.eventStore,
    asOf: args.asOf,
    entity,
    functionalCurrency,
    ...(args.marketDataStore !== undefined ? { marketDataStore: args.marketDataStore } : {}),
    ...(args.zarRates !== undefined ? { zarRates: args.zarRates } : {}),
  });

  const fxChargeMinor = ba320.fx.openPositionChargeMinor;
  const marketRwaAvailable = fxChargeMinor !== null;

  let marketRwaMinor = 0;
  if (marketRwaAvailable) {
    // RWA = 12.5 × capital charge, decimal-engine HALF_UP (no float on money).
    const rwaD = roundDecimal(
      mulD(toDecimal(String(fxChargeMinor)), toDecimal(RWA_PER_CAPITAL_CHARGE)),
      0,
      "HALF_UP",
    );
    marketRwaMinor = Number(toMinorUnits(rwaD, 0));
  } else {
    // Fail-closed: BA-320 charge is null (no production FX rate, or no open FX
    // position). Market RWA is EXCLUDED — not zero-as-if-complete. The flag
    // (marketRwaAvailable=false) is the signal; the 0 is only the additive identity.
    gaps.push(
      `GAP-3E-002 (FAIL-CLOSED): BA-320 V2 FX open-position charge is null (BA-320 coverageStatus="${ba320.fx.coverageStatus}") — market-risk RWA is EXCLUDED from totalRwa, not zero-coerced. ` +
        `On the clean build-phase store this is the expected no-open-FX-position state; where an open FX pair lacks a production fx-quote tick it is the fail-closed missing-rate state (no fabricated rate). ` +
        `When the BA-320 charge resolves, market RWA = 12.5 × charge is included automatically. Authority: D-FX-RETURN-CELL-CONTRACTS-AND-BA700-MR-WIRING; Reg 38; BCBS Basel III §50–§90.`,
    );
  }

  gaps.push(
    "GAP-3E-003: Operational RWA has no V2 event type at Phase 3e (gross-income-blocked placeholder). " +
      "Resolution: future op-risk V2 event workstream. Authority: D-V1-REMOVAL-PHASE-3E.",
  );

  // Total RWA = credit RWA + market RWA (when available) + operational RWA (zero).
  // Market RWA is summed in ONLY when marketRwaAvailable; a null BA-320 charge
  // contributes nothing (fail-closed), and marketRwaMinor stays 0 as the identity.
  const totalRwa = creditRwaMinor + marketRwaMinor;
  const carRatio = totalRwa > 0 ? (tier1Capital + tier2Capital) / totalRwa : null;

  const hasMarketRwa = marketRwaAvailable && marketRwaMinor > 0;
  const coverageStatus: "partial" | "no-data" =
    hasCapital || hasRwa || hasMarketRwa ? "partial" : "no-data";

  return {
    meta: {
      form: "BA 700",
      version: "v2-phase-3e",
      entity,
      asOf: args.asOf,
      functionalCurrency,
      coverageStatus,
      sources: {
        capital: hasCapital ? "capital-fil-composition" : "none",
        rwa: ccrEadCount > 0 ? "ccr-ead-v2-credit-only" : "none",
        marketRwa: marketRwaAvailable ? "ba320-fx-v2" : "none",
      },
      marketRwaAvailable,
    },
    capitalAdequacy: {
      tier1Capital,
      tier2Capital,
      creditRwa: creditRwaMinor,
      marketRwa: marketRwaMinor,
      operationalRwa: 0,
      totalRwa,
      carRatio,
    },
    gaps,
  };
}

// ---------------------------------------------------------------------------
// Comparison helper — for the parity gate
// ---------------------------------------------------------------------------

/**
 * Extract a flat comparable shape from the V1 BA700Return for parity checking.
 * Only fields that have V2 equivalents are included (others are structurally absent).
 */
export interface BA700ComparableV1 {
  readonly capitalAdequacy: {
    readonly tier1Capital: number;
    readonly tier2Capital: number;
    readonly rwa: number;
    readonly carRatio: number;
  };
}

export function extractBA700Comparable(v1Return: BA700Return): BA700ComparableV1 {
  return {
    capitalAdequacy: {
      tier1Capital: v1Return.capitalAdequacy.tier1Capital,
      tier2Capital: v1Return.capitalAdequacy.tier2Capital,
      rwa: v1Return.capitalAdequacy.rwa,
      carRatio: v1Return.capitalAdequacy.carRatio,
    },
  };
}
