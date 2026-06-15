// v2-core/fil-models/fx/shared/fx-interpolation.ts
//
// Generic linear curve interpolation utility for FX (and reusable by IRD yield
// curves, credit spreads, etc.).
//
// interpolateCurve discovers all entries in marks.observables matching
// `<curvePrefix><N>d`, extracts N (integer days), sorts ascending, linearly
// interpolates. Flat extrapolation beyond the terminal tenor. Fail-closed:
// throws if no curve entries found.
//
// Authority: D-ENGINEERING-INTEGRITY-CHARTER; brief:atlas:fil-fx-language-phase-1-linear-otc-models:2026-06-15
// Author: Atlas (Core banking platform architect, engineering).

import type { MarketDataSlice } from "../../../fil-facets/facets.ts";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface TenorPoint {
  days: number;
  value: number;
}

/**
 * Linearly interpolates a value at targetDays from named curve entries in marks.
 * Discovers all keys matching `curvePrefix + "<N>d"`, extracts N (integer days),
 * sorts ascending, linearly interpolates. Flat extrapolation beyond last tenor.
 * Throws if no curve entries found (fail-closed).
 */
export function interpolateCurve(
  marks: MarketDataSlice,
  curvePrefix: string,
  targetDays: number,
): number {
  const tenorRegex = new RegExp(`^${escapeRegex(curvePrefix)}(\\d+)d$`);
  const points: TenorPoint[] = [];

  for (const [key, value] of Object.entries(marks.observables)) {
    const m = tenorRegex.exec(key);
    if (m && m[1] !== undefined) {
      points.push({ days: Number.parseInt(m[1], 10), value });
    }
  }

  if (points.length === 0) {
    throw new Error(
      `interpolateCurve: no curve entries found for prefix "${curvePrefix}" — ensure marks contain at least one tenor point`,
    );
  }

  points.sort((a, b) => a.days - b.days);

  const first = points[0];
  const last = points[points.length - 1];

  // These are always defined — points.length > 0 guaranteed by the check above
  if (!first || !last) {
    throw new Error(
      "interpolateCurve: internal invariant violated — points array empty after check",
    );
  }

  // Flat left extrapolation (short end)
  if (targetDays <= first.days) return first.value;
  // Flat right extrapolation (long end)
  if (targetDays >= last.days) return last.value;

  // Linear interpolation — find the bracketing interval
  for (let i = 0; i < points.length - 1; i++) {
    const lo = points[i];
    const hi = points[i + 1];
    if (!lo || !hi) continue; // satisfy strict array-bounds check
    if (targetDays >= lo.days && targetDays <= hi.days) {
      const t = (targetDays - lo.days) / (hi.days - lo.days);
      return lo.value + t * (hi.value - lo.value);
    }
  }

  // Unreachable — all interior cases handled above
  return last.value;
}
