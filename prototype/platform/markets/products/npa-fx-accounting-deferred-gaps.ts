// platform/markets/products/npa-fx-accounting-deferred-gaps.ts
//
// Records the FX-posting-completeness tracked deferred gaps (WS-ACCT-FX-
// COMPLETENESS Slice 3, D-ACCT-FX-IFRS-POSTING-COMPLETENESS) onto the
// `accounting` dimension of the FX product `prd:bank:fx:otc-vanilla`.
//
// WHY (Engineering Charter cmd 5 — no silent deferral)
// ----------------------------------------------------
// Slice 3 implemented + unit-tested the IFRS posting LOGIC for the five FX
// permutations the FIL fold cannot yet fire automatically (settlement realised-
// P&L, derecognition reversal, swap near/far legs, NDF fixing, FVOCI→P&L
// reclass) — because the FIL terminal/settlement events do not yet carry the
// economic terms those rules need. The TRIGGER-WIRING is genuinely deferred, so
// it must be a tracked `ProductDeferredGap`, not a silent omission.
//
// MECHANISM (latest-wins, idempotent — mirrors the conduct gap pattern)
// ---------------------------------------------------------------------
// Reads the latest `accounting` `ProductDimensionAttested` for the FX product
// from the store (Principle 1: the store is the source of truth) and re-emits it
// latest-wins with the FX_SETTLEMENT_DEFERRED_GAPS MERGED IN (existing gaps
// carried forward unchanged; gaps already present are not duplicated). If every
// gap is already recorded, or no accounting attestation exists yet, it is a
// no-op — so it is safe to run repeatedly and on a clean store.
//
// Run against the SHARED canonical store (do NOT set BANK_EVENT_DB):
//   bun run scripts/record-fx-accounting-deferred-gaps.ts
//
// Authority: D-ACCT-FX-IFRS-POSTING-COMPLETENESS (CEO-approved 2026-06-18);
//   D-ACCT-SCHEMA-CANONICAL-HOME; D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { FX_SETTLEMENT_DEFERRED_GAPS } from "../../../v2-core/posting-rules/fx-settlement";
import {
  type ProductDeferredGap,
  type ProductDimensionAttestedPayload,
  makeProductDimensionAttested,
} from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";

export const FX_ACCT_PRODUCT_ID = "prd:bank:fx:otc-vanilla";
export const FX_ACCT_DIMENSION = "accounting";
/** Stable as-of for this gap-recording (after the FX NPA restart 2026-06-17). */
export const FX_ACCT_GAPS_AS_OF = "2026-06-18T00:00:00.000Z";

const ACTOR: Actor = {
  type: "service",
  id: "agent:bea:npa-fx-accounting-deferred-gaps",
};

const CITATIONS = [
  "D-ACCT-FX-IFRS-POSTING-COMPLETENESS",
  "D-ACCT-SCHEMA-CANONICAL-HOME",
  "dimension:accounting",
];

export interface FxAcctGapsResult {
  readonly recorded: boolean;
  readonly skipped: boolean;
  readonly reason?: string;
}

/** The deferred gaps to record, as well-formed ProductDeferredGap payloads. */
export function fxAccountingDeferredGaps(): ProductDeferredGap[] {
  return FX_SETTLEMENT_DEFERRED_GAPS.map((g) => ({
    gapId: g.gapId,
    title: g.title,
    owner: g.owner,
    targetTrigger: g.targetTrigger,
    citations: [...g.citations],
  }));
}

/** Find the latest `accounting` ProductDimensionAttested for the FX product. */
function latestAccountingAttestation(
  store: EventStore,
): { payload: ProductDimensionAttestedPayload; asOf: string } | undefined {
  let latest: { payload: ProductDimensionAttestedPayload; asOf: string } | undefined;
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as ProductDimensionAttestedPayload;
    if (p.productId !== FX_ACCT_PRODUCT_ID || p.dimension !== FX_ACCT_DIMENSION) continue;
    if (latest === undefined || ev.as_of >= latest.asOf) latest = { payload: p, asOf: ev.as_of };
  }
  return latest;
}

/**
 * Record the FX-posting-completeness deferred gaps onto the FX accounting
 * dimension (latest-wins re-attestation). Idempotent + no-op-safe.
 */
export function recordFxAccountingDeferredGaps(store: EventStore): FxAcctGapsResult {
  const current = latestAccountingAttestation(store);
  if (current === undefined) {
    return {
      recorded: false,
      skipped: true,
      reason:
        "no accounting ProductDimensionAttested exists yet for the FX product — nothing to carry forward",
    };
  }

  const newGaps = fxAccountingDeferredGaps();
  const existing = current.payload.deferredGaps ?? [];
  const existingIds = new Set(existing.map((g) => g.gapId));
  const toAdd = newGaps.filter((g) => !existingIds.has(g.gapId));
  if (toAdd.length === 0) {
    return {
      recorded: false,
      skipped: true,
      reason: "all FX accounting deferred gaps already recorded",
    };
  }

  const mergedGaps: ProductDeferredGap[] = [...existing, ...toAdd];
  const payload: ProductDimensionAttestedPayload = {
    productId: FX_ACCT_PRODUCT_ID,
    dimension: FX_ACCT_DIMENSION,
    // Carry the current result forward unchanged — adding tracked deferred gaps
    // never changes the attestation verdict (they are non-blocking).
    result: current.payload.result,
    citationChain: [...current.payload.citationChain],
    deferredGaps: mergedGaps,
  };

  store.append({
    ...makeProductDimensionAttested({
      asOf: FX_ACCT_GAPS_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload,
    }),
    provenance: buildPhaseFixtureTag({
      sourceLineage: "platform:npa-fx-accounting-deferred-gaps",
      variant: `npa-dimension-deferred-gaps:${FX_ACCT_PRODUCT_ID}:accounting:fx-posting-completeness`,
      tags: ["npa-gate", "deferred-gap", "accounting", FX_ACCT_PRODUCT_ID],
    }),
  });

  return { recorded: true, skipped: false };
}
