// v2-core/applicability/events.ts
//
// Applicability-assessment event family (V2 S8). The typed lifecycle that turns
// "here is a new rule / candidate posture / obligation" into "here is exactly
// what contexts it binds, asserted and replayable" (Principle 1 + Principle 2).
//
//   ApplicabilityAssessmentRequested — a trigger opens an assessment, carrying
//                                       the subject's AppliesToScope predicate.
//   ApplicabilityAssessmentPerformed — the evaluator ran over the candidate
//                                       contexts; records what was evaluated +
//                                       which contexts matched.
//   ApplicabilityAssessmentConcluded — the verdict (applies | does-not-apply |
//                                       partially-applies) + the matched contexts.
//
// Design principle: structured-first (D-W8-POSTURE-REGISTER-SLICE-1). The
// assessment engine (`engine.ts`) is pure — given an AppliesToScope and a set of
// candidate PostureContexts it produces the verdict; the lifecycle events are the
// only durable record. The register projection (`projection.ts`) folds ONLY these
// three events. The S3 APPLIES_WHEN evaluator (`evaluateAppliesToScope`) is reused
// unchanged — S8 adds no new predicate types.
//
// PACKAGE BOUNDARY: this file MUST NOT import from v1 (`platform/`, `runtime/`,
// `domains/`, etc.). The no-v1-import gate (`recon:v2-no-v1-import`) enforces this.
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Mira (Chief Obligations & Regulatory Officer, compliance),
//         with input from Zara (Chief Compliance Officer, governance) on the
//         conduct/compliance assessment dimension.

import { z } from "zod";
import type { CitationRef, Instant } from "../fil-core/primitives";
import { citationRefSchema, instantSchema } from "../fil-core/primitives";
import { type AppliesToScope, appliesToScopeSchema, postureContextSchema } from "../posture";
import type { PostureContext } from "../posture";

// ---------------------------------------------------------------------------
// Verdict vocabulary
// ---------------------------------------------------------------------------

/**
 * The closed set of assessment verdicts:
 *   `applies`           — the subject's scope holds for ALL candidate contexts.
 *   `does-not-apply`    — the subject's scope holds for NO candidate context.
 *   `partially-applies` — the subject's scope holds for SOME (but not all)
 *                         candidate contexts.
 *
 * The verdict is derived deterministically by the engine from the match set
 * over the candidate contexts; it is never hand-asserted independently of the
 * matches (the recon gate checks this consistency).
 */
export const APPLICABILITY_VERDICTS = ["applies", "does-not-apply", "partially-applies"] as const;

export type ApplicabilityVerdict = (typeof APPLICABILITY_VERDICTS)[number];
export const applicabilityVerdictSchema = z.enum(APPLICABILITY_VERDICTS);

// ---------------------------------------------------------------------------
// AssessedContext — a candidate context paired with its label
// ---------------------------------------------------------------------------

/**
 * A candidate evaluation context carrying a stable label so the matched-context
 * set in the verdict is human-readable and citable. The `context` field is the
 * S3 `PostureContext` passed to `evaluateAppliesToScope`; the `contextRef` is a
 * stable identifier for the context (e.g. an entity URN, a product taxonomy
 * scope, or a jurisdiction code).
 */
export interface AssessedContext {
  /** Stable identifier for this candidate context (entity / product / jurisdiction). */
  readonly contextRef: string;
  /** The S3 PostureContext evaluated by `evaluateAppliesToScope`. */
  readonly context: PostureContext;
}

export const assessedContextSchema: z.ZodType<AssessedContext> = z.object({
  contextRef: z.string().min(1),
  context: postureContextSchema,
});

// ---------------------------------------------------------------------------
// ApplicabilityAssessmentRequested
// ---------------------------------------------------------------------------

/**
 * `ApplicabilityAssessmentRequested` — a trigger opens an assessment.
 *
 * `assessmentId`   — stable slug; convention `assessment:<subject-kind>:<slug>:<as-of-date>`.
 * `subjectRef`     — what is being assessed (a posture id, an obligation URN, a
 *                    candidate posture ref, or a decision id for S9 sweeps).
 * `subjectKind`    — typed discriminator of the subject's nature.
 * `appliesToScope` — the subject's APPLIES_WHEN predicate (the thing being tested).
 * `requestedBy`    — who/what opened the assessment.
 * `citations`      — Principle 2 upward citations (authorising decision +
 *                    the regulatory source of the subject).
 */
export const APPLICABILITY_SUBJECT_KINDS = [
  "posture", // an existing/candidate posture (its appliesToScope)
  "obligation", // a regulatory obligation URN
  "regulatory-change", // an inbound regulatory change carrying a scope
  "decision", // a decision (S9 decision-impact sweep trigger)
] as const;

