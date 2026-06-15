// v2-core/fil-models/fx/types/fx-lifecycles.ts
//
// FX lifecycle declarations for Phase 1 OTC instruments.
// Each FX instrument type maps to FIL kernel stages:
//   booked → "proposed" | active → "active" | settled/cash-settled → "settled"
//   defaulted/abandoned → "terminated" | cancelled → "cancelled"
//
// NDF: NdfFixingObserved does NOT change kernel stage (stays "active");
//       only SettlementConfirmed moves to "settled".
// Swap: near-leg settlement is a CDM event, NOT a kernel stage change.
//
// Authority: D-ENGINEERING-INTEGRITY-CHARTER; brief:atlas:fil-fx-language-phase-1-linear-otc-models:2026-06-15
// Author: Atlas (Core banking platform architect, engineering).

import type { FilEventRef, FilLifecycleDeclaration } from "../../../fil-core/lifecycle.ts";

function ref(s: string): FilEventRef {
  return s as FilEventRef;
}

export const FX_SPOT_LIFECYCLE: FilLifecycleDeclaration = {
  initial: "proposed",
  transitions: [
    { from: "proposed", to: "active", via: ref("FxTradeExecuted") },
    { from: "active", to: "settled", via: ref("SettlementConfirmed") },
    { from: "active", to: "cancelled", via: ref("FxTradeCancelled") },
    { from: "active", to: "terminated", via: ref("FxForwardDefaulted") },
  ],
};

export const FX_FORWARD_LIFECYCLE: FilLifecycleDeclaration = {
  initial: "proposed",
  transitions: [
    { from: "proposed", to: "active", via: ref("FxTradeExecuted") },
    { from: "active", to: "settled", via: ref("SettlementConfirmed") },
    { from: "active", to: "cancelled", via: ref("FxTradeCancelled") },
    { from: "active", to: "terminated", via: ref("FxForwardDefaulted") },
  ],
};

// Swap: near-leg settlement keeps kernel stage "active"; far-leg settlement = "settled"
export const FX_SWAP_LIFECYCLE: FilLifecycleDeclaration = {
  initial: "proposed",
  transitions: [
    { from: "proposed", to: "active", via: ref("FxTradeExecuted") },
    { from: "active", to: "settled", via: ref("SettlementConfirmed") },
    { from: "active", to: "cancelled", via: ref("FxTradeCancelled") },
    { from: "active", to: "terminated", via: ref("FxForwardDefaulted") },
  ],
};

// NDF: fixing (NdfFixingObserved) does NOT change kernel stage — it stays "active"
// Only cash settlement confirmation moves to "settled"
export const FX_NDF_LIFECYCLE: FilLifecycleDeclaration = {
  initial: "proposed",
  transitions: [
    { from: "proposed", to: "active", via: ref("FxTradeExecuted") },
    { from: "active", to: "settled", via: ref("SettlementConfirmed") },
    { from: "active", to: "cancelled", via: ref("FxTradeCancelled") },
    { from: "active", to: "terminated", via: ref("FxForwardDefaulted") },
  ],
};
