// v2-core/fil-models/ir/bond/types/bond-type-definitions.ts
//
// Formal FilTypeDefinition registration for the Phase 3c FVTPL fixed-rate
// vanilla bond (asset class `ir`). Atomic (no legs).
//
// URN GRAMMAR NOTE. The W9-canonical FIL URN grammar (`v2-core/fil-core/urn.ts`)
// specialises the family path with DOTS, not extra colons — a type URN is exactly
// `fil:type:<asset-class>:<family-path>:<type-slug>@maj.min` with ONE family-path
// segment (dots allowed inside it) and ONE type-slug segment. The brief sketches
// the type as `fil:type:ir:bond:fixed-rate-vanilla@1.0`; that already fits the
// grammar (family-path `bond`, type-slug `fixed-rate-vanilla`), so we adopt it
// verbatim — consistent with the Phase 3b `ir` grouping (Charter cmd 6 — respect
// the type contract).
//
// Authority: D-V1-REMOVAL-PHASE-3C; D-ENGINEERING-INTEGRITY-CHARTER;
//   brief:atlas:v1-removal-phase-3c-bond-accounting-on-v2-fvtpl-:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

import { ATOMIC_COMPOSITION } from "../../../../fil-core/composition.ts";
import type { FilTypeDefinition } from "../../../../fil-core/type-definition.ts";
import type { FilTypeUrn } from "../../../../fil-core/urn.ts";
import { BOND_LIFECYCLE } from "./bond-lifecycles.ts";

// ---------------------------------------------------------------------------
// Fixed-rate vanilla bond — FVTPL; long (asset) or short (liability). ONE type,
// direction carried on the position. The one DISCOUNTING instrument in the batch.
// ---------------------------------------------------------------------------
export const BOND_FIXED_RATE_VANILLA_TYPE_URN =
  "fil:type:ir:bond:fixed-rate-vanilla@1.0" as FilTypeUrn;

export const BOND_FIXED_RATE_VANILLA_TYPE: FilTypeDefinition = {
  urn: BOND_FIXED_RATE_VANILLA_TYPE_URN,
  assetClass: "ir",
  familyPath: "bond",
  composition: ATOMIC_COMPOSITION,
  lifecycle: BOND_LIFECYCLE,
  implementsFacets: [
    "Lifecycled",
    "Valuable",
    "Performable",
    "RiskMeasurable",
    "RegulatoryClassifiable",
  ],
  minting: "kernel",
};

export const BOND_TYPE_DEFINITIONS_PHASE3C = [BOND_FIXED_RATE_VANILLA_TYPE] as const;
