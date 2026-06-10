// dashboard/markets-fx-npa.ts
//
// Read-side projection over the Product NPA lifecycle event family, re-pointed
// onto the umbrella OTC vanilla FX product (`prd:bank:fx:otc-vanilla`) and its
// typed `scope` (D-FX-OTC-NPA-SCOPE-EXPANSION). Surfaces one badge row per FX
// instrument variant, deriving each row's status from the umbrella product's
// latest ProductApproved / ProductWithheld event and whether that variant is in
// the approved instrument scope:
//   - variant ∈ umbrella scope + umbrella approved  → "approved"
//   - variant ∈ umbrella scope + umbrella withheld  → "withheld"
//   - variant ∉ umbrella scope (e.g. option, M5)    → "pending"
//   - no umbrella approval yet                       → "pending"
//
// (Prior to this re-point the projection was a fixed 4-row view keyed on the
// literal product codes "FX-spot"/.../"FX-NDF", which never matched the real
// approval events — those key on the `prd:bank:fx:*` productId. The umbrella
// product is the single canonical FX product per the scope expansion.)
//
// Surface: GET /api/markets/fx/products/attestation (wired in server.ts).
// Consumed by `dashboard/public/markets/fx/desk.html` Slice 7 NPA badge strip.
//
// Authority chain (Principle 2 upward):
//   - D-FX-OTC-NPA-SCOPE-EXPANSION (CEO session-delegation 2026-06-10).
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10) Slice 7.
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2 (CEO-approved 2026-05-10).
//
// Author: Scrooge-coordinated session for marc@tgv.co.za · Saskia (Head of
//         Global Markets, governance).

import { nowUtc } from "../platform/core/types";
import type { ProductScopeForEvent } from "../platform/event-store/event-types/product";
import type { EventStore } from "../platform/event-store/store";

export type NpaStatus = "approved" | "withheld" | "pending";

export interface NpaAttestation {
  productCode: string;
  status: NpaStatus;
  approvedAt?: string;
  withheldAt?: string;
  withheldReason?: string;
  /** True when the variant is outside the umbrella's approved scope (e.g. option = M5). */
  outOfScope?: boolean;
}

export interface NpaView {
  /** One row per FX instrument variant (spot, forward, swap, option). */
  attestations: NpaAttestation[];
  /** ISO-8601 wall-clock at projection time. */
  asOf: string;
}

/** The umbrella OTC vanilla FX product — single canonical FX product. */
export const UMBRELLA_FX_PRODUCT_ID = "prd:bank:fx:otc-vanilla";

/** Display rows: FX instrument variant ↔ product code. Variant strings match
 *  `productScopeSchema.fxInstrumentVariants`; codes match the FX CDM taxonomy
 *  display convention. */
export const FX_INSTRUMENT_ROWS = [
  { variant: "spot", code: "FX-spot" },
  { variant: "forward", code: "FX-forward" },
  { variant: "swap", code: "FX-swap" },
  { variant: "option", code: "FX-option" },
] as const;

export const FX_PRODUCT_CODES = FX_INSTRUMENT_ROWS.map((r) => r.code) as readonly string[];
export type FxProductCode = (typeof FX_INSTRUMENT_ROWS)[number]["code"];

/**
 * Build the NPA attestation view from the event store, derived from the
 * umbrella OTC vanilla FX product.
 */
export function buildNpaView(
  store: Pick<EventStore, "replay">,
  nowIso: string = nowUtc(),
): NpaView {
  type Fold = {
    status: Exclude<NpaStatus, "pending">;
    timestamp: string;
    scope?: ProductScopeForEvent;
    withheldReason?: string | undefined;
  };

  let umbrella: Fold | undefined;

  for (const ev of store.replay()) {
    if (ev.type !== "ProductApproved" && ev.type !== "ProductWithheld") continue;
    const payload = ev.payload as Record<string, unknown>;
    if (String(payload.productId ?? "") !== UMBRELLA_FX_PRODUCT_ID) continue;

    const timestamp = ev.as_of;
    // Latest-wins by as_of (ISO-8601 lexicographic comparison is monotone).
    if (umbrella && umbrella.timestamp >= timestamp) continue;

    const scope =
      payload.scope && typeof payload.scope === "object"
        ? (payload.scope as ProductScopeForEvent)
        : undefined;

    if (ev.type === "ProductApproved") {
      umbrella = { status: "approved", timestamp, ...(scope ? { scope } : {}) };
    } else {
      const reason = typeof payload.reason === "string" ? payload.reason : undefined;
      umbrella = {
        status: "withheld",
        timestamp,
        ...(scope ? { scope } : {}),
        ...(reason !== undefined ? { withheldReason: reason } : {}),
      };
    }
  }

  // When the umbrella approval carries no typed scope, fall back to the v1.0
  // approved instrument set (spot/forward/swap); option stays out of scope.
  const inScopeVariants = new Set<string>(
    umbrella?.scope?.fxInstrumentVariants ?? ["spot", "forward", "swap"],
  );

  const attestations: NpaAttestation[] = FX_INSTRUMENT_ROWS.map(({ variant, code }) => {
    const variantInScope = inScopeVariants.has(variant);

    if (!umbrella || !variantInScope) {
      // No approval yet, or variant outside approved scope (e.g. option = M5).
      return {
        productCode: code,
        status: "pending",
        ...(umbrella && !variantInScope ? { outOfScope: true } : {}),
      };
    }

    if (umbrella.status === "approved") {
      return { productCode: code, status: "approved", approvedAt: umbrella.timestamp };
    }
    const row: NpaAttestation = {
      productCode: code,
      status: "withheld",
      withheldAt: umbrella.timestamp,
    };
    if (umbrella.withheldReason) row.withheldReason = umbrella.withheldReason;
    return row;
  });

  return { attestations, asOf: nowIso };
}
