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
//     Market RWA + operational RWA have no V2 source at Phase 3e.
//     → `rwaV2Source: "ccr-ead-v2-credit-only"` (structural partial).
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

import { minorFromMoneyWire } from "../core/money-codec";
import { normalizeCcrEadPayload } from "../event-store/event-types/counterparty-credit-risk";
import type { EventStore } from "../event-store/store";
import { anchorFunctionalCurrency } from "../identity/functional-currency";
import type { BA700Return } from "../returns/ba700/generator";
import { computeCapitalComposition } from "./ba700-capital-composition";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "./filter";

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
    };
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
     * Credit RWA from summed CcrEadComputed V2 events (minor units).
     * Market RWA (GAP-3E-002) and operational RWA (GAP-3E-003) are zero.
     */
    readonly creditRwa: number;
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
  // Market RWA (GAP-3E-002) and operational RWA (GAP-3E-003) are zero — no
  // V2 event types for these components exist at Phase 3e.
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

  gaps.push(
    "GAP-3E-002: Market RWA (12.5 × BA-320 capital charge) has no V2 event source at Phase 3e. " +
      "Resolution: Phase 3e BA-320 V2 gate → flip → wire market RWA here. Authority: D-V1-REMOVAL-PHASE-3E.",
  );
  gaps.push(
    "GAP-3E-003: Operational RWA has no V2 event type at Phase 3e (gross-income-blocked placeholder). " +
      "Resolution: future op-risk V2 event workstream. Authority: D-V1-REMOVAL-PHASE-3E.",
  );

  const totalRwa = creditRwaMinor; // market + operational are zero at Phase 3e
  const carRatio = totalRwa > 0 ? (tier1Capital + tier2Capital) / totalRwa : null;

  const coverageStatus: "partial" | "no-data" = hasCapital || hasRwa ? "partial" : "no-data";

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
      },
    },
    capitalAdequacy: {
      tier1Capital,
      tier2Capital,
      creditRwa: creditRwaMinor,
      marketRwa: 0,
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
