// platform/event-store/registry/applicability-assessment.ts
//
// Registry rows (F-032) for the V2 S8 applicability-assessment event family:
//   ApplicabilityAssessmentRequested — a trigger opens an assessment
//   ApplicabilityAssessmentPerformed — the evaluator ran over candidate contexts
//   ApplicabilityAssessmentConcluded — the verdict + matched contexts
//
// The assessment register is a projection over these events
// (`v2-core/applicability/projection.ts`, folded by
// `recon:v2-applicability-assessment-integrity`). The three events fold by
// assessmentId; Concluded supersedes per key (latest-wins-per-key, P1).
//
// Retention: governance-7y — applicability assessments are real regulatory
// records that determine which obligations / postures bind which contexts
// (Principle 2 upward citations to the authorising decision + regulatory source).
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// F-032 (event-type registration).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import type { z } from "zod";
import {
  applicabilityAssessmentConcludedPayloadSchema,
  applicabilityAssessmentPerformedPayloadSchema,
  applicabilityAssessmentRequestedPayloadSchema,
} from "../event-types/applicability-assessment";
import { type EventTypeMetadata, RETENTION_GOVERNANCE_7Y } from "./types";

const CITATIONS = [
  "D-W8-POSTURE-REGISTER-SLICE-1",
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
  "P6-AUTONOMOUS-BY-DEFAULT",
] as const;

const SUBSCRIBERS = ["Mira", "Zara", "Helena", "Atlas", "Vera", "Scrooge"];

export const APPLICABILITY_ASSESSMENT_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "ApplicabilityAssessmentRequested",
    class: "governance",
    issuer: "Mira",
    subscribers: SUBSCRIBERS,
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: applicabilityAssessmentRequestedPayloadSchema as unknown as z.ZodType<
      Record<string, unknown>
    >,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/applicability-assessment.ts",
    v2Status: "v1-only",
  },
  {
    type: "ApplicabilityAssessmentPerformed",
    class: "governance",
    issuer: "Mira",
    subscribers: SUBSCRIBERS,
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: applicabilityAssessmentPerformedPayloadSchema as unknown as z.ZodType<
      Record<string, unknown>
    >,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/applicability-assessment.ts",
    v2Status: "v1-only",
  },
  {
    type: "ApplicabilityAssessmentConcluded",
    class: "governance",
    issuer: "Mira",
    subscribers: SUBSCRIBERS,
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: applicabilityAssessmentConcludedPayloadSchema as unknown as z.ZodType<
      Record<string, unknown>
    >,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/applicability-assessment.ts",
    v2Status: "v1-only",
  },
];
