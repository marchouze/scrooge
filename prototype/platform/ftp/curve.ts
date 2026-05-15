// platform/ftp/curve.ts
//
// FtpCurve — the curve object produced when a FtpCurvePublished event lands.
//
// Wraps the ordered tenor/rate pairs and provides:
//   - getRateForTenor(tenor)  — exact lookup or linear interpolation
//   - getRateForDays(days)    — convert a day count to a tenor and look up
//
// The bank uses matched-maturity FTP: each transaction is attributed a rate
// from the curve at the closest comparable tenor. Linear interpolation is
// used when the transaction's tenor falls between two curve tenors.
//
// Tenor-to-days mapping:
//   ON / O/N / 1D →  1
//   1W            →  7
//   2W            → 14
//   1M            → 30
//   2M            → 60
//   3M            → 91
//   6M            → 182
//   9M            → 273
//   1Y            → 365
//   2Y            → 730
//   3Y            → 1095
//   5Y            → 1825
//   7Y            → 2555
//   10Y           → 3650
//   15Y           → 5475
//   20Y           → 7300
//   30Y           → 10950
//
// For tenors not in the above map, a simple heuristic parses the suffix
// (D/W/M/Y) and multiplies. Unknown tenors default to the nearest
// outer boundary (shortest tenor for < shortest, longest for > longest).
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.
// Author: Ravi (Treasury/ALM Engineer, engineering)

import type { FtpCurvePublishedPayload, FtpTenorRate } from "../event-store/event-types/ftp";

// ---------------------------------------------------------------------------
// Tenor-to-days canonical map
// ---------------------------------------------------------------------------

const TENOR_DAYS: Record<string, number> = {
  ON: 1,
  "O/N": 1,
  "1D": 1,
  "2D": 2,
  "3D": 3,
  "1W": 7,
  "2W": 14,
  "3W": 21,
  "1M": 30,
  "2M": 60,
  "3M": 91,
  "4M": 122,
  "5M": 152,
  "6M": 182,
  "7M": 213,
  "8M": 243,
  "9M": 273,
  "10M": 304,
  "11M": 334,
  "1Y": 365,
  "2Y": 730,
  "3Y": 1095,
  "4Y": 1460,
  "5Y": 1825,
  "6Y": 2190,
  "7Y": 2555,
  "8Y": 2920,
  "9Y": 3285,
  "10Y": 3650,
  "12Y": 4380,
  "15Y": 5475,
  "20Y": 7300,
  "25Y": 9125,
  "30Y": 10950,
};

/**
 * Converts a tenor string to a day count.
 *
 * Uses the canonical map above. If the tenor is not in the map, falls back
 * to a simple regex heuristic: parse the numeric prefix and the unit suffix
 * (D = days, W = weeks, M = months ×30, Y = years ×365).
 *
 * Returns `null` if the tenor is completely unrecognised.
 */
