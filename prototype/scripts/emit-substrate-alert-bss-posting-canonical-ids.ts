/**
 * SubstrateAlert — posting engine non-canonical source IDs (2026-05-SEED).
 *
 * Records the systemic substrate-gap surfaced by the balance sheet
 * substantiation run for period 2026-05-SEED (BalanceSheetSubstantiationCompleted
 * 7175ebcb): the seed-period GL posting engine generated SubLedgerPostingEmitted
 * events whose sourceEventId does not resolve to any event in the store.
 *
 * Three non-canonical ID schemes found:
 *   1. sim-trade-* prefix (256 distinct IDs, 1014 postings) — FX simulation IDs
 *   2. UUID phantom IDs (1118 distinct, 2542 postings) — fx-lifecycle-close /
 *      fx-principal-payment / reversal / trade-booking posting types
 *   3. unrecognised-source-type (557 postings)
 *
 * PROC-FIN-BSS-01 §12 requires a SubstrateAlert for substrate-gap exceptions.
 * The BSS run logged but did not emit it; this closes that gap. One alert
 * captures the systemic finding (not one per posting).
 *
 * Routed to Atlas (substrate) for canonical-ID wiring — see brief.
 *
 * Authority: PROC-FIN-BSS-01; FIN-BSS-01.
 */

import { eventStore as _eventStore } from "../platform/composition.ts";
import { makeSubstrateAlert } from "../platform/event-store/event-types/platform.ts";
import type { EventStore } from "../platform/event-store/store.ts";

const eventStore = _eventStore as unknown as EventStore;

const event = makeSubstrateAlert({
  asOf: new Date().toISOString(),
  entity: "LE-ZA-HOZ-BANK",
  actor: { type: "system", id: "system:bea:balance-sheet-substantiation" },
  citations: ["PROC-FIN-BSS-01", "FIN-BSS-01"],
  payload: {
    alertId: "alert:integrity:bss-posting-noncanonical-source-ids",
    alertClass: "integrity",
    agentUrn: "agent:atlas",
    severity: "medium",
    details:
      "Balance sheet substantiation for period 2026-05-SEED (BalanceSheetSubstantiationCompleted 7175ebcb) found 4113 SubLedgerPostingEmitted postings whose sourceEventId does not resolve to any event in the store. Three non-canonical ID schemes: (1) sim-trade-* prefix — 256 distinct IDs, 1014 postings (FX simulation framework synthetic trade IDs); (2) UUID-format phantom IDs — 1118 distinct, 2542 postings (postingType fx-lifecycle-close / fx-principal-payment / reversal / trade-booking); (3) unrecognised-source-type — 557 postings. Double-entry integrity holds (all currencies net to zero), so trial-balance arithmetic is sound, but Principle 1 traceability is broken: balances cannot be proven back to primary events. Root cause: seed-period posting engine predates canonical event-ID-as-sourceEventId wiring. Fix owner: Atlas (Core banking platform architect, engineering) — wire posting rules to emit canonical event store event_ids as sourceEventId; backfill or re-derive seed-period postings where feasible. Scheduled for next sprint per CEO direction 2026-05-30.",
  },
});

eventStore.append(event);

console.log("SubstrateAlert emitted:");
console.log(`  event_id: ${event.event_id}`);
console.log("  alertId:  alert:integrity:bss-posting-noncanonical-source-ids");
console.log("  class:    integrity | severity: medium");
console.log("  owner:    agent:atlas");
