// platform/risk/rwa-computed-engine.ts
//
// D-RWA-ENGINE-W2-SLICE-3 — the `RwaComputed` event engine.
//
// This module turns the pure `rwa-engine.ts` projection (CRE20 standardised
// risk-weight logic) into an events-first capability: it folds the
// event-sourced debt-exposure base for credit RWA, takes the BA 320
// market-risk return's RWA for market RWA, holds operational RWA as an
// explicit gross-income-blocked placeholder, and emits a `RwaComputed` event
// at period close. The BA 700 capital-adequacy generator consumes that event
// (threading `rwaComputationEventId`) instead of a bare fixture placeholder.
//
// Why an event (and not just the existing `computeRwaFromPositions` in-memory
// projection): the original W2 Slice 3 dispatch deliberately deferred the
// `RwaSnapshot`/`RwaComputed` event ("compute on demand chosen to avoid
// event-types.ts collision with parallel Reporting Slice 4/5 + W2 Slice 2
// work"). This dispatch lands that deferred event so the BA 700 RWA
// denominator has a queryable record of computation under Principle 1.
//
// Composition (per the dispatch brief BUILD steps 2–4):
//
//   CREDIT RWA — REAL (event-sourced).
//     `readDebtExposures(store)` (the BA 200 events-first debt-exposure base:
//     BondTradeExecuted net positions + live InterbankLoanPlaced) maps each
//     `DebtExposure` to a `CreditExposure` (ExposureClass → CRE20
//     CounterpartyType), then `computeRwa()` applies the standardised weight.
//     Cite Reg 23 / CRE20. Standard approach — no novel calibration.
//
//   MARKET RWA — REAL (event-sourced).
//     The engine takes a BA 320 market-risk return (`Ba310Output`) and uses
//     its `totalMarketRiskRwaMinor` directly. That figure is already
//     12.5 × market-risk capital and already folds the Reg 28(3)(a) IR-general
//     disallowance algebra (PR #1131). Taking it whole avoids any double-count
//     and lets the disallowances flow through untouched (Mira's scope — read,
//     never re-derive).
//
//   OPERATIONAL RWA — EXPLICIT PLACEHOLDER.
//     Operational RWA via the BIA (OPE25) needs three years of audited gross
//     income; gross income is gross-income-blocked until licence-day (no
//     RevenueRecognitionEmitted feed pre-licence). Held at zero, flagged via
//     `operationalRwaIsPlaceholder: true` and the `source` discriminator.
//     NOT fabricated.
//
// HONESTY: because total RWA still carries a placeholder op-risk component,
// submitting BA 700 now would understate the required-capital denominator.
// The `ba700` period-close subscriber stays allowlisted (inert-module
// detection) with a corrected, narrower blocker reason — see
// platform/recon/completeness/inert-module-detection.ts. Honest-allowlist >
// hollow-wiring (PR #1106 precedent).
//
// Authority: D-RWA-ENGINE-W2-SLICE-3 (CEO session-delegation 2026-06-09);
//   D-REGULATORY-READINESS-W2-SLICE-3; D-REGULATORY-READINESS-GATE-PLAN.
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line-mapping owner)
//   + Camille (Chief Financial Officer, governance — RWA-engine accountable).

import { type DebtExposure, type ExposureClass, readDebtExposures } from "../accounting/ecl-engine";
import { makeRwaComputed } from "../event-store/event-types/regulatory-reporting";
import type { EventStore } from "../event-store/store";
import type { Actor, Event } from "../event-store/types";
import { type ProvenanceFilter, defaultProvenanceFilter } from "../projections/filter";
import type { Ba310Output } from "../reporting/ba-320-market-risk";
import {
  type CounterpartyType,
  type CreditExposure,
  RWA_BANK_ENTITIES,
  type RwaEngineOutput,
  computeRwa,
} from "./rwa-engine";

// ---------------------------------------------------------------------------
// Source discriminator — canonical build-phase composition.
// ---------------------------------------------------------------------------

