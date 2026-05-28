// scripts/ifrs9-staging-run.ts
//
// IFRS 9 staging run orchestrator.
//
// Runs a batch IFRS 9 impairment-stage assessment cycle:
//   1. Opens EventStore from BANK_EVENT_DB (or home default).
//   2. Reads all TradeBooked events to build the instrument list.
//   3. For each trade, constructs IfrsAssessmentParams (all performing,
//      build-phase default: dpd=0, manualSicr=false, restructured=false,
//      defaultIndicator=false).
//   4. Calls assessIfrs9Stage() to classify the instrument.
//   5. Emits Ifrs9StageAssigned event (idempotent: checks for same-day
//      assessment for the tradeId before emitting).
//   6. Prints a summary table to stdout and exits 0.
//
// Idempotency:
//   Same-day assessments are skipped. Re-running multiple times on the same
//   calendar day produces exactly one Ifrs9StageAssigned per tradeId per day.
//
// Environment:
//   BANK_EVENT_DB   path to SQLite event store (shared home store default)
//
// Usage:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/ifrs9-staging-run.ts
//
// Authority:
//   - D-IFRS9-STAGING-V1 (CEO-approved 2026-05-28)
//   - D-IFRS-THRESHOLDS-V13 (SICR thresholds, 2026-05-27)
//   - IFRS 9 §5.5.1–§5.5.17 (ECL impairment requirements)
//   - Regulations Relating to Banks Reg 23 (default definition)
//
// Author: Atlas (Core banking platform architect, engineering)

import { resolveEventDbPath } from "../platform/event-store/resolve-event-db";
import { EventStore } from "../platform/event-store/store";
import { makeIfrs9StageAssigned } from "../platform/event-store/event-types/ifrs9-staging";
import type { Ifrs9StageAssignedPayload } from "../platform/event-store/event-types/ifrs9-staging";
import { assessIfrs9Stage } from "../platform/accounting/ifrs9-staging";
import type { TradeBookedPayload } from "../platform/event-store/event-types/markets-trading-extended";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BANK_ENTITY = "LE-ZA-HOZ-BANK";
const ENGINE_ACTOR = {
  type: "service" as const,
  id: "ifrs9-engine",
};
const CITATIONS = [
  "D-IFRS9-STAGING-V1",
  "D-IFRS-THRESHOLDS-V13",
  "IFRS-9-§5.5",
  "Regulations Relating to Banks Reg 23",
];
const POLICY_REF = "D-IFRS9-STAGING-V1";
const ASSESSOR_ID = "ifrs9-engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a product family string from the instrument field on TradeBooked.
 * Falls back to "equity" (trading-book ECL rate) if the instrument cannot
 * be matched.
 */
function deriveProductFamily(instrument: string | undefined): string {
  if (!instrument) return "equity";
  const lower = instrument.toLowerCase();
  if (lower.includes("bond") || lower.includes("debt")) return "bond";
  if (lower.includes("repo")) return "repo";
  if (lower.includes("money") || lower.includes("mmd") || lower.includes("ibl")) {
    return "money-market";
  }
  if (lower.includes("irs") || lower.includes("swap")) return "irs";
  if (lower.includes("fx") || lower.includes("fxswap")) return "fx-swap";
  return "equity";
}

/**
 * Extract a same-day date string (YYYY-MM-DD) from an ISO 8601 timestamp.
 */
function toDateString(isoTs: string): string {
  return isoTs.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const resolved = resolveEventDbPath();
  console.log(`[ifrs9-staging-run] Event DB: ${resolved.path} (source: ${resolved.source})`);

  const store = new EventStore(resolved.path);
  const now = new Date().toISOString();
  const today = toDateString(now);

  // -------------------------------------------------------------------------
  // Step 1: Collect all TradeBooked events
  // -------------------------------------------------------------------------

  const trades = new Map<string, TradeBookedPayload & { _asOf: string }>();

  for (const evt of store.replay({ type: "TradeBooked" })) {
    const p = evt.payload as unknown as TradeBookedPayload;
    const tradeId = p.tradeId ?? p.bookingRef;
    if (tradeId) {
      // Last-write wins — most recent TradeBooked for this tradeId
      trades.set(tradeId, { ...p, _asOf: evt.as_of });
    }
  }

  console.log(`[ifrs9-staging-run] Found ${trades.size} trade(s) to assess.`);

  // -------------------------------------------------------------------------
  // Step 2: Collect existing same-day assessments (idempotency guard)
  // -------------------------------------------------------------------------

  const alreadyAssessedToday = new Set<string>();

  for (const evt of store.replay({ type: "Ifrs9StageAssigned" })) {
    const p = evt.payload as unknown as Ifrs9StageAssignedPayload;
    if (p.tradeId && toDateString(p.assessedAt) === today) {
      alreadyAssessedToday.add(p.tradeId);
    }
  }

  console.log(
    `[ifrs9-staging-run] ${alreadyAssessedToday.size} trade(s) already assessed today — will skip.`,
  );

  // -------------------------------------------------------------------------
  // Step 3: Assess and emit
  // -------------------------------------------------------------------------

  let emitted = 0;
  let skipped = 0;
  const stageSummary: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };

  for (const [tradeId, tradePayload] of trades) {
    if (alreadyAssessedToday.has(tradeId)) {
      skipped++;
      continue;
    }

    const productFamily = deriveProductFamily(tradePayload.instrument);
    // Build-phase: all instruments are performing
    const params = {
      dpd: 0,
      manualSicr: false,
      restructured: false,
      defaultIndicator: false,
      productFamily,
      notionalMinor: 0, // notional not captured on TradeBooked in current schema
      currency: tradePayload.currency ?? "ZAR",
    };

    const result = assessIfrs9Stage(params);
    stageSummary[result.stage]++;

    const instrumentId = tradePayload.instrument ?? `trade:${tradeId}`;

    const event = makeIfrs9StageAssigned({
      asOf: now,
      entity: BANK_ENTITY,
      actor: ENGINE_ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId,
        instrumentId,
        stage: result.stage,
        eclBasisPoints: result.eclBasisPoints,
        eclAmountMinor: result.eclAmountMinor,
        currency: params.currency,
        triggerReason: result.triggerReason as Ifrs9StageAssignedPayload["triggerReason"],
        assessedAt: now,
        assessorId: ASSESSOR_ID,
        policyRef: POLICY_REF,
      },
    });

    store.append(event);
    emitted++;
  }

  // -------------------------------------------------------------------------
  // Step 4: Summary
  // -------------------------------------------------------------------------

  console.log("\n[ifrs9-staging-run] Assessment complete.");
  console.log(`  Trades assessed : ${emitted}`);
  console.log(`  Trades skipped  : ${skipped} (already assessed today)`);
  console.log(`  Stage 1         : ${stageSummary[1]}`);
  console.log(`  Stage 2         : ${stageSummary[2]}`);
  console.log(`  Stage 3         : ${stageSummary[3]}`);
  console.log(`  Total trades    : ${trades.size}`);
}

main().catch((err) => {
  console.error("[ifrs9-staging-run] FATAL:", err);
  process.exit(1);
});
