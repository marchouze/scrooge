// v2-core/control-plane/tenant.ts
//
// Tenant axis for the v2 event envelope (V2 S2).
//
// S2 SCOPE: the tenant constant + the dark-mode predicate. Nothing here is
// ENFORCED — routing, isolation gates, and the control-plane store all land in
// later slices (S3 onward). The anchor-tenant constant and the predicate exist
// now so every upstream envelope-aware piece of code can reference the same
// shared symbol and so `recon:v2-tenant-axis-present` has a real type to assert
// against.
//
// DARK-MODE CONTRACT
// ------------------
// `isAnchorTenantEvent(envelope)` returns `true` for the seed tenant that owns
// the v1 code-line. In production all existing v1 events route to this tenant;
// a multi-tenant routing layer evaluating this predicate is a later wave
// deliverable. The predicate is already callable in S2 so call-sites can be
// written in a tenant-aware style (they won't be enforced until routing lands).
//
// Authority: D-V2-TENANCY-ARCHITECTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

// ---------------------------------------------------------------------------
// Anchor-tenant constant
// ---------------------------------------------------------------------------

/**
 * The identifier of the anchor tenant — the SA bank entity (LE-ZA-HOZ-BANK)
 * that seeds the v2 code-line and owns all existing v1-sourced events.
 *
 * Format matches the v2 `fil:inst:` tenant segment (W9 §3.1): lowercase-kebab
 * qualified string prefixed with `"tenant:"`. External routing configuration
 * may carry a different presentation layer identifier; the event-envelope
 * value is always this canonical form.
 *
 * Authority: D-V2-TENANCY-ARCHITECTURE.
 */
export const ANCHOR_TENANT_ID = "tenant:za-bank" as const;

export type AnchorTenantId = typeof ANCHOR_TENANT_ID;

// ---------------------------------------------------------------------------
// TenantId branded type
// ---------------------------------------------------------------------------

/**
 * A branded string for a validated tenant identifier. The v2 envelope carries
 * this type rather than a bare string so TypeScript enforces that tenant IDs
 * flow through the `tenantIdSchema` parse path.
 */
export type TenantId = string & { readonly __brand: "fil.TenantId" };

export const tenantIdSchema = z
  .string()
  .min(1)
  .refine((s) => s.startsWith("tenant:"), {
    message: 'tenant ID must be prefixed with "tenant:" (e.g. "tenant:za-bank")',
  })
  .transform((s) => s as TenantId);

// ---------------------------------------------------------------------------
// Dark-mode predicate
// ---------------------------------------------------------------------------

/**
 * Returns `true` iff the envelope's `tenantId` matches the anchor tenant.
 *
 * This is a **dark-mode predicate** (V2 S2): it is callable and correct, but
 * NOT yet used for routing or isolation enforcement. Call-sites should be
 * written in a tenant-aware style now so the routing layer (S3+) only needs
 * to flip the enforcement gate rather than retrofit call-sites.
 *
 * @param tenantId - the tenant ID from the envelope under inspection
 */
export function isAnchorTenantEvent(tenantId: TenantId): boolean {
  return tenantId === ANCHOR_TENANT_ID;
}