/**
 * The build-phase `source` discriminator value: credit + market RWA are
 * event-sourced; operational RWA is an explicit gross-income-blocked
 * placeholder.  This string is the canonical legibility signal recon + the
 * BA 700 generator key off.
 */
export const RWA_COMPUTED_BUILD_PHASE_SOURCE =
  "credit+market-event-sourced;op-placeholder-gross-income-blocked";

const ENTITY_ID = "LE-ZA-HOZ-BANK";
const FUNCTIONAL_CURRENCY = "ZAR";

const ACTOR: Actor = { type: "service", id: "agent:bea:rwa-computed-engine" };

// ---------------------------------------------------------------------------
// Exposure-class → CRE20 counterparty-type mapping (credit RWA).
// ---------------------------------------------------------------------------

/**
 * Map the BA 200 obligor `ExposureClass` to the CRE20 standardised-approach
 * `CounterpartyType` the `rwa-engine` risk-weight lookup keys on. This is the
 * documented standard approach (Reg 23 / CRE20), NOT a novel calibration:
 *
 *   - sovereign  → "sovereign-domestic-currency" (RSA ZAR-funded, ZAR-denominated
 *                  sovereign exposure is 0% per CRE20 + national discretion;
 *                  SA government bonds in the banking book qualify).
 *   - bank       → "bank" (External Credit Risk Assessment Approach; unrated
 *                  long-term = 75% per CRE20.21 SCRA Grade B default).
 *   - corporate  → "corporate-ig" (unrated investment-grade corporate = 65%
 *                  post-finalised reforms per CRE20.46).
 *   - retail     → "retail" (regulatory retail = 75% per CRE20).
 *
 * The rating-bucket / residual-maturity refinements are carried per-exposure
 * below where the source events supply them; absent, the conservative default
 * applies (unrated, long-term).
 */
export function exposureClassToCounterpartyType(cls: ExposureClass): CounterpartyType {
  switch (cls) {
    case "sovereign":
      return "sovereign-domestic-currency";
    case "bank":
      return "bank";
    case "corporate":
      return "corporate-ig";
    case "retail":
      return "retail";
  }
}

/**
 * Map an event-sourced `DebtExposure` (from `readDebtExposures`) to a
 * `CreditExposure` for the RWA engine. Sovereign exposures omit the rating
 * bucket (0% weight; under `exactOptionalPropertyTypes` an explicit
 * `undefined` is not assignable to the optional `CreditRatingBucket`). All
 * non-sovereign exposures default to `unrated` + `long-term` — the
 * conservative CRE20 buckets — unless a finer source is available.
 */
export function debtExposureToCreditExposure(d: DebtExposure): CreditExposure {
  const counterpartyType = exposureClassToCounterpartyType(d.exposureClass);
  const isSovereign = counterpartyType === "sovereign-domestic-currency";
  return {
    counterpartyId: d.obligorPartyId ?? d.instrumentId,
    counterpartyType,
    eadMinor: d.eadMinor,
    currency: d.currency,
    ...(isSovereign ? {} : { ratingBucket: "unrated" as const }),
    residualMaturity: "long-term",
    note: `${d.productFamily} instrument=${d.instrumentId} tradeId=${d.tradeId}`,
  };
}

// ---------------------------------------------------------------------------
// RwaComputed result
// ---------------------------------------------------------------------------

export interface RwaComputedResult {
  readonly entityId: string;
  readonly asOf: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  /** Credit RWA — event-sourced via CRE20 over readDebtExposures. */
  readonly creditRwaMinor: number;
  /** Market RWA — 12.5 × BA 320 market-risk capital (incl. Reg 28(3)(a) disallowances). */
  readonly marketRwaMinor: number;
  /** Operational RWA — explicit gross-income-blocked placeholder (zero). */
  readonly operationalRwaMinor: number;
  /** Total RWA = credit + market + operational. */
  readonly totalRwaMinor: number;
  /** Source discriminator (partial-real legibility). */
  readonly source: string;
  /** Always true build-phase: op-RWA is a placeholder. */
  readonly operationalRwaIsPlaceholder: boolean;
  /** Contributing source event_ids (chain-of-custody). */
  readonly sourceEventIds: readonly string[];
  /** Count of credit exposures folded. */
  readonly creditExposureCount: number;
  /** The underlying rwa-engine output (credit section), for forensic use. */
  readonly creditEngineOutput: RwaEngineOutput;
  readonly citations: readonly string[];
}

