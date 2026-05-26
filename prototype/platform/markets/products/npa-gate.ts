// platform/markets/products/npa-gate.ts
//
// NPA gate validator — checks that all 14 NPA dimensions are attested
// before a product may advance to controlled-launch or live.
//
// Pure function; no event side-effects.
// Authority: D-NEW-PRODUCT-APPROVAL-POLICY · D-PRODUCT-CONSTRUCTION-SUBSTRATE.
// Author: Atlas (substrate authority).

import type { ProductRegisterRow } from "../../projections/products/product-register";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface NpaGateResult {
  readonly ready: boolean;
  readonly missing: readonly string[];
}

// ---------------------------------------------------------------------------
// Gate validator
// ---------------------------------------------------------------------------

/**
 * Validates that a product has attested all 14 NPA dimensions.
 *
 * `missing` is the list of dimensions not yet present in
 * `row.attestedDimensions` (pre-computed by the projection as
 * `row.pendingDimensions`).  `ready` is true iff missing is empty.
 *
 * The gate is stage-agnostic: callers (the recon pipeline, the dashboard)
 * decide which lifecycle stages to enforce. This function is a pure query
 * over the projection row.
 */
export function validateNpaGate(row: ProductRegisterRow): NpaGateResult {
  const missing = row.pendingDimensions;
  return {
    ready: missing.length === 0,
    missing,
  };
}
