// platform/event-store/event-types/sla-approval.ts
//
// SLA rule approval-workflow event family (Phase-0 design spec §9.3;
// D-SLA-ENGINE-RULES-AS-DATA Phase 4c).
//
// The governance gate that makes a rule/version interpreter-eligible only after
// an attested four-eyes approval. Three append-only event kinds:
//
//   SlaRulePublished — a rule/version is published for review. Carries the
//     publishing seat (name + position) and the reviewed rule-content hash. A
//     publish is NOT yet eligible; it opens the pending queue.
//   SlaRuleApproved  — an approver (name + position) attests they reviewed the
//     identified rule/version + preview hash and approve it for production
//     eligibility. The interpreter treats a rule/version as eligible only when
//     a matching SlaRuleApproved exists whose approver ≠ publisher (four-eyes,
//     Owen control i). Grandfathered in-force rules satisfy this via a seeded
//     build-phase grandfather approval (approver = the engineering seat,
//     recordedVia a backfill).
//   SlaRuleWithheld  — an approver declines a published rule/version, with a
//     reason. A withheld rule is NOT eligible.
//
// APPEND-ONLY (Owen control iii): corrections are NEW events, never edits. A
// rule withheld in error is re-published (new SlaRulePublished) and re-approved;
// an approval granted in error is followed by a withholding event — the audit
// trail shows the full sequence.
//
// PRINCIPLE-6 BOUNDARY (Owen control iv): approval gates the RULE, never an
// individual booking. There is no per-entry approval surface anywhere. Once a
// rule/version is approved, every posting it produces flows autonomously.
//
// ─── Identity (the attestation, Owen control ii) ────────────────────────────
// Both `publisher` and `approver` carry name + position (e.g. "Bea",
// "Accounting & financial reporting engineer, engineering" / "Camille", "CFO,
// governance"). This is the named attestation an auditor relies on: who
// published which rule version, and who — a DIFFERENT seat — approved it after
// reviewing which preview hash. The envelope `actor` is the system/service that
// recorded the event; the `publisher`/`approver` are the accountable seats.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4c, CEO-approved 2026-06-06);
//            D-SLA-APPROVAL-WORKFLOW-SEGREGATION (CoSec Owen — the 5 controls);
//            D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL (CoSec — CFO+CoSec joint).
// Citations: Principles/1-events-are-truth.md (append-only),
//            Principles/6-autonomous-by-default.md (rule-level gate, not per-entry).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

/** A named accountable seat — name + position, paired on every reference. */
export const slaSeatSchema = z.object({
  /** The seat's name (e.g. "Bea", "Camille", "Owen"). */
  name: z.string().min(1),
  /** The seat's position (e.g. "CFO, governance"). */
  position: z.string().min(1),
});

export type SlaSeat = z.infer<typeof slaSeatSchema>;

/** A canonical rule/version reference shared by the whole family. */
const ruleVersionFields = {
  /** The SLA representation the rule belongs to (e.g. "IFRS", "SARB-BA-RETURN"). */
  representation: z.string().min(1),
  /** The rule id (e.g. "PR-FX-001-BA"). */
  ruleId: z.string().min(1),
  /** The rule version (1-based, monotonic per lineage). */
  version: z.number().int().min(1),
} as const;

// ---------------------------------------------------------------------------
// SlaRulePublished
// ---------------------------------------------------------------------------

export const slaRulePublishedPayloadSchema = z.object({
  ...ruleVersionFields,
  /** The publishing seat (name + position). */
  publisher: slaSeatSchema,
  /**
   * A content hash of the published rule body (the template the reviewer will
   * inspect). The approver re-states this (as `reviewedRuleHash`) so the
   * approval is provably AGAINST the published content — a later in-place edit
   * (which is forbidden anyway) would change the hash and break the link.
   */
  ruleContentHash: z.string().min(1),
  /** Optional free-text note from the publisher. */
  note: z.string().optional(),
});

export type SlaRulePublishedPayload = z.infer<typeof slaRulePublishedPayloadSchema>;

export function makeSlaRulePublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SlaRulePublishedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SlaRulePublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: slaRulePublishedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SlaRuleApproved
// ---------------------------------------------------------------------------

export const slaRuleApprovedPayloadSchema = z.object({
  ...ruleVersionFields,
  /** The approving seat (name + position). MUST differ from the publisher. */
  approver: slaSeatSchema,
  /**
   * The rule-content hash the approver reviewed — restates the published
   * `ruleContentHash`. The recon asserts an approval references a content the
   * publisher actually published (provenance link, Owen control ii).
   */
  reviewedRuleHash: z.string().min(1),
  /**
   * The hash of the side-by-side representation preview the approver inspected
   * (the auditor's "what did they actually look at"). Bound into the attestation
   * so an approval cannot be claimed without a concrete reviewed artefact.
   */
  reviewedPreviewHash: z.string().min(1),
  /**
   * Build-phase grandfather marker. `true` ⇒ this is the seeded grandfather
   * approval for a rule already in force before the approval gate landed
   * (non-regression). Real approvals omit it / set it false. The recon counts
   * grandfathers as valid four-eyes approvals (approver = engineering seat,
   * publisher = the same lineage's authoring seat — still author ≠ approver is
   * enforced).
   */
  grandfather: z.boolean().optional(),
  /** Optional free-text note from the approver. */
  note: z.string().optional(),
});

export type SlaRuleApprovedPayload = z.infer<typeof slaRuleApprovedPayloadSchema>;

export function makeSlaRuleApproved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SlaRuleApprovedPayload;
  eventId?: string;
}): Event {
  const payload = slaRuleApprovedPayloadSchema.parse(args.payload);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SlaRuleApproved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload,
  });
}

// ---------------------------------------------------------------------------
// SlaRuleWithheld
// ---------------------------------------------------------------------------

export const slaRuleWithheldPayloadSchema = z.object({
  ...ruleVersionFields,
  /** The seat withholding approval (name + position). */
  approver: slaSeatSchema,
  /** Why approval was withheld (mandatory — no silent withholding). */
  reason: z.string().min(1),
});

export type SlaRuleWithheldPayload = z.infer<typeof slaRuleWithheldPayloadSchema>;

export function makeSlaRuleWithheld(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SlaRuleWithheldPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SlaRuleWithheld",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: slaRuleWithheldPayloadSchema.parse(args.payload),
  });
}
