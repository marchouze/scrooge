// v2-core/fil-models/ir/bond/types/bond-lifecycles.ts
//
// Lifecycle declaration for the Phase 3c FVTPL fixed-rate vanilla bond. Maps to
// FIL kernel stages over the V2-parallel bond lifecycle event types:
//   trade-executed → "active" | matured/sold → "matured"
//
// Interest-accrual and fair-value-revaluation events do NOT change the kernel
// stage (they fold the carrying / fair value; the instance stays "active"). Only
// a terminal redemption (BondMaturedV2) or a disposal (BondSoldV2) moves to
// "matured" — both are derecognition events (IFRS 9 §3.2.3).
//
// Authority: D-V1-REMOVAL-PHASE-3C; D-ENGINEERING-INTEGRITY-CHARTER;
//   brief:atlas:v1-removal-phase-3c-bond-accounting-on-v2-fvtpl-:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

import type { FilEventRef, FilLifecycleDeclaration } from "../../../../fil-core/lifecycle.ts";

function ref(s: string): FilEventRef {
  return s as FilEventRef;
}

// Fixed-rate vanilla bond — long or short; the terminal event differs by exit
// (held to maturity → matured; sold before maturity → matured via disposal).
export const BOND_LIFECYCLE: FilLifecycleDeclaration = {
  initial: "proposed",
  transitions: [
    { from: "proposed", to: "active", via: ref("BondTradeExecutedV2") },
    // Accrual + revaluation fold value; the instance stays active.
    { from: "active", to: "active", via: ref("BondInterestAccruedV2") },
    { from: "active", to: "active", via: ref("BondPositionRevaluedV2") },
    // Terminal: held-to-maturity redemption, or disposal in the secondary market.
    { from: "active", to: "matured", via: ref("BondMaturedV2") },
    { from: "active", to: "matured", via: ref("BondSoldV2") },
  ],
};
