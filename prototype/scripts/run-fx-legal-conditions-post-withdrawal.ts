// scripts/run-fx-legal-conditions-post-withdrawal.ts
//
// One-shot driver: emit the legal-dimension design-attested-with-conditions
// event for prd:bank:fx:otc-vanilla following product-approval withdrawal
// (D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL, CEO 2026-06-15).
//
// Emits a ProductDimensionAttested { result: "design-attested", deferredGaps: [4] }
// with as_of 2026-06-15T12:00 — later than the implementation-attested event
// (2026-06-12T08:00), so the latest-wins fold picks this up as current.
//
// Run against the canonical shared store (leave BANK_EVENT_DB at default):
//   bun run scripts/run-fx-legal-conditions-post-withdrawal.ts
//
// Authority: D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO 2026-06-15);
//            D-NPA-GATE-POLICY-REDESIGN.

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { emitFxLegalConditions } from "../platform/markets/products/npa-fx-legal-conditions-post-withdrawal";

if (import.meta.main) {
  const result = emitFxLegalConditions(eventStore);
  console.log(
    JSON.stringify(
      {
        ok: true,
        emitted: result.emitted,
        skipped: result.skipped,
        note: result.skipped
          ? "design-attested-with-conditions already in store — idempotent"
          : "legal dimension set to design-attested with 4 tracked conditions",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
