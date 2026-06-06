// prototype/scripts/backfill-sla-grandfather-approvals.ts
//
// Backfill build-phase grandfather approvals for every in-force IFRS SLA rule
// version (Phase 4c — the CRITICAL non-regression step). D-SLA-ENGINE-RULES-AS-
// DATA Phase 4c; D-SLA-APPROVAL-WORKFLOW-SEGREGATION.
//
// Wired into `ci:migrate` so the approval-eligibility gate is satisfied
// deterministically in CI: every in-force IFRS rule carries a four-eyes
// grandfather approval, so `recon:sla-approval-workflow` (a) passes and the
// production FX posting path stays eligible (non-regression). The SARB-BA-RETURN
// representation is deliberately NOT grandfathered — it activates later through
// the real CFO+CoSec joint workflow.
//
// Idempotent: a rule/version already carrying an approval is skipped. Uses the
// composition-resolved event store (same store the recon reads), mirroring the
// other ci:migrate backfills.
//
// Run from prototype/: bun run scripts/backfill-sla-grandfather-approvals.ts
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { seedGrandfatherApprovals } from "../platform/accounting/sla/grandfather";
import { eventStore } from "../platform/composition";

/** Fixed early seed instant so grandfathers precede later real approvals. */
const GRANDFATHER_AS_OF = "2026-01-01T00:00:00.000Z";

const res = seedGrandfatherApprovals(eventStore, GRANDFATHER_AS_OF);
// eslint-disable-next-line no-console
console.log(
  `[backfill-sla-grandfather] seeded ${res.seeded.length} grandfather approval(s); ` +
    `skipped ${res.skipped.length} already-approved.`,
);
