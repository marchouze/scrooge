// scripts/run-reconciliation.ts
//
// CLI script to run the three-way reconciliation harness (PROC-PAY-RBH-01).
//
// Usage:
//   bun run scripts/run-reconciliation.ts [--date YYYY-MM-DD] [--dry-run]
//
// Flags:
//   --date YYYY-MM-DD   Run reconciliation for this date (default: today UTC)
//   --dry-run           Read event store and compute result but do NOT emit events
//
// Authority: PROC-PAY-RBH-01, NPS-ACT-78-1998, BANKS-ACT-94-1990
// Author: Atlas (Core Banking Platform Architect, engineering)

import { runThreeWayReconciliation } from "../platform/payments/reconciliation";

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let asOf: string | undefined;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--date" && args[i + 1]) {
    asOf = args[++i];
  } else if (args[i] === "--dry-run") {
    dryRun = true;
  }
}

// Default to today UTC.
if (!asOf) {
  asOf = new Date().toISOString().slice(0, 10);
}

// Validate date format.
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
  console.error(`ERROR: --date must be in YYYY-MM-DD format, got: ${asOf}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Run reconciliation
// ---------------------------------------------------------------------------

console.log(`Running three-way reconciliation for asOf=${asOf}${dryRun ? " (dry-run)" : ""}`);
console.log("Authority: PROC-PAY-RBH-01, NPS-ACT-78-1998, BANKS-ACT-94-1990");
console.log("");

const result = runThreeWayReconciliation(asOf, dryRun);

console.log("Result:");
console.log(`  matchedCount : ${result.matchedCount}`);
console.log(`  breakCount   : ${result.breakCount}`);
console.log("");

if (result.breakCount === 0) {
  console.log("Clean — all trade IDs matched across all three legs.");
} else {
  console.log(`Breaks (${result.breakCount}):`);
  for (const b of result.breaks) {
    console.log(`  [${b.kind}] ${b.tradeId}: ${b.description}`);
    if (b.tradeAmount !== undefined) {
      console.log(`    tradeAmount   = ${b.tradeAmount}`);
    }
    if (b.paymentAmount !== undefined) {
      console.log(`    paymentAmount = ${b.paymentAmount}`);
    }
  }
}

console.log("");
if (dryRun) {
  console.log("Dry-run complete. No events were emitted.");
} else {
  console.log(
    `Events emitted: ${result.breakCount} ReconciliationBreak + 1 DailyReconciliationReport.`,
  );
}
