// platform/reporting/ba-340-equity-risk-banking-book.ts
//
// BA 340 (Equity Risk in the Banking Book) SIMPLE-RISK-WEIGHT engine + fold over
// the banking-book equity book (D-BA-RETURN-SIMULATOR-FIRST, Phase 2c).
//
// ── WHAT BA 340 IS ──────────────────────────────────────────────────────────
// BA 340 reports the capital the bank must hold against equity positions held in
// its BANKING book (strategic / held-to-collect investments), under the SIMPLE
// RISK-WEIGHT METHOD (Regulations Relating to Banks Reg 31(6)(b)(i), Table 1).
// This is DISTINCT from BA 320 (Market Risk), which charges TRADING-book equity
// (held-for-trading) under the net-general + gross-specific position method. A
// banking-book equity holding NEVER enters BA 320 (the FRTB boundary): the two
// books are fed by two separate event families, so leakage is structurally
// impossible (BA 320 reads only EquityTradingPositionOpened; this engine reads
// only BankingBookEquityHoldingOpened).
//
// ── METHODOLOGY (the domain-truth oracle — SARB Reg 31(6)(b)(i), Table 1) ─────
//   Risk weight by holding class:
//     Publicly-traded ("listed") equity ............. 300%   (BA 340 R0040)
//     Other ("unlisted") equity positions ........... 400%   (BA 340 R0050)
//   Footnote 1: the position INCLUDES the absolute values of net short positions
//   (a net short is risk-weighted on its |value|, not netted to zero).
//   Per holding class:
//     risk-weighted exposure (RWE) = exposure value × risk weight
//     capital requirement          = RWE × 8%   (Reg 38 minimum capital ratio)
//
// The internal-models / market-based approach (Reg 31(6)(b)(ii); BA 340 R0060–
// R0080) is the ALTERNATIVE column. The build-phase substrate implements the
// SIMPLE RISK-WEIGHT method only; the IMA column is surfaced as an explicit,
// tracked gap (no silent zero) by the cell-assembly — never fabricated.
//
// "Speculative-unlisted" holdings (BA 340 R0020) are the phased-in / Reg-38(5)
// deduction-or-250% regime, NOT the Table-1 simple-risk-weight engine; the fold
// carries their exposure for the R0020 line but the engine charges only `listed`
// + `unlisted` (the Table-1 classes). A separate licence-day fold handles the
// deduction regime.
//
// ── PROVENANCE BOUNDARY (the R300m-into-Prod lesson) ────────────────────────
// The fold takes a ProvenanceFilter and only folds events that match it. The
// PRODUCTION read (`defaultProvenanceFilter()`, production-only) excludes the
// simulated book, so the production BA 340 charge is ZERO pre-licence-day (no
// real banking-book equity). The simulated book appears only under a simulated-
// inclusive filter. Both legs proven by `recon:ba340-equity-risk-sim-drive`.
//
// ── DECIMAL-NATIVE ──────────────────────────────────────────────────────────
// Event payloads carry MoneyWire (major-unit decimal); this fold converts to
// minor-unit `number` at the fold boundary via `minorFromMoneyWire` (the same
// boundary the BA 320 / BA 350 adapters cross). Minor figures are summed with
// integer addition; the risk-weight multiply is an integer-basis-points multiply
// (riskWeightBps / 100) then capital is `× 8 / 100` with an integer round — no
// float-money arithmetic (recon:no-float-money-arithmetic).
//
// Pure read — no appends. Per-entity; bank-licence-bound (LE-ZA-HOZ-BANK).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FRTB-TRADING-DESK-STRUCTURE; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE;
//   D-MONEY-DECIMAL-REDENOMINATION; Regulations Relating to Banks Reg 31
//   (equity risk in the banking book — simple risk-weight method), Reg 38
//   (8% min ratio); Basel CRE; Principle 1; Principle 5.
//
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line-mapping owner).

import { minorFromMoneyWire } from "../core/money-codec";
import type {
  BankingBookEquityHoldingClass,
  BankingBookEquityHoldingClosedPayload,
  BankingBookEquityHoldingOpenedPayload,
} from "../event-store/event-types/banking-book-equity-holdings";
import type { EventStore } from "../event-store/store";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../projections/filter";

// ---------------------------------------------------------------------------
// Methodology constants — the domain-truth oracle (Reg 31(6)(b)(i), Table 1).
// ---------------------------------------------------------------------------

/**
 * Simple-risk-weight Table-1 risk weights, in BASIS POINTS of exposure
 * (300% = 30000bps, 400% = 40000bps), so the risk-weighted-exposure multiply is
 * `exposureMinor × bps / 100` — an integer-basis-points multiply with no float.
 *
 * Only `listed` + `unlisted` are Table-1 classes the engine charges.
 * `speculative-unlisted` is NOT in this map — it routes to the deduction/250%
 * regime (a separate licence-day fold), so the engine does not Table-1-charge it.
 */
