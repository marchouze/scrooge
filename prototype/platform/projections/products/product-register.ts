// platform/projections/products/product-register.ts
//
// Product Register projection — folds the 12 product-lifecycle event
// types into a per-product register row that tracks lifecycle stage,
// version, attested dimensions, and pending NPA dimensions.
//
// Principle 1: projection is a derivation over the event log; never
// authoritative state.
// Principle 2: every row traces to D-PRODUCT-CONSTRUCTION-SUBSTRATE
// (CEO-approved 2026-05-10) + D-NEW-PRODUCT-APPROVAL-POLICY
// (CEO-approved 2026-05-10).
// Principle 6: NPA gate enforcement is a projection-derived query,
// not a gated mutation.
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2 (event family registration)
//   - D-NEW-PRODUCT-APPROVAL-POLICY §5 (14 NPA dimensions)
//
// Author: Atlas (substrate authority)

import type {
  ProductDeferredGap,
  ProductScopeForEvent,
} from "../../event-store/event-types/product";
import type { Event } from "../../event-store/types";
import { PRODUCT_DIMENSION_VALUES } from "../../markets/products/semantic";
import type { ProductFamily, ProductLifecycleStage } from "../../markets/products/types";

// Re-export for convenience of callers that only import from this module.
export type { ProductFamily, ProductLifecycleStage };

// Re-export for gate callers.
export type { ProductDeferredGap };

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/**
 * Per-dimension attestation record held in the register row.
 * Tracks both the attestation result and any tracked deferred gaps
 * (D-NPA-GATE-POLICY-REDESIGN).
 */
export interface AttestationRecord {
  result: "design-attested" | "implementation-attested" | "failed";
  /** Tracked deferred gaps — present on design-attested dimensions. */
  deferredGaps: ProductDeferredGap[];
}

