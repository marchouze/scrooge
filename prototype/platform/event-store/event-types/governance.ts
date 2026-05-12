// platform/event-store/event-types/governance.ts
//
// Governance document-lifecycle event-payload schemas.
//
// Covers:
//   - DocumentRegistered — emitted whenever a versioned policy / charter /
//     procedure / report is registered in the canonical Policies/ directory.
//     The event carries a BLAKE3 content hash that CI enforces via the
//     document-registration recon pipeline.
//
// Authority: D-POLICY-DOCUMENT-HOME Option C (CEO-approved 2026-05-12).
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// DocumentRegistered
// ---------------------------------------------------------------------------

export const documentRegisteredPayloadSchema = z.object({
  /** Stable identifier — never changes across versions.
   *  Convention: `<kind>:<kebab-name>:v<n>`
   *  e.g. `policy:liquidity-risk-management:v1` */
  documentId: z.string().min(1),

  /** Human-readable title as it appears in the document frontmatter. */
  title: z.string().min(1),

  /** Document category. */
  kind: z.enum(["policy", "charter", "procedure", "report", "other"]),

  /** Canonical repo-relative path.
   *  e.g. `Policies/liquidity-risk-management-policy-v1.md` */
  filePath: z.string().min(1),

  /** BLAKE3 hash of the file content, prefixed `blake3:<hex>`.
   *  Computed by `platform/document-store/hash.ts`. */
  contentHash: z
    .string()
    .min(1)
    .regex(/^blake3:[0-9a-f]{64}$/, {
      message: "contentHash must be `blake3:<64 lowercase hex chars>`",
    }),

  /** Semantic version string — e.g. `"1.0.0"`. */
  version: z.string().min(1),

  /** Authors — agent URNs (`agent:<name>`) or email addresses. */
  authors: z.array(z.string().min(1)).min(1),

  /** ISO 8601 UTC timestamp when this event was emitted. */
  registeredAt: z.string().min(1),

  /** documentId of the prior version this supersedes, if any. */
  supersedes: z.string().min(1).optional(),
});

export type DocumentRegisteredPayload = z.infer<typeof documentRegisteredPayloadSchema>;

export function makeDocumentRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DocumentRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DocumentRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: documentRegisteredPayloadSchema.parse(args.payload),
  });
}