/**
 * Citations every `RwaComputed` carries — the standing authority + the
 * standardised-approach regulatory anchors (credit Reg 23 / CRE20; market
 * Reg 28 / MAR; operational Reg 33 / OPE25 — held as a placeholder).
 */
const RWA_COMPUTED_CITATIONS: readonly string[] = [
  "D-RWA-ENGINE-W2-SLICE-3",
  "D-REGULATORY-READINESS-W2-SLICE-3",
  "Banks Act 94 of 1990 §70",
  "Regulations Relating to Banks Reg 23",
  "Regulations Relating to Banks Reg 28",
  "Regulations Relating to Banks Reg 33",
  "BCBS Basel III/IV (CRE20, MAR, OPE25)",
];

// ---------------------------------------------------------------------------
// Engine — compute the RWA decomposition.
// ---------------------------------------------------------------------------

export interface ComputeRwaComputedInput {
  readonly entityId: string;
  readonly asOf: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  /**
   * The period's BA 320 market-risk return. The engine reads
   * `totalMarketRiskRwaMinor` (= 12.5 × market-risk capital, already including
   * the Reg 28(3)(a) IR-general disallowance algebra) directly — no
   * re-derivation, no double-count. Mira owns the disallowance logic; this
   * engine never touches it.
   */
  readonly marketRisk: Ba310Output;
  /** Provenance filter — defaults to the standard production filter. */
  readonly provenanceFilter?: ProvenanceFilter;
}

/**
 * Compute the Pillar-1 RWA decomposition for a closed period.
 *
 * Credit RWA is REAL (event-sourced): `readDebtExposures` → CRE20 weights.
 * Market RWA is REAL (event-sourced): 12.5 × BA 320 market-risk capital,
 *   taken whole from the supplied `Ba310Output.totalMarketRiskRwaMinor`.
 * Operational RWA is an EXPLICIT placeholder (zero; gross-income-blocked).
 *
 * Pure function over (store, marketRisk) — no event side-effects. The emit
 * step is `emitRwaComputed` below.
 *
 * @throws if `entityId` is not a bank-licence entity (capital-adequacy is
 *   bank-licence-bound per D-REGULATORY-PERIMETER).
 */
export function computeRwaComputed(
  store: EventStore,
  input: ComputeRwaComputedInput,
): RwaComputedResult {
  if (!RWA_BANK_ENTITIES.includes(input.entityId)) {
    throw new Error(
      `RwaComputed engine: capital-adequacy is bank-licence-bound; entity '${input.entityId}' is not in RWA_BANK_ENTITIES (${RWA_BANK_ENTITIES.join(", ")}). See D-REGULATORY-PERIMETER.`,
    );
  }
  if (input.marketRisk.meta.entity !== input.entityId) {
    throw new Error(
      `RwaComputed engine: market-risk return entity '${input.marketRisk.meta.entity}' does not match RWA entity '${input.entityId}'.`,
    );
  }

  const provenanceFilter = input.provenanceFilter ?? defaultProvenanceFilter();

  // ---- Credit RWA — REAL: CRE20 over the event-sourced debt-exposure base. --
  const debtExposures = readDebtExposures(store, provenanceFilter);
  const creditExposures = debtExposures.map(debtExposureToCreditExposure);
  const sourceEventIds = debtExposures.map((d) => d.tradeId).filter((id) => id.length > 0);

  const creditEngineOutput = computeRwa({
    entityId: input.entityId,
    asOf: input.asOf,
    functionalCurrency: input.functionalCurrency,
    creditExposures,
    // Market + operational are composed separately below — pass empties so the
    // engine's credit section is the only contribution here.
    tradingBookPositions: [],
    businessIndicator: {
      ildcMinor: 0,
      scMinor: 0,
      fcMinor: 0,
      // EUR rate is immaterial: BI is zero so operational RWA is zero here.
      eurToFunctionalRate: 1,
      ilm: 1,
    },
    sourceEventIds,
  });

  const creditRwaMinor = creditEngineOutput.credit.totalMinor;

  // ---- Market RWA — REAL: 12.5 × BA 320 market-risk capital (whole). --------
  // Taken directly from the BA 320 return so the Reg 28(3)(a) IR-general
  // disallowances (PR #1131) flow through untouched. No re-derivation.
  const marketRwaMinor = input.marketRisk.totalMarketRiskRwaMinor;

  // ---- Operational RWA — EXPLICIT placeholder (gross-income-blocked). -------
  const operationalRwaMinor = 0;

  const totalRwaMinor = creditRwaMinor + marketRwaMinor + operationalRwaMinor;

  return {
    entityId: input.entityId,
    asOf: input.asOf,
    periodId: input.periodId,
    functionalCurrency: input.functionalCurrency,
    creditRwaMinor,
    marketRwaMinor,
    operationalRwaMinor,
    totalRwaMinor,
    source: RWA_COMPUTED_BUILD_PHASE_SOURCE,
    operationalRwaIsPlaceholder: true,
    sourceEventIds,
    creditExposureCount: creditExposures.length,
    creditEngineOutput,
    citations: RWA_COMPUTED_CITATIONS,
  };
}

