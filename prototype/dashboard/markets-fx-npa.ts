// dashboard/markets-fx-npa.ts
//
// Read-side projection over the Product NPA lifecycle event family. Folds
// `ProductApproved` and `ProductWithheld` keyed on `productId` (latest
// timestamp wins), then surfaces a fixed 4-row view — one row per FX product
// code — with a `"pending"` status for any product that has no NPA event yet.
//
// Surface: GET /api/markets/fx/products/attestation (wired in server.ts).
// Consumed by `dashboard/public/markets/fx/desk.html` Slice 7 NPA badge strip.
//
// Authority chain (Principle 2 upward):
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10) Slice 7.
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2 (CEO-approved 2026-05-10):
//     ProductApproved / ProductWithheld event types.
//
// Product lifecycle design note (from memory: project_product_lifecycle_npa_vs_engineering.md):
//   NPA is a pre-go-live gate, not a pre-build gate. In the build phase all
//   four FX products are expected to be in `"pending"` status until NPA
//   approval events are emitted at go-live readiness. The badge strip is
//   informational v1; gating v2 lands after licence-day.
//
// Author: Kai (Trading systems engineer, engineering — reports to Saskia,
//         Head of Global Markets) · Saskia (Head of Global Markets, governance).

import type { EventStore } from "../platform/event-store/store";

export type NpaStatus = "approved" | "withheld" | "pending";

export interface NpaAttestation {
  productCode: string;
  status: NpaStatus;
  approvedAt?: string;
  withheldAt?: string;
  withheldReason?: string;
}

export interface NpaView {
  /** Always exactly 4 rows — one per FX product code. */
  attestations: NpaAttestation[];
  /** ISO-8601 wall-clock at projection time. */
  asOf: string;
}

/** The four FX product codes from the FX CDM `productTaxonomy` discriminator
 *  (`platform/markets/cdm/fx.ts`). Must stay in sync with that enum. */
export const FX_PRODUCT_CODES = ["FX-spot", "FX-forward", "FX-swap", "FX-NDF"] as const;
export type FxProductCode = (typeof FX_PRODUCT_CODES)[number];

/**
 * Build the NPA attestation view from the event store.
 *
 * Projection logic:
 *   - Replay all events; filter to `ProductApproved` and `ProductWithheld`.
 *   - For each event, read `payload.productId` as the product code key.
 *   - Latest-wins by `as_of` timestamp (ISO-8601 string comparison is
 *     monotone for well-formed UTC strings).
 *   - For each of the 4 FX product codes, emit the current status row.
 *     Products with no NPA event → `{ productCode, status: "pending" }`.
 */
export function buildNpaView(
  store: Pick<EventStore, "replay">,
  nowIso: string = new Date().toISOString(),
): NpaView {
  type Fold = {
    status: NpaStatus;
    timestamp: string;
    withheldReason?: string;
  };

  const byProduct = new Map<string, Fold>();

  for (const ev of store.replay()) {
    if (ev.type !== "ProductApproved" && ev.type !== "ProductWithheld") continue;

    const payload = ev.payload as Record<string, unknown>;
    const productId = String(payload.productId ?? "");
    if (!productId) continue;

    const timestamp = ev.as_of;

    const existing = byProduct.get(productId);
    // Latest-wins by as_of string (ISO-8601 lexicographic comparison is safe).
    if (existing && existing.timestamp >= timestamp) continue;

    if (ev.type === "ProductApproved") {
      byProduct.set(productId, { status: "approved", timestamp });
    } else {
      // ProductWithheld — capture the reason field.
      const reason = typeof payload.reason === "string" ? payload.reason : undefined;
      byProduct.set(productId, { status: "withheld", timestamp, withheldReason: reason });
    }
  }

  const attestations: NpaAttestation[] = FX_PRODUCT_CODES.map((code) => {
    const fold = byProduct.get(code);
    if (!fold) {
      return { productCode: code, status: "pending" };
    }
    if (fold.status === "approved") {
      return { productCode: code, status: "approved", approvedAt: fold.timestamp };
    }
    // withheld
    const row: NpaAttestation = {
      productCode: code,
      status: "withheld",
      withheldAt: fold.timestamp,
    };
    if (fold.withheldReason) row.withheldReason = fold.withheldReason;
    return row;
  });

  return { attestations, asOf: nowIso };
}
