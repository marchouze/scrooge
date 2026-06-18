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

import {
  FX_SETTLEMENT_DEFERRED_GAPS,
  activeFxSettlementDeferredGaps,
} from "../../../v2-core/posting-rules/fx-settlement";
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

/**
 * The deferred gaps to record, as well-formed ProductDeferredGap payloads. Only
 * STILL-OPEN gaps are recorded — gaps WS-FIL-FX-SETTLEMENT-EVENTS resolved are
 * dropped from the attestation by `runFxAccountingGapClosure` (append-only
 * re-emit), so re-running this recorder must not re-introduce them.
 */
export function fxAccountingDeferredGaps(): ProductDeferredGap[] {
  return activeFxSettlementDeferredGaps().map((g) => ({
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

// ---------------------------------------------------------------------------
// Append-only gap CLOSURE — WS-FIL-FX-SETTLEMENT-EVENTS.
//
// Resolves the FX-posting-completeness gaps now that the FIL FX settlement event
// family fires every rule at fold time (D-FIL-FX-SETTLEMENT-EVENTS). Mirrors the
// established infosec closure pattern (npa-fx-infosec-gap-closure.ts): re-emit
// the LATEST FX accounting attestation with the RESOLVED gaps removed and every
// other (still-open) gap carried VERBATIM, at a later as_of so latest-wins folds
// pick up the closure. The original gap-recording events stay in the log — the
// inventory is append-only; nothing is deleted.
// ---------------------------------------------------------------------------

/** As-of for the closure — after the gap-recording (FX_ACCT_GAPS_AS_OF). */
export const FX_ACCT_GAPS_CLOSURE_AS_OF = "2026-06-18T06:00:00.000Z";

const CLOSURE_ACTOR: Actor = {
  type: "service",
  id: "agent:bea:npa-fx-accounting-gap-closure",
};

const CLOSURE_CITATIONS = [
  "D-FIL-FX-SETTLEMENT-EVENTS",
  "D-ACCT-FX-IFRS-POSTING-COMPLETENESS",
  "D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD",
  "dimension:accounting",
];

/** The gap ids WS-FIL-FX-SETTLEMENT-EVENTS resolved (the now-fired rules). */
export function resolvedFxAccountingGapIds(): readonly string[] {
  return FX_SETTLEMENT_DEFERRED_GAPS.filter((g) => g.resolvedBy !== undefined).map((g) => g.gapId);
}

export interface FxAcctGapClosureResult {
  readonly closed: boolean;
  readonly skipped: boolean;
  readonly blockedReason?: string;
  readonly gapsBefore?: number;
  readonly gapsAfter?: number;
}

/**
 * Re-emit the FX accounting attestation with the WS-FIL-FX-SETTLEMENT-EVENTS-
 * resolved gaps removed (every other gap carried verbatim), at a later as_of.
 * Fail-closed: refuses if there is no accounting attestation of record. Idempotent:
 * skips if none of the resolved gaps are still present on the latest attestation.
 */
export function runFxAccountingGapClosure(store: EventStore): FxAcctGapClosureResult {
  const current = latestAccountingAttestation(store);
  if (current === undefined) {
    return {
      closed: false,
      skipped: false,
      blockedReason:
        "FX accounting gap-closure refused — no accounting ProductDimensionAttested of record to amend.",
    };
  }

  const resolvedIds = new Set(resolvedFxAccountingGapIds());
  const existing = current.payload.deferredGaps ?? [];
  const stillPresentResolved = existing.filter((g) => resolvedIds.has(g.gapId));
  if (stillPresentResolved.length === 0) {
    // Nothing to close — the resolved gaps are already gone (idempotent skip).
    return {
      closed: false,
      skipped: true,
      gapsBefore: existing.length,
      gapsAfter: existing.length,
    };
  }

  const remaining = existing.filter((g) => !resolvedIds.has(g.gapId));
  const payload: ProductDimensionAttestedPayload = {
    productId: FX_ACCT_PRODUCT_ID,
    dimension: FX_ACCT_DIMENSION,
    // The verdict is unchanged — removing resolved non-blocking gaps never alters
    // the attestation result; the substrate that backed them now exists.
    result: current.payload.result,
    citationChain: [
      ...current.payload.citationChain,
      "v2-core/fil-instances/events.ts — FX settlement/terminal/NDF event family",
      "platform/accounting/posting-rules-v2/fx-fold.ts — five rules fire at fold time",
    ],
    deferredGaps: remaining,
  };

  store.append({
    ...makeProductDimensionAttested({
      asOf: FX_ACCT_GAPS_CLOSURE_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: CLOSURE_ACTOR,
      citations: [
        ...CLOSURE_CITATIONS,
        ...stillPresentResolved.map((g) => `gap-closed:${g.gapId}`),
      ],
      payload,
    }),
    provenance: buildPhaseFixtureTag({
      sourceLineage: "platform:npa-fx-accounting-gap-closure",
      variant: `npa-dimension-gap-closure:${FX_ACCT_PRODUCT_ID}:accounting:fx-settlement-events`,
      tags: ["npa-gate", "gap-closure", "accounting", FX_ACCT_PRODUCT_ID],
    }),
  });

  return {
    closed: true,
    skipped: false,
    gapsBefore: existing.length,
    gapsAfter: remaining.length,
  };
}
