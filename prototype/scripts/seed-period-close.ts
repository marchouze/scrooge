#!/usr/bin/env bun
// scripts/seed-period-close.ts
//
// Idempotent one-shot script: opens an accounting period, emits an interim
// TrialBalanceSnapshotted, then closes the period.
//
// Run from prototype/:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/seed-period-close.ts
//
// Exit codes:
//   0 — completed (open + snapshot + close, or idempotent no-op for steps
//       already done)
//   1 — error (period conflict, balance violation, etc.)
//
// Idempotency:
//   - `openPeriod` is idempotent — returns the existing event if the period
//     is already open with the same payload.
//   - `snapshotTrialBalance` always appends a new interim snapshot (design:
//     multiple interim snapshots per period are permitted; subsequent
//     calls produce new snapshot events).
//   - `closePeriod` throws if the period is already closed — the script
//     guards against this by checking for an existing AccountingPeriodClosed
//     event before calling close.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved);
//   D-REPORTING-CAPABILITY-SLICE-2; Principles/1-events-are-truth.md.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { closePeriod, openPeriod } from "../platform/accounting/period-close";
import { snapshotTrialBalance } from "../platform/accounting/period-close-handler";
import { EventStore } from "../platform/event-store/store";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const PERIOD_ID = "2026-05-SEED";
const PERIOD_START = "2026-05-01T00:00:00.000Z";
const PERIOD_END = "2026-05-31T23:59:59.999Z";
const OPENED_AT = "2026-05-01T08:00:00.000Z";
const SNAPSHOT_AT = "2026-05-15T08:00:00.000Z"; // mid-month interim snapshot
const CLOSED_AT = "2026-06-01T08:00:00.000Z"; // close on the first day of June

const ACTOR = { type: "service" as const, id: "script:seed-period-close" };
const CITATIONS = [
  "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
  "D-REPORTING-CAPABILITY-SLICE-2",
  "Principles/1-events-are-truth.md",
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): number {
  const eventDbPath = process.env.BANK_EVENT_DB ?? `${process.env.HOME}/.local/share/bank/event.db`;
  const db = new EventStore(eventDbPath);

  console.log(`\nSeed period-close — entity=${ENTITY}, periodId=${PERIOD_ID}`);
  console.log(`Event store: ${eventDbPath}`);
  console.log("─".repeat(60));

  // -------------------------------------------------------------------------
  // Idempotency guard: if the period is already closed, the entire script
  // is a no-op. This handles the common case where CI runs the seed twice
  // (first run seeds; second run is a safe no-op).
  // -------------------------------------------------------------------------
  let alreadyClosedEarly = false;
  for (const e of db.replay({ entity: ENTITY, type: "AccountingPeriodClosed" })) {
    const p = e.payload as Record<string, unknown>;
    if (p.periodId === PERIOD_ID) {
      alreadyClosedEarly = true;
      console.log(`  Period already fully closed (idempotent no-op) — event_id=${e.event_id}`);
      break;
    }
  }
  if (alreadyClosedEarly) {
    console.log("\n✓ seed-period-close complete (no-op: period already closed)");
    return 0;
  }

  // -------------------------------------------------------------------------
  // Step 1: Open the period (idempotent)
  // -------------------------------------------------------------------------
  let openResult: ReturnType<typeof openPeriod>;
  try {
    openResult = openPeriod({
      eventStore: db,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        periodId: PERIOD_ID,
        periodKind: "month",
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        openedAt: OPENED_AT,
        functionalCurrency: "ZAR",
      },
      asOf: OPENED_AT,
    });
  } catch (err) {
    console.error(`[seed-period-close] ERROR opening period: ${String(err)}`);
    return 1;
  }

  if (openResult.appended) {
    console.log(`✓ Period opened — event_id=${openResult.event.event_id}`);
  } else {
    console.log(`  Period already open (idempotent) — event_id=${openResult.event.event_id}`);
  }

  // -------------------------------------------------------------------------
  // Step 2: Emit an interim TrialBalanceSnapshotted
  // -------------------------------------------------------------------------
  try {
    const snapResult = snapshotTrialBalance({
      eventStore: db,
      entity: ENTITY,
      periodId: PERIOD_ID,
      snapshotAt: SNAPSHOT_AT,
      actor: ACTOR,
      citations: CITATIONS,
    });
    console.log(
      `✓ Interim trial balance snapshot — event_id=${snapResult.snapshotEvent.event_id}, rows=${snapResult.trialBalance.rows.length}, uptoSequence=${snapResult.trialBalance.uptoSequence}`,
    );
  } catch (err) {
    console.error(`[seed-period-close] ERROR snapshotting trial balance: ${String(err)}`);
    return 1;
  }

  // -------------------------------------------------------------------------
  // Step 3: Close the period
  // -------------------------------------------------------------------------
  // Note: the early-exit guard above handles the already-closed case; this
  // path only runs when the period is open and not yet closed.
  try {
    const closeResult = closePeriod({
      eventStore: db,
      entity: ENTITY,
      periodId: PERIOD_ID,
      closedAt: CLOSED_AT,
      actor: ACTOR,
      citations: CITATIONS,
    });
    console.log(
      `✓ Period closed — closedEvent=${closeResult.accountingPeriodClosedEvent.event_id}, TB rows=${closeResult.trialBalance.rows.length}, uptoSequence=${closeResult.trialBalance.uptoSequence}`,
    );
  } catch (err) {
    console.error(`[seed-period-close] ERROR closing period: ${String(err)}`);
    return 1;
  }

  console.log("\n✓ seed-period-close complete");
  return 0;
}

process.exit(main());
