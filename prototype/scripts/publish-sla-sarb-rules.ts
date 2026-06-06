// prototype/scripts/publish-sla-sarb-rules.ts
//
// Publish the SARB-BA-RETURN rule set for governance review (SARB activation
// Round 1). D-SLA-ENGINE-RULES-AS-DATA Phase 4c; spec §9.5 activation runbook
// (D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL).
//
// Emits a SlaRulePublished (publisher = Bea, the authoring/engineering seat) for
// every SARB-BA-RETURN rule version. PUBLISH ONLY — no SlaRuleApproved, no change
// to PRODUCTION_REPRESENTATIONS. The rules stay INELIGIBLE: they open the
// pending-review queue for the Round-2 CFO four-eyes approval (approver ≠
// publisher). SARB stays inert in production.
//
// Wired into `ci:migrate` (after backfill:sla-grandfather) so the publish events
// reproduce deterministically in any fresh store — the recon + CI replay them.
// Idempotent: a SARB rule/version already published by the Bea seat is skipped
// (dedupe on representation+rule_id+version+publisher). Append-only.
//
// Run from prototype/: bun run scripts/publish-sla-sarb-rules.ts
// Live home store:     BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/publish-sla-sarb-rules.ts
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { publishSarbBaReturnRules } from "../platform/accounting/sla/publish-sarb";
import { eventStore } from "../platform/composition";

/** Fixed publish instant so the Round-1 publishes precede any later Round-2 approval. */
const PUBLISH_AS_OF = "2026-06-06T00:00:00.000Z";

const res = publishSarbBaReturnRules(eventStore, PUBLISH_AS_OF);
const hashLines = res.contentHashes
  .map((h) => `  ${h.ruleId}@v${h.version}  contentHash=${h.contentHash}`)
  .join("\n");
// eslint-disable-next-line no-console
console.log(
  `[publish-sla-sarb-rules] published ${res.published.length} SARB-BA-RETURN rule(s) for review; skipped ${res.skipped.length} already-published.\n${hashLines}`,
);
