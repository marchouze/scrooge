// v2-core/fil-models/fx/types/fx-type-definitions.ts
//
// Formal FilTypeDefinition registrations for Phase 1 OTC FX instruments.
// Spot, forward, and NDF are atomic (no legs). Swap uses FilComposition.legs
// (near + far), both typed as forward — same algebra IRD (fixed+float) uses.
//
// Authority: D-ENGINEERING-INTEGRITY-CHARTER; brief:atlas:fil-fx-language-phase-1-linear-otc-models:2026-06-15
// Author: Atlas (Core banking platform architect, engineering).

import { ATOMIC_COMPOSITION } from "../../../fil-core/composition.ts";
import type { FilTypeDefinition } from "../../../fil-core/type-definition.ts";
import type { FilTypeUrn } from "../../../fil-core/urn.ts";
import {
  FX_FORWARD_LIFECYCLE,
  FX_NDF_LIFECYCLE,
  FX_SPOT_LIFECYCLE,
  FX_SWAP_LIFECYCLE,
} from "./fx-lifecycles.ts";

// ---------------------------------------------------------------------------
// Spot — atomic (no legs)
// ---------------------------------------------------------------------------
export const FX_SPOT_TYPE: FilTypeDefinition = {
  urn: "fil:type:fx:spot:otc-vanilla@1.0" as FilTypeUrn,
  assetClass: "fx",
  familyPath: "spot",
  composition: ATOMIC_COMPOSITION,
  lifecycle: FX_SPOT_LIFECYCLE,
  implementsFacets: ["Lifecycled", "Valuable", "RiskMeasurable", "Performable"],
  minting: "kernel",
};

// ---------------------------------------------------------------------------
// Forward — atomic
// ---------------------------------------------------------------------------
export const FX_FORWARD_TYPE: FilTypeDefinition = {
  urn: "fil:type:fx:forward:outright@1.0" as FilTypeUrn,
  assetClass: "fx",
  familyPath: "forward",
  composition: ATOMIC_COMPOSITION,
  lifecycle: FX_FORWARD_LIFECYCLE,
  implementsFacets: ["Lifecycled", "Valuable", "RiskMeasurable", "Performable"],
  minting: "kernel",
};

// ---------------------------------------------------------------------------
// Swap — two legs (near + far), both typed as forward
// ---------------------------------------------------------------------------
export const FX_SWAP_TYPE: FilTypeDefinition = {
  urn: "fil:type:fx:swap:vanilla@1.0" as FilTypeUrn,
  assetClass: "fx",
  familyPath: "swap",
  composition: {
    legs: [
      {
        legId: "near",
        legType: "fil:type:fx:forward:outright@1.0" as FilTypeUrn,
        direction: "receive",
      },
      {
        legId: "far",
        legType: "fil:type:fx:forward:outright@1.0" as FilTypeUrn,
        direction: "pay",
      },
    ],
    components: [],
    wrappers: [],
  },
  lifecycle: FX_SWAP_LIFECYCLE,
  implementsFacets: ["Lifecycled", "Valuable", "RiskMeasurable", "Performable"],
  minting: "kernel",
};

// ---------------------------------------------------------------------------
// NDF — atomic, cash-settled in settlement currency
// ---------------------------------------------------------------------------
export const FX_NDF_TYPE: FilTypeDefinition = {
  urn: "fil:type:fx:ndf:vanilla@1.0" as FilTypeUrn,
  assetClass: "fx",
  familyPath: "ndf",
  composition: ATOMIC_COMPOSITION,
  lifecycle: FX_NDF_LIFECYCLE,
  implementsFacets: ["Lifecycled", "Valuable", "RiskMeasurable", "Performable"],
  minting: "kernel",
};

export const FX_TYPE_DEFINITIONS_PHASE1 = [
  FX_SPOT_TYPE,
  FX_FORWARD_TYPE,
  FX_SWAP_TYPE,
  FX_NDF_TYPE,
] as const;
