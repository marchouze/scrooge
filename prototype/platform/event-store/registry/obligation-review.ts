// platform/event-store/registry/obligation-review.ts
//
// Obligation-review event-type registry rows.
//
// Covers:
//   - ObligationReviewMatched — Mira's LLM-extraction asserts a match with
//     an existing obligation-register row.
//   - ObligationReviewConflict — LLM extraction disagrees with an existing
//     row; routed to review queue.
//   - ObligationCandidateProposed — LLM produces an obligation with no
//     matching register row; routed to review queue as new candidate.
//   - ObligationReviewCompleted — governance seat (or Marc as build-phase
//     fallback) closes the queued obligation with confirmed / modified /
//     retired status.
//
// All four are governance-class, append-only-audit. The Vera advisory
// recons (`recon:obligation-policy-coverage` + `recon:obligation-review-
// status`) consume them.
//
// Authority:
//   - D-OBLIGATION-REVIEW-SUBSTRATE (CEO-approved 2026-05-21 via session
//     delegation; event b913e7c0-99f0-4864-9645-54b96510718a).
//   - D-KG-GRAPHITI-ADOPT (CEO-approved 2026-05-21 via session delegation).
//   - P2-SINGLE-GRAPH-DISCIPLINE (Principle 2).
//   - P1-EVENTS-AS-TRUTH (Principle 1).
//
// Author: Atlas (Core banking platform architect, engineering).

import {
  obligationCandidateProposedPayloadSchema,
  obligationReviewCompletedPayloadSchema,
  obligationReviewConflictPayloadSchema,
  obligationReviewMatchedPayloadSchema,
} from "../event-types/obligation-review";
import { RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const SHARED_CITATIONS = [
  "D-OBLIGATION-REVIEW-SUBSTRATE",
  "D-KG-GRAPHITI-ADOPT",
  "P2-SINGLE-GRAPH-DISCIPLINE",
  "P1-EVENTS-AS-TRUTH",
] as const;

const SHARED_SUBSCRIBERS = [
  // Mira (Compliance / RegTech engineer, engineering) — emits the upstream
  // events from her extraction pipeline and consumes review-completed.
  "Mira",
  // Owen (Company Secretary, governance) — owns the obligations-register
  // governance surface; column extension lives in his WS-URN-VOCABULARY PR.
  "Owen",
  // Zara (Chief Compliance Officer, governance) — register curator under
  // whose mandate Mira operates.
  "Zara",
  // Vera (Internal audit engineer, engineering) — runs the advisory recons.
  "Vera",
  // Atlas (Core banking platform architect, engineering) — substrate steward.
  "Atlas",
] as const;

export const OBLIGATION_REVIEW_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "ObligationReviewMatched",
    class: "governance",
    issuer: "Mira",
    subscribers: SHARED_SUBSCRIBERS,
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: obligationReviewMatchedPayloadSchema,
    citationsHint: SHARED_CITATIONS,
    source: "platform/event-store/event-types/obligation-review.ts",
    v2Status: "v1-only",
  },
  {
    type: "ObligationReviewConflict",
    class: "governance",
    issuer: "Mira",
    subscribers: SHARED_SUBSCRIBERS,
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: obligationReviewConflictPayloadSchema,
    citationsHint: SHARED_CITATIONS,
    source: "platform/event-store/event-types/obligation-review.ts",
    v2Status: "v1-only",
  },
  {
    type: "ObligationCandidateProposed",
    class: "governance",
    issuer: "Mira",
    subscribers: SHARED_SUBSCRIBERS,
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: obligationCandidateProposedPayloadSchema,
    citationsHint: SHARED_CITATIONS,
    source: "platform/event-store/event-types/obligation-review.ts",
    v2Status: "v1-only",
  },
  {
    type: "ObligationReviewCompleted",
    class: "governance",
    // Issued by any governance seat (CCO, CoSec, Compliance) or by the CEO
    // (Marc) as build-phase fallback. `any-agent` here defers issuer
    // restriction to the permission-gate layer.
    issuer: "any-agent",
    subscribers: SHARED_SUBSCRIBERS,
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    // `obligationReviewCompletedPayloadSchema` is a refined Zod schema;
    // ZodEffects is still a ZodType<Record<string, unknown>> for registry
    // purposes (the .parse() surface is what the append path uses).
    payloadSchema: obligationReviewCompletedPayloadSchema,
    citationsHint: SHARED_CITATIONS,
    source: "platform/event-store/event-types/obligation-review.ts",
    v2Status: "v1-only",
  },
];
