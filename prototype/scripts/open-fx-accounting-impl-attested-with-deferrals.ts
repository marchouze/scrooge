// scripts/open-fx-accounting-impl-attested-with-deferrals.ts
//
// Build-1 opener (D-FX-OTC-NPA-SCOPE-EXPANSION roadmap §1): move the `accounting`
// dimension of the umbrella OTC vanilla FX product from design-attested to
// IMPLEMENTATION-ATTESTED for the substrate that is genuinely built (spot
// posting: PR-FX-001/002/PRIN/CLOSE), while recording the two remaining
// forward/swap accounting items as TRACKED DEFERRED GAPS rather than leaving
// the whole dimension at design level.
//
// This is the first exercise of "approved with tracked deferred gaps": the
// dimension is implementation-attested for what works; the deferrals are
// explicit, owned, and triggered. recon:npa-deferred-gap-tracking enforces that
// every deferral is properly tracked.
//
// Idempotent: skips if the accounting dimension is already implementation-attested.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/open-fx-accounting-impl-attested-with-deferrals.ts
//
// Authority: D-FX-OTC-NPA-SCOPE-EXPANSION (CEO session-delegation 2026-06-10);
//            D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Author: Scrooge-coordinated session for marc@tgv.co.za · Bea (Accounting policy engineer, finance).

import { clock, eventStore } from "../platform/composition";
import {
  type ProductDeferredGap,
  makeProductDimensionAttested,
} from "../platform/event-store/event-types/product";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
import { logger } from "../platform/observability/logger";

const PRODUCT_ID = "prd:bank:fx:otc-vanilla";
const DIMENSION = "accounting";
// Later than the umbrella's initial attestation (T00:00:00 on the same day) so
// latest-wins folds (which break ties by keeping the earlier event) pick up this
// upgrade. The upgrade is genuinely a subsequent event.
const AS_OF = "2026-06-10T12:00:00.000Z";

const DEFERRED_GAPS: ProductDeferredGap[] = [
  {
    gapId: "fx-forward-points-accrual",
    title:
      "Forward-points accrual accounting — IAS 21 §28 time-value vs intrinsic split (forward/swap)",
    owner: "Bea (Accounting policy engineer, finance)",
    targetTrigger: "forward/swap go-live (first FX-forward or FX-swap trade booked)",
    citations: ["D-FX-OTC-NPA-SCOPE-EXPANSION", "IAS-21", "Policies/accounting-policy-v1.md"],
  },
  {
    gapId: "fx-swap-far-leg-posting",
    title:
      "Swap far-leg posting rule + forward-points separation (far leg currently rides the spot rule)",
    owner: "Bea (Accounting policy engineer, finance)",
    targetTrigger: "forward/swap go-live",
    citations: ["D-FX-OTC-NPA-SCOPE-EXPANSION", "IAS-21"],
  },
];

// Idempotency: latest accounting attestation already implementation-attested?
let alreadyImplAttested = false;
let latestAsOf = "";
for (const ev of eventStore.replay({ type: "ProductDimensionAttested" })) {
  const p = ev.payload as { productId?: string; dimension?: string; result?: string };
  if (p.productId !== PRODUCT_ID || p.dimension !== DIMENSION) continue;
  if (ev.as_of >= latestAsOf) {
    latestAsOf = ev.as_of;
    alreadyImplAttested = p.result === "implementation-attested";
  }
}

if (alreadyImplAttested) {
  logger.info(
    { productId: PRODUCT_ID, dimension: DIMENSION },
    "accounting already implementation-attested — skipped (idempotent)",
  );
  process.exit(0);
}

const provenance = buildPhaseFixtureTag({
  sourceLineage: "platform:npa-attestation-runner",
  variant: `npa-dimension-upgrade:${PRODUCT_ID}:${DIMENSION}`,
  tags: ["npa-gate", "dimension-upgrade", "deferred-gaps", PRODUCT_ID],
});

const ev = {
  ...makeProductDimensionAttested({
    asOf: AS_OF,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:bea:accounting" },
    citations: [
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      "D-NEW-PRODUCT-APPROVAL-POLICY",
      "dimension:accounting",
    ],
    payload: {
      productId: PRODUCT_ID,
      dimension: DIMENSION,
      result: "implementation-attested",
      citationChain: [
        "D-FX-OTC-NPA-SCOPE-EXPANSION",
        "D-NEW-PRODUCT-APPROVAL-POLICY",
        "Policies/accounting-policy-v1.md",
        "IAS-21",
        "IFRS-9",
      ],
      deferredGaps: DEFERRED_GAPS,
    },
  }),
  provenance,
};
eventStore.append(ev);

logger.info(
  {
    productId: PRODUCT_ID,
    dimension: DIMENSION,
    result: "implementation-attested",
    deferredGaps: DEFERRED_GAPS.map((g) => g.gapId),
    at: clock.now(),
  },
  "accounting → implementation-attested with 2 tracked deferred gaps (forward-points accrual; swap far-leg posting)",
);
process.exit(0);
