// platform/markets/products/npa-fx-infosec-gap-closure.ts
//
// FX OTC umbrella NPA — infosec dimension: close Rashida's tracked deferred gap
// `fx-gateway-identity-check-enforcement` now that the gateway `identity` check
// ENFORCES fail-closed (platform/markets/identity/counterparty-identity-gate.ts;
// this dispatch).
//
// The infosec attestation (npa-fx-infosec-attestation.ts, Rashida, Chief
// Information Security Officer, governance) was promoted implementation-attested
// with four tracked deferred gaps — the first of which,
// `fx-gateway-identity-check-enforcement` (ratification condition 1), is the
// EXACT condition this dispatch discharges. This module re-emits the infosec
// dimension's LATEST attestation with that one gap REMOVED and every other gap
// carried VERBATIM (the gap inventory shrinks by exactly one), at a later as_of
// so latest-wins folds pick up the closure.
//
// It reads the current latest infosec ProductDimensionAttested event of record
// (Principle 1) rather than hard-coding the gap list — so it stays correct even
// if the infosec attestation is re-run with a different gap set.
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-FX-NPA-VERIFICATION-PASS-2-DISPATCH; D-FX-OTC-NPA-SCOPE-EXPANSION;
//   D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Author: Tomas (Operations & payments engineer, engineering), discharging
//   Rashida's (Chief Information Security Officer, governance) condition 1;
//   governance owner Devon (Chief Operating Officer, governance).

import {
  type ProductDeferredGap,
  makeProductDimensionAttested,
} from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";

export const INFOSEC_PRODUCT_ID = "prd:bank:fx:otc-vanilla";
export const CLOSED_GAP_ID = "fx-gateway-identity-check-enforcement";

// Later than the infosec promotion (2026-06-12T08:00) and after the op-risk
// promotion (2026-06-12T09:00) so this closure is the latest infosec event.
export const INFOSEC_CLOSURE_AS_OF = "2026-06-12T09:30:00.000Z";

const ACTOR = {
  type: "service" as const,
  id: "agent:tomas:npa-infosec-gap-closure",
};

const CLOSURE_CITATIONS = [
  "D-FX-HELD-DIMS-SEAT-SWEEP",
  "D-FX-OTC-NPA-SCOPE-EXPANSION",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
];

interface InfosecAttestationSnapshot {
  citationChain: string[];
  deferredGaps: ProductDeferredGap[];
  asOf: string;
}

/** Read the latest infosec implementation-attested event of record. */
function latestInfosecAttestation(store: EventStore): InfosecAttestationSnapshot | null {
  let latest: InfosecAttestationSnapshot | null = null;
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as {
      productId?: string;
      dimension?: string;
      result?: string;
      citationChain?: string[];
      deferredGaps?: ProductDeferredGap[];
    };
    if (
      p.productId === INFOSEC_PRODUCT_ID &&
      p.dimension === "infosec" &&
      p.result === "implementation-attested"
    ) {
      if (latest === null || ev.as_of >= latest.asOf) {
        latest = {
          citationChain: [...(p.citationChain ?? [])],
          deferredGaps: (p.deferredGaps ?? []).map((g) => ({ ...g, citations: [...g.citations] })),
          asOf: ev.as_of,
        };
      }
    }
  }
  return latest;
}

export interface InfosecGapClosureResult {
  readonly closed: boolean;
  readonly skipped: boolean;
  readonly blockedReason?: string;
  readonly gapsBefore?: number;
  readonly gapsAfter?: number;
}

/**
 * Re-emit the infosec dimension's latest attestation with the
 * `fx-gateway-identity-check-enforcement` gap removed, carrying every other gap
 * verbatim. Fail-closed:
 *   - refuses if there is no infosec implementation-attested event of record;
 *   - refuses if the gap is not present in the latest attestation (nothing to
 *     close — avoids emitting a no-op identical re-attestation).
 * Idempotent: skips if a closure at or after INFOSEC_CLOSURE_AS_OF already
 * stands (i.e. the latest infosec event no longer carries the gap AND is dated
 * at/after the closure as_of).
 */
export function runFxInfosecGapClosure(store: EventStore): InfosecGapClosureResult {
  const latest = latestInfosecAttestation(store);
  if (latest === null) {
    return {
      closed: false,
      skipped: false,
      blockedReason:
        "infosec gap-closure refused — no infosec implementation-attested event of record to amend.",
    };
  }

  const hasGap = latest.deferredGaps.some((g) => g.gapId === CLOSED_GAP_ID);
  if (!hasGap) {
    // Already closed (or never present) — idempotent skip when the latest event
    // is at/after the closure as_of, else nothing to do.
    return {
      closed: false,
      skipped: true,
      gapsBefore: latest.deferredGaps.length,
      gapsAfter: latest.deferredGaps.length,
    };
  }

  const remaining = latest.deferredGaps.filter((g) => g.gapId !== CLOSED_GAP_ID);

  const provenance = buildPhaseFixtureTag({
    sourceLineage: "platform:npa-attestation-runner",
    variant: `npa-dimension-gap-closure:${INFOSEC_PRODUCT_ID}:infosec:${CLOSED_GAP_ID}`,
    tags: ["npa-gate", "gap-closure", "infosec", INFOSEC_PRODUCT_ID],
  });

  store.append({
    ...makeProductDimensionAttested({
      asOf: INFOSEC_CLOSURE_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: [...CLOSURE_CITATIONS, "dimension:infosec", "gap-closed:fx-gateway-identity-check-enforcement"],
      payload: {
        productId: INFOSEC_PRODUCT_ID,
        dimension: "infosec",
        result: "implementation-attested",
        citationChain: [
          ...latest.citationChain,
          "platform/markets/identity/counterparty-identity-gate.ts",
        ],
        deferredGaps: remaining.map((g) => ({ ...g, citations: [...g.citations] })),
      },
    }),
    provenance,
  });

  return {
    closed: true,
    skipped: false,
    gapsBefore: latest.deferredGaps.length,
    gapsAfter: remaining.length,
  };
}
