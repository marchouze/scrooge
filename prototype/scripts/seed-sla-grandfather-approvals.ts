// scripts/seed-sla-grandfather-approvals.ts
//
// Seed build-phase grandfather approvals for every in-force IFRS SLA rule
// version (Phase 4c — the CRITICAL non-regression step). D-SLA-ENGINE-RULES-AS-
// DATA Phase 4c; D-SLA-APPROVAL-WORKFLOW-SEGREGATION.
//
// Running this is REQUIRED before the approval-eligibility gate can post: a rule
// without a four-eyes SlaRuleApproved is ineligible. The seed grandfathers the
// IFRS production basis so production posting is unchanged; the SARB-BA-RETURN
// representation is deliberately NOT grandfathered (it activates later through
// the real CFO+CoSec joint workflow).
//
// IDEMPOTENT: a rule/version already carrying an approval is skipped.
//
// Usage:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//   bun run scripts/seed-sla-grandfather-approvals.ts
//
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4c); D-SLA-APPROVAL-WORKFLOW-SEGREGATION.

import { seedGrandfatherApprovals } from "../platform/accounting/sla/grandfather";
import { EventStore } from "../platform/event-store/store";

/** Fixed early seed instant so grandfathers precede later real approvals. */
const GRANDFATHER_AS_OF = "2026-01-01T00:00:00.000Z";

function main(): void {
  const eventDbPath = process.env.BANK_EVENT_DB;
  if (!eventDbPath) {
    console.error("[seed-sla-grandfather] ERROR: BANK_EVENT_DB not set.");
    process.exit(1);
  }
  const store = new EventStore(eventDbPath);
  const res = seedGrandfatherApprovals(store, GRANDFATHER_AS_OF);
  console.log(
    `[seed-sla-grandfather] seeded ${res.seeded.length} grandfather approval(s); ` +
      `skipped ${res.skipped.length} already-approved.`,
  );
  if (res.seeded.length > 0) {
    console.log(`[seed-sla-grandfather] newly grandfathered: ${res.seeded.join(", ")}`);
  }
  store.close();
}

main();
