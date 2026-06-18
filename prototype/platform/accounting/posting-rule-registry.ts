// platform/accounting/posting-rule-registry.ts
//
// RE-EXPORT SHIM. The posting-rule registry SCHEMA + DATA now live in the
// canonical home `v2-core/posting-rules/registry.ts` (WS-ACCT-FX-COMPLETENESS
// Slice 2, D-ACCT-SCHEMA-CANONICAL-HOME). This v1 module re-exports them so the
// many v1 importers (SLA rules, recon gates, dashboard, GL engine) keep working
// unchanged. The `recon:accounting-schema-home` gate enforces that the schema
// is not re-declared here.
//
// Authority: D-ACCT-SCHEMA-CANONICAL-HOME (CEO-approved 2026-06-18);
//   D-MARKETS-SCHEMA-FOUNDATION; D-ACCT-FX-IFRS-POSTING-COMPLETENESS.
// Author: Bea (Accounting & financial reporting engineer, engineering).

export {
  type TriggerDomain,
  type LifecycleStage,
  type PostingCondition,
  type PostingRuleEntry,
  triggerDomainSchema,
  lifecycleStageSchema,
  postingConditionSchema,
  postingRuleEntrySchema,
  PostingRuleEntrySchema,
  POSTING_RULE_REGISTRY,
  findEntriesForEventType,
  getMandatoryEntries,
  findEntriesForLifecycle,
  findEntryForRuleId,
} from "../../v2-core/posting-rules/registry";
