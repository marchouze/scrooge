// scripts/seed-correspondent-drawdown.ts
//
// One-time, idempotent build-phase nudge: drive a single CorrespondentNostroSimulator
// tick against the live event store with an opening balance below the RAS intraday
// floor, forcing a floor breach. The breach emits:
//   1. FundingDrawnDown — the correspondent draws on the bank's intraday line; and
//   2. SettlementInstructionIssued — the paired repayment leg (a non-trade
//      contractual outflow, BA 325 §23) that lands in the LCR 30-day denominator
//      via buildSettlementOutflows (alm-positions.ts).
//
// This closes the "SettlementInstructionIssued: 0 settlement instructions within
// 30-day horizon" ALM substrate gap on the treasury dashboard. The PERSISTENT
// wiring lives in correspondent-nostro-sim.ts tick(); this script just populates
// the build-phase baseline once. Re-runs are no-ops once an in-horizon repayment
// instruction exists.
//
// Provenance: emitted events are untagged → treated as `simulated` by the
// projection-runtime provenance filter (build-phase posture).
//
// Environment:
//   BANK_EVENT_DB   path to SQLite event store (default: $HOME/.local/share/bank/event.db)
//
// Authority: D-FX-CLS-MEMBERSHIP; BCBS 248; Banks Act 94 of 1990 Reg 26; BA 325 §23.
// Author: Tomas (Operations & payments engineer, engineering); consumed by the
//   LCR fold owned by Ravi (Treasury and ALM engineer, engineering).

import { nowUtc } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";
import { CorrespondentNostroSimulator } from "../platform/simulation/env-sim/correspondent-nostro-sim";

/** Deterministic PRNG (mulberry32) — no Math.random / wall-clock. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HORIZON_DAYS = 30;

function main(): number {
  const eventDbPath = process.env.BANK_EVENT_DB ?? `${process.env.HOME}/.local/share/bank/event.db`;
  const store = new EventStore(eventDbPath);

  console.log("\nseed-correspondent-drawdown — correspondent intraday repayment instruction");
  console.log(`Event store: ${eventDbPath}`);
  console.log("─".repeat(60));

  // Idempotency guard: no-op if an in-horizon SettlementInstructionIssued repayment
  // already exists (matching the SI-REPAY-* convention emitted by the simulator).
  const asOfDate = new Date(nowUtc());
  const horizonDate = new Date(asOfDate);
  horizonDate.setUTCDate(horizonDate.getUTCDate() + HORIZON_DAYS);

  for (const ev of store.replay({ type: "SettlementInstructionIssued" })) {
    const p = ev.payload as { settlementInstructionId?: string; settlementDate?: string };
    if (!p.settlementInstructionId?.startsWith("SI-REPAY-")) continue;
    if (!p.settlementDate) continue;
    const sd = new Date(p.settlementDate);
    if (sd >= asOfDate && sd <= horizonDate) {
      console.log(
        `  In-horizon repayment instruction already present (no-op): ${p.settlementInstructionId}`,
      );
      console.log("\n✓ seed-correspondent-drawdown complete (no-op)");
      return 0;
    }
  }

  // Drive the real simulator code path with an opening balance below the floor
  // (R40m < R50m RAS floor) so the very first tick breaches and draws.
  const sim = new CorrespondentNostroSimulator({
    store,
    rng: mulberry32(0x5eed01),
    intervalMs: 60_000,
    openingBalanceMinor: 40_000_000_00n,
  });

  let drewAt = -1;
  for (let i = 0; i < 5; i++) {
    const r = sim.tick();
    if (r.fundingDrawn) {
      drewAt = i;
      console.log(
        `  Tick ${i}: FundingDrawnDown + repayment instruction emitted (drawn ZAR ${(Number(r.drawnAmountMinor) / 100).toLocaleString()}).`,
      );
      break;
    }
  }

  if (drewAt < 0) {
    console.error(
      "[seed-correspondent-drawdown] ERROR: no floor breach across 5 ticks — no draw emitted.",
    );
    return 1;
  }

  const instructions = [...store.replay({ type: "SettlementInstructionIssued" })].filter((ev) =>
    (ev.payload as { settlementInstructionId?: string }).settlementInstructionId?.startsWith(
      "SI-REPAY-",
    ),
  );
  console.log(`  SettlementInstructionIssued (SI-REPAY-*) now in store: ${instructions.length}`);
  console.log("\n✓ seed-correspondent-drawdown complete");
  return 0;
}

process.exit(main());
