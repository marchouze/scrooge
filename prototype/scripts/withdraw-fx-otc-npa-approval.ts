// scripts/withdraw-fx-otc-npa-approval.ts
//
// Emit ProductWithheld for prd:bank:fx:otc-vanilla, withdrawing the approval
// that was issued under the pre-D-NPA-GATE-POLICY-REDESIGN policy.
//
// The previous ProductApproved was issued when design-attested-alone was
// sufficient. Under D-NPA-GATE-POLICY-REDESIGN (CEO 2026-06-15), ProductApproved
// requires EITHER implementation-attested, OR design-attested with at least one
// explicit tracked condition (ProductDeferredGap with owner + targetTrigger +
// citations). The existing approval pre-dates that standard and must be
// withdrawn pending re-gate.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/withdraw-fx-otc-npa-approval.ts
//
// Authority:
//   - D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO 2026-06-15)
//   - D-NPA-GATE-POLICY-REDESIGN (CEO 2026-06-15)
//   - D-NPA-SCOPE-FIX-COUNTERPARTY-ELIGIBILITY (CEO 2026-06-15)
//
// Author: Owen (Company Secretary, governance)

import { clock, eventStore } from "../platform/composition";
import { makeProductWithheld } from "../platform/event-store/event-types/product";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
import { logger } from "../platform/observability/logger";

const AS_OF = "2026-06-15T00:00:00.000Z";
const PRODUCT_ID = "prd:bank:fx:otc-vanilla";
const VERSION = "1.0.0";
const ENTITY = "LE-ZA-HOZ-BANK";

const CITATIONS = [
  "D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL",
  "D-NPA-GATE-POLICY-REDESIGN",
  "D-NPA-SCOPE-FIX-COUNTERPARTY-ELIGIBILITY",
];

// ---------------------------------------------------------------------------
// Idempotency guard — skip if a ProductWithheld already exists for this product
// at or after the withdrawal date.
// ---------------------------------------------------------------------------

let alreadyWithheld = false;
for (const ev of eventStore.replay({ type: "ProductWithheld" })) {
  const p = ev.payload as { productId?: string };
  if (p.productId === PRODUCT_ID && ev.as_of >= AS_OF) {
    alreadyWithheld = true;
    break;
  }
}

if (alreadyWithheld) {
  logger.info(
    { productId: PRODUCT_ID },
    "ProductWithheld already emitted for this product at or after withdrawal date — skipped (idempotent)",
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Emit ProductWithheld.
// ---------------------------------------------------------------------------

const provenance = buildPhaseFixtureTag({
  sourceLineage: "governance:owen:npa-policy-withdrawal",
  variant: `npa-withdraw:${PRODUCT_ID}`,
  tags: ["npa-gate", "product-withheld", PRODUCT_ID, "D-NPA-GATE-POLICY-REDESIGN"],
});

const withheld = {
  ...makeProductWithheld({
    asOf: AS_OF,
    entity: ENTITY,
    actor: { type: "service", id: "agent:owen:company-secretary" },
    citations: CITATIONS,
    payload: {
      productId: PRODUCT_ID,
      version: VERSION,
      reason:
        "Approval issued under pre-D-NPA-GATE-POLICY-REDESIGN policy (design-attested-sufficient); product withdrawn pending re-gate under new standard (D-NPA-GATE-POLICY-REDESIGN, D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL, CEO 2026-06-15)",
    },
  }),
  provenance,
};

eventStore.append(withheld);

logger.info(
  { productId: PRODUCT_ID, version: VERSION, at: clock.now() },
  "ProductWithheld emitted — OTC FX approval withdrawn pending re-gate under D-NPA-GATE-POLICY-REDESIGN",
);

process.exit(0);