export const BA340_TABLE1_RISK_WEIGHT_BPS: Readonly<
  Partial<Record<BankingBookEquityHoldingClass, number>>
> = {
  listed: 30_000, // 300% — publicly-traded equity on a licensed exchange (R0040)
  unlisted: 40_000, // 400% — other equity positions (R0050)
};

/** SARB Reg 38 minimum total capital ratio — 8%, in basis points (800bps). */
export const BA340_MIN_CAPITAL_RATIO_BPS = 800;

// ---------------------------------------------------------------------------
// Output contract
// ---------------------------------------------------------------------------

/** Per-holding-class aggregated measures. All money in minor units (cents). */
export interface Ba340ClassMeasures {
  readonly holdingClass: BankingBookEquityHoldingClass;
  /** Exposure value (Σ |exposure|, minor units) — BA 340 column C0010. */
  readonly exposureValueMinor: number;
  /**
   * Risk-weighted exposure (minor units) — BA 340 column C0020. Computed for the
   * Table-1 classes (listed/unlisted); for speculative-unlisted this is 0 because
   * the Table-1 engine does not charge it (it routes to the deduction regime).
   */
  readonly riskWeightedExposureMinor: number;
  /**
   * Capital requirement (minor units) — BA 340 column C0030 = RWE × 8%.
   * 0 for speculative-unlisted (not Table-1-charged here).
   */
  readonly capitalRequirementMinor: number;
  /** The Table-1 risk weight applied (bps), or null when not Table-1-charged. */
  readonly riskWeightBps: number | null;
  /** Number of holdings folded into this class. */
  readonly holdingCount: number;
}

/** The full BA 340 banking-book equity-risk fold over the book. */
export interface Ba340EquityRiskInventory {
  readonly entity: string;
  readonly periodEnd: string;
  /** Per-holding-class measures (only populated classes; empty classes omitted). */
  readonly byClass: readonly Ba340ClassMeasures[];
  /** Total exposure value across all classes (minor units). */
  readonly totalExposureValueMinor: number;
  /** Total risk-weighted exposure (Table-1 classes only; minor units). */
  readonly totalRiskWeightedExposureMinor: number;
  /** Total capital requirement (Table-1 classes only; minor units). */
  readonly totalCapitalRequirementMinor: number;
  /** Total open holdings folded. */
  readonly totalHoldings: number;
  /** Provenance-filter mode the inventory was computed under (audit trail). */
  readonly provenanceDigest: string;
}

// ---------------------------------------------------------------------------
// Input contract
// ---------------------------------------------------------------------------

export interface Ba340FoldInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). */
  readonly entity: string;
  /** Period-end ISO 8601 date-time. Holdings opened ≤ periodEnd are folded. */
  readonly periodEnd: string;
  /** Event store — provides BankingBookEquityHolding{Opened,Closed}. */
  readonly eventStore: EventStore;
  /**
   * Provenance filter. Defaults to the canonical production-only filter
   * (`defaultProvenanceFilter()`) — a caller that does NOT pass a filter gets the
   * production read (simulated book excluded). The recon / simulated read passes
   * a simulated-inclusive filter explicitly.
   */
  readonly provenanceFilter?: ProvenanceFilter;
}

// ---------------------------------------------------------------------------
// Pure charge function (the engine) — testable without a store.
// ---------------------------------------------------------------------------

/**
 * Compute the Table-1 risk-weighted exposure + capital requirement for one
 * holding class from a total exposure value (minor units). Pure, integer
 * arithmetic — no float-money. Returns 0/0/null for a non-Table-1 class
 * (speculative-unlisted), which routes to the deduction regime, not charged here.
 */
export function ba340ChargeForClass(
  holdingClass: BankingBookEquityHoldingClass,
  exposureValueMinor: number,
): {
  riskWeightedExposureMinor: number;
  capitalRequirementMinor: number;
  riskWeightBps: number | null;
} {
  const riskWeightBps = BA340_TABLE1_RISK_WEIGHT_BPS[holdingClass];
  if (riskWeightBps === undefined) {
    // Not a Table-1 class (speculative-unlisted) — the simple-risk-weight engine
    // does not charge it (it routes to the Reg-38(5) deduction/250% regime).
    return {
      riskWeightedExposureMinor: 0,
      capitalRequirementMinor: 0,
      riskWeightBps: null,
    };
  }
  // RWE = exposure × riskWeight; riskWeight is in bps-of-100% so /100.
  // Integer basis-points multiply (exposure is integer minor; bps is integer).
  const riskWeightedExposureMinor = Math.round((exposureValueMinor * riskWeightBps) / 100);
  // Capital = RWE × 8% = RWE × 800bps / 10000.
  const capitalRequirementMinor = Math.round(
    (riskWeightedExposureMinor * BA340_MIN_CAPITAL_RATIO_BPS) / 10_000,
  );
  return { riskWeightedExposureMinor, capitalRequirementMinor, riskWeightBps };
}

