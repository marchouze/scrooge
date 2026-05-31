#!/usr/bin/env bun
// scripts/close-may-2026.ts
//
// One-shot: closes the live May 2026 accounting period for LE-ZA-HOZ-BANK.
//
// The period (period:LE-ZA-HOZ-BANK:month:2026-05) was opened on 2026-05-28
// but the bea-period-close agent handler was missing the close branch —
// a substrate gap surfaced on 2026-05-31 (CEO-instructed close).
//
// Idempotent: exits 0 with no-op if the period is already closed.
//
// Run from prototype/:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/close-may-2026.ts
//
// Authority: CEO session delegation 2026-05-31; D-REPORTING-CAPABILITY-SLICE-2.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { closePeriod } from "../platform/accounting/period-close";
import { EventStore } from "../platform/event-store/store";

const ENTITY = "LE-ZA-HOZ-BANK";
const PERIOD_ID = "period:LE-ZA-HOZ-BANK:month:2026-05";
const CLOSED_AT = "2026-05-31T17:00:00.000Z"; // EoD last business day of May

const ACTOR = { type: "service" as const, id: "script:close-may-2026:ceo-session-delegation" };
const CITATIONS = [
  "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
  "D-REPORTING-CAPABILITY-SLICE-2",
  "Principles/1-events-are-truth.md",
];

function main(): number {
  const eventDbPath = process.env.BANK_EVENT_DB ?? `${process.env.HOME}/.local/share/bank/event.db`;
  const db = new EventStore(eventDbPath);

  console.log(`\nClose May 2026 — entity=${ENTITY}, periodId=${PERIOD_ID}`);
  console.log(`Event store: ${eventDbPath}`);
  console.log("─".repeat(60));

  // Idempotency guard
  for (const e of db.replay({ entity: ENTITY, type: "AccountingPeriodClosed" })) {
    const p = e.payload as Record<string, unknown>;
    if (p.periodId === PERIOD_ID) {
      console.log(`  Period already closed (no-op) — event_id=${e.event_id}`);
      console.log("\n✓ close-may-2026 complete (no-op)");
      return 0;
    }
  }

  // Verify the period is open
  let periodOpen = false;
  for (const e of db.replay({ entity: ENTITY, type: "AccountingPeriodOpened" })) {
    const p = e.payload as Record<string, unknown>;
    if (p.periodId === PERIOD_ID) {
      periodOpen = true;
      console.log(`  Period is open — event_id=${e.event_id}`);
      break;
    }
  }

  if (!periodOpen) {
    console.error(`[close-may-2026] ERROR: no AccountingPeriodOpened for ${PERIOD_ID}`);
    return 1;
  }

  try {
    const closeResult = closePeriod({
      eventStore: db,
      entity: ENTITY,
      periodId: PERIOD_ID,
      closedAt: CLOSED_AT,
      actor: ACTOR,
      citations: CITATIONS,
    });
    console.log(`✓ Period closed — event_id=${closeResult.accountingPeriodClosedEvent.event_id}`);
    console.log(
      `  Trial balance: ${closeResult.trialBalance.rows.length} rows, uptoSequence=${closeResult.trialBalance.uptoSequence}`,
    );
  } catch (err) {
    console.error(`[close-may-2026] ERROR: ${String(err)}`);
    return 1;
  }

  console.log("\n✓ close-may-2026 complete");
  return 0;
}

process.exit(main());