export type ApplicabilitySubjectKind = (typeof APPLICABILITY_SUBJECT_KINDS)[number];
export const applicabilitySubjectKindSchema = z.enum(APPLICABILITY_SUBJECT_KINDS);

export interface ApplicabilityAssessmentRequestedPayload {
  readonly assessmentId: string;
  readonly subjectRef: string;
  readonly subjectKind: ApplicabilitySubjectKind;
  readonly appliesToScope: AppliesToScope;
  readonly requestedBy: string;
  readonly citations: readonly CitationRef[];
}

// biome-ignore lint/suspicious/noExplicitAny: ZodType<any,any,any> required for recursive AppliesToScope + exactOptionalPropertyTypes compat
export const applicabilityAssessmentRequestedPayloadSchema: z.ZodType<any, any, any> = z.object({
  assessmentId: z.string().min(1),
  subjectRef: z.string().min(1),
  subjectKind: applicabilitySubjectKindSchema,
  appliesToScope: appliesToScopeSchema,
  requestedBy: z.string().min(1),
  citations: z.array(citationRefSchema).min(1),
});

// ---------------------------------------------------------------------------
// ApplicabilityAssessmentPerformed
// ---------------------------------------------------------------------------

/**
 * `ApplicabilityAssessmentPerformed` — the evaluator ran over the candidate
 * contexts.
 *
 * `contextsEvaluated` — every candidate context the engine tested (label + the
 *                       PostureContext). This is the full input set, recorded so
 *                       the recon gate can re-run `evaluateAppliesToScope` over
 *                       the recorded scope and confirm the matches.
 * `matches`           — the subset of `contextsEvaluated` (by contextRef) whose
 *                       predicate held.
 * `performedBy`       — who/what ran the engine.
 */
export interface ApplicabilityAssessmentPerformedPayload {
  readonly assessmentId: string;
  readonly contextsEvaluated: readonly AssessedContext[];
  readonly matches: readonly string[];
  readonly performedBy: string;
  readonly performedAt: Instant;
}

// biome-ignore lint/suspicious/noExplicitAny: ZodType<any,any,any> required for nested AppliesToScope + exactOptionalPropertyTypes compat
export const applicabilityAssessmentPerformedPayloadSchema: z.ZodType<any, any, any> = z.object({
  assessmentId: z.string().min(1),
  contextsEvaluated: z.array(assessedContextSchema).min(1),
  matches: z.array(z.string()),
  performedBy: z.string().min(1),
  performedAt: instantSchema,
});

// ---------------------------------------------------------------------------
// ApplicabilityAssessmentConcluded
// ---------------------------------------------------------------------------

/**
 * `ApplicabilityAssessmentConcluded` — the verdict.
 *
 * `verdict`          — applies | does-not-apply | partially-applies.
 * `appliesToContexts`— the matched context refs the verdict binds to.
 * `rationale`        — human-readable statement of why this verdict.
 * `concludedBy`      — who/what concluded the assessment.
 * `citations`        — Principle 2 upward citations.
 */
export interface ApplicabilityAssessmentConcludedPayload {
  readonly assessmentId: string;
  readonly verdict: ApplicabilityVerdict;
  readonly appliesToContexts: readonly string[];
  readonly rationale: string;
  readonly concludedBy: string;
  readonly concludedAt: Instant;
  readonly citations: readonly CitationRef[];
}

// biome-ignore lint/suspicious/noExplicitAny: ZodType<any,any,any> for exactOptionalPropertyTypes compat with the rest of the family
export const applicabilityAssessmentConcludedPayloadSchema: z.ZodType<any, any, any> = z.object({
  assessmentId: z.string().min(1),
  verdict: applicabilityVerdictSchema,
  appliesToContexts: z.array(z.string()),
  rationale: z.string().min(1),
  concludedBy: z.string().min(1),
  concludedAt: instantSchema,
  citations: z.array(citationRefSchema).min(1),
});

// ---------------------------------------------------------------------------
// Discriminated union of all applicability-assessment event payloads
// ---------------------------------------------------------------------------

export type ApplicabilityAssessmentEventPayload =
  | ({ readonly kind: "ApplicabilityAssessmentRequested" } & ApplicabilityAssessmentRequestedPayload)
  | ({ readonly kind: "ApplicabilityAssessmentPerformed" } & ApplicabilityAssessmentPerformedPayload)
  | ({
      readonly kind: "ApplicabilityAssessmentConcluded";
    } & ApplicabilityAssessmentConcludedPayload);

export const APPLICABILITY_ASSESSMENT_EVENT_KINDS = [
  "ApplicabilityAssessmentRequested",
  "ApplicabilityAssessmentPerformed",
  "ApplicabilityAssessmentConcluded",
] as const;

export type ApplicabilityAssessmentEventKind =
  (typeof APPLICABILITY_ASSESSMENT_EVENT_KINDS)[number];
