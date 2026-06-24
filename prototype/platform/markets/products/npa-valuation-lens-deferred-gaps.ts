// platform/markets/products/npa-valuation-lens-deferred-gaps.ts
//
// Records the FIVE-DOMAIN valuation-lens tracked deferred gaps
// (D-V2-UI-OVERSIGHT-STANDARD / D-NPA-PAGE-DE-INVENTION) onto the relevant NPA
// dimensions of the FX product `prd:bank:fx:otc-vanilla`. Two domains of the
// valuation/reporting map have no live measure and so MUST be surfaced as
// tracked deferrals, never a bare "planned":
//
//   - Liquidity Risk    → `liquidity-risk` dimension  (no LCR/NSFR projection)
//   - Product Control   → `market-risk` dimension     (no realised-P&L attribution)
//
// WHY (Engineering Charter cmd 5 — no silent deferral)
// ----------------------------------------------------
// The NPA page renders these two domains `planned-with-gap` / `partial`; that
// status is sourced from the in-code inventory `VALUATION_LENS_DEFERRED_GAPS`
// so the de-invention gate sees it against an empty store. This recorder is the
// EVENTS-FIRST mirror (Principle 1): it re-emits the relevant dimension's latest
// `ProductDimensionAttested` with the gap MERGED IN (latest-wins, append-only),
// so the canonical store carries the same tracked deferral the page renders. The
// recorder reads the SAME constant the page reads — they can never drift.
//
// MECHANISM (idempotent, no-op-safe — mirrors npa-fx-accounting-deferred-gaps.ts)
// -------------------------------------------------------------------------------
// For each (dimension, gap), reads the latest `ProductDimensionAttested` for the
// FX product on that dimension and re-emits it with the gap appended if absent.
// If the gap is already present, or no attestation exists yet for the dimension,
// that gap is skipped. Safe to run repeatedly and on a clean store.
//
// Run against the SHARED canonical store (do NOT set BANK_EVENT_DB):
//   bun run scripts/record-npa-valuation-lens-gaps.ts
//
// Authority: D-V2-UI-OVERSIGHT-STANDARD; D-NPA-PAGE-DE-INVENTION (CEO-approved
//   2026-06-23); D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Author: Atlas (Core banking platform architect, engineering).

import {
  type ValuationLensDeferredGap,
  activeValuationLensGaps,
} from "../../../v2-core/reporting-treatments/valuation-lens-gaps";
import {
  type ProductDeferredGap,
  type ProductDimensionAttestedPayload,
  makeProductDimensionAttested,
} from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";

export const VAL_LENS_PRODUCT_ID = "prd:bank:fx:otc-vanilla";
export const VAL_LENS_PRODUCT_FAMILY = "fx";
/** Stable as-of for this gap-recording. */
export const VAL_LENS_GAPS_AS_OF = "2026-06-24T00:00:00.000Z";

const ACTOR: Actor = {
  type: "service",
  id: "agent:atlas:npa-valuation-lens-deferred-gaps",
};

export interface ValLensGapResult {
  /** Per-gap outcomes: which dimension, gapId, and whether it was recorded or skipped. */
  readonly outcomes: readonly {
    readonly dimension: string;
    readonly gapId: string;
    readonly recorded: boolean;
    readonly reason?: string;
  }[];
  readonly recordedCount: number;
}

/** Find the latest ProductDimensionAttested for the FX product on a dimension. */
function latestAttestation(
  store: EventStore,
  dimension: string,
): { payload: ProductDimensionAttestedPayload; asOf: string } | undefined {
  let latest: { payload: ProductDimensionAttestedPayload; asOf: string } | undefined;
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as ProductDimensionAttestedPayload;
    if (p.productId !== VAL_LENS_PRODUCT_ID || p.dimension !== dimension) continue;
    if (latest === undefined || ev.as_of >= latest.asOf) latest = { payload: p, asOf: ev.as_of };
  }
  return latest;
}

/** Convert an in-code valuation-lens gap to a well-formed ProductDeferredGap payload. */
function toProductDeferredGap(g: ValuationLensDeferredGap): ProductDeferredGap {
  return {
    gapId: g.gapId,
    title: g.title,
    owner: g.owner,
    targetTrigger: g.targetTrigger,
    citations: [...g.citations],
  };
}

/**
 * Record the five-domain valuation-lens deferred gaps onto their NPA dimensions
 * (latest-wins re-attestation). Idempotent + no-op-safe.
 */
export function recordValuationLensDeferredGaps(store: EventStore): ValLensGapResult {
  const gaps = activeValuationLensGaps(VAL_LENS_PRODUCT_FAMILY);
  const outcomes: {
    dimension: string;
    gapId: string;
    recorded: boolean;
    reason?: string;
  }[] = [];
  let recordedCount = 0;

  for (const gap of gaps) {
    const current = latestAttestation(store, gap.dimension);
    if (current === undefined) {
      outcomes.push({
        dimension: gap.dimension,
        gapId: gap.gapId,
        recorded: false,
        reason: `no ${gap.dimension} ProductDimensionAttested exists yet for the FX product — nothing to carry forward`,
      });
      continue;
    }
    const existing = current.payload.deferredGaps ?? [];
    if (existing.some((g) => g.gapId === gap.gapId)) {
      outcomes.push({
        dimension: gap.dimension,
        gapId: gap.gapId,
        recorded: false,
        reason: "already recorded",
      });
      continue;
    }

    const mergedGaps: ProductDeferredGap[] = [...existing, toProductDeferredGap(gap)];
    const payload: ProductDimensionAttestedPayload = {
      productId: VAL_LENS_PRODUCT_ID,
      dimension: gap.dimension,
      // The verdict is unchanged — a tracked non-blocking deferral never alters it.
      result: current.payload.result,
      citationChain: [...current.payload.citationChain],
      deferredGaps: mergedGaps,
    };

    store.append({
      ...makeProductDimensionAttested({
        asOf: VAL_LENS_GAPS_AS_OF,
        entity: "LE-ZA-HOZ-BANK",
        actor: ACTOR,
        citations: [
          "D-V2-UI-OVERSIGHT-STANDARD",
          "D-NPA-PAGE-DE-INVENTION",
          `dimension:${gap.dimension}`,
          `valuation-domain:${gap.domain}`,
        ],
        payload,
      }),
      provenance: buildPhaseFixtureTag({
        sourceLineage: "platform:npa-valuation-lens-deferred-gaps",
        variant: `npa-dimension-deferred-gaps:${VAL_LENS_PRODUCT_ID}:${gap.dimension}:valuation-lens`,
        tags: ["npa-gate", "deferred-gap", gap.dimension, VAL_LENS_PRODUCT_ID],
      }),
    });

    recordedCount++;
    outcomes.push({ dimension: gap.dimension, gapId: gap.gapId, recorded: true });
  }

  return { outcomes, recordedCount };
}
