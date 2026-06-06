// platform/accounting/sla/publish-sarb.ts
//
// SARB-BA-RETURN publish-for-review backfill (SARB activation Round 1 — engineering
// PUBLISHES the SARB rule set for governance approval). D-SLA-ENGINE-RULES-AS-DATA
// Phase 4c; spec §9.5 activation runbook (D-SLA-REPRESENTATION-ACTIVATION-JOINT-
// APPROVAL).
//
// This is the FIRST of the three activation rounds:
//   Round 1 (THIS) — engineering emits a SlaRulePublished for every SARB-BA-RETURN
//                    rule/version, publisher = Bea (the authoring seat). The rules
//                    remain INELIGIBLE: a publish opens the pending-review queue;
//                    it does NOT make a rule interpreter-eligible. No SlaRuleApproved
//                    is emitted here (four-eyes: the publisher is engineering; the
//                    CFO approves in Round 2).
//   Round 2 — the CFO emits SlaRuleApproved (approver ≠ publisher) against the
//             SAME content hashes published here, plus the CFO+CoSec joint
//             activation Decisions.
//   Round 3 — the production flip (PRODUCTION_REPRESENTATIONS gains SARB-BA-RETURN).
//
// CONTRAST WITH grandfather.ts: the grandfather backfill seeds a publish+approve
// PAIR for the in-force IFRS rules (non-regression). This module emits ONLY the
// publish leg, and ONLY for the SARB representation. SARB stays inert in
// production until Rounds 2+3 land.
//
// IDEMPOTENT: a SARB rule/version that already has a SlaRulePublished by the same
// publisher seat is skipped (dedupe on representation+rule_id+version+publisher).
// Re-running is a no-op. Append-only — never mutates an existing event.
//
// CONTENT HASH: uses `ruleContentHash` from approval.ts — the SAME hash the
// Round-2 SlaRuleApproved must restate as `reviewedRuleHash`. Publishing through
// this module guarantees the approver review-matches the published content.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4c, CEO-approved 2026-06-06);
//            D-SLA-APPROVAL-WORKFLOW-SEGREGATION (CoSec Owen — the 5 controls);
//            D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL (CoSec — CFO+CoSec joint).
// Citations: Principles/1-events-are-truth.md (append-only),
//            Principles/6-autonomous-by-default.md (rule-level gate).

import { makeSlaRulePublished } from "../../event-store/event-types/sla-approval";
import type { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";
import { ruleContentHash } from "./approval";
import type { SlaRule } from "./generated/sla-types";
import { ALL_SLA_RULES } from "./rules/all-rules";

/** The representation published for review in Round 1. */
export const SARB_REPRESENTATION = "SARB-BA-RETURN" as const;

/**
 * The publishing seat — engineering (Bea, the authoring seat). The Round-2
 * approver (the CFO) MUST be a different seat (four-eyes, Owen control i), which
 * is why this module emits no approval.
 */
export const SARB_PUBLISHER = {
  name: "Bea",
  position: "Accounting & financial reporting engineer, engineering",
} as const;

const PUBLISH_ACTOR: Actor = { type: "service", id: "sla-sarb-publish-backfill" };
const PUBLISH_ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = [
  "D-SLA-ENGINE-RULES-AS-DATA",
  "D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL",
  "Principles/1-events-are-truth.md",
];

/** Dedupe key for an already-published rule/version by a given publisher seat. */
function publishDedupeKey(args: {
  representation: string;
  ruleId: string;
  version: number;
  publisherName: string;
  publisherPosition: string;
}): string {
  return `${args.representation}::${args.ruleId}@${args.version}::${args.publisherName}|${args.publisherPosition}`;
}

/** The SARB-BA-RETURN rules to publish — every rule version on the SARB basis. */
export function sarbBaReturnRules(): readonly SlaRule[] {
  return ALL_SLA_RULES.filter((r) => r.representation === SARB_REPRESENTATION);
}

export interface SarbPublishResult {
  /** approvalKey-style strings for the rule/versions newly published. */
  readonly published: readonly string[];
  /** approvalKey-style strings skipped (already published by this seat). */
  readonly skipped: readonly string[];
  /** rule_id@version → content hash for every SARB rule (the Round-2 review set). */
  readonly contentHashes: ReadonlyArray<{
    readonly ruleId: string;
    readonly version: number;
    readonly contentHash: string;
  }>;
}

/**
 * Emit a SlaRulePublished (publisher = Bea) for every SARB-BA-RETURN rule version
 * not yet published by that seat. PUBLISH ONLY — no SlaRuleApproved. Idempotent.
 *
 * The `asOf` is the publish instant. The rules stay ineligible: the eligibility
 * core treats a publish-without-approve as pending, never eligible.
 */
export function publishSarbBaReturnRules(store: EventStore, asOf: string): SarbPublishResult {
  // Existing publishes by THIS publisher seat (idempotency).
  const existing = new Set<string>();
  for (const e of store.replay({ type: "SlaRulePublished" })) {
    const p = e.payload as {
      representation?: string;
      ruleId?: string;
      version?: number;
      publisher?: { name?: string; position?: string };
    };
    if (
      typeof p.representation === "string" &&
      typeof p.ruleId === "string" &&
      typeof p.version === "number" &&
      typeof p.publisher?.name === "string" &&
      typeof p.publisher?.position === "string"
    ) {
      existing.add(
        publishDedupeKey({
          representation: p.representation,
          ruleId: p.ruleId,
          version: p.version,
          publisherName: p.publisher.name,
          publisherPosition: p.publisher.position,
        }),
      );
    }
  }

  const published: string[] = [];
  const skipped: string[] = [];
  const contentHashes: Array<{ ruleId: string; version: number; contentHash: string }> = [];

  for (const rule of sarbBaReturnRules()) {
    const contentHash = ruleContentHash(rule);
    contentHashes.push({ ruleId: rule.rule_id, version: rule.version, contentHash });

    const dedupe = publishDedupeKey({
      representation: rule.representation,
      ruleId: rule.rule_id,
      version: rule.version,
      publisherName: SARB_PUBLISHER.name,
      publisherPosition: SARB_PUBLISHER.position,
    });
    const label = `${rule.representation}::${rule.rule_id}@${rule.version}`;
    if (existing.has(dedupe)) {
      skipped.push(label);
      continue;
    }

    store.append(
      makeSlaRulePublished({
        asOf,
        entity: PUBLISH_ENTITY,
        actor: PUBLISH_ACTOR,
        citations: CITATIONS,
        payload: {
          representation: rule.representation,
          ruleId: rule.rule_id,
          version: rule.version,
          publisher: SARB_PUBLISHER,
          ruleContentHash: contentHash,
          note: "SARB activation Round 1 — engineering publishes for governance (CFO) review; rule stays ineligible until a four-eyes SlaRuleApproved (Round 2)",
        },
      }),
    );

    existing.add(dedupe);
    published.push(label);
  }

  return { published, skipped, contentHashes };
}
