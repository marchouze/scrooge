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
//     Market RWA = 12.5 × the FULL BA-320 standardised market-risk capital charge
//       (Reg 28(3)(a) / Reg 28(5)) — the SUM across ALL risk classes: FX
//       open-position + IR general + IR specific + equity + commodity — sourced
//       from `buildBa320MarketRiskCharge` over the (simulated) trading-book event
//       fold (#1562), per Reg 38 / BCBS Basel III §50–§90 (RWA = 12.5 × capital
//       requirement). REUSES the per-risk-class adapters (Principle 2 — single
//       derivation site; Charter cmd 4 — source, don't duplicate). This SUPERSEDES
//       the former FX-only wiring (`computeBA320V2().fx` only), which understated
//       market RWA by omitting the equity / commodity / IR trading-book charges
//       (D-BA-RETURN-SIMULATOR-FIRST capstone). GAP-3E-002 closed by
//       D-FX-RETURN-CELL-CONTRACTS-AND-BA700-MR-WIRING (2026-06-21); the all-three-
//       legs completion by D-BA-RETURN-SIMULATOR-FIRST (2026-06-26).
//
//       AVAILABILITY (Charter cmd 2 — fail-closed, no zero-coercion): the FX leg
//       is RATE-DEPENDENT — EXCLUDED (not zeroed) when no production FX rate
//       resolves (`marketRwaAvailable === false`). The non-FX legs (IR / equity /
//       commodity) are position×risk-weight — NO rate dependency, so they are
//       ALWAYS available and contribute to market RWA even when the FX rate is
//       null. `marketRwaAvailable` reports the FX leg's inclusion specifically;
//       `marketRwa` always carries the non-FX legs (a 0 there means no open
//       position, never "unavailable").
//     Operational RWA: 12.5 × BA-400 SMA op-risk capital (D-BA-RETURN-SIMULATOR-FIRST).
//     → `rwa` sources: "ccr-ead-v2-credit-only" (credit), "ba320-standardised-v2"
//       (market — all risk classes), "ba400-sma-v2" (operational).
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

import {
  divD,
  mulD,
  roundDecimal,
  toCanonicalString,
  toDecimal,
  toMinorUnits,
} from "../core/decimal-engine";
import { minorFromMoneyWire } from "../core/money-codec";
import { normalizeCcrEadPayload } from "../event-store/event-types/counterparty-credit-risk";
import type { EventStore } from "../event-store/store";
import { anchorFunctionalCurrency } from "../identity/functional-currency";
import type { MarketDataStore } from "../market-data/store";
import { buildBa320MarketRiskCharge } from "../reporting/ba-320-market-risk-charge-adapter";
import { buildBa400SmaInput } from "../reporting/ba-400-sma-income-adapter";
import { generateBa400Sma } from "../reporting/ba-400-sma-op-risk";
import type { BA700Return } from "../returns/ba700/generator";
import { computeCapitalComposition } from "./ba700-capital-composition";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "./filter";

