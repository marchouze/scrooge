// platform/markets/products/npa-gate.ts
//
// NPA gate validator — checks that all 14 NPA dimensions are attested
// before a product may advance to controlled-launch or live.
//
// Policy: D-NPA-GATE-POLICY-REDESIGN (CEO 2026-06-15)
//   - implementation-attested → always passes
//   - design-attested WITH at least one tracked deferred gap
//     (ProductDeferredGap with owner + targetTrigger + citations) → passes
//     with condition recorded in openConditions
//   - design-attested with NO deferred gaps → BLOCKED; listed in missing
//   - failed → always fails; listed in missing
//
// Pure function; no event side-effects.
// Authority: D-NPA-GATE-POLICY-REDESIGN · D-NEW-PRODUCT-APPROVAL-POLICY
//            · D-PRODUCT-CONSTRUCTION-SUBSTRATE.
// Author: Owen (Company Secretary, governance).

import type { ProductRegisterRow } from "../../projections/products/product-register";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface NpaGateResult {
  readonly ready: boolean;
  /**
   * Dimensions that block approval:
   *   - not yet attested (pending),
   *   - design-attested with no tracked deferred gaps, or
   *   - failed.
   */
  readonly missing: readonly string[];
  /**
   * Dimensions that are design-attested with at least one tracked deferred gap.
   * These are ALLOWED but flagged — the gate passes with conditions.
   * Each entry is a string of the form "<dim> (N condition(s))".
   */
  readonly openConditions: readonly string[];
}

// ---------------------------------------------------------------------------
// Gate validator
// ---------------------------------------------------------------------------

/**
 * Validates that a product satisfies the NPA gate under
 * D-NPA-GATE-POLICY-REDESIGN (CEO 2026-06-15).
 *
 * Rules per dimension:
 *   - implementation-attested → passes unconditionally
 *   - design-attested with ≥1 deferredGaps entry → passes with a condition
 *     (listed in openConditions)
 *   - design-attested with 0 deferredGaps → BLOCKED (listed in missing)
 *   - failed → BLOCKED (listed in missing)
 *   - not yet attested (still in pendingDimensions) → BLOCKED (listed in missing)
 *
 * `ready` is true iff missing is empty (openConditions may be non-empty).
 */
export function validateNpaGate(row: ProductRegisterRow): NpaGateResult {
  const missing: string[] = [];
  const openConditions: string[] = [];

  // 1. Dimensions not yet attested at all.
  for (const dim of row.pendingDimensions) {
    missing.push(dim);
  }

  // 2. Dimensions that are attested — apply the policy rules.
  for (const [dim, record] of row.attestedDimensions) {
    if (record.result === "implementation-attested") {
      // Always passes — no action needed.
    } else if (record.result === "design-attested") {
      if (record.deferredGaps.length > 0) {
        // Passes with condition.
        openConditions.push(`${dim} (${record.deferredGaps.length} condition(s))`);
      } else {
        // No tracked deferred gaps → blocked.
        missing.push(dim);
      }
    } else {
      // result === "failed" → blocked.
      missing.push(dim);
    }
  }

  return {
    ready: missing.length === 0,
    missing,
    openConditions,
  };
}