export interface ProductRegisterRow {
  productId: string;
  family: ProductFamily;
  version: string;
  lifecycleStage: ProductLifecycleStage;
  /**
   * Map from dimension key to its most-recent AttestationRecord.
   * A dimension is "attested" (cleared from pendingDimensions) as soon as it
   * appears here, regardless of result.
   */
  attestedDimensions: Map<string, AttestationRecord>;
  /** All 14 NPA dimensions not yet in attestedDimensions. */
  pendingDimensions: string[];
  /** Latest citations from the most-recent lifecycle event for this product. */
  citations: string[];
  /** Typed product scope, if the proposal/approval carried one (D-FX-OTC-NPA-SCOPE-EXPANSION). */
  scope?: ProductScopeForEvent;
  /** ISO 8601 as_of of the last event that modified this row. */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// All 14 NPA dimension keys — sourced from PRODUCT_DIMENSION_VALUES in
// semantic.ts (the canonical single-source per feedback_canonical_source_registry.md).
// ---------------------------------------------------------------------------

export const ALL_NPA_DIMENSION_KEYS: readonly string[] = PRODUCT_DIMENSION_VALUES.map(
  (d) => d.value,
);

// ---------------------------------------------------------------------------
// Projection fold
// ---------------------------------------------------------------------------

/**
 * Folds a sequence of product-lifecycle events into a register map.
 * Last-matching event wins per product per field (append-only audit rule
 * per D-PRODUCT-CONSTRUCTION-SUBSTRATE §4).
 */
export function buildProductRegisterView(events: Event[]): Map<string, ProductRegisterRow> {
  const register = new Map<string, ProductRegisterRow>();

  for (const ev of events) {
    const p = ev.payload as Record<string, unknown>;
    if (typeof p.productId !== "string" || p.productId === "") continue;
    const productId: string = p.productId;

    // Helper: get or create a mutable draft row.
    function row(): ProductRegisterRow {
      let r = register.get(productId);
      if (!r) {
        r = {
          productId,
          family: "fx", // placeholder until ProductConceptualised arrives
          version: "0.0.0",
          lifecycleStage: "proposed",
          attestedDimensions: new Map(),
          pendingDimensions: [...ALL_NPA_DIMENSION_KEYS],
          citations: ev.citations,
          updatedAt: ev.as_of,
        };
        register.set(productId, r);
      }
      return r;
    }

    switch (ev.type) {
      case "ProductProposalRegistered": {
        const r = row();
        // family is on the proposal payload
        if (typeof p.family === "string") {
          r.family = p.family as ProductFamily;
        }
        if (p.scope && typeof p.scope === "object") {
          r.scope = p.scope as ProductScopeForEvent;
        }
        r.lifecycleStage = "proposed";
        r.citations = ev.citations;
        r.updatedAt = ev.as_of;
        break;
      }

      case "ProductConceptualised": {
        const r = row();
        if (typeof p.version === "string") r.version = p.version;
        r.lifecycleStage = "conceptualised";
        r.citations = ev.citations;
        r.updatedAt = ev.as_of;
        break;
      }

      case "ProductDueDiligenceCompleted": {
        const r = row();
        r.lifecycleStage = "due-diligence";
        r.citations = ev.citations;
        r.updatedAt = ev.as_of;
        break;
      }

      case "ProductDueDiligenceWithheld": {
        const r = row();
        r.lifecycleStage = "under-review";
        r.citations = ev.citations;
        r.updatedAt = ev.as_of;
        break;
      }

      case "ProductApproved": {
        const r = row();
        if (typeof p.version === "string") r.version = p.version;
        if (p.scope && typeof p.scope === "object") {
          r.scope = p.scope as ProductScopeForEvent;
        }
        r.lifecycleStage = "approved-conditional";
        r.citations = ev.citations;
        r.updatedAt = ev.as_of;
        break;
      }

      case "ProductWithheld": {
        const r = row();
        if (typeof p.version === "string") r.version = p.version;
        r.lifecycleStage = "under-review";
        r.citations = ev.citations;
        r.updatedAt = ev.as_of;
        break;
      }

      case "ProductLaunched": {
        const r = row();
        if (typeof p.version === "string") r.version = p.version;
        r.lifecycleStage = "controlled-launch";
        r.citations = ev.citations;
        r.updatedAt = ev.as_of;
        break;
      }

      case "ProductPostImplementationReviewCompleted": {
        const r = row();
        r.lifecycleStage = "live";
        r.citations = ev.citations;
        r.updatedAt = ev.as_of;
        break;
      }

      case "ProductReviewCompleted": {
        // No lifecycle stage change. Update citations + timestamp only.
        const r = row();
        r.citations = ev.citations;
        r.updatedAt = ev.as_of;
        break;
      }

      case "ProductRetired": {
        const r = row();
        r.lifecycleStage = "retired";
        r.citations = ev.citations;
        r.updatedAt = ev.as_of;
        break;
      }

      case "ProductVersionPublished": {
        // Update version field only.
        const r = row();
        if (typeof p.newVersion === "string") r.version = p.newVersion;
        r.citations = ev.citations;
        r.updatedAt = ev.as_of;
        break;
      }

      case "ProductDimensionAttested": {
        const r = row();
        if (typeof p.dimension === "string") {
          const result =
            p.result === "implementation-attested" || p.result === "failed"
              ? (p.result as AttestationRecord["result"])
              : "design-attested";
          const rawGaps = Array.isArray(p.deferredGaps) ? p.deferredGaps : [];
          const deferredGaps: ProductDeferredGap[] = rawGaps.filter(
            (g): g is ProductDeferredGap =>
              g !== null &&
              typeof g === "object" &&
              typeof (g as Record<string, unknown>).title === "string" &&
              typeof (g as Record<string, unknown>).owner === "string" &&
              typeof (g as Record<string, unknown>).targetTrigger === "string" &&
              Array.isArray((g as Record<string, unknown>).citations),
          );
          r.attestedDimensions.set(p.dimension, { result, deferredGaps });
        }
        r.updatedAt = ev.as_of;
        break;
      }

      default:
        // Non-product-lifecycle event — skip.
        break;
    }
  }

  // Compute pendingDimensions for every row once the fold is complete.
  for (const row of register.values()) {
    row.pendingDimensions = ALL_NPA_DIMENSION_KEYS.filter((d) => !row.attestedDimensions.has(d));
  }


  return register;
}
