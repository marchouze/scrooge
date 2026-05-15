// platform/ftp/attribution.ts
//
// attributeTransaction — produces a FtpAttributionRecordedPayload for a
// single transaction against a live FTP curve.
//
// FTP attribution allocates a funding cost or benefit to each transaction
// based on its maturity, currency, and the bank's curve methodology:
//
//   spread = clientRate - ftpRate
//
// A positive spread means the transaction earns above the bank's marginal
// cost of funds (profitable). A negative spread means the bank earns below
// its cost of funds (unprofitable on a standalone funding basis).
//
// The caller is responsible for:
//   - Selecting the correct currency curve for the transaction.
//   - Emitting the returned payload as an FtpAttributionRecorded event
//     (via the event store).
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.
// Author: Ravi (Treasury/ALM Engineer, engineering)

import type { FtpAttributionRecordedPayload } from "../event-store/event-types/ftp";
import { type FtpCurve, tenorToDays } from "./curve";

// ---------------------------------------------------------------------------
// AttributionParams
// ---------------------------------------------------------------------------

export interface AttributionParams {
  /** Unique attribution identifier — e.g. 'FTP-ATTR-001'. */
  attributionId: string;
  /** Reference to the underlying trade/loan event. */
  transactionId: string;
  /** Type of transaction being attributed. */
  transactionType: FtpAttributionRecordedPayload["transactionType"];
  /** ISO 4217 currency code — must match the curve's currency. */
  currency: string;
  /** Notional amount of the transaction. */
  notional: number;
  /** Days to maturity — used to look up the FTP rate via the curve. */
  maturityDays: number;
  /** Rate charged to / paid by the client (annualised decimal). */
  clientRate: number;
  /** The active FTP curve for this currency. */
  curve: FtpCurve;
}

// ---------------------------------------------------------------------------
// attributeTransaction
// ---------------------------------------------------------------------------

/**
 * Attributes a single transaction against an FTP curve.
 *
 * Returns the full `FtpAttributionRecordedPayload` ready to be emitted as an
 * `FtpAttributionRecorded` event. The caller supplies `attributedAt`.
 *
 * The matched tenor string is derived from `maturityDays` by finding the
 * curve tenor whose day-count is closest to `maturityDays`.
 *
 * @throws Error if the curve has no valid tenor points.
 */
export function attributeTransaction(
  params: AttributionParams & { attributedAt: string },
): FtpAttributionRecordedPayload {
  const {
    attributionId,
    transactionId,
    transactionType,
    currency,
    notional,
    maturityDays,
    clientRate,
    curve,
    attributedAt,
  } = params;

  const ftpRate = curve.getRateForDays(maturityDays);
  const spread = clientRate - ftpRate;
  const matchedTenor = findClosestTenor(curve, maturityDays);

  return {
    attributionId,
    transactionId,
    transactionType,
    currency,
    notional,
    tenor: matchedTenor,
    clientRate,
    ftpRate,
    spread,
    ftpCurveId: curve.curveId,
    attributedAt,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Finds the curve tenor label whose day-count is closest to `days`.
 *
 * When `days` falls exactly between two tenors, returns the shorter one
 * (conservative matched-maturity convention).
 */
function findClosestTenor(curve: FtpCurve, days: number): string {
  let bestTenor = curve.tenors[0]?.tenor ?? "1D";
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const t of curve.tenors) {
    const tenorDays = tenorToDays(t.tenor);
    if (tenorDays === null) continue;
    const distance = Math.abs(tenorDays - days);
    // Use strict < so that ties favour the shorter (earlier) tenor
    if (distance < bestDistance) {
      bestDistance = distance;
      bestTenor = t.tenor;
    }
  }

  return bestTenor;
}
