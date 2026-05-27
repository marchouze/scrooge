#!/usr/bin/env bun
// scripts/run-helena-appetite-watch.ts
//
// Standalone runner for Helena's risk-appetite-watch handler.
// Thin wrapper around `runtime/agents/helena-risk-appetite-watch.ts`;
// builds an AgentRunContext and delegates directly to the handler.
//
// Usage:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/run-helena-appetite-watch.ts
//
// Options:
//   --dry-run   Build the snapshot and narrative but do not append events
//               or write the Owner Inbox deliverable.
//
// What this emits:
//   - One `RiskAppetiteSnapshot` event to the shared event store
//   - Optionally one `AgentEscalation` if Tier-1 breaches are open
//   - An Owner Inbox markdown deliverable at
//     `Owner Inbox/<date>_helena_risk-appetite-watch.md`
//
// Exit codes:
//   0 — handler ran and `ok: true` (or dry-run succeeded)
//   1 — handler error
//
// Authority: D-FLEET-ROLLOUT-SEQUENCING; Team/Helena.md § 6 (Cadence);
//   Principles/6-autonomous-by-default.md.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { resolve } from "node:path";

import { clock } from "../platform/composition";
import handler from "../runtime/agents/helena-risk-appetite-watch";
import type { AgentRunContext } from "../runtime/types";

// ---------------------------------------------------------------------------
// Parse flags
// ---------------------------------------------------------------------------

const dryRun = process.argv.includes("--dry-run");
const asOf = clock.now();

// ---------------------------------------------------------------------------
// Resolve repo root (script lives in prototype/scripts/ — root is one level up)
// ---------------------------------------------------------------------------

const repoRoot = resolve(import.meta.dir, "../../");

// ---------------------------------------------------------------------------
// Build AgentRunContext
// ---------------------------------------------------------------------------

const ctx: AgentRunContext = {
  agent: "Helena",
  trigger: { kind: "on-request", id: "run-helena-appetite-watch-script" },
  asOf,
  runId: `run:helena:${asOf.replace(/[:.]/g, "-")}`,
  repoRoot,
  ownerInboxDir: resolve(repoRoot, "Owner Inbox"),
  dryRun,
};

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log(`\nHelena risk-appetite-watch — ${dryRun ? "DRY RUN" : "LIVE"}`);
console.log(`As-of: ${asOf}`);
console.log("─".repeat(60));

const result = await handler(ctx);

console.log(`\n${result.summary}`);

if (result.ok) {
  if (!dryRun) {
    console.log(`\n✓ Events emitted: ${result.eventsEmitted}`);
    if (result.deliverable) {
      console.log(`✓ Deliverable: ${result.deliverable}`);
    }
  } else {
    console.log("\n✓ Dry-run complete (no events appended)");
  }
  process.exit(0);
} else {
  console.error("\n✗ Helena risk-appetite-watch handler returned ok=false");
  process.exit(1);
}
