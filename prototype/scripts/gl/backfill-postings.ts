#!/usr/bin/env bun
// scripts/gl/backfill-postings.ts
//
// Backfill script: replays all payment and FX lifecycle events from the event
// store and emits SubLedgerPostingEmitted events for each, idempotently.
//
// Engine run:
//   - beaGlPostingEngine  → the SOLE posting path: payments
//     (PaymentInitiated / PaymentSettled / SettlementInstructionReceived),
//     treasury, securities, IRD, and FX lifecycle
//     (FxTradeExecuted / FxPositionRevalued / TradeMatured / FxTradeCancelled).
//     The redundant bea:fx-posting-engine was retired under
//     WS-SLA-FULL-RETIREMENT (D-SLA-ENGINE-RULES-AS-DATA).
//
// Usage:
//   bun run gl:backfill-postings
//   bun run gl:backfill-postings --dry-run
//
// Exit codes:
//   0 — completed without errors
//   1 — one or more events failed to post
//
// Authority:
//   - PROC-PAY-RBH-01 (three-way reconciliation procedure)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { clock } from "../../platform/composition";
import { beaGlPostingEngine } from "../../runtime/agents/bea-gl-posting-engine";
import type { AgentRunContext } from "../../runtime/types";

// ---------------------------------------------------------------------------
// Parse flags
// ---------------------------------------------------------------------------

const dryRun = process.argv.includes("--dry-run");
const asOf = clock.now();

// ---------------------------------------------------------------------------
// Build minimal AgentRunContext
// ---------------------------------------------------------------------------

const ctx: AgentRunContext = {
  agent: "Bea",
  trigger: { kind: "on-request", id: "gl-backfill-postings" },
  asOf,
  repoRoot: process.cwd(),
  ownerInboxDir: `${process.cwd()}/Owner Inbox`,
  dryRun,
};

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log(`\nGL Backfill Postings — ${dryRun ? "DRY RUN" : "LIVE"}`);
console.log(`As-of: ${asOf}`);
console.log("─".repeat(60));

const glResult = await beaGlPostingEngine(ctx);

console.log(`\n${glResult.summary}`);

const ok = glResult.ok;
const allErrors = [...((glResult as { errors?: string[] }).errors ?? [])];

if (ok) {
  console.log("\n✓ Completed successfully");
  if (dryRun) {
    console.log("  (dry-run: no events were appended to the event store)");
  }
  process.exit(0);
} else {
  console.error("\n✗ Completed with errors:");
  for (const err of allErrors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}
