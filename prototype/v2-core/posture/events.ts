// v2-core/posture/events.ts
//
// Posture event types — the four typed events that constitute the posture
// register lifecycle (W8 brief §1; Principle 1: events are the only source of
// truth).
//
//   PostureRegistered  — a new posture enters the register
//   PostureActivated   — a registered posture becomes active for a scope
//   PostureDeactivated — a posture is retired for a scope
//   PostureRevised     — a posture's parameters are updated
//
// Design principle: structured-first (D-W8-POSTURE-REGISTER-SLICE-1).
// No weight or external process silently mutates a posture. Every change is
// typed, citable, and replayable. The posture register projection
// (`projection.ts`) folds ONLY these events.
//
// PACKAGE BOUNDARY: no v1 imports permitted.
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import { z } from "zod";
import type { CitationRef, Instant } from "../fil-core/primitives";
import { citationRefSchema, instantSchema } from "../fil-core/primitives";
import { type AppliesToScope, appliesToScopeSchema } from "./applies-when";

// ---------------------------------------------------------------------------
// Posture-class vocabulary
// ---------------------------------------------------------------------------

/**
 * The closed set of posture classes at S3. Aligned with the RAS/risk-taxonomy
 * categories the register needs to carry at launch. The set is extensible via
 * new event registration (Principle 1); a closed enum here is the minimum
 * W8-Slice-1 contract.
 */
export const POSTURE_CLASSES = [
  "risk-appetite", // RAS §B-series appetite lines
  "procedure-variant", // agent procedure variant selection (K|R|C tier)
  "jurisdiction-flag", // jurisdictional on/off toggle
  "product-gate", // product-family operating gate (posture-conditioned)
  "compliance-stance", // obligation-level compliance approach
] as const;

export type PostureClass = (typeof POSTURE_CLASSES)[number];
export const postureClassSchema = z.enum(POSTURE_CLASSES);

/**
 * K|R|C tier applicability from the W8 brief: the tier dimension a posture
 * applies to (`"K"` = kernel, `"R"` = risk, `"C"` = conduct, `"all"` = all
 * tiers). This is the W8 learning layer's tier vocabulary.
 */
export const POSTURE_TIERS = ["K", "R", "C", "all"] as const;
export type PostureTier = (typeof POSTURE_TIERS)[number];
export const postureTierSchema = z.enum(POSTURE_TIERS);

// ---------------------------------------------------------------------------
// Posture event payloads
// ---------------------------------------------------------------------------

/**
 * `PostureRegistered` — a new posture enters the register.
 *
 * `postureId`       — stable slug; convention `posture:<class>:<short-slug>`.
 * `postureClass`    — category from the closed set.
 * `description`     — human-readable statement of what the posture says.
 * `appliesToScope`  — APPLIES_WHEN predicate (typed, evaluable, replayable).
 * `appliesToTier`   — W8 tier dimension.
 * `proposedBy`      — who proposed/authored this posture.
 * `citations`       — Principle 2 upward citations (at minimum the authorising
 *                     decision + RAS section for appetite postures).
 * `parameters`      — optional structured parameters the posture carries
 *                     (e.g. numeric thresholds for risk-appetite postures).
 */
export interface PostureRegisteredPayload {
  readonly postureId: string;
  readonly postureClass: PostureClass;
  readonly description: string;
  readonly appliesToScope: AppliesToScope;
  readonly appliesToTier: PostureTier;
  readonly proposedBy: string;
  readonly citations: readonly CitationRef[];
  readonly parameters?: Readonly<Record<string, unknown>>;
}

// biome-ignore lint/suspicious/noExplicitAny: ZodType<any,any,any> required for recursive AppliesToScope + exactOptionalPropertyTypes compat
export const postureRegisteredPayloadSchema: z.ZodType<any, any, any> = z.object({
  postureId: z.string().min(1),
  postureClass: postureClassSchema,
  description: z.string().min(1),
  appliesToScope: appliesToScopeSchema,
  appliesToTier: postureTierSchema,
  proposedBy: z.string().min(1),
  citations: z.array(citationRefSchema).min(1),
  parameters: z.record(z.unknown()).optional(),
});

