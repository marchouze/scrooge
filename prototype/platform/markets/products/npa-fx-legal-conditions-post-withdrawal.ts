// platform/markets/products/npa-fx-legal-conditions-post-withdrawal.ts
//
// Post-withdrawal legal-dimension conditions for prd:bank:fx:otc-vanilla.
//
// D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO 2026-06-15) withdrew the product
// approval. Under D-NPA-GATE-POLICY-REDESIGN, a legal dimension may be accepted
// as "design-attested" provided every deferred condition is explicitly tracked
// (owner + targetTrigger + citations). This module emits that event, superseding
// the earlier implementation-attested event (2026-06-12T08:00) with a later
// as_of timestamp.
//
// The four conditions correspond directly to external-counterparty or
// external-counsel dependencies that CANNOT be resolved in the build phase:
//
//   1. fx-fais-s45-counsel-opinion  — external counsel opinion (FAIS s.45)
//   2. fx-real-isda-execution       — real ISDA Master Agreement execution
//   3. fx-jurisdictional-opinion-refresh — first real ISDA netting opinion
//   4. fx-csa-margin-mechanics      — CSA + variation-margin substrate
//
// Over-attestation is the failure mode: this file deliberately uses
// "design-attested" (not "implementation-attested"), which is the
// honest result when real counterparties and external counsel are required.
//
// Authority: D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO 2026-06-15);
//            D-NPA-GATE-POLICY-REDESIGN;
//            D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//            D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Author: Imani (Legal-as-code engineer, engineering)
//         Governance owner: Devon (COO, interim, pending future GC)

import {
  type ProductDeferredGap,
  makeProductDimensionAttested,
} from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";

export const LEGAL_CONDITIONS_PRODUCT_ID = "prd:bank:fx:otc-vanilla";

// Must be LATER than the implementation-attested event (2026-06-12T08:00)
// so the latest-wins fold in products-view.ts picks this up as the current
// legal-dimension attestation.
export const LEGAL_CONDITIONS_AS_OF = "2026-06-15T12:00:00.000Z";

const ACTOR = {
  type: "service" as const,
  id: "agent:imani:npa-legal-conditions-post-withdrawal",
};

const BASE_CITATIONS = [
  "D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL",
  "D-NPA-GATE-POLICY-REDESIGN",
  "D-FX-HELD-DIMS-SEAT-SWEEP",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
];

/**
 * The four legal conditions that require real counterparties or external
 * counsel and therefore cannot be closed in the build phase.
 *
 * Every field is mandatory (enforced by Zod schema on ProductDeferredGap);
 * no condition can be silently empty. Recon gate recon:npa-deferred-gap-tracking
 * inventories these on every CI run.
 */
export const LEGAL_CONDITIONS: readonly ProductDeferredGap[] = [
  {
    gapId: "fx-fais-s45-counsel-opinion",
    title:
      "FAIS s.45 exemption/licensing analysis for the institutional FX desk is pending an external-counsel opinion. The in-house reading (institutional-only venue, market-counterparty scope) stands un-opined until external counsel is engaged at the licence-application stage.",
    owner:
      "Devon (COO, interim, pending future GC) — discharged via external counsel at engagement",
    targetTrigger: "licence-application external-counsel engagement (FAIS s.45 opinion delivered)",
    citations: ["FAIS-ACT-37-2002", "D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL"],
  },
  {
    gapId: "fx-real-isda-execution",
    title:
      "LegalDocumentationSigned events for authorised FX counterparties are SIMULATED build-phase fixtures (no executed agreements, no doc-store documentHash). Real ISDA 2002 Master Agreement executions with hashed executed documents replace them at licence-day counterparty legal onboarding.",
    owner: "Imani (Legal-as-code engineer, engineering)",
    targetTrigger:
      "licence-day — real counterparty ISDA 2002 Master Agreement executed (documentHash mandatory)",
    citations: ["ISDA-2002-MASTER-AGREEMENT", "D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL"],
  },
  {
    gapId: "fx-jurisdictional-opinion-refresh",
    title:
      "No JurisdictionalOpinionRefreshed of record exists yet. The ISDA South Africa netting opinion subscription is a licence-day engagement. The annual-refresh watchdog reports missing-opinion findings (medium, monitoring) until the first real opinion is filed.",
    owner: "Imani (Legal-as-code engineer, engineering)",
    targetTrigger:
      "first non-ZA counterparty onboarding — first JurisdictionalOpinionRefreshed filed with doc-store opinionDocumentHash",
    citations: ["D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL"],
  },
  {
    gapId: "fx-csa-margin-mechanics",
    title:
      "No CSA margining substrate exists. Fixture signings carry csaPresent:false. A CSA is mandatory once forward/IRD margin requirements bind (Imani G-9 §3). CSA execution and variation-margin mechanics are deferred until the first live ISDA/CSA execution with a real counterparty.",
    owner: "Imani (Legal-as-code engineer, engineering)",
    targetTrigger:
      "first live ISDA/CSA execution with real counterparty (margining substrate build precedes forward/IRD margin go-live)",
    citations: ["D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL"],
  },
];

export interface LegalConditionsResult {
  readonly emitted: boolean;
  readonly skipped: boolean;
}

/**
 * Emit the legal-dimension design-attested event with tracked conditions.
 *
 * Idempotent: if a legal design-attested event at or after LEGAL_CONDITIONS_AS_OF
 * already exists for the product, returns skipped.
 *
 * This event supersedes the implementation-attested event from 2026-06-12T08:00
 * because it carries a later as_of timestamp and the latest-wins fold in
 * products-view.ts uses as_of to determine the current attestation.
 */
export function emitFxLegalConditions(store: EventStore): LegalConditionsResult {
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as { productId?: string; dimension?: string; result?: string };
    if (
      p.productId === LEGAL_CONDITIONS_PRODUCT_ID &&
      p.dimension === "legal" &&
      p.result === "design-attested" &&
      ev.as_of >= LEGAL_CONDITIONS_AS_OF
    ) {
      return { emitted: false, skipped: true };
    }
  }

  const provenance = buildPhaseFixtureTag({
    sourceLineage: "platform:npa-legal-conditions-post-withdrawal",
    variant: `npa-dimension-conditions:${LEGAL_CONDITIONS_PRODUCT_ID}:legal:post-withdrawal`,
    tags: [
      "npa-gate",
      "dimension-conditions",
      "legal",
      LEGAL_CONDITIONS_PRODUCT_ID,
      "post-withdrawal",
    ],
  });

  store.append({
    ...makeProductDimensionAttested({
      asOf: LEGAL_CONDITIONS_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: [...BASE_CITATIONS, "dimension:legal"],
      payload: {
        productId: LEGAL_CONDITIONS_PRODUCT_ID,
        dimension: "legal",
        result: "design-attested",
        citationChain: [...BASE_CITATIONS, "FAIS-ACT-37-2002", "ISDA-2002-MASTER-AGREEMENT"],
        deferredGaps: LEGAL_CONDITIONS.map((g) => ({ ...g, citations: [...g.citations] })),
      },
    }),
    provenance,
  });

  return { emitted: true, skipped: false };
}
