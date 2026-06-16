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
//   Capital numerator: `GlPostingEmitted` (v2-parallel, Phase 3A) for capital-
//     classified accounts. At Phase 3e, only FX posting rules (PR-FX-001-V2,
//     PR-FX-REVAL-V2, PR-FX-CLOSE-V2) emit GlPostingEmitted. The capital accounts
//     (ACC-5000-001/002, ACC-5200-001/002) are NOT FX accounts, so V2 capital
//     will be zero on all stores until capital-GL posting rules are built.
//     → `capitalV2Source: "gl-posting-v2"` (structural partial).
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

import { coaToCapitalClassifications } from "../accounting/coa-registry";
import { amountToMinorUnits } from "../core/decimal-money";
import { legAmountMoney } from "../core/money-codec";
import { minorFromMoneyWire } from "../core/money-codec";
import { normalizeCcrEadPayload } from "../event-store/event-types/counterparty-credit-risk";
import type { EventStore } from "../event-store/store";
import { anchorFunctionalCurrency } from "../identity/functional-currency";
import type { BA700Return } from "../returns/ba700/generator";
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
      readonly capital: "gl-posting-v2" | "none";
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
  // Step 1: Fold GlPostingEmitted for capital-classified accounts.
  //
  // Capital-classified accounts from the canonical COA (coaToCapitalClassifications):
  //   CET1: ACC-5000-001 (Share Capital), ACC-5000-002 (Retained Earnings)
  //   T2:   ACC-5200-001 (Subordinated Debt), ACC-5200-002 (General Provisions)
  //
  // At Phase 3e scope: only FX posting rules (PR-FX-001-V2, PR-FX-REVAL-V2,
  // PR-FX-CLOSE-V2) emit GlPostingEmitted. These post to FX nostro accounts
  // (e.g. ACC-1100-*), NOT to capital accounts — so the capital-account fold
  // will produce zero. This is expected; the parity gate surfaces it as an
  // advisory gap (GAP-3E-001).
  //
  // Authority: D-V1-REMOVAL-PHASE-3A (GlPostingEmitted; v2-parallel).
  // -------------------------------------------------------------------------

  const classifications = coaToCapitalClassifications();
  const capitalAccountIds = new Set(classifications.map((c) => c.leafAccountId));

  // Per-(accountId, currency) signed balance in minor units.
  // Sign convention: debit = positive, credit = negative (GL convention).
  const capitalBalances = new Map<string, number>();

  for (const ev of args.eventStore.replay({
    entity,
    type: "GlPostingEmitted",
    asOf: args.asOf,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;

    // GlPostingEmitted payload shape (from gl-projection-v2.ts GlLeg interface):
    //   { accountCode, creditDebit, amount: MoneyWire, postingDate }
    const leg = ev.payload as {
      accountCode?: string;
      creditDebit?: "credit" | "debit";
      amount?: { currency?: string; amount?: string };
      postingDate?: string;
    };

    const accountCode = leg.accountCode;
    const ccy = leg.amount?.currency;
    if (!accountCode || !ccy) continue;
    if (!capitalAccountIds.has(accountCode)) continue;
    if (ccy !== functionalCurrency) continue; // multi-currency capital at Slice 6+

    // Decode MoneyWire amount to minor units (same pattern as gl-projection-v2.ts).
    const legMoney = legAmountMoney({ amount: leg.amount, currency: ccy });
    const legMinor = Number(amountToMinorUnits(legMoney));

    const key = `${accountCode}|${ccy}`;
    const current = capitalBalances.get(key) ?? 0;
    capitalBalances.set(key, current + (leg.creditDebit === "debit" ? legMinor : -legMinor));
  }

  // Bucket balances into CET1 / AT1 / T2.
  const classMap = new Map(classifications.map((c) => [c.leafAccountId, c]));
  let cet1Minor = 0;
  let at1Minor = 0;
  let t2Minor = 0;

  for (const [key, balance] of capitalBalances.entries()) {
    const accountId = key.split("|")[0];
    if (!accountId) continue;
    const cls = classMap.get(accountId);
    if (!cls) continue;
    const stock = Math.abs(balance); // capital is credit-side → positive magnitude
    if (cls.capitalTier === "cet1") cet1Minor += stock;
    else if (cls.capitalTier === "at1") at1Minor += stock;
    else t2Minor += stock;
  }

  const tier1Capital = cet1Minor + at1Minor;
  const tier2Capital = t2Minor;
  const hasCapital = tier1Capital > 0 || tier2Capital > 0;

  if (!hasCapital) {
    gaps.push(
      "GAP-3E-001: V2 capital numerator is zero — no V2 GL posting rules for capital accounts " +
        "(ACC-5000-001/002, ACC-5200-001/002) exist at Phase 3e. Only FX posting rules (PR-FX-001-V2, " +
        "PR-FX-REVAL-V2, PR-FX-CLOSE-V2) emit GlPostingEmitted. Capital GL rules land in a future phase. " +
        "Authority: D-V1-REMOVAL-PHASE-3E.",
    );
  }

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
        capital: hasCapital ? "gl-posting-v2" : "none",
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