// ---------------------------------------------------------------------------
// Emit — append a RwaComputed event for a computed decomposition.
// ---------------------------------------------------------------------------

/**
 * True iff a `RwaComputed` event already exists for `(entity, periodId)` — the
 * idempotency guard. One RWA computation per closed period; a same-period
 * re-run is a no-op.
 */
export function rwaComputedExists(store: EventStore, entity: string, periodId: string): boolean {
  for (const ev of store.replay({ entity, type: "RwaComputed" })) {
    const p = ev.payload as { periodId?: string };
    if (p.periodId === periodId) return true;
  }
  return false;
}

export interface EmitRwaComputedResult {
  /** True when a new RwaComputed event was appended. */
  readonly emitted: boolean;
  /** The event_id of the (new or pre-existing) RwaComputed event. */
  readonly eventId: string;
  readonly result: RwaComputedResult;
}

/**
 * Compute + (idempotently) emit a `RwaComputed` event for a closed period.
 *
 * If a `RwaComputed` event already exists for `(entity, periodId)`, this is a
 * no-op (`emitted: false`) and returns the existing event_id.
 */
export function emitRwaComputed(
  store: EventStore,
  input: ComputeRwaComputedInput,
): EmitRwaComputedResult {
  const result = computeRwaComputed(store, input);

  // Idempotency: one RwaComputed per (entity, periodId).
  for (const ev of store.replay({ entity: input.entityId, type: "RwaComputed" })) {
    const p = ev.payload as { periodId?: string };
    if (p.periodId === input.periodId) {
      return { emitted: false, eventId: ev.event_id, result };
    }
  }

  const event: Event = makeRwaComputed({
    asOf: input.asOf,
    entity: input.entityId,
    actor: ACTOR,
    citations: [...result.citations],
    payload: {
      entityId: result.entityId,
      asOf: result.asOf,
      periodId: result.periodId,
      functionalCurrency: result.functionalCurrency,
      creditRwaMinor: result.creditRwaMinor,
      marketRwaMinor: result.marketRwaMinor,
      operationalRwaMinor: result.operationalRwaMinor,
      totalRwaMinor: result.totalRwaMinor,
      source: result.source,
      operationalRwaIsPlaceholder: result.operationalRwaIsPlaceholder,
      sourceEventIds: [...result.sourceEventIds],
      creditExposureCount: result.creditExposureCount,
      citations: [...result.citations],
    },
  });
  store.append(event);

  return { emitted: true, eventId: event.event_id, result };
}

export {
  ENTITY_ID as RWA_COMPUTED_ENTITY_ID,
  FUNCTIONAL_CURRENCY as RWA_COMPUTED_FUNCTIONAL_CURRENCY,
};
