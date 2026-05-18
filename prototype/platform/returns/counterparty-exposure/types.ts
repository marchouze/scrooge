// platform/returns/counterparty-exposure/types.ts
//
// M3 Slice 10 — Counterparty-exposure register types.
//
// Data substrate for the large-exposure monitoring module. All metric cells
// derive from CounterpartyExposureCalculated event replay (Principle 1).
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
//   (CEO-approved 2026-05-10).
//
// Citations:
//   Banks Act 94 of 1990 §73 (large exposures);
//   RRB Regulation 23 (credit-risk large exposure limits);
//   BCBS 283 (large exposures framework, 2014);
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Atlas (Principal Software Engineer, engineering)

import type { ExposureType } from "../../event-store/event-types/counterparty-exposure";

// ---------------------------------------------------------------------------
// Re-export shared enum for consumers of this module
// ---------------------------------------------------------------------------

export type { ExposureType };

// ---------------------------------------------------------------------------
// Per-type exposure snapshot (event-derived)
// ---------------------------------------------------------------------------

/**
 * A single counterparty-exposure snapshot for one exposure type and one
 * calculation timestamp. Derived from a single CounterpartyExposureCalculated
 * event.
 */
export interface CounterpartyExposureSnapshot {
  /** Party register ID of the counterparty. */
  readonly counterpartyId: string;
  /** The exposure-type dimension. */
  readonly exposureType: ExposureType;
  /** Gross exposure in ZAR minor units (cents) before netting/collateral. */
  readonly grossExposure: number;
  /** Net exposure in ZAR minor units after bilateral netting. */
  readonly netExposure: number;
  /** Netting agreement ID applied (if any). Undefined when no netting agreement exists. */
  readonly nettingAgreementId: string | undefined;
  /** Market value of collateral held (ZAR minor units). */
  readonly collateralHeld: number;
  /** Uncovered exposure = max(0, netExposure − collateralHeld). */
  readonly uncoveredExposure: number;
  /** Limit utilisation (0–100+ pct). */
  readonly limitUtilisationPct: number;
  /** Whether the exposure limit is breached. */
  readonly breached: boolean;
  /** ISO 8601 — calculation timestamp. */
  readonly calculatedAt: string;
}

// ---------------------------------------------------------------------------
// Counterparty-exposure register entry (latest snapshot per counterparty/type)
// ---------------------------------------------------------------------------

/**
 * A register entry holding the most recent exposure snapshot per counterparty
 * per exposure type. The register is keyed on `${counterpartyId}:${exposureType}`.
 * Derived from replaying all CounterpartyExposureCalculated events, keeping
 * only the latest (by calculatedAt) for each key.
 */
export type ExposureRegisterKey = `${string}:${ExposureType}`;

export interface CounterpartyExposureRegisterEntry {
  /** Register key: `${counterpartyId}:${exposureType}`. */
  readonly key: ExposureRegisterKey;
  /** Latest snapshot for this counterparty/type combination. */
  readonly latest: CounterpartyExposureSnapshot;
  /** Number of calculation events recorded for this key. */
  readonly calculationCount: number;
  /** History of all snapshots for this key (newest-first). */
  readonly history: readonly CounterpartyExposureSnapshot[];
}

// ---------------------------------------------------------------------------
// Full counterparty-exposure register
// ---------------------------------------------------------------------------

/**
 * Full counterparty-exposure register derived from event replay.
 *
 * Contains:
 *   - `entries`     — latest snapshot per counterparty/type combination.
 *   - `breached`    — entries where `breached === true` (convenience filter).
 *   - `metrics`     — aggregate summary for the register.
 */
export interface CounterpartyExposureRegister {
  /** ISO 8601 — when this register snapshot was generated. */
  readonly asOf: string;
  /** All register entries (one per counterparty/type key). */
  readonly entries: readonly CounterpartyExposureRegisterEntry[];
  /** Subset of entries where the latest snapshot is breached. */
  readonly breached: readonly CounterpartyExposureRegisterEntry[];
  /** Aggregate metrics across the register. */
  readonly metrics: CounterpartyExposureMetrics;
}

// ---------------------------------------------------------------------------
// Aggregate metrics
// ---------------------------------------------------------------------------

/**
 * Aggregate metrics for the counterparty-exposure register.
 */
export interface CounterpartyExposureMetrics {
  /** Total number of register entries (distinct counterparty/type pairs). */
  readonly totalEntries: number;
  /** Number of entries where `breached === true`. */
  readonly breachedCount: number;
  /** Number of distinct counterparties in the register. */
  readonly distinctCounterparties: number;
  /** Exposure types represented in the register. */
  readonly exposureTypesPresent: readonly ExposureType[];
  /**
   * Aggregate uncovered exposure across all entries (ZAR minor units).
   * Sum of `latest.uncoveredExposure` for each entry.
   */
  readonly totalUncoveredExposure: number;
  /**
   * Maximum limit utilisation across all entries (pct).
   * 0 when no entries exist.
   */
  readonly maxLimitUtilisationPct: number;
}