export function tenorToDays(tenor: string): number | null {
  const normalised = tenor.toUpperCase().trim();
  if (normalised in TENOR_DAYS) return TENOR_DAYS[normalised] ?? null;

  const m = normalised.match(/^(\d+(?:\.\d+)?)(D|W|M|Y)$/);
  if (!m) return null;
  const n = Number.parseFloat(m[1] ?? "0");
  switch (m[2]) {
    case "D":
      return Math.round(n);
    case "W":
      return Math.round(n * 7);
    case "M":
      return Math.round(n * 30);
    case "Y":
      return Math.round(n * 365);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// FtpCurve
// ---------------------------------------------------------------------------

/**
 * An FTP curve constructed from a `FtpCurvePublished` event payload.
 *
 * The curve maintains an ordered list of (days, rate) pairs and supports:
 *   - Exact tenor lookup
 *   - Linear interpolation between adjacent tenors
 *   - Day-count lookup (converted to the closest tenor bucket)
 */
export class FtpCurve {
  /** Curve identifier — e.g. 'FTP-ZAR-2026-05-15'. */
  readonly curveId: string;
  /** ISO 4217 currency. */
  readonly currency: string;
  /** ISO 8601 effective date. */
  readonly effectiveDate: string;
  /** Methodology used. */
  readonly methodology: FtpCurvePublishedPayload["methodology"];
  /** Original tenor/rate pairs from the event. */
  readonly tenors: readonly FtpTenorRate[];

  /** Internal: sorted (days, rate) pairs for interpolation. */
  private readonly _points: Array<{ days: number; rate: number; tenor: string }>;

  constructor(payload: FtpCurvePublishedPayload) {
    this.curveId = payload.curveId;
    this.currency = payload.currency;
    this.effectiveDate = payload.effectiveDate;
    this.methodology = payload.methodology;
    this.tenors = payload.tenors;

    // Build sorted (days, rate) point array. Tenors whose day-count cannot
    // be determined are silently skipped (the payload schema ensures at
    // least one valid tenor, and the skipped-tenor count is low in practice).
    this._points = payload.tenors
      .map((t) => {
        const days = tenorToDays(t.tenor);
        return days !== null ? { days, rate: t.rate, tenor: t.tenor } : null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => a.days - b.days);

    if (this._points.length === 0) {
      throw new Error(
        `FtpCurve(${payload.curveId}): no valid tenor points could be derived from the payload tenors`,
      );
    }
  }

  /**
   * Returns the rate for an exact tenor string.
   *
   * If the tenor is in the curve exactly, the stored rate is returned.
   * Otherwise, converts the tenor to days and calls `getRateForDays()`.
   *
   * @throws Error if the tenor is unrecognisable (cannot be parsed to days).
   */
  getRateForTenor(tenor: string): number {
    // Check for exact tenor match first (case-insensitive normalisation)
    const normalised = tenor.toUpperCase().trim();
    for (const t of this.tenors) {
      if (t.tenor.toUpperCase().trim() === normalised) {
        return t.rate;
      }
    }
    // Fall through to day-based interpolation
    const days = tenorToDays(tenor);
    if (days === null) {
      throw new Error(
        `FtpCurve.getRateForTenor: unrecognised tenor '${tenor}' — cannot convert to days`,
      );
    }
    return this.getRateForDays(days);
  }

  /**
   * Returns the interpolated rate for a given number of days to maturity.
   *
   * Interpolation rules:
   *   - days <= shortest tenor → use the shortest tenor rate (flat extension)
   *   - days >= longest tenor  → use the longest tenor rate (flat extension)
   *   - otherwise              → linear interpolation between adjacent tenors
   */
  getRateForDays(days: number): number {
    if (this._points.length === 0) {
      throw new Error("FtpCurve.getRateForDays: curve has no valid points");
    }

    const first = this._points[0];
    const last = this._points[this._points.length - 1];

    // These are guaranteed non-null because length > 0 (checked above),
    // but TypeScript array access returns T|undefined. Use early throw rather
    // than the forbidden ! operator.
    if (first === undefined || last === undefined) {
      throw new Error("FtpCurve.getRateForDays: internal error — points array unexpectedly empty");
    }

    // Short-circuit: at or below the shortest tenor
    if (days <= first.days) {
      return first.rate;
    }

    // Short-circuit: at or above the longest tenor
    if (days >= last.days) {
      return last.rate;
    }

    // Linear interpolation: find the two surrounding points
    for (let i = 0; i < this._points.length - 1; i++) {
      const lo = this._points[i];
      const hi = this._points[i + 1];

      if (lo === undefined || hi === undefined) continue;

      if (days >= lo.days && days <= hi.days) {
        if (hi.days === lo.days) {
          // Degenerate (duplicate days) — return lo rate
          return lo.rate;
        }
        const t = (days - lo.days) / (hi.days - lo.days);
        return lo.rate + t * (hi.rate - lo.rate);
      }
    }

    // Should never reach here given the boundary checks above
    return last.rate;
  }
}
