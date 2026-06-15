// scripts/close-fx-accounting-gaps-impl-attested.ts
//
// Promotion: move `prd:bank:fx:otc-vanilla` accounting dimension from the
// previous attestation (which carried two tracked deferred gaps) to a new
// `implementation-attested` attestation that closes those two gaps and tracks
// only the remaining Gap 3 (hedge accounting election).
//
// Gaps closed by this promotion:
//   ✅ fx-forward-points-accrual — IAS 21 §28 daily amortisation of forward
//      premium/discount implemented via:
//        • FxForwardPointsAccrued event type (fx-accounting.ts)
//        • PR-FX-FWD-POINTS-ACCRUAL SLA rule (pr-fx-fwd-points-accrual.ts)
//        • COA accounts ACC-2100-025 / ACC-2100-026
//        • Resolver rows fx.forward_points_deferred_income / fx.forward_points_deferred_expense
//        • Tests: tests/fx-forward-points-accrual.test.ts (10 tests, all pass)
//   ✅ fx-swap-far-leg-posting — confirmed implementation-attested via:
//        • PR-FX-PRIN already handles PrincipalPayment for BOTH near and far
//          legs (instrument-type-agnostic dispatch axis, per build-3 findings).
//        • FxForwardPointsAccrued legKind="far" covers the forward-points
//          component of the swap far-leg.
//        • Test: tests/fx-otc-forward-swap-lifecycle-posting.test.ts pin
//          (PR-FX-PRIN: a swap FAR-LEG deliver posts standard derecognition legs).
//
// Remaining tracked gap (Gap 3):
//   ⏳ fx-hedge-accounting-election — hedge accounting designation (IAS 39 /
//      IFRS 9) cannot be implemented without a live counterparty requesting
//      designation. Deferred until first live counterparty designates a
//      hedging relationship.
//
// Idempotent: exits 0 if the accounting dimension is already attested at
// a timestamp ≥ AS_OF with no deferred gaps beyond the hedge-accounting one.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/close-fx-accounting-gaps-impl-attested.ts
//
// Authority: D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO 2026-06-15);
//            D-FX-OTC-NPA-SCOPE-EXPANSION (original gap register);
//            D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Author: Nadia (Model validation engineer, engineering).

import { clock, eventStore } from "../platform/composition";
import {
  type ProductDeferredGap,
  makeProductDimensionAttested,
} from "../platform/event-store/event-types/product";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
import { logger } from "../platform/observability/logger";

const PRODUCT_ID = "prd:bank:fx:otc-vanilla";
const DIMENSION = "accounting";
// Post-date the previous gap-deferral attestation (2026-06-10T12:00:00.000Z)
// so latest-wins folds pick up this promotion.
const AS_OF = "2026-06-15T10:00:00.000Z";

// ---------------------------------------------------------------------------
// Gap 3 only — Gaps 1 and 2 are now closed.
// ---------------------------------------------------------------------------

const DEFERRED_GAPS: ProductDeferredGap[] = [
  {
    gapId: "fx-hedge-accounting-election",
    title:
      "Hedge accounting election (IAS 39 / IFRS 9) — deferred until first counterparty designates a hedging relationship",
    owner: "Nadia (Model validation engineer, engineering)",
    targetTrigger: "first live counterparty requests hedge accounting designation",
    citations: ["IAS-39", "IFRS-9", "D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL"],
  },
];

// ---------------------------------------------------------------------------
// Idempotency: skip if already promoted past this point with only Gap 3 deferred.
// ---------------------------------------------------------------------------

let alreadyPromoted = false;
let latestAsOf = "";
for (const ev of eventStore.replay({ type: "ProductDimensionAttested" })) {
  const p = ev.payload as {
    productId?: string;
    dimension?: string;
    result?: string;
    deferredGaps?: Array<{ gapId: string }>;
  };
  if (p.productId !== PRODUCT_ID || p.dimension !== DIMENSION) continue;
  if (ev.as_of >= latestAsOf) {
    latestAsOf = ev.as_of;
    const gaps = p.deferredGaps ?? [];
    // Already promoted if: impl-attested, only gap remaining is hedge-accounting.
    alreadyPromoted =
      p.result === "implementation-attested" &&
      gaps.length === 1 &&
      gaps[0]?.gapId === "fx-hedge-accounting-election";
  }
}

if (alreadyPromoted) {
  logger.info(
    { productId: PRODUCT_ID, dimension: DIMENSION },
    "accounting dimension already promoted (only hedge-accounting gap remains) — skipped (idempotent)",
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Emit the promotion attestation.
// ---------------------------------------------------------------------------

const provenance = buildPhaseFixtureTag({
  sourceLineage: "platform:npa-attestation-runner",
  variant: `npa-dimension-upgrade:${PRODUCT_ID}:${DIMENSION}:gap-1-2-closed`,
  tags: [
    "npa-gate",
    "dimension-upgrade",
    "deferred-gaps",
    PRODUCT_ID,
    "ias21-forward-points-accrual",
    "fx-swap-far-leg-posting",
  ],
});

const ev = {
  ...makeProductDimensionAttested({
    asOf: AS_OF,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:nadia:model-validation" },
    citations: [
      "D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL",
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      "D-NEW-PRODUCT-APPROVAL-POLICY",
      "dimension:accounting",
    ],
    payload: {
      productId: PRODUCT_ID,
      dimension: DIMENSION,
      result: "implementation-attested",
      citationChain: [
        "D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL",
        "D-FX-OTC-NPA-SCOPE-EXPANSION",
        "D-NEW-PRODUCT-APPROVAL-POLICY",
        "Policies/accounting-policy-v1.md",
        "IAS-21",
        "IFRS-9",
        "IAS-39",
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
    closedGaps: ["fx-forward-points-accrual", "fx-swap-far-leg-posting"],
    remainingDeferredGaps: DEFERRED_GAPS.map((g) => g.gapId),
    at: clock.now(),
  },
  "accounting → implementation-attested: Gaps 1+2 closed (IAS21 forward-points accrual + swap far-leg posting); Gap 3 (hedge accounting) tracked deferred",
);
process.exit(0);
