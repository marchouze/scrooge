// platform/ftp/projection.ts
//
// buildFtpPortfolio — reduces FtpAttributionRecorded and FtpCurvePublished
// events from the event log into a FtpPortfolioSummary.
//
// Principle 1: this projection is a derived cache over the event log;
// the event log is the only source of truth.
//
// The summary is consumed by:
//   - The dashboard `ftp` tile (Eitan's ALCO overview)
//   - Ravi's daily ALM-readiness handler (substrate-gap reporting)
//   - Future NII-at-risk scenarios (Rohan joint with Eitan)
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.
// Author: Ravi (Treasury/ALM Engineer, engineering)

import type {
  FtpAttributionRecordedPayload,
  FtpCurvePublishedPayload,
} from "../event-store/event-types/ftp";
import type { Event } from "../event-store/types";

// ---------------------------------------------------------------------------
// FtpPortfolioSummary
// ---------------------------------------------------------------------------

/**
 * Aggregated view over all FtpAttributionRecorded events.
 *
 * `weightedAvgSpread` is expressed in basis points (bps = spread × 10_000).
 * Weights are by notional.
 */
export interface FtpPortfolioSummary {
  /** Total number of attribution records in the event log. */
  totalAttributions: number;
  /** Total notional across all attributions (in the transaction currency — no cross-currency conversion). */
  totalNotional: number;
  /** Notional-weighted average spread in basis points. */
  weightedAvgSpread: number;
  /** Per-transaction-type breakdown. */
  byTransactionType: Record<
    string,
    {
      count: number;
      totalNotional: number;
      /** Notional-weighted average spread in basis points for this type. */
      avgSpread: number;
    }
  >;
  /** The most recently published FTP curve ID, or null if no curve exists yet. */
  activeCurveId: string | null;
  /** ISO 8601 timestamp of the most recent FtpAttributionRecorded or FtpCurvePublished event. */
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// Empty / default summary
// ---------------------------------------------------------------------------

export function emptyFtpPortfolioSummary(): FtpPortfolioSummary {
  return {
    totalAttributions: 0,
    totalNotional: 0,
    weightedAvgSpread: 0,
    byTransactionType: {},
    activeCurveId: null,
    lastUpdated: new Date(0).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// buildFtpPortfolio
// ---------------------------------------------------------------------------

/**
 * Folds the event stream into a FtpPortfolioSummary.
 *
 * Processes:
 *   - `FtpCurvePublished` — tracks the most recent curve ID.
 *   - `FtpAttributionRecorded` — accumulates notional and spread.
 *
 * All other event types are ignored.
 */
export function buildFtpPortfolio(events: readonly Event[]): FtpPortfolioSummary {
  let activeCurveId: string | null = null;
  let latestCurveAt: string = new Date(0).toISOString();
  let latestAttributionAt: string = new Date(0).toISOString();

  let totalAttributions = 0;
  let totalNotional = 0;
  let totalNotionalWeightedSpread = 0; // sum of (notional × spread) for weighted avg

  const byType: Record<
    string,
    { count: number; totalNotional: number; totalNotionalWeightedSpread: number }
  > = {};

  for (const event of events) {
    if (event.type === "FtpCurvePublished") {
      const p = event.payload as FtpCurvePublishedPayload;
      // Track the most recently published curve by as_of
      if (event.as_of >= latestCurveAt) {
        latestCurveAt = event.as_of;
        activeCurveId = p.curveId;
      }
      continue;
    }

    if (event.type === "FtpAttributionRecorded") {
      const p = event.payload as FtpAttributionRecordedPayload;

      totalAttributions++;
      totalNotional += p.notional;
      totalNotionalWeightedSpread += p.notional * p.spread;

      if (event.as_of > latestAttributionAt) {
        latestAttributionAt = event.as_of;
      }

      const txType = p.transactionType;
      if (!byType[txType]) {
        byType[txType] = { count: 0, totalNotional: 0, totalNotionalWeightedSpread: 0 };
      }
      byType[txType].count++;
      byType[txType].totalNotional += p.notional;
      byType[txType].totalNotionalWeightedSpread += p.notional * p.spread;
    }
  }

  // Convert to basis points; guard against zero notional
  const weightedAvgSpread =
    totalNotional > 0 ? (totalNotionalWeightedSpread / totalNotional) * 10_000 : 0;

  const byTransactionType: FtpPortfolioSummary["byTransactionType"] = {};
  for (const [type, row] of Object.entries(byType)) {
    const avgSpreadBps =
      row.totalNotional > 0
        ? (row.totalNotionalWeightedSpread / row.totalNotional) * 10_000
        : 0;
    byTransactionType[type] = {
      count: row.count,
      totalNotional: row.totalNotional,
      avgSpread: avgSpreadBps,
    };
  }

  // lastUpdated = max of latest curve or attribution timestamp
  const lastUpdated =
    latestAttributionAt > latestCurveAt
      ? latestAttributionAt
      : latestCurveAt > new Date(0).toISOString()
        ? latestCurveAt
        : new Date(0).toISOString();

  return {
    totalAttributions,
    totalNotional,
    weightedAvgSpread,
    byTransactionType,
    activeCurveId,
    lastUpdated,
  };
}
