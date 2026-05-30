// platform/product-control/pnl-data-failures-view.ts
//
// Read-side projection that surfaces the daily P&L aggregate as a data failure
// when it is incomplete. Sibling of model-registry/data-failures-view.ts: that
// view covers registered-model calc figures (LCR, NSFR, RWA, VaR, CVA); this
// one covers the product-control headline unrealised P&L, which is computed
// outside CALC_BINDINGS but must obey the same no-silent-zero discipline.
//
// A LIVE FX position with no usable production mark must NOT collapse to a
// silent 0 in the headline unrealised figure. When ≥1 such position exists,
// `computeDailyPnL` excludes it (rather than zeroing it) and marks the
// aggregate incomplete. This view turns that incompleteness into a banner
// entry shaped exactly like model-registry data failures, so the global
// /api/data-failures banner shows "unrealised P&L unavailable" with the
// unmarkable trade IDs named — never a clean-looking partial number.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Workstream: WS-TRUSTED-FIGURES.
// Author: Atlas (Core banking platform architect, engineering).

import type { EventStore } from "../event-store/store";
import { isPresent } from "../types/financial-input";
import { computeDailyPnL } from "./daily-pnl";

/**
 * Shaped to match model-registry DataFailureView so the same banner section
 * renders it. `missingInputs` carries the unmarkable live trade IDs.
 */
export interface PnLDataFailureView {
  readonly calcKey: string;
  readonly figure: string;
  readonly modelId: string;
  readonly owningAgent: string;
  readonly status: "degraded" | "failed";
  readonly missingInputs: readonly string[];
  readonly asOf: string;
}

/**
 * Returns a single-element array describing the daily-P&L data failure when the
 * headline unrealised figure is incomplete (≥1 unmarkable live position), or an
 * empty array when every live position was markable. Computed on demand for the
 * current report date — the same read the /api/product-control/daily-pnl
 * endpoint performs.
 */
export function buildPnLDataFailuresView(
  store: EventStore,
  reportDate: string,
): PnLDataFailureView[] {
  const { totalUnrealised, payload } = computeDailyPnL(store, reportDate);
  if (isPresent(totalUnrealised)) return [];
  return [
    {
      calcKey: "product-control:daily-unrealised-pnl",
      figure: "FX desk unrealised P&L (daily)",
      modelId: "product-control:daily-pnl",
      owningAgent: "Bea (Accounting & financial reporting engineer, engineering)",
      status: "degraded",
      missingInputs: payload.unmarkableLiveTradeIds.map((tid) => `mark for live position ${tid}`),
      asOf: payload.generatedAt,
    },
  ];
}
