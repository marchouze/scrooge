// platform/accounting/sla/approval-loader.ts
//
// Approval-corpus loader (Phase 4c). Maps the append-only SLA approval event
// family (SlaRulePublished / SlaRuleApproved / SlaRuleWithheld) into the pure
// `ApprovalCorpus` the eligibility core (`approval.ts`) consumes.
//
// This is the AUDITABLE projection step: the caller (the production GL cutover
// seam + the recon) replays the approval stream ONCE, in append order, and
// hands the corpus to `computeEligibility`. The interpreter stays pure — it
// never touches the store; it receives the eligible-key set as data.
//
// Append-order preservation (last-writer-wins veto/restore): the single ordered
// `events` array yields the `decisions` list in the order approve/withhold
// events were appended, so a re-approval after a withhold naturally supersedes.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4c, CEO-approved 2026-06-06).

import type {
  SlaRuleApprovedPayload,
  SlaRulePublishedPayload,
  SlaRuleWithheldPayload,
} from "../../event-store/event-types/sla-approval";
import type { Event } from "../../event-store/types";
import type { ApprovalCorpus, ApprovalDecision, PublishRecord } from "./approval";

/**
 * Build the `ApprovalCorpus` from a slice of the event stream. Only the three
 * approval event types are consulted; everything else is ignored.
 *
 * Decision ordering (last-writer-wins veto/restore): the approve + withhold
 * decisions are sorted by `as_of` (ISO timestamp, lexicographically ordered)
 * with the input position as a stable tiebreak. The caller may therefore pass
 * the three types concatenated in any order (e.g. one filtered replay per type)
 * — the loader re-establishes chronological order. A grandfather seed (one
 * instant) precedes later real approvals, which precede later withholds, exactly
 * as the as_of timeline dictates.
 */
export function loadApprovalCorpus(events: readonly Event[]): ApprovalCorpus {
  const published: PublishRecord[] = [];
  const decisionsWithOrder: Array<{ asOf: string; seq: number; decision: ApprovalDecision }> = [];
  let seq = 0;

  for (const e of events) {
    if (e.type === "SlaRulePublished") {
      const p = e.payload as SlaRulePublishedPayload;
      published.push({
        representation: p.representation,
        ruleId: p.ruleId,
        version: p.version,
        publisherName: p.publisher.name,
        publisherPosition: p.publisher.position,
        ruleContentHash: p.ruleContentHash,
      });
    } else if (e.type === "SlaRuleApproved") {
      const p = e.payload as SlaRuleApprovedPayload;
      decisionsWithOrder.push({
        asOf: e.as_of,
        seq: seq++,
        decision: {
          kind: "approve",
          representation: p.representation,
          ruleId: p.ruleId,
          version: p.version,
          approverName: p.approver.name,
          approverPosition: p.approver.position,
          reviewedRuleHash: p.reviewedRuleHash,
          reviewedPreviewHash: p.reviewedPreviewHash,
          grandfather: p.grandfather ?? false,
        },
      });
    } else if (e.type === "SlaRuleWithheld") {
      const p = e.payload as SlaRuleWithheldPayload;
      decisionsWithOrder.push({
        asOf: e.as_of,
        seq: seq++,
        decision: {
          kind: "withhold",
          representation: p.representation,
          ruleId: p.ruleId,
          version: p.version,
          approverName: p.approver.name,
          reason: p.reason,
        },
      });
    }
  }

  decisionsWithOrder.sort((a, b) => (a.asOf === b.asOf ? a.seq - b.seq : a.asOf < b.asOf ? -1 : 1));
  const decisions = decisionsWithOrder.map((d) => d.decision);

  return { published, decisions };
}
