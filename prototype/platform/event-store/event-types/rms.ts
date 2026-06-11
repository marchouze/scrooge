// platform/event-store/event-types/rms.ts
//
// Records Management Substrate (RMS) event-payload schemas.
//
// Covers:
//   - DecisionRequested, Feedback, BriefSuperseded, RecordFiled
//   - CeoDecisionRmsExtended (additive payload schema for CeoDecision)
//
// Note: AgentBriefIssued, AgentRunStarted, AgentRunCompleted are co-located in
// agent.ts because they use the shared rmsAgentRefSchema + documentHashSchema
// defined there. The re-export at event-types/index.ts surfaces all symbols
// from a single surface.
//
// Authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09).
// F-020 split from the god-file `../event-types.ts`.
// Authors: Owen (Company Secretary, governance) + Atlas (substrate)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";
import { documentHashSchema, rmsAgentRefSchema } from "./agent";

// ---------------------------------------------------------------------------
// DecisionRequested (RMS-4)
// ---------------------------------------------------------------------------

export const decisionRequestedPayloadSchema = z.object({
  decisionId: z.string().min(1),
  title: z.string().min(1),
  category: z.enum([
    "pacing",
    "near-term",
    "second-order",
    "medium-term",
    "long-horizon",
    "substrate-foundational",
  ]),
  owner: rmsAgentRefSchema,
  forActor: z.enum(["CEO", "Board", "AC", "ALCO", "BRC"]),
  decisionForActor: z.string().min(1),
  recommendation: z.object({
    stance: z.string().min(1),
    reasoning: z.string().min(1),
  }),
  sourceDocumentHashes: z.array(documentHashSchema),
  citations: z.array(z.string().min(1)),
  deadline: z.string().min(1).optional(),
  options: z
    .array(
      z.object({
        label: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .optional(),
});

export type DecisionRequestedPayload = z.infer<typeof decisionRequestedPayloadSchema>;

export function makeDecisionRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DecisionRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DecisionRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: decisionRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Feedback (RMS-5)
// ---------------------------------------------------------------------------

export const feedbackPayloadSchema = z.object({
  feedbackId: z.string().min(1),
  from: z.object({
    actor: z.enum(["CEO", "Board", "Agent"]),
    identity: z.string().min(1),
    agent: rmsAgentRefSchema.optional(),
  }),
  channel: z.enum([
    "chat",
    "decisions-desk-comment",
    "register-annotation",
    "review-meeting-record",
  ]),
  intakeAt: z.string().min(1),
  subject: z.object({
    kind: z.enum(["decision", "brief", "run", "register", "policy", "principle", "operating-rule"]),
    ref: z.string().min(1),
  }),
  body: z.string().min(1),
  bodyDocumentHash: documentHashSchema.optional(),
  classifications: z
    .array(z.enum(["directive", "preference", "correction", "question", "praise", "concern"]))
    .min(1),
  routedTo: z.array(rmsAgentRefSchema).optional(),
});

export type FeedbackPayload = z.infer<typeof feedbackPayloadSchema>;

export function makeFeedback(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FeedbackPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "Feedback",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: feedbackPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BriefSuperseded (RMS-6)
// ---------------------------------------------------------------------------

export const briefSupersededPayloadSchema = z.object({
  originalBriefId: z.string().min(1),
  supersededBy: z.string().min(1),
  reason: z.enum(["withdrawn", "merged", "scope-changed", "actioned-out-of-band"]),
  authorisedBy: rmsAgentRefSchema,
});

export type BriefSupersededPayload = z.infer<typeof briefSupersededPayloadSchema>;

export function makeBriefSuperseded(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BriefSupersededPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BriefSuperseded",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: briefSupersededPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RecordFiled (RMS-7)
// ---------------------------------------------------------------------------

export const recordFiledPayloadSchema = z.object({
  recordId: z.string().min(1),
  registerKey: z.enum([
    "decisions",
    "correspondence",
    "agent-runs",
    "documents",
    "feedback",
    "briefs",
    "workstreams",
  ]),
  documentHash: documentHashSchema,
  classification: z.enum([
    "ceo-only",
    "governance-seat",
    "engineering-seat",
    "agent-internal",
    "public-disclosure",
  ]),
  retention: z.object({
    citationRef: z.string().min(1),
    minimumYears: z.number().int().positive(),
    archivalTier: z.enum(["hot", "cool", "archive"]),
  }),
  supersedes: z.string().min(1).optional(),
  correctsOriginalErrors: z.boolean().optional(),
  metadata: z
    .object({
      title: z.string(),
      path: z.string(),
      category: z.string(),
      author: z.string().optional(),
      date: z.string().optional(),
      prRef: z.string().optional(),
      // Regulatory-source filing fields (D-REGULATORY-LIBRARY-V1, Slice 1).
      // Present when `category === "regulatory-source"`; the seed-projection
      // hash-links the filed binary to its graph Document node by matching
      // `instrumentId` / `slug`. All additive + optional — back-compatible.
      instrumentId: z.string().optional(),
      slug: z.string().optional(),
      sourceUrl: z.string().optional(),
      contentType: z.string().optional(),
      // Regulatory-excerpt filing fields (D-REGULATORY-LIBRARY-V1, Slice 4).
      // Present when `category === "regulatory-excerpt"`. All additive + optional.
      sectionId: z.string().optional(),
      excerptId: z.string().optional(),
      kind: z.string().optional(),
      pages: z.string().optional(),
      caption: z.string().optional(),
    })
    .optional(),
});

export type RecordFiledPayload = z.infer<typeof recordFiledPayloadSchema>;

export function makeRecordFiled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RecordFiledPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RecordFiled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: recordFiledPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CeoDecisionRmsExtended — additive payload schema for the CeoDecision event.
// Per spec §3.5: not yet wired into envelope-validation for CeoDecision; Slice 3
// will wire it through the registry. Today it is the documented surface for the
// new optional fields.
// ---------------------------------------------------------------------------

export const ceoDecisionRmsExtendedPayloadSchema = z.object({
  // pre-existing fields (unchanged):
  decisionId: z.string().min(1),
  action: z.enum(["approve", "defer", "modify", "request-revision"]),
  title: z.string().min(1),
  outcome: z.string().min(1),
  comment: z.string().optional(),
  /** Legacy markdown-path field — deprecated under RMS, retained for back-compat. */
  sourceDoc: z.string().optional(),
  followOnRoutes: z.array(z.string().min(1)).optional(),
  recordedVia: z.string().min(1),

  // new in RMS Slice 2 (additive, all optional):
  requestEventId: z.string().min(1).optional(),
  recordDocumentHashes: z.array(documentHashSchema).optional(),
  modifiedRecommendation: z
    .object({
      stance: z.string().min(1),
      reasoning: z.string().min(1),
    })
    .optional(),
});

export type CeoDecisionRmsExtendedPayload = z.infer<typeof ceoDecisionRmsExtendedPayloadSchema>;

export const RMS_TYPED_EVENT_TYPES = [
  "DecisionRequested",
  "Feedback",
  "BriefSuperseded",
  "RecordFiled",
] as const;
export type RmsEventType = (typeof RMS_TYPED_EVENT_TYPES)[number];