/**
 * Basel III / Reg 38 capital-charge → RWA scalar: RWA = 12.5 × capital requirement
 * (the reciprocal of the 8% minimum capital ratio). Applied to the FULL BA-320
 * standardised market-risk capital charge (all risk classes) to derive the
 * market-risk RWA component. BCBS Basel III §50–§90; Reg 38.
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
       * Market-RWA source. `"ba320-standardised-v2"` when the FULL standardised
       * BA-320 charge (all risk classes — FX + IR + equity + commodity) resolved
       * a non-zero charge in this provenance lens; `"none"` when the whole charge
       * is zero (no open trading-book position AND no FX leg). NOTE: this reflects
       * whether a charge was produced at all — the FX-leg-specific fail-closed
       * signal is `marketRwaAvailable` (the non-FX legs are always available).
       */
      readonly marketRwa: "ba320-standardised-v2" | "none";
      /**
       * Operational-RWA source. `"ba400-sma-v2"` when an
       * `OperatingIncomeStatementSnapshotted` resolved in this provenance lens
       * (the BA 400 SMA engine drove op-RWA); `"none"` when no income snapshot
       * is visible (fail-closed — op-RWA excluded, never fabricated).
       */
      readonly operationalRwa: "ba400-sma-v2" | "none";
    };
    /**
     * Whether the FX leg of the market-risk charge is included in `totalRwa`.
     * `false` = the BA-320 FX open-position charge was `null` (no production FX
     * rate → the FX leg fails closed), so the FX term is EXCLUDED — NOT
     * zero-coerced as-if complete (Charter cmd 2 — fail-closed). The flag, not a
     * zero, is the signal for the excluded FX term.
     *
     * IMPORTANT: this flag is FX-leg-specific. The NON-FX legs (IR general/
     * specific, equity, commodity) are position×risk-weight with NO rate
     * dependency — they are ALWAYS available and are ALWAYS included in
     * `capitalAdequacy.marketRwa` regardless of this flag. So `marketRwa` can be
     * non-zero while `marketRwaAvailable === false` (FX excluded, non-FX legs
     * present). Read {@link fxLegIncluded}/{@link marketRiskChargeBreakdownMinor}
     * for the full per-leg decomposition.
     */
    readonly marketRwaAvailable: boolean;
    /**
     * Alias of {@link marketRwaAvailable} with an unambiguous name — whether the
     * FX leg specifically is included in market RWA. The non-FX legs are always
     * included; this names the FX-leg fail-closed signal explicitly.
     */
    readonly fxLegIncluded: boolean;
    /**
     * Per-risk-class market-risk CAPITAL CHARGE breakdown (functional-currency
     * minor units) — the pre-12.5× decomposition of `capitalAdequacy.marketRwa`.
     * `fxMinor` is `null` when the FX leg is EXCLUDED (no production rate,
     * fail-closed); the non-FX legs always carry a real figure (0 = no position).
     * Lets a consumer see exactly which Reg 28(3)(a) risk classes drive the
     * market-RWA leg. Authority: Reg 28(3)(a), Reg 28(5); BCBS D352 §718.
     */
    readonly marketRiskChargeBreakdownMinor: {
      readonly irGeneralMinor: number;
      readonly irSpecificMinor: number;
      readonly equityMinor: number;
      readonly commodityMinor: number;
      readonly fxMinor: number | null;
      readonly totalMinor: number;
    };
    /**
     * Whether the operational-risk RWA component (12.5 × SMA Operational Risk
     * Capital) is included in `totalRwa`. `false` = no
     * `OperatingIncomeStatementSnapshotted` was visible in this provenance lens
     * (fail-closed — op-RWA EXCLUDED, not zero-coerced as-if-complete). When
     * `false`, `capitalAdequacy.operationalRwa` is 0 only as the additive
     * identity; the flag, not the zero, is the signal. Authority:
     * D-BA-RETURN-SIMULATOR-FIRST; OPE25.
     */
    readonly operationalRwaAvailable: boolean;
  };
  /**
   * V2 capital adequacy section. Fields are comparable to V1's
   * `BA700Return.capitalAdequacy`. All amounts are in minor units.
   *
   * Values will be zero when V2 capital GL posting rules are not yet built
   * (Phase 3e gap GAP-3E-001). The `coverageStatus` field signals this.
   */
  readonly capitalAdequacy: {
    /** CET1 capital (minor units). The Tier-1 own-funds top tier. */
    readonly cet1Capital: number;
    readonly tier1Capital: number;
    readonly tier2Capital: number;
    /** Total own funds = Tier 1 + Tier 2 (minor units). */
    readonly totalCapital: number;
    /**
     * Credit RWA from summed CcrEadComputed V2 events (minor units). Separately
     * inspectable from `marketRwa` for the credit-vs-market RWA decomposition.
     */
    readonly creditRwa: number;
    /**
     * Market-risk RWA (minor units) = 12.5 × the FULL BA-320 standardised
     * market-risk capital charge — the SUM across ALL Reg 28(3)(a) / Reg 28(5)
     * risk classes (FX open-position + IR general + IR specific + equity +
     * commodity), sourced from `buildBa320MarketRiskCharge` over the trading-book
     * event fold — per Reg 38 / BCBS Basel III §50–§90. Separately inspectable
     * from `creditRwa`; the per-leg decomposition is in
     * `meta.marketRiskChargeBreakdownMinor`.
     *
     * `0` ONLY when there is NO open trading-book position in ANY risk class AND
     * the FX leg is absent/excluded. A non-zero value with
     * `meta.marketRwaAvailable === false` means the FX leg was EXCLUDED
     * (fail-closed, no rate) but the non-FX legs (always available) drove the
     * charge. Read `meta.marketRwaAvailable` / `meta.fxLegIncluded` to know the
     * FX-leg inclusion specifically.
     */
    readonly marketRwa: number;
    /**
     * Operational-risk RWA (minor units) = 12.5 × SMA Operational Risk Capital
     * (`generateBa400Sma().opRiskRwaMinor`), per Reg 38 / OPE25. The last BA 700
     * RWA leg to be wired (GAP-BA700-OPERATIONAL-RWA CLOSED — D-BA-RETURN-
     * SIMULATOR-FIRST Phase A). `0` ONLY when `meta.operationalRwaAvailable ===
     * false` — no `OperatingIncomeStatementSnapshotted` visible in this
     * provenance lens (fail-closed). Read `meta.operationalRwaAvailable` to
     * disambiguate. The SMA approach (Business Indicator → BIC → ILM → ORC)
     * supersedes the legacy BIA/TSA per the current SARB BA 400 form.
     */
    readonly operationalRwa: number;
    readonly totalRwa: number;
    /**
     * CET1 capital-adequacy ratio = CET1 / totalRwa (Reg 38 minimum 4.5% +
     * buffers). `null` when totalRwa is zero (no division by zero).
     */
    readonly cet1Ratio: number | null;
    /**
     * Tier-1 capital-adequacy ratio = (CET1 + AT1) / totalRwa (Reg 38 minimum
     * 6% + buffers). `null` when totalRwa is zero.
     */
    readonly tier1Ratio: number | null;
    /**
     * Total capital-adequacy ratio = (Tier 1 + Tier 2) / totalRwa (Reg 38
     * minimum 8% + buffers). Identical to `carRatio`. `null` when totalRwa zero.
     */
    readonly totalCapitalRatio: number | null;
    /**
     * Capital adequacy ratio = (tier1 + tier2) / totalRwa (= `totalCapitalRatio`,
     * retained for V1 parity). `null` when totalRwa is zero (no division by zero).
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
  // Step 3: Market-risk RWA = 12.5 × the FULL BA-320 standardised market-risk
  // capital charge (all Reg 28(3)(a) / Reg 28(5) risk classes).
  //
  // GAP-3E-002 CLOSED (D-FX-RETURN-CELL-CONTRACTS-AND-BA700-MR-WIRING, 2026-06-21);
  // ALL-THREE-LEGS completion (D-BA-RETURN-SIMULATOR-FIRST, 2026-06-26). The former
  // FX-ONLY wiring (`computeBA320V2().fx` only) UNDERSTATED market RWA — it omitted
  // the equity / commodity / IR-general / IR-specific trading-book charges that the
  // simulated trading book (#1562) drives non-zero. We now source the COMPLETE
  // standardised charge from `buildBa320MarketRiskCharge`, which REUSES the
  // per-risk-class event-fold adapters (Principle 2 — single derivation site;
  // Charter cmd 4 — source, don't duplicate). All sub-adapters apply the SAME
  // provenance lens, so production folds to the fail-closed baseline (no real
  // trading positions → no charge) and the simulated / combined lens drives it.
  //
  // RWA = 12.5 × capital requirement (Reg 38 / BCBS Basel III §50–§90), on the
  // decimal engine (no float on money; HALF_UP).
  //
  // FAIL-CLOSED (Charter cmd 2) — DELIBERATE per-leg availability:
  //   * FX leg is RATE-DEPENDENT. When the BA-320 FX charge is `null` (no
  //     production rate for an open pair) the FX leg is EXCLUDED — not zeroed —
  //     and `marketRwaAvailable === false`. The flag, not a zero, is the signal.
  //   * NON-FX legs (IR / equity / commodity) are position×risk-weight with NO
  //     rate dependency — ALWAYS available, included even when the FX rate is
  //     null. So `marketRwa` can be non-zero while `marketRwaAvailable === false`.
  // The aggregate market-risk charge is therefore NEVER null (the non-FX legs
  // always carry a real figure, possibly 0); the FX term is summed in only when
  // available. The rate is NEVER fabricated and no leg is zero-coerced as-if-complete.
  // -------------------------------------------------------------------------

  const marketCharge = buildBa320MarketRiskCharge({
    eventStore: args.eventStore,
    entity,
    asOf: args.asOf,
    functionalCurrency,
    ...(args.marketDataStore !== undefined ? { marketDataStore: args.marketDataStore } : {}),
    ...(args.zarRates !== undefined ? { zarRates: args.zarRates } : {}),
  });

  const marketRwaAvailable = marketCharge.fxAvailable;

  // RWA = 12.5 × the TOTAL standardised charge (non-FX legs always; FX leg only
  // when available — already excluded inside marketRiskChargeMinor when null).
  const marketRwaMinor = Number(
    toMinorUnits(
      roundDecimal(
        mulD(
          toDecimal(String(marketCharge.marketRiskChargeMinor)),
          toDecimal(RWA_PER_CAPITAL_CHARGE),
        ),
        0,
        "HALF_UP",
      ),
      0,
    ),
  );

  if (!marketRwaAvailable) {
    // Fail-closed: the FX leg is EXCLUDED (no production rate / no open FX pair).
    // The non-FX legs (if any) are still folded into marketRwaMinor; the flag is
    // the signal for the excluded FX term, never a fabricated rate.
    gaps.push(
      `GAP-3E-002 (FX-LEG FAIL-CLOSED): BA-320 FX open-position charge is null (FX coverageStatus="${marketCharge.fxCoverageStatus}") — the FX leg is EXCLUDED from market RWA, not zero-coerced. On the clean build-phase store this is the no-open-FX-position state; where an open FX pair lacks a production fx-quote tick it is the fail-closed missing-rate state (no fabricated rate). The NON-FX legs (IR / equity / commodity) are unaffected — they are always available and remain included. When the FX charge resolves, its 12.5× contribution is added automatically. Authority: D-BA-RETURN-SIMULATOR-FIRST; D-FX-RETURN-CELL-CONTRACTS-AND-BA700-MR-WIRING; Reg 38; BCBS Basel III §50–§90.`,
    );
  }

  // Surface any IRS swaps that could not be maturity-method-decomposed (not
  // dropped, not fabricated — Charter cmd 5, no silent deferral).
  for (const swapId of marketCharge.swapsMissingTerms) {
    gaps.push(
      `GAP-BA320-IRS-DECOMP: trading-book IRS ${swapId} could not be maturity-method-decomposed (non-vanilla role or missing next-reset terms) — its IR-general contribution is surfaced, NOT folded. Authority: WS-BA-RETURNS-FOLLOWON G1; D-IRS-DV01-BUCKETING-CALIBRATION.`,
    );
  }

  const hasMarketCharge = marketCharge.marketRiskChargeMinor > 0;

  // -------------------------------------------------------------------------
  // Step 4: Operational-risk RWA = 12.5 × SMA Operational Risk Capital.
  //
  // GAP-BA700-OPERATIONAL-RWA CLOSED (D-BA-RETURN-SIMULATOR-FIRST Phase A,
  // 2026-06-26). The former hardcoded `operationalRwa: 0` placeholder (the last
  // missing BA 700 RWA leg) now sources the REAL op-RWA from the BA 400 SMA
  // engine (`generateBa400Sma`) over the latest `OperatingIncomeStatementSnapshotted`
  // event, folded through the SAME provenance lens as the rest of this
  // projection (`defaultProvenanceFilter` — production-only).
  //
  // DOMAIN TRUTH: the current SARB BA 400 form mandates the SMA (Business
  // Indicator → BIC → ILM → ORC), NOT the legacy BIA/TSA. Pre-licence the ILM is
  // 1 (no loss history; OPE25 §25.8) — the loss-driven ILM is a Phase-B follow-on.
  //
  // FAIL-CLOSED (Charter cmd 2): with the production-only filter and a simulated-
  // only income statement, the adapter finds NO snapshot → op-RWA stays 0
  // (production folds to 0 pre-licence-day, the R300m-into-Prod guard). The
  // simulated / combined lens drives it non-zero. A null income statement is
  // never zero-coerced as-if-complete; the absence is the signal.
  //
  // Authority: D-BA-RETURN-SIMULATOR-FIRST; D-CAPITAL-ASSET-CLASS-V1; OPE25 /
  //   BCBS SCO; SARB Reg 33 revised; Reg 38 (RWA = 12.5 × capital requirement).
  // -------------------------------------------------------------------------

  const smaInput = buildBa400SmaInput({
    entity,
    periodEnd: args.asOf,
    periodId: `period:${entity}:ba700-v2`,
    functionalCurrency,
    eventStore: args.eventStore,
    provenanceFilter,
  });
  const smaOutput = smaInput !== null ? generateBa400Sma(smaInput) : null;
  const operationalRwaMinor = smaOutput !== null ? smaOutput.opRiskRwaMinor : 0;
  const operationalRwaAvailable = smaOutput !== null;

  if (!operationalRwaAvailable) {
    gaps.push(
      "GAP-BA700-OPERATIONAL-RWA (FAIL-CLOSED): no OperatingIncomeStatementSnapshotted in the production provenance lens — operational RWA is 0 (production folds to 0 pre-licence-day; the simulated / combined lens drives it via the BA 400 SMA engine). The op-RWA ENGINE + fold are proven end-to-end against the simulated income series (recon:ba400-op-risk-sim-drive); production op-RWA lands at licence-day on REAL audited income. Authority: D-BA-RETURN-SIMULATOR-FIRST; OPE25; SARB Reg 33 revised.",
    );
  }

  // Total RWA = credit RWA + market RWA + operational RWA.
  // Market RWA = 12.5 × the full standardised charge: the non-FX legs (IR /
  // equity / commodity) are always included; the FX leg is summed into the charge
  // ONLY when marketRwaAvailable (excluded inside marketCharge when null — fail-
  // closed). So marketRwaMinor is never a fabricated figure for an excluded leg.
  // Operational RWA is non-zero only when an income snapshot resolves in this lens.
  const totalRwa = creditRwaMinor + marketRwaMinor + operationalRwaMinor;
  const ownFundsMinor = tier1Capital + tier2Capital;
  // Capital-adequacy ratios = capital / totalRwa. A ratio is a dimensionless
  // quotient of two money figures — computed on the decimal engine (no float on
  // money; D-DECIMAL-NATIVE-MONEY-ARITHMETIC), then rendered to a JS number for
  // the (number | null) contract. `null` when totalRwa is zero (no div-by-zero).
  // Reg 38 minima: CET1 ≥ 4.5%, Tier 1 ≥ 6%, Total ≥ 8% (+ SARB buffers, applied
  // by the consumer). All against totalRwa.
  const ratioOf = (numeratorMinor: number): number | null =>
    totalRwa > 0
      ? Number(
          toCanonicalString(divD(toDecimal(String(numeratorMinor)), toDecimal(String(totalRwa)))),
        )
      : null;
  const carRatio = ratioOf(ownFundsMinor);
  const cet1Ratio = ratioOf(cet1Minor);
  const tier1Ratio = ratioOf(tier1Capital);
  const totalCapitalRatio = carRatio;

  // Market RWA contributes to "partial" coverage whenever ANY market-risk charge
  // was produced (non-FX legs are always available; FX adds when its rate resolves).
  const hasMarketRwa = hasMarketCharge;
  const hasOperationalRwa = operationalRwaAvailable && operationalRwaMinor > 0;
  const coverageStatus: "partial" | "no-data" =
    hasCapital || hasRwa || hasMarketRwa || hasOperationalRwa ? "partial" : "no-data";

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
        marketRwa: hasMarketCharge ? "ba320-standardised-v2" : "none",
        operationalRwa: operationalRwaAvailable ? "ba400-sma-v2" : "none",
      },
      marketRwaAvailable,
      fxLegIncluded: marketRwaAvailable,
      marketRiskChargeBreakdownMinor: {
        irGeneralMinor: marketCharge.charges.irGeneralMinor,
        irSpecificMinor: marketCharge.charges.irSpecificMinor,
        equityMinor: marketCharge.charges.equityMinor,
        commodityMinor: marketCharge.charges.commodityMinor,
        fxMinor: marketCharge.charges.fxMinor,
        totalMinor: marketCharge.marketRiskChargeMinor,
      },
      operationalRwaAvailable,
    },
    capitalAdequacy: {
      cet1Capital: cet1Minor,
      tier1Capital,
      tier2Capital,
      totalCapital: ownFundsMinor,
      creditRwa: creditRwaMinor,
      marketRwa: marketRwaMinor,
      operationalRwa: operationalRwaMinor,
      totalRwa,
      cet1Ratio,
      tier1Ratio,
      totalCapitalRatio,
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
