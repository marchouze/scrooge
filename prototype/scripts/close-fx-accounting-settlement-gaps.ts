// scripts/close-fx-accounting-settlement-gaps.ts
//
// One-shot driver: CLOSE the five FX-posting-completeness deferred gaps on the
// `accounting` dimension of prd:bank:fx:otc-vanilla now that WS-FIL-FX-
// SETTLEMENT-EVENTS wired every FX completeness posting rule to fire at fold
// time (D-FIL-FX-SETTLEMENT-EVENTS).
//
// Append-only: re-emits the latest FX accounting attestation with the resolved
// gaps removed (latest-wins). The original gap-recording events stay in the log.
// Idempotent + no-op-safe — safe to run repeatedly and on a clean store.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/close-fx-accounting-settlement-gaps.ts
//
// Authority: D-FIL-FX-SETTLEMENT-EVENTS (CEO session-delegation 2026-06-18);
//   D-ACCT-FX-IFRS-POSTING-COMPLETENESS; D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { runFxAccountingGapClosure } from "../platform/markets/products/npa-fx-accounting-deferred-gaps";

const result = runFxAccountingGapClosure(eventStore);
if (result.closed) {
  console.log(
    `✅ closed FX accounting settlement gaps (latest-wins re-attestation): ${result.gapsBefore} → ${result.gapsAfter} tracked gaps.`,
  );
} else if (result.skipped) {
  console.log("ℹ️  no-op: the FX accounting settlement gaps are already closed.");
} else {
  console.error(`❌ blocked: ${result.blockedReason ?? "unknown"}`);
  process.exit(1);
}
