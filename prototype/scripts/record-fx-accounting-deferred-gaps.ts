// scripts/record-fx-accounting-deferred-gaps.ts
//
// One-shot driver: record the FX-posting-completeness tracked deferred gaps
// (WS-ACCT-FX-COMPLETENESS Slice 3) onto the `accounting` dimension of
// prd:bank:fx:otc-vanilla. Idempotent + no-op-safe.
//
// Run against the SHARED canonical store (do NOT set BANK_EVENT_DB):
//   bun run scripts/record-fx-accounting-deferred-gaps.ts
//
// Authority: D-ACCT-FX-IFRS-POSTING-COMPLETENESS (CEO-approved 2026-06-18).
// Author: Bea (Accounting & financial reporting engineer, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { recordFxAccountingDeferredGaps } from "../platform/markets/products/npa-fx-accounting-deferred-gaps";

const result = recordFxAccountingDeferredGaps(eventStore);
if (result.recorded) {
  console.log("✅ recorded FX accounting deferred gaps (latest-wins re-attestation).");
} else {
  console.log(`ℹ️  no-op: ${result.reason ?? "nothing to record"}`);
}