// ---------------------------------------------------------------------------
// Per-class accumulator
// ---------------------------------------------------------------------------

interface ClassAccumulator {
  exposureValueMinor: number;
  holdingCount: number;
}

// The deterministic display order of holding classes.
const CLASS_ORDER: readonly BankingBookEquityHoldingClass[] = [
  "listed",
  "unlisted",
  "speculative-unlisted",
];

// ---------------------------------------------------------------------------
// Main fold
// ---------------------------------------------------------------------------

/**
 * Fold the banking-book equity book into the BA 340 simple-risk-weight inventory.
 * Pure read.
 *
 * Logic:
 *   1. Collect derecognised holdingIds from BankingBookEquityHoldingClosed.
 *   2. Replay BankingBookEquityHoldingOpened ≤ periodEnd, provenance-filtered.
 *   3. Exclude derecognised holdings.
 *   4. Accumulate |exposure value| per holding class (Reg 31 footnote 1 —
 *      absolute value, both sides; a net short is charged on its magnitude).
 *   5. Apply the Table-1 risk weight per class (300% listed / 400% unlisted) →
 *      risk-weighted exposure → capital (× 8%).
 *
 * Citations: Reg 31(6)(b)(i) Table 1; Reg 38 (8% min ratio);
 *   D-BA-RETURN-SIMULATOR-FIRST; Principle 1.
 */
export function foldBa340EquityRiskBankingBook(input: Ba340FoldInput): Ba340EquityRiskInventory {
  const { eventStore, entity, periodEnd } = input;
  const provenanceFilter = input.provenanceFilter ?? defaultProvenanceFilter();

  // 1. Derecognitions.
  const closed = new Set<string>();
  for (const ev of eventStore.replay({
    type: "BankingBookEquityHoldingClosed",
    asOf: periodEnd,
  })) {
    if (ev.entity !== entity) continue;
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as unknown as BankingBookEquityHoldingClosedPayload;
    closed.add(p.holdingId);
  }

  // 2 + 4. Fold opens.
  const byClass = new Map<BankingBookEquityHoldingClass, ClassAccumulator>();
  let totalHoldings = 0;

  for (const ev of eventStore.replay({
    type: "BankingBookEquityHoldingOpened",
    asOf: periodEnd,
  })) {
    if (ev.entity !== entity) continue;
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as unknown as BankingBookEquityHoldingOpenedPayload;
    if (closed.has(p.holdingId)) continue;

    let acc = byClass.get(p.holdingClass);
    if (!acc) {
      acc = { exposureValueMinor: 0, holdingCount: 0 };
      byClass.set(p.holdingClass, acc);
    }
    // Exposure value is the absolute magnitude (Reg 31 footnote 1).
    acc.exposureValueMinor += Math.abs(minorFromMoneyWire(p.exposureValue));
    acc.holdingCount += 1;
    totalHoldings += 1;
  }

  // 5. Apply the Table-1 charge per class, in deterministic order.
  const measures: Ba340ClassMeasures[] = [];
  let totalExposureValueMinor = 0;
  let totalRiskWeightedExposureMinor = 0;
  let totalCapitalRequirementMinor = 0;

  for (const holdingClass of CLASS_ORDER) {
    const acc = byClass.get(holdingClass);
    if (!acc || acc.holdingCount === 0) continue;
    const charge = ba340ChargeForClass(holdingClass, acc.exposureValueMinor);
    measures.push({
      holdingClass,
      exposureValueMinor: acc.exposureValueMinor,
      riskWeightedExposureMinor: charge.riskWeightedExposureMinor,
      capitalRequirementMinor: charge.capitalRequirementMinor,
      riskWeightBps: charge.riskWeightBps,
      holdingCount: acc.holdingCount,
    });
    totalExposureValueMinor += acc.exposureValueMinor;
    totalRiskWeightedExposureMinor += charge.riskWeightedExposureMinor;
    totalCapitalRequirementMinor += charge.capitalRequirementMinor;
  }

  return {
    entity,
    periodEnd,
    byClass: measures,
    totalExposureValueMinor,
    totalRiskWeightedExposureMinor,
    totalCapitalRequirementMinor,
    totalHoldings,
    provenanceDigest: provenanceFilter.mode,
  };
}

// ---------------------------------------------------------------------------
// Aggregation helpers — BA 340 cell assembly reads these.
// ---------------------------------------------------------------------------

/** Measures for one holding class, or null when the class has no holdings. */
export function ba340MeasuresForClass(
  inv: Ba340EquityRiskInventory,
  holdingClass: BankingBookEquityHoldingClass,
): Ba340ClassMeasures | null {
  return inv.byClass.find((m) => m.holdingClass === holdingClass) ?? null;
}
