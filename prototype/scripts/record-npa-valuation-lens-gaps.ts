// scripts/record-npa-valuation-lens-gaps.ts
//
// One-shot driver: record the five-domain valuation-lens tracked deferred gaps
// (D-V2-UI-OVERSIGHT-STANDARD / D-NPA-PAGE-DE-INVENTION) onto their NPA
// dimensions for prd:bank:fx:otc-vanilla — Liquidity Risk (no LCR/NSFR
// projection) and Product Control (no realised-P&L attribution). Idempotent +
// no-op-safe. This is the events-first mirror of the in-code inventory the NPA
// page renders (Principle 1).
//
// Run against the SHARED canonical store (do NOT set BANK_EVENT_DB):
//   bun run scripts/record-npa-valuation-lens-gaps.ts
//
// Authority: D-V2-UI-OVERSIGHT-STANDARD; D-NPA-PAGE-DE-INVENTION (CEO-approved
//   2026-06-23).
// Author: Atlas (Core banking platform architect, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { recordValuationLensDeferredGaps } from "../platform/markets/products/npa-valuation-lens-deferred-gaps";

const result = recordValuationLensDeferredGaps(eventStore);
console.log(`recorded ${result.recordedCount} valuation-lens deferred gap(s):`);
for (const o of result.outcomes) {
  console.log(
    `  ${o.recorded ? "✅" : "ℹ️ "} ${o.dimension} / ${o.gapId}${o.reason ? ` — ${o.reason}` : ""}`,
  );
}