/**
 * `PostureActivated` — a registered posture becomes active for a scope.
 *
 * `activatedAt` and `authority` record the governance event that activated
 * the posture. The posture MUST already be registered (a `PostureRegistered`
 * event with the same `postureId` must precede this in the event log); the
 * projection enforces this constraint.
 */
export interface PostureActivatedPayload {
  readonly postureId: string;
  readonly appliesToScope: AppliesToScope;
  readonly activatedAt: Instant;
  readonly authority: string;
  readonly citations: readonly CitationRef[];
}

// biome-ignore lint/suspicious/noExplicitAny: ZodType<any,any,any> required for recursive AppliesToScope + exactOptionalPropertyTypes compat
export const postureActivatedPayloadSchema: z.ZodType<any, any, any> = z.object({
  postureId: z.string().min(1),
  appliesToScope: appliesToScopeSchema,
  activatedAt: instantSchema,
  authority: z.string().min(1),
  citations: z.array(citationRefSchema).min(1),
});

/**
 * `PostureDeactivated` — a posture is retired for a scope.
 *
 * `reason` records why the posture was deactivated — retirement, supersession,
 * or explicit governance decision. This is audit-trail information; Principle 1
 * dictates the event is the record, not any derived state.
 */
export interface PostureDeactivatedPayload {
  readonly postureId: string;
  readonly appliesToScope: AppliesToScope;
  readonly deactivatedAt: Instant;
  readonly reason: string;
}

// biome-ignore lint/suspicious/noExplicitAny: ZodType<any,any,any> required for recursive AppliesToScope + exactOptionalPropertyTypes compat
export const postureDeactivatedPayloadSchema: z.ZodType<any, any, any> = z.object({
  postureId: z.string().min(1),
  appliesToScope: appliesToScopeSchema,
  deactivatedAt: instantSchema,
  reason: z.string().min(1),
});

/**
 * `PostureRevised` — a posture's parameters are updated without deactivation.
 *
 * `revisedFields` carries the new values for only the fields that changed.
 * The description, appliesToScope, and appliesToTier MAY be updated here;
 * if not included in `revisedFields` they are unchanged. The authority field
 * records the governance event that authorised the revision.
 */
export interface PostureRevisedPayload {
  readonly postureId: string;
  readonly revisedFields: Readonly<
    Partial<{
      description: string;
      appliesToScope: AppliesToScope;
      appliesToTier: PostureTier;
      parameters: Readonly<Record<string, unknown>>;
    }>
  >;
  readonly revisedAt: Instant;
  readonly authority: string;
  readonly citations: readonly CitationRef[];
}

// biome-ignore lint/suspicious/noExplicitAny: ZodType<any,any,any> required for recursive AppliesToScope + exactOptionalPropertyTypes compat
export const postureRevisedPayloadSchema: z.ZodType<any, any, any> = z.object({
  postureId: z.string().min(1),
  revisedFields: z.object({
    description: z.string().optional(),
    appliesToScope: appliesToScopeSchema.optional(),
    appliesToTier: postureTierSchema.optional(),
    parameters: z.record(z.unknown()).optional(),
  }),
  revisedAt: instantSchema,
  authority: z.string().min(1),
  citations: z.array(citationRefSchema).min(1),
});

// ---------------------------------------------------------------------------
// Discriminated union of all posture event payloads
// ---------------------------------------------------------------------------

export type PostureEventPayload =
  | ({ readonly kind: "PostureRegistered" } & PostureRegisteredPayload)
  | ({ readonly kind: "PostureActivated" } & PostureActivatedPayload)
  | ({ readonly kind: "PostureDeactivated" } & PostureDeactivatedPayload)
  | ({ readonly kind: "PostureRevised" } & PostureRevisedPayload);

export const POSTURE_EVENT_KINDS = [
  "PostureRegistered",
  "PostureActivated",
  "PostureDeactivated",
  "PostureRevised",
] as const;

export type PostureEventKind = (typeof POSTURE_EVENT_KINDS)[number];
