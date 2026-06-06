// platform/accounting/sla/grandfather.ts
//
// Build-phase grandfather backfill (Phase 4c — the CRITICAL non-regression
// step). D-SLA-ENGINE-RULES-AS-DATA Phase 4c.
//
// Introducing the approval-eligibility gate (spec §9.3) would make EVERY
// existing in-force rule ineligible and break production posting. This backfill
// seeds a grandfather approval for each in-force IFRS rule version so they stay
// eligible — and ONLY the IFRS rules (the live production basis). The SARB-BA-
// RETURN representation is deliberately NOT grandfathered: it stays ineligible
// until the post-4c CFO+CoSec joint activation round approves it through the
// real workflow.
//
// Each grandfather seeds a PAIR (append-only, four-eyes-clean):
//   - SlaRulePublished — publisher = the authoring seat (Bea), with the rule's
//     content hash.
//   - SlaRuleApproved{grandfather:true} — approver = a DIFFERENT engineering
//     seat (Atlas), reviewedRuleHash = the published content hash,
//     reviewedPreviewHash = a deterministic grandfather marker. author ≠ approver
//     holds (Owen control i), so the grandfather is a genuine four-eyes record,
//     not a self-approval.
//
// IDEMPOTENT: a rule/version that already has a SlaRuleApproved (grandfather or
// real) is skipped. Re-running the seed is a no-op.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4c, CEO-approved 2026-06-06);
//            D-SLA-APPROVAL-WORKFLOW-SEGREGATION (CoSec Owen).

import {
  makeSlaRuleApproved,
  makeSlaRulePublished,
} from "../../event-store/event-types/sla-approval";
import type { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";
import { approvalKey, ruleApprovalKey, ruleContentHash } from "./approval";
import type { SlaRule } from "./generated/sla-types";
import { ALL_SLA_RULES } from "./rules/all-rules";

/** The authoring seat (publisher of the grandfather record). */
export const GRANDFATHER_PUBLISHER = {
  name: "Bea",
  position: "Accounting & financial reporting engineer, engineering",
} as const;

/** The approving seat — a DIFFERENT engineering seat (four-eyes). */
export const GRANDFATHER_APPROVER = {
  name: "Atlas",
  position: "Core banking platform architect, engineering",
} as const;

/** Deterministic preview-hash marker for a grandfather approval. */
export function grandfatherPreviewHash(rule: SlaRule): string {
  return `grandfather:${ruleContentHash(rule)}`;
}

const SEED_ACTOR: Actor = { type: "service", id: "sla-grandfather-backfill" };
const SEED_ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = [
  "D-SLA-ENGINE-RULES-AS-DATA",
  "D-SLA-APPROVAL-WORKFLOW-SEGREGATION",
  "Principles/1-events-are-truth.md",
];

/** The in-force IFRS rules to grandfather — every rule on the production basis. */
export function inForceIfrsRules(): readonly SlaRule[] {
  return ALL_SLA_RULES.filter((r) => r.representation === "IFRS");
}

export interface GrandfatherSeedResult {
  readonly seeded: readonly string[];
  readonly skipped: readonly string[];
}

/**
 * Seed a grandfather approval pair for every in-force IFRS rule version that does
 * not yet carry an approval. Idempotent. The `asOf` is the seed instant — set it
 * to a fixed early timestamp so grandfathers precede any later real approval on
 * the as_of timeline (last-writer-wins ordering in the eligibility core).
 */
export function seedGrandfatherApprovals(store: EventStore, asOf: string): GrandfatherSeedResult {
  // Existing approval keys (any SlaRuleApproved present → already covered).
  const existing = new Set<string>();
  for (const e of store.replay({ type: "SlaRuleApproved" })) {
    const p = e.payload as { representation?: string; ruleId?: string; version?: number };
    if (
      typeof p.representation === "string" &&
      typeof p.ruleId === "string" &&
      typeof p.version === "number"
    ) {
      existing.add(
        approvalKey({ representation: p.representation, ruleId: p.ruleId, version: p.version }),
      );
    }
  }

  const seeded: string[] = [];
  const skipped: string[] = [];

  for (const rule of inForceIfrsRules()) {
    const key = ruleApprovalKey(rule);
    if (existing.has(key)) {
      skipped.push(key);
      continue;
    }
    const contentHash = ruleContentHash(rule);

    store.append(
      makeSlaRulePublished({
        asOf,
        entity: SEED_ENTITY,
        actor: SEED_ACTOR,
        citations: CITATIONS,
        payload: {
          representation: rule.representation,
          ruleId: rule.rule_id,
          version: rule.version,
          publisher: GRANDFATHER_PUBLISHER,
          ruleContentHash: contentHash,
          note: "build-phase grandfather publish — rule already in force before the approval gate landed",
        },
      }),
    );

    store.append(
      makeSlaRuleApproved({
        asOf,
        entity: SEED_ENTITY,
        actor: SEED_ACTOR,
        citations: CITATIONS,
        payload: {
          representation: rule.representation,
          ruleId: rule.rule_id,
          version: rule.version,
          approver: GRANDFATHER_APPROVER,
          reviewedRuleHash: contentHash,
          reviewedPreviewHash: grandfatherPreviewHash(rule),
          grandfather: true,
          note: "build-phase grandfather approval — keeps the in-force rule eligible (non-regression)",
        },
      }),
    );

    existing.add(key);
    seeded.push(key);
  }

  return { seeded, skipped };
}
